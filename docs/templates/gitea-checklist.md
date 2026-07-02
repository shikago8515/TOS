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

文档、规则或测试清理默认不修改 `releaseNotes.json`，也不运行 `version:bump`；用户可见版本说明由 `semantic-release` 根据 Conventional Commits 在 Gitea `main` 发布链路生成，服务器部署默认以 Gitea `main` 为准。

普通小改按 `AGENTS.md` 的验证分层记录最接近的真实检查；文档、规则或说明改动优先 `check:changed` 规划出的 whitespace 检查；前端小改优先前端 `lint`、`typecheck` 和相关 `vitest`，后端单模块小改优先对应 `python -m unittest tests.test_xxx -v`。涉及公共工具、前后端契约、依赖、版本发布、CI/CD、部署、打包、认证、下载等高风险区域时，先执行 `check:changed` 映射出的专项检查；只有无法安全缩小范围或专项检查无法覆盖核心边界时，才运行 `npm run check:quick`。

基础状态检查：

```powershell
git status --short --branch
```

涉及版本记录、发布、部署、CI/CD、打包或 `check:changed` 建议升级的高风险主线合并/推送时，按范围补充：

```powershell
npm run check:backend-version
npm run release:updates:dry-run
npm run release:updates:push:dry-run
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
- 是否为同一 commit 重复检查：否
- `check:backend-version`：
- 版本记录 dry-run：
- 业务回归：
- 是否允许生成服务器包：否

## 合并 main 前

- Gitea 分支已推送：
- 本地 `main` 已合并目标分支：
- 目标 commit 已按 `check:changed` 建议完成一次本地检查；如无法安全缩小范围，专项检查或 `npm run check:quick` 已通过：
- `main` 已推送 Gitea：
- 服务器 `~/TOS-source` 可 `git pull --ff-only origin main`：
- 服务器 `scripts/server/deploy-gitea-main.sh` 已执行：
- 后端版本和前端 HTTP 200 已验证：
- 旧远端不参与当前发布：
