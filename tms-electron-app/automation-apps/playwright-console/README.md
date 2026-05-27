# Playwright 网页自动化控制台

这是一个本地运行的 Node.js + Playwright 工具，用来把 Excel 数据批量带入网页流程。当前重做后的主流程是：

- `SAP BTP PO 决策处理`
- Excel 支持列名：`Case Number`、`PO`/`PO Number`、`Task ID`、`Decision`、`Comments`
- `Decision` 可填 `Accept`、`Reject`，也支持中文 `接受`、`拒绝`
- 首次正式运行会打开 Edge，可手动登录；登录状态保存在 `playwright-user-data/`

## 启动

```powershell
npm install
npm start
```

打开：

```text
http://localhost:3100
```

## 使用方式

1. 先勾选“仅预览，不操作网页”，上传 Excel，确认解析出的行数和字段正确。
2. 取消“仅预览”，开始正式运行。
3. 如果网页结构变化导致失败，失败截图会保存到 `runs/` 目录。

## 配置

主要配置在 `config/default.config.json`：

- `workflows.sap-btp-po-decisions.startUrl`：SAP BTP 入口网址
- `taskFilter.taskTypeNames`：Task Center 里要筛选的任务类型，默认匹配视频里的 `Review Sub-Ticket Resolution`
- `selectors.taskCenterLinkPatterns`：Task Center 磁贴/链接名称匹配
- `selectors.taskRowPatterns`：任务列表中定位行的规则
- `selectors.detailRowPatterns`：详情页中定位 PO/Task 行的规则
- `submit.enabled`：是否在选择 Accept/Reject 后点击提交按钮

默认 `submit.enabled` 是 `true`。正式运行会尝试点击 `Submit`、`Save`、`OK` 或 `Confirm`，如果没有找到按钮，会记录日志并继续。只想让它选择决策、不提交时，可改成：

```json
"submit": {
  "enabled": false,
  "required": false,
  "buttonNames": ["Submit", "Save", "OK", "Confirm"],
  "timeoutMs": 8000,
  "afterSubmitMs": 1500
}
```

## 测试 Excel

项目里保留了几个样例：

- `test_po_decisions.xlsx`
- `po_decisions_test.xlsx`
- `test_btp.xlsx`
- `test_btp_tasks.xlsx`
