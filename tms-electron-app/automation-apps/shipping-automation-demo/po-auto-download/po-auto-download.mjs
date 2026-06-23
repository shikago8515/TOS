import { access, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0";
const INFORNEXUS_LOGIN_PATH = "/en/trade/login.jsp";
const INFORNEXUS_HOME_PATH = "/en/trade/Homepage.jsp?nav=Homenav";
const INVOICES_VIEW_PATH = "/en/trade/InvoicesView.jsp";
const IN_PROGRESS_INVOICES_PATH = "/en/trade/InProgressInvoices";
const PAGE_RESOLVER_PATH = "/en/trade/PageResolver";
const PDF_TOPIC_NAME = "ADIDAS_FINANCIAL_INVOICE_PDF";
const execFileAsync = promisify(execFile);

export function isPoAutoDownloadRoute(requestPath) {
  return requestPath === "/run-po-auto-download-file"
    || requestPath === "/api/run-po-auto-download-file";
}

export function isPoAutoDownloadDirectoryRoute(requestPath) {
  return requestPath === "/select-download-directory"
    || requestPath === "/api/select-download-directory"
    || requestPath === "/select-po-auto-download-directory"
    || requestPath === "/api/select-po-auto-download-directory";
}

export async function createPoAutoDownloadRequestSession(options = {}) {
  const credentials = options.credentials || {};
  const config = options.config || {};
  const log = typeof options.log === "function" ? options.log : () => {};
  const runId = String(options.runId || "");
  const jar = createCookieJar();
  const loginOrigin = resolveLoginOrigin(config.loginUrl);
  const entryUrl = config.loginUrl || `${loginOrigin}/`;
  const loginUrl = new URL(INFORNEXUS_LOGIN_PATH, loginOrigin).toString();
  const homeUrl = new URL(INFORNEXUS_HOME_PATH, loginOrigin).toString();
  const invoicesViewUrl = new URL(INVOICES_VIEW_PATH, loginOrigin).toString();

  const entryResponse = await requestWithCookieJar(entryUrl, {
    headers: buildBrowserHeaders({ accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }),
    jar,
    redirect: "manual",
  });
  const entryHtml = await entryResponse.text().catch(() => "");

  const loginBody = buildLoginFormBody(credentials, entryHtml);
  const loginResponse = await requestWithCookieJar(loginUrl, {
    method: "POST",
    headers: buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      contentType: "application/x-www-form-urlencoded",
      origin: loginOrigin,
      referer: `${loginOrigin}/`,
    }),
    body: loginBody,
    jar,
    redirect: "manual",
  });

  const loginText = await loginResponse.text().catch(() => "");
  if (!hasRequiredInforNexusSessionCookies(jar)) {
    throw buildRequestLoginFailureError(loginResponse, loginText);
  }

  const location = loginResponse.headers.get("location") || "";
  const redirectedUrl = location ? new URL(location, loginUrl).toString() : homeUrl;
  await requestWithCookieJar(redirectedUrl, {
    headers: buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      referer: `${loginOrigin}/`,
    }),
    jar,
    redirect: "manual",
  }).catch(() => null);

  const invoicesViewResponse = await requestWithCookieJar(invoicesViewUrl, {
    headers: buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      referer: redirectedUrl,
    }),
    jar,
    redirect: "manual",
  });
  const invoicesText = await invoicesViewResponse.text().catch(() => "");
  if (invoicesViewResponse.status >= 400 || (invoicesViewResponse.status >= 300 && invoicesViewResponse.status < 400)) {
    throw new Error(`Infor Nexus InvoicesView request failed. HTTP ${invoicesViewResponse.status}. ${stripHtmlForMessage(invoicesText).slice(0, 240)}`);
  }
  if (isLikelyLoginPage(invoicesText)) {
    throw new Error("Infor Nexus 登录会话已失效：打开 InvoicesView 时返回登录页。请重新登录后再试。");
  }

  log("PO auto-download captured request login session.", {
    runId,
    cookieNames: jar.names(),
    finalUrl: invoicesViewUrl,
  });

  return {
    cookieHeader: jar.header(),
    cookieJar: jar,
    cookieMap: jar.entries(),
    loginOrigin,
    sToken: jar.get("sToken"),
    finalUrl: invoicesViewUrl,
    title: "",
    method: "request-login",
    authMethod: "request-login",
  };
}

