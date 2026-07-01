from __future__ import annotations

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from utils.excel_result_history import (
    DEFAULT_RESULT_CONTENT_TYPE,
    ExcelResultHistoryContext,
    process_history_response_fields,
    store_uploaded_process_result_file,
)
from utils.minio_storage import get_object_response, sanitize_object_segment
from utils.mysql_store import (
    count_process_history_records,
    get_process_history_result_file,
    list_process_history_records,
    upsert_process_history_record,
)


router = APIRouter(prefix="/process-history", tags=["Process History"])
logger = logging.getLogger(__name__)
HISTORY_WRITE_TOKEN_ENV = "TOS_PROCESS_HISTORY_WRITE_TOKEN"


class ProcessSummaryItem(BaseModel):
    label: str = ""
    value: str = ""
    note: str | None = None


class ProcessHistoryPayload(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    moduleId: str = Field(min_length=1, max_length=128)
    moduleName: str = Field(default="", max_length=255)
    status: str = Field(default="success", max_length=32)
    durationMs: int = Field(default=0, ge=0)
    message: str = ""
    inputFiles: list[str] = Field(default_factory=list)
    outputFile: str = ""
    summary: list[ProcessSummaryItem] = Field(default_factory=list)
    createdAt: str | None = None


@router.get("/records")
def read_process_history_records(
    moduleIds: str | None = Query(None),
    status: str | None = Query(None),
    personId: str | None = Query(None),
    createdFrom: str | None = Query(None),
    createdTo: str | None = Query(None),
    downloadableOnly: bool = Query(False),
    limit: int = Query(80, ge=1, le=300),
    page: int = Query(1, ge=1),
) -> dict[str, Any]:
    module_id_list = _split_module_ids(moduleIds)
    normalized_status = _normalize_status(status)
    normalized_person_id = _normalize_person_id(personId)
    created_from = _parse_optional_datetime(createdFrom, "createdFrom")
    created_to = _parse_optional_datetime(createdTo, "createdTo")
    if created_from and created_to and created_from > created_to:
        raise HTTPException(status_code=400, detail="createdFrom must not be later than createdTo.")
    query_filters: dict[str, Any] = {"status": normalized_status}
    if normalized_person_id:
        query_filters["person_id"] = normalized_person_id
    if created_from:
        query_filters["created_from"] = created_from
    if created_to:
        query_filters["created_to"] = created_to
    if downloadableOnly is True:
        query_filters["downloadable_only"] = True
    offset = (page - 1) * limit
    try:
        total = count_process_history_records(
            module_id_list,
            **query_filters,
        )
        rows = list_process_history_records(
            module_id_list,
            **query_filters,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        logger.exception("Failed to read process history records.")
        raise HTTPException(
            status_code=503,
            detail="无法读取处理历史记录：MySQL 数据库暂时不可用，请检查后端数据库连接。",
        ) from exc

    if downloadableOnly is True:
        original_row_count = len(rows)
        rows = [row for row in rows if _row_has_result_file(row)]
        hidden_row_count = original_row_count - len(rows)
        total = max(len(rows), total - hidden_row_count)

    return {
        "ok": True,
        "records": [_record_payload(row) for row in rows],
        "pagination": {
            "page": page,
            "pageSize": limit,
            "total": total,
        },
    }


@router.post("/records")
def save_process_history_record(payload: ProcessHistoryPayload) -> dict[str, Any]:
    try:
        row = upsert_process_history_record({
            "record_id": payload.id,
            "module_id": payload.moduleId,
            "module_name": payload.moduleName,
            "status": _normalize_status(payload.status) or "success",
            "duration_ms": payload.durationMs,
            "message": payload.message,
            "input_files": [str(item) for item in payload.inputFiles],
            "output_file": payload.outputFile,
            "summary": [_summary_item_payload(item) for item in payload.summary],
            "created_at": _parse_created_at(payload.createdAt),
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to save process history record.")
        raise HTTPException(
            status_code=503,
            detail="无法保存处理历史记录：MySQL 数据库暂时不可用，请稍后重试。",
        ) from exc

    return {
        "ok": True,
        "record": _record_payload(row),
    }


@router.post("/result-files")
def save_process_history_result_file(
    moduleId: str = Form(...),
    requestId: str = Form(...),
    originalFilename: str = Form(""),
    moduleName: str = Form(""),
    status: str = Form("success"),
    durationMs: int = Form(0),
    message: str = Form(""),
    inputFiles: str = Form("[]"),
    outputFile: str = Form(""),
    summary: str = Form("[]"),
    createdAt: str | None = Form(None),
    contentType: str = Form(""),
    file: UploadFile = File(...),
    history_write_token: str | None = Header(None, alias="X-TOS-History-Write-Token"),
) -> dict[str, Any]:
    _verify_history_write_token(history_write_token)
    module_id = _required_form_value(moduleId, "moduleId")
    request_id = _required_form_value(requestId, "requestId")
    safe_filename = sanitize_object_segment(originalFilename or file.filename or "result.xlsx")
    normalized_status = _normalize_status(status) or "success"
    content_type = str(contentType or file.content_type or DEFAULT_RESULT_CONTENT_TYPE).strip()
    history_record = {
        "record_id": request_id,
        "module_id": module_id,
        "module_name": str(moduleName or "").strip(),
        "status": normalized_status,
        "duration_ms": max(0, int(durationMs or 0)),
        "message": str(message or ""),
        "input_files": _parse_json_list_field(inputFiles, "inputFiles"),
        "output_file": sanitize_object_segment(outputFile or safe_filename),
        "summary": _parse_json_list_field(summary, "summary"),
        "created_at": _parse_created_at(createdAt),
        "source_system": "backend.result-history",
    }

    try:
        archive_payload = store_uploaded_process_result_file(
            file=file,
            context=ExcelResultHistoryContext(
                module_id=module_id,
                request_id=request_id,
                original_filename=safe_filename,
                content_type=content_type,
            ),
            history_record=history_record,
        )
    except Exception as exc:
        logger.exception(
            "Failed to save process history result file: module_id=%s request_id=%s filename=%s",
            module_id,
            request_id,
            safe_filename,
        )
        raise HTTPException(
            status_code=503,
            detail="处理结果历史文件暂时无法保存，请稍后重试或联系管理员检查服务器 MinIO 存储连接。",
        ) from exc

    return {
        "ok": True,
        **process_history_response_fields(request_id, archive_payload),
    }


@router.get("/files/{file_id}/download")
def download_process_history_result_file(file_id: int):
    row = get_process_history_result_file(file_id)
    if not row:
        raise HTTPException(status_code=404, detail="处理结果文件不存在或已被清理。")

    try:
        response = get_object_response(row["bucket"], row["object_key"])
    except Exception as exc:
        logger.exception(
            "Failed to download process history result file: file_id=%s bucket=%s object_key=%s",
            file_id,
            row.get("bucket"),
            row.get("object_key"),
        )
        raise HTTPException(
            status_code=503,
            detail="处理结果文件暂时无法下载，请稍后重试或联系管理员检查 MinIO 存储连接。",
        ) from exc

    filename = row.get("original_filename") or f"process-result-{file_id}.xlsx"
    headers = {
        "Content-Disposition": _attachment_content_disposition(filename),
        "Cache-Control": "no-store",
    }
    return StreamingResponse(
        response.stream(32 * 1024),
        media_type=row.get("content_type") or "application/octet-stream",
        headers=headers,
        background=BackgroundTask(response.close),
    )


def _split_module_ids(raw_value: str | None) -> list[str]:
    if not isinstance(raw_value, str):
        return []
    return [
        item.strip()
        for item in str(raw_value or "").split(",")
        if item.strip()
    ]


def _verify_history_write_token(token: str | None) -> None:
    expected_token = os.environ.get(HISTORY_WRITE_TOKEN_ENV, "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=503,
            detail="处理结果历史归档接口未配置写入 token，请联系管理员配置服务器后端。",
        )
    if not token or not secrets.compare_digest(str(token), expected_token):
        raise HTTPException(status_code=401, detail="处理结果历史归档无权限。")


def _required_form_value(value: str, field_name: str) -> str:
    normalized_value = str(value or "").strip()
    if not normalized_value:
        raise HTTPException(status_code=400, detail=f"{field_name} 不能为空。")
    if len(normalized_value) > 128:
        raise HTTPException(status_code=400, detail=f"{field_name} 超过长度限制。")
    return normalized_value


def _parse_json_list_field(raw_value: str, field_name: str) -> list[Any]:
    text = str(raw_value or "").strip()
    if not text:
        return []
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} 不是有效的 JSON 数组。") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail=f"{field_name} 必须是 JSON 数组。")
    return payload


def _summary_item_payload(item: ProcessSummaryItem) -> dict[str, Any]:
    if hasattr(item, "model_dump"):
        return item.model_dump(exclude_none=True)
    return item.dict(exclude_none=True)


def _normalize_status(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    status = str(value or "").strip().lower()
    if not status:
        return None
    if status in {"success", "error"}:
        return status
    raise HTTPException(status_code=400, detail="处理历史状态只支持 success 或 error。")


def _normalize_person_id(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    person_id = str(value or "").strip()
    if not person_id:
        return None
    if len(person_id) > 64:
        raise HTTPException(status_code=400, detail="personId is too long.")
    return person_id


def _parse_optional_datetime(value: str | None, field_name: str) -> datetime | None:
    if not isinstance(value, str):
        return None
    raw_value = str(value or "").strip()
    if not raw_value:
        return None
    try:
        normalized_value = raw_value[:-1] + "+00:00" if raw_value.endswith("Z") else raw_value
        parsed = datetime.fromisoformat(normalized_value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} is not a valid ISO datetime.") from exc

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _parse_created_at(value: str | None) -> datetime:
    raw_value = str(value or "").strip()
    if not raw_value:
        return datetime.now(timezone.utc).replace(tzinfo=None)

    try:
        normalized_value = raw_value[:-1] + "+00:00" if raw_value.endswith("Z") else raw_value
        parsed = datetime.fromisoformat(normalized_value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="createdAt 不是有效的 ISO 时间。") from exc

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _record_payload(row: dict[str, Any]) -> dict[str, Any]:
    result_file = _result_file_payload(row)
    payload = {
        "id": row["record_id"],
        "moduleId": row["module_id"],
        "moduleName": row.get("module_name", ""),
        "status": row.get("status", "success"),
        "durationMs": int(row.get("duration_ms") or 0),
        "message": row.get("message", ""),
        "inputFiles": _safe_json_list(row.get("input_files_json")),
        "outputFile": row.get("output_file", ""),
        "summary": _safe_json_list(row.get("summary_json")),
        "createdAt": _format_datetime(row.get("created_at")),
    }
    if row.get("person_id"):
        payload["personId"] = row["person_id"]
    if result_file:
        payload["resultFile"] = result_file
        payload["resultDownloadPath"] = result_file["downloadPath"]
    return payload


def _row_has_result_file(row: dict[str, Any]) -> bool:
    return int(row.get("result_file_id") or 0) > 0


def _result_file_payload(row: dict[str, Any]) -> dict[str, Any] | None:
    file_id = int(row.get("result_file_id") or 0)
    if file_id <= 0:
        return None
    return {
        "id": file_id,
        "filename": row.get("result_file_name", ""),
        "contentType": row.get("result_file_content_type", ""),
        "fileSize": int(row.get("result_file_size") or 0),
        "sha256": row.get("result_file_sha256", ""),
        "downloadPath": f"/api/process-history/files/{file_id}/download",
    }


def _safe_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(str(value))
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _format_datetime(value: Any) -> str:
    if isinstance(value, datetime):
        utc_value = value.replace(tzinfo=timezone.utc)
        return utc_value.isoformat().replace("+00:00", "Z")
    return str(value or "")


def _attachment_content_disposition(filename: str) -> str:
    ascii_filename = filename.encode("ascii", errors="ignore").decode("ascii").strip()
    fallback_filename = ascii_filename or "process-result.xlsx"
    quoted_filename = quote(filename, safe="")
    return f'attachment; filename="{fallback_filename}"; filename*=UTF-8\'\'{quoted_filename}'
