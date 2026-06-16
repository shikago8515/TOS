"""Desktop backend API contract checks."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

import main


class BackendApiContractTests(unittest.TestCase):
    def test_desktop_contract_paths_exist_in_fastapi_openapi(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        contract_path = repo_root / "tms-electron-app" / "backend-api-contract.json"
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        required_paths = contract["requiredOpenapiPaths"]
        openapi_paths = set(main.app.openapi()["paths"])

        missing_paths = sorted(
            route_path
            for route_path in required_paths
            if route_path not in openapi_paths
        )

        self.assertEqual(missing_paths, [])

    def test_system_contract_paths_expose_response_schemas(self) -> None:
        paths = main.app.openapi()["paths"]

        release_updates = paths["/api/release-updates"]
        self.assertIn(
            "$ref",
            release_updates["get"]["responses"]["200"]["content"]["application/json"]["schema"],
        )
        self.assertIn(
            "$ref",
            release_updates["post"]["responses"]["200"]["content"]["application/json"]["schema"],
        )

        summary = paths["/api/system/config/summary"]["get"]
        self.assertIn(
            "$ref",
            summary["responses"]["200"]["content"]["application/json"]["schema"],
        )

        self.assertIn(
            "application/vnd.microsoft.portable-executable",
            paths["/api/system/config/tos-desktop/download"]["get"]["responses"]["200"][
                "content"
            ],
        )
        self.assertIn(
            "application/vnd.microsoft.portable-executable",
            paths["/api/system/config/tos-desktop-full/download"]["get"]["responses"]["200"][
                "content"
            ],
        )
        self.assertIn(
            "application/zip",
            paths["/api/system/config/tos-desktop/payload/{payload_sha256}"]["get"][
                "responses"
            ]["200"]["content"],
        )


if __name__ == "__main__":
    unittest.main()
