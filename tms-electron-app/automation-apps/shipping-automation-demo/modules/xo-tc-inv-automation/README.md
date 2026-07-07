# XO-Trade Card INV amount 自动化模块

前端入口：`xo-tc-inv-automation`

执行器路由：

- `/run-xo-tc-inv-file`
- `/api/run-xo-tc-inv-file`

项目书范围：

- `网页流程自动化（TC INV板块）`
- 业务归属：Jessica / Shipping
- SLT、VENT、XO 工厂支持自动上传出货明细表，系统自动上传运费表，同步录入货物交期、各项费用等信息。

## 当前实现阶段

当前模块先接入第一段真实页面链路：

1. 接收前端上传的 TC INV Excel。
2. 读取 `Invoice#` 列并提取第一张有效发票号。
3. 复用 Shipping 执行器的 Infor Nexus 登录逻辑。
4. 登录后点击 `#navmenu__inprogressinvoices` 进入 Invoices。
5. 在 `InProgressInvoicePageManagerinvoiceFilterInvoice` 输入框填入 Excel 的 `Invoice#`。
6. 点击 `Apply`。
7. 点击结果列表中的 `InvoicePageResolver` 发票链接，打开 Invoice 详情页。
8. 输出 JSON / Excel 执行摘要和截图。

后续的出货明细上传、运费表上传、交期和费用录入继续在本模块内扩展，不再写入顶层 `server.mjs`。

## 文件职责

- `index.mjs`：模块入口、路由声明、请求处理。
- `workbook.mjs`：TC INV Excel 解析，识别 `Invoice#`、工厂和原始行。
- `workflow.mjs`：Infor Nexus 登录、Invoices 查询、发票详情页打开。
- `artifacts.mjs`：写入执行结果 JSON / Excel。
- `errors.mjs`：TC INV 业务错误说明。
