# Browser Automation Module Standards

本文件是 TOS 浏览器自动化的工程级模块规范。后续新增或重构浏览器自动化功能时，必须优先按业务页面 / 自动化功能拆分，不再把新业务流程继续塞进单个巨大 `server.mjs`。

依据：

- `TOS项目立项书(1).docx` 附录 1 的业务程序清单。
- 前端 `webAutomationEntries`、`moduleCatalog`、路由页面的业务入口。
- 当前项目维护方式：用户和业务人员按“万代、新龙泰、PO 下载、Invoice 下载、BTP、aTP”等功能定位问题。

## 核心原则

1. 一个业务页面入口，对应一个浏览器自动化业务模块。
2. 业务模块优先，技术分层其次。先按“万代 / 新龙泰 / PO 下载 / Invoice 下载”等业务功能建目录，再在模块内部拆 `workbook`、`workflow`、`errors` 等文件。
3. `server.mjs` 只负责启动服务、注册路由、分发到业务模块，不承载新的业务流程细节。
4. 公共能力才放入 `shared/`，例如登录、浏览器生命周期、ExtJS 弹窗、Desktop Utility 检测、Excel 基础解析、运行产物写入。
5. 业务模块拥有自己的报错解释、输入校验、结果导出和失败记录；用户看到的错误必须是业务语言，不直接暴露 `JSON.parse`、Playwright target closed、DOM selector 等底层信息。
6. 当前已有的大文件可以保留兼容；新需求、新自动化、新大块逻辑必须进入业务模块目录。对旧流程做小型故障修复时可以局部补丁，但不得继续扩大单文件复杂度。

## 推荐目录

当前 Infor Nexus / Shipping 相关 executor 的后续目标结构如下：

```text
tms-electron-app/
  automation-apps/
    shipping-automation-demo/
      server.mjs                  # 只负责启动服务、注册路由、分发模块

      modules/
        wandai-shipping/           # 万代
          index.mjs                # /api/run-shipping-file 入口
          workbook.mjs             # 万代 Excel 解析、字段校验
          workflow.mjs             # 万代主流程编排
          shipment-scan.mjs        # Shipment Scan 页面操作
          create-shipment.mjs      # Create Shipment 页面操作
          errors.mjs               # 万代业务错误解释与失败步骤分类
          artifacts.mjs            # 万代结果 Excel / JSON / 截图归档
          README.md                # 输入模板、流程、调试说明

        xinlongtai-shipping/       # 新龙泰
          index.mjs
          workbook.mjs
          workflow.mjs
          shipment-scan.mjs
          errors.mjs
          artifacts.mjs
          README.md

        po-auto-download/          # PO / Invoice 下载
          index.mjs
          workbook.mjs
          workflow.mjs
          invoice-download.mjs
          errors.mjs
          artifacts.mjs
          README.md

        infornexus-auto-add/       # Infor Nexus 自动搜索添加
          index.mjs
          workbook.mjs
          workflow.mjs
          search-page.mjs
          errors.mjs
          artifacts.mjs
          README.md

      shared/
        http.mjs
        browser.mjs
        infornexus-login.mjs
        extjs-dialogs.mjs
        desktop-utility.mjs
        artifacts.mjs
        workbook-utils.mjs
        run-lifecycle.mjs
        errors.mjs
```

后续如果新增 aTP、bTP、BOM 上传、交期批量修改等浏览器自动化，也按同样规则新增业务模块：

```text
modules/
  atp-report-upload/
  btp-upload-accept/
  bom-upload/
  delivery-date-update/
```

不要把这些新功能写进既有的 `wandai-shipping`、`xinlongtai-shipping` 或 `server.mjs`。

## 业务模块职责

每个 `modules/<business-module>/` 至少要说明或实现以下边界：

| 文件 | 职责 |
| --- | --- |
| `index.mjs` | 模块入口。声明模块 id、业务名称、路由路径、handler，并把请求交给本模块内部流程。 |
| `workbook.mjs` | 解析 Excel / CSV / 输入文件，做字段名、空值、格式、重复值校验。 |
| `workflow.mjs` | 编排本业务主流程，不写通用浏览器工具函数。 |
| `*-page.mjs` | 封装具体业务页面操作，例如搜索、筛选、点击、上传、下载、回写。 |
| `errors.mjs` | 把页面异常、业务失败、网络超时、权限不足等转换成用户可读中文说明。 |
| `artifacts.mjs` | 输出结果 Excel、失败清单、JSON、截图和可下载文件。 |
| `README.md` | 说明业务输入模板、执行步骤、常见失败原因、调试入口。 |

模块内部可以继续按技术角色拆文件，但第一层目录必须是业务模块。

## `server.mjs` 边界

`server.mjs` 只能做这些事情：

- 加载配置、启动 HTTP 服务。
- 设置 CORS、鉴权、健康检查、运行状态。
- 注册业务模块。
- 将请求分发到对应模块。
- 保留旧 route 的兼容映射。
- 调用公共运行生命周期能力。

