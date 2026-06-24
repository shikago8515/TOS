import os
import sys
import tempfile
import unittest
from datetime import date
from typing import Any, Dict, List

from openpyxl import Workbook, load_workbook
import pandas as pd


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jessca_module import InvoiceRecord, JesscaModule, PackingListRecord


class JesscaModuleReferenceTableTests(unittest.TestCase):
    def setUp(self):
        self.module = JesscaModule()

    def _build_reference_df(self) -> pd.DataFrame:
        return pd.DataFrame(
            [
                {"Price": 12.34, "Style NO.": "STYLE-OK", "Article NO.": "ART-OK"},
                {"Price": 20.0, "Style NO.": "STYLE-PRICE", "Article NO.": "ART-PRICE"},
                {"Price": 10.0, "Style NO.": "STYLE-GOOD", "Article NO.": "ART-STYLE"},
                {"Price": 11.0, "Style NO.": "STYLE-ARTICLE", "Article NO.": "ART-ARTICLE"},
                {"Price": 7.0, "Style NO.": "STYLE-MULTI-A", "Article NO.": "ART-MULTI"},
                {"Price": 7.0, "Style NO.": "STYLE-MULTI-B", "Article NO.": "ART-MULTI"},
                {"Price": 8.0, "Style NO.": "STYLE-NOT-INVOICE", "Article NO.": "ART-NOT-INVOICE"},
            ]
        )

    def _sheet_records(self, worksheet: Any) -> List[Dict[str, Any]]:
        header_row_index = None
        headers = []
        for row_index, row in enumerate(worksheet.iter_rows(values_only=True), 1):
            row_values = list(row)
            if "核对状态" in row_values or "状态" in row_values:
                header_row_index = row_index
                headers = row_values
                break

        self.assertIsNotNone(header_row_index)
        records = []
        for row in worksheet.iter_rows(min_row=header_row_index + 1, values_only=False):
            values = [cell.value for cell in row]
            if not any(value not in (None, "") for value in values):
                continue
            records.append(
                {
                    "values": dict(zip(headers, values)),
                    "cells": dict(zip(headers, row)),
                }
            )
        return records

    def test_update_reference_table_accepts_title_case_headers(self):
        ref_df = pd.DataFrame(
            [
                {"Price": 12.34, "Style NO.": "STYLE-1", "Article NO.": "ART-1"},
                {"Price": 99.0, "Style NO.": "STYLE-2", "Article NO.": "ART-2"},
            ]
        )
        invoice_data = {
            ("ART-1", "STYLE-1"): {"invoice-a.xls": 12.34},
            ("ART-2", "STYLE-2"): {"invoice-b.xls": 88.0},
        }

        result_df, matches = self.module.update_reference_table(ref_df, invoice_data)

        self.assertEqual(matches, {"一致": 1, "不一致": 1, "未找到": 0})
        self.assertEqual(result_df.loc[0, "核对状态"], "一致")
        self.assertEqual(result_df.loc[1, "核对状态"], "价格不一致")
        self.assertEqual(result_df.loc[1, "发票价格"], 88.0)

    def test_update_reference_table_classifies_two_field_diagnostics(self):
        ref_df = self._build_reference_df()
        invoice_data = {
            ("ART-OK", "STYLE-OK"): {"ok.xls": 12.34},
            ("ART-PRICE", "STYLE-PRICE"): {"price.xls": 19.5},
            ("ART-STYLE", "STYLE-WRONG"): {"style.xls": 10.0},
            ("ART-WRONG", "STYLE-ARTICLE"): {"article.xls": 11.0},
            ("ART-MULTI", "STYLE-WRONG"): {"multi.xls": 7.0},
        }

        result_df, matches = self.module.update_reference_table(ref_df, invoice_data)

        self.assertEqual(matches, {"一致": 1, "不一致": 5, "未找到": 1})
        status_by_article = dict(zip(result_df["Article NO."], result_df["核对状态"]))
        field_by_article = dict(zip(result_df["Article NO."], result_df["疑似错误字段"]))

        self.assertEqual(status_by_article["ART-OK"], "一致")
        self.assertEqual(status_by_article["ART-PRICE"], "价格不一致")
        self.assertEqual(status_by_article["ART-STYLE"], "发票款号疑似错误")
        self.assertEqual(status_by_article["ART-ARTICLE"], "发票Article疑似错误")
        self.assertEqual(status_by_article["ART-MULTI"], "字段疑似错误-候选多条")
        self.assertEqual(status_by_article["ART-NOT-INVOICE"], "未在发票中找到")

        self.assertEqual(field_by_article["ART-STYLE"], "款号")
        self.assertEqual(field_by_article["ART-ARTICLE"], "Article")
        self.assertEqual(field_by_article["ART-MULTI"], "款号")
        self.assertEqual(
            result_df.loc[result_df["Article NO."] == "ART-STYLE", "建议参考款号"].iloc[0],
            "STYLE-GOOD",
        )
        self.assertEqual(
            result_df.loc[result_df["Article NO."] == "ART-ARTICLE", "建议参考Article"].iloc[0],
            "ART-ARTICLE",
        )

    def test_summary_lookup_accepts_title_case_headers(self):
        ref_df = pd.DataFrame(
            [
                {"Price": 12.34, "Style NO.": "STYLE-1", "Article NO.": "ART-1"},
                {"Price": 99.0, "Style NO.": "STYLE-2", "Article NO.": "ART-2"},
            ]
        )
        invoice_data = {
            ("ART-1", "STYLE-1"): {"invoice-a.xls": 12.34},
            ("ART-2", "STYLE-2"): {"invoice-b.xls": 88.0},
        }
        result_df, _ = self.module.update_reference_table(ref_df, invoice_data)

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, "result.xlsx")
            save_result = self.module.save_excel_with_summary(
                result_df,
                invoice_data,
                ["invoice-a.xls", "invoice-b.xls"],
                ["invoice-a.xls", "invoice-b.xls"],
                ref_df,
                output_path,
            )

        self.assertEqual(save_result["missing_count"], 0)
        self.assertEqual(save_result["data_count"], 2)

    def test_summary_sheet_outputs_diagnostics_and_status_colors(self):
        ref_df = self._build_reference_df()
        invoice_data = {
            ("ART-OK", "STYLE-OK"): {"ok.xls": 12.34},
            ("ART-STYLE", "STYLE-WRONG"): {"style.xls": 10.0},
            ("ART-WRONG", "STYLE-ARTICLE"): {"article.xls": 11.0},
            ("ART-MULTI", "STYLE-WRONG"): {"multi.xls": 7.0},
            ("ART-MISSING", "STYLE-MISSING"): {"missing.xls": 99.0},
        }
        result_df, _ = self.module.update_reference_table(ref_df, invoice_data)

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, "result.xlsx")
            save_result = self.module.save_excel_with_summary(
                result_df,
                invoice_data,
                ["ok.xls", "style.xls", "article.xls", "multi.xls", "missing.xls"],
                ["ok.xls", "style.xls", "article.xls", "multi.xls", "missing.xls"],
                ref_df,
                output_path,
            )
            workbook = load_workbook(output_path)

        self.assertEqual(save_result["diagnostics"]["一致"], 1)
        self.assertEqual(save_result["diagnostics"]["发票款号疑似错误"], 1)
        self.assertEqual(save_result["diagnostics"]["发票Article疑似错误"], 1)
        self.assertEqual(save_result["diagnostics"]["字段疑似错误-候选多条"], 1)
        self.assertEqual(save_result["diagnostics"]["参考表未找到"], 1)

        summary_records = self._sheet_records(workbook["汇总表"])
        summary_by_invoice = {
            record["values"]["来源发票"]: record
            for record in summary_records
            if record["values"].get("来源发票") not in (None, "-")
        }

        style_record = summary_by_invoice["style.xls"]
        article_record = summary_by_invoice["article.xls"]
        multi_record = summary_by_invoice["multi.xls"]
        missing_record = summary_by_invoice["missing.xls"]

        self.assertEqual(style_record["values"]["状态"], "发票款号疑似错误")
        self.assertEqual(style_record["values"]["疑似错误字段"], "款号")
        self.assertEqual(style_record["values"]["建议参考款号"], "STYLE-GOOD")
        self.assertEqual(article_record["values"]["状态"], "发票Article疑似错误")
        self.assertEqual(article_record["values"]["建议参考Article"], "ART-ARTICLE")
        self.assertEqual(multi_record["values"]["状态"], "字段疑似错误-候选多条")
        self.assertEqual(missing_record["values"]["状态"], "参考表未找到")
        self.assertEqual(style_record["cells"]["状态"].fill.fgColor.rgb, "FFFFDDDD")
        self.assertEqual(missing_record["cells"]["状态"].fill.fgColor.rgb, "FFFFFFCC")

        main_records = self._sheet_records(workbook["核对结果"])
        main_by_article = {
            record["values"]["Article NO."]: record
            for record in main_records
            if record["values"].get("Article NO.")
        }
        self.assertEqual(main_by_article["ART-STYLE"]["values"]["核对状态"], "发票款号疑似错误")
        self.assertEqual(main_by_article["ART-NOT-INVOICE"]["values"]["核对状态"], "未在发票中找到")
        self.assertEqual(main_by_article["ART-STYLE"]["cells"]["核对状态"].fill.fgColor.rgb, "FFFFDDDD")
        self.assertEqual(main_by_article["ART-NOT-INVOICE"]["cells"]["核对状态"].fill.fgColor.rgb, "FFFFFFCC")

    def test_read_invoice_records_extracts_header_po_quantity_and_price(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            invoice_path = os.path.join(temp_dir, "invoice.xlsx")
            wb = Workbook()
            ws = wb.active
            ws["I4"] = "Inv#:"
            ws["J4"] = "10-06-26-0712"
            ws["I7"] = "Date:"
            ws["J7"] = date(2026, 6, 7)
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([" PO NO.", "STOCK NO.", "COLOR", "DESCRIPTIONS", None, "QTY(PC)", "UNIT PRICE(PC)", None, "FOB"])
            ws.append(["WOMEN'S KNITTED SHORT"])
            ws.append(["PO:", "0902694555", None, None, None, 200, "USD", 6.6, "USD", 1320.0])
            ws.append(["ARTICLE NO.:", "LG4321"])
            ws.append(["STYLE NO.:", "RC2620OW008"])
            wb.save(invoice_path)

            records = self.module.read_invoice_records(invoice_path)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].invoice_file, "invoice.xlsx")
        self.assertEqual(records[0].invoice_number, "10-06-26-0712")
        self.assertEqual(records[0].invoice_date, "2026-06-07")
        self.assertEqual(records[0].po_number, "0902694555")
        self.assertEqual(records[0].article, "LG4321")
        self.assertEqual(records[0].style, "RC2620OW008")
        self.assertEqual(records[0].quantity, 200)
        self.assertEqual(records[0].price, 6.6)

    def test_read_invoice_records_extracts_inline_no_and_month_date_header(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            invoice_path = os.path.join(temp_dir, "invoice.xlsx")
            wb = Workbook()
            ws = wb.active
            ws["J4"] = "NO: 17-05-26-1190"
            ws["J7"] = "DATE: MAY 25 2026"
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([" PO NO.", "STOCK NO.", "COLOR", "DESCRIPTIONS", None, "QTY(PC)", "UNIT PRICE(PC)", None, "FOB"])
            ws.append(["WOMEN'S WOVEN TRACK TOP"])
            ws.append(["PO:", "0902590165", None, None, None, 100, "USD", 15.55, "USD", 1555.0])
            ws.append(["ARTICLE NO.:", "LD5339"])
            ws.append(["STYLE NO.:", "RC2613OW007"])
            wb.save(invoice_path)

            records = self.module.read_invoice_records(invoice_path)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].invoice_number, "17-05-26-1190")
        self.assertEqual(records[0].invoice_date, "2026-05-25")
        self.assertEqual(records[0].po_number, "0902590165")
        self.assertEqual(records[0].article, "LD5339")
        self.assertEqual(records[0].style, "RC2613OW007")

    def test_read_invoice_records_extracts_split_inv_no_label_header(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            invoice_path = os.path.join(temp_dir, "invoice.xlsx")
            wb = Workbook()
            ws = wb.active
            ws["G4"] = "INV NO.:"
            ws["H4"] = "10-04-26-0460"
            ws["G7"] = "DATE:"
            ws["H7"] = date(2026, 4, 15)
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([])
            ws.append([" PO NO.", "STOCK NO.", "COLOR", "DESCRIPTIONS", None, "QTY(PC)", "UNIT PRICE(PC)", None, "FOB"])
            ws.append(["WOMEN'S WOVEN ST DNM WSH JACKET"])
            ws.append(["PO#", "0902187227", None, None, None, 342, "USD", 21.8, "USD", 7455.6])
            ws.append(["ARTICLE NO.:", "KV0625"])
            ws.append(["STYLE NO.:", "AF26INSPW072"])
            wb.save(invoice_path)

            records = self.module.read_invoice_records(invoice_path)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].invoice_number, "10-04-26-0460")
        self.assertEqual(records[0].invoice_date, "2026-04-15")
        self.assertEqual(records[0].po_number, "0902187227")
        self.assertEqual(records[0].article, "KV0625")
        self.assertEqual(records[0].style, "AF26INSPW072")

    def test_build_packing_list_comparison_matches_invoice_and_flags_quantity(self):
        invoice_records = [
            InvoiceRecord(
                invoice_file="invoice.xlsx",
                invoice_number="10-06-26-0712",
                invoice_date="2026-06-07",
                po_number="0902694555",
                article="LG4321",
                style="RC2620OW008",
                quantity=200,
                price=6.6,
            ),
            InvoiceRecord(
                invoice_file="invoice.xlsx",
                invoice_number="10-06-26-0712",
                invoice_date="2026-06-07",
                po_number="0902694557",
                article="LG4323",
                style="RC2620OW008",
                quantity=200,
                price=6.6,
            ),
        ]
        packing_records = [
            PackingListRecord(
                invoice_number="10-06-26-0712",
                ex_factory_date="2026-06-07",
                po_number="0902694555",
                working_number="RC2620OW008",
                article_number="LG4321",
                customer_number="0307073961",
                quantity=200,
                cartons=7,
            ),
            PackingListRecord(
                invoice_number="10-06-26-0712",
                ex_factory_date="2026-06-07",
                po_number="0902694557",
                working_number="RC2620OW008",
                article_number="LG4323",
                customer_number="0307073963",
                quantity=180,
                cartons=7,
            ),
        ]

        rows = self.module.build_packing_list_comparison(invoice_records, packing_records)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].status, "一致")
        self.assertEqual(rows[0].issue_detail, "")
        self.assertEqual(rows[1].status, "需核对")
        self.assertIn("QTY", rows[1].issue_detail)
        self.assertEqual(rows[1].invoice_quantity, 200)
        self.assertEqual(rows[1].packing_quantity, 180)

    def test_save_excel_with_summary_adds_packing_list_sheet_when_rows_exist(self):
        ref_df = pd.DataFrame(
            [{"Price": 6.6, "Style NO.": "RC2620OW008", "Article NO.": "LG4321"}],
        )
        invoice_data = {("LG4321", "RC2620OW008"): {"invoice.xlsx": 6.6}}
        result_df, _ = self.module.update_reference_table(ref_df, invoice_data)
        packing_rows = self.module.build_packing_list_comparison(
            [
                InvoiceRecord(
                    invoice_file="invoice.xlsx",
                    invoice_number="10-06-26-0712",
                    invoice_date="2026-06-07",
                    po_number="0902694555",
                    article="LG4321",
                    style="RC2620OW008",
                    quantity=200,
                    price=6.6,
                )
            ],
            [
                PackingListRecord(
                    invoice_number="10-06-26-0712",
                    ex_factory_date="2026-06-07",
                    po_number="0902694555",
                    working_number="RC2620OW008",
                    article_number="LG4321",
                    customer_number="0307073961",
                    quantity=200,
                    cartons=7,
                )
            ],
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = os.path.join(temp_dir, "result.xlsx")
            save_result = self.module.save_excel_with_summary(
                result_df,
                invoice_data,
                ["invoice.xlsx"],
                ["invoice.xlsx"],
                ref_df,
                output_path,
                packing_comparison_rows=packing_rows,
            )
            workbook = load_workbook(output_path)

        self.assertIn("Packing List核对", workbook.sheetnames)
        self.assertEqual(save_result["packing_count"], 1)
        self.assertEqual(save_result["packing_matched_count"], 1)
        self.assertEqual(save_result["packing_issue_count"], 0)
        packing_sheet = workbook["Packing List核对"]
        headers = [cell.value for cell in packing_sheet[2]]
        self.assertIn("PO No", headers)
        self.assertIn("Invoice No", headers)
        self.assertIn("Invoice Date", headers)
        self.assertIn("Packing QTY", headers)
        self.assertEqual(packing_sheet["A3"].value, "一致")
        self.assertEqual(packing_sheet["C3"].value, "10-06-26-0712")
        self.assertEqual(packing_sheet["E3"].value, "2026-06-07")

    def test_process_invoices_merges_multiple_packing_pdf_records(self):
        class MultiPackingJesscaModule(JesscaModule):
            def __init__(self):
                super().__init__()
                self.read_packing_paths: List[str] = []

            def read_invoice_records(self, _invoice_path: str) -> List[InvoiceRecord]:
                return [
                    InvoiceRecord(
                        invoice_file="invoice.xlsx",
                        invoice_number="10-06-26-0712",
                        invoice_date="2026-06-07",
                        po_number="0902694555",
                        article="LG4321",
                        style="RC2620OW008",
                        quantity=200,
                        price=6.6,
                    ),
                    InvoiceRecord(
                        invoice_file="invoice.xlsx",
                        invoice_number="10-06-26-0712",
                        invoice_date="2026-06-07",
                        po_number="0902694557",
                        article="LG4323",
                        style="RC2620OW008",
                        quantity=180,
                        price=7.1,
                    ),
                ]

            def read_packing_list_records(self, packing_path: str) -> List[PackingListRecord]:
                self.read_packing_paths.append(packing_path)
                if packing_path.endswith("packing-a.pdf"):
                    return [
                        PackingListRecord(
                            invoice_number="10-06-26-0712",
                            ex_factory_date="2026-06-07",
                            po_number="0902694555",
                            working_number="RC2620OW008",
                            article_number="LG4321",
                            customer_number="0307073961",
                            quantity=200,
                            cartons=7,
                        )
                    ]

                return [
                    PackingListRecord(
                        invoice_number="10-06-26-0712",
                        ex_factory_date="2026-06-07",
                        po_number="0902694557",
                        working_number="RC2620OW008",
                        article_number="LG4323",
                        customer_number="0307073963",
                        quantity=180,
                        cartons=5,
                    )
                ]

        with tempfile.TemporaryDirectory() as temp_dir:
            ref_path = os.path.join(temp_dir, "reference.xlsx")
            pd.DataFrame(
                [
                    {"Price": 6.6, "Style NO.": "RC2620OW008", "Article NO.": "LG4321"},
                    {"Price": 7.1, "Style NO.": "RC2620OW008", "Article NO.": "LG4323"},
                ]
            ).to_excel(ref_path, index=False)

            module = MultiPackingJesscaModule()
            result = module.process_invoices(
                [os.path.join(temp_dir, "invoice.xlsx")],
                ref_path,
                temp_dir,
                packing_paths=[
                    os.path.join(temp_dir, "packing-a.pdf"),
                    os.path.join(temp_dir, "packing-b.pdf"),
                ],
            )

        self.assertTrue(result["success"])
        self.assertEqual(len(module.read_packing_paths), 2)
        self.assertEqual(result["packing_count"], 2)
        self.assertEqual(result["packing_matched_count"], 2)
        self.assertEqual(result["packing_issue_count"], 0)


if __name__ == "__main__":
    unittest.main()
