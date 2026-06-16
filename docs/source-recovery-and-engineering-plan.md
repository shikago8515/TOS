# TOS 源码恢复评估与工程化重建方案

> 历史快照：本文记录源码恢复早期评估与重建路线。当前工程事实以仓库根 `README.md`、`AGENTS.md`、`docs/engineering-closure-roadmap.md` 和当前源码为准；文中“前端源码丢失/待重建”等结论不代表当前完成度。

更新时间：2026-05-23

当前评估目录：

`C:\Users\Jax_shi\Desktop\win-unpacked\tms-electron-app\dist-diagnostics\win-unpacked`

## 1. 结论

当前机器上没有找到完整源码仓库。现有目录是 Electron 打包后的 `win-unpacked` 发布包，不适合作为长期开发和主分支迭代目录。

发布包里仍然保留了部分可恢复资产：

| 资产 | 状态 | 处理建议 |
| --- | --- | --- |
| Electron 主进程 | 可从 `resources/app.asar` 恢复 | 直接恢复为 `tms-electron-app` 源码 |
| Electron preload | 可从 `resources/app.asar` 恢复 | 直接恢复并补 TypeScript 类型 |
| FastAPI 后端 | 已在 `resources/backend` 明文保留 | 直接恢复为 `tms-backend` 源码 |
| 前端源码 | 未找到 `src/`、`.vue`、`.tsx`、sourcemap | 不建议反编译，建议按功能重建 |
| 前端构建产物 | 存在 Vite bundle JS/CSS | 可作为行为参考，不作为可维护源码 |
| Eric 前端补丁 | 存在单独 `dist-frontend/eric-module.js` | 可参考行为，后续改写成正式组件 |
| 自动化应用/浏览器插件 | 存在发布资源 | 可迁移到 Electron extraResources |

核心判断：

1. 后端和 Electron 壳可以比较完整恢复。
2. 前端源码已经丢失或不在当前机器上，不能无损恢复。
3. 继续直接修改 `app.asar` 或 `win-unpacked` 会让项目越来越难维护。
4. 正确路线是新建源码工作区，把当前发布包作为功能基线，按统一工程规范重建前端。

## 2. 已确认的原始工程结构线索

`resources/app.asar` 内的 `package.json` 暴露了原始目录假设：

```text
tms-frontend/
tms-backend/
tms-electron-app/
```

构建脚本逻辑是：

```text
cd ../tms-frontend
npm run build
cd ../tms-electron-app
node scripts/copy-frontend.js
electron-builder
```

Electron 开发态加载：

```text
http://localhost:5174
```

Electron 打包态加载：

```text
dist-frontend/index.html
```

FastAPI 后端默认地址：

```text
http://127.0.0.1:8000
```

## 3. 当前发布包资产清单

### 3.1 Electron 可恢复文件

来自 `resources/app.asar`：

```text
main-simple.js
main.js
preload.js
adidas-materials-main.js
adidas-materials-preload.js
build.ps1
scripts/copy-frontend.js
package.json
README.md
```

主进程能力包括：

- 创建主窗口，打包态加载 `dist-frontend/index.html`
- 启动 FastAPI 后端，端口 `8000`
- 通过 preload 暴露 `window.electronAPI`
- 诊断日志与诊断包导出
- 浏览器插件启动
- 网页自动化应用启动/停止
- 外部模块启动
- adidas Materials 采集器窗口和 IPC

preload 已暴露的 API：

```text
getBackendUrl
openExternal
recordDiagnosticEvent
exportDiagnosticsPackage
getExternalModules
launchExternalModule
getBrowserPlugins
launchBrowserPlugin
getAutomationApps
launchAutomationApp
stopAutomationApp
launchAdidasMaterialCollector
```

### 3.2 后端可恢复文件

当前存在：

```text
resources/backend/main.py
resources/backend/requirements.txt
resources/backend/api/jessca_api.py
resources/backend/api/sophia_tina_api.py
resources/backend/api/jane_api.py
resources/backend/api/eric_api.py
resources/backend/modules/jessca_module.py
resources/backend/modules/sophia_tina_module.py
resources/backend/modules/jane_module.py
resources/backend/modules/eric_module.py
resources/backend/utils/excel_utils.py
resources/backend/utils/file_utils.py
```

依赖：

```text
fastapi
uvicorn
python-multipart
openpyxl
pandas
xlrd
```

后端接口概览：

| 模块 | 上传接口 | 下载接口 | 说明 |
| --- | --- | --- | --- |
| Jessca | `POST /api/jessca/process` | `GET /api/jessca/download/{filename}` | 多发票与参考表核对 |
| Sophia/Tina | `POST /api/sophia-tina/process` | `GET /api/sophia-tina/download/{filename}` | TMS/Article/Price/Pack 合并 |
| Jane | `POST /api/jane/process` | `GET /api/jane/download/{filename}` | 成品表生成 |
| Jane | `POST /api/jane/test` | 无 | 测试验证入口 |
| Eric | `POST /api/eric/process` | `GET /api/eric/download/{filename}` | PO 区块拆分与 Final_Data 生成 |
| Health | `GET /health` | 无 | 后端健康检查 |

