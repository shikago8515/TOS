# TOS Jessca 页面等价重建记录

本记录用于约束 `tms-frontend/src/pages/jessca` 的源码化实现。该页面已接管正式 Electron 打包入口。

## 原页面行为基线

- 页面标题：对账核对。
- 页面说明：Jessca 发票文件与参考表自动核对，输出价格差异和缺失款号整理结果。
- 文件准备说明：发票文件可多选，参考表文件只上传 1 个。
- 文件预检查：未补齐必传文件时禁用开始处理。
- 上传字段：
  - 发票文件（可多选）
  - 参考表文件
- 操作按钮：
  - 开始处理
  - 重置
- 处理状态：
  - 上传进度
  - 结果摘要
  - 成功/失败提示
  - 下载结果文件
  - 处理记录

## 已拆出的源码边界

- `src/pages/jessca/JesscaPage.vue`: 页面容器和交互状态。
- `src/pages/jessca/jesscaApi.ts`: `/api/jessca/process` 与 `/api/jessca/download/{filename}`。
- `src/pages/jessca/jesscaModel.ts`: 模块 id、模块名和结果摘要转换。
- `src/shared/files/fileGroups.ts`: 文件组预检查、大小格式化、输入文件序列化。
- `src/shared/api/backendClient.ts`: 后端地址、上传请求和下载地址封装。
- `src/shared/process/processHistory.ts`: 本地处理记录。
- `src/shared/ui/FileRequirementGuide.vue`: 文件准备指南。
- `src/shared/ui/FilePrecheckPanel.vue`: 文件预检查。
- `src/shared/ui/FileUploadBox.vue`: 文件上传控件。
- `src/shared/ui/ResultSummary.vue`: 结果摘要。
- `src/shared/ui/ProcessHistoryPanel.vue`: 处理记录。

## 后续复用规则

- Sophia / Jane 的 Excel 上传页应复用本轮新增的文件组、上传、预检查、结果摘要和处理历史组件。
- 新业务页只在 `src/pages/{module}` 下保留业务差异，不重新实现上传控件。
- API 封装必须落在页面模块或共享 API 层，页面组件不能直接散写请求 URL。

## 当前维护边界

- 后端 `jessca_module.py` 已承载 invoice 表头解析、参考表诊断归因和 optional packing PDF 逻辑；前端文案或上传字段调整前先核对 `/api/jessca/process` 的表单字段与返回摘要。
- Jessica 组的产地证核对、shipping 自动化和 PO 自动下载已是独立侧边栏入口，不要在 Jessca 页面内增加跨流程入口卡片。
