import base64
import os
import sys
import tempfile
import unittest
from datetime import date, datetime

import openpyxl
from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.tms_finance_work_sales_module import (  # noqa: E402
    TmsFinanceWorkSalesModule,
)


SALES_HEADERS = [
    "Style Number",
    "Unit Price(include VAT)",
    "Unit Price(exclude VAT)",
    "Ship Quantity",
    "Total price excluding VAT and VAS",
    "VAS",
    "Promo price upcharge",
    "Sales Amount after deduction",
    "VAT Amount",
    "Gross Amount(include the VAT)",
    "AR Amount",
    "Total amount in Iplex system (include VAT)",
    "Total amount in Iplex system (exclude VAT)",
    "difference",
    "",
    "MERCH",
    "HANDOVER DATE",
    "SALES INVOICE NUMBER",
]

PURCHASE_HEADERS = [
    "Style Number",
    "Unit Price(include VAT)",
    "Unit Price(exclude VAT)",
    "Ship Quantity",
    "Purchase Amount",
    "NET RE-ROUTE SURCHARGE",
    "VAT Amount",
    "RE-ROUTE SURCHARGE",
    "Gross Amount",
    "AP Amount",
    "Total amount in Iplex system (include VAT)",
    "Total amount in Iplex system (exclude VAT)",
    "difference",
    "",
    "",
    "MERCH",
    "HANDOVER DATE",
    "SALES INVOICE NUMBER",
]

