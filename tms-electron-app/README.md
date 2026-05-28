# TMS 报表自动化工具 - Electron 版本

这是一个将 TMS 工具集成到 Electron 桌面应用的完整方案。

## 📁 项目结构

```
win-unpacked/
├── tms-electron-app/     # Electron 应用外壳
├── tms-backend/          # Python 后端服务
├── tms-frontend/         # Vue 3 前端界面
└── TMS工具_20260518_2100.pyw  # 原始独立版本（保留）
```

## 🚀 快速开始

### 前置要求

- Node.js 16+ 和 npm
- Python 3.8+

### 安装依赖

```bash
# 1. 安装前端依赖
cd tms-frontend
npm install

# 2. 安装 Electron 应用依赖
cd ../tms-electron-app
npm install

# 3. 安装后端依赖（如果还没有）
cd ../tms-backend
pip install -r requirements.txt
```

### 开发模式运行

```bash
cd tms-electron-app
npm run dev
```

这将同时启动：
- Vue 3 前端开发服务器 (http://localhost:5173)
- Python FastAPI 后端服务 (http://localhost:8000)
- Electron 窗口

### 打包生产版本

#### Windows 版本

```bash
cd tms-electron-app
npm run build:win
```

打包后的文件将位于 `tms-electron-app/dist/` 目录，正式交付只包含安装版：
- 安装程序 (`TOS Setup x.x.x.exe`)
- 自动更新元数据 (`latest.yml`、`changelog.json`、`TOS Setup x.x.x.exe.blockmap`)
- 人工下载兜底元数据 (`manual-downloads.json`)
- 免安装备用包 (`downloads/x.x.x/TOS_vx.x.x_Windows_x64_unpacked.zip`)

不再生成或发布 `TOS_vx.x.x_Portable.exe`。自动更新仍只使用安装程序；免安装 zip 仅作为安装包被系统拦截时的人工下载兜底，不参与自动安装。

## 📦 打包注意事项

对于完整的生产打包，您需要考虑将 Python 环境一起打包。以下是两种常用方案：

### 方案 1: PyInstaller + Electron 组合打包

将 Python 后端用 PyInstaller 打包成 exe，然后与 Electron 应用一起打包。

### 方案 2: 使用 pywebview（推荐用于简化）

使用 pywebview 创建一个基于 Python 的轻量级桌面应用，省去 Electron + Node.js 的依赖。

## 🔧 配置

### 后端服务配置

后端服务配置位于 `tms-backend/main.py`，默认运行在 8000 端口。

### 前端配置

前端 API 配置位于 `tms-frontend/src/api/client.ts`。

## 📄 许可证

MIT License

## 👥 作者

DG运营部开发团队