export async function selectPoAutoDownloadDirectory(body = {}) {
  if (process.platform !== "win32") {
    return {
      statusCode: 501,
      body: {
        ok: false,
        message: "Directory picker is currently implemented for Windows local executors only.",
      },
    };
  }

  const initialDirectory = String(
    body?.initialDirectory
      || body?.downloadDirectory
      || body?.defaultPath
      || "",
  ).trim();

  try {
    const selectedPath = await selectWindowsDirectory(initialDirectory);
    if (!selectedPath) {
      return {
        statusCode: 200,
        body: {
          ok: false,
          canceled: true,
          path: "",
          message: "Directory selection was cancelled.",
        },
      };
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        canceled: false,
        path: selectedPath,
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
    };
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

export function createPoAutoDownloadAutomation(deps) {
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
    xlsx,
  } = deps;

  async function handleRequest(body) {
    const credentials = resolveCredentials(body);
    const poRows = extractInvoiceRowsFromWorkbookPayload(body);
    const inputFileName = normalizeUploadFileName(body);
    const headless = toBoolean(body?.headless, config.headless);
    const selectedDownloadDirectory = resolveDownloadDirectory(body);
    const downloadDirectory = await resolveRunDownloadDirectory(selectedDownloadDirectory);
    const requestConcurrency = resolveRequestConcurrency(body, config);

    const activeRun = registerActiveRun({
      action: "run-po-auto-download-file",
      browser: config.browser,
      headless,
      downloadDirectory,
      selectedDownloadDirectory,
      downloadMode: "request-first",
      inputFileName,
      inputMode: "po-auto-download",
      totalPoCount: poRows.length,
      progress: buildInitialProgress({
        downloadDirectory,
        inputFileName,
        selectedDownloadDirectory,
        totalCount: poRows.length,
      }),
    });

    try {
      const result = await runPoAutoDownloadRequestFirst({
        activeRun,
        body,
        credentials,
        downloadDirectory,
        selectedDownloadDirectory,
        inputFileName,
        headless,
        poRows,
        requestConcurrency,
        runId: activeRun.runId,
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
        downloadMode: result.downloadMode,
        inputFileName,
        progress: result.progress,
        totalPoCount: result.totalPoCount,
        downloadedPoCount: result.downloadedPoCount,
        failedPoCount: result.failedPoCount,
      });

      return {
        statusCode: result.statusCode || (result.ok ? 200 : 500),
        body: result,
      };
    } finally {
      unregisterActiveRun(activeRun.runId);
    }
  }

  async function runPoAutoDownloadRequestFirst(options) {
    const startedAt = new Date().toISOString();
    const {
      activeRun,
      body,
      credentials,
      downloadDirectory,
      selectedDownloadDirectory,
      inputFileName,
      headless,
      poRows,
      requestConcurrency,
      runId,
    } = options;

    const requestOptions = resolveRequestOptions(body, config);
    const skippedStatusResults = poRows
      .filter((row) => !isActiveInvoiceRow(row))
      .map((row) => buildStatusSkippedResult(row));
    const activeRows = poRows.filter((row) => isActiveInvoiceRow(row));
    setRunProgress(activeRun, {
      phase: "准备下载",
      message: `已读取 ${poRows.length} 行，待下载 ${activeRows.length} 个 active Invoice。`,
      totalCount: poRows.length,
      activeCount: activeRows.length,
      skippedCount: skippedStatusResults.length,
      downloadDirectory,
      selectedDownloadDirectory,
      currentInvoiceNumbers: [],
      recentResults: [],
    });

    if (activeRows.length === 0) {
      setRunProgress(activeRun, {
        phase: "已结束",
        message: "没有 STATUS=active 的 Invoice 行可下载。",
        completedCount: 0,
        failedCount: poRows.length,
        skippedCount: skippedStatusResults.length,
      });
      const result = {
        runId,
        ok: false,
        statusCode: 207,
        loginSuccess: false,
        downloadMode: "request-first",
        inputMode: "po-auto-download",
        inputFileName,
        totalPoCount: poRows.length,
        totalInvoiceCount: poRows.length,
        searchedPoCount: 0,
        searchedInvoiceCount: 0,
        downloadedPoCount: 0,
        downloadedInvoiceCount: 0,
        failedPoCount: poRows.length,
        failedInvoiceCount: poRows.length,
        skippedInvoiceCount: skippedStatusResults.length,
        pendingDownloadPoCount: 0,
        downloadPending: false,
        requestConcurrency,
        selectedDownloadDirectory,
        downloadDirectory,
        poResults: mergeSkippedAndWorkerResults(poRows, skippedStatusResults, []),
        message: "没有 STATUS=active 的 Invoice 行可下载，已记录并跳过全部行。",
        progress: activeRun?.progress || null,
        generatedAt: new Date().toISOString(),
        startedAt,
      };
      await writeRunSummary(downloadDirectory, runId, result, requestOptions);
      return result;
    }

    let authSession = null;
    try {
      setRunProgress(activeRun, {
        phase: "登录 Infor Nexus",
        message: "正在登录 Infor Nexus 并建立下载会话。",
      });
      authSession = await createRequestAuthenticatedSession(credentials, { headless, runId });
      const progressTracker = createProgressTracker(activeRun, {
        activeCount: activeRows.length,
        downloadDirectory,
        selectedDownloadDirectory,
        skippedCount: skippedStatusResults.length,
        totalCount: poRows.length,
      });
      progressTracker.setPhase("筛选并下载 Invoice", "登录成功，开始逐条搜索并下载 Invoice PDF。");
      const downloadResults = await runDownloadPool(activeRows, requestConcurrency, (row) => {
        progressTracker.start(row);
        return downloadInvoicePdfFromRequestFlow({
          authSession,
          downloadDirectory,
          loginOrigin: authSession.loginOrigin || resolveLoginOrigin(config.loginUrl),
          requestOptions,
          row,
        })
          .then((result) => progressTracker.done(result))
          .catch((error) => {
            progressTracker.fail(row, error);
            throw error;
          });
      });
      const poResults = mergeSkippedAndWorkerResults(poRows, skippedStatusResults, downloadResults);
      const searchedPoCount = downloadResults.filter((item) => item.searchOk).length;
      const failedSearchCount = activeRows.length - searchedPoCount;
      const downloadedPoCount = downloadResults.filter((item) => item.ok).length;
      const failedPoCount = poResults.length - downloadedPoCount;
      const message = `PO 自动下载完成，已下载 ${downloadedPoCount}/${activeRows.length} 个 active Invoice，跳过 ${skippedStatusResults.length} 条非 active。`;
      setRunProgress(activeRun, {
        phase: failedPoCount === 0 ? "已完成" : "未完成",
        message,
        completedCount: activeRows.length,
        downloadedCount: downloadedPoCount,
        failedCount: failedPoCount,
        currentInvoiceNumbers: [],
      });

      const result = {
        runId,
        ok: failedPoCount === 0,
        statusCode: failedPoCount === 0 ? 200 : 207,
        loginSuccess: true,
        downloadMode: "request-first",
        inputMode: "po-auto-download",
        inputFileName,
        totalPoCount: poRows.length,
        totalInvoiceCount: poRows.length,
        searchedPoCount,
        searchedInvoiceCount: searchedPoCount,
        failedSearchCount,
        downloadedPoCount,
        downloadedInvoiceCount: downloadedPoCount,
        failedPoCount,
        failedInvoiceCount: failedPoCount,
        skippedInvoiceCount: skippedStatusResults.length,
        pendingDownloadPoCount: 0,
        downloadPending: false,
        requestConcurrency,
        selectedDownloadDirectory,
        downloadDirectory,
        poResults,
        invoiceResults: poResults,
        message,
        progress: activeRun?.progress || null,
        generatedAt: new Date().toISOString(),
        finalUrl: authSession.finalUrl,
        title: authSession.title,
        authMethod: authSession.authMethod || authSession.method || "",
        startedAt,
      };

      await writeRunSummary(downloadDirectory, runId, result, requestOptions);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunProgress(activeRun, {
        phase: "异常",
        message,
        currentInvoiceNumbers: [],
        failedCount: activeRows.length,
      });
      const result = {
        runId,
        ok: false,
        statusCode: 500,
        loginSuccess: Boolean(authSession),
        downloadMode: "request-first",
        inputMode: "po-auto-download",
        inputFileName,
        totalPoCount: poRows.length,
        totalInvoiceCount: poRows.length,
        searchedPoCount: 0,
        searchedInvoiceCount: 0,
        downloadedPoCount: 0,
        downloadedInvoiceCount: 0,
        failedPoCount: poRows.length,
        failedInvoiceCount: poRows.length,
        skippedInvoiceCount: skippedStatusResults.length,
        pendingDownloadPoCount: 0,
        downloadPending: false,
        requestConcurrency,
        selectedDownloadDirectory,
        downloadDirectory,
        poResults: mergeSkippedAndWorkerResults(poRows, skippedStatusResults, activeRows.map((row) => ({
          rowIndex: row.rowIndex,
          poNo: row.poNo || row.invoiceNumber,
          invoiceNumber: row.invoiceNumber,
          status: row.status,
          ok: false,
          error: message,
        }))),
        message,
        progress: activeRun?.progress || null,
        generatedAt: new Date().toISOString(),
        finalUrl: authSession?.finalUrl || "",
        title: authSession?.title || "",
        authMethod: authSession?.authMethod || authSession?.method || "",
        startedAt,
      };
      result.invoiceResults = result.poResults;

      await writeRunSummary(downloadDirectory, runId, result, requestOptions).catch(() => {});
      return result;
    }
  }

  async function createRequestAuthenticatedSession(credentials, options = {}) {
    try {
      return await createPoAutoDownloadRequestSession({
        credentials,
        config,
        log,
        runId: options.runId,
      });
    } catch (requestError) {
      if (!canUseBrowserLoginFallback()) {
        throw requestError;
      }
      log("PO auto-download request login failed; trying browser login fallback.", {
        runId: options.runId,
        error: requestError instanceof Error ? requestError.message : String(requestError),
      });
      return createBrowserAuthenticatedSession(credentials, options, requestError);
    }
  }

  function canUseBrowserLoginFallback() {
    const engine = browserEngines?.[config.browser];
    return Boolean(engine && ensureLoggedIn);
  }

  async function createBrowserAuthenticatedSession(credentials, options = {}, requestError = null) {
    const engine = browserEngines?.[config.browser];
    if (!engine || !ensureLoggedIn) {
      throw requestError instanceof Error ? requestError : new Error("PO auto-download browser login fallback is unavailable.");
    }

    const loginOrigin = resolveLoginOrigin(config.loginUrl);
    const invoicesViewUrl = new URL(INVOICES_VIEW_PATH, loginOrigin).toString();
    const launchOptions = {
      slowMo: config.slowMo,
      ...(config.launchOptions && typeof config.launchOptions === "object" ? config.launchOptions : {}),
      headless: toBoolean(options.headless, config.headless),
    };
    const browserLaunchOptions = typeof buildVisibleBrowserLaunchOptions === "function"
      ? buildVisibleBrowserLaunchOptions(launchOptions, config.browser)
      : launchOptions;

    let browser = null;
    let context = null;
    let page = null;
    try {
      browser = await engine.launch(browserLaunchOptions);
      context = await browser.newContext({ viewport: null });
      page = await context.newPage();
      page.setDefaultTimeout(config.navigationTimeoutMs);
      page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

      await page.goto(config.loginUrl || `${loginOrigin}/`, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await ensureLoggedIn(page, credentials);
      if (config.postLoginWaitMs > 0) {
        await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
      }
      await page.goto(invoicesViewUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });

      const jar = createCookieJarFromBrowserCookies(await context.cookies(loginOrigin));
      if (!hasRequiredInforNexusSessionCookies(jar)) {
        throw new Error("Infor Nexus 浏览器登录未建立下载会话：缺少 userToken/JSESSIONID cookies。请重新登录，或联系管理员确认账号状态。");
      }

      const title = typeof safePageTitle === "function"
        ? await safePageTitle(page)
        : await page.title().catch(() => "");
      const finalUrl = typeof safePageUrl === "function"
        ? safePageUrl(page)
        : page.url();

      log("PO auto-download captured browser login fallback session.", {
        runId: options.runId,
        cookieNames: jar.names(),
        finalUrl: finalUrl || invoicesViewUrl,
      });

      return {
        cookieHeader: jar.header(),
        cookieJar: jar,
        cookieMap: jar.entries(),
        loginOrigin,
        sToken: jar.get("sToken"),
        finalUrl: finalUrl || invoicesViewUrl,
        title,
        method: "browser-login-fallback",
        authMethod: "browser-login-fallback",
      };
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  }

  function extractInvoiceRowsFromWorkbookPayload(body) {
    if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) {
      const error = new Error("xlsx runtime is not available for PO auto download.");
      error.statusCode = 500;
      throw error;
    }

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

    let workbook;
    try {
      workbook = xlsx.read(workbookBuffer, { type: "buffer" });
    } catch (error) {
      const parseError = new Error(`Failed to parse uploaded workbook: ${error.message || error}`);
      parseError.statusCode = 400;
      throw parseError;
    }

    const sheetName = resolveWorkbookSheetName(workbook, body?.sheetName);
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

    const invoiceRows = rows
      .map((row, index) => {
        const invoiceNumber = extractInvoiceNumberValue(row);
        const status = extractStatusValue(row);
        return {
          rowIndex: index + 2,
          invoiceNumber,
          poNo: invoiceNumber,
          status,
          originalRow: row,
        };
      })
      .filter((row) => row.invoiceNumber || row.status);

    if (invoiceRows.length === 0) {
      const error = new Error("Uploaded workbook must contain at least one INVOICE NUMBER row.");
      error.statusCode = 400;
      throw error;
    }

    return invoiceRows;
  }

  return { handleRequest };
}

function resolveDownloadDirectory(body) {
  const rawValue = String(
    body?.downloadDirectory
      || body?.saveDirectory
      || body?.downloadPath
      || body?.targetDirectory
      || "",
  ).trim();
  if (!rawValue) {
    const error = new Error("downloadDirectory must be provided.");
    error.statusCode = 400;
    throw error;
  }
  return path.resolve(rawValue);
}

async function resolveRunDownloadDirectory(selectedDownloadDirectory) {
  await mkdir(selectedDownloadDirectory, { recursive: true });
  const baseName = `TC Invoice ${formatLocalDateSegment(new Date())}`;
  const directoryName = await nextAvailableDirectoryName(selectedDownloadDirectory, baseName);
  const runDirectory = path.join(selectedDownloadDirectory, directoryName);
  await mkdir(runDirectory, { recursive: false });
  return runDirectory;
}

function formatLocalDateSegment(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function nextAvailableDirectoryName(parentDirectory, baseName) {
  let candidate = baseName;
  let index = 1;
  while (await fileExists(path.join(parentDirectory, candidate))) {
    candidate = `${baseName}-${index}`;
    index += 1;
  }
  return candidate;
}

async function selectWindowsDirectory(initialDirectory) {
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.ShowInTaskbar = $false",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.Width = 1",
    "$owner.Height = 1",
    "$owner.Opacity = 0",
    "$owner.Show()",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select TOS download folder'",
    "$dialog.ShowNewFolderButton = $true",
    "if ($env:TOS_INITIAL_DIRECTORY -and (Test-Path -LiteralPath $env:TOS_INITIAL_DIRECTORY)) { $dialog.SelectedPath = $env:TOS_INITIAL_DIRECTORY }",
    "$result = $dialog.ShowDialog($owner)",
    "$owner.Close()",
    "$owner.Dispose()",
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath; exit 0 }",
    "exit 2",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: {
          ...process.env,
          TOS_INITIAL_DIRECTORY: initialDirectory || "",
        },
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
    return String(stdout || "").trim();
  } catch (error) {
    if (error?.code === 2) {
      return "";
    }
    throw error;
  }
}

