# TOS 工程化收口路线图

本文档跟踪当前仓库中“功能可运行但工程化未完全收口”的部分。执行时按小任务推进，避免把前端重建、后端契约、安全和发布链路混在一次高风险改动里。

## 当前状态

- 基础工程入口已经存在：根目录 `npm run check:*`、Gitea 远端检查、服务器包 dry-run、Electron 包校验脚本。
- 第一阶段入口一致性已收口：`/web-automation` 作为真实模块入口接入模块目录、侧边栏、首页快捷入口和 Vue 页面组件。
- Jason / 发票 PDF 重排序已经完成前端源码化：真实 Vue 页面、typed API/model 层和 source guard 测试替代了 raw HTML + `new Function` 包装。
- Jason 已完成 canonical 前后端命名：`/#/jason/pdf-reorder` 和 `/api/jason/pdf-reorder/*` 是当前主入口；`it-invoice-pdf-reorder` 是历史兼容技术标识，只作为旧路由和旧 API alias 保留。
- Jason、`release-updates`、`system-config` 等接口已先行补齐 response schema，并纳入桌面后端契约测试；后续 schema 化应继续推广到高频业务接口。
- 前端已接入低侵入 ESLint 静态门禁，`check:quick` 与 `check:frontend` 会运行 `npm run lint`；Prettier 暂未引入，避免制造全仓格式化 diff。
- 日常开发验证已按风险分层：小范围前端/后端改动优先运行相关最小检查，发布、部署、CI/CD 和打包链路优先走专项检查；无法安全缩小范围时再使用 `npm run check:quick` 作为兜底门禁。
- 系统设置页已接入 TOS 轻量在线安装器和完整安装包下载链路；相关 MinIO 下载接口仍属于发布敏感链路。
- `recovered-frontend` 仍作为回退和视觉参考保留；没有移除或更改回退开关。

## 优先级

| Priority | Area | 目标 | 验收标准 |
| --- | --- | --- | --- |
| P0 | 前端入口一致性 | 已有页面源码必须有真实模块入口，不能落到 `RoutePlaceholder` | 模块目录、路由和首页入口一致；前端测试覆盖 `/web-automation` 主入口 |
| P1 | Jason / 发票 PDF 重排序源码化 | 将 raw HTML + `new Function` 包装迁移为 Vue 组件 | 已完成；页面状态、上传、预览、处理、下载流程与当前行为一致 |
| P1 | Jason 前后端 canonical 命名 | 新增 `/#/jason/pdf-reorder` 和 `/api/jason/pdf-reorder/*`，旧入口保留 alias | 已完成；新旧路由/API 均有契约测试；前端只调用 canonical API；旧下载 URL 继续可用 |
| P1 | 后端 API schema 化 | 为高频业务接口逐步补 typed request/response models | Jason、`release-updates`、`system-config` 已完成；下一批优先收口 Jessca、Jane、Eric、Draft/Packing、Finance |
| P2 | 安全硬化 | 收紧桌面场景下的 CORS、外链打开和本地 executor token 管理 | Electron 外链使用 allowlist；CORS 使用本地 allowlist；executor token 从本机配置或安全存储读取；敏感配置不进入 Git 或发行包 |
| P2 | 发布验收自动化 | 补齐浏览器 smoke、Electron 启动和外部二进制供应链验证 | 发布前验证脚本能发现缺失外部资源、前端入口异常和关键页面加载失败 |
| P2 | 前端静态门禁 | 已接入低侵入 ESLint；Prettier 暂缓 | `npm run lint` 已纳入 `check:quick` 和 `check:frontend`；后续逐步收紧自动化响应类型相关规则 |
| P2 | 后端慢测试治理 | 优化或拆分 `test_file_security_utils.LegacyApiSecurityTests` 等耗时测试 | 保留安全覆盖，不删除关键断言；优先减少重复 setup 或单独标识 slow test，避免在可专项验证的场景反复运行整套 `check:quick` |

## 执行边界

- 每个任务单独分支、单独验证；不在一个提交里混合安全、重构、发布配置和 UI 行为。
- 不移除 `tms-electron-app/recovered-frontend/`，除非已有足够 burn-in 结论并同步更新 `copy-frontend.js`、文档和打包校验。
- 不删除 Jason 模块的旧 `it-invoice-pdf-reorder` API prefix 或 legacy router，直到确认没有旧前端、脚本或发布包仍在调用旧路径。
- 不把 `/api/system/config/*` 下载接口当作普通业务接口随手调整；自动化助手、TOS 轻量在线安装器、完整安装包和 payload 下载均属于发布敏感链路。
- 不把 `external-apps/infornexus` 二进制直接纳入 Git；后续应选择 Git LFS、release cache 或内部 artifact copy step。

## 建议实施顺序

1. 完成 P0 入口一致性并保持测试覆盖。
2. 完成 Jason / 发票 PDF 重排序源码化，并保持 source guard、API/model 测试覆盖。
3. 完成 Jason canonical 路由/API 和 response schema 化，新旧路径并行验证后再推广到其他模块。
4. 为 `release-updates` 与 `system-config` 补充 response schema，并把系统接口纳入桌面后端契约。
5. 单独处理 Electron 外链 allowlist、CORS 本地 allowlist 和 executor token 配置化，补 secret hygiene 测试。
6. 在发布脚本中增加可选 smoke 验证，覆盖 `/release-updates`、TOS 桌面下载入口和关键业务页面，先本地跑通，再考虑纳入 Gitea 远端检查。
7. 单独优化后端慢测试，优先处理 `tms-backend/tests/test_file_security_utils.py` 中 legacy API security 覆盖的重复 setup；不得通过删除安全断言来缩短检查时间。
