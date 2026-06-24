import os
import sys
import tempfile
import unittest

import openpyxl


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.draft_packing_compare_module import (  # noqa: E402
    DraftPackingCompareModule,
    PackingExtractedPage,
)


DIRECT_AND_ATTACHMENT_DRAFT_TEXT = """
1 THIRTEEN (13) CARTONS OF ADIDAS BRAND GARMENT
WOMEN'S WOVEN JACKET,FROM BODY: 100% COTTON
PO# 0902172742
ARTICLE NO.: KV0625
STYLE NO.: AF26INSPW072
CUST NO.: 0306485444
QUANTITY: 150 PCS
HS Code:620432
PSR 150 PIECES
2 SIXTY ONE (61) CARTONS OF ADIDAS BRAND GARMENT
WOMEN'S WOVEN PANTS,MAIN MATERIAL: 100% COTTON
PSR 537 PIECES
(SEE ATTACHMENT)
11.Declaration by the exporter
Attachment
PO# 0902319411
ARTICLE NO.: LE8303
STYLE NO.: RC2613OW006
CUST NO.: 0306700330
QUANTITY: 537 PCS
HS Code:620462
"""


PACKING_PAGE_TEXT = """
PO No PO Line
Aggregator
Working No Article
No
Article Description Model
No
Model Name Market PO
Number
Category Brand QTY Ctn
Count
Net Net Net Gross Vol Vol Wt
0902172742 1 AF26INSPW072 KV0625 ST DNM WSH JK
CRSK
P6083 ST DNM WSH
JK
0306485444 NOT SPORTS
SPECIFIC
ADIDAS 150 13 108.770 111.770 126.070 0.874 0.000
Sourcing Size/Manufacturing Size HTS Description Quota Category Quantity
A28,A32,A36,A40,A44 62043290 APP/ JACKET 150
Goods Description
WOMEN'S WOVEN ST DNM WSH JACKET,FROM BODY: 100% COTTON
PO No PO Line
Aggregator
Working No Article No Article Description Model No Model Name Market PO
Number
Category Brand QTY Ctn Count Net Net Net Gross Vol Vol Wt
0902319334 1 RC2613OW003 LE8298 SKIRT BLACK CH594 SKIRT 0306699266 ORIGINALS ADIDAS 824 33 314.540 331.020 365.670 1.848 0.000
Goods Description
WOMEN'S WOVEN SKIRT,MAIN MATERIAL: 100% COTTON
"""


PACKING_PAGE = PackingExtractedPage(
    text=PACKING_PAGE_TEXT,
    tables=[
        [
            [
                "PO No",
                "PO Line\nAggregator",
                "Working No",
                "Article\nNo",
                "Article Description",
                "Model\nNo",
                "Model Name",
                "Market PO\nNumber",
                "Category",
                "Brand",
                "QTY",
                "C t n\nCount",
            ],
            [
                "0902172742",
                "1",
                "AF26INSPW072",
                "KV0625",
                "ST DNM WSH JK\nCRSK",
                "P6083",
                "ST DNM WSH\nJK",
                "0306485444",
                "NOT SPORTS\nSPECIFIC",
                "ADIDAS",
                "150",
                "13",
            ],
        ],
        [
            [
                "Sourcing Size/Manufacturing Size",
                "HTS",
                "Description",
                "Quota Category",
                "Quantity",
            ],
            ["A28,A32,A36,A40,A44", "62043290", "APP/ JACKET", "", "150"],
        ],
        [
            [
                "PO No",
                "PO Line\nAggregator",
                "Working No",
                "Article No",
                "Article Description",
                "Model No",
                "Model Name",
                "Market PO\nNumber",
                "Category",
                "Brand",
                "QTY",
                "C t n\nCount",
            ],
            [
                "0902319334",
                "1",
                "RC2613OW003",
                "LE8298",
                "SKIRT BLACK",
                "CH594",
                "SKIRT",
                "0306699266",
                "ORIGINALS",
                "ADIDAS",
                "824",
                "33",
            ],
        ],
    ],
)


