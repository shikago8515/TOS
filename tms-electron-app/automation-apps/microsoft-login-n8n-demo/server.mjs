import http from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  createSapBtpLoginHandler,
  moduleDefinition as sapBtpLoginModule,
} from "./modules/sap-btp-login/index.mjs";
import {
  createTicketOwnerStatisticsHandler,
  moduleDefinition as ticketOwnerStatisticsModule,
} from "./modules/ticket-owner-statistics/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = __dirname;
const runtimeDataRoot = process.env.TMS_PLAYWRIGHT_DATA_DIR
  ? path.resolve(process.env.TMS_PLAYWRIGHT_DATA_DIR)
  : appRoot;
const bundledConfigPath = path.join(appRoot, "executor.config.json");
const runtimeConfigPath = path.join(runtimeDataRoot, "executor.config.local.json");
const artifactsDir = path.join(runtimeDataRoot, "run-artifacts");
const uploadPagePath = path.join(appRoot, "demo-upload.html");

const sharedExecutorRoot = resolveSharedExecutorRoot();
const sharedPackageJson = path.join(sharedExecutorRoot, "package.json");
const requireShared = createRequire(sharedPackageJson);
const { chromium, firefox, webkit } = requireShared("playwright");
const xlsx = requireShared("xlsx");

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

let activeRun = null;
let lastRun = null;

const moduleRouteHandlers = new Map();
const moduleDeps = {
  artifactsDir,
  authorize,
  extractRowsFromWorkbookPayload,
  getActiveRun: () => activeRun,
  normalizeRunOptions,
  normalizeUploadFileName,
  persistRunArtifacts,
  readJsonBody,
  runLogin,
  sendJson,
  setActiveRun: (run) => {
    activeRun = run;
  },
  updateActiveRun: (patch) => {
    if (!activeRun || !patch || typeof patch !== "object") {
      return;
    }
    const nextProgress = patch.progress && typeof patch.progress === "object"
      ? {
          ...(activeRun.progress && typeof activeRun.progress === "object" ? activeRun.progress : {}),
          ...patch.progress,
          updatedAt: new Date().toISOString(),
        }
      : activeRun.progress;
    activeRun = {
      ...activeRun,
      ...patch,
      ...(nextProgress ? { progress: nextProgress } : {}),
    };
  },
  setLastRun: (run) => {
    lastRun = run;
  },
  xlsx,
};

registerModuleRoutes(sapBtpLoginModule, createSapBtpLoginHandler(moduleDeps));
registerModuleRoutes(ticketOwnerStatisticsModule, createTicketOwnerStatisticsHandler(moduleDeps));

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);
    const requestPath = String(req.url || "/").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      await sendFile(res, uploadPagePath, "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && (req.url === "/health" || req.url === "/api/health")) {
      sendJson(res, 200, buildHealthPayload());
      return;
    }

    if (req.method === "GET") {
      const artifact = resolveArtifactDownload(requestPath);
      if (artifact) {
        await sendDownload(res, artifact);
        return;
      }
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

    const moduleHandler = moduleRouteHandlers.get(requestPath);
    if (req.method === "POST" && moduleHandler) {
      await moduleHandler(req, res);
      return;
    }

    if (req.method === "POST" && (req.url === "/run-login" || req.url === "/api/run-login")) {
      const body = await readJsonBody(req);
      authorize(req, body);

      if (activeRun) {
        sendJson(res, 409, {
          ok: false,
          message: "Executor is busy with another run.",
          activeRun,
        });
        return;
      }

      const rows = normalizeRows(body);
      const runOptions = normalizeRunOptions(body);
      activeRun = {
        startedAt: new Date().toISOString(),
        totalRows: rows.length,
        browser: runOptions.browser,
      };

      try {
        const result = await runLogin(rows, runOptions);
        result.artifacts = await persistRunArtifacts(result, rows);
        lastRun = {
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          loginSuccess: result.loginSuccess,
          uploadedRowCount: result.uploadedRowCount,
          finalUrl: result.finalUrl,
          searchedCaseCount: result.taskCenter?.searchedCaseCount ?? 0,
        };
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRun = null;
      }
      return;
    }

    sendJson(res, 404, {
      ok: false,
      message: "Not found",
      path: req.url,
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
  log(`Microsoft login executor listening on http://${config.host}:${config.port}`);
  log(`Visible browser mode: ${config.headless ? "off" : "on"}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

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
    host: String(merged.host || "0.0.0.0"),
    port: Number(process.env.TMS_PLAYWRIGHT_PORT || merged.port || 3002),
    token: String(merged.token || ""),
    loginUrl: String(merged.loginUrl || ""),
    browser: String(merged.browser || "chromium"),
    headless: Boolean(merged.headless),
    slowMo: Number(merged.slowMo ?? 120),
    navigationTimeoutMs: Number(merged.navigationTimeoutMs ?? 45000),
    postLoginWaitMs: Number(merged.postLoginWaitMs ?? 1200),
    staySignedInAction: String(merged.staySignedInAction || "no"),
    keepBrowserOpenOnErrorMs: Number(merged.keepBrowserOpenOnErrorMs ?? 120000),
    launchOptions: merged.launchOptions && typeof merged.launchOptions === "object"
      ? merged.launchOptions
      : {},
  };
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Executor-Token");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function sendFile(res, filePath, contentType) {
  const fileBuffer = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
  });
  res.end(fileBuffer);
}

async function sendDownload(res, artifact) {
  if (!existsSync(artifact.filePath)) {
    sendJson(res, 404, {
      ok: false,
      message: "Artifact file was not found.",
    });
    return;
  }

  const fileBuffer = await readFile(artifact.filePath);
  res.writeHead(200, {
    "Content-Type": artifact.contentType,
    "Content-Disposition": `attachment; filename="${String(artifact.downloadName || "artifact").replace(/"/g, "")}"`,
    "Cache-Control": "no-store",
  });
  res.end(fileBuffer);
}

function registerModuleRoutes(moduleDefinition, handler) {
  const routePaths = Array.isArray(moduleDefinition?.routePaths)
    ? moduleDefinition.routePaths
    : [];
  if (!routePaths.length) {
    throw new Error(`Automation module has no route paths: ${moduleDefinition?.id || "unknown"}`);
  }

  for (const routePath of routePaths) {
    moduleRouteHandlers.set(routePath, handler);
  }
}

