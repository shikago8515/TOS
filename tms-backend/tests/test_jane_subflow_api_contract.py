from __future__ import annotations

import os
import sys
import unittest
from io import BytesIO
from unittest.mock import patch

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import main  # noqa: E402
from api import jane_bom_compare_api, jane_bom_summary_api, jane_outbound_compare_api  # noqa: E402


EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class JaneSubflowApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_process_routes_declare_typed_response_schemas(self) -> None:
        payload = self.client.get("/openapi.json").json()
        cases = [
            (
                "/api/jane-bom-summary/process",
                "JaneBomSummaryProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "bom_count",
                    "row_count",
                    "output_file",
                    "history_warnings",
                    "result_download_path",
                    "result_download_backend_target",
                    "result_file",
                ],
            ),
            (
                "/api/jane-bom-compare/process",
                "JaneBomCompareProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "bom_count",
                    "bom_material_row_count",
                    "checked_row_count",
                    "mismatch_cell_count",
                    "inconsistent_group_count",
                    "extra_material_row_count",
                    "missing_row_count",
                    "rate_row_count",
                    "no_bom_key_count",
                    "output_file",
                    "history_warnings",
                    "result_download_path",
                    "result_download_backend_target",
                    "result_file",
                ],
            ),
            (
                "/api/jane-outbound-compare/process",
                "JaneOutboundCompareProcessResponse",
                [
                    "success",
                    "message",
                    "logs",
                    "checked_row_count",
                    "matched_row_count",
                    "missing_tms_row_count",
                    "missing_outbound_row_count",
                    "difference_cell_count",
                    "issue_count",
                    "output_file",
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

    def test_bom_summary_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "BOM summary failed",
            "logs": ["bad bom"],
        }

        with patch.object(
            jane_bom_summary_api.jane_bom_summary_module,
            "process_reports",
            return_value=failure_result,
        ):
            response = self.client.post(
                "/api/jane-bom-summary/process",
                files=[
                    (
                        "bom_files",
                        ("bom.xlsx", BytesIO(b"placeholder bom workbook"), EXCEL_CONTENT_TYPE),
                    ),
                    (
                        "pack_file",
                        ("pack.xlsx", BytesIO(b"placeholder pack workbook"), EXCEL_CONTENT_TYPE),
                    ),
                ],
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "BOM summary failed",
                "logs": ["bad bom"],
            },
        )

    def test_bom_compare_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "BOM compare failed",
            "logs": ["bad production"],
        }

        with patch.object(
            jane_bom_compare_api.jane_bom_compare_module,
            "process_reports",
            return_value=failure_result,
        ):
            response = self.client.post(
                "/api/jane-bom-compare/process",
                files={
                    "production_file": (
                        "production.xlsx",
                        BytesIO(b"placeholder production workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                    "bom_summary_file": (
                        "bom-summary.xlsx",
                        BytesIO(b"placeholder bom summary workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "BOM compare failed",
                "logs": ["bad production"],
            },
        )

    def test_outbound_compare_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "Outbound compare failed",
            "logs": ["bad outbound"],
        }

        with patch.object(
            jane_outbound_compare_api.jane_outbound_compare_module,
            "process_reports",
            return_value=failure_result,
        ):
            response = self.client.post(
                "/api/jane-outbound-compare/process",
                files={
                    "outbound_file": (
                        "outbound.xlsx",
                        BytesIO(b"placeholder outbound workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                    "tms_file": (
                        "tms.xlsx",
                        BytesIO(b"placeholder tms workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "Outbound compare failed",
                "logs": ["bad outbound"],
            },
        )


if __name__ == "__main__":
    unittest.main()
