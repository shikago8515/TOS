from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from utils.minio_storage import (
    get_minio_bucket,
    put_object_bytes,
    put_object_file,
    sanitize_object_segment,
)
from utils.mysql_store import insert_process_result_file, upsert_process_history_record


logger = logging.getLogger(__name__)

PROCESS_RESULT_PREFIX = "process-results"
RESULT_FILE_ROLE = "result_file"
DEFAULT_RESULT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
RESULT_HISTORY_WARNING = "处理结果历史文件暂时无法保存，当前结果仍可下载。"
REMOTE_ARCHIVE_URL_ENV = "TOS_PROCESS_HISTORY_ARCHIVE_URL"
REMOTE_ARCHIVE_TOKEN_ENV = "TOS_PROCESS_HISTORY_ARCHIVE_TOKEN"
SERVER_WRITE_TOKEN_ENV = "TOS_PROCESS_HISTORY_WRITE_TOKEN"
REMOTE_HISTORY_BACKEND_TARGET = "remote"

PROCESS_HISTORY_MODULE_ID_ALIASES = {
    "jessca": "excel-jessca",
    "draft-packing-compare": "pdf-draft-packing-compare",
    "jane": "excel-jane",
    "jane-bom-compare": "excel-jane-bom-compare",
    "jane-bom-summary": "excel-jane-bom-summary",
    "jane-outbound-compare": "excel-jane-outbound-compare",
    "sophia-tina": "excel-sophia-tina",
    "tms-finance-internal-reconciliation": "excel-tms-finance-internal-reconciliation",
    "tms-finance-work-sales": "excel-tms-finance-work-sales",
}


@dataclass(frozen=True)
class ExcelResultHistoryContext:
    module_id: str
    request_id: str
    original_filename: str
    content_type: str = DEFAULT_RESULT_CONTENT_TYPE


def normalize_process_history_module_id(module_id: str) -> str:
    normalized = str(module_id or "").strip()
    return PROCESS_HISTORY_MODULE_ID_ALIASES.get(normalized, normalized)


def store_excel_result_history(
    file_path: str | Path,
    context: ExcelResultHistoryContext,
    history_record: dict[str, Any] | None = None,
) -> dict[str, Any]:
    path = Path(file_path)
    safe_filename = sanitize_object_segment(context.original_filename or path.name)
    content_type = context.content_type or DEFAULT_RESULT_CONTENT_TYPE
    clean_context = ExcelResultHistoryContext(
        module_id=normalize_process_history_module_id(context.module_id),
        request_id=context.request_id,
        original_filename=safe_filename,
        content_type=content_type,
    )
    bucket = get_minio_bucket("results")
    object_key = build_excel_result_history_object_key(path, clean_context)
    storage_record = put_object_file(
        bucket=bucket,
        object_key=object_key,
        file_path=path,
        content_type=content_type,
    )
    upsert_process_history_record(_build_process_history_record(clean_context, safe_filename, history_record))
    file_record = insert_process_result_file({
        "request_id": clean_context.request_id,
        "module_id": clean_context.module_id,
        "file_role": RESULT_FILE_ROLE,
        "bucket": storage_record["bucket"],
        "object_key": storage_record["object_key"],
        "original_filename": safe_filename,
        "content_type": content_type,
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })
    return _result_history_payload(file_record)


def store_uploaded_process_result_file(
    *,
    file: Any,
    context: ExcelResultHistoryContext,
    history_record: dict[str, Any] | None = None,
) -> dict[str, Any]:
    safe_filename = sanitize_object_segment(context.original_filename or getattr(file, "filename", "") or "result.xlsx")
    content_type = context.content_type or getattr(file, "content_type", "") or DEFAULT_RESULT_CONTENT_TYPE
    clean_context = ExcelResultHistoryContext(
        module_id=normalize_process_history_module_id(context.module_id),
        request_id=context.request_id,
        original_filename=safe_filename,
        content_type=content_type,
    )
    file_obj = getattr(file, "file", file)
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    content = file_obj.read()
    if isinstance(content, str):
        content = content.encode("utf-8")

    bucket = get_minio_bucket("results")
    object_key = build_excel_result_history_object_key(safe_filename, clean_context)
    storage_record = put_object_bytes(
        bucket=bucket,
        object_key=object_key,
        content=bytes(content),
        content_type=content_type,
    )
    upsert_process_history_record(_build_process_history_record(clean_context, safe_filename, history_record))
    file_record = insert_process_result_file({
        "request_id": clean_context.request_id,
        "module_id": clean_context.module_id,
        "file_role": RESULT_FILE_ROLE,
        "bucket": storage_record["bucket"],
        "object_key": storage_record["object_key"],
        "original_filename": safe_filename,
        "content_type": content_type,
        "file_size": storage_record["file_size"],
        "sha256": storage_record["sha256"],
    })
    return _result_history_payload(file_record)


