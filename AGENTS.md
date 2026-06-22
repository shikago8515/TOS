# AGENTS.md - TOS-main AI 协作规则

生效范围：`D:\project\TOS-main` 当前仓库。`E:\project\TOS-main` 是移动硬盘参考副本，除非用户明确切换工作区，否则不作为本仓库生效规则。

## 最高优先级

1. 全程使用中文沟通；代码、命令、库名、文件路径、API 名称和错误信息保留英文。
2. 开始任何开发任务前，先读取本文件，并以当前仓库源码和 `package.json` scripts 为准。旧 README 或 docs 与源码冲突时，先核实当前源码，不按旧文档盲做。
3. 执行 Git 操作前必须先运行 `git status --short --branch`。禁止在未确认工作区状态时切分支、pull、commit、reset、rebase 或 push。
4. 保护已有改动。发现未提交变更时，只改当前任务必需文件；不得回滚、覆盖或删除用户已有改动。
5. 严禁硬编码密钥、Token、密码、Cookie、连接串或内部凭据。用户误发密钥时，视为已泄露，提醒撤销并重新生成，不能写入文件、命令历史、remote URL 或提交信息。

## 项目事实

- TOS 是 Windows x64 桌面应用，架构为 Electron 主进程 + Vue 3/TypeScript/Vite 前端 + Python FastAPI 后端。
- 当前前端源码是重建工作区，位置是 `tms-frontend/src`。
- `tms-electron-app/recovered-frontend/` 是恢复出的打包前端基线，只读参考，不是长期源码。
- 后端入口是 `tms-backend/main.py`，默认监听 `127.0.0.1:8000`。
- 前端开发服务器端口以 `tms-frontend/package.json` 为准，当前是 `127.0.0.1:5174`。
- Electron 打包默认使用 `tms-frontend/dist`；`TOS_FRONTEND_SOURCE=recovered` 只用于紧急回退。
- 仓库根目录 `package.json` 提供工程入口 scripts，用于编排前端、后端和 Electron 子项目的现有检查命令。
- GitCode 远端检查位于 `.gitcode/workflows/tos-check.yml`，默认对 `main`、`codex/**` 分支 push 和面向 `main` 的合并请求运行完整 `npm run check`。
- 完整 TOS-AI 工作流位于 `docs/tos-ai-workflow.md`，覆盖 GitCode 同步、分支开发、自动版本、更新内容、CI、服务器发布和回滚。

## 默认探索边界

1. 搜索优先使用 `rg`，并默认排除：
   - `node_modules/**`
   - `.venv/**`
   - `dist/**`、`dist-*/**`、`dist-frontend/**`
   - `build/**`、`out/**`、`release/**`
   - `package-lock.json`
   - `*.min.js`
   - `tms-electron-app/recovered-frontend/**`
   - `tms-electron-app/archive/**`
   - `tms-electron-app/backend-runtime/**`
   - 运行数据目录：`uploads/**`、`runs/**`、`logs/**`、`run-artifacts/**`、`backend-data/**`、`playwright-user-data/**`
2. 只有在任务明确涉及依赖、打包产物、恢复基线、归档包或运行日志时，才读取上述目录。
3. 大任务开始前先形成简短结构化摘要：业务目标、输入材料、相关文件、验收标准、明确不做的范围。
4. 不默认读取完整仓库、完整日志、整批 Excel/PDF 或完整历史对话。先定位关键文件、字段和错误片段。

## 代码修改规则

1. 改动严格聚焦当前需求，不做无关重构。
2. 优先遵循项目现有目录、命名、样式和工具链。
3. 新代码必须有清晰类型：TypeScript 禁止无理由 `any`；Python 新增函数必须写参数和返回值类型提示。
4. 旧恢复源码中超长函数、CommonJS 或历史结构不要求一次性重写；只在触及相关逻辑时做局部、可验证的改善。
5. 复杂业务逻辑、边界条件和非显然实现添加中文注释；自解释代码不加空洞注释。
6. 生产代码不要新增 `console.log()` 或 `print()`。Electron/Node 脚本可保留现有命令行输出风格。