async function persistRunArtifacts(result, rows) {
  await mkdir(artifactsDir, { recursive: true });

  const failedRows = extractFailedRowsForManualFollowUp(result, rows);
  const latestResultPath = path.join(artifactsDir, "last-result.json");
  const latestFailedJsonPath = path.join(artifactsDir, "last-failed-rows.json");
  const latestFailedCsvPath = path.join(artifactsDir, "last-failed-rows.csv");
  const latestFailedXlsxPath = path.join(artifactsDir, "last-failed-rows.xlsx");

  await writeFile(latestResultPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(latestFailedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writeFile(latestFailedCsvPath, toCsv(failedRows), "utf8");

  let xlsxExportError = "";
  try {
    await exportFailedRowsToXlsx(failedRows, latestFailedXlsxPath);
  } catch (error) {
    xlsxExportError = error.message || String(error);
    log("Failed rows XLSX export failed.", {
      latestFailedXlsxPath,
      error: xlsxExportError,
    });
  }

  return {
    latestResultPath,
    latestFailedJsonPath,
    latestFailedCsvPath,
    latestFailedXlsxPath: xlsxExportError ? "" : latestFailedXlsxPath,
    failedRowCount: failedRows.length,
    xlsxExportError,
  };
}

function resolveArtifactDownload(requestPath) {
  const normalizedPath = String(requestPath || "");
  const dynamicMatch = normalizedPath.match(/^\/(?:api\/)?artifacts\/([A-Za-z0-9._-]+\.(?:json|xlsx|csv|png))$/);
  if (!dynamicMatch) {
    return null;
  }

  const downloadName = dynamicMatch[1];
  const artifactRoot = path.resolve(artifactsDir);
  const filePath = path.resolve(artifactRoot, downloadName);
  if (!filePath.startsWith(artifactRoot + path.sep)) {
    return null;
  }

  const ext = path.extname(downloadName).toLowerCase();
  const contentType = ext === ".xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : ext === ".csv"
      ? "text/csv; charset=utf-8"
      : ext === ".png"
        ? "image/png"
        : "application/json; charset=utf-8";

  return {
    filePath,
    contentType,
    downloadName,
  };
}

function buildCredentialsPayload() {
  return {
    ok: false,
    hasStoredCredentials: false,
    username: "",
    message: "Executor credential storage has moved to the TOS backend database.",
  };
}

function extractFailedRowsForManualFollowUp(result, rows) {
  const uploadedRows = Array.isArray(rows) ? rows : [];
  const completeUploadedRows = uploadedRows
    .map((row, index) => ({
      rowIndex: index + 2,
      caseNumber: String(row?.["Case Number"] ?? "").trim(),
      po: normalizePoValue(row?.["PO"]),
      decision: normalizeDecisionValue(row?.["Decision"]),
      originalRow: row,
    }))
    .filter((entry) => entry.caseNumber && entry.po && entry.decision);

  const resolvedMap = new Map();
  const failedRows = [];

  const searchedCases = Array.isArray(result?.taskCenter?.searchedCases)
    ? result.taskCenter.searchedCases
    : [];

  for (const searchedCase of searchedCases) {
    const rowResults = Array.isArray(searchedCase?.rowResults) ? searchedCase.rowResults : [];
    for (const rowResult of rowResults) {
      const key = Number(rowResult?.rowIndex);
      if (!Number.isFinite(key)) {
        continue;
      }

      resolvedMap.set(key, rowResult);
      if (!rowResult.ok) {
        const sourceRow = completeUploadedRows.find((item) => item.rowIndex === key);
        failedRows.push({
          rowIndex: key,
          caseNumber: sourceRow?.caseNumber ?? searchedCase?.caseNumber ?? "",
          po: sourceRow?.po ?? rowResult?.po ?? "",
          decision: sourceRow?.decision ?? rowResult?.decision ?? "",
          reason: summarizeFailureReason(rowResult?.error || result?.message || "Automation failed."),
        });
      }
    }
  }

  for (const entry of completeUploadedRows) {
    if (resolvedMap.has(entry.rowIndex)) {
      continue;
    }

    failedRows.push({
      rowIndex: entry.rowIndex,
      caseNumber: entry.caseNumber,
      po: entry.po,
      decision: entry.decision,
      reason: summarizeFailureReason(
        result?.message || "This row was not completed by the automation run."
      ),
    });
  }

  return failedRows.sort((left, right) => left.rowIndex - right.rowIndex);
}

function toCsv(rows) {
  const headers = ["rowIndex", "caseNumber", "po", "decision", "reason"];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => csvEscape(row?.[header] ?? ""));
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function summarizeFailureReason(reason) {
  const text = String(reason ?? "").trim();
  if (!text) {
    return "Automation failed.";
  }

  const withoutFailedRows = text.split(" Failed rows:")[0].split(". Failed rows:")[0].trim();
  const withoutPreview = withoutFailedRows.split(" Preview:")[0].split(". Preview:")[0].trim();
  const withoutRootError = withoutPreview.split(" Root error:")[0].trim();
  const concise = withoutRootError || withoutPreview || withoutFailedRows || text;
  if (concise.length <= 220) {
    return concise;
  }

  return `${concise.slice(0, 217)}...`;
}

async function exportFailedRowsToXlsx(rows, outputXlsxPath) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const worksheet = xlsx.utils.json_to_sheet(normalizedRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Failed Rows");
  xlsx.writeFile(workbook, outputXlsxPath);
}

function authorize(req, body) {
  if (!config.token) return;

  const header = req.headers["x-executor-token"];
  const tokenFromHeader = Array.isArray(header) ? header[0] : header;
  const tokenFromBody = body?.token;

  if (tokenFromHeader === config.token || tokenFromBody === config.token) {
    return;
  }

  const error = new Error("Unauthorized executor request.");
  error.statusCode = 401;
  throw error;
}

function normalizeRows(body) {
  if (Array.isArray(body?.rows) && body.rows.length > 0) {
    return body.rows;
  }

  const error = new Error("rows must be a non-empty array.");
  error.statusCode = 400;
  throw error;
}

function extractRowsFromWorkbookPayload(body) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();
  if (!fileBase64) {
    const error = new Error("fileBase64 must be a non-empty base64 string.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");

  let workbookBuffer;
  try {
    workbookBuffer = Buffer.from(normalizedBase64, "base64");
  } catch {
    const error = new Error("fileBase64 is not valid base64 content.");
    error.statusCode = 400;
    throw error;
  }

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
  const rows = xlsx.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error("Uploaded workbook does not contain any data rows.");
    error.statusCode = 400;
    throw error;
  }

  return rows;
}

function resolveWorksheetName(workbook, preferredSheetName) {
  if (preferredSheetName && workbook?.SheetNames?.includes(preferredSheetName)) {
    return preferredSheetName;
  }

  return Array.isArray(workbook?.SheetNames) ? workbook.SheetNames[0] || "" : "";
}

function normalizeUploadFileName(body) {
  return String(body?.fileName || body?.filename || "").trim();
}

function normalizeCredentialValue(value, fallback) {
  const trimmed = String(value ?? "").trim();
  return trimmed || String(fallback || "");
}

function normalizeRunOptions(body) {
  const username = normalizeCredentialValue(body?.username, "");
  const password = normalizeCredentialValue(body?.password, "");
  if (!username || !password) {
    const error = new Error("请提供当前网站登录账号密码。");
    error.statusCode = 400;
    throw error;
  }

  return {
    browser: String(body?.browser || config.browser),
    loginUrl: String(body?.loginUrl || config.loginUrl),
    username,
    password,
    headless: toBoolean(body?.headless, config.headless),
    slowMo: toNumber(body?.slowMo, config.slowMo),
    navigationTimeoutMs: toNumber(body?.navigationTimeoutMs, config.navigationTimeoutMs),
    postLoginWaitMs: toNumber(body?.postLoginWaitMs, config.postLoginWaitMs),
    staySignedInAction: String(body?.staySignedInAction || config.staySignedInAction),
    showBrowserProgressOverlay: body?.showBrowserProgressOverlay !== false,
    keepBrowserOpenOnErrorMs: toNumber(
      body?.keepBrowserOpenOnErrorMs,
      config.keepBrowserOpenOnErrorMs
    ),
    launchOptions: {
      ...(config.launchOptions || {}),
      ...((body?.launchOptions && typeof body.launchOptions === "object")
        ? body.launchOptions
        : {}),
    },
  };
}

async function runLogin(rows, options) {
  const engine = browserEngines[options.browser] || chromium;
  const launchOptions = {
    headless: options.headless,
    slowMo: options.slowMo,
    ...options.launchOptions,
  };
  const browserLaunchOptions = buildVisibleBrowserLaunchOptions(launchOptions, options.browser);

  let browser;
  let context;
  let page;
  let runFailed = false;
  const workflowMode = String(options.workflowMode || "task-center-po-decisions");
  const workflowTitle = String(options.workflowLabel || (
    workflowMode === "ticket-owner-statistics"
      ? "统计 ticket 归属 自动化"
      : workflowMode === "login-only"
        ? "SAP BTP 登录自动化"
        : "SAP BTP PO Decision 自动化"
  ));
  const showRunBadge = async (message, details = {}) => {
    if (options.showBrowserProgressOverlay === false) {
      await removeAutomationBadge(page);
      return;
    }
    await showAutomationBadge(page, {
      title: workflowTitle,
      message,
      details: {
        phase: "sap-btp-login",
        workflowMode,
        totalCount: Array.isArray(rows) ? rows.length : 0,
        ...details,
      },
    });
  };

  try {
    browser = await engine.launch(browserLaunchOptions);
    context = await browser.newContext({
      viewport: null,
    });
    page = await context.newPage();
    page.setDefaultTimeout(options.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(options.navigationTimeoutMs);

    await showRunBadge("正在打开 Microsoft / SAP BTP 登录页", {
      phase: "open-login",
    });
    await page.goto(options.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.navigationTimeoutMs,
    });

    await showRunBadge("正在填写登录信息", {
      phase: "login",
    });
    await fillMicrosoftLogin(page, options.username, options.password, options);
    await showRunBadge("正在确认登录结果", {
      phase: "login-check",
    });

    if (options.postLoginWaitMs > 0) {
      const homeTileSelectors = [
        "#__tile32",
        "a[href*='taskcenter-display']",
        "text=Task Center",
      ];
      const homeTileReady = await waitForAny(
        page,
        homeTileSelectors,
        Math.min(options.postLoginWaitMs, 4000)
      ).then(() => true).catch(() => false);

      if (!homeTileReady) {
        await pageWait(page, options.postLoginWaitMs);
      }
    }

    const loginState = await capturePageState(page);
    const loginSuccess = detectLoginSuccess(loginState);

    let taskCenter = null;
    let workflowResult = null;
    if (loginSuccess && typeof options.afterLogin === "function") {
      await showRunBadge(`登录完成，正在执行 ${workflowTitle}`, {
        phase: "workflow",
      });
      workflowResult = await options.afterLogin(page, options);
    } else if (loginSuccess && workflowMode !== "login-only") {
      await showRunBadge("登录完成，正在执行 Task Center PO 处理", {
        phase: "task-center",
      });
      taskCenter = await runTaskCenterSearchFlow(page, rows, options, showRunBadge);
    } else if (!loginSuccess) {
      await showRunBadge("登录未到达确认成功状态，已记录页面状态", {
        phase: "failed",
      });
    }

    const finalState = await capturePageState(page);
    const workflowOk = workflowResult ? workflowResult.ok !== false : true;
    const finalOk = loginSuccess && workflowOk;
    await showRunBadge(
      finalOk ? `${workflowTitle} 已完成` : `${workflowTitle} 未完成，已记录状态`,
      {
        phase: finalOk ? "complete" : "failed",
        completedCount: taskCenter?.completedRowCount || 0,
        failedCount: taskCenter?.failedRowCount || 0,
        totalCount: Array.isArray(rows) ? rows.length : 0,
      },
    );
    return {
      ok: finalOk,
      loginSuccess,
      uploadedRowCount: rows.length,
      generatedAt: new Date().toISOString(),
      finalUrl: finalState.url,
      title: finalState.title,
      pageTextSnippet: finalState.pageTextSnippet,
      visibleError: finalState.visibleError,
      rowsPreview: rows.slice(0, 3),
      taskCenter,
      workflowResult,
      workflowMode,
      workflowLabel: options.workflowLabel || "",
      message: loginSuccess
        ? options.successMessage || "Microsoft login completed successfully."
        : "Microsoft login did not reach a confirmed signed-in state.",
    };
  } catch (error) {
    runFailed = true;
    await showRunBadge(`${workflowTitle} 执行失败，已记录错误信息`, {
      phase: "failed",
    });
    const finalState = await capturePageState(page);
    const loginSuccess = page ? detectLoginSuccess(finalState) : false;
    return {
      ok: false,
      loginSuccess,
      uploadedRowCount: rows.length,
      generatedAt: new Date().toISOString(),
      finalUrl: finalState.url,
      title: finalState.title,
      pageTextSnippet: finalState.pageTextSnippet,
      visibleError: finalState.visibleError,
      rowsPreview: rows.slice(0, 3),
      taskCenter: null,
      workflowResult: null,
      workflowMode: String(options.workflowMode || "task-center-po-decisions"),
      workflowLabel: options.workflowLabel || "",
      message: error.message || "Login run failed.",
    };
  } finally {
    if (runFailed) {
      const keepOpenMs = Math.max(0, Number(options.keepBrowserOpenOnErrorMs || 0));
      if (keepOpenMs > 0 && !isPageClosed(page)) {
        await page.bringToFront().catch(() => {});
        log("Keeping browser open after error for inspection.", {
          keepOpenMs,
          currentUrl: page?.url?.() || "",
          currentTitle: await safeTitle(page),
        });
        await pageWait(page, keepOpenMs);
      }
    }
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function fillMicrosoftLogin(page, username, password, options) {
  const signedInSelectors = [
    "#__tile32",
    "a[href*='taskcenter-display']",
    "[id*='inboxTable']",
    "text=Task Center",
  ];
  const microsoftEmailSelectors = ["input[name='loginfmt']"];
  const microsoftPasswordSelectors = ["input[name='passwd']"];
  const adidasEmailSelectors = [
    "input[type='email']",
    "input[placeholder*='example.com']",
    "input[placeholder*='someone']",
    "input[name='username']",
    "input[name='login']",
    "input[id*='user']",
  ];
  const adidasPasswordSelectors = [
    "input[type='password']",
    "input[name='password']",
    "input[id*='password']",
  ];

  await waitForAny(page, [
    ...microsoftEmailSelectors,
    ...microsoftPasswordSelectors,
    ...adidasEmailSelectors,
    ...adidasPasswordSelectors,
    "#idRichContext_DisplaySign",
    "#KmsiDescription",
    "#idBtn_Back",
    ...signedInSelectors,
  ], options.navigationTimeoutMs);

  await handleStaySignedInPrompt(page, options);

  if (
    await anyVisible(page, signedInSelectors) &&
    !await anyVisible(page, [
      ...microsoftEmailSelectors,
      ...microsoftPasswordSelectors,
      ...adidasEmailSelectors,
      ...adidasPasswordSelectors,
    ])
  ) {
    return;
  }

  await fillAdidasLoginIfPresent(page, username, password, options, {
    signedInSelectors,
    emailSelectors: adidasEmailSelectors,
    passwordSelectors: adidasPasswordSelectors,
  });

  if (await isVisible(page, "input[name='loginfmt']")) {
    await page.fill("input[name='loginfmt']", username);
    await clickFirstVisible(page, ["#idSIButton9", "input[type='submit']"]);
    await retryTransientAccountLookup(page);
  }

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await waitForAny(page, [
    "input[name='passwd']",
    ...adidasPasswordSelectors,
    "#passwordError",
    "#usernameError",
    "#idRichContext_DisplaySign",
    "#KmsiDescription",
    "#idBtn_Back",
    ...signedInSelectors,
  ], options.navigationTimeoutMs);

  await handleStaySignedInPrompt(page, options);

  await fillAdidasLoginIfPresent(page, username, password, options, {
    signedInSelectors,
    emailSelectors: adidasEmailSelectors,
    passwordSelectors: adidasPasswordSelectors,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!(await isVisible(page, "input[name='passwd']"))) {
      break;
    }

    await page.fill("input[name='passwd']", password);
    await clickFirstVisible(page, ["#idSIButton9", "input[type='submit']"]);
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await pageWait(page, 400);

    const stillOnPasswordPage = await isVisible(page, "input[name='passwd']");
    const kmsiVisible = await isVisible(page, "#KmsiDescription");
    if (!stillOnPasswordPage || kmsiVisible) {
      break;
    }
  }

  await handleStaySignedInPrompt(page, options);

  if (await isVisible(page, "input[name='otc']") || await isVisible(page, "#idTxtBx_SAOTCC_OTC")) {
    const error = new Error("Additional verification is required on this account.");
    error.statusCode = 409;
    throw error;
  }

  await waitFor(async () => {
    return (
      !page.url().includes("login.microsoftonline.com") ||
      (await anyVisible(page, [
        "#__tile32",
        "a[href*='taskcenter-display']",
        "text=Task Center",
      ]))
    );
  }, Math.min(options.navigationTimeoutMs, 12000), 250).catch(() => {});
}

async function handleStaySignedInPrompt(page, options) {
  if (!await anyVisible(page, ["#KmsiDescription", "#idBtn_Back", "text=保持登录状态"])) {
    return false;
  }

  if (options.staySignedInAction === "yes") {
    await clickFirstVisible(page, ["#idSIButton9", "input[value='是']", "button:has-text(\"是\")"]);
  } else {
    await clickFirstVisible(page, ["#idBtn_Back", "input[value='否']", "button:has-text(\"否\")"]);
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await pageWait(page, 800);
  return true;
}

async function fillAdidasLoginIfPresent(page, username, password, options, selectors) {
  const emailSelectors = selectors?.emailSelectors || [];
  const passwordSelectors = selectors?.passwordSelectors || [];
  const signedInSelectors = selectors?.signedInSelectors || [];
  const nextButtonSelectors = [
    "button:has-text(\"下一步\")",
    "button:has-text(\"Next\")",
    "input[type='submit']",
    "button[type='submit']",
  ];
  const submitButtonSelectors = [
    "button:has-text(\"登录\")",
    "button:has-text(\"Sign in\")",
    "button:has-text(\"Log in\")",
    "button:has-text(\"下一步\")",
    "button:has-text(\"Next\")",
    "input[type='submit']",
    "button[type='submit']",
  ];
  let handled = false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await anyVisible(page, signedInSelectors)) {
      return handled;
    }

    const email = await firstVisibleTarget(page, emailSelectors);
    if (email) {
      await email.target.locator(email.selector).first().fill(username);
      await clickFirstVisible(page, nextButtonSelectors).catch(async () => {
        await page.keyboard.press("Enter").catch(() => {});
      });
      handled = true;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await pageWait(page, 800);
      continue;
    }

    const passwordInput = await firstVisibleTarget(page, passwordSelectors);
    if (passwordInput) {
      await passwordInput.target.locator(passwordInput.selector).first().fill(password);
      await clickFirstVisible(page, submitButtonSelectors).catch(async () => {
        await page.keyboard.press("Enter").catch(() => {});
      });
      handled = true;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await pageWait(page, 1000);
      continue;
    }

    break;
  }

  if (handled) {
    await waitFor(async () => {
      return (
        await anyVisible(page, signedInSelectors) ||
        await anyVisible(page, ["input[name='loginfmt']", "input[name='passwd']"]) ||
        !await anyVisible(page, [...emailSelectors, ...passwordSelectors])
      );
    }, Math.min(options.navigationTimeoutMs, 12000), 250).catch(() => {});
  }

  return handled;
}

async function retryTransientAccountLookup(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await pageWait(page, 350);

  if (await isVisible(page, "input[name='passwd']")) {
    return;
  }

  const nextVisible = await isVisible(page, "#idSIButton9");
  const loginfmtVisible = await isVisible(page, "input[name='loginfmt']");
  const stillOnLoginDomain = page.url().includes("login.microsoftonline.com");

  if (nextVisible && loginfmtVisible && stillOnLoginDomain) {
    await page.locator("#idSIButton9").first().click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});
  }
}

