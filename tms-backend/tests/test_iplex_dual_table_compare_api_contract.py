from __future__ import annotations

import os
import sys
import unittest

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import main  # noqa: E402


class IplexDualTableCompareApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_inspect_and_process_routes_declare_typed_response_schemas(self) -> None:
        payload = self.client.get("/openapi.json").json()
        cases = [
            (
                "/api/iplex/dual-table-compare/inspect",
                "IplexDualTableInspectionResponse",
                ["sheets", "selected_sheet"],
            ),
            (
                "/api/iplex/dual-table-compare/process",
                "IplexDualTableCompareProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "output_file",
                    "main_row_count",
                    "lookup_row_count",
                    "matched_count",
                    "unmatched_count",
                    "four_digit_mismatch_count",
                    "two_digit_mismatch_count",
                    "preview_rows",
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

    def test_inspection_schema_declares_nested_sheet_and_header_fields(self) -> None:
        payload = self.client.get("/openapi.json").json()

        sheet_properties = payload["components"]["schemas"]["IplexDualTableSheetSummary"]["properties"]
        for key in ["name", "max_row", "max_column"]:
            self.assertIn(key, sheet_properties)

        selected_sheet_properties = payload["components"]["schemas"]["IplexDualTableSelectedSheet"]["properties"]
        for key in ["name", "header_row", "max_row", "max_column", "data_row_count", "headers"]:
            self.assertIn(key, selected_sheet_properties)

        header_properties = payload["components"]["schemas"]["IplexDualTableHeader"]["properties"]
        for key in ["index", "letter", "label", "sample_value"]:
            self.assertIn(key, header_properties)

    def test_process_schema_declares_preview_row_fields(self) -> None:
        payload = self.client.get("/openapi.json").json()

        preview_row_properties = payload["components"]["schemas"]["IplexDualTableComparePreviewRow"]["properties"]
        for key in ["row_number", "key", "status", "four_digit", "two_digit"]:
            self.assertIn(key, preview_row_properties)

        metric_properties = payload["components"]["schemas"]["IplexDualTableComparePreviewMetric"]["properties"]
        for key in ["main_value", "lookup_value", "difference"]:
            self.assertIn(key, metric_properties)


if __name__ == "__main__":
    unittest.main()
