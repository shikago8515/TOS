# TOS Hybrid Backend Development Mode

Hybrid 模式用于本地前端开发时，同时使用服务器共享数据和本机执行能力。

## 启动方式

先确认旧的 `5174` Vite 进程已经停止，再运行：

```powershell
npm run dev:frontend
```

显式 Hybrid 别名也可使用：

```powershell
npm run dev:frontend:hybrid
```

浏览器仍访问：

```text
http://127.0.0.1:5174
```

## 开发模式入口

- `npm run dev:frontend`
  - 默认 Hybrid 模式，等价于 `npm run dev:frontend:hybrid`。
  - 服务器共享数据接口连接服务器后端。
  - 本机执行接口连接本地后端 `http://127.0.0.1:8000`。
- `npm run dev:frontend:server`
  - 本地前端全部连接服务器后端 `https://ai.tomwell.net:56130/tos/desktop-api`。
  - 数据和业务接口都来自服务器。
  - 适合只改前端并查看服务器真实数据。
- `npm run dev:frontend:hybrid`
  - 服务器共享数据接口连接服务器后端。
  - 本机执行接口连接本地后端 `http://127.0.0.1:8000`。
  - 适合本地开发自动化、Excel/PDF 处理等功能，同时读取服务器模板、版本记录和首页看板数据。
- `npm run dev:frontend:local`
  - 本地前端连接本地后端 `http://127.0.0.1:8000`。
  - 数据来自本地后端配置的本地 MySQL。
  - 适合纯本地后端开发和离线调试。

## Hybrid 分流规则

服务器后端：

- `/api/release-updates*`
- `/api/automation/templates*`
- 首页看板读取的自动化运行记录：`/api/automation/runs*`
- 首页看板读取的处理历史：`/api/process-history/records*`
- 历史结果文件下载：`/api/process-history/files/*`

本地后端：

- Excel 上传处理接口
- PDF 处理接口
- 浏览器自动化执行接口
- Desktop Utility / PackByScan 等依赖本机环境的接口
- 自动化运行记录创建、完成写入和运行文件下载
- 当前处理结果下载：各 Excel 模块旧 `/download/{filename}` 接口

Excel 处理结果历史归档：

- 本地后端处理 Excel 后，不直接连接本机 MinIO 保存历史结果。
- 配置 `TOS_PROCESS_HISTORY_ARCHIVE_URL` 和 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN` 后，本地后端会把结果文件 POST 到服务器 `/api/process-history/result-files`，由服务器后端写服务器 MinIO 和 MySQL。
- 未配置远程归档或服务器暂不可用时，当前处理不失败，只返回 `history_warnings`；顶部“下载结果”仍下载本次本地结果，“下载历史结果”会在没有可归档历史文件时禁用。

## 注意事项

- Hybrid 模式不会让本地后端直连服务器 MySQL。
- 不要把服务器 MySQL 密码、MinIO 密钥或连接串写入仓库。
- 不要把 `TOS_PROCESS_HISTORY_WRITE_TOKEN` 或 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN` 写入仓库、日志、命令历史或提交信息。
- 模板中心的新增、替换、停用、下载会直接作用服务器数据。
- 首页看板会读取服务器共享记录，并合并浏览器本机缓存中的处理历史。
- 如果本地后端没有启动，共享数据页面仍可读取服务器数据，但本地执行功能会显示后端连接错误。
