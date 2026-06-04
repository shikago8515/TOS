
# -*- coding: utf-8 -*-
"""
Jessca API Router
"""

import os
import shutil
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from typing import List, Optional

# 导入模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.jessca_module import JesscaModule


router = APIRouter(prefix="/jessca", tags=["Jessca"])
jessca_module = JesscaModule()

# 临时目录
UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/process")
async def process_jessca(
    invoices: List[UploadFile] = File(...),
    reference_file: UploadFile = File(...),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Jessca 数据核对
    """
    
    # 保存上传的文件
    invoice_paths = []
    for invoice in invoices:
        invoice_path = os.path.join(UPLOAD_DIR, invoice.filename)
        with open(invoice_path, "wb") as f:
            shutil.copyfileobj(invoice.file, f)
        invoice_paths.append(invoice_path)
    
    ref_path = os.path.join(UPLOAD_DIR, reference_file.filename)
    with open(ref_path, "wb") as f:
        shutil.copyfileobj(reference_file.file, f)
    
    # 处理数据
    try:
        result = jessca_module.process_invoices(
            invoice_paths, 
            ref_path, 
            output_dir if output_dir else UPLOAD_DIR
        )
        
        # 返回结果
        if result['success'] and result['output_path']:
            return {
                "success": True,
                "message": result['message'],
                "logs": result['logs'],
                "invoice_count": result['invoice_count'],
                "total_items": result['total_items'],
                "matches": result['matches'],
                "diagnostics": result.get('diagnostics', {}),
                "output_file": os.path.basename(result['output_path'])
            }
        else:
            return {
                "success": False,
                "message": result['message'],
                "logs": result['logs']
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_jessca_result(filename: str):
    """
    下载 Jessca 处理结果
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
