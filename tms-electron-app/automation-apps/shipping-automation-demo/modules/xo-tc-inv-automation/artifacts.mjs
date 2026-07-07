import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function persistTcInvArtifacts(options) {
  const { artifactsDir, result, rows, runId, xlsx } = options;
  await mkdir(artifactsDir, { recursive: true });

  const safeRunId = sanitizeFileSegment(runId || result?.runId || "tc-inv");
  const resultJsonName = `${safeRunId}-tc-inv-result.json`;
  const resultExcelName = `${safeRunId}-tc-inv-result.xlsx`;
  const resultJsonPath = path.join(artifactsDir, resultJsonName);
  const resultExcelPath = path.join(artifactsDir, resultExcelName);

  await writeFile(resultJsonPath, JSON.stringify(result, null, 2), "utf8");
  await writeTcInvResultWorkbook(resultExcelPath, result, rows, xlsx);

  return {
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
    },
    resultJsonPath,
    resultExcelPath,
    failedRowCount: countFailedTcInvRows(rows, result.failedInvoiceNumbers),
  };
}

async function writeTcInvResultWorkbook(targetPath, result, rows, xlsx) {
  const workbook = xlsx.utils.book_new();
  const summaryRows = [
    { 字段: "模块", 值: "XO-Trade Card INV amount 自动化" },
    { 字段: "执行阶段", 值: "登录 Infor Nexus / Invoices 查询 / 打开发票详情" },
    { 字段: "执行结果", 值: result.ok ? "成功" : "失败" },
    { 字段: "消息", 值: result.message || "" },
    { 字段: "文件", 值: result.inputFileName || "" },
    { 字段: "查询 Invoice#", 值: result.searchedInvoiceNumber || "" },
    { 字段: "点击结果", 值: result.clickedInvoiceText || "" },
    { 字段: "PODD", 值: result.firstPoddDate || "" },
    { 字段: "Cargo handover/FCR date", 值: result.cargoHandoverDateResult?.filled ? "Filled" : result.cargoHandoverDateResult?.skippedReason || "" },
    { 字段: "Build 页面", 值: result.buildAdjustmentResult?.opened ? "Opened" : result.buildAdjustmentResult?.skippedReason || "" },
    { 字段: "Adjustment Apply As", 值: result.buildAdjustmentResult?.chargeSelected ? "Charge" : result.buildAdjustmentResult?.selectedLabel || "" },
    { 字段: "ZADD + Other cost", 值: result.buildAdjustmentResult?.zadd?.actualAmount || result.buildAdjustmentResult?.adjustments?.zaddPlusOtherCostInputValue || "" },
    { 字段: "ZADD Reason", 值: result.buildAdjustmentResult?.zadd?.reason?.code || "" },
    { 字段: "ZDOC", 值: result.buildAdjustmentResult?.zdoc?.actualAmount || result.buildAdjustmentResult?.adjustments?.zdocInputValue || "" },
    { 字段: "ZDOC Reason", 值: result.buildAdjustmentResult?.zdoc?.reason?.code || "" },
    { 字段: "Preview", 值: result.previewResult?.opened ? "Opened" : result.previewResult?.skippedReason || "" },
    { 字段: "Validate 后下载 PDF", 值: result.previewPdfDownloadEnabled ? "是" : "否" },
    { 字段: "PDF 保存目录", 值: result.previewPdfDownloadDirectory || "" },
    { 字段: "PDF 下载成功数", 值: result.previewPdfDownloadedCount || 0 },
    { 字段: "PDF 下载失败数", 值: result.previewPdfDownloadFailedCount || 0 },
    { 字段: "PDF 文件路径", 值: Array.isArray(result.previewPdfSavedPaths) ? result.previewPdfSavedPaths.join(", ") : "" },
    { 字段: "尝试 Invoice 数", 值: result.attemptedInvoiceCount || 0 },
    { 字段: "完成 Invoice 数", 值: result.completedInvoiceCount || 0 },
    { 字段: "完成 Invoice", 值: Array.isArray(result.completedInvoiceNumbers) ? result.completedInvoiceNumbers.join(", ") : "" },
    { 字段: "失败 Invoice 数", 值: result.failedInvoiceCount || 0 },
    { 字段: "失败 Invoice", 值: Array.isArray(result.failedInvoiceNumbers) ? result.failedInvoiceNumbers.join(", ") : "" },
    { 字段: "发票总数", 值: Array.isArray(result.invoiceNumbers) ? result.invoiceNumbers.length : 0 },
    { 字段: "数据行数", 值: result.totalRowCount || 0 },
    { 字段: "识别工厂", 值: Array.isArray(result.factories) ? result.factories.join(", ") : "" },
    { 字段: "主页面已打开", 值: result.homeOpened ? "是" : "否" },
    { 字段: "Invoices 已打开", 值: result.invoicesOpened ? "是" : "否" },
    { 字段: "筛选已执行", 值: result.invoiceFilterApplied ? "是" : "否" },
    { 字段: "详情页已打开", 值: result.invoiceDetailOpened ? "是" : "否" },
    { 字段: "最终页面", 值: result.finalUrl || "" },
    { 字段: "生成时间", 值: result.generatedAt || "" },
  ];
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryRows), "执行摘要");
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(rows.map((row) => ({
      Excel行号: row.rowIndex,
      "Invoice#": row.invoiceNumber || "",
      分组Invoice: row.groupInvoiceNumber || "",
      PODD: row.poddDate || "",
      ZADD: row.zaddAmount || 0,
      ZDOC: row.zdocAmount || 0,
      OtherCost: row.otherCostAmount || 0,
      工厂: row.factory || "",
      非空字段数: row.nonEmptyCellCount,
      原始数据: JSON.stringify(row.originalRow),
    }))),
    "上传明细预览",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet((result.processedInvoiceResults || []).map((item) => ({
      Invoice: item.invoiceNumber || "",
      Result: item.ok === false ? "Failed" : "OK",
      PODD: item.poddDate || "",
      FCRDateFilled: item.cargoHandoverDateResult?.filled ? "Yes" : "No",
      ZADDPlusOtherCost: item.buildAdjustmentResult?.zadd?.actualAmount || "",
      ZADDReason: item.buildAdjustmentResult?.zadd?.reason?.code || "",
      ZDOC: item.buildAdjustmentResult?.zdoc?.actualAmount || "",
      ZDOCReason: item.buildAdjustmentResult?.zdoc?.reason?.code || "",
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
    }))),
    "Invoice执行结果",
  );

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  await writeFile(targetPath, buffer);
}

function countFailedTcInvRows(rows, failedInvoiceNumbers) {
  const failedInvoices = new Set(Array.isArray(failedInvoiceNumbers) ? failedInvoiceNumbers.filter(Boolean) : []);
  if (failedInvoices.size === 0) {
    return 0;
  }
  return rows.filter((row) => failedInvoices.has(row.groupInvoiceNumber || row.invoiceNumber)).length;
}

function sanitizeFileSegment(value) {
  return String(value || "tc-inv")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tc-inv";
}
