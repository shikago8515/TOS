import importlib
import importlib.util
import asyncio
import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


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


class ExcelResultHistoryTests(unittest.TestCase):
    def test_normalizes_legacy_catalog_module_ids_to_history_module_ids(self) -> None:
        history = self._load_history_module()
        cases = {
            "jessca": "excel-jessca",
            "draft-packing-compare": "pdf-draft-packing-compare",
            "jane": "excel-jane",
            "jane-bom-compare": "excel-jane-bom-compare",
            "jane-bom-summary": "excel-jane-bom-summary",
            "jane-outbound-compare": "excel-jane-outbound-compare",
            "sophia-tina": "excel-sophia-tina",
            "tms-finance-internal-reconciliation": "excel-tms-finance-internal-reconciliation",
            "tms-finance-work-sales": "excel-tms-finance-work-sales",
            "jason-result-set-excel": "jason-result-set-excel",
            "eric": "eric",
            "iplex-dual-table-compare": "iplex-dual-table-compare",
            "excel-template-mapper-test": "excel-template-mapper-test",
        }

        for module_id, expected_history_id in cases.items():
            with self.subTest(module_id=module_id):
                self.assertEqual(
                    history.normalize_process_history_module_id(module_id),
                    expected_history_id,
                )

    def test_result_history_service_stores_file_and_records_download_metadata(self) -> None:
        history = self._load_history_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "result.xlsx"
            source_path.write_bytes(b"result workbook")
            context = history.ExcelResultHistoryContext(
                module_id="jessca",
                request_id="req-1",
                original_filename="../result.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            storage_record = {
                "bucket": "tos-results",
                "object_key": "process-results/excel-jessca/2026/06/30/req-1/result_file/20260630010101000000-result.xlsx",
                "file_size": len(b"result workbook"),
                "sha256": "b" * 64,
            }
            db_record = {
                "id": 42,
                "activity_id": "req-1",
                "file_role": "result_file",
                "bucket": "tos-results",
                "object_key": storage_record["object_key"],
                "original_filename": "result.xlsx",
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "file_size": storage_record["file_size"],
                "sha256": storage_record["sha256"],
            }

            with patch.object(history, "get_minio_bucket", return_value="tos-results"), \
                 patch.object(history, "put_object_file", return_value=storage_record) as put_object_file, \
                 patch.object(history, "upsert_process_history_record") as upsert_history, \
                 patch.object(history, "insert_process_result_file", return_value=db_record) as insert_file:
                record = history.store_excel_result_history(source_path, context)

        put_kwargs = put_object_file.call_args.kwargs
        self.assertEqual(put_kwargs["bucket"], "tos-results")
        self.assertRegex(
            put_kwargs["object_key"],
            r"^process-results/excel-jessca/\d{4}/\d{2}/\d{2}/req-1/result_file/\d{20}-result\.xlsx$",
        )
        history_record = upsert_history.call_args.args[0]
        self.assertEqual(history_record["record_id"], "req-1")
        self.assertEqual(history_record["module_id"], "excel-jessca")
        self.assertEqual(history_record["output_file"], "result.xlsx")
        self.assertEqual(history_record["source_system"], "backend.result-history")
        metadata = insert_file.call_args.args[0]
        self.assertEqual(metadata["request_id"], "req-1")
        self.assertEqual(metadata["module_id"], "excel-jessca")
        self.assertEqual(metadata["file_role"], "result_file")
        self.assertEqual(metadata["original_filename"], "result.xlsx")
        self.assertEqual(metadata["bucket"], "tos-results")
        self.assertEqual(record["resultFileId"], 42)
        self.assertEqual(record["resultDownloadPath"], "/api/process-history/files/42/download")
        self.assertEqual(record["fileSize"], storage_record["file_size"])
        self.assertEqual(record["sha256"], storage_record["sha256"])

    def test_archive_helper_returns_warning_without_using_local_minio_when_remote_is_not_configured(self) -> None:
        history = self._load_history_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "result.xlsx"
            source_path.write_bytes(b"result workbook")
            with patch.dict(os.environ, {}, clear=True), \
                 patch.object(history, "store_excel_result_history") as store_history:
                result = history.archive_excel_result_history(
                    file_path=source_path,
                    module_id="jane",
                    request_id="req-2",
                    original_filename="result.xlsx",
                )

        self.assertEqual(result["historyWarnings"], [history.RESULT_HISTORY_WARNING])
        self.assertNotIn("resultFileId", result)
        store_history.assert_not_called()

    def test_archive_helper_stores_result_locally_when_server_write_token_is_configured(self) -> None:
        history = self._load_history_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "server-result.xlsx"
            source_path.write_bytes(b"result workbook")
            archive_payload = {
                "resultFileId": 96,
                "resultDownloadPath": "/api/process-history/files/96/download",
                "historyWarnings": [],
            }

            with patch.dict(os.environ, {"TOS_PROCESS_HISTORY_WRITE_TOKEN": "server-token"}, clear=True), \
                 patch.object(history, "store_excel_result_history", return_value=archive_payload) as store_history:
                result = history.archive_excel_result_history(
                    file_path=source_path,
                    module_id="jessca",
                    request_id="req-server-1",
                    original_filename="../server-result.xlsx",
                )

        store_history.assert_called_once()
        context = store_history.call_args.args[1]
        self.assertEqual(context.module_id, "excel-jessca")
        self.assertEqual(context.request_id, "req-server-1")
        self.assertEqual(context.original_filename, "server-result.xlsx")
        self.assertEqual(result["resultFileId"], 96)
        self.assertEqual(result["resultDownloadPath"], "/api/process-history/files/96/download")

    def test_archive_helper_posts_result_file_to_remote_archive_api(self) -> None:
        history = self._load_history_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / "remote-result.xlsx"
            source_path.write_bytes(b"result workbook")
            remote_response = FakeHttpResponse({
                "history_id": "req-remote-1",
                "result_file_id": 84,
                "result_download_path": "/api/process-history/files/84/download",
                "result_download_backend_target": "remote",
                "result_file": {
                    "id": 84,
                    "filename": "remote-result.xlsx",
                    "downloadPath": "/api/process-history/files/84/download",
                },
                "history_warnings": [],
            })

            with patch.dict(os.environ, {
                "TOS_PROCESS_HISTORY_ARCHIVE_URL": "https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/result-files",
                "TOS_PROCESS_HISTORY_ARCHIVE_TOKEN": "archive-token",
            }, clear=True), patch.object(history.httpx, "post", return_value=remote_response) as post:
                result = history.archive_excel_result_history(
                    file_path=source_path,
                    module_id="jane-bom-summary",
                    request_id="req-remote-1",
                    original_filename="../remote-result.xlsx",
                )

        post.assert_called_once()
        post_kwargs = post.call_args.kwargs
        self.assertEqual(post.call_args.args[0], "https://ai.tomwell.net:56130/tos/desktop-api/api/process-history/result-files")
        self.assertEqual(post_kwargs["headers"]["X-TOS-History-Write-Token"], "archive-token")
        self.assertEqual(post_kwargs["data"]["moduleId"], "excel-jane-bom-summary")
        self.assertEqual(post_kwargs["data"]["requestId"], "req-remote-1")
        self.assertEqual(post_kwargs["data"]["originalFilename"], "remote-result.xlsx")
        self.assertEqual(result["resultFileId"], 84)
        self.assertEqual(result["resultDownloadBackendTarget"], "remote")

    def test_jane_process_response_includes_history_download_metadata(self) -> None:
        from api import jane_api

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "jane-result.xlsx"
            output_path.write_bytes(b"result workbook")
            archive_payload = {
                "resultFileId": 42,
                "resultDownloadPath": "/api/process-history/files/42/download",
                "resultFile": {
                    "id": 42,
                    "filename": "jane-result.xlsx",
                    "downloadPath": "/api/process-history/files/42/download",
                },
                "historyWarnings": [],
            }

            with patch.object(jane_api, "copy_upload_to_path"), \
                 patch.object(jane_api.jane_module, "process_reports", return_value={
                     "success": True,
                     "message": "completed",
                     "logs": [],
                     "working_count": 1,
                     "output_path": str(output_path),
                 }), \
                 patch.object(jane_api, "archive_excel_result_history", return_value=archive_payload) as archive_history:
                response = asyncio.run(jane_api.process_jane(
                    FakeUpload("tms.xlsx"),
                    FakeUpload("country.xlsx"),
                    working_filters=None,
                    output_dir=None,
                ))

        self.assertTrue(response["success"])
        self.assertEqual(response["history_id"], response["request_id"])
        self.assertEqual(response["result_file_id"], 42)
        self.assertEqual(response["result_download_path"], "/api/process-history/files/42/download")
        self.assertEqual(response["result_download_backend_target"], "remote")
        self.assertEqual(response["history_warnings"], [])
        self.assertEqual(archive_history.call_args.kwargs["module_id"], "jane")

    def test_jane_process_response_includes_archive_warning_without_remote_archive_config(self) -> None:
        from api import jane_api
        history = self._load_history_module()

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "jane-result.xlsx"
            output_path.write_bytes(b"result workbook")

            with patch.dict(os.environ, {}, clear=True), \
                 patch.object(jane_api, "copy_upload_to_path"), \
                 patch.object(jane_api.jane_module, "process_reports", return_value={
                     "success": True,
                     "message": "completed",
                     "logs": [],
                     "working_count": 1,
                     "output_path": str(output_path),
                 }):
                response = asyncio.run(jane_api.process_jane(
                    FakeUpload("tms.xlsx"),
                    FakeUpload("country.xlsx"),
                    working_filters=None,
                    output_dir=None,
                ))

        self.assertTrue(response["success"])
        self.assertEqual(response["output_file"], "jane-result.xlsx")
        self.assertEqual(response["history_id"], response["request_id"])
        self.assertEqual(response["history_warnings"], [history.RESULT_HISTORY_WARNING])
        self.assertEqual(response["result_download_path"], "")
        self.assertEqual(response["result_download_backend_target"], "")
        self.assertIsNone(response["result_file_id"])

    def _load_history_module(self):
        spec = importlib.util.find_spec("utils.excel_result_history")
        if spec is None:
            self.fail("utils.excel_result_history module is required")
        return importlib.import_module("utils.excel_result_history")


class FakeHttpResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


if __name__ == "__main__":
    unittest.main()
