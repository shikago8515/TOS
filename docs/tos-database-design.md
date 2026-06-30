# TOS 数据库设计说明

更新时间：2026-06-30

本文件记录服务器 `tos` 数据库当前真实结构。数据库已重构为一套新的 `tos_*` 表，旧表已完成数据迁移并删除。

## 设计原则

- 以人员、模块、处理记录、文件产物为主线，首页看板和历史页面都从同一套记录表读取。
- 表名统一使用 `tos_` 前缀，字段名使用直观业务含义，避免旧表中自动化、Excel、发布记录各自散落。
- 自动化运行记录和本地 Excel 处理历史统一进入 `tos_activity_records`。
- 自动化结果文件、Excel 上传备份、本地处理产物统一进入 `tos_activity_files`。
- 凭据、模板、版本记录保留独立表，避免把安全数据或配置数据混入处理流水。

## 当前表总览

| 表名 | 当前行数 | 用途 |
| --- | ---: | --- |
| `tos_people` | 7 | 人员主数据，用于首页按人员分组、排序和展示。 |
| `tos_modules` | 24 | 模块主数据，维护模块归属人员、页面路径、模块类型。 |
| `tos_activity_records` | 115 | 统一处理记录表，承载自动化执行、本地 Excel/PDF 等处理历史。 |
| `tos_activity_files` | 226 | 统一文件产物表，承载结果文件、上传备份、MinIO 对象索引。 |
| `tos_module_templates` | 6 | 模块模板表，维护 Excel 模板等可下载模板文件。 |
| `tos_login_accounts` | 12 | 模块登录账号表，保存加密后的自动化登录凭据。 |
| `tos_release_records` | 223 | 版本更新记录表，支撑 `/release-updates` 历史时间线。 |

## 已删除旧表

迁移完成后已删除以下旧表：

`automation_credentials`, `automation_run_files`, `automation_runs`, `excel_templates`, `excel_upload_backups`, `process_history_records`, `release_announcements`, `release_update_records`

迁移对应关系：

| 旧表 | 新表 |
| --- | --- |
| `automation_runs` | `tos_activity_records` |
| `process_history_records` | `tos_activity_records` |
| `automation_run_files` | `tos_activity_files` |
| `excel_upload_backups` | `tos_activity_files` |
| `excel_templates` | `tos_module_templates` |
| `automation_credentials` | `tos_login_accounts` |
| `release_update_records` | `tos_release_records` |
| `release_announcements` | 无有效数据，删除 |

## 表结构

### `tos_people`

用途：人员维表，首页左侧人员分组和参与人员统计使用。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `person_id` | `varchar(64)` | 否 | PK |  | 人员唯一标识，如 `jessica`。 |
| `person_name` | `varchar(96)` | 否 |  |  | 中文或业务展示名。 |
| `person_name_en` | `varchar(96)` | 否 |  |  | 英文展示名。 |
| `sort_order` | `int` | 否 |  | `100` | 首页和导航排序。 |
| `is_active` | `tinyint(1)` | 否 |  | `1` | 是否启用。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 创建时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |

索引：`PRIMARY(person_id)`

### `tos_modules`

用途：模块维表，定义模块属于谁、是什么类型、前端跳转到哪里。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `module_id` | `varchar(128)` | 否 | PK |  | 模块唯一标识。 |
| `person_id` | `varchar(64)` | 否 | IDX |  | 归属人员，对应 `tos_people.person_id`。 |
| `module_name` | `varchar(255)` | 否 |  |  | 中文模块名。 |
| `module_name_en` | `varchar(255)` | 否 |  |  | 英文模块名。 |
| `module_type` | `varchar(64)` | 否 | IDX | `excel` | 模块类型，如 `excel`、`browser-automation`、`pdf`。 |
| `page_path` | `varchar(255)` | 否 |  |  | 前端页面路径。 |
| `sort_order` | `int` | 否 |  | `100` | 人员下模块排序。 |
| `is_active` | `tinyint(1)` | 否 |  | `1` | 是否启用。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 创建时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |

索引：`PRIMARY(module_id)`, `idx_tos_modules_person(person_id, sort_order)`, `idx_tos_modules_type(module_type)`

### `tos_activity_records`

用途：统一处理流水。首页“今日处理/成功/失败/人员动态/最近处理”以及自动化记录列表都从这里读取。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `id` | `bigint unsigned` | 否 | PK |  | 自增主键。 |
| `activity_id` | `varchar(128)` | 否 | UK |  | 业务记录 ID，自动化 run_id 或本地处理 record_id。 |
| `module_id` | `varchar(128)` | 否 | IDX |  | 关联模块。 |
| `person_id` | `varchar(64)` | 否 | IDX |  | 记录归属人员。 |
| `activity_type` | `varchar(64)` | 否 | IDX | `excel` | 记录类型，如 `automation`、`excel`、`pdf`。 |
| `activity_name` | `varchar(255)` | 否 |  |  | 展示名称。 |
| `status` | `varchar(32)` | 否 | IDX | `pending` | 状态，如 `success`、`failed`、`running`、`error`。 |
| `status_label` | `varchar(32)` | 否 |  |  | 中文状态，如成功、失败、执行中。 |
| `message` | `text` | 是 |  |  | 用户可读消息。 |
| `technical_message` | `text` | 是 |  |  | 技术错误或详细消息。 |
| `result_json` | `longtext` | 是 |  |  | 自动化结果 JSON。 |
| `metadata_json` | `longtext` | 是 |  |  | 本地处理输入文件、输出文件、摘要等扩展信息。 |
| `duration_ms` | `bigint unsigned` | 否 |  | `0` | 处理耗时。 |
| `started_at` | `datetime` | 是 |  |  | 开始时间。 |
| `finished_at` | `datetime` | 是 |  |  | 完成时间。 |
| `created_at` | `datetime` | 否 | IDX | `CURRENT_TIMESTAMP` | 业务发生时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |
| `source_system` | `varchar(96)` | 否 |  | `tos` | 数据来源，如 `web-automation`、`frontend.process-history`。 |

