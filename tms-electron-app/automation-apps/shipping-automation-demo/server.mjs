import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  createPoAutoDownloadAutomation,
  isPoAutoDownloadDirectoryRoute,
  isPoAutoDownloadRoute,
  selectPoAutoDownloadDirectory,
} from "./po-auto-download/po-auto-download.mjs";
import {
  collectInfornexusAutoAddSearchDiagnostics,
  formatInfornexusAutoAddSearchDiagnostics,
  INFORNEXUS_AUTO_ADD_SEARCH_URL,
  createInfornexusAutoAddManualSessionManager,
  getInfornexusAutoAddSearchButton,
  getInfornexusAutoAddSearchInput,
  openInfornexusAutoAddSearchPage,
} from "./infornexus-auto-add-page.mjs";
import { createShipping2ReleasedBulkAutomation } from "./shipping2-released-bulk.mjs";
import { createShipping2UnreleasedBulkAutomation } from "./shipping2-unreleased-bulk.mjs";
import {
  createTcInvAutomation,
  isTcInvAutomationRoute,
} from "./modules/tc-inv-automation/index.mjs";
import {
  createPackingListAutoDownloadAutomation,
  isPackingListAutoDownloadRoute,
} from "./modules/packing-list-auto-download/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = __dirname;
const runtimeDataRoot = process.env.TMS_PLAYWRIGHT_DATA_DIR
  ? path.resolve(process.env.TMS_PLAYWRIGHT_DATA_DIR)
  : appRoot;
const bundledConfigPath = path.join(appRoot, "executor.config.json");
const runtimeConfigPath = path.join(runtimeDataRoot, "executor.config.local.json");
const artifactsDir = path.join(runtimeDataRoot, "run-artifacts");
const PREPARE_NEXT_PO_DIALOG_TIMEOUT_MS = 3000;
const XINLONGTAI_SHIPPING_AUTOMATION_ID = "xinlongtai-shipping-automation";
const DESKTOP_UTILITY_CONNECTION_PATTERN = /taking longer than normal for the desktop to connect|Desktop Utility process is running|version\s+2\.0\.1\.29|re-loading the PackByScan application|Awaiting desktop|PackByScan/i;
const INFOR_NEXUS_EXTENSION_ID = "fkmgjdbgapopggcnkapkodfjeblddieo";
const INFOR_NEXUS_NATIVE_HOST = "com.gtnexus.packbyscan.chrome_native_bridge";
const BUSINESS_DATA_EMPTY_CODE = "INFORNEXUS_BUSINESS_DATA_EMPTY";

const sharedExecutorRoot = resolveSharedExecutorRoot();
const sharedPackageJson = path.join(sharedExecutorRoot, "package.json");
const requireShared = createRequire(sharedPackageJson);
const { chromium, firefox, webkit } = requireShared("playwright");
const xlsx = requireShared("xlsx");
const executorVersion = await resolveExecutorVersion();

const browserEngines = { chromium, firefox, webkit };
const VISIBLE_CHROMIUM_WINDOW_ARGS = ["--start-maximized", "--window-position=0,0"];

function resolveSharedExecutorRoot() {
  const candidates = [
    process.env.TMS_AUTOMATION_SHARED_EXECUTOR_ROOT,
    process.env.TMS_AUTOMATION_APP_ROOT
      ? path.join(process.env.TMS_AUTOMATION_APP_ROOT, "playwright-console")
      : "",
    path.resolve(appRoot, "..", "playwright-console"),
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (!normalized) {
      continue;
    }
    const packageJsonPath = path.join(path.resolve(normalized), "package.json");
    if (existsSync(packageJsonPath)) {
      return path.resolve(normalized);
    }
  }

  return path.resolve(appRoot, "..", "playwright-console");
}

await ensureRuntimeFiles();
const config = await loadConfig();
const {
  extractShipping2ReleasedBulkRowsFromWorkbookPayload,
  processShipping2ReleasedBulkWorksheet,
  formatReleasedBulkSaveDecisionMessage,
} = createShipping2ReleasedBulkAutomation({
  config,
  log,
  forceClickLocator,
  showAutomationBadge,
  xlsx,
  assertWorkbookPayload,
  resolveWorksheetName,
});
const {
  extractShipping2UnreleasedBulkRowsFromWorkbookPayload,
  processShipping2UnreleasedBulkWorksheet,
  formatUnreleasedBulkSaveDecisionMessage,
} = createShipping2UnreleasedBulkAutomation({
  config,
  log,
  forceClickLocator,
  showAutomationBadge,
  xlsx,
  assertWorkbookPayload,
  resolveWorksheetName,
});

