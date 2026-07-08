# TOS 服务器部署 Runbook

本文记录服务器 `~/TOS` 目录式 Docker Compose 更新流程。完整开发、Gitea、版本和发布门禁见 `docs/tos-ai-workflow.md`；本文只保留服务器实操步骤。

## 适用边界

- 服务器路径：`/home/obito_li/TOS`
- 包落地目录：`/home/obito_li/TOS/.deploy_uploads/`
- Compose 文件：`docker-compose.tos.yml`
- 后端服务：`tos-backend`，本机端口 `127.0.0.1:18000`
- 前端服务：`tos-frontend`，本机端口 `127.0.0.1:18080`
- 认证服务：`tos-authelia`，部署 TOS 前后端时不改动

服务器 `~/TOS` 不是 Git 仓库，不能在该目录使用 `git pull` 更新。默认部署方式是：本地改完后合并并推送到 Gitea `main`，服务器执行 `deploy-tos`，通过 Gitea deploy key 免密拉取代码，再在服务器本地生成标准更新包并部署到 `~/TOS`。

只有 Gitea 或服务器拉代码不可用时，才退回旧备用方案：本机从 clean commit 生成标准更新包，通过 MobaXterm SFTP 上传到 `.deploy_uploads/`，再在服务器解压并执行包内脚本。

截图中如存在 `_deploy_uploads` 或 `_source_uploads`，视为历史目录；新流程只使用 `.deploy_uploads`。

服务器部署不等于 Windows Electron 打包。只有发布桌面安装包、自动更新包或正式 Windows 客户端时，才运行 `npm run build:win`。

## 备用方案：本机准备

默认 Gitea main 部署不需要在本机生成 `.tar.gz`。只有 Gitea 或服务器拉代码不可用时，才在 Windows PowerShell 执行：

```powershell
cd D:\project\TOS-main

git status --short --branch
npm run check:changed:dry-run
npm run check:changed
npm run server:package:dry-run
npm run server:package
```

`server:package` 会：

- 要求正式打包时工作区 clean。
- 校验 `app-version.json` 与 `releaseNotes.json` 版本一致。
- 以 `VITE_BACKEND_URL=/tos/desktop-api` 构建前端。
- 生成 `release/server/tos-server-update-v<version>-<yyyyMMddHHmmss>-<gitShortSha>.tar.gz`。
- 写入包内 `deploy/manifest.json` 和 `deploy/apply-server-update.sh`。

备用上传前确认包名包含本次版本和 Git commit 短 SHA。只上传生成的 `.tar.gz`，不要上传源码目录、`node_modules`、`dist` 散文件、Dockerfile、`nginx.conf` 或 `docker-compose.tos.yml`。

服务器更新包只覆盖 `tos-backend`、`tos-frontend` 和 `app-version.json` 等 Docker Compose 部署内容，不包含 `tms-electron-app/automation-apps`、`automation-launcher`、`browser-plugins` 或 `external-apps`。桌面自动化、automation helper 或 Electron 外部应用修复需要走对应桌面发布链路。

## 备用方案：上传

把本地生成的更新包上传到：

```text
/home/obito_li/TOS/.deploy_uploads/
```

如果目录不存在，先在服务器执行：

```bash
mkdir -p ~/TOS/.deploy_uploads
```

