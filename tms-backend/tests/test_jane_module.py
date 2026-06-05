import os
import sys
import tempfile
from typing import Any, Dict, List
import unittest

import openpyxl
import pandas as pd


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jane_module import JaneModule


class JaneModuleWorkbookTests(unittest.TestCase):
    def setUp(self):
        self.module = JaneModule()

    def _tms_row(
        self,
        working_number: str,
        article_number: str,
        country: str,
        customer_no: str,
        po_number: int,
        po_line: int,
        ordered_quantity: int,
    ) -> Dict[str, Any]:
        return {
            "Working Number": working_number,
            "PO Number": po_number,
            "Market PO Number": po_number,
            "PO Line Item #": po_line,
            "Company Code": "TMS",
            "Article Number": article_number,
            "Article Description": f"{article_number} color",
            "Customer Request Date (CRD)": "2026-07-01",
            "PODD": "2026-07-10",
            "Plant Code": "P1",
            "Customer Size Run": "",
            "Technical Notation": "",
            "Shipment Mode": "Ocean",
            "Gps Customer Number": customer_no,
            "Country/Region": country,
            "Technical Size": "36",
            "Customer Size": "36",
            "Ordered Quantity": ordered_quantity,
            "Factory": "F1",
        }

    def _country_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "CST NO": row["Gps Customer Number"],
                "DESTINATION": row["Country/Region"],
                "REGION": "EMEA" if row["Country/Region"] in {"SOUTH AFRICA", "USA", "CANADA"} else "APAC",
            }
            for row in rows
        ]

    def _process_rows(
        self,
        rows: List[Dict[str, Any]],
        working_filters: List[str] | None = None,
        country_rows: List[Dict[str, Any]] | None = None,
    ) -> openpyxl.Workbook:
        with tempfile.TemporaryDirectory() as temp_dir:
            tms_path = os.path.join(temp_dir, "Copy of TMS.xlsx")
            country_path = os.path.join(temp_dir, "country.xlsx")
            pd.DataFrame(rows).to_excel(tms_path, sheet_name="Result Set", index=False)
            pd.DataFrame(country_rows or self._country_rows(rows)).to_excel(country_path, index=False)

            result = self.module.process_reports(
                tms_path=tms_path,
                country_path=country_path,
                working_filters=working_filters,
                output_dir=temp_dir,
            )

            self.assertTrue(result["success"], result["message"])
            return openpyxl.load_workbook(result["output_path"], data_only=False)

    def test_subtotal_po_qty_sums_po_qty_column_rows(self):
        df = pd.DataFrame(
            [
                {
                    "Working Number": "WN-001",
                    "PO Number": 823016,
                    "Market PO Number": 823016,
                    "PO Line Item #": 10,
                    "Company Code": "TMS",
                    "Article Number": "ART-1",
                    "Customer Request Date (CRD)": "2026-07-01",
                    "PODD": "2026-07-10",
                    "Plant Code": "P1",
                    "Customer Size Run": "",
                    "Technical Notation": "",
                    "Shipment Mode": "By Sea",
                    "Gps Customer Number": "848012",
                    "Technical Size": "A28",
                    "Customer Size": "A/XS",
                    "Ordered Quantity": 58,
                },
                {
                    "Working Number": "WN-001",
                    "PO Number": 823016,
                    "Market PO Number": 823016,
                    "PO Line Item #": 20,
                    "Company Code": "TMS",
                    "Article Number": "ART-1",
                    "Customer Request Date (CRD)": "2026-07-01",
                    "PODD": "2026-07-10",
                    "Plant Code": "P1",
                    "Customer Size Run": "",
                    "Technical Notation": "",
                    "Shipment Mode": "By Sea",
                    "Gps Customer Number": "848012",
                    "Technical Size": "A32",
                    "Customer Size": "A/S",
                    "Ordered Quantity": 94,
                },
            ]
        )

        wb = self.module.create_auto_workbook(df, ["WN-001"], {}, [])
        ws = wb["WN-001"]

        subtotal_row = next(
            row_idx
            for row_idx in range(1, ws.max_row + 1)
            if ws.cell(row=row_idx, column=14).value == "Sub. Total "
        )
        po_qty_col = next(
            col_idx
            for col_idx in range(1, ws.max_column + 1)
            if ws.cell(row=1, column=col_idx).value == "PO QTY"
        )
        po_qty_letter = ws.cell(row=1, column=po_qty_col).column_letter

        self.assertEqual(
            ws.cell(row=subtotal_row, column=po_qty_col).value,
            f"=SUM({po_qty_letter}3:{po_qty_letter}{subtotal_row - 1})",
        )

    def test_south_africa_is_merged_into_europe_category(self) -> None:
        rows = [
            self._tms_row("WN-001", "ART-1", "SOUTH AFRICA", "1001", 101, 10, 400),
        ]

        wb = self._process_rows(rows)
        ws = wb["WN-001"]
        category_helper_col = next(
            col_idx
            for col_idx in range(1, ws.max_column + 1)
            if ws.cell(row=1, column=col_idx).value == "_Jane_CATEGORY"
        )
        category_labels = [
            ws.cell(row=row_idx, column=6).value
            for row_idx in range(1, ws.max_row + 1)
        ]
        data_categories = [
            ws.cell(row=row_idx, column=category_helper_col).value
            for row_idx in range(2, ws.max_row + 1)
            if ws.cell(row=row_idx, column=category_helper_col).value
        ]

        self.assertIn("欧美单", category_labels)
        self.assertNotIn("南非单", category_labels)
        self.assertEqual(["欧美单"], data_categories)

    def test_legacy_south_africa_category_is_merged_into_europe_category(self) -> None:
        rows = [
            self._tms_row("WN-001", "ART-1", "", "1001", 101, 10, 400),
        ]
        country_rows = [
            {
                "CST NO": "1001",
                "DESTINATION": "",
                "REGION": "",
                "CATEGORY": "南非单",
            }
        ]

        wb = self._process_rows(rows, country_rows=country_rows)
        ws = wb["WN-001"]
        category_helper_col = next(
            col_idx
            for col_idx in range(1, ws.max_column + 1)
            if ws.cell(row=1, column=col_idx).value == "_Jane_CATEGORY"
        )
        data_categories = [
            ws.cell(row=row_idx, column=category_helper_col).value
            for row_idx in range(2, ws.max_row + 1)
            if ws.cell(row=row_idx, column=category_helper_col).value
        ]

        self.assertEqual(["欧美单"], data_categories)

    def test_process_reports_sorts_workbook_by_article_country_working(self) -> None:
        rows = [
            self._tms_row("WN-B", "ART-2", "SOUTH AFRICA", "1003", 103, 10, 30),
            self._tms_row("WN-C", "ART-1", "CANADA", "1002", 102, 10, 20),
            self._tms_row("WN-A", "ART-1", "CANADA", "1001", 101, 10, 10),
            self._tms_row("WN-B", "ART-1", "USA", "1004", 104, 10, 40),
        ]

        wb = self._process_rows(rows)
        summary_rows = []
        current_working = None
        for row in wb["Summary"].iter_rows(min_row=3, max_col=3, values_only=True):
            if row[1]:
                current_working = row[1]
            if current_working and row[2]:
                summary_rows.append((current_working, row[2]))

        self.assertEqual(["Summary", "WN-A", "WN-C", "WN-B"], wb.sheetnames)
        self.assertEqual(
            [
                ("WN-A", "ART-1"),
                ("WN-C", "ART-1"),
                ("WN-B", "ART-1"),
                ("WN-B", "ART-2"),
            ],
            summary_rows,
        )

    def test_working_filter_keeps_filtered_rows_sorted(self) -> None:
        rows = [
            self._tms_row("WN-B", "ART-2", "SOUTH AFRICA", "1003", 103, 10, 30),
            self._tms_row("WN-C", "ART-1", "CANADA", "1002", 102, 10, 20),
            self._tms_row("WN-A", "ART-1", "CANADA", "1001", 101, 10, 10),
        ]

        wb = self._process_rows(rows, working_filters=["WN-B", "WN-A"])

        self.assertEqual(["Summary", "WN-A", "WN-B"], wb.sheetnames)


if __name__ == "__main__":
    unittest.main()
