from __future__ import annotations

import os
from datetime import date
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app_version import APP_VERSION
from utils.mysql_store import (
    insert_release_update_record_once,
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


class ReleaseUpdateRecordResponse(BaseModel):
    id: int
    recordKey: str
    version: str
    releaseDate: str
    category: str
    pageName: str
    pagePath: str
    title: str
    description: str
    createdBy: str
    createdAt: str
    updatedAt: str


class ReleaseUpdatesResponse(BaseModel):
    ok: bool
    version: str
    records: list[ReleaseUpdateRecordResponse]
    total: int


class ReleaseUpdateSaveResponse(BaseModel):
    ok: bool
    record: ReleaseUpdateRecordResponse


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
        "builtin-0.9.8-beta.3.19-improved-automation-executor-health-probe",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "网页自动化 / 本机执行器",
        "/web-automation",
        "优化本机执行器检测速度",
        "本机执行器健康检查改为并行快探测 /api/health 和 /health，并收紧本机超时时间，减少浏览器刷新执行器状态时的等待卡顿。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.19-improved-helper-version-update-prompt",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "自动化助手 / 安装包",
        "/settings",
        "提示本机小助手版本更新",
        "小助手、Shipping 执行器和 TOS 完整安装包版本统一跟随系统版本，浏览器自动检测到本机小助手版本落后或无法识别时会提示用户安装最新版。",
    ),
    _default_record(
        "git-b04b31d8534b8d99518dc963a2ab2e2125f51cac",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "fixed",
        "多个页面",
        "",
        "fix: 避免版本记录缓存提交循环写入",
        "由 Git commit 自动记录：fix: 避免版本记录缓存提交循环写入。涉及文件：.githooks/post-merge、scripts/release_update_sync.py、scripts/release_update_sync_test.py、tms-backend/api/release_updates_api.py、tms-backend/utils/mysql_store.py、tms-frontend/src/shared/version/releaseHistory.json。",
    ),
    _default_record(
        "git-b6be8c1c92434a5add09afbadb14a8f189142092",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "多个页面",
        "",
        "merge: 收口 Work Sales 与版本同步",
        "由 Git merge 自动记录：merge: 收口 Work Sales 与版本同步。涉及文件：.githooks/post-commit、.githooks/post-merge、AGENTS.md、README.md、app-version.json、docs/engineering-entrypoints.md、docs/templates/gitcode-checklist.md、docs/templates/release-notes.md 等 55 个文件。",
    ),
    _default_record(
        "git-7d7f1d9f0082c4711d8fb502e1f3ae9ede23a577",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "版本更新记录",
        "/release-updates",
        "test: 放宽版本记录缓存排序断言",
        "由 Git commit 自动记录：test: 放宽版本记录缓存排序断言。涉及文件：tms-frontend/src/pages/release-updates/releaseUpdatesApi.test.ts。",
    ),
    _default_record(
        "git-f20fec7594149756cb7b6ee80c8c0322e550acb9",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "后端服务",
        "/api",
        "docs: 收口本地开发和合并流程",
        "由 Git commit 自动记录：docs: 收口本地开发和合并流程。涉及文件：AGENTS.md、README.md、docs/engineering-entrypoints.md、docs/templates/gitcode-checklist.md、docs/templates/release-notes.md、docs/tos-ai-workflow.md、scripts/engineering/frontend-dev-entrypoints.test.mjs、tms-backend/README.md。",
    ),
    _default_record(
        "git-07fd04941c568ff333e4711b759304134e1b7a6a",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "improved",
        "多个页面",
        "",
        "chore: 同步版本记录到服务器主源",
        "由 Git commit 自动记录：chore: 同步版本记录到服务器主源。涉及文件：.githooks/post-commit、.githooks/post-merge、package.json、scripts/engineering/run-checks.mjs、scripts/release_update_sync.py、scripts/release_update_sync_test.py、tms-backend/api/release_updates_api.py、tms-backend/tests/test_release_updates_api.py 等 9 个文件。",
    ),
    _default_record(
        "git-33a8dcf7380a1c6c68f62751e87df3c48effa899",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "fixed",
        "多个页面",
        "",
        "fix: 收紧本地后端和安全边界",
        "由 Git commit 自动记录：fix: 收紧本地后端和安全边界。涉及文件：app-version.json、scripts/engineering/check-backend-version.mjs、scripts/engineering/check-backend-version.test.mjs、scripts/engineering/frontend-direct-fetch-boundary.test.mjs、tms-backend/api/eric_api.py、tms-backend/api/jane_bom_compare_api.py、tms-backend/api/jane_bom_summary_api.py、tms-backend/api/jane_outbound_compare_api.py 等 22 个文件。",
    ),
    _default_record(
        "git-a413676afc0a0a1251d33aca84ed1cbcc9cd343f",
        "0.9.8-beta.3.19",
        "2026-06-17",
        "added",
        "多个页面",
        "",
        "feat: 重建 Work Sales 数据写入",
        "由 Git commit 自动记录：feat: 重建 Work Sales 数据写入。涉及文件：tms-backend/api/tms_finance_work_sales_api.py、tms-backend/modules/tms_finance_work_sales_module.py、tms-backend/tests/test_tms_finance_work_sales_module.py、tms-frontend/src/app/router.test.ts、tms-frontend/src/domain/moduleCatalog.test.ts、tms-frontend/src/domain/moduleCatalog.ts、tms-frontend/src/pages/tms-finance-internal-reconciliation/TmsFinanceInternalReconciliationPage.vue、tms-frontend/src/pages/tms-finance-internal-reconciliation/tmsFinancePageModel.test.ts 等 16 个文件。",
    ),
    _default_record(
        "git-bbee1f57a7c5d246380f6f356a77f07a963f59b6",
        "0.9.8-beta.3.19",
        "2026-06-16",
        "improved",
        "版本更新记录",
        "/release-updates",
        "merge: 收口前端开发入口",
        "由 Git manual 自动记录：merge: 收口前端开发入口。涉及文件：.gitignore、README.md、docs/engineering-entrypoints.md、package.json、tms-electron-app/README.md、tms-frontend/.env.server、tms-frontend/README.md、tms-frontend/package.json 等 10 个文件。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.19-fixed-backend-version-sentinel",
        "0.9.8-beta.3.19",
        "2026-06-16",
        "fixed",
        "桌面客户端 / 后端服务",
        "/release-updates",
        "提示后端版本未更新",
        "前端请求业务接口前会检查本地后端版本，发现后端仍是旧版本时直接提示重启，避免把后端未更新误判为业务处理失败。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.18-improved-work-sales-turnover-details-fill",
        "0.9.8-beta.3.18",
        "2026-06-16",
        "improved",
        "Work Sales 数据写入",
        "/tms-finance-work-sales",
        "重建 Work Sales 明细",
        "Work Sales 改为从 BULK Sales 导出表重建 TURNOVER 的 Turnover Details 明细，目标表旧明细会先清空再按源行写入。",
    ),
    _default_record(
        "git-844f6ea5ece625bced602e24cf178fc00d8fc203",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "fixed",
        "全局通用",
        "",
        "fix: send Xinlongtai automation id to executor",
        "由 Git commit 自动记录：fix: send Xinlongtai automation id to executor。涉及文件：tms-frontend/src/pages/xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue。",
    ),
    _default_record(
        "git-e3e7dfabb261e92b9386eea859d644981a76dd4e",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "fixed",
        "浏览器自动化",
        "/web-automation",
        "fix: scope shipment action override to Xinlongtai",
        "由 Git commit 自动记录：fix: scope shipment action override to Xinlongtai。涉及文件：tms-electron-app/automation-apps/shipping-automation-demo/server.mjs。",
    ),
    _default_record(
        "git-12fd07b9fc9a299ad5d3aa3b6ac0b0fb919d6a59",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "fixed",
        "浏览器自动化",
        "/web-automation",
        "fix: support assign equipment action for Xinlongtai shipping",
        "由 Git commit 自动记录：fix: support assign equipment action for Xinlongtai shipping。涉及文件：tms-electron-app/automation-apps/shipping-automation-demo/server.mjs、tms-frontend/src/pages/xinlongtai-shipping-automation/components/XinlongtaiShippingAutomationWorkspace.vue。",
    ),
    _default_record(
        "git-5693b13c01d1e7060242551f0b4e13fe6fcb10c5",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "fixed",
        "浏览器自动化",
        "/web-automation",
        "fix: pass shipment scan action to shipping workflow",
        "由 Git commit 自动记录：fix: pass shipment scan action to shipping workflow。涉及文件：tms-electron-app/automation-apps/shipping-automation-demo/server.mjs。",
    ),
    _default_record(
        "git-ad80bc65ee7084af7396a788b9a77b4b8a3b4121",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "improved",
        "多个页面",
        "",
        "Merge remote-tracking branch 'origin/main'",
        "由 Git merge 自动记录：Merge remote-tracking branch 'origin/main'。涉及文件：.gitignore、README.md、docs/engineering-entrypoints.md、package.json、tms-electron-app/README.md、tms-frontend/.env.server、tms-frontend/README.md、tms-frontend/package.json 等 41 个文件。",
    ),
    _default_record(
        "git-84ba3dabb147e3e58e29da05a1d3a21321875666",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "improved",
        "版本更新记录",
        "/release-updates",
        "chore: 收口前端开发入口",
        "由 Git merge 自动记录：chore: 收口前端开发入口。涉及文件：.gitignore、README.md、docs/engineering-entrypoints.md、package.json、tms-electron-app/README.md、tms-frontend/.env.server、tms-frontend/README.md、tms-frontend/package.json 等 10 个文件。",
    ),
    _default_record(
        "git-18799c1e2e2a6070781b00f124ce7945f98a6539",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "added",
        "多个页面",
        "",
        "feat: add PO auto download workflow",
        "由 Git commit 自动记录：feat: add PO auto download workflow。涉及文件：tms-backend/README.md、tms-backend/api/automation_storage_api.py、tms-backend/api/system_config_api.py、tms-backend/scripts/seed_automation_templates.py、tms-backend/scripts/seed_existing_automation_credentials.py、tms-backend/templates/automation/xinlongtai-shipping-automation-template.xls、tms-backend/tests/test_automation_storage.py、tms-electron-app/README.md 等 33 个文件。",
    ),
    _default_record(
        "git-7fe486ee550d124d70c9e7c3ef066b8d9c322f1c",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "fix: 版本更新记录直连服务器兜底",
        "由 Git commit 自动记录：fix: 版本更新记录直连服务器兜底。涉及文件：tms-frontend/src/pages/release-updates/releaseUpdatesApi.test.ts、tms-frontend/src/pages/release-updates/releaseUpdatesApi.ts。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.17-improved-electron-external-allowlist",
        "0.9.8-beta.3.17",
        "2026-06-16",
        "improved",
        "TOS 桌面客户端 / 安全",
        "/settings",
        "收口桌面外链打开边界",
        "收口 Electron 外链打开 allowlist，默认不再使用 GitHub 作为桌面更新源，外部网页和手动下载只允许明确可信的 HTTPS 地址。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.16-improved-system-api-contract",
        "0.9.8-beta.3.16",
        "2026-06-16",
        "improved",
        "桌面客户端 / 后端服务",
        "/settings",
        "收口系统接口后端契约",
        "为版本更新记录和系统配置接口补充后端响应 schema，并将 TOS 桌面下载等系统接口纳入桌面后端兼容契约。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-improved-settings-download-center-copy",
        "0.9.8-beta.3.15",
        "2026-06-16",
        "improved",
        "系统设置 / 下载中心",
        "/settings",
        "优化下载中心中文文案",
        "TOS 应用安装包、TOS 完整安装包和自动化助手安装包在页面中使用中文说明，安装包文件名保持英文，便于下载和排查。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-fixed-tos-desktop-installer-empty-folder",
        "0.9.8-beta.3.15",
        "2026-06-16",
        "fixed",
        "TOS 桌面安装包",
        "/settings",
        "修复 TOS 安装目录为空的问题",
        "修正 NSIS 卸载段命名导致安装阶段误执行清理逻辑的问题，安装后会保留 TOS.exe、app.asar 和运行资源。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-improved-tos-desktop-remote-backend",
        "0.9.8-beta.3.15",
        "2026-06-16",
        "improved",
        "TOS 桌面客户端",
        "/settings",
        "桌面版改为连接服务器后端",
        "桌面客户端业务 API 默认连接服务器后端，用户电脑本机仅保留自动化启动器等本地能力，避免安装包查找本机业务后端。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-added-tos-desktop-full-installer",
        "0.9.8-beta.3.15",
        "2026-06-16",
        "added",
        "系统设置 / 下载中心",
        "/settings",
        "新增 TOS 完整安装包下载链路",
        "新增 TOS-Desktop-Full-Setup.exe 完整安装包，用户下载单个大安装包后，安装阶段直接解压内置 payload，不再连接 MinIO 下载组件。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-fixed-release-updates-browser-backend",
        "0.9.8-beta.3.15",
        "2026-06-16",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "修复浏览器版版本记录后端连接",
        "浏览器版部署在 /tos 路径下时自动使用同源 /tos 后端前缀，避免误连本机 127.0.0.1 导致显示本地版本说明。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.15-fixed-release-updates-version-sort",
        "0.9.8-beta.3.15",
        "2026-06-15",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "修复版本更新记录排序",
        "修复版本更新记录按数据库更新时间排序时旧版本可能排在最新版上方的问题，改为按版本号倒序展示。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.14-improved-draft-packing-separator-row",
        "0.9.8-beta.3.14",
        "2026-06-15",
        "improved",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "优化对比结果分隔行样式",
        "优化 Draft & Packing List 核对结果分隔行样式，组间空白行改用浅色填充，避免误判为空白问题行。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.13-fixed-draft-packing-feedback-label",
        "0.9.8-beta.3.13",
        "2026-06-15",
        "fixed",
        "Draft & Packing List 核对",
        "/draft-packing-compare",
        "简化字段缺失反馈状态",
        "修正 Draft & Packing List 核对结果中字段缺失状态，只显示“需反馈”，不再附带 Nydia。",
    ),
    _default_record(
        "builtin-0.9.8-beta.3.12-improved-process-history-scroll",
        "0.9.8-beta.3.12",
        "2026-06-15",
        "improved",
        "处理记录",
        "/jane",
        "处理记录改为内部滚动",
        "优化处理记录面板为内部滚动，避免长记录撑高页面。",
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
        "git-988a6920aed8100cd460babf3105f4382f76ca44",
        "0.9.8-beta.3.9",
        "2026-06-15",
        "fixed",
        "版本更新记录",
        "/release-updates",
        "fix: 同步服务器部署版本更新记录",
        "修复服务器已更新到新版本后，版本更新记录页仍可能显示上一版本的问题；服务器部署包会携带并同步本次部署记录。",
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
        "git-a367dcb6d51bad34ac71b312057fea0f40aee9d9",
        "0.9.8-beta.3.8",
        "2026-06-13",
        "improved",
        "多个页面",
        "",
        "merge: unify Jason module frontend and backend entry",
        "由 Git deploy 自动记录：merge: unify Jason module frontend and backend entry。涉及 Jason PDF 重排、版本更新记录、路由、后端 API 和版本同步等文件。",
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
        "git-7e4a4df502f6672fcb93556cb2d76183a8644b5a",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "fixed",
        "多个页面",
        "",
        "fix: 优化版本更新记录自动排序",
        "由 Git deploy 自动记录：fix: 优化版本更新记录自动排序。涉及文件：scripts/release_update_sync.py、tms-backend/utils/mysql_store.py。",
    ),
    _default_record(
        "git-69d5971691b365872db095150ef11dba3799d53a",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "improved",
        "版本更新记录",
        "/release-updates",
        "chore: 自动记录版本更新历史",
        "由 Git deploy 自动记录：chore: 自动记录版本更新历史。涉及文件：.githooks/post-commit、.githooks/post-merge、scripts/install_release_update_hooks.ps1、scripts/release_update_sync.py。",
    ),
    _default_record(
        "git-9c850dcb7c0ae5edfa9f584fe0df95515e4aa099",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "improved",
        "多个页面",
        "",
        "Merge remote-tracking branch 'origin/main'",
        "由 Git deploy 自动记录：Merge remote-tracking branch 'origin/main'。涉及文件：app-version.json、tms-backend/app_version.py、tms-electron-app/package-lock.json、tms-electron-app/package.json、tms-frontend/src/pages/it-invoice-pdf-reorder/ItInvoicePdfReorderPage.vue、tms-frontend/src/pages/it-invoice-pdf-reorder/itInvoicePdfReorderApi.test.ts、tms-frontend/src/pages/it-invoice-pdf-reorder/itInvoicePdfReorderApi.ts、tms-frontend/src/pages/it-invoice-pdf-reorder/itInvoicePdfReorderModel.test.ts 等 27 个文件。",
    ),
    _default_record(
        "git-3fc2a23860eca21623d8fdf4a83b0b8527e34830",
        "0.9.8-beta.3.7",
        "2026-06-13",
        "added",
        "多个页面",
        "",
        "feat: 重构系统设置与版本更新入口",
        "由 Git deploy 自动记录：feat: 重构系统设置与版本更新入口。涉及文件：tms-backend/api/release_updates_api.py、tms-backend/main.py、tms-backend/utils/mysql_store.py、tms-frontend/src/app/router.test.ts、tms-frontend/src/app/router.ts、tms-frontend/src/layout/AppShell.vue、tms-frontend/src/layout/useAppShellModel.ts、tms-frontend/src/pages/release-updates/ReleaseUpdatesPage.vue 等 14 个文件。",
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
        "builtin-0.9.8-beta.3.1-fixed-tms-finance-append",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "fixed",
        "TMS 财务表格数据处理",
        "/tms-finance-internal-reconciliation",
        "修复 TMS 财务追加稳定性",
        "修复 TMS 财务追加时重复识别、格式复制、公式平移和小计范围更新不稳定的问题。",
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
        "builtin-0.9.8-beta.3.1-added-tms-finance-stats",
        "0.9.8-beta.3.1",
        "2026-06-11",
        "added",
        "TMS 财务表格数据处理",
        "/tms-finance-internal-reconciliation",
        "新增 TMS 财务追加结果统计",
        "TMS 财务追加结果统计，显示追加行、重复跳过、相似已追加、Sales/Purchase 追加数量。",
    ),
]


@router.get("", response_model=ReleaseUpdatesResponse)
async def read_release_updates(limit: int = Query(100, ge=1, le=300)) -> dict[str, Any]:
    seed_default_release_updates()
    records = [_record_payload(row) for row in list_release_update_records(limit)]
    return {
        "ok": True,
        "version": APP_VERSION,
        "records": records,
        "total": len(records),
    }


@router.post("", response_model=ReleaseUpdateSaveResponse)
async def save_release_update(
    payload: ReleaseUpdatePayload,
    x_release_update_token: str | None = Header(default=None, alias="X-Release-Update-Token"),
) -> dict[str, Any]:
    _validate_release_update_write_token(x_release_update_token)
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
        insert_release_update_record_once(record)


def _validate_release_update_write_token(token: str | None) -> None:
    expected_token = os.environ.get("TOS_RELEASE_UPDATE_WRITE_TOKEN", "").strip()
    if expected_token and token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized release update write.")


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
