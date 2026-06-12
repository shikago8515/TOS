# Release Notes Template

更新文件：

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

- 用户可见改动默认运行 `npm run version:bump`。
- 指定版本运行 `npm run version:set -- <version>`。
- `releaseNotes.json.version` 必须等于 `app-version.json.version`。
- 至少一个 `added`、`improved`、`fixed` 数组非空。

