# TOS Electron App

`tms-electron-app` 是 TOS Windows 桌面壳，负责主窗口、preload IPC、后端启动、诊断导出、外部模块、自动化应用和打包发布。

## 当前工程事实

- 主进程入口：`main-simple.js`
- preload：`preload.js`
- 前端开发态加载：`http://127.0.0.1:5174`，默认由 `../tms-frontend` 的 server mode 提供
- 打包态默认加载：`dist-frontend/index.html`
- 默认前端来源：`../tms-frontend/dist`
- 紧急回退前端来源：`TOS_FRONTEND_SOURCE=recovered`
- 后端源码打包来源：`../tms-backend`
- 本机后端地址：`http://127.0.0.1:8000`，仅在 local mode 或本机后端联调时使用

开发态 `npm run dev` 只启动 Electron。前端 server/local 模式由 `../tms-frontend` 控制，同一时间 `5174` 只运行一种模式；根目录入口见 `../docs/engineering-entrypoints.md`。

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

`build:win` 当前会依次执行：

- `build:backend-runtime`
- `build:frontend`
- `clean:update-artifacts`
- `electron-builder --win --x64`
- `verify:renderer-package`
- `write:update-changelog`
- `write:manual-downloads`
- `verify:release-package`

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
- TOS 轻量在线安装器、完整安装包和 payload 生成脚本

当前正式交付产物以安装版为主。免安装 zip 作为安装包被系统拦截时的人工下载兜底，不参与自动安装。
`manual-downloads.json` 是免安装 zip 的人工兜底下载清单，由 `write:manual-downloads` 在正式构建链路中生成，并由 `verify:release-package` 校验版本、URL、sha512 和 size。

## 桌面安装包链路

- `scripts/build-tos-desktop-nsis-installer.ps1` 生成 TOS 轻量在线安装器 `TOS-Desktop-Setup.<version>.exe` 和 `TOS-Desktop-Payload.zip`；安装时按 payload sha256 从配置 URL 下载并校验。
- `scripts/build-tos-desktop-full-nsis-installer.ps1` 生成完整安装包 `TOS-Desktop-Full-Setup.<version>.exe`；payload 内置在安装包里，适合网络下载受限场景。
- 后端系统配置下载接口位于 `/api/system/config/tos-desktop/*` 和 `/api/system/config/tos-desktop-full/download`，默认从 MinIO `downloads` bucket 读取安装器和 payload。
- 前端系统设置页默认使用 `https://ai.tomwell.net:56130/tos/tos-desktop/download` 与 `https://ai.tomwell.net:56130/tos/tos-desktop-full/download`，也可通过 Vite 环境变量覆盖。

完整离线安装包构建命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\build-tos-desktop-full-nsis-installer.ps1
```

当前完整离线安装包输出：

```text
dist-tos-desktop-full/TOS-Desktop-Full-Setup.<version>.exe
```

当前已验证的完整包元数据：

```text
version: 0.9.8-beta.3.17
size: 125591538 bytes
sha256: b50cc00da0a27afa856c7c100d0f9c3d8ab6dd663925fb54a7b9d916f6a2ca8d
builder: NSIS-full
networkDuringInstall: false
```

`networkDuringInstall: false` 表示安装阶段解压内置 `TOS-Desktop-Payload.zip`，不会去 MinIO 下载 payload；应用启动后的业务 API 仍然连接远程 TOS 服务器后端。

上传服务器前必须先做本地安装校验：

```powershell
$installer = Resolve-Path .\dist-tos-desktop-full\TOS-Desktop-Full-Setup.*.exe
$target = "D:\software\TOS_full_verify"
if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
Start-Process -FilePath $installer -ArgumentList "/S", "/D=$target" -Wait
Test-Path "$target\TOS.exe"
Test-Path "$target\resources\app.asar"
Test-Path "$target\resources\backend\main.py"
Test-Path "$target\resources\automation-launcher"
Test-Path "$target\resources\automation-apps\shipping-automation-demo\server.mjs"
```

## 独立运行边界

这些目录有独立运行和打包边界，修改前先读对应 README、registry 和启动脚本：

- `automation-apps/`
- `automation-launcher/`
- `browser-plugins/`
- `external-apps/`

不要修改 `archive/legacy-packaging/`，除非任务明确处理历史打包方案。

`automation-apps/shipping-automation-demo/po-auto-download/` 是 PO 自动下载的独立执行器模块。主 `server.mjs` 只做薄路由挂载；Excel 解析、登录态获取、请求式查询、后续下载和落盘逻辑保持在该子目录内。当前链路优先纯 HTTP 请求：登录、打开 `InvoicesView.jsp`、提交 `InProgressInvoices` 筛选并保存返回 HTML；只有纯请求下载接口无法闭环时，才补浏览器点击兜底。
