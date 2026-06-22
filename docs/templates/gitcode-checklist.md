# GitCode Checklist Template

## 分支准备

```powershell
git status --short --branch
git fetch gitcode main --prune
git switch -c codex/<topic> gitcode/main
```

继续已有分支时：

```powershell
git status --short --branch
git fetch gitcode main --prune
git rebase gitcode/main
```

## 提交前检查

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
git push -u gitcode codex/<topic>
git push -u origin codex/<topic>
```

## CI 门禁

- GitCode 分支：
- Commit：
- CI 状态：
- CI 链接：
- `check:backend-version`：
- 版本记录 dry-run：
- 业务回归：
- 是否允许生成服务器包：否

## 合并 main 前

- GitCode 分支 CI 已通过：
- 本地 `main` 已合并目标分支：
- `main` 上 `npm run check:quick` 已通过：
- `main` 推送后允许 `semantic-release` 自动生成版本提交、tag 和 GitCode Release：
- GitCode CI 已配置 `GITCODE_TOKEN`，且当前基线已有 `v0.9.8-beta.3.28` tag：
- `main` 已推送 GitCode：
- GitCode main CI 已通过：
- `main` 已同步 GitHub：
