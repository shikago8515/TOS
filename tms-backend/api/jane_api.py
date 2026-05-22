
# -*- coding: utf-8 -*-
"""
Jane API Router
"""

import os
import shutil
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from typing import Optional

# 导入模块
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from modules.jane_module import JaneModule


router = APIRouter(prefix="/jane", tags=["Jane"])
jane_module = JaneModule()

# 临时目录
UPLOAD_DIR = os.path.join(
    os.environ.get("TMS_BACKEND_DATA_DIR", os.path.join(os.path.dirname(__file__), "..")),
    "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/test")
async def test_jane(
    tms_file: UploadFile = File(...),
    country_file: UploadFile = File(...)
):
    """
    Jane 测试验证
    """
    
    # 保存上传的文件
    tms_path = os.path.join(UPLOAD_DIR, tms_file.filename)
    with open(tms_path, "wb") as f:
        shutil.copyfileobj(tms_file.file, f)
    
    country_path = os.path.join(UPLOAD_DIR, country_file.filename)
    with open(country_path, "wb") as f:
        shutil.copyfileobj(country_file.file, f)
    
    # 执行测试
    try:
        result = jane_module.process_reports(
            tms_path=tms_path,
            country_path=country_path,
            output_dir=UPLOAD_DIR
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process")
async def process_jane(
    tms_file: UploadFile = File(...),
    country_file: UploadFile = File(...),
    working_filters: Optional[str] = Form(None),
    output_dir: Optional[str] = Form(None)
):
    """
    处理 Jane 成品表生成
    """
    
    # 保存上传的文件
    tms_path = os.path.join(UPLOAD_DIR, tms_file.filename)
    with open(tms_path, "wb") as f:
        shutil.copyfileobj(tms_file.file, f)
    
    country_path = os.path.join(UPLOAD_DIR, country_file.filename)
    with open(country_path, "wb") as f:
        shutil.copyfileobj(country_file.file, f)
    
    # 解析筛选条件
    filters_list = None
    if working_filters:
        filters_list = working_filters.split(',')
    
    # 处理数据
    try:
        result = jane_module.process_reports(
            tms_path=tms_path,
            country_path=country_path,
            working_filters=filters_list,
            output_dir=output_dir if output_dir else UPLOAD_DIR
        )
        
        # 返回结果
        if result['success'] and result['output_path']:
            return {
                "success": True,
                "message": result['message'],
                "logs": result['logs'],
                "working_count": result['working_count'],
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
async def download_jane_result(filename: str):
    """
    下载 Jane 处理结果
    """
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )
