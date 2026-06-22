from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import release_update_sync


class ReleaseUpdateSyncTest(unittest.TestCase):
    def test_merge_prefers_server_records_and_preserves_local_newer_records(self) -> None:
        server_records = [
            {
                "recordKey": "git-cache-sync",
                "version": "0.9.8-beta.3.19",
                "releaseDate": "2026-06-17",
                "category": "improved",
                "pageName": "多个页面",
                "pagePath": "",
                "title": "chore: 同步版本更新缓存",
                "description": "cache sync should not be shown",
            },
            {
                "recordKey": "git-server",
                "version": "0.9.8-beta.3.17",
                "releaseDate": "2026-06-16",
                "category": "fixed",
                "pageName": "服务器记录",
                "pagePath": "/server",
                "title": "server wins",
                "description": "server description",
            },
            {
                "recordKey": "shared-key",
                "version": "0.9.8-beta.3.16",
                "releaseDate": "2026-06-15",
                "category": "improved",
                "pageName": "服务器重复记录",
                "pagePath": "/server-duplicate",
                "title": "server duplicate wins",
                "description": "server duplicate description",
            },
        ]
        local_records = [
            {
                "recordKey": "local-3.19",
                "version": "0.9.8-beta.3.19",
                "releaseDate": "2026-06-17",
                "category": "fixed",
                "pageName": "本地新版本",
                "pagePath": "/release-updates",
                "title": "local newer record",
                "description": "local description",
            },
            {
                "recordKey": "shared-key",
                "version": "0.9.8-beta.3.16",
                "releaseDate": "2026-06-15",
                "category": "fixed",
                "pageName": "本地重复记录",
                "pagePath": "/local-duplicate",
                "title": "local duplicate should be ignored",
                "description": "local duplicate description",
            },
        ]

        records = release_update_sync.merge_release_update_records(server_records, local_records)

        self.assertEqual([record["recordKey"] for record in records], ["local-3.19", "git-server", "shared-key"])
        self.assertEqual(records[2]["title"], "server duplicate wins")
        self.assertEqual(records[2]["pagePath"], "/server-duplicate")

    def test_backend_api_url_can_be_resolved_from_env_server(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            env_path = root / "tms-frontend" / ".env.server"
            env_path.parent.mkdir(parents=True)
            env_path.write_text(
                "VITE_BACKEND_URL=https://ai.tomwell.net:56130/tos/desktop-api\n",
                encoding="utf-8",
            )

            url = release_update_sync.resolve_release_updates_api_url("", root)

        self.assertEqual(url, "https://ai.tomwell.net:56130/tos/desktop-api/api/release-updates")

    def test_package_scripts_include_explicit_push_dry_run(self) -> None:
        package_json = json.loads((release_update_sync.WORKSPACE_ROOT / "package.json").read_text(encoding="utf-8"))
        scripts = package_json["scripts"]

        self.assertEqual(
            scripts["release:updates:push:dry-run"],
            "python scripts/release_update_sync.py --dry-run",
        )
        self.assertEqual(
            scripts["release:updates:dry-run"],
            "python scripts/release_update_sync.py --pull --limit 300 --dry-run",
        )

    def test_git_hooks_support_release_update_skip_flag(self) -> None:
        for hook_name in ("post-commit", "post-merge"):
            hook_text = (release_update_sync.WORKSPACE_ROOT / ".githooks" / hook_name).read_text(encoding="utf-8")

            self.assertIn("TOS_RELEASE_UPDATES_SKIP", hook_text)
            self.assertIn('if [ "${TOS_RELEASE_UPDATES_SKIP:-}" = "1" ]; then', hook_text)
            self.assertLess(hook_text.index("TOS_RELEASE_UPDATES_SKIP"), hook_text.index("release_update_sync.py"))

        post_merge_text = (release_update_sync.WORKSPACE_ROOT / ".githooks" / "post-merge").read_text(encoding="utf-8")
        self.assertIn("--commit HEAD --event merge", post_merge_text)
        self.assertNotIn("--range", post_merge_text)

    def test_cache_sync_commit_is_not_recorded_from_ranges(self) -> None:
        self.assertTrue(
            release_update_sync.is_release_update_cache_sync_commit({
                "subject": "chore: 同步版本更新缓存",
                "files": "\n".join([
                    "tms-backend/data/release_updates_seed.json",
                    "tms-frontend/src/shared/version/releaseHistory.json",
                ]),
            }),
        )
        self.assertFalse(
            release_update_sync.is_release_update_cache_sync_commit({
                "subject": "chore: 同步版本更新缓存",
                "files": "README.md",
            }),
        )

    def test_pull_dry_run_does_not_write_cache_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            history_path = root / "tms-frontend" / "src" / "shared" / "version" / "releaseHistory.json"
            api_path = root / "tms-backend" / "api" / "release_updates_api.py"
            seed_path = root / "tms-backend" / "data" / "release_updates_seed.json"
            history_path.parent.mkdir(parents=True)
            api_path.parent.mkdir(parents=True)
            seed_path.parent.mkdir(parents=True)
            history_payload = [
                {
                    "recordKey": "local-only",
                    "version": "0.9.8-beta.3.19",
                    "releaseDate": "2026-06-17",
                    "category": "fixed",
                    "pageName": "本地记录",
                    "pagePath": "/release-updates",
                    "title": "local only",
                    "description": "local",
                }
            ]
            original_history = json.dumps(history_payload, ensure_ascii=False, indent=2) + "\n"
            original_api = (
                "from pathlib import Path\n"
                "RELEASE_UPDATE_SEED_PATH = Path(__file__).resolve().parents[1] / \"data\" / \"release_updates_seed.json\"\n"
            )
            original_seed = "[]\n"
            history_path.write_text(original_history, encoding="utf-8")
            api_path.write_text(original_api, encoding="utf-8")
            seed_path.write_text(original_seed, encoding="utf-8")

            result = release_update_sync.sync_release_update_cache(
                workspace_root=root,
                server_records=[
                    {
                        "recordKey": "server-only",
                        "version": "0.9.8-beta.3.17",
                        "releaseDate": "2026-06-16",
                        "category": "improved",
                        "pageName": "服务器记录",
                        "pagePath": "/release-updates",
                        "title": "server only",
                        "description": "server",
                    }
                ],
                dry_run=True,
            )

            self.assertEqual(result["recordCount"], 2)
            self.assertEqual(history_path.read_text(encoding="utf-8"), original_history)
            self.assertEqual(api_path.read_text(encoding="utf-8"), original_api)
            self.assertEqual(seed_path.read_text(encoding="utf-8"), original_seed)

    def test_pull_writes_release_history_and_backend_seed_with_lf_line_endings(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            history_path = root / "tms-frontend" / "src" / "shared" / "version" / "releaseHistory.json"
            api_path = root / "tms-backend" / "api" / "release_updates_api.py"
            seed_path = root / "tms-backend" / "data" / "release_updates_seed.json"
            history_path.parent.mkdir(parents=True)
            api_path.parent.mkdir(parents=True)
            seed_path.parent.mkdir(parents=True)
            history_path.write_text("[]\n", encoding="utf-8")
            api_path.write_text("API source must not be rewritten\n", encoding="utf-8")
            seed_path.write_text("[]\n", encoding="utf-8")

            release_update_sync.sync_release_update_cache(
                workspace_root=root,
                server_records=[
                    {
                        "recordKey": "server-only",
                        "version": "0.9.8-beta.3.17",
                        "releaseDate": "2026-06-16",
                        "category": "improved",
                        "pageName": "服务器记录",
                        "pagePath": "/release-updates",
                        "title": "server only",
                        "description": "server",
                    }
                ],
            )

            self.assertNotIn(b"\r\n", history_path.read_bytes())
            self.assertNotIn(b"\r\n", seed_path.read_bytes())
            self.assertEqual(api_path.read_text(encoding="utf-8"), "API source must not be rewritten\n")

            seed_records = json.loads(seed_path.read_text(encoding="utf-8"))
            self.assertEqual(seed_records[0]["recordKey"], "server-only")


if __name__ == "__main__":
    unittest.main()