## 前端规则

1. 不做营销页、说明页或占位替代；优先实现真实可用界面。
2. 前端重建必须对照恢复基线，保持原产品体验，不重新设计导航模型或视觉语言。
3. 新增或调整页面时，通常需要同步：
   - `tms-frontend/src/domain/moduleCatalog.ts`
   - `tms-frontend/src/app/routeCatalog.ts`
   - `tms-frontend/src/app/router.ts`
4. 页面组件使用 Vue 3 Composition API 和 `<script setup>`。
5. 组件样式默认 scoped；全局 CSS 仅限 reset、design tokens 和项目级基础样式。
6. 后端请求通过 `tms-frontend/src/shared/api/backendClient.ts` 或 feature API 模块；组件不要散落直接 `fetch`。少数本地 automation executor/launcher 直连属于显式例外，必须由 `scripts/engineering/frontend-direct-fetch-boundary.test.mjs` 白名单锁定。
7. 文件上传、进度、结果展示、处理历史优先复用 `shared/ui` 和 `shared/process` 中已有组件。
8. Excel 处理型页面优先复用 `shared/ui/excel-process`、`FilePrecheckPanel`、`ProcessHistoryPanel`、`ResultSummary`、`shared/process` 与 `shared/styles/jane-page.scss`；页面内只保留业务字段、按钮文案、API 参数映射、结果摘要转换和历史 module id 等差异。
9. 当左侧导航和路由已经表达子流程时，不在页面内容区重复做大卡片式流程切换入口，除非产品明确要求。
10. 当前项目未配置 ESLint、Prettier；前端测试脚本以 `tms-frontend/package.json` 为准，当前有 `npm run test`。不要在规则或报告中声称已经运行不存在的命令。
11. 本地开发默认前端入口 `npm run dev:frontend` 必须连接本机后端 `http://127.0.0.1:8000`；不得让默认 `dev` 脚本加载 `--mode server` 或 `tms-frontend/.env.server`。
12. 只有显式运行 `npm run dev:frontend:server` 时，才允许读取 `tms-frontend/.env.server` 中的公开 `VITE_BACKEND_URL` 连接服务器后端；切换 local/server 模式前必须停止旧的 `5174` Vite 进程。
13. 前端页面出现“无法连接后端服务”时，先检查 Vite 实际注入的 `import.meta.env`、当前 `5174` 前端启动模式和 `npm run check:backend-version`，不得直接判断为业务模块处理失败。
14. 运行 `npm run version:bump`、切换分支、拉取同事更新或修改 `tms-backend/app_version.py` 后，先运行 `npm run dev:backend:restart` 和 `npm run check:backend-version`，再刷新本地 `5174` 前端页面，避免旧 `8000` 后端进程继续返回上一版本。

## Jane 模块边界

1. Jane 相关前端源码主要位于：
   - `tms-frontend/src/pages/jane/`
   - `tms-frontend/src/pages/jane-sap/`
   - `tms-frontend/src/pages/jane-bom-compare/`
   - `tms-frontend/src/pages/jane-bom-summary/`
   - `tms-frontend/src/pages/jane-outbound-compare/`
   - `tms-frontend/src/shared/styles/jane-page.scss`
2. Jane 相关后端源码主要位于：
   - `tms-backend/api/jane_api.py`
   - `tms-backend/api/jane_bom_compare_api.py`
   - `tms-backend/api/jane_bom_summary_api.py`
   - `tms-backend/api/jane_outbound_compare_api.py`
   - `tms-backend/modules/jane_module.py`
   - `tms-backend/modules/jane_bom_compare_module.py`
   - `tms-backend/modules/jane_bom_summary_module.py`
   - `tms-backend/modules/jane_outbound_compare_module.py`
