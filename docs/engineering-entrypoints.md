# Engineering Entrypoints

本文件说明仓库根目录 `package.json` 提供的工程入口。根目录脚本只负责编排现有子项目命令，不迁移 workspace，不新增依赖，也不触发正式发布。

## 命令矩阵

| 命令 | 覆盖范围 | 会运行 |
| --- | --- | --- |
| `npm run check:quick` | 快速检查 | 工程脚本测试、前端 `lint`、前端 `typecheck`、前端 `test`、后端 `unittest`、Electron script tests |
| `npm run check:frontend` | 前端完整检查 | `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` |
| `npm run check:backend` | 后端完整检查 | `python -m unittest discover tests/ -v`、`python -m compileall .` |
| `npm run check:electron` | Electron 脚本测试 | 自动发现 `tms-electron-app/scripts/*.test.js` 并运行 `node --test` |
| `npm run check` | 完整工程检查 | 工程脚本测试、前端完整检查、后端完整检查、Electron 脚本测试 |
| `npm run ci:install` | Gitea 检查环境依赖安装 | 根目录、前端、Electron、Playwright console 的 `npm ci`，以及后端 `pip install -r requirements.txt` |
| `npm run test:server-package` | 服务器包脚本测试 | `node --test scripts/engineering/package-server-update.test.mjs` |
| `npm run release:dry-run` | 自动发布预演 | 运行 `semantic-release --dry-run`，预览版本计算、CHANGELOG 和 release notes 生成 |
| `npm run release` | 自动发布 | 由 Gitea 发布环境在 Gitea `main` push 后运行，生成版本提交、tag、当前 release notes、release manifest 和 Gitea Release |
| `npm run release:updates:pull` | 版本记录同步 | 从服务器 `/api/release-updates` 拉取记录，合并更新本地 fallback 和后端默认 seed |
| `npm run release:updates:push` | 版本记录写入 | 将当前 commit 的版本记录写入服务器 `/api/release-updates` |
| `npm run release:updates:push:dry-run` | 版本记录写入预览 | 预览当前 commit 将写入的记录，不 POST |
| `npm run release:updates:dry-run` | 版本记录同步预览 | 预览服务器记录与本地缓存合并结果，不写文件、不 POST |
| `npm run server:package:dry-run` | 服务器包计划检查 | 校验版本、更新内容和包清单，不生成正式包 |
| `npm run server:package` | 服务器更新包生成 | 校验 clean worktree，构建服务器前端，生成 `release/server/tos-server-update-*.tar.gz`；默认由服务器 Gitea 部署脚本调用，本机手动运行只用于备用上传流程 |

## 验证分层

日常开发按风险选择最小真实检查，避免把 `npm run check:quick` 变成所有普通改动的默认成本：

- 前端 UI、文案或局部路由小改：运行 `cd tms-frontend && npm run lint`、`npm run typecheck` 和相关 `vitest`；需要确认构建产物时再运行 `npm run build`。
- 后端单模块小改：运行对应 `python -m unittest tests.test_xxx -v`、class 或 method；涉及导入边界时再补 `python -m compileall .`。
- 公共工具、前后端契约、版本发布、CI/CD、服务器部署、Electron 打包、合并 `main` 或推送 Gitea 主线前：运行 `npm run check:quick`。
- 正式大版本、Windows 打包发布、自动更新或安装器链路：运行 `npm run check` 或 `AGENTS.md` 要求的发布专项验证。
- `npm run check:quick` 若超过 12-15 分钟，应定位慢测试或重复覆盖，不直接移除安全、契约、发布、部署关键测试。

## 开发入口

日常前端开发默认使用本地后端模式：`npm run dev:frontend` 必须连接 `http://127.0.0.1:8000`，不得读取 `tms-frontend/.env.server`。远程服务器联调必须显式使用 `npm run dev:frontend:server`，该模式才会读取 `tms-frontend/.env.server` 的公开 `VITE_BACKEND_URL`；Hybrid 联调必须显式使用 `npm run dev:frontend:hybrid`，用于“服务器共享数据接口 + 本地执行接口”的混合场景，具体分流规则见 `docs/development-hybrid-backend.md`。这些模式都占用 `http://127.0.0.1:5174`，同一时间只能运行一种模式；切换模式前先停止旧 Vite 进程。

| 命令 | 等价子项目命令 |
| --- | --- |
| `npm run dev:frontend` | `node scripts/engineering/run-npm.mjs --prefix tms-frontend run dev`，默认本地后端模式 |
| `npm run dev:frontend:server` | `node scripts/engineering/run-npm.mjs --prefix tms-frontend run dev:server`，显式服务器联调模式 |
| `npm run dev:frontend:hybrid` | `node scripts/engineering/run-npm.mjs --prefix tms-frontend run dev:hybrid`，显式 Hybrid 联调模式 |
| `npm run dev:frontend:local` | `node scripts/engineering/run-npm.mjs --prefix tms-frontend run dev:local`，显式本地后端模式 |
| `npm run preview:frontend` | `node scripts/engineering/run-npm.mjs --prefix tms-frontend run preview` |
| `npm run dev:electron` | `node scripts/engineering/run-npm.mjs --prefix tms-electron-app run dev` |

