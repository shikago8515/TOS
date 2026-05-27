
# -*- coding: utf-8 -*-
"""
TMS Backend API
FastAPI Server
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 导入 API 路由
from api.jessca_api import router as jessca_router
from api.sophia_tina_api import router as st_router
from api.jane_api import router as jane_router
from api.jane_bom_summary_api import router as jane_bom_summary_router
from api.eric_api import router as eric_router


# 创建 FastAPI 应用
app = FastAPI(
    title="TMS Backend API",
    description="TMS 报表自动化工具后端 API 服务",
    version="0.9.6-beta.1"
)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(jessca_router, prefix="/api")
app.include_router(st_router, prefix="/api")
app.include_router(jane_router, prefix="/api")
app.include_router(jane_bom_summary_router, prefix="/api")
app.include_router(eric_router, prefix="/api")


# 根路径
@app.get("/")
async def root():
    return {
        "message": "TMS Backend API is running",
        "version": "0.9.6-beta.1",
        "docs": "/docs"
    }


# 健康检查
@app.get("/health")
async def health_check():
    return {"status": "ok"}


# 启动服务器
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=False
    )
