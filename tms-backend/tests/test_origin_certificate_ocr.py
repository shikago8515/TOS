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


ACFTA_FORM_E_ATTACHMENT_TEXT = """
ASEAN-CHINA FREE TRADE AREA
PREFERENTIAL TARIFF CERTIFICATE OF ORIGIN
FORM E
5.Item 6. Marks and 7.Number and type of packages, description of products 8.Origin criteria 9.Gross weight or net 10.Number,
number numbers on (including quantity where appropriate and HS number in (see Overleaf weight or other quantity, date of
packages six digit code) Notes) and value (FOB) only Invoices
when RVC criterion is applied
1 FIFTY SIX (56) CARTONS OF WOMEN'S WOVEN DENIM PANTS, PSR 560 PIECES 6541156264
MAIN MATERIAL: 100% COTTON MAY.06,2026
PO# 0902319353
ARTICLE NO.: LE5888
STYLE NO.: RC2613OW006
CUST ORDER NO.:0306700299
ARTICLE DESCRIPTION:DENIM BARREL LTBLUE
HS Code:620462
2 FOURTEEN (14) CARTONS OF WOMEN'S WOVEN SKIRT,MAIN PSR 371 PIECES
MATERIAL: 100% COTTON
PO# 0902319344
ARTICLE NO.: LE8298
STYLE NO.: RC2613OW003
CUST ORDER NO.:0306700300
ARTICLE DESCRIPTION:SKIRT BLACK
HS Code:620452
3 CART NO. ELEVEN (11) CARTONS OF WOMEN'S WOVEN SKIRT,MAIN PSR 285 PIECES
CUST O/N MATERIAL: 100% COTTON
PO NO PO# 0902319335
ART NO ARTICLE NO.: LE8297
SIZE ARTICLE NO. STYLE NO.: RC2613OW003
QTY STYLE NO. CUST ORDER NO.:0306700305
MADE IN CHINA ARTICLE DESCRIPTION:SKIRT OLISTR
HS Code:620452
(SEE ATTACHMENT)
ADDRESS:1008 WANDA BUILDING NO.9 JIEFANG STREET ZHONGSHAN
FAX:0411-82643422 TEL:0411-82532807
4 TWENTY FOUR (24) CARTONS OF WOMEN'S WOVEN DENIM CTH 431 PIECES 6541156264
TRACK TOP,MAIN MATERIAL: 99% COTTON 1% ELASTANE MAY.06,2026
PO# 0902319349
ARTICLE NO.: LE8299
STYLE NO.: RC2613OW004
CUST ORDER NO.:0306700308
ARTICLE DESCRIPTION:SSTR TT INDDNM
HS 2017 is HS 620292
HS Code:620230
5 FORTY THREE (43) CARTONS OF WOMEN'S WOVEN DENIM PSR 602 PIECES
PANTS, MAIN MATERIAL: 99% COTTON 1% ELASTANE
PO# 0902319406
ARTICLE NO.: LE8302
STYLE NO.: RC2613OW005
CUST ORDER NO.:0306700309
ARTICLE DESCRIPTION:DENIM WL PANTS INDDNM
HS Code:620462
6 TWENTY THREE (23) CARTONS OF WOMEN'S WOVEN DENIM CTH 405 PIECES
TRACK TOP,MAIN MATERIAL: 99% COTTON 1% ELASTANE
PO# 0902319345
ARTICLE NO.: LF3779
STYLE NO.: RC2613OW004B
(SEE ATTACHMENT)
11.Declaration by the exporter 12.Certification
5.Item 6. Marks and 7.Number and type of packages, description of products 8.Origin criteria
CUST ORDER NO.:0306700311 6541156264
ARTICLE DESCRIPTION:SSTR TT WAGRDN MAY.06,2026
HS 2017 is HS 620292
HS Code:620230
7 FIFTY TWO (52) CARTONS OF WOMEN'S WOVEN DENIM PSR 517 PIECES
PANTS,MAIN MATERIAL: 100% COTTON
PO# 0902319352
ARTICLE NO.: LF3778
STYLE NO.: RC2613OW006B
CUST ORDER NO.:0306700312
ARTICLE DESCRIPTION:DENIM BARREL MEBLDE
HS Code:620462
8 FIFTY ONE (51) CARTONS OF WOMEN'S WOVEN DENIM PSR 507 PIECES
PANTS,MAIN MATERIAL: 100% COTTON
PO# 0902319407
ARTICLE NO.: LE8303
STYLE NO.: RC2613OW006
CUST ORDER NO.:0306700313
ARTICLE DESCRIPTION:DENIM BARREL INDDNM
HS Code:620462
SAY TOTAL TWO HUNDRED AND SEVENTY FOUR (274)
CARTONS ONLY
"""