排查页面提示“无法连接后端服务”时，先确认：

1. `Invoke-RestMethod http://127.0.0.1:8000/` 能返回当前 `app-version.json` 版本。
2. `npm run check:backend-version` 通过。
3. Vite 实际输出的 `import.meta.env` 是否符合当前启动模式；只有 `dev:frontend:server` 和 `dev:frontend:hybrid` 会读取服务器后端相关公开配置。
4. `netstat -ano | Select-String -Pattern ':5174|:8000'` 显示当前本地前后端进程符合预期。

## 边界

- 根目录入口不运行 `npm run pack`、`npm run build:win`、`verify:renderer-package`、`verify:release-package`、`write:update-changelog` 或 `write:manual-downloads`。
- 发布、打包、更新清单和安装包校验仍按 `tms-electron-app/README.md` 与 `AGENTS.md` 的发布敏感规则单独执行。
- `server:package` 只生成服务器 Docker Compose 部署用更新包，不生成 Windows Electron 安装包。默认服务器发布由 `scripts/server/deploy-gitea-main.sh` 在服务器 `~/TOS-source` 内调用；本机生成后手动上传只作为 Gitea 或服务器拉代码不可用时的备用流程。
- 子项目原生命令仍然可用；根目录入口只是日常开发检查的统一编排层。

## 请求边界

- 普通前端后端请求必须经过 `tms-frontend/src/shared/api/backendClient.ts` 或页面级 API 模块，确保版本哨兵、错误归一化和本地/服务器后端切换规则生效。
- 本地 automation executor/launcher 的直连 `fetch` 是显式例外，只允许出现在 `scripts/engineering/frontend-direct-fetch-boundary.test.mjs` 的白名单文件内。
- 新增直接 `fetch`、`XMLHttpRequest` 或 executor token 传递前，先确认是否能复用 `backendClient`；确需直连时必须说明本地边界、URL 来源、token 暴露面和错误脱敏策略，并同步更新白名单测试。

## 版本记录同步

- 版本发布事实以 Git tag、`tms-frontend/src/shared/version/releaseManifest.json` 和服务器包 `deploy/manifest.json` 为准；版本更新记录以服务器数据库为查询主源，本地 `releaseHistory.json` 和后端默认 seed `tms-backend/data/release_updates_seed.json` 是可再生成缓存。
- 本地缓存落后服务器时运行 `npm run release:updates:pull`；先用 `npm run release:updates:dry-run` 检查合并结果。
- 手动写入服务器前先运行 `npm run release:updates:push:dry-run` 检查当前 commit 将生成的记录；不要依赖 `npm run release:updates:push -- --dry-run` 这类参数透传。
- commit/merge 自动记录通过 `.githooks` 调用 `scripts/release_update_sync.py`，默认从 `TOS_RELEASE_UPDATES_API_URL` 或 `tms-frontend/.env.server` 解析服务器 `/api/release-updates`，不得提交数据库账号或写入 token；该 hook 只作为辅助记录或预览，不作为正式版本发布事实来源。
- `POST /api/release-updates` 可由服务器环境变量 `TOS_RELEASE_UPDATE_WRITE_TOKEN` 保护；`GET /api/release-updates` 必须保持公开读取，避免版本页不可用。
- `semantic-release` 只在 Gitea `main` push 后由 `.gitea/workflows/tos-check.yml` 运行；发布环境使用 Gitea Actions 内置 `GITEA_TOKEN`，并同步暴露为 `TOS_GITEA_TOKEN`。`main` 作为 `beta.3` prerelease 分支，`stable` 仅作为 semantic-release 要求的稳定 release branch；首次启用前需要在当前基线提交补齐 `v0.9.8-beta.3.28` tag。
- 普通功能、修复和文档清理不要手工维护 `releaseNotes.json` 或运行 `version:bump`；当前版本说明和 release manifest 由 `semantic-release` 根据 Conventional Commits 写入，服务器包生成前会校验版本一致，并在 manifest 存在时优先用它生成部署记录。

## Gitea 远端检查

- 当前远端检查和发布以 Gitea `main` 为准，入口是 `.gitea/workflows/tos-check.yml`。
- `main`、`codex/**` 分支 push，以及面向 `main` 的合并请求会运行完整 `npm run check`。
- 只有 `refs/heads/main` push 且上一条提交不是 `chore(release):` 时，workflow 才会继续运行 `npm run release -- --no-ci`。
- CI 会设置 `PYTHON=python3` 和 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，并在 runner 内下载使用 Node.js 22.11.0；当前远端检查只运行脚本级测试，不下载浏览器，也不做真实浏览器自动化 smoke。
- 远端检查不运行 `npm run pack`、`npm run build:win`、发布清单写入命令或任何上传发布产物的命令。
