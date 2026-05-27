import os
import sys
import unittest

import pandas as pd


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jane_module import JaneModule


class JaneModuleWorkbookTests(unittest.TestCase):
    def setUp(self):
        self.module = JaneModule()

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


if __name__ == "__main__":
    unittest.main()