function detectLoginSuccess(pageState) {
  if (!pageState) return false;

  const loweredTitle = pageState.title.toLowerCase();
  const loweredSnippet = pageState.pageTextSnippet.toLowerCase();

  if (pageState.emailVisible || pageState.passwordVisible || pageState.mfaVisible) {
    return false;
  }

  if (
    loweredTitle.includes("error") ||
    loweredSnippet.includes("error") ||
    loweredSnippet.includes("something went wrong") ||
    loweredSnippet.includes("configuration error")
  ) {
    return false;
  }

  return !pageState.url.includes("login.microsoftonline.com");
}

async function runTaskCenterSearchFlow(page, rows, options, showRunBadge = async () => {}) {
  const caseEntries = rows
    .map((row, index) => ({
      rowIndex: index + 2,
      caseNumber: String(row?.["Case Number"] ?? "").trim(),
      po: normalizePoValue(row?.["PO"]),
      decision: normalizeDecisionValue(row?.["Decision"]),
    }))
    .filter((entry) => entry.caseNumber && entry.po && entry.decision)
    .sort(compareCaseEntryExecutionOrder);

  if (caseEntries.length === 0) {
    throw new Error("No complete rows with 'Case Number', 'PO', and 'Decision' were found in the uploaded Excel data.");
  }

  const caseGroups = [];
  const groupedEntries = new Map();
  for (const entry of caseEntries) {
    if (!groupedEntries.has(entry.caseNumber)) {
      groupedEntries.set(entry.caseNumber, []);
      caseGroups.push({
        caseNumber: entry.caseNumber,
        entries: groupedEntries.get(entry.caseNumber),
      });
    }
    groupedEntries.get(entry.caseNumber).push(entry);
  }

  await showRunBadge("正在打开 Task Center", {
    phase: "open-task-center",
    totalCount: caseEntries.length,
  });
  await openTaskCenter(page, options.navigationTimeoutMs);
  const selectedTaskTypes = await configureTaskCenterFilter(page);
  await showRunBadge("Task Center 已就绪，正在准备搜索 Case", {
    phase: "task-center-ready",
    totalCount: caseEntries.length,
  });
  const taskCenterUrl = page.url();

  const searchedCases = [];
  let completedRowCount = 0;
  let failedRowCount = 0;
  for (let index = 0; index < caseGroups.length; index += 1) {
    const group = caseGroups[index];
    await showRunBadge(`正在搜索 Case ${group.caseNumber}`, {
      phase: "case-search",
      caseNumber: group.caseNumber,
      currentCount: index + 1,
      totalCount: caseGroups.length,
    });
    const searchResult = await searchCaseNumber(page, group.caseNumber);
    let openInAppRun = await openInAppFromSearchResults(page, group.caseNumber, options.navigationTimeoutMs);
    await showRunBadge(`Case ${group.caseNumber} 已打开 Open in App`, {
      phase: "open-in-app",
      caseNumber: group.caseNumber,
      currentCount: index + 1,
      totalCount: caseGroups.length,
    });
    const orderedEntries = sortCaseGroupEntriesForExecution(group.entries);
    const rowResults = [];

    for (let rowIndex = 0; rowIndex < orderedEntries.length; rowIndex += 1) {
      const entry = orderedEntries[rowIndex];
      try {
        await showRunBadge(`正在处理 Case ${group.caseNumber} / PO ${entry.po}`, {
          phase: "po-processing",
          caseNumber: group.caseNumber,
          po: entry.po,
          decision: entry.decision,
          currentCount: completedRowCount + failedRowCount + 1,
          totalCount: caseEntries.length,
        });
        await showAutomationBadge(openInAppRun.appPage, {
          title: "SAP BTP PO Decision 自动化",
          message: `正在处理 Case ${group.caseNumber} / PO ${entry.po}`,
          details: {
            phase: "po-processing",
            caseNumber: group.caseNumber,
            po: entry.po,
            decision: entry.decision,
            currentCount: completedRowCount + failedRowCount + 1,
            totalCount: caseEntries.length,
          },
        });
        const processed = await processPoEntryWithRecovery(
          page,
          openInAppRun,
          group.caseNumber,
          entry,
          options.navigationTimeoutMs,
          { restartAtTop: rowIndex === 0 }
        );
        openInAppRun = processed.openInAppRun;
        rowResults.push({
          rowIndex: entry.rowIndex,
          po: entry.po,
          decision: entry.decision,
          ok: true,
          poDecision: processed.poDecision,
          recoveredVia: processed.recoveredVia,
        });
        completedRowCount += 1;
        await showAutomationBadge(openInAppRun.appPage, {
          title: "SAP BTP PO Decision 自动化",
          message: `PO ${entry.po} 已完成`,
          details: {
            phase: "po-complete",
            caseNumber: group.caseNumber,
            po: entry.po,
            decision: entry.decision,
            completedCount: completedRowCount,
            failedCount: failedRowCount,
            totalCount: caseEntries.length,
          },
        });
      } catch (error) {
        log("PO processing failed after all recovery attempts.", {
          caseNumber: group.caseNumber,
          po: entry.po,
          decision: entry.decision,
          error: error.message || "PO processing failed.",
        });
        rowResults.push({
          rowIndex: entry.rowIndex,
          po: entry.po,
          decision: entry.decision,
          ok: false,
          error: error.message || "PO processing failed.",
        });
        failedRowCount += 1;
        await showAutomationBadge(openInAppRun.appPage, {
          title: "SAP BTP PO Decision 自动化",
          message: `PO ${entry.po} 处理失败，已记录`,
          details: {
            phase: "failed",
            caseNumber: group.caseNumber,
            po: entry.po,
            decision: entry.decision,
            completedCount: completedRowCount,
            failedCount: failedRowCount,
            totalCount: caseEntries.length,
          },
        });
      }
      await showRunBadge(`Task Center PO 进度 ${completedRowCount + failedRowCount}/${caseEntries.length}`, {
        phase: failedRowCount > 0 ? "failed" : "po-progress",
        caseNumber: group.caseNumber,
        completedCount: completedRowCount,
        failedCount: failedRowCount,
        currentCount: completedRowCount + failedRowCount,
        totalCount: caseEntries.length,
      });
    }

    const hasFailedRows = rowResults.some((rowResult) => !rowResult.ok);
    let saveResult = {
      clicked: false,
      skipped: true,
      reason: hasFailedRows
        ? `Case Number ${group.caseNumber} has failed PO rows, so Save was skipped.`
        : "No PO rows were processed for this Case Number.",
    };

    if (!hasFailedRows && rowResults.length > 0) {
      await showAutomationBadge(openInAppRun.appPage, {
        title: "SAP BTP PO Decision 自动化",
        message: `Case ${group.caseNumber} 已处理，正在 Save`,
        details: {
          phase: "save",
          caseNumber: group.caseNumber,
          completedCount: completedRowCount,
          failedCount: failedRowCount,
          totalCount: caseEntries.length,
        },
      });
      saveResult = await saveOpenInAppChanges(openInAppRun.appPage, options.navigationTimeoutMs);
      await showAutomationBadge(openInAppRun.appPage, {
        title: "SAP BTP PO Decision 自动化",
        message: `Case ${group.caseNumber} 已 Save`,
        details: {
          phase: "case-complete",
          caseNumber: group.caseNumber,
          completedCount: completedRowCount,
          failedCount: failedRowCount,
          totalCount: caseEntries.length,
        },
      });
    }

    searchedCases.push({
      ...searchResult,
      openInApp: openInAppRun.summary,
      rowResults,
      saveResult,
    });

    if (hasFailedRows) {
      const failedRows = rowResults
        .filter((rowResult) => !rowResult.ok)
        .map((rowResult) => ({
          rowIndex: rowResult.rowIndex,
          po: rowResult.po,
          decision: rowResult.decision,
          error: rowResult.error,
        }))
        .slice(0, 3);
      throw new Error(`Case Number ${group.caseNumber} was not fully processed, so Save was not clicked. Failed rows: ${JSON.stringify(failedRows)}`);
    }

    if (index < caseGroups.length - 1) {
      await restoreTaskCenterAfterOpen(page, openInAppRun, taskCenterUrl, options.navigationTimeoutMs);
    }
  }

  await showRunBadge("Task Center PO 处理已完成", {
    phase: failedRowCount > 0 ? "failed" : "complete",
    completedCount: completedRowCount,
    failedCount: failedRowCount,
    currentCount: completedRowCount + failedRowCount,
    totalCount: caseEntries.length,
  });

  return {
    taskCenterOpened: true,
    selectedTaskTypes,
    searchedCaseCount: caseEntries.length,
    searchedCaseGroupCount: caseGroups.length,
    completedRowCount,
    failedRowCount,
    searchedCases,
    finalTaskCenterUrl: page.url(),
  };
}

