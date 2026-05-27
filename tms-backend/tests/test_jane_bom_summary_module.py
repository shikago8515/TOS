import os
import sys
import tempfile
import unittest

import openpyxl


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jane_bom_summary_module import JaneBomSummaryModule


class JaneBomSummaryModuleTests(unittest.TestCase):
    def setUp(self):
        self.module = JaneBomSummaryModule()

    def _save_pack_workbook(self, folder):
        path = os.path.join(folder, "Pack.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Sheet1"
        ws.append(["Pack", "Season", "Working Number", "Merch"])
        ws.append(["SS26 ASOS Pack", "SS26", "RC2610OW007H2H", "Diana"])
        wb.save(path)
        return path

    def _save_bom_workbook(self, folder):
        path = os.path.join(folder, "BOM-CH512-1L8006-20261.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "CH512-1L8006-20261"

        ws["A1"] = "Working #"
        ws["B1"] = "RC2610OW007H2H"
        ws["A3"] = "Season"
        ws["B3"] = "SS26"
        ws["A5"] = "Factory"
        ws["B5"] = "1L8006 | DANDONG SLT GARMENT INDUSTRY | B"
        ws["P9"] = "DEFAULT GROUP - BLACK | LD1813 | IN RANGE"
        ws["R9"] = "DEFAULT GROUP - CRYSTAL SKY S26 | LD1812 | IN RANGE"

        headers = [
            "Variation",
            "Part Name",
            "Part ID",
            "Part Group #",
            "Material Reference #",
            "Material Name",
            "Group Code Supplier",
            "Supplier Name",
            "Supplier Material ID",
            "Supplier Material Name",
            "Material Description",
            "Material Supplier Lifecycle",
            "Material Lifecycle Validate",
            "Part Remark",
            "Color Layer Name",
            "Color",
            "Color Treatments",
            "Color",
        ]
        for column_index, value in enumerate(headers, start=1):
            ws.cell(row=10, column=column_index, value=value)

        ws["B11"] = "MAIN COMPONENT"
        ws.append([
            "",
            "B main body",
            "7155",
            "10",
            "70020171",
            "70020171 Satin",
            "1SB001",
            "TMS (CHN)",
            '="70020171_1SB001"',
            "",
            "97%POLYESTER",
            "Released",
            "",
            "",
            "",
            "095A BLACK",
            "",
            "AE65 CRYSTAL SKY S26",
        ])
        ws["B13"] = "TRIM"
        ws.append([
            "",
            "B trim",
            "",
            "200",
            "80011226",
            "80011226 Tape",
            "1SB001",
            "TMS (CHN)",
            "",
            "",
            "Tape",
            "",
            "",
            "",
            "",
            "095A BLACK",
            "",
            "001A WHITE",
        ])
        wb.save(path)
        return path

    def test_generates_rows_from_main_component_with_pack_lookup(self):
        with tempfile.TemporaryDirectory() as folder:
            pack_path = self._save_pack_workbook(folder)
            bom_path = self._save_bom_workbook(folder)

            result = self.module.process_reports([bom_path], pack_path, folder)

            self.assertTrue(result["success"])
            self.assertEqual(result["row_count"], 2)

            output_wb = openpyxl.load_workbook(result["output_path"], data_only=False)
            ws = output_wb.active
            rows = list(ws.iter_rows(values_only=True))

            self.assertEqual(
                rows[0],
                (
                    "Pack",
                    "Working #",
                    "Season",
                    "Factory",
                    "Articles",
                    "Part Group #",
                    "Material Reference #",
                    "Material Name",
                    "Group Code Supplier",
                    "Supplier Name",
                    "Material Description",
                    "Color",
                ),
            )
            self.assertEqual(rows[1][0:6], (
                "SS26 ASOS Pack",
                "RC2610OW007H2H",
                "SS26",
                "1L8006 | DANDONG SLT GARMENT INDUSTRY | B",
                "LD1813",
                "10",
            ))
            self.assertEqual(rows[1][6:12], (
                "70020171",
                "70020171 Satin",
                "1SB001",
                "TMS (CHN)",
                "97%POLYESTER",
                "095A BLACK",
            ))
            self.assertEqual(rows[2][4], "LD1812")
            self.assertEqual(rows[2][11], "AE65 CRYSTAL SKY S26")

    def test_rejects_ambiguous_pack_mapping(self):
        with tempfile.TemporaryDirectory() as folder:
            pack_path = self._save_pack_workbook(folder)
            wb = openpyxl.load_workbook(pack_path)
            ws = wb.active
            ws.append(["Different Pack", "SS26", "RC2610OW007H2H", "Diana"])
            wb.save(pack_path)

            bom_path = self._save_bom_workbook(folder)

            result = self.module.process_reports([bom_path], pack_path, folder)

            self.assertFalse(result["success"])
            self.assertIn("Pack 表存在重复映射", result["message"])


if __name__ == "__main__":
    unittest.main()