JAPAN_RCEP_PAGES = [
    """
REGIONAL COMPREHENSIVE ECONOMIC PARTNERSHIP AGREEMENT
CERTIFICATE OF ORIGIN
Form RCEP
6.Item 7.Marks 8.Number and kind of 9.HS Code of 10.Origin 11.RCEP 12.Quantity (Gross 13.Invoice
number and packages;and description of the goods(6 Conferring Country of weight or other number(s) and date
1 NINETY FOUR (94) CARTONS OF 620230 CTC CHINA 812 PIECES 10-06-26-0734
WOMEN'S WOVEN ST DNM WSH JUN.09,2026
JACKET
PO# 0902556814
ARTICLE NO.: KV0625
STYLE NO.: AF26INSPW072
CTNS:94
PCS:812
CUST ORDER NO.:0306968254
2 ONE HUNDRED AND FOURTEEN 620230 CTC CHINA 989 PIECES 10-06-26-0734
(114) CARTONS OF WOMEN'S JUN.09,2026
WOVEN ST DNM WSH JACKET
PO# 0902555371
ARTICLE NO.: KV0626
STYLE NO.: AF26INSPW072
CTNS:114
PCS:989
CUST ORDER NO.:0306968255
(SEE ATTACHMENT)
14.Remarks THIRD-PARTY OPERATOR:
ADDRESS:1008 WANDA BUILDING NO.9 JIEFANG STREET
FAX:0411-82643422 TEL:0411-82532807
""",
    """
OVERLEAF NOTES
12. ISSUED RETROACTIVELY: Where a Certificate of Origin is issued retrospectively in accordance with paragraph 8 of Article 3.17.
""",
    """
Continuation Sheet
Certificate No.: Form RCEP
6.Item 7.Marks 8.Number and kind of 9.HS Code of 10.Origin 11.RCEP 12.Quantity (Gross 13.Invoice
number and packages;and description of the goods(6 Conferring Country of weight or other number(s) and date
3 ONE HUNDRED AND NINETEEN 620230 CTC CHINA 1032 PIECES 10-06-26-0734
(119) CARTONS OF WOMEN'S JUN.09,2026
WOVEN ST DNM WSH JACKET
PO# 0902557007
ARTICLE NO.: KV0624
STYLE NO.: AF26INSPW072
CTNS:119
PCS:1032
CUST ORDER NO.:0306968253
4 ONE HUNDRED AND FORTY FIVE 620462 CTC CHINA 1714 PIECES 10-06-26-0734
(145) CARTONS OF WOMEN'S JUN.09,2026
WOVEN ST DNM WSH PANT
PO# 0902559747
ARTICLE NO.: KV0619
STYLE NO.: AF26INSPW080
CTNS:145
PCS:1714
CUST ORDER NO.:0306968824
5 TWO HUNDRED AND EIGHT (208) 620462 CTC CHINA 2448 PIECES 10-06-26-0734
CARTONS OF WOMEN'S WOVEN JUN.09,2026
ST DNM WSH PANT
PO# 0902555490
ARTICLE NO.: KV0620
STYLE NO.: AF26INSPW080
CTNS:208
PCS:2448
CUST ORDER NO.:0306967348
6 TWO HUNDRED AND TEN (210) 620462 CTC CHINA 2476 PIECES 10-06-26-0734
CARTONS OF WOMEN'S WOVEN JUN.09,2026
ST DNM WSH PANT
PO# 0902556909
ARTICLE NO.: KV0618
(SEE ATTACHMENT)
14.Remarks THIRD-PARTY OPERATOR:
""",
    """
OVERLEAF NOTES
The Agreement contains Article 3.17 and other legal notes.
""",
    """
Continuation Sheet
Certificate No.: Form RCEP
6.Item 7.Marks 8.Number and kind of 9.HS Code of 10.Origin 11.RCEP 12.Quantity (Gross 13.Invoice
number and packages;and description of the goods(6 Conferring Country of weight or other number(s) and date
STYLE NO.: AF26INSPW080
CTNS:210
PCS:2476
CUST ORDER NO.:0306968250
7 NINETY (90) CARTONS OF 620452 CTC CHINA 958 PIECES 10-06-26-0734
WOMEN'S WOVEN ST DNM WSH JUN.09,2026
SKIRT
PO# 0902543263
ARTICLE NO.: KV0622
STYLE NO.: AF26INSPW081
CTNS:90
PCS:958
CUST ORDER NO.:0306968997
8 ONE HUNDRED AND TWENTY 620452 CTC CHINA 1356 PIECES 10-06-26-0734
SEVEN (127) CARTONS OF JUN.09,2026
WOMEN'S WOVEN ST DNM WSH
SKIRT
PO# 0902558552
ARTICLE NO.: KV0623
STYLE NO.: AF26INSPW081
CTNS:127
PCS:1356
CUST ORDER NO.:0306968252
9 ONE HUNDRED AND THIRTY FIVE 620452 CTC CHINA 1444 PIECES 10-06-26-0734
(135) CARTONS OF WOMEN'S JUN.09,2026
WOVEN ST DNM WSH SKIRT
PO# 0902558183
ARTICLE NO.: KV0621
STYLE NO.: AF26INSPW081
(SEE ATTACHMENT)
14.Remarks THIRD-PARTY OPERATOR:
""",
    """
Continuation Sheet
Certificate No.: Form RCEP
6.Item 7.Marks 8.Number and kind of 9.HS Code of 10.Origin 11.RCEP 12.Quantity (Gross 13.Invoice
number and packages;and description of the goods(6 Conferring Country of weight or other number(s) and date
CTNS:135
PCS:1444
CUST ORDER NO.:0306967349
***
14.Remarks THIRD-PARTY OPERATOR:
""",
]


