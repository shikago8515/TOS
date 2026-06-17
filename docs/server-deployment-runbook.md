# TOS 服务器部署 Runbook

本文记录服务器 `~/TOS` 目录式 Docker Compose 更新流程。完整开发、GitCode、版本和发布门禁见 `docs/tos-ai-workflow.md`；本文只保留服务器实操步骤。

## 适用边界

- 服务器路径：`/home/obito_li/TOS`
- 上传目录：`/home/obito_li/TOS/.deploy_uploads/`
- Compose 文件：`docker-compose.tos.yml`
- 后端服务：`tos-backend`，本机端口 `127.0.0.1:18000`
- 前端服务：`tos-frontend`，本机端口 `127.0.0.1:18080`
- 认证服务：`tos-authelia`，部署 TOS 前后端时不改动

服务器 `~/TOS` 不是 Git 仓库，不能使用 `git pull` 更新。服务器部署方式是：本地从 GitCode CI 已通过的 clean commit 生成标准更新包，通过 MobaXterm SFTP 上传到 `.deploy_uploads/`，再在服务器解压并执行包内脚本。

截图中如存在 `_deploy_uploads` 或 `_source_uploads`，视为历史目录；新流程只使用 `.deploy_uploads`。

服务器部署不等于 Windows Electron 打包。只有发布桌面安装包、自动更新包或正式 Windows 客户端时，才运行 `npm run build:win`。

## 本机准备

在 Windows PowerShell 执行：

```powershell
cd D:\project\TOS-main

git status --short --branch
npm run check:quick
npm run server:package:dry-run
npm run server:package
```

`server:package` 会：

- 要求正式打包时工作区 clean。
- 校验 `app-version.json` 与 `releaseNotes.json` 版本一致。
- 以 `VITE_BACKEND_URL=/tos` 构建前端。
- 生成 `release/server/tos-server-update-v<version>-<yyyyMMddHHmmss>-<gitShortSha>.tar.gz`。
- 写入包内 `deploy/manifest.json` 和 `deploy/apply-server-update.sh`。

上传前确认包名包含本次版本和 Git commit 短 SHA。只上传生成的 `.tar.gz`，不要上传源码目录、`node_modules`、`dist` 散文件、Dockerfile、`nginx.conf` 或 `docker-compose.tos.yml`。

## 上传

把本地生成的更新包上传到：

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

PKG=".deploy_uploads/tos-server-update-v你的版本-你的时间戳-你的SHA.tar.gz"
DEPLOY_ID="$(date +%Y%m%d%H%M%S)"
WORK=".deploy_uploads/work/${DEPLOY_ID}"

