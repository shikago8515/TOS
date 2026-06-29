import { formatPackingListAutoDownloadError } from "./errors.mjs";
import { validatePackingListWorkbookPayload } from "./workbook.mjs";
import { runPackingListAutoDownloadWorkflow } from "./workflow.mjs";

export const moduleDefinition = {
  id: "packing-list-auto-download",
  title: "自动下载箱单",
  frontendEntryId: "packing-list-auto-download",
  routePaths: ["/run-packing-list-auto-download-file", "/api/run-packing-list-auto-download-file"],
};

export function isPackingListAutoDownloadRoute(requestPath) {
  return moduleDefinition.routePaths.includes(requestPath);
}

export function createPackingListAutoDownloadAutomation(deps) {
  const {
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    ensureLoggedIn,
    log,
    normalizeUploadFileName,
    recordCompletedRun,
    registerActiveRun,
    resolveCredentials,
    safePageTitle,
    safePageUrl,
    unregisterActiveRun,
  } = deps;

  async function handleRequest(body) {
    let inputFileName = "";
    let credentials = null;
    let workbook = null;

    try {
      inputFileName = normalizeUploadFileName(body);
      credentials = resolveCredentials(body);
      workbook = validatePackingListWorkbookPayload(body, deps);
      inputFileName = workbook.inputFileName;
    } catch (error) {
      const formatted = formatPackingListAutoDownloadError(error);
      return {
        statusCode: formatted.statusCode,
        body: {
          ok: false,
          generatedAt: new Date().toISOString(),
          stage: formatted.stage,
          message: formatted.message,
          detail: formatted.detail,
          inputMode: "packing-list-auto-download",
          inputFileName,
          automationImplemented: false,
        },
      };
    }

    const headless = resolveRunHeadless(body, config);
    const activeRun = registerActiveRun({
      action: "run-packing-list-auto-download-file",
      automationId: moduleDefinition.frontendEntryId,
      browser: config.browser,
      headless,
      inputFileName,
      inputMode: "packing-list-auto-download",
      totalPoCount: workbook.poNumbers.length,
      progress: {
        phase: "准备箱单查询",
        message: `已读取 ${workbook.poNumbers.length} 个 PO 号，准备打开箱单页面。`,
        totalPoCount: workbook.poNumbers.length,
        currentPoNumbers: [],
        updatedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await runPackingListAutoDownloadWorkflow({
        activeRun,
        browserEngines,
        buildVisibleBrowserLaunchOptions,
        config,
        credentials,
        ensureLoggedIn,
        headless,
        inputFileName,
        log,
        safePageTitle,
        safePageUrl,
        workbook,
      });

      recordCompletedRun({
        runId: activeRun.runId,
        startedAt: activeRun.startedAt,
        finishedAt: result.generatedAt,
        ok: result.ok,
        finalUrl: result.finalUrl,
        headless,
        inputFileName,
        inputMode: "packing-list-auto-download",
        automationImplemented: result.automationImplemented,
        homeOpened: result.homeOpened,
        packingManifestOpened: result.packingManifestOpened,
        poFilterFilled: result.poFilterFilled,
        flexViewPostObserved: result.flexViewPostObserved,
        authMethod: result.authMethod,
        searchedPoNumber: result.searchedPoNumber,
        totalPoCount: result.totalPoCount,
        progress: result.progress,
      });

      return {
        statusCode: result.statusCode,
        body: result,
      };
    } catch (error) {
      const formatted = formatPackingListAutoDownloadError(error);
      log("Packing List auto download failed before response.", {
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
          inputMode: "packing-list-auto-download",
          automationImplemented: false,
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
