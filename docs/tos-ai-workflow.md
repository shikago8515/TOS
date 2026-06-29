# TOS-AI 完整工作流

本文定义 TOS 项目从开始需求到 Gitea 留痕、验证、服务器部署和回滚的标准流程。服务器 `~/TOS` 不是 Git 仓库，不在 `~/TOS` 执行 `git pull`；服务器发布默认执行 `deploy-tos`，由 `~/TOS-source` 通过 Gitea deploy key 拉取 `main` 后在服务器本地生成并应用标准更新包。

## 1. 开始任务

每次开发前先确认当前仓库状态：

```powershell
cd D:\project\TOS-main
git status --short --branch
```

开始大任务前先形成简短摘要：

- 业务目标
- 输入材料
- 相关文件
- 验收标准
- 明确不做范围

摘要可使用 `docs/templates/change-summary.md`。

## 2. 同步 Gitea 主线

新任务必须从 Gitea 最新主线开始：

```powershell
git fetch gitea main --prune
git switch -c codex/<topic> gitea/main
```

继续已有 `codex/<topic>` 分支时，先确认工作区 clean：

```powershell
git status --short --branch
git fetch gitea main --prune
git rebase gitea/main
```

如果工作区存在未提交改动，不自动 rebase。先确认这些改动是否属于当前任务，再决定继续、提交或另开分支。

## 3. 开发与本地验证

改动必须聚焦当前需求，遵循 `AGENTS.md` 的模块边界和验证要求。

按范围运行最接近的检查：

```powershell
npm run check:quick
npm run check:frontend
npm run check:backend
npm run check:electron
npm run check
```

发布相关改动至少运行：

```powershell
npm run check:quick
```

## 4. 自动版本与更新内容

用户可见改动默认使用 Conventional Commits，由 Gitea `main` push 后的 `semantic-release` 自动递增版本；开发阶段可先预演：

```powershell
npm run release:dry-run
```

用户指定版本时使用：

```powershell
npm run version:set -- 0.9.8-beta.3.3
```

需要自动递增版本的改动：

- 新功能
- UI 可见变化
- 后端业务逻辑或处理结果变化
- API 契约变化
- 服务器部署流程变化
- Electron 发布或更新行为变化

默认不递增版本的改动：

- 纯文档
- 纯测试
- 纯注释
- 不影响产品行为的内部脚本整理

当前版本弹窗内容保存在：

```text
tms-frontend/src/shared/version/releaseNotes.json
```

规则：

- 普通用户可见改动通过 Conventional Commits 进入 `semantic-release`，由 Gitea `main` push 后自动生成版本号、`CHANGELOG.md`、Git tag 和当前版本 `releaseNotes.json`。
- `semantic-release` 同时生成当前版本发布档案 `tms-frontend/src/shared/version/releaseManifest.json`，记录 version、tag、gitSha、releaseDate、channel、releaseNotes 和构建产物占位。
- `feat:` 进入 `added`，`fix:` 进入 `fixed`，`perf:`、`refactor:`、`build:`、`ci:` 等进入 `improved`。
- 文档、测试和规则清理默认不手改 `releaseNotes.json`，也不运行 `version:bump`。
- 本地需要指定版本时使用 `npm run version:set -- <version>`；指定后必须确认 `releaseNotes.json.version` 等于 `app-version.json`，且当前版本说明不带上一版本遗留条目。
- 服务器发布包仍会校验 `releaseNotes.json` 至少有一个 `added`、`improved` 或 `fixed` 条目。

模板见 `docs/templates/release-notes.md`。

版本发布事实以 Git tag、`releaseManifest.json` 和服务器包 `deploy/manifest.json` 为准；版本更新历史页面以服务器 MySQL `release_update_records` 为查询主源，本地 `tms-frontend/src/shared/version/releaseHistory.json` 和 `tms-backend/data/release_updates_seed.json` 只是可再生成缓存。更新版本记录时使用：

```powershell
npm run release:updates:push:dry-run
npm run release:updates:push
npm run release:updates:dry-run
npm run release:updates:pull
```

`release:updates:push` 通过服务器 `/api/release-updates` 写入记录，不直连数据库账号；`release:updates:pull` 从服务器拉取并合并更新本地缓存。同步缓存类提交如需避免 post-commit 再次写入服务器，可以临时设置 `TOS_RELEASE_UPDATES_SKIP=1`。本地 commit/merge hook 只用于辅助记录或预览，不作为正式版本发布事实来源。

