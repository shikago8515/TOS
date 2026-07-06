# -*- coding: utf-8 -*-
"""
Jane-OUTBOUND 核对 API Router
"""

import logging
import os
import shutil
from typing import Optional, Set
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from api.jane_schemas import JaneOutboundCompareProcessResponse
from modules.jane_outbound_compare_module import JaneOutboundCompareModule
from utils.excel_result_history import archive_process_output_history
from utils.excel_upload_backup import ExcelUploadBackupContext
from utils.file_utils import copy_upload_to_path


router = APIRouter(prefix="/jane-outbound-compare", tags=["Jane-OUTBOUND核对"])
jane_outbound_compare_module = JaneOutboundCompareModule()
logger = logging.getLogger(__name__)
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"
MODULE_ID = "jane-outbound-compare"

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm"}

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_excel_filename(
    filename: Optional[str],
    allowed_extensions: Set[str],
    label: str,
) -> str:
    safe_name = os.path.basename(filename or "")
    if not safe_name:
        raise HTTPException(status_code=400, detail=f"请选择要上传的 {label}")

    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in allowed_extensions:
        allowed_text = " / ".join(sorted(allowed_extensions))
        raise HTTPException(status_code=400, detail=f"{label} 仅支持 {allowed_text}")

    return safe_name


def _download_path(filename: str) -> str:
    safe_name = os.path.basename(filename or "")
    if not safe_name:
        raise HTTPException(status_code=400, detail="文件名无效")

    root = os.path.abspath(UPLOAD_DIR)
    file_path = os.path.abspath(os.path.join(root, safe_name))
    if os.path.commonpath([root, file_path]) != root:
        raise HTTPException(status_code=400, detail="文件名无效")
    return file_path


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


def _copy_upload(
    upload: UploadFile,
    target_path: str,
    backup_context: ExcelUploadBackupContext | None = None,
) -> None:
    copy_upload_to_path(upload, target_path, backup_context=backup_context)


def _copy_output_to_upload_dir(output_path: str) -> str:
    output_path = os.path.abspath(output_path)
    output_filename = os.path.basename(output_path)
    upload_output_path = os.path.join(UPLOAD_DIR, output_filename)
    if os.path.abspath(os.path.dirname(output_path)) != os.path.abspath(UPLOAD_DIR):
        shutil.copy2(output_path, upload_output_path)
    return output_filename


@router.post(
    "/process",
    response_model=JaneOutboundCompareProcessResponse,
    response_model_exclude_none=True,
)
async def process_jane_outbound_compare(
    outbound_file: UploadFile = File(...),
    tms_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理 Jane-OUTBOUND 核对。"""

    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"jane_outbound_compare_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        outbound_name = _validate_excel_filename(
            outbound_file.filename,
            ALLOWED_EXCEL_EXTENSIONS,
            "T1 OUTBOUND 文件",
        )
        outbound_path = os.path.join(work_dir, outbound_name)
        _copy_upload(
            outbound_file,
            outbound_path,
            backup_context=_backup_context(
                outbound_file,
                outbound_name,
                request_id=request_id,
                file_role="outbound",
            ),
        )

        tms_name = _validate_excel_filename(
            tms_file.filename,
            ALLOWED_EXCEL_EXTENSIONS,
            "TMS Released Order 文件",
        )
        tms_path = os.path.join(work_dir, tms_name)
        _copy_upload(
            tms_file,
            tms_path,
            backup_context=_backup_context(
                tms_file,
                tms_name,
                request_id=request_id,
                file_role="tms",
            ),
        )

        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = jane_outbound_compare_module.process_reports(
            outbound_path,
            tms_path,
            target_output_dir,
        )
        if result["success"] and result["output_path"]:
            output_filename = _copy_output_to_upload_dir(result["output_path"])
            return {
                "success": True,
                "message": result["message"],
                "logs": result["logs"],
                "checked_row_count": result["checked_row_count"],
                "matched_row_count": result["matched_row_count"],
                "missing_tms_row_count": result["missing_tms_row_count"],
                "missing_outbound_row_count": result["missing_outbound_row_count"],
                "difference_cell_count": result["difference_cell_count"],
                "issue_count": result["issue_count"],
                "output_file": output_filename,
                **archive_process_output_history(
                    upload_dir=UPLOAD_DIR,
                    module_id=MODULE_ID,
                    request_id=request_id,
                    output_filename=output_filename,
                ),
            }

        return {
            "success": False,
            "message": result["message"],
            "logs": result["logs"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Jane outbound compare processing failed")
        raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_jane_outbound_compare_result(filename: str):
    """下载 Jane-OUTBOUND 核对结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