function resolveRequestConcurrency(body, config) {
  const value = Number(
    body?.requestConcurrency
      || config?.poAutoDownload?.requestConcurrency
      || DEFAULT_CONCURRENCY,
  );
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.min(Math.max(Math.floor(value), 1), 8);
}

function resolveRequestOptions(body, config) {
  const configured = config?.poAutoDownload && typeof config.poAutoDownload === "object"
    ? config.poAutoDownload
    : {};
  return {
    saveDiagnostics: Boolean(body?.saveDiagnostics ?? configured.saveDiagnostics ?? false),
    timeoutMs: Number(body?.downloadTimeoutMs || configured.downloadTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS),
  };
}

function shouldSaveDiagnostics(requestOptions) {
  return Boolean(requestOptions?.saveDiagnostics);
}

function buildInitialProgress(options = {}) {
  return {
    phase: "等待开始",
    message: "等待上传 Excel 并发起下载。",
    totalCount: Number(options.totalCount || 0),
    activeCount: 0,
    completedCount: 0,
    downloadedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    currentInvoiceNumbers: [],
    recentResults: [],
    selectedDownloadDirectory: options.selectedDownloadDirectory || "",
    downloadDirectory: options.downloadDirectory || "",
    inputFileName: options.inputFileName || "",
    updatedAt: new Date().toISOString(),
  };
}

