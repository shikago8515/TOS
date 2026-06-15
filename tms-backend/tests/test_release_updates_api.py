import json
import os
import sys
import unittest
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_ROOT, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from api import release_updates_api  # noqa: E402


class ReleaseUpdatesApiTest(unittest.TestCase):
    def test_default_records_keep_unique_historical_versions(self) -> None:
        records = release_updates_api.DEFAULT_RELEASE_UPDATE_RECORDS
        keys = [record["record_key"] for record in records]
        versions = {record["version"] for record in records}

        self.assertEqual(len(keys), len(set(keys)))
        self.assertGreater(len(records), 2)
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

    def test_seed_default_release_updates_upserts_every_record(self) -> None:
        with patch.object(release_updates_api, "upsert_release_update_record") as upsert_record:
            release_updates_api.seed_default_release_updates()

        self.assertEqual(upsert_record.call_count, len(release_updates_api.DEFAULT_RELEASE_UPDATE_RECORDS))
        record_keys = [call.args[0]["record_key"] for call in upsert_record.call_args_list]
        self.assertIn("2026-06-13-release-update-records-page", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.14-improved-draft-packing-separator-row", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.13-fixed-draft-packing-feedback-label", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.12-improved-process-history-scroll", record_keys)
        self.assertIn("builtin-0.9.8-beta.3.11-fixed-draft-packing-description-cleanup", record_keys)

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


if __name__ == "__main__":
    unittest.main()
