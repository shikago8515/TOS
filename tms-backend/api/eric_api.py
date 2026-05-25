# -*- coding: utf-8 -*-
"""
Eric Excel integration API router.
"""

import os
import shutil
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.eric_module import EricModule


router = APIRouter(prefix="/eric", tags=["Eric"])
eric_module = EricModule()
ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xlsm"}

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_excel_filename(filename: Optional[str]) -> str:
    safe_name = os.path.basename(filename or "")
    if not safe_name:
        raise HTTPException(status_code=400, detail="请选择要上传的 Excel 文件")

    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in ALLOWED_EXCEL_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xlsm 文件")

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


@router.post("/process")
async def process_eric(
    excel_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None)
):
    """Process one Eric source workbook and return a normalized Final_Data workbook."""

    safe_name = _validate_excel_filename(excel_file.filename)
    work_dir = os.path.join(UPLOAD_DIR, f"eric_upload_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)
    file_path = os.path.join(work_dir, safe_name)
    try:
        with open(file_path, "wb") as fp:
            shutil.copyfileobj(excel_file.file, fp)

        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = eric_module.process_file(
            file_path,
            target_output_dir
        )
        if result["success"] and result["output_path"]:
            output_path = os.path.abspath(result["output_path"])
            output_filename = os.path.basename(output_path)
            upload_output_path = os.path.join(UPLOAD_DIR, output_filename)
            if os.path.abspath(os.path.dirname(output_path)) != os.path.abspath(UPLOAD_DIR):
                shutil.copy2(output_path, upload_output_path)

            return {
                "success": True,
                "message": result["message"],
                "logs": result["logs"],
                "row_count": result["row_count"],
                "output_file": output_filename
            }
        return {
            "success": False,
            "message": result["message"],
            "logs": result["logs"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.get("/download/{filename}")
async def download_eric_result(filename: str):
    file_path = _download_path(filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="\u6587\u4ef6\u4e0d\u5b58\u5728")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
