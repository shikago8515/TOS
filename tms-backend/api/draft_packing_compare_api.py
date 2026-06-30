# -*- coding: utf-8 -*-
"""PDF核对 API Router。"""

from __future__ import annotations

import logging
import os
import shutil
from typing import NoReturn, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.draft_packing_compare_module import DraftPackingCompareModule
from utils.excel_result_history import archive_process_output_history
from utils.file_utils import (
    copy_output_to_directory,
    copy_upload_to_path,
    resolve_download_path,
    sanitize_output_logs,
    sanitize_output_reference,
    validate_upload_filename,
)


router = APIRouter(prefix="/draft-packing-compare", tags=["PDF核对"])
draft_packing_compare_module = DraftPackingCompareModule()
logger = logging.getLogger(__name__)

ALLOWED_PDF_EXTENSIONS = {".pdf"}
MODULE_ID = "draft-packing-compare"
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


def _normalize_uploads(upload_or_uploads: UploadFile | list[UploadFile], label: str) -> list[UploadFile]:
    uploads = upload_or_uploads if isinstance(upload_or_uploads, list) else [upload_or_uploads]
    if not uploads:
        raise HTTPException(status_code=400, detail=f"请选择要上传的 {label}")
    return uploads


def _save_pdf_uploads(
    uploads: list[UploadFile],
    work_dir: str,
    prefix: str,
    label: str,
) -> list[str]:
    paths: list[str] = []
    multiple_files = len(uploads) > 1
    for index, upload in enumerate(uploads, start=1):
        safe_name = _validate_pdf_filename(upload.filename, label)
        file_prefix = f"{prefix}_{index}_" if multiple_files else f"{prefix}_"
        file_path = os.path.join(work_dir, f"{file_prefix}{safe_name}")
        copy_upload_to_path(upload, file_path)
        paths.append(file_path)

    return paths


@router.post("/process")
async def process_draft_packing_compare(
    draft_file: list[UploadFile] = File(...),
    packing_file: list[UploadFile] = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理产地证与 Packing List PDF 核对。"""

    request_id = uuid4().hex
    work_dir = os.path.join(UPLOAD_DIR, f"draft_packing_compare_{request_id}")
    os.makedirs(work_dir, exist_ok=True)

    try:
        draft_uploads = _normalize_uploads(draft_file, "产地证PDF")
        packing_uploads = _normalize_uploads(packing_file, "Packing List PDF")
        draft_paths = _save_pdf_uploads(draft_uploads, work_dir, "draft", "产地证PDF")
        packing_paths = _save_pdf_uploads(
            packing_uploads,
            work_dir,
            "packing",
            "Packing List PDF",
        )

        if len(draft_paths) == 1 and len(packing_paths) == 1:
            result = draft_packing_compare_module.process_files(
                draft_pdf_path=draft_paths[0],
                packing_pdf_path=packing_paths[0],
                output_dir=output_dir if output_dir else UPLOAD_DIR,
            )
        else:
            result = draft_packing_compare_module.process_file_batches(
                draft_pdf_paths=draft_paths,
                packing_pdf_paths=packing_paths,
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
            "sheet_count": result.get("sheet_count", 1),
            "draft_file_count": result.get("draft_file_count", len(draft_paths)),
            "packing_file_count": result.get("packing_file_count", len(packing_paths)),
            **archive_process_output_history(
                upload_dir=UPLOAD_DIR,
                module_id=MODULE_ID,
                request_id=request_id,
                output_filename=output_filename,
            ),
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
    """下载 PDF核对结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
