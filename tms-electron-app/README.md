# TOS Electron App

`tms-electron-app` 是 TOS Windows 桌面壳，负责主窗口、preload IPC、后端启动、诊断导出、外部模块、自动化应用和打包发布。

## 当前工程事实

- 主进程入口：`main-simple.js`
- preload：`preload.js`
- 前端开发态加载：`http://127.0.0.1:5174`
- 打包态默认加载：`dist-frontend/index.html`
- 默认前端来源：`../tms-frontend/dist`
- 紧急回退前端来源：`TOS_FRONTEND_SOURCE=recovered`
- 后端源码打包来源：`../tms-backend`
- 后端默认地址：`http://127.0.0.1:8000`

开发态 `npm run dev` 只启动 Electron。需要调试前端时，先在 `../tms-frontend` 运行 `npm run dev`。

## 常用命令

```powershell
npm run dev
npm run build:frontend
npm run pack
npm run verify:renderer-package
npm run verify:release-package
```

生产发布前完整验证：

```powershell
npm run build:win
```

发布前还应手动验证 Electron 启动、后端 `/health`、主要 Excel 模块上传/处理/下载、更新状态和诊断导出。

## 打包与发布边界

以下区域属于发布敏感配置，修改前需要先说明影响面和回退方案：

- `main-simple.js`
- `preload.js`
- `package.json`
- `scripts/`
- `electron-builder`
- 自动更新 feed
- `manual-downloads.json`
- `update-changelog.json`
- COS/CDN 或 GitHub Releases 下载地址
- `TOS_FRONTEND_SOURCE`
- NSIS 配置

当前正式交付产物以安装版为主。免安装 zip 作为安装包被系统拦截时的人工下载兜底，不参与自动安装。

## 独立运行边界

这些目录有独立运行和打包边界，修改前先读对应 README、registry 和启动脚本：

- `automation-apps/`
- `automation-launcher/`
- `browser-plugins/`
- `external-apps/`

不要修改 `archive/legacy-packaging/`，除非任务明确处理历史打包方案。
