import unittest
from datetime import datetime
from unittest.mock import patch

from api import process_history_api
from api.process_history_api import ProcessHistoryPayload


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

    def test_read_process_history_records_rejects_unknown_status(self):
        with self.assertRaises(process_history_api.HTTPException) as context:
            process_history_api.read_process_history_records(status="running")

        self.assertEqual(context.exception.status_code, 400)


def build_history_row():
    return {
        "id": 1,
        "record_id": "jessca-20260630010203",
        "module_id": "jessca",
        "module_name": "Jessica Invoice",
        "status": "success",
        "duration_ms": 1234,
        "message": "completed",
        "input_files_json": '["invoice.xlsx"]',
        "output_file": "D:/outputs/result.xlsx",
        "summary_json": '[{"label":"Rows","value":"18"}]',
        "created_at": datetime(2026, 6, 30, 1, 2, 3),
        "updated_at": datetime(2026, 6, 30, 1, 2, 4),
    }


if __name__ == "__main__":
    unittest.main()