3. 优化 Jane 模块时先核对现有页面、API 模块和后端处理模块的契约；不要只改单端并假设另一端兼容。
4. Jane 前端 UI 调整必须保持现有产品体验和共享样式一致，避免重新设计导航模型或视觉语言。

## Jason 模块边界

1. Jason / 发票 PDF 重排序的 canonical 前端入口是 `/#/jason/pdf-reorder`，canonical 后端 API prefix 是 `/api/jason/pdf-reorder/*`。
2. `it-invoice-pdf-reorder` 是历史兼容技术标识；旧前端路由、旧 API prefix 和 legacy `/api/preview-invoice`、`/api/preview-po`、`/api/extract-numbers`、`/api/process` 在未确认历史包无调用前不得删除。
3. Jason 前端源码主要位于 `tms-frontend/src/pages/jason-pdf-reorder/`；后端 API 仍位于 `tms-backend/api/it_invoice_pdf_reorder_api.py`，响应 schema 位于 `tms-backend/api/jason_pdf_reorder_schemas.py`。
4. 修改 Jason 模块时不得改动业务字段名 `invoice_pdf`、`po_pdf`、下载 URL 形状或旧接口响应字段，除非明确进行 breaking change。

## Sophia/Tina 模块边界

1. Sophia/Tina 报表使用原生 PivotTable 模板刷新路线；不要用 `openpyxl` 从零创建 PivotTable，也不要回退为静态汇总 sheet，除非用户明确改需求。
2. `tms-backend/templates/sophia_tina_pivot_template.xlsx` 是后端运行必需资源。修改模板、生成逻辑或发行配置时，必须同时验证源码环境和 PyInstaller runtime 环境都能找到模板。
3. 发行包内模板必须同时存在于 `resources/backend/templates/sophia_tina_pivot_template.xlsx` 和 `resources/backend-runtime/tos-backend/_internal/templates/sophia_tina_pivot_template.xlsx`。
4. 修改 Sophia/Tina 报表生成逻辑后，至少运行 `python -m unittest tests.test_sophia_tina_module -v`，并检查生成文件仍保留原生 pivot XML、`Table1` 范围和 PivotCache source range。

## 后端规则

1. 保持现有 FastAPI API 兼容，除非用户明确要求 breaking change。
2. 每个业务模块保持 `api/{module}_api.py` + `modules/{module}_module.py` 的边界。
3. Excel 处理逻辑放在 `tms-backend/modules/`；API 层负责上传、下载、参数校验和响应封装。
4. 所有上传文件名和下载文件名必须做 basename、扩展名和目录边界校验，避免路径遍历。
5. 不新增 `HTTPException(status_code=500, detail=str(e))` 这类内部异常直出。对用户返回脱敏消息，内部细节写入受控日志或诊断信息。
6. CORS 默认只允许本地前端来源；服务器或特殊部署必须通过 `TMS_CORS_ALLOW_ORIGINS` 显式配置允许来源。禁止恢复 `allow_origins=["*"]` + `allow_credentials=True`，除非先完成 Electron、浏览器和服务器暴露面的风险评估。
7. 后端依赖当前使用 `requirements.txt`，不要为普通任务强制迁移到 `pyproject.toml`。

## 版本更新记录边界

1. `/release-updates` 页面从后端 `/api/release-updates` 读取记录，后端不可用时使用 `tms-frontend/src/shared/version/releaseHistory.json` 作为本地 fallback。
2. 服务器 MySQL `release_update_records` 是版本更新记录主源；本地 `releaseHistory.json` 和后端默认 seed 是可再生成缓存，使用 `npm run release:updates:pull` 从服务器拉取合并。
3. 写入版本更新记录默认通过服务器 `/api/release-updates`，使用 `npm run release:updates:push:dry-run` 预览、`npm run release:updates:push` 写入；禁止提交数据库账号、写入 token 或连接串。
4. 后端默认 seed 位于 `tms-backend/data/release_updates_seed.json`，必须与 `releaseHistory.json` 保持同步；新增历史条目时运行相关一致性测试。
5. 服务器发布包会生成 `releaseUpdateRecord` 并在部署脚本中同步到后端记录接口；修改该链路时必须同时核对 `scripts/engineering/package-server-update.mjs`、`scripts/server/apply-server-update.sh` 和相关测试。

