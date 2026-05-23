# TOS Sophia & Tina 页面等价重建记录

本记录用于约束 `tms-frontend/src/pages/sophia-tina` 的源码化实现。该页面仍不接管正式 Electron 打包入口。

## 原页面行为基线

- 页面标题：报表合并。
- 页面说明：Sophia & Tina 多类 Excel 文件统一合并，自动生成分析报表。
- 文件准备说明：TMS、Article、Factory Price、Pack 四类文件都可多选。
- 文件预检查：四类文件都至少上传 1 个后才允许开始处理。
- 上传字段：
  - TMS 文件（可多选）
  - Article 文件（可多选）
  - Factory Price 文件（可多选）
  - Pack 文件（可多选）
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

- `src/pages/sophia-tina/SophiaTinaPage.vue`: 页面容器和交互状态。
- `src/pages/sophia-tina/sophiaTinaApi.ts`: `/api/sophia-tina/process` 与 `/api/sophia-tina/download/{filename}`。
- `src/pages/sophia-tina/sophiaTinaModel.ts`: 模块 id、模块名和结果摘要转换。
- `src/shared/ui/FileRequirementGuide.vue`: 已扩展支持 Sophia & Tina 文件准备说明。
- 继续复用上一轮的文件预检查、上传控件、结果摘要、处理历史和后端客户端封装。

## 后续复用规则

- Jane 页面继续复用本轮共享组件，不重新实现上传和处理历史。
- 每个 Excel 模块只保留自己的 API 参数映射和结果摘要转换。
- 正式打包入口只有在首页、Jessca、Sophia & Tina、Jane、Eric 全部完成等价验证后再切换。
