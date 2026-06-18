import json
import os
import sys
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_ROOT, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from api import release_updates_api  # noqa: E402
from utils import mysql_store  # noqa: E402


class _FakeCursor:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, _exc_type: object, _exc: object, _traceback: object) -> None:
        return None

    def execute(self, _query: str, _params: tuple[int] | None = None) -> None:
        return None

    def fetchall(self) -> list[dict[str, object]]:
        return self._rows


class _FakeConnection:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def __enter__(self) -> "_FakeConnection":
        return self

    def __exit__(self, _exc_type: object, _exc: object, _traceback: object) -> None:
        return None

    def cursor(self) -> _FakeCursor:
        return _FakeCursor(self._rows)


class _CaptureCursor:
    def __init__(self) -> None:
        self.queries: list[str] = []

    def __enter__(self) -> "_CaptureCursor":
        return self

    def __exit__(self, _exc_type: object, _exc: object, _traceback: object) -> None:
        return None

    def execute(self, query: str, _params: tuple[object, ...] | None = None) -> None:
        self.queries.append(query)


class _CaptureConnection:
    def __init__(self, cursor: _CaptureCursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> "_CaptureConnection":
        return self

    def __exit__(self, _exc_type: object, _exc: object, _traceback: object) -> None:
        return None

    def cursor(self) -> _CaptureCursor:
        return self._cursor

    def commit(self) -> None:
        return None


class ReleaseUpdatesApiTest(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(release_updates_api.router, prefix="/api")
        self.client = TestClient(app)

    def test_read_release_updates_returns_stable_response_shape(self) -> None:
        with patch.object(release_updates_api, "seed_default_release_updates"), patch.object(
            release_updates_api,
            "list_release_update_records",
            return_value=[self._release_update_row(1, "0.9.8-beta.3.15")],
        ):
            response = self.client.get("/api/release-updates?limit=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "ok": True,
                "version": "0.9.8-beta.3.15",
                "records": [
                    {
                        "id": 1,
                        "recordKey": "record-0.9.8-beta.3.15",
                        "version": "0.9.8-beta.3.15",
                        "releaseDate": "2026-06-15",
                        "category": "improved",
                        "pageName": "版本更新记录",
                        "pagePath": "/release-updates",
                        "title": "Record 0.9.8-beta.3.15",
                        "description": "",
                        "createdBy": "system",
                        "createdAt": "",
                        "updatedAt": "",
                    }
                ],
                "total": 1,
            },
        )

    def test_save_release_update_returns_stable_response_shape(self) -> None:
        expected_row = self._release_update_row(2, "0.9.8-beta.3.15")

        with patch.dict(os.environ, {"TOS_RELEASE_UPDATE_WRITE_TOKEN": ""}), patch.object(
            release_updates_api,
            "upsert_release_update_record",
            return_value=expected_row,
        ) as upsert_record:
            response = self.client.post(
                "/api/release-updates",
                json={
                    "recordKey": " record-0.9.8-beta.3.15 ",
                    "version": " 0.9.8-beta.3.15 ",
                    "releaseDate": "2026-06-15",
                    "category": " fixed ",
                    "pageName": " 版本更新记录 ",
                    "pagePath": " /release-updates ",
                    "title": " 修复记录 ",
                    "description": " 描述 ",
                    "createdBy": " deploy ",
                },
            )

        self.assertEqual(response.status_code, 200)
        upsert_record.assert_called_once_with(
            {
                "record_key": "record-0.9.8-beta.3.15",
                "version": "0.9.8-beta.3.15",
                "release_date": "2026-06-15",
                "category": "fixed",
                "page_name": "版本更新记录",
                "page_path": "/release-updates",
                "title": "修复记录",
                "description": "描述",
                "created_by": "deploy",
            }
        )
        self.assertEqual(
            response.json()["record"],
            {
                "id": 2,
                "recordKey": "record-0.9.8-beta.3.15",
                "version": "0.9.8-beta.3.15",
                "releaseDate": "2026-06-15",
                "category": "improved",
                "pageName": "版本更新记录",
                "pagePath": "/release-updates",
                "title": "Record 0.9.8-beta.3.15",
                "description": "",
                "createdBy": "system",
                "createdAt": "",
                "updatedAt": "",
            },
        )

    def test_openapi_exposes_release_update_response_schemas(self) -> None:
        openapi_path = self.client.app.openapi()["paths"]["/api/release-updates"]

        get_schema = openapi_path["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        post_schema = openapi_path["post"]["responses"]["200"]["content"]["application/json"]["schema"]

        self.assertIn("$ref", get_schema)
        self.assertIn("$ref", post_schema)

    def test_default_records_keep_unique_historical_versions(self) -> None:
        records = release_updates_api.DEFAULT_RELEASE_UPDATE_RECORDS
        keys = [record["record_key"] for record in records]
        versions = {record["version"] for record in records}

        self.assertEqual(len(keys), len(set(keys)))
        self.assertGreater(len(records), 2)
        self.assertIn("0.9.8-beta.3.17", versions)
        self.assertIn("0.9.8-beta.3.16", versions)
        self.assertIn("0.9.8-beta.3.15", versions)
        self.assertIn("0.9.8-beta.3.14", versions)
        self.assertIn("0.9.8-beta.3.13", versions)
        self.assertIn("0.9.8-beta.3.12", versions)
        self.assertIn("0.9.8-beta.3.11", versions)
        self.assertIn("0.9.8-beta.3.10", versions)
        self.assertIn("0.9.8-beta.3.9", versions)
        self.assertIn("0.9.8-beta.3.1", versions)
        self.assertGreater(len(versions), 4)

        existing_default = next(
            record
            for record in records
            if record["record_key"] == "2026-06-13-release-update-records-page"
        )
        self.assertEqual(existing_default["version"], "0.9.8-beta.3.6")

    def test_seed_default_release_updates_inserts_missing_records_without_overwriting(self) -> None:
        with patch.object(release_updates_api, "insert_release_update_record_once") as insert_record, patch.object(
            release_updates_api,
            "upsert_release_update_record",
        ) as upsert_record:
            release_updates_api.seed_default_release_updates()

        self.assertEqual(insert_record.call_count, len(release_updates_api.DEFAULT_RELEASE_UPDATE_RECORDS))
        upsert_record.assert_not_called()
        record_keys = [call.args[0]["record_key"] for call in insert_record.call_args_list]
        self.assertIn("builtin-0.9.8-beta.3.27-added-jessica-packing-list-pdf", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.20-fixed-adidas-materials-helper-entry", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.17-improved-electron-external-allowlist", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.16-improved-system-api-contract", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.15-fixed-release-updates-browser-backend", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.15-added-tos-desktop-full-installer", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.15-fixed-release-updates-version-sort", record_keys)
        self.assertIn("2026-06-13-release-update-records-page", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.14-improved-draft-packing-separator-row", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.13-fixed-draft-packing-feedback-label", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.12-improved-process-history-scroll", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.11-fixed-draft-packing-description-cleanup", record_keys)

    def test_save_release_update_allows_public_get_but_rejects_post_with_wrong_token(self) -> None:
        expected_row = self._release_update_row(3, "0.9.8-beta.3.19")
        with patch.dict(os.environ, {"TOS_RELEASE_UPDATE_WRITE_TOKEN": "secret-token"}), patch.object(
            release_updates_api,
            "seed_default_release_updates",
        ), patch.object(
            release_updates_api,
            "list_release_update_records",
            return_value=[expected_row],
        ), patch.object(
            release_updates_api,
            "upsert_release_update_record",
        ) as upsert_record:
            get_response = self.client.get("/api/release-updates?limit=1")
            missing_token_response = self.client.post(
                "/api/release-updates",
                json={
                    "recordKey": "record-0.9.8-beta.3.19",
                    "version": "0.9.8-beta.3.19",
                    "releaseDate": "2026-06-17",
                    "category": "fixed",
                    "pageName": "版本更新记录",
                    "pagePath": "/release-updates",
                    "title": "缺少 token",
                    "description": "",
                    "createdBy": "test",
                },
            )

        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(missing_token_response.status_code, 401)
        upsert_record.assert_not_called()

    def test_save_release_update_accepts_correct_write_token(self) -> None:
        expected_row = self._release_update_row(4, "0.9.8-beta.3.19")

        with patch.dict(os.environ, {"TOS_RELEASE_UPDATE_WRITE_TOKEN": "secret-token"}), patch.object(
            release_updates_api,
            "upsert_release_update_record",
            return_value=expected_row,
        ) as upsert_record:
            response = self.client.post(
                "/api/release-updates",
                headers={"X-Release-Update-Token": "secret-token"},
                json={
                    "recordKey": "record-0.9.8-beta.3.19",
                    "version": "0.9.8-beta.3.19",
                    "releaseDate": "2026-06-17",
                    "category": "fixed",
                    "pageName": "版本更新记录",
                    "pagePath": "/release-updates",
                    "title": "正确 token",
                    "description": "",
                    "createdBy": "test",
                },
            )

        self.assertEqual(response.status_code, 200)
        upsert_record.assert_called_once()

    def test_list_release_update_records_orders_semantic_versions_descending(self) -> None:
        rows = [
            self._release_update_row(4, "0.9.8-beta.3.11"),
            self._release_update_row(3, "0.9.8-beta.3.12"),
            self._release_update_row(2, "0.9.8-beta.3.13"),
            self._release_update_row(1, "0.9.8-beta.3.14"),
        ]

        with patch.object(mysql_store, "ensure_schema"), patch.object(
            mysql_store,
            "mysql_connection",
            return_value=_FakeConnection(rows),
        ):
            records = mysql_store.list_release_update_records(4)

        self.assertEqual(
            [record["version"] for record in records],
            [
                "0.9.8-beta.3.14",
                "0.9.8-beta.3.13",
                "0.9.8-beta.3.12",
                "0.9.8-beta.3.11",
            ],
        )

    def test_upsert_release_update_record_does_not_refresh_updated_at(self) -> None:
        cursor = _CaptureCursor()
        record = {
            "record_key": "record-0.9.8-beta.3.14",
            "version": "0.9.8-beta.3.14",
            "release_date": "2026-06-15",
            "category": "fixed",
            "page_name": "版本更新记录",
            "page_path": "/release-updates",
            "title": "修复排序",
            "description": "保持最新版在上方",
            "created_by": "system",
        }

        with patch.object(mysql_store, "ensure_schema"), patch.object(
            mysql_store,
            "mysql_connection",
            return_value=_CaptureConnection(cursor),
        ), patch.object(mysql_store, "get_release_update_record", return_value={}):
            mysql_store.upsert_release_update_record(record)

        self.assertNotIn("updated_at = CURRENT_TIMESTAMP", "\n".join(cursor.queries))

    def test_frontend_release_history_matches_backend_defaults(self) -> None:
        history_path = os.path.join(
            REPO_ROOT,
            "tms-frontend",
            "src",
            "shared",
            "version",
            "releaseHistory.json",
        )
        with open(history_path, "r", encoding="utf-8") as history_file:
            frontend_records = json.load(history_file)

        backend_records = release_updates_api.DEFAULT_RELEASE_UPDATE_RECORDS

        self.assertEqual(
            [self._frontend_projection(record) for record in frontend_records],
            [self._backend_projection(record) for record in backend_records],
        )

    @staticmethod
    def _frontend_projection(record: dict[str, str]) -> dict[str, str]:
        return {
            "record_key": record["recordKey"],
            "version": record["version"],
            "release_date": record["releaseDate"],
            "category": record["category"],
            "page_name": record["pageName"],
            "page_path": record["pagePath"],
            "title": record["title"],
            "description": record["description"],
        }

    @staticmethod
    def _backend_projection(record: dict[str, str]) -> dict[str, str]:
        return {
            "record_key": record["record_key"],
            "version": record["version"],
            "release_date": record["release_date"],
            "category": record["category"],
            "page_name": record["page_name"],
            "page_path": record["page_path"],
            "title": record["title"],
            "description": record["description"],
        }

    @staticmethod
    def _release_update_row(row_id: int, version: str) -> dict[str, object]:
        return {
            "id": row_id,
            "record_key": f"record-{version}",
            "version": version,
            "release_date": "2026-06-15",
            "category": "improved",
            "page_name": "版本更新记录",
            "page_path": "/release-updates",
            "title": f"Record {version}",
            "description": "",
            "created_by": "system",
            "created_at": "",
            "updated_at": "",
        }


if __name__ == "__main__":
    unittest.main()
