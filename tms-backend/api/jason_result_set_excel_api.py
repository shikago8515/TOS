from __future__ import annotations

import logging
import os
import re
import shutil
from dataclasses import dataclass
from datetime import date
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.jason_result_set_excel_module import JasonResultSetExcelModule
from utils.excel_result_history import archive_process_output_history
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/jason/result-set-excel", tags=["Jason Result Set Excel"])
jason_result_set_excel_module = JasonResultSetExcelModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm"}
MODULE_ID = "jason-result-set-excel"
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@dataclass(frozen=True)
class ResolvedProcessDateFilter:
    mode: str
    target_month: str | None
    date_from: str | None
    date_to: str | None


def _validate_result_set_filename(filename: Optional[str]) -> str:
    try:
        return validate_upload_filename(filename, ALLOWED_EXCEL_EXTENSIONS, "Result Set 文件")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _download_path(filename: str) -> str:
    try:
        return resolve_download_path(UPLOAD_DIR, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _copy_output_to_upload_dir(output_path: str) -> str:
    try:
        return copy_output_to_directory(output_path, UPLOAD_DIR)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


def _backup_context(
    upload: UploadFile,
    safe_name: str,
    *,
    request_id: str,
) -> ExcelUploadBackupContext:
    return ExcelUploadBackupContext(
        module_id=MODULE_ID,
        request_id=request_id,
        file_role="result_set",
        original_filename=safe_name,
        content_type=getattr(upload, "content_type", "") or "",
    )


def _archive_result_history(output_filename: str, request_id: str) -> dict[str, object]:
    history_fields = archive_process_output_history(
        upload_dir=UPLOAD_DIR,
        module_id=MODULE_ID,
        request_id=request_id,
        output_filename=output_filename,
    )
    result_download_path = history_fields.get("result_download_path") or (
        f"/api/jason/result-set-excel/download/{output_filename}"
    )
    return {
        **history_fields,
        "requestId": request_id,
        "historyId": history_fields.get("history_id") or request_id,
        "resultFileId": history_fields.get("result_file_id"),
        "resultDownloadPath": result_download_path,
        "resultDownloadBackendTarget": history_fields.get("result_download_backend_target") or "local",
        "resultFile": history_fields.get("result_file"),
        "historyWarnings": history_fields.get("history_warnings") or [],
    }


def _resolve_target_month(target_month: Optional[str], filename: str) -> str:
    normalized_month = str(target_month or "").strip()
    if normalized_month:
        return normalized_month

    inferred = _infer_next_month_from_filename(filename)
    if inferred:
        return inferred
    raise HTTPException(status_code=400, detail="请选择目标月份")


def _infer_next_month_from_filename(filename: str) -> str:
    match = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", filename)
    if not match:
        return ""

    year = int(match.group(1))
    month = int(match.group(2))
    day = int(match.group(3))
    try:
        source_date = date(year, month, day)
    except ValueError:
        return ""

    next_year = source_date.year + 1 if source_date.month == 12 else source_date.year
    next_month = 1 if source_date.month == 12 else source_date.month + 1
    return f"{next_year:04d}-{next_month:02d}"


def _resolve_process_date_filter(
    *,
    target_month: Optional[str],
    date_filter_mode: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    filename: str,
) -> ResolvedProcessDateFilter:
    normalized_mode = str(date_filter_mode or "").strip().lower()
    normalized_date_from = str(date_from or "").strip()
    normalized_date_to = str(date_to or "").strip()

    if normalized_mode == "none":
        return ResolvedProcessDateFilter(
            mode="none",
            target_month=None,
            date_from=None,
            date_to=None,
        )

    if normalized_mode == "range" or normalized_date_from or normalized_date_to:
        if not normalized_date_from or not normalized_date_to:
            raise HTTPException(status_code=400, detail="date_from 和 date_to 必须同时填写")
        parsed_date_from = _validate_date_text(normalized_date_from, "date_from")
        parsed_date_to = _validate_date_text(normalized_date_to, "date_to")
        if parsed_date_from > parsed_date_to:
            raise HTTPException(status_code=400, detail="date_from 不能晚于 date_to")
        return ResolvedProcessDateFilter(
            mode="range",
            target_month=None,
            date_from=parsed_date_from.isoformat(),
            date_to=parsed_date_to.isoformat(),
        )

    resolved_target_month = _resolve_target_month(target_month, filename)
    return ResolvedProcessDateFilter(
        mode="range",
        target_month=resolved_target_month,
        date_from=None,
        date_to=None,
    )


def _validate_date_text(value: str, field_name: str) -> date:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise HTTPException(status_code=400, detail=f"{field_name} 必须是 YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} 日期无效") from exc


def _public_message(message: str, output_path: str, output_filename: str) -> str:
    return sanitize_output_reference(message, output_path, output_filename)


def _raise_processing_error(exc: Exception) -> NoReturn:
    logger.exception("Jason Result Set Excel processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


@router.post("/process")
async def process_jason_result_set_excel(
    result_set_file: UploadFile = File(...),
    target_month: Optional[str] = Form(None),
    date_filter_mode: Optional[str] = Form(None),
    date_from: Optional[str] = Form(None),
    date_to: Optional[str] = Form(None),
    order_type_filter: Optional[str] = Form("bulk"),
    output_dir: Optional[str] = Form(None),
):
    """根据 adidas Result Set 导出表生成 Jason test 风格目标表。"""

    safe_name = _validate_result_set_filename(result_set_file.filename)
    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"jason_result_set_excel_{request_id}")
    os.makedirs(work_dir, exist_ok=True)
    input_path = os.path.join(work_dir, safe_name)

    try:
        copy_upload_to_path(
            result_set_file,
            input_path,
            backup_context=_backup_context(result_set_file, safe_name, request_id=request_id),
        )
        resolved_date_filter = _resolve_process_date_filter(
            target_month=target_month,
            date_filter_mode=date_filter_mode,
            date_from=date_from,
            date_to=date_to,
            filename=safe_name,
        )
        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = jason_result_set_excel_module.process_result_set(
            result_set_path=input_path,
            output_dir=target_output_dir,
            target_month=resolved_date_filter.target_month,
            date_from=resolved_date_filter.date_from,
            date_to=resolved_date_filter.date_to,
            order_type_filter=order_type_filter or "bulk",
        )
        output_path = str(result["output_path"])
        output_filename = _copy_output_to_upload_dir(output_path)
        public_message = _public_message(str(result.get("message", "")), output_path, output_filename)

        return {
            "success": True,
            "message": public_message,
            "output_file": output_filename,
            "target_month": result.get("target_month"),
            "date_filter_mode": result.get("date_filter_mode", resolved_date_filter.mode),
            "date_from": result.get("date_from"),
            "date_to": result.get("date_to"),
            "date_filter_label": result.get("date_filter_label"),
            "order_type_filter": result.get("order_type_filter"),
            "order_type_label": result.get("order_type_label"),
            "written_row_count": result.get("written_row_count", 0),
            "not_shipped_row_count": result.get("not_shipped_row_count", 0),
            "partial_row_count": result.get("partial_row_count", 0),
            "unknown_lookup_count": result.get("unknown_lookup_count", 0),
            "warnings": result.get("warnings", []),
            **_archive_result_history(output_filename, request_id),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename:path}")
async def download_jason_result_set_excel(filename: str):
    """下载 Jason Result Set Excel 处理结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=os.path.basename(filename),
    )
