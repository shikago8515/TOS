import asyncio
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl
from fastapi import HTTPException
from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from api import iplex_dual_table_compare_api  # noqa: E402
from main import app  # noqa: E402


class IplexDualTableCompareApiTests(unittest.TestCase):
    def test_api_inspects_processes_and_downloads_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_upload_dir = iplex_dual_table_compare_api.UPLOAD_DIR
            iplex_dual_table_compare_api.UPLOAD_DIR = temp_dir
            try:
                main_bytes = self._build_main_workbook()
                lookup_bytes = self._build_lookup_workbook()
                client = TestClient(app)

                inspect_response = client.post(
                    "/api/iplex/dual-table-compare/inspect",
                    files={
                        "excel_file": (
                            "main.xlsx",
                            main_bytes,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                    },
                    data={"header_row": "1"},
                )
                self.assertEqual(inspect_response.status_code, 200)
                self.assertEqual(
                    inspect_response.json()["selected_sheet"]["headers"][0]["label"],
                    "PO #",
                )

                process_response = client.post(
                    "/api/iplex/dual-table-compare/process",
                    files={
                        "main_file": (
                            "main.xlsx",
                            self._build_main_workbook(),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                        "lookup_file": (
                            "lookup.xlsx",
                            lookup_bytes,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                    },
                    data={
                        "config_json": (
                            '{"main_sheet_name":"Main","lookup_sheet_name":"Lookup",'
                            '"main_header_row":1,"lookup_header_row":1,'
                            '"main_key_column":1,"lookup_key_column":3,'
                            '"four_digit_main_column":4,"four_digit_lookup_column":7,'
                            '"two_digit_main_column":5,"two_digit_lookup_column":10}'
                        ),
                    },
                )
                self.assertEqual(process_response.status_code, 200)
                payload = process_response.json()
                self.assertTrue(payload["success"])
                self.assertEqual(payload["matched_count"], 1)
                self.assertEqual(payload["preview_rows"], [])
                self.assertTrue(payload["output_file"].endswith(".xlsx"))

                download_response = client.get(
                    f"/api/iplex/dual-table-compare/download/{payload['output_file']}",
                )
                self.assertEqual(download_response.status_code, 200)
                self.assertGreater(len(download_response.content), 1000)
            finally:
                iplex_dual_table_compare_api.UPLOAD_DIR = original_upload_dir

    def test_download_rejects_path_traversal(self) -> None:
        with self.assertRaises(HTTPException) as context:
            asyncio.run(iplex_dual_table_compare_api.download_iplex_dual_table_compare_result("../secret.xlsx"))

        self.assertEqual(context.exception.status_code, 400)

    def _build_main_workbook(self) -> bytes:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Main"
        sheet.append(["PO #", "Article", "Duplicate", "Adjustment_per_unit", "Total Adjustment Amount"])
        sheet.append(["0902893225", "LG4295", "", 0.1, 10])
        stream = io.BytesIO()
        workbook.save(stream)
        return stream.getvalue()

    def _build_lookup_workbook(self) -> bytes:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Lookup"
        sheet.append([
            "WORKING NUMBER",
            "ARTICLE NUMBER",
            "BUYER ORDER NO.",
            "CURRENCY",
            "PROMO PRICE UPCHARGE (%)",
            "KIDS FIRE LABEL",
            "SHAS PRICE PER UNIT",
            "",
            "",
            "TOTAL ADJUSTMENT",
        ])
        sheet.append(["RC2620OW014", "LG4295", "0902893225", "USD", 0, 0, 0.1, "", "", 10])
        stream = io.BytesIO()
        workbook.save(stream)
        return stream.getvalue()


if __name__ == "__main__":
    unittest.main()
