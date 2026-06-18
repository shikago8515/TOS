from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from utils.credential_crypto import decrypt_secret, encrypt_secret
from utils.minio_storage import (
    build_object_key,
    download_url_bytes,
    get_minio_bucket,
    get_object_response,
    put_object_bytes,
    sanitize_object_segment,
    sha256_bytes,
)
from utils.mysql_store import (
    create_automation_run,
    delete_automation_credentials,
    get_automation_credentials,
    get_automation_run,
    get_excel_template,
    insert_automation_run_file,
    list_automation_credentials,
    list_automation_runs,
    list_excel_templates,
    update_automation_run,
    upsert_automation_credentials,
    upsert_excel_template,
)


router = APIRouter(prefix="/automation", tags=["Automation Storage"])

INFOR_NEXUS_SHARED_CREDENTIAL_IDS = (
    "shipping-automation",
    "shipping-automation-demo",
    "shipping-automation-2",
    "xinlongtai-shipping-automation",
    "po-auto-download",
    "released-bulk-automation",
)


class CredentialPayload(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    accountKey: str = "default"


class RunFilePayload(BaseModel):
    url: str
    fileName: str = ""
    fileRole: str = "result_file"
    contentType: str = ""


class RunUpdatePayload(BaseModel):
    status: str
    message: str = ""
    result: Any = None
    resultFiles: list[RunFilePayload] = Field(default_factory=list)


@router.get("/credentials/{automation_id}/accounts")
async def list_credentials(automation_id: str) -> dict[str, Any]:
    accounts: list[dict[str, Any]] = []
    seen_account_keys: set[str] = set()
    for source_automation_id in _credential_lookup_ids(automation_id):
        for row in list_automation_credentials(source_automation_id):
            account_key = _normalize_account_key(row.get("account_key"))
            if account_key in seen_account_keys:
                continue
            seen_account_keys.add(account_key)
            accounts.append(_credential_account_payload(automation_id, row, source_automation_id))

    return {
        "ok": True,
        "automationId": automation_id,
        "accounts": accounts,
    }


@router.get("/credentials/{automation_id}")
async def read_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    return _credential_public_payload(automation_id, account_key, row, source_automation_id)


@router.put("/credentials/{automation_id}")
async def save_credentials(automation_id: str, payload: CredentialPayload) -> dict[str, Any]:
    username = payload.username.strip()
    password = payload.password
    account_key = _normalize_account_key(payload.accountKey)
    if not username or not password:
        raise HTTPException(status_code=400, detail="请填写当前网站登录账号密码。")

    row = upsert_automation_credentials(
        automation_id,
        account_key,
        username,
        encrypt_secret(password),
    )
    return _credential_public_payload(automation_id, account_key, row, automation_id)


@router.delete("/credentials/{automation_id}")
async def clear_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    delete_automation_credentials(source_automation_id if row else automation_id, account_key)
    return _credential_public_payload(automation_id, account_key, None, source_automation_id)


@router.post("/credentials/{automation_id}/resolve")
async def resolve_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    if not row:
        raise HTTPException(status_code=404, detail="未保存当前网站登录账号密码。请先填写并保存。")
    return {
        "ok": True,
        "automationId": automation_id,
        "sourceAutomationId": source_automation_id,
        "accountKey": account_key,
        "username": row["username"],
        "password": decrypt_secret(row["password_ciphertext"]),
    }


@router.get("/templates")
async def read_templates(moduleId: str = Query(...)) -> dict[str, Any]:
    templates = [_template_payload(row) for row in list_excel_templates(moduleId)]
    return {
        "ok": True,
        "moduleId": moduleId,
        "templates": templates,
    }


@router.post("/templates")
async def upload_template(
    module_id: str = Form(...),
    template_key: str = Form("default"),
    display_name: str = Form("Excel 模板"),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    safe_filename = sanitize_object_segment(file.filename or "template.xlsx")
    if not safe_filename.lower().endswith((".xlsx", ".xls", ".xlsm")):
        raise HTTPException(status_code=400, detail="Template file must be an Excel workbook.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Template file is empty.")

    bucket = get_minio_bucket("templates")
    object_key = build_object_key("templates", module_id, template_key, safe_filename)
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type=file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    row = upsert_excel_template({
        "module_id": module_id,
        "template_key": template_key or "default",
        "display_name": display_name or safe_filename,
        "bucket": storage_record["bucket"],
        "object_key": storage_record["object_key"],
        "original_filename": safe_filename,
        "content_type": file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })
    return {
        "ok": True,
        "template": _template_payload(row),
    }


@router.get("/templates/{template_id}/download")
async def download_template(template_id: int):
    row = get_excel_template(template_id)
    if not row:
        raise HTTPException(status_code=404, detail="Template was not found.")

    response = get_object_response(row["bucket"], row["object_key"])
    filename = row.get("original_filename") or f"template-{template_id}.xlsx"
    headers = {
        "Content-Disposition": _attachment_content_disposition(filename),
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(32 * 1024),
        media_type=row.get("content_type") or "application/octet-stream",
        headers=headers,
        background=None,
    )


@router.post("/runs")
async def create_run(
    automation_id: str = Form(...),
    module_id: str = Form(""),
    run_name: str = Form(""),
    message: str = Form(""),
    source_file: UploadFile | None = File(None),
) -> dict[str, Any]:
    run_id = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:10]}"
    row = create_automation_run({
        "run_id": run_id,
        "automation_id": automation_id,
        "module_id": module_id or automation_id,
        "run_name": run_name or automation_id,
        "status": "running",
        "message": message,
        "started_at": datetime.utcnow(),
    })

    files: list[dict[str, Any]] = []
    if source_file is not None and source_file.filename:
        files.append(await _store_upload_file(
            run_id=run_id,
            automation_id=automation_id,
            upload=source_file,
            file_role="source_excel",
            bucket_key="run_files",
        ))

    return {
        "ok": True,
        "run": _run_payload(row),
        "files": files,
    }


