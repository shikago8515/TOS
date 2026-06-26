import { persistTcInvArtifacts } from "./artifacts.mjs";
import { formatTcInvAutomationError } from "./errors.mjs";
import { parseTcInvWorkbookPayload } from "./workbook.mjs";
import { runTcInvInvoiceSearchWorkflow } from "./workflow.mjs";

export const moduleDefinition = {
  id: "tc-inv-automation",
  title: "TC INV 自动化",
  frontendEntryId: "tc-inv-automation",
  routePaths: ["/run-tc-inv-file", "/api/run-tc-inv-file"],
};

export function isTcInvAutomationRoute(requestPath) {
  return moduleDefinition.routePaths.includes(requestPath);
}

export function createTcInvAutomation(deps) {
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
    const activeRun = registerActiveRun({
      action: "run-tc-inv-file",
      automationId: moduleDefinition.frontendEntryId,
      browser: config.browser,
      factories: workbook.factories,
      headless,
      inputFileName,
      inputMode: "tc-inv-invoice-search",
      invoiceNumber: workbook.firstInvoiceNumber,
      totalInvoiceCount: workbook.invoiceNumbers.length,
      totalRowCount: workbook.rows.length,
    });

    try {
      const result = await runTcInvInvoiceSearchWorkflow({
        ...deps,
        activeRun,
        credentials,
        headless,
        inputFileName,
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
        inputMode: "tc-inv-invoice-search",
        invoiceDetailOpened: result.invoiceDetailOpened,
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
          inputMode: "tc-inv-invoice-search",
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
