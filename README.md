# TOS Source Workspace

TOS 是一个 Windows x64 桌面工具，当前源码工作区由三部分组成：

- `tms-electron-app/`：Electron 主进程、preload、打包与发布脚本。
- `tms-frontend/`：Vue 3、TypeScript、Vite 前端重建源码。
- `tms-backend/`：Python FastAPI 后端与 Excel 处理模块。

`tms-electron-app/recovered-frontend/` 是恢复出的打包前端基线，只作为行为和视觉参考，不是长期源码。

## 当前工程事实

- 后端入口是 `tms-backend/main.py`，默认监听 `http://127.0.0.1:8000`，用于本机后端联调和 local dev。
- 前端开发服务器由 `tms-frontend/package.json` 定义，当前是 `http://127.0.0.1:5174`；默认 `dev:frontend` 为 server mode，本机后端备用入口为 `dev:frontend:local`，入口细节见 `docs/engineering-entrypoints.md`。
- Electron 打包默认使用 `tms-frontend/dist`；`TOS_FRONTEND_SOURCE=recovered` 仅用于紧急回退。
- 仓库根目录 `package.json` 提供工程入口 scripts，用于编排前端、后端和 Electron 子项目的现有检查命令。
- GitCode 远端检查位于 `.gitcode/workflows/tos-check.yml`，对 `main`、`codex/**` 分支 push 和面向 `main` 的合并请求运行完整 `npm run check`。

## 文档地图

- `AGENTS.md`：项目级 AI 协作规则、工程边界和验证要求。
- `tms-frontend/README.md`：前端源码工作区、命令、源码约定和页面清单。
- `docs/frontend-engineering-standards.md`：前端重建工程规范和变更接收检查项。
- `docs/engineering-entrypoints.md`：根目录工程入口、检查矩阵和命令边界。
- `docs/engineering-closure-roadmap.md`：未完全工程化部分的优先级、边界和验收标准。
- `docs/tos-ai-workflow.md`：TOS-AI 从 GitCode 同步、分支开发、版本、CI 到服务器发布的完整工作流。
- `docs/server-deployment-runbook.md`：服务器 `~/TOS` 目录式 Docker Compose 更新、备份、验证和回滚流程。
- `docs/server-deployment-runbook.md` 同时记录桌面安装包在服务器 MinIO Docker volume 中的物理位置、对象 key、旧安装包删除规则和公开下载代理地址。
- `docs/frontend-tms-finance-parity.md`：TMS 财务页 parity 与复用边界说明。
- `tms-backend/README.md`：后端运行、模块和测试说明。
- `tms-electron-app/README.md`：Electron 运行、打包和发布说明。

## 常用验证命令

优先从仓库根目录运行编排入口；这些命令只调用各子项目已有工具链，不触发正式发布。

```powershell
npm run check:quick
npm run check:frontend
npm run check:backend
npm run check:electron
npm run check
npm run server:package:dry-run
```

`npm run check:quick` 运行工程脚本测试、前端 typecheck/test、后端 unittest 和 Electron script tests；`npm run check` 运行工程脚本测试、完整前端、完整后端和 Electron 脚本检查。

服务器发布包生成使用：

```powershell
npm run server:package
```

正式服务器发布前必须先推送 GitCode 并确认 CI 通过；服务器目录不是 Git 仓库，不在服务器执行 `git pull`。

GitCode CI 使用同一套根目录入口：在 runner 内下载 Node.js 22.11.0，先运行 `npm run ci:install` 安装依赖，再运行 `PYTHON=python3 npm run check`。该远端检查不触发 `npm run pack`、`npm run build:win` 或发布清单写入命令。

也可以进入子目录运行单项命令：

```powershell
cd tms-frontend
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
- 完整工作流以 `docs/tos-ai-workflow.md` 为准；新任务从最新 `gitcode/main` 创建 `codex/<topic>` 分支。
- 搜索默认排除 `node_modules`、`dist`、`build`、恢复基线、归档目录和运行数据目录。
- 前端新增或调整页面时同步 `src/domain/moduleCatalog.ts`、`src/app/routeCatalog.ts`、`src/app/router.ts`。
- 后端保持 `api/{module}_api.py` + `modules/{module}_module.py` 边界，上传和下载文件名必须做 basename、扩展名和目录边界校验。
- 未经明确要求，不执行 `git add`、`commit`、`push`、`pull`、`merge`、`rebase`、`reset` 或发布操作。

## 后续重点

1. 按 `docs/engineering-closure-roadmap.md` 继续收口后端 response schema、桌面后端契约和系统接口说明。
2. 单独收紧 Electron 外部 URL 打开策略、CORS 本地 allowlist 和本地 executor token 配置。
3. 补齐发布验收 smoke，覆盖关键业务页面、版本更新记录和 TOS 桌面下载入口。
