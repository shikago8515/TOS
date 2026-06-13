# TOS 工程化收口路线图

本文档跟踪当前仓库中“功能可运行但工程化未完全收口”的部分。执行时按小任务推进，避免把前端重建、后端契约、安全和发布链路混在一次高风险改动里。

## 当前状态

- 基础工程入口已经存在：根目录 `npm run check:*`、GitCode CI、服务器包 dry-run、Electron 包校验脚本。
- 第一阶段入口一致性已收口：`/web-automation` 作为可见 validation 模块接入模块目录、侧边栏、首页快捷入口和真实 Vue 页面组件。
- Jason / 发票 PDF 重排序已经完成前端源码化：真实 Vue 页面、typed API/model 层和 source guard 测试替代了 raw HTML + `new Function` 包装。
- Jason 是业务模块名；`it-invoice-pdf-reorder` 是历史兼容技术标识，只作为旧路由和旧 API alias 保留。
- `recovered-frontend` 仍作为回退和视觉参考保留；没有移除或更改回退开关。

## 优先级

| Priority | Area | 目标 | 验收标准 |
| --- | --- | --- | --- |
| P0 | 前端入口一致性 | 已有页面源码必须有真实模块入口，不能落到 `RoutePlaceholder` | 模块目录、路由和首页入口一致；前端测试覆盖 `/web-automation` 主入口 |
| P1 | Jason / 发票 PDF 重排序源码化 | 将 raw HTML + `new Function` 包装迁移为 Vue 组件 | 已完成；页面状态、上传、预览、处理、下载流程与当前行为一致 |
| P1 | Jason 前后端 canonical 命名 | 新增 `/#/jason/pdf-reorder` 和 `/api/jason/pdf-reorder/*`，旧入口保留 alias | 新旧路由/API 均有契约测试；前端只调用 canonical API；旧下载 URL 继续可用 |
| P1 | 后端 API schema 化 | 为高频业务接口逐步补 typed request/response models | Jason 模块先行；不破坏现有 OpenAPI 路径契约；新增 schema 有对应 API 契约测试 |
| P2 | 安全硬化 | 收紧桌面场景下的 CORS、外链打开和本地 executor token 管理 | Electron 外链使用 allowlist；executor token 从本机配置或安全存储读取；敏感配置不进入 Git 或发行包 |
| P2 | 发布验收自动化 | 补齐浏览器 smoke、Electron 启动和外部二进制供应链验证 | 发布前验证脚本能发现缺失外部资源、前端入口异常和关键页面加载失败 |
| P2 | 前端静态门禁 | 评估并引入 ESLint/Prettier 或等价规则 | 与现有 Vue/TypeScript 风格兼容；CI 使用真实脚本，不声称运行不存在命令 |

## 执行边界

- 每个任务单独分支、单独验证；不在一个提交里混合安全、重构、发布配置和 UI 行为。
- 不移除 `tms-electron-app/recovered-frontend/`，除非已有足够 burn-in 结论并同步更新 `copy-frontend.js`、文档和打包校验。
- 不删除 Jason 模块的旧 `it-invoice-pdf-reorder` API prefix 或 legacy router，直到确认没有旧前端、脚本或发布包仍在调用旧路径。
- 不把 `external-apps/infornexus` 二进制直接纳入 Git；后续应选择 Git LFS、release cache 或内部 artifact copy step。

## 建议实施顺序

1. 完成 P0 入口一致性并保持测试覆盖。
2. 完成 Jason / 发票 PDF 重排序源码化，并保持 source guard、API/model 测试覆盖。
3. 完成 Jason canonical 路由/API 和 response schema 化，新旧路径并行验证后再推广到其他模块。
4. 为后端选择下一个低风险模块补充 response schema，验证 OpenAPI 和前端调用兼容后再推广。
5. 单独处理 Electron 外链 allowlist 和 executor token 配置化，补 secret hygiene 测试。
6. 在发布脚本中增加可选 smoke 验证，先本地跑通，再考虑纳入 GitCode CI。