## 备用方案：服务器更新

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
tos-desktop/installers/<version>/TOS-Desktop-Setup.<version>.exe
tos-desktop/TOS-Desktop-Payload.zip
tos-desktop/payloads/<payload-sha256>/TOS-Desktop-Payload.zip
tos-desktop-full/TOS-Desktop-Full-Setup.exe
tos-desktop-full/installers/<version>/TOS-Desktop-Full-Setup.<version>.exe
automation-helper/TOS-Automation-Helper-Setup.exe
automation-helper/installers/<version>/TOS-Automation-Helper-Setup.<version>.exe
automation-helper/TOS-Automation-Helper-Payload.zip
automation-helper/payloads/<payload-sha256>/TOS-Automation-Helper-Payload.zip
```

`tos-desktop/TOS-Desktop-Setup.exe`、`tos-desktop-full/TOS-Desktop-Full-Setup.exe` 和 `automation-helper/TOS-Automation-Helper-Setup.exe` 是兼容旧下载入口的 latest 对象；每次更新必须同时保留对应的 `<prefix>/installers/<version>/*.<version>.exe` 版本归档对象。发布自动化助手时必须先提升
`app-version.json`、`tms-electron-app/package.json`、`tms-backend/app_version.py` 的版本号，再构建和上传安装包。

不要直接替换 Docker volume 下的 `part.*` 文件。MinIO 大对象由 metadata 和分片组成，必须通过 MinIO API、`mc cp` 或后端上传辅助流程写入。

Excel 处理模块的原始上传文件会备份到 `tos-upload-backups` bucket，业务元数据统一写入 MySQL `tos_activity_files` 表。该 bucket 只作为审计追溯用途，不对前端暴露公开下载入口；服务器上应配置 180 天自动清理：

```bash
mc ilm rule add ALIAS/tos-upload-backups --expire-days 180
mc ilm rule ls ALIAS/tos-upload-backups
```

Excel 处理结果历史文件保存到 `tos-results` bucket，MySQL 索引写入 `tos_activity_files`，`file_role='result_file'`。本地后端只调用服务器归档接口 `/api/process-history/result-files`，不得直连本机 MinIO 或在前端保存服务器写入 token。服务器应为结果历史预留 180 天清理策略：

```bash
mc ilm rule add ALIAS/tos-results --expire-days 180 --prefix process-results/
mc ilm rule ls ALIAS/tos-results
```

服务器后端需要配置 `TOS_PROCESS_HISTORY_WRITE_TOKEN`，本地后端需要配置同值对应的 `TOS_PROCESS_HISTORY_ARCHIVE_TOKEN` 和服务器归档地址 `TOS_PROCESS_HISTORY_ARCHIVE_URL`。这些值只放在服务器私有环境变量、部署私有配置或本机私有启动环境中，不写入仓库。

`ALIAS` 使用服务器 MinIO client 已配置的别名，不要把 MinIO access key 或 secret key 写入仓库、命令记录或交付文档。

替换 TOS 桌面安装包时，先删除旧的 TOS desktop 对象：

```text
tos-desktop/TOS-Desktop-Setup.exe
tos-desktop/installers/*
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
https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/files/{file_id}/download
```

## 从 Gitea main 默认部署

“合并到 Gitea `main` 后，在服务器本地生成发布包并更新”是默认服务器发布流程。仍然不要把 `~/TOS` 改成 Git 仓库，保持两个目录：

```text
/home/obito_li/TOS-source   # Git 源码目录，跟踪 Gitea main
/home/obito_li/TOS          # Docker Compose 部署目录，不执行 git pull
```

服务器首次准备：

```bash
cd ~
git clone ssh://git@gitea-tos/luenthai-ai/TOS.git TOS-source
chmod +x ~/TOS-source/scripts/server/deploy-gitea-main.sh
```

服务器免密部署约定：

```text
Gitea SSH clone URL: ssh://git@172.16.48.208:222/luenthai-ai/TOS.git
SSH host alias: gitea-tos
部署 wrapper: /home/obito_li/server-scripts/deploy-tos.sh
快捷命令: deploy-tos
```

`gitea-tos` 由服务器 `~/.ssh/config` 指向 `172.16.48.208:222`，使用只读 deploy key。不要把私钥、token 或密码写入仓库、remote URL、命令历史或发布记录。

`/home/obito_li/server-scripts/deploy-tos.sh` 内容约定：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/TOS-source"
TOS_GITEA_REMOTE_URL="ssh://git@gitea-tos/luenthai-ai/TOS.git" bash scripts/server/deploy-gitea-main.sh
```

快捷命令由服务器 shell 配置提供：

```bash
alias deploy-tos="$HOME/server-scripts/deploy-tos.sh"
```

以后 Gitea 合并到 `main` 后，优先在服务器执行：

```bash
deploy-tos
```

手动排障时可展开执行：

```bash
cd ~/TOS-source
git pull --ff-only origin main
bash scripts/server/deploy-gitea-main.sh
```

脚本会执行：

- 确认 `~/TOS-source` 是 clean checkout，并通过 `git pull --ff-only origin main` 对齐 Gitea `main`；如存在未提交改动或无法 fast-forward，直接失败并要求人工处理。
- 拒绝把 `~/TOS` 当成 Git 仓库更新，避免覆盖服务器专用的 `docker-compose.tos.yml`、`authelia/`、Dockerfile 和备份目录。
- 运行服务器部署专用包检查：`npm run test:server-package`、`npm run server:package:dry-run` 和 `npm run server:package`。默认不重复运行前端 `typecheck/test` 和后端 `unittest`；需要服务器现场复核完整测试时，显式设置 `TOS_RUN_DEPLOY_TESTS=1`。
- 把生成的 `release/server/tos-server-update-*.tar.gz` 复制到 `~/TOS/.deploy_uploads/`。
- 解压更新包并调用包内 `deploy/apply-server-update.sh`，完成备份、复制、Docker 重建、启动和本地验证。Docker 构建默认复用 layer cache；需要强制干净重建时，显式设置 `TOS_DOCKER_NO_CACHE=1`。

常用环境变量：

```bash
TOS_SKIP_INSTALL=1 bash ~/TOS-source/scripts/server/deploy-gitea-main.sh
TOS_RUN_DEPLOY_TESTS=1 bash ~/TOS-source/scripts/server/deploy-gitea-main.sh
TOS_DOCKER_NO_CACHE=1 bash ~/TOS-source/scripts/server/deploy-gitea-main.sh
TOS_GITEA_REMOTE_URL=ssh://git@gitea-tos/luenthai-ai/TOS.git bash ~/TOS-source/scripts/server/deploy-gitea-main.sh
TOS_SOURCE_DIR=/home/obito_li/TOS-source TOS_DEPLOY_ROOT=/home/obito_li/TOS bash ~/TOS-source/scripts/server/deploy-gitea-main.sh
```

## 北京测试服务器手动包部署

北京测试服务器不能访问 LT 内网 Gitea，也不能从公司测试服务器稳定接收 SSH 推送。北京部署不使用一键 SSH 上传脚本，不在北京服务器 `~/TOS` 里执行 `git pull`，也不要把整仓源码覆盖到 `~/TOS`。

固定流程是：本机 PowerShell 从最新 Gitea `main` 生成标准服务器包，通过本机 `scp` 或 MobaXterm SFTP 上传到北京服务器，再在北京服务器执行包内 `deploy/apply-server-update.sh`。

本机 PowerShell 生成包：

```powershell
Set-Location D:\project\TOS-main

git status --short --branch
git fetch gitea main --prune
git merge --ff-only gitea/main

npm run test:server-package
npm run server:package:dry-run
npm run server:package

$pkg = Get-ChildItem .\release\server\tos-server-update-*.tar.gz |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$pkg.FullName
```

本机上传到北京服务器：

```powershell
scp $pkg.FullName tosadmin@218.240.184.58:/home/tosadmin/TOS/.deploy_uploads/
```

如果使用 MobaXterm，也可以在 SFTP 面板把 `$pkg.FullName` 对应的 `.tar.gz` 上传到：

```text
/home/tosadmin/TOS/.deploy_uploads/
```

北京服务器执行部署：

```bash
cd ~/TOS

PKG="$(ls -t .deploy_uploads/tos-server-update-*.tar.gz | head -n 1)"
DEPLOY_ID="$(date +%Y%m%d%H%M%S)"
WORK=".deploy_uploads/work/$DEPLOY_ID"

test -f "$PKG" || { echo "missing $PKG"; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$PKG" -C "$WORK"

PKG="$PWD/$PKG" DEPLOY_ID="$DEPLOY_ID" TOS_ROOT="$PWD" bash "$WORK/deploy/apply-server-update.sh"
```

北京部署只更新 `tms-backend`、`tms-frontend` 和 `app-version.json` 等应用内容，保留北京服务器侧 `docker-compose.tos.yml`、Dockerfile、Nginx、`authelia/` 和私有配置。

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
