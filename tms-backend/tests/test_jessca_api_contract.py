from __future__ import annotations

import os
import sys
import unittest

from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

import main  # noqa: E402


class JesscaApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        main.app.openapi_schema = None
        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        main.app.openapi_schema = None

    def test_process_route_declares_typed_response_schema(self) -> None:
        payload = self.client.get("/openapi.json").json()

        response_schema = (
            payload["paths"]["/api/jessca/process"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
        )
        self.assertEqual(response_schema["$ref"], "#/components/schemas/JesscaProcessResponse")

        process_schema = payload["components"]["schemas"]["JesscaProcessResponse"]
        properties = process_schema["properties"]
        for key in [
            "success",
            "message",
            "logs",
            "invoice_count",
            "total_items",
            "matches",
            "diagnostics",
            "tc_count",
            "tc_total_issue_count",
            "output_file",
            "history_warnings",
            "result_download_path",
        ]:
            self.assertIn(key, properties)


if __name__ == "__main__":
    unittest.main()
