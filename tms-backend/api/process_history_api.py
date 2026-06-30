from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from utils.mysql_store import (
    count_process_history_records,
    list_process_history_records,
    upsert_process_history_record,
)


router = APIRouter(prefix="/process-history", tags=["Process History"])
logger = logging.getLogger(__name__)


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
    limit: int = Query(80, ge=1, le=300),
    page: int = Query(1, ge=1),
) -> dict[str, Any]:
    module_id_list = _split_module_ids(moduleIds)
    normalized_status = _normalize_status(status)
    offset = (page - 1) * limit
    try:
        total = count_process_history_records(
            module_id_list,
            status=normalized_status,
        )
        rows = list_process_history_records(
            module_id_list,
            status=normalized_status,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        logger.exception("Failed to read process history records.")
        raise HTTPException(
            status_code=503,
            detail="无法读取处理历史记录：MySQL 数据库暂时不可用，请检查后端数据库连接。",
        ) from exc

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


def _split_module_ids(raw_value: str | None) -> list[str]:
    return [
        item.strip()
        for item in str(raw_value or "").split(",")
        if item.strip()
    ]


def _summary_item_payload(item: ProcessSummaryItem) -> dict[str, Any]:
    if hasattr(item, "model_dump"):
        return item.model_dump(exclude_none=True)
    return item.dict(exclude_none=True)


def _normalize_status(value: str | None) -> str | None:
    status = str(value or "").strip().lower()
    if not status:
        return None
    if status in {"success", "error"}:
        return status
    raise HTTPException(status_code=400, detail="处理历史状态只支持 success 或 error。")


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
    return {
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
