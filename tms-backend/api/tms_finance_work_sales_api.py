# -*- coding: utf-8 -*-
"""
TMS 财务 - Work Sales 数据提取 API Router
"""

from __future__ import annotations

import logging
import os
import shutil
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.tms_finance_work_sales_module import TmsFinanceWorkSalesModule
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(
    prefix="/tms-finance/work-sales",
    tags=["TMS财务-Work Sales数据提取"],
)
tms_finance_work_sales_module = TmsFinanceWorkSalesModule()
logger = logging.getLogger(__name__)

ALLOWED_BULK_SALES_EXTENSIONS = {".xls", ".xlsx", ".xlsm"}
ALLOWED_TURNOVER_EXTENSIONS = {".xlsx", ".xlsm"}
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_upload(
    filename: Optional[str],
    label: str,
    allowed_extensions: set[str],
) -> str:
    try:
        return validate_upload_filename(filename, allowed_extensions, label)
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


def _raise_processing_error(exc: Exception) -> NoReturn:
    logger.exception("TMS finance Work Sales processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


@router.post("/process")
async def process_work_sales(
    bulk_sales_file: Optional[UploadFile] = File(None),
    turnover_file: UploadFile = File(...),
    iplix_file: Optional[UploadFile] = File(None),
    output_dir: Optional[str] = Form(None),
):
    """处理 Work Sales 数据追加。"""

    work_dir = os.path.join(UPLOAD_DIR, f"tms_finance_work_sales_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        selected_bulk_file = bulk_sales_file or iplix_file
        if selected_bulk_file is None:
            raise HTTPException(status_code=400, detail="请上传 BULK Sales 导出表")

        bulk_sales_name = _validate_upload(
            selected_bulk_file.filename,
            "BULK Sales 导出表",
            ALLOWED_BULK_SALES_EXTENSIONS,
        )
        turnover_name = _validate_upload(
            turnover_file.filename,
            "TURNOVER 目标表",
            ALLOWED_TURNOVER_EXTENSIONS,
        )
        bulk_sales_path = os.path.join(work_dir, f"bulk_sales_{bulk_sales_name}")
        turnover_path = os.path.join(work_dir, f"turnover_{turnover_name}")
        copy_upload_to_path(selected_bulk_file, bulk_sales_path)
        copy_upload_to_path(turnover_file, turnover_path)

        result = tms_finance_work_sales_module.process_files(
            bulk_sales_path=bulk_sales_path,
            turnover_path=turnover_path,
            output_dir=output_dir if output_dir else UPLOAD_DIR,
        )
        output_path = result["output_path"]
        output_filename = _copy_output_to_upload_dir(output_path)
        public_message = sanitize_output_reference(
            result["message"],
            output_path,
            output_filename,
        )

        return {
            "success": True,
            "message": public_message,
            "logs": sanitize_output_logs(result["logs"], output_path, output_filename),
            "output_file": output_filename,
            "extracted_count": result["extracted_count"],
            "source_row_count": result["source_row_count"],
            "sales_appended_count": result["sales_appended_count"],
            "purchase_appended_count": result["purchase_appended_count"],
            "duplicate_count": result["duplicate_count"],
            "diagnostic_count": result["diagnostic_count"],
            "diagnostics": result["diagnostics"],
            "totals": result["totals"],
            "source_summary": result["source_summary"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_work_sales_result(filename: str):
    """下载 Work Sales 数据提取结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
