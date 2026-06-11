# TOS 服务器部署 Runbook

本文记录服务器 `~/TOS` 目录式 Docker Compose 更新流程。适用于当前服务器部署形态：服务器目录不是 Git 仓库，前后端镜像从服务器本地 `tms-backend/` 和 `tms-frontend/` 构建。

## 适用边界

- 服务器路径：`/home/obito_li/TOS`
- Compose 文件：`docker-compose.tos.yml`
- 后端服务：`tos-backend`，本机端口 `127.0.0.1:18000`
- 前端服务：`tos-frontend`，本机端口 `127.0.0.1:18080`
- 认证服务：`tos-authelia`，部署 TOS 前后端时不改动

服务器 `~/TOS` 不是 Git 仓库，不能使用 `git pull` 更新。更新方式是：本机生成更新包，通过 MobaXterm SFTP 上传到服务器，再在服务器备份旧目录、覆盖源码、重建并重启 Docker Compose 服务。

服务器部署不等于 Windows Electron 打包。只有发布桌面安装包、自动更新包或正式 Windows 客户端时，才运行 `npm run build:win`。

## 本机准备

在 Windows PowerShell 执行：

```powershell
cd D:\project\TOS-main

git status --short --branch

# 如果本次部署包含新业务改动，部署前先更新产品版本。
# 普通递增使用：
npm run version:bump
# 如果需要指定版本，使用：
# npm run version:set -- 0.9.8-beta.3.0

npm run check:quick

$env:VITE_BACKEND_URL="/tos"
npm --prefix tms-frontend run build
Remove-Item Env:\VITE_BACKEND_URL

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$pkg = "$env:TEMP\tos-update-$stamp.tar.gz"

tar -czf $pkg `
  app-version.json `
  tms-backend/app_version.py `
  tms-backend/main.py `
  tms-backend/backend_launcher.py `
  tms-backend/requirements.txt `
  tms-backend/api `
  tms-backend/modules `
  tms-backend/templates `
  tms-backend/utils `
  tms-frontend/index.html `
  tms-frontend/package.json `
  tms-frontend/package-lock.json `
  tms-frontend/tsconfig.json `
  tms-frontend/tsconfig.node.json `
  tms-frontend/vite.config.ts `
  tms-frontend/src `
  tms-frontend/dist

Write-Host $pkg
```

上传前确认包内不包含 `node_modules`、`.git`、`__pycache__`、`.pyc`、运行数据、Dockerfile、`nginx.conf` 或 `docker-compose.tos.yml`。

把输出的 `tos-update-*.tar.gz` 通过 MobaXterm 左侧 SFTP 上传到：

```text
/home/obito_li/TOS/.deploy_uploads/
```

如果目录不存在，先在服务器执行：

```bash
mkdir -p ~/TOS/.deploy_uploads
```

## 服务器更新

在服务器终端执行，替换 `PKG` 为实际上传文件名：

```bash
cd ~/TOS

PKG=".deploy_uploads/tos-update-你的时间戳.tar.gz"
STAMP=$(date +%Y%m%d%H%M%S)

test -f "$PKG" || { echo "找不到上传包: $PKG"; exit 1; }

mkdir -p backups ".deploy_uploads/extract-$STAMP"

cp -a tms-backend "backups/tms-backend.$STAMP"
cp -a tms-frontend "backups/tms-frontend.$STAMP"

tar -xzf "$PKG" -C ".deploy_uploads/extract-$STAMP"
SRC=".deploy_uploads/extract-$STAMP"

rm -rf tms-backend/api tms-backend/modules tms-backend/templates tms-backend/utils
cp -a "$SRC/tms-backend/api" tms-backend/
cp -a "$SRC/tms-backend/modules" tms-backend/
cp -a "$SRC/tms-backend/templates" tms-backend/
cp -a "$SRC/tms-backend/utils" tms-backend/
cp -a "$SRC/tms-backend/app_version.py" tms-backend/
cp -a "$SRC/tms-backend/main.py" tms-backend/
cp -a "$SRC/tms-backend/backend_launcher.py" tms-backend/
cp -a "$SRC/tms-backend/requirements.txt" tms-backend/

rm -rf tms-frontend/src tms-frontend/dist
cp -a "$SRC/tms-frontend/src" tms-frontend/
cp -a "$SRC/tms-frontend/dist" tms-frontend/
cp -a "$SRC/tms-frontend/index.html" tms-frontend/
cp -a "$SRC/tms-frontend/package.json" tms-frontend/
cp -a "$SRC/tms-frontend/package-lock.json" tms-frontend/
cp -a "$SRC/tms-frontend/tsconfig.json" tms-frontend/
cp -a "$SRC/tms-frontend/tsconfig.node.json" tms-frontend/
cp -a "$SRC/tms-frontend/vite.config.ts" tms-frontend/
cp -a "$SRC/app-version.json" ./
```

本流程保留服务器已有 `tms-backend/Dockerfile`、`tms-frontend/Dockerfile`、`tms-frontend/nginx.conf`、`docker-compose.tos.yml` 和 `authelia/`。

默认备份是局部备份：

```text
~/TOS/backups/tms-backend.<STAMP>
~/TOS/backups/tms-frontend.<STAMP>
```

如需整目录备份，在覆盖前额外执行：

```bash
FULL_STAMP=$(date +%Y%m%d%H%M%S)
cp -a ~/TOS ~/TOS.backup.full.$FULL_STAMP
```

## 重建和验证

服务器当前用户可能没有直接访问 Docker socket 的权限，使用 `sudo docker compose`：

```bash
cd ~/TOS

sudo docker compose -f docker-compose.tos.yml build --no-cache tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml up -d tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml ps

curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```

后端版本应返回当前产品版本，例如：

```json
{"message":"TMS Backend API is running","version":"0.9.8-beta.3.0","docs":"/docs"}
```

如果脚本刚重启后 `curl` 为空，等待几秒后重新执行：

```bash
curl -s http://127.0.0.1:18000/
sudo docker compose -f docker-compose.tos.yml logs --tail=120 tos-backend
```

最后打开线上页面，按 `Ctrl + F5` 强制刷新，进入“系统设置”，确认版本卡片显示当前版本。

## 回滚

如果重建失败或页面异常，使用本次部署时记录的 `STAMP` 回滚：

```bash
cd ~/TOS

sudo docker compose -f docker-compose.tos.yml stop tos-backend tos-frontend

mv tms-backend "tms-backend.failed.$STAMP"
mv tms-frontend "tms-frontend.failed.$STAMP"
mv "backups/tms-backend.$STAMP" tms-backend
mv "backups/tms-frontend.$STAMP" tms-frontend

sudo docker compose -f docker-compose.tos.yml build --no-cache tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml up -d tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml ps
```

如果执行过整目录备份，也可以在停服务后恢复 `~/TOS.backup.full.<STAMP>`，但恢复前必须确认目标路径和备份路径，避免覆盖错误目录。
