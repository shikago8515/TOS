
# -*- coding: utf-8 -*-
"""
TMS Backend API
FastAPI Server
"""

import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app_version import APP_VERSION

# 导入 API 路由
from api.jessca_api import router as jessca_router
from api.sophia_tina_api import router as st_router
from api.jane_api import router as jane_router
from api.jane_bom_compare_api import router as jane_bom_compare_router
from api.jane_bom_summary_api import router as jane_bom_summary_router
from api.jane_outbound_compare_api import router as jane_outbound_compare_router
from api.eric_api import router as eric_router
from api.it_invoice_pdf_reorder_api import compat_router as it_invoice_pdf_reorder_compat_router
from api.it_invoice_pdf_reorder_api import legacy_router as it_invoice_pdf_reorder_legacy_router
from api.it_invoice_pdf_reorder_api import router as it_invoice_pdf_reorder_router
from api.automation_storage_api import router as automation_storage_router
from api.process_history_api import router as process_history_router
from api.system_config_api import router as system_config_router
from api.release_updates_api import router as release_updates_router
from api.tms_finance_internal_reconciliation_api import router as tms_finance_internal_reconciliation_router
from api.tms_finance_work_sales_api import router as tms_finance_work_sales_router
from api.draft_packing_compare_api import router as draft_packing_compare_router
from api.iplex_dual_table_compare_api import router as iplex_dual_table_compare_router


# 创建 FastAPI 应用
app = FastAPI(
    title="TMS Backend API",
    description="TMS 报表自动化工具后端 API 服务",
    version=APP_VERSION
)

DEFAULT_CORS_ALLOW_ORIGINS = (
    "http://127.0.0.1:5174",
    "http://localhost:5174",
)


def resolve_cors_allow_origins(raw_value: str | None = None) -> list[str]:
    configured_value = raw_value if raw_value is not None else os.environ.get("TMS_CORS_ALLOW_ORIGINS")
    if not configured_value:
        return list(DEFAULT_CORS_ALLOW_ORIGINS)

    return [
        origin.strip()
        for origin in configured_value.split(",")
        if origin.strip()
    ]


# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(jessca_router, prefix="/api")
app.include_router(st_router, prefix="/api")
app.include_router(jane_router, prefix="/api")
app.include_router(jane_bom_summary_router, prefix="/api")
app.include_router(jane_bom_compare_router, prefix="/api")
app.include_router(jane_outbound_compare_router, prefix="/api")
app.include_router(eric_router, prefix="/api")
app.include_router(it_invoice_pdf_reorder_router, prefix="/api")
app.include_router(it_invoice_pdf_reorder_compat_router, prefix="/api")
app.include_router(it_invoice_pdf_reorder_legacy_router, prefix="/api")
app.include_router(automation_storage_router, prefix="/api")
app.include_router(process_history_router, prefix="/api")
app.include_router(system_config_router, prefix="/api")
app.include_router(release_updates_router, prefix="/api")
app.include_router(tms_finance_internal_reconciliation_router, prefix="/api")
app.include_router(tms_finance_work_sales_router, prefix="/api")
app.include_router(draft_packing_compare_router, prefix="/api")
app.include_router(iplex_dual_table_compare_router, prefix="/api")


# 根路径
@app.get("/")
async def root():
    return {
        "message": "TMS Backend API is running",
        "version": APP_VERSION,
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
