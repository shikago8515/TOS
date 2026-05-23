# 源码前端 Electron 打包试验

## 目标

在不替换现有可用 `TOS.exe` 的前提下，验证 `tms-frontend/src` 重建出来的 Vue 前端能否作为 Electron 生产包入口正常运行。

## 新增脚本

- 默认打包仍然使用 `tms-electron-app/recovered-frontend`
- 新增源码前端试验打包脚本：`tms-electron-app/scripts/pack-source-unpacked.js`
- 新增 npm 命令：`pack:source`
- 独立测试产物目录：`tms-electron-app/dist-source-frontend/win-unpacked`

## 前端来源控制

`tms-electron-app/scripts/copy-frontend.js` 现在支持环境变量：

- 默认或 `TOS_FRONTEND_SOURCE=recovered`：复制 `tms-electron-app/recovered-frontend`
- `TOS_FRONTEND_SOURCE=source`：复制 `tms-frontend/dist`

这样默认生产打包行为不变，源码前端只在显式试验脚本中启用。

## 当前验证范围

试验包用于验证以下路由不白屏并能打开：

- `/`
- `/jessca`
- `/sophia-tina`
- `/jane`
- `/eric`

验证通过后，下一步才能考虑把默认 `pack` 从 recovered frontend 切换到 source frontend。
