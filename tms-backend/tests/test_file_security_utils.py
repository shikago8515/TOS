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

from api import (
    draft_packing_compare_api,
    eric_api,
    jane_api,
    jane_bom_compare_api,
    jane_bom_summary_api,
    jane_outbound_compare_api,
    jessca_api,
    sophia_tina_api,
)
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

    def test_jessca_process_accepts_optional_tc_invoice_pdf(self):
        original_upload_dir = jessca_api.UPLOAD_DIR
        original_module = jessca_api.jessca_module

        class FakeUpload:
            def __init__(self, filename: str):
                self.filename = filename
                self.file = io.BytesIO(b"content")

        class CapturingJesscaModule:
            def __init__(self):
                self.tc_invoice_path = None
                self.tc_invoice_paths = None

            def process_invoices(
                self,
                _invoice_paths,
                _ref_path,
                output_dir=None,
                packing_path=None,
                packing_paths=None,
                tc_invoice_path=None,
                tc_invoice_paths=None,
            ):
                self.tc_invoice_path = tc_invoice_path
                self.tc_invoice_paths = tc_invoice_paths
                output_path = os.path.join(output_dir, "jessca-result.xlsx")
                with open(output_path, "wb") as fp:
                    fp.write(b"result")
                return {
                    "success": True,
                    "message": f"批量核对完成：{output_path}",
                    "logs": [f"结果文件：{output_path}"],
                    "invoice_count": 1,
                    "total_items": 1,
                    "matches": {"一致": 1, "不一致": 0, "未找到": 0},
                    "diagnostics": {},
                    "tc_count": 1,
                    "tc_matched_count": 1,
                    "tc_issue_count": 0,
                    "output_path": output_path,
                }

        with tempfile.TemporaryDirectory() as temp_dir:
            module = CapturingJesscaModule()
            jessca_api.UPLOAD_DIR = temp_dir
            jessca_api.jessca_module = module
            try:
                response = asyncio.run(
                    jessca_api.process_jessca(
                        invoices=[FakeUpload("invoice.xls")],
                        reference_file=FakeUpload("reference.xlsx"),
                        tc_invoice_file=FakeUpload("tc.pdf"),
                        output_dir=None,
                    )
                )
            finally:
                jessca_api.UPLOAD_DIR = original_upload_dir
                jessca_api.jessca_module = original_module

        self.assertIsNotNone(module.tc_invoice_path)
        self.assertTrue(str(module.tc_invoice_path).endswith("tc_invoice_tc.pdf"))
        self.assertEqual(response["tc_count"], 1)
        self.assertEqual(response["tc_matched_count"], 1)
        self.assertEqual(response["tc_issue_count"], 0)

    def test_jessca_process_accepts_multiple_optional_tc_invoice_pdfs(self):
        original_upload_dir = jessca_api.UPLOAD_DIR
        original_module = jessca_api.jessca_module

        class FakeUpload:
            def __init__(self, filename: str):
                self.filename = filename
                self.file = io.BytesIO(b"content")

        class CapturingJesscaModule:
            def __init__(self):
                self.tc_invoice_path = None
                self.tc_invoice_paths = None

            def process_invoices(
                self,
                _invoice_paths,
                _ref_path,
                output_dir=None,
                packing_path=None,
                packing_paths=None,
                tc_invoice_path=None,
                tc_invoice_paths=None,
            ):
                self.tc_invoice_path = tc_invoice_path
                self.tc_invoice_paths = tc_invoice_paths
                output_path = os.path.join(output_dir, "jessca-result.xlsx")
                with open(output_path, "wb") as fp:
                    fp.write(b"result")
                return {
                    "success": True,
                    "message": f"done: {output_path}",
                    "logs": [f"result: {output_path}"],
                    "invoice_count": 1,
                    "total_items": 1,
                    "matches": {"same": 1, "different": 0, "missing": 0},
                    "diagnostics": {},
                    "tc_count": 2,
                    "tc_matched_count": 2,
                    "tc_issue_count": 0,
                    "output_path": output_path,
                }

        with tempfile.TemporaryDirectory() as temp_dir:
            module = CapturingJesscaModule()
            jessca_api.UPLOAD_DIR = temp_dir
            jessca_api.jessca_module = module
            try:
                response = asyncio.run(
                    jessca_api.process_jessca(
                        invoices=[FakeUpload("invoice.xls")],
                        reference_file=FakeUpload("reference.xlsx"),
                        tc_invoice_file=[
                            FakeUpload("tc-a.pdf"),
                            FakeUpload("tc-b.pdf"),
                        ],
                        output_dir=None,
                    )
                )
            finally:
                jessca_api.UPLOAD_DIR = original_upload_dir
                jessca_api.jessca_module = original_module

        self.assertIsNone(module.tc_invoice_path)
        self.assertEqual(len(module.tc_invoice_paths), 2)
        self.assertTrue(str(module.tc_invoice_paths[0]).endswith("1_tc-a.pdf"))
        self.assertTrue(str(module.tc_invoice_paths[1]).endswith("2_tc-b.pdf"))
        self.assertEqual(response["tc_count"], 2)
        self.assertEqual(response["tc_matched_count"], 2)
        self.assertEqual(response["tc_issue_count"], 0)

    def test_jessca_process_accepts_legacy_packing_field_as_tc_invoice_pdf_alias(self):
        original_upload_dir = jessca_api.UPLOAD_DIR
        original_module = jessca_api.jessca_module

        class FakeUpload:
            def __init__(self, filename: str):
                self.filename = filename
                self.file = io.BytesIO(b"content")

        class CapturingJesscaModule:
            def __init__(self):
                self.tc_invoice_path = None

            def process_invoices(
                self,
                _invoice_paths,
                _ref_path,
                output_dir=None,
                packing_path=None,
                packing_paths=None,
                tc_invoice_path=None,
                tc_invoice_paths=None,
            ):
                self.tc_invoice_path = tc_invoice_path
                output_path = os.path.join(output_dir, "jessca-result.xlsx")
                with open(output_path, "wb") as fp:
                    fp.write(b"result")
                return {
                    "success": True,
                    "message": "ok",
                    "logs": [],
                    "invoice_count": 1,
                    "total_items": 1,
                    "matches": {"一致": 1, "不一致": 0, "未找到": 0},
                    "diagnostics": {},
                    "tc_count": 1,
                    "tc_matched_count": 1,
                    "tc_issue_count": 0,
                    "output_path": output_path,
                }

        with tempfile.TemporaryDirectory() as temp_dir:
            module = CapturingJesscaModule()
            jessca_api.UPLOAD_DIR = temp_dir
            jessca_api.jessca_module = module
            try:
                response = asyncio.run(
                    jessca_api.process_jessca(
                        invoices=[FakeUpload("invoice.xls")],
                        reference_file=FakeUpload("reference.xlsx"),
                        packing_file=FakeUpload("legacy-tc.pdf"),
                        output_dir=None,
                    )
                )
            finally:
                jessca_api.UPLOAD_DIR = original_upload_dir
                jessca_api.jessca_module = original_module

        self.assertIsNotNone(module.tc_invoice_path)
        self.assertTrue(str(module.tc_invoice_path).endswith("tc_invoice_legacy-tc.pdf"))
        self.assertEqual(response["tc_count"], 1)

    def test_jessca_process_rejects_non_pdf_tc_invoice_file(self):
        class FakeUpload:
            def __init__(self, filename: str):
                self.filename = filename
                self.file = io.BytesIO(b"content")

        with tempfile.TemporaryDirectory() as temp_dir:
            original_upload_dir = jessca_api.UPLOAD_DIR
            jessca_api.UPLOAD_DIR = temp_dir
            try:
                with self.assertRaises(HTTPException) as context:
                    asyncio.run(
                        jessca_api.process_jessca(
                            invoices=[FakeUpload("invoice.xls")],
                            reference_file=FakeUpload("reference.xlsx"),
                            tc_invoice_file=[
                                FakeUpload("tc.pdf"),
                                FakeUpload("tc.txt"),
                            ],
                            output_dir=None,
                        )
                    )
            finally:
                jessca_api.UPLOAD_DIR = original_upload_dir

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("TC INV PDF 仅支持 .pdf", context.exception.detail)

    def test_draft_packing_compare_process_accepts_multiple_origin_and_packing_pdfs(self):
        original_upload_dir = draft_packing_compare_api.UPLOAD_DIR
        original_module = draft_packing_compare_api.draft_packing_compare_module

        class CapturingDraftPackingModule:
            def __init__(self):
                self.draft_paths = None
                self.packing_paths = None

            def process_file_batches(self, draft_pdf_paths, packing_pdf_paths, output_dir):
                self.draft_paths = draft_pdf_paths
                self.packing_paths = packing_pdf_paths
                output_path = os.path.join(output_dir, "draft-packing-result.xlsx")
                with open(output_path, "wb") as fp:
                    fp.write(b"result")
                return {
                    "success": True,
                    "message": f"done: {output_path}",
                    "logs": [f"result: {output_path}"],
                    "output_path": output_path,
                    "group_count": 2,
                    "issue_count": 0,
                    "mismatch_count": 0,
                    "missing_field_count": 0,
                    "draft_count": 2,
                    "packing_count": 2,
                    "sheet_count": 2,
                    "draft_file_count": 2,
                    "packing_file_count": 2,
                }

            def process_files(self, **_kwargs):
                raise AssertionError("multiple uploads should use process_file_batches")

        with tempfile.TemporaryDirectory() as temp_dir:
            module = CapturingDraftPackingModule()
            draft_packing_compare_api.UPLOAD_DIR = temp_dir
            draft_packing_compare_api.draft_packing_compare_module = module
            try:
                response = asyncio.run(
                    draft_packing_compare_api.process_draft_packing_compare(
                        draft_file=[
                            FakeUpload("origin-a.pdf"),
                            FakeUpload("origin-b.pdf"),
                        ],
                        packing_file=[
                            FakeUpload("packing-a.pdf"),
                            FakeUpload("packing-b.pdf"),
                        ],
                        output_dir=None,
                    )
                )
            finally:
                draft_packing_compare_api.UPLOAD_DIR = original_upload_dir
                draft_packing_compare_api.draft_packing_compare_module = original_module

        self.assertEqual(len(module.draft_paths), 2)
        self.assertEqual(len(module.packing_paths), 2)
        self.assertTrue(str(module.draft_paths[0]).endswith("draft_1_origin-a.pdf"))
        self.assertTrue(str(module.packing_paths[1]).endswith("packing_2_packing-b.pdf"))
        self.assertEqual(response["sheet_count"], 2)
        self.assertEqual(response["draft_file_count"], 2)
        self.assertEqual(response["packing_file_count"], 2)

    def test_draft_packing_compare_process_rejects_non_pdf_in_multi_upload(self):
        original_upload_dir = draft_packing_compare_api.UPLOAD_DIR

        with tempfile.TemporaryDirectory() as temp_dir:
            draft_packing_compare_api.UPLOAD_DIR = temp_dir
            try:
                with self.assertRaises(HTTPException) as context:
                    asyncio.run(
                        draft_packing_compare_api.process_draft_packing_compare(
                            draft_file=[
                                FakeUpload("origin-a.pdf"),
                                FakeUpload("origin-b.txt"),
                            ],
                            packing_file=[FakeUpload("packing-a.pdf")],
                            output_dir=None,
                        )
                    )
            finally:
                draft_packing_compare_api.UPLOAD_DIR = original_upload_dir

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("产地证PDF 仅支持 .pdf", context.exception.detail)

    def test_jane_bom_summary_returns_sanitized_500_detail(self):
        original_upload_dir = jane_bom_summary_api.UPLOAD_DIR
        original_module = jane_bom_summary_api.jane_bom_summary_module

        class ExplodingModule:
            def process_reports(self, *_args, **_kwargs):
                raise RuntimeError("internal path C:/secret/bom-summary.xlsx")

        with tempfile.TemporaryDirectory() as temp_dir:
            jane_bom_summary_api.UPLOAD_DIR = temp_dir
            jane_bom_summary_api.jane_bom_summary_module = ExplodingModule()
            try:
                with self.assertLogs(jane_bom_summary_api.logger, level="ERROR") as logs:
                    with self.assertRaises(HTTPException) as context:
                        asyncio.run(
                            jane_bom_summary_api.process_jane_bom_summary(
                                bom_files=[FakeUpload("bom.xlsx")],
                                pack_file=FakeUpload("pack.xlsx"),
                                output_dir=None,
                            )
                        )
            finally:
                jane_bom_summary_api.UPLOAD_DIR = original_upload_dir
                jane_bom_summary_api.jane_bom_summary_module = original_module

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "处理失败，请查看诊断日志或稍后重试")
        self.assertNotIn("secret", context.exception.detail)
        self.assertIn("Jane BOM summary processing failed", "\n".join(logs.output))

    def test_jane_bom_compare_returns_sanitized_500_detail(self):
        original_upload_dir = jane_bom_compare_api.UPLOAD_DIR
        original_module = jane_bom_compare_api.jane_bom_compare_module

        class ExplodingModule:
            def process_reports(self, *_args, **_kwargs):
                raise RuntimeError("internal path C:/secret/bom-compare.xlsx")

        with tempfile.TemporaryDirectory() as temp_dir:
            jane_bom_compare_api.UPLOAD_DIR = temp_dir
            jane_bom_compare_api.jane_bom_compare_module = ExplodingModule()
            try:
                with self.assertLogs(jane_bom_compare_api.logger, level="ERROR") as logs:
                    with self.assertRaises(HTTPException) as context:
                        asyncio.run(
                            jane_bom_compare_api.process_jane_bom_compare(
                                production_file=FakeUpload("production.xlsx"),
                                bom_summary_file=FakeUpload("bom_summary.xlsx"),
                                bom_files=None,
                                output_dir=None,
                            )
                        )
            finally:
                jane_bom_compare_api.UPLOAD_DIR = original_upload_dir
                jane_bom_compare_api.jane_bom_compare_module = original_module

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "处理失败，请查看诊断日志或稍后重试")
        self.assertNotIn("secret", context.exception.detail)
        self.assertIn("Jane BOM compare processing failed", "\n".join(logs.output))

    def test_jane_outbound_compare_returns_sanitized_500_detail(self):
        original_upload_dir = jane_outbound_compare_api.UPLOAD_DIR
        original_module = jane_outbound_compare_api.jane_outbound_compare_module

        class ExplodingModule:
            def process_reports(self, *_args, **_kwargs):
                raise RuntimeError("internal path C:/secret/outbound.xlsx")

        with tempfile.TemporaryDirectory() as temp_dir:
            jane_outbound_compare_api.UPLOAD_DIR = temp_dir
            jane_outbound_compare_api.jane_outbound_compare_module = ExplodingModule()
            try:
                with self.assertLogs(jane_outbound_compare_api.logger, level="ERROR") as logs:
                    with self.assertRaises(HTTPException) as context:
                        asyncio.run(
                            jane_outbound_compare_api.process_jane_outbound_compare(
                                outbound_file=FakeUpload("outbound.xlsx"),
                                tms_file=FakeUpload("tms.xlsx"),
                                output_dir=None,
                            )
                        )
            finally:
                jane_outbound_compare_api.UPLOAD_DIR = original_upload_dir
                jane_outbound_compare_api.jane_outbound_compare_module = original_module

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "处理失败，请查看诊断日志或稍后重试")
        self.assertNotIn("secret", context.exception.detail)
        self.assertIn("Jane outbound compare processing failed", "\n".join(logs.output))

    def test_eric_process_returns_sanitized_500_detail(self):
        original_upload_dir = eric_api.UPLOAD_DIR
        original_module = eric_api.eric_module

        class ExplodingModule:
            def process_file(self, *_args):
                raise RuntimeError("internal path C:/secret/eric.xlsx")

        with tempfile.TemporaryDirectory() as temp_dir:
            eric_api.UPLOAD_DIR = temp_dir
            eric_api.eric_module = ExplodingModule()
            try:
                with self.assertLogs(eric_api.logger, level="ERROR") as logs:
                    with self.assertRaises(HTTPException) as context:
                        asyncio.run(
                            eric_api.process_eric(
                                excel_file=FakeUpload("pack.xlsx"),
                                output_dir=None,
                            )
                        )
            finally:
                eric_api.UPLOAD_DIR = original_upload_dir
                eric_api.eric_module = original_module

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "处理失败，请查看诊断日志或稍后重试")
        self.assertNotIn("secret", context.exception.detail)
        self.assertIn("Eric processing failed", "\n".join(logs.output))


class FakeUpload:
    def __init__(self, filename: str):
        self.filename = filename
        self.file = io.BytesIO(b"not an excel file")


if __name__ == "__main__":
    unittest.main()
