import os
import tempfile
import textwrap
import unittest
from pathlib import Path

from utils.settings import SETTINGS_FILE_ENV, get_settings, get_settings_summary


class SettingsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.original_settings_file = os.environ.get(SETTINGS_FILE_ENV)
        self.original_mysql_host = os.environ.get("TOS_MYSQL_HOST")

    def tearDown(self) -> None:
        restore_env(SETTINGS_FILE_ENV, self.original_settings_file)
        restore_env("TOS_MYSQL_HOST", self.original_mysql_host)
        get_settings(reload=True)

    def test_loads_yaml_and_masks_sensitive_values(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            settings_path = Path(temp_dir) / "settings.yaml"
            settings_path.write_text(
                textwrap.dedent(
                    """
                    database:
                      mysql:
                        host: "127.0.0.1"
                        password: "local-secret"
                    storage:
                      minio:
                        access_key: "minio-user"
                        secret_key: "minio-secret"
                    """
                ),
                encoding="utf-8",
            )
            os.environ[SETTINGS_FILE_ENV] = str(settings_path)

            settings = get_settings(reload=True)
            summary = get_settings_summary()

        self.assertEqual(settings["database"]["mysql"]["password"], "local-secret")
        self.assertNotEqual(summary["database"]["mysql"]["password"], "local-secret")
        self.assertNotEqual(summary["storage"]["minio"]["secret_key"], "minio-secret")

    def test_environment_overrides_yaml(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            settings_path = Path(temp_dir) / "settings.yaml"
            settings_path.write_text(
                "database:\n  mysql:\n    host: old-host\n",
                encoding="utf-8",
            )
            os.environ[SETTINGS_FILE_ENV] = str(settings_path)
            os.environ["TOS_MYSQL_HOST"] = "override-host"

            settings = get_settings(reload=True)

        self.assertEqual(settings["database"]["mysql"]["host"], "override-host")


def restore_env(name: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value