def archive_excel_result_history(
    *,
    file_path: str | Path,
    module_id: str,
    request_id: str,
    original_filename: str,
    content_type: str = DEFAULT_RESULT_CONTENT_TYPE,
) -> dict[str, Any]:
    history_module_id = normalize_process_history_module_id(module_id)
    remote_url = os.environ.get(REMOTE_ARCHIVE_URL_ENV, "").strip()
    remote_token = os.environ.get(REMOTE_ARCHIVE_TOKEN_ENV, "").strip()
    if not remote_url or not remote_token:
        if os.environ.get(SERVER_WRITE_TOKEN_ENV, "").strip():
            try:
                return store_excel_result_history(
                    file_path,
                    ExcelResultHistoryContext(
                        module_id=history_module_id,
                        request_id=request_id,
                        original_filename=sanitize_object_segment(original_filename or Path(file_path).name),
                        content_type=content_type,
                    ),
                )
            except Exception:
                logger.warning(
                    "Excel result history local archive failed: module_id=%s request_id=%s filename=%s",
                    history_module_id,
                    request_id,
                    original_filename,
                    exc_info=True,
                )
        return {"historyWarnings": [RESULT_HISTORY_WARNING]}

    try:
        return archive_excel_result_history_remotely(
            file_path=file_path,
            context=ExcelResultHistoryContext(
                module_id=history_module_id,
                request_id=request_id,
                original_filename=sanitize_object_segment(original_filename or Path(file_path).name),
                content_type=content_type,
            ),
            archive_url=remote_url,
            archive_token=remote_token,
        )
    except Exception:
        logger.warning(
            "Excel result history remote archive failed: module_id=%s request_id=%s filename=%s",
            history_module_id,
            request_id,
            original_filename,
            exc_info=True,
        )
        return {"historyWarnings": [RESULT_HISTORY_WARNING]}


def archive_excel_result_history_remotely(
    *,
    file_path: str | Path,
    context: ExcelResultHistoryContext,
    archive_url: str,
    archive_token: str,
) -> dict[str, Any]:
    path = Path(file_path)
    safe_filename = sanitize_object_segment(context.original_filename or path.name)
    content_type = context.content_type or DEFAULT_RESULT_CONTENT_TYPE
    clean_context = ExcelResultHistoryContext(
        module_id=normalize_process_history_module_id(context.module_id),
        request_id=context.request_id,
        original_filename=safe_filename,
        content_type=content_type,
    )
    with path.open("rb") as file_obj:
        response = httpx.post(
            archive_url,
            headers={"X-TOS-History-Write-Token": archive_token},
            data={
                "moduleId": clean_context.module_id,
                "requestId": clean_context.request_id,
                "originalFilename": safe_filename,
                "contentType": content_type,
            },
            files={
                "file": (safe_filename, file_obj, content_type),
            },
            timeout=30,
        )
    response.raise_for_status()
    payload = response.json()
    return _normalize_remote_archive_payload(payload if isinstance(payload, dict) else {})


