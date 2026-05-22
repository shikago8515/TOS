# -*- coding: utf-8 -*-
"""
Eric Excel integration API router.
"""

import os
import shutil
import importlib.util
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

def _load_eric_module_class():
    module_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "modules", "eric_module.py"))
    spec = importlib.util.spec_from_file_location("tos_eric_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load Eric module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.EricModule


EricModule = _load_eric_module_class()


router = APIRouter(prefix="/eric", tags=["Eric"])
eric_module = EricModule()

UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/process")
async def process_eric(
    excel_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None)
):
    """Process one Eric source workbook and return a normalized Final_Data workbook."""

    file_path = os.path.join(UPLOAD_DIR, excel_file.filename)
    with open(file_path, "wb") as fp:
        shutil.copyfileobj(excel_file.file, fp)

    try:
        result = eric_module.process_file(
            file_path,
            output_dir if output_dir else UPLOAD_DIR
        )
        if result["success"] and result["output_path"]:
            return {
                "success": True,
                "message": result["message"],
                "logs": result["logs"],
                "row_count": result["row_count"],
                "output_file": os.path.basename(result["output_path"])
            }
        return {
            "success": False,
            "message": result["message"],
            "logs": result["logs"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/download/{filename}")
async def download_eric_result(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="\u6587\u4ef6\u4e0d\u5b58\u5728")

    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