## Electron、自动化和发布规则

1. 修改 `tms-electron-app/main-simple.js`、`preload.js`、`package.json`、`scripts/`、自动更新、协议注册或 NSIS 配置前，先说明影响面。
2. `electron-builder`、自动更新 feed、`manual-downloads.json`、`update-changelog.json`、COS/CDN 地址、`TOS_FRONTEND_SOURCE`、安装包输出规则、TOS 桌面安装器和 payload 生成链路属于发布敏感区域。
3. 发布敏感改动必须成套验证，不能只改单文件后建议发布。
4. 正式 Windows 本地发行入口是 `cd tms-electron-app && npm run build:win`；`npm run pack` 不是正式发行入口。
5. 修改 `electron-builder`、`backend-runtime`、`extraResources`、`afterPack`、更新清单、TOS 桌面安装器脚本或发行校验脚本时，必须成套运行 `verify-renderer-package` 和 `verify-release-package`。
6. `app.asar` 必须保持瘦身校验，不得包含 `backend-runtime/`、`automation-apps/`、`automation-launcher/`、`browser-plugins/`、`external-apps/`、旧 `dist*` 或嵌套 `app.asar`。
7. 本地发行产物默认只保留在 `tms-electron-app/dist`，不上传 GitCode/GitHub Release，除非用户明确要求。
8. 发行完成后报告 installer、免安装 zip、`app.asar`、`backend-runtime`、`external-apps` 的实际大小。
9. `backend-runtime` 依赖瘦身是独立优化项；不要在普通打包修复里顺手移除 `torch`、`cv2`、`pyarrow`、`scipy` 等大依赖。
10. `automation-apps/`、`automation-launcher/`、`browser-plugins/`、`external-apps/` 是独立运行边界。修改时先读对应 README、registry 和启动脚本。
11. 不修改 `archive/legacy-packaging/`，除非任务明确是处理历史打包方案。
12. TOS 桌面轻量在线安装器脚本是 `scripts/build-tos-desktop-nsis-installer.ps1`，完整安装包脚本是 `scripts/build-tos-desktop-full-nsis-installer.ps1`；对应后端下载配置接口为 `/api/system/config/tos-desktop/*` 和 `/api/system/config/tos-desktop-full/download`。

## 服务器部署规则

1. 服务器 `~/TOS` 目录式 Docker Compose 部署必须遵循 `docs/server-deployment-runbook.md`，不要把服务器当作 Git 仓库直接 `git pull`。
2. 服务器部署默认只更新 `tos-backend` 和 `tos-frontend`，保留服务器侧 Dockerfile、`nginx.conf`、`docker-compose.tos.yml` 和 `authelia/`。
3. 服务器部署不等于 Windows Electron 打包；只有发布桌面安装包、自动更新包或正式 Windows 客户端时，才运行 `npm run build:win`。
4. 服务器发布包必须从 GitCode CI 已通过的 clean commit 生成，使用 `npm run server:package`，并上传到 `/home/obito_li/TOS/.deploy_uploads/`。
5. 截图或服务器中如存在 `_deploy_uploads`、`_source_uploads`，视为历史目录；新流程不写入这些目录。

## 可用检查命令

按改动范围选择最接近的真实命令。若命令不存在，明确说明未运行原因。优先使用仓库根目录工程入口；需要调试单个子项目时，再切到对应子项目目录运行原生命令。

### 根目录入口

```powershell
npm run check:quick
npm run check:frontend
npm run check:backend
npm run check:electron
npm run check
npm run server:package:dry-run
npm run server:package
```

