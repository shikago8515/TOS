import { mkdirSync } from "node:fs";
import path from "node:path";
import { persistTcInvArtifacts } from "./artifacts.mjs";
import { formatTcInvAutomationError } from "./errors.mjs";
import { parseTcInvWorkbookPayload } from "./workbook.mjs";
import { runTcInvInvoiceSearchWorkflow } from "./workflow.mjs";

export const moduleDefinition = {
  id: "xo-tc-inv-automation",
  title: "XO-Trade Card INV amount 自动化",
  frontendEntryId: "xo-tc-inv-automation",
  routePaths: ["/run-xo-tc-inv-file", "/api/run-xo-tc-inv-file"],
};

export function isXoTcInvAutomationRoute(requestPath) {
  return moduleDefinition.routePaths.includes(requestPath);
}

export function createXoTcInvAutomation(deps) {
  const {
    config,
    log,
    normalizeUploadFileName,
    recordCompletedRun,
    registerActiveRun,
    resolveCredentials,
    unregisterActiveRun,
  } = deps;

  async function handleRequest(body) {
    const credentials = resolveCredentials(body);
    const workbook = parseTcInvWorkbookPayload(body, deps);
    const inputFileName = normalizeUploadFileName(body);
    const headless = resolveRunHeadless(body, config);
    const downloadPreviewPdf = resolveDownloadPreviewPdf(body);
    const previewPdfDownloadRootDirectory = downloadPreviewPdf
      ? resolveTcInvPreviewPdfDownloadRootDirectory(body)
      : "";
    const previewPdfDownloadDirectory = previewPdfDownloadRootDirectory
      ? createTcInvPreviewPdfRunDirectory(previewPdfDownloadRootDirectory)
      : "";
    const firstInvoiceAdjustments = workbook.adjustmentsByInvoice?.[workbook.firstInvoiceNumber] || null;
    const activeRun = registerActiveRun({
      action: "run-xo-tc-inv-file",
      automationId: moduleDefinition.frontendEntryId,
      browser: config.browser,
      factories: workbook.factories,
      headless,
      inputFileName,
      inputMode: "xo-tc-inv-invoice-search",
      invoiceNumber: workbook.firstInvoiceNumber,
      poddDate: workbook.firstPoddDate,
      previewPdfDownloadRootDirectory,
      previewPdfDownloadDirectory,
      zaddPlusOtherCost: firstInvoiceAdjustments?.zaddPlusOtherCostInputValue || "",
      zdoc: firstInvoiceAdjustments?.zdocInputValue || "",
      totalInvoiceCount: workbook.invoiceNumbers.length,
      totalRowCount: workbook.rows.length,
    });

    try {
      const result = await runTcInvInvoiceSearchWorkflow({
        ...deps,
        activeRun,
        credentials,
        downloadPreviewPdf,
        headless,
        inputFileName,
        previewPdfDownloadDirectory,
        previewPdfDownloadRootDirectory,
        workbook,
      });
      result.artifacts = await persistTcInvArtifacts({
        ...deps,
        result,
        rows: workbook.rows,
        runId: activeRun.runId,
      });

      recordCompletedRun({
        runId: activeRun.runId,
        startedAt: activeRun.startedAt,
        finishedAt: result.generatedAt,
        ok: result.ok,
        finalUrl: result.finalUrl,
        homeOpened: result.homeOpened,
        inputFileName,
        inputMode: "xo-tc-inv-invoice-search",
        invoiceDetailOpened: result.invoiceDetailOpened,
        cargoHandoverDateFilled: result.cargoHandoverDateFilled,
        buildStepOpened: result.buildStepOpened,
        adjustmentChargeSelected: result.adjustmentChargeSelected,
        previewOpened: result.previewOpened,
        previewPdfDownloadEnabled: result.previewPdfDownloadEnabled,
        previewPdfDownloadRootDirectory: result.previewPdfDownloadRootDirectory || "",
        previewPdfDownloadDirectory: result.previewPdfDownloadDirectory || "",
        previewPdfDownloadedCount: result.previewPdfDownloadedCount || 0,
        previewPdfDownloadFailedCount: result.previewPdfDownloadFailedCount || 0,
        previewPdfSavedPaths: result.previewPdfSavedPaths || [],
        attemptedInvoiceCount: result.attemptedInvoiceCount,
        completedInvoiceCount: result.completedInvoiceCount,
        completedInvoiceNumbers: result.completedInvoiceNumbers,
        failedInvoiceCount: result.failedInvoiceCount,
        failedInvoiceNumbers: result.failedInvoiceNumbers,
        hasInvoiceFailures: result.hasInvoiceFailures,
        zaddPlusOtherCost: result.buildAdjustmentResult?.zadd?.actualAmount || firstInvoiceAdjustments?.zaddPlusOtherCostInputValue || "",
        zdoc: result.buildAdjustmentResult?.zdoc?.actualAmount || firstInvoiceAdjustments?.zdocInputValue || "",
        searchedInvoiceNumber: result.searchedInvoiceNumber,
        totalInvoiceCount: workbook.invoiceNumbers.length,
        totalRowCount: result.totalRowCount,
      });

      return {
        statusCode: result.ok ? 200 : 500,
        body: result,
      };
    } catch (error) {
      const formatted = formatTcInvAutomationError(error);
      log("TC INV automation failed before response.", {
        runId: activeRun.runId,
        message: formatted.message,
        stage: formatted.stage,
      });
      return {
        statusCode: formatted.statusCode,
        body: {
          ok: false,
          runId: activeRun.runId,
          generatedAt: new Date().toISOString(),
          stage: formatted.stage,
          message: formatted.message,
          detail: formatted.detail,
          inputFileName,
          inputMode: "xo-tc-inv-invoice-search",
          firstPoddDate: workbook.firstPoddDate,
          previewPdfDownloadRootDirectory,
          previewPdfDownloadDirectory,
          searchedInvoiceNumber: workbook.firstInvoiceNumber,
          totalInvoiceCount: workbook.invoiceNumbers.length,
          totalRowCount: workbook.rows.length,
        },
      };
    } finally {
      unregisterActiveRun(activeRun.runId);
    }
  }

  return {
    handleRequest,
    moduleDefinition,
  };
}

