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
| Jane BOM Compare | `api/jane_bom_compare_api.py` | `modules/jane_bom_compare_module.py` |
| Jane Outbound Compare | `api/jane_outbound_compare_api.py` | `modules/jane_outbound_compare_module.py` |
| Eric | `api/eric_api.py` | `modules/eric_module.py` |
| Jason PDF Reorder | `api/it_invoice_pdf_reorder_api.py` | `modules/it_invoice_pdf_reorder_module.py` |
| Draft & Packing List Compare | `api/draft_packing_compare_api.py` | `modules/draft_packing_compare_module.py` |
| TMS Finance Internal Reconciliation | `api/tms_finance_internal_reconciliation_api.py` | `modules/tms_finance_internal_reconciliation_module.py` |
| TMS Finance Work Sales | `api/tms_finance_work_sales_api.py` | `modules/tms_finance_work_sales_module.py` |
| Automation Storage | `api/automation_storage_api.py` | `utils/mysql_store.py`, `utils/minio_storage.py` |
| System Config / Downloads | `api/system_config_api.py` | `utils/settings.py`, `utils/minio_storage.py` |
| Release Updates | `api/release_updates_api.py` | `utils/mysql_store.py` |

## API Compatibility

- Jason 的 canonical API prefix 是 `/api/jason/pdf-reorder/*`。
- 旧 `/api/it-invoice-pdf-reorder/*` 和 legacy `/api/preview-invoice`、`/api/preview-po`、`/api/extract-numbers`、`/api/process` 继续保留兼容。
- 系统配置下载接口包含自动化助手、TOS 轻量在线安装器、完整安装包、payload 和 PO 自动下载模板下载路径，例如 `/api/system/config/tos-desktop/download`、`/api/system/config/tos-desktop-full/download` 与 `/api/system/config/po-auto-download/template/download`。
- `/api/release-updates` 提供版本更新记录读取和部署同步写入，默认 seed 需要与 `tms-frontend/src/shared/version/releaseHistory.json` 保持一致。
- 自动化凭据接口 `/api/automation/credentials/{automation_id}` 负责保存 Infor Nexus 等登录凭据；`po-auto-download/default` 使用同一张 `automation_credentials` 表，前端只回显账号，执行时通过 resolve 接口取加密密码。

## Engineering Notes

- 保持现有 FastAPI path、method、form field、下载 URL 和 JSON 字段兼容，除非任务明确要求 breaking change。
- Jason 模块已先行补充 Pydantic response models；其他高频模块按工程化路线图逐步 schema 化。
- 文件上传和下载路径必须继续使用现有 basename、扩展名和目录边界校验工具，避免路径遍历。
- `allow_origins=["*"]` + `allow_credentials=True` 仍是已知本地场景风险；收紧 CORS 时必须单独评估 Electron 和浏览器模式影响。
