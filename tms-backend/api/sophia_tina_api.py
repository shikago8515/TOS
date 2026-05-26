
# -*- coding: utf-8 -*-
"""
Sophia & Tina API Router
"""

import os
import shutil
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from typing import List, Optional

# 导入模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.sophia_tina_module import SophiaTinaModule


router = APIRouter(prefix="/sophia-tina", tags=["Sophia & Tina"])
st_module = SophiaTinaModule()

# 临时目录
UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/process")
async def process_sophia_tina(
    tms_files: List[UploadFile] = File(...),
    article_files: List[UploadFile] = File(...),
    price_files: List[UploadFile] = File(...),
    pack_files: List[UploadFile] = File(...),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Sophia & Tina 报表生成
    """
    
    # 保存上传的文件
    tms_paths = []
    for f in tms_files:
        file_path = os.path.join(UPLOAD_DIR, f.filename)
        with open(file_path, "wb") as fp:
            shutil.copyfileobj(f.file, fp)
        tms_paths.append(file_path)
    
    article_paths = []
    for f in article_files:
        file_path = os.path.join(UPLOAD_DIR, f.filename)
        with open(file_path, "wb") as fp:
            shutil.copyfileobj(f.file, fp)
        article_paths.append(file_path)
    
    price_paths = []
    for f in price_files:
        file_path = os.path.join(UPLOAD_DIR, f.filename)
        with open(file_path, "wb") as fp:
            shutil.copyfileobj(f.file, fp)
        price_paths.append(file_path)
    
    pack_paths = []
    for f in pack_files:
        file_path = os.path.join(UPLOAD_DIR, f.filename)
        with open(file_path, "wb") as fp:
            shutil.copyfileobj(f.file, fp)
        pack_paths.append(file_path)
    
    # 处理数据
    try:
        result = st_module.process_reports(
            tms_paths, 
            article_paths, 
            price_paths, 
            pack_paths,
            output_dir if output_dir else UPLOAD_DIR
        )
        
        # 返回结果
        if result['success'] and result['output_path']:
            return {
                "success": True,
                "message": result['message'],
                "logs": result['logs'],
                "working_count": result['working_count'],
                "result_count": result.get('result_count', 0),
                "diagnostics_count": result.get('diagnostics_count', 0),
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
async def download_st_result(filename: str):
    """
    下载 Sophia & Tina 处理结果
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
