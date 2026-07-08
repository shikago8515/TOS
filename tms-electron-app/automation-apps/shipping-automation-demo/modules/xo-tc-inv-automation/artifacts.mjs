import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function persistTcInvArtifacts(options) {
  const { artifactsDir, result, rows, runId, xlsx } = options;
  await mkdir(artifactsDir, { recursive: true });

  const safeRunId = sanitizeFileSegment(runId || result?.runId || "xo-tc-inv");
  const resultJsonName = `${safeRunId}-xo-tc-inv-result.json`;
  const resultExcelName = `${safeRunId}-xo-tc-inv-result.xlsx`;
  const resultJsonPath = path.join(artifactsDir, resultJsonName);
  const resultExcelPath = path.join(artifactsDir, resultExcelName);

  await writeFile(resultJsonPath, JSON.stringify(result, null, 2), "utf8");
  await writeTcInvResultWorkbook(resultExcelPath, result, rows, xlsx);

  return {
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
    },
    failedRowCount: countFailedTcInvRows(rows, result.failedInvoiceNumbers),
    resultExcelPath,
    resultJsonPath,
  };
}

async function writeTcInvResultWorkbook(targetPath, result, rows, xlsx) {
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(buildSummaryRows(result)),
    "Summary",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(buildUploadedRows(rows)),
    "Uploaded Rows",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(buildInvoiceResultRows(result)),
    "Invoice Results",
  );

  const buffer = xlsx.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });
  await writeFile(targetPath, buffer);
}

function buildSummaryRows(result) {
  return [
    { Field: "Module", Value: "XO-Trade Card INV amount" },
    { Field: "Workflow", Value: "Infor Nexus / Invoices / Build ZEQS or date-only Preview Validate / PDF download" },
    { Field: "Result", Value: result.ok ? "Success" : "Failed" },
    { Field: "Message", Value: result.message || "" },
    { Field: "Input File", Value: result.inputFileName || "" },
    { Field: "Sheet", Value: result.sheetName || "" },
    { Field: "Header Row", Value: result.headerRowIndex || "" },
    { Field: "First Invoice", Value: result.searchedInvoiceNumber || "" },
    { Field: "Clicked Invoice", Value: result.clickedInvoiceText || "" },
    { Field: "PODD", Value: result.firstPoddDate || "" },
    {
      Field: "Cargo handover/FCR date",
      Value: result.cargoHandoverDateResult?.filled
        ? "Filled"
        : result.cargoHandoverDateResult?.skippedReason || "",
    },
    { Field: "Build Page", Value: result.buildAdjustmentResult?.opened ? "Opened" : result.buildAdjustmentResult?.skippedReason || "" },
    { Field: "No Charge", Value: result.buildAdjustmentResult?.noCharge ? "Yes" : "No" },
    { Field: "Adjustment Apply As", Value: result.buildAdjustmentResult?.chargeSelected ? "Charge" : result.buildAdjustmentResult?.selectedLabel || "" },
    { Field: "ZEQS Amount", Value: result.buildAdjustmentResult?.zeqs?.actualAmount || result.buildAdjustmentResult?.adjustments?.zeqsInputValue || "" },
    { Field: "ZEQS Reason", Value: result.buildAdjustmentResult?.zeqs?.reason?.code || "" },
    {
      Field: "ZEQS Source Rows",
      Value: Array.isArray(result.buildAdjustmentResult?.adjustments?.sourceRows)
        ? result.buildAdjustmentResult.adjustments.sourceRows.join(", ")
        : "",
    },
    { Field: "Preview", Value: result.previewResult?.opened ? "Opened" : result.previewResult?.skippedReason || "" },
    { Field: "Validate Clicked", Value: result.previewResult?.validateResult?.clicked ? "Yes" : "No" },
    { Field: "PDF Download Enabled", Value: result.previewPdfDownloadEnabled ? "Yes" : "No" },
    { Field: "PDF Directory", Value: result.previewPdfDownloadDirectory || "" },
    { Field: "PDF Downloaded Count", Value: result.previewPdfDownloadedCount || 0 },
    { Field: "PDF Failed Count", Value: result.previewPdfDownloadFailedCount || 0 },
    { Field: "PDF Saved Paths", Value: Array.isArray(result.previewPdfSavedPaths) ? result.previewPdfSavedPaths.join(", ") : "" },
    { Field: "Attempted Invoice Count", Value: result.attemptedInvoiceCount || 0 },
    { Field: "Completed Invoice Count", Value: result.completedInvoiceCount || 0 },
    { Field: "Completed Invoices", Value: Array.isArray(result.completedInvoiceNumbers) ? result.completedInvoiceNumbers.join(", ") : "" },
    { Field: "Failed Invoice Count", Value: result.failedInvoiceCount || 0 },
    { Field: "Failed Invoices", Value: Array.isArray(result.failedInvoiceNumbers) ? result.failedInvoiceNumbers.join(", ") : "" },
    { Field: "Invoice Count", Value: Array.isArray(result.invoiceNumbers) ? result.invoiceNumbers.length : 0 },
    { Field: "Data Row Count", Value: result.totalRowCount || 0 },
    { Field: "Factories", Value: Array.isArray(result.factories) ? result.factories.join(", ") : "" },
    { Field: "Home Opened", Value: result.homeOpened ? "Yes" : "No" },
    { Field: "Invoices Opened", Value: result.invoicesOpened ? "Yes" : "No" },
    { Field: "Invoice Filter Applied", Value: result.invoiceFilterApplied ? "Yes" : "No" },
    { Field: "Invoice Detail Opened", Value: result.invoiceDetailOpened ? "Yes" : "No" },
    { Field: "Final URL", Value: result.finalUrl || "" },
    { Field: "Generated At", Value: result.generatedAt || "" },
  ];
}

