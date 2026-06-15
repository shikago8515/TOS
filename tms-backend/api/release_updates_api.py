from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app_version import APP_VERSION
from utils.mysql_store import (
    list_release_update_records,
    upsert_release_update_record,
)


router = APIRouter(prefix="/release-updates", tags=["Release Updates"])


class ReleaseUpdatePayload(BaseModel):
    recordKey: str = Field(min_length=1, max_length=160)
    version: str = Field(default=APP_VERSION, min_length=1, max_length=64)
    releaseDate: str | None = None
    category: str = Field(default="improved", max_length=32)
    pageName: str = Field(min_length=1, max_length=255)
    pagePath: str = Field(default="", max_length=255)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    createdBy: str = Field(default="manual", max_length=96)


def _default_record(
    record_key: str,
    version: str,
    release_date: str,
    category: str,
    page_name: str,
    page_path: str,
    title: str,
    description: str,
) -> dict[str, Any]:
    return {
        "record_key": record_key,
        "version": version,
        "release_date": release_date,
        "category": category,
        "page_name": page_name,
        "page_path": page_path,
        "title": title,
        "description": description,
        "created_by": "system",
    }


DEFAULT_RELEASE_UPDATE_RECORDS: list[dict[str, Any]] = [
    _default_record(
        "builtin-0.9.8-beta.3.11-fixed-draft-packing-description-cleanup",
        "0.9.8-beta.3.11",
        "2026-06-15",
        "fixed",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "清理 Packing List 描述脏数据",
        "修复 Draft & Packing List 核对结果中 Goods Description 误带入 PDF 免责声明和页码的问题。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.11-fixed-release-updates-backend-fallback",
        "0.9.8-beta.3.11",
        "2026-06-15",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "修复后端未连接时的版本记录显示",
        "修复版本更新记录页在浏览器模式且后端未启动时显示 Failed to fetch 的问题，改为展示本地版本说明。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.11-improved-release-updates-history-fallback",
        "0.9.8-beta.3.11",
        "2026-06-15",
        "improved",
        "版本更新记录",
        "/release-updates",
        "补全本地历史版本记录",
        "版本更新记录页本地 fallback 支持展示内置历史版本记录。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.10-improved-draft-packing-jessica-nav",
        "0.9.8-beta.3.10",
        "2026-06-15",
        "improved",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "调整 Draft & Packing List 导航位置",
        "将 Draft & Packing List 核对入口移到 Jessica 导航下，并保留原页面路径和处理接口。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.9-added-server-release-update-sync",
        "0.9.8-beta.3.9",
        "2026-06-13",
        "added",
        "版本更新记录",
        "/release-updates",
        "服务器部署同步版本记录",
        "服务器部署包现在会携带本次部署的版本更新记录，并在服务重启验证通过后自动同步到后端记录接口。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.9-improved-release-updates-runtime-version",
        "0.9.8-beta.3.9",
        "2026-06-13",
        "improved",
        "版本更新记录",
        "/release-updates",
        "优化最新版本显示来源",
        "版本更新记录页的“最新版本”改为优先显示后端运行版本，避免数据库历史记录未同步时误显示旧版本。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.9-improved-server-release-manifest",
        "0.9.8-beta.3.9",
        "2026-06-13",
        "improved",
        "服务器部署",
        "/release-updates",
        "部署 manifest 记录版本更新内容",
        "服务器部署 manifest 新增 releaseUpdateRecord 字段，便于追踪本次部署版本、commit 和更新内容。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.9-fixed-release-updates-stale-version",
        "0.9.8-beta.3.9",
        "2026-06-13",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "修复服务器更新后的旧版本显示",
        "修复服务器已更新到新版本后，版本更新记录页仍可能显示上一版本的问题。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.8-added-jason-pdf-canonical-entry",
        "0.9.8-beta.3.8",
        "2026-06-13",
        "added",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "新增 Jason PDF 重排序标准入口",
        "Jason / 发票 PDF 重排序新增 canonical 前端入口 #/jason/pdf-reorder 和后端 API /api/jason/pdf-reorder/*。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.8-improved-jason-naming",
        "0.9.8-beta.3.8",
        "2026-06-13",
        "improved",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "统一 Jason PDF 模块命名",
        "Jason 模块前端目录、路由、API client 和测试命名已统一到 Jason PDF Reorder。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.8-improved-jason-response-models",
        "0.9.8-beta.3.8",
        "2026-06-13",
        "improved",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "补充 Jason 后端响应模型",
        "Jason 后端 API 已补充 Pydantic response models，并在 OpenAPI 中暴露具体响应 schema。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.8-fixed-jason-legacy-paths",
        "0.9.8-beta.3.8",
        "2026-06-13",
        "fixed",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "保留 Jason 旧路径兼容",
        "旧 #/it-invoice-pdf-reorder、/api/it-invoice-pdf-reorder/* 和 legacy /api/* 路径继续兼容，避免历史链接和发布包调用失效。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.7-added-it-invoice-vue-page",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "added",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "迁移发票 PDF 重排序为 Vue 页面",
        "IT Invoice PDF Reorder 已迁移为正式 Vue 页面，保留发票提取、PO 页码识别、号码提取、重排生成和摘要打印流程。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.7-improved-it-invoice-typed-api",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "improved",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "抽出发票 PDF typed API",
        "IT Invoice PDF Reorder 前端请求已抽出 typed API/client，页面组件不再直接执行 raw HTML 脚本。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.7-improved-it-invoice-source-guard",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "improved",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "增加发票 PDF 源码守卫",
        "新增源码守卫测试，防止该页面重新引入 raw HTML、Shadow DOM 包装或 new Function 执行路径。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.7-fixed-it-invoice-original-html",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "fixed",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "删除发票 PDF 页面旧 HTML 残留",
        "删除 IT Invoice PDF Reorder 页面级 original-index.html 残留，降低后续维护误用风险。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.6-added-engineering-roadmap",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "added",
        "工程化工作流",
        "/release-updates",
        "新增工程化收口路线图",
        "新增工程化收口路线图，明确前端源码化、后端 schema、安全硬化和发布验收的后续边界。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.6-improved-web-automation-entry",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "improved",
        "网页自动化",
        "/web-automation",
        "接入网页自动化主入口",
        "接入网页自动化主入口，侧边栏和首页快捷入口会打开真实 Vue 页面，不再落到开发中占位页。",
    ),
    _default_record(
        "2026-06-13-release-update-records-page",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "added",
        "系统菜单 / 版本更新记录",
        "/release-updates",
        "新增版本更新记录入口和独立页面",
        "右上角系统菜单新增版本更新记录入口，页面从数据库读取历史更新，并明确每条更新影响的页面。",
    ),
    _default_record(
        "2026-06-13-automation-excel-drag-drop",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "fixed",
        "网页自动化 / shipping 2 自动化",
        "/web-automation/scenarios/shipping-automation-2",
        "优化自动化页面 Excel 拖拽上传",
        "修复拖拽 Excel 经过上传框内部文字、图标和按钮时页面高亮反复闪烁的问题。",
    ),
    _default_record(
        "2026-06-13-automation-storage-minio-db",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "added",
        "网页自动化页面",
        "/web-automation",
        "自动化模板、账号密码和运行记录接入数据库与 MinIO",
        "自动化页面支持从数据库读取网站登录账号密码，Excel 模板和运行结果文件通过 MinIO 存储。",
    ),
    _default_record(
        "2026-06-13-automation-helper-installer",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "improved",
        "网页自动化页面 / 系统设置",
        "/settings",
        "优化本机自动化助手下载与安装链路",
        "右上角入口可下载自动化助手安装包，安装包从服务器地址下载完整 payload 并校验。",
    ),
    _default_record(
        "2026-06-13-it-invoice-summary-columns",
        "0.9.8-beta.3.6",
        "2026-06-13",
        "improved",
        "Jason / 发票 PDF 重排序",
        "/jason/pdf-reorder",
        "调整 PO 重排汇总页金额字段",
        "生成 PDF 的汇总页改用 Shas Vas Price，并增加 Merchandise Amount、Total Adjustment、Total Taxes、Order Total 汇总列。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.5-improved-backend-api-contract",
        "0.9.8-beta.3.5",
        "2026-06-13",
        "improved",
        "桌面客户端 / 后端服务",
        "/settings",
        "新增桌面端后端 API 契约清单",
        "新增桌面端后端 API 契约清单，启动时会按应用版本和 OpenAPI 路由校验后端兼容性。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.5-improved-backend-port-bypass",
        "0.9.8-beta.3.5",
        "2026-06-13",
        "improved",
        "桌面客户端 / 后端服务",
        "/settings",
        "优化旧后端端口占用处理",
        "当 8000 端口被旧后端占用时，桌面端会旁路启动当前版本后端并返回实际服务地址。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.5-fixed-fastapi-not-found-message",
        "0.9.8-beta.3.5",
        "2026-06-13",
        "fixed",
        "桌面客户端 / 后端服务",
        "/settings",
        "优化接口缺失提示",
        "优化 FastAPI 接口缺失时的前端提示，避免只显示 Not Found。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.4-fixed-draft-packing-old-backend",
        "0.9.8-beta.3.4",
        "2026-06-13",
        "fixed",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "兼容桌面端旧后端接口",
        "修复桌面端复用旧后端时 Draft & Packing List 核对接口返回 Not Found 的问题，启动时会校验新增处理和下载接口。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.3-added-draft-packing-module",
        "0.9.8-beta.3.3",
        "2026-06-12",
        "added",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "新增 Draft & Packing List 核对模块",
        "新增 PDF数据获取核对 分组和 Draft & Packing List 核对模块，可上传 Draft Form E 与 Packing List PDF 并生成上下对比 Excel。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.3-added-draft-packing-extraction",
        "0.9.8-beta.3.3",
        "2026-06-12",
        "added",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "新增 Draft/Packing 字段提取与核对",
        "新增后端 Draft/Packing 字段提取、严格 HS/HTS 核对、问题明细 Sheet 和缺失字段反馈信息。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.3-improved-packing-pdfplumber",
        "0.9.8-beta.3.3",
        "2026-06-12",
        "improved",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "优化 Packing List 表格 PDF 解析",
        "Packing List 表格型 PDF 解析改用 pdfplumber，提高 PO、Working Number、Article Number、Market PO、Quantity、Cartons 等字段定位稳定性。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.2-added-settings-browser-mode",
        "0.9.8-beta.3.2",
        "2026-06-12",
        "added",
        "系统设置",
        "/settings",
        "新增浏览器模式系统设置页",
        "服务器/浏览器模式下的系统设置页改为只展示版本、运行环境和语言。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.2-improved-english-breadcrumb",
        "0.9.8-beta.3.2",
        "2026-06-12",
        "improved",
        "全局导航",
        "/settings",
        "优化英文面包屑标题",
        "英文模式面包屑改为使用完整页面标题，避免只显示左侧导航短名。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.2-improved-english-business-copy",
        "0.9.8-beta.3.2",
        "2026-06-12",
        "improved",
        "多业务页面",
        "/settings",
        "补齐英文业务文案",
        "Jane、TMS Finance、Infornexus、adidas Materials 等页面补齐英文业务文案。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.2-fixed-browser-settings-desktop-actions",
        "0.9.8-beta.3.2",
        "2026-06-12",
        "fixed",
        "系统设置",
        "/settings",
        "隐藏浏览器模式桌面端操作",
        "修复浏览器/服务器模式仍显示桌面安装包更新入口和诊断包按钮的问题。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.1-added-tms-finance-stats",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "added",
        "TMS 财务表格数据处理",
        "/tms-finance-internal-reconciliation",
        "新增 TMS 财务追加结果统计",
        "TMS 财务追加结果统计，显示追加行、重复跳过、相似已追加、Sales/Purchase 追加数量。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.1-improved-internal-reconciliation-append",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "improved",
        "内销对账表数据提取",
        "/tms-finance-internal-reconciliation",
        "调整内销对账追加流程",
        "内销对账表从“回填已有行”调整为向未清账追加缺失行，避免覆盖已有数据。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.1-improved-work-sales-append",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "improved",
        "Work Sales 数据追加",
        "/tms-finance-work-sales",
        "调整 Work Sales 追加流程",
        "Work Sales 调整为“BULK Sales 导出表 + TURNOVER 目标表”的追加流程。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.1-improved-file-drag-drop",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "improved",
        "文件上传",
        "/tms-finance-internal-reconciliation",
        "优化多文件拖拽上传",
        "文件上传支持拖拽追加多文件，拖拽状态更稳定。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.1-fixed-tms-finance-append",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "fixed",
        "TMS 财务表格数据处理",
        "/tms-finance-internal-reconciliation",
        "修复 TMS 财务追加稳定性",
        "修复 TMS 财务追加时重复识别、格式复制、公式平移和小计范围更新不稳定的问题。",
    ),
]


