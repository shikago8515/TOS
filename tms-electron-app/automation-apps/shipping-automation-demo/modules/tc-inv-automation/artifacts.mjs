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
    failedRowCount: result.ok ? 0 : rows.length,
  };
}

async function writeTcInvResultWorkbook(targetPath, result, rows, xlsx) {
  const workbook = xlsx.utils.book_new();
  const summaryRows = [
    { 字段: "模块", 值: "TC INV 自动化" },
    { 字段: "执行阶段", 值: "登录 Infor Nexus / Invoices 查询 / 打开发票详情" },
    { 字段: "执行结果", 值: result.ok ? "成功" : "失败" },
    { 字段: "消息", 值: result.message || "" },
    { 字段: "文件", 值: result.inputFileName || "" },
    { 字段: "查询 Invoice#", 值: result.searchedInvoiceNumber || "" },
    { 字段: "点击结果", 值: result.clickedInvoiceText || "" },
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
      工厂: row.factory || "",
      非空字段数: row.nonEmptyCellCount,
      原始数据: JSON.stringify(row.originalRow),
    }))),
    "上传明细预览",
  );

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  await writeFile(targetPath, buffer);
}

function sanitizeFileSegment(value) {
  return String(value || "tc-inv")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tc-inv";
}
