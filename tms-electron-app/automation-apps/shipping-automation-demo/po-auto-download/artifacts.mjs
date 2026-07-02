import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function buildPoAutoDownloadFailureDetails(result, rows = []) {
  const resultRows = Array.isArray(result?.invoiceResults)
    ? result.invoiceResults
    : Array.isArray(result?.poResults)
      ? result.poResults
      : [];
  const byRowIndex = new Map(resultRows.map((item) => [Number(item?.rowIndex || 0), item]));

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const resultRow = byRowIndex.get(Number(row?.rowIndex || 0)) || null;
      if (resultRow?.ok) return null;
      const invoiceNumber = String(row?.invoiceNumber || row?.poNo || resultRow?.invoiceNumber || resultRow?.poNo || "").trim();
      const reason = String(resultRow?.error || resultRow?.step || result?.message || "Invoice row was not downloaded.").trim();
      return {
        rowIndex: Number(row?.rowIndex || resultRow?.rowIndex || 0),
        invoiceNumber,
        poNo: invoiceNumber,
        status: String(row?.status || resultRow?.status || "").trim(),
        result: resultRow?.skipped ? "skipped" : "failed",
        searchOk: Boolean(resultRow?.searchOk),
        error: reason,
        step: String(resultRow?.step || "").trim(),
        filePath: String(resultRow?.filePath || "").trim(),
        originalRow: row?.originalRow && typeof row.originalRow === "object" ? row.originalRow : {},
      };
    })
    .filter(Boolean);
}

