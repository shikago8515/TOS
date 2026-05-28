# 网页自动化 API 快速通道设计

## 背景

当前网页自动化控制台位于 `tms-electron-app/automation-apps/playwright-console`，主要通过 Playwright 驱动 Edge 页面完成 SAP BTP Task Center 里的 PO 决策处理。现有实现偏调试和演示：开启 `slowMo`、页面高亮、状态浮层和多处固定等待，导致执行速度明显慢于人工操作。

本次目标选择“极限提速”：尽量绕过 UI 点击，研究并复用目标网页真实提交接口。由于 SAP BTP 页面通常包含登录态、CSRF token、动态任务标识、etag 或租户 header，不能直接猜接口或硬编码请求；必须先捕获一次真实 UI 操作，再把可验证的接口模板沉淀为快速执行器。

## 目标

- 新增接口捕获能力，记录正式 UI 操作过程中与决策提交相关的 `XHR/fetch` 请求。
- 生成本地分析报告，帮助识别可复用的查询接口、提交接口、必要 headers、payload 字段和响应校验规则。
- 新增运行模式，为后续直接 API 批量提交提供入口，同时保留 UI 回退能力。
- 在 API 快速模式不可用、接口校验失败或页面结构变化时，明确回退到现有 UI 流程，避免静默误提交。
- 将敏感信息控制在本机运行目录，不把 cookie、token 或完整认证 header 展示到普通 UI 日志里。

## 非目标

- 不在第一步盲目调用未知生产接口。
- 不绕过用户登录；仍复用用户真实 Edge 会话和 `playwright-user-data` 登录态。
- 不修改 Electron 发布、打包、COS 更新源或版本号。
- 不把接口捕获结果上传到外部服务。

## 运行模式

### 调试 UI 模式

保留现有 Playwright 点击流程和可视化提示，用于首次捕获、业务确认和失败排查。这个模式可以继续使用页面高亮、状态浮层和慢动作，但后续应允许配置关闭。

### 捕获分析模式

基于调试 UI 流程运行，但在 `page` 和弹出的详情页上监听网络请求。捕获范围默认限定为 `XHR/fetch` 的 `POST`、`PUT`、`PATCH`、`DELETE`，并优先标记发生在选择 `Accept/Reject`、填写备注、点击 `Submit` 附近的请求。捕获结果写入本地 `runs/network-captures/`。

### 快速 API 模式

读取已确认的接口模板，复用当前浏览器上下文的认证状态，通过 Playwright request context 或页面上下文直接调用接口批量处理 Excel 行。成功条件必须来自接口响应和业务字段校验，不能只看 HTTP 2xx。

### 混合模式

当任务定位仍依赖 UI，但提交决策接口已经稳定时，UI 只负责打开任务和获取动态 task context，决策和提交走 API。这个模式作为快速 API 模式前的过渡方案。

## 组件设计

### NetworkCapture

负责挂载到 `page`、popup page 和相关 frame 所属页面，收集请求和响应元数据。

保存内容：

- 时间戳、请求方法、URL、resource type、状态码、耗时。
- 经过脱敏的 headers。
- 请求 payload 摘要和 JSON 结构。
- 响应 JSON 摘要、错误码和关键业务字段。
- 与当前 Excel 行、Case Number、PO、Task ID、Decision 的关联信息。

脱敏规则：

- 默认隐藏 `cookie`、`authorization`、`x-csrf-token`、`set-cookie`、`sap-contextid` 等认证或会话字段。
- 完整原始请求只允许保存在本机捕获文件中，并通过配置开关控制；前端日志只显示脱敏摘要。

### ApiTemplateAnalyzer

负责从捕获文件中筛选候选接口。

筛选规则：

- 优先选择在 `Submit` 点击前后短时间窗口内出现的写请求。
- 优先选择 payload 中包含 task id、decision、comment、PO 或 case 相关字段的请求。
- 标记疑似 CSRF token 获取接口、任务详情查询接口和最终提交接口。
- 输出“候选接口报告”，不自动启用快速提交。

### FastApiExecutor

负责根据已确认模板执行批量提交。

执行逻辑：

- 启动浏览器上下文，确认登录态有效。
- 获取或刷新 CSRF token。
- 为每个 Excel 行解析 task context。
- 组装请求 payload，调用提交接口。
- 校验响应状态、业务状态和返回字段。
- 按行记录 `ok`、`failed`、`skipped`，失败时保留可回放的脱敏上下文。

### WorkflowModeRouter

负责根据用户选择和配置决定执行路径。

执行路径：

- `debug-ui`：走现有 UI workflow。
- `capture`：走现有 UI workflow，并启用 NetworkCapture。
- `hybrid`：UI 获取上下文，API 提交。
- `fast-api`：优先 API 执行，失败时根据配置决定是否回退 UI。

## 数据流

1. 用户上传 Excel 并选择运行模式。
2. 控制台解析 Excel，生成标准化业务行。
3. 捕获模式下，UI 流程正常执行，同时记录候选网络请求。
4. 分析器生成本地报告，列出候选接口和字段映射。
5. 用户或开发者确认接口模板后，快速 API 模式读取模板。
6. 快速 API 模式直接批量调用接口，返回逐行结果。
7. 如果 API 校验失败，按配置停止或回退到 UI 模式。

## 错误处理

- 登录态失效：提示用户重新登录，不尝试伪造凭据。
- CSRF token 失效：尝试刷新一次；仍失败则停止当前批次。
- 接口模板缺字段：拒绝进入快速 API 模式，并提示先运行捕获模式。
- 单行业务失败：记录行级错误；是否继续由 `continueOnError` 控制。
- API 响应不确定：标记为 `needs-review`，不算成功。
- 捕获文件写入失败：不中断 UI 流程，但在运行结果中提示无法生成分析报告。

## 测试与验证

- `npm run check` 覆盖新增 Node.js 文件的语法检查。
- 为接口分析器补充离线单元测试，使用脱敏后的模拟 HAR/JSON 捕获样本。
- 在没有真实 SAP 环境时，快速 API 执行器先通过 mock request adapter 验证 payload 生成、脱敏和错误分支。
- 真实环境验证顺序固定为：捕获一次人工确认流程、检查报告、用单行 Excel 运行快速 API、再扩大到小批量。

## 风险与控制

- 目标网页接口可能随版本变化：模板必须带版本、URL pattern 和响应校验规则。
- 直接 API 调用可能绕过前端校验：执行器必须保留业务字段校验，不允许只提交 Excel 原值。
- 敏感信息泄露风险：默认脱敏，原始捕获只存本地，且不进入诊断包，除非后续明确增加受控导出。
- 批量提交不可逆：快速 API 模式首次启用时默认要求单行试跑；批量运行前显示待提交总数和模式。

## 实施边界

第一轮实现只做捕获、分析报告、运行模式入口和配置结构，不直接启用生产快速提交。等捕获到真实接口并确认字段后，再实现 `fast-api` 的具体模板和执行器。
