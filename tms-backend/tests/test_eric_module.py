import os
import sys
import unittest


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from modules.eric_module import EricModule


class EricModuleYticSourceTests(unittest.TestCase):
    def setUp(self):
        self.module = EricModule()

    def test_extract_sp_rows_uses_actual_confirmation_sections(self):
        rows = [
            ["*CUSTOMER  PO NUMBER"],
            ["0902792931", "Adidas Originals", "May - Oct", "2026", "CO-BA15", 106],
            [],
            ["", "PO Line Items"],
            [],
            [
                "",
                "",
                "*STYLE NUMBER",
                "PO LINE NUMBER",
                "CUSTOMER SEASON",
                "CUSTOMER SEASON YEAR",
                "PARENT STYLE",
                "TMS OFFICE",
                "PRODCUTION DIVISION",
                "DISTRIBUTOR DIVISION",
                "*CUSTOMER  DELIVERY  DATE",
                "*SHIP MODE",
                "*DESTINATION",
                "PO QTY",
                "SIZE RANGE",
                "UOM",
                "SALES CONFIRMATION NUMBER",
                "SC STATUS",
                "PURCHASE CONFIRMATION NUMBER",
                "PC STATUS",
            ],
            [
                "",
                "",
                "RC2606OW000",
                1,
                "FW26",
                "2026",
                "",
                "TM4",
                "",
                "ISC",
                46218,
                "By Sea",
                "United Arab Emirates",
                106,
                "2T,3T,4T,5T,2XS,XS,S,M,L,XL",
                "PIECES",
            ],
            [],
            ["", "", "", "PO Sub Details"],
            [],
            ["", "", "", "", "COLOR", "SIZE", "QTY", "PC NO", "ADJ QTY"],
            ["", "", "", "", "LI2854", "XS", 32, 1],
            [],
            ["", "", "", "Sales Confirmation"],
            [],
            [
                "",
                "",
                "",
                "",
                "CUSTOMER",
                "*SELLER/SUPPLIER",
                "*BILL TO",
                "*CONSIGNEE",
                "MAX ALLOW SHIP (%)",
                "MAX ALLOW SHORT SHIP (%)",
                "REQUIRED DELIVERY DATE",
                "SHIP MODE",
                "QUOTA CTRY",
                "SALES CONFIRMATION NUMBER",
                "PO QTY",
                "FOB",
            ],
            [
                "",
                "",
                "",
                "",
                "Adidas Originals",
                "TMS Fashion (H.K.) Ltd.",
                "Adidas International Trading AG",
                "Adidas Emerging Markets FZE",
                0,
                0,
                46218,
                "By Sea",
                "United Arab Emirates",
                "",
                106,
                16.5,
            ],
            [],
            ["", "", "", "Purchase Confirmation"],
            [],
            [
                "",
                "",
                "",
                "",
                "PC NUMBER",
                "FACTORY",
                "*BILL TO",
                "*CONSIGNEE",
                "SHIP TO",
                "MAX ALLOW SHIP (%)",
                "REQUIRED DELIVERY DATE",
                "SHIP MODE",
                "CTRY ORIGIN",
            ],
            [
                "",
                "",
                "",
                "",
                1,
                "Yuen Thai Industrial Company Ltd.",
                "TMS Fashion (H.K.) Ltd.",
                "Adidas Emerging Markets FZE",
                "Retail Logistics LLC, Dubai, UAE",
                0,
                46208,
                "By Sea",
                "United Arab Emirates",
            ],
        ]

        rows_out = self.module.extract_sp_rows_from_source(rows)

        self.assertEqual(
            rows_out,
            [
                [
                    "0902792931",
                    "RC2606OW000",
                    "FW26",
                    "2026",
                    "",
                    "TM4",
                    "",
                    "ISC",
                    46218,
                    "",
                    "By Sea",
                    "United Arab Emirates",
                    106,
                    "2T,3T,4T,5T,2XS,XS,S,M,L,XL",
                    "PIECES",
                ],
                [
                    "",
                    "",
                    "Adidas Originals",
                    "TMS Fashion (H.K.) Ltd.",
                    "Adidas International Trading AG",
                    "Adidas Emerging Markets FZE",
                    0,
                    0,
                    46218,
                    10,
                    "By Sea",
                    "United Arab Emirates",
                    "",
                    "",
                    "",
                ],
                [
                    "",
                    "",
                    1,
                    "Yuen Thai Industrial Company Ltd.",
                    "TMS Fashion (H.K.) Ltd.",
                    "Adidas Emerging Markets FZE",
                    "Retail Logistics LLC, Dubai, UAE",
                    0,
                    46208,
                    "",
                    "By Sea",
                    "United Arab Emirates",
                    "",
                    "",
                    "",
                ],
            ],
        )

    def test_build_size_check_rows_prefers_ytic_order(self):
        final_map = {
            ("0902773420", "KV1165", "2XS"): 25,
            ("0902792931", "LI2854", "XS"): 32,
            ("0902775685", "KV1165", "XS"): 51,
        }
        ytic_map = {
            ("0902792931", "LI2854", "XS"): 32,
            ("0902775685", "KV1165", "XS"): 51,
            ("0902773420", "KV1165", "2XS"): 25,
        }
        ytic_order = [
            ("0902792931", "LI2854", "XS"),
            ("0902775685", "KV1165", "XS"),
            ("0902773420", "KV1165", "2XS"),
        ]

        rows = self.module.build_size_check_rows(final_map, ytic_map, ytic_order)

        self.assertEqual([row[:3] for row in rows], [list(key) for key in ytic_order])

    def test_normalize_ship_mode_matches_ytic_destination_rules(self):
        self.assertEqual(self.module.normalize_ship_mode("By Sea"), "Ocean")
        self.assertEqual(self.module.normalize_ship_mode("By Courier"), "Air Express")
        self.assertEqual(self.module.normalize_ship_mode("By Courier", "Germany"), "Ocean")


if __name__ == "__main__":
    unittest.main()
