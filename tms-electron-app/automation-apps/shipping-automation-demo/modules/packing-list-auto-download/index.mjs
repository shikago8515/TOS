import { formatPackingListAutoDownloadError } from "./errors.mjs";
import { runPackingListAutoDownloadLangGraphWorkflow } from "./langgraph-workflow.mjs";
import { preparePackingListRunDownloadDirectory } from "./download-directory.mjs";
import { validatePackingListWorkbookPayload } from "./workbook.mjs";

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
    let selectedDownloadDirectory = "";
    let downloadDirectory = "";
    let downloadFolderName = "";

    try {
      inputFileName = normalizeUploadFileName(body);
      credentials = resolveCredentials(body);
      workbook = validatePackingListWorkbookPayload(body, deps);
      inputFileName = workbook.inputFileName;
      selectedDownloadDirectory = resolveDownloadDirectory(body);
      const preparedDownloadDirectory = await preparePackingListRunDownloadDirectory(selectedDownloadDirectory);
      selectedDownloadDirectory = preparedDownloadDirectory.selectedDownloadDirectory;
      downloadDirectory = preparedDownloadDirectory.downloadDirectory;
      downloadFolderName = preparedDownloadDirectory.downloadFolderName;
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
      downloadDirectory,
      selectedDownloadDirectory,
      downloadFolderName,
      totalGroupCount: workbook.groups.length,
      totalPoCount: workbook.poNumbers.length,
      progress: {
        phase: "准备箱单查询",
        message: `已读取 ${workbook.groups.length} 个 NO 批次、${workbook.poNumbers.length} 个 PO 号，准备打开箱单页面。`,
        downloadDirectory,
        selectedDownloadDirectory,
        downloadFolderName,
        totalCount: workbook.groups.length,
        totalGroupCount: workbook.groups.length,
        totalPoCount: workbook.poNumbers.length,
        currentPackingListNumbers: [],
        currentPoNumbers: [],
        updatedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await runPackingListAutoDownloadLangGraphWorkflow({
        activeRun,
        browserEngines,
        buildVisibleBrowserLaunchOptions,
        config,
        credentials,
        downloadDirectory,
        downloadConcurrency: body?.downloadConcurrency ?? body?.concurrency,
        selectedDownloadDirectory,
        downloadFolderName,
        ensureLoggedIn,
        headless,
        inputFileName,
        log,
        checkpoint: normalizeCheckpointConfig(body, activeRun.runId),
        resumeMode: normalizeResumeMode(body?.resumeMode),
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
        downloadDirectory,
        selectedDownloadDirectory,
        downloadFolderName,
        inputFileName,
        inputMode: "packing-list-auto-download",
        automationImplemented: result.automationImplemented,
        homeOpened: result.homeOpened,
        packingManifestOpened: result.packingManifestOpened,
        poFilterFilled: result.poFilterFilled,
        flexViewPostObserved: result.flexViewPostObserved,
        authMethod: result.authMethod,
        searchedPoNumber: result.searchedPoNumber,
        totalGroupCount: result.totalGroupCount,
        totalPoCount: result.totalPoCount,
        downloadedPackingListCount: result.downloadedPackingListCount,
        failedPackingListCount: result.failedPackingListCount,
        downloadedFilePaths: result.downloadedFilePaths,
        firstDownloadedFilePath: result.firstDownloadedFilePath,
        groupResults: result.groupResults,
        progress: result.progress,
        checkpoint: result.checkpoint || null,
        resumeMode: result.resumeMode || normalizeResumeMode(body?.resumeMode),
        langGraph: result.langGraph || null,
      });

      return {
        statusCode: result.statusCode,
        body: result,
      };
    } catch (error) {
      const formatted = formatPackingListAutoDownloadError(error);
      const failedAt = new Date().toISOString();
      log("Packing List auto download failed before response.", {
        runId: activeRun.runId,
        message: formatted.message,
        stage: formatted.stage,
      });
      recordCompletedRun({
        runId: activeRun.runId,
        startedAt: activeRun.startedAt,
        finishedAt: failedAt,
        ok: false,
        status: "failed",
        headless,
        downloadDirectory,
        selectedDownloadDirectory,
        downloadFolderName,
        inputFileName,
        inputMode: "packing-list-auto-download",
        automationImplemented: false,
        stage: formatted.stage,
        message: formatted.message,
        detail: formatted.detail,
        progress: activeRun.progress || null,
        langGraph: error?.langGraph || activeRun.progress?.langGraph || null,
      });
      return {
        statusCode: formatted.statusCode,
        body: {
          ok: false,
          runId: activeRun.runId,
          generatedAt: failedAt,
          stage: formatted.stage,
          message: formatted.message,
          detail: formatted.detail,
          downloadDirectory,
          selectedDownloadDirectory,
          downloadFolderName,
          inputFileName,
          inputMode: "packing-list-auto-download",
          automationImplemented: false,
          checkpoint: normalizeCheckpointConfig(body, activeRun.runId),
          langGraph: error?.langGraph || activeRun.progress?.langGraph || null,
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

function resolveDownloadDirectory(body) {
  const value = String(
    body?.downloadDirectory
      || body?.saveDirectory
      || body?.outputDirectory
      || "",
  ).trim();
  if (!value) {
    const error = new Error("请先选择箱单 PDF 下载保存目录。");
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function normalizeResumeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ["new", "restart", "continue", "retry-failed"].includes(mode) ? mode : "new";
}

function normalizeCheckpointConfig(body, runId) {
  const checkpoint = body?.checkpoint && typeof body.checkpoint === "object" ? body.checkpoint : null;
  const batchId = String(body?.batchId || checkpoint?.batchId || "").trim();
  const backendBaseUrl = String(body?.backendBaseUrl || checkpoint?.backendBaseUrl || "").trim();
  if (!batchId || !backendBaseUrl) {
    return {
      enabled: false,
      batchId,
      runId,
    };
  }
  return {
    enabled: body?.checkpointEnabled !== false,
    backendBaseUrl,
    batchId,
    attemptId: String(body?.attemptId || checkpoint?.attemptId || "").trim(),
    runId: String(body?.backendRunId || checkpoint?.runId || runId || "").trim(),
    mode: normalizeResumeMode(body?.resumeMode || checkpoint?.mode),
    snapshot: checkpoint?.snapshot && typeof checkpoint.snapshot === "object" ? checkpoint.snapshot : null,
  };
}
