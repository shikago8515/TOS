# Engineering Entrypoints

本文件说明仓库根目录 `package.json` 提供的工程入口。根目录脚本只负责编排现有子项目命令，不迁移 workspace，不新增依赖，也不触发正式发布。

## 命令矩阵

| 命令 | 覆盖范围 | 会运行 |
| --- | --- | --- |
| `npm run check:quick` | 快速检查 | 工程脚本测试、前端 `typecheck`、前端 `test`、后端 `unittest`、Electron script tests |
| `npm run check:frontend` | 前端完整检查 | `npm run typecheck`、`npm run test`、`npm run build` |
| `npm run check:backend` | 后端完整检查 | `python -m unittest discover tests/ -v`、`python -m compileall .` |
| `npm run check:electron` | Electron 脚本测试 | 自动发现 `tms-electron-app/scripts/*.test.js` 并运行 `node --test` |
| `npm run check` | 完整工程检查 | 工程脚本测试、前端完整检查、后端完整检查、Electron 脚本测试 |
| `npm run ci:install` | GitCode CI 依赖安装 | 根目录、前端、Electron、Playwright console 的 `npm ci`，以及后端 `pip install -r requirements.txt` |
| `npm run test:server-package` | 服务器包脚本测试 | `node --test scripts/engineering/package-server-update.test.mjs` |
| `npm run release:dry-run` | 自动发布预演 | 运行 `semantic-release --dry-run`，预览版本计算、CHANGELOG 和 release notes 生成 |
| `npm run release` | 自动发布 | 由 CI 在 GitCode `main` push 后运行，生成版本提交、tag 和 GitCode Release |
| `npm run release:updates:pull` | 版本记录同步 | 从服务器 `/api/release-updates` 拉取记录，合并更新本地 fallback 和后端默认 seed |
| `npm run release:updates:push` | 版本记录写入 | 将当前 commit 的版本记录写入服务器 `/api/release-updates` |
| `npm run release:updates:push:dry-run` | 版本记录写入预览 | 预览当前 commit 将写入的记录，不 POST |
| `npm run release:updates:dry-run` | 版本记录同步预览 | 预览服务器记录与本地缓存合并结果，不写文件、不 POST |
| `npm run server:package:dry-run` | 服务器包计划检查 | 校验版本、更新内容和包清单，不生成正式包 |
| `npm run server:package` | 服务器更新包生成 | 校验 clean worktree，构建服务器前端，生成 `release/server/tos-server-update-*.tar.gz` |

## 开发入口

日常前端开发默认使用本地后端模式：`npm run dev:frontend` 必须连接 `http://127.0.0.1:8000`，不得读取 `tms-frontend/.env.server`。远程服务器联调必须显式使用 `npm run dev:frontend:server`，该模式才会读取 `tms-frontend/.env.server` 的公开 `VITE_BACKEND_URL`；该文件不保存密钥或内部凭据。`dev:frontend`、`dev:frontend:server` 和 `dev:frontend:local` 都占用 `http://127.0.0.1:5174`，同一时间只能运行一种模式；切换 server/local 前先停止旧 Vite 进程。

| 命令 | 等价子项目命令 |
| --- | --- |
| `npm run dev:frontend` | `npm --prefix tms-frontend run dev`，默认本地后端模式 |
| `npm run dev:frontend:server` | `npm --prefix tms-frontend run dev:server`，显式服务器联调模式 |
| `npm run dev:frontend:local` | `npm --prefix tms-frontend run dev:local`，显式本地后端模式 |
| `npm run preview:frontend` | `npm --prefix tms-frontend run preview` |
| `npm run dev:electron` | `npm --prefix tms-electron-app run dev` |

排查页面提示“无法连接后端服务”时，先确认：

1. `Invoke-RestMethod http://127.0.0.1:8000/` 能返回当前 `app-version.json` 版本。
2. `npm run check:backend-version` 通过。
3. Vite 实际输出的 `import.meta.env` 不包含服务器 `VITE_BACKEND_URL`，除非正在显式使用 `dev:frontend:server`。
4. `netstat -ano | Select-String -Pattern ':5174|:8000'` 显示当前本地前后端进程符合预期。

## 边界

- 根目录入口不运行 `npm run pack`、`npm run build:win`、`verify:renderer-package`、`verify:release-package`、`write:update-changelog` 或 `write:manual-downloads`。
- 发布、打包、更新清单和安装包校验仍按 `tms-electron-app/README.md` 与 `AGENTS.md` 的发布敏感规则单独执行。
- `server:package` 只生成服务器 Docker Compose 部署用更新包，不生成 Windows Electron 安装包，也不上传服务器。
- 子项目原生命令仍然可用；根目录入口只是日常开发检查的统一编排层。

## 请求边界

- 普通前端后端请求必须经过 `tms-frontend/src/shared/api/backendClient.ts` 或页面级 API 模块，确保版本哨兵、错误归一化和本地/服务器后端切换规则生效。
- 本地 automation executor/launcher 的直连 `fetch` 是显式例外，只允许出现在 `scripts/engineering/frontend-direct-fetch-boundary.test.mjs` 的白名单文件内。
- 新增直接 `fetch`、`XMLHttpRequest` 或 executor token 传递前，先确认是否能复用 `backendClient`；确需直连时必须说明本地边界、URL 来源、token 暴露面和错误脱敏策略，并同步更新白名单测试。

## 版本记录同步

- 版本更新记录以服务器数据库为主源，本地 `releaseHistory.json` 和后端默认 seed `tms-backend/data/release_updates_seed.json` 是可再生成缓存。
- 本地缓存落后服务器时运行 `npm run release:updates:pull`；先用 `npm run release:updates:dry-run` 检查合并结果。
- 手动写入服务器前先运行 `npm run release:updates:push:dry-run` 检查当前 commit 将生成的记录；不要依赖 `npm run release:updates:push -- --dry-run` 这类参数透传。
- commit/merge 自动记录通过 `.githooks` 调用 `scripts/release_update_sync.py`，默认从 `TOS_RELEASE_UPDATES_API_URL` 或 `tms-frontend/.env.server` 解析服务器 `/api/release-updates`，不得提交数据库账号或写入 token。
- `POST /api/release-updates` 可由服务器环境变量 `TOS_RELEASE_UPDATE_WRITE_TOKEN` 保护；`GET /api/release-updates` 必须保持公开读取，避免版本页不可用。
- `semantic-release` 只在 GitCode `main` push 后运行；CI 需要配置 `GITCODE_TOKEN`。`main` 作为 `beta.3` prerelease 分支，`stable` 仅作为 semantic-release 要求的稳定 release branch；首次启用前需要在当前基线提交补齐 `v0.9.8-beta.3.28` tag。

## GitCode 远端检查

- GitCode 工作流位于 `.gitcode/workflows/tos-check.yml`。
- `main`、`codex/**` 分支 push，以及面向 `main` 的合并请求会运行完整 `npm run check`。
- CI 会设置 `PYTHON=python3` 和 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，并在 runner 内下载使用 Node.js 22.11.0；当前远端检查只运行脚本级测试，不下载浏览器，也不做真实浏览器自动化 smoke。
- 远端检查不运行 `npm run pack`、`npm run build:win`、发布清单写入命令或任何上传发布产物的命令。