@router.patch("/runs/{run_id}")
async def finish_run(run_id: str, payload: RunUpdatePayload) -> dict[str, Any]:
    if not get_automation_run(run_id):
        raise HTTPException(status_code=404, detail="Automation run was not found.")

    row = update_automation_run(
        run_id,
        payload.status,
        payload.message,
        payload.result,
        datetime.utcnow(),
    )
    files: list[dict[str, Any]] = []
    if payload.result is not None:
        files.append(_store_result_json(run_id, row["automation_id"], payload.result))

    for file_payload in payload.resultFiles:
        files.append(_store_remote_result_file(run_id, row["automation_id"], file_payload))

    return {
        "ok": True,
        "run": _run_payload(row),
        "files": files,
    }


@router.get("/runs")
async def read_runs(
    automationId: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
) -> dict[str, Any]:
    runs = [_run_payload(row) for row in list_automation_runs(automationId, limit)]
    return {
        "ok": True,
        "runs": runs,
    }


def _credential_public_payload(
    automation_id: str,
    account_key: str,
    row: dict[str, Any] | None,
    source_automation_id: str | None = None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "automationId": automation_id,
        "sourceAutomationId": source_automation_id or automation_id,
        "accountKey": account_key,
        "hasStoredCredentials": bool(row),
        "username": row["username"] if row else "",
    }


def _credential_account_payload(
    automation_id: str,
    row: dict[str, Any],
    source_automation_id: str,
) -> dict[str, Any]:
    return {
        "automationId": automation_id,
        "sourceAutomationId": source_automation_id,
        "accountKey": _normalize_account_key(row.get("account_key")),
        "hasStoredCredentials": True,
        "username": row.get("username", ""),
        "createdAt": _format_datetime(row.get("created_at")),
        "updatedAt": _format_datetime(row.get("updated_at")),
    }


def _get_credentials_with_alias(automation_id: str, account_key: str) -> tuple[dict[str, Any] | None, str]:
    account_key = _normalize_account_key(account_key)
    for candidate_id in _credential_lookup_ids(automation_id):
        row = get_automation_credentials(candidate_id, account_key)
        if row:
            return row, candidate_id
    return None, automation_id


def _normalize_account_key(value: Any) -> str:
    key = str(value or "default").strip()
    return (key or "default")[:120]


