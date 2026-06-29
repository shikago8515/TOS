import os
import base64
import tempfile
import unittest
from datetime import datetime
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from openpyxl import load_workbook

from api import automation_storage_api
from utils import credential_crypto
from utils.credential_crypto import decrypt_secret, encrypt_secret
from utils.mysql_store import SCHEMA_DDL
from api.automation_storage_api import (
    RunFilePayload,
    RunUpdatePayload,
    _attachment_content_disposition,
    _credential_lookup_ids,
    _normalize_account_key,
    _run_file_payload,
    _store_remote_result_file,
    _template_payload,
)
from scripts.seed_automation_templates import AUTOMATION_TEMPLATES, read_template_content


class AutomationStorageTests(unittest.TestCase):
    def test_schema_contains_required_tables(self):
        schema_text = "\n".join(SCHEMA_DDL)

        self.assertIn("automation_credentials", schema_text)
        self.assertIn("excel_templates", schema_text)
        self.assertIn("automation_runs", schema_text)
        self.assertIn("automation_run_files", schema_text)

    def test_credentials_encrypt_and_decrypt_with_local_key_file(self):
        original_key_file = os.environ.get(credential_crypto.CREDENTIAL_KEY_FILE_ENV)
        original_key = os.environ.get(credential_crypto.CREDENTIAL_KEY_ENV)
        try:
            os.environ.pop(credential_crypto.CREDENTIAL_KEY_ENV, None)
            with tempfile.TemporaryDirectory() as temp_dir:
                key_file = Path(temp_dir) / "credential.key"
                os.environ[credential_crypto.CREDENTIAL_KEY_FILE_ENV] = str(key_file)

                encrypted = encrypt_secret("plain-password")

                self.assertNotEqual(encrypted, "plain-password")
                self.assertEqual(decrypt_secret(encrypted), "plain-password")
                self.assertTrue(key_file.exists())
        finally:
            restore_env(credential_crypto.CREDENTIAL_KEY_FILE_ENV, original_key_file)
            restore_env(credential_crypto.CREDENTIAL_KEY_ENV, original_key)

    def test_xinlongtai_shipping_template_is_registered_from_source_file(self):
        template = next(
            item for item in AUTOMATION_TEMPLATES
            if item["module_id"] == "xinlongtai-shipping-automation"
        )

        content = read_template_content(template)

        self.assertEqual(template["filename"], "新龙泰-shipping-自动化模板.XLS")
        self.assertGreater(len(content), 0)

    def test_wandai_shipping_template_is_registered_from_source_file(self):
        template = next(
            item for item in AUTOMATION_TEMPLATES
            if item["module_id"] == "shipping-automation"
        )

        content = read_template_content(template)

        self.assertEqual(template["filename"], "万代-shipping-自动化模板.xlsx")
        self.assertEqual(template["display_name"], "万代 Shipping 自动化 Excel 模板")
        self.assertGreater(len(content), 0)

    def test_template_download_header_supports_chinese_filename(self):
        header = _attachment_content_disposition("新龙泰-shipping-自动化模板.XLS")

        self.assertIn('filename="', header)
        self.assertIn("filename*=UTF-8''", header)
        self.assertIn("%E6%96%B0%E9%BE%99%E6%B3%B0", header)

    def test_template_download_reports_missing_minio_object(self):
        class MissingObjectError(Exception):
            code = "NoSuchKey"

        row = {
            "bucket": "tos-templates",
            "object_key": "templates/missing.xlsx",
            "original_filename": "template.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        with patch.object(automation_storage_api, "get_excel_template", return_value=row), \
             patch.object(automation_storage_api, "get_object_response", side_effect=MissingObjectError()):
            with self.assertRaises(automation_storage_api.HTTPException) as context:
                automation_storage_api.download_template(1)

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("模板文件不存在", context.exception.detail)

    def test_template_download_reports_storage_unavailable(self):
        row = {
            "bucket": "tos-templates",
            "object_key": "templates/template.xlsx",
            "original_filename": "template.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        with patch.object(automation_storage_api, "get_excel_template", return_value=row), \
             patch.object(automation_storage_api, "get_object_response", side_effect=RuntimeError("storage down")):
            with self.assertRaises(automation_storage_api.HTTPException) as context:
                automation_storage_api.download_template(1)

        self.assertEqual(context.exception.status_code, 503)
        self.assertIn("MinIO", context.exception.detail)

    def test_shipping_executor_id_can_read_shared_infor_nexus_credentials(self):
        lookup_ids = _credential_lookup_ids("shipping-automation-demo")
        released_bulk_lookup_ids = _credential_lookup_ids("shipping-automation-2")

        self.assertEqual(lookup_ids[0], "shipping-automation-demo")
        self.assertIn("shipping-automation", lookup_ids)
        self.assertIn("xinlongtai-shipping-automation", lookup_ids)
        self.assertNotIn("infornexus-auto-add", lookup_ids)
        self.assertEqual(released_bulk_lookup_ids[0], "shipping-automation-2")
        self.assertIn("shipping-automation", released_bulk_lookup_ids)
        self.assertIn("po-auto-download", released_bulk_lookup_ids)

    def test_ticket_owner_statistics_can_read_shared_microsoft_credentials(self):
        lookup_ids = _credential_lookup_ids("ticket-owner-statistics")
        microsoft_lookup_ids = _credential_lookup_ids("microsoft-login-n8n")

        self.assertEqual(lookup_ids[0], "ticket-owner-statistics")
        self.assertIn("microsoft-login-n8n", lookup_ids)
        self.assertIn("ticket-owner-statistics", microsoft_lookup_ids)

    def test_credential_account_key_is_normalized_for_saved_profiles(self):
        self.assertEqual(_normalize_account_key("  Lily  "), "Lily")
        self.assertEqual(_normalize_account_key(""), "default")
        self.assertEqual(len(_normalize_account_key("x" * 160)), 120)

    def test_create_run_continues_when_source_file_storage_is_unavailable(self):
        row = build_run_row("run-1")

        with patch.object(automation_storage_api, "create_automation_run", return_value=row), \
             patch.object(
                 automation_storage_api,
                 "_store_upload_file",
                 new=AsyncMock(side_effect=RuntimeError("storage backend detail")),
             ):
            response = run_async(automation_storage_api.create_run(
                automation_id="infornexus-auto-add",
                module_id="",
                run_name="debug",
                message="started",
                source_file=SimpleNamespace(filename="source.xlsx"),
            ))

        self.assertTrue(response["ok"])
        self.assertEqual(response["run"]["runId"], "run-1")
        self.assertEqual(response["files"], [])
        self.assertEqual(len(response["warnings"]), 1)
        self.assertNotIn("storage backend detail", response["warnings"][0])

    def test_finish_run_updates_status_when_result_file_storage_is_unavailable(self):
        existing_row = build_run_row("run-2", status="running")
        updated_row = build_run_row("run-2", status="failed", message="executor failed")
        payload = RunUpdatePayload(
            status="failed",
            message="executor failed",
            result={"ok": False, "message": "executor failed"},
            resultFiles=[],
        )

        with patch.object(automation_storage_api, "get_automation_run", return_value=existing_row), \
             patch.object(automation_storage_api, "update_automation_run", return_value=updated_row), \
             patch.object(
                 automation_storage_api,
                 "_store_result_json",
                 side_effect=RuntimeError("storage backend detail"),
             ):
            response = run_async(automation_storage_api.finish_run("run-2", payload))

        self.assertTrue(response["ok"])
        self.assertEqual(response["run"]["status"], "failed")
        self.assertEqual(response["files"], [])
        self.assertEqual(len(response["warnings"]), 1)
        self.assertNotIn("storage backend detail", response["warnings"][0])

    def test_result_file_can_be_stored_from_base64_content(self):
        payload = RunFilePayload(
            url="http://127.0.0.1:3002/artifacts/result.xlsx",
            fileName="Ticket ownership.xlsx",
            fileRole="result_excel",
            contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            contentBase64=base64.b64encode(b"excel-bytes").decode("ascii"),
        )
        inserted_row = {
            "id": 12,
            "run_id": "run-12",
            "file_role": "result_excel",
            "bucket": "tos-results",
            "object_key": "results/ticket-owner-statistics/run-12/result.xlsx",
            "original_filename": "Ticket ownership.xlsx",
            "content_type": payload.contentType,
            "file_size": len(b"excel-bytes"),
            "sha256": "c" * 64,
            "created_at": datetime(2026, 6, 29, 12, 0, 0),
        }

        with patch.object(automation_storage_api, "get_minio_bucket", return_value="tos-results"), \
             patch.object(automation_storage_api, "build_object_key", return_value=inserted_row["object_key"]), \
             patch.object(automation_storage_api, "put_object_bytes", return_value={
                 "file_size": len(b"excel-bytes"),
                 "sha256": "c" * 64,
             }) as put_object, \
             patch.object(automation_storage_api, "download_url_bytes") as download_url, \
             patch.object(automation_storage_api, "insert_automation_run_file", return_value=inserted_row):
            row = _store_remote_result_file("run-12", "ticket-owner-statistics", payload)

        self.assertEqual(row["id"], 12)
        put_object.assert_called_once()
        self.assertEqual(put_object.call_args.kwargs["content"], b"excel-bytes")
        download_url.assert_not_called()

    def test_ticket_owner_result_excel_is_built_on_server(self):
        existing_row = build_run_row("run-ticket", status="running")
        existing_row["automation_id"] = "ticket-owner-statistics"
        existing_row["module_id"] = "ticket-owner-statistics"
        updated_row = {
            **existing_row,
            "status": "success",
            "message": "done",
            "finished_at": datetime(2026, 6, 29, 12, 0, 0),
        }
        result = {
            "ok": True,
            "rows": [{
                "Case Number": "10682971",
                "Task Type": "Provide Feedback",
                "Request": "Transport Mode Change",
                "PO Number": "0902793368",
                "Working Number": "RC2606OW001",
                "Factory": "3LP001",
                "Merch": "Rosa",
            }],
        }
        payload = RunUpdatePayload(
            status="success",
            message="done",
            result=result,
            resultFiles=[RunFilePayload(
                url="http://127.0.0.1:3002/artifacts/local.xlsx",
                fileName="Ticket ownership.xlsx",
                fileRole="result_excel",
            )],
        )
        inserted_excel_row = {
            "id": 22,
            "run_id": "run-ticket",
            "file_role": "result_excel",
            "bucket": "tos-results",
            "object_key": "results/ticket-owner-statistics/run-ticket/result_excel/Ticket ownership.xlsx",
            "original_filename": "Ticket ownership.xlsx",
            "content_type": automation_storage_api.EXCEL_CONTENT_TYPE,
            "file_size": 1,
            "sha256": "d" * 64,
            "created_at": datetime(2026, 6, 29, 12, 0, 0),
        }

        with patch.object(automation_storage_api, "get_automation_run", return_value=existing_row), \
             patch.object(automation_storage_api, "update_automation_run", return_value=updated_row), \
             patch.object(automation_storage_api, "_store_result_json", return_value={
                 "id": 21,
                 "run_id": "run-ticket",
                 "file_role": "result_json",
                 "bucket": "tos-results",
                 "object_key": "results/ticket-owner-statistics/run-ticket/result.json",
                 "original_filename": "result.json",
                 "content_type": "application/json; charset=utf-8",
                 "file_size": 100,
                 "sha256": "e" * 64,
                 "created_at": datetime(2026, 6, 29, 12, 0, 0),
             }), \
             patch.object(automation_storage_api, "get_minio_bucket", return_value="tos-results"), \
             patch.object(automation_storage_api, "build_object_key", return_value=inserted_excel_row["object_key"]), \
             patch.object(automation_storage_api, "put_object_bytes", return_value={
                 "file_size": 2048,
                 "sha256": "d" * 64,
             }) as put_object, \
             patch.object(automation_storage_api, "insert_automation_run_file", return_value=inserted_excel_row), \
             patch.object(automation_storage_api, "_store_remote_result_file") as remote_store:
            response = run_async(automation_storage_api.finish_run("run-ticket", payload))

        self.assertEqual([file["file_role"] for file in response["files"]], ["result_json", "result_excel"])
        remote_store.assert_not_called()
        excel_content = put_object.call_args.kwargs["content"]
        workbook = load_workbook(BytesIO(excel_content))
        sheet = workbook["Ticket ownership"]
        self.assertEqual(sheet["A1"].value, "Case Number")
        self.assertEqual(sheet["D2"].value, "0902793368")
        self.assertEqual(sheet["A1"].fill.fgColor.rgb, "FF5B9BD5")
        self.assertEqual(sheet["A2"].fill.fgColor.rgb, "FFDDEBF7")
        self.assertEqual(sheet.auto_filter.ref, "A1:G2")
        workbook.close()

    def test_template_payload_exposes_management_fields(self):
        row = {
            "id": 7,
            "module_id": "tc-inv-automation",
            "template_key": "default",
            "display_name": "TC INV 模板",
            "original_filename": "tc-inv.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "file_size": 1200,
            "sha256": "a" * 64,
            "is_active": 0,
            "created_at": datetime(2026, 6, 26, 8, 0, 0),
            "updated_at": datetime(2026, 6, 26, 9, 0, 0),
        }

        payload = _template_payload(row)

        self.assertEqual(payload["id"], 7)
        self.assertFalse(payload["isActive"])
        self.assertEqual(payload["downloadPath"], "/api/automation/templates/7/download")
        self.assertIn("2026-06-26", payload["updatedAt"])

    def test_run_file_payload_exposes_download_path(self):
        row = {
            "id": 11,
            "run_id": "run-11",
            "file_role": "result_excel",
            "bucket": "tos-results",
            "object_key": "results/run-11/result.xlsx",
            "original_filename": "result.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "file_size": 4096,
            "sha256": "b" * 64,
            "created_at": datetime(2026, 6, 26, 10, 0, 0),
        }

        payload = _run_file_payload(row)

        self.assertEqual(payload["id"], 11)
        self.assertEqual(payload["fileRole"], "result_excel")
        self.assertEqual(payload["downloadPath"], "/api/automation/run-files/11/download")

    def test_read_templates_can_list_all_modules_for_management(self):
        rows = [
            {
                "id": 1,
                "module_id": "shipping-automation",
                "template_key": "default",
                "display_name": "万代模板",
                "original_filename": "wandai.xlsx",
                "content_type": "",
                "file_size": 1,
                "sha256": "",
                "is_active": 1,
                "created_at": None,
                "updated_at": None,
            },
            {
                "id": 2,
                "module_id": "tc-inv-automation",
                "template_key": "default",
                "display_name": "TC INV 模板",
                "original_filename": "tc-inv.xlsx",
                "content_type": "",
                "file_size": 1,
                "sha256": "",
                "is_active": 1,
                "created_at": None,
                "updated_at": None,
            },
        ]

        with patch.object(automation_storage_api, "list_excel_templates", return_value=rows) as list_templates:
            response = automation_storage_api.read_templates(moduleId=None, includeInactive=True, limit=500)

        list_templates.assert_called_once_with(None, include_inactive=True, limit=500)
        self.assertEqual(response["moduleId"], "")
        self.assertEqual([item["moduleId"] for item in response["templates"]], [
            "shipping-automation",
            "tc-inv-automation",
        ])


def restore_env(name, value):
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value


def build_run_row(run_id, status="running", message="started"):
    now = datetime(2026, 6, 24, 3, 30, 0)
    return {
        "run_id": run_id,
        "automation_id": "infornexus-auto-add",
        "module_id": "infornexus-auto-add",
        "run_name": "debug",
        "status": status,
        "message": message,
        "result_json": None,
        "started_at": now,
        "finished_at": now if status != "running" else None,
        "created_at": now,
        "updated_at": now,
    }


def run_async(awaitable):
    import asyncio

    return asyncio.run(awaitable)


if __name__ == "__main__":
    unittest.main()
