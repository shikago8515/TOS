# Engineering Entrypoints

本文件说明仓库根目录 `package.json` 提供的工程入口。根目录脚本只负责编排现有子项目命令，不迁移 workspace，不新增依赖，也不触发正式发布。

## 命令矩阵

| 命令 | 覆盖范围 | 会运行 |
| --- | --- | --- |
| `npm run check:quick` | 快速检查 | 前端 `typecheck`、前端 `test`、后端 `unittest`、Electron script tests |
| `npm run check:frontend` | 前端完整检查 | `npm run typecheck`、`npm run test`、`npm run build` |
| `npm run check:backend` | 后端完整检查 | `python -m unittest discover tests/ -v`、`python -m compileall .` |
| `npm run check:electron` | Electron 脚本测试 | 自动发现 `tms-electron-app/scripts/*.test.js` 并运行 `node --test` |
| `npm run check` | 完整工程检查 | 前端完整检查、后端完整检查、Electron 脚本测试 |

## 开发入口

| 命令 | 等价子项目命令 |
| --- | --- |
| `npm run dev:frontend` | `npm --prefix tms-frontend run dev` |
| `npm run preview:frontend` | `npm --prefix tms-frontend run preview` |
| `npm run dev:electron` | `npm --prefix tms-electron-app run dev` |

## 边界

- 根目录入口不运行 `npm run pack`、`npm run build:win`、`verify:renderer-package`、`verify:release-package`、`write:update-changelog` 或 `write:manual-downloads`。
- 发布、打包、更新清单和安装包校验仍按 `tms-electron-app/README.md` 与 `AGENTS.md` 的发布敏感规则单独执行。
- 子项目原生命令仍然可用；根目录入口只是日常开发检查的统一编排层。
