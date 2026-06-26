# Server Release Record Template

## 基本信息

- 发布版本：
- Git 分支：
- Git commit：
- Gitea main 状态：
- GitCode/GitHub 同步状态（如适用）：
- 发布包：
- 包落地目录：`/home/obito_li/TOS/.deploy_uploads/`
- deployId：
- 发布时间：

## 本地验证

```powershell

```

## 服务器部署命令

```bash
cd ~/TOS-source
git pull --ff-only origin main
bash scripts/server/deploy-gitea-main.sh
```

备用上传流程：

```bash
cd ~/TOS
PKG=".deploy_uploads/<package-name>.tar.gz"
```

## 服务器验证

```bash
sudo docker compose -f docker-compose.tos.yml ps
curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```

## 结果

- 后端版本：
- 前端 HTTP 状态：
- 页面强刷验证：
- 是否需要回滚：
