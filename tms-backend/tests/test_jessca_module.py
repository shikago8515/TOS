import os
import sys
import tempfile
import unittest

import pandas as pd


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jessca_module import JesscaModule


class JesscaModuleReferenceTableTests(unittest.TestCase):
    def setUp(self):
        self.module = JesscaModule()

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
        self.assertEqual(result_df.loc[1, "核对状态"], "不一致")
        self.assertEqual(result_df.loc[1, "发票价格"], 88.0)

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


if __name__ == "__main__":
    unittest.main()