function setRunProgress(activeRun, patch = {}) {
  if (!activeRun) return null;
  activeRun.progress = {
    ...(activeRun.progress || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return activeRun.progress;
}

function createProgressTracker(activeRun, options = {}) {
  const current = new Set();
  const recentResults = [];
  let completedCount = 0;
  let downloadedCount = 0;
  let failedCount = 0;

  function update(patch = {}) {
    return setRunProgress(activeRun, {
      totalCount: Number(options.totalCount || 0),
      activeCount: Number(options.activeCount || 0),
      skippedCount: Number(options.skippedCount || 0),
      completedCount,
      downloadedCount,
      failedCount,
      currentInvoiceNumbers: Array.from(current),
      recentResults: recentResults.slice(0, 8),
      selectedDownloadDirectory: options.selectedDownloadDirectory || "",
      downloadDirectory: options.downloadDirectory || "",
      ...patch,
    });
  }

  function remember(result) {
    recentResults.unshift({
      invoiceNumber: result?.invoiceNumber || result?.poNo || "",
      ok: Boolean(result?.ok),
      error: result?.error || "",
      fileName: result?.fileName || "",
      step: result?.step || "",
      updatedAt: new Date().toISOString(),
    });
    recentResults.splice(8);
  }

  return {
    setPhase(phase, message) {
      update({ phase, message });
    },
    start(row) {
      const invoiceNumber = resolveInvoiceFilterValue(row);
      if (invoiceNumber) current.add(invoiceNumber);
      update({
        phase: "下载中",
        message: invoiceNumber
          ? `正在处理 Invoice ${invoiceNumber}。`
          : "正在处理 Invoice。",
      });
    },
    done(result) {
      const invoiceNumber = result?.invoiceNumber || result?.poNo || "";
      if (invoiceNumber) current.delete(invoiceNumber);
      completedCount += 1;
      if (result?.ok) downloadedCount += 1;
      else failedCount += 1;
      remember(result);
      update({
        phase: "下载中",
        message: `已处理 ${completedCount}/${Number(options.activeCount || 0)}，已下载 ${downloadedCount}，失败 ${failedCount}。`,
      });
      return result;
    },
    fail(row, error) {
      const invoiceNumber = resolveInvoiceFilterValue(row);
      if (invoiceNumber) current.delete(invoiceNumber);
      completedCount += 1;
      failedCount += 1;
      remember({
        invoiceNumber,
        poNo: invoiceNumber,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      update({
        phase: "下载中",
        message: `已处理 ${completedCount}/${Number(options.activeCount || 0)}，已下载 ${downloadedCount}，失败 ${failedCount}。`,
      });
    },
  };
}

function resolveWorkbookSheetName(workbook, preferredSheetName) {
  if (preferredSheetName && workbook?.SheetNames?.includes(preferredSheetName)) {
    return preferredSheetName;
  }
  return Array.isArray(workbook?.SheetNames) ? workbook.SheetNames[0] || "" : "";
}

function extractInvoiceNumberValue(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const preferredKeys = [
    "INVOICE NUMBER",
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
      || normalizedKey === "invoice";
  });
  return invoiceKey ? String(row[invoiceKey] ?? "").trim() : "";
}

function extractStatusValue(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const preferredKeys = ["STATUS", "Status", "status"];
  for (const key of preferredKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const statusKey = Object.keys(row).find((key) => normalizeHeaderName(key) === "status");
  return statusKey ? String(row[statusKey] ?? "").trim() : "";
}

function normalizeHeaderName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveLoginOrigin(loginUrl) {
  try {
    const parsed = new URL(loginUrl || "https://network.infornexus.com");
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://network.infornexus.com";
  }
}

function buildLoginFormBody(credentials, loginPageHtml = "") {
  const discoveredFields = extractLoginFormFields(loginPageHtml);
  const form = new URLSearchParams(discoveredFields);
  const username = String(credentials?.username || "");
  const password = String(credentials?.password || "");
  const usernameFields = findLoginFieldNames(discoveredFields, {
    fallback: ["username", "userName", "userId", "login", "j_username"],
    pattern: /(^|_)(user(name|id)?|login|j_username)$/i,
  });
  const passwordFields = findLoginFieldNames(discoveredFields, {
    fallback: ["password", "j_password"],
    pattern: /(password|j_password|passwd|pwd)$/i,
  });

  for (const field of usernameFields) {
    form.set(field, username);
  }
  for (const field of passwordFields) {
    form.set(field, password);
  }
  form.set("Login", "Log In");
  form.set("submit", "Log In");
  return form.toString();
}

function extractLoginFormFields(html) {
  const fields = [];
  const inputPattern = /<input\b[^>]*>/gi;
  const matches = String(html || "").match(inputPattern) || [];
  for (const inputHtml of matches) {
    const name = readHtmlAttribute(inputHtml, "name");
    if (!name) continue;
    const value = readHtmlAttribute(inputHtml, "value");
    fields.push([name, value]);
  }
  return fields;
}

function readHtmlAttribute(html, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(html || "").match(pattern);
  if (!match) return "";
  return htmlDecode(match[2] ?? match[3] ?? match[4] ?? "");
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findLoginFieldNames(discoveredFields, options) {
  const names = discoveredFields
    .map(([name]) => String(name || ""))
    .filter((name) => options.pattern.test(name));
  const merged = [...names, ...(options.fallback || [])];
  return Array.from(new Set(merged.filter(Boolean)));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBrowserHeaders(options = {}) {
  const headers = {
    Accept: options.accept || "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "Cache-Control": "max-age=0",
    "User-Agent": DEFAULT_USER_AGENT,
    "Upgrade-Insecure-Requests": "1",
  };

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }
  if (options.origin) {
    headers.Origin = options.origin;
  }
  if (options.referer) {
    headers.Referer = options.referer;
  }
  return headers;
}

async function requestWithCookieJar(url, options = {}) {
  const jar = options.jar;
  const headers = {
    ...(options.headers || {}),
  };
  const cookieHeader = jar?.header?.() || "";
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
    redirect: options.redirect || "manual",
    signal: options.signal,
  });
  jar?.storeFromHeaders?.(response.headers);
  return response;
}

async function fetchWithAuthSession(url, options = {}) {
  if (options.authSession?.cookieJar) {
    return requestWithCookieJar(url, {
      method: options.method || "GET",
      headers: options.headers,
      body: options.body,
      jar: options.authSession.cookieJar,
      redirect: options.redirect || "manual",
      signal: options.signal,
    });
  }

  return fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.headers || {}),
      Cookie: options.authSession?.cookieHeader || "",
    },
    body: options.body,
    redirect: options.redirect || "manual",
    signal: options.signal,
  });
}