export async function persistPoAutoDownloadArtifacts(options) {
  const { artifactsDir, result, rows, runId, xlsx } = options;
  if (!artifactsDir || !xlsx?.utils || !xlsx?.write) {
    return null;
  }

  await mkdir(artifactsDir, { recursive: true });

  const safeRunId = sanitizeFileSegment(runId || result?.runId || "po-auto-download");
  const resultJsonName = `${safeRunId}-po-auto-download-result.json`;
  const resultExcelName = `${safeRunId}-po-auto-download-result.xlsx`;
  const failedJsonName = `${safeRunId}-po-auto-download-failed-rows.json`;
  const failedExcelName = `${safeRunId}-po-auto-download-failed-rows.xlsx`;
  const resultJsonPath = path.join(artifactsDir, resultJsonName);
  const resultExcelPath = path.join(artifactsDir, resultExcelName);
  const failedJsonPath = path.join(artifactsDir, failedJsonName);
  const failedExcelPath = path.join(artifactsDir, failedExcelName);
  const latestResultJsonPath = path.join(artifactsDir, "po-auto-download-last-result.json");
  const latestResultExcelPath = path.join(artifactsDir, "po-auto-download-last-result.xlsx");
  const latestFailedJsonPath = path.join(artifactsDir, "po-auto-download-last-failed-rows.json");
  const latestFailedExcelPath = path.join(artifactsDir, "po-auto-download-last-failed-rows.xlsx");
  const failedRows = buildPoAutoDownloadFailureDetails(result, rows);

  const artifacts = {
    runId: safeRunId,
    resultJsonPath,
    resultExcelPath,
    failedJsonPath,
    failedExcelPath,
    latestResultJsonPath,
    latestResultExcelPath,
    latestFailedJsonPath,
    latestFailedExcelPath,
    failedRowCount: failedRows.length,
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
      failedPoJsonUrl: `/artifacts/${failedJsonName}`,
      failedPoExcelUrl: `/artifacts/${failedExcelName}`,
      latestResultJsonUrl: "/artifacts/po-auto-download-last-result.json",
      latestResultExcelUrl: "/artifacts/po-auto-download-last-result.xlsx",
      latestFailedPoJsonUrl: "/artifacts/po-auto-download-last-failed-rows.json",
      latestFailedPoExcelUrl: "/artifacts/po-auto-download-last-failed-rows.xlsx",
    },
  };

  result.failedInvoiceDetails = failedRows;
  result.artifacts = {
    ...(result.artifacts || {}),
    ...artifacts,
  };

  await writeFile(resultJsonPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(failedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writePoAutoDownloadResultWorkbook(resultExcelPath, result, rows, failedRows, xlsx);
  await writePoAutoDownloadFailedWorkbook(failedExcelPath, failedRows, xlsx);

  await writeFile(latestResultJsonPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(latestFailedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writePoAutoDownloadResultWorkbook(latestResultExcelPath, result, rows, failedRows, xlsx);
  await writePoAutoDownloadFailedWorkbook(latestFailedExcelPath, failedRows, xlsx);

  return artifacts;
}

async function writePoAutoDownloadResultWorkbook(targetPath, result, rows, failedRows, xlsx) {
  const workbook = xlsx.utils.book_new();
  const resultRows = Array.isArray(result?.invoiceResults)
    ? result.invoiceResults
    : Array.isArray(result?.poResults)
      ? result.poResults
      : [];
  const resultByRowIndex = new Map(resultRows.map((item) => [Number(item?.rowIndex || 0), item]));
  const failedRowIndexSet = new Set(failedRows.map((item) => Number(item.rowIndex || 0)));

  const summaryRows = [
    { 字段: "模块", 值: "Invoice 自动下载" },
    { 字段: "执行结果", 值: result?.ok ? "成功" : "未完成" },
    { 字段: "消息", 值: result?.message || "" },
    { 字段: "文件", 值: result?.inputFileName || "" },
    { 字段: "Invoice 总数", 值: Number(result?.totalInvoiceCount ?? result?.totalPoCount ?? rows.length) },
    { 字段: "已下载", 值: Number(result?.downloadedInvoiceCount ?? result?.downloadedPoCount ?? 0) },
    { 字段: "失败", 值: Number(result?.failedInvoiceCount ?? result?.failedPoCount ?? failedRows.length) },
    { 字段: "跳过", 值: Number(result?.skippedInvoiceCount ?? 0) },
    { 字段: "并发", 值: Number(result?.downloadConcurrency ?? result?.requestConcurrency ?? 0) },
    { 字段: "保存目录", 值: result?.downloadDirectory || "" },
    { 字段: "生成时间", 值: result?.generatedAt || "" },
  ];
  const summarySheet = xlsx.utils.json_to_sheet(summaryRows);
  applySheetBasics(summarySheet, summaryRows.length + 1, 2);
  xlsx.utils.book_append_sheet(workbook, summarySheet, "执行摘要");

  const detailRows = (Array.isArray(rows) ? rows : []).map((row) => {
    const resultRow = resultByRowIndex.get(Number(row?.rowIndex || 0)) || {};
    const ok = Boolean(resultRow.ok);
    const original = row?.originalRow && typeof row.originalRow === "object" ? row.originalRow : {};
    return {
      ...original,
      Excel行号: row?.rowIndex || "",
      识别Invoice: row?.invoiceNumber || row?.poNo || "",
      识别STATUS: row?.status || "",
      下载结果: ok ? "成功" : (resultRow.skipped ? "跳过/失败" : "失败"),
      失败原因: ok ? "" : String(resultRow.error || resultRow.step || result?.message || "").trim(),
      保存文件: resultRow.filePath || "",
    };
  });
  const detailSheet = xlsx.utils.json_to_sheet(detailRows);
  applySheetBasics(detailSheet, detailRows.length + 1, inferColumnCount(detailRows));
  applyFailedRowStyles(detailSheet, detailRows, failedRowIndexSet, xlsx);
  xlsx.utils.book_append_sheet(workbook, detailSheet, "上传明细");

  const fileRows = resultRows
    .filter((item) => item?.ok)
    .map((item) => ({
      Invoice: item.invoiceNumber || item.poNo || "",
      文件名: item.fileName || "",
      保存路径: item.filePath || "",
      大小: item.size || "",
      PDF地址: item.pdfUrl || "",
    }));
  const fileSheet = xlsx.utils.json_to_sheet(fileRows);
  applySheetBasics(fileSheet, fileRows.length + 1, 5);
  xlsx.utils.book_append_sheet(workbook, fileSheet, "已下载文件");

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  await writeFile(targetPath, buffer);
}

async function writePoAutoDownloadFailedWorkbook(targetPath, failedRows, xlsx) {
  const exportRows = failedRows.map((row) => ({
    ...(row.originalRow || {}),
    Excel行号: row.rowIndex || "",
    识别Invoice: row.invoiceNumber || "",
    识别STATUS: row.status || "",
    下载结果: row.result === "skipped" ? "跳过/失败" : "失败",
    失败阶段: row.step || "",
    失败原因: row.error || "",
  }));
  const worksheet = xlsx.utils.json_to_sheet(exportRows, {
    header: exportRows.length > 0
      ? undefined
      : ["Excel行号", "识别Invoice", "识别STATUS", "下载结果", "失败阶段", "失败原因"],
  });
  applySheetBasics(worksheet, exportRows.length + 1, inferColumnCount(exportRows));
  applyAllDataRowStyle(worksheet, exportRows.length, xlsx, failureCellStyle());
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "失败明细");

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    cellStyles: true,
  });
  await writeFile(targetPath, buffer);
}

