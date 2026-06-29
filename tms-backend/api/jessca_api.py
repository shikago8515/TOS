
# -*- coding: utf-8 -*-
"""
Jessca API Router
"""

import logging
import os
import shutil
from typing import List, NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

# 导入模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.jessca_module import JesscaModule
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/jessca", tags=["Jessca"])
jessca_module = JesscaModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".xls"}
ALLOWED_PDF_EXTENSIONS = {".pdf"}
MODULE_ID = "jessca"
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


def _validate_pdf_filename(filename: Optional[str], label: str) -> str:
    try:
        return validate_upload_filename(filename, ALLOWED_PDF_EXTENSIONS, label)
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
    logger.exception("Jessca processing failed")
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


def _save_uploads(
    files: List[UploadFile],
    work_dir: str,
    label: str,
    *,
    request_id: str,
    file_role: str,
) -> List[str]:
    paths = []
    for index, upload in enumerate(files, start=1):
        safe_name = _validate_excel_filename(upload.filename, label)
        file_path = os.path.join(work_dir, f"{index}_{safe_name}")
        copy_upload_to_path(
            upload,
            file_path,
            backup_context=_backup_context(
                upload,
                safe_name,
                request_id=request_id,
                file_role=file_role,
            ),
        )
        paths.append(file_path)

    return paths


def _normalize_optional_uploads(
    upload_or_uploads: UploadFile | List[UploadFile] | None,
) -> List[UploadFile]:
    if upload_or_uploads is None:
        return []
    if isinstance(upload_or_uploads, list):
        return upload_or_uploads
    if not hasattr(upload_or_uploads, "filename"):
        return []
    return [upload_or_uploads]


def _save_tc_invoice_uploads(files: List[UploadFile], work_dir: str) -> List[str]:
    paths = []
    multiple_files = len(files) > 1
    for index, upload in enumerate(files, start=1):
        safe_name = _validate_pdf_filename(upload.filename, "TC INV PDF")
        prefix = f"{index}_" if multiple_files else "tc_invoice_"
        file_path = os.path.join(work_dir, f"{prefix}{safe_name}")
        copy_upload_to_path(upload, file_path)
        paths.append(file_path)

    return paths


@router.post("/process")
async def process_jessca(
    invoices: List[UploadFile] = File(...),
    reference_file: UploadFile = File(...),
    tc_invoice_file: Optional[List[UploadFile]] = File(None),
    packing_file: Optional[List[UploadFile]] = File(None),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Jessca 数据核对
    """

    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"jessca_process_{request_id}")
    os.makedirs(work_dir, exist_ok=True)
    try:
        invoice_paths = _save_uploads(
            invoices,
            work_dir,
            "发票文件",
            request_id=request_id,
            file_role="invoice",
        )
        reference_name = _validate_excel_filename(reference_file.filename, "参考文件")
        ref_path = os.path.join(work_dir, reference_name)
        copy_upload_to_path(
            reference_file,
            ref_path,
            backup_context=_backup_context(
                reference_file,
                reference_name,
                request_id=request_id,
                file_role="reference",
            ),
        )
        tc_uploads = _normalize_optional_uploads(tc_invoice_file)
        if not tc_uploads:
            tc_uploads = _normalize_optional_uploads(packing_file)
        tc_invoice_paths = _save_tc_invoice_uploads(
            tc_uploads,
            work_dir,
        )
        tc_invoice_path = tc_invoice_paths[0] if len(tc_invoice_paths) == 1 else None

        result = jessca_module.process_invoices(
            invoice_paths, 
            ref_path, 
            output_dir if output_dir else UPLOAD_DIR,
            tc_invoice_path=tc_invoice_path,
            tc_invoice_paths=tc_invoice_paths if len(tc_invoice_paths) > 1 else None,
        )
        
        # 返回结果
        if result['success'] and result['output_path']:
            output_path = result['output_path']
            output_filename = _copy_output_to_upload_dir(output_path)
            return {
                "success": True,
                "message": _public_message(result['message'], output_path, output_filename),
                "logs": sanitize_output_logs(result['logs'], output_path, output_filename),
                "invoice_count": result['invoice_count'],
                "total_items": result['total_items'],
                "matches": result['matches'],
                "diagnostics": result.get('diagnostics', {}),
                "tc_count": result.get('tc_count', 0),
                "tc_matched_count": result.get('tc_matched_count', 0),
                "tc_issue_count": result.get('tc_issue_count', 0),
                "tc_summary_count": result.get('tc_summary_count', 0),
                "tc_summary_issue_count": result.get('tc_summary_issue_count', 0),
                "tc_total_issue_count": result.get('tc_total_issue_count', 0),
                "output_file": output_filename
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
async def download_jessca_result(filename: str):
    """
    下载 Jessca 处理结果
    """
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
