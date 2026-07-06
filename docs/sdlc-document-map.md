# TOS SDLC 文档映射表

本文把标准企业版软件开发文档映射到当前 TOS 仓库已有资料，方便判断哪些已经满足、哪些需要按模块或版本逐步补齐。

状态说明：

- **已覆盖**：已有当前可用文档或脚本门禁。
- **部分覆盖**：已有工程资料，但不是标准企业交付文档。
- **待补齐**：仓库中暂无稳定模板或正式文档。
- **按需补齐**：普通小改不强制，客户验收、审计或高风险改动需要补。

## 1. 需求类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 需求调研记录表 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/requirement-research.md` |
| 原始需求清单 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/raw-requirement-list.md` |
| BRS 业务需求说明书 | `docs/templates/change-summary.md` 部分覆盖业务目标 | 部分覆盖 | 客户/业务流程型需求使用 `docs/templates/sdlc/brs.md` |
| URS 用户需求说明书 | 模块 parity 文档部分描述用户行为 | 部分覆盖 | 用户操作流程型需求使用 `docs/templates/sdlc/urs.md` |
| SRS 软件需求规格说明书 | `docs/templates/change-summary.md` 和模块规则部分覆盖 | 部分覆盖 | 新功能、高风险改动使用 `docs/templates/sdlc/srs.md` |
| 需求评审纪要 | 无固定模板 | 待补齐 | 复用 SRS 的评审记录章节，必要时独立建会议纪要 |
| 需求变更申请表 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/requirement-change-request.md` |
| 需求确认单 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/requirement-signoff.md` |

## 2. 设计类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| HLD 概要设计说明书 | `docs/source-recovery-and-engineering-plan.md`、`README.md`、各 README | 部分覆盖 | 跨模块或架构调整使用 `docs/templates/sdlc/hld.md` |
| LLD 详细设计说明书 | 模块源码和少量工程计划文档 | 部分覆盖 | 复杂状态机、文件处理、发布链路使用 `docs/templates/sdlc/lld.md` |
| 数据库设计说明书 | `docs/tos-database-design.md` | 已覆盖 | 数据库变更同步更新该文档或使用 `docs/templates/sdlc/database-design.md` |
| ER 图/数据字典 | `docs/tos-database-design.md` 表结构覆盖，ER 图缺失 | 部分覆盖 | 后续数据库治理补 ER 图或 Mermaid |
| API 接口设计文档 | FastAPI OpenAPI、前端 API 模块、契约测试 | 部分覆盖 | 新接口或 breaking 风险使用 `docs/templates/sdlc/api-design.md` |
| 统一错误码规范 | 后端脱敏规则和测试覆盖，未形成统一错误码文档 | 部分覆盖 | API 收口阶段补错误码/错误响应规范 |
| 系统部署架构方案 | `docs/server-deployment-runbook.md` | 已覆盖 | 服务器架构变化时同步更新 |
| UI/交互规范 | `docs/frontend-engineering-standards.md`、页面 parity 文档 | 部分覆盖 | 新 UI 模块按模块补交互说明 |
| 设计评审纪要 | 无固定模板 | 待补齐 | 复杂改动在 HLD/LLD 增加评审记录 |

## 3. 开发类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 项目环境搭建手册 | `README.md`、`docs/engineering-entrypoints.md`、各子项目 README | 已覆盖 | 新入口同步文档地图 |
| 代码开发规范 | `AGENTS.md`、`docs/frontend-engineering-standards.md`、`tms-backend/README.md` | 已覆盖 | 继续按模块边界维护 |
| Git 分支管理规范 | `AGENTS.md`、`docs/tos-ai-workflow.md` | 已覆盖 | 保持 Gitea main 主线规则 |
| 开发任务分解清单 | 无固定模板 | 待补齐 | 复杂需求使用 SRS 或设计文档中的任务拆分章节 |
| 单元测试用例 | `tms-backend/tests/`、`tms-frontend/src/**/*.test.ts`、`scripts/**/*.test.*` | 已覆盖 | 文档化测试范围可使用测试计划模板 |
| Code Review 记录 | Gitea/提交历史承载，仓库无模板 | 按需补齐 | 外部交付时使用 `docs/templates/sdlc/code-review-record.md` |
| 项目 README | `README.md`、子项目 README | 已覆盖 | 新文档入口同步 README 文档地图 |

## 4. 测试类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 测试计划 TP | 工程入口和验证分层覆盖命令，不是测试计划 | 部分覆盖 | 使用 `docs/templates/sdlc/test-plan.md` |
| 测试用例 TC | 自动化测试文件覆盖，但缺业务用例说明 | 部分覆盖 | 使用 `docs/templates/sdlc/test-case.md` 补关键业务场景 |
| 测试数据准备文档 | 测试代码内有 fixtures，暂无统一文档 | 部分覆盖 | 大文件/真实样本场景单独记录 |
| 性能测试报告 | 无固定报告 | 待补齐 | 有并发/性能需求时补专项报告 |
| 安全测试报告 | 有安全边界测试，缺正式报告 | 部分覆盖 | 安全审计时补报告 |
| Bug 跟踪台账 | 依赖 Git/Gitea 历史，无仓库模板 | 按需补齐 | 使用 `docs/templates/sdlc/bug-register.md` |
| 系统测试总结报告 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/test-summary.md` |
| UAT 用户验收报告 | 无固定模板 | 待补齐 | 使用 `docs/templates/sdlc/uat-report.md` |

## 5. 上线部署类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 上线部署操作方案 | `docs/server-deployment-runbook.md`、`docs/tos-ai-workflow.md` | 已覆盖 | 重大发布可复制 `docs/templates/sdlc/deployment-plan.md` |
| 数据库变更脚本说明 | `docs/tos-database-design.md` 部分覆盖 | 部分覆盖 | 有 DDL/DML 时补执行顺序和回滚脚本 |
| 上线风险及回滚预案 | `docs/server-deployment-runbook.md`、`docs/templates/rollback-record.md` | 已覆盖 | 发布前确认 deployId 和回滚点 |
| 上线发布记录单 | `docs/templates/server-release-record.md` | 已覆盖 | 每次服务器发布填写 |
| 上线巡检记录表 | server release record 部分覆盖 | 部分覆盖 | 可用 `docs/templates/sdlc/release-checklist.md` 补巡检项 |

## 6. 交付与运维类

| 标准文档 | 当前 TOS 对应资料 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 用户操作手册 | README 和页面文案，不是用户手册 | 待补齐 | 使用 `docs/templates/sdlc/user-manual.md` |
| 运维部署维护手册 | `docs/server-deployment-runbook.md` | 部分覆盖 | 使用 `docs/templates/sdlc/operation-manual.md` 补日常运维视角 |
| 第三方接口对接维护手册 | 分散在模块文档和环境变量说明中 | 部分覆盖 | 使用 `docs/templates/sdlc/third-party-interface-maintenance.md` |
| 线上故障处理报告 | `docs/templates/rollback-record.md` 部分覆盖 | 部分覆盖 | 使用 `docs/templates/sdlc/incident-report.md` |
| 项目全套文档归档包 | 无固定归档清单 | 待补齐 | 发布或验收时按本文映射表归档 |

## 7. 建议补齐顺序

1. 先保持本文档映射表与真实仓库同步。
2. 新需求优先补 `change-summary`、`srs`、`test-plan`、`test-summary`。
3. 高风险改动补 `hld`、`lld`、`api-design`、`deployment-plan`。
4. 客户验收补 `brs`、`urs`、`uat-report`、`user-manual`。
5. 线上事故补 `incident-report` 和必要的 rollback record。