export function createCookieJarFromBrowserCookies(browserCookies = []) {
  const jar = createCookieJar();
  for (const cookie of Array.isArray(browserCookies) ? browserCookies : []) {
    jar.set(cookie?.name, cookie?.value);
  }
  return jar;
}

function createCookieJar() {
  const cookies = new Map();

  return {
    set(name, value) {
      const cookieName = String(name || "").trim();
      if (!cookieName) return;
      cookies.set(cookieName, String(value ?? ""));
    },
    get(name) {
      return cookies.get(name) || "";
    },
    has(name) {
      return cookies.has(name);
    },
    header() {
      return Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
    names() {
      return Array.from(cookies.keys());
    },
    entries() {
      return Object.fromEntries(cookies.entries());
    },
    storeFromHeaders(headers) {
      for (const value of readSetCookieHeaders(headers)) {
        const parsed = parseSetCookie(value);
        if (parsed?.name) {
          cookies.set(parsed.name, parsed.value);
        }
      }
    },
  };
}

function readSetCookieHeaders(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return splitCombinedSetCookieHeader(raw);
}

function splitCombinedSetCookieHeader(value) {
  const parts = [];
  let current = "";
  let inExpires = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const tail = value.slice(index, index + 8).toLowerCase();
    if (tail === "expires=") {
      inExpires = true;
    }
    if (inExpires && char === ";") {
      inExpires = false;
    }
    if (!inExpires && char === "," && /\s*[^=;,\s]+=/.test(value.slice(index + 1, index + 80))) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSetCookie(value) {
  const firstPart = String(value || "").split(";")[0] || "";
  const separatorIndex = firstPart.indexOf("=");
  if (separatorIndex <= 0) return null;
  return {
    name: firstPart.slice(0, separatorIndex).trim(),
    value: firstPart.slice(separatorIndex + 1).trim(),
  };
}

function uniquePoRows(rows) {
  const seen = new Set();
  const uniqueRows = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const poNo = String(row?.poNo || "").trim();
    if (!poNo || seen.has(poNo)) continue;
    seen.add(poNo);
    uniqueRows.push({ ...row, poNo });
  }
  return uniqueRows;
}

function isActiveInvoiceRow(row) {
  return String(row?.status || "").trim().toLowerCase() === "active";
}

function buildStatusSkippedResult(row) {
  const status = String(row?.status || "").trim();
  const invoiceNumber = String(row?.invoiceNumber || row?.poNo || "").trim();
  return {
    rowIndex: row.rowIndex,
    poNo: invoiceNumber,
    invoiceNumber,
    status,
    ok: false,
    skipped: true,
    step: "STATUS validation",
    error: `STATUS must be active. Current STATUS: ${status || "(blank)"}.`,
  };
}

function mergeSkippedAndWorkerResults(rows, skippedResults, workerResults) {
  const skippedByRowIndex = new Map(
    skippedResults.map((item) => [Number(item?.rowIndex || 0), item]),
  );
  const workerByRowIndex = new Map(
    workerResults.map((item) => [Number(item?.rowIndex || 0), item]),
  );

  return rows.map((row) => {
    const rowIndex = Number(row?.rowIndex || 0);
    return skippedByRowIndex.get(rowIndex)
      || workerByRowIndex.get(rowIndex)
      || {
        rowIndex: row.rowIndex,
        poNo: row.poNo || row.invoiceNumber,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        ok: false,
        error: "Invoice row was not processed.",
      };
  });
}

async function runDownloadPool(rows, concurrency, worker) {
  const results = new Array(rows.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < rows.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const row = rows[currentIndex];
      try {
        results[currentIndex] = await worker(row);
      } catch (error) {
        results[currentIndex] = {
          rowIndex: row.rowIndex,
          poNo: row.poNo || row.invoiceNumber,
          invoiceNumber: row.invoiceNumber,
          status: row.status,
          ok: false,
          searchOk: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => runWorker()),
  );
  return results;
}

async function downloadInvoicePdfFromRequestFlow(options) {
  const {
    authSession,
    downloadDirectory,
    loginOrigin,
    requestOptions,
    row,
  } = options;
  const invoiceNumber = resolveInvoiceFilterValue(row);
  const searchResult = await postInProgressInvoiceSearch({
    authSession,
    downloadDirectory,
    loginOrigin,
    requestOptions,
    row,
  });
  const searchHtml = searchResult.html || "";
  const publicSearchResult = withoutHtml(searchResult);
  const pageResolverUrl = extractInvoicePageResolverUrl(searchHtml, loginOrigin, invoiceNumber);
  if (!pageResolverUrl) {
    throw new Error(`Invoice ${invoiceNumber}: PageResolver URL was not found in InProgressInvoices response.`);
  }

  const invoicePage = await fetchInvoicePage({
    authSession,
    downloadDirectory,
    invoiceNumber,
    loginOrigin,
    pageResolverUrl,
    requestOptions,
  });
  const pdfUrl = extractInvoicePdfUrl(invoicePage.html, loginOrigin);
  if (!pdfUrl) {
    throw new Error(`Invoice ${invoiceNumber}: PDF dyncon URL was not found in PageResolver response.`);
  }

  const pdfResult = await downloadInvoicePdfFile({
    authSession,
    downloadDirectory,
    invoiceNumber,
    pageResolverUrl,
    pdfUrl,
    requestOptions,
  });

  return {
    ...publicSearchResult,
    ...pdfResult,
    searchOk: true,
    invoicePageFileName: invoicePage.fileName,
    invoicePageFilePath: invoicePage.filePath,
    pageResolverUrl,
    pdfUrl,
    ok: true,
  };
}

async function fetchInvoicePage(options) {
  const {
    authSession,
    downloadDirectory,
    invoiceNumber,
    loginOrigin,
    pageResolverUrl,
    requestOptions,
  } = options;
  const timeoutMs = Number.isFinite(requestOptions?.timeoutMs)
    ? Math.max(requestOptions.timeoutMs, 5000)
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const referer = new URL(IN_PROGRESS_INVOICES_PATH, loginOrigin).toString();

  try {
    const response = await fetchWithAuthSession(pageResolverUrl, {
      authSession,
      method: "GET",
      headers: {
        ...buildBrowserHeaders({
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          referer,
        }),
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    const html = await response.text().catch(() => "");
    if (!response.ok) {
      throw new Error(`PageResolver HTTP ${response.status} ${response.statusText}${html ? `: ${html.slice(0, 240)}` : ""}`);
    }
    if (isLikelyLoginPage(html)) {
      throw new Error("Infor Nexus session expired while opening PageResolver.");
    }

    const result = {
      html,
      fileName: "",
      filePath: "",
      status: response.status,
      contentType: response.headers.get("content-type") || "",
    };

    if (shouldSaveDiagnostics(requestOptions)) {
      const resultDirectory = path.join(downloadDirectory, "po-auto-download-invoice-pages");
      await mkdir(resultDirectory, { recursive: true });
      const baseFileName = sanitizeFileName(`invoice-page-${invoiceNumber}.html`) || "invoice-page.html";
      const fileName = await nextAvailableFileName(resultDirectory, baseFileName);
      const filePath = path.join(resultDirectory, fileName);
      await writeFile(filePath, html, "utf8");
      result.fileName = fileName;
      result.filePath = filePath;
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadInvoicePdfFile(options) {
  const {
    authSession,
    downloadDirectory,
    invoiceNumber,
    pageResolverUrl,
    pdfUrl,
    requestOptions,
  } = options;
  const timeoutMs = Number.isFinite(requestOptions?.timeoutMs)
    ? Math.max(requestOptions.timeoutMs, 5000)
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchWithAuthSession(pdfUrl, {
      authSession,
      method: "GET",
      headers: {
        ...buildBrowserHeaders({
          accept: "application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          referer: pageResolverUrl,
        }),
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const errorText = buffer.toString("utf8", 0, Math.min(buffer.length, 240));
      throw new Error(`Invoice PDF HTTP ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`);
    }
    if (!buffer.length) {
      throw new Error("Invoice PDF response was empty.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("pdf") && buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
      throw new Error(`Invoice PDF response was not a PDF. content-type=${contentType || "(blank)"}`);
    }

    const baseName = sanitizeFileName(`TC Invoice ${invoiceNumber}.pdf`) || "TC Invoice.pdf";
    const fileName = await nextAvailableFileName(downloadDirectory, baseName);
    const filePath = path.join(downloadDirectory, fileName);
    await writeFile(filePath, buffer);
    return {
      fileName,
      filePath,
      contentType,
      size: buffer.length,
      downloadedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function postInProgressInvoiceSearch(options) {
  const {
    authSession,
    downloadDirectory,
    loginOrigin,
    requestOptions,
    row,
  } = options;
  const poNo = String(row?.poNo || "").trim();
  const invoiceFilterValue = resolveInvoiceFilterValue(row);
  if (!invoiceFilterValue) {
    throw new Error(`Row ${row?.rowIndex || ""} does not contain a PO No or Invoice Number value.`);
  }

  const url = new URL(IN_PROGRESS_INVOICES_PATH, loginOrigin).toString();
  const formBody = buildInProgressInvoicesBody({
    invoiceFilterValue,
    sToken: authSession.sToken || authSession.cookieMap?.sToken || parseCookieHeader(authSession.cookieHeader).sToken || "",
  });
  const timeoutMs = Number.isFinite(requestOptions?.timeoutMs)
    ? Math.max(requestOptions.timeoutMs, 5000)
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    ...buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      contentType: "application/x-www-form-urlencoded",
      origin: loginOrigin,
      referer: url,
    }),
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
  };

  try {
    const response = await fetchWithAuthSession(url, {
      authSession,
      method: "POST",
      headers,
      body: formBody,
      redirect: "manual",
      signal: controller.signal,
    });

    const html = await response.text().catch(() => "");
    if (!response.ok) {
      throw new Error(`InProgressInvoices HTTP ${response.status} ${response.statusText}${html ? `: ${html.slice(0, 240)}` : ""}`);
    }
    if (isLikelyLoginPage(html)) {
      throw new Error("Infor Nexus session expired while searching InProgressInvoices.");
    }

    const result = {
      rowIndex: row.rowIndex,
      poNo,
      invoiceNumber: invoiceFilterValue,
      status: row.status,
      invoiceFilterValue,
      ok: true,
      searchOk: true,
      url,
      method: "POST",
      resultFileName: "",
      resultFilePath: "",
      httpStatus: response.status,
      contentType: response.headers.get("content-type") || "",
      size: Buffer.byteLength(html, "utf8"),
      html,
    };

    if (shouldSaveDiagnostics(requestOptions)) {
      const resultDirectory = path.join(downloadDirectory, "po-auto-download-search-pages");
      await mkdir(resultDirectory, { recursive: true });
      const baseFileName = sanitizeFileName(`invoice-search-${invoiceFilterValue || poNo}.html`) || "invoice-search.html";
      const fileName = await nextAvailableFileName(resultDirectory, baseFileName);
      const filePath = path.join(resultDirectory, fileName);
      await writeFile(filePath, html, "utf8");
      result.resultFileName = fileName;
      result.resultFilePath = filePath;
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveInvoiceFilterValue(row) {
  return String(row?.invoiceNumber || row?.poNo || "").trim();
}

function buildInProgressInvoicesBody(options) {
  const form = new URLSearchParams();
  const fields = [
    ["resetGroup", ""],
    ["userAction", ""],
    ["InProgressInvoicePageManagerSortColumn", ""],
    ["InProgressInvoicePageManagerSort", ""],
    ["PAGEPERF", "161"],
    ["InProgressInvoicePageManagerTotalSize", "1"],
    ["sToken", options.sToken || ""],
    ["InProgressInvoicePageManagerinvoiceFilterInvoice", options.invoiceFilterValue || ""],
    ["InProgressInvoicePageManagerinvoiceFilterContract", ""],
    ["InProgressInvoicePageManagerinvoiceFilterShipmentStatus", ""],
    ["InProgressInvoicePageManagerinvoiceFilterSellerBuyer", ""],
    ["InProgressInvoicePageManagerinvoiceFilterSellerBuyerold", ""],
    ["InProgressInvoicePageManagerinvoiceFilterSellerBuyerOrgID", ""],
    ["sellerBuyerOrgType", ""],
    ["InProgressInvoicePageManagerinvoiceFilterType", ""],
    ["InProgressInvoicePageManagerJumpToPage", ""],
    ["hiddenAutoSubmitPrevention", ""],
    ["InProgressInvoicePageManagerbrowseDays", ""],
    ["InProgressInvoicePageManagerBufferSize", "75"],
    ["InProgressInvoicePageManagerBufferStartOffset", "1"],
    ["InProgressInvoicePageManagerBufferEndOffset", "1"],
    ["InProgressInvoicePageManagerPreviousBufferSize", "75"],
  ];
  for (const [key, value] of fields) {
    form.set(key, value);
  }
  return form.toString();
}

function isLikelyLoginPage(html) {
  const normalized = String(html || "").toLowerCase();
  return normalized.includes("login.jsp")
    && normalized.includes("password")
    && !normalized.includes("inprogressinvoicepagemanager");
}

function hasRequiredInforNexusSessionCookies(jar) {
  return Boolean(jar?.has?.("userToken") && jar?.has?.("JSESSIONID"));
}

function buildRequestLoginFailureError(response, html) {
  if (isAccessCodeChallengePage(html)) {
    return new Error("Infor Nexus 登录需要 Access Code：账号进入 e-Identity 验证流程。请检查 User ID / Password 是否正确，或联系管理员确认账号权限。");
  }
  if (isLikelyLoginPage(html)) {
    return new Error("Infor Nexus 登录失败：登录请求返回登录页，未建立下载会话。请检查 User ID / Password，或确认账号是否需要 Access Code。");
  }
  const status = Number(response?.status || 0);
  if (status >= 400) {
    return new Error(`Infor Nexus 登录请求失败：HTTP ${status}。${stripHtmlForMessage(html).slice(0, 160)}`);
  }
  return new Error("Infor Nexus 登录未建立下载会话：缺少 userToken/JSESSIONID cookies。请重新登录，或联系管理员确认账号状态。");
}

function isAccessCodeChallengePage(html) {
  const text = stripHtmlForMessage(html);
  return /Access Code/i.test(text)
    && /(e-Identity|without providing an Access Code|required to log in)/i.test(text);
}

function stripHtmlForMessage(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutHtml(result) {
  const { html, ...rest } = result || {};
  return rest;
}

function extractInvoicePageResolverUrl(html, loginOrigin, invoiceNumber) {
  const normalizedInvoice = String(invoiceNumber || "").toLowerCase();
  const candidates = extractHtmlUrlCandidates(html, loginOrigin)
    .filter((candidate) => {
      const url = candidate.url.toLowerCase();
      return url.includes(PAGE_RESOLVER_PATH.toLowerCase())
        && url.includes("pageresolvertype=invoicepageresolver")
        && url.includes("destination=commercialinvoice");
    });

  if (candidates.length === 0) {
    return "";
  }

  const scored = candidates.map((candidate) => {
    const context = candidate.context.toLowerCase();
    let score = 0;
    if (normalizedInvoice && context.includes(normalizedInvoice)) score += 100;
    if (candidate.url.includes("originType=Shipment")) score += 20;
    if (candidate.url.includes("originKey=")) score += 10;
    return { ...candidate, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.url || "";
}

function extractInvoicePdfUrl(html, loginOrigin) {
  const candidates = extractHtmlUrlCandidates(html, loginOrigin)
    .filter((candidate) => {
      const url = candidate.url.toLowerCase();
      return url.includes("/dyncon/")
        && url.includes("rendertype=pdf")
        && url.includes("type=commercialinvoice");
    });

  if (candidates.length === 0) {
    return "";
  }

  const scored = candidates.map((candidate) => {
    const url = candidate.url.toLowerCase();
    let score = 0;
    if (url.includes(`topicname=${PDF_TOPIC_NAME.toLowerCase()}`)) score += 100;
    if (url.includes("producer=platformtemplateproducer")) score += 20;
    if (url.includes("ishuman=true")) score += 10;
    return { ...candidate, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.url || "";
}

function extractHtmlUrlCandidates(html, loginOrigin) {
  const source = htmlDecode(String(html || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
  const candidates = [];
  const patterns = [
    /(?:href|src|data-url|data-href)\s*=\s*["']([^"']+)["']/gi,
    /["']([^"']*(?:\/en\/trade\/PageResolver|\/dyncon\/\?)[^"']*)["']/gi,
    /(\/(?:en\/trade\/PageResolver|dyncon\/)\?[^"'<>\\\s]+)/gi,
    /\b(PageResolver\?[^"'<>\\\s]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const rawUrl = match[1] || match[0] || "";
      const url = normalizeHtmlUrlCandidate(rawUrl, loginOrigin);
      if (!url) continue;
      const start = Math.max(0, match.index - 700);
      const end = Math.min(source.length, match.index + rawUrl.length + 700);
      candidates.push({
        url,
        context: source.slice(start, end),
      });
    }
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function normalizeHtmlUrlCandidate(value, loginOrigin) {
  const cleaned = htmlDecode(String(value || ""))
    .replace(/&amp;/g, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!cleaned || cleaned.startsWith("javascript:") || cleaned.startsWith("#")) {
    return "";
  }

  try {
    const origin = new URL(loginOrigin).origin;
    if (/^[a-z][a-z\d+.-]*:/i.test(cleaned)) {
      return new URL(cleaned).toString();
    }
    if (cleaned.startsWith("//")) {
      return new URL(`https:${cleaned}`).toString();
    }
    if (cleaned.startsWith("/")) {
      return new URL(cleaned, origin).toString();
    }
    if (/^PageResolver(?:[?#]|$)/i.test(cleaned)) {
      return new URL(`/en/trade/${cleaned}`, origin).toString();
    }
    if (/^dyncon(?:\/|\?)/i.test(cleaned)) {
      const normalized = cleaned.startsWith("dyncon/") ? cleaned : cleaned.replace(/^dyncon\?/, "dyncon/?");
      return new URL(`/${normalized}`, origin).toString();
    }
    return new URL(cleaned, `${origin}/en/trade/`).toString();
  } catch {
    return "";
  }
}

function parseCookieHeader(value) {
  const entries = [];
  for (const part of String(value || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    entries.push([
      trimmed.slice(0, separatorIndex).trim(),
      trimmed.slice(separatorIndex + 1).trim(),
    ]);
  }
  return Object.fromEntries(entries);
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function nextAvailableFileName(directory, fileName) {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let index = 1;
  while (await fileExists(path.join(directory, candidate))) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  return candidate;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeRunSummary(downloadDirectory, runId, result, requestOptions = {}) {
  if (!shouldSaveDiagnostics(requestOptions)) {
    return;
  }

  const summaryPath = path.join(downloadDirectory, `po-auto-download-${sanitizeFileName(runId)}-result.json`);
  await writeFile(summaryPath, JSON.stringify(result, null, 2), "utf8");
  result.artifacts = {
    ...(result.artifacts || {}),
    summaryPath,
  };
}
