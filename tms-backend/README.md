# tms-backend

`tms-backend` 是 TOS 当前维护的 Python FastAPI 后端源码，负责业务文件处理、自动化存储、系统配置下载和版本更新记录接口。

## Entry Point

```text
main.py
```

默认本地服务地址：

```text
http://127.0.0.1:8000
```

## Commands

```powershell
python -m unittest discover tests/ -v
python -m compileall .
```

日常工程检查优先从仓库根目录运行：

```powershell
npm run check:backend
```

## Modules

| Area | API router | Processing / storage module |
| --- | --- | --- |
| Jessca | `api/jessca_api.py` | `modules/jessca_module.py` |
| Sophia/Tina | `api/sophia_tina_api.py` | `modules/sophia_tina_module.py` |
| Jane | `api/jane_api.py` | `modules/jane_module.py` |
| Jane BOM Summary | `api/jane_bom_summary_api.py` | `modules/jane_bom_summary_module.py` |
| Jane PRODUCTION Compare | `api/jane_bom_compare_api.py` | `modules/jane_bom_compare_module.py` |
| Jane Outbound Compare | `api/jane_outbound_compare_api.py` | `modules/jane_outbound_compare_module.py` |
| Eric | `api/eric_api.py` | `modules/eric_module.py` |
| Jason PDF Reorder | `api/it_invoice_pdf_reorder_api.py` | `modules/it_invoice_pdf_reorder_module.py` |
| Draft & Packing List Compare | `api/draft_packing_compare_api.py` | `modules/draft_packing_compare_module.py` |
| TMS Finance Internal Reconciliation | `api/tms_finance_internal_reconciliation_api.py` | `modules/tms_finance_internal_reconciliation_module.py` |
| TMS Finance Work Sales | `api/tms_finance_work_sales_api.py` | `modules/tms_finance_work_sales_module.py` |
| Automation Storage | `api/automation_storage_api.py` | `utils/mysql_store.py`, `utils/minio_storage.py` |
| System Config / Downloads | `api/system_config_api.py` | `utils/settings.py`, `utils/minio_storage.py`, `utils/automation_module_manifest.py` |
| Release Updates | `api/release_updates_api.py` | `utils/mysql_store.py` |

## API Compatibility

- Automation module hot updates use `/api/system/config/automation-modules` and `/api/system/config/automation-modules/{module_id}/download`; the manifest and zip packages are stored in MinIO under the downloads bucket.
- Jason 的 canonical API prefix 是 `/api/jason/pdf-reorder/*`。
- 旧 `/api/it-invoice-pdf-reorder/*` 和 legacy `/api/preview-invoice`、`/api/preview-po`、`/api/extract-numbers`、`/api/process` 继续保留兼容。
- 系统配置下载接口包含自动化助手、TOS 轻量在线安装器、完整安装包、payload 和 PO 自动下载模板下载路径，例如 `/api/system/config/tos-desktop/download`、`/api/system/config/tos-desktop-full/download` 与 `/api/system/config/po-auto-download/template/download`。
- `/api/release-updates` 提供版本更新记录读取和部署同步写入；服务器 MySQL 是主源，本地默认 seed `data/release_updates_seed.json` 需要通过 `npm run release:updates:pull` 与 `tms-frontend/src/shared/version/releaseHistory.json` 保持一致。
- 自动化凭据接口 `/api/automation/credentials/{automation_id}` 负责保存 Infor Nexus 等登录凭据；`po-auto-download/default` 使用同一张 `tos_login_accounts` 表，前端只回显账号，执行时通过 resolve 接口取加密密码。

## Engineering Notes

- 保持现有 FastAPI path、method、form field、下载 URL 和 JSON 字段兼容，除非任务明确要求 breaking change。
- Jason 模块已先行补充 Pydantic response models；其他高频模块按工程化路线图逐步 schema 化。
- 文件上传和下载路径必须继续使用现有 basename、扩展名和目录边界校验工具，避免路径遍历。
- CORS 默认只允许本地前端来源 `http://127.0.0.1:5174` 和 `http://localhost:5174`；服务器或特殊部署通过 `TMS_CORS_ALLOW_ORIGINS` 显式配置允许来源。不要恢复 `allow_origins=["*"]` + `allow_credentials=True`。

## Code Standards

- 新增 Python 函数必须写参数和返回值类型提示；复杂返回结构优先使用已有 Pydantic schema、dataclass 或明确的 typed dict 形状，不用裸 `dict` 掩盖契约。
- API 层负责上传、下载、参数校验和响应封装；Excel/PDF 业务处理逻辑放在 `modules/`，公共存储、配置和历史结果能力放在 `utils/`。
- 不新增 `HTTPException(status_code=500, detail=str(e))` 这类内部异常直出。用户可见错误使用脱敏文案，内部细节写入项目已有日志、诊断字段或受控调试输出。
- 上传文件名、下载文件名、模板对象 key、临时路径和输出路径必须做 basename、扩展名和目录边界校验；不得信任前端传入的路径片段。
- 资源管理优先使用 `with`、临时目录上下文、显式关闭或项目已有 helper；处理 workbook、PDF、网络连接和临时文件时不得遗留句柄。
- 新增或修改 schema 时保持旧字段兼容，除非任务明确要求 breaking change；兼容字段删除前必须确认历史 Electron 包、前端页面和服务器部署无调用。
- 模块测试优先选择对应 `tests.test_xxx`、class 或 method；涉及导入边界、动态加载或跨模块工具时再补 `python -m compileall .`。
