# TOS Jane 页面等价重建记录

本记录用于约束 `tms-frontend/src/pages/jane` 的源码化实现。该页面已接管正式 Electron 打包入口。

## 原页面行为基线

- 页面标题：成品表生成。
- 页面说明：上传客户文件和 country.xlsx 后自动生成标准成品表。
- 文件准备说明：客户文件上传 1 个，country.xlsx 上传 1 个。
- 文件预检查：两个必传文件都上传后才允许开始处理。
- 上传字段：
  - 客户文件
  - country.xlsx
- 可选输入：
  - Working Number 筛选，多个 Working Number 用英文逗号分隔。
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

- `src/pages/jane/JanePage.vue`: 页面容器、文件状态和筛选输入。
- `src/pages/jane/janeApi.ts`: `/api/jane/process` 与 `/api/jane/download/{filename}`。
- `src/pages/jane/janeModel.ts`: 模块 id、模块名和结果摘要转换。
- `src/shared/ui/FileRequirementGuide.vue`: 已扩展支持 Jane 文件准备说明。
- 继续复用文件预检查、上传控件、结果摘要、处理历史和后端客户端封装。

## 后续复用规则

- Eric 页面如仍是 Excel 处理型页面，应优先复用本轮共享组件。
- 每个模块只保留 API 字段名映射、结果摘要转换和少量业务差异。
- 正式 Electron 打包入口已切到新 Vue 源码；recovered frontend 仅作为回退参考保留。
