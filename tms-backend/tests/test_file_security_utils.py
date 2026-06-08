import asyncio
import io
import os
import sys
import tempfile
import unittest

from fastapi import HTTPException


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from api import jane_api, jessca_api, sophia_tina_api
from utils.file_utils import (
    resolve_download_path,
    sanitize_output_reference,
    validate_upload_filename,
)


class FileSecurityUtilsTests(unittest.TestCase):
    def test_validate_upload_filename_rejects_path_segments(self):
        with self.assertRaises(ValueError) as context:
            validate_upload_filename("../invoice.xlsx", {".xlsx"}, "发票文件")

        self.assertIn("文件名无效", str(context.exception))

    def test_validate_upload_filename_rejects_unsupported_extension(self):
        with self.assertRaises(ValueError) as context:
            validate_upload_filename("invoice.csv", {".xlsx", ".xlsm"}, "发票文件")

        self.assertIn("仅支持", str(context.exception))

    def test_resolve_download_path_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(ValueError) as context:
                resolve_download_path(temp_dir, "../secret.xlsx")

        self.assertIn("文件名无效", str(context.exception))

    def test_sanitize_output_reference_replaces_internal_path(self):
        internal_path = os.path.join("C:\\secret", "backend", "result.xlsx")

        self.assertEqual(
            sanitize_output_reference(f"结果文件：{internal_path}", internal_path, "result.xlsx"),
            "结果文件：result.xlsx",
        )


class LegacyApiSecurityTests(unittest.TestCase):
    def test_legacy_download_routes_reject_path_traversal(self):
        for download in (
            jane_api.download_jane_result,
            jessca_api.download_jessca_result,
            sophia_tina_api.download_st_result,
        ):
            with self.subTest(route=download.__name__):
                with self.assertRaises(HTTPException) as context:
                    asyncio.run(download("../secret.xlsx"))

                self.assertEqual(context.exception.status_code, 400)
                self.assertEqual(context.exception.detail, "文件名无效")

    def test_jane_process_returns_sanitized_500_detail(self):
        original_upload_dir = jane_api.UPLOAD_DIR
        original_module = jane_api.jane_module

        class FakeUpload:
            def __init__(self, filename: str):
                self.filename = filename
                self.file = io.BytesIO(b"not an excel file")

        class ExplodingJaneModule:
            def process_reports(self, **_kwargs):
                raise RuntimeError("internal path C:/secret/backend.xlsx")

        with tempfile.TemporaryDirectory() as temp_dir:
            jane_api.UPLOAD_DIR = temp_dir
            jane_api.jane_module = ExplodingJaneModule()
            try:
                with self.assertLogs(jane_api.logger, level="ERROR") as logs:
                    with self.assertRaises(HTTPException) as context:
                        asyncio.run(
                            jane_api.process_jane(
                                tms_file=FakeUpload("tms.xlsx"),
                                country_file=FakeUpload("country.xlsx"),
                                working_filters=None,
                            )
                        )
            finally:
                jane_api.UPLOAD_DIR = original_upload_dir
                jane_api.jane_module = original_module

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "处理失败，请查看诊断日志或稍后重试")
        self.assertNotIn("secret", context.exception.detail)
        self.assertIn("Jane processing failed", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
