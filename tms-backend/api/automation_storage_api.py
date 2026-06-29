from __future__ import annotations

import base64
import binascii
from io import BytesIO
import json
import logging
from datetime import datetime
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
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
    count_automation_runs,
    create_automation_run,
    delete_automation_credentials,
    delete_excel_template,
    get_automation_run_file,
    get_automation_credentials,
    get_automation_run,
    get_excel_template,
    insert_automation_run_file,
    list_automation_credentials,
    list_automation_run_files,
    list_automation_runs,
    list_excel_templates,
    update_automation_run,
    update_excel_template,
    upsert_automation_credentials,
    upsert_excel_template,
)


router = APIRouter(prefix="/automation", tags=["Automation Storage"])
logger = logging.getLogger(__name__)

INFOR_NEXUS_SHARED_CREDENTIAL_IDS = (
    "shipping-automation",
    "shipping-automation-demo",
    "shipping-automation-2",
    "xinlongtai-shipping-automation",
    "po-auto-download",
    "released-bulk-automation",
)

MICROSOFT_SHARED_CREDENTIAL_IDS = (
    "microsoft-login-n8n",
    "ticket-owner-statistics",
)

TICKET_OWNER_AUTOMATION_ID = "ticket-owner-statistics"
TICKET_OWNER_COLUMNS = (
    "Case Number",
    "Task Type",
    "Request",
    "PO Number",
    "Working Number",
    "Factory",
    "Merch",
)
TICKET_OWNER_EXCEL_NAME = "Ticket ownership.xlsx"
EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class CredentialPayload(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    accountKey: str = "default"


class RunFilePayload(BaseModel):
    url: str
    fileName: str = ""
    fileRole: str = "result_file"
    contentType: str = ""
    contentBase64: str = ""


class RunUpdatePayload(BaseModel):
    status: str
    message: str = ""
    result: Any = None
    resultFiles: list[RunFilePayload] = Field(default_factory=list)


class TemplateUpdatePayload(BaseModel):
    moduleId: str | None = None
    templateKey: str | None = None
    displayName: str | None = None
    isActive: bool | None = None


@router.get("/credentials/{automation_id}/accounts")
def list_credentials(automation_id: str) -> dict[str, Any]:
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
def read_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    return _credential_public_payload(automation_id, account_key, row, source_automation_id)


@router.put("/credentials/{automation_id}")
def save_credentials(automation_id: str, payload: CredentialPayload) -> dict[str, Any]:
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
def clear_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    delete_automation_credentials(source_automation_id if row else automation_id, account_key)
    return _credential_public_payload(automation_id, account_key, None, source_automation_id)


@router.post("/credentials/{automation_id}/resolve")
def resolve_credentials(automation_id: str, accountKey: str = Query("default")) -> dict[str, Any]:
    account_key = _normalize_account_key(accountKey)
    row, source_automation_id = _get_credentials_with_alias(automation_id, account_key)
    if not row:
        raise HTTPException(status_code=404, detail="未保存当前网站登录账号密码。请先填写并保存。")
    try:
        password = decrypt_secret(row["password_ciphertext"])
    except ValueError as exc:
        logger.warning(
            "Automation credential decrypt failed: automation_id=%s source_automation_id=%s account_key=%s",
            automation_id,
            source_automation_id,
            account_key,
        )
        raise HTTPException(
            status_code=409,
            detail=(
                "已找到该 Infor Nexus 账号记录，但本机后端无法解密密码。"
                "请确认本机 tms-backend/config/settings.yaml 中的 security.credential_key "
                "与保存该密码时使用的后端一致；如果当前连接的是远程数据库，请使用服务器同一套凭据密钥。"
            ),
        ) from exc
    return {
        "ok": True,
        "automationId": automation_id,
        "sourceAutomationId": source_automation_id,
        "accountKey": account_key,
        "username": row["username"],
        "password": password,
    }


@router.get("/templates")
def read_templates(
    moduleId: str | None = Query(None),
    includeInactive: bool = Query(False),
    limit: int = Query(500, ge=1, le=1000),
) -> dict[str, Any]:
    templates = [
        _template_payload(row)
        for row in list_excel_templates(moduleId, include_inactive=includeInactive, limit=limit)
    ]
    return {
        "ok": True,
        "moduleId": moduleId or "",
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


@router.patch("/templates/{template_id}")
def update_template(template_id: int, payload: TemplateUpdatePayload) -> dict[str, Any]:
    if not get_excel_template(template_id, include_inactive=True):
        raise HTTPException(status_code=404, detail="模板记录不存在。")

    updates: dict[str, Any] = {}
    if payload.moduleId is not None:
        updates["module_id"] = payload.moduleId.strip()
    if payload.templateKey is not None:
        updates["template_key"] = payload.templateKey.strip() or "default"
    if payload.displayName is not None:
        updates["display_name"] = payload.displayName.strip() or "Excel 模板"
    if payload.isActive is not None:
        updates["is_active"] = 1 if payload.isActive else 0

    row = update_excel_template(template_id, updates)
    if not row:
        raise HTTPException(status_code=404, detail="模板记录不存在。")
    return {
        "ok": True,
        "template": _template_payload(row),
    }


@router.delete("/templates/{template_id}")
def delete_template(template_id: int) -> dict[str, Any]:
    if not delete_excel_template(template_id):
        raise HTTPException(status_code=404, detail="模板记录不存在或已经删除。")
    return {
        "ok": True,
        "templateId": template_id,
    }


@router.get("/templates/{template_id}/download")
def download_template(template_id: int):
    row = get_excel_template(template_id)
    if not row:
        raise HTTPException(status_code=404, detail="当前模块的 Excel 模板未配置，请联系管理员上传模板。")

    try:
        response = get_object_response(row["bucket"], row["object_key"])
    except Exception as exc:
        _raise_template_storage_error(template_id, row, exc)
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
    warnings: list[str] = []
    if source_file is not None and source_file.filename:
        stored_file = await _try_store_upload_file(
            run_id=run_id,
            automation_id=automation_id,
            upload=source_file,
            file_role="source_excel",
            bucket_key="run_files",
            warnings=warnings,
        )
        if stored_file:
            files.append(stored_file)

    return {
        "ok": True,
        "run": _run_payload(row),
        "files": [_run_file_payload(file_row) for file_row in files],
        "warnings": warnings,
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
    warnings: list[str] = []
    server_generated_roles: set[str] = set()
    if payload.result is not None:
        result_file = _try_store_result_json(run_id, row["automation_id"], payload.result, warnings)
        if result_file:
            files.append(result_file)
        ticket_owner_file = _try_store_ticket_owner_excel(
            run_id,
            row["automation_id"],
            payload.result,
            warnings,
        )
        if ticket_owner_file:
            files.append(ticket_owner_file)
            server_generated_roles.add("result_excel")

    for file_payload in payload.resultFiles:
        if file_payload.fileRole in server_generated_roles:
            continue
        result_file = _try_store_remote_result_file(run_id, row["automation_id"], file_payload, warnings)
        if result_file:
            files.append(result_file)

    return {
        "ok": True,
        "run": _run_payload(row),
        "files": [_run_file_payload(file_row) for file_row in files],
        "warnings": warnings,
    }


@router.get("/runs")
def read_runs(
    automationId: str | None = Query(None),
    moduleId: str | None = Query(None),
    status: str | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
    limit: int | None = Query(None, ge=1, le=100),
) -> dict[str, Any]:
    try:
        effective_page_size = limit or pageSize
        offset = (page - 1) * effective_page_size
        total = count_automation_runs(
            automationId,
            module_id=moduleId,
            status=status,
            keyword=keyword,
        )
        runs = [
            _run_payload(row)
            for row in list_automation_runs(
                automationId,
                effective_page_size,
                module_id=moduleId,
                status=status,
                keyword=keyword,
                offset=offset,
            )
        ]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to read automation run records.")
        raise HTTPException(
            status_code=503,
            detail="无法读取自动化执行记录：远程 MySQL 数据库暂时不可用或连接被服务器断开。请确认 172.16.48.208 的 MySQL 服务正常后重试。",
        ) from exc
    return {
        "ok": True,
        "runs": runs,
        "pagination": {
            "page": page,
            "pageSize": effective_page_size,
            "total": total,
        },
    }


@router.get("/runs/{run_id}")
def read_run_detail(run_id: str) -> dict[str, Any]:
    row = get_automation_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Automation run was not found.")
    return {
        "ok": True,
        "run": _run_payload(row),
        "files": [_run_file_payload(file_row) for file_row in list_automation_run_files(run_id)],
    }


@router.get("/runs/{run_id}/files")
def read_run_files(run_id: str) -> dict[str, Any]:
    if not get_automation_run(run_id):
        raise HTTPException(status_code=404, detail="Automation run was not found.")
    return {
        "ok": True,
        "runId": run_id,
        "files": [_run_file_payload(row) for row in list_automation_run_files(run_id)],
    }


@router.get("/run-files/{file_id}/download")
def download_run_file(file_id: int):
    row = get_automation_run_file(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="执行文件不存在。")

    try:
        response = get_object_response(row["bucket"], row["object_key"])
    except Exception as exc:
        logger.exception(
            "Failed to download automation run file: file_id=%s bucket=%s object_key=%s",
            file_id,
            row.get("bucket"),
            row.get("object_key"),
        )
        raise HTTPException(
            status_code=503,
            detail="执行文件暂时无法下载，请联系管理员检查 MinIO 存储连接。",
        ) from exc

    filename = row.get("original_filename") or f"automation-file-{file_id}"
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
    if automation_id in MICROSOFT_SHARED_CREDENTIAL_IDS:
        lookup_ids.extend(
            candidate_id
            for candidate_id in MICROSOFT_SHARED_CREDENTIAL_IDS
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
        "isActive": bool(row.get("is_active", 1)),
        "downloadPath": f"/api/automation/templates/{row['id']}/download",
        "createdAt": _format_datetime(row.get("created_at")),
        "updatedAt": _format_datetime(row.get("updated_at")),
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


def _run_file_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "runId": row["run_id"],
        "fileRole": row["file_role"],
        "bucket": row["bucket"],
        "objectKey": row["object_key"],
        "originalFilename": row.get("original_filename", ""),
        "contentType": row.get("content_type", ""),
        "fileSize": row.get("file_size", 0),
        "sha256": row.get("sha256", ""),
        "createdAt": _format_datetime(row.get("created_at")),
        "downloadPath": f"/api/automation/run-files/{row['id']}/download",
    }


async def _try_store_upload_file(
    *,
    run_id: str,
    automation_id: str,
    upload: UploadFile,
    file_role: str,
    bucket_key: str,
    warnings: list[str],
) -> dict[str, Any] | None:
    try:
        return await _store_upload_file(
            run_id=run_id,
            automation_id=automation_id,
            upload=upload,
            file_role=file_role,
            bucket_key=bucket_key,
        )
    except Exception:
        logger.exception("Failed to store automation run upload file.")
        warnings.append("File storage is unavailable; run record was kept without attached source file.")
        return None


def _try_store_result_json(
    run_id: str,
    automation_id: str,
    result: Any,
    warnings: list[str],
) -> dict[str, Any] | None:
    try:
        return _store_result_json(run_id, automation_id, result)
    except Exception:
        logger.exception("Failed to store automation run result JSON.")
        warnings.append("File storage is unavailable; run result was kept without attached result JSON.")
        return None


def _try_store_ticket_owner_excel(
    run_id: str,
    automation_id: str,
    result: Any,
    warnings: list[str],
) -> dict[str, Any] | None:
    if automation_id != TICKET_OWNER_AUTOMATION_ID or not isinstance(result, dict):
        return None
    rows = result.get("rows")
    if not isinstance(rows, list):
        return None

    try:
        content = _build_ticket_owner_workbook_bytes(rows)
        return _store_result_file_bytes(
            run_id=run_id,
            automation_id=automation_id,
            file_role="result_excel",
            filename=TICKET_OWNER_EXCEL_NAME,
            content=content,
            content_type=EXCEL_CONTENT_TYPE,
        )
    except Exception:
        logger.exception("Failed to build server-side ticket ownership workbook.")
        warnings.append("File storage is unavailable; ticket ownership Excel was not generated on the server.")
        return None


def _try_store_remote_result_file(
    run_id: str,
    automation_id: str,
    file_payload: RunFilePayload,
    warnings: list[str],
) -> dict[str, Any] | None:
    try:
        return _store_remote_result_file(run_id, automation_id, file_payload)
    except Exception:
        logger.exception("Failed to store automation run remote result file.")
        warnings.append("File storage is unavailable; run result was kept without one attached file.")
        return None


def _raise_template_storage_error(template_id: int, row: dict[str, Any], exc: Exception) -> None:
    error_code = str(getattr(exc, "code", "") or getattr(exc, "response", "") or "")
    if error_code in {"NoSuchKey", "NoSuchBucket", "NoSuchObject"}:
        logger.warning(
            "Automation template object missing: template_id=%s bucket=%s object_key=%s code=%s",
            template_id,
            row.get("bucket"),
            row.get("object_key"),
            error_code,
        )
        raise HTTPException(
            status_code=404,
            detail="模板文件不存在或已从 MinIO 删除，请联系管理员重新上传模板。",
        ) from exc

    logger.exception(
        "Failed to download automation template: template_id=%s bucket=%s object_key=%s",
        template_id,
        row.get("bucket"),
        row.get("object_key"),
    )
    raise HTTPException(
        status_code=503,
        detail="模板文件暂时无法下载，请联系管理员检查 MinIO 存储连接和模板对象。",
    ) from exc


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


def _store_result_file_bytes(
    *,
    run_id: str,
    automation_id: str,
    file_role: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> dict[str, Any]:
    safe_filename = sanitize_object_segment(filename)
    bucket = get_minio_bucket("results")
    object_key = build_object_key("results", automation_id, run_id, file_role, safe_filename)
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=content,
        content_type=content_type,
    )
    return insert_automation_run_file({
        "run_id": run_id,
        "file_role": file_role,
        "bucket": bucket,
        "object_key": object_key,
        "original_filename": safe_filename,
        "content_type": content_type,
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"] or sha256_bytes(content),
    })


def _store_remote_result_file(run_id: str, automation_id: str, file_payload: RunFilePayload) -> dict[str, Any]:
    if file_payload.contentBase64:
        return _store_result_file_content(run_id, automation_id, file_payload)

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


def _store_result_file_content(run_id: str, automation_id: str, file_payload: RunFilePayload) -> dict[str, Any]:
    try:
        content = base64.b64decode(file_payload.contentBase64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 result file content.") from exc

    filename = sanitize_object_segment(file_payload.fileName or file_payload.url.split("/")[-1] or "result-file")
    content_type = file_payload.contentType or "application/octet-stream"
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


def _build_ticket_owner_workbook_bytes(rows: list[Any]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Ticket ownership"

    header_fill = PatternFill("solid", fgColor="FF5B9BD5")
    stripe_fill = PatternFill("solid", fgColor="FFDDEBF7")
    white_fill = PatternFill("solid", fgColor="FFFFFFFF")
    thin_side = Side(style="thin", color="FF000000")
    border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    header_font = Font(bold=True, color="FFFFFF")
    alignment = Alignment(horizontal="center", vertical="center")

    worksheet.append(list(TICKET_OWNER_COLUMNS))
    for cell in worksheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.border = border
        cell.alignment = alignment
        cell.number_format = "@"

    for row_index, source_row in enumerate(rows, start=2):
        normalized_row = _normalize_ticket_owner_row(source_row)
        worksheet.append([normalized_row[column] for column in TICKET_OWNER_COLUMNS])
        fill = stripe_fill if row_index % 2 == 0 else white_fill
        for cell in worksheet[row_index]:
            cell.fill = fill
            cell.border = border
            cell.alignment = alignment
            cell.number_format = "@"

    column_widths = (16, 30, 34, 18, 22, 16, 16)
    for column_index, width in enumerate(column_widths, start=1):
        worksheet.column_dimensions[get_column_letter(column_index)].width = width

    worksheet.freeze_panes = "A2"
    table_ref = f"A1:G{max(worksheet.max_row, 1)}"
    worksheet.auto_filter.ref = table_ref
    if worksheet.max_row >= 2:
        table = Table(displayName="TicketOwnership", ref=table_ref)
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        worksheet.add_table(table)

    stream = BytesIO()
    workbook.save(stream)
    workbook.close()
    return stream.getvalue()


def _normalize_ticket_owner_row(row: Any) -> dict[str, str]:
    if not isinstance(row, dict):
        return {column: "" for column in TICKET_OWNER_COLUMNS}
    return {
        column: _normalize_ticket_owner_cell(row.get(column))
        for column in TICKET_OWNER_COLUMNS
    }


def _normalize_ticket_owner_cell(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


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