test -f "$PKG" || { echo "找不到上传包: $PKG"; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$PKG" -C "$WORK"

PKG="$PKG" DEPLOY_ID="$DEPLOY_ID" bash "$WORK/deploy/apply-server-update.sh"
```

包内脚本会：

- 校验 `deploy/manifest.json`。
- 备份 `tms-backend`、`tms-frontend` 和 `app-version.json`。
- 覆盖前后端源码和前端 `dist`。
- 保留服务器已有 `tms-backend/Dockerfile`、`tms-frontend/Dockerfile`、`tms-frontend/nginx.conf`、`docker-compose.tos.yml` 和 `authelia/`。
- 重建并启动 `tos-backend`、`tos-frontend`。
- 验证后端和前端本机端口。
- 成功后将上传包移动到 `.deploy_uploads/applied/`。

默认备份路径：

```text
~/TOS/backups/tms-backend.<DEPLOY_ID>
~/TOS/backups/tms-frontend.<DEPLOY_ID>
~/TOS/backups/app-version.<DEPLOY_ID>.json
```

如需整目录备份，在执行包内脚本前额外执行：

```bash
FULL_STAMP=$(date +%Y%m%d%H%M%S)
cp -a ~/TOS ~/TOS.backup.full.$FULL_STAMP
```

## 验证

包内脚本会执行基础验证。发布完成后建议再次执行：

```bash
cd ~/TOS

sudo docker compose -f docker-compose.tos.yml ps
curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```

后端版本应返回当前产品版本，例如：

```json
{"message":"TMS Backend API is running","version":"0.9.8-beta.3.2","docs":"/docs"}
```

如果脚本刚重启后 `curl` 为空，等待几秒后重新执行：

```bash
curl -s http://127.0.0.1:18000/
sudo docker compose -f docker-compose.tos.yml logs --tail=120 tos-backend
```

最后打开线上页面，按 `Ctrl + F5` 强制刷新，进入“系统设置”，确认版本卡片显示当前版本。

发布记录使用 `docs/templates/server-release-record.md`。

## 桌面安装包与 MinIO

TOS 桌面安装包不放在服务器 `~/TOS` 源码目录里，而是放在 `automation-stack` 的 MinIO Docker volume 中。

服务器实际位置：

```text
MinIO compose: /home/obito_li/automation-stack/compose.yaml
MinIO container: minio
Container data path: /data
Host Docker volume: /var/lib/docker/volumes/automation-stack_minio_data/_data
TOS downloads bucket path: /var/lib/docker/volumes/automation-stack_minio_data/_data/tos-downloads
```

`tos-downloads` bucket 的安装包对象约定：

```text
tos-desktop/TOS-Desktop-Setup.exe
tos-desktop/TOS-Desktop-Payload.zip
tos-desktop/payloads/<payload-sha256>/TOS-Desktop-Payload.zip
tos-desktop-full/TOS-Desktop-Full-Setup.exe
tos-desktop-full/installers/<version>/TOS-Desktop-Full-Setup.<version>.exe
automation-helper/TOS-Automation-Helper-Setup.exe
automation-helper/installers/<version>/TOS-Automation-Helper-Setup.<version>.exe
automation-helper/TOS-Automation-Helper-Payload.zip
automation-helper/payloads/<payload-sha256>/TOS-Automation-Helper-Payload.zip
```

`automation-helper/TOS-Automation-Helper-Setup.exe` 是兼容旧下载入口的 latest 对象；每次更新必须同时保留
`automation-helper/installers/<version>/TOS-Automation-Helper-Setup.<version>.exe`。发布自动化助手时必须先提升
`app-version.json`、`tms-electron-app/package.json`、`tms-backend/app_version.py` 的版本号，再构建和上传安装包。

不要直接替换 Docker volume 下的 `part.*` 文件。MinIO 大对象由 metadata 和分片组成，必须通过 MinIO API、`mc cp` 或后端上传辅助流程写入。

替换 TOS 桌面安装包时，先删除旧的 TOS desktop 对象：

```text
tos-desktop/TOS-Desktop-Setup.exe
tos-desktop/TOS-Desktop-Payload.zip
tos-desktop/payloads/*
tos-desktop-full/TOS-Desktop-Full-Setup.exe
tos-desktop-full/installers/*
```

不要删除 `automation-helper/*`，除非本次也重新构建并验证了小助手安装包。

浏览器页面使用后端代理下载地址，不直接暴露 MinIO：

```text
https://ai.tomwell.net:56130/tos/tos-desktop/download
https://ai.tomwell.net:56130/tos/tos-desktop-full/download
https://ai.tomwell.net:56130/tos/automation-helper/download
```

## 回滚

如果重建失败或页面异常，使用本次部署记录的 `DEPLOY_ID` 回滚：

```bash
cd ~/TOS

sudo docker compose -f docker-compose.tos.yml stop tos-backend tos-frontend

mv tms-backend "tms-backend.failed.$DEPLOY_ID"
mv tms-frontend "tms-frontend.failed.$DEPLOY_ID"
mv "backups/tms-backend.$DEPLOY_ID" tms-backend
mv "backups/tms-frontend.$DEPLOY_ID" tms-frontend
if [ -f "backups/app-version.$DEPLOY_ID.json" ]; then
  cp -a "backups/app-version.$DEPLOY_ID.json" app-version.json
fi

sudo docker compose -f docker-compose.tos.yml build --no-cache tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml up -d tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml ps
```

如果执行过整目录备份，也可以在停服务后恢复 `~/TOS.backup.full.<STAMP>`，但恢复前必须确认目标路径和备份路径，避免覆盖错误目录。

回滚记录使用 `docs/templates/rollback-record.md`。
