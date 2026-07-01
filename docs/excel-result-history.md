# Excel 处理结果历史归档与下载

本文档说明 Excel 处理模块的历史结果文件如何归档、查询和下载。

## 目标

- 当前处理结果下载保持兼容：各模块继续保留旧 `/download/{filename}` 接口。
- 历史结果下载走服务器持久化：结果文件进服务器 MinIO `tos-results` bucket，索引写入 MySQL `tos_activity_files`。
- 本地后端不默认连接本机 MinIO，也不保存服务器 MinIO 密钥。
- 前端不接触归档 token、MinIO access key/secret 或 MySQL 连接串。

## 数据流

1. 用户在本地前端上传 Excel 并点击处理。
2. 本地后端执行对应模块逻辑，生成当前结果文件。
3. 本地后端读取 `TOS_PROCESS_HISTORY_ARCHIVE_URL` 和 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN`。
4. 如果配置存在，本地后端把结果文件和历史元数据 POST 到服务器 `/api/process-history/result-files`。
5. 服务器后端校验 `TOS_PROCESS_HISTORY_WRITE_TOKEN`，写入：
   - MinIO bucket：`tos-results`
   - object key：`process-results/{moduleId}/{yyyy}/{mm}/{dd}/{requestId}/result_file/{timestamp}-{filename}`
   - MySQL：`tos_activity_records` 和 `tos_activity_files`，其中 `file_role='result_file'`
6. 服务器返回 `history_id`、`result_file_id`、`result_download_path`、`result_file` 和 `result_download_backend_target='remote'`。
7. 前端把记录合并到本机最近 20 条缓存；有远程下载路径时，顶部“下载历史结果”走服务器后端下载。

## 接口

服务器归档接口：

```text
POST /api/process-history/result-files
Header: X-TOS-History-Write-Token: <server write token>
Content-Type: multipart/form-data
```

必填字段：

- `moduleId`
- `requestId`
- `originalFilename`
- `file`

可选字段：

- `moduleName`
- `status`
- `durationMs`
- `message`
- `inputFiles`
- `outputFile`
- `summary`
- `createdAt`
- `contentType`

历史下载接口：

```text
GET /api/process-history/files/{file_id}/download
```

该接口只允许下载非 automation 的 `result_file`，并通过后端代理从 MinIO streaming 返回文件。

## 环境变量

服务器后端：

```text
TOS_PROCESS_HISTORY_WRITE_TOKEN=<shared-write-token>
```

本地后端：

```text
TOS_PROCESS_HISTORY_ARCHIVE_URL=https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/result-files
TOS_PROCESS_HISTORY_ARCHIVE_TOKEN=<shared-write-token>
```

注意：

- token 值只能放在环境变量、服务器私有配置或已忽略的本机私有配置中。
- 不要提交 `settings.yaml`、`.env.server`、MinIO 密钥、MySQL 密码或归档 token。
- 不要把 token 写入命令历史、remote URL、日志或提交信息。

## 前端规则

- 顶部“下载结果”下载当前刚生成的本地结果文件。
- 顶部“下载历史结果”下载当前模块最新一条带 `resultDownloadPath` 的历史结果文件。
- 没有可下载历史结果时，“下载历史结果”禁用，并通过 title 提示历史结果未归档。
- 右侧 `ProcessHistoryPanel` 只展示处理记录、输入文件和结果文件名，不显示行内下载按钮。

## 失败策略

- 未配置 `TOS_PROCESS_HISTORY_ARCHIVE_URL` 或 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN`：不尝试连接本机 MinIO，返回 `history_warnings`。
- 服务器归档接口未部署、token 不匹配、服务器 MinIO/MySQL 不可用：当前 Excel 处理不失败，当前结果仍可通过旧“下载结果”下载。
- 旧记录不会自动补历史结果文件；需要功能上线并配置服务器归档后重新处理一次，才会生成可下载历史 Excel。

## 验证

后端目标测试：

```powershell
cd tms-backend
python -m unittest tests.test_process_history_api tests.test_excel_result_history -v
```

前端目标和完整检查：

```powershell
cd tms-frontend
npm run lint
npm run typecheck
npm run test
```

跨模块验证：

```powershell
npm run check:quick
```

手工集成检查：

1. 服务器后端部署本接口并配置 `TOS_PROCESS_HISTORY_WRITE_TOKEN`。
2. 本地后端配置 `TOS_PROCESS_HISTORY_ARCHIVE_URL` 和 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN`。
3. 重新处理任一 Excel 模块，例如 Jane 成品表。
4. 确认响应包含 `result_download_backend_target='remote'` 和 `result_download_path`。
5. 前端顶部“下载历史结果”可下载服务器归档 Excel。
