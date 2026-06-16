import os
import tempfile
import unittest
from pathlib import Path

from utils import credential_crypto
from utils.credential_crypto import decrypt_secret, encrypt_secret
from utils.mysql_store import SCHEMA_DDL
from api.automation_storage_api import _attachment_content_disposition
from scripts.seed_automation_templates import AUTOMATION_TEMPLATES, read_template_content


class AutomationStorageTests(unittest.TestCase):
    def test_schema_contains_required_tables(self):
        schema_text = "\n".join(SCHEMA_DDL)

        self.assertIn("automation_credentials", schema_text)
        self.assertIn("excel_templates", schema_text)
        self.assertIn("automation_runs", schema_text)
        self.assertIn("automation_run_files", schema_text)

    def test_credentials_encrypt_and_decrypt_with_local_key_file(self):
        original_key_file = os.environ.get(credential_crypto.CREDENTIAL_KEY_FILE_ENV)
        original_key = os.environ.get(credential_crypto.CREDENTIAL_KEY_ENV)
        try:
            os.environ.pop(credential_crypto.CREDENTIAL_KEY_ENV, None)
            with tempfile.TemporaryDirectory() as temp_dir:
                key_file = Path(temp_dir) / "credential.key"
                os.environ[credential_crypto.CREDENTIAL_KEY_FILE_ENV] = str(key_file)

                encrypted = encrypt_secret("plain-password")

                self.assertNotEqual(encrypted, "plain-password")
                self.assertEqual(decrypt_secret(encrypted), "plain-password")
                self.assertTrue(key_file.exists())
        finally:
            restore_env(credential_crypto.CREDENTIAL_KEY_FILE_ENV, original_key_file)
            restore_env(credential_crypto.CREDENTIAL_KEY_ENV, original_key)

    def test_xinlongtai_shipping_template_is_registered_from_source_file(self):
        template = next(
            item for item in AUTOMATION_TEMPLATES
            if item["module_id"] == "xinlongtai-shipping-automation"
        )

        content = read_template_content(template)

        self.assertEqual(template["filename"], "新龙泰-shipping-自动化模板.XLS")
        self.assertGreater(len(content), 0)

    def test_template_download_header_supports_chinese_filename(self):
        header = _attachment_content_disposition("新龙泰-shipping-自动化模板.XLS")

        self.assertIn('filename="', header)
        self.assertIn("filename*=UTF-8''", header)
        self.assertIn("%E6%96%B0%E9%BE%99%E6%B3%B0", header)


def restore_env(name, value):
    if value is None:
        os.environ.pop(name, None)
    else:
        os.environ[name] = value


if __name__ == "__main__":
    unittest.main()
