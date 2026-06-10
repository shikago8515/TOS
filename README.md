# TOS Source Workspace

TOS 是一个 Windows x64 桌面工具，当前源码工作区由三部分组成：

- `tms-electron-app/`：Electron 主进程、preload、打包与发布脚本。
- `tms-frontend/`：Vue 3、TypeScript、Vite 前端重建源码。
- `tms-backend/`：Python FastAPI 后端与 Excel 处理模块。

`tms-electron-app/recovered-frontend/` 是恢复出的打包前端基线，只作为行为和视觉参考，不是长期源码。

## 当前工程事实

- 后端入口是 `tms-backend/main.py`，默认监听 `http://127.0.0.1:8000`。
- 前端开发服务器由 `tms-frontend/package.json` 定义，当前是 `http://127.0.0.1:5174`。
- Electron 打包默认使用 `tms-frontend/dist`；`TOS_FRONTEND_SOURCE=recovered` 仅用于紧急回退。
- 仓库根目录 `package.json` 当前没有可用 scripts；运行检查命令时进入对应子目录。

## 文档地图

- `AGENTS.md`：项目级 AI 协作规则、工程边界和验证要求。
- `tms-frontend/README.md`：前端源码工作区、命令、源码约定和页面清单。
- `docs/frontend-engineering-standards.md`：前端重建工程规范和变更接收检查项。
- `docs/frontend-tms-finance-parity.md`：TMS 财务页 parity 与复用边界说明。
- `tms-backend/README.md`：后端运行、模块和测试说明。
- `tms-electron-app/README.md`：Electron 运行、打包和发布说明。

## 常用验证命令

根目录没有可用 scripts；检查命令必须进入对应子目录，并以当前 `package.json` 或后端测试配置为准。

```powershell
cd tms-frontend
npm run typecheck
npm run test
npm run build
```

```powershell
cd tms-backend
python -m unittest discover tests/ -v
python -m compileall .
```

```powershell
cd tms-electron-app
npm run build:frontend
npm run pack
npm run verify:renderer-package
npm run verify:release-package
```

`npm run pack` 只用于普通打包/校验，不是正式 Windows 发行入口。

发布前完整验证使用：

```powershell
cd tms-electron-app
npm run build:win
```

## 开发规则摘要

- 开发任务先读取项目级 `AGENTS.md`，再按当前源码和 `package.json` scripts 核实。
- 搜索默认排除 `node_modules`、`dist`、`build`、恢复基线、归档目录和运行数据目录。
- 前端新增或调整页面时同步 `src/domain/moduleCatalog.ts`、`src/app/routeCatalog.ts`、`src/app/router.ts`。
- 后端保持 `api/{module}_api.py` + `modules/{module}_module.py` 边界，上传和下载文件名必须做 basename、扩展名和目录边界校验。
- 未经明确要求，不执行 `git add`、`commit`、`push`、`pull`、`merge`、`rebase`、`reset` 或发布操作。

## 后续重点

1. 继续按恢复基线补齐仍处于 `validation` 或 `placeholder` 的前端模块。
2. 为前后端接口补充更完整的契约测试和响应 schema。
3. 按发布敏感规则单独收紧 Electron 外部 URL 打开策略。
