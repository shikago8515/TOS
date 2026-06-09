
# -*- coding: utf-8 -*-
"""
Sophia & Tina API Router
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
from modules.sophia_tina_module import SophiaTinaModule
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/sophia-tina", tags=["Sophia & Tina"])
st_module = SophiaTinaModule()
logger = logging.getLogger(__name__)

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".xls"}
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
    logger.exception("Sophia/Tina processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


def _public_message(message: str, output_path: str, output_filename: str) -> str:
    return sanitize_output_reference(message, output_path, output_filename)


def _save_uploads(files: List[UploadFile], work_dir: str, label: str) -> List[str]:
    paths = []
    for index, upload in enumerate(files, start=1):
        safe_name = _validate_excel_filename(upload.filename, label)
        file_path = os.path.join(work_dir, f"{index}_{safe_name}")
        copy_upload_to_path(upload, file_path)
        paths.append(file_path)

    return paths


@router.post("/process")
async def process_sophia_tina(
    tms_files: List[UploadFile] = File(...),
    tms_price_files: Optional[List[UploadFile]] = File(None),
    article_files: Optional[List[UploadFile]] = File(None),
    price_files: List[UploadFile] = File(...),
    pack_files: Optional[List[UploadFile]] = File(None),
    allocation_files: Optional[List[UploadFile]] = File(None),
    shipment_method_files: Optional[List[UploadFile]] = File(None),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Sophia & Tina 报表生成
    """

    work_dir = os.path.join(UPLOAD_DIR, f"sophia_tina_process_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)
    try:
        tms_paths = _save_uploads(tms_files, work_dir, "TMS 文件")
        tms_price_uploads = tms_price_files or article_files or []
        if not tms_price_uploads:
            raise HTTPException(status_code=400, detail="请选择要上传的 TMS Price 文件")
        tms_price_paths = _save_uploads(tms_price_uploads, work_dir, "TMS Price 文件")
        price_paths = _save_uploads(price_files, work_dir, "Price 文件")
        pack_paths = _save_uploads(pack_files or [], work_dir, "Pack 文件") if pack_files else None
        allocation_paths = (
            _save_uploads(allocation_files or [], work_dir, "Allocation Factory 文件")
            if allocation_files
            else None
        )
        shipment_method_paths = (
            _save_uploads(shipment_method_files or [], work_dir, "Shipment Method 文件")
            if shipment_method_files
            else None
        )

        result = st_module.process_reports(
            tms_paths, 
            tms_price_paths,
            price_paths, 
            pack_paths,
            output_dir if output_dir else UPLOAD_DIR,
            allocation_paths=allocation_paths,
            shipment_method_paths=shipment_method_paths,
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
                "result_count": result.get('result_count', 0),
                "diagnostics_count": result.get('diagnostics_count', 0),
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
async def download_st_result(filename: str):
    """
    下载 Sophia & Tina 处理结果
    """
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
