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


if __name__ == "__main__":
    unittest.main()