WORK_SALES_XLS_FIXTURE = (
    "0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAACQAAAAAAAAAAEAAA/v///wAA"
    "AAD+////AAAAAAgAAAD/////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "//////////////////////////////////////////////////////////////////8JCBAAAAYFALsNzAcAAAAA"
    "BgAAAOEAAgCwBMEAAgAAAOIAAABcAHAATm9uZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg"
    "ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg"
    "ICAgIEIAAgCwBGEBAgAAAD0BAgABAJwAAgAOABkAAgAAABIAAgAAAGMAAgAAABMAAgAAAK8BAgAAALwBAgAAAEAA"
    "AgAAAI0AAgAAAD0AEgDgAVoAzz9OKjgAAAAAAAEAWAIiAAIAAAAOAAIAAQC3AQIAAADaAAIAAAAxABUAyAAAAP9/"
    "kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEABQBBcmlhbDEAFQDIAAAA/3+QAQAAAAABAAUAQXJpYWwx"
    "ABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsMQAVAMgAAAD/f5ABAAAAAAEABQBBcmlhbDEAFQDIAAAA/3+QAQAAAAAB"
    "AAUAQXJpYWwxABUAyAAAAP9/kAEAAAAAAQAFAEFyaWFsHgQMAKQABwAAR2VuZXJhbOAAFAAGAKQA9f8gAAD0AAAA"
    "AAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8g"
    "AAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAG"
    "AKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADA"
    "IOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAA"
    "AAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQA9f8g"
    "AAD0AAAAAAAAAADAIOAAFAAGAKQA9f8gAAD0AAAAAAAAAADAIOAAFAAGAKQAAQAgAAD4AAAAAAAAAADAIOAAFAAH"
    "AKQAAQAgAAD4AAAAAAAAAADAIJMCBAAAgAD/YAECAAEAhQAYAAMGAAAAABAAVHVybm92ZXIgRGV0YWlsc/wAVAIr"
    "AAAAHAAAABkAAFR1cm5vdmVyIERldGFpbHMgTUFZIDIwMjYMAABTdHlsZSBOdW1iZXIXAABVbml0IFByaWNlKGlu"
    "Y2x1ZGUgVkFUKRcAAFVuaXQgUHJpY2UoZXhjbHVkZSBWQVQpDQAAU2hpcCBRdWFudGl0eSEAAFRvdGFsIHByaWNl"
    "IGV4Y2x1ZGluZyBWQVQgYW5kIFZBUwMAAFZBUxQAAFByb21vIHByaWNlIHVwY2hhcmdlHAAAU2FsZXMgQW1vdW50"
    "IGFmdGVyIGRlZHVjdGlvbgoAAFZBVCBBbW91bnQdAABHcm9zcyBBbW91bnQoaW5jbHVkZSB0aGUgVkFUKQkAAEFS"
    "IEFtb3VudCoAAFRvdGFsIGFtb3VudCBpbiBJcGxleCBzeXN0ZW0gKGluY2x1ZGUgVkFUKSoAAFRvdGFsIGFtb3Vu"
    "dCBpbiBJcGxleCBzeXN0ZW0gKGV4Y2x1ZGUgVkFUKQoAAGRpZmZlcmVuY2UFAABNRVJDSA0AAEhBTkRPVkVSIERB"
    "VEUUAABTQUxFUyBJTlZPSUNFIE5VTUJFUgwAAFJDMjYxME9XMDAxLggAAENhcm9saW5lCgAAMjAyNi0wNS0wNw0A"
    "ADE0LTA1LTI2LTAwNjMZAABQdXJjaGFzZSBEZXRhaWxzIE1BWSAyMDI2DwAAUHVyY2hhc2UgQW1vdW50FgAATkVU"
    "IFJFLVJPVVRFIFNVUkNIQVJHRRIAAFJFLVJPVVRFIFNVUkNIQVJHRQwAAEdyb3NzIEFtb3VudAkAAEFQIEFtb3Vu"
    "dAoAAAAJCBAAAAYQALsNzAcAAAAABgAAAA0AAgABAAwAAgBkAA8AAgABABEAAgAAABAACAD8qfHSTWJQP18AAgAA"
    "AIAACAAAAAAAAQAAACUCBAAAAP8AgQACAAEMAAIOAAAAAAALAAAAAAASAAAAKgACAAAAKwACAAAAggACAAEAGwAC"
    "AAAAGgACAAAAFAAFAAIAACZQFQAFAAIAACZGgwACAAEAhAACAAAAJgAIADMzMzMzM9M/JwAIADMzMzMzM9M/KAAI"
    "AIXrUbgeheM/KQAIAK5H4XoUrtc/oQAiAAkAZAABAAEAAQCDACwBLAGamZmZmZm5P5qZmZmZmbk/AQASAAIAAADd"
    "AAIAAAAZAAIAAABjAAIAAAATAAIAAAAIAhAAAAAAAAEA/wAAAAAAAAEPAP0ACgAAAAAAEQAAAAAACAIQAAIAAAAS"
    "AP8AAAAAAAABDwD9AAoAAgAAABEAAQAAAP0ACgACAAEAEQACAAAA/QAKAAIAAgARAAMAAAD9AAoAAgADABEABAAA"
    "AP0ACgACAAQAEQAFAAAA/QAKAAIABQARAAYAAAD9AAoAAgAGABEABwAAAP0ACgACAAcAEQAIAAAA/QAKAAIACAAR"
    "AAkAAAD9AAoAAgAJABEACgAAAP0ACgACAAoAEQALAAAA/QAKAAIACwARAAwAAAD9AAoAAgAMABEADQAAAP0ACgAC"
    "AA0AEQAOAAAAAQIGAAIADgARAP0ACgACAA8AEQAPAAAA/QAKAAIAEAARABAAAAD9AAoAAgARABEAEQAAAAgCEAAD"
    "AAAAEgD/AAAAAAAAAQ8A/QAKAAMAAAARABIAAAABAgYAAwABABEAvQASAAMAAgARAJfDAAARAIYuAAADAL4AHAAD"
    "AAQAEQARABEAEQARABEAEQARABEAEQARAA4A/QAKAAMADwARABMAAAD9AAoAAwAQABEAFAAAAP0ACgADABEAEQAV"
    "AAAACAIQAAQAAAAEAP8AAAAAAAABDwAGACMABAADABEAAwAAAAAA//8AAAAAAAANACUDAAMAA8ADwBkQAAAIAhAA"
    "BgAAAAEA/wAAAAAAAAEPAP0ACgAGAAAAEQAWAAAACAIQAAgAAAASAP8AAAAAAAABDwD9AAoACAAAABEAAQAAAP0A"
    "CgAIAAEAEQACAAAA/QAKAAgAAgARAAMAAAD9AAoACAADABEABAAAAP0ACgAIAAQAEQAXAAAA/QAKAAgABQARABgA"
    "AAD9AAoACAAGABEACQAAAP0ACgAIAAcAEQAZAAAA/QAKAAgACAARABoAAAD9AAoACAAJABEAGwAAAP0ACgAIAAoA"
    "EQAMAAAA/QAKAAgACwARAA0AAAD9AAoACAAMABEADgAAAL4ACgAIAA0AEQARAA4A/QAKAAgADwARAA8AAAD9AAoA"
    "CAAQABEAEAAAAP0ACgAIABEAEQARAAAACAIQAAkAAAASAP8AAAAAAAABDwD9AAoACQAAABEAEgAAAAECBgAJAAEA"
    "EQC9ABIACQACABEA27EAABEAhi4AAAMAvgAcAAkABAARABEAEQARABEAEQARABEAEQARABEADgD9AAoACQAPABEA"
    "EwAAAP0ACgAJABAAEQAUAAAA/QAKAAkAEQARABUAAAAIAhAACgAAAAQA/wAAAAAAAAEPAAYAIwAKAAMAEQADAAAA"
    "AAD//wAAAAAAAA0AJQkACQADwAPAGRAAAD4CEgC2AgAAAABAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAIAAAADAAAA"
    "BAAAAAUAAAAGAAAABwAAAP7////9/////v//////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "////////////////////////////////////////////////////////////////////////////////////////"
    "//////////////////////////////////////////////////9SAG8AbwB0ACAARQBuAHQAcgB5AAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgAFAf//////////AQAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7///8AAAAAAAAAAFcAbwByAGsAYgBvAG8AawAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAIB////////////////AAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH///////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAD+////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf///////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAP7///8AAAAAAAAAAA=="
)


