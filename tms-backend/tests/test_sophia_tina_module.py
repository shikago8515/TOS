import os
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.sophia_tina_module import SophiaTinaModule


class SophiaTinaModulePricePriorityTests(unittest.TestCase):
    def setUp(self):
        self.module = SophiaTinaModule()

    def _write_excel(self, directory: Path, name: str, rows: list[dict]) -> str:
        path = directory / name
        pd.DataFrame(rows).to_excel(path, index=False)
        return str(path)

    def test_tms_price_uses_milestone_priority_order_instead_of_source_row_order(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            work_dir = Path(temp_dir)
            tms_path = self._write_excel(
                work_dir,
                "tms.xlsx",
                [
                    {
                        "Factory": "FACTORY-A",
                        "Working Number": "WN-FINAL",
                        "Article Number": "ART-F",
                        "Article Description": "Final article",
                        "Customer Request Date (CRD)": "2026-06-01",
                        "PODD": "2026-07-01",
                        "Gps Customer Number": "GPS-1",
                        "Country/Region": "US",
                        "Ordered Quantity": 2,
                    },
                    {
                        "Factory": "FACTORY-B",
                        "Working Number": "WN-P2",
                        "Article Number": "ART-P2",
                        "Article Description": "P2 article",
                        "Customer Request Date (CRD)": "2026-06-02",
                        "PODD": "2026-07-02",
                        "Gps Customer Number": "GPS-2",
                        "Country/Region": "CN",
                        "Ordered Quantity": 3,
                    },
                    {
                        "Factory": "FACTORY-C",
                        "Working Number": "WN-P1",
                        "Article Number": "ART-P1",
                        "Article Description": "P1 article",
                        "Customer Request Date (CRD)": "2026-06-03",
                        "PODD": "2026-07-03",
                        "Gps Customer Number": "GPS-3",
                        "Country/Region": "BR",
                        "Ordered Quantity": 4,
                    },
                    {
                        "Factory": "FACTORY-D",
                        "Working Number": "WN-PREC",
                        "Article Number": "ART-PREC",
                        "Article Description": "PREC article",
                        "Customer Request Date (CRD)": "2026-06-04",
                        "PODD": "2026-07-04",
                        "Gps Customer Number": "GPS-4",
                        "Country/Region": "ZA",
                        "Ordered Quantity": 5,
                    },
                ],
            )
            article_path = self._write_excel(
                work_dir,
                "article.xlsx",
                [
                    {
                        "Working Number (M)": "WN-FINAL",
                        "Article Number (A)": "ART-F",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 100,
                        "Milestone (C)": "P2",
                        "Intl. FOB (C)": 9.99,
                    },
                    {
                        "Working Number (M)": "WN-FINAL",
                        "Article Number (A)": "ART-F",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 100,
                        "Milestone (C)": "P1",
                        "Intl. FOB (C)": 7.5,
                    },
                    {
                        "Working Number (M)": "WN-FINAL",
                        "Article Number (A)": "ART-F",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 100,
                        "Milestone (C)": "Final",
                        "Intl. FOB (C)": 15.25,
                    },
                    {
                        "Working Number (M)": "WN-P2",
                        "Article Number (A)": "ART-P2",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 200,
                        "Milestone (C)": "P1",
                        "Intl. FOB (C)": 8.75,
                    },
                    {
                        "Working Number (M)": "WN-P2",
                        "Article Number (A)": "ART-P2",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 200,
                        "Milestone (C)": "PREC",
                        "Intl. FOB (C)": 3.0,
                    },
                    {
                        "Working Number (M)": "WN-P2",
                        "Article Number (A)": "ART-P2",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 200,
                        "Milestone (C)": "P2",
                        "Intl. FOB (C)": 12.5,
                    },
                    {
                        "Working Number (M)": "WN-P1",
                        "Article Number (A)": "ART-P1",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 300,
                        "Milestone (C)": "PREC",
                        "Intl. FOB (C)": 4.5,
                    },
                    {
                        "Working Number (M)": "WN-P1",
                        "Article Number (A)": "ART-P1",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 300,
                        "Milestone (C)": "P1",
                        "Intl. FOB (C)": 13.0,
                    },
                    {
                        "Working Number (M)": "WN-PREC",
                        "Article Number (A)": "ART-PREC",
                        "Season (M)": "SS26",
                        "Marketing Forecast (M)": 400,
                        "Milestone (C)": "PREC",
                        "Intl. FOB (C)": 6.75,
                    },
                ],
            )
            price_path = self._write_excel(
                work_dir,
                "price.xlsx",
                [
                    {
                        "Season": "SS26",
                        "Working Number": "WN-FINAL",
                        "Article Number": "ART-F",
                        "Factory": "FACTORY-A",
                        "Factory Price": 11.0,
                    },
                    {
                        "Season": "SS26",
                        "Working Number": "WN-P2",
                        "Article Number": "ART-P2",
                        "Factory": "FACTORY-B",
                        "Factory Price": 7.0,
                    },
                    {
                        "Season": "SS26",
                        "Working Number": "WN-P1",
                        "Article Number": "ART-P1",
                        "Factory": "FACTORY-C",
                        "Factory Price": 8.0,
                    },
                    {
                        "Season": "SS26",
                        "Working Number": "WN-PREC",
                        "Article Number": "ART-PREC",
                        "Factory": "FACTORY-D",
                        "Factory Price": 9.0,
                    },
                ],
            )
            pack_path = self._write_excel(
                work_dir,
                "pack.xlsx",
                [
                    {"Pack": "PACK-SS26", "Season": "SS26", "Working Number": "WN-FINAL"},
                    {"Pack": "PACK-SS26", "Season": "SS26", "Working Number": "WN-P2"},
                    {"Pack": "PACK-SS26", "Season": "SS26", "Working Number": "WN-P1"},
                    {"Pack": "PACK-SS26", "Season": "SS26", "Working Number": "WN-PREC"},
                ],
            )

            result = self.module.process_reports(
                [tms_path],
                [article_path],
                [price_path],
                [pack_path],
                str(work_dir),
            )

            self.assertTrue(result["success"], result["message"])
            wb = load_workbook(result["output_path"], data_only=True)
            ws = wb["Result"]
            headers = [cell.value for cell in ws[1]]
            column_by_name = {name: index + 1 for index, name in enumerate(headers)}
            rows_by_working = {
                ws.cell(row=row_index, column=column_by_name["Working Number"]).value: row_index
                for row_index in range(2, ws.max_row + 1)
            }

            final_row = rows_by_working["WN-FINAL"]
            self.assertEqual(
                ws.cell(final_row, column=column_by_name["TMS Price(USD)"]).value,
                15.25,
            )
            self.assertEqual(
                ws.cell(final_row, column=column_by_name["TMS Amount(USD)"]).value,
                30.5,
            )

            p2_row = rows_by_working["WN-P2"]
            self.assertEqual(
                ws.cell(p2_row, column=column_by_name["TMS Price(USD)"]).value,
                12.5,
            )
            self.assertEqual(
                ws.cell(p2_row, column=column_by_name["TMS Amount(USD)"]).value,
                37.5,
            )

            p1_row = rows_by_working["WN-P1"]
            self.assertEqual(
                ws.cell(p1_row, column=column_by_name["TMS Price(USD)"]).value,
                13.0,
            )
            self.assertEqual(
                ws.cell(p1_row, column=column_by_name["TMS Amount(USD)"]).value,
                52.0,
            )

            prec_row = rows_by_working["WN-PREC"]
            self.assertEqual(
                ws.cell(prec_row, column=column_by_name["TMS Price(USD)"]).value,
                6.75,
            )
            self.assertEqual(
                ws.cell(prec_row, column=column_by_name["TMS Amount(USD)"]).value,
                33.75,
            )


if __name__ == "__main__":
    unittest.main()
