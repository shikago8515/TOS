# Release Notes Template

当前版本弹窗文件：

```text
tms-frontend/src/shared/version/releaseNotes.json
```

格式：

```json
{
  "version": "0.9.8-beta.3.3",
  "date": "2026-06-12",
  "added": [],
  "improved": [],
  "fixed": []
}
```

## 分类规则

- `added`：新功能、新页面、新业务能力。
- `improved`：已有行为优化、交互优化、文案优化、兼容性优化。
- `fixed`：bug 修复、异常流程修复、错误结果修复。

## 版本规则

- 用户可见改动默认由 `semantic-release` 在 GitCode `main` push 后自动更新版本和当前版本说明；本地预演使用 `npm run release:dry-run`。
- 普通功能、修复、测试或文档清理不手改 `releaseNotes.json`，也不运行 `version:bump`。
- 只有用户明确要求指定本地版本时运行 `npm run version:set -- <version>`。
- `releaseNotes.json.version` 必须等于 `app-version.json.version`。
- `releaseNotes.json` 只写当前版本变更；手工指定版本后必须清理上一版本遗留的 `added`、`improved`、`fixed` 条目。
- `/release-updates` 历史时间线以服务器 MySQL `release_update_records` 为主源；本地 `releaseHistory.json` 和后端默认 seed `tms-backend/data/release_updates_seed.json` 通过 `npm run release:updates:pull` 从服务器记录合并生成，并用一致性测试防止前后端分叉。
- 至少一个 `added`、`improved`、`fixed` 数组非空。
