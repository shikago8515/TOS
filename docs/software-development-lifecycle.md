# TOS 软件开发全生命周期流程

本文定义 TOS 项目的轻量企业版 SDLC 流程，用于把需求、设计、开发、测试、上线和运维留痕统一到可复用文档与现有工程门禁中。项目真实工程入口仍以 `AGENTS.md`、`docs/tos-ai-workflow.md`、`docs/engineering-entrypoints.md` 和当前源码为准。

## 1. 适用范围

- 适用于 TOS 前端、后端、Electron、服务器部署和非自动化业务模块的日常需求交付。
- 自动化模块由对应负责人维护；涉及自动化模块时，应先由模块负责人确认范围和文档归档方式。
- 普通小修复不强制补齐全套文档，但必须保留变更目标、验收标准和验证记录。
- 客户验收、外部交付、审计、发布敏感或跨模块改动，应按本文补齐对应阶段文档。

## 2. 阶段与产物

| 阶段 | 目标 | 最小产物 | 现有入口 |
| --- | --- | --- | --- |
| 需求阶段 | 确认做什么、为什么做、验收标准是什么 | 需求调研记录、原始需求清单、SRS 或变更摘要、需求确认记录 | `docs/templates/change-summary.md`、`docs/templates/sdlc/srs.md` |
| 方案设计阶段 | 确认怎么做、影响哪些模块、契约如何保持兼容 | HLD/LLD、API 设计、数据库设计或影响评估 | `docs/source-recovery-and-engineering-plan.md`、`docs/tos-database-design.md`、`docs/templates/sdlc/` |
| 开发编码阶段 | 在受控分支内实现、评审、验证 | 分支、提交、CR 记录、开发任务拆分、自测记录 | `AGENTS.md`、`docs/tos-ai-workflow.md`、`docs/templates/gitea-checklist.md` |
| 测试阶段 | 证明实现符合需求且风险可接受 | 测试计划、测试用例、测试总结、UAT 报告或检查命令记录 | `docs/engineering-entrypoints.md`、`npm run check:*`、`docs/templates/sdlc/` |
| 上线部署阶段 | 可回滚地发布到服务器或桌面端 | 发布清单、部署记录、回滚预案、巡检记录 | `docs/server-deployment-runbook.md`、`docs/templates/server-release-record.md`、`docs/templates/rollback-record.md` |
| 运维迭代阶段 | 保持可维护、可追踪、可复盘 | 用户手册、运维手册、故障报告、版本迭代记录 | `README.md`、`tms-backend/README.md`、`tms-electron-app/README.md`、`CHANGELOG.md` |

## 3. 按改动类型选择文档

| 改动类型 | 必填 | 建议补充 |
| --- | --- | --- |
| 文档、规则、说明 | 变更摘要、验证记录 | 文档映射表更新 |
| 单模块小修复 | 变更摘要、测试记录 | 轻量 SRS、测试用例 |
| 新功能或用户可见流程 | SRS、设计说明、测试计划、UAT checklist | BRS/URS、用户手册 |
| API 契约或数据库变更 | SRS、API 设计、数据库设计、测试计划 | HLD/LLD、回滚预案 |
| 发布、部署、打包、版本链路 | 上线部署方案、发布记录、回滚预案 | 巡检记录、故障预案 |
| 客户验收或外部交付 | BRS、URS、SRS、测试总结、UAT 报告、用户手册 | 全套归档包 |

## 4. 标准执行流程

1. **需求进入**：收集原始诉求，写入 `docs/templates/change-summary.md` 或对应 SRS 模板。
2. **需求确认**：明确业务目标、用户、范围、不做范围、验收标准和变更风险。
3. **方案设计**：按影响面选择 HLD、LLD、API 设计、数据库设计或部署方案模板。
4. **分支开发**：从最新 `gitea/main` 创建 `codex/<topic>` 分支，遵循 `AGENTS.md` 的 Git 和验证规则。
5. **测试验证**：先运行最小真实检查；高风险改动按 `docs/engineering-entrypoints.md` 升级检查范围。
6. **合并发布**：按 `docs/tos-ai-workflow.md` 合并到 Gitea `main`，由远端 CI 和 semantic-release 生成发布事实。
7. **部署巡检**：服务器部署按 `docs/server-deployment-runbook.md`，发布和回滚记录使用现有模板。
8. **归档复盘**：将需求、设计、测试、发布和故障处理文档归档到模块或版本目录。

## 5. 文档归档建议

新模块或核心模块建议使用以下结构：

```text
docs/modules/<module-id>/
  srs.md
  design.md
  api-contract.md
  test-plan.md
  uat-checklist.md
  user-manual.md
```

跨模块或工程化改动建议使用以下结构：

```text
docs/engineering/<topic>/
  change-summary.md
  design.md
  test-summary.md
  release-record.md
```

当前仓库已有大量历史工程文档，不要求搬迁。新增文档应先链接到 `docs/sdlc-document-map.md`，再决定是否按模块归档。

## 6. 维护规则

- 不把账号、token、密码、服务器私钥、数据库连接串写入任何 SDLC 文档。
- 文档中的环境变量只写变量名，不写真实值。
- 改动只涉及文档时，优先运行 `npm run check:changed:dry-run` 和 `npm run check:changed`。
- 文档与当前源码冲突时，以当前源码、`package.json` scripts 和 `AGENTS.md` 的安全/Git/发布规则为准，并修正文档漂移。