function resolveRunHeadless(body, config) {
  const value = body?.headless;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  }
  return Boolean(config.headless);
}

function resolveDownloadPreviewPdf(body) {
  const value = body?.downloadPreviewPdf ?? body?.downloadTcInvPreviewPdf ?? true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  }
  return true;
}

function resolveTcInvPreviewPdfDownloadRootDirectory(body) {
  const value = String(
    body?.previewPdfDownloadDirectory
      || body?.previewPdfSaveDirectory
      || body?.xoTcInvPreviewPdfDownloadDirectory
      || body?.tcInvPreviewPdfDownloadDirectory
      || body?.pdfSaveDirectory
      || "",
  ).trim();
  if (!value) {
    const error = new Error("请先选择 TC INV Preview PDF 保存目录。");
    error.statusCode = 400;
    throw error;
  }
  return path.resolve(value);
}

function createTcInvPreviewPdfRunDirectory(rootDirectory) {
  const rootPath = path.resolve(String(rootDirectory || "").trim());
  if (!rootPath) {
    const error = new Error("请先选择 TC INV Preview PDF 保存目录。");
    error.statusCode = 400;
    throw error;
  }

  mkdirSync(rootPath, { recursive: true });
  const baseName = sanitizeWindowsDirectoryName(`${formatBeijingDateForDirectory()} TC INV`, "TC INV");
  return createUniqueChildDirectorySync(rootPath, baseName);
}

function formatBeijingDateForDirectory(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  const year = get("year") || date.getFullYear();
  const month = get("month") || date.getMonth() + 1;
  const day = get("day") || date.getDate();
  return `${year}-${month}-${day}`;
}

function sanitizeWindowsDirectoryName(value, fallback = "folder") {
  return String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[ .]+$/g, "")
    .trim()
    .slice(0, 120) || fallback;
}

function createUniqueChildDirectorySync(parentDirectory, baseName) {
  let index = 0;
  while (index < 1000) {
    const suffix = index === 0 ? "" : `-${index}`;
    const candidate = path.join(parentDirectory, `${baseName}${suffix}`);
    try {
      mkdirSync(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      index += 1;
    }
  }

  const error = new Error(`无法创建唯一的 TC INV Preview PDF 保存子目录：${parentDirectory}`);
  error.statusCode = 500;
  throw error;
}
