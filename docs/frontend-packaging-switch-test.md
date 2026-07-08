# 源码前端 Electron 打包试验

## 目标

在不替换现有可用 `TOS.exe` 的前提下，验证 `tms-frontend/src` 重建出来的 Vue 前端能否作为 Electron 生产包入口正常运行。

## 当前状态

- 默认打包现在构建并复制 `tms-frontend/dist`
- `TOS_FRONTEND_SOURCE=recovered` 仍可手动回退到 `tms-electron-app/recovered-frontend`
- `pack:source` 继续保留为独立 source-frontend 冒烟打包命令
- 独立测试产物目录：`tms-electron-app/dist-source-frontend/win-unpacked`

## 前端来源控制

`tms-electron-app/scripts/copy-frontend.js` 现在支持环境变量：

- 默认或 `TOS_FRONTEND_SOURCE=source`：复制 `tms-frontend/dist`
- `TOS_FRONTEND_SOURCE=recovered`：复制 `tms-electron-app/recovered-frontend`

这样默认生产打包使用源码前端，recovered frontend 只作为显式回退路径保留。

## 当前验证范围

试验包用于验证当前源码前端真实路由不白屏并能打开：

- `/`
- `/jessca`
- `/sophia-tina`
- `/jane`
- `/jane-bom-summary`
- `/jane-bom-compare`
- `/jane-outbound-compare`
- `/jane-sap`
- `/jane-infornexus`
- `/eric`
- `/iplex/dual-table-compare`
- `/eric-infornexus`
- `/jason/result-set-excel`
- `/web-automation`
- `/web-automation/scenarios/shipping-automation`
- `/web-automation/scenarios/xinlongtai-shipping-automation`
- `/web-automation/scenarios/tc-inv-automation`
- `/web-automation/scenarios/xo-tc-inv-automation`
- `/web-automation/scenarios/shipping-automation-2`
- `/web-automation/scenarios/infornexus-auto-add`
- `/web-automation/scenarios/po-auto-download`
- `/web-automation/scenarios/packing-list-auto-download`
- `/jason/pdf-reorder`
- `/draft-packing-compare`
- `/tms-finance-internal-reconciliation`
- `/tms-finance-work-sales`
- `/excel-template-mapper-test`
- `/adidas-materials`
- `/automation-runs`
- `/automation-templates`
- `/settings`
- `/release-updates`
- `/process-history/:personId`

旧 `/browser-plugins` 和 `/jessica-infornexus` 只验证能重定向到 `/eric-infornexus`；旧 `/module-a`、`/module-b` 已不属于当前模块目录。

默认 `pack` 已切换到 source frontend。后续只在生产回归发现阻断问题时使用 recovered fallback。
