import os
import sys
import tempfile
import unittest
from typing import Any, Dict, List

from openpyxl import load_workbook
import pandas as pd


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jessca_module import JesscaModule


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


if __name__ == "__main__":
    unittest.main()
