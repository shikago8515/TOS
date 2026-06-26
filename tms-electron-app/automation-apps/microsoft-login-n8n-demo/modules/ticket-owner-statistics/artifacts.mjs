import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TICKET_OWNER_COLUMNS, toTicketOwnerWorkbookRows } from "./ticket-fields.mjs";

const WORKSHEET_NAME = "Ticket ownership";
const WORKBOOK_FILE_NAME = "Ticket ownership.xlsx";

export async function persistTicketOwnerStatisticsArtifacts(deps, result) {
  if (!deps?.artifactsDir) {
    throw new Error("ticket-owner-statistics artifact dependency is missing: artifactsDir");
  }
  if (!deps?.xlsx?.utils || typeof deps.xlsx.writeFile !== "function") {
    throw new Error("ticket-owner-statistics artifact dependency is missing: xlsx");
  }

  await mkdir(deps.artifactsDir, { recursive: true });

  const runId = createRunId("ticket-owner-statistics");
  const resultJsonName = `${runId}-ticket-ownership.json`;
  const resultExcelName = `${runId}-ticket-ownership.xlsx`;
  const latestJsonName = "last-ticket-ownership.json";
  const latestExcelName = "last-ticket-ownership.xlsx";
  const resultJsonPath = path.join(deps.artifactsDir, resultJsonName);
  const resultExcelPath = path.join(deps.artifactsDir, resultExcelName);
  const latestResultJsonPath = path.join(deps.artifactsDir, latestJsonName);
  const latestResultExcelPath = path.join(deps.artifactsDir, latestExcelName);

  const payload = {
    ...result,
    generatedWorkbookName: WORKBOOK_FILE_NAME,
  };
  await writeFile(resultJsonPath, JSON.stringify(payload, null, 2), "utf8");
  await writeFile(latestResultJsonPath, JSON.stringify(payload, null, 2), "utf8");
  writeTicketOwnerWorkbook(deps.xlsx, resultExcelPath, result.rows);
  writeTicketOwnerWorkbook(deps.xlsx, latestResultExcelPath, result.rows);

  return {
    runId,
    resultJsonPath,
    resultExcelPath,
    latestResultJsonPath,
    latestResultExcelPath,
    rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
    workbookFileName: WORKBOOK_FILE_NAME,
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
      latestResultJsonUrl: `/artifacts/${latestJsonName}`,
      latestResultExcelUrl: `/artifacts/${latestExcelName}`,
    },
  };
}

export function writeTicketOwnerWorkbook(xlsx, outputXlsxPath, rows) {
  const workbookRows = toTicketOwnerWorkbookRows(rows);
  const worksheet = xlsx.utils.json_to_sheet(workbookRows, {
    header: TICKET_OWNER_COLUMNS,
    skipHeader: false,
  });

  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 34 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
  ];
  worksheet["!autofilter"] = {
    ref: `A1:G${Math.max(workbookRows.length + 1, 1)}`,
  };

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, WORKSHEET_NAME);
  xlsx.writeFile(workbook, outputXlsxPath);
}

function createRunId(prefix) {
  const safePrefix = sanitizeFileSegment(prefix || "run");
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${safePrefix}-${Date.now().toString(36)}-${randomPart}`;
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "run";
}
