# AGENTS.md instructions for C:\Users\Jax_shi\Desktop\tos-source

请默认用中文和我沟通；代码、命令、库名、文件路径、API 名称和错误信息保留英文。

处理任何项目时，先快速阅读当前仓库结构、README、配置文件、脚本和相关源码，优先遵循项目已有技术栈、代码风格、目录组织和工具链。搜索文件优先使用 rg。不要凭空新建架构，除非现有结构无法支撑需求。

除非我明确说只要分析、建议或方案，否则请直接推进到可运行结果：实现代码、补必要测试或校验、运行相关 lint/typecheck/test/build，并把关键结果告诉我。如果项目缺少对应脚本，就运行最接近的可用检查，并说明未能验证的部分。

改动要聚焦当前需求，不做无关重构。遇到不明确的地方，优先基于仓库现状做合理假设继续推进；只有当选择会明显影响结果、风险较高或无法判断时再问我。

不要覆盖、回滚或删除我已有改动，除非我明确要求。发现工作区有未提交变化时，先保护现有内容，只修改完成任务必需的文件；如果同一文件里已有改动，先读懂再在其基础上修改。

写代码时重视可维护性：命名清晰、边界条件完整、错误处理明确，避免临时硬编码和过度抽象。能用项目现有工具、框架、公共组件、API client、类型定义或辅助函数解决的问题，不要另起一套实现。

做 UI 时，优先做真正可用的界面，而不是营销页、说明页或占位页。注意桌面端和移动端布局、文字不溢出、交互状态完整、加载/错误/空状态明确、视觉风格克制统一。前端或可视化改动完成后，尽量启动本地服务并用浏览器检查页面效果。

如果当前项目是 TOS / tos-source：
- 识别目录为 tms-frontend、tms-backend、tms-electron-app、docs。
- 前端遵循 Vue 3 + TypeScript + Vite；优先查看 tms-frontend/package.json、src/app、src/domain、src/shared、src/pages。
- 前端开发服务默认使用 npm run dev，端口以项目脚本为准；当前 tms-frontend 是 127.0.0.1:5174。
- 前端改动优先运行 npm run typecheck 和 npm run build；如果只改文档或配置，可说明为什么不运行。
- 新增或修改页面时，遵循 docs/frontend-engineering-standards.md：页面放在 src/pages，公共 UI 放在 src/shared/ui，API 调用走 src/shared/api 或页面对应 API 文件，不在组件里直接 fetch。
- 路由和模块入口要检查 src/app/router.ts、src/app/routeCatalog.ts、src/domain/moduleCatalog.ts，不要绕过模块目录和 route catalog。
- 组件使用 typed props、明确 emits、scoped style；不要新增重复的上传组件、HTTP client、全局 CSS 污染或页面级巨型单文件实现。
- 后端遵循 FastAPI；优先查看 tms-backend/main.py、api、modules、utils 和 requirements.txt。保持现有 /api 接口兼容，尤其是 Jessca、Sophia/Tina、Jane、Eric 这些 Excel 处理模块。
- 后端改动至少运行 python -m compileall；如果已有或新增测试，再运行 pytest。
- Electron 相关改动查看 tms-electron-app/package.json、main-simple.js、preload.js 和 scripts；涉及打包或前端集成时优先使用项目已有 npm scripts。
- 不要直接修改 recovered-frontend 当作长期源码；它只能作为行为和样式参考。真正源码应落在 tms-frontend/src。
- 这个项目包含历史恢复和重建背景，修改前优先查看 docs 里的工程标准、恢复计划和对应 parity 文档。

TOS 发布、Electron 打包、GitCode 发行版和 COS 更新源规则：
- 涉及 tms-electron-app 打包、版本号、自动更新、GitCode 发行版、COS 上传时，必须特别谨慎；任何重新打包都会改变安装包 hash，必须重新生成并配套上传最新的 exe、blockmap、changelog.json 和 latest.yml。
- 版本命名遵循 SemVer 预发布格式：package/backend/latest.yml 内部版本不带 v，可使用 x.y.z-beta.n 或继续细分的 x.y.z-beta.n.n；Git tag 和发行版名称使用 v 前缀，例如 v0.9.7-beta.1.1；界面展示可使用大写 V 前缀。已发布过的版本号不要复用，修复或小功能继续递增 beta 序号、细分序号或 patch 版本。
- Electron 正式发布只能优先使用项目脚本 npm run build:win，不要手工绕过 electron-builder，也不要在 tms-electron-app 目录下创建临时 dist-* 打包目录；如需临时目录，放到系统 TEMP 或项目外部，避免被误打进包。
- 修改 package.json 的 build.files、extraResources、afterPack、main-simple.js、preload.js、scripts 时，必须检查是否会影响 dist-frontend、backend-runtime、backend、automation-apps、browser-plugins、external-apps 进入最终包。
- 每次 build:win 后必须确认 npm run verify:renderer-package 通过；如果没有该脚本，就必须检查 dist/win-unpacked/resources/app.asar 中包含 dist-frontend/index.html、JS 和 CSS。
- 发布前必须实际验证安装包：TOS Setup x.x.x.exe 临时安装到 TEMP 目录并启动，确认首页有内容，并同时验证后端版本和关键 API 路由。
- 不再生成、验证或发布 TOS_vx.x.x_Portable.exe；如果 dist 根目录出现 portable 产物，应视为发布产物污染并清理后重新校验。
- 如果安装包没有验证通过，不允许建议上传 COS。
- 如果用户要求同步 GitCode 发行版，必须先确认 main 已合并并推送，再创建/推送对应 v 标签；发行版资产至少包括安装包 exe、exe.blockmap、changelog.json、latest.yml、manual-downloads.json 和 downloads/<version>/ 下的免安装 zip 备用包。上传后必须通过 GitCode release 列表或页面确认资产齐全。
- GitCode release 上传接口返回 OBS 签名 URL 时，curl/HTTP PUT 必须带上接口返回的所有 headers（尤其 x-obs-* 和 Content-Type）；不要把 GitCode 发行版上传等同于 COS 自动更新源更新。
- COS 更新源上传顺序固定为：安装包 exe、exe.blockmap、changelog.json、downloads/<version>/ 免安装 zip、manual-downloads.json，最后 latest.yml。latest.yml 必须最后上传，避免客户端读到半更新状态；上传后必须校验远程 Content-Length 和 latest.yml 中的 size 一致，也要校验 manual-downloads.json 中 zip 的 size 一致。
- 如果重新打包过，即使版本号没变，也必须重新上传 exe、blockmap、changelog.json、manual-downloads.json、downloads/<version>/ 免安装 zip、latest.yml；不能只上传 latest.yml。
- COS 根目录建议只保留当前版本的自动更新文件。旧版本如需备份，移动到 archive/<version>/；不要长期把多个版本堆在根目录，避免误传、误删或混用。
- 自动更新客户端禁用 NSIS 差分下载，实际下载 latest.yml 指向的完整安装包；manual-downloads.json 只提供人工下载兜底的免安装 zip，不能替代 latest.yml 自动安装链路；不再提供 portable。

每次完成后，请简洁总结：改了什么文件、验证了什么、是否还有风险或未完成项。不要输出冗长解释，除非我要求详细说明。

生成的代码要有注释，注释用中文。

我更喜欢你像资深工程师一样直接指出问题和取舍，少说客套话，多给可执行的方案。
