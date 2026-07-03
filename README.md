# TOS Source Workspace

TOS 是一个 Windows x64 桌面工具，当前源码工作区由三部分组成：

- `tms-electron-app/`：Electron 主进程、preload、打包与发布脚本。
- `tms-frontend/`：Vue 3、TypeScript、Vite 前端重建源码。
- `tms-backend/`：Python FastAPI 后端与 Excel 处理模块。

`tms-electron-app/recovered-frontend/` 是恢复出的打包前端基线，只作为行为和视觉参考，不是长期源码。

## 当前工程事实

- 后端入口是 `tms-backend/main.py`，默认监听 `http://127.0.0.1:8000`，用于本机执行、Excel/PDF 处理和显式 local dev。
- 前端开发服务器由 `tms-frontend/package.json` 定义，当前是 `http://127.0.0.1:5174`；默认 `dev:frontend` 使用 hybrid 模式（服务器共享数据接口 + 本地执行接口），纯本地联调必须显式使用 `dev:frontend:local`，全量服务器联调必须显式使用 `dev:frontend:server`，入口细节见 `docs/engineering-entrypoints.md` 和 `docs/development-hybrid-backend.md`。
- Electron 打包默认使用 `tms-frontend/dist`；`TOS_FRONTEND_SOURCE=recovered` 仅用于紧急回退。
- 仓库根目录 `package.json` 提供工程入口 scripts，用于编排前端、后端和 Electron 子项目的现有检查命令。
- Gitea `main` 是当前服务器部署主线；本地改完后优先推送并合并到 Gitea `main`。
- Gitea 是当前唯一主线远端；服务器部署、远端检查和自动版本发布都以 Gitea `main` 为准。历史旧远端不作为当前检查或发布路径，旧 CI workflow 不再保留。

## 文档地图

- `AGENTS.md`：AI 代码助手必须遵守的项目级执行规则、工程边界、安全要求和验证分层。
- `tms-frontend/README.md`：前端源码工作区、命令、源码约定、页面清单和本地开发入口。
- `docs/frontend-engineering-standards.md`：前端重建的 Vue/TypeScript 可执行规范、共享组件复用、API 边界和变更接收检查项。
- `docs/engineering-entrypoints.md`：根目录工程入口、检查矩阵、验证分层和命令边界。
- `docs/engineering-closure-roadmap.md`：未完全工程化部分的优先级、边界和验收标准。
- `docs/tos-ai-workflow.md`：TOS-AI 从 Gitea 同步、分支开发、版本、CI 到服务器发布的完整工作流。
- `docs/server-deployment-runbook.md`：服务器 `~/TOS` 目录式 Docker Compose 更新、备份、验证和回滚流程。
- `docs/server-deployment-runbook.md` 同时记录桌面安装包在服务器 MinIO Docker volume 中的物理位置、对象 key、旧安装包删除规则和公开下载代理地址。
- `docs/excel-result-history.md`：Excel 处理结果历史归档、服务器下载、环境变量和验证说明。
- `docs/frontend-tms-finance-parity.md`：TMS 财务页 parity 与复用边界说明。
- `tms-backend/README.md`：后端运行、模块、API 兼容、代码规范和测试说明。
- `tms-electron-app/README.md`：Electron 运行、打包、独立运行边界和发布敏感配置说明。

## 如何选择文档

- 做 AI 协作、改规则、处理 Git/验证/安全/发布边界：先看 `AGENTS.md`。
- 做前端页面、路由、状态、样式、请求封装或 Excel 处理页复用：看 `docs/frontend-engineering-standards.md` 和 `tms-frontend/README.md`。
- 做后端 API、Excel/PDF 处理、上传下载、错误脱敏或模块测试：看 `tms-backend/README.md`。
- 做 Electron 主进程、preload、自动化 helper、安装包、更新清单或发布产物：看 `tms-electron-app/README.md`。
- 不确定该运行哪个命令：看 `docs/engineering-entrypoints.md`，先用 `npm run check:changed:dry-run` 预览最小检查集。
- 做从需求到 Gitea `main`、自动版本、服务器部署和回滚的完整流程：看 `docs/tos-ai-workflow.md`。

## 常用验证命令

优先从仓库根目录运行编排入口；这些命令只调用各子项目已有工具链，不触发正式发布。

```powershell
npm run check:quick
npm run check:frontend
npm run check:backend
npm run check:electron
npm run check:changed:dry-run
npm run check:changed
npm run check
npm run server:package:dry-run
```

`npm run check:quick` 运行工程脚本测试、前端 lint/typecheck/test、后端 unittest 和 Electron script tests；`npm run check` 运行工程脚本测试、完整前端、完整后端和 Electron 脚本检查。

