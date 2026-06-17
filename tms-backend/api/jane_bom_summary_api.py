# -*- coding: utf-8 -*-
"""
Jane-BOM 汇总 API Router
"""

import logging
import os
import shutil
from typing import List, Optional, Set
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.jane_bom_summary_module import JaneBomSummaryModule


router = APIRouter(prefix="/jane-bom-summary", tags=["Jane-BOM汇总"])
jane_bom_summary_module = JaneBomSummaryModule()
logger = logging.getLogger(__name__)
PROCESSING_ERROR_MESSAGE = "处理失败，请查看诊断日志或稍后重试"

ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm"}

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
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


def _copy_upload(upload: UploadFile, target_path: str) -> None:
    with open(target_path, "wb") as fp:
        shutil.copyfileobj(upload.file, fp)


def _copy_output_to_upload_dir(output_path: str) -> str:
    output_path = os.path.abspath(output_path)
    output_filename = os.path.basename(output_path)
    upload_output_path = os.path.join(UPLOAD_DIR, output_filename)
    if os.path.abspath(os.path.dirname(output_path)) != os.path.abspath(UPLOAD_DIR):
        shutil.copy2(output_path, upload_output_path)
    return output_filename


@router.post("/process")
async def process_jane_bom_summary(
    bom_files: List[UploadFile] = File(...),
    pack_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None),
):
    """处理 Jane-BOM 汇总。"""

    if not bom_files:
        raise HTTPException(status_code=400, detail="请至少上传 1 个 BOM 文件")

    work_dir = os.path.join(UPLOAD_DIR, f"jane_bom_summary_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)
    bom_paths: List[str] = []

    try:
        for bom_file in bom_files:
            bom_name = _validate_excel_filename(
                bom_file.filename,
                ALLOWED_EXCEL_EXTENSIONS,
                "BOM 文件",
            )
            bom_path = os.path.join(work_dir, bom_name)
            _copy_upload(bom_file, bom_path)
            bom_paths.append(bom_path)

        pack_name = _validate_excel_filename(
            pack_file.filename,
            ALLOWED_EXCEL_EXTENSIONS,
            "Pack 文件",
        )
        pack_path = os.path.join(work_dir, pack_name)
        _copy_upload(pack_file, pack_path)

        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = jane_bom_summary_module.process_reports(
            bom_paths,
            pack_path,
            target_output_dir,
        )
        if result["success"] and result["output_path"]:
            output_filename = _copy_output_to_upload_dir(result["output_path"])
            return {
                "success": True,
                "message": result["message"],
                "logs": result["logs"],
                "bom_count": result["bom_count"],
                "row_count": result["row_count"],
                "output_file": output_filename,
            }

        return {
            "success": False,
            "message": result["message"],
            "logs": result["logs"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Jane BOM summary processing failed")
        raise HTTPException(status_code=500, detail=PROCESSING_ERROR_MESSAGE) from exc
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_jane_bom_summary_result(filename: str):
    """下载 Jane-BOM 汇总结果。"""

    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