const activeRuns = new Map();
let lastRun = null;
const recentRuns = [];
const autoAddManualSessionManager = createInfornexusAutoAddManualSessionManager({
  browserEngines,
  buildVisibleBrowserLaunchOptions,
  config,
  ensureLoggedIn,
  log,
  safePageTitle,
  safePageUrl,
  showAutomationBadge,
});
const poAutoDownloadAutomation = createPoAutoDownloadAutomation({
  browserEngines,
  buildVisibleBrowserLaunchOptions,
  config,
  ensureLoggedIn,
  extractPoRowsFromWorkbookPayload,
  log,
  normalizeUploadFileName,
  recordCompletedRun,
  registerActiveRun,
  resolveCredentials,
  safePageTitle,
  safePageUrl,
  showAutomationBadge,
  unregisterActiveRun: (runId) => activeRuns.delete(runId),
  xlsx,
});
const tcInvAutomation = createTcInvAutomation({
  artifactsDir,
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
  showAutomationBadge,
  unregisterActiveRun: (runId) => activeRuns.delete(runId),
  xlsx,
});
const packingListAutoDownloadAutomation = createPackingListAutoDownloadAutomation({
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
  unregisterActiveRun: (runId) => activeRuns.delete(runId),
  xlsx,
});

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);
    const requestPath = String(req.url || "/").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (requestPath === "/health" || requestPath === "/api/health")) {
      sendJson(res, 200, buildHealthPayload());
      return;
    }

    if (req.method === "GET" && (requestPath === "/credentials" || requestPath === "/api/credentials")) {
      sendJson(res, 410, buildCredentialsPayload());
      return;
    }

    if (req.method === "PUT" && (requestPath === "/credentials" || requestPath === "/api/credentials")) {
      sendJson(res, 410, buildCredentialsPayload());
      return;
    }

    if (req.method === "DELETE" && (requestPath === "/credentials" || requestPath === "/api/credentials")) {
      sendJson(res, 410, buildCredentialsPayload());
      return;
    }

    if (req.method === "GET" && await trySendArtifactDownload(requestPath, res)) {
      return;
    }

    if (req.method === "POST" && isPoAutoDownloadDirectoryRoute(requestPath)) {
      const body = await readJsonBody(req);
      authorize(req, body);
      const result = await selectPoAutoDownloadDirectory(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === "POST" && isPoAutoDownloadRoute(requestPath)) {
      const body = await readJsonBody(req);
      authorize(req, body);
      const result = await poAutoDownloadAutomation.handleRequest(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === "POST" && isTcInvAutomationRoute(requestPath)) {
      const body = await readJsonBody(req);
      authorize(req, body);
      const result = await tcInvAutomation.handleRequest(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === "POST" && isPackingListAutoDownloadRoute(requestPath)) {
      const body = await readJsonBody(req);
      authorize(req, body);
      const result = await packingListAutoDownloadAutomation.handleRequest(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const shipping2BulkRoute = requestPath.match(/^\/(?:api\/)?run-shipping2-(unreleased|released)-bulk$/);
    if (req.method === "POST" && shipping2BulkRoute) {
      const bulkType = shipping2BulkRoute[1];
      const body = await readJsonBody(req);
      authorize(req, body);

      const requestBulkType = String(body?.bulkType || "").trim().toLowerCase();
      if (requestBulkType && requestBulkType !== bulkType) {
        const error = new Error("Bulk type does not match the requested automation route.");
        error.statusCode = 400;
        throw error;
      }

      const credentials = resolveCredentials(body);
      const headless = resolveRunHeadless(body);
      const releasedBulkRows = bulkType === "released"
        ? extractShipping2ReleasedBulkRowsFromWorkbookPayload(body)
        : [];
      const unreleasedBulkRows = bulkType === "unreleased"
        ? extractShipping2UnreleasedBulkRowsFromWorkbookPayload(body)
        : [];
      const shipping2BulkRows = bulkType === "released" ? releasedBulkRows : unreleasedBulkRows;
      const shipping2BulkPoNumbers = shipping2BulkRows.map((row) => row.poNo).filter(Boolean);
      const inputFileName = normalizeUploadFileName(body);
      const activeRun = registerActiveRun({
        action: `run-shipping2-${bulkType}-bulk`,
        browser: config.browser,
        headless,
        bulkType,
        inputFileName,
        inputMode: "shipping2-bulk",
        totalPoCount: shipping2BulkPoNumbers.length,
      });

      try {
        const result = await runShipping2BulkFile(credentials, bulkType, inputFileName, activeRun.runId, {
          releasedBulkRows,
          headless,
          unreleasedBulkRows,
        });
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          bulkType,
          inputFileName,
          eventManagementOpened: result.eventManagementOpened,
          homeOpened: result.homeOpened,
          shipping2BulkFilterApplied: result.shipping2BulkFilterApplied,
          shipping2BulkPoCount: result.shipping2BulkPoCount,
          releasedBulkFilterApplied: result.releasedBulkFilterApplied,
          releasedBulkPoCount: result.releasedBulkPoCount,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    if (req.method === "POST" && (requestPath === "/open-shipment-scan" || requestPath === "/api/open-shipment-scan")) {
      const body = await readJsonBody(req);
      authorize(req, body);

      const credentials = resolveCredentials(body);
      const headless = resolveRunHeadless(body);
      const activeRun = registerActiveRun({
        action: "open-shipment-scan",
        browser: config.browser,
        headless,
      });

      try {
        const result = await openShipmentScan(credentials, activeRun.runId, { headless });
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          shipmentScanOpened: result.shipmentScanOpened,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    if (req.method === "POST" && (requestPath === "/open-infornexus-home" || requestPath === "/api/open-infornexus-home")) {
      const body = await readJsonBody(req);
      authorize(req, body);

      const credentials = resolveCredentials(body);
      const headless = resolveRunHeadless(body);
      const activeRun = registerActiveRun({
        action: "open-infornexus-home",
        browser: config.browser,
        headless,
      });

      try {
        const result = await openInfornexusHome(credentials, activeRun.runId, { headless });
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          homeOpened: result.homeOpened,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    if (req.method === "POST" && (requestPath === "/open-infornexus-auto-add-search" || requestPath === "/api/open-infornexus-auto-add-search")) {
      const body = await readJsonBody(req);
      authorize(req, body);

      const credentials = resolveCredentials(body);
      const headless = toBoolean(body?.headless, false);
      const activeRun = registerActiveRun({
        action: "open-infornexus-auto-add-search",
        browser: config.browser,
        headless,
      });

      try {
        const result = await autoAddManualSessionManager.open(credentials, { headless });
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          searchOpened: result.searchOpened,
          manualSessionId: result.manualSessionId,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    if (req.method === "POST" && (requestPath === "/run-infornexus-auto-add-file" || requestPath === "/api/run-infornexus-auto-add-file")) {
      const body = await readJsonBody(req);
      authorize(req, body);

      const credentials = resolveCredentials(body);
      const headless = resolveRunHeadless(body);
      const idRows = extractInfornexusAutoAddRowsFromWorkbookPayload(body);
      const inputFileName = normalizeUploadFileName(body);
      const activeRun = registerActiveRun({
        action: "run-infornexus-auto-add-file",
        browser: config.browser,
        headless,
        inputFileName,
        inputMode: "infornexus-auto-add",
        totalIdCount: idRows.length,
      });

      try {
        const result = await runInfornexusAutoAddFile(credentials, idRows, inputFileName, activeRun.runId, { headless });
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          inputFileName,
          totalIdCount: result.totalIdCount,
          completedIdCount: result.completedIdCount,
          failedIdCount: result.failedIdCount,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    const isShippingFileRequest = requestPath === "/run-shipping-file" || requestPath === "/api/run-shipping-file";
    const isXinlongtaiShippingFileRequest = requestPath === "/run-xinlongtai-shipping-file"
      || requestPath === "/api/run-xinlongtai-shipping-file";
    if (req.method === "POST" && (isShippingFileRequest || isXinlongtaiShippingFileRequest)) {
      const body = await readJsonBody(req);
      authorize(req, body);

      const credentials = resolveCredentials(body);
      const headless = resolveRunHeadless(body);
      const isXinlongtaiShippingRun = isXinlongtaiShippingFileRequest || isXinlongtaiShippingRequestBody(body);
      const poRows = extractPoRowsFromWorkbookPayload(body, {
        isXinlongtaiWorkbook: isXinlongtaiShippingRun,
      });
      const inputFileName = normalizeUploadFileName(body);
      const activeRun = registerActiveRun({
        action: isXinlongtaiShippingRun ? "run-xinlongtai-shipping-file" : "run-shipping-file",
        browser: config.browser,
        headless,
        inputFileName,
        inputMode: "local-file",
        totalPoCount: poRows.length,
      });

      try {
        const result = await runShippingFile(credentials, poRows, inputFileName, activeRun.runId, {
          headless,
          shipmentScanAction: isXinlongtaiShippingRun ? "remove-change-equipment-id" : "assign-equipment-id",
        });
        result.artifacts = await persistRunArtifacts(result, poRows, activeRun.runId);
        recordCompletedRun({
          runId: activeRun.runId,
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          inputFileName,
          totalPoCount: result.totalPoCount,
          completedPoCount: result.completedPoCount,
          failedPoCount: result.failedPoCount,
        });
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRuns.delete(activeRun.runId);
      }
      return;
    }

    sendJson(res, 404, {
      ok: false,
      message: "Not found",
      path: requestPath,
      method: req.method,
    });
  } catch (error) {
    sendJson(res, error.statusCode ?? 500, {
      ok: false,
      message: error.message || "Unexpected executor error",
    });
  }
});

server.listen(config.port, config.host, () => {
  log(`Shipping automation executor listening on http://${config.host}:${config.port}`);
  log(`Visible browser mode: ${config.headless ? "off" : "on"}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function ensureRuntimeFiles() {
  await mkdir(runtimeDataRoot, { recursive: true });
  await mkdir(artifactsDir, { recursive: true });
}

async function loadConfig() {
  const base = await readJsonIfExists(bundledConfigPath, {});
  const override = await readJsonIfExists(runtimeConfigPath, {});
  const merged = {
    ...base,
    ...override,
    launchOptions: {
      ...(base.launchOptions && typeof base.launchOptions === "object" ? base.launchOptions : {}),
      ...(override.launchOptions && typeof override.launchOptions === "object" ? override.launchOptions : {}),
    },
  };

  return {
    host: String(process.env.TMS_PLAYWRIGHT_HOST || merged.host || "0.0.0.0"),
    port: Number(process.env.TMS_PLAYWRIGHT_PORT || merged.port || 3003),
    token: String(merged.token || ""),
    loginUrl: String(merged.loginUrl || "https://network.infornexus.com"),
    autoAddSearchUrl: String(merged.autoAddSearchUrl || INFORNEXUS_AUTO_ADD_SEARCH_URL),
    browser: String(merged.browser || "chromium"),
    headless: Boolean(merged.headless),
    slowMo: Number(merged.slowMo ?? 40),
    navigationTimeoutMs: Number(merged.navigationTimeoutMs ?? 45000),
    postLoginWaitMs: Number(merged.postLoginWaitMs ?? 500),
    keepBrowserOpenOnSuccessMs: Number(merged.keepBrowserOpenOnSuccessMs ?? 2000),
    keepBrowserOpenOnErrorMs: Number(merged.keepBrowserOpenOnErrorMs ?? 2000),
    inforNexusExtensionPath: resolveInforNexusExtensionPath(merged.inforNexusExtensionPath),
    launchOptions: merged.launchOptions && typeof merged.launchOptions === "object"
      ? merged.launchOptions
      : {},
  };
}

function buildHealthPayload() {
  const activeRunList = Array.from(activeRuns.values());
  const appId = String(process.env.TOS_AUTOMATION_APP_ID || "shipping-automation-demo").trim();
  const moduleVersion = String(process.env.TOS_AUTOMATION_MODULE_VERSION || "").trim();
  const moduleSource = String(process.env.TOS_AUTOMATION_MODULE_SOURCE || "bundled").trim();
  const desktopBridge = collectInforNexusDesktopBridgeDiagnostics();
  return {
    ok: true,
    appId,
    port: config.port,
    version: executorVersion,
    helperVersion: executorVersion,
    moduleVersion,
    moduleSource,
    moduleSha256: String(process.env.TOS_AUTOMATION_MODULE_SHA256 || "").trim(),
    busy: activeRunList.length > 0,
    activeRun: activeRunList[0] || null,
    activeRuns: activeRunList,
    activeRunCount: activeRunList.length,
    manualSession: autoAddManualSessionManager.getSessionSummary(),
    lastRun,
    recentRuns,
    dataDir: runtimeDataRoot,
    runtimeConfigPath,
    desktopBridge,
    capabilities: {
      infornexusAutoAddManualSearch: true,
      poAutoDownload: true,
      poAutoDownloadDirectoryPicker: true,
      poAutoDownloadRequestDownload: true,
      tcInvAutomation: true,
      packingListAutoDownload: true,
      packingListAutoDownloadDirectoryPicker: true,
    },
    config: {
      version: executorVersion,
      appId,
      moduleVersion,
      moduleSource,
      loginUrl: config.loginUrl,
      autoAddSearchUrl: config.autoAddSearchUrl,
      browser: config.browser,
      headless: config.headless,
      slowMo: config.slowMo,
      navigationTimeoutMs: config.navigationTimeoutMs,
      postLoginWaitMs: config.postLoginWaitMs,
      keepBrowserOpenOnSuccessMs: config.keepBrowserOpenOnSuccessMs,
      keepBrowserOpenOnErrorMs: config.keepBrowserOpenOnErrorMs,
      inforNexusExtensionPath: config.inforNexusExtensionPath,
      launchOptions: config.launchOptions,
      credentialsSource: "tos-backend-database",
    },
  };
}

function mergeBrowserArgs(currentArgs, requiredArgs) {
  const args = Array.isArray(currentArgs) ? currentArgs : [];
  const merged = [...args];
  for (const arg of requiredArgs) {
    if (!merged.includes(arg)) {
      merged.push(arg);
    }
  }
  return merged;
}

function buildVisibleBrowserLaunchOptions(baseOptions, browserName) {
  const launchOptions = { ...(baseOptions || {}) };
  if (!launchOptions.headless && String(browserName || "").toLowerCase() === "chromium") {
    launchOptions.args = mergeBrowserArgs(launchOptions.args, VISIBLE_CHROMIUM_WINDOW_ARGS);
  }
  return launchOptions;
}

function resolveInforNexusExtensionPath(configuredPath) {
  const configured = String(process.env.TMS_INFOR_NEXUS_EXTENSION_PATH || configuredPath || "").trim();
  const candidate = configured || path.join(
    process.env.APPDATA || "",
    "TOS-Automation-Helper",
    "infor-nexus-extension",
    INFOR_NEXUS_EXTENSION_ID,
  );
  const resolved = path.resolve(candidate);
  return existsSync(path.join(resolved, "manifest.json")) ? resolved : "";
}

function collectInforNexusDesktopBridgeDiagnostics() {
  const nativeHosts = collectInforNexusNativeHostRegistrations();
  const activeBrowser = resolveInforNexusNativeHostBrowser(config.launchOptions?.channel);
  const activeNativeHosts = activeBrowser
    ? nativeHosts.filter((item) => item.browser === activeBrowser)
    : nativeHosts;
  return {
    extensionId: INFOR_NEXUS_EXTENSION_ID,
    extensionPath: config.inforNexusExtensionPath,
    extensionInstalledForAutomation: Boolean(config.inforNexusExtensionPath),
    nativeHostName: INFOR_NEXUS_NATIVE_HOST,
    nativeHostRegistered: activeNativeHosts.some((item) => item.registered),
    nativeHosts,
    activeBrowser,
    browser: config.browser,
    channel: String(config.launchOptions?.channel || ""),
  };
}

function resolveInforNexusNativeHostBrowser(channel) {
  const normalized = String(channel || "").toLowerCase();
  if (normalized.includes("edge")) return "edge";
  if (normalized.includes("chrome")) return "chrome";
  return "";
}

function collectInforNexusNativeHostRegistrations() {
  const registryKeys = [
    {
      browser: "chrome",
      scope: "current-user",
      key: `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${INFOR_NEXUS_NATIVE_HOST}`,
    },
    {
      browser: "chrome",
      scope: "local-machine",
      key: `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${INFOR_NEXUS_NATIVE_HOST}`,
    },
    {
      browser: "edge",
      scope: "current-user",
      key: `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${INFOR_NEXUS_NATIVE_HOST}`,
    },
    {
      browser: "edge",
      scope: "local-machine",
      key: `HKLM\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${INFOR_NEXUS_NATIVE_HOST}`,
    },
  ];

  return registryKeys.map((entry) => ({
    ...entry,
    registered: isRegistryKeyPresent(entry.key),
  }));
}

function isRegistryKeyPresent(key) {
  if (process.platform !== "win32") {
    return false;
  }
  try {
    execFileSync("reg.exe", ["query", key, "/ve"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function canUseInforNexusExtensionLaunch(browserName, launchOptions) {
  const channel = String(launchOptions?.channel || "").toLowerCase();
  return Boolean(
    config.inforNexusExtensionPath
    && !launchOptions.headless
    && String(browserName || "").toLowerCase() === "chromium"
    && channel === "chrome"
  );
}

function addInforNexusExtensionArgs(currentArgs) {
  const extensionPath = config.inforNexusExtensionPath;
  let args = Array.isArray(currentArgs) ? [...currentArgs] : [];
  args = mergeExtensionBrowserArg(args, "--disable-extensions-except=", extensionPath);
  args = mergeExtensionBrowserArg(args, "--load-extension=", extensionPath);
  return args;
}

function mergeIgnoreDefaultArgs(currentValue, requiredArgs) {
  const existing = Array.isArray(currentValue) ? [...currentValue] : [];
  for (const arg of requiredArgs) {
    if (!existing.includes(arg)) {
      existing.push(arg);
    }
  }
  return existing;
}

function mergeExtensionBrowserArg(args, prefix, extensionPath) {
  const existingIndex = args.findIndex((arg) => String(arg || "").startsWith(prefix));
  if (existingIndex === -1) {
    return [...args, `${prefix}${extensionPath}`];
  }

  const existingValue = String(args[existingIndex] || "").slice(prefix.length);
  const paths = existingValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paths.includes(extensionPath)) {
    paths.push(extensionPath);
  }
  const merged = [...args];
  merged[existingIndex] = `${prefix}${paths.join(",")}`;
  return merged;
}

function resolveInforNexusBrowserProfileDir(runId) {
  return path.join(runtimeDataRoot, "browser-profiles", `infor-nexus-${runId}`);
}

function buildCredentialsPayload() {
  return {
    ok: false,
    hasStoredCredentials: false,
    username: "",
    message: "Executor credential storage has moved to the TOS backend database.",
  };
}

function resolveCredentials(body) {
  const username = normalizeInforNexusUsernameForLogin(body?.username || body?.userId || "");
  const password = String(body?.password || "");
  if (!username || !password) {
    const error = new Error("请提供 Infor Nexus 登录账号密码。");
    error.statusCode = 400;
    throw error;
  }
  return { username, password };
}

function normalizeInforNexusUsernameForLogin(value) {
  return String(value || "").trim();
}

function registerActiveRun(run) {
  const runId = createRunId(run?.action || "run");
  const activeRun = {
    runId,
    startedAt: new Date().toISOString(),
    ...run,
  };
  activeRuns.set(runId, activeRun);
  return activeRun;
}

function recordCompletedRun(run) {
  lastRun = run;
  recentRuns.unshift(run);
  recentRuns.splice(20);
}

function createRunId(action) {
  const actionSlug = sanitizeFileSegment(action || "run");
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomPart}-${actionSlug}`;
}

function sanitizeFileSegment(value) {
  return String(value || "run")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "run";
}

async function resolveExecutorVersion() {
  const envVersion = String(process.env.TOS_AUTOMATION_HELPER_VERSION || "").trim();
  if (envVersion) {
    return envVersion;
  }

  try {
    const packageJson = JSON.parse(
      await readFile(path.join(appRoot, "package.json"), "utf8"),
    );
    return String(packageJson.version || "").trim();
  } catch (_error) {
    return "";
  }
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  }
  return Boolean(fallback);
}

function resolveRunHeadless(runContext) {
  return toBoolean(runContext?.headless, config.headless);
}

function normalizeShipmentScanAction(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["assign", "assign-equipment-id", "assign equipment id"].includes(normalized)) {
    return "Assign Equipment ID";
  }
  return "Remove/Change Equipment ID";
}

function getShipmentScanToolbarActionLabel(shipmentScanAction) {
  return isAssignEquipmentShipmentScanAction(shipmentScanAction)
    ? "Assign Equipment ID"
    : "Change Equipment ID";
}

function isAssignEquipmentShipmentScanAction(value) {
  return normalizeShipmentScanAction(value) === "Assign Equipment ID";
}

function isXinlongtaiShippingRequestBody(body) {
  const automationId = String(
    body?.automationId
      || body?.moduleId
      || body?.entryId
      || "",
  ).trim();
  return automationId === XINLONGTAI_SHIPPING_AUTOMATION_ID;
}

function resolveShipmentScanAction(runContext) {
  return normalizeShipmentScanAction(runContext?.shipmentScanAction);
}

async function openShipmentScan(credentials, runId, options = {}) {
  return runShippingWorkflow(credentials, {
    runId,
    poRows: [],
    inputFileName: "",
    fillPoNumbers: false,
    headless: options?.headless,
    targetPage: "shipment-scan",
  });
}

async function openInfornexusHome(credentials, runId, options = {}) {
  return runShippingWorkflow(credentials, {
    runId,
    poRows: [],
    inputFileName: "",
    fillPoNumbers: false,
    headless: options?.headless,
    targetPage: "home",
  });
}

async function runShipping2BulkFile(credentials, bulkType, inputFileName, runId, options = {}) {
  return runShippingWorkflow(credentials, {
    runId,
    poRows: [],
    inputFileName,
    fillPoNumbers: false,
    headless: options?.headless,
    targetPage: "event-management",
    shipping2BulkType: bulkType,
    releasedBulkRows: Array.isArray(options?.releasedBulkRows)
      ? options.releasedBulkRows
      : [],
    unreleasedBulkRows: Array.isArray(options?.unreleasedBulkRows)
      ? options.unreleasedBulkRows
      : [],
  });
}

async function runShippingFile(credentials, poRows, inputFileName, runId, options = {}) {
  return runShippingWorkflow(credentials, {
    runId,
    poRows,
    inputFileName,
    fillPoNumbers: true,
    headless: options?.headless,
    targetPage: "shipment-scan",
    shipmentScanAction: options?.shipmentScanAction,
  });
}

async function runInfornexusAutoAddFile(credentials, idRows, inputFileName, runId, options = {}) {
  return runInfornexusAutoAddWorkflow(credentials, {
    runId,
    idRows,
    inputFileName,
    headless: options?.headless,
  });
}

async function runInfornexusAutoAddWorkflow(credentials, runContext) {
  const engine = browserEngines[config.browser] || chromium;
  const launchOptions = {
    slowMo: config.slowMo,
    ...config.launchOptions,
    headless: resolveRunHeadless(runContext),
  };
  const browserLaunchOptions = buildVisibleBrowserLaunchOptions(launchOptions, config.browser);

  let browser = null;
  let context = null;
  let page = null;
  let lifecycle = null;
  let latestScreenshotPath = "";
  const startedAt = new Date().toISOString();
  const idRows = Array.isArray(runContext?.idRows) ? runContext.idRows : [];
  const runId = String(runContext?.runId || createRunId("infornexus-auto-add"));
  const idResults = [];
  const showRunBadge = async (message, details = {}) => showAutomationBadge(page, {
    title: "Infor Nexus Auto Add 自动化",
    message,
    details: {
      phase: "auto-add",
      inputFileName: runContext?.inputFileName || "",
      totalCount: idRows.length,
      ...details,
    },
  });

  try {
    browser = await engine.launch(browserLaunchOptions);
    context = await browser.newContext({
      viewport: null,
    });
    page = await context.newPage();
    lifecycle = trackBrowserLifecycle(page, context, browser);
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await showRunBadge("正在打开 Infor Nexus 登录页", {
      phase: "open-login",
    });
    await page.goto(config.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await showRunBadge("正在确认 Infor Nexus 登录状态", {
      phase: "login",
    });

    await ensureLoggedIn(page, credentials);
    await showRunBadge("登录完成，正在打开 Auto Add 查询页", {
      phase: "open-search",
    });
    await page.waitForTimeout(config.postLoginWaitMs);
    const autoAddSearchUrl = await openInfornexusAutoAddSearchPage(page, {
      loginUrl: config.loginUrl,
      searchUrl: config.autoAddSearchUrl,
      navigationTimeoutMs: config.navigationTimeoutMs,
      postLoginWaitMs: config.postLoginWaitMs,
    });
    await showRunBadge("Auto Add 查询页已打开", {
      phase: "search-ready",
    });
    log("Opened Infornexus auto-add search page.", {
      autoAddSearchUrl,
      finalUrl: safePageUrl(page),
    });
    await waitForInfornexusAutoAddSearchReady(page);

    for (let index = 0; index < idRows.length; index += 1) {
      const idRow = idRows[index];
      const id = String(idRow?.id || "").trim();
      try {
        await showRunBadge(`正在处理 ID ${id}`, {
          phase: "process-id",
          currentCount: index + 1,
          totalCount: idRows.length,
          id,
        });
        const itemResult = await processInfornexusAutoAddId(page, id);
        idResults.push({
          ...idRow,
          ok: true,
          ...itemResult,
        });
        await showRunBadge(`ID ${id} 已处理`, {
          phase: "process-id",
          currentCount: index + 1,
          totalCount: idRows.length,
          id,
        });
      } catch (error) {
        const normalizedError = normalizeRunError(
          error,
          page,
          lifecycle,
          `ID ${id}: browser page became unavailable during Infornexus auto add.`,
        );
        idResults.push({
          ...idRow,
          ok: false,
          error: normalizedError.message,
        });
        log("Infornexus auto-add ID failed; recorded and continuing.", {
          id,
          rowIndex: Number(idRow?.rowIndex || 0),
          error: normalizedError.message,
        });
        await showRunBadge(`ID ${id} 处理失败，已记录`, {
          phase: "failed",
          currentCount: index + 1,
          totalCount: idRows.length,
          id,
        });
        if (hasPageLifecycleEnded(page, lifecycle) || isClosedTargetError(error)) {
          throw normalizedError;
        }
      }
    }

    if (hasPageLifecycleEnded(page, lifecycle)) {
      throw normalizeRunError(
        new Error("Browser page became unavailable before capturing the final state."),
        page,
        lifecycle,
        "Browser page became unavailable before capturing the final state.",
      );
    }

    latestScreenshotPath = path.join(artifactsDir, `infornexus-auto-add-${runId}-success-${Date.now()}.png`);
    await showRunBadge("Auto Add 自动化已完成", {
      phase: "complete",
      completedCount: idResults.filter((item) => item.ok).length,
      totalCount: idRows.length,
    });
    await page.screenshot({ path: latestScreenshotPath, fullPage: true });

    const failedIdCount = idResults.filter((item) => !item.ok).length;
    const completedIdCount = idResults.filter((item) => item.ok).length;
    const result = {
      runId,
      ok: failedIdCount === 0,
      loginSuccess: true,
      inputMode: "infornexus-auto-add",
      inputFileName: runContext?.inputFileName || "",
      totalIdCount: idRows.length,
      completedIdCount,
      failedIdCount,
      idResults,
      message: `Infornexus auto add processed ${completedIdCount}/${idRows.length} IDs.`,
      generatedAt: new Date().toISOString(),
      finalUrl: safePageUrl(page),
      title: await safePageTitle(page),
      artifacts: {
        latestScreenshotPath,
        lifecycleEvents: lifecycle?.events || [],
      },
    };

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
    }

    return result;
  } catch (error) {
    const normalizedError = normalizeRunError(
      error,
      page,
      lifecycle,
      "Infornexus auto-add browser session became unavailable.",
    );
    let failureMessage = normalizedError.message;
    if (page && !page.isClosed()) {
      await showRunBadge("Auto Add 自动化失败，已保留错误信息", {
        phase: "failed",
      });
      latestScreenshotPath = path.join(artifactsDir, `infornexus-auto-add-${runId}-error-${Date.now()}.png`);
      await page.screenshot({ path: latestScreenshotPath, fullPage: true }).catch(() => {});
      if (latestScreenshotPath) {
        failureMessage = `${failureMessage} Screenshot: ${latestScreenshotPath}`;
      }
    }

    const result = {
      runId,
      ok: false,
      loginSuccess: false,
      inputMode: "infornexus-auto-add",
      inputFileName: runContext?.inputFileName || "",
      totalIdCount: idRows.length,
      completedIdCount: idResults.filter((item) => item.ok).length,
      failedIdCount: Math.max(
        idRows.length - idResults.filter((item) => item.ok).length,
        idResults.filter((item) => !item.ok).length,
      ),
      idResults,
      message: failureMessage || "Infornexus auto add failed.",
      generatedAt: new Date().toISOString(),
      finalUrl: safePageUrl(page),
      title: await safePageTitle(page),
      artifacts: {
        latestScreenshotPath,
        lifecycleEvents: lifecycle?.events || [],
      },
    };

    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }

    return result;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    log("Infornexus auto-add run finished.", {
      startedAt,
      screenshot: latestScreenshotPath,
    });
  }
}

async function runShippingWorkflow(credentials, runContext) {
  const engine = browserEngines[config.browser] || chromium;
  const launchOptions = {
    slowMo: config.slowMo,
    ...config.launchOptions,
    headless: resolveRunHeadless(runContext),
  };
  const browserLaunchOptions = buildVisibleBrowserLaunchOptions(launchOptions, config.browser);

  let browser = null;
  let context = null;
  let page = null;
  let lifecycle = null;
  let latestScreenshotPath = "";
  const startedAt = new Date().toISOString();
  const poRows = Array.isArray(runContext?.poRows) ? runContext.poRows : [];
  const shouldFillPoNumbers = Boolean(runContext?.fillPoNumbers);
  const shipmentScanAction = resolveShipmentScanAction(runContext);
  const runId = String(runContext?.runId || createRunId("adhoc"));
  const targetPage = ["home", "event-management"].includes(runContext?.targetPage)
    ? runContext.targetPage
    : "shipment-scan";
  const shipping2BulkType = ["unreleased", "released"].includes(runContext?.shipping2BulkType)
    ? runContext.shipping2BulkType
    : "";
  const shipping2BulkLabel = shipping2BulkType === "unreleased"
    ? "Unreleased Bulk"
    : shipping2BulkType === "released"
      ? "Released Bulk"
      : "";
  const isShipping2BulkRun = Boolean(shipping2BulkType);
  const releasedBulkRows = shipping2BulkType === "released" && Array.isArray(runContext?.releasedBulkRows)
    ? runContext.releasedBulkRows
    : [];
  const unreleasedBulkRows = shipping2BulkType === "unreleased" && Array.isArray(runContext?.unreleasedBulkRows)
    ? runContext.unreleasedBulkRows
    : [];
  const shipping2BulkRows = shipping2BulkType === "released"
    ? releasedBulkRows
    : shipping2BulkType === "unreleased"
      ? unreleasedBulkRows
      : [];
  const shouldOpenShipmentScan = targetPage === "shipment-scan";
  const shouldOpenEventManagement = targetPage === "event-management" || isShipping2BulkRun;
  const artifactPrefix = isShipping2BulkRun
    ? `shipping2-${shipping2BulkType}-bulk`
    : shouldOpenShipmentScan
      ? "shipment-scan"
      : "infornexus-home";
  const poResults = [];
  const createShipmentResults = [];
  let createShipmentBatches = [];
  let createShipmentEquipmentIds = [];
  let releasedBulkResult = null;
  let unreleasedBulkResult = null;
  const automationBadgeTitle = resolveShippingAutomationBadgeTitle({
    targetPage,
    shipmentScanAction,
    shipping2BulkType,
    shouldFillPoNumbers,
  });
  const showRunBadge = async (message, details = {}) => showAutomationBadge(page, {
    title: automationBadgeTitle,
    message,
    details: {
      phase: "shipping",
      inputFileName: runContext?.inputFileName || "",
      totalCount: poRows.length || shipping2BulkRows.length,
      selectedAction: isShipping2BulkRun ? shipping2BulkLabel : shouldFillPoNumbers ? shipmentScanAction : "",
      ...details,
    },
  });

  try {
    if (shouldOpenShipmentScan && canUseInforNexusExtensionLaunch(config.browser, browserLaunchOptions)) {
      const persistentLaunchOptions = {
        ...browserLaunchOptions,
        args: addInforNexusExtensionArgs(browserLaunchOptions.args),
        ignoreDefaultArgs: mergeIgnoreDefaultArgs(browserLaunchOptions.ignoreDefaultArgs, [
          "--disable-extensions",
        ]),
        viewport: null,
      };
      context = await engine.launchPersistentContext(
        resolveInforNexusBrowserProfileDir(runId),
        persistentLaunchOptions,
      );
      browser = context.browser();
      page = context.pages()[0] || await context.newPage();
      log("Loaded Infor Nexus browser extension for Shipment Scan.", {
        extensionId: INFOR_NEXUS_EXTENSION_ID,
        extensionPath: config.inforNexusExtensionPath,
        nativeHostRegistered: collectInforNexusNativeHostRegistrations().some((item) => item.registered),
      });
    } else {
      browser = await engine.launch(browserLaunchOptions);
      context = await browser.newContext({
        viewport: null,
      });
      page = await context.newPage();
    }
    lifecycle = trackBrowserLifecycle(page, context, browser);
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await showRunBadge("正在打开 Infor Nexus 登录页", {
      phase: "open-login",
    });
    await page.goto(config.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await showRunBadge("正在确认 Infor Nexus 登录状态", {
      phase: "login",
    });

    await ensureLoggedIn(page, credentials);
    await showRunBadge("登录完成，正在打开业务页面", {
      phase: "logged-in",
    });
    await page.waitForTimeout(config.postLoginWaitMs);

    if (shouldOpenShipmentScan) {
      await showRunBadge("正在打开 Print-Scan-Ship / Shipment Scan", {
        phase: "open-shipment-scan",
      });
      await clickLocator(page.locator("#navmenu__applications"), "Applications");
      await clickLocator(
        page.locator("#navmenu__inprogressmanifestsprintscanship"),
        "Print-Scan-Ship",
      );
      await page.waitForURL(/\/en\/trade\/PackByScan/, { timeout: config.navigationTimeoutMs });
      await page.waitForTimeout(config.postLoginWaitMs);
      await showRunBadge("Shipment Scan 已打开", {
        phase: "shipment-scan-ready",
      });
    } else if (shouldOpenEventManagement) {
      await showRunBadge("正在打开 Event Management", {
        phase: "open-event-management",
      });
      await openEventManagement(page);
      await showRunBadge("Event Management 已打开", {
        phase: "event-management-ready",
      });
      if (isShipping2BulkRun) {
        await showRunBadge(`正在打开 ${shipping2BulkLabel} 工作表`, {
          phase: "open-shipping2-worksheet",
        });
        await openShipping2BulkWorksheet(page, shipping2BulkType);
        await showRunBadge(`${shipping2BulkLabel} 工作表已打开`, {
          phase: "shipping2-worksheet-ready",
        });
        if (shipping2BulkType === "released") {
          releasedBulkResult = await processShipping2ReleasedBulkWorksheet(page, releasedBulkRows);
        } else if (shipping2BulkType === "unreleased") {
          unreleasedBulkResult = await processShipping2UnreleasedBulkWorksheet(page, unreleasedBulkRows);
        }
        await showRunBadge(`${shipping2BulkLabel} 自动化已处理完成`, {
          phase: "shipping2-complete",
          completedCount: Number((shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.updatedRowCount || 0),
          failedCount: Number((shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.failedRowCount || 0),
          totalCount: shipping2BulkRows.length,
        });
      }
    }

    if (shouldFillPoNumbers) {
      for (let index = 0; index < poRows.length; index += 1) {
        const poRow = poRows[index];
        const nextPoRow = poRows[index + 1] || null;
        try {
          await showRunBadge(`正在处理 Shipment Scan PO ${String(poRow?.poNo || "").trim()}`, {
            phase: "shipment-scan-po",
            currentCount: index + 1,
            totalCount: poRows.length,
            poNo: String(poRow?.poNo || "").trim(),
            changeEquipmentId: String(poRow?.changeEquipmentId || "").trim(),
          });
          const shipmentResult = await processShipmentPoRow(page, poRow, shipmentScanAction);
          poResults.push({
            ...poRow,
            ok: true,
            changeEquipmentApplyStatus: String(shipmentResult?.status || "applied"),
          });
          await showRunBadge(`Shipment Scan PO ${String(poRow?.poNo || "").trim()} 已完成`, {
            phase: "shipment-scan-po",
            currentCount: index + 1,
            totalCount: poRows.length,
            poNo: String(poRow?.poNo || "").trim(),
            changeEquipmentId: String(poRow?.changeEquipmentId || "").trim(),
          });
          if (nextPoRow && !hasPageLifecycleEnded(page, lifecycle)) {
            await prepareForNextShipmentPoIteration(page, poRow.poNo, nextPoRow.poNo, shipmentScanAction);
          }
        } catch (error) {
          const normalizedError = normalizeRunError(
            error,
            page,
            lifecycle,
            `PO No ${String(poRow?.poNo || "").trim()}: browser page became unavailable during Shipment Scan.`,
          );
          const failureReason = normalizedError.message;
          poResults.push({
            ...poRow,
            ok: false,
            error: failureReason,
            errorCode: normalizedError.code || "",
            failedStep: classifyPoFailureStep(failureReason),
          });
          log("Shipment PO failed; recorded and continuing.", {
            poNo: String(poRow?.poNo || "").trim(),
            error: failureReason,
            nextPoNo: String(nextPoRow?.poNo || "").trim(),
          });
          await showRunBadge(`Shipment Scan PO ${String(poRow?.poNo || "").trim()} 失败，已记录`, {
            phase: normalizedError.code === BUSINESS_DATA_EMPTY_CODE ? "business-empty" : "failed",
            currentCount: index + 1,
            totalCount: poRows.length,
            poNo: String(poRow?.poNo || "").trim(),
            changeEquipmentId: String(poRow?.changeEquipmentId || "").trim(),
            failedStep: classifyPoFailureStep(failureReason),
          });
          if (hasPageLifecycleEnded(page, lifecycle) || isClosedTargetError(error)) {
            throw normalizedError;
          }
          if (nextPoRow) {
            await prepareForNextShipmentPoIteration(page, poRow.poNo, nextPoRow.poNo, shipmentScanAction);
          }
        }
      }

      createShipmentBatches = collectCreateShipmentBatches(poRows);
      createShipmentEquipmentIds = createShipmentBatches.map((batch) => batch.changeEquipmentId);
      if (createShipmentBatches.length > 0) {
        log("Prepared Create Shipment batches.", {
          batchCount: createShipmentBatches.length,
          targetPoCount: createShipmentBatches.reduce(
            (sum, batch) => sum + (Array.isArray(batch?.targetPairs) ? batch.targetPairs.length : 0),
            0,
          ),
          successfulPoCount: poResults.filter((item) => item?.ok).length,
          failedPoCount: poResults.filter((item) => !item?.ok).length,
          equipmentIds: createShipmentEquipmentIds,
        });
      } else {
        log("Skipping Create Shipment because workbook rows did not produce any eligible target pairs.", {
          totalPoCount: poRows.length,
          successfulPoCount: poResults.filter((item) => item?.ok).length,
          failedPoCount: poResults.filter((item) => !item?.ok).length,
        });
      }

      for (let batchIndex = 0; batchIndex < createShipmentBatches.length; batchIndex += 1) {
        const createShipmentBatch = createShipmentBatches[batchIndex];
        const nextCreateShipmentBatch = createShipmentBatches[batchIndex + 1] || null;
        const changeEquipmentId = createShipmentBatch.changeEquipmentId;
        try {
          await showRunBadge(`正在 Create Shipment 设备 ${changeEquipmentId}`, {
            phase: "create-shipment",
            currentCount: batchIndex + 1,
            totalCount: createShipmentBatches.length,
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
          });
          await processCreateShipmentEquipmentId(page, createShipmentBatch);
          createShipmentResults.push({
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
            ok: true,
          });
          await showRunBadge(`Create Shipment 设备 ${changeEquipmentId} 已完成`, {
            phase: "create-shipment",
            currentCount: batchIndex + 1,
            totalCount: createShipmentBatches.length,
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
          });
        } catch (error) {
          const normalizedError = normalizeRunError(
            error,
            page,
            lifecycle,
            `Change Equipment ID ${changeEquipmentId}: browser page became unavailable during Create Shipment.`,
          );
          const failureReason = normalizedError.message;
          createShipmentResults.push({
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
            ok: false,
            error: failureReason,
            errorCode: normalizedError.code || "",
            failedStep: classifyPoFailureStep(failureReason),
          });
          log("Create Shipment batch failed.", {
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
            error: failureReason,
          });
          await showRunBadge(`Create Shipment 设备 ${changeEquipmentId} 失败，已记录`, {
            phase: normalizedError.code === BUSINESS_DATA_EMPTY_CODE ? "business-empty" : "failed",
            currentCount: batchIndex + 1,
            totalCount: createShipmentBatches.length,
            changeEquipmentId,
            poNos: createShipmentBatch.poNos,
            failedStep: classifyPoFailureStep(failureReason),
          });
          if (hasPageLifecycleEnded(page, lifecycle) || isClosedTargetError(error)) {
            throw normalizedError;
          }
        }

        if (nextCreateShipmentBatch && !hasPageLifecycleEnded(page, lifecycle)) {
          await reopenPrintScanShipForNextCreateShipmentBatch(
            page,
            createShipmentBatch,
            nextCreateShipmentBatch,
          );
        }
      }
    } else if (shouldOpenShipmentScan) {
      await openShipmentScanDialog(page, { shipmentScanAction });
    }

    if (hasPageLifecycleEnded(page, lifecycle)) {
      throw normalizeRunError(
        new Error("Browser page became unavailable before capturing the final state."),
        page,
        lifecycle,
        "Browser page became unavailable before capturing the final state.",
      );
    }

    latestScreenshotPath = path.join(artifactsDir, `${artifactPrefix}-${runId}-success-${Date.now()}.png`);
    await showRunBadge("Shipping 自动化已完成，正在生成运行结果", {
      phase: "complete",
      completedCount: poResults.filter((item) => item.ok).length,
      failedCount: poResults.filter((item) => !item.ok).length,
      totalCount: poRows.length || shipping2BulkRows.length,
    });
    await page.screenshot({ path: latestScreenshotPath, fullPage: true });

    const failedPoCount = poResults.filter((item) => !item.ok).length;
    const completedPoCount = poResults.filter((item) => item.ok).length;
    const failedCreateShipmentCount = createShipmentResults.filter((item) => !item.ok).length;
    const completedCreateShipmentCount = createShipmentResults.filter((item) => item.ok).length;
    const businessDataEmptyPoCount = countBusinessDataEmptyResults(poResults);
    const businessDataEmptyCreateShipmentCount = countBusinessDataEmptyResults(createShipmentResults);
    const shipping2BulkResult = shipping2BulkType === "released"
      ? releasedBulkResult
      : shipping2BulkType === "unreleased"
        ? unreleasedBulkResult
        : null;
    const failedShipping2BulkRowCount = Number(shipping2BulkResult?.failedRowCount || 0);
    const completedShipping2BulkRowCount = Number(shipping2BulkResult?.updatedRowCount || 0);
    const shipping2BulkSaveMessage = shipping2BulkType === "unreleased"
      ? formatUnreleasedBulkSaveDecisionMessage(shipping2BulkResult?.saveResult)
      : formatReleasedBulkSaveDecisionMessage(shipping2BulkResult?.saveResult);

    const result = {
      runId,
      ok: failedPoCount === 0 && failedCreateShipmentCount === 0 && failedShipping2BulkRowCount === 0,
      loginSuccess: true,
      shipmentScanOpened: shouldOpenShipmentScan,
      eventManagementOpened: shouldOpenEventManagement,
      shipping2WorksheetOpened: isShipping2BulkRun,
      homeOpened: !shouldOpenShipmentScan && !shouldOpenEventManagement,
      bulkType: shipping2BulkType,
      inputMode: isShipping2BulkRun ? "shipping2-bulk" : shouldFillPoNumbers ? "local-file" : shouldOpenShipmentScan ? "open-only" : "login-only",
      inputFileName: runContext?.inputFileName || "",
      totalPoCount: poRows.length,
      completedPoCount,
      failedPoCount,
      businessDataEmptyPoCount,
      poResults,
      shipping2BulkFilterApplied: Boolean(shipping2BulkResult?.filterApplied),
      shipping2BulkSaved: Boolean(shipping2BulkResult?.saved),
      shipping2BulkSaveResult: shipping2BulkResult?.saveResult || null,
      shipping2BulkPoCount: shipping2BulkRows.length,
      shipping2BulkUpdatedRowCount: completedShipping2BulkRowCount,
      shipping2BulkFailedRowCount: failedShipping2BulkRowCount,
      shipping2BulkUpdateResults: shipping2BulkResult?.rowResults || [],
      releasedBulkFilterApplied: Boolean(shipping2BulkResult?.filterApplied),
      releasedBulkSaved: Boolean(shipping2BulkResult?.saved),
      releasedBulkSaveResult: shipping2BulkResult?.saveResult || null,
      releasedBulkPoCount: shipping2BulkRows.length,
      releasedBulkUpdatedRowCount: completedShipping2BulkRowCount,
      releasedBulkFailedRowCount: failedShipping2BulkRowCount,
      releasedBulkUpdateResults: shipping2BulkResult?.rowResults || [],
      uniqueChangeEquipmentIdCount: createShipmentEquipmentIds.length,
      completedCreateShipmentCount,
      failedCreateShipmentCount,
      businessDataEmptyCreateShipmentCount,
      createShipmentResults,
      selectedAction: isShipping2BulkRun ? shipping2BulkLabel : shouldFillPoNumbers ? shipmentScanAction : "",
      message: shouldFillPoNumbers
        ? `Shipment Scan processed ${completedPoCount}/${poRows.length} PO rows and Create Shipment processed ${completedCreateShipmentCount}/${createShipmentEquipmentIds.length} unique equipment IDs.`
        : isShipping2BulkRun
          ? shipping2BulkResult
            ? `${shipping2BulkLabel} 已筛选 ${shipping2BulkRows.length} 个 PO，并更新 ${completedShipping2BulkRowCount}/${shipping2BulkRows.length} 行。${shipping2BulkSaveMessage}`
            : `${shipping2BulkLabel} 页面已成功打开。`
          : shouldOpenShipmentScan
          ? "Infor Nexus Shipment Scan opened successfully."
          : "Infor Nexus logged in successfully.",
      generatedAt: new Date().toISOString(),
      finalUrl: safePageUrl(page),
      title: await safePageTitle(page),
      artifacts: {
        latestScreenshotPath,
        lifecycleEvents: lifecycle?.events || [],
      },
    };

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
    }

    return result;
  } catch (error) {
    const normalizedError = normalizeRunError(
      error,
      page,
      lifecycle,
      isShipping2BulkRun
        ? `${shipping2BulkLabel} 浏览器会话已中断。`
        : shouldOpenShipmentScan
        ? "Shipment Scan automation browser session became unavailable."
        : "Infor Nexus login browser session became unavailable.",
    );
    const failureMessage = normalizedError.message;
    const businessDataEmptyPoCount = countBusinessDataEmptyResults(poResults);
    const businessDataEmptyCreateShipmentCount = countBusinessDataEmptyResults(createShipmentResults);
    if (page && !page.isClosed()) {
      await showRunBadge("Shipping 自动化失败，已记录错误信息", {
        phase: normalizedError.code === BUSINESS_DATA_EMPTY_CODE ? "business-empty" : "failed",
      });
      latestScreenshotPath = path.join(artifactsDir, `${artifactPrefix}-${runId}-error-${Date.now()}.png`);
      await page.screenshot({ path: latestScreenshotPath, fullPage: true }).catch(() => {});
    }

    const result = {
      runId,
      ok: false,
      loginSuccess: false,
      shipmentScanOpened: false,
      eventManagementOpened: false,
      shipping2WorksheetOpened: false,
      homeOpened: false,
      bulkType: shipping2BulkType,
      inputMode: isShipping2BulkRun ? "shipping2-bulk" : shouldFillPoNumbers ? "local-file" : shouldOpenShipmentScan ? "open-only" : "login-only",
      inputFileName: runContext?.inputFileName || "",
      totalPoCount: poRows.length,
      completedPoCount: poResults.filter((item) => item.ok).length,
      failedPoCount: Math.max(
        poRows.length - poResults.filter((item) => item.ok).length,
        poResults.filter((item) => !item.ok).length,
      ),
      businessDataEmptyPoCount,
      poResults,
      shipping2BulkFilterApplied: Boolean(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.filterApplied,
      ),
      shipping2BulkSaved: Boolean(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.saved,
      ),
      shipping2BulkSaveResult: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.saveResult || null,
      shipping2BulkPoCount: shipping2BulkRows.length,
      shipping2BulkUpdatedRowCount: Number(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.updatedRowCount || 0,
      ),
      shipping2BulkFailedRowCount: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)
        ? Number((shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult).failedRowCount || 0)
        : isShipping2BulkRun
          ? shipping2BulkRows.length
          : 0,
      shipping2BulkUpdateResults: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.rowResults || [],
      releasedBulkFilterApplied: Boolean(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.filterApplied,
      ),
      releasedBulkSaved: Boolean(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.saved,
      ),
      releasedBulkSaveResult: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.saveResult || null,
      releasedBulkPoCount: shipping2BulkRows.length,
      releasedBulkUpdatedRowCount: Number(
        (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.updatedRowCount || 0,
      ),
      releasedBulkFailedRowCount: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)
        ? Number((shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult).failedRowCount || 0)
        : isShipping2BulkRun
          ? shipping2BulkRows.length
          : 0,
      releasedBulkUpdateResults: (shipping2BulkType === "released" ? releasedBulkResult : unreleasedBulkResult)?.rowResults || [],
      uniqueChangeEquipmentIdCount: createShipmentEquipmentIds.length,
      completedCreateShipmentCount: createShipmentResults.filter((item) => item.ok).length,
      failedCreateShipmentCount: createShipmentResults.filter((item) => !item.ok).length,
      businessDataEmptyCreateShipmentCount,
      createShipmentResults,
      selectedAction: isShipping2BulkRun ? shipping2BulkLabel : shouldFillPoNumbers ? shipmentScanAction : "",
      message: failureMessage || (isShipping2BulkRun
        ? `${shipping2BulkLabel} 自动化执行失败。`
        : shouldOpenShipmentScan
          ? "Shipment Scan automation failed."
          : "Infor Nexus login automation failed."),
      generatedAt: new Date().toISOString(),
      finalUrl: safePageUrl(page),
      title: await safePageTitle(page),
      artifacts: {
        latestScreenshotPath,
        lifecycleEvents: lifecycle?.events || [],
      },
    };

    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }

    return result;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    log("Shipping run finished.", {
      startedAt,
      screenshot: latestScreenshotPath,
    });
  }
}

async function ensureLoggedIn(page, credentials) {
  const startedAt = Date.now();
  const applicationsMenu = page.locator("#navmenu__applications").first();
  if (await applicationsMenu.isVisible().catch(() => false)) {
    log("Infor Nexus session already logged in.", {
      elapsedMs: Date.now() - startedAt,
      finalUrl: safePageUrl(page),
    });
    return;
  }

  const usernameField = page.getByPlaceholder("Username");
  const passwordField = page.getByPlaceholder("Password");
  const loginButton = page.getByRole("button", { name: "Log In" });

  const loginVisible = await usernameField
    .waitFor({ state: "visible", timeout: Math.min(config.navigationTimeoutMs, 8000) })
    .then(() => true)
    .catch(() => false);
  if (loginVisible) {
    await usernameField.fill(credentials.username);
    await passwordField.fill(credentials.password);
    await loginButton.click({ force: true, noWaitAfter: true });
    log("Submitted Infor Nexus login.", {
      elapsedMs: Date.now() - startedAt,
      method: "playwright-fill-click",
    });
  }

  await waitForInforNexusLoggedIn(page, Math.min(config.navigationTimeoutMs, 30000));
  log("Infor Nexus logged-in shell ready.", {
    elapsedMs: Date.now() - startedAt,
    finalUrl: safePageUrl(page),
  });
}

async function waitForInforNexusLoggedIn(page, timeoutMs = config.navigationTimeoutMs) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    const state = await page.evaluate(() => {
      const href = String(window.location.href || "");
      const pathname = String(window.location.pathname || "");
      const bodyText = String(document.body?.innerText || "");
      const hasLoginForm = Boolean(document.querySelector('input[placeholder="Username"], input[name*="user" i]'));
      return {
        href,
        pathname,
        readyState: document.readyState,
        isTradePage: /\/en\/trade\/?/i.test(pathname) && !/login/i.test(pathname),
        hasApplicationText: /\bAPPLICATIONS\b/i.test(bodyText),
        hasLoginForm,
        hasAccessCodeChallenge: /Access Code/i.test(bodyText)
          && /(e-Identity|without providing an Access Code|required to log in)/i.test(bodyText),
        hasLoginFailure: hasLoginForm
          && /(invalid|incorrect|not recognized|authentication failed|login failed|try again)/i.test(bodyText),
      };
    }).catch(() => null);

    const applicationsVisible = await page.locator("#navmenu__applications")
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false);
    const navigationAttached = await page.locator("#navmenu__inprogresseventmanagement, #navmenu__inprogressmanifestsprintscanship")
      .first()
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    lastState = {
      ...(state || {}),
      applicationsVisible,
      navigationAttached,
    };

    if (state?.hasAccessCodeChallenge) {
      throw new Error("Infor Nexus 登录需要 Access Code：账号进入 e-Identity 验证流程。请检查 User ID / Password 是否正确，或联系管理员确认账号权限。");
    }

    if (state?.hasLoginFailure) {
      throw new Error("Infor Nexus 登录失败：账号或密码错误，请检查 User ID 和 Password。");
    }

    if (applicationsVisible || navigationAttached || (state?.isTradePage && !state?.hasLoginForm)) {
      return lastState;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Infor Nexus 登录后在 ${timeoutMs}ms 内未进入业务主界面。最后状态：${JSON.stringify(lastState || {})}`);
}

function getInfornexusAutoAddResultCheckbox(page) {
  return page
    .locator('.listtablerowodd [type="checkbox"], .listtableroweven [type="checkbox"], [name="searchResults"] [type="checkbox"]')
    .first();
}

function getInfornexusAutoAddButton(page) {
  return page
    .locator('[name="searchResults"] [type="button"], [name="searchResults"] input[type="button"], [name="searchResults"] button')
    .first();
}

async function waitForInfornexusAutoAddSearchReady(page) {
  const searchInput = getInfornexusAutoAddSearchInput(page);
  try {
    await searchInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
    await getInfornexusAutoAddSearchButton(page).waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = await collectInfornexusAutoAddSearchDiagnostics(page);
    throw new Error(
      `Infornexus auto-add search form was not found after login. ${message} ${formatInfornexusAutoAddSearchDiagnostics(diagnostics)}`,
    );
  }
}

async function processInfornexusAutoAddId(page, id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    throw new Error("ID is empty.");
  }

  await waitForInfornexusAutoAddSearchReady(page);
  await fillInfornexusAutoAddSearchInput(page, normalizedId);
  await page.waitForTimeout(100);

  const searchButton = getInfornexusAutoAddSearchButton(page);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    forceClickLocator(searchButton, "Infornexus Search"),
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(350);

  const resultInfo = await waitForInfornexusAutoAddResultCount(page, normalizedId);
  if (resultInfo.matchCount >= 2) {
    log("Infornexus ID already appears added.", {
      id: normalizedId,
      matchCount: resultInfo.matchCount,
    });
    return {
      id: normalizedId,
      status: "already-added",
      matchCount: resultInfo.matchCount,
    };
  }

  const checkbox = getInfornexusAutoAddResultCheckbox(page);
  await checkbox.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await forceClickLocator(checkbox, "Infornexus result checkbox");
  await page.waitForTimeout(100);

  const addButton = getInfornexusAutoAddButton(page);
  await addButton.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    forceClickLocator(addButton, "Infornexus Add"),
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(350);

  log("Infornexus ID searched and added.", {
    id: normalizedId,
    matchCount: resultInfo.matchCount,
  });
  return {
    id: normalizedId,
    status: "added",
    matchCount: resultInfo.matchCount,
  };
}

async function fillInfornexusAutoAddSearchInput(page, id) {
  const searchInput = getInfornexusAutoAddSearchInput(page);
  await searchInput.evaluate((element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, id);
}

async function waitForInfornexusAutoAddResultCount(page, id, timeoutMs = config.navigationTimeoutMs) {
  const normalizedId = String(id || "").trim();
  const startedAt = Date.now();
  let firstSeenAt = 0;
  let lastMatchCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    lastMatchCount = await countInfornexusAutoAddResultCells(page, normalizedId);
    if (lastMatchCount > 0) {
      if (!firstSeenAt) {
        firstSeenAt = Date.now();
      }
      if (lastMatchCount >= 2 || Date.now() - firstSeenAt > 2000) {
        return { matchCount: lastMatchCount };
      }
    }
    await page.waitForTimeout(150);
  }

  throw new Error(`ID ${normalizedId}: search result was not found. Last match count: ${lastMatchCount}.`);
}

async function countInfornexusAutoAddResultCells(page, id) {
  return page.locator(".listtablecell").evaluateAll((cells, targetId) => {
    return cells.filter((cell) => String(cell.textContent || "").includes(targetId)).length;
  }, id).catch(() => 0);
}

async function openEventManagement(page) {
  const attempts = [
    {
      label: "applications-menu",
      run: async () => {
        const applications = page.locator("#navmenu__applications").first();
        await applications.waitFor({
          state: "visible",
          timeout: Math.min(config.navigationTimeoutMs, 5000),
        });
        await forceClickLocator(applications, "Applications");
        await page.waitForTimeout(150);

        const eventManagement = page.locator("#navmenu__inprogresseventmanagement").first();
        await eventManagement.waitFor({
          state: "visible",
          timeout: Math.min(config.navigationTimeoutMs, 5000),
        });
        await forceClickLocator(eventManagement, "Event Management");
      },
    },
    {
      label: "dom-id-fallback",
      run: async () => {
        const clicked = await page.evaluate(() => {
          const clickById = (id) => {
            const element = document.getElementById(id);
            if (!(element instanceof HTMLElement)) {
              return false;
            }
            const fireMouse = (type) => {
              element.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
              }));
            };
            ["mouseover", "mouseenter", "mousedown", "mouseup", "click"].forEach(fireMouse);
            element.click?.();
            return true;
          };

          if (!clickById("navmenu__applications")) {
            return false;
          }
          return clickById("navmenu__inprogresseventmanagement");
        });

        if (!clicked) {
          throw new Error("Applications/Event Management navigation items were not clickable by id.");
        }
      },
    },
    {
      label: "direct-url-fallback",
      run: async () => {
        const targetUrl = new URL(
          "/en/trade/InProgressEventManagement?nav=navmenu__inprogresseventmanagement",
          page.url(),
        ).toString();
        await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: Math.min(config.navigationTimeoutMs, 15000),
        });
      },
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await attempt.run();
      await waitForEventManagementPage(page, Math.min(config.navigationTimeoutMs, 12000));
      await page.waitForTimeout(config.postLoginWaitMs);
      log("Event Management page opened.", {
        method: attempt.label,
        finalUrl: safePageUrl(page),
      });
      return;
    } catch (error) {
      lastError = error;
      log("Event Management open attempt failed.", {
        method: attempt.label,
        error: error instanceof Error ? error.message : String(error),
        currentUrl: safePageUrl(page),
      });
    }
  }

  throw lastError || new Error("Event Management page could not be opened.");
}

async function openShipping2BulkWorksheet(page, bulkType) {
  const worksheetLabel = bulkType === "released" ? "Released Bulk" : "Unreleased Bulk";
  const worksheetLink = page
    .locator('td.listtablecell a[href*="TrackingWorksheet"]')
    .filter({ hasText: exactTextRegex(worksheetLabel) });

  await clickLocator(worksheetLink, worksheetLabel);
  await page.waitForURL(/\/en\/trade\/TrackingWorksheet/, {
    timeout: config.navigationTimeoutMs,
  });
  await page.waitForTimeout(config.postLoginWaitMs);
  log("Shipping 2 worksheet opened.", {
    bulkType,
    worksheetLabel,
  });
}

async function waitForEventManagementPage(page, timeoutMs = config.navigationTimeoutMs) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    const state = await page.evaluate(() => {
      const href = String(window.location.href || "");
      const pathname = String(window.location.pathname || "");
      const bodyText = String(document.body?.innerText || "");
      return {
        href,
        pathname,
        hasEventManagementUrl: /\/en\/trade\/InProgressEventManagement/i.test(href),
        hasEventManagementText: /\bEvent Management\b/i.test(bodyText),
        hasTrackingWorksheetLink: Boolean(
          document.querySelector('td.listtablecell a[href*="TrackingWorksheet"]'),
        ),
      };
    }).catch(() => null);

    lastState = state;
    if (state?.hasEventManagementUrl || (state?.hasEventManagementText && state?.hasTrackingWorksheetLink)) {
      return state;
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Event Management page did not finish opening within ${timeoutMs}ms. Last state: ${JSON.stringify(lastState || {})}`);
}

async function waitForShipmentScanDialog(page, timeoutMs = config.navigationTimeoutMs) {
  const dialog = getShipmentScanDialog(page);
  await waitForAny(page, [
    () => page.waitForURL(/#Shipment%20Scan/, { timeout: timeoutMs }),
    () => dialog.waitFor({ state: "visible", timeout: timeoutMs }),
  ]);
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
}

function getShipmentScanDialog(page) {
  return page
    .locator("div.x-window:visible")
    .filter({
      has: page.locator("span.x-window-header-text", {
        hasText: /^Shipment Scan - Select Filters$/i,
      }),
    })
    .last();
}

function getShipmentScanWorkspaceTitlePattern(shipmentScanAction) {
  return isAssignEquipmentShipmentScanAction(shipmentScanAction)
    ? /^(?:Undo Shipment Scan|Shipment Scan)$/i
    : /^Undo Shipment Scan$/i;
}

function getShipmentScanWorkspace(page, shipmentScanAction = "Remove/Change Equipment ID") {
  return page
    .locator("div.x-panel:visible")
    .filter({
      has: page.locator("span.x-panel-header-text", {
        hasText: getShipmentScanWorkspaceTitlePattern(shipmentScanAction),
      }),
    })
    .first();
}

function getShipmentScanGrid(page, shipmentScanAction = "Remove/Change Equipment ID") {
  return getShipmentScanWorkspace(page, shipmentScanAction)
    .locator("div.x-grid3:visible")
    .first();
}

async function openShipmentScanDialog(page, options = {}) {
  const timeoutMs = Number(options?.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : config.navigationTimeoutMs;
  const shipmentScanAction = normalizeShipmentScanAction(options?.shipmentScanAction);
  const dialog = getShipmentScanDialog(page);
  const alreadyVisible = await dialog.isVisible().catch(() => false);
  if (!alreadyVisible) {
    await clickShipmentScanSideLink(page);
  }

  await waitForShipmentScanDialog(page, timeoutMs);
  const visibleDialog = getShipmentScanDialog(page);
  await waitForShipmentScanDialogControls(visibleDialog, timeoutMs, shipmentScanAction);
  log("Shipment Scan dialog ready.", { shipmentScanAction });
  return visibleDialog;
}

async function clickShipmentScanSideLink(page) {
  await clickLocator(
    page.locator('div.sidepanellinks a[href="#Shipment%20Scan"]'),
    "Shipment Scan",
  );
}

async function prepareForNextShipmentPoIteration(page, currentPoNo, nextPoNo, shipmentScanAction) {
  const normalizedCurrentPoNo = String(currentPoNo || "").trim();
  const normalizedNextPoNo = String(nextPoNo || "").trim();
  if (!normalizedNextPoNo) {
    return;
  }

  try {
    await openShipmentScanDialog(page, {
      timeoutMs: PREPARE_NEXT_PO_DIALOG_TIMEOUT_MS,
      shipmentScanAction,
    });
    log("Prepared Shipment Scan for next PO.", {
      currentPoNo: normalizedCurrentPoNo,
      nextPoNo: normalizedNextPoNo,
      shipmentScanAction: normalizeShipmentScanAction(shipmentScanAction),
      timeoutMs: PREPARE_NEXT_PO_DIALOG_TIMEOUT_MS,
    });
  } catch (error) {
    log("Shipment Scan preparation deferred to next iteration.", {
      currentPoNo: normalizedCurrentPoNo,
      nextPoNo: normalizedNextPoNo,
      shipmentScanAction: normalizeShipmentScanAction(shipmentScanAction),
      timeoutMs: PREPARE_NEXT_PO_DIALOG_TIMEOUT_MS,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function waitForShipmentScanDialogControls(
  dialog,
  timeoutMs = config.navigationTimeoutMs,
  shipmentScanAction = "Remove/Change Equipment ID",
) {
  const actionLabel = normalizeShipmentScanAction(shipmentScanAction);
  const actionText = exactTextRegex(actionLabel);
  const poInput = dialog.locator('input[name="poNum"], input[name="poNumbers"]').first();
  const manualTarget = dialog.locator("div.x-form-check-wrap").filter({
    hasText: actionText,
  }).first();
  const actionLabelLocator = manualTarget.locator("label.x-form-cb-label", {
    hasText: actionText,
  }).first();
  const actionRadio = manualTarget.locator('input[type="radio"][name="radioGroup"]').first();
  const okButton = dialog.locator("button.x-btn-text").filter({ hasText: /^OK$/ }).first();

  await poInput.waitFor({ state: "visible", timeout: timeoutMs });
  await manualTarget.waitFor({ state: "attached", timeout: timeoutMs });
  await actionLabelLocator.waitFor({ state: "visible", timeout: timeoutMs });
  await actionRadio.waitFor({ state: "attached", timeout: timeoutMs });
  await okButton.waitFor({ state: "visible", timeout: timeoutMs });
  await dialogPause(dialog, 350);
}

async function isShipmentScanModeSelected(manualTarget, radio) {
  const checked = await radio.isChecked().catch(() => false);
  if (checked) {
    return true;
  }

  return manualTarget.evaluate((wrapper) => {
    const input = wrapper.querySelector('input[type="radio"]');
    const label = wrapper.querySelector("label");
    const wrapperClass = String(wrapper.className || "").toLowerCase();
    const labelClass = String(label?.className || "").toLowerCase();
    const inputClass = String(input?.className || "").toLowerCase();
    return Boolean(
      input?.checked
      || input?.getAttribute("checked") !== null
      || wrapperClass.includes("checked")
      || labelClass.includes("checked")
      || inputClass.includes("checked"),
    );
  }).catch(() => false);
}

async function waitForShipmentScanModeSelected(manualTarget, radio, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isShipmentScanModeSelected(manualTarget, radio)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return isShipmentScanModeSelected(manualTarget, radio);
}

async function dialogPause(dialog, timeoutMs) {
  await dialog.evaluate((_, ms) => new Promise((resolve) => setTimeout(resolve, ms)), timeoutMs)
    .catch(() => {});
}

async function cleanupShipmentScanDialog(page) {
  await dismissVisibleMessageDialog(page).catch(() => false);

  const dialog = getShipmentScanDialog(page);
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (!dialogVisible) {
    return;
  }

  const cancelButton = dialog.locator("button.x-btn-text").filter({ hasText: /^Cancel$/ }).first();
  const cancelVisible = await cancelButton.isVisible().catch(() => false);
  if (cancelVisible) {
    await forceClickLocator(cancelButton, "Shipment Scan Cancel");
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    return;
  }

  const closeTool = dialog.locator(".x-tool-close").first();
  const closeVisible = await closeTool.isVisible().catch(() => false);
  if (closeVisible) {
    await forceClickLocator(closeTool, "Shipment Scan close tool");
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

async function selectShipmentScanAction(dialog, shipmentScanAction = "Remove/Change Equipment ID") {
  const actionLabel = normalizeShipmentScanAction(shipmentScanAction);
  const actionText = exactTextRegex(actionLabel);
  const manualTarget = dialog.locator("div.x-form-check-wrap").filter({
    hasText: actionText,
  }).first();
  await manualTarget.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  const radio = manualTarget.locator('input[type="radio"][name="radioGroup"]').first();
  const label = manualTarget.locator("label.x-form-cb-label").first();

  if (await isShipmentScanModeSelected(manualTarget, radio)) {
    log("Selected Shipment Scan action.", { shipmentScanAction: actionLabel });
    return;
  }

  await radio.scrollIntoViewIfNeeded().catch(() => {});
  await dialogPause(dialog, 250);

  await radio.check({ force: true }).catch(() => {});
  if (await waitForShipmentScanModeSelected(manualTarget, radio, 1200)) {
    log("Selected Shipment Scan action.", {
      shipmentScanAction: actionLabel,
      target: "radio.check",
    });
    return;
  }

  const clickTargets = [
    { locator: label, label: "label" },
    { locator: manualTarget, label: "wrapper" },
    { locator: radio, label: "radio" },
  ];

  for (const target of clickTargets) {
    const visible = await target.locator.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    await forceClickLocator(target.locator, `Shipment Scan ${target.label}`);
    if (await waitForShipmentScanModeSelected(manualTarget, radio, 1500)) {
      log("Selected Shipment Scan action.", {
        shipmentScanAction: actionLabel,
        target: target.label,
      });
      return;
    }
  }

  const selectedByDom = await manualTarget.evaluate((wrapper) => {
    const input = wrapper.querySelector('input[type="radio"]');
    const labelNode = wrapper.querySelector("label");
    const clickables = [wrapper, labelNode, input].filter(Boolean);
    const fireMouse = (node, type) => {
      node.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    };

    for (const node of clickables) {
      fireMouse(node, "mouseover");
      fireMouse(node, "mousedown");
      fireMouse(node, "mouseup");
      fireMouse(node, "click");
    }

    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return Boolean(input.checked);
    }

    return false;
  }).catch(() => false);

  if (selectedByDom && await waitForShipmentScanModeSelected(manualTarget, radio, 1500)) {
    log("Selected Shipment Scan action.", {
      shipmentScanAction: actionLabel,
      target: "dom-dispatch",
    });
    return;
  }

  throw new Error(`${actionLabel} radio was not selected.`);
}

async function processShipmentPoRow(page, poRow, shipmentScanAction) {
  const normalizedChangeEquipmentId = String(poRow?.changeEquipmentId || "").trim();
  if (!normalizedChangeEquipmentId) {
    throw new Error(`Change equipment ID is empty for PO No ${String(poRow?.poNo || "").trim()}.`);
  }

  await confirmShipmentScanFilters(page, poRow.poNo, shipmentScanAction);
  await waitForShipmentGridRows(page, poRow.poNo, shipmentScanAction);
  await selectShipmentGridRows(page, poRow.poNo, shipmentScanAction);
  const dialog = await openChangeEquipmentIdDialog(page, poRow.poNo, shipmentScanAction);
  await fillChangeEquipmentIdDialog(dialog, normalizedChangeEquipmentId);
  const applyResult = await applyChangeEquipmentIdDialog(page, dialog, poRow.poNo);
  await waitForShipmentWorkspaceReadyAfterApply(page, poRow.poNo, shipmentScanAction);
  log("Completed shipment PO row.", {
    poNo: String(poRow?.poNo || "").trim(),
    changeEquipmentId: normalizedChangeEquipmentId,
    applyStatus: String(applyResult?.status || "applied"),
  });
  return applyResult;
}

async function confirmShipmentScanFilters(page, poNo, shipmentScanAction) {
  const actionLabel = normalizeShipmentScanAction(shipmentScanAction);
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const shipmentDialog = await openShipmentScanDialog(page, { shipmentScanAction: actionLabel });
      await fillShipmentPoNumber(shipmentDialog, poNo);
      await selectShipmentScanAction(shipmentDialog, actionLabel);
      await dialogPause(shipmentDialog, 350);
      await clickShipmentScanOk(shipmentDialog);
      await page.waitForTimeout(250);
      const desktopIssue = await getDesktopUtilityConnectionIssue(page);
      if (desktopIssue?.detected) {
        log("Desktop Utility notice visible after Shipment Scan OK; continuing to inspect business grid.", {
          poNo: String(poNo || "").trim(),
          text: desktopIssue.text,
        });
      }
      log("Confirmed PO No.", {
        poNo: String(poNo || "").trim(),
        shipmentScanAction: actionLabel,
        attempt,
      });
      return;
    } catch (error) {
      lastError = error;
      log("Shipment Scan filter attempt failed.", {
        poNo: String(poNo || "").trim(),
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await cleanupShipmentScanDialog(page);
      await page.waitForTimeout(500);
    }
  }

  throw lastError || new Error(`PO No ${String(poNo || "").trim()}: Shipment Scan filters failed.`);
}

async function fillShipmentPoNumber(dialog, poNo) {
  const normalizedPoNo = String(poNo || "").trim();
  if (!normalizedPoNo) {
    throw new Error("PO No is empty.");
  }

  const poInput = dialog
    .locator('input[name="poNum"], input[name="poNumbers"]')
    .first();
  await poInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await poInput.fill(normalizedPoNo);
  await poInput.press("Tab").catch(() => {});
  await dialogPause(dialog, 250);
  log("Entered PO No.", { poNo: normalizedPoNo });
}

async function waitForShipmentGridRows(page, poNo, shipmentScanAction = "Remove/Change Equipment ID") {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 12000);
  const startedAt = Date.now();
  let lastDialogError = "";
  let lastState = null;
  let noDataSince = 0;
  let emptyGridSince = 0;
  let staleNonMatchingSince = 0;
  let lastNonMatchingSignature = "";
  let stableMatchCount = 0;
  let lastSignature = "";

  while (Date.now() - startedAt < timeoutMs) {
    lastDialogError = (await getVisibleDialogErrorText(page)) || lastDialogError;
    if (lastDialogError) {
      throw new Error(`PO No ${poNo}: ${lastDialogError}`);
    }

    const state = await getShipmentGridState(page, poNo, shipmentScanAction);
    lastState = state;

    if (state.rowCount > 0 && state.matchedPoRowCount > 0) {
      stableMatchCount = state.rowSignature === lastSignature ? stableMatchCount + 1 : 1;
      lastSignature = state.rowSignature;
      if (stableMatchCount >= 2) {
        log("Shipment grid rows loaded.", {
          poNo,
          rowCount: state.rowCount,
          matchedPoRowCount: state.matchedPoRowCount,
          packagesSelectedCount: state.packagesSelectedCount,
        });
        return;
      }
    } else {
      stableMatchCount = 0;
      lastSignature = state.rowSignature;
    }

    if (state.rowCount === 0) {
      noDataSince = noDataSince || Date.now();
      const noDataThresholdMs = state.noDataVisible ? 900 : 2800;
      if (Date.now() - noDataSince >= noDataThresholdMs) {
        log("Shipment grid returned no rows; skipping PO.", {
          poNo,
          noDataVisible: state.noDataVisible,
          waitedMs: Date.now() - startedAt,
        });
        throw buildShipmentBusinessDataEmptyError(
          poNo,
          state,
          "no shipment rows were loaded after clicking OK",
        );
      }
    } else {
      noDataSince = 0;
    }

    if (state.rowCount === 0 && !state.noDataVisible) {
      emptyGridSince = emptyGridSince || Date.now();
      if (Date.now() - emptyGridSince >= 2800) {
        log("Shipment grid stayed empty; skipping PO.", {
          poNo,
          waitedMs: Date.now() - startedAt,
        });
        throw buildShipmentBusinessDataEmptyError(
          poNo,
          state,
          "shipment grid stayed empty after clicking OK",
        );
      }
    } else {
      emptyGridSince = 0;
    }

    if (state.rowCount > 0 && state.matchedPoRowCount === 0) {
      const currentSignature = state.rowSignature || `rows:${state.rowCount}`;
      staleNonMatchingSince = currentSignature === lastNonMatchingSignature
        ? (staleNonMatchingSince || Date.now())
        : Date.now();
      lastNonMatchingSignature = currentSignature;
      if (Date.now() - staleNonMatchingSince >= 2200) {
        log("Shipment grid did not switch to the requested PO; skipping PO.", {
          poNo,
          rowCount: state.rowCount,
          waitedMs: Date.now() - startedAt,
          sample: String(state.rowSignature || "").slice(0, 180),
        });
        throw buildShipmentBusinessDataEmptyError(
          poNo,
          state,
          "shipment grid did not switch to rows for this PO",
        );
      }
    } else {
      staleNonMatchingSince = 0;
      lastNonMatchingSignature = "";
    }

    await page.waitForTimeout(250);
  }

  throw buildShipmentBusinessDataEmptyError(
    poNo,
    lastState,
    "timed out waiting for shipment rows",
  );
}

async function waitForShipmentWorkspaceReadyAfterApply(page, poNo, shipmentScanAction = "Remove/Change Equipment ID") {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 4000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const processingVisible = await hasVisibleWindowText(page, /processing/i);
    const visibleDialog = await getTopVisibleDialogInfo(page).catch(() => null);
    const workspaceVisible = await getShipmentScanWorkspace(page, shipmentScanAction).isVisible().catch(() => false);
    const shipmentScanLinkVisible = await page
      .locator('div.sidepanellinks a[href="#Shipment%20Scan"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (!processingVisible && workspaceVisible && shipmentScanLinkVisible && !visibleDialog?.id) {
      log("Shipment workspace ready after Apply.", {
        poNo: String(poNo || "").trim(),
        waitedMs: Date.now() - startedAt,
      });
      return;
    }

    await page.waitForTimeout(150);
  }

  log("Shipment workspace was still settling after Apply; continuing anyway.", {
    poNo: String(poNo || "").trim(),
    waitedMs: Date.now() - startedAt,
  });
}

async function selectShipmentGridRows(page, poNo, shipmentScanAction = "Remove/Change Equipment ID") {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();
  let lastState = null;
  let stableSelectedCount = 0;
  let lastSignature = "";
  let assignHeaderClickAttempted = false;
  const isAssignEquipmentSelection = isAssignEquipmentShipmentScanAction(shipmentScanAction);
  const grid = getShipmentScanGrid(page, shipmentScanAction);

  while (Date.now() - startedAt < timeoutMs) {
    const selectionState = await getShipmentGridState(page, poNo, shipmentScanAction);
    lastState = selectionState;

    if (selectionState.noDataVisible && selectionState.rowCount === 0) {
      throw buildShipmentBusinessDataEmptyError(
        poNo,
        selectionState,
        "no shipment rows were loaded after clicking OK",
      );
    }

    if (selectionState.rowCount > 0
      && selectionState.matchedPoRowCount > 0
      && selectionState.selectedRowCount >= selectionState.rowCount
      && selectionState.packagesSelectedCount > 0) {
      stableSelectedCount = selectionState.rowSignature === lastSignature ? stableSelectedCount + 1 : 1;
      lastSignature = selectionState.rowSignature;
      if (stableSelectedCount >= 2) {
        log("Selected shipment rows with header checker.", {
          poNo,
          rowCount: selectionState.rowCount,
          selectedRowCount: selectionState.selectedRowCount,
          packagesSelectedCount: selectionState.packagesSelectedCount,
        });
        return;
      }

      await page.waitForTimeout(200);
      continue;
    }

    stableSelectedCount = 0;
    lastSignature = selectionState.rowSignature;

    if (isAssignEquipmentSelection
      && selectionState.rowCount > 0
      && selectionState.matchedPoRowCount > 0) {
      if (!assignHeaderClickAttempted) {
        const headerClickResult = await clickAssignEquipmentShipmentGridCheckers(page, poNo, "header");
        assignHeaderClickAttempted = true;
        if (headerClickResult.headerClicked || headerClickResult.modelSelected) {
          log("Selected Assign Equipment ID shipment rows from header step.", {
            poNo,
            ...headerClickResult,
          });
          await page.waitForTimeout(350);
          continue;
        }
      }

      const rowClickResult = await clickAssignEquipmentShipmentGridCheckers(page, poNo, "rows");
      if (rowClickResult.rowClickedCount > 0 || rowClickResult.modelSelected) {
        log("Selected Assign Equipment ID shipment rows from row step.", {
          poNo,
          ...rowClickResult,
        });
        await page.waitForTimeout(350);
        continue;
      }
      if (rowClickResult.gridFound && rowClickResult.matchedRowCount > 0) {
        await page.waitForTimeout(350);
        continue;
      }
    }

    const headerChecker = grid.locator("div.x-grid3-hd-checker").first();
    const headerVisible = await headerChecker.isVisible().catch(() => false);
    if (headerVisible) {
      await headerChecker.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    const rowChecker = grid.locator("div.x-grid3-row-checker").first();
    await rowChecker.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
    const rowVisible = await rowChecker.isVisible().catch(() => false);
    if (rowVisible) {
      await rowChecker.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    await page.waitForTimeout(250);
  }

  throw buildShipmentBusinessDataEmptyError(
    poNo,
    lastState,
    "shipment rows were not fully selected",
  );
}

async function clickAssignEquipmentShipmentGridCheckers(page, poNo, mode = "header") {
  const normalizedPoNo = String(poNo || "").trim();
  const clickMode = mode === "rows" ? "rows" : "header";
  return page.evaluate(({ targetPo, clickMode: modeValue }) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const isShipmentWorkspaceHeader = (value) => {
      const text = normalize(value);
      return /^Undo Shipment Scan$/i.test(text) || /^Shipment Scan$/i.test(text);
    };
    const dispatchGridClick = (element, options = {}) => {
      if (!element) {
        return false;
      }

      const candidates = [
        element,
        element.closest("td"),
        element.parentElement,
      ].filter(Boolean);
      for (const target of candidates) {
        const rect = target.getBoundingClientRect();
        const eventInit = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: Math.round(rect.left + rect.width / 2),
          clientY: Math.round(rect.top + rect.height / 2),
          ctrlKey: Boolean(options.ctrlKey),
          metaKey: Boolean(options.ctrlKey),
          shiftKey: Boolean(options.shiftKey),
        };
        for (const eventType of ["mouseover", "mousemove", "mousedown", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(eventType, eventInit));
        }
        if (typeof target.click === "function") {
          target.click();
        }
      }
      return true;
    };

    const result = {
      workspaceFound: false,
      gridFound: false,
      headerClicked: false,
      modelSelected: false,
      modelSelectedCount: 0,
      matchedRowCount: 0,
      selectedBeforeCount: 0,
      rowClickedCount: 0,
    };
    const workspace = Array.from(document.querySelectorAll("div.x-panel"))
      .find((element) => isVisible(element)
        && Array.from(element.querySelectorAll("span.x-panel-header-text"))
          .some((header) => isShipmentWorkspaceHeader(header.textContent)));
    if (!workspace) {
      return result;
    }
    result.workspaceFound = true;

    const grid = Array.from(workspace.querySelectorAll("div.x-grid3"))
      .find((element) => isVisible(element));
    if (!grid) {
      return result;
    }
    result.gridFound = true;
    const rowNodes = Array.from(grid.querySelectorAll("div.x-grid3-row"))
      .filter((element) => isVisible(element));
    const matchingRowNodes = rowNodes.filter((rowNode) => {
      const rowText = normalize(rowNode.innerText || rowNode.textContent);
      return !targetPo || rowText.includes(targetPo);
    });
    result.matchedRowCount = matchingRowNodes.length;

    const trySelectWithExtModel = () => {
      const ext = window.Ext;
      if (!ext || typeof ext.getCmp !== "function") {
        return false;
      }

      const candidateIds = [];
      let node = grid;
      while (node && node !== document.body) {
        if (node.id) {
          candidateIds.push(node.id);
        }
        node = node.parentElement;
      }
      if (workspace.id) {
        candidateIds.push(workspace.id);
      }

      const rowIndexes = matchingRowNodes
        .map((rowNode) => rowNodes.indexOf(rowNode))
        .filter((index) => index >= 0);
      for (const id of Array.from(new Set(candidateIds))) {
        const component = ext.getCmp(id);
        const selectionModel = component?.getSelectionModel?.();
        if (!selectionModel) {
          continue;
        }

        if (rowIndexes.length > 0 && typeof selectionModel.selectRows === "function") {
          selectionModel.selectRows(rowIndexes, false);
          result.modelSelected = true;
          result.modelSelectedCount = rowIndexes.length;
          return true;
        }
        if (rowIndexes.length > 0 && typeof selectionModel.selectRow === "function") {
          rowIndexes.forEach((index, position) => selectionModel.selectRow(index, position > 0));
          result.modelSelected = true;
          result.modelSelectedCount = rowIndexes.length;
          return true;
        }
        if (!targetPo && typeof selectionModel.selectAll === "function") {
          selectionModel.selectAll();
          result.modelSelected = true;
          result.modelSelectedCount = rowNodes.length;
          return true;
        }
      }

      return false;
    };

    if (modeValue === "header") {
      if (trySelectWithExtModel()) {
        return result;
      }

      const headerChecker = Array.from(grid.querySelectorAll("div.x-grid3-hd-checker"))
        .find((element) => isVisible(element));
      result.headerClicked = dispatchGridClick(headerChecker);
      return result;
    }

    if (trySelectWithExtModel()) {
      return result;
    }
    for (const rowNode of matchingRowNodes) {
      const checker = rowNode.querySelector("div.x-grid3-row-checker");
      const checkerClass = String(checker?.className || "");
      const rowClass = String(rowNode.className || "");
      const selected = isVisible(checker)
        && (checkerClass.includes("x-grid3-row-checker-on") || rowClass.includes("x-grid3-row-selected"));
      if (selected) {
        result.selectedBeforeCount += 1;
        continue;
      }
      if (dispatchGridClick(checker, { ctrlKey: true })) {
        result.rowClickedCount += 1;
      }
    }

    return result;
  }, {
    targetPo: normalizedPoNo,
    clickMode,
  }).catch(() => ({
    workspaceFound: false,
    gridFound: false,
    headerClicked: false,
    modelSelected: false,
    modelSelectedCount: 0,
    matchedRowCount: 0,
    selectedBeforeCount: 0,
    rowClickedCount: 0,
  }));
}

async function openChangeEquipmentIdDialog(page, poNo, shipmentScanAction = "Remove/Change Equipment ID") {
  const toolbarActionLabel = getShipmentScanToolbarActionLabel(shipmentScanAction);
  const selectionState = await getShipmentGridState(page, poNo, shipmentScanAction);
  if (selectionState.rowCount === 0
    || selectionState.matchedPoRowCount === 0
    || selectionState.packagesSelectedCount === 0) {
    throw new Error(`PO No ${poNo}: shipment rows were not ready for ${toolbarActionLabel}. State: ${JSON.stringify(selectionState)}`);
  }

  const button = getShipmentScanWorkspace(page, shipmentScanAction)
    .locator("button.x-btn-text")
    .filter({ hasText: exactTextRegex(toolbarActionLabel) })
    .first();
  await button.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await forceClickLocator(button, toolbarActionLabel);
  log(`Clicked ${toolbarActionLabel}.`, {
    poNo,
    shipmentScanAction: normalizeShipmentScanAction(shipmentScanAction),
  });

  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      await dismissVisibleMessageDialog(page);
      throw new Error(`PO No ${poNo}: ${errorText}`);
    }

    const dialogInfo = await getTopVisibleDialogInfo(page);
    if (dialogInfo?.id && dialogInfo.inputs?.length) {
      const dialog = page.locator(`[id="${dialogInfo.id}"]`).first();
      log(`${toolbarActionLabel} dialog opened.`, {
        poNo,
        dialogId: dialogInfo.id,
      });
      return dialog;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`PO No ${poNo}: ${toolbarActionLabel} dialog did not appear.`);
}

async function fillChangeEquipmentIdDialog(dialog, changeEquipmentId) {
  const input = dialog.locator('input[type="text"], textarea').first();
  await input.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await input.fill(String(changeEquipmentId || "").trim());
  log("Entered change equipment ID.", {
    changeEquipmentId: String(changeEquipmentId || "").trim(),
  });
}

async function applyChangeEquipmentIdDialog(page, dialog, poNo) {
  const applyButton = dialog.locator("button.x-btn-text").filter({ hasText: /^Apply$/ }).first();
  await applyButton.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await forceClickLocator(applyButton, "Change Equipment ID Apply");

  const timeoutMs = Math.min(config.navigationTimeoutMs, 30000);
  const startedAt = Date.now();
  let sawProcessing = false;

  while (Date.now() - startedAt < timeoutMs) {
    const acceptedConfirmation = await acceptVisibleContinueAnywayDialog(page, {
      poNo,
      context: "Change Equipment ID Apply",
    });
    if (acceptedConfirmation) {
      await page.waitForTimeout(250);
      continue;
    }

    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      if (isRecoverableChangeEquipmentIdConflictText(errorText)) {
        const recoveryResult = await recoverFromRecoverableChangeEquipmentIdError(page, dialog, poNo, errorText);
        return recoveryResult;
      }

      await dismissVisibleMessageDialog(page);
      throw new Error(`PO No ${poNo}: ${errorText}`);
    }

    const processingVisible = await hasVisibleWindowText(page, /processing/i);
    sawProcessing = sawProcessing || processingVisible;

    const dialogVisible = await dialog.isVisible().catch(() => false);
    if (!dialogVisible) {
      log("Applied change equipment ID.", {
        poNo,
        sawProcessing,
      });
      return {
        status: "applied",
      };
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`PO No ${poNo}: Change Equipment ID Apply did not finish.`);
}

async function processCreateShipmentEquipmentId(page, createShipmentBatch) {
  const normalizedChangeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const targetPairs = Array.isArray(createShipmentBatch?.targetPairs)
    ? createShipmentBatch.targetPairs
    : [];
  if (!normalizedChangeEquipmentId) {
    throw new Error("Create Shipment change equipment ID is empty.");
  }
  if (targetPairs.length === 0) {
    throw new Error(`Create Shipment ${normalizedChangeEquipmentId}: target PO rows are empty.`);
  }

  const dialog = await openCreateShipmentDialog(page);
  await clearCreateShipmentPoNumber(dialog);
  await fillCreateShipmentBrowseDays(dialog, "601");
  await fillCreateShipmentEquipmentId(dialog, normalizedChangeEquipmentId);
  await clickDialogOk(dialog, "Create Shipment Filter");
  await page.waitForTimeout(250);
  await waitForCreateShipmentGridRows(page, createShipmentBatch);
  const selectionSummary = await selectCreateShipmentGridRows(page, createShipmentBatch);
  if (!selectionSummary?.selectedTargetRowCount) {
    throw new Error(`Create Shipment ${normalizedChangeEquipmentId}: no matching rows were selected for the requested PO/equipment pairs.`);
  }
  const previousUrl = safePageUrl(page);
  await clickCreateShipmentWorkspaceButton(page, createShipmentBatch, selectionSummary);
  await waitForCreateShipmentNextStep(page, createShipmentBatch, previousUrl);
  await applyCreateShipmentIssueDate(page, createShipmentBatch);
  await applyCreateShipmentInvoiceNumber(page, createShipmentBatch);
  await applyCreateShipmentShipmentDate(page, createShipmentBatch);
  await clickCreateShipmentPreviewStep(page, createShipmentBatch);
  await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
  log("Completed Create Shipment row.", {
    changeEquipmentId: normalizedChangeEquipmentId,
    poNos: createShipmentBatch.poNos,
    issueDate: createShipmentBatch.issueDate || "",
    invoiceNumber: createShipmentBatch.invoiceNumber || "",
    selectedTargetRowCount: selectionSummary.selectedTargetRowCount,
    missingTargetPairCount: selectionSummary.missingTargetPairCount,
  });
}

async function openCreateShipmentDialog(page) {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 20000);
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    const dialog = await findVisibleCreateShipmentDialog(page);
    if (dialog) {
      return dialog;
    }

    const attempt = Math.floor((Date.now() - startedAt) / 4500) + 1;
    try {
      await activateCreateShipmentEntry(page, attempt);
    } catch (error) {
      lastError = error;
    }

    const remainingMs = Math.max(1500, Math.min(4500, timeoutMs - (Date.now() - startedAt)));
    try {
      const dialog = await waitForVisibleCreateShipmentDialog(page, remainingMs);
      if (dialog) {
        return dialog;
      }
    } catch (error) {
      lastError = error;
    }

    await page.waitForTimeout(300);
  }

  const suffix = lastError instanceof Error && lastError.message
    ? ` Last error: ${lastError.message}`
    : "";
  throw new Error(`Create Shipment dialog did not appear.${suffix}`);
}

async function activateCreateShipmentEntry(page, attempt = 1) {
  const link = page
    .locator('div.sidepanellinks a[href="#Create%20Shipment"], div.sidepanellinks a[href="#Create Shipment"]')
    .first();
  await link.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  const row = link.locator("xpath=ancestor::tr[1]").first();
  const wrapper = link.locator("xpath=ancestor::div[contains(@class,'sidepanellinks')][1]").first();
  const strategies = [
    {
      label: "side-link",
      run: async () => {
        await forceClickLocator(link, "Create Shipment");
      },
    },
    {
      label: "link-wrapper",
      run: async () => {
        await forceClickLocator(wrapper, "Create Shipment wrapper");
      },
    },
    {
      label: "link-row",
      run: async () => {
        await forceClickLocator(row, "Create Shipment row");
      },
    },
    {
      label: "dom-dispatch",
      run: async () => {
        await page.evaluate(() => {
          const target = document.querySelector('div.sidepanellinks a[href="#Create%20Shipment"], div.sidepanellinks a[href="#Create Shipment"]');
          if (!target) {
            throw new Error("Create Shipment side link was not found in DOM.");
          }

          target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
          target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
          target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          if (typeof target.click === "function") {
            target.click();
          }
        });
      },
    },
    {
      label: "hash-fallback",
      run: async () => {
        await page.evaluate(() => {
          const currentHref = String(window.location.href || "");
          const nextHref = currentHref.replace(/#.*$/, "") + "#Create Shipment";
          if (currentHref !== nextHref) {
            window.location.hash = "Create Shipment";
          } else {
            window.location.hash = "Create Shipment";
          }
        });
      },
    },
  ];

  const strategy = strategies[Math.min(attempt - 1, strategies.length - 1)];
  await strategy.run();
  log("Clicked Create Shipment.", {
    attempt,
    strategy: strategy.label,
    url: page.url(),
  });
}

async function waitForVisibleCreateShipmentDialog(page, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      throw new Error(errorText);
    }

    const dialog = await findVisibleCreateShipmentDialog(page);
    if (dialog) {
      return dialog;
    }

    await page.waitForTimeout(250);
  }

  return null;
}

async function findVisibleCreateShipmentDialog(page) {
  const dialogInfo = await getVisibleCreateShipmentDialogInfo(page);
  if (!dialogInfo?.id) {
    return null;
  }

  const dialog = page.locator(`[id="${dialogInfo.id}"]`).first();
  const browseDaysInput = dialog.locator('input[name="executionDateDays"]').first();
  const equipmentInput = dialog.locator('input[name="EquipmentJM"]').first();
  const poInput = dialog.locator('input[name="poNum"]').first();
  const ready = await Promise.any([
    browseDaysInput.waitFor({ state: "visible", timeout: 1200 }).then(() => true),
    equipmentInput.waitFor({ state: "visible", timeout: 1200 }).then(() => true),
    poInput.waitFor({ state: "visible", timeout: 1200 }).then(() => true),
  ]).catch(() => false);

  if (!ready) {
    return null;
  }

  log("Create Shipment dialog opened.", {
    dialogId: dialogInfo.id,
    inputNames: dialogInfo.inputs.map((input) => input.name).filter(Boolean),
  });
  return dialog;
}

async function getVisibleCreateShipmentDialogInfo(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    const dialogs = Array.from(document.querySelectorAll("div.x-window"))
      .filter(isVisible)
      .map((element) => {
        const inputs = Array.from(element.querySelectorAll('input:not([type="hidden"]), textarea, select'))
          .filter(isVisible)
          .map((input) => ({
            id: input.id || "",
            name: input.getAttribute("name") || "",
            type: input.getAttribute("type") || "",
            value: input.value || "",
          }));

        const text = (element.innerText || "").trim();
        const names = new Set(inputs.map((input) => input.name).filter(Boolean));
        const matchesByInputs = names.has("EquipmentJM")
          || names.has("executionDateDays")
          || (names.has("poNum") && /Browse Days|Equipment/i.test(text));
        const matchesByText = /Create Shipment/i.test(text)
          && (names.has("EquipmentJM") || names.has("executionDateDays") || names.has("poNum"));

        return {
          id: element.id || "",
          text,
          zIndex: Number(window.getComputedStyle(element).zIndex || 0),
          inputs,
          matches: matchesByInputs || matchesByText,
        };
      })
      .filter((dialog) => dialog.matches)
      .sort((left, right) => right.zIndex - left.zIndex);

    return dialogs[0] || null;
  }).catch(() => null);
}

async function clearCreateShipmentPoNumber(dialog) {
  const poInput = dialog.locator('input[name="poNum"]').first();
  await poInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await poInput.fill("");
  log("Cleared Create Shipment PO Numbers.");
}

async function fillCreateShipmentBrowseDays(dialog, value) {
  const browseDaysInput = dialog.locator('input[name="executionDateDays"]').first();
  await browseDaysInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await browseDaysInput.fill(String(value || "").trim());
  log("Entered Create Shipment Browse Days.", {
    executionDateDays: String(value || "").trim(),
  });
}

async function fillCreateShipmentEquipmentId(dialog, changeEquipmentId) {
  const equipmentInput = dialog.locator('input[name="EquipmentJM"]').first();
  await equipmentInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await equipmentInput.fill(String(changeEquipmentId || "").trim());
  log("Entered Create Shipment equipment number.", {
    changeEquipmentId: String(changeEquipmentId || "").trim(),
  });
}

function getCreateShipmentWorkspace(page) {
  return page
    .locator("div.x-panel:visible")
    .filter({
      has: page.locator("span.x-panel-header-text", {
        hasText: /^Create Shipment$/i,
      }),
    })
    .first();
}

function getCreateShipmentGrid(page) {
  return getCreateShipmentWorkspace(page)
    .locator("div.x-grid3-viewport:visible")
    .first();
}

async function waitForCreateShipmentGridRows(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();
  let lastState = null;
  let stableMatchCount = 0;
  let lastSignature = "";
  let noDataSince = 0;
  let staleNonMatchingSince = 0;
  let lastNonMatchingSignature = "";
  const noDataThresholdMs = Math.min(8000, Math.max(3000, Math.floor(timeoutMs / 2)));

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      throw new Error(errorText);
    }

    const state = await getCreateShipmentGridState(page, createShipmentBatch);
    lastState = state;

    if (state.rowCount > 0 && state.matchedEquipmentRowCount > 0) {
      stableMatchCount = state.rowSignature === lastSignature ? stableMatchCount + 1 : 1;
      lastSignature = state.rowSignature;
      if (stableMatchCount >= 2) {
        log("Create Shipment grid rows loaded.", {
          changeEquipmentId,
          rowCount: state.rowCount,
          matchedEquipmentRowCount: state.matchedEquipmentRowCount,
          matchedTargetPairRowCount: state.matchedTargetPairRowCount,
          selectedRowCount: state.selectedRowCount,
        });
        return;
      }
    } else {
      stableMatchCount = 0;
      lastSignature = state.rowSignature;
    }

    if (state.rowCount === 0) {
      noDataSince = noDataSince || Date.now();
      if (state.noDataVisible && Date.now() - noDataSince >= noDataThresholdMs) {
        throw buildCreateShipmentBusinessDataEmptyError(
          changeEquipmentId,
          state,
          "no rows were loaded after confirming filters",
        );
      }
    } else {
      noDataSince = 0;
    }

    if (state.rowCount > 0 && state.matchedEquipmentRowCount === 0) {
      const currentSignature = state.rowSignature || `rows:${state.rowCount}`;
      staleNonMatchingSince = currentSignature === lastNonMatchingSignature
        ? (staleNonMatchingSince || Date.now())
        : Date.now();
      lastNonMatchingSignature = currentSignature;
      if (Date.now() - staleNonMatchingSince >= 1800) {
        throw buildCreateShipmentBusinessDataEmptyError(
          changeEquipmentId,
          state,
          "grid did not switch to rows for this equipment number",
        );
      }
    } else {
      staleNonMatchingSince = 0;
      lastNonMatchingSignature = "";
    }

    await page.waitForTimeout(250);
  }

  throw buildCreateShipmentBusinessDataEmptyError(
    changeEquipmentId,
    lastState,
    "timed out waiting for filtered grid rows",
  );
}

async function selectCreateShipmentGridRows(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 10000);
  const startedAt = Date.now();
  let lastPlan = null;
  const grid = getCreateShipmentGrid(page);

  while (Date.now() - startedAt < timeoutMs) {
    const plan = await getCreateShipmentGridSelectionPlanExact(page, createShipmentBatch);
    lastPlan = plan;

    if (plan.matchedTargetRowCount > 0
      && plan.pendingToggleCount === 0
      && plan.selectedTargetRowCount === plan.matchedTargetRowCount
      && plan.unexpectedSelectedCount === 0) {
      log("Selected Create Shipment rows by PO/equipment matching.", {
        changeEquipmentId,
        rowCount: plan.rowCount,
        matchedTargetRowCount: plan.matchedTargetRowCount,
        selectedTargetRowCount: plan.selectedTargetRowCount,
        missingTargetPairCount: plan.missingTargetPairCount,
      });
      return plan;
    }

    if (plan.matchedTargetRowCount === 0 && plan.rowCount > 0) {
      throw buildCreateShipmentBusinessDataEmptyError(
        changeEquipmentId,
        plan,
        "no grid rows matched the requested PO/equipment pairs",
      );
    }

    const nextAction = Array.isArray(plan.actions)
      ? plan.actions.find((item) => Boolean(item && item.needsToggle))
      : null;
    if (nextAction) {
      const checker = grid.locator("div.x-grid3-row-checker").nth(nextAction.index);
      await checker.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
      await forceClickLocator(
        checker,
        `Create Shipment row checker ${nextAction.poNo || nextAction.equipmentNumber || nextAction.index}`,
      );
      await page.waitForTimeout(300);
      continue;
    }

    await page.waitForTimeout(250);
  }

  throw buildCreateShipmentBusinessDataEmptyError(
    changeEquipmentId,
    lastPlan,
    "grid rows were not fully selected",
  );
}

async function clickCreateShipmentWorkspaceButton(page, createShipmentBatch, selectionSummary) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const button = getCreateShipmentWorkspace(page)
    .locator("button.x-btn-text.icon-gear-ok-small")
    .filter({ hasText: /^Create Shipment$/i })
    .first();
  await button.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await forceClickLocator(button, "Create Shipment workspace button");
  log("Clicked Create Shipment workspace button.", {
    changeEquipmentId,
    poNos: createShipmentBatch?.poNos || [],
    selectedTargetRowCount: selectionSummary?.selectedTargetRowCount || 0,
    missingTargetPairCount: selectionSummary?.missingTargetPairCount || 0,
    url: safePageUrl(page),
  });
}

async function waitForCreateShipmentNextStep(page, createShipmentBatch, previousUrl) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();
  const summaryIssueDateMonth = page.locator("#PackingManifest_issueDate_month").first();

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      throw new Error(`Create Shipment ${changeEquipmentId}: ${errorText}`);
    }

    const currentUrl = safePageUrl(page);
    if (previousUrl && currentUrl && currentUrl !== previousUrl) {
      log("Create Shipment moved to next page.", {
        changeEquipmentId,
        previousUrl,
        currentUrl,
      });
      return;
    }

    const summaryReady = await summaryIssueDateMonth.isVisible().catch(() => false);
    if (summaryReady) {
      log("Create Shipment summary form ready.", {
        changeEquipmentId,
        previousUrl,
        currentUrl,
      });
      return;
    }

    const topDialog = await getTopVisibleDialogInfo(page);
    if (topDialog?.id && !topDialog.isMessageDialog) {
      log("Create Shipment opened next dialog.", {
        changeEquipmentId,
        dialogId: topDialog.id,
      });
      return;
    }

    const workspaceVisible = await getCreateShipmentWorkspace(page).isVisible().catch(() => false);
    if (!workspaceVisible) {
      log("Create Shipment workspace transitioned.", {
        changeEquipmentId,
        previousUrl,
        currentUrl,
      });
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Create Shipment ${changeEquipmentId}: did not move to the next page after clicking Create Shipment.`);
}

async function applyCreateShipmentIssueDate(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const issueDateParts = normalizeIssueDateParts(createShipmentBatch?.issueDate);
  if (!issueDateParts) {
    throw new Error(`Create Shipment ${changeEquipmentId}: Issue Date is missing or invalid in workbook.`);
  }

  const monthSelect = page.locator("#PackingManifest_issueDate_month").first();
  const daySelect = page.locator("#PackingManifest_issueDate_day").first();
  const yearSelect = page.locator("#PackingManifest_issueDate_year").first();

  await monthSelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await daySelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await yearSelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  await monthSelect.selectOption(String(issueDateParts.month));
  await daySelect.selectOption(String(issueDateParts.day));
  await yearSelect.selectOption(String(issueDateParts.year));
  await page.waitForTimeout(250).catch(() => {});

  log("Applied Create Shipment Issue Date.", {
    changeEquipmentId,
    issueDate: issueDateParts.normalized,
    issueDateSource: createShipmentBatch?.issueDateSource || "",
  });
}

async function applyCreateShipmentInvoiceNumber(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  if (createShipmentBatch?.invoiceNumberConflict) {
    throw new Error(`Create Shipment ${changeEquipmentId}: multiple Invoice Number values were found for the same change equipment ID.`);
  }

  const invoiceNumber = String(createShipmentBatch?.invoiceNumber || "").trim();
  if (!invoiceNumber) {
    throw new Error(`Create Shipment ${changeEquipmentId}: Invoice Number is missing in workbook.`);
  }

  const invoiceInput = page
    .locator("#PackingManifest_shipmentDetail__1_invoiceNumber, input[name=\"PackingManifest_shipmentDetail__1_invoiceNumber\"]")
    .first();
  await invoiceInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await invoiceInput.fill(invoiceNumber);
  await page.waitForTimeout(200).catch(() => {});

  log("Applied Create Shipment Invoice Number.", {
    changeEquipmentId,
    invoiceNumber,
    invoiceNumberSource: createShipmentBatch?.invoiceNumberSource || "",
  });
}

async function applyCreateShipmentShipmentDate(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const issueDateParts = normalizeIssueDateParts(createShipmentBatch?.issueDate);
  if (!issueDateParts) {
    throw new Error(`Create Shipment ${changeEquipmentId}: Ex-Factory Date could not reuse Issue Date because the workbook Issue Date is missing or invalid.`);
  }

  const trigger = page.locator("#PackingManifest_shipmentDetail__1_shipmentDate__1_eventDateTimeInTZtrigger").first();
  const monthSelect = page.locator("#PackingManifest_shipmentDetail__1_shipmentDate__1_eventDateTimeInTZ_month").first();
  const daySelect = page.locator("#PackingManifest_shipmentDetail__1_shipmentDate__1_eventDateTimeInTZ_day").first();
  const yearSelect = page.locator("#PackingManifest_shipmentDetail__1_shipmentDate__1_eventDateTimeInTZ_year").first();

  await trigger.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await monthSelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await daySelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await yearSelect.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  await monthSelect.selectOption(String(issueDateParts.month));
  await daySelect.selectOption(String(issueDateParts.day));
  await yearSelect.selectOption(String(issueDateParts.year));
  await page.waitForTimeout(250).catch(() => {});

  log("Applied Create Shipment Ex-Factory Date.", {
    changeEquipmentId,
    shipmentDate: issueDateParts.normalized,
    shipmentDateSource: createShipmentBatch?.issueDateSource || "",
  });
}

async function clickCreateShipmentPreviewStep(page, createShipmentBatch) {
  const changeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const previewLink = page.locator("a[href*=\"jumpToStep('Review')\"]").first();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();

  await previewLink.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await previewLink.scrollIntoViewIfNeeded().catch(() => {});
  await forceClickLocator(previewLink, "Create Shipment Preview step");

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      throw new Error(`Create Shipment ${changeEquipmentId}: ${errorText}`);
    }

    const currentTitle = await safePageTitle(page);
    if (/Packing List - Preview/i.test(currentTitle) || /^Preview$/i.test(currentTitle)) {
      log("Create Shipment moved to Preview step.", {
        changeEquipmentId,
        currentTitle,
        currentUrl: safePageUrl(page),
      });
      return;
    }

    await page.waitForTimeout(250).catch(() => {});
  }

  throw new Error(`Create Shipment ${changeEquipmentId}: Preview step did not open after clicking Preview.`);
}

async function reopenPrintScanShipForNextCreateShipmentBatch(page, currentBatch, nextBatch) {
  const currentEquipmentId = String(currentBatch?.changeEquipmentId || "").trim();
  const nextEquipmentId = String(nextBatch?.changeEquipmentId || "").trim();
  const applicationsLink = page.locator("#navmenu__applications").first();
  const printScanShipLink = page.locator("#navmenu__inprogressmanifestsprintscanship").first();
  const createShipmentLink = page
    .locator('div.sidepanellinks a[href="#Create%20Shipment"], div.sidepanellinks a[href="#Create Shipment"]')
    .first();

  await clickLocator(applicationsLink, "Applications");
  await clickLocator(printScanShipLink, "Print-Scan-Ship");
  await page.waitForURL(/\/en\/trade\/PackByScan/, { timeout: config.navigationTimeoutMs }).catch(() => {});
  await createShipmentLink.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});

  log("Reopened Print-Scan-Ship for next Create Shipment batch.", {
    currentEquipmentId,
    nextEquipmentId,
    currentUrl: safePageUrl(page),
    currentTitle: await safePageTitle(page),
  });
}

async function clickDialogOk(dialog, label) {
  await clickDialogButton(dialog, label, /^OK$/);
}

async function clickDialogButton(dialog, label, buttonPattern) {
  const candidates = [
    dialog.locator("button.x-btn-text").filter({ hasText: buttonPattern }),
    dialog.locator("td.x-btn-center button").filter({ hasText: buttonPattern }),
    dialog.getByRole("button", { name: buttonPattern }),
  ];
  const startedAt = Date.now();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    for (const locator of candidates) {
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 8); index += 1) {
        const button = locator.nth(index);
        const visible = await button.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        try {
          await forceClickLocator(button, `${label} button`);
          await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
          log(`Clicked ${label} button.`, {
            buttonPattern: String(buttonPattern),
          });
          return;
        } catch (error) {
          lastError = error;
        }
      }
    }

    await dialogPause(dialog, 250);
  }

  throw lastError || new Error(`${label} button was not found.`);
}

async function forceClickLocator(locator, label) {
  const attempts = [
    async () => locator.click(),
    async () => locator.click({ force: true }),
    async () => locator.evaluate((node) => {
      node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      if (typeof node.click === "function") {
        node.click();
      }
    }),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`${label} click failed.`);
}

async function hasVisibleWindowText(page, pattern) {
  return page.evaluate(({ source, flags }) => {
    const matcher = new RegExp(source, flags);
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    return Array.from(document.querySelectorAll("div.x-window"))
      .some((element) => isVisible(element) && matcher.test((element.innerText || "").trim()));
  }, {
    source: pattern.source,
    flags: pattern.flags,
  }).catch(() => false);
}

function buildDesktopUtilityConnectionMessage(metadata = {}) {
  const poNo = String(metadata?.poNo || "").trim();
  const changeEquipmentId = String(metadata?.changeEquipmentId || "").trim();
  const stage = String(metadata?.stage || "Pack-Scan-Ship").trim();
  const operation = String(metadata?.operation || "当前自动化").trim();
  const prefix = poNo
    ? `PO No ${poNo}: `
    : changeEquipmentId
      ? `Create Shipment ${changeEquipmentId}: `
      : "";
  return `${prefix}Infor Nexus 桌面工具连接超时：页面已进入 ${stage}，但没有连上 Desktop Utility，${operation} 无法加载所需设备/包裹数据。请确认 Desktop Utility 正在运行且版本不低于 2.0.1.29；可点击左下角 Reconnect to Desktop，或重新加载 PackByScan 后再执行。`;
}

function compactBusinessDataState(state = {}) {
  const compact = {};
  const numericFields = [
    "rowCount",
    "matchedPoRowCount",
    "matchedEquipmentRowCount",
    "matchedTargetPairRowCount",
    "matchedTargetRowCount",
    "matchedTargetPairCount",
    "selectedRowCount",
    "packagesSelectedCount",
    "missingTargetPairCount",
  ];

  for (const field of numericFields) {
    if (state?.[field] !== undefined && state?.[field] !== null && state?.[field] !== "") {
      compact[field] = Number(state[field] || 0);
    }
  }

  if (state?.noDataVisible !== undefined) {
    compact.noDataVisible = Boolean(state.noDataVisible);
  }

  const rowSignature = String(state?.rowSignature || "").trim();
  if (rowSignature) {
    compact.rowSignature = rowSignature.slice(0, 240);
  }

  return compact;
}

function createBusinessDataEmptyError(message, metadata = {}) {
  const state = compactBusinessDataState(metadata?.state);
  const stateSuffix = Object.keys(state).length > 0
    ? ` State: ${JSON.stringify(state)}`
    : "";
  const error = new Error(`${message}${stateSuffix}`);
  error.code = BUSINESS_DATA_EMPTY_CODE;
  error.businessDataEmpty = true;
  error.businessData = {
    ...metadata,
    state,
  };
  return error;
}

function buildShipmentBusinessDataEmptyError(poNo, state, reason) {
  const normalizedPoNo = String(poNo || "").trim();
  const reasonText = String(reason || "").trim();
  const detail = reasonText ? `（${reasonText}）` : "";
  return createBusinessDataEmptyError(
    `PO No ${normalizedPoNo}: 业务数据为空，Shipment Scan 未查询到可处理的包裹/设备行${detail}。`,
    {
      poNo: normalizedPoNo,
      stage: "Shipment Scan",
      reason: reasonText,
      state,
    },
  );
}

function buildCreateShipmentBusinessDataEmptyError(changeEquipmentId, state, reason) {
  const normalizedChangeEquipmentId = String(changeEquipmentId || "").trim();
  const reasonText = String(reason || "").trim();
  const detail = reasonText ? `（${reasonText}）` : "";
  return createBusinessDataEmptyError(
    `Create Shipment ${normalizedChangeEquipmentId}: 业务数据为空，Create Shipment 未查询到可处理的 PO/设备行${detail}。`,
    {
      changeEquipmentId: normalizedChangeEquipmentId,
      stage: "Create Shipment",
      reason: reasonText,
      state,
    },
  );
}

async function assertNoDesktopUtilityConnectionIssue(page, metadata = {}) {
  const issue = await getDesktopUtilityConnectionIssue(page);
  if (!issue?.detected) {
    return;
  }

  const error = new Error(buildDesktopUtilityConnectionMessage(metadata));
  error.code = "INFORNEXUS_DESKTOP_UTILITY_TIMEOUT";
  error.desktopUtility = issue;
  throw error;
}

async function getDesktopUtilityConnectionIssue(page) {
  return page.evaluate(({ source, flags }) => {
    const matcher = new RegExp(source, flags);
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    const candidates = Array.from(document.querySelectorAll("div.x-window, div.x-tip, div.x-layer, div.x-panel, span, td, a"))
      .filter(isVisible)
      .map((element) => normalize(element.innerText || element.textContent))
      .filter(Boolean);
    const matchedText = candidates.find((text) => matcher.test(text))
      || (matcher.test(normalize(document.body?.innerText)) ? normalize(document.body?.innerText) : "");

    return matchedText
      ? { detected: true, text: matchedText.slice(0, 600) }
      : { detected: false, text: "" };
  }, {
    source: DESKTOP_UTILITY_CONNECTION_PATTERN.source,
    flags: DESKTOP_UTILITY_CONNECTION_PATTERN.flags,
  }).catch(() => ({ detected: false, text: "" }));
}

async function getShipmentGridSelectionState(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    const rowCheckers = Array.from(document.querySelectorAll("div.x-grid3-row-checker"))
      .filter(isVisible);
    const selectedRowCount = rowCheckers.filter((element) => {
      const className = String(element.className || "");
      if (className.includes("x-grid3-row-checker-on")) {
        return true;
      }

      const rowNode = element.closest(".x-grid3-row");
      return Boolean(rowNode && rowNode.className.includes("x-grid3-row-selected"));
    }).length;

    const headerChecker = Array.from(document.querySelectorAll("div.x-grid3-hd-checker"))
      .find(isVisible);
    const headerSelected = Boolean(
      headerChecker
      && (
        String(headerChecker.className || "").includes("x-grid3-hd-checker-on")
        || String(headerChecker.parentElement?.className || "").includes("x-grid3-hd-checker-on")
      )
    );

    return {
      rowCount: rowCheckers.length,
      selectedRowCount,
      headerSelected,
    };
  });
}

async function getShipmentGridState(page, poNo, shipmentScanAction = "Remove/Change Equipment ID") {
  const normalizedPoNo = String(poNo || "").trim();
  const allowPlainShipmentScanTitle = isAssignEquipmentShipmentScanAction(shipmentScanAction);
  return page.evaluate(({ targetPo, allowPlainShipmentScanTitle: allowPlainTitle }) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isShipmentWorkspaceHeader = (value) => {
      const text = normalize(value);
      return /^Undo Shipment Scan$/i.test(text)
        || (allowPlainTitle && /^Shipment Scan$/i.test(text));
    };
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    const workspace = Array.from(document.querySelectorAll("div.x-panel"))
      .find((element) => isVisible(element)
        && Array.from(element.querySelectorAll("span.x-panel-header-text"))
          .some((header) => isShipmentWorkspaceHeader(header.textContent)));
    if (!workspace) {
      return {
        rowCount: 0,
        selectedRowCount: 0,
        headerSelected: false,
        matchedPoRowCount: 0,
        packagesSelectedCount: 0,
        noDataVisible: false,
        rowSignature: "",
      };
    }

    const grid = Array.from(workspace.querySelectorAll("div.x-grid3"))
      .find((element) => isVisible(element));
    if (!grid) {
      return {
        rowCount: 0,
        selectedRowCount: 0,
        headerSelected: false,
        matchedPoRowCount: 0,
        packagesSelectedCount: 0,
        noDataVisible: false,
        rowSignature: "",
      };
    }

    const rowNodes = Array.from(grid.querySelectorAll("div.x-grid3-row"))
      .filter((element) => isVisible(element));
    const rowTexts = rowNodes
      .map((element) => normalize(element.innerText || element.textContent))
      .filter(Boolean);
    const selectedRowCount = rowNodes.filter((rowNode) => {
      const checker = rowNode.querySelector("div.x-grid3-row-checker");
      const checkerClass = String(checker?.className || "");
      const rowClass = String(rowNode.className || "");
      return isVisible(checker)
        && (checkerClass.includes("x-grid3-row-checker-on") || rowClass.includes("x-grid3-row-selected"));
    }).length;

    const headerChecker = Array.from(grid.querySelectorAll("div.x-grid3-hd-checker"))
      .find((element) => isVisible(element));
    const headerSelected = Boolean(
      headerChecker
      && (
        String(headerChecker.className || "").includes("x-grid3-hd-checker-on")
        || String(headerChecker.parentElement?.className || "").includes("x-grid3-hd-checker-on")
      )
    );
    const packagesMatch = normalize(workspace.innerText || workspace.textContent).match(/Packages Selected:\s*(\d+)/i);
    const matchedPoRowCount = targetPo
      ? rowTexts.filter((text) => text.includes(targetPo)).length
      : rowTexts.length;
    const noDataVisible = Array.from(workspace.querySelectorAll("div, span, td"))
      .filter((element) => isVisible(element))
      .some((element) => /No data to display/i.test(normalize(element.textContent)));

    return {
      rowCount: rowNodes.length,
      selectedRowCount,
      headerSelected,
      matchedPoRowCount,
      packagesSelectedCount: Number(packagesMatch?.[1] || 0),
      noDataVisible,
      rowSignature: rowTexts.slice(0, 8).join(" || ").slice(0, 600),
    };
  }, {
    targetPo: normalizedPoNo,
    allowPlainShipmentScanTitle,
  }).catch(() => ({
    rowCount: 0,
    selectedRowCount: 0,
    headerSelected: false,
    matchedPoRowCount: 0,
    packagesSelectedCount: 0,
    noDataVisible: false,
    rowSignature: "",
  }));
}

async function getCreateShipmentGridState(page, createShipmentBatch) {
  const plan = await getCreateShipmentGridSelectionPlanExact(page, createShipmentBatch);
  return {
    rowCount: plan.rowCount,
    selectedRowCount: plan.selectedRowCount,
    headerSelected: plan.headerSelected,
    matchedEquipmentRowCount: plan.matchedEquipmentRowCount,
    matchedTargetPairRowCount: plan.matchedTargetRowCount,
    matchedTargetPairCount: plan.matchedTargetPairCount,
    noDataVisible: plan.noDataVisible,
    rowSignature: plan.rowSignature,
  };
}

async function getCreateShipmentGridSelectionPlanExact(page, createShipmentBatch) {
  const normalizedChangeEquipmentId = String(createShipmentBatch?.changeEquipmentId || "").trim();
  const targetPairs = Array.isArray(createShipmentBatch?.targetPairs)
    ? createShipmentBatch.targetPairs.map((item) => ({
      poNo: String(item?.poNo || "").trim(),
      changeEquipmentId: String(item?.changeEquipmentId || "").trim(),
    })).filter((item) => item.poNo && item.changeEquipmentId)
    : [];

  return page.evaluate(({ targetEquipmentId, targetPairsInput }) => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const buildPairKey = (equipmentNumber, poNo) => `${normalize(equipmentNumber)}|||${normalize(poNo)}`;

    const grid = Array.from(document.querySelectorAll("div.x-grid3-viewport"))
      .filter((element) => isVisible(element))
      .find((element) => {
        const headerTexts = Array.from(
          element.querySelectorAll(".x-grid3-header td, .x-grid3-header div.x-grid3-hd-inner, td.x-grid3-hd, div.x-grid3-hd-inner"),
        )
          .map((header) => normalize(header.textContent))
          .filter(Boolean);
        return headerTexts.some((text) => /Equipment Number/i.test(text))
          && headerTexts.some((text) => /PO Numbers/i.test(text));
      });

    if (!grid) {
      return {
        rowCount: 0,
        selectedRowCount: 0,
        headerSelected: false,
        matchedEquipmentRowCount: 0,
        matchedTargetRowCount: 0,
        matchedTargetPairCount: 0,
        selectedTargetRowCount: 0,
        missingTargetPairCount: targetPairsInput.length,
        unexpectedSelectedCount: 0,
        pendingToggleCount: 0,
        noDataVisible: false,
        rowSignature: "",
        actions: [],
      };
    }

    const headerCells = Array.from(grid.querySelectorAll("td.x-grid3-hd, td.x-grid3-cell-first, td"))
      .filter((element) => isVisible(element) && element.closest(".x-grid3-header"));
    const headerEntries = headerCells.map((cell, index) => ({
      index,
      text: normalize(cell.innerText || cell.textContent),
      className: String(cell.className || ""),
    }));
    const equipmentColIndex = headerEntries.find((item) => /Equipment Number/i.test(item.text) || /equipmentRef/i.test(item.className))?.index ?? 1;
    const poColIndex = headerEntries.find((item) => /PO Numbers/i.test(item.text) || /poNums/i.test(item.className))?.index ?? 2;

    const targetPairCounts = new Map();
    for (const pair of targetPairsInput) {
      const pairKey = buildPairKey(pair.changeEquipmentId, pair.poNo);
      targetPairCounts.set(pairKey, Number(targetPairCounts.get(pairKey) || 0) + 1);
    }
    const remainingPairCounts = new Map(targetPairCounts);

    const rowNodes = Array.from(grid.querySelectorAll("tbody.x-grid3-body tr.x-grid3-row, tr.x-grid3-row"))
      .filter((element) => isVisible(element));
    const actions = [];
    let matchedEquipmentRowCount = 0;
    let matchedTargetRowCount = 0;
    let matchedTargetPairCount = 0;
    let selectedRowCount = 0;
    let selectedTargetRowCount = 0;
    let unexpectedSelectedCount = 0;

    rowNodes.forEach((rowNode, index) => {
      const rowCells = Array.from(rowNode.querySelectorAll("td.x-grid3-cell, td"))
        .filter((element) => element.closest(".x-grid3-row") === rowNode);
      const equipmentText = normalize(
        rowNode.querySelector('td.x-grid3-td-eqp-equipmentRef .tgv-cell-inner, td[class*="equipmentRef"] .x-grid3-cell-inner, div[class*="equipmentRef"]')
          ?.textContent
          || rowCells[equipmentColIndex]?.textContent
          || "",
      );
      const poText = normalize(
        rowNode.querySelector('td.x-grid3-td-eqp-poNums .tgv-cell-inner, td[class*="poNums"] .x-grid3-cell-inner, div[class*="poNums"]')
          ?.textContent
          || rowCells[poColIndex]?.textContent
          || "",
      );
      const checker = rowNode.querySelector("div.x-grid3-row-checker");
      const checkerClass = String(checker?.className || "");
      const rowClass = String(rowNode.className || "");
      const selected = isVisible(checker)
        && (checkerClass.includes("x-grid3-row-checker-on") || rowClass.includes("x-grid3-row-selected"));

      if (selected) {
        selectedRowCount += 1;
      }

      const equipmentMatches = equipmentText === normalize(targetEquipmentId);
      if (equipmentMatches) {
        matchedEquipmentRowCount += 1;
      }

      const pairKey = buildPairKey(equipmentText, poText);
      const remainingCount = Number(remainingPairCounts.get(pairKey) || 0);
      const shouldSelect = equipmentMatches && remainingCount > 0;
      if (shouldSelect) {
        remainingPairCounts.set(pairKey, remainingCount - 1);
        matchedTargetPairCount += 1;
        matchedTargetRowCount += 1;
        if (selected) {
          selectedTargetRowCount += 1;
        }
      } else if (selected) {
        unexpectedSelectedCount += 1;
      }

      actions.push({
        index,
        poNo: poText,
        equipmentNumber: equipmentText,
        selected,
        shouldSelect,
        matchedPairKey: shouldSelect ? pairKey : "",
        needsToggle: selected !== shouldSelect,
      });
    });

    const missingTargetPairCount = Array.from(remainingPairCounts.values())
      .reduce((sum, count) => sum + Number(count || 0), 0);
    const headerChecker = Array.from(grid.querySelectorAll("div.x-grid3-hd-checker"))
      .find((element) => isVisible(element));
    const headerSelected = Boolean(
      headerChecker
      && (
        String(headerChecker.className || "").includes("x-grid3-hd-checker-on")
        || String(headerChecker.parentElement?.className || "").includes("x-grid3-hd-checker-on")
      )
    );
    const noDataVisible = Array.from(document.querySelectorAll("div, span, td"))
      .filter((element) => isVisible(element))
      .some((element) => /No data to display/i.test(normalize(element.textContent)));
    const rowSignature = actions
      .map((item) => `${item.equipmentNumber}|${item.poNo}|${item.selected ? "1" : "0"}|${item.shouldSelect ? "1" : "0"}`)
      .slice(0, 8)
      .join(" || ")
      .slice(0, 600);

    return {
      rowCount: rowNodes.length,
      selectedRowCount,
      headerSelected,
      matchedEquipmentRowCount,
      matchedTargetRowCount,
      matchedTargetPairCount,
      selectedTargetRowCount,
      missingTargetPairCount,
      unexpectedSelectedCount,
      pendingToggleCount: actions.filter((item) => item.needsToggle).length,
      noDataVisible,
      rowSignature,
      actions,
    };
  }, {
    targetEquipmentId: normalizedChangeEquipmentId,
    targetPairsInput: targetPairs,
  }).catch(() => ({
    rowCount: 0,
    selectedRowCount: 0,
    headerSelected: false,
    matchedEquipmentRowCount: 0,
    matchedTargetRowCount: 0,
    matchedTargetPairCount: 0,
    selectedTargetRowCount: 0,
    missingTargetPairCount: targetPairs.length,
    unexpectedSelectedCount: 0,
    pendingToggleCount: 0,
    noDataVisible: false,
    rowSignature: "",
    actions: [],
  }));
}

async function getVisibleDialogErrorText(page) {
  const normalizedText = await getVisibleMessageDialogText(page);
  if (!normalizedText) {
    return "";
  }

  if (/Please select at least one Package Range to continue/i.test(normalizedText)) {
    return "Please select at least one Package Range to continue";
  }

  if (!isContinueAnywayDialogText(normalizedText)) {
    return normalizedText;
  }

  return "";
}

async function getVisibleMessageDialogText(page) {
  const dialogInfo = await getTopVisibleDialogInfo(page);
  if (!dialogInfo?.isMessageDialog || !dialogInfo.text) {
    return "";
  }

  return dialogInfo.text.replace(/\s+/g, " ").trim();
}

function isContinueAnywayDialogText(text) {
  return /Invalid Equipment Number/i.test(String(text || ""))
    && /Continue anyway\?/i.test(String(text || ""));
}

function isRecoverableChangeEquipmentIdConflictText(text) {
  const normalizedText = String(text || "");
  return /Container\/Equipment number is already in used/i.test(normalizedText)
    || /Container\/Equipment number is already in use/i.test(normalizedText)
    || /Please input another one/i.test(normalizedText);
}

async function acceptVisibleContinueAnywayDialog(page, metadata = {}) {
  const dialogText = await getVisibleMessageDialogText(page);
  if (!isContinueAnywayDialogText(dialogText)) {
    return false;
  }

  const dismissed = await dismissVisibleMessageDialog(page);
  if (dismissed) {
    log("Accepted continue-anyway dialog.", {
      ...metadata,
      text: dialogText,
    });
  }
  return dismissed;
}

async function recoverFromRecoverableChangeEquipmentIdError(page, dialog, poNo, errorText) {
  const sawShadow = await hasVisibleModalShadow(page);
  await dismissVisibleMessageDialog(page).catch(() => false);
  await page.waitForTimeout(250).catch(() => {});
  await closeDialogWithCloseTool(dialog, "Change Equipment ID").catch(() => false);

  log("Recovered from Change Equipment ID conflict and treated row as already applied.", {
    poNo,
    sawShadow,
    errorText,
  });
  return {
    status: "already-applied",
  };
}

async function dismissVisibleMessageDialog(page) {
  const dialogInfo = await getTopVisibleDialogInfo(page);
  if (!dialogInfo?.id || !dialogInfo.isMessageDialog) {
    return false;
  }

  const dialog = page.locator(`[id="${dialogInfo.id}"]`).first();
  const okButton = dialog.locator("button.x-btn-text").filter({ hasText: /^OK$/ }).first();
  const okVisible = await okButton.isVisible().catch(() => false);
  if (okVisible) {
    await okButton.click().catch(() => {});
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    log("Dismissed visible message dialog.", {
      dialogId: dialogInfo.id,
      text: dialogInfo.text,
    });
    return true;
  }

  const closeTool = dialog.locator(".x-tool-close").first();
  const closeVisible = await closeTool.isVisible().catch(() => false);
  if (closeVisible) {
    await closeTool.click().catch(() => {});
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
    log("Closed visible message dialog with close tool.", {
      dialogId: dialogInfo.id,
      text: dialogInfo.text,
    });
    return true;
  }

  return false;
}

async function closeDialogWithCloseTool(dialog, label) {
  const dialogVisible = await dialog.isVisible().catch(() => false);
  if (!dialogVisible) {
    return false;
  }

  const closeTool = dialog.locator(".x-tool-close").first();
  const closeVisible = await closeTool.isVisible().catch(() => false);
  if (!closeVisible) {
    return false;
  }

  await forceClickLocator(closeTool, `${label} close tool`);
  await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  log(`Closed ${label} dialog with close tool.`);
  return true;
}

async function hasVisibleModalShadow(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    return Array.from(document.querySelectorAll("div.x-shadow"))
      .some((element) => isVisible(element));
  }).catch(() => false);
}

async function getTopVisibleDialogInfo(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };

    const dialogs = Array.from(document.querySelectorAll("div.x-window"))
      .filter(isVisible)
      .map((element) => {
        const inputs = Array.from(element.querySelectorAll('input:not([type="hidden"]), textarea, select'))
          .filter(isVisible)
          .map((input) => ({
            id: input.id || "",
            name: input.getAttribute("name") || "",
            type: input.getAttribute("type") || "",
            value: input.value || "",
          }));

        return {
          id: element.id || "",
          text: (element.innerText || "").trim(),
          zIndex: Number(window.getComputedStyle(element).zIndex || 0),
          inputs,
          isMessageDialog: element.className.includes("x-window-dlg"),
        };
      })
      .sort((left, right) => right.zIndex - left.zIndex);

    return dialogs[0] || null;
  }).catch((error) => {
    if (isTransientExecutionContextError(error)) {
      return null;
    }
    throw error;
  });
}

async function clickShipmentScanOk(dialog) {
  const candidates = [
    dialog.locator("button.x-btn-text").filter({ hasText: /^OK$/ }),
    dialog.locator("td.x-btn-center button").filter({ hasText: /^OK$/ }),
    dialog.getByRole("button", { name: /^OK$/ }),
  ];
  const startedAt = Date.now();
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    for (const locator of candidates) {
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 8); index += 1) {
        const button = locator.nth(index);
        const visible = await button.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        try {
          await forceClickLocator(button, "Shipment Scan OK");
          await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
          log("Clicked Shipment Scan OK.");
          return;
        } catch (error) {
          lastError = error;
        }
      }
    }

    await dialogPause(dialog, 250);
  }

  throw lastError || new Error("Shipment Scan OK button was not found.");
}

async function clickLocator(locator, label) {
  await locator.first().waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await locator.first().click();
  log(`Clicked ${label}.`);
}

async function persistRunArtifacts(result, poRows, runId) {
  await mkdir(artifactsDir, { recursive: true });

  const safeRunId = sanitizeFileSegment(runId || result?.runId || createRunId("artifact"));
  const resultJsonName = `${safeRunId}-result.json`;
  const resultExcelName = `${safeRunId}-result.xlsx`;
  const failedJsonName = `${safeRunId}-failed-po-rows.json`;
  const failedExcelName = `${safeRunId}-failed-po-rows.xlsx`;
  const runResultPath = path.join(artifactsDir, resultJsonName);
  const runResultExcelPath = path.join(artifactsDir, resultExcelName);
  const runFailedJsonPath = path.join(artifactsDir, failedJsonName);
  const runFailedExcelPath = path.join(artifactsDir, failedExcelName);
  const latestResultPath = path.join(artifactsDir, "last-result.json");
  const latestResultExcelPath = path.join(artifactsDir, "last-result.xlsx");
  const latestFailedJsonPath = path.join(artifactsDir, "last-failed-po-rows.json");
  const latestFailedExcelPath = path.join(artifactsDir, "last-failed-po-rows.xlsx");
  const failedRows = extractFailedPoRows(result, poRows);

  await writeFile(runResultPath, JSON.stringify(result, null, 2), "utf8");
  await writeRunResultWorkbook(runResultExcelPath, result, poRows);
  await writeFile(runFailedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writeFailedPoWorkbook(runFailedExcelPath, failedRows);

  await writeFile(latestResultPath, JSON.stringify(result, null, 2), "utf8");
  await writeRunResultWorkbook(latestResultExcelPath, result, poRows);
  await writeFile(latestFailedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writeFailedPoWorkbook(latestFailedExcelPath, failedRows);

  return {
    runId: safeRunId,
    resultPath: runResultPath,
    resultExcelPath: runResultExcelPath,
    failedJsonPath: runFailedJsonPath,
    failedExcelPath: runFailedExcelPath,
    latestResultPath,
    latestResultExcelPath,
    latestFailedJsonPath,
    latestFailedExcelPath,
    failedRowCount: failedRows.length,
    downloadUrls: {
      resultJsonUrl: `/artifacts/${resultJsonName}`,
      resultExcelUrl: `/artifacts/${resultExcelName}`,
      failedPoJsonUrl: `/artifacts/${failedJsonName}`,
      failedPoExcelUrl: `/artifacts/${failedExcelName}`,
      latestResultJsonUrl: "/artifacts/last-result.json",
      latestResultExcelUrl: "/artifacts/last-result.xlsx",
      latestFailedPoJsonUrl: "/artifacts/last-failed-po-rows.json",
      latestFailedPoExcelUrl: "/artifacts/last-failed-po-rows.xlsx",
    },
  };
}

function extractFailedPoRows(result, poRows) {
  const resultRows = Array.isArray(result?.poResults) ? result.poResults : [];
  const resultByRowIndex = new Map(resultRows.map((item) => [item.rowIndex, item]));

  return poRows
    .filter((row) => {
      const resultRow = resultByRowIndex.get(row.rowIndex);
      return !resultRow || !resultRow.ok;
    })
    .map((row) => {
      const resultRow = resultByRowIndex.get(row.rowIndex);
      return {
        rowIndex: row.rowIndex,
        poNo: row.poNo,
        changeEquipmentId: row.changeEquipmentId,
        failedStep: resultRow?.failedStep || classifyPoFailureStep(resultRow?.error || result?.message || ""),
        errorCode: resultRow?.errorCode || "",
        reason: resultRow?.error || result?.message || "Shipment PO row was not completed.",
        originalRow: row.originalRow,
      };
    });
}

async function writeFailedPoWorkbook(targetPath, failedRows) {
  const exportRows = failedRows.map((row) => ({
    rowIndex: row.rowIndex,
    poNo: row.poNo,
    changeEquipmentId: row.changeEquipmentId || "",
    failedStep: row.failedStep || "",
    errorCode: row.errorCode || "",
    failureReason: row.reason || "",
    ...(row.originalRow && typeof row.originalRow === "object" ? row.originalRow : {}),
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportRows, {
    header: exportRows.length > 0
      ? undefined
      : ["rowIndex", "poNo", "changeEquipmentId", "failedStep", "errorCode", "failureReason"],
  });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Failed PO Rows");

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  await writeFile(targetPath, buffer);
}

async function writeRunResultWorkbook(targetPath, result, poRows) {
  const workbook = xlsx.utils.book_new();
  const poResultRows = buildPoResultWorkbookRows(result, poRows);
  const createShipmentRows = buildCreateShipmentWorkbookRows(result);
  const summaryRows = buildRunSummaryRows(result, poResultRows, createShipmentRows);

  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(summaryRows),
    "Summary",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(poResultRows, {
      header: poResultRows.length > 0
        ? undefined
        : ["rowIndex", "poNo", "changeEquipmentId", "ok", "failedStep", "errorCode", "failureReason"],
    }),
    "PO Results",
  );
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(createShipmentRows, {
      header: createShipmentRows.length > 0
        ? undefined
        : ["changeEquipmentId", "poNos", "ok", "failedStep", "errorCode", "failureReason"],
    }),
    "Create Shipment",
  );

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  await writeFile(targetPath, buffer);
}

function buildPoResultWorkbookRows(result, poRows) {
  const resultRows = Array.isArray(result?.poResults) ? result.poResults : [];
  const resultByRowIndex = new Map(resultRows.map((item) => [item.rowIndex, item]));

  return poRows.map((row) => {
    const resultRow = resultByRowIndex.get(row.rowIndex);
    const failureReason = resultRow?.ok
      ? ""
      : resultRow?.error || result?.message || "Shipment PO row was not completed.";
    return {
      rowIndex: row.rowIndex,
      poNo: row.poNo,
      changeEquipmentId: row.changeEquipmentId || "",
      ok: Boolean(resultRow?.ok),
      changeEquipmentApplyStatus: String(resultRow?.changeEquipmentApplyStatus || ""),
      failedStep: resultRow?.ok ? "" : classifyPoFailureStep(failureReason),
      errorCode: resultRow?.ok ? "" : String(resultRow?.errorCode || ""),
      failureReason,
      ...(row.originalRow && typeof row.originalRow === "object" ? row.originalRow : {}),
    };
  });
}

function buildCreateShipmentWorkbookRows(result) {
  const createShipmentResults = Array.isArray(result?.createShipmentResults)
    ? result.createShipmentResults
    : [];

  return createShipmentResults.map((item) => {
    const failureReason = item?.ok
      ? ""
      : String(item?.error || result?.message || "").trim();
    return {
      changeEquipmentId: String(item?.changeEquipmentId || "").trim(),
      poNos: Array.isArray(item?.poNos) ? item.poNos.join(", ") : "",
      ok: Boolean(item?.ok),
      failedStep: item?.ok ? "" : item?.failedStep || classifyPoFailureStep(failureReason),
      errorCode: item?.ok ? "" : String(item?.errorCode || ""),
      failureReason,
    };
  });
}

function buildRunSummaryRows(result, poResultRows, createShipmentRows) {
  return [
    { metric: "ok", value: Boolean(result?.ok) ? "true" : "false" },
    { metric: "message", value: String(result?.message || "") },
    { metric: "generatedAt", value: String(result?.generatedAt || "") },
    { metric: "inputFileName", value: String(result?.inputFileName || "") },
    { metric: "totalPoCount", value: Number(result?.totalPoCount ?? poResultRows.length) },
    { metric: "completedPoCount", value: Number(result?.completedPoCount ?? poResultRows.filter((item) => item.ok).length) },
    { metric: "failedPoCount", value: Number(result?.failedPoCount ?? poResultRows.filter((item) => !item.ok).length) },
    { metric: "businessDataEmptyPoCount", value: Number(result?.businessDataEmptyPoCount ?? poResultRows.filter((item) => isBusinessDataEmptyResult(item)).length) },
    { metric: "uniqueChangeEquipmentIdCount", value: Number(result?.uniqueChangeEquipmentIdCount ?? 0) },
    { metric: "completedCreateShipmentCount", value: Number(result?.completedCreateShipmentCount ?? createShipmentRows.filter((item) => item.ok).length) },
    { metric: "failedCreateShipmentCount", value: Number(result?.failedCreateShipmentCount ?? createShipmentRows.filter((item) => !item.ok).length) },
    { metric: "businessDataEmptyCreateShipmentCount", value: Number(result?.businessDataEmptyCreateShipmentCount ?? createShipmentRows.filter((item) => isBusinessDataEmptyResult(item)).length) },
    { metric: "finalUrl", value: String(result?.finalUrl || "") },
  ];
}

function countBusinessDataEmptyResults(rows) {
  return Array.isArray(rows)
    ? rows.filter((item) => isBusinessDataEmptyResult(item)).length
    : 0;
}

function isBusinessDataEmptyResult(item) {
  if (!item || item.ok) {
    return false;
  }

  if (String(item.errorCode || "") === BUSINESS_DATA_EMPTY_CODE) {
    return true;
  }

  return classifyPoFailureStep(item.failedStep || item.failureReason || item.error || "") === "业务数据为空";
}

function isBusinessDataEmptyReason(reason) {
  const normalizedReason = String(reason || "").toLowerCase();
  return normalizedReason.includes("业务数据为空")
    || normalizedReason.includes("business data empty")
    || normalizedReason.includes(BUSINESS_DATA_EMPTY_CODE.toLowerCase())
    || normalizedReason.includes("no shipment rows were loaded")
    || normalizedReason.includes("shipment grid stayed empty")
    || normalizedReason.includes("shipment grid did not switch")
    || normalizedReason.includes("timed out waiting for shipment rows")
    || normalizedReason.includes("no rows were loaded after confirming filters")
    || normalizedReason.includes("timed out waiting for filtered grid rows")
    || normalizedReason.includes("grid did not switch to rows for this equipment number")
    || normalizedReason.includes("no grid rows matched")
    || normalizedReason.includes("grid rows were not fully selected")
    || normalizedReason.includes("shipment rows were not fully selected");
}

function classifyPoFailureStep(reason) {
  const normalizedReason = String(reason || "").toLowerCase();
  if (!normalizedReason) {
    return "Shipping Automation";
  }

  if (normalizedReason.includes("po no is empty")) {
    return "Workbook Validation";
  }

  if (normalizedReason.includes("change equipment id is empty")) {
    return "Workbook Validation";
  }

  if (isBusinessDataEmptyReason(reason)) {
    return "业务数据为空";
  }

  if (normalizedReason.includes("desktop utility")
    || normalizedReason.includes("packbyscan")
    || normalizedReason.includes("桌面工具连接超时")) {
    return "Desktop Utility Connection";
  }

  if (normalizedReason.includes("shipment scan ok button")) {
    return "Shipment Scan Confirm";
  }

  if (normalizedReason.includes("timed out waiting for shipment rows")) {
    return "Shipment Scan Result Wait";
  }

  if (normalizedReason.includes("no shipment rows were loaded")) {
    return "Shipment Scan Result Load";
  }

  if (normalizedReason.includes("shipment grid stayed empty")) {
    return "Shipment Scan Result Load";
  }

  if (normalizedReason.includes("did not switch to rows for this po")) {
    return "Shipment Scan Result Load";
  }

  if (normalizedReason.includes("package range")) {
    return "Change Equipment ID Selection";
  }

  if (normalizedReason.includes("container/equipment number is already in used")
    || normalizedReason.includes("container/equipment number is already in use")
    || normalizedReason.includes("please input another one")
    || normalizedReason.includes("x-shadow modal detected")) {
    return "Change Equipment ID Conflict";
  }

  if (normalizedReason.includes("apply did not finish")) {
    return "Change Equipment ID Apply";
  }

  if (normalizedReason.includes("change equipment id dialog")) {
    return "Change Equipment ID Dialog";
  }

  if (normalizedReason.includes("create shipment")) {
    return "Create Shipment";
  }

  return "Shipping Automation";
}

function assertWorkbookPayload(body) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();
  if (!fileBase64) {
    const error = new Error("fileBase64 must be a non-empty base64 string.");
    error.statusCode = 400;
    throw error;
  }

  const inputFileName = normalizeUploadFileName(body);
  if (inputFileName && !/\.(xlsx|xls)$/i.test(inputFileName)) {
    const error = new Error("Uploaded file must be an .xlsx or .xls workbook.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");
  const workbookBuffer = Buffer.from(normalizedBase64, "base64");
  if (!workbookBuffer.length) {
    const error = new Error("Decoded workbook content is empty.");
    error.statusCode = 400;
    throw error;
  }

  return workbookBuffer;
}

function extractInfornexusAutoAddRowsFromWorkbookPayload(body) {
  const workbookBuffer = assertWorkbookPayload(body);

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, { type: "buffer" });
  } catch (error) {
    const parseError = new Error(`Failed to parse uploaded workbook: ${error.message || error}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const sheetName = resolveWorksheetName(workbook, body?.sheetName);
  if (!sheetName) {
    const error = new Error("Uploaded workbook does not contain any worksheet.");
    error.statusCode = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  const idRows = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const value = Array.isArray(row) ? String(row[1] ?? "").trim() : "";
    if (value && value.length === 10) {
      idRows.push({
        rowIndex: index + 1,
        id: value,
      });
    }
  }

  if (idRows.length === 0) {
    const error = new Error("Uploaded workbook must contain at least one 10-character ID in the second column.");
    error.statusCode = 400;
    throw error;
  }

  return idRows;
}

function extractPoRowsFromWorkbookPayload(body, options = {}) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();
  if (!fileBase64) {
    const error = new Error("fileBase64 must be a non-empty base64 string.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");
  const workbookBuffer = Buffer.from(normalizedBase64, "base64");
  if (!workbookBuffer.length) {
    const error = new Error("Decoded workbook content is empty.");
    error.statusCode = 400;
    throw error;
  }

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, { type: "buffer" });
  } catch (error) {
    const parseError = new Error(`Failed to parse uploaded workbook: ${error.message || error}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const sheetName = resolveWorksheetName(workbook, body?.sheetName);
  if (!sheetName) {
    const error = new Error("Uploaded workbook does not contain any worksheet.");
    error.statusCode = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[sheetName];
  const isXinlongtaiWorkbook = Boolean(options?.isXinlongtaiWorkbook);
  const rows = xlsx.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  const poRows = rows
    .map((row, index) => ({
      rowIndex: index + 2,
      poNo: extractPoNoValue(row, { isXinlongtaiWorkbook }),
      changeEquipmentId: extractChangeEquipmentIdValue(row),
      issueDate: extractIssueDateValue(row),
      invoiceNumber: extractInvoiceNumberValue(row, { isXinlongtaiWorkbook }),
      originalRow: row,
    }))
    .filter((row) => row.poNo);

  if (poRows.length === 0) {
    const error = new Error("Uploaded workbook must contain at least one non-empty PO No value.");
    error.statusCode = 400;
    throw error;
  }

  return poRows;
}

function resolveWorksheetName(workbook, preferredSheetName) {
  if (preferredSheetName && workbook?.SheetNames?.includes(preferredSheetName)) {
    return preferredSheetName;
  }

  return Array.isArray(workbook?.SheetNames) ? workbook.SheetNames[0] || "" : "";
}

function extractPoNoValue(row, options = {}) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const directValue = row["PO No"]
    ?? row["PO NO"]
    ?? row["PO no"]
    ?? row["PO No1"]
    ?? row["PO NO1"]
    ?? row["PO no1"]
    ?? row["PO No."]
    ?? row["PO Number"]
    ?? row["PO NUMBER"]
    ?? row["P/O Number"]
    ?? row["P/O NUMBER"]
    ?? row["Purchase Order Number"]
    ?? row["PO"];
  if (directValue !== undefined && directValue !== null && String(directValue).trim()) {
    return String(directValue).trim();
  }

  const poKey = Object.keys(row).find((key) => {
    const normalizedKey = normalizeHeaderName(key);
    return isPoNoHeader(normalizedKey, options);
  });
  return poKey ? String(row[poKey] ?? "").trim() : "";
}

function isPoNoHeader(normalizedKey, options = {}) {
  return normalizedKey === "pono"
    || normalizedKey === "pono1"
    || normalizedKey === "ponumber"
    || normalizedKey === "purchaseordernumber"
    || normalizedKey === "purchaseorder"
    || normalizedKey === "orderno"
    || normalizedKey === "order"
    || (options?.isXinlongtaiWorkbook && normalizedKey === "po");
}

function extractChangeEquipmentIdValue(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const directValue = row["change equipment ID"] ?? row["Change Equipment ID"] ?? row["Change equipment ID"];
  if (directValue !== undefined && directValue !== null && String(directValue).trim()) {
    return String(directValue).trim();
  }

  const equipmentKey = Object.keys(row).find((key) => normalizeHeaderName(key) === "changeequipmentid");
  return equipmentKey ? String(row[equipmentKey] ?? "").trim() : "";
}

function extractIssueDateValue(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const preferredKeys = [
    "Issue Date",
    "issue date",
    "PODD Date",
    "PODD  Date",
    "PODD",
    "Date",
    "date",
  ];
  for (const key of preferredKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const dateKey = Object.keys(row).find((key) => {
    const normalizedKey = normalizeHeaderName(key);
    return normalizedKey === "issuedate"
      || normalizedKey === "podddate"
      || normalizedKey === "date";
  });
  return dateKey ? String(row[dateKey] ?? "").trim() : "";
}

function extractInvoiceNumberValue(row, options = {}) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const preferredKeys = [
    "Invoice Number",
    "invoice number",
    "Invoice No",
    "Invoice No.",
    "invoice no",
    "Invoice",
  ];
  for (const key of preferredKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const invoiceKey = Object.keys(row).find((key) => {
    const normalizedKey = normalizeHeaderName(key);
    return normalizedKey === "invoicenumber"
      || normalizedKey === "invoiceno"
      || normalizedKey === "invoice"
      || (options?.isXinlongtaiWorkbook && normalizedKey === "invnumber");
  });
  return invoiceKey ? String(row[invoiceKey] ?? "").trim() : "";
}

function collectCreateShipmentBatches(poRows) {
  const batches = [];
  const batchByEquipmentId = new Map();

  for (const row of Array.isArray(poRows) ? poRows : []) {
    const poNo = String(row?.poNo || "").trim();
    const changeEquipmentId = String(row?.changeEquipmentId || "").trim();
    const issueDate = String(row?.issueDate || "").trim();
    const invoiceNumber = String(row?.invoiceNumber || "").trim();
    if (!poNo || !changeEquipmentId) {
      continue;
    }

    let batch = batchByEquipmentId.get(changeEquipmentId);
    if (!batch) {
      batch = {
        changeEquipmentId,
        poNos: [],
        targetPairs: [],
        issueDate: "",
        issueDateSource: "",
        invoiceNumber: "",
        invoiceNumberSource: "",
        invoiceNumberConflict: false,
      };
      batchByEquipmentId.set(changeEquipmentId, batch);
      batches.push(batch);
    }

    if (!batch.poNos.includes(poNo)) {
      batch.poNos.push(poNo);
    }

    batch.targetPairs.push({
      rowIndex: Number(row?.rowIndex || 0),
      poNo,
      changeEquipmentId,
      issueDate,
      invoiceNumber,
    });

    if (issueDate && !batch.issueDate) {
      batch.issueDate = issueDate;
      batch.issueDateSource = `row ${Number(row?.rowIndex || 0)}`;
    }

    if (invoiceNumber && !batch.invoiceNumber) {
      batch.invoiceNumber = invoiceNumber;
      batch.invoiceNumberSource = `row ${Number(row?.rowIndex || 0)}`;
    } else if (
      invoiceNumber
      && batch.invoiceNumber
      && batch.invoiceNumber !== invoiceNumber
    ) {
      batch.invoiceNumberConflict = true;
    }
  }

  return batches;
}

function normalizeIssueDateParts(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const directDate = new Date(raw);
  if (!Number.isNaN(directDate.getTime())) {
    return {
      year: directDate.getFullYear(),
      month: directDate.getMonth() + 1,
      day: directDate.getDate(),
      normalized: `${directDate.getFullYear()}-${String(directDate.getMonth() + 1).padStart(2, "0")}-${String(directDate.getDate()).padStart(2, "0")}`,
    };
  }

  const dateMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    || raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!dateMatch) {
    return null;
  }

  let year;
  let month;
  let day;
  if (dateMatch[1].length === 4) {
    year = Number(dateMatch[1]);
    month = Number(dateMatch[2]);
    day = Number(dateMatch[3]);
  } else {
    month = Number(dateMatch[1]);
    day = Number(dateMatch[2]);
    year = Number(dateMatch[3]);
  }

  if (!year || !month || !day) {
    return null;
  }

  return {
    year,
    month,
    day,
    normalized: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function collectUniqueChangeEquipmentIds(poRows) {
  const uniqueIds = [];
  const seen = new Set();

  for (const row of Array.isArray(poRows) ? poRows : []) {
    const normalizedValue = String(row?.changeEquipmentId || "").trim();
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    uniqueIds.push(normalizedValue);
  }

  return uniqueIds;
}

function normalizeHeaderName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function exactTextRegex(value) {
  return new RegExp(`^\\s*${escapeRegExp(value)}\\s*$`, "i");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUploadFileName(body) {
  return String(body?.fileName || body?.filename || "").trim();
}

async function waitForAny(page, attempts) {
  const errors = [];
  const runners = attempts.map(async (attempt) => {
    try {
      return await attempt(page);
    } catch (error) {
      errors.push(error);
      throw error;
    }
  });

  try {
    return await Promise.any(runners);
  } catch (error) {
    throw errors[errors.length - 1] || error || new Error("No expected page state was reached.");
  }
}

function isClosedTargetError(error) {
  const normalizedMessage = String(error?.message || error || "").toLowerCase();
  return normalizedMessage.includes("target page, context or browser has been closed")
    || normalizedMessage.includes("target closed")
    || normalizedMessage.includes("page has been closed")
    || normalizedMessage.includes("browser has been closed")
    || normalizedMessage.includes("context has been closed")
    || normalizedMessage.includes("page crashed");
}

function isTransientExecutionContextError(error) {
  const normalizedMessage = String(error?.message || error || "").toLowerCase();
  return normalizedMessage.includes("execution context was destroyed")
    || normalizedMessage.includes("cannot find context with specified id")
    || normalizedMessage.includes("most likely because of a navigation");
}

function trackBrowserLifecycle(page, context, browser) {
  const state = {
    pageClosed: false,
    pageCrashed: false,
    contextClosed: false,
    browserDisconnected: false,
    events: [],
  };

  const record = (type, details = {}) => {
    state.events.push({
      type,
      at: new Date().toISOString(),
      ...details,
    });
    if (state.events.length > 12) {
      state.events = state.events.slice(-12);
    }
  };

  page.on("close", () => {
    state.pageClosed = true;
    record("page-close", { url: safePageUrl(page) });
  });
  page.on("crash", () => {
    state.pageCrashed = true;
    record("page-crash");
  });
  context.on("close", () => {
    state.contextClosed = true;
    record("context-close");
  });
  browser?.on("disconnected", () => {
    state.browserDisconnected = true;
    record("browser-disconnected");
  });

  return state;
}

function hasPageLifecycleEnded(page, lifecycle) {
  return Boolean(
    !page
    || page.isClosed()
    || lifecycle?.pageClosed
    || lifecycle?.pageCrashed
    || lifecycle?.contextClosed
    || lifecycle?.browserDisconnected,
  );
}

function describeLifecycleEvents(lifecycle) {
  const lastEvent = Array.isArray(lifecycle?.events) ? lifecycle.events[lifecycle.events.length - 1] : null;
  if (!lastEvent?.type) {
    return "";
  }

  return `Last lifecycle event: ${lastEvent.type} at ${lastEvent.at}.`;
}

function resolveShippingAutomationBadgeTitle(options = {}) {
  const shipping2BulkType = String(options?.shipping2BulkType || "").trim();
  if (shipping2BulkType === "released") {
    return "Shipping2 Released Bulk 自动化";
  }
  if (shipping2BulkType === "unreleased") {
    return "Shipping2 Unreleased Bulk 自动化";
  }

  if (options?.shouldFillPoNumbers) {
    return isAssignEquipmentShipmentScanAction(options?.shipmentScanAction)
      ? "万代 Shipping 自动化"
      : "新龙泰 Shipping 自动化";
  }

  if (options?.targetPage === "event-management") {
    return "Infor Nexus Event Management 自动化";
  }

  if (options?.targetPage === "home") {
    return "Infor Nexus 登录自动化";
  }

  return "Infor Nexus Shipment Scan 自动化";
}

async function showAutomationBadge(target, options = {}) {
  if (!target || typeof target.evaluate !== "function") {
    return;
  }

  const targets = [target];
  if (typeof target.frames === "function") {
    targets.push(...target.frames());
  }

  const uniqueTargets = Array.from(new Set(targets)).filter(
    (item) => item && typeof item.evaluate === "function",
  );
  const payload = {
    id: "tos-browser-automation-status-badge",
    title: String(options?.title || "TOS 浏览器自动化"),
    message: String(options?.message || "自动化正在执行"),
    details: normalizeAutomationBadgeDetails(options?.details),
  };

  await Promise.allSettled(uniqueTargets.map((item) => injectAutomationBadge(item, payload)));
}

function normalizeAutomationBadgeDetails(details = {}) {
  const normalized = {
    phase: String(details?.phase || ""),
    inputFileName: String(details?.inputFileName || ""),
    selectedAction: String(details?.selectedAction || ""),
    poNo: String(details?.poNo || ""),
    changeEquipmentId: String(details?.changeEquipmentId || ""),
    id: String(details?.id || ""),
    failedStep: String(details?.failedStep || ""),
    currentCount: Number(details?.currentCount || 0),
    completedCount: Number(details?.completedCount || 0),
    failedCount: Number(details?.failedCount || 0),
    totalCount: Number(details?.totalCount || 0),
  };

  if (Array.isArray(details?.poNos)) {
    normalized.poNos = details.poNos
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 4);
  } else {
    normalized.poNos = [];
  }

  return normalized;
}

async function injectAutomationBadge(target, payload) {
  await target.evaluate(({ id, title, message, details }) => {
    const asText = (value) => String(value || "").trim();
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement("div");
      root.id = id;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("data-tos-browser-automation-badge", "true");
      root.style.cssText = [
        "position:fixed",
        "left:18px",
        "top:18px",
        "z-index:2147483647",
        "width:320px",
        "max-width:calc(100vw - 36px)",
        "box-sizing:border-box",
        "padding:10px 12px",
        "border:2px solid #0ea5e9",
        "border-radius:8px",
        "background:#f8fafc",
        "color:#0f172a",
        "box-shadow:0 12px 32px rgba(15,23,42,.20)",
        "font-family:Segoe UI,Microsoft YaHei,Arial,sans-serif",
        "font-size:13px",
        "line-height:1.35",
        "pointer-events:none",
      ].join(";");

      const titleNode = document.createElement("div");
      titleNode.style.cssText = "display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:5px;";

      const dot = document.createElement("span");
      dot.setAttribute("data-tos-badge-dot", "true");
      dot.style.cssText = "width:8px;height:8px;border-radius:999px;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.14);flex:0 0 auto;";

      const titleText = document.createElement("span");
      titleText.setAttribute("data-tos-badge-title", "true");
      titleText.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      titleNode.append(dot, titleText);

      const messageNode = document.createElement("div");
      messageNode.setAttribute("data-tos-badge-message", "true");
      messageNode.style.cssText = "font-size:12px;color:#334155;word-break:break-word;";

      const metaNode = document.createElement("div");
      metaNode.setAttribute("data-tos-badge-meta", "true");
      metaNode.style.cssText = "margin-top:5px;font-size:11px;color:#0369a1;word-break:break-word;";

      root.append(titleNode, messageNode, metaNode);
      document.documentElement.appendChild(root);
    }

    const phase = asText(details?.phase);
    const failed = phase === "failed" || phase === "error";
    const businessEmpty = phase === "business-empty";
    const complete = phase === "complete" || phase.endsWith("-complete");
    root.style.borderColor = failed ? "#dc2626" : businessEmpty ? "#f59e0b" : complete ? "#059669" : "#0ea5e9";
    root.style.background = failed ? "#fef2f2" : businessEmpty ? "#fffbeb" : complete ? "#ecfdf5" : "#f8fafc";

    const dot = root.querySelector("[data-tos-badge-dot]");
    if (dot) {
      const color = failed ? "#ef4444" : businessEmpty ? "#f59e0b" : complete ? "#10b981" : "#0ea5e9";
      dot.style.background = color;
      dot.style.boxShadow = failed
        ? "0 0 0 5px rgba(239,68,68,.14)"
        : businessEmpty
          ? "0 0 0 5px rgba(245,158,11,.18)"
          : complete
            ? "0 0 0 5px rgba(16,185,129,.14)"
            : "0 0 0 5px rgba(14,165,233,.16)";
    }

    const titleNode = root.querySelector("[data-tos-badge-title]");
    if (titleNode) {
      titleNode.textContent = asText(title) || "TOS 浏览器自动化";
    }

    const messageNode = root.querySelector("[data-tos-badge-message]");
    if (messageNode) {
      messageNode.textContent = asText(message) || "自动化正在执行";
    }

    const metaNode = root.querySelector("[data-tos-badge-meta]");
    if (metaNode) {
      const parts = [];
      const current = Number(details?.currentCount || 0);
      const completed = Number(details?.completedCount || 0);
      const total = Number(details?.totalCount || 0);
      const failedCount = Number(details?.failedCount || 0);
      const poNo = asText(details?.poNo);
      const changeEquipmentId = asText(details?.changeEquipmentId);
      const idValue = asText(details?.id);
      const selectedAction = asText(details?.selectedAction);
      const failedStep = asText(details?.failedStep);
      const fileName = asText(details?.inputFileName);
      const poNos = Array.isArray(details?.poNos) ? details.poNos.map(asText).filter(Boolean) : [];

      if (current > 0 && total > 0) parts.push(`${current}/${total}`);
      else if (completed > 0 && total > 0) parts.push(`完成 ${completed}/${total}`);
      else if (total > 0) parts.push(`共 ${total}`);
      if (failedCount > 0) parts.push(`失败 ${failedCount}`);
      if (poNo) parts.push(`PO ${poNo}`);
      if (changeEquipmentId) parts.push(`设备 ${changeEquipmentId}`);
      if (idValue) parts.push(`ID ${idValue}`);
      if (poNos.length > 0) parts.push(`PO ${poNos.join(", ")}`);
      if (selectedAction) parts.push(selectedAction);
      if (failedStep) parts.push(failedStep);
      if (fileName) parts.push(fileName.slice(0, 48));

      metaNode.textContent = parts.join(" · ");
      metaNode.style.display = parts.length > 0 ? "block" : "none";
    }
  }, payload).catch(() => {});
}

function normalizeRunError(error, page, lifecycle, fallbackMessage) {
  if (isClosedTargetError(error) || hasPageLifecycleEnded(page, lifecycle)) {
    const lifecycleMessage = describeLifecycleEvents(lifecycle);
    return new Error(
      [fallbackMessage, lifecycleMessage].filter(Boolean).join(" "),
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

function safePageUrl(page) {
  try {
    return page?.url?.() || "";
  } catch {
    return "";
  }
}

async function safePageTitle(page) {
  if (!page || page.isClosed()) {
    return "";
  }

  return page.title().catch(() => "");
}

function authorize(req, body) {
  if (!config.token) return;

  const headerToken = req.headers["x-executor-token"];
  const bodyToken = body?.token;
  if (headerToken === config.token || bodyToken === config.token) {
    return;
  }

  const error = new Error("Unauthorized executor request.");
  error.statusCode = 401;
  throw error;
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Executor-Token");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function trySendArtifactDownload(requestPath, res) {
  const artifactEntry = resolveArtifactDownload(requestPath);
  if (!artifactEntry) {
    return false;
  }

  if (!existsSync(artifactEntry.filePath)) {
    sendJson(res, 404, {
      ok: false,
      message: "Requested artifact does not exist yet.",
      path: requestPath,
    });
    return true;
  }

  const buffer = await readFile(artifactEntry.filePath);
  res.writeHead(200, {
    "Content-Type": artifactEntry.contentType,
    "Content-Disposition": `attachment; filename="${artifactEntry.downloadName}"`,
    "Cache-Control": "no-store",
  });
  res.end(buffer);
  return true;
}

function resolveArtifactDownload(requestPath) {
  const normalizedPath = String(requestPath || "");
  const artifactMap = {
    "/artifacts/last-result.json": {
      filePath: path.join(artifactsDir, "last-result.json"),
      contentType: "application/json; charset=utf-8",
      downloadName: "shipping-last-result.json",
    },
    "/api/artifacts/last-result.json": {
      filePath: path.join(artifactsDir, "last-result.json"),
      contentType: "application/json; charset=utf-8",
      downloadName: "shipping-last-result.json",
    },
    "/artifacts/last-result.xlsx": {
      filePath: path.join(artifactsDir, "last-result.xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadName: "shipping-last-result.xlsx",
    },
    "/api/artifacts/last-result.xlsx": {
      filePath: path.join(artifactsDir, "last-result.xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadName: "shipping-last-result.xlsx",
    },
    "/artifacts/last-failed-po-rows.json": {
      filePath: path.join(artifactsDir, "last-failed-po-rows.json"),
      contentType: "application/json; charset=utf-8",
      downloadName: "shipping-last-failed-po-rows.json",
    },
    "/api/artifacts/last-failed-po-rows.json": {
      filePath: path.join(artifactsDir, "last-failed-po-rows.json"),
      contentType: "application/json; charset=utf-8",
      downloadName: "shipping-last-failed-po-rows.json",
    },
    "/artifacts/last-failed-po-rows.xlsx": {
      filePath: path.join(artifactsDir, "last-failed-po-rows.xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadName: "shipping-last-failed-po-rows.xlsx",
    },
    "/api/artifacts/last-failed-po-rows.xlsx": {
      filePath: path.join(artifactsDir, "last-failed-po-rows.xlsx"),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadName: "shipping-last-failed-po-rows.xlsx",
    },
  };

  if (artifactMap[normalizedPath]) {
    return artifactMap[normalizedPath];
  }

  const dynamicMatch = normalizedPath.match(/^\/(?:api\/)?artifacts\/([A-Za-z0-9._-]+\.(?:json|xlsx|png))$/);
  if (!dynamicMatch) {
    return null;
  }

  const downloadName = dynamicMatch[1];
  const filePath = path.resolve(artifactsDir, downloadName);
  if (!filePath.startsWith(path.resolve(artifactsDir) + path.sep)) {
    return null;
  }

  const ext = path.extname(downloadName).toLowerCase();
  const contentType = ext === ".xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : ext === ".png"
      ? "image/png"
      : "application/json; charset=utf-8";

  return {
    filePath,
    contentType,
    downloadName,
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function readJsonIfExists(filePath, fallbackValue) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallbackValue;
  }
}

async function shutdown() {
  await autoAddManualSessionManager.close("shutdown").catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  process.exit(0);
}

function log(message, payload) {
  if (payload === undefined) {
    console.log(`[shipping-automation] ${message}`);
    return;
  }
  console.log(`[shipping-automation] ${message}`, payload);
}
