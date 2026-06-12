# -*- coding: utf-8 -*-
"""Draft & Packing List 核对 API Router。"""

from __future__ import annotations

import logging
import os
import shutil
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.draft_packing_compare_module import DraftPackingCompareModule
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/draft-packing-compare", tags=["Draft & Packing List 核对"])
draft_packing_compare_module = DraftPackingCompareModule()
logger = logging.getLogger(__name__)

ALLOWED_PDF_EXTENSIONS = {".pdf"}
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    logger.exception("Draft Packing compare processing failed")
    raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc


@router.post("/process")
async def process_draft_packing_compare(
    draft_file: UploadFile = File(...),
    packing_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理 Draft Form E 与 Packing List PDF 核对。"""

    work_dir = os.path.join(UPLOAD_DIR, f"draft_packing_compare_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        draft_name = _validate_pdf_filename(draft_file.filename, "Draft Form E PDF")
        packing_name = _validate_pdf_filename(packing_file.filename, "Packing List PDF")
        draft_path = os.path.join(work_dir, f"draft_{draft_name}")
        packing_path = os.path.join(work_dir, f"packing_{packing_name}")
        copy_upload_to_path(draft_file, draft_path)
        copy_upload_to_path(packing_file, packing_path)

        result = draft_packing_compare_module.process_files(
            draft_pdf_path=draft_path,
            packing_pdf_path=packing_path,
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
            "group_count": result["group_count"],
            "issue_count": result["issue_count"],
            "mismatch_count": result["mismatch_count"],
            "missing_field_count": result["missing_field_count"],
            "draft_count": result["draft_count"],
            "packing_count": result["packing_count"],
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        _raise_processing_error(exc)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_draft_packing_compare_result(filename: str):
    """下载 Draft & Packing List 核对结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