async function openTaskCenter(page, timeoutMs) {
  const tileSelectors = [
    "#__tile32",
    "a[href*='taskcenter-display']",
    "text=Task Center",
  ];

  if (page.url().includes("taskcenter-display")) {
    await waitForTaskCenterReady(page, timeoutMs);
    return;
  }

  await waitForAny(page, tileSelectors, timeoutMs);
  await clickFirstVisible(page, tileSelectors);

  await waitFor(async () => {
    return page.url().includes("taskcenter-display") || await anyVisible(page, [
      "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
      "#application-taskcenter-display-component---inboxTable--searchField-I",
      "[id$='taskDefinitionFilter-arrow']",
      "[id$='searchField-I']",
    ]);
  }, timeoutMs, 200);
  await waitForTaskCenterReady(page, timeoutMs);
}

async function configureTaskCenterFilter(page) {
  const filterArrowSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
    "[id$='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter'] .sapMInputBaseIcon",
  ];
  const filterFieldSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter",
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-inner",
    "[id$='taskDefinitionFilter']",
    "[id$='taskDefinitionFilter-inner']",
    "[id*='taskDefinitionFilter'] input[role='combobox']",
    "input[name='taskDefinition']",
  ];
  const searchInputSelectors = [
    "#application-taskcenter-display-component---inboxTable--searchField-I",
    "[id$='searchField-I']",
    "[id*='inboxTable--searchField-I']",
    "input[type='search'][placeholder*='Task Title']",
    "input[type='search'][aria-label*='Task Title']",
  ];
  const goButtonSelectors = [
    "#application-taskcenter-display-component---worklist--filterBar-btnGo",
    "[id$='filterBar-btnGo']",
    "button:has-text(\"Go\")",
  ];

  try {
    await waitForAny(page, [...filterArrowSelectors, ...filterFieldSelectors, ...searchInputSelectors], 60000);
  } catch (error) {
    const debugInfo = await collectTaskCenterDebug(page);
    error.message = `${error.message}. Debug: ${JSON.stringify(debugInfo)}`;
    throw error;
  }

  if (await anyVisible(page, filterArrowSelectors)) {
    await clickFirstVisible(page, filterArrowSelectors);
  } else if (await anyVisible(page, filterFieldSelectors)) {
    const filterFieldTarget = await firstVisibleTarget(page, filterFieldSelectors);
    await filterFieldTarget.target.locator(filterFieldTarget.selector).first().click();
    await page.keyboard.press("Alt+ArrowDown").catch(() => {});
  } else {
    const debugInfo = await collectTaskCenterDebug(page);
    throw new Error(`Task definition filter field did not become visible. Debug: ${JSON.stringify(debugInfo)}`);
  }

  const selectedTaskTypes = await selectTaskTypeOptions(page);

  await page.keyboard.press("Escape").catch(() => {});
  if (await anyVisible(page, goButtonSelectors)) {
    await clickFirstVisible(page, goButtonSelectors);
    await pageWait(page, 450);
  }

  const searchInputTarget = await firstVisibleTarget(page, searchInputSelectors);
  if (searchInputTarget) {
    await searchInputTarget.target.locator(searchInputTarget.selector).first().click();
  }
  await pageWait(page, 250);
  return selectedTaskTypes;
}

async function selectTaskTypeOptions(page) {
  const popupListSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-popup-list-listUl",
    "[id$='taskDefinitionFilter-popup-list-listUl']",
    "ul[role='listbox'][aria-multiselectable='true'].sapMListUl",
  ];
  const preferredOptionGroups = [
    ["Proceed with Request"],
    ["Review Sub-Ticket Resolution"],
  ];

  await openTaskTypePopup(page, popupListSelectors);

  let selectedOptionTexts = [];
  try {
    for (const optionGroup of preferredOptionGroups) {
      const selectedOptionText = await selectPreferredTaskTypeOption(page, optionGroup);
      selectedOptionTexts.push(selectedOptionText);
    }
  } catch (error) {
    log("Falling back to the last two Task Type options.", {
      reason: error.message,
    });
    selectedOptionTexts = await selectLastTaskTypeOptions(page, 2);
  }

  const verification = [];
  for (const optionText of selectedOptionTexts) {
    verification.push({
      optionText,
      selected: await isTaskTypeOptionSelectedByText(page, optionText),
    });
  }

  if (verification.every((item) => item.selected)) {
  return verification.filter((item) => item.selected).map((item) => item.optionText);
}

throw new Error(`Not all Task Type options were selected. Verification: ${JSON.stringify(verification)}`);
}

async function selectPreferredTaskTypeOption(page, optionTexts) {
  for (const optionText of optionTexts) {
    const selected = await ensureTaskTypeOptionSelectedByText(page, optionText).then(() => true).catch(() => false);
    if (selected) {
      return optionText;
    }
  }

  const debugInfo = await collectTaskTypeDebug(page);
  throw new Error(`None of the preferred Task Type options could be selected: ${optionTexts.join(", ")}. Debug: ${JSON.stringify(debugInfo)}`);
}

async function selectLastTaskTypeOptions(page, count) {
  const optionTexts = await collectVisibleTaskTypeOptionTexts(page);
  const fallbackTexts = optionTexts.slice(-count);

  if (fallbackTexts.length < count) {
    const debugInfo = await collectTaskTypeDebug(page);
    throw new Error(`Not enough Task Type options were visible for fallback selection. Debug: ${JSON.stringify(debugInfo)}`);
  }

  for (const optionText of fallbackTexts) {
    await ensureTaskTypeOptionSelectedByText(page, optionText);
  }

  return fallbackTexts;
}

async function openInAppFromSearchResults(page, caseNumber, timeoutMs) {
  const actionMenuButtonSelectors = [
    "button[id*='responseOptionsButtonMenu'][id$='-arrowButton']",
    "[id*='responseOptionsButtonMenu'] button[aria-label='Open Menu']",
    "button[title='Open Menu'][aria-haspopup='menu']",
    "button[aria-label='Open Menu'][aria-haspopup='menu']",
  ];
  const openInAppMenuItemSelectors = [
    "li.sapMMenuItem:has-text(\"Open in App\")",
    "[role='menuitem']:has-text(\"Open in App\")",
    ".sapMMenuItemText:text-is(\"Open in App\")",
    "li.sapMMenuItem:has-text(\"Open\")",
    "[role='menuitem']:has-text(\"Open\")",
  ];

  await waitForNoBlockingLayer(page, Math.min(timeoutMs, 12000));
  await waitForAny(page, actionMenuButtonSelectors, timeoutMs);
  let menuReady = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForNoBlockingLayer(page, Math.min(timeoutMs, 12000));
    await clickFirstVisible(page, actionMenuButtonSelectors);
    menuReady = await waitForAny(page, openInAppMenuItemSelectors, 6000).then(() => true).catch(() => false);
    if (menuReady) {
      break;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await pageWait(page, 250);
  }

  const context = page.context();
  const openInAppTarget = await firstVisibleTarget(page, openInAppMenuItemSelectors);
  if (!openInAppTarget) {
    const debugInfo = await collectOpenInAppMenuDebug(page);
    throw new Error(`Open in App menu item did not become visible. Debug: ${JSON.stringify(debugInfo)}`);
  }

  const optionRoot = await resolveMenuItemRoot(openInAppTarget.target, openInAppTarget.selector);
  const beforeUrl = page.url();
  const beforePages = context.pages().filter((candidate) => !candidate.isClosed());
  log("Clicking Open in App.", {
    caseNumber,
    beforeUrl,
    contextPages: beforePages.map((candidate) => candidate.url()),
  });
  await optionRoot.click();

  const resolvedOpen = await waitForOpenInAppTarget(page, beforePages, beforeUrl, timeoutMs);
  log("Open in App target resolved.", {
    caseNumber,
    openedIn: resolvedOpen.openedIn,
    finalUrl: resolvedOpen.appPage.url(),
    contextPages: context.pages().filter((candidate) => !candidate.isClosed()).map((candidate) => candidate.url()),
  });

  await resolvedOpen.appPage.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => {});
  await waitForOpenInAppReady(resolvedOpen.appPage, timeoutMs);
  await showAutomationBadge(resolvedOpen.appPage, {
    title: "SAP BTP PO Decision 自动化",
    message: `Case ${caseNumber} 的 Open in App 页面已打开`,
    details: {
      phase: "open-in-app",
      caseNumber,
    },
  });

  if (resolvedOpen.openedIn === "popup") {
    const summary = {
      caseNumber,
      selectedAction: "Open in App",
      openedIn: "popup",
      finalUrl: resolvedOpen.appPage.url(),
      title: await safeTitle(resolvedOpen.appPage),
      pageTextSnippet: await readBodySnippet(resolvedOpen.appPage),
    };
    return {
      summary,
      appPage: resolvedOpen.appPage,
      openedIn: "popup",
    };
  }

  const openedIn = resolvedOpen.appPage.url() !== beforeUrl ? "same_page_navigation" : "same_page";
  const summary = {
    caseNumber,
    selectedAction: "Open in App",
    openedIn,
    finalUrl: resolvedOpen.appPage.url(),
    title: await safeTitle(resolvedOpen.appPage),
    pageTextSnippet: await readBodySnippet(resolvedOpen.appPage),
  };
  return {
    summary,
    appPage: resolvedOpen.appPage,
    openedIn,
  };
}

async function waitForOpenInAppTarget(page, beforePages, beforeUrl, timeoutMs) {
  const context = page.context();
  const start = Date.now();
  while (Date.now() - start < Math.min(timeoutMs, 25000)) {
    const livePages = context.pages().filter((candidate) => !candidate.isClosed());
    const popupCandidate = livePages.find((candidate) => {
      if (candidate === page) {
        return false;
      }
      return !beforePages.includes(candidate) || candidate.url() !== "about:blank";
    });

    if (popupCandidate) {
      return {
        appPage: popupCandidate,
        openedIn: "popup",
      };
    }

    if (page.url() !== beforeUrl || await isPotentialOpenInAppSurface(page)) {
      return {
        appPage: page,
        openedIn: page.url() !== beforeUrl ? "same_page_navigation" : "same_page",
      };
    }

    await pageWait(page, 250);
  }

  return {
    appPage: page,
    openedIn: page.url() !== beforeUrl ? "same_page_navigation" : "same_page",
  };
}

async function collectOpenInAppMenuDebug(page) {
  const menuItemSelectors = [
    "li.sapMMenuItem",
    "[role='menuitem']",
  ];
  const visibleMenuTexts = [];

  for (const target of listSearchTargets(page)) {
    const items = target.locator(menuItemSelectors.join(", "));
    const count = await items.count().catch(() => 0);
    for (let index = 0; index < Math.min(count, 12); index += 1) {
      const item = items.nth(index);
      const visible = await item.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      const text = normalizeSnippet(await item.innerText().catch(() => ""), 120);
      if (text && !visibleMenuTexts.includes(text)) {
        visibleMenuTexts.push(text);
      }
    }
  }

  return {
    url: page.url(),
    title: await safeTitle(page),
    visibleMenuTexts,
    bodyTextSnippet: await readBodySnippet(page),
  };
}

