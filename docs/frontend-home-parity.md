# TOS 首页等价重建记录

本记录用于约束 `tms-frontend/src/pages/home` 的第一条源码化页面，避免再次生成一套和原 UI 不一致的新界面。

## 已拆出的源码边界

- `src/layout/AppShell.vue`: 桌面端左侧导航、顶部栏、日期和诊断包入口。
- `src/domain/moduleCatalog.ts`: 路由、导航、模块名称、阶段和描述的唯一数据源。
- `src/pages/home/HomePage.vue`: 首页信息层级和布局。
- `src/pages/home/homeModel.ts`: 首页指标、快捷入口和服务状态数据。
- `src/shared/ui/MetricTile.vue`: 统计卡。
- `src/shared/ui/ModuleShortcutCard.vue`: 模块入口卡。
- `src/shared/ui/ServiceStatusItem.vue`: 服务状态列表项。

## 当前首页文案基线

- TOS
- 首页
- Excel 处理
- 自动化试验区
- 测试
- adidas 材料
- 应用
- v0.9.6-beta.1
- DG运营部
- TOS - 功能概览
- 导出诊断包
- TOS 运营看板
- 后端在线
- Excel 处理 4 项
- 对账核对 / 报表合并 / 成品表生成 / Eric
- 正式采集 1
- adidas Materials
- 测试模块 2
- 浏览器插件 / 网页自动化
- 快捷入口
- 正式模块与测试模块
- 对账核对
- 报表合并
- 成品表生成
- Eric数据处理
- 浏览器插件
- 网页自动化
- adidas 材料
- 服务状态
- Python 后端
- 运行中
- 诊断日志
- 可导出
- 自动化试验区
- 业务验证中
- 文件准备
- 对账核对

## 默认打包状态

`tms-electron-app/scripts/copy-frontend.js` 已默认复制 `tms-frontend/dist`。
以下项目作为后续回归检查项保留：

- 首页截图与当前 `TOS.exe` 首页截图对比。
- 所有快捷入口路径与原路由一致。
- 诊断包导出入口仍调用 `window.electronAPI.exportDiagnosticsPackage()`。
- 非首页路由已逐页完成等价重建，或明确采用原包 fallback。
- TypeScript 检查和 Vite build 通过。
