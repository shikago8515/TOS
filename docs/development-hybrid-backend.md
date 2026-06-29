# TOS Hybrid Backend Development Mode

Hybrid 模式用于本地前端开发时同时使用服务器共享数据和本机执行能力。

## 启动方式

先确认旧的 `5174` Vite 进程已经停止，再运行：

```powershell
npm run dev:frontend:hybrid
```

浏览器仍访问：

```text
http://127.0.0.1:5174
```

## 三种开发模式

- `npm run dev:frontend`
  - 本地前端连接本地后端 `http://127.0.0.1:8000`。
  - 数据来自本地后端配置的本地 MySQL。
  - 适合纯本地后端开发和离线调试。

- `npm run dev:frontend:server`
  - 本地前端全部连接服务器后端 `https://ai.tomwell.net:56130/tos/desktop-api`。
  - 数据和业务接口都来自服务器。
  - 适合只改前端并查看服务器真实数据。

- `npm run dev:frontend:hybrid`
  - 共享数据接口连接服务器后端。
  - 本机执行接口连接本地后端 `http://127.0.0.1:8000`。
  - 适合本地开发自动化、Excel/PDF 处理等功能，同时读取服务器模板和版本记录。

## Hybrid 分流规则

服务器后端：

- `/api/release-updates*`
- `/api/automation/templates*`

本地后端：

- Excel 上传处理接口
- PDF 处理接口
- 浏览器自动化执行接口
- Desktop Utility / PackByScan 等依赖本机环境的接口
- 自动化运行记录和本地处理结果下载

## 注意事项

- Hybrid 模式不会让本地后端直连服务器 MySQL。
- 不要把服务器 MySQL 密码、MinIO 密钥或连接串写入仓库。
- 模板中心的新增、替换、停用、下载会直接作用服务器数据。
- 如果本地后端没有启动，共享数据页仍可读取服务器数据，但本地执行功能会显示后端连接错误。