async function restoreTaskCenterAfterOpen(page, openInAppRun, taskCenterUrl, timeoutMs) {
  if (openInAppRun?.openedIn === "popup") {
    const popupPage = openInAppRun.appPage;
    if (popupPage && popupPage !== page) {
      await popupPage.close().catch(() => {});
    }
    await page.bringToFront().catch(() => {});
    await waitForTaskCenterReady(page, Math.min(timeoutMs, 10000)).catch(() => {});
    await showAutomationBadge(page, {
      title: "SAP BTP PO Decision 自动化",
      message: "已回到 Task Center，继续处理下一组 Case",
      details: {
        phase: "task-center-ready",
      },
    });
    return;
  }

  if (page.url().includes("taskcenter-display")) {
    await waitForTaskCenterReady(page, Math.min(timeoutMs, 10000)).catch(() => {});
    await showAutomationBadge(page, {
      title: "SAP BTP PO Decision 自动化",
      message: "Task Center 已就绪，继续处理下一组 Case",
      details: {
        phase: "task-center-ready",
      },
    });
    return;
  }

  await page.goto(taskCenterUrl, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await waitForTaskCenterReady(page, timeoutMs);
  await configureTaskCenterFilter(page);
  await showAutomationBadge(page, {
    title: "SAP BTP PO Decision 自动化",
    message: "已重新打开 Task Center，继续处理下一组 Case",
    details: {
      phase: "task-center-ready",
    },
  });
}

async function resolveMenuItemRoot(target, selector) {
  const locator = target.locator(selector).first();
  const tagName = await locator.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
  if (tagName === "li") {
    return locator;
  }

  return locator.locator("xpath=ancestor::li[@role='menuitem'][1]").first();
}

async function reloadOpenInAppPage(appPage, url, timeoutMs) {
  await appPage.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await waitForOpenInAppReady(appPage, timeoutMs);
  await showAutomationBadge(appPage, {
    title: "SAP BTP PO Decision 自动化",
    message: "Open in App 页面已恢复，继续处理",
    details: {
      phase: "open-in-app-reloaded",
    },
  });
}

async function ensureOpenInAppRunActive(page, openInAppRun, caseNumber, timeoutMs) {
  if (!openInAppRun || isPageClosed(openInAppRun.appPage)) {
    log("Reopening Open in App page for Case Number.", { caseNumber });
    return await openInAppFromSearchResults(page, caseNumber, timeoutMs);
  }

  return openInAppRun;
}

async function orderCaseGroupEntriesByVisiblePoSequence(appPage, entries) {
  const visiblePoSequence = await collectScrollablePoSequence(appPage, "1");
  if (visiblePoSequence.length === 0) {
    return entries;
  }

  const pageOrder = new Map();
  visiblePoSequence.forEach((po, index) => {
    if (!pageOrder.has(po)) {
      pageOrder.set(po, index);
    }
  });

  return [...entries].sort((left, right) => {
    const leftIndex = pageOrder.has(left.po) ? pageOrder.get(left.po) : Number.MAX_SAFE_INTEGER;
    const rightIndex = pageOrder.has(right.po) ? pageOrder.get(right.po) : Number.MAX_SAFE_INTEGER;
    if (leftIndex === rightIndex) {
      return left.rowIndex - right.rowIndex;
    }
    return leftIndex - rightIndex;
  });
}

async function saveOpenInAppChanges(appPage, timeoutMs) {
  const saveSelectors = [
    "#__button29",
    "button:has-text('Save')",
    "[data-ui5-accesskey='s']",
  ];

  await waitForAny(appPage, saveSelectors, Math.min(timeoutMs, 15000));
  const saveTarget = await firstVisibleTarget(appPage, saveSelectors);
  if (!saveTarget) {
    throw new Error("Save button did not become visible after processing the current Case Number.");
  }

  const saveButton = saveTarget.target.locator(saveTarget.selector).first();
  await saveButton.click();
  await pageWait(appPage, 900);

  return {
    clicked: true,
    label: await saveButton.innerText().catch(() => "Save"),
    pageUrlAfterSave: appPage.url(),
  };
}

async function processPoEntryWithRecovery(page, openInAppRun, caseNumber, entry, timeoutMs, options = {}) {
  const attempts = [
    { mode: "current", restartAtTop: options.restartAtTop !== false },
    { mode: "current", restartAtTop: true },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      openInAppRun = await ensureOpenInAppRunActive(
        page,
        openInAppRun,
        caseNumber,
        timeoutMs
      );

      await waitForPoTableData(openInAppRun.appPage, Math.min(timeoutMs, 25000));
      const poDecision = await applyPoDecisionInApp(
        openInAppRun.appPage,
        entry,
        timeoutMs,
        { restartAtTop: attempt.restartAtTop }
      );

      return {
        openInAppRun,
        poDecision,
        recoveredVia: attempt.mode === "current" ? null : attempt.mode,
      };
    } catch (error) {
      lastError = error;
      log("PO processing attempt failed.", {
        caseNumber,
        po: entry.po,
        decision: entry.decision,
        attemptMode: attempt.mode,
        restartAtTop: attempt.restartAtTop,
        error: error.message || "PO processing failed.",
      });
    }
  }

  throw lastError ?? new Error(`PO processing failed for ${entry.po}.`);
}

async function closeOpenInAppRun(openInAppRun) {
  if (!openInAppRun?.appPage || isPageClosed(openInAppRun.appPage)) {
    return;
  }

  await openInAppRun.appPage.close().catch(() => {});
}

async function waitForPoTableData(page, timeoutMs) {
  const ready = await waitFor(async () => {
    for (const target of listSearchTargets(page)) {
      const rowCount = await target
        .locator("tr[role='row'][aria-level='1']")
        .count()
        .catch(() => 0);
      if (rowCount > 0) {
        return true;
      }

      const hasTableDataSignal = await target
        .locator("#__xmlview3--table-vsb, [id$='table-vsb'], .sapUiTableVSb")
        .evaluateAll((nodes) => {
          return nodes.some((node) => {
            const scrollHeight = Number(node.scrollHeight || 0);
            const clientHeight = Number(node.clientHeight || 0);
            return scrollHeight > 0 && clientHeight >= 0;
          });
        })
        .catch(() => false);

      if (hasTableDataSignal) {
        return true;
      }
    }

    return false;
  }, timeoutMs, 250).then(() => true).catch(() => false);

  if (!ready) {
    const preview = await collectAppTablePreview(page);
    throw new Error(`Open in App PO table data did not become ready. Preview: ${JSON.stringify(preview)}`);
  }
}

async function applyPoDecisionInApp(appPage, entry, timeoutMs, options = {}) {
  const po = entry.po;
  const decision = entry.decision;
  const tableSelectors = [
    "tr[role='row'][aria-level='1']",
    "[id*='table-rows-row0']",
    "tbody tr[role='row']",
  ];

  log("Processing PO decision.", {
    po,
    decision,
    restartAtTop: options.restartAtTop !== false,
  });

  try {
    await waitForAny(appPage, tableSelectors, Math.min(timeoutMs, 30000));
    await waitFor(async () => {
      return (await countVisibleRowsByLevel(appPage, "1")) > 0;
    }, Math.min(timeoutMs, 30000), 300);
  } catch (error) {
    const preview = await collectAppTablePreview(appPage);
    throw new Error(`Open in App page did not expose the PO table for PO ${po}. Preview: ${JSON.stringify(preview)}. Root error: ${error.message || error}`);
  }

  const parentRow = await findPoRowByLevel(appPage, po, "1", {
    allowScroll: true,
    restartAtTop: options.restartAtTop !== false,
  });
  if (!parentRow) {
    const preview = await collectAppTablePreview(appPage);
    throw new Error(`PO row was not found for PO ${po}. Preview: ${JSON.stringify(preview)}`);
  }

  const treeIcon = parentRow.locator("span.sapUiTableTreeIcon[role='button']").first();
  const expanded = await parentRow.getAttribute("aria-expanded").catch(() => "");
  if (expanded !== "true") {
    await treeIcon.click();
  }

  await waitFor(async () => {
    const attr = await parentRow.getAttribute("aria-expanded").catch(() => "");
    return attr === "true";
  }, 10000, 250);
  await pageWait(appPage, 250);

  const childRow = await waitForChildRow(appPage, parentRow, po, 12000);
  if (!childRow) {
    const preview = await collectAppTablePreview(appPage);
    throw new Error(`Expanded child row was not found for PO ${po}. Preview: ${JSON.stringify(preview)}`);
  }

  const decisionCell = childRow.locator("td[data-sap-ui-colid*='decision_ID']").first();
  const decisionInput = decisionCell.locator("input[role='combobox']").first();
  const decisionArrow = decisionCell.locator("span[role='button'][aria-label='Select Options']").first();
  await decisionArrow.click();

  const optionSelectors = [
    `li[role='option']:has-text("${decision}")`,
    `li.sapMComboBoxBaseNonInteractiveItem:has-text("${decision}")`,
    `span[aria-live='polite']:text-is("${decision}")`,
  ];
  let optionTarget = null;
  try {
    await waitForAny(appPage, optionSelectors, 1500);
    optionTarget = await firstVisibleTarget(appPage, optionSelectors);
  } catch {
    optionTarget = null;
  }

  if (optionTarget) {
    const optionRoot = await resolveOptionRoot(optionTarget.target, optionTarget.selector);
    await optionRoot.click();
  } else {
    await decisionInput.click();
    await decisionInput.fill(decision);
    await decisionInput.press("Enter").catch(async () => {
      await decisionInput.press("Tab").catch(() => {});
    });
  }

  const committed = await confirmDecisionValue(childRow, decisionInput, decisionCell, decision, 1600);
  if (!committed) {
    await decisionInput.click().catch(() => {});
    await decisionInput.press(process.platform === "win32" ? "Control+A" : "Meta+A").catch(() => {});
    await decisionInput.fill(decision).catch(() => {});
    await decisionInput.press("Enter").catch(async () => {
      await decisionInput.press("Tab").catch(() => {});
    });
    await pageWait(appPage, 120);
  }

  const verified = await confirmDecisionValue(childRow, decisionInput, decisionCell, decision, 1800);
  if (!verified) {
    throw new Error(`Decision value did not commit for PO ${po}.`);
  }

  log("PO decision selected.", {
    po,
    decision,
  });

  return {
    po,
    decisionRequested: decision,
    decisionSelected: await decisionInput.inputValue().catch(() => decision),
    parentExpanded: true,
  };
}

async function waitForChildRow(appPage, parentRow, po, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const matchingLevel2Row = await findPoRowByLevel(appPage, po, "2");
    if (matchingLevel2Row) {
      return matchingLevel2Row;
    }

    const siblingLevel2Row = parentRow.locator("xpath=following-sibling::tr[@role='row' and @aria-level='2' and not(contains(@class,'sapUiTableRowHidden'))][1]").first();
    if (await siblingLevel2Row.isVisible().catch(() => false)) {
      return siblingLevel2Row;
    }

    await pageWait(appPage, 300);
  }

  return null;
}

async function confirmDecisionValue(childRow, decisionInput, decisionCell, decision, timeoutMs) {
  return await waitFor(async () => {
    const inputValue = await decisionInput.inputValue().catch(() => "");
    if (normalizeDecisionValue(inputValue) === decision) {
      return true;
    }

    const cellText = await decisionCell.innerText().catch(() => "");
    if (normalizeDecisionValue(cellText) === decision || normalizeDecisionValue(cellText.split(/\s+/).pop()) === decision) {
      return true;
    }

    const rowText = await childRow.innerText().catch(() => "");
    const normalizedRowText = normalizeSnippet(rowText, 300).toLowerCase();
    return normalizedRowText.includes(decision.toLowerCase());
  }, timeoutMs, 100).then(() => true).catch(() => false);
}

async function collectAppTablePreview(page) {
  const rowsByLevel = {
    level1: [],
    level2: [],
  };

  for (const level of ["1", "2"]) {
    for (const target of listSearchTargets(page)) {
      const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
      const count = await rows.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 8); index += 1) {
        const row = rows.nth(index);
        const visible = await row.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        const text = await row.innerText().catch(() => "");
        rowsByLevel[`level${level}`].push(normalizeSnippet(text, 200));
      }
    }
  }

  return {
    url: page.url(),
    title: await safeTitle(page),
    frameSummaries: await collectFrameSummaries(page),
    rowsByLevel,
    scrollables: await collectScrollableTablePreview(page),
    idsContainingXmlview3: await collectIdsContaining(page, "__xmlview3"),
    idsContainingPODetails: await collectIdsContaining(page, "PODetails"),
    idsContainingDecision: await collectIdsContaining(page, "decision_ID"),
    bodyTextSnippet: await readBodySnippet(page),
  };
}