def process_history_response_fields(
    request_id: str,
    archive_payload: dict[str, Any],
) -> dict[str, Any]:
    result_download_path = archive_payload.get("resultDownloadPath", "")
    result_download_backend_target = (
        archive_payload.get("resultDownloadBackendTarget")
        or archive_payload.get("result_download_backend_target")
        or (REMOTE_HISTORY_BACKEND_TARGET if result_download_path else "")
    )
    return {
        "request_id": request_id,
        "history_id": request_id,
        "result_file_id": archive_payload.get("resultFileId"),
        "result_download_path": result_download_path,
        "result_download_backend_target": result_download_backend_target,
        "result_file": archive_payload.get("resultFile"),
        "history_warnings": archive_payload.get("historyWarnings") or [],
    }


def archive_process_output_history(
    *,
    upload_dir: str | Path,
    module_id: str,
    request_id: str,
    output_filename: str,
    content_type: str = DEFAULT_RESULT_CONTENT_TYPE,
) -> dict[str, Any]:
    payload = archive_excel_result_history(
        file_path=Path(upload_dir) / output_filename,
        module_id=module_id,
        request_id=request_id,
        original_filename=output_filename,
        content_type=content_type,
    )
    return process_history_response_fields(request_id, payload)


def build_excel_result_history_object_key(
    file_path: str | Path,
    context: ExcelResultHistoryContext,
) -> str:
    now = datetime.now(UTC)
    timestamp = now.strftime("%Y%m%d%H%M%S%f")
    filename = sanitize_object_segment(context.original_filename or Path(file_path).name)
    parts = [
        PROCESS_RESULT_PREFIX,
        sanitize_object_segment(normalize_process_history_module_id(context.module_id)),
        now.strftime("%Y"),
        now.strftime("%m"),
        now.strftime("%d"),
        sanitize_object_segment(context.request_id),
        RESULT_FILE_ROLE,
        f"{timestamp}-{filename}",
    ]
    return "/".join(parts)


def _result_history_payload(row: dict[str, Any]) -> dict[str, Any]:
    file_id = int(row.get("id") or row.get("file_id") or 0)
    return {
        "resultFileId": file_id,
        "resultDownloadPath": f"/api/process-history/files/{file_id}/download",
        "resultDownloadBackendTarget": REMOTE_HISTORY_BACKEND_TARGET,
        "resultFile": {
            "id": file_id,
            "filename": row.get("original_filename", ""),
            "contentType": row.get("content_type", ""),
            "fileSize": int(row.get("file_size") or 0),
            "sha256": row.get("sha256", ""),
            "downloadPath": f"/api/process-history/files/{file_id}/download",
        },
        "fileSize": int(row.get("file_size") or 0),
        "sha256": row.get("sha256", ""),
        "historyWarnings": [],
    }


def _build_process_history_record(
    context: ExcelResultHistoryContext,
    safe_filename: str,
    history_record: dict[str, Any] | None,
) -> dict[str, Any]:
    record = {
        "record_id": context.request_id,
        "module_id": context.module_id,
        "status": "success",
        "message": "",
        "input_files": [],
        "output_file": safe_filename,
        "summary": [],
        "created_at": datetime.now(UTC).replace(tzinfo=None),
        "source_system": "backend.result-history",
    }
    if history_record:
        for key, value in history_record.items():
            if value not in (None, ""):
                record[key] = value
    record["record_id"] = context.request_id
    record["module_id"] = normalize_process_history_module_id(context.module_id)
    record["output_file"] = record.get("output_file") or safe_filename
    record["source_system"] = "backend.result-history"
    return record


def _normalize_remote_archive_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result_download_path = str(payload.get("result_download_path") or payload.get("resultDownloadPath") or "")
    result_file = payload.get("result_file") or payload.get("resultFile")
    return {
        "resultFileId": payload.get("result_file_id") or payload.get("resultFileId"),
        "resultDownloadPath": result_download_path,
        "resultDownloadBackendTarget": (
            payload.get("result_download_backend_target")
            or payload.get("resultDownloadBackendTarget")
            or (REMOTE_HISTORY_BACKEND_TARGET if result_download_path else "")
        ),
        "resultFile": result_file if isinstance(result_file, dict) else None,
        "fileSize": payload.get("file_size") or payload.get("fileSize") or 0,
        "sha256": payload.get("sha256", ""),
        "historyWarnings": payload.get("history_warnings") or payload.get("historyWarnings") or [],
    }
