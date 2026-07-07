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
from api import eric_api  # noqa: E402


EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class EricApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_process_and_reconcile_routes_declare_typed_response_schema(self) -> None:
        payload = self.client.get("/openapi.json").json()

        for path in ["/api/eric/process", "/api/eric/reconcile"]:
            with self.subTest(path=path):
                response_schema = payload["paths"][path]["post"]["responses"]["200"]["content"][
                    "application/json"
                ]["schema"]
                self.assertEqual(response_schema["$ref"], "#/components/schemas/EricProcessResponse")

        process_schema = payload["components"]["schemas"]["EricProcessResponse"]
        properties = process_schema["properties"]
        for key in [
            "success",
            "message",
            "logs",
            "row_count",
            "output_file",
            "difference_count",
            "po_difference_count",
            "size_check_count",
            "history_warnings",
            "result_download_path",
            "result_download_backend_target",
            "result_file",
        ]:
            self.assertIn(key, properties)

    def test_process_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "Eric failed",
            "logs": ["bad pack"],
        }

        with patch.object(eric_api.eric_module, "process_file", return_value=failure_result):
            response = self.client.post(
                "/api/eric/process",
                files={
                    "excel_file": (
                        "pack.xlsx",
                        BytesIO(b"placeholder pack workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "Eric failed",
                "logs": ["bad pack"],
            },
        )

    def test_reconcile_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "Eric reconcile failed",
            "logs": ["bad ytic"],
        }

        with patch.object(eric_api.eric_module, "process_reconciliation", return_value=failure_result):
            response = self.client.post(
                "/api/eric/reconcile",
                files={
                    "pack_file": (
                        "pack.xlsx",
                        BytesIO(b"placeholder pack workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                    "ytic_file": (
                        "ytic.xlsx",
                        BytesIO(b"placeholder ytic workbook"),
                        EXCEL_CONTENT_TYPE,
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "Eric reconcile failed",
                "logs": ["bad ytic"],
            },
        )


if __name__ == "__main__":
    unittest.main()