版本号、`CHANGELOG.md`、当前版本 `releaseNotes.json`、`releaseManifest.json` 和 Git tag 默认由 `semantic-release` 在 Gitea `main` push 后自动生成。`main` 当前继续发布 `beta.3` 预发布版本；`stable` 仅作为 semantic-release 要求的稳定 release branch，占位保持在当前基线。首次启用前需要在当前基线提交上补齐 `v0.9.8-beta.3.28` tag，避免自动发布从旧 tag 重新计算历史版本；Gitea 发布环境会在缺少 `stable` 分支时自动创建。

## 5. Gitea 提交与验证门禁

提交前确认状态和验证结果：

```powershell
git status --short --branch
npm run check:backend-version
npm run release:updates:dry-run
npm run release:updates:push:dry-run
npm run check:quick
```

提交只包含当前任务相关文件：

```powershell
git add <files>
git commit -m "类型: 描述"
git push -u gitea codex/<topic>
```

Gitea 远端检查以 Gitea `main` 和 `codex/**` 分支为准，远端检查运行完整 `npm run check`。触发正式自动版本发布时，在 Gitea 发布环境运行 `npm run release`；默认服务器部署不再依赖“先本机打包再上传”。

分支推送到 Gitea 后，合并进本地 `main`，在 `main` 上运行 `npm run check:quick`，再推送 `main` 到 Gitea。

服务器正式发布前，必须满足：

- 当前代码已 push 并合并到 Gitea `main`
- 本地工作区 clean
- 本地 commit 与准备发布的 Gitea `main` commit 一致

检查清单见 `docs/templates/gitea-checklist.md`。

## 6. 服务器更新包

备用上传流程中，可从 clean commit 生成标准包：

```powershell
npm run server:package
```

仅检查包生成条件，不生成正式包：

```powershell
npm run server:package:dry-run
```

标准包名：

```text
release/server/tos-server-update-v<version>-<yyyyMMddHHmmss>-<gitShortSha>.tar.gz
```

包内必须包含：

```text
deploy/manifest.json
deploy/apply-server-update.sh
app-version.json
tms-backend/
tms-frontend/dist/
```

包内不得包含：

```text
node_modules
.git
__pycache__
uploads
runs
logs
backend-data
Dockerfile
nginx.conf
docker-compose.tos.yml
authelia
```

## 7. Gitea main 服务器部署

默认服务器部署流程：

```bash
deploy-tos
```

`deploy-tos` 指向 `/home/obito_li/server-scripts/deploy-tos.sh`，通过 `TOS_GITEA_REMOTE_URL=ssh://git@gitea-tos/luenthai-ai/TOS.git` 使用只读 deploy key 免密拉取 Gitea `main`，再调用 `scripts/server/deploy-gitea-main.sh`。脚本会在服务器本地运行部署检查、生成 `tos-server-update-*.tar.gz`，复制到 `~/TOS/.deploy_uploads/`，再部署到 `~/TOS` 并重建重启 `tos-backend`、`tos-frontend`。

手动排障时可展开执行：

```bash
cd ~/TOS-source
git pull --ff-only origin main
bash scripts/server/deploy-gitea-main.sh
```

只有 Gitea 或服务器拉代码不可用时，才使用备用上传流程：在本机生成 `tos-server-update-*.tar.gz`，手动上传到 `/home/obito_li/TOS/.deploy_uploads/`，再按 `docs/server-deployment-runbook.md` 执行包内脚本。发布记录使用 `docs/templates/server-release-record.md`。

部署后至少验证：

```bash
cd ~/TOS
sudo docker compose -f docker-compose.tos.yml ps
curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```

最后打开线上页面，按 `Ctrl + F5` 强制刷新，确认系统设置里的版本号等于发布版本。

## 8. 回滚

发布失败或线上验证异常时，使用本次发布记录中的 `deployId` 回滚。回滚过程按 `docs/server-deployment-runbook.md` 执行，并填写 `docs/templates/rollback-record.md`。

回滚后必须重新验证：

```bash
sudo docker compose -f docker-compose.tos.yml ps
curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```