@router.get("")
async def read_release_updates(limit: int = Query(100, ge=1, le=300)) -> dict[str, Any]:
    seed_default_release_updates()
    records = [_record_payload(row) for row in list_release_update_records(limit)]
    return {
        "ok": True,
        "version": APP_VERSION,
        "records": records,
        "total": len(records),
    }


@router.post("")
async def save_release_update(payload: ReleaseUpdatePayload) -> dict[str, Any]:
    row = upsert_release_update_record({
        "record_key": payload.recordKey.strip(),
        "version": payload.version.strip(),
        "release_date": payload.releaseDate,
        "category": payload.category.strip() or "improved",
        "page_name": payload.pageName.strip(),
        "page_path": payload.pagePath.strip(),
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "created_by": payload.createdBy.strip() or "manual",
    })
    return {
        "ok": True,
        "record": _record_payload(row),
    }


def seed_default_release_updates() -> None:
    for record in DEFAULT_RELEASE_UPDATE_RECORDS:
        upsert_release_update_record(record)


def _record_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "recordKey": row["record_key"],
        "version": row["version"],
        "releaseDate": _format_date(row.get("release_date")),
        "category": row.get("category", "improved"),
        "pageName": row.get("page_name", ""),
        "pagePath": row.get("page_path", ""),
        "title": row.get("title", ""),
        "description": row.get("description", ""),
        "createdBy": row.get("created_by", ""),
        "createdAt": _format_datetime(row.get("created_at")),
        "updatedAt": _format_datetime(row.get("updated_at")),
    }


def _format_date(value: Any) -> str:
    if isinstance(value, date):
        return value.isoformat()
    return str(value or "")


def _format_datetime(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value or "")
