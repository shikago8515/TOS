import asyncio
import importlib
import importlib.util
import inspect
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

from utils.file_utils import copy_upload_to_path
from utils import minio_storage, mysql_store


class FakeUpload:
    def __init__(
        self,
        filename: str,
        content: bytes = b"excel-bytes",
        content_type: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) -> None:
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


class ExcelUploadBackupTests(unittest.TestCase):
    def test_minio_storage_can_upload_file_path_with_checksum(self) -> None:
        self.assertTrue(hasattr(minio_storage, "put_object_file"))

    def test_mysql_schema_contains_excel_upload_backups_metadata_table(self) -> None:
        schema_text = "\n".join(mysql_store.SCHEMA_DDL)

        self.assertIn("CREATE TABLE IF NOT EXISTS excel_upload_backups", schema_text)
        self.assertIn("request_id VARCHAR(96) NOT NULL", schema_text)
        self.assertIn("module_id VARCHAR(128) NOT NULL", schema_text)
        self.assertIn("file_role VARCHAR(64) NOT NULL", schema_text)
        self.assertIn("sha256 CHAR(64) NOT NULL", schema_text)

    def test_example_settings_declares_upload_backup_bucket(self) -> None:
        settings_path = Path(__file__).resolve().parents[1] / "config" / "settings.example.yaml"
        settings = yaml.safe_load(settings_path.read_text(encoding="utf-8"))
        buckets = settings["storage"]["minio"]["buckets"]

        self.assertIn("upload_backups", buckets)
        self.assertEqual(
            buckets["upload_backups"],
            "tos-upload-backups",
        )

    def test_upload_backup_bucket_fallback_uses_minio_safe_name(self) -> None:
        with patch.object(minio_storage, "get_settings", return_value={"storage": {"minio": {"buckets": {}}}}):
            bucket = minio_storage.get_minio_bucket("upload_backups")

        self.assertEqual(bucket, "tos-upload-backups")

    def test_backup_service_stores_file_and_records_metadata(self) -> None:
        backup = self._load_backup_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "invoice.xlsx"
            source_path.write_bytes(b"original excel")
            context = backup.ExcelUploadBackupContext(
                module_id="jessca",
                request_id="req-1",
                file_role="invoice",
                original_filename="invoice.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            storage_record = {
                "bucket": "tos-upload-backups",
                "object_key": "upload-backups/jessca/20260629010101000000-invoice.xlsx",
                "file_size": len(b"original excel"),
                "sha256": "a" * 64,
            }

            with patch.object(backup, "get_minio_bucket", return_value="tos-upload-backups"), \
                 patch.object(backup, "put_object_file", return_value=storage_record) as put_object_file, \
                 patch.object(backup, "insert_excel_upload_backup", return_value={"id": 1}) as insert_backup:
                record = backup.store_excel_upload_backup(source_path, context)

        put_kwargs = put_object_file.call_args.kwargs
        self.assertEqual(put_kwargs["bucket"], "tos-upload-backups")
        self.assertRegex(
            put_kwargs["object_key"],
            r"^upload-backups/jessca/\d{4}/\d{2}/\d{2}/req-1/invoice/\d{20}-invoice\.xlsx$",
        )
        metadata = insert_backup.call_args.args[0]
        self.assertEqual(metadata["request_id"], "req-1")
        self.assertEqual(metadata["module_id"], "jessca")
        self.assertEqual(metadata["file_role"], "invoice")
        self.assertEqual(metadata["original_filename"], "invoice.xlsx")
        self.assertEqual(metadata["bucket"], storage_record["bucket"])
        self.assertEqual(metadata["sha256"], storage_record["sha256"])
        self.assertEqual(record, {"id": 1})

    def test_copy_upload_to_path_accepts_backup_context_without_blocking_processing(self) -> None:
        parameters = inspect.signature(copy_upload_to_path).parameters
        self.assertIn("backup_context", parameters)
        backup = self._load_backup_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            target_path = Path(temp_dir) / "source.xlsx"
            context = backup.ExcelUploadBackupContext(
                module_id="jane",
                request_id="req-2",
                file_role="tms",
                original_filename="source.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            with patch(
                "utils.file_utils.store_excel_upload_backup",
                side_effect=RuntimeError("storage backend detail"),
            ) as store_backup, \
                patch("utils.file_utils.logger.warning") as log_warning:
                copy_upload_to_path(
                    FakeUpload("source.xlsx", b"source bytes"),
                    str(target_path),
                    backup_context=context,
                )

            self.assertEqual(target_path.read_bytes(), b"source bytes")
            store_backup.assert_called_once_with(str(target_path), context)
            log_warning.assert_called_once()

    def test_jessca_save_uploads_tags_excel_files_for_backup(self) -> None:
        backup = self._load_backup_module()
        from api import jessca_api

        self.assertIn("request_id", inspect.signature(jessca_api._save_uploads).parameters)
        with tempfile.TemporaryDirectory() as temp_dir, \
             patch.object(jessca_api, "copy_upload_to_path") as copy_upload:
            jessca_api._save_uploads(
                [FakeUpload("invoice-a.xlsx"), FakeUpload("invoice-b.xls")],
                temp_dir,
                "invoice",
                request_id="req-3",
                file_role="invoice",
            )

        contexts = [call.kwargs["backup_context"] for call in copy_upload.call_args_list]
        self.assertEqual([context.module_id for context in contexts], ["jessca", "jessca"])
        self.assertEqual([context.request_id for context in contexts], ["req-3", "req-3"])
        self.assertEqual([context.file_role for context in contexts], ["invoice", "invoice"])
        self.assertIsInstance(contexts[0], backup.ExcelUploadBackupContext)

    def test_jane_process_tags_each_excel_upload_for_backup(self) -> None:
        backup = self._load_backup_module()
        from api import jane_api

        with patch.object(jane_api, "copy_upload_to_path") as copy_upload, \
             patch.object(jane_api.jane_module, "process_reports", return_value={
                 "success": False,
                 "message": "stopped after upload",
                 "logs": [],
             }):
            run_async(jane_api.process_jane(
                FakeUpload("tms.xlsx"),
                FakeUpload("country.xlsx"),
                working_filters=None,
                output_dir=None,
            ))

        contexts = [call.kwargs["backup_context"] for call in copy_upload.call_args_list]
        self.assertEqual([context.module_id for context in contexts], ["jane", "jane"])
        self.assertEqual([context.file_role for context in contexts], ["tms", "country"])
        self.assertIsInstance(contexts[0], backup.ExcelUploadBackupContext)

    def test_iplex_inspect_tags_excel_upload_for_backup(self) -> None:
        backup = self._load_backup_module()
        from api import iplex_dual_table_compare_api

        with patch.object(iplex_dual_table_compare_api, "copy_upload_to_path") as copy_upload, \
             patch.object(
                 iplex_dual_table_compare_api.iplex_dual_table_compare_module,
                 "inspect_workbook",
                 return_value={"sheets": []},
             ):
            run_async(iplex_dual_table_compare_api.inspect_iplex_workbook(FakeUpload("main.xlsx")))

        context = copy_upload.call_args.kwargs["backup_context"]
        self.assertEqual(context.module_id, "iplex-dual-table-compare")
        self.assertEqual(context.file_role, "inspect_excel")
        self.assertIsInstance(context, backup.ExcelUploadBackupContext)

    def _load_backup_module(self):
        spec = importlib.util.find_spec("utils.excel_upload_backup")
        if spec is None:
            self.fail("utils.excel_upload_backup module is required")
        return importlib.import_module("utils.excel_upload_backup")


def run_async(awaitable):
    return asyncio.run(awaitable)


if __name__ == "__main__":
    unittest.main()