def _credential_lookup_ids(automation_id: str) -> list[str]:
    lookup_ids = [automation_id]
    if automation_id in INFOR_NEXUS_SHARED_CREDENTIAL_IDS:
        lookup_ids.extend(
            candidate_id
            for candidate_id in INFOR_NEXUS_SHARED_CREDENTIAL_IDS
            if candidate_id not in lookup_ids
        )
    return lookup_ids


def _template_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "moduleId": row["module_id"],
        "templateKey": row["template_key"],
        "displayName": row["display_name"],
        "originalFilename": row.get("original_filename", ""),
        "contentType": row.get("content_type", ""),
        "fileSize": row.get("file_size", 0),
        "sha256": row.get("sha256", ""),
        "downloadPath": f"/api/automation/templates/{row['id']}/download",
    }


def _attachment_content_disposition(filename: str) -> str:
    ascii_filename = filename.encode("ascii", errors="ignore").decode("ascii").strip()
    fallback_filename = ascii_filename or "template.xlsx"
    quoted_filename = quote(filename, safe="")
    return f'attachment; filename="{fallback_filename}"; filename*=UTF-8\'\'{quoted_filename}'


def _run_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "runId": row["run_id"],
        "automationId": row["automation_id"],
        "moduleId": row["module_id"],
        "runName": row.get("run_name", ""),
        "status": row.get("status", ""),
        "message": row.get("message", ""),
        "result": _safe_json_loads(row.get("result_json")),
        "startedAt": _format_datetime(row.get("started_at")),
        "finishedAt": _format_datetime(row.get("finished_at")),
        "createdAt": _format_datetime(row.get("created_at")),
        "updatedAt": _format_datetime(row.get("updated_at")),
    }


async def _store_upload_file(
    *,
    run_id: str,
    automation_id: str,
    upload: UploadFile,
    file_role: str,
    bucket_key: str,
) -> dict[str, Any]:
    content = await upload.read()
    filename = sanitize_object_segment(upload.filename or "upload.xlsx")
    bucket = get_minio_bucket(bucket_key)
    object_key = build_object_key("runs", automation_id, run_id, file_role, filename)
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type=upload.content_type or "application/octet-stream",
    )
    return insert_automation_run_file({
        "run_id": run_id,
        "file_role": file_role,
        "bucket": bucket,
        "object_key": object_key,
        "original_filename": filename,
        "content_type": upload.content_type or "application/octet-stream",
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })


def _store_result_json(run_id: str, automation_id: str, result: Any) -> dict[str, Any]:
    content = json.dumps(result, ensure_ascii=False, indent=2).encode("utf-8")
    bucket = get_minio_bucket("results")
    object_key = build_object_key("results", automation_id, run_id, "result.json")
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type="application/json; charset=utf-8",
    )
    return insert_automation_run_file({
        "run_id": run_id,
        "file_role": "result_json",
        "bucket": bucket,
        "object_key": object_key,
        "original_filename": "result.json",
        "content_type": "application/json; charset=utf-8",
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })


def _store_remote_result_file(run_id: str, automation_id: str, file_payload: RunFilePayload) -> dict[str, Any]:
    if not file_payload.url.lower().startswith(("http://127.0.0.1:", "http://localhost:")):
        raise HTTPException(status_code=400, detail="Only local executor artifact URLs can be stored.")

    content, detected_content_type = download_url_bytes(file_payload.url)
    filename = sanitize_object_segment(file_payload.fileName or file_payload.url.split("/")[-1] or "result-file")
    content_type = file_payload.contentType or detected_content_type or "application/octet-stream"
    bucket = get_minio_bucket("results")
    object_key = build_object_key("results", automation_id, run_id, file_payload.fileRole, filename)
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type=content_type,
    )
    return insert_automation_run_file({
        "run_id": run_id,
        "file_role": file_payload.fileRole,
        "bucket": bucket,
        "object_key": object_key,
        "original_filename": filename,
        "content_type": content_type,
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"] or sha256_bytes(content),
    })


def _safe_json_loads(value: Any) -> Any:
    if not value:
        return None
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _format_datetime(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")