def _sample_rows(count: int = 2) -> list[dict[str, object]]:
    base = [
        {
            "invoice": "14-05-26-0063",
            "style": "RC2610OW001.",
            "sales_price": 125.17,
            "purchase_price": 113.82,
            "quantity": 2977,
            "merch": "Caroline",
            "handover": datetime(2026, 5, 7),
        },
        {
            "invoice": "14-05-26-0062",
            "style": "RC2610OW000.",
            "sales_price": 127.3,
            "purchase_price": 115.6,
            "quantity": 1804,
            "merch": "Caroline",
            "handover": datetime(2026, 5, 7),
        },
    ]
    rows: list[dict[str, object]] = []
    for index in range(count):
        source = base[index % len(base)].copy()
        source["invoice"] = f"{source['invoice']}-{index + 1:03d}"
        rows.append(source)
    return rows


def _write_work_sales_xls_fixture(path: str) -> None:
    with open(path, "wb") as fp:
        fp.write(base64.b64decode(WORK_SALES_XLS_FIXTURE))


class TmsFinanceWorkSalesModuleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = TmsFinanceWorkSalesModule()

    def _create_iplix_workbook(
        self,
        path: str,
        rows: list[dict[str, object]],
        *,
        mismatch_purchase: bool = False,
    ) -> None:
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = "Turnover Details"
        ws["A1"] = "Turnover Details MAY 2026"

        for column, header in enumerate(SALES_HEADERS, start=1):
            ws.cell(3, column).value = header
        for offset, row in enumerate(rows, start=4):
            ws.cell(offset, 1).value = row["style"]
            ws.cell(offset, 3).value = row["sales_price"]
            ws.cell(offset, 4).value = row["quantity"]
            ws.cell(offset, 16).value = row["merch"]
            ws.cell(offset, 17).value = row["handover"]
            ws.cell(offset, 18).value = row["invoice"]
        total_row = 4 + len(rows)
        ws.cell(total_row, 4).value = f"=SUM(D4:D{total_row - 1})"

        purchase_header_row = total_row + 3
        ws.cell(purchase_header_row - 2, 1).value = "Purchase Details MAY 2026"
        for column, header in enumerate(PURCHASE_HEADERS, start=1):
            ws.cell(purchase_header_row, column).value = header
        for offset, row in enumerate(rows, start=purchase_header_row + 1):
            ws.cell(offset, 1).value = (
                "MISMATCH."
                if mismatch_purchase and offset == purchase_header_row + 1
                else row["style"]
            )
            ws.cell(offset, 3).value = row["purchase_price"]
            ws.cell(offset, 4).value = row["quantity"]
            ws.cell(offset, 16).value = row["merch"]
            ws.cell(offset, 17).value = row["handover"]
            ws.cell(offset, 18).value = row["invoice"]
        purchase_total_row = purchase_header_row + 1 + len(rows)
        ws.cell(purchase_total_row, 4).value = (
            f"=SUM(D{purchase_header_row + 1}:D{purchase_total_row - 1})"
        )

        workbook.save(path)

    def _create_reference_workbook(self, path: str, include_optional: bool = True) -> None:
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = "Sheet1"
        headers = [
            "STYLE NUMBER",
            "*BUYER NAME",
            "BILL TO",
            "NAME OF FACTORY",
        ]
        if include_optional:
            headers.extend(["SAS Price", "Promo Price", "Upcharge"])
        ws.append(headers)
        ws.append(
            [
                "RC2610OW001.",
                "Adidas Originals",
                "Adidas Sports (China) Co., Ltd.",
                "DANDONG SLT GARMENT INDUSTRY CO LTD",
                128.88,
                2.5,
                1.25,
            ][: len(headers)]
        )
        workbook.save(path)

    def test_process_creates_single_sheet_summary_with_reference_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            self._create_iplix_workbook(iplix_path, _sample_rows(2))
            self._create_reference_workbook(reference_path)

            result = self.module.process_files(
                iplix_path=iplix_path,
                reference_path=reference_path,
                output_dir=tmpdir,
                today=date(2026, 6, 9),
            )

            self.assertTrue(result["success"])
            self.assertEqual(result["extracted_count"], 2)
            self.assertEqual(result["matched_reference_count"], 1)
            self.assertEqual(result["missing_reference_count"], 1)
            self.assertEqual(result["month_label"], "2026年06月")
            output_wb = openpyxl.load_workbook(result["output_path"])
            try:
                ws = output_wb["Work Sales Summary"]
                headers = [ws.cell(4, column).value for column in range(1, 13)]
                self.assertEqual(
                    headers,
                    [
                        "Invoice No.",
                        "Style Number",
                        "Unit Price (Sales)",
                        "Buyer",
                        "Factory",
                        "Unit Price (Purchase) / Customer Price",
                        "Customer",
                        "Merchandiser",
                        "Handover Date",
                        "SAS Price",
                        "Promo Price",
                        "Upcharge",
                    ],
                )
                self.assertEqual(ws["A2"].value, "月份：2026年06月")
                self.assertEqual(ws["A5"].value, "14-05-26-0063-001")
                self.assertEqual(ws["B5"].value, "RC2610OW001.")
                self.assertEqual(ws["C5"].value, 125.17)
                self.assertEqual(ws["D5"].value, "Adidas Originals")
                self.assertEqual(ws["E5"].value, "SLT")
                self.assertEqual(ws["F5"].value, 113.82)
                self.assertEqual(ws["G5"].value, "Adidas Sports (China) Co., Ltd.")
                self.assertEqual(ws["H5"].value, "Caroline")
                self.assertEqual(ws["J5"].value, 128.88)
                self.assertEqual(ws["K5"].value, 2.5)
                self.assertEqual(ws["L5"].value, 1.25)
                self.assertIsNone(ws["D6"].value)
                self.assertEqual(ws["C5"].number_format, "0.00")
                self.assertEqual(ws["F5"].number_format, "0.00")
            finally:
                output_wb.close()

    def test_records_purchase_mismatch_without_stopping(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            self._create_iplix_workbook(
                iplix_path,
                _sample_rows(2),
                mismatch_purchase=True,
            )
            self._create_reference_workbook(reference_path, include_optional=False)

            result = self.module.process_files(
                iplix_path=iplix_path,
                reference_path=reference_path,
                output_dir=tmpdir,
                today=date(2026, 6, 9),
            )

            self.assertEqual(result["extracted_count"], 2)
            reasons = [item["reason"] for item in result["diagnostics"]]
            self.assertTrue(any("Sales/Purchase 明细不一致" in reason for reason in reasons))
            self.assertTrue(any("参考表缺少可选字段" in reason for reason in reasons))

    def test_dynamic_rows_extracts_eighty_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            self._create_iplix_workbook(iplix_path, _sample_rows(80))
            self._create_reference_workbook(reference_path)

            result = self.module.process_files(
                iplix_path=iplix_path,
                reference_path=reference_path,
                output_dir=tmpdir,
                today=date(2026, 6, 9),
            )

            self.assertEqual(result["extracted_count"], 80)
            output_wb = openpyxl.load_workbook(result["output_path"])
            try:
                ws = output_wb["Work Sales Summary"]
                self.assertEqual(ws.max_row, 84)
                self.assertEqual(ws["A84"].value, "14-05-26-0062-080")
            finally:
                output_wb.close()

    def test_process_reads_legacy_xls_iplix_workbook(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xls")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            _write_work_sales_xls_fixture(iplix_path)
            self._create_reference_workbook(reference_path)

            result = self.module.process_files(
                iplix_path=iplix_path,
                reference_path=reference_path,
                output_dir=tmpdir,
                today=date(2026, 6, 9),
            )

            self.assertEqual(result["extracted_count"], 1)
            self.assertEqual(result["matched_reference_count"], 1)
            output_wb = openpyxl.load_workbook(result["output_path"])
            try:
                ws = output_wb["Work Sales Summary"]
                self.assertEqual(ws["A5"].value, "14-05-26-0063")
                self.assertEqual(ws["B5"].value, "RC2610OW001.")
                self.assertEqual(ws["C5"].value, 125.17)
                self.assertEqual(ws["F5"].value, 113.82)
            finally:
                output_wb.close()

    def test_process_without_optional_reference_keeps_work_sales_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            self._create_iplix_workbook(iplix_path, _sample_rows(2))

            result = self.module.process_files(
                iplix_path=iplix_path,
                reference_path=None,
                output_dir=tmpdir,
                today=date(2026, 6, 9),
            )

            self.assertEqual(result["extracted_count"], 2)
            self.assertEqual(result["matched_reference_count"], 0)
            self.assertEqual(result["missing_reference_count"], 0)
            self.assertEqual(result["source_summary"]["reference_rows"], 0)
            output_wb = openpyxl.load_workbook(result["output_path"])
            try:
                ws = output_wb["Work Sales Summary"]
                self.assertEqual(ws["A5"].value, "14-05-26-0063-001")
                self.assertIsNone(ws["D5"].value)
                self.assertIsNone(ws["E5"].value)
                self.assertIsNone(ws["G5"].value)
                self.assertEqual(ws["H5"].value, "Caroline")
            finally:
                output_wb.close()

    def test_api_processes_upload_and_downloads_result(self) -> None:
        from api.tms_finance_work_sales_api import router

        app = FastAPI()
        app.include_router(router, prefix="/api")
        client = TestClient(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            self._create_iplix_workbook(iplix_path, _sample_rows(2))
            self._create_reference_workbook(reference_path)

            with open(iplix_path, "rb") as iplix_file, open(reference_path, "rb") as reference_file:
                response = client.post(
                    "/api/tms-finance/work-sales/process",
                    files={
                        "iplix_file": (
                            "iplix.xlsx",
                            iplix_file,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                        "reference_file": (
                            "reference.xlsx",
                            reference_file,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                    },
                )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["extracted_count"], 2)
            self.assertEqual(payload["matched_reference_count"], 1)
            self.assertIn("output_file", payload)

            download_response = client.get(
                f"/api/tms-finance/work-sales/download/{payload['output_file']}",
            )
            self.assertEqual(download_response.status_code, 200)

    def test_api_processes_without_optional_reference_file(self) -> None:
        from api.tms_finance_work_sales_api import router

        app = FastAPI()
        app.include_router(router, prefix="/api")
        client = TestClient(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xlsx")
            self._create_iplix_workbook(iplix_path, _sample_rows(2))

            with open(iplix_path, "rb") as iplix_file:
                response = client.post(
                    "/api/tms-finance/work-sales/process",
                    files={
                        "iplix_file": (
                            "iplix.xlsx",
                            iplix_file,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                    },
                )

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["extracted_count"], 2)
            self.assertEqual(payload["source_summary"]["reference_rows"], 0)
            self.assertIn("output_file", payload)

    def test_api_processes_legacy_xls_iplix_upload(self) -> None:
        from api.tms_finance_work_sales_api import router

        app = FastAPI()
        app.include_router(router, prefix="/api")
        client = TestClient(app)

        with tempfile.TemporaryDirectory() as tmpdir:
            iplix_path = os.path.join(tmpdir, "iplix.xls")
            reference_path = os.path.join(tmpdir, "reference.xlsx")
            _write_work_sales_xls_fixture(iplix_path)
            self._create_reference_workbook(reference_path)

            with open(iplix_path, "rb") as iplix_file, open(reference_path, "rb") as reference_file:
                response = client.post(
                    "/api/tms-finance/work-sales/process",
                    files={
                        "iplix_file": (
                            "iplix.xls",
                            iplix_file,
                            "application/vnd.ms-excel",
                        ),
                        "reference_file": (
                            "reference.xlsx",
                            reference_file,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        ),
                    },
                )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["extracted_count"], 1)

    def test_api_rejects_invalid_extension(self) -> None:
        from api.tms_finance_work_sales_api import router

        app = FastAPI()
        app.include_router(router, prefix="/api")
        client = TestClient(app)

        response = client.post(
            "/api/tms-finance/work-sales/process",
            files={
                "iplix_file": ("iplix.txt", b"bad", "text/plain"),
                "reference_file": ("reference.xlsx", b"bad", "application/octet-stream"),
            },
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