`server.mjs` 不应该继续新增这些内容：

- 新业务 Excel 解析。
- 新业务 Playwright 操作步骤。
- 新业务页面 selector。
- 新业务错误文案。
- 新业务结果 Excel 生成。
- 新业务批量循环和失败清单规则。

如果必须临时修复旧流程，可以在当前文件做小补丁，但补丁不能成为新增功能的常态。后续同类扩展应先建模块，再迁移或复用逻辑。

## 模块注册契约

新增模块时，推荐 `index.mjs` 暴露统一定义，便于 `server.mjs` 只做分发：

```js
export const moduleDefinition = {
  id: "wandai-shipping",
  title: "万代 shipping 自动化",
  routePaths: ["/run-shipping-file", "/api/run-shipping-file"],
  frontendEntryId: "shipping-automation",
};

export function createModuleHandler(deps) {
  return async function handleWandaiShippingRequest(req, res, context) {
    // 只处理万代业务请求。
  };
}
```

实际实现可以根据现有 raw `http` server 逐步调整，但必须保持“模块定义 + 模块 handler”的方向。新增 route 不应散落在 `server.mjs` 的长 `if` 链里。

## 前端入口对应关系

新增浏览器自动化页面时，需要同步维护：

- `tms-frontend/src/pages/web-automation/webAutomationModel.ts`
- `tms-frontend/src/domain/moduleCatalog.ts`
- `tms-frontend/src/app/routeCatalog.ts`
- `tms-frontend/src/app/router.ts`
- 对应页面目录：`tms-frontend/src/pages/<business-module>/`
- 对应 executor 模块：`tms-electron-app/automation-apps/<executor>/modules/<business-module>/`

命名建议保持一致：

| 前端 entry id | 后端模块目录 | 说明 |
| --- | --- | --- |
| `shipping-automation` | `wandai-shipping` | 万代 shipping 自动化 |
| `xinlongtai-shipping-automation` | `xinlongtai-shipping` | 新龙泰 shipping 自动化 |
| `shipping-automation-2` | `released-bulk` | released Bulk 自动化 |
| `infornexus-auto-add` | `infornexus-auto-add` | Infor Nexus 自动搜索添加 |
| `po-auto-download` | `po-auto-download` | Invoice / PO 文件下载 |

前端页面、路由、执行器 module 名称不必完全相同，但必须在模块 `README.md` 中写清映射。

## 错误处理要求

所有浏览器自动化模块必须满足项目书 Web Automation 验收标准中的异常处理要求：

- 页面元素找不到、点击失败、动态加载超时，要说明“当前卡在哪一步、可能原因、用户该怎么处理”。
- 网络断开、弱网、页面加载失败、404、权限不足、服务器繁忙、风控拦截，要给出业务说明和重试建议。
- 批量处理时，单行失败优先写入失败清单，不应无理由终止全量流程。
- 程序异常必须留存截图、原始响应、生命周期日志和失败行明细。
- 前端展示用户可读中文说明；底层错误只进入日志或诊断附件。
- 不允许直接把 `JSON.parse`、`Target page closed`、selector、stack trace 当作用户主错误文案。

## Shared 放置规则

只有满足以下条件之一，才放入 `shared/`：

- 至少两个业务模块已经复用。
- 明确属于平台能力，不属于某个业务，例如 browser launch、run lifecycle、artifact writer。
- 明确属于 Infor Nexus 通用页面机制，例如登录、ExtJS dialog、Desktop Utility 连接检测。

以下内容不要放入 `shared/`：

- 只有万代使用的 PO 字段规则。
- 只有新龙泰使用的模板列名。
- 只有某个页面的按钮 selector。
- 某个业务专属的失败步骤分类。
- 某个业务专属的结果 Excel 列。

## 新增模块检查清单

新增浏览器自动化前，先完成以下检查：

1. 是否对应项目书附录 1 中的一个业务程序，或用户明确新增的一个业务页面。
2. 是否已有相同业务模块；如果有，扩展原模块，不另起相近名称。
3. 是否需要新增前端页面入口、模板下载、账号配置、结果下载和运行历史。
4. 是否需要新增 executor route；route 是否只注册到本业务模块。
5. 是否有 Excel 模板解析测试、错误格式化测试、至少一个流程级 dry-run 或 handler 测试。
6. 是否有失败清单、截图、JSON 原始结果、可下载产物。
7. 是否保证账号、密码、Token、Cookie 不硬编码、不写入普通日志。
8. 是否更新模块 README 和必要的工程文档。

## 当前遗留说明

当前 `shipping-automation-demo/server.mjs` 已经承载了多个业务流程，这是历史遗留状态，不代表后续新增方式。后续规则是：

- 不立即为了规范而拆旧代码，避免影响当前生产可用性。
- 新增浏览器自动化必须先建业务模块目录。
- 对旧流程做中大型改造时，优先把对应业务迁入 `modules/<business-module>/`。
- 迁移时按业务模块逐个拆，不做一次性大爆炸重构。