async function collectScrollableTablePreview(page) {
  const selector = ".sapUiTableVSb, .sapUiTableCtrlScr, .sapUiTableCtrlCnt, .sapUiTableCCnt, .sapUiTableRowHdrScr";
  const previews = [];
  for (const target of listSearchTargets(page)) {
    const items = await target.locator(selector).evaluateAll((nodes) =>
      nodes.slice(0, 20).map((node) => ({
        tagName: node.tagName,
        id: node.id || "",
        className: node.className || "",
        scrollTop: node.scrollTop || 0,
        scrollHeight: node.scrollHeight || 0,
        clientHeight: node.clientHeight || 0,
      }))
    ).catch(() => []);

    for (const item of items) {
      previews.push(item);
    }
  }

  return previews;
}

async function countVisibleRowsByLevel(page, level) {
  let visibleCount = 0;
  for (const target of listSearchTargets(page)) {
    const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
    const count = await rows.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      if (await row.isVisible().catch(() => false)) {
        visibleCount += 1;
      }
    }
  }

  return visibleCount;
}

async function findPoRowByLevel(page, po, level, options = {}) {
  const normalizedTargetPo = normalizePoValue(po);
  const allowScroll = Boolean(options.allowScroll) && level === "1";
  const restartAtTop = options.restartAtTop !== false;

  if (allowScroll && restartAtTop) {
    await scrollTableToTop(page, level).catch(() => {});
  }

  const findVisibleMatch = async () => {
    for (const target of listSearchTargets(page)) {
      const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
      const count = await rows.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        const visible = await row.isVisible().catch(() => false);
        if (visible) {
          const rowPo = await readPoValueFromRow(row);
          if (normalizePoValue(rowPo) === normalizedTargetPo) {
            return row;
          }
        }
      }
    }

    return null;
  };

  const visibleMatch = await findVisibleMatch();
  if (visibleMatch || !allowScroll) {
    return visibleMatch;
  }

  let lastSignature = "";
  let stagnantCount = 0;
  for (let step = 0; step < 80; step += 1) {
    const scrolled = await scrollTableDown(page, level);
    await pageWait(page, 500);

    const afterScrollMatch = await findVisibleMatch();
    if (afterScrollMatch) {
      return afterScrollMatch;
    }

    const signature = await collectVisiblePoSignature(page, level);
    if (!scrolled || signature === lastSignature) {
      stagnantCount += 1;
    } else {
      stagnantCount = 0;
    }

    if (stagnantCount >= 3) {
      break;
    }

    lastSignature = signature;
  }

  return null;
}

async function collectScrollablePoSequence(page, level) {
  const collectedPos = [];
  const seenPos = new Set();

  await scrollTableToTop(page, level).catch(() => {});

  let lastSignature = "";
  let stagnantCount = 0;
  for (let step = 0; step < 80; step += 1) {
    for (const target of listSearchTargets(page)) {
      const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
      const count = await rows.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        const visible = await row.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        const rowPo = normalizePoValue(await readPoValueFromRow(row));
        if (rowPo && !seenPos.has(rowPo)) {
          seenPos.add(rowPo);
          collectedPos.push(rowPo);
        }
      }
    }

    const scrolled = await scrollTableDown(page, level);
    await pageWait(page, 350);

    const signature = await collectVisiblePoSignature(page, level);
    if (!scrolled || signature === lastSignature) {
      stagnantCount += 1;
    } else {
      stagnantCount = 0;
    }

    if (stagnantCount >= 3) {
      break;
    }

    lastSignature = signature;
  }

  return collectedPos;
}

function sortCaseGroupEntriesForExecution(entries) {
  return [...entries].sort(compareCaseEntryExecutionOrder);
}

function compareCaseEntryExecutionOrder(left, right) {
  const caseCompare = String(left.caseNumber || "").localeCompare(String(right.caseNumber || ""));
  if (caseCompare !== 0) {
    return caseCompare;
  }

  const leftPo = String(left.po || "");
  const rightPo = String(right.po || "");
  const poCompare = leftPo.localeCompare(rightPo, "en", { numeric: true, sensitivity: "base" });
  if (poCompare !== 0) {
    return poCompare;
  }

  return Number(left.rowIndex || 0) - Number(right.rowIndex || 0);
}

async function collectVisiblePoSignature(page, level) {
  const visiblePos = [];
  for (const target of listSearchTargets(page)) {
    const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
    const count = await rows.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const visible = await row.isVisible().catch(() => false);
      if (visible) {
        const rowPo = await readPoValueFromRow(row);
        visiblePos.push(normalizePoValue(rowPo));
      }
    }
  }

  return visiblePos.join("|");
}

async function scrollTableToTop(page, level) {
  return scrollTableByDelta(page, level, "top");
}

async function scrollTableDown(page, level) {
  return scrollTableByDelta(page, level, "down");
}

async function scrollTableByDelta(page, level, direction) {
  const directScrollbarSelectors = [
    "#__xmlview3--table-vsb",
    "[id$='-table-vsb']",
    ".sapUiTableVSb",
  ];

  const directScrollbar = await firstExistingTarget(page, directScrollbarSelectors);
  if (directScrollbar) {
    const scrolled = await directScrollbar.target
      .locator(directScrollbar.selector)
      .first()
      .evaluate((node, scrollDirection) => {
        const maxScrollable = node.scrollHeight - node.clientHeight;
        if (maxScrollable <= 0) {
          return false;
        }

        const previousTop = node.scrollTop;
        if (scrollDirection === "top") {
          node.scrollTop = 0;
        } else {
          node.scrollTop = Math.min(maxScrollable, previousTop + Math.max(node.clientHeight * 0.9, 280));
        }

        return node.scrollTop !== previousTop;
      }, direction)
      .catch(() => false);

    if (scrolled) {
      return true;
    }
  }

  const anchor = await findVisibleRowAnchor(page, level);
  if (!anchor) {
    return false;
  }

  const scrolled = await anchor.evaluate((node, scrollDirection) => {
    const scrollableSelectors = [
      ".sapUiTableVSb",
      ".sapUiTableCtrlScr",
      ".sapUiTableCtrlCnt",
      ".sapUiTableCCnt",
      ".sapUiTableRowHdrScr",
    ];

    const tryScroll = (el) => {
      if (!el) return false;
      const maxScrollable = el.scrollHeight - el.clientHeight;
      if (maxScrollable <= 0) return false;
      const previousTop = el.scrollTop;
      if (scrollDirection === "top") {
        el.scrollTop = 0;
      } else {
        el.scrollTop = Math.min(maxScrollable, previousTop + Math.max(el.clientHeight * 0.85, 240));
      }
      return el.scrollTop !== previousTop;
    };

    const tableRoot = node.closest("#__xmlview3--table") || node.closest(".sapUiTable");
    if (tableRoot) {
      for (const selector of scrollableSelectors) {
        const candidates = Array.from(tableRoot.querySelectorAll(selector));
        for (const candidate of candidates) {
          if (tryScroll(candidate)) {
            return true;
          }
        }
      }
    }

    return false;
  }, direction).catch(() => false);

  return scrolled;
}

async function findVisibleRowAnchor(page, level) {
  for (const target of listSearchTargets(page)) {
    const rows = target.locator(`tr[role='row'][aria-level='${level}']`);
    const count = await rows.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      if (await row.isVisible().catch(() => false)) {
        return row;
      }
    }
  }

  return null;
}

async function readPoValueFromRow(row) {
  const poCellSelectors = [
    "td[data-sap-ui-colid*='POContractNumber'] .sapUiCompSmartFieldValue",
    "td[data-sap-ui-colid*='POContractNumber'] input",
    "td[aria-colindex='2'] .sapUiCompSmartFieldValue",
    "td[aria-colindex='2'] input",
  ];

  for (const selector of poCellSelectors) {
    const locator = row.locator(selector).first();
    if (await locator.count().catch(() => 0)) {
      const value = await locator.inputValue().catch(async () => {
        return await locator.innerText().catch(() => "");
      });
      if (String(value || "").trim()) {
        return String(value).trim();
      }
    }
  }

  return normalizeSnippet(await row.innerText().catch(() => ""), 100);
}

async function resolveOptionRoot(target, selector) {
  const locator = target.locator(selector).first();
  const tagName = await locator.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
  if (tagName === "li") {
    return locator;
  }

  return locator.locator("xpath=ancestor::li[@role='option'][1]").first();
}

async function pageWait(page, ms) {
  await page.waitForTimeout(ms).catch(() => {});
}

function isPageClosed(page) {
  try {
    return !page || page.isClosed();
  } catch {
    return true;
  }
}

async function ensureTaskTypeOptionSelectedByText(page, optionText) {
  const popupListSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-popup-list-listUl",
    "[id$='taskDefinitionFilter-popup-list-listUl']",
    "ul[role='listbox'][aria-multiselectable='true'].sapMListUl",
  ];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await isTaskTypeOptionSelectedByText(page, optionText)) {
      return;
    }

    await openTaskTypePopup(page, popupListSelectors).catch(() => {});
    const optionRoot = await findTaskTypeOptionByText(page, optionText);
    if (!optionRoot) {
      await pageWait(page, 350);
      continue;
    }

    await optionRoot.click().catch(() => {});
    const checkbox = optionRoot.locator(".sapMCbBg").first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click().catch(() => {});
    }
    await optionRoot.press(" ").catch(() => {});

    const selected = await waitFor(async () => {
      return (
        await isTaskTypeOptionLocatorSelected(optionRoot) ||
        await isTaskTypeSelectedInField(page, optionText)
      );
    }, 5000, 150).then(() => true).catch(() => false);

    if (selected) {
      return;
    }

    await trySelectTaskTypeOptionByTyping(page, optionText).catch(() => {});
    const selectedAfterTyping = await waitFor(async () => {
      return await isTaskTypeSelectedInField(page, optionText);
    }, 4000, 150).then(() => true).catch(() => false);

    if (selectedAfterTyping) {
      return;
    }

    await pageWait(page, 300);
  }

  const debugInfo = await collectTaskTypeDebug(page);
  throw new Error(`Task Type option was not selected: ${optionText}. Debug: ${JSON.stringify(debugInfo)}`);
}

async function isTaskTypeOptionSelectedByText(page, optionText) {
  if (await isTaskTypeSelectedInField(page, optionText)) {
    return true;
  }

  const optionRoot = await findTaskTypeOptionByText(page, optionText);
  if (!optionRoot) {
    return false;
  }

  return isTaskTypeOptionLocatorSelected(optionRoot);
}

function normalizeDecisionValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "accept") {
    return "Accept";
  }
  if (normalized === "reject") {
    return "Reject";
  }

  return String(value ?? "").trim();
}

function normalizePoValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^O/, "0");

  if (/^\d+(\.0+)?$/.test(normalized)) {
    return normalized.replace(/\.0+$/, "");
  }

  return normalized;
}

async function findTaskTypeOptionByText(page, optionText) {
  for (const target of listSearchTargets(page)) {
    const optionRoot = target
      .locator("li.sapMMultiComboBoxItem[role='option'], li[role='option'].sapMMultiComboBoxItem")
      .filter({ hasText: optionText })
      .first();

    const visible = await optionRoot.isVisible().catch(() => false);
    if (visible) {
      return optionRoot;
    }
  }

  return null;
}

async function openTaskTypePopup(page, popupListSelectors) {
  if (await anyVisible(page, popupListSelectors)) {
    return;
  }

  const filterArrowSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
    "[id$='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter'] .sapMInputBaseIcon",
  ];
  const filterFieldSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter",
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-inner",
    "[id$='taskDefinitionFilter']",
    "[id$='taskDefinitionFilter-inner']",
    "[id*='taskDefinitionFilter'] input[role='combobox']",
    "input[name='taskDefinition']",
  ];

  if (await anyVisible(page, filterArrowSelectors)) {
    await clickFirstVisible(page, filterArrowSelectors);
  } else {
    const filterFieldTarget = await firstVisibleTarget(page, filterFieldSelectors);
    if (filterFieldTarget) {
      const field = filterFieldTarget.target.locator(filterFieldTarget.selector).first();
      await field.click().catch(() => {});
      await page.keyboard.press("Alt+ArrowDown").catch(() => {});
    }
  }

  await waitForAny(page, popupListSelectors, 15000);
  await pageWait(page, 200);
}

