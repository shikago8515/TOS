# TOS 项目冗余治理审计 - 2026-06-12

## 本轮目标

- 在 `codex/tos-redundancy-cleanup-20260612` 分支执行保守清理。
- 只删除已确认低风险的冗余内容：本地旧分支、已跟踪运行结果、隐藏占位模块、未引用前端共享组件。
- 不修改后端 API 契约、Electron 发布配置、自动更新、`backend-runtime` 或回退前端资产。

## Git 分支清理

执行规则：

- 只处理本地分支。
- `main` 和当前工作分支 `codex/tos-redundancy-cleanup-20260612` 永远保护，且不计入 20 条名额。
- 其余本地分支按最后提交时间保留最新 20 条，更旧的本地分支删除。
- 远端分支未删除；仅通过 `git fetch gitcode --prune` 清理本地 stale remote-tracking refs。

已删除本地分支：

| Branch | Commit | Date | Subject | Restore command |
| --- | --- | --- | --- | --- |
| `codex/sidebar-group-dropdowns` | `09bd61a` | 2026-06-04 | `feat: 优化前端模块显示` | `git branch codex/sidebar-group-dropdowns 09bd61a` |
| `codex/jessca-reconcile-diagnostics` | `f0682ed` | 2026-06-04 | `feat: 增加Jessca对账诊断` | `git branch codex/jessca-reconcile-diagnostics f0682ed` |
| `chore/remove-unused-web-frontend` | `a5a1883` | 2026-06-03 | `chore: remove unused training web frontend` | `git branch chore/remove-unused-web-frontend a5a1883` |
| `integrate/stl-reference-file-recognition` | `0f0b217` | 2026-06-03 | `fix: recognize Jessca reference table headers` | `git branch integrate/stl-reference-file-recognition 0f0b217` |
| `fix/stl-reference-file-recognition` | `3bee923` | 2026-06-03 | `fix: recognize Jessca reference table headers` | `git branch fix/stl-reference-file-recognition 3bee923` |
| `local-latest-20260603` | `ef4eb4d` | 2026-06-03 | `filter local automation artifacts from package` | `git branch local-latest-20260603 ef4eb4d` |
| `legacy/local-main-20260603` | `996363a` | 2026-06-03 | `latest source baseline` | `git branch legacy/local-main-20260603 996363a` |

保留的普通本地分支：

- `codex/tos-ai-workflow`
- `codex/fix-sophia-tina-excel-ooxml`
- `codex/server-first-settings-cleanup`
- `codex/update-release-notice`
- `codex/integrate-tms-finance-main-20260611`
- `codex/optimize-tms-finance-module`
- `codex/fix-tms-finance-upload-work-sales`
- `codex/tos-gitcode-checks`
- `codex/tos-engineering-foundation`
- `codex/frontend-ui-polish`
- `codex/add-tms-finance-excel-module`
- `codex/repackage-release-0.9.8-beta.0.6`
- `codex/sophia-tina-report-update`
- `codex/unify-release-asset-names`
- `codex/tos-engineering-guardrails`
- `sync/local-latest-to-gitcode-main`
- `codex/optimize-eric-country-color`
- `codex/jane-module-and-rules`
- `codex/update-tos-agents-rules`
- `codex/excel-process-reuse-framework`

Pruned stale remote-tracking refs:

- `gitcode/backup/pre-large-change-20260529-144157`
- `gitcode/codex/desktop-install-default`
- `gitcode/codex/eric-size-check-formula`
- `gitcode/codex/jane-table-sidebar-menu`
- `gitcode/codex/sophia-module-update`
- `gitcode/codex/sophia-result-redesign`

## 文件清理

已删除：

- `结果excel/shipping-last-result.xlsx`
- `结果excel/shipping-last-failed-po-rows.xlsx`
- `tms-frontend/src/shared/ui/teacher-course/AutomationHintList.vue`
- `tms-frontend/src/shared/ui/teacher-course/TeacherCourseShell.vue`
- `tms-frontend/src/shared/ui/teacher-course/TeacherCourseStatCard.vue`
- `tms-frontend/src/shared/styles/teacher-course-shell.scss`

已调整：

- `.gitignore` 增加 `结果excel/`，避免运行结果 Excel 再次入库。
- `tms-frontend/src/domain/moduleCatalog.ts` 删除隐藏占位模块 `module-a` 和 `module-b`。
- `tms-frontend/src/domain/moduleCatalog.test.ts` 增加测试，防止隐藏 placeholder 模块重新进入模块目录。

清理依据：

- `结果excel/*.xlsx` 只与运行时下载文件名同名，没有按路径被源码或文档引用。
- `teacher-course` 共享组件只存在内部自引用，没有业务页面或共享入口引用。
- `module-a`、`module-b` 是隐藏 placeholder，不在侧边栏展示，保留会增加模块目录噪声。

## 明确保留

- `tms-electron-app/recovered-frontend/`：紧急回退和视觉参考基线，当前仍由 `TOS_FRONTEND_SOURCE=recovered` 支持。
- `tms-electron-app/archive/legacy-packaging/`：历史打包方案归档，已有 `legacy-archive.test.js` 约束它不在 active path。
- `tms-frontend/src/pages/it-invoice-pdf-reorder/original-index.html`：当前页面仍以内嵌原始 HTML 承载功能，不能在本轮直接删除。
- `tms-backend/api/it_invoice_pdf_reorder_api.py` 中的 `legacy_router`：仍用于兼容旧 `/api/process` 等路径。
- `tms-electron-app/build/automation-launcher-installer.nsh`：NSIS 配置引用的安装脚本，不属于冗余。

## 未执行的本地运行数据清理

以下目录属于本地运行或构建产物，未被 Git 跟踪或已在 `.gitignore` 中，但本轮不自动删除：

| Path | Files | Size |
| --- | ---: | ---: |
| `tms-backend/build` | 17 | 257.89 MB |
| `tms-backend/uploads` | 157 | 14.92 MB |
| `tms-backend/logs` | 2 | 0 MB |
| `tms-electron-app/.local-launcher-data` | 5 | 0 MB |
| `tms-electron-app/dist-frontend` | 3 | 0.49 MB |

如需手动清理，先确认没有正在运行的后端、Electron 或自动化任务，再按明确路径执行 `Remove-Item -LiteralPath <path> -Recurse`。

## 二期高风险候选

- 将 `it-invoice-pdf-reorder` 从 raw HTML 迁移为 Vue 组件，同时保留现有后端兼容路由。
- 评估 `legacy_router` 的真实调用方，再决定是否收敛旧路径。
- 评估 `recovered-frontend` 是否仍需要作为发布回退资产；如移除，必须同步修改 `copy-frontend.js`、文档和打包验证。
- 评估 `automation-apps/*-demo` 命名是否需要产品化；这会影响 Electron 打包、启动器、验证脚本和前端入口。