CAMBODIA_FORM_D_TEXT = """
KHTH2605006456
XO TEX INDUSTRIAL CO., LTD.
KINGDOM OF CAMBODIA.
ADIDAS (THAILAND) CO.,LTD.
07-APR-2026
730 PIECE
1 CUST O/N : HS CODE: 610910 CC+SP 730 PIECE 17-03-26-07
PO NO. : WOMEN'S 93% COTTON 7% ELASTANE KNIT T-SHIRT 94
ART NO. : PO NO # ART NO # CUST. O/NO # ART DES # 30-MAR-2026
SIZE : 0901891240 KY7558 0305678582 3S TEE VIVRED
QTY : 14 CARTON
MADE IN
CAMBODIA
TOTAL (PIECE): SEVEN HUNDRED THIRTY ONLY
THIRD-COUNTRY INVOICING:
INVOICE NUMBER: 6541141861
DATE:31-MAR-2026
"""


CAMBODIA_FORM_D_MULTI_ITEM_TEXT = """
KHVN2604030487
XO TEX INDUSTRIAL CO., LTD.
KINGDOM OF CAMBODIA.
ADIDAS VIETNAM CO LTD
05-APR-2026
895 PIECE
1 CUST O/N : HS CODE: 610990 CC 515 PIECE 17-03-26-07
PO NO. : ADIDAS BRANDED : MEN'S 100% POLYESTER 96
ART NO. : (100%RECYCLED) KNITJERSEY (SHORT SLEEVE) 30-MAR-2026
SIZE : PO NO # ART NO # CUST. O/NO #
QTY : 0901944686 KX1258 0305670288
QTY:515 PCS
13 CARTON
2 MADE IN HS CODE: 610910 CC 380 PIECE
CAMBODIA ADIDAS BRANDED : MEN'S 100% COTTON KNIT T-SHIRT
N.W.: PO NO # ART NO # CUST. O/NO #
G.W.: 0901891214 KY2114 0305678561
QTY:380 PCS
13 CARTON
TOTAL (PIECE): EIGHT HUNDRED NINETY FIVE ONLY
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

    def test_parse_acfta_form_e_attachment_item_blocks_extracts_complete_records(self):
        records = self.parser.parse_text(ACFTA_FORM_E_ATTACHMENT_TEXT)

        self.assertEqual(len(records), 8)
        self.assertNotIn("", [record.po_number for record in records])
        self.assertFalse({record.hs_code for record in records} & {"1008", "2026", "0411", "82643422", "82532807"})

        by_po = {record.po_number: record for record in records}
        first_attachment = by_po["0902319335"]
        self.assertEqual(first_attachment.working_number, "RC2613OW003")
        self.assertEqual(first_attachment.article_number, "LE8297")
        self.assertEqual(first_attachment.customer_number, "0306700305")
        self.assertEqual(first_attachment.quantity, 285)
        self.assertEqual(first_attachment.cartons, 11)
        self.assertEqual(first_attachment.cartons_in_words, "ELEVEN")
        self.assertEqual(first_attachment.hs_code, "620452")
        self.assertEqual(first_attachment.goods_description, "WOMEN'S WOVEN SKIRT,MAIN MATERIAL: 100% COTTON")

        continuation = by_po["0902319345"]
        self.assertEqual(continuation.working_number, "RC2613OW004B")
        self.assertEqual(continuation.article_number, "LF3779")
        self.assertEqual(continuation.customer_number, "0306700311")
        self.assertEqual(continuation.quantity, 405)
        self.assertEqual(continuation.cartons, 23)
        self.assertEqual(continuation.hs_code, "620230")
        self.assertNotIn("CTH", continuation.goods_description)

        last_record = by_po["0902319407"]
        self.assertEqual(last_record.working_number, "RC2613OW006")
        self.assertEqual(last_record.article_number, "LE8303")
        self.assertEqual(last_record.customer_number, "0306700313")
        self.assertEqual(last_record.quantity, 507)
        self.assertEqual(last_record.cartons, 51)
        self.assertEqual(last_record.cartons_in_words, "FIFTY ONE")
        self.assertEqual(last_record.hs_code, "620462")
        self.assertEqual(last_record.goods_description, "WOMEN'S WOVEN DENIM PANTS,MAIN MATERIAL: 100% COTTON")
        self.assertTrue(all("PSR" not in record.goods_description for record in records))

    def test_parse_japan_rcep_item_blocks_merges_continuation_fields(self):
        records = self.parser.parse_pages(JAPAN_RCEP_PAGES)

        self.assertEqual(len(records), 9)
        self.assertFalse({record.article_number for record in records} & {"3.17", ""})
        self.assertFalse({record.hs_code for record in records} & {"0734", "2026", "1444", "0411"})

        by_po = {record.po_number: record for record in records}
        page_three_record = by_po["0902559747"]
        self.assertEqual(page_three_record.working_number, "AF26INSPW080")
        self.assertEqual(page_three_record.article_number, "KV0619")
        self.assertEqual(page_three_record.customer_number, "0306968824")
        self.assertEqual(page_three_record.quantity, 1714)
        self.assertEqual(page_three_record.cartons, 145)
        self.assertEqual(page_three_record.cartons_in_words, "ONE HUNDRED AND FORTY FIVE")
        self.assertEqual(page_three_record.hs_code, "620462")
        self.assertEqual(page_three_record.goods_description, "WOMEN'S WOVEN ST DNM WSH PANT")

        split_item = by_po["0902556909"]
        self.assertEqual(split_item.working_number, "AF26INSPW080")
        self.assertEqual(split_item.article_number, "KV0618")
        self.assertEqual(split_item.customer_number, "0306968250")
        self.assertEqual(split_item.quantity, 2476)
        self.assertEqual(split_item.cartons, 210)
        self.assertEqual(split_item.hs_code, "620462")
        self.assertEqual(split_item.goods_description, "WOMEN'S WOVEN ST DNM WSH PANT")

        final_split_item = by_po["0902558183"]
        self.assertEqual(final_split_item.working_number, "AF26INSPW081")
        self.assertEqual(final_split_item.article_number, "KV0621")
        self.assertEqual(final_split_item.customer_number, "0306967349")
        self.assertEqual(final_split_item.quantity, 1444)
        self.assertEqual(final_split_item.cartons, 135)
        self.assertEqual(final_split_item.hs_code, "620452")
        self.assertEqual(final_split_item.goods_description, "WOMEN'S WOVEN ST DNM WSH SKIRT")

    def test_parse_cambodia_form_d_extracts_tabular_detail(self):
        records = self.parser.parse_text(CAMBODIA_FORM_D_TEXT)

        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record.po_number, "0901891240")
        self.assertEqual(record.article_number, "KY7558")
        self.assertEqual(record.customer_number, "0305678582")
        self.assertEqual(record.quantity, 730)
        self.assertEqual(record.cartons, 14)
        self.assertEqual(record.hs_code, "610910")
        self.assertEqual(record.goods_description, "WOMEN'S 93% COTTON 7% ELASTANE KNIT T-SHIRT")
        self.assertEqual(record.working_number, "")

    def test_parse_cambodia_form_d_extracts_multiple_detail_layouts(self):
        records = self.parser.parse_text(CAMBODIA_FORM_D_MULTI_ITEM_TEXT)

        self.assertEqual(len(records), 2)
        by_po = {record.po_number: record for record in records}

        recycled_polyester = by_po["0901944686"]
        self.assertEqual(recycled_polyester.article_number, "KX1258")
        self.assertEqual(recycled_polyester.customer_number, "0305670288")
        self.assertEqual(recycled_polyester.quantity, 515)
        self.assertEqual(recycled_polyester.cartons, 13)
        self.assertEqual(recycled_polyester.hs_code, "610990")
        self.assertEqual(
            recycled_polyester.goods_description,
            "ADIDAS BRANDED : MEN'S 100% POLYESTER (100%RECYCLED) KNITJERSEY (SHORT SLEEVE)",
        )

        cotton_tshirt = by_po["0901891214"]
        self.assertEqual(cotton_tshirt.article_number, "KY2114")
        self.assertEqual(cotton_tshirt.customer_number, "0305678561")
        self.assertEqual(cotton_tshirt.quantity, 380)
        self.assertEqual(cotton_tshirt.cartons, 13)
        self.assertEqual(cotton_tshirt.hs_code, "610910")
        self.assertEqual(cotton_tshirt.goods_description, "ADIDAS BRANDED : MEN'S 100% COTTON KNIT T-SHIRT")


if __name__ == "__main__":
    unittest.main()