`npm run check:quick` 运行工程脚本测试、前端 typecheck/test、后端 unittest 和 Electron script tests；`npm run check` 运行工程脚本测试、完整前端、完整后端和 Electron 脚本检查。根目录入口不运行 `npm run pack`、`npm run build:win` 或发布清单写入命令。

GitCode CI 在 runner 内下载 Node.js 22.11.0，通过 `npm run ci:install` 安装依赖，并用 `PYTHON=python3 npm run check` 做远端完整检查。修改 `.gitcode/workflows/tos-check.yml` 时不得顺手加入 `pack`、`build:win`、发布清单写入、上传或正式发布步骤。

用户可见改动默认由 `semantic-release` 根据 Conventional Commits 自动判断版本并维护 `tms-frontend/src/shared/version/releaseNotes.json`；本地需要手动指定版本时使用 `npm run version:set -- <version>`，临时手工递增仍可用 `npm run version:bump`。
`releaseNotes.json` 只描述当前版本变更；自动发布会重写 `added`、`improved`、`fixed` 数组，手工运行 `version:bump` 后必须移除上一版本遗留条目。
`/release-updates` 的内置历史时间线由 `tms-frontend/src/shared/version/releaseHistory.json` 和后端默认 seed 同步维护；新增历史条目时必须用测试校验前后端内容一致。

### 前端

```powershell
cd tms-frontend
npm run typecheck
npm run test
npm run build
npm run preview
```

### 后端

```powershell
cd tms-backend
python -m unittest discover tests/ -v
python -m compileall .
```

### Electron

```powershell
cd tms-electron-app
npm run build:frontend
npm run pack
npm run verify:renderer-package
npm run verify:release-package
node --test scripts/build-backend-runtime.test.js scripts/run-pack-default.test.js scripts/legacy-archive.test.js scripts/verify-release-package.test.js
```

`npm run pack` 只用于普通打包/校验，不作为正式 Windows 发行入口。

### 发布前完整验证

```powershell
cd tms-electron-app
npm run build:win
node scripts/verify-renderer-package.js
node scripts/verify-release-package.js
```

发布前还应手动验证 Electron 启动、后端 `/health`、主要业务模块 Excel 上传/处理/下载、更新状态和诊断导出。

## Git 规则

1. 默认从 `gitcode/main` 更新主线，除非用户明确要求使用 `origin/main`。
2. 新任务先执行 `git fetch gitcode main --prune`，再从最新 `gitcode/main` 创建 `codex/<topic>` 分支；继续已有分支时，在工作区 clean 的前提下 `git rebase gitcode/main`。
3. 新功能或项目规则改动使用 `codex/` 前缀分支，例如 `codex/update-tos-agents-rules`。
4. 提交信息使用 `类型: 描述`，例如 `docs: 添加 TOS AI 协作规则`。
5. 每次提交只包含一个功能或一个明确规则改动。
6. 未经用户明确要求，不执行 `git add`、`commit`、`pull`、`merge`、`rebase`、`reset`、`force push`、删除分支或发布操作。

## Token 用量治理

1. 单人一周 430,000,000 tokens 视为异常红线，达到该量级先做用量审计。
2. 单 session 超过 1,000,000 tokens 时，复盘是否读取了过多上下文；超过 5,000,000 tokens 时，拆分任务并收敛输入。
3. 单日超过 30,000,000 tokens 时，当天先做用量审计再继续扩大上下文。
4. 用量审计默认看 Top 10 高消耗 session、按天/软件/模型分布、input/output 比例、单 session 峰值、工具调用次数和文件读取次数。
5. input tokens 占比异常偏高时，优先减少输入上下文，而不是只更换模型。

## 交付格式

完成任务后简洁说明：

- 修改了哪些文件
- 运行了哪些验证
- 是否有风险或未完成项

不要输出完整日志、大段代码复述或无关解释，除非用户明确要求。
