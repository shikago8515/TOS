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
from api import jane_api  # noqa: E402


class JaneApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_process_route_declares_typed_response_schema(self) -> None:
        payload = self.client.get("/openapi.json").json()

        response_schema = (
            payload["paths"]["/api/jane/process"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        )
        self.assertEqual(response_schema["$ref"], "#/components/schemas/JaneProcessResponse")

        process_schema = payload["components"]["schemas"]["JaneProcessResponse"]
        properties = process_schema["properties"]
        for key in [
            "success",
            "message",
            "logs",
            "working_count",
            "output_file",
            "history_warnings",
            "result_download_path",
            "result_download_backend_target",
            "result_file",
        ]:
            self.assertIn(key, properties)

    def test_process_failure_keeps_legacy_response_shape(self) -> None:
        failure_result = {
            "success": False,
            "message": "Jane failed",
            "logs": ["bad input"],
            "output_path": None,
            "working_count": 0,
        }

        with patch.object(jane_api.jane_module, "process_reports", return_value=failure_result):
            response = self.client.post(
                "/api/jane/process",
                files={
                    "tms_file": (
                        "copy-of-tms.xlsx",
                        BytesIO(b"placeholder tms workbook"),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ),
                    "country_file": (
                        "country.xlsx",
                        BytesIO(b"placeholder country workbook"),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "message": "Jane failed",
                "logs": ["bad input"],
            },
        )


if __name__ == "__main__":
    unittest.main()