日常开发按风险分层验证：先运行 `npm run check:changed:dry-run` 查看当前分支和工作区建议的最小检查集；确认无误后可运行 `npm run check:changed` 执行。文档、规则或说明改动通常只需 whitespace 检查；前端 UI、文案或局部路由小改优先运行前端 `lint`、`typecheck` 和相关 `vitest`；后端单模块小改优先运行对应 `python -m unittest tests.test_xxx -v`。公共工具、前后端契约、依赖、版本发布、CI/CD、部署、打包、认证、下载等高风险改动也先走 `check:changed` 的专项映射；只有无法安全缩小范围或触及核心边界且没有专项门禁时，才运行 `npm run check:quick`。同一 commit 已完成本地检查后，合并进本地 `main` 不重复跑相同检查；Gitea `main` push 后远端仍运行完整检查。

默认服务器发布在服务器执行 `deploy-tos`，通过 Gitea deploy key 免密拉取 `main`，再调用 `scripts/server/deploy-gitea-main.sh` 本地生成并应用服务器发布包。备用方案才在本机生成发布包：

```powershell
npm run server:package
```

正式服务器发布前必须先推送并合并到 Gitea `main`。服务器 `~/TOS` 目录不是 Git 仓库，不在 `~/TOS` 执行 `git pull`；只有 `~/TOS-source` 是跟踪 Gitea `main` 的源码目录。手动排障时才进入 `~/TOS-source` 执行 `git pull --ff-only origin main` 和 `bash scripts/server/deploy-gitea-main.sh`。

Gitea 检查环境使用同一套根目录入口：先在 runner 的仓库工作区创建 `.venv`，通过该虚拟环境运行 `npm run ci:install` 安装依赖，再复用同一 `.venv` 运行 `npm run check`。CI 系统包需包含 `nodejs`、`npm`、Python venv 支持，以及 Electron 自动化脚本测试使用的 `zip`、`unzip`、`lsof`。Alpine CI 会跳过 `rapidocr` 和 `onnxruntime` 这组可选 OCR engine runtime，正式后端依赖文件仍保留完整依赖。该远端检查不触发 `npm run pack`、`npm run build:win` 或发布清单写入命令。

常用前端开发入口：

```powershell
npm run dev:frontend
npm run dev:frontend:local
npm run dev:frontend:server
npm run dev:frontend:hybrid
```

`dev:frontend` 与 `dev:frontend:hybrid` 等价，默认用于服务器共享数据接口 + 本地执行接口的混合联调；`dev:frontend:local` 连接本地后端；`dev:frontend:server` 全部连接服务器后端。

也可以进入子目录运行单项命令：

```powershell
cd tms-frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

```powershell
cd tms-backend
python -m unittest discover tests/ -v
python -m compileall .
```

`npm run pack` 只用于普通打包/校验，不是正式 Windows 发行入口。

发布前完整验证使用：

```powershell
cd tms-electron-app
npm run build:win
```

## 开发规则摘要

- 开发任务先读取项目级 `AGENTS.md`，再按当前源码和 `package.json` scripts 核实。
- 完整工作流以 `docs/tos-ai-workflow.md` 为准；新任务从最新 `gitea/main` 创建 `codex/<topic>` 分支。
- 搜索默认排除 `node_modules`、`dist`、`build`、恢复基线、归档目录和运行数据目录。
- 前端新增或调整页面时同步 `src/domain/moduleCatalog.ts`、`src/app/routeCatalog.ts`、`src/app/router.ts`。
- 当前模块入口以 `tms-frontend/src/domain/moduleCatalog.ts` 为准；旧 `/browser-plugins`、`/jessica-infornexus` 仅作为兼容重定向保留，不作为新功能入口。
- 后端保持 `api/{module}_api.py` + `modules/{module}_module.py` 边界，上传和下载文件名必须做 basename、扩展名和目录边界校验。
- Excel 处理历史结果下载由服务器归档接口持久化，规则见 `docs/excel-result-history.md`；不要把服务器 MinIO/MySQL 凭据或归档 token 写入仓库。
- 未经明确要求，不执行 `git add`、`commit`、`push`、`pull`、`merge`、`rebase`、`reset` 或发布操作。

## 后续重点

1. 按 `docs/engineering-closure-roadmap.md` 继续收口后端 response schema、桌面后端契约和系统接口说明。
2. 单独收紧 Electron 外部 URL 打开策略、CORS 本地 allowlist 和本地 executor token 配置。
3. 补齐发布验收 smoke，覆盖关键业务页面、版本更新记录和 TOS 桌面下载入口。
