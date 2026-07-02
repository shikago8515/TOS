
# -*- coding: utf-8 -*-
"""
Jane API Router
"""

import logging
import os
import shutil
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

# 导入模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.jane_module import JaneModule
from utils.excel_result_history import (
    archive_excel_result_history,
    process_history_response_fields,
)
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/jane", tags=["Jane"])
jane_module = JaneModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".xls"}
MODULE_ID = "jane"
HISTORY_MODULE_ID = "excel-jane"
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

# 临时目录
UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
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
    logger.exception("Jane processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


def _public_message(message: str, output_path: str, output_filename: str) -> str:
    return sanitize_output_reference(message, output_path, output_filename)


def _backup_context(
    upload: UploadFile,
    safe_name: str,
    *,
    request_id: str,
    file_role: str,
) -> ExcelUploadBackupContext:
    return ExcelUploadBackupContext(
        module_id=MODULE_ID,
        request_id=request_id,
        file_role=file_role,
        original_filename=safe_name,
        content_type=getattr(upload, "content_type", "") or "",
    )


def _archive_result_history(output_filename: str, request_id: str) -> dict[str, object]:
    payload = archive_excel_result_history(
        file_path=os.path.join(UPLOAD_DIR, output_filename),
        module_id=HISTORY_MODULE_ID,
        request_id=request_id,
        original_filename=output_filename,
    )
    return process_history_response_fields(request_id, payload)


@router.post("/test")
async def test_jane(
    tms_file: UploadFile = File(...),
    country_file: UploadFile = File(...)
):
    """
    Jane 测试验证
    """

    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"jane_test_{request_id}")
    os.makedirs(work_dir, exist_ok=True)
    try:
        tms_name = _validate_excel_filename(tms_file.filename, "TMS 文件")
        tms_path = os.path.join(work_dir, tms_name)
        copy_upload_to_path(
            tms_file,
            tms_path,
            backup_context=_backup_context(
                tms_file,
                tms_name,
                request_id=request_id,
                file_role="tms",
            ),
        )

        country_name = _validate_excel_filename(country_file.filename, "Country 文件")
        country_path = os.path.join(work_dir, country_name)
        copy_upload_to_path(
            country_file,
            country_path,
            backup_context=_backup_context(
                country_file,
                country_name,
                request_id=request_id,
                file_role="country",
            ),
        )

        result = jane_module.process_reports(
            tms_path=tms_path,
            country_path=country_path,
            output_dir=UPLOAD_DIR
        )
        if result.get("success") and result.get("output_path"):
            output_path = result["output_path"]
            output_filename = _copy_output_to_upload_dir(output_path)
            result = {
                **result,
                "message": _public_message(result.get("message", ""), output_path, output_filename),
                "logs": sanitize_output_logs(result.get("logs", []), output_path, output_filename),
                "output_path": output_filename,
                "output_file": output_filename,
                **_archive_result_history(output_filename, request_id),
            }
        return result
    except HTTPException:
        raise
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/process")
async def process_jane(
    tms_file: UploadFile = File(...),
    country_file: UploadFile = File(...),
    working_filters: Optional[str] = Form(None),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Jane 成品表生成
    """

    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"jane_process_{request_id}")
    os.makedirs(work_dir, exist_ok=True)
    try:
        tms_name = _validate_excel_filename(tms_file.filename, "TMS 文件")
        tms_path = os.path.join(work_dir, tms_name)
        copy_upload_to_path(
            tms_file,
            tms_path,
            backup_context=_backup_context(
                tms_file,
                tms_name,
                request_id=request_id,
                file_role="tms",
            ),
        )

        country_name = _validate_excel_filename(country_file.filename, "Country 文件")
        country_path = os.path.join(work_dir, country_name)
        copy_upload_to_path(
            country_file,
            country_path,
            backup_context=_backup_context(
                country_file,
                country_name,
                request_id=request_id,
                file_role="country",
            ),
        )

        filters_list = working_filters.split(',') if working_filters else None
        result = jane_module.process_reports(
            tms_path=tms_path,
            country_path=country_path,
            working_filters=filters_list,
            output_dir=output_dir if output_dir else UPLOAD_DIR
        )
        
        # 返回结果
        if result['success'] and result['output_path']:
            output_path = result['output_path']
            output_filename = _copy_output_to_upload_dir(output_path)
            return {
                "success": True,
                "message": _public_message(result['message'], output_path, output_filename),
                "logs": sanitize_output_logs(result['logs'], output_path, output_filename),
                "working_count": result['working_count'],
                "output_file": output_filename,
                **_archive_result_history(output_filename, request_id),
            }
        else:
            return {
                "success": False,
                "message": result['message'],
                "logs": result['logs']
            }
    except HTTPException:
        raise
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_jane_result(filename: str):
    """
    下载 Jane 处理结果
    """
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
