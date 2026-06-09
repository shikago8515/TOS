# -*- coding: utf-8 -*-
"""
TMS 财务 - 内销对账单导入 API Router
"""

from __future__ import annotations

import logging
import os
import shutil
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.tms_finance_internal_reconciliation_module import (
    TmsFinanceInternalReconciliationModule,
)
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(
    prefix="/tms-finance/internal-reconciliation",
    tags=["TMS财务-内销对账单"],
)
tms_finance_module = TmsFinanceInternalReconciliationModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm"}
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_excel_filename(filename: Optional[str], label: str) -> str:
    try:
        return validate_upload_filename(filename, ALLOWED_EXCEL_EXTENSIONS, label)
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
    logger.exception("TMS finance internal reconciliation processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


@router.post("/process")
async def process_internal_reconciliation(
    sample_file: UploadFile = File(...),
    bulk_file: UploadFile = File(...),
    target_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理内销对账单导入。"""

    work_dir = os.path.join(UPLOAD_DIR, f"tms_finance_internal_reconciliation_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        sample_name = _validate_excel_filename(sample_file.filename, "合并Sample 文件")
        bulk_name = _validate_excel_filename(bulk_file.filename, "合并BULK 文件")
        target_name = _validate_excel_filename(target_file.filename, "内销对账单 文件")

        sample_path = os.path.join(work_dir, f"sample_{sample_name}")
        bulk_path = os.path.join(work_dir, f"bulk_{bulk_name}")
        target_path = os.path.join(work_dir, f"target_{target_name}")
        copy_upload_to_path(sample_file, sample_path)
        copy_upload_to_path(bulk_file, bulk_path)
        copy_upload_to_path(target_file, target_path)

        result = tms_finance_module.process_files(
            sample_path=sample_path,
            bulk_path=bulk_path,
            target_path=target_path,
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
            "appended_count": result["appended_count"],
            "skipped_count": result["skipped_count"],
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
async def download_internal_reconciliation_result(filename: str):
    """下载内销对账单导入结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
