# Rollback Record Template

## 回滚原因

- 

## 回滚目标

- deployId：
- 后端备份：
- 前端备份：
- app-version 备份：

## 回滚命令

```bash
cd ~/TOS
sudo docker compose -f docker-compose.tos.yml stop tos-backend tos-frontend
mv tms-backend "tms-backend.failed.$DEPLOY_ID"
mv tms-frontend "tms-frontend.failed.$DEPLOY_ID"
mv "backups/tms-backend.$DEPLOY_ID" tms-backend
mv "backups/tms-frontend.$DEPLOY_ID" tms-frontend
if [ -f "backups/app-version.$DEPLOY_ID.json" ]; then cp -a "backups/app-version.$DEPLOY_ID.json" app-version.json; fi
sudo docker compose -f docker-compose.tos.yml build --no-cache tos-backend tos-frontend
sudo docker compose -f docker-compose.tos.yml up -d tos-backend tos-frontend
```

## 回滚后验证

```bash
sudo docker compose -f docker-compose.tos.yml ps
curl -s http://127.0.0.1:18000/
curl -I http://127.0.0.1:18080/
```

## 后续修复项

- 