PACKING_PAGE_WITH_SUMMARY_FOOTER = PackingExtractedPage(
    text="""
PO No PO Line
0902319350 1 RC2613OW006 LE5888 PANTS 0306700331 ADIDAS 703 78
Goods Description
WOMEN'S WOVEN DENIM PANTS,MAIN MATERIAL: 100% COTTON
This document is a summary and does not contain all the terms and conditions applicable to the transaction.
The complete document may be accessed on the system. Page 6 of 8
""",
    tables=[
        [
            [
                "PO No",
                "PO Line",
                "Working No",
                "Article No",
                "Market PO Number",
                "QTY",
                "C t n Count",
            ],
            [
                "0902319350",
                "1",
                "RC2613OW006",
                "LE5888",
                "0306700331",
                "703",
                "78",
            ],
        ],
    ],
)


CHINA_PERU_FTA_TEXT = """
CERTIFICATE OF ORIGIN
Form for China-Peru FTA
6.Item 7.Number and kind of 8.HS code 9.Origin 10.Gross 11.Number and 12.Invoiced
number Packages;description of (Six digit criterion weight,quantity date of invoice value
(Max goods code) (Quantity Unit)
20) or other
measures (liters,
m³,etc.)
1 EIGHTEEN (18) CARTONS OF KID'S 620462 PSR 67.04% 252 PIECES 10-04-26-0537 USD
WOVEN DENIM PANT,MAIN G.WEIGHT MAY.05,2026 22838.65
MATERIAL:100% COTTON 161.24 KGS
PO# 0902275914
ARTICLE NO.: KU8337
STYLE NO.: OJF26250705
2 SIXTEEN (16) CARTONS OF KID'S 620462 PSR 67.04% 251 PIECES
WOVEN DENIM PANT,MAIN G.WEIGHT
MATERIAL:100% COTTON 107.56 KGS
PO# 0902275872
ARTICLE NO.: KU8317
STYLE NO.: OLKF26250706
3 THIRTY NINE (39) CARTONS OF 620432 PSR 95.21% 504 PIECES
KID'S WOVEN DENIM JACKET,MAIN G.WEIGHT
MATERIAL:100% COTTON 415.23 KGS
PO# 0902275843
ARTICLE NO.: KS1734
STYLE NO.: OJF26250703
***
"""


class FailingOriginCertificateOcr:
    def __init__(self) -> None:
        self.called = False

    def extract_records(self, pdf_path):
        self.called = True
        raise AssertionError("text-readable FTA PDFs should not trigger OCR fallback")


class DraftPackingCompareModuleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = DraftPackingCompareModule()

    def _fill_rgb(self, cell) -> str:
        color = cell.fill.fgColor
        if color.type == "rgb":
            return (color.rgb or "").upper()
        return ""

    def _has_fill(self, cell) -> bool:
        return cell.fill.fill_type is not None

    def test_parse_draft_text_keeps_style_and_article_separate_and_uses_attachment_context(self):
        records = self.module.parse_draft_text(DIRECT_AND_ATTACHMENT_DRAFT_TEXT)

        self.assertEqual(len(records), 2)
        first = records[0]
        self.assertEqual(first.po_number, "0902172742")
        self.assertEqual(first.working_number, "AF26INSPW072")
        self.assertEqual(first.article_number, "KV0625")
        self.assertEqual(first.customer_number, "0306485444")
        self.assertEqual(first.quantity, 150)
        self.assertEqual(first.cartons, 13)
        self.assertEqual(first.cartons_in_words, "THIRTEEN")
        self.assertEqual(first.hs_code, "620432")
        self.assertEqual(first.goods_description, "WOMEN'S WOVEN JACKET,FROM BODY: 100% COTTON")

        attachment = records[1]
        self.assertEqual(attachment.po_number, "0902319411")
        self.assertEqual(attachment.working_number, "RC2613OW006")
        self.assertEqual(attachment.article_number, "LE8303")
        self.assertEqual(attachment.cartons, 61)
        self.assertEqual(attachment.cartons_in_words, "SIXTY ONE")
        self.assertEqual(attachment.goods_description, "WOMEN'S WOVEN PANTS,MAIN MATERIAL: 100% COTTON")

    def test_parse_origin_certificate_pdf_uses_text_fta_records_without_ocr(self):
        ocr = FailingOriginCertificateOcr()
        module = DraftPackingCompareModule(origin_certificate_ocr=ocr)
        module._extract_pdf_text = lambda _pdf_path: CHINA_PERU_FTA_TEXT

        records = module.parse_origin_certificate_pdf("text-readable-fta.pdf")

        self.assertFalse(ocr.called)
        self.assertEqual(len(records), 3)
        first = records[0]
        self.assertEqual(first.po_number, "0902275914")
        self.assertEqual(first.working_number, "OJF26250705")
        self.assertEqual(first.article_number, "KU8337")
        self.assertEqual(first.quantity, 252)
        self.assertEqual(first.cartons, 18)
        self.assertEqual(first.cartons_in_words, "EIGHTEEN")
        self.assertEqual(first.goods_description, "KID'S WOVEN DENIM PANT,MAIN MATERIAL:100% COTTON")
        self.assertEqual(first.hs_code, "620462")
        self.assertTrue(any("Cust Number" in issue for issue in first.issues))

    def test_parse_packing_pages_uses_tables_and_reports_missing_hts(self):
        records = self.module.parse_packing_pages([PACKING_PAGE])

        self.assertEqual(len(records), 2)
        first = records[0]
        self.assertEqual(first.po_number, "0902172742")
        self.assertEqual(first.working_number, "AF26INSPW072")
        self.assertEqual(first.article_number, "KV0625")
        self.assertEqual(first.customer_number, "0306485444")
        self.assertEqual(first.quantity, 150)
        self.assertEqual(first.cartons, 13)
        self.assertEqual(first.hs_code, "62043290")
        self.assertEqual(
            first.goods_description,
            "WOMEN'S WOVEN ST DNM WSH JACKET,FROM BODY: 100% COTTON",
        )

        missing_hts = records[1]
        self.assertEqual(missing_hts.po_number, "0902319334")
        self.assertEqual(missing_hts.hs_code, "")
        self.assertTrue(any("HTS" in issue for issue in missing_hts.issues))

    def test_parse_packing_pages_removes_summary_footer_from_goods_description(self):
        records = self.module.parse_packing_pages([PACKING_PAGE_WITH_SUMMARY_FOOTER])

        self.assertEqual(len(records), 1)
        self.assertEqual(
            records[0].goods_description,
            "WOMEN'S WOVEN DENIM PANTS,MAIN MATERIAL: 100% COTTON",
        )
        self.assertNotIn("This document is a summary", records[0].goods_description)
        self.assertNotIn("Page 6 of 8", records[0].goods_description)

    def test_build_comparison_result_marks_strict_hs_difference(self):
        draft_records = self.module.parse_draft_text(DIRECT_AND_ATTACHMENT_DRAFT_TEXT)
        packing_records = self.module.parse_packing_pages([PACKING_PAGE])

        result = self.module.build_comparison_result(draft_records[:1], packing_records[:1])

        self.assertEqual(result.group_count, 1)
        self.assertEqual(result.issue_count, 2)
        self.assertEqual(result.mismatch_count, 2)
        self.assertEqual(result.missing_field_count, 0)
        self.assertIn("HS Code / HTS Code", result.groups[0].issue_detail)
        self.assertIn("Goods Description", result.groups[0].issue_detail)

    def test_missing_field_status_uses_generic_feedback_label(self):
        records = self.module.parse_packing_pages([PACKING_PAGE])

        result = self.module.build_comparison_result([], records[1:2])

        self.assertEqual(result.groups[0].status, "需反馈")

    def test_process_extracted_data_writes_two_row_excel_with_issue_sheet_and_fills(self):
        draft_records = self.module.parse_draft_text(DIRECT_AND_ATTACHMENT_DRAFT_TEXT)
        packing_records = self.module.parse_packing_pages([PACKING_PAGE])

        with tempfile.TemporaryDirectory() as folder:
            result = self.module.process_extracted_data(draft_records[:1], packing_records[:1], folder)

            self.assertTrue(result["success"])
            self.assertEqual(result["group_count"], 1)
            self.assertEqual(result["issue_count"], 2)

            workbook = openpyxl.load_workbook(result["output_path"])
            ws = workbook["产地证 vs Packing"]
            issues = workbook["Issues"]

            self.assertEqual(
                [cell.value for cell in ws[1]],
                [
                    "PO Number",
                    "Source",
                    "Working Number / Style Number",
                    "Article Number",
                    "Cust Number / Market PO Number",
                    "Quantity",
                    "Cartons",
                    "Cartons In Words",
                    "Goods Description",
                    "HS Code / HTS Code",
                    "Check Status",
                    "Issue Detail",
                ],
            )
            self.assertEqual(ws["A2"].value, "0902172742")
            self.assertEqual(ws["B2"].value, "产地证")
            self.assertEqual(ws["B3"].value, "Packing List")
            self.assertEqual(ws["C2"].value, "AF26INSPW072")
            self.assertEqual(ws["D2"].value, "KV0625")
            self.assertEqual(ws["H2"].value, "THIRTEEN")
            self.assertIsNone(ws["H3"].value)
            self.assertEqual(ws["J2"].value, "620432")
            self.assertEqual(ws["J3"].value, "62043290")
            self.assertEqual(ws["K2"].value, "需核对")
            self.assertEqual(ws.max_row, 3)
            self.assertEqual(self._fill_rgb(ws["J1"]), "FFD9EAF7")
            self.assertFalse(self._has_fill(ws["J2"]))
            self.assertFalse(self._has_fill(ws["J3"]))
            self.assertGreaterEqual(issues.max_row, 2)
            self.assertIn("HS Code / HTS Code", [issues.cell(row=row, column=4).value for row in range(2, issues.max_row + 1)])

    def test_process_extracted_data_uses_filled_blank_separator_rows(self):
        draft_records = self.module.parse_draft_text(DIRECT_AND_ATTACHMENT_DRAFT_TEXT)
        packing_records = self.module.parse_packing_pages([PACKING_PAGE])

        with tempfile.TemporaryDirectory() as folder:
            result = self.module.process_extracted_data(draft_records, packing_records, folder)

            workbook = openpyxl.load_workbook(result["output_path"])
            ws = workbook["产地证 vs Packing"]

            self.assertEqual(ws.max_row, 1 + result["group_count"] * 2 + result["group_count"] - 1)
            separator_rows = [4 + group_index * 3 for group_index in range(result["group_count"] - 1)]

            for row_index in separator_rows:
                values = [ws.cell(row=row_index, column=column_index).value for column_index in range(1, len(self.module.HEADERS) + 1)]
                self.assertTrue(all(value in (None, "") for value in values))
                for column_index in range(1, len(self.module.HEADERS) + 1):
                    cell = ws.cell(row=row_index, column=column_index)
                    self.assertEqual(self._fill_rgb(cell), "FFEFF6FF")

            self.assertEqual(self._fill_rgb(ws["H4"]), "FFEFF6FF")
            self.assertNotEqual(self._fill_rgb(ws["H4"]), "FFFFC7CE")
            self.assertEqual(self._fill_rgb(ws["J4"]), "FFEFF6FF")


if __name__ == "__main__":
    unittest.main()