async function trySelectTaskTypeOptionByTyping(page, optionText) {
  const filterInputSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-inner",
    "[id$='taskDefinitionFilter-inner']",
    "[id*='taskDefinitionFilter'] input[role='combobox']",
    "input[name='taskDefinition']",
  ];
  const popupListSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-popup-list-listUl",
    "[id$='taskDefinitionFilter-popup-list-listUl']",
    "ul[role='listbox'][aria-multiselectable='true'].sapMListUl",
  ];

  await openTaskTypePopup(page, popupListSelectors);
  const inputTarget = await firstVisibleTarget(page, filterInputSelectors);
  if (!inputTarget) {
    return;
  }

  const input = inputTarget.target.locator(inputTarget.selector).first();
  await input.click().catch(() => {});
  await page.keyboard.press(process.platform === "win32" ? "Control+A" : "Meta+A").catch(() => {});
  await input.fill(optionText);
  await pageWait(page, 250);

  const optionRoot = await findTaskTypeOptionByText(page, optionText);
  if (optionRoot) {
    await optionRoot.click().catch(() => {});
  }

  await input.press("Enter").catch(() => {});
  await pageWait(page, 250);
}

async function isTaskTypeSelectedInField(page, optionText) {
  const fieldSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter",
    "[id$='taskDefinitionFilter']",
  ];

  for (const target of listSearchTargets(page)) {
    for (const selector of fieldSelectors) {
      const field = target.locator(selector).first();
      const visible = await field.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      const text = await field.innerText().catch(() => "");
      if (text.includes(optionText)) {
        return true;
      }
    }
  }

  return false;
}

async function collectTaskTypeDebug(page) {
  const filterFieldSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter",
    "[id$='taskDefinitionFilter']",
  ];
  const popupOptionSelectors = [
    "li.sapMMultiComboBoxItem[role='option']",
    "li[role='option'].sapMMultiComboBoxItem",
  ];

  let fieldText = "";
  let popupVisible = false;
  const optionStates = [];

  for (const target of listSearchTargets(page)) {
    for (const selector of filterFieldSelectors) {
      const field = target.locator(selector).first();
      if (await field.isVisible().catch(() => false)) {
        fieldText = await field.innerText().catch(() => "");
        break;
      }
    }

    const options = target.locator(popupOptionSelectors.join(", "));
    const count = await options.count().catch(() => 0);
    if (count > 0) {
      popupVisible = true;
      for (let index = 0; index < Math.min(count, 8); index += 1) {
        const option = options.nth(index);
        const visible = await option.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        optionStates.push({
          text: normalizeSnippet(await option.innerText().catch(() => ""), 120),
          ariaSelected: await option.getAttribute("aria-selected").catch(() => ""),
        });
      }
    }
  }

  return {
    url: page.url(),
    title: await safeTitle(page),
    fieldText: normalizeSnippet(fieldText, 200),
    popupVisible,
    optionStates,
    bodyTextSnippet: await readBodySnippet(page),
  };
}

async function collectVisibleTaskTypeOptionTexts(page) {
  const popupOptionSelectors = [
    "li.sapMMultiComboBoxItem[role='option']",
    "li[role='option'].sapMMultiComboBoxItem",
  ];
  const optionTexts = [];

  for (const target of listSearchTargets(page)) {
    const options = target.locator(popupOptionSelectors.join(", "));
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const visible = await option.isVisible().catch(() => false);
      if (!visible) {
        continue;
      }

      const text = normalizeSnippet(await option.innerText().catch(() => ""), 120);
      if (text && !optionTexts.includes(text)) {
        optionTexts.push(text);
      }
    }
  }

  return optionTexts;
}

async function isTaskTypeOptionLocatorSelected(optionRoot) {
  return optionRoot.evaluate((node) => {
    const ariaSelected = node.getAttribute("aria-selected");
    if (ariaSelected === "true") {
      return true;
    }

    return Boolean(node.querySelector(".sapMCbMarkChecked"));
  }).catch(() => false);
}

async function searchCaseNumber(page, caseNumber) {
  const inputSelectors = [
    "#application-taskcenter-display-component---inboxTable--searchField-I",
    "[id$='searchField-I']",
    "[id*='inboxTable--searchField-I']",
    "input[type='search'][placeholder*='Task Title']",
    "input[type='search'][aria-label*='Task Title']",
  ];
  const submitSelectors = [
    "#application-taskcenter-display-component---worklist--filterBar-btnGo",
    "[id$='filterBar-btnGo']",
    "[id*='filterBar-btnGo']",
    "[id$='searchField-search']",
    "[id*='searchField-search']",
    "button[aria-label='Search']",
    "button[title='Search']",
    "button:has-text(\"Go\")",
  ];

  await waitForAny(page, inputSelectors, 60000);
  const inputTarget = await firstVisibleTarget(page, inputSelectors);
  if (!inputTarget) {
    const debugInfo = await collectTaskCenterDebug(page);
    throw new Error(`Task Center search input did not become visible. Debug: ${JSON.stringify(debugInfo)}`);
  }

  const previousVisibleRows = await collectTaskCenterRowTexts(page);
  const input = inputTarget.target.locator(inputTarget.selector).first();
  await input.click();
  await page.keyboard.press(process.platform === "win32" ? "Control+A" : "Meta+A").catch(() => {});
  await input.fill("");
  await input.fill(caseNumber);
  await input.press("Enter").catch(() => {});

  let resultsUpdated = await waitForTaskCenterSearchResults(page, caseNumber, previousVisibleRows, 5000)
    .then(() => true)
    .catch(() => false);

  if (!resultsUpdated) {
    const submitTarget = await firstVisibleTarget(page, submitSelectors);
    if (submitTarget) {
      await submitTarget.target.locator(submitTarget.selector).first().click().catch(() => {});
      await pageWait(page, 350);
    } else {
      await input.press("Enter").catch(() => {});
    }

    await waitForTaskCenterSearchResults(page, caseNumber, previousVisibleRows, 12000);
    resultsUpdated = true;
  }

  if (!resultsUpdated) {
    const debugInfo = await collectTaskCenterDebug(page);
    throw new Error(`Task Center search results did not update for Case Number ${caseNumber}. Debug: ${JSON.stringify(debugInfo)}`);
  }

  await waitForNoBlockingLayer(page, 12000);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    caseNumber,
    searchBoxValue: await input.inputValue().catch(() => caseNumber),
    pageMatchedCaseNumber: (await collectTaskCenterRowTexts(page)).some((rowText) => rowText.includes(caseNumber)),
    pageTextSnippet: normalizeSnippet(bodyText, 300),
  };
}

async function waitForTaskCenterSearchResults(page, caseNumber, previousVisibleRows, timeoutMs) {
  await waitFor(async () => {
    const visibleRows = await collectTaskCenterRowTexts(page);
    if (visibleRows.some((rowText) => rowText.includes(caseNumber))) {
      return true;
    }

    if (
      visibleRows.length > 0 &&
      previousVisibleRows.length > 0 &&
      JSON.stringify(visibleRows) !== JSON.stringify(previousVisibleRows)
    ) {
      return visibleRows.some((rowText) => rowText.toLowerCase().includes(caseNumber.toLowerCase()));
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const loweredBodyText = bodyText.toLowerCase();
    if (
      loweredBodyText.includes("no data") ||
      loweredBodyText.includes("no items") ||
      loweredBodyText.includes("no tasks")
    ) {
      return true;
    }

    return false;
  }, timeoutMs, 250);
}

async function collectTaskCenterRowTexts(page) {
  const rowSelectors = [
    "tr[role='row'][aria-level='1']",
    "[id*='inboxTable'] tr[role='row']",
    "tbody tr[role='row']",
  ];
  const rowTexts = [];

  for (const target of listSearchTargets(page)) {
    for (const selector of rowSelectors) {
      const rows = target.locator(selector);
      const count = await rows.count().catch(() => 0);
      for (let index = 0; index < Math.min(count, 12); index += 1) {
        const row = rows.nth(index);
        const visible = await row.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        const text = normalizeSnippet(await row.innerText().catch(() => ""), 240);
        if (text && !rowTexts.includes(text)) {
          rowTexts.push(text);
        }
      }
    }
  }

  return rowTexts;
}

async function waitForNoBlockingLayer(page, timeoutMs) {
  const blockingLayerSelectors = [
    "#sap-ui-blocklayer-popup",
    ".sapUiBLy",
  ];

  await waitFor(async () => {
    for (const selector of blockingLayerSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const layer = locator.nth(index);
        const visible = await layer.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        const blocking = await layer.evaluate((node) => {
          const style = window.getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
            return false;
          }

          const opacity = Number(style.opacity || "1");
          return opacity > 0;
        }).catch(() => false);

        if (blocking) {
          return false;
        }
      }
    }

    return true;
  }, timeoutMs, 250);
}

async function collectTaskCenterDebug(page) {
  return {
    url: page.url(),
    title: await safeTitle(page),
    frameSummaries: await collectFrameSummaries(page),
    idsContainingTaskDefinitionFilter: await collectIdsContaining(page, "taskDefinitionFilter"),
    idsContainingSearchField: await collectIdsContaining(page, "searchField"),
    bodyTextSnippet: await readBodySnippet(page),
  };
}

async function waitForTaskCenterReady(page, timeoutMs) {
  const readySelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
    "#application-taskcenter-display-component---inboxTable--searchField-I",
    "[id$='taskDefinitionFilter-arrow']",
    "[id$='searchField-I']",
  ];

  const selectorReady = await waitForAny(
    page,
    readySelectors,
    Math.min(timeoutMs, 20000)
  ).then(() => true).catch(() => false);

  if (selectorReady) {
    await pageWait(page, 250);
    return;
  }

  const taskCenterSurfaceReady = await waitFor(async () => {
    const urlReady = page.url().includes("taskcenter-display");
    const titleReady = (await safeTitle(page)).toLowerCase().includes("task center");
    return urlReady && titleReady;
  }, Math.min(timeoutMs, 12000), 250).then(() => true).catch(() => false);

  if (taskCenterSurfaceReady) {
    await pageWait(page, 500);
    return;
  }

  const debugInfo = await collectTaskCenterDebug(page);
  throw new Error(`Task Center page did not become ready. Debug: ${JSON.stringify(debugInfo)}`);
}

async function waitForOpenInAppReady(page, timeoutMs) {
  const readySelectors = [
    "tr[role='row'][aria-level='1']",
    "[id*='table-rows-row0']",
    "#__xmlview3--table",
    "#__button29",
    "[id$='table-vsb']",
    ".sapUiTableVSb",
    "text=My Inbox",
  ];

  const readyBySelectors = await waitForAny(
    page,
    readySelectors,
    Math.min(timeoutMs, 15000)
  ).then(() => true).catch(() => false);

  if (readyBySelectors) {
    const tableReady = await waitForPoTableData(page, Math.min(timeoutMs, 18000))
      .then(() => true)
      .catch(() => false);
    if (tableReady) {
      await pageWait(page, 250);
      return;
    }

    await pageWait(page, 350);
    return;
  }

  const url = page.url();
  if (url.includes("WorkflowTask-DisplayMyInbox") || url.includes("detail_deep")) {
    const tableReady = await waitForPoTableData(page, Math.min(timeoutMs, 20000))
      .then(() => true)
      .catch(() => false);
    if (tableReady) {
      log("Treating Open in App page as ready based on route and PO table data.", {
        url,
        title: await safeTitle(page),
      });
      await pageWait(page, 250);
      return;
    }

    const surfaceReady = await isOpenInAppSurfaceReady(page);
    if (surfaceReady) {
      log("Treating Open in App page as ready based on route and visible inbox surface.", {
        url,
        title: await safeTitle(page),
        frameSummaries: await collectFrameSummaries(page),
      });
      await pageWait(page, 350);
      return;
    }
  }

  const debugInfo = await collectOpenInAppReadyDebug(page);
  throw new Error(`Open in App page did not become ready. Debug: ${JSON.stringify(debugInfo)}`);
}

