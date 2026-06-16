# tms-frontend

`tms-frontend` 是 TOS 当前长期维护的前端源码工作区。恢复出的打包前端保留在：

```text
../tms-electron-app/recovered-frontend
```

该恢复包只作为视觉和行为基线。默认 Electron 打包使用本目录生成的 `dist`；只有紧急回退时才设置 `TOS_FRONTEND_SOURCE=recovered`。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Sass
- Vitest

当前项目未配置 ESLint 或 Prettier，不要在交付说明中声称已运行这些命令。

## 命令

```powershell
npm run dev
npm run dev:server
npm run dev:local
npm run typecheck
npm run test
npm run build
npm run preview
```

`npm run dev` 和 `npm run dev:server` 使用 server mode，远程后端地址来自 `.env.server` 的公开 `VITE_BACKEND_URL`。`npm run dev:local` 保留本机 FastAPI 联调入口。三者都占用 `5174`，切换模式前先停止旧 Vite 进程；根目录入口矩阵见 `../docs/engineering-entrypoints.md`。

当前端口：

- dev / dev:server / dev:local：`http://127.0.0.1:5174`
- preview：`http://127.0.0.1:4174`

## 源码约定

- 后端请求通过 `src/shared/api/backendClient.ts` 或页面级 API 模块封装。
- 导航和模块元数据来自 `src/domain/moduleCatalog.ts`。
- 路由定义来自 `src/app/routeCatalog.ts` 和 `src/app/router.ts`。
- 文件上传、进度、结果展示和处理历史优先复用 `src/shared/ui` 与 `src/shared/process`。
- Excel 处理型页面优先复用 `src/shared/ui/excel-process`、`FilePrecheckPanel`、`ProcessHistoryPanel`、`ResultSummary` 和 `src/shared/styles/jane-page.scss`；已有侧边栏和路由表达子流程时，不在内容区重复实现大卡片式流程切换。
- 页面组件使用 Vue 3 Composition API 和 `<script setup>`。
- 组件样式默认 scoped；全局 CSS 仅用于 reset、design tokens 和项目级基础样式。

## 当前重建状态

已有源码级页面包括：

- `/`
- `/jessca`
- `/sophia-tina`
- `/jane`
- `/jane-bom-summary`
- `/jane-bom-compare`
- `/jane-outbound-compare`
- `/eric`
- `/jason/pdf-reorder`
- `/draft-packing-compare`
- `/tms-finance-internal-reconciliation`
- `/tms-finance-work-sales`
- `/browser-plugins`
- `/web-automation`
- `/web-automation/scenarios/shipping-automation-2`
- `/web-automation/scenarios/po-auto-download`
- `/infornexus`
- `/jane-sap`
- `/eric-infornexus`
- `/adidas-materials`
- `/settings`
- `/release-updates`

`placeholder` 路由使用 `src/pages/RoutePlaceholder.vue`。
旧 `/#/it-invoice-pdf-reorder` 已作为历史链接重定向到 Jason canonical 路由 `/#/jason/pdf-reorder`。

`/web-automation/scenarios/po-auto-download` 使用独立源码目录 `src/pages/po-auto-download/`，不复用通用场景页。页面上传 Excel、选择本机下载目录，并调用本机 `shipping-automation-demo` 执行器的 `/api/run-po-auto-download-file`；Infor Nexus 登录、`InvoicesView.jsp`、`InProgressInvoices` 筛选请求和后续文件下载都留在执行器模块内处理。

PO 自动下载执行中会轮询本机执行器 `/api/health` 的 `activeRun.progress`，实时显示阶段、已处理数量、已下载数量、失败数量和当前 Invoice，避免长批量下载时页面只显示等待状态；最终失败结果会展示前 3 条失败示例。

PO 自动下载模板不放在前端 public 固定目录，页面通过后端 `/api/system/config/po-auto-download/template/download` 从 MinIO 下载，默认对象为 `tos-templates/po-auto-download/po-auto-download-template.xls`，浏览器保存文件名仍为 `PO 自动下载模板.XLS`。

PO 自动下载的保存目录输入的是父目录；执行器每次运行会自动创建 `TC Invoice YYYY-MM-DD` 子文件夹，若重复则递增为 `TC Invoice YYYY-MM-DD-1`。用户可见的运行子文件夹默认只保留下载完成的 PDF，不写入搜索页 HTML、发票页 HTML 或结果 JSON。

当前本机验证样例：使用 `PO 自动下载模板.XLS` 通过纯请求链路下载 13/13 个 active Invoice PDF，输出目录为 `D:\TOS-Shipping-test\TC Invoice 2026-06-16-1`。

浏览器模式默认连接服务器后端 `https://ai.tomwell.net:56130/tos/desktop-api`；当部署在 `/tos` 路径下时使用同源 `/tos/desktop-api`，避免误连本机后端。

## 迁移规则

不要用全新设计替换恢复基线。新增或调整页面时，按一个路由一个路由迁移，对照恢复 UI 保持原产品体验，并运行最接近的真实检查命令。
