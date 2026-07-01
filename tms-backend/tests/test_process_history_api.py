import os
import unittest
from datetime import datetime
from unittest.mock import patch

from api import process_history_api
from api.process_history_api import ProcessHistoryPayload
from utils import mysql_store


class ProcessHistoryApiTests(unittest.TestCase):
    def test_save_process_history_record_persists_frontend_payload(self):
        row = build_history_row()
        payload = ProcessHistoryPayload(
            id="jessca-20260630010203",
            moduleId="jessca",
            moduleName="Jessica Invoice",
            status="success",
            durationMs=1234,
            message="completed",
            inputFiles=["invoice.xlsx", "packing.xlsx"],
            outputFile="D:/outputs/result.xlsx",
            summary=[{"label": "Rows", "value": "18"}],
            createdAt="2026-06-30T01:02:03.000Z",
        )

        with patch.object(
            process_history_api,
            "upsert_process_history_record",
            return_value=row,
        ) as upsert:
            response = process_history_api.save_process_history_record(payload)

        saved_record = upsert.call_args.args[0]
        self.assertEqual(saved_record["record_id"], "jessca-20260630010203")
        self.assertEqual(saved_record["module_id"], "jessca")
        self.assertEqual(saved_record["duration_ms"], 1234)
        self.assertEqual(saved_record["input_files"], ["invoice.xlsx", "packing.xlsx"])
        self.assertEqual(saved_record["summary"], [{"label": "Rows", "value": "18"}])
        self.assertEqual(saved_record["created_at"], datetime(2026, 6, 30, 1, 2, 3))
        self.assertTrue(response["ok"])
        self.assertEqual(response["record"]["id"], row["record_id"])
        self.assertEqual(response["record"]["inputFiles"], ["invoice.xlsx"])
        self.assertEqual(response["record"]["summary"][0]["label"], "Rows")
        self.assertEqual(response["record"]["createdAt"], "2026-06-30T01:02:03Z")
        self.assertEqual(response["record"]["resultFile"]["id"], 42)
        self.assertEqual(
            response["record"]["resultDownloadPath"],
            "/api/process-history/files/42/download",
        )

    def test_read_process_history_records_filters_by_module_ids(self):
        rows = [build_history_row()]
        with patch.object(
            process_history_api,
            "count_process_history_records",
            return_value=1,
        ) as count_records, patch.object(
            process_history_api,
            "list_process_history_records",
            return_value=rows,
        ) as list_records:
            response = process_history_api.read_process_history_records(
                moduleIds="jessca,jane",
                status="success",
                limit=80,
                page=1,
            )

        count_records.assert_called_once_with(["jessca", "jane"], status="success")
        list_records.assert_called_once_with(
            ["jessca", "jane"],
            status="success",
            limit=80,
            offset=0,
        )
        self.assertEqual(response["pagination"]["total"], 1)
        self.assertEqual(response["records"][0]["moduleId"], "jessca")
        self.assertEqual(response["records"][0]["resultFile"]["filename"], "result.xlsx")

    def test_read_process_history_records_filters_by_person_date_and_downloadable_results(self):
        rows = [build_history_row({"person_id": "jane"})]
        with patch.object(
            process_history_api,
            "count_process_history_records",
            return_value=1,
        ) as count_records, patch.object(
            process_history_api,
            "list_process_history_records",
            return_value=rows,
        ) as list_records:
            response = process_history_api.read_process_history_records(
                personId="jane",
                createdFrom="2026-06-01T00:00:00Z",
                createdTo="2026-07-01T00:00:00Z",
                downloadableOnly=True,
                status="success",
                limit=25,
                page=2,
            )

        created_from = datetime(2026, 6, 1, 0, 0, 0)
        created_to = datetime(2026, 7, 1, 0, 0, 0)
        count_records.assert_called_once_with(
            [],
            status="success",
            person_id="jane",
            created_from=created_from,
            created_to=created_to,
            downloadable_only=True,
        )
        list_records.assert_called_once_with(
            [],
            status="success",
            person_id="jane",
            created_from=created_from,
            created_to=created_to,
            downloadable_only=True,
            limit=25,
            offset=25,
        )
        self.assertEqual(response["pagination"]["page"], 2)
        self.assertEqual(response["records"][0]["personId"], "jane")

    def test_read_process_history_records_rejects_unknown_status(self):
        with self.assertRaises(process_history_api.HTTPException) as context:
            process_history_api.read_process_history_records(status="running")

        self.assertEqual(context.exception.status_code, 400)

    def test_process_history_store_filters_person_time_and_downloadable_only(self):
        created_from = datetime(2026, 6, 1, 0, 0, 0)
        created_to = datetime(2026, 7, 1, 0, 0, 0)

        where_clause, params = mysql_store._build_process_history_filters(
            status="success",
            person_id="jane",
            created_from=created_from,
            created_to=created_to,
            downloadable_only=True,
        )

        self.assertIn("ar.activity_type <> 'automation'", where_clause)
        self.assertIn("ar.person_id = %s", where_clause)
        self.assertIn("ar.created_at >= %s", where_clause)
        self.assertIn("ar.created_at <= %s", where_clause)
        self.assertIn("af_download.file_role = 'result_file'", where_clause)
        self.assertEqual(params, ["success", "jane", created_from, created_to])

    def test_download_process_history_result_file_streams_minio_object(self):
        row = {
            "id": 42,
            "record_id": "jessca-20260630010203",
            "file_role": "result_file",
            "bucket": "tos-results",
            "object_key": "process-results/jessca/2026/06/30/req/result_file/result.xlsx",
            "original_filename": "result.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        response_obj = FakeObjectResponse()

        with patch.object(
            process_history_api,
            "get_process_history_result_file",
            return_value=row,
        ) as get_file, patch.object(
            process_history_api,
            "get_object_response",
            return_value=response_obj,
        ) as get_object:
            response = process_history_api.download_process_history_result_file(42)

        get_file.assert_called_once_with(42)
        get_object.assert_called_once_with(row["bucket"], row["object_key"])
        self.assertEqual(response.media_type, row["content_type"])
        self.assertIn("filename*=UTF-8''result.xlsx", response.headers["content-disposition"])

    def test_download_process_history_result_file_rejects_missing_record(self):
        with patch.object(
            process_history_api,
            "get_process_history_result_file",
            return_value=None,
        ):
            with self.assertRaises(process_history_api.HTTPException) as context:
                process_history_api.download_process_history_result_file(404)

        self.assertEqual(context.exception.status_code, 404)

    def test_download_process_history_result_file_reports_storage_failure(self):
        row = {
            "id": 42,
            "record_id": "jessca-20260630010203",
            "file_role": "result_file",
            "bucket": "tos-results",
            "object_key": "process-results/jessca/2026/06/30/req/result_file/result.xlsx",
            "original_filename": "result.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }

        with patch.object(
            process_history_api,
            "get_process_history_result_file",
            return_value=row,
        ), patch.object(
            process_history_api,
            "get_object_response",
            side_effect=RuntimeError("minio unavailable"),
        ), patch.object(process_history_api.logger, "exception"):
            with self.assertRaises(process_history_api.HTTPException) as context:
                process_history_api.download_process_history_result_file(42)

        self.assertEqual(context.exception.status_code, 503)

    def test_save_process_history_result_file_requires_configured_token(self):
        upload = FakeUpload("result.xlsx")

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(process_history_api.HTTPException) as context:
                process_history_api.save_process_history_result_file(
                    moduleId="jane",
                    requestId="req-remote-1",
                    originalFilename="result.xlsx",
                    moduleName="Jane",
                    status="success",
                    durationMs=0,
                    message="",
                    inputFiles="[]",
                    outputFile="result.xlsx",
                    summary="[]",
                    createdAt=None,
                    contentType="",
                    file=upload,
                    history_write_token="server-token",
                )

        self.assertEqual(context.exception.status_code, 503)

    def test_save_process_history_result_file_rejects_bad_token(self):
        upload = FakeUpload("result.xlsx")

        with patch.dict(os.environ, {"TOS_PROCESS_HISTORY_WRITE_TOKEN": "server-token"}, clear=True):
            with self.assertRaises(process_history_api.HTTPException) as context:
                process_history_api.save_process_history_result_file(
                    moduleId="jane",
                    requestId="req-remote-1",
                    originalFilename="result.xlsx",
                    file=upload,
                    history_write_token="wrong-token",
                )

        self.assertEqual(context.exception.status_code, 401)

    def test_save_process_history_result_file_stores_uploaded_file(self):
        upload = FakeUpload("result.xlsx", b"server result")
        archive_payload = {
            "resultFileId": 84,
            "resultDownloadPath": "/api/process-history/files/84/download",
            "resultFile": {
                "id": 84,
                "filename": "result.xlsx",
                "downloadPath": "/api/process-history/files/84/download",
            },
            "fileSize": len(b"server result"),
            "sha256": "d" * 64,
            "historyWarnings": [],
        }

        with patch.dict(os.environ, {"TOS_PROCESS_HISTORY_WRITE_TOKEN": "server-token"}, clear=True), \
             patch.object(
                 process_history_api,
                 "store_uploaded_process_result_file",
                 return_value=archive_payload,
             ) as store_file:
            response = process_history_api.save_process_history_result_file(
                moduleId="jane",
                requestId="req-remote-1",
                originalFilename="../result.xlsx",
                moduleName="Jane",
                status="success",
                durationMs=1234,
                message="completed",
                inputFiles='["source.xlsx"]',
                outputFile="result.xlsx",
                summary='[{"label":"Rows","value":"18"}]',
                createdAt="2026-06-30T01:02:03.000Z",
                contentType="",
                file=upload,
                history_write_token="server-token",
            )

        store_file.assert_called_once()
        context = store_file.call_args.kwargs["context"]
        history_record = store_file.call_args.kwargs["history_record"]
        self.assertEqual(context.module_id, "jane")
        self.assertEqual(context.request_id, "req-remote-1")
        self.assertEqual(context.original_filename, "result.xlsx")
        self.assertEqual(history_record["module_name"], "Jane")
        self.assertEqual(history_record["input_files"], ["source.xlsx"])
        self.assertEqual(history_record["summary"], [{"label": "Rows", "value": "18"}])
        self.assertTrue(response["ok"])
        self.assertEqual(response["history_id"], "req-remote-1")
        self.assertEqual(response["result_download_path"], "/api/process-history/files/84/download")
        self.assertEqual(response["result_download_backend_target"], "remote")

    def test_save_process_history_result_file_reports_storage_failure(self):
        upload = FakeUpload("result.xlsx")

        with patch.dict(os.environ, {"TOS_PROCESS_HISTORY_WRITE_TOKEN": "server-token"}, clear=True), \
             patch.object(
                 process_history_api,
                 "store_uploaded_process_result_file",
                 side_effect=RuntimeError("minio unavailable"),
             ), patch.object(process_history_api.logger, "exception"):
            with self.assertRaises(process_history_api.HTTPException) as context:
                process_history_api.save_process_history_result_file(
                    moduleId="jane",
                    requestId="req-remote-1",
                    originalFilename="result.xlsx",
                    moduleName="Jane",
                    status="success",
                    durationMs=0,
                    message="",
                    inputFiles="[]",
                    outputFile="result.xlsx",
                    summary="[]",
                    createdAt=None,
                    contentType="",
                    file=upload,
                    history_write_token="server-token",
                )

        self.assertEqual(context.exception.status_code, 503)


def build_history_row(overrides=None):
    row = {
        "id": 1,
        "record_id": "jessca-20260630010203",
        "module_id": "jessca",
        "person_id": "jessica",
        "module_name": "Jessica Invoice",
        "status": "success",
        "duration_ms": 1234,
        "message": "completed",
        "input_files_json": '["invoice.xlsx"]',
        "output_file": "D:/outputs/result.xlsx",
        "result_file_id": 42,
        "result_file_name": "result.xlsx",
        "result_file_content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "result_file_size": 128,
        "result_file_sha256": "c" * 64,
        "summary_json": '[{"label":"Rows","value":"18"}]',
        "created_at": datetime(2026, 6, 30, 1, 2, 3),
        "updated_at": datetime(2026, 6, 30, 1, 2, 4),
    }
    if overrides:
        row.update(overrides)
    return row


class FakeObjectResponse:
    def stream(self, _chunk_size):
        yield b"result workbook"

    def close(self):
        return None


class FakeUpload:
    def __init__(
        self,
        filename: str,
        content: bytes = b"result workbook",
        content_type: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        self.filename = filename
        self.content_type = content_type
        import io
        self.file = io.BytesIO(content)


if __name__ == "__main__":
    unittest.main()
