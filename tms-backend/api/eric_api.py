# -*- coding: utf-8 -*-
"""
Eric Excel integration API router.
"""

import os
import shutil
from typing import Optional, Set
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from modules.eric_module import EricModule


router = APIRouter(prefix="/eric", tags=["Eric"])
eric_module = EricModule()

ALLOWED_PACK_EXTENSIONS = {".xlsx", ".xlsm"}
ALLOWED_YTIC_EXTENSIONS = {".xls", ".xlsx", ".xlsm"}

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


def _copy_upload(upload: UploadFile, target_path: str):
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
async def process_eric(
    excel_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None)
):
    """Process one Eric source workbook and return a normalized Final_Data workbook."""

    safe_name = _validate_excel_filename(
        excel_file.filename,
        ALLOWED_PACK_EXTENSIONS,
        "Pack Size breakdown 文件",
    )
    work_dir = os.path.join(UPLOAD_DIR, f"eric_upload_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)
    file_path = os.path.join(work_dir, safe_name)
    try:
        _copy_upload(excel_file, file_path)

        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = eric_module.process_file(file_path, target_output_dir)
        if result["success"] and result["output_path"]:
            output_filename = _copy_output_to_upload_dir(result["output_path"])

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


@router.post("/reconcile")
async def reconcile_eric(
    pack_file: UploadFile = File(...),
    ytic_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None)
):
    """Generate Final_Data, parse the YTIC check workbook, and return a reconciliation package."""

    pack_name = _validate_excel_filename(
        pack_file.filename,
        ALLOWED_PACK_EXTENSIONS,
        "Pack Size breakdown 文件",
    )
    ytic_name = _validate_excel_filename(
        ytic_file.filename,
        ALLOWED_YTIC_EXTENSIONS,
        "YTIC check 文件",
    )

    work_dir = os.path.join(UPLOAD_DIR, f"eric_reconcile_{uuid4().hex}")
    os.makedirs(work_dir, exist_ok=True)
    pack_path = os.path.join(work_dir, pack_name)
    ytic_path = os.path.join(work_dir, ytic_name)

    try:
        _copy_upload(pack_file, pack_path)
        _copy_upload(ytic_file, ytic_path)

        target_output_dir = output_dir if output_dir else UPLOAD_DIR
        result = eric_module.process_reconciliation(
            pack_path,
            ytic_path,
            target_output_dir,
        )
        if result["success"] and result["output_path"]:
            output_filename = _copy_output_to_upload_dir(result["output_path"])
            return {
                "success": True,
                "message": result["message"],
                "logs": result["logs"],
                "row_count": result["row_count"],
                "output_file": output_filename,
                "difference_count": result["difference_count"],
                "po_difference_count": result["po_difference_count"],
                "size_check_count": result["size_check_count"],
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
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
