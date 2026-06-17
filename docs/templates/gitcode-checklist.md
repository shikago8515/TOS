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

```powershell
git add <files>
git commit -m "类型: 描述"
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
- `main` 已推送 GitCode：
- GitCode main CI 已通过：
- `main` 已同步 GitHub：
