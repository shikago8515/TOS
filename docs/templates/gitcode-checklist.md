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
npm run check:quick
```

## 提交与推送

```powershell
git add <files>
git commit -m "类型: 描述"
git push -u gitcode codex/<topic>
```

## CI 门禁

- GitCode 分支：
- Commit：
- CI 状态：
- CI 链接：
- 是否允许生成服务器包：否

