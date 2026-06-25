# Gitea Checklist Template

## 分支准备

```powershell
git status --short --branch
git fetch gitea main --prune
git switch -c codex/<topic> gitea/main
```

继续已有分支时：

```powershell
git status --short --branch
git fetch gitea main --prune
git rebase gitea/main
```

## 提交前检查

文档、规则或测试清理默认不修改 `releaseNotes.json`，也不运行 `version:bump`；用户可见版本说明由 `semantic-release` 根据 Conventional Commits 在 GitCode `main` 发布链路生成，服务器部署默认以 Gitea `main` 为准。

```powershell
git status --short --branch
npm run check:backend-version
npm run release:updates:dry-run
npm run release:updates:push:dry-run
npm run check:quick
```

业务回归按改动范围补充，例如 Work Sales 改动需要用真实 bulk `.XLS` 和空 TURNOVER 模板调用 `/api/tms-finance/work-sales/process`，确认写入数量符合预期。

## 提交与推送

提交信息必须使用 Conventional Commits，确保 `semantic-release` 能正确判断版本升级类型。常用类型：

- `feat: 描述` 触发 minor 版本
- `fix: 描述` 触发 patch 版本
- `perf:`、`refactor:`、`build:`、`ci:` 触发 patch 版本
- `docs:`、`test:`、`chore:` 默认不触发产品版本

```powershell
git add <files>
git commit -m "feat: 描述"
git push -u gitea codex/<topic>
```

## CI 门禁

- Gitea 分支：
- Commit：
- 本地验证状态：
- `check:backend-version`：
- 版本记录 dry-run：
- 业务回归：
- 是否允许生成服务器包：否

## 合并 main 前

- Gitea 分支已推送：
- 本地 `main` 已合并目标分支：
- `main` 上 `npm run check:quick` 已通过：
- `main` 已推送 Gitea：
- 服务器 `~/TOS-source` 可 `git pull --ff-only origin main`：
- 服务器 `scripts/server/deploy-gitea-main.sh` 已执行：
- 后端版本和前端 HTTP 200 已验证：
- 如需同步 GitCode/GitHub，已按对应远端规则执行：
