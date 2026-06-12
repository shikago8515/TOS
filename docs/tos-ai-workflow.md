# TOS-AI 完整工作流

本文定义 TOS 项目从开始需求到 GitCode 留痕、CI、服务器部署和回滚的标准流程。服务器 `~/TOS` 不是 Git 仓库，不在服务器执行 `git pull`；服务器发布只接收本地生成的标准更新包。

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

## 2. 同步 GitCode 主线

新任务必须从 GitCode 最新主线开始：

```powershell
git fetch gitcode main --prune
git switch -c codex/<topic> gitcode/main
```

继续已有 `codex/<topic>` 分支时，先确认工作区 clean：

```powershell
git status --short --branch
git fetch gitcode main --prune
git rebase gitcode/main
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

用户可见改动默认由 AI 自动递增版本，不再等待用户单独提醒：

```powershell
npm run version:bump
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

更新内容写入：

```text
tms-frontend/src/shared/version/releaseNotes.json
```

规则：

- 新功能写入 `added`
- 行为优化写入 `improved`
- bug 修复写入 `fixed`
- 至少一个数组非空
- `version` 必须等于 `app-version.json` 的版本
- `date` 使用当前发布日期，格式为 `YYYY-MM-DD`

模板见 `docs/templates/release-notes.md`。

## 5. GitCode 提交与 CI 门禁

提交前确认状态和验证结果：

```powershell
git status --short --branch
npm run check:quick
```

提交只包含当前任务相关文件：

```powershell
git add <files>
git commit -m "类型: 描述"
git push -u gitcode codex/<topic>
```

GitCode CI 位于 `.gitcode/workflows/tos-check.yml`，对 `main`、`codex/**` 分支 push 和面向 `main` 的合并请求运行完整 `npm run check`。

服务器正式发布前，必须满足：

- 当前代码已 push 到 GitCode
- GitCode CI 通过
- 本地工作区 clean
- 本地 commit 与准备发布的 GitCode commit 一致

检查清单见 `docs/templates/gitcode-checklist.md`。

## 6. 服务器更新包

服务器发布前从 CI 通过的 clean commit 生成标准包：

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

## 7. 上传与服务器部署

只上传 `tos-server-update-*.tar.gz` 到：

```text
/home/obito_li/TOS/.deploy_uploads/
```

服务器部署按 `docs/server-deployment-runbook.md` 执行。发布记录使用 `docs/templates/server-release-record.md`。

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