async function isOpenInAppSurfaceReady(page) {
  const title = (await safeTitle(page)).toLowerCase();
  if (title.includes("my inbox")) {
    return true;
  }

  const bodySnippet = (await readBodySnippet(page)).toLowerCase();
  if (bodySnippet.includes("my inbox")) {
    return true;
  }

  const frameSummaries = await collectFrameSummaries(page);
  return frameSummaries.some((frame) => {
    const frameText = String(frame.bodyTextSnippet || "").toLowerCase();
    const frameUrl = String(frame.url || "").toLowerCase();
    return (
      frameText.includes("my inbox") ||
      frameText.includes("review sub-ticket resolution") ||
      frameText.includes("handle request") ||
      frameUrl.includes("workflowtask-displaymyinbox") ||
      frameUrl.includes("detail_deep")
    );
  });
}

async function isPotentialOpenInAppSurface(page) {
  if (isPageClosed(page)) {
    return false;
  }

  const url = page.url();
  if (url && !url.includes("taskcenter-display")) {
    return true;
  }

  return await anyVisible(page, [
    "#__xmlview3--table",
    "#__button29",
    "[id$='table-vsb']",
    ".sapUiTableVSb",
    "text=My Inbox",
  ]).catch(() => false);
}

async function collectOpenInAppReadyDebug(page) {
  return {
    url: page.url(),
    title: await safeTitle(page),
    frameSummaries: await collectFrameSummaries(page),
    bodyTextSnippet: await readBodySnippet(page),
  };
}

async function collectIdsContaining(page, substring) {
  const matches = [];
  for (const target of listSearchTargets(page)) {
    try {
      const ids = await target.locator(`[id*='${substring}']`).evaluateAll((nodes) =>
        nodes
          .map((node) => node.id)
          .filter(Boolean)
          .slice(0, 20)
      );
      if (ids.length > 0) {
        matches.push({
          frameUrl: readTargetUrl(target),
          ids,
        });
      }
    } catch {
      // Ignore per-target failures and keep collecting.
    }
  }

  return matches;
}

async function collectFrameSummaries(page) {
  const summaries = [];
  const frames = page.frames();
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    let bodyTextSnippet = "";
    try {
      bodyTextSnippet = normalizeSnippet(await frame.locator("body").innerText(), 300);
    } catch {
      bodyTextSnippet = "";
    }

    summaries.push({
      index,
      url: frame.url(),
      name: frame.name(),
      bodyTextSnippet,
    });
  }

  return summaries;
}

async function capturePageState(page) {
  return {
    url: page?.url?.() ?? "",
    title: await safeTitle(page),
    pageTextSnippet: await readBodySnippet(page),
    visibleError: await readVisibleError(page),
    emailVisible: await anyVisible(page, [
      "input[name='loginfmt']",
      "input[type='email']",
      "input[placeholder*='example.com']",
      "input[placeholder*='someone']",
      "input[name='username']",
      "input[name='login']",
    ]),
    passwordVisible: await anyVisible(page, [
      "input[name='passwd']",
      "input[type='password']",
      "input[name='password']",
    ]),
    mfaVisible: (await isVisible(page, "input[name='otc']")) || (await isVisible(page, "#idTxtBx_SAOTCC_OTC")),
  };
}

async function readVisibleError(page) {
  if (!page) return "";

  const selectors = [
    "#passwordError",
    "#usernameError",
    "#errorText",
    "[role='alert']",
    ".alert-error",
  ];

  for (const selector of selectors) {
    if (await isVisible(page, selector)) {
      const text = await page.locator(selector).first().innerText().catch(() => "");
      if (text.trim()) {
        return text.trim();
      }
    }
  }

  return "";
}

async function readBodySnippet(page) {
  if (!page) return "";

  try {
    const text = await page.locator("body").innerText();
    return normalizeSnippet(text, 500);
  } catch {
    return "";
  }
}

function normalizeSnippet(text, maxLength) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function safeTitle(page) {
  try {
    return await page?.title?.();
  } catch {
    return "";
  }
}

async function waitForAny(page, selectors, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (isPageClosed(page)) {
      throw new Error(`Target page was closed while waiting for selectors: ${selectors.join(", ")}`);
    }
    const match = await firstVisibleTarget(page, selectors);
    if (match) {
      return match.selector;
    }
    await pageWait(page, 250);
  }
  throw new Error(`Timed out waiting for selectors: ${selectors.join(", ")}`);
}

async function waitFor(predicate, timeout = 20000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Timed out waiting for condition.");
}

async function clickFirstVisible(page, selectors) {
  const match = await firstVisibleTarget(page, selectors);
  if (match) {
    await match.target.locator(match.selector).first().click();
    return;
  }

  throw new Error(`No clickable selector found: ${selectors.join(", ")}`);
}

async function isVisible(page, selector) {
  try {
    return await page.locator(selector).first().isVisible();
  } catch {
    return false;
  }
}

async function anyVisible(page, selectors) {
  return Boolean(await firstVisibleTarget(page, selectors));
}

async function firstVisibleSelector(page, selectors) {
  const match = await firstVisibleTarget(page, selectors);
  return match?.selector || "";
}

async function firstVisibleTarget(page, selectors) {
  for (const target of listSearchTargets(page)) {
    for (const selector of selectors) {
      if (await isVisible(target, selector)) {
        return {
          target,
          selector,
        };
      }
    }
  }

  return null;
}

async function firstExistingTarget(page, selectors) {
  for (const target of listSearchTargets(page)) {
    for (const selector of selectors) {
      const count = await target.locator(selector).count().catch(() => 0);
      if (count > 0) {
        return {
          target,
          selector,
        };
      }
    }
  }

  return null;
}

function listSearchTargets(page) {
  const frames = page.frames().filter((frame) => frame !== page.mainFrame());
  return [page, ...frames];
}

function readTargetUrl(target) {
  try {
    return target.url();
  } catch {
    return "";
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function toBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function previewUrl(url) {
  if (!url) return "";
  return url.length > 120 ? `${url.slice(0, 120)}...` : url;
}

async function ensureRuntimeFiles() {
  await mkdir(runtimeDataRoot, { recursive: true });
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(await readFile(filePath, "utf8"));
}

function buildHealthPayload() {
  const appId = String(process.env.TOS_AUTOMATION_APP_ID || "microsoft-login-n8n-demo").trim();
  const helperVersion = String(process.env.TOS_AUTOMATION_HELPER_VERSION || "").trim();
  const moduleVersion = String(process.env.TOS_AUTOMATION_MODULE_VERSION || "").trim();
  const moduleSource = String(process.env.TOS_AUTOMATION_MODULE_SOURCE || "bundled").trim();
  const moduleSha256 = String(process.env.TOS_AUTOMATION_MODULE_SHA256 || "").trim();
  return {
    ok: true,
    appId,
    port: config.port,
    version: helperVersion,
    helperVersion,
    moduleVersion,
    moduleSource,
    moduleSha256,
    capabilities: {
      routes: [
        "/run-login-file",
        "/api/run-login-file",
        "/run-ticket-owner-statistics",
        "/api/run-ticket-owner-statistics",
      ],
      modules: ["sap-btp-login", "ticket-owner-statistics"],
    },
    busy: Boolean(activeRun),
    activeRun,
    activeRunCount: activeRun ? 1 : 0,
    lastRun,
    dataDir: runtimeDataRoot,
    runtimeConfigPath,
    config: {
      host: config.host,
      port: config.port,
      appId,
      browser: config.browser,
      headless: config.headless,
      slowMo: config.slowMo,
      staySignedInAction: config.staySignedInAction,
      moduleVersion,
      moduleSource,
      moduleSha256,
      loginUrlPreview: previewUrl(config.loginUrl),
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

async function showAutomationBadge(target, options = {}) {
  if (!target || typeof target.evaluate !== "function" || isPageClosed(target)) {
    return;
  }

  const targets = [target];
  if (typeof target.frames === "function") {
    targets.push(...target.frames());
  }

  const uniqueTargets = Array.from(new Set(targets)).filter((item) => item && typeof item.evaluate === "function");
  const payload = {
    id: "tos-browser-automation-status-badge",
    title: String(options?.title || "TOS 浏览器自动化"),
    message: String(options?.message || "自动化正在执行"),
    details: normalizeAutomationBadgeDetails(options?.details),
  };

  await Promise.allSettled(uniqueTargets.map((item) => injectAutomationBadge(item, payload)));
}

async function removeAutomationBadge(target) {
  if (!target || typeof target.evaluate !== "function" || isPageClosed(target)) {
    return;
  }
  const targets = [target];
  if (typeof target.frames === "function") {
    targets.push(...target.frames());
  }
  await Promise.allSettled(
    Array.from(new Set(targets))
      .filter((item) => item && typeof item.evaluate === "function")
      .map((item) => item.evaluate(() => {
        document.getElementById("tos-browser-automation-status-badge")?.remove();
        document.getElementById("tos-ticket-owner-progress")?.remove();
      }))
  );
}

function normalizeAutomationBadgeDetails(details = {}) {
  const input = details && typeof details === "object" ? details : {};
  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      normalized[key] = value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6);
    } else if (typeof value === "number" || typeof value === "boolean") {
      normalized[key] = value;
    } else {
      normalized[key] = String(value || "").trim();
    }
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
    const complete = phase === "complete" || phase.endsWith("-complete");
    root.style.borderColor = failed ? "#dc2626" : complete ? "#059669" : "#0ea5e9";
    root.style.background = failed ? "#fef2f2" : complete ? "#ecfdf5" : "#f8fafc";

    const dot = root.querySelector("[data-tos-badge-dot]");
    if (dot) {
      const color = failed ? "#ef4444" : complete ? "#10b981" : "#0ea5e9";
      dot.style.background = color;
      dot.style.boxShadow = failed
        ? "0 0 0 5px rgba(239,68,68,.14)"
        : complete
          ? "0 0 0 5px rgba(16,185,129,.14)"
          : "0 0 0 5px rgba(14,165,233,.14)";
    }

    const titleNode = root.querySelector("[data-tos-badge-title]");
    if (titleNode) {
      titleNode.textContent = title;
    }

    const messageNode = root.querySelector("[data-tos-badge-message]");
    if (messageNode) {
      messageNode.textContent = message || "自动化正在执行";
    }

    const metaNode = root.querySelector("[data-tos-badge-meta]");
    if (metaNode) {
      const parts = [];
      const caseNumber = asText(details?.caseNumber);
      const po = asText(details?.po);
      const decision = asText(details?.decision);
      const workflowMode = asText(details?.workflowMode);
      const total = Number(details?.totalCount || 0);
      const current = Number(details?.currentCount || 0);
      const completed = Number(details?.completedCount || 0);
      const failedCount = Number(details?.failedCount || 0);
      if (caseNumber) parts.push(`Case ${caseNumber}`);
      if (po) parts.push(`PO ${po}`);
      if (decision) parts.push(`Decision ${decision}`);
      if (workflowMode) parts.push(workflowMode);
      if (total > 0 && current > 0) parts.push(`${current}/${total}`);
      if (completed > 0) parts.push(`完成 ${completed}`);
      if (failedCount > 0) parts.push(`失败 ${failedCount}`);
      metaNode.textContent = parts.join(" · ");
      metaNode.style.display = parts.length ? "block" : "none";
    }
  }, payload).catch(() => {});
}

function log(message, meta) {
  if (meta) {
    console.log(`[ms-login-executor] ${message}`, meta);
    return;
  }
  console.log(`[ms-login-executor] ${message}`);
}

async function shutdown() {
  log("Shutting down Microsoft login executor.");
  server.close(() => process.exit(0));
}