function buildUploadedRows(rows) {
  return rows.map((row) => ({
    ExcelRow: row.rowIndex,
    Invoice: row.invoiceNumber || "",
    GroupInvoice: row.groupInvoiceNumber || "",
    PONo: row.poNumber || "",
    ChargeCode: row.effectiveChargeCode || row.chargeCode || "",
    NoCharge: row.hasZeqsAmount ? "No" : "Yes",
    ZEQS: row.hasZeqsAmount ? row.zeqsAmount || 0 : "",
    UpchargeTotal: row.hasZeqsAmount ? row.upchargeAmount || 0 : "",
    PODD: row.poddDate || "",
    Factory: row.factory || "",
    NonEmptyCellCount: row.nonEmptyCellCount,
    OriginalRow: JSON.stringify(row.originalRow || {}),
  }));
}

function buildInvoiceResultRows(result) {
  return (result.processedInvoiceResults || []).map((item) => ({
    Invoice: item.invoiceNumber || "",
    Result: item.ok === false ? "Failed" : "OK",
    PODD: item.poddDate || "",
    FCRDateFilled: item.cargoHandoverDateResult?.filled ? "Yes" : "No",
    NoCharge: item.buildAdjustmentResult?.noCharge ? "Yes" : "No",
    ZEQS: item.buildAdjustmentResult?.zeqs?.actualAmount || "",
    ZEQSReason: item.buildAdjustmentResult?.zeqs?.reason?.code || "",
    PreviewOpened: item.previewResult?.opened ? "Yes" : "No",
    AlreadyPreview: item.previewResult?.alreadyOpen ? "Yes" : "No",
    ValidateClicked: item.previewResult?.validateResult?.clicked ? "Yes" : "No",
    PreviewPdfDownloaded: item.previewResult?.validateResult?.previewPdfDownloadResult?.ok ? "Yes" : "No",
    PreviewPdfFileName: item.previewResult?.validateResult?.previewPdfDownloadResult?.fileName || "",
    PreviewPdfFilePath: item.previewResult?.validateResult?.previewPdfDownloadResult?.filePath || "",
    PreviewPdfError: item.previewResult?.validateResult?.previewPdfDownloadResult?.error || "",
    ErrorStage: item.errorStage || "",
    ErrorMessage: item.errorMessage || "",
    FinalUrl: item.finalUrl || "",
  }));
}

function countFailedTcInvRows(rows, failedInvoiceNumbers) {
  const failedInvoices = new Set(Array.isArray(failedInvoiceNumbers) ? failedInvoiceNumbers.filter(Boolean) : []);
  if (failedInvoices.size === 0) {
    return 0;
  }
  return rows.filter((row) => failedInvoices.has(row.groupInvoiceNumber || row.invoiceNumber)).length;
}

function sanitizeFileSegment(value) {
  return String(value || "xo-tc-inv")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "xo-tc-inv";
}
