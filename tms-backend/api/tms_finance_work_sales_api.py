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

ALLOWED_IPLIX_EXTENSIONS = {".xlsx", ".xlsm"}
ALLOWED_REFERENCE_EXTENSIONS = {".xls", ".xlsx", ".xlsm"}
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
    iplix_file: UploadFile = File(...),
    reference_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理 Work Sales 数据提取。"""

    work_dir = os.path.join(UPLOAD_DIR, f"tms_finance_work_sales_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        iplix_name = _validate_upload(
            iplix_file.filename,
            "iPlix 导出 Excel",
            ALLOWED_IPLIX_EXTENSIONS,
        )
        reference_name = _validate_upload(
            reference_file.filename,
            "补充参考表",
            ALLOWED_REFERENCE_EXTENSIONS,
        )

        iplix_path = os.path.join(work_dir, f"iplix_{iplix_name}")
        reference_path = os.path.join(work_dir, f"reference_{reference_name}")
        copy_upload_to_path(iplix_file, iplix_path)
        copy_upload_to_path(reference_file, reference_path)

        result = tms_finance_work_sales_module.process_files(
            iplix_path=iplix_path,
            reference_path=reference_path,
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
            "matched_reference_count": result["matched_reference_count"],
            "missing_reference_count": result["missing_reference_count"],
            "diagnostic_count": result["diagnostic_count"],
            "diagnostics": result["diagnostics"],
            "month_label": result["month_label"],
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
