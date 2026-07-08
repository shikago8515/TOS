import assert from "node:assert/strict";
import test from "node:test";

import { parseTcInvWorkbookPayload } from "./workbook.mjs";

function createFakeXlsx(rows) {
  return {
    read() {
      return {
        SheetNames: ["SOR"],
        Sheets: {
          SOR: {},
        },
      };
    },
    utils: {
      sheet_to_json() {
        return rows;
      },
    },
  };
}

test("parses Submission as the XO TC INV handover date", () => {
  const rows = [
    [],
    [],
    [],
    [],
    [],
    [],
    ["ZEQS", "Eqv Ocean Rate per CBM"],
    [],
    [
      "Submission",
      "LO",
      "Seller",
      "Factory Code",
      "Customer no.",
      "PO no.",
      "Inv No",
      "Charge Code",
      "Remark",
      "upcharge $ total",
      "Ticket No.",
    ],
    [
      "2026-07-08T00:00:00",
      "Cambodia",
      "",
      "3LP001",
      "",
      "0902793377",
      "17-07-26-1575",
      "ZEQS",
      "",
      1306.89,
      "",
    ],
  ];

  const result = parseTcInvWorkbookPayload(
    {
      fileBase64: Buffer.from("fake workbook").toString("base64"),
      fileName: "PO issue list IDD 06-JUL-26(1).xlsx",
    },
    { xlsx: createFakeXlsx(rows) },
  );

  assert.equal(result.firstInvoiceNumber, "17-07-26-1575");
  assert.equal(result.firstPoddDate, "2026-07-08");
  assert.equal(result.poddDatesByInvoice["17-07-26-1575"], "2026-07-08");
  assert.equal(result.adjustmentsByInvoice["17-07-26-1575"].chargeCode, "ZEQS");
  assert.equal(result.adjustmentsByInvoice["17-07-26-1575"].zeqsInputValue, "1306.89");
});
