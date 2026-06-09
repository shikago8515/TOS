import os
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl
from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.tms_finance_internal_reconciliation_module import (  # noqa: E402
    TmsFinanceInternalReconciliationModule,
)


TARGET_HEADERS = [
    "Date1",
    "Sales invoice",
    "Date2",
    "Purchase invoice",
    "REMARK",
    "VENDOR",
    "CUSTOMER",
    "QTY",
    "Purchase amount",
    "Sales amount  with Tax 13%",
    "货描",
    "WORKING  NO.(款号)",
    "PO ORDER NO.",
    "ARTICLE NO.(货号)",
    "CUSTOMER NO.(客户编码)",
    "CUSTOMER ORDER NO.(客户订单号)",
    "交期",
    "MR",
    "Commercial Invoice",
    "工厂Promo附加费",
    "采购",
    "销售",
]


class TmsFinanceInternalReconciliationModuleTests(unittest.TestCase):
    def setUp(self):
        self.module = TmsFinanceInternalReconciliationModule()

    def _save_target_workbook(self, folder: str, rows_before_append: int = 208) -> str:
        path = os.path.join(folder, "内销对账单.xlsx")
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = "未清账"
        ws.append(TARGET_HEADERS)
        for row in range(2, rows_before_append + 1):
            ws.append([
                "2026-04-30",
                f"sales-{row}",
                "2026-04-30",
                f"purchase-{row}",
                "SAMPLE",
                "VENT",
                "adidas",
                1,
                1.11,
                2.22,
                "历史货描",
                f"HISTORY{row}",
                f"PO{row}",
                f"ART{row}",
                "825059",
                "",
                "2026-04-30",
                "Jane",
                f"FS{row}",
                "",
                "",
                "",
            ])
        archive = workbook.create_sheet("清 from 2407")
        archive.append(TARGET_HEADERS)
        archive.append([
            "2024-07-05",
            "old-sales",
            "2024-07-05",
            "old-purchase",
            "BULK",
            "SLT",
            "adidas",
            1,
            1,
            1,
            "归档",
            "ARCHIVE",
            "0900000001",
            "AA0001",
            "825057",
            "0300000001",
            "2024-07-05",
            "Rosa",
            "",
            "",
            "",
            "",
        ])
        workbook.save(path)
        return path

    def _append_source_headers(self, ws, header_row: int) -> None:
        ws.cell(header_row, 1).value = "Pack"
        ws.cell(header_row, 2).value = "Season"
        ws.cell(header_row, 3).value = "款号"
        ws.cell(header_row, 4).value = "颜色"
        ws.cell(header_row, 5).value = "描述"
        ws.cell(header_row, 6).value = "订单号"
        ws.cell(header_row, 7).value = "客户订单号"
        ws.cell(header_row, 8).value = "客户编号"
        ws.cell(header_row, 9).value = "客户仓库"
        ws.cell(header_row, 10).value = "大货交期"
        ws.cell(header_row, 11).value = "数量"
        ws.cell(header_row, 12).value = "工厂价格"
        ws.cell(header_row + 1, 12).value = "单价"
        ws.cell(header_row + 1, 14).value = "PO总金额=单价*PO件数+PO税金"
        ws.cell(header_row, 15).value = "TMS价格"
        ws.cell(header_row + 1, 15).value = "单价"
        ws.cell(header_row + 1, 17).value = "VAS/SHAS附加费"
        ws.cell(header_row + 1, 18).value = "PO总金额=单价*PO件数+PO税金+VAS/SHAS"
        ws.cell(header_row, 19).value = "工厂"
        ws.cell(header_row + 1, 19).value = "工厂code"
        ws.cell(header_row + 1, 20).value = "工厂"
        ws.cell(header_row, 22).value = "TMS 业务"
        ws.cell(header_row, 24).value = "TMS发票#"

    def _append_source_row(
        self,
        ws,
        row: int,
        *,
        remark: str,
        style: str,
        order: str,
        article: str,
        qty: int | float,
        purchase_amount: float,
        sales_amount: float,
        vendor_code: str = "1L8006",
        vendor_name: str = "丹东新龙太",
        customer_order: str = "(blank)",
        commercial_invoice: str | None = None,
    ) -> None:
        ws.cell(row, 1).value = "FW26"
        ws.cell(row, 2).value = "FW26"
        ws.cell(row, 3).value = style
        ws.cell(row, 4).value = article
        ws.cell(row, 5).value = "女式梭织上衣"
        ws.cell(row, 6).value = order
        ws.cell(row, 7).value = customer_order
        ws.cell(row, 8).value = "825059" if remark == "SAMPLE" else "825057"
        ws.cell(row, 9).value = "MSO" if remark == "SAMPLE" else "天津仓"
        ws.cell(row, 10).value = "2026-05-13" if remark == "SAMPLE" else "2026-05-07"
        ws.cell(row, 11).value = qty
        ws.cell(row, 14).value = purchase_amount
        ws.cell(row, 17).value = 0.96 if remark == "SAMPLE" else 969.58
        ws.cell(row, 18).value = sales_amount
        ws.cell(row, 19).value = vendor_code
        ws.cell(row, 20).value = vendor_name
        ws.cell(row, 22).value = "Bacy" if remark == "SAMPLE" else "Caroline"
        ws.cell(row, 24).value = commercial_invoice

    def _save_sample_workbook(self, folder: str) -> str:
        path = os.path.join(folder, "合并Sample 202605.xlsx")
        workbook = openpyxl.Workbook()
        hidden = workbook.active
        hidden.title = "仅供中国单使用-4月份出货"
        hidden.sheet_state = "hidden"
        self._append_source_headers(hidden, 2)
        self._append_source_row(
            hidden,
            4,
            remark="SAMPLE",
            style="SHOULD_IGNORE",
            order="4500000000",
            article="OLD001",
            qty=99,
            purchase_amount=99,
            sales_amount=99,
        )

        ws = workbook.create_sheet("5月")
        self._append_source_headers(ws, 2)
        for offset in range(14):
            purchase = 3.39 if offset < 13 else 376.29
            sales = 7.86 if offset < 13 else 377.37
            self._append_source_row(
                ws,
                4 + offset,
                remark="SAMPLE",
                style=f"RC2613OW{offset:03d}",
                order=f"4501749{offset:03d}",
                article=f"LE{8200 + offset}",
                qty=3,
                purchase_amount=purchase,
                sales_amount=sales,
            )
        ws.cell(18, 1).value = None
        ws.cell(19, 11).value = 42
        ws.cell(19, 14).value = 420.36
        ws.cell(19, 18).value = 479.55

        dc = workbook.create_sheet("DC")
        dc.append(["客户编号", "客户仓库"])
        dc.append(["825059", "MSO"])
        workbook.save(path)
        return path

    def _save_bulk_workbook(self, folder: str) -> str:
        path = os.path.join(folder, "合并BULK 202605.xlsx")
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = "仅供中国单使用-5月"
        self._append_source_headers(ws, 1)
        quantities = [10, 10, 20, 30, 50, 60, 100, 120]
        purchases = [11.3, 11.3, 22.6, 33.9, 113, 135.6, 226, 406.8]
        sales = [1118.23, 2848.08, 1047.98, 2747.43, 1739.13, 991.37, 1160.86, 2467.04]
        for offset, qty in enumerate(quantities):
            self._append_source_row(
                ws,
                3 + offset,
                remark="BULK",
                style=f"RC2610OW{offset:03d}",
                order=f"0901888{offset:03d}",
                article=f"KX{1867 + offset}",
                qty=qty,
                purchase_amount=purchases[offset],
                sales_amount=sales[offset],
                vendor_name="SLT",
                customer_order=f"03058{offset:05d}",
            )
        ws.cell(11, 1).value = None
        ws.cell(12, 11).value = 400
        ws.cell(12, 14).value = 960.5
        ws.cell(12, 18).value = 14120.12
        workbook.save(path)
        return path

    def test_appends_sample_then_bulk_rows_and_preserves_target_workbook(self):
        with tempfile.TemporaryDirectory() as folder:
            target_path = self._save_target_workbook(folder)
            sample_path = self._save_sample_workbook(folder)
            bulk_path = self._save_bulk_workbook(folder)

            result = self.module.process_files(sample_path, bulk_path, target_path, folder)

            self.assertTrue(result["success"])
            self.assertEqual(result["appended_count"], 22)
            self.assertEqual(result["skipped_count"], 0)
            self.assertEqual(result["source_summary"]["sample_rows"], 14)
            self.assertEqual(result["source_summary"]["bulk_rows"], 8)
            self.assertEqual(result["totals"]["quantity"], 442)
            self.assertEqual(result["totals"]["purchase_amount"], 1380.86)
            self.assertEqual(result["totals"]["sales_amount_with_tax"], 14599.67)

            output_wb = openpyxl.load_workbook(result["output_path"], data_only=False)
            self.assertIn("清 from 2407", output_wb.sheetnames)
            ws = output_wb["未清账"]
            self.assertEqual(ws.max_row, 230)
            self.assertEqual(ws.cell(209, 5).value, "SAMPLE")
            self.assertEqual(ws.cell(209, 6).value, "SLT")
            self.assertEqual(ws.cell(209, 7).value, "adidas")
            self.assertEqual(ws.cell(209, 8).value, 3)
            self.assertEqual(ws.cell(209, 9).value, 3.39)
            self.assertEqual(ws.cell(209, 10).value, 7.86)
            self.assertIsNone(ws.cell(209, 16).value)
            self.assertEqual(ws.cell(209, 18).value, "Bacy")
            self.assertIsNone(ws.cell(209, 1).value)
            self.assertIsNone(ws.cell(209, 2).value)
            self.assertEqual(ws.cell(222, 5).value, "SAMPLE")
            self.assertEqual(ws.cell(223, 5).value, "BULK")
            self.assertEqual(ws.cell(223, 6).value, "SLT")
            self.assertEqual(ws.cell(230, 8).value, 120)
            self.assertEqual(ws.cell(230, 9).value, 406.8)
            self.assertEqual(ws.cell(230, 10).value, 2467.04)
            self.assertEqual(
                output_wb["清 from 2407"].cell(2, 12).value,
                "ARCHIVE",
            )

    def test_skips_duplicate_keys_without_modifying_existing_row(self):
        with tempfile.TemporaryDirectory() as folder:
            target_path = self._save_target_workbook(folder, rows_before_append=2)
            target_wb = openpyxl.load_workbook(target_path)
            ws = target_wb["未清账"]
            ws.cell(2, 5).value = "SAMPLE"
            ws.cell(2, 12).value = "RC2613OW000."
            ws.cell(2, 13).value = "4501749000"
            ws.cell(2, 14).value = "LE8200"
            ws.cell(2, 8).value = 99
            target_wb.save(target_path)

            sample_path = self._save_sample_workbook(folder)
            bulk_path = self._save_bulk_workbook(folder)

            result = self.module.process_files(sample_path, bulk_path, target_path, folder)

            self.assertTrue(result["success"])
            self.assertEqual(result["appended_count"], 21)
            self.assertEqual(result["skipped_count"], 1)
            self.assertEqual(result["duplicate_count"], 1)
            self.assertEqual(result["diagnostics"][0]["reason"], "目标已存在")

            output_wb = openpyxl.load_workbook(result["output_path"], data_only=False)
            ws = output_wb["未清账"]
            self.assertEqual(ws.cell(2, 8).value, 99)
            self.assertEqual(ws.cell(3, 12).value, "RC2613OW001")

    def test_api_uploads_processes_and_downloads_result(self):
        with tempfile.TemporaryDirectory() as folder:
            sample_path = self._save_sample_workbook(folder)
            bulk_path = self._save_bulk_workbook(folder)
            target_path = self._save_target_workbook(folder)

            from api import tms_finance_internal_reconciliation_api as api

            original_upload_dir = api.UPLOAD_DIR
            api.UPLOAD_DIR = folder
            app = FastAPI()
            app.include_router(api.router, prefix="/api")
            client = TestClient(app)
            try:
                with (
                    open(sample_path, "rb") as sample_file,
                    open(bulk_path, "rb") as bulk_file,
                    open(target_path, "rb") as target_file,
                ):
                    response = client.post(
                        "/api/tms-finance/internal-reconciliation/process",
                        files={
                            "sample_file": (
                                "合并Sample 202605.xlsx",
                                sample_file,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            ),
                            "bulk_file": (
                                "合并BULK 202605.xlsx",
                                bulk_file,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            ),
                            "target_file": (
                                "内销对账单 202605.xlsx",
                                target_file,
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            ),
                        },
                    )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload["success"])
                self.assertEqual(payload["appended_count"], 22)
                self.assertTrue(payload["output_file"].endswith(".xlsx"))

                download = client.get(
                    f"/api/tms-finance/internal-reconciliation/download/{payload['output_file']}",
                )
                self.assertEqual(download.status_code, 200)
                self.assertGreater(len(download.content), 1000)

                bad_response = client.post(
                    "/api/tms-finance/internal-reconciliation/process",
                    files={
                        "sample_file": ("sample.csv", b"x", "text/csv"),
                        "bulk_file": ("bulk.xlsx", b"x", "application/octet-stream"),
                        "target_file": ("target.xlsx", b"x", "application/octet-stream"),
                    },
                )
                self.assertEqual(bad_response.status_code, 400)
            finally:
                api.UPLOAD_DIR = original_upload_dir


if __name__ == "__main__":
    unittest.main()
