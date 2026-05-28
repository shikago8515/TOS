import os
import sys
import tempfile
import unittest

import openpyxl
from openpyxl.styles import PatternFill


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.jane_bom_compare_module import JaneBomCompareModule


class JaneBomCompareModuleTests(unittest.TestCase):
    def setUp(self):
        self.module = JaneBomCompareModule()

    def _fill_rgb(self, cell):
        color = cell.fill.fgColor
        if color.type == "rgb":
            return (color.rgb or "").upper()
        return ""

    def _has_fill(self, cell):
        return cell.fill.fill_type is not None

    def _column_by_header(self, ws, header):
        for cell in ws[1]:
            if cell.value == header:
                return cell.column
        self.fail(f"未找到表头：{header}")

    def _save_production_workbook(self, folder):
        path = os.path.join(folder, "T1 PRODUCTION.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "PRODUCTION"

        headers = [
            "Style ID",
            "Production Lot ID",
            "Production Quantity (in Units)",
            "Units",
            "Production Date",
            "Recording Facility ID",
            "Input Material UID/ID",
            "Input Material Lot ID/ TC Lot No",
            "TC Ref. Number/ Invoice Number",
            "Input Lot Quantity Used (In Kgs)",
            "Input Lot Quantity Used (In Units)",
            "Input Units",
            "Seller Facility ID",
            "Input Material Production Date",
            "Input Material Type",
            "Input Material Name",
            "Material Composition(%)",
            "Year",
            "Season",
            "Status",
            "WORKING",
            "MER",
            "PACK",
        ]
        ws.append(headers)

        orange_fill = PatternFill("solid", fgColor="FFFFD966")
        green_fill = PatternFill("solid", fgColor="FFD9EAD3")
        for index, cell in enumerate(ws[1], start=1):
            # 测试保留原始 T1 表头样式，避免输出时被重建成纯文本表。
            cell.fill = green_fill if 7 <= index <= 12 else orange_fill

        ws.append([
            "LD1803",
            "OHO055-M-LD1803",
            6450,
            "Each",
            "2026-02-01",
            "3LP001",
            "70020171",
            "IC2501220171",
            "Z71GH26YT008",
            2801.14,
            9588,
            "Yards",
            "2SX001",
            "",
            0,
            "",
            "",
            2026,
            "Spring/Summer",
            "Submit",
            "RC2610OW005H2H",
            "Diana",
            "SS26 ASOS Pack",
        ])
        for column in range(1, 24):
            ws.cell(row=2, column=column).fill = green_fill if 7 <= column <= 12 else orange_fill
        wb.save(path)
        return path

    def _save_bom_workbook(self, folder):
        path = os.path.join(folder, "BOM-SF342-3LP001-20261.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "SF342-3LP001-20261"

        ws["A1"] = "Working #"
        ws["B1"] = "RC2610OW005H2H"
        ws["A3"] = "Season"
        ws["B3"] = "SS26"
        ws["A5"] = "Factory"
        ws["B5"] = "3LP001 | XO TEX INDUSTRIAL CO., LTD. | A"
        ws["A6"] = "Articles"
        ws["B6"] = "LD1803"
        ws["P9"] = "DEFAULT GROUP - NIGHT INDIGO | LD1803 | IN RANGE"

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
        ]
        for column_index, value in enumerate(headers, start=1):
            ws.cell(row=10, column=column_index, value=value)

        ws["B11"] = "MAIN COMPONENT"
        ws.append([
            "",
            "T main body",
            "575",
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
            "117A NIGHT INDIGO",
            "",
        ])
        ws.append([
            "",
            "T pocket bags",
            "9505",
            "20",
            "62712089",
            "62712089 Tricot",
            "299002",
            "HUAFENG (CHINA)",
            '="62712089_299002"',
            "",
            "100%POLYESTER",
            "Released",
            "",
            "",
            "",
            "117A NIGHT INDIGO",
            "",
        ])
        ws["B14"] = "TRIM"
        ws.append([
            "",
            "T trim tape",
            "18195",
            "205",
            "80011255",
            "80011255 Tape",
            "1SB001",
            "TMS (CHN)",
            '="80011255_1SB001"',
            "",
            "Tape",
            "Released",
            "",
            "",
            "",
            "117A NIGHT INDIGO",
            "",
        ])
        wb.save(path)
        return path

    def test_marks_supplier_mismatch_and_reports_missing_bom_material_without_appending_rows(self):
        with tempfile.TemporaryDirectory() as folder:
            production_path = self._save_production_workbook(folder)
            bom_path = self._save_bom_workbook(folder)

            result = self.module.process_reports(production_path, [bom_path], folder)

            self.assertTrue(result["success"])
            self.assertEqual(result["mismatch_cell_count"], 1)
            self.assertEqual(result["missing_row_count"], 1)
            self.assertEqual(result["bom_material_row_count"], 2)

            output_wb = openpyxl.load_workbook(result["output_path"])
            ws = output_wb["PRODUCTION"]

            self.assertEqual(self._fill_rgb(ws["A1"]), "FFFFD966")
            self.assertEqual(self._fill_rgb(ws["G1"]), "FFD9EAD3")
            self.assertEqual(ws.max_row, 2)

            correct_material_col = self._column_by_header(ws, "Correct Material Reference # (BOM)")
            seller_col = self._column_by_header(ws, "Seller Facility ID")
            correct_supplier_col = self._column_by_header(ws, "Correct Group Code Supplier (BOM)")
            result_col = self._column_by_header(ws, "Check Result")
            source_col = self._column_by_header(ws, "Mismatch Source")
            detail_col = self._column_by_header(ws, "Check Detail")
            bom_file_col = self._column_by_header(ws, "BOM Source File")
            bom_row_col = self._column_by_header(ws, "BOM Source Row")

            self.assertEqual(ws.cell(row=2, column=correct_material_col - 1).value, "70020171")
            self.assertFalse(self._has_fill(ws.cell(row=2, column=correct_material_col - 1)))
            self.assertIsNone(ws.cell(row=2, column=correct_material_col).value)
            self.assertFalse(self._has_fill(ws.cell(row=2, column=correct_material_col)))
            self.assertEqual(ws.cell(row=2, column=seller_col).value, "2SX001")
            self.assertEqual(self._fill_rgb(ws.cell(row=2, column=seller_col)), "FFFFC7CE")
            self.assertEqual(ws.cell(row=2, column=correct_supplier_col).value, "1SB001")
            self.assertFalse(self._has_fill(ws.cell(row=2, column=correct_supplier_col)))
            self.assertFalse(self._has_fill(ws["A2"]))
            self.assertFalse(self._has_fill(ws["F2"]))
            self.assertEqual(ws.cell(row=2, column=result_col).value, "需核对")
            self.assertEqual(ws.cell(row=2, column=source_col).value, "值不一致：以 BOM 为准")
            self.assertIn("Group Code Supplier", ws.cell(row=2, column=detail_col).value)
            self.assertIn("BOM 还有未在 T1 PRODUCTION 出现的材料", ws.cell(row=2, column=detail_col).value)
            self.assertIn("62712089/299002", ws.cell(row=2, column=detail_col).value)
            self.assertEqual(ws.cell(row=2, column=bom_file_col).value, "BOM-SF342-3LP001-20261.xlsx")
            self.assertEqual(ws.cell(row=2, column=bom_row_col).value, 12)


if __name__ == "__main__":
    unittest.main()