索引：`PRIMARY(id)`, `uq_tos_activity_id(activity_id)`, `idx_tos_activity_created(created_at)`, `idx_tos_activity_person_created(person_id, created_at)`, `idx_tos_activity_module_created(module_id, created_at)`, `idx_tos_activity_status_created(status, created_at)`, `idx_tos_activity_type_created(activity_type, created_at)`

### `tos_activity_files`

用途：统一记录处理相关文件。自动化源文件、结果文件、失败明细、Excel 上传备份、本地输出都写入这里。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `file_id` | `bigint unsigned` | 否 | PK |  | 自增主键。 |
| `activity_id` | `varchar(128)` | 否 | IDX |  | 关联 `tos_activity_records.activity_id`。 |
| `file_role` | `varchar(64)` | 否 |  |  | 文件角色，如 `source_excel`、`result_excel`、`upload_backup`。 |
| `file_role_label` | `varchar(96)` | 否 |  |  | 中文文件角色。 |
| `storage_provider` | `varchar(32)` | 否 |  | `minio` | 存储类型，如 `minio`、`local-path`。 |
| `bucket` | `varchar(128)` | 否 |  |  | MinIO bucket。 |
| `object_key` | `varchar(1024)` | 否 |  |  | MinIO object key 或本地路径。 |
| `file_name` | `varchar(255)` | 否 |  |  | 原始文件名或展示文件名。 |
| `content_type` | `varchar(128)` | 否 |  |  | MIME 类型。 |
| `file_size` | `bigint unsigned` | 否 |  | `0` | 文件大小。 |
| `sha256` | `char(64)` | 否 |  |  | 文件哈希。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 归档时间。 |

索引：`PRIMARY(file_id)`, `uq_tos_activity_file_object(activity_id, file_role, object_key, file_name)`, `idx_tos_activity_files_activity(activity_id, created_at)`

### `tos_module_templates`

用途：模块模板中心。前端模板中心和下载接口使用。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `template_id` | `bigint unsigned` | 否 | PK |  | 自增主键。 |
| `module_id` | `varchar(128)` | 否 | IDX |  | 所属模块。 |
| `template_key` | `varchar(128)` | 否 |  | `default` | 模板业务键。 |
| `template_name` | `varchar(255)` | 否 |  |  | 模板展示名称。 |
| `bucket` | `varchar(128)` | 否 |  |  | MinIO bucket。 |
| `object_key` | `varchar(1024)` | 否 |  |  | MinIO object key。 |
| `file_name` | `varchar(255)` | 否 |  |  | 原始文件名。 |
| `content_type` | `varchar(128)` | 否 |  |  | MIME 类型。 |
| `file_size` | `bigint unsigned` | 否 |  | `0` | 文件大小。 |
| `sha256` | `char(64)` | 否 |  |  | 文件哈希。 |
| `is_active` | `tinyint(1)` | 否 |  | `1` | 是否启用。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 创建时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |

索引：`PRIMARY(template_id)`, `uq_tos_module_templates(module_id, template_key)`, `idx_tos_module_templates_module(module_id, is_active)`

### `tos_login_accounts`

用途：自动化登录账号。密码只保存加密密文，前端只回显账号名。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `account_id` | `bigint unsigned` | 否 | PK |  | 自增主键。 |
| `module_id` | `varchar(128)` | 否 | IDX |  | 所属自动化模块。 |
| `account_key` | `varchar(128)` | 否 |  | `default` | 账号槽位，如 `default`。 |
| `username` | `varchar(255)` | 否 |  |  | 登录账号。 |
| `password_ciphertext` | `text` | 否 |  |  | 加密后的密码密文。 |
| `is_active` | `tinyint(1)` | 否 |  | `1` | 是否启用。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 创建时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |

索引：`PRIMARY(account_id)`, `uq_tos_login_accounts(module_id, account_key)`, `idx_tos_login_accounts_module(module_id, is_active)`

### `tos_release_records`

用途：版本发布和更新历史。`/release-updates` 页面和部署同步流程使用。

| 字段 | 类型 | 可空 | 键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `release_id` | `bigint unsigned` | 否 | PK |  | 自增主键。 |
| `release_key` | `varchar(160)` | 否 | UK |  | 发布记录唯一键。 |
| `release_version` | `varchar(64)` | 否 |  |  | 版本号。 |
| `release_date` | `date` | 是 | IDX |  | 发布日期。 |
| `change_type` | `varchar(32)` | 否 |  | `improved` | 变更类型，如 `added`、`improved`、`fixed`。 |
| `page_name` | `varchar(255)` | 否 |  |  | 页面或模块名称。 |
| `page_path` | `varchar(255)` | 否 | IDX |  | 页面路径。 |
| `title` | `varchar(255)` | 否 |  |  | 更新标题。 |
| `description` | `text` | 是 |  |  | 更新描述。 |
| `created_by` | `varchar(96)` | 否 |  | `system` | 创建来源。 |
| `created_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 创建时间。 |
| `updated_at` | `timestamp` | 否 |  | `CURRENT_TIMESTAMP` | 更新时间，自动更新。 |

索引：`PRIMARY(release_id)`, `uq_tos_release_key(release_key)`, `idx_tos_release_date(release_date, release_id)`, `idx_tos_release_page(page_path)`

