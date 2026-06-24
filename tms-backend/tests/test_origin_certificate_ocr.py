import os
import sys
import unittest


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.origin_certificate_ocr import OriginCertificateOcrParser  # noqa: E402


FORM_E_OCR_TEXT = """
FORM E
1 FIVE (5) CARTONS OF ADIDAS BRAND GARMENT
WOMEN'S WOVEN CHECK PANTS, MAIN MATERIAL: 100% COTTON
P0# 0902318083 CUST 0RDER# 0306700297 ART# LD5340
STYLE#: RC26130W001 HS CODE 6204.63 347 PIECES
2 SIX (6) CARTONS OF ADIDAS BRAND GARMENT
WOMEN'S WOVEN KNIT TOP, MAIN MATERIAL: 100% POLYESTER
PO#:0902318090 CUST ORDER#:0306700301 ARTICLE#:LE8309
STYLE#:RC26130W002 HS CODE:6204.69 335PIECES
"""


GENERIC_CO_OCR_TEXT = """
CERTIFICATE OF ORIGIN
7. NUMBER AND KIND OF PACKAGES; DESCRIPTION OF GOODS
FIVE (5) CARTONS WOMEN'S WOVEN PANTS
STYLE#:RC26130W008 ARTICLE#:LE8309 PO#:0902319191 CUST ORDER#:0306694689
SIX (6) CARTONS WOMEN'S WOVEN JACKET
STYLE#:RC26130W013 ARTICLE#:LE8320 PO#:0902319190 CUST ORDER#:0306694690
SEVEN (7) CARTONS WOMEN'S WOVEN SKIRT
STYLE#:RC26130W014 ARTICLE#:LE8324 PO#:0902319189 CUST ORDER#:0306694691
8. H.S.CODE
62.04
61.14
61.04
9. QUANTITY
105PIECES
110 PIECES
110PIECES
"""


GENERIC_CO_CONTINUATION_PAGES = [
    """
CERTIFICATE OF ORIGIN
STYLE#:RC26130W008 ARTICLE#:LE8308 PO#:0902319247 CUST ORDER#:0306694623
STYLE#:RC26130W013 ARTICLE#:LE8321 PO#:0902318128 CUST ORDER#:0306694628STYLE#:RC26130W013
ARTICLE#:LE8319PO#:0902319249 CUST ORDER#:0306694627STYLE#:RC26130W014
H.S.CODE 62.04 61.14 61.14 61.04 61.04
QUANTITY 471PIECES 312PIECES 362PIECES 312PIECES 362PIECES
""",
    """
CONTINUATION PAGE
ARTICLE#:LE8323PO#:0902319248 CUST ORDER#:0306694630STYLE#:RC26130W014
ARTICLE#:LE8322PO#:0902319250 CUST ORDER#:0306694629
""",
]


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


class OriginCertificateOcrParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.parser = OriginCertificateOcrParser()

    def test_parse_form_e_ocr_text_extracts_records(self):
        records = self.parser.parse_text(FORM_E_OCR_TEXT)

        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].po_number, "0902318083")
        self.assertEqual(records[0].customer_number, "0306700297")
        self.assertEqual(records[0].article_number, "LD5340")
        self.assertEqual(records[0].working_number, "RC26130W001")
        self.assertEqual(records[0].hs_code, "620463")
        self.assertEqual(records[0].quantity, 347)
        self.assertEqual(records[0].cartons, 5)
        self.assertEqual(records[0].cartons_in_words, "FIVE")
        self.assertIn("WOMEN'S WOVEN CHECK PANTS", records[0].goods_description)

    def test_parse_generic_china_co_pairs_detail_hs_and_quantity_by_sequence(self):
        records = self.parser.parse_text(GENERIC_CO_OCR_TEXT)

        self.assertEqual(len(records), 3)
        self.assertEqual([record.po_number for record in records], ["0902319191", "0902319190", "0902319189"])
        self.assertEqual([record.article_number for record in records], ["LE8309", "LE8320", "LE8324"])
        self.assertEqual([record.working_number for record in records], ["RC26130W008", "RC26130W013", "RC26130W014"])
        self.assertEqual([record.customer_number for record in records], ["0306694689", "0306694690", "0306694691"])
        self.assertEqual([record.hs_code for record in records], ["6204", "6114", "6104"])
        self.assertEqual([record.quantity for record in records], [105, 110, 110])
        self.assertEqual([record.cartons for record in records], [5, 6, 7])

    def test_parse_generic_china_co_merges_continuation_pages(self):
        records = self.parser.parse_pages(GENERIC_CO_CONTINUATION_PAGES)

        self.assertEqual(len(records), 5)
        self.assertEqual(records[-1].po_number, "0902319250")
        self.assertEqual(records[-1].article_number, "LE8322")
        self.assertEqual(records[-1].hs_code, "6104")
        self.assertEqual(records[-1].quantity, 362)

    def test_parse_china_co_keeps_unpaired_table_rows_without_inventing_po(self):
        records = self.parser.parse_text(
            """
            STYLE#:RC26200W021 ARTICLE#:LG4267 PO#:0902599825 CUST ORDER#:0307079016
            STYLE#:RC26200W019 ARTICLE#:LG4263 PO#:0902599824 CUST ORDER#:0307079018
            8. H.S.Code
            9. Quantity
            62.04
            120PIECES
            61.14
            100PIECES
            61.04
            100PIECES
            """
        )

        self.assertEqual(len(records), 3)
        self.assertEqual([record.hs_code for record in records], ["6204", "6114", "6104"])
        self.assertEqual([record.quantity for record in records], [120, 100, 100])
        self.assertEqual(records[2].po_number, "")
        self.assertEqual(records[2].article_number, "")

    def test_parse_china_peru_fta_item_blocks_extracts_records(self):
        records = self.parser.parse_text(CHINA_PERU_FTA_TEXT)

        self.assertEqual(len(records), 3)
        self.assertEqual([record.po_number for record in records], ["0902275914", "0902275872", "0902275843"])
        self.assertEqual([record.article_number for record in records], ["KU8337", "KU8317", "KS1734"])
        self.assertEqual([record.working_number for record in records], ["OJF26250705", "OLKF26250706", "OJF26250703"])
        self.assertEqual([record.hs_code for record in records], ["620462", "620462", "620432"])
        self.assertEqual([record.quantity for record in records], [252, 251, 504])
        self.assertEqual([record.cartons for record in records], [18, 16, 39])
        self.assertEqual([record.cartons_in_words for record in records], ["EIGHTEEN", "SIXTEEN", "THIRTY NINE"])
        self.assertEqual(
            records[0].goods_description,
            "KID'S WOVEN DENIM PANT,MAIN MATERIAL:100% COTTON",
        )
        self.assertEqual(
            records[2].goods_description,
            "KID'S WOVEN DENIM JACKET,MAIN MATERIAL:100% COTTON",
        )


if __name__ == "__main__":
    unittest.main()
