# Eric 页面源码重建记录

## 范围

本轮把原先由 `tms-electron-app/recovered-frontend/eric-module.js` 运行时注入的 Eric 页面，拆成正式 Vue 源码：

- `tms-frontend/src/pages/eric/EricPage.vue`
- `tms-frontend/src/pages/eric/ericApi.ts`
- `tms-frontend/src/pages/eric/ericModel.ts`

并在 `tms-frontend/src/app/router.ts` 接入 `/eric` 路由。

## 保留的原 UI/行为

- 页面标题：`Excel数据处理整合工具-Eric`
- 顶部说明：`PO Number1 / Article Number1` 辅助列、PO 区块拆分、尺码列逆透视到 `Final_Data`
- 测试版标识：`测试版 v0.1.2-alpha.1`
- 测试阶段提示文案
- 单文件上传，仅支持 `.xlsx / .xlsm`
- 三步处理说明：辅助列、拆分 Sheet、Final_Data
- 操作按钮：开始处理、重置、下载结果
- 四个统计项：源文件、处理状态、Final_Data 行数、结果文件
- 日志区：后端返回的 `logs` 逐行显示

## 接口映射

- 上传处理：`POST /api/eric/process`
- 表单字段：`excel_file`
- 下载结果：`GET /api/eric/download/{filename}`
- 返回字段：`success`, `message`, `logs`, `row_count`, `output_file`

## 工程化说明

Eric 不再通过运行时脚本动态修改 DOM 和注入全局样式，而是改为路由组件和 scoped CSS。接口请求封装在 `ericApi.ts`，页面静态文案与统计映射放在 `ericModel.ts`，避免后续继续扩展时把页面逻辑、接口协议和展示模型混在一个文件里。

正式 Electron 打包入口仍未切到新 Vue 源码；需要首页、Jessca、Sophia & Tina、Jane、Eric 都完成等价验证后再统一切换。