function applySheetBasics(worksheet, rowCount, columnCount) {
  if (!worksheet || columnCount <= 0) return;
  worksheet["!cols"] = Array.from({ length: columnCount }, () => ({ wch: 22 }));
  const range = worksheet["!ref"];
  if (!range) return;
  const decoded = decodeRange(range);
  for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {
    const address = encodeCell(0, col);
    if (worksheet[address]) {
      worksheet[address].s = headerCellStyle();
    }
  }
  worksheet["!autofilter"] = { ref: range };
  worksheet["!freeze"] = { xSplit: 0, ySplit: rowCount > 1 ? 1 : 0 };
}

function applyFailedRowStyles(worksheet, rows, failedRowIndexSet, xlsx) {
  if (!worksheet || !Array.isArray(rows) || failedRowIndexSet.size === 0) return;
  const range = worksheet["!ref"];
  if (!range) return;
  const decoded = decodeRange(range);
  rows.forEach((row, index) => {
    if (!failedRowIndexSet.has(Number(row.Excel行号 || 0))) return;
    for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {
      const address = encodeCell(index + 1, col);
      if (worksheet[address]) worksheet[address].s = failureCellStyle();
    }
  });
}

function applyAllDataRowStyle(worksheet, rowCount, xlsx, style) {
  if (!worksheet || rowCount <= 0) return;
  const range = worksheet["!ref"];
  if (!range) return;
  const decoded = decodeRange(range);
  for (let row = 1; row <= rowCount; row += 1) {
    for (let col = decoded.s.c; col <= decoded.e.c; col += 1) {
      const address = encodeCell(row, col);
      if (worksheet[address]) worksheet[address].s = style;
    }
  }
}

function headerCellStyle() {
  return {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "0F766E" } },
    alignment: { vertical: "center", wrapText: true },
  };
}

function failureCellStyle() {
  return {
    font: { color: { rgb: "991B1B" } },
    fill: { fgColor: { rgb: "FEE2E2" } },
    alignment: { vertical: "center", wrapText: true },
  };
}

function inferColumnCount(rows) {
  const first = Array.isArray(rows) ? rows.find((row) => row && typeof row === "object") : null;
  return first ? Object.keys(first).length : 6;
}

function decodeRange(ref) {
  const [start, end] = String(ref || "A1:A1").split(":");
  return { s: decodeCell(start), e: decodeCell(end || start) };
}

function decodeCell(address) {
  const match = String(address || "A1").match(/^([A-Z]+)(\d+)$/i);
  if (!match) return { r: 0, c: 0 };
  let col = 0;
  for (const char of match[1].toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return { r: Number(match[2]) - 1, c: col - 1 };
}

function encodeCell(row, col) {
  let column = "";
  let value = col + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return `${column}${row + 1}`;
}

function sanitizeFileSegment(value) {
  return String(value || "po-auto-download")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "po-auto-download";
}
