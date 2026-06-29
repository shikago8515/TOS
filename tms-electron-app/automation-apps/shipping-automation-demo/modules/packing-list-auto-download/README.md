# 自动下载箱单模块

前端入口：`packing-list-auto-download`

前端路由：`/#/web-automation/scenarios/packing-list-auto-download`

Executor 路由：

- `/run-packing-list-auto-download-file`
- `/api/run-packing-list-auto-download-file`

## 当前边界

本模块是 Jessica 浏览器自动化下的独立业务入口，用于后续承载 Infor Nexus 箱单自动下载流程。

当前只完成：

- 独立模块目录和 route 注册。
- Excel 上传请求校验，并解析 `PO Number` / `PO#` / `PO号` 等表头。
- 账号凭据校验复用现有执行器能力。
- 照搬 Invoice 自动下载的 request-login 方式登录 Infor Nexus，并请求 `Homepage.jsp?nav=Homenav` 主页。
- 打开 `PackingManifestView.jsp`。
- 在 `PO Number(s)` contains 输入框填入 Excel 第一条 PO，并等待 FlexView POST。
- 运行记录边界和用户可读错误文案。

当前暂不实现：

- 箱单搜索结果选择。
- 箱单 PDF 下载。
- 结果文件和失败清单产物。

后续补充自动化逻辑时，应继续在 `modules/packing-list-auto-download/` 内添加 `workflow`、页面步骤、字段校验和 artifacts，不要把流程写回 `server.mjs`。