### 3.3 前端现状

前端只剩打包产物：

```text
dist-frontend/index.html
dist-frontend/assets/index-COwNHm1K.js
dist-frontend/assets/index-eQdTsAfm.css
dist-frontend/eric-module.js
dist-frontend/excel-page-versions.js
dist-frontend/upload-layout-fix.css
```

问题：

- 没有发现 `src/`
- 没有发现 `.vue`、`.tsx`、`.jsx`
- 没有发现前端 sourcemap
- 主 bundle 是压缩后的 Vite 产物
- Eric 页面是运行时注入式脚本，不是正常组件

因此，前端不能作为可维护源码继续开发，只能作为行为参考。

## 4. 风险评估

### 4.1 不能继续在发布包中迭代

继续修改 `win-unpacked` 或 `app.asar` 的风险：

- 没有 TypeScript 检查
- 没有组件边界
- 没有源码级 diff
- 不容易 code review
- 不能稳定复现构建
- 每次修复都可能覆盖前一次临时补丁
- UI、接口、状态逻辑会继续碎片化

### 4.2 前端反编译价值有限

可以从 bundle 里找 API、文案、部分布局和交互，但不能恢复：

- 原始组件拆分
- 原始 props/emits 类型
- 原始 composable/hook
- 原始路由结构
- 原始状态管理设计
- 原始样式组织
- 原始测试

如果直接从 bundle 反推源码，通常会得到一套“能跑但更难维护”的代码。更稳妥的做法是重建源码结构，然后按当前功能逐个迁移。

## 5. 推荐的新源码工作区

建议新建：

```text
C:\Users\Jax_shi\Desktop\tos-source\
  apps/
    desktop/
    frontend/
    backend/
  packages/
    shared-contracts/
  docs/
  samples/
  scripts/
```

也可以沿用原始目录风格：

```text
C:\Users\Jax_shi\Desktop\tos-source\
  tms-electron-app/
  tms-frontend/
  tms-backend/
  docs/
  samples/
```

如果优先降低迁移成本，建议用第二种，因为它匹配现有构建脚本。

## 6. 前端重建目录规范

建议使用 Vue 3 + TypeScript + Vite。理由是当前 bundle 中可以看到 Vue 痕迹，并且 Electron 主进程开发态默认指向 Vite 端口。

推荐结构：

```text
tms-frontend/
  src/
    app/
      main.ts
      router.ts
      App.vue
    pages/
      DashboardPage.vue
      JesscaPage.vue
      SophiaTinaPage.vue
      JanePage.vue
      EricPage.vue
      AutomationPage.vue
      DiagnosticsPage.vue
    features/
      jessca/
      sophia-tina/
      jane/
      eric/
      automation/
      diagnostics/
      adidas-materials/
    shared/
      api/
        http.ts
        backend.ts
        types.ts
      components/
        AppShell.vue
        ModuleCard.vue
        FileUploadField.vue
        UploadFileList.vue
        ProcessActions.vue
        ProcessResultPanel.vue
        LogViewer.vue
        DownloadButton.vue
        ErrorSummary.vue
      composables/
        useFileSelection.ts
        useProcessRequest.ts
        useBackendHealth.ts
      styles/
        tokens.css
        base.css
      utils/
```

页面只负责组合，不直接写重复上传逻辑。业务模块只提供模块配置、接口参数、结果字段映射。

## 7. 后端重建目录规范

建议结构：

```text
tms-backend/
  app/
    main.py
    api/
      jessca.py
      sophia_tina.py
      jane.py
      eric.py
    services/
      jessca_service.py
      sophia_tina_service.py
      jane_service.py
      eric_service.py
    schemas/
      common.py
      jessca.py
      sophia_tina.py
      jane.py
      eric.py
    core/
      config.py
      paths.py
    utils/
      excel.py
      files.py
  tests/
  requirements.txt
```

后端当前可以先原样恢复，再逐步重构：

1. 第一阶段：保持接口兼容，目录尽量少动。
2. 第二阶段：补 Pydantic response schema。
3. 第三阶段：给每个业务模块补样例文件和回归测试。

## 8. API 契约标准

所有上传处理接口统一响应格式：

```ts
export interface ProcessResponseBase {
  success: boolean
  message: string
  logs: string[]
  output_file?: string
}
```

模块扩展：

```ts
export interface JesscaProcessResponse extends ProcessResponseBase {
  invoice_count?: number
  total_items?: number
  matches?: number
}

export interface SophiaTinaProcessResponse extends ProcessResponseBase {
  working_count?: number
}

export interface JaneProcessResponse extends ProcessResponseBase {
  working_count?: number
}

export interface EricProcessResponse extends ProcessResponseBase {
  row_count?: number
}
```

