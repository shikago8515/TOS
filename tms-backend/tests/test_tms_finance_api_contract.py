from __future__ import annotations

import os
import sys
import unittest

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import main  # noqa: E402


class TmsFinanceApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_process_routes_declare_typed_response_schemas(self) -> None:
        payload = self.client.get("/openapi.json").json()
        cases = [
            (
                "/api/tms-finance/internal-reconciliation/process",
                "TmsFinanceInternalReconciliationProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "output_file",
                    "updated_count",
                    "source_row_count",
                    "target_row_count",
                    "excluded_rows",
                    "excluded_columns",
                    "appended_count",
                    "skipped_count",
                    "duplicate_count",
                    "similar_count",
                    "diagnostic_count",
                    "diagnostics",
                    "totals",
                    "source_summary",
                    "history_warnings",
                    "result_download_path",
                    "result_download_backend_target",
                    "result_file",
                ],
            ),
            (
                "/api/tms-finance/work-sales/process",
                "TmsFinanceWorkSalesProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "output_file",
                    "extracted_count",
                    "source_row_count",
                    "sales_written_count",
                    "purchase_written_count",
                    "cleared_sales_count",
                    "cleared_purchase_count",
                    "sales_appended_count",
                    "purchase_appended_count",
                    "duplicate_count",
                    "diagnostic_count",
                    "diagnostics",
                    "totals",
                    "source_summary",
                    "history_warnings",
                    "result_download_path",
                    "result_download_backend_target",
                    "result_file",
                ],
            ),
        ]

        for path, schema_name, expected_properties in cases:
            with self.subTest(path=path):
                response_schema = payload["paths"][path]["post"]["responses"]["200"]["content"][
                    "application/json"
                ]["schema"]
                self.assertEqual(response_schema["$ref"], f"#/components/schemas/{schema_name}")

                process_schema = payload["components"]["schemas"][schema_name]
                properties = process_schema["properties"]
                for key in expected_properties:
                    self.assertIn(key, properties)

    def test_internal_reconciliation_schema_declares_nested_summary_and_totals(self) -> None:
        payload = self.client.get("/openapi.json").json()

        totals_properties = payload["components"]["schemas"][
            "TmsFinanceInternalReconciliationTotals"
        ]["properties"]
        for key in ["quantity", "purchase_amount", "sales_amount_with_tax"]:
            self.assertIn(key, totals_properties)

        summary_properties = payload["components"]["schemas"][
            "TmsFinanceInternalReconciliationSourceSummary"
        ]["properties"]
        for key in ["sample_rows", "bulk_rows", "source_rows", "source_files"]:
            self.assertIn(key, summary_properties)

    def test_work_sales_schema_declares_nested_summary_and_totals(self) -> None:
        payload = self.client.get("/openapi.json").json()

        totals_properties = payload["components"]["schemas"]["TmsFinanceWorkSalesTotals"][
            "properties"
        ]
        for key in [
            "sales_written_count",
            "purchase_written_count",
            "cleared_sales_count",
            "cleared_purchase_count",
            "sales_appended_count",
            "purchase_appended_count",
        ]:
            self.assertIn(key, totals_properties)

        summary_properties = payload["components"]["schemas"][
            "TmsFinanceWorkSalesSourceSummary"
        ]["properties"]
        for key in [
            "source_rows",
            "sales_rows",
            "purchase_rows",
            "sales_written_rows",
            "purchase_written_rows",
            "cleared_sales_rows",
            "cleared_purchase_rows",
            "duplicate_rows",
        ]:
            self.assertIn(key, summary_properties)

    def test_result_file_schema_keeps_existing_download_fields(self) -> None:
        payload = self.client.get("/openapi.json").json()

        result_file_properties = payload["components"]["schemas"]["TmsFinanceResultFile"][
            "properties"
        ]
        for key in ["id", "filename", "contentType", "fileSize", "sha256", "downloadPath"]:
            self.assertIn(key, result_file_properties)


if __name__ == "__main__":
    unittest.main()