统一下载 URL：

```ts
GET /api/{module}/download/{filename}
```

## 9. 组件和命名标准

命名规则：

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 页面 | `{Module}Page.vue` | `JesscaPage.vue` |
| 业务组件 | `{Module}{Purpose}.vue` | `JesscaUploadForm.vue` |
| 通用组件 | 描述能力 | `FileUploadField.vue` |
| composable | `use{Capability}.ts` | `useProcessRequest.ts` |
| API 文件 | `{domain}.ts` | `jessca.ts` |
| 类型 | `{Domain}{Entity}` | `EricProcessResponse` |

props 规则：

```ts
interface FileUploadFieldProps {
  label: string
  accept: string
  multiple?: boolean
  disabled?: boolean
  modelValue: File[]
}
```

禁止：

- 裸 `any`
- props 命名为 `data`、`info`、`item` 且无明确类型
- 页面组件直接写复杂上传请求
- 每个业务页面复制一套文件选择、请求、下载逻辑

## 10. 状态管理边界

不建议一开始引入复杂全局 store。

状态归属：

| 状态 | 放置位置 |
| --- | --- |
| 当前选择的文件 | 页面或 composable |
| 当前处理状态 | `useProcessRequest` |
| 后端健康状态 | `useBackendHealth` |
| 当前路由 | Vue Router |
| 用户偏好/设置 | 小型 store 或 Electron store |
| 全局诊断事件 | diagnostics service |

禁止：

- 把表单临时状态放进全局 store
- 为每个页面创建一套独立 store
- 在 store 里直接操作 DOM
- 在 store 里混写 API 请求、UI 文案、文件校验

## 11. 样式规则

目标是避免全局污染。

允许全局样式：

```text
tokens.css
base.css
reset.css
```

组件样式要求：

- Vue 组件使用 scoped style 或 CSS Modules
- 禁止页面随意写 `.button`、`.card`、`.title` 这类全局类名
- 业务模块样式用模块前缀，例如 `.jessca-*`
- 设计 token 统一管理颜色、间距、字体、圆角、阴影

当前 `eric-module.js` 这种运行时注入 `<style>` 的方式，只能作为临时补丁，不应进入新源码结构。

## 12. AI 生成代码门禁

AI 以后可以生成代码，但必须遵守以下流程：

```text
1. 先读现有模块和公共组件
2. 判断是否已有同类实现
3. 优先复用 shared/components、shared/api、shared/composables
4. 只在 feature 目录内新增业务差异
5. 补齐 TypeScript 类型
6. 跑 lint、typecheck、test、build
7. 生成变更说明
8. 开分支或 PR，不直接合并主分支
```

AI 生成代码禁止项：

- 不准直接改主分支
- 不准绕过类型检查
- 不准新增重复上传组件
- 不准新增重复 HTTP client
- 不准新增全局 CSS 污染
- 不准把所有页面写成单文件巨型组件
- 不准没有接口类型就调用后端
- 不准生成只在当前页面可用的孤岛实现

## 13. CI 与本地检查

前端最低门禁：

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

后端最低门禁：

```text
python -m pytest
python -m compileall app
```

Electron 最低门禁：

```text
npm run build:frontend
npm run pack
```

发布前验证：

- 打开 Electron 应用
- 检查后端 `/health`
- 每个业务模块至少跑一份样例 Excel
- 检查下载文件是否生成
- 导出诊断包

## 14. 建议执行路线

### 阶段 0：保护现状

- 保留当前 `win-unpacked` 发布包
- 不再直接修改 `app.asar`
- 记录当前可运行版本和功能截图

### 阶段 1：恢复可恢复源码

- 新建 `tos-source`
- 从 `resources/backend` 恢复 `tms-backend`
- 从 `resources/app.asar` 恢复 `tms-electron-app`
- 恢复 `package.json`、构建脚本、preload、主进程

### 阶段 2：建立前端工程壳

- 新建 `tms-frontend`
- 使用 Vue 3 + TypeScript + Vite
- 配置路由、AppShell、公共组件
- 对接 `window.electronAPI`
- 建立统一 HTTP client

### 阶段 3：按模块重建前端

优先级建议：

1. 后端健康检查与诊断导出
2. Jessca
3. Sophia/Tina
4. Jane
5. Eric
6. 自动化应用入口
7. 浏览器插件入口
8. adidas Materials 采集器入口

### 阶段 4：补测试和样例数据

- 每个业务模块放入匿名化样例 Excel
- 后端用样例跑回归测试
- 前端用 Playwright 检查上传、处理、下载流程

## 15. 下一步建议

下一步可以直接执行“阶段 1”：

1. 在桌面创建 `tos-source`
2. 恢复 `tms-backend`
3. 从 `app.asar` 提取 Electron 源文件到 `tms-electron-app`
4. 初始化 git 仓库
5. 提交第一个基线版本

完成后再开始重建 `tms-frontend`，不要先写业务页面。
