import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync, unzipSync } from "node:zlib";
import { downloadPackingManifestPdfByDetailRequest } from "./detail-request.mjs";
import { showPackingListAutomationBadge } from "./progress-overlay.mjs";

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0";
const INFORNEXUS_LOGIN_PATH = "/en/trade/login.jsp";
const INFORNEXUS_HOME_PATH = "/en/trade/Homepage.jsp?nav=Homenav";
const PACKING_MANIFEST_VIEW_PATH = "/en/trade/PackingManifestView.jsp";
const FLEX_VIEW_RPC_PATH = "/remotes/f2.bridge/inline.gtnexus.trade.flexView";
const FLEX_VIEW_POST_WAIT_MS = 15000;
const PACKING_MANIFEST_RESULT_WAIT_MS = 2500;
const PACKING_MANIFEST_APPLY_RESULT_FAST_WAIT_MS = 900;
const PACKING_MANIFEST_PDF_WAIT_MS = 30000;

export async function runPackingListAutoDownloadWorkflow(options) {
  const {
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    downloadDirectory,
    ensureLoggedIn,
    headless,
    inputFileName,
    log = () => {},
    safePageTitle,
    safePageUrl,
    workbook,
  } = options;
  const generatedAt = new Date().toISOString();
  const groups = Array.isArray(workbook?.groups) ? workbook.groups : [];
  const poNumbers = Array.isArray(workbook?.poNumbers) ? workbook.poNumbers : [];
  const resumePlan = buildPackingListResumePlan({
    checkpoint: options.resumeCheckpoint || options.checkpoint?.snapshot || options.checkpoint,
    groups,
    mode: options.resumeMode,
  });
  const runnableGroups = resumePlan.groups;
  const runnablePoNumbers = collectPackingListPoNumbers(runnableGroups);
  if (groups.length === 0 || poNumbers.length === 0) {
    const error = new Error("自动下载箱单 Excel 中没有可用于查询的 PO 号。");
    error.statusCode = 400;
    throw error;
  }

  await mkdir(downloadDirectory, { recursive: true });
  setRunProgress(activeRun, {
    phase: "登录 Infor Nexus",
    message: "正在打开本机浏览器并复用登录态。",
    downloadDirectory,
    totalCount: groups.length,
    totalGroupCount: groups.length,
    totalPoCount: poNumbers.length,
    currentPackingListNumbers: [groups[0]?.no || ""].filter(Boolean),
    currentPoNumbers: groups[0]?.poNumbers?.slice(0, 1) || [],
  });
  let requestSession = null;
  if (canUseBrowserLoginFallback({ browserEngines, config, ensureLoggedIn })) {
    requestSession = {
      authMethod: "browser-login-fallback",
      cookieMap: {},
      loginOrigin: resolveLoginOrigin(config.loginUrl),
    };
  } else {
    requestSession = await createPackingListHomeRequestSession({
      config,
      credentials,
      log,
      runId: activeRun.runId,
    });
  }
  const browserResult = await openPackingManifestAndDownloadGroups({
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    downloadDirectory,
    ensureLoggedIn,
    groups: runnableGroups,
    allGroups: groups,
    headless,
    log,
    requestSession,
    safePageTitle,
    safePageUrl,
    skippedGroupResults: resumePlan.skippedGroupResults,
    checkpoint: options.checkpoint,
    resumeMode: resumePlan.mode || options.resumeMode || "new",
  });
  const groupResults = [
    ...resumePlan.skippedGroupResults,
    ...(browserResult.groupResults || []),
  ];
  const downloadedPackingListCount = groupResults.filter((item) => item.ok).length;
  const failedPackingListCount = groupResults.length - downloadedPackingListCount;
  const downloadedFilePaths = groupResults
    .filter((item) => item.ok && item.filePath)
    .map((item) => item.filePath);
  const failedPackingLists = groupResults
    .filter((item) => !item.ok)
    .map((item) => normalizeFailedPackingListResult(item));
  const firstSuccessfulAttempt = groupResults
    .flatMap((group) => group.attempts || [])
    .find((attempt) => attempt.ok);

  const result = {
    ok: failedPackingListCount === 0,
    statusCode: failedPackingListCount === 0 ? 200 : 207,
    runId: activeRun.runId,
    generatedAt,
    stage: "自动下载箱单 PDF 下载",
    message: failedPackingListCount === 0
      ? `自动下载箱单完成，已下载 ${downloadedPackingListCount}/${groups.length} 个 NO 批次。`
      : `自动下载箱单未全部完成，已下载 ${downloadedPackingListCount}/${groups.length} 个 NO 批次，失败 ${failedPackingListCount} 个。`,
    detail: "当前按 NO 批次处理：同一 NO 下 PO No1 逐个搜索，任意一个 PO 搜到 PackingManifest 并保存 PDF 后，该 NO 批次即算成功。",
    inputFileName,
    inputMode: "packing-list-auto-download",
    automationImplemented: true,
    downloadImplemented: true,
    searchStepImplemented: true,
    downloadDirectory,
    homeOpened: true,
    packingManifestOpened: browserResult.packingManifestOpened,
    poFilterFilled: groupResults.some((item) => item.attempts?.some((attempt) => attempt.poFilterFilled)),
    flexViewPostObserved: groupResults.some((item) => item.attempts?.some((attempt) => attempt.flexViewPostObserved)),
    flexViewPostStatus: firstSuccessfulAttempt?.flexViewPostStatus || 0,
    flexViewPostUrl: firstSuccessfulAttempt?.flexViewPostUrl || "",
    authMethod: browserResult.authMethod || requestSession.authMethod,
    finalUrl: browserResult.finalUrl,
    title: browserResult.title,
    searchedPoNumber: firstSuccessfulAttempt?.poNumber || poNumbers[0],
    totalGroupCount: groups.length,
    totalPoCount: poNumbers.length,
    totalPackingListCount: groups.length,
    downloadedPackingListCount,
    downloadedPoCount: downloadedPackingListCount,
    completedPoCount: downloadedPackingListCount,
    failedPackingListCount,
    failedPoCount: failedPackingListCount,
    failedPackingLists,
    failedNoBatches: failedPackingLists,
    downloadedFilePaths,
    firstDownloadedFilePath: downloadedFilePaths[0] || "",
    groupResults,
    poNumbers,
    checkpoint: options.checkpoint || null,
    resumeMode: resumePlan.mode || options.resumeMode || "new",
    skippedPackingListCount: resumePlan.skippedGroupResults.length,
    progress: activeRun?.progress || null,
  };
  await persistPackingListAutoDownloadCheckpoint(options, {
    allGroups: groups,
    groupResults,
    result,
    status: result.ok ? "success" : "partial",
    message: result.message,
  });
  return result;
}

export async function preparePackingListAutoDownloadRun(options) {
  const {
    activeRun,
    downloadDirectory,
    workbook,
  } = options;
  const generatedAt = new Date().toISOString();
  const groups = Array.isArray(workbook?.groups) ? workbook.groups : [];
  const poNumbers = Array.isArray(workbook?.poNumbers) ? workbook.poNumbers : [];
  const resumePlan = buildPackingListResumePlan({
    checkpoint: options.resumeCheckpoint || options.checkpoint?.snapshot || options.checkpoint,
    groups,
    mode: options.resumeMode,
  });
  const runnableGroups = resumePlan.groups;
  const runnablePoNumbers = collectPackingListPoNumbers(runnableGroups);
  if (groups.length === 0 || poNumbers.length === 0) {
    const error = new Error("自动下载箱单 Excel 中没有可用于查询的 PO 号。");
    error.statusCode = 400;
    throw error;
  }

  await mkdir(downloadDirectory, { recursive: true });
  setRunProgress(activeRun, {
    phase: "LangGraph 初始化",
    message: "正在准备自动下载箱单流程图。",
    downloadDirectory,
    totalCount: groups.length,
    totalGroupCount: groups.length,
    totalPoCount: poNumbers.length,
    pendingGroupCount: runnableGroups.length,
    skippedGroupCount: resumePlan.skippedGroupResults.length,
    currentPackingListNumbers: [runnableGroups[0]?.no || ""].filter(Boolean),
    currentPoNumbers: runnableGroups[0]?.poNumbers?.slice(0, 1) || [],
  });

  return {
    generatedAt,
    allGroups: groups,
    groups: runnableGroups,
    poNumbers: runnablePoNumbers,
    totalPoNumbers: poNumbers,
    resumePlan,
    skippedGroupResults: resumePlan.skippedGroupResults,
  };
}

export async function createPackingListAutoDownloadRequestSession(options) {
  const {
    activeRun,
    browserEngines,
    config,
    credentials,
    ensureLoggedIn,
    log = () => {},
  } = options;

  setRunProgress(activeRun, {
    phase: "登录 Infor Nexus",
    message: "正在准备 Infor Nexus 登录会话。",
  });

  if (canUseBrowserLoginFallback({ browserEngines, config, ensureLoggedIn })) {
    return {
      authMethod: "browser-login-fallback",
      cookieMap: {},
      loginOrigin: resolveLoginOrigin(config.loginUrl),
    };
  }

  return createPackingListHomeRequestSession({
    config,
    credentials,
    log,
    runId: activeRun.runId,
  });
}

export async function openPackingListAutoDownloadBrowserSession(options) {
  const {
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    ensureLoggedIn,
    groups,
    headless,
    log = () => {},
    requestSession,
  } = options;
  const engine = browserEngines?.[config.browser] || browserEngines?.chromium;
  if (!engine) {
    throw new Error("自动下载箱单无法打开浏览器：未找到可用 Playwright 浏览器引擎。");
  }

  const loginOrigin = requestSession?.loginOrigin || resolveLoginOrigin(config.loginUrl);
  const homeUrl = new URL(INFORNEXUS_HOME_PATH, loginOrigin).toString();
  const packingManifestUrl = new URL(PACKING_MANIFEST_VIEW_PATH, loginOrigin).toString();
  let authMethod = requestSession?.authMethod || "request-login";
  const launchOptions = {
    slowMo: Number(config.packingListSlowMo ?? 0),
    ...(config.launchOptions && typeof config.launchOptions === "object" ? config.launchOptions : {}),
    headless: toBoolean(headless, config.headless),
  };
  const browserLaunchOptions = typeof buildVisibleBrowserLaunchOptions === "function"
    ? buildVisibleBrowserLaunchOptions(launchOptions, config.browser)
    : launchOptions;

  let browser = null;
  let context = null;
  let page = null;
  let browserLoginCompleted = false;
  const groupResults = [];
  try {
    browser = await engine.launch(browserLaunchOptions);
    context = await browser.newContext({
      viewport: null,
      acceptDownloads: true,
    });
    await addRequestSessionCookiesToContext(context, requestSession, loginOrigin);
    page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
    await showPackingListAutomationBadge(page, "正在打开箱单查询页", {
      phase: "open-home",
      totalCount: groups.length,
      completedCount: 0,
    });

    setRunProgress(activeRun, {
      phase: "打开箱单页面",
      message: "正在打开 PackingManifestView.jsp；如未登录会自动登录。",
      currentPackingListNumbers: [groups[0]?.no || ""].filter(Boolean),
      currentPoNumbers: groups[0]?.poNumbers?.slice(0, 1) || [],
    });
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await waitForPageSettled(page, config);
    await showPackingListAutomationBadge(page, "正在确认 Infor Nexus 登录状态", {
      phase: "login-check",
      totalCount: groups.length,
      completedCount: 0,
    });

    if (await needsInforNexusLogin(page)) {
      if (typeof ensureLoggedIn !== "function") {
        throw new Error("自动下载箱单浏览器会话未登录，且缺少 ensureLoggedIn 登录辅助。");
      }
      log("Packing List auto-download request cookies did not open home; using visible login fallback.", {
        runId: activeRun.runId,
        url: page.url(),
      });
      authMethod = "browser-login-fallback";
      await page.goto(config.loginUrl || `${loginOrigin}/`, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await showPackingListAutomationBadge(page, "正在登录 Infor Nexus", {
        phase: "browser-login",
        totalCount: groups.length,
        completedCount: 0,
      });
      await ensureLoggedIn(page, credentials);
      browserLoginCompleted = true;
      if (config.postLoginWaitMs > 0) {
        await page.waitForTimeout(Math.min(config.postLoginWaitMs, 150)).catch(() => {});
      }
      await page.goto(homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await showPackingListAutomationBadge(page, "登录完成，正在进入箱单页面", {
        phase: "home-opened",
        totalCount: groups.length,
        completedCount: 0,
      });
    }

    if (await needsInforNexusLogin(page)) {
      throw new Error("自动下载箱单打开主页后仍停留在 Infor Nexus 登录页，请检查账号或 Access Code 状态。");
    }

    setRunProgress(activeRun, {
      phase: "打开箱单页面",
      message: "正在打开 PackingManifestView.jsp。",
      homeOpened: true,
      currentPackingListNumbers: [groups[0]?.no || ""].filter(Boolean),
      currentPoNumbers: groups[0]?.poNumbers?.slice(0, 1) || [],
    });
    if (!isPackingManifestViewUrl(page.url())) {
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
    }
    await showPackingListAutomationBadge(page, "已打开箱单查询页", {
      phase: "packing-manifest",
      totalCount: groups.length,
      completedCount: 0,
    });
    if (await needsInforNexusLogin(page) && typeof ensureLoggedIn === "function") {
      authMethod = "browser-login-fallback";
      if (!browserLoginCompleted) {
        await ensureLoggedIn(page, credentials);
        browserLoginCompleted = true;
        if (config.postLoginWaitMs > 0) {
          await page.waitForTimeout(Math.min(config.postLoginWaitMs, 150)).catch(() => {});
        }
      }
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await showPackingListAutomationBadge(page, "已重新打开箱单查询页", {
        phase: "packing-manifest",
        totalCount: groups.length,
        completedCount: 0,
      });
    }
    if (await needsInforNexusLogin(page)) {
      throw new Error("Infor Nexus 登录会话已失效：打开箱单页面时返回登录页。");
    }

    await ensurePackingManifestSearchReady(page, packingManifestUrl, config);

    return {
      authMethod,
      browser,
      context,
      page,
      pageRef: { current: page },
      packingManifestOpened: true,
      packingManifestUrl,
    };
  } catch (error) {
    await persistPackingListAutoDownloadCheckpoint(options, {
      allGroups: groups,
      groupResults,
      status: "interrupted",
      message: error instanceof Error ? error.message : String(error || "Packing list automation interrupted."),
    });
    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    throw error;
  }
}

export async function processPackingListAutoDownloadGraphGroup(options) {
  const {
    activeRun,
    config,
    downloadDirectory,
    group,
    groupIndex,
    groupResults,
    groupTotal,
    log = () => {},
    session,
  } = options;
  const result = await processPackingManifestGroup({
    activeRun,
    config,
    context: session.context,
    downloadDirectory,
    group,
    groupIndex,
    groupTotal,
    log,
    pageRef: session.pageRef,
    packingManifestUrl: session.packingManifestUrl,
  });
  session.page = session.pageRef.current || session.page;

  const nextGroupResults = [...(groupResults || []), result];
  const downloadedCount = nextGroupResults.filter((item) => item.ok).length;
  const failedCount = nextGroupResults.length - downloadedCount;
  const downloadedFilePaths = nextGroupResults
    .filter((item) => item.ok && item.filePath)
    .map((item) => item.filePath);
  setRunProgress(activeRun, {
    phase: "下载箱单",
    message: `已处理 ${nextGroupResults.length}/${groupTotal} 个 NO 批次，已下载 ${downloadedCount}，失败 ${failedCount}。`,
    completedCount: nextGroupResults.length,
    downloadedCount,
    failedCount,
    downloadedFilePaths,
    lastDownloadedFilePath: downloadedFilePaths[downloadedFilePaths.length - 1] || "",
    packingManifestOpened: true,
    currentPackingListNumbers: [],
    currentPoNumbers: [],
  });
  await showPackingListAutomationBadge(session.page, `已处理 ${nextGroupResults.length}/${groupTotal} 个 NO 批次`, {
    phase: "group-progress",
    totalCount: groupTotal,
    completedCount: nextGroupResults.length,
    successCount: downloadedCount,
    failedCount,
  });

  return {
    result,
    session,
  };
}

export async function preparePackingListPoFilterAttempt(options) {
  const {
    activeRun,
    config,
    downloadDirectory,
    group,
    groupIndex,
    groupTotal,
    log = () => {},
    poIndex,
    session,
    attempts = [],
  } = options;
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const poNumber = String(poNumbers[poIndex] || "").trim();
  if (!poNumber) {
    return {
      ok: false,
      skipped: true,
      attempt: null,
      session,
    };
  }

  setRunProgress(activeRun, {
    phase: "搜索箱单",
    message: `NO ${no} (${groupIndex + 1}/${groupTotal}) / PO ${poNumber} (${poIndex + 1}/${poNumbers.length})：正在准备搜索。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });

  let page = await ensurePackingManifestWorkingPage({
    activeRun,
    config,
    context: session.context,
    log,
    pageRef: session.pageRef,
  });
  session.page = page;

  await showPackingListAutomationBadge(page, `正在搜索 PO ${poNumber}`, {
    phase: "search-po",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });

  setRunProgress(activeRun, {
    phase: "打开箱单筛选",
    message: `NO ${no} / PO ${poNumber}: 正在打开筛选面板。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });
  await resetPackingManifestSearchPageAfterFailedAttempt({
    attempts,
    config,
    groupIndex,
    groupTotal,
    no,
    page,
    packingManifestUrl: session.packingManifestUrl,
    poIndex,
    poNumber,
    poNumbers,
  });
  await openPackingManifestSearchPage(page, session.packingManifestUrl, config, poNumber);

  await showPackingListAutomationBadge(page, `正在定位 PO ${poNumber} 输入框`, {
    phase: "locate-po-input",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });
  setRunProgress(activeRun, {
    phase: "定位 PO 输入框",
    message: `NO ${no} / PO ${poNumber}: 正在定位 PO Number(s) 输入框。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });
  const poInput = await resolvePackingManifestPoInput(page, config);

  await showPackingListAutomationBadge(page, `正在填写 PO ${poNumber} 并点击 Apply`, {
    phase: "fill-po",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });
  setRunProgress(activeRun, {
    phase: "填写 PO",
    message: `NO ${no} / PO ${poNumber}: 正在填写 PO 并点击 Apply。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });

  let fillResult = null;
  const maxFilterAttempts = 3;
  for (let filterAttempt = 1; filterAttempt <= maxFilterAttempts; filterAttempt += 1) {
    const currentPoInput = filterAttempt === 1
      ? poInput
      : await resolvePackingManifestPoInput(page, config);
    fillResult = await fillPackingManifestPoFilter(page, currentPoInput, poNumber, config);
    if (!isPackingManifestFilterStillPending(fillResult)) {
      break;
    }
    log("Packing List PO filter did not apply to current PO; retrying from a clean query page.", {
      runId: activeRun.runId,
      no,
      poNumber,
      filterAttempt,
      reason: fillResult.searchOutcome?.reason || "",
    });
    await showPackingListAutomationBadge(page, `PO ${poNumber} filter not applied; retry ${filterAttempt}/${maxFilterAttempts}`, {
      phase: "retry-po-filter",
      no,
      poNumber,
      totalCount: groupTotal,
      completedCount: groupIndex,
      attemptedCount: poIndex + 1,
      currentPoIndex: poIndex + 1,
      totalPoCount: poNumbers.length,
    });
    if (filterAttempt >= maxFilterAttempts) {
      break;
    }
    await page.goto(session.packingManifestUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 12000),
    }).catch(() => null);
    await waitForPageSettled(page, config);
    await openPackingManifestSearchPage(page, session.packingManifestUrl, config, poNumber);
  }

  if (isPackingManifestFilterStillPending(fillResult)) {
    const debugSnapshot = await writePackingManifestDebugSnapshot({
      downloadDirectory,
      no,
      page,
      poNumber,
      reason: "po-filter-not-applied",
      runId: activeRun.runId,
    }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error || ""),
    }));
    return {
      ok: false,
      session,
      fillResult,
      attempt: {
        ok: false,
        no,
        poNumber,
        poFilterFilled: true,
        ...fillResult,
        debugSnapshot,
        step: "po-filter-apply",
        noResults: false,
        error: `PO ${poNumber} filter was not applied after ${maxFilterAttempts} attempts.`,
      },
    };
  }

  await showPackingListAutomationBadge(page, `PO ${poNumber} 已 Apply，正在读取结果`, {
    phase: "wait-result",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });
  setRunProgress(activeRun, {
    phase: "等待箱单结果",
    message: `NO ${no} / PO ${poNumber}: Apply 已触发，正在读取查询结果。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });

  return {
    ok: true,
    fillResult,
    no,
    page,
    poNumber,
    session,
  };
}

export async function openPackingListPoSearchResultAttempt(options) {
  const {
    activeRun,
    config,
    downloadDirectory,
    fillResult,
    group,
    groupIndex,
    groupTotal,
    log = () => {},
    poIndex,
    session,
  } = options;
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const poNumber = String(poNumbers[poIndex] || "").trim();
  let page = session.pageRef?.current || session.page;
  if (!page || page.isClosed()) {
    page = await ensurePackingManifestWorkingPage({
      activeRun,
      config,
      context: session.context,
      log,
      pageRef: session.pageRef,
    });
    session.page = page;
  }

  let openResult = fillResult.searchOutcome?.notFound
    ? {
        page,
        linkInfo: null,
        notFound: true,
        reason: fillResult.searchOutcome.reason || "no-results",
      }
    : await openFirstPackingManifestSearchResult(
        page,
        fillResult.responseLinkInfo,
        config,
        poNumber,
      );
  if (openResult?.pageClosed || page.isClosed()) {
    page = await ensurePackingManifestWorkingPage({
      activeRun,
      config,
      context: session.context,
      log,
      pageRef: session.pageRef,
    });
    session.page = page;
    openResult = await openFirstPackingManifestSearchResult(page, null, config, poNumber);
  }

  if (!openResult?.linkInfo) {
    const noResults = Boolean(openResult?.notFound) || await hasNoPackingManifestResults(page, poNumber).catch(() => false);
    const linkDiagnostics = await collectPackingManifestResultLinkDiagnostics(page);
    const debugSnapshot = await writePackingManifestDebugSnapshot({
      downloadDirectory,
      no,
      page,
      poNumber,
      reason: noResults ? "no-results" : "result-link-not-found",
      runId: activeRun.runId,
    }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error || ""),
    }));
    log(noResults ? "Packing List search returned no results." : "Packing List result link not found after search.", {
      runId: activeRun.runId,
      no,
      poNumber,
      finalUrl: page.isClosed() ? "page-closed" : page.url(),
      linkDiagnosticsCount: linkDiagnostics.length,
      debugSnapshot,
    });
    await showPackingListAutomationBadge(page, noResults
      ? `PO ${poNumber} 搜索为空，继续下一个`
      : `PO ${poNumber} 未找到详情链接，继续下一个`, {
      phase: noResults ? "no-results" : "result-link-not-found",
      no,
      poNumber,
      totalCount: groupTotal,
      completedCount: groupIndex,
      attemptedCount: poIndex + 1,
      currentPoIndex: poIndex + 1,
      totalPoCount: poNumbers.length,
    });
    return {
      ok: false,
      session,
      openResult,
      attempt: {
        ok: false,
        no,
        poNumber,
        poFilterFilled: true,
        ...fillResult,
        linkDiagnostics,
        debugSnapshot,
        step: "search-result",
        noResults,
        error: noResults
          ? `PO ${poNumber} 搜索为空，已记录并继续下一个 PO。`
          : `PO ${poNumber} 未搜到 PackingManifest 结果。`,
      },
    };
  }

  const linkInfo = openResult.linkInfo;
  log("Packing List result link found.", {
    runId: activeRun.runId,
    no,
    poNumber,
    href: linkInfo.href || linkInfo.rawHref || "",
    source: linkInfo.source || "",
    text: linkInfo.text || "",
  });
  setRunProgress(activeRun, {
    phase: "请求箱单详情",
    message: `NO ${no} 的 PO ${poNumber} 已搜到结果，正在请求箱单详情并下载 PDF。`,
    currentPackingListNumbers: [no],
    currentPoNumbers: [poNumber],
  });
  const detailPage = openResult.page || page;
  await showPackingListAutomationBadge(detailPage, `已搜到 PO ${poNumber}，正在下载箱单`, {
    phase: "download-pdf",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });

  return {
    ok: true,
    linkInfo,
    openResult,
    session,
  };
}

export async function downloadPackingListPoPdfAttempt(options) {
  const {
    activeRun,
    config,
    downloadDirectory,
    fillResult,
    group,
    groupIndex,
    groupTotal,
    linkInfo,
    log = () => {},
    openResult,
    poIndex,
    session,
  } = options;
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const poNumber = String(poNumbers[poIndex] || "").trim();
  const page = session.pageRef?.current || session.page;
  const detailPage = openResult.page || page;

  log("Packing List detail request prepared.", {
    runId: activeRun.runId,
    no,
    poNumber,
    url: linkInfo.href || "",
    browserUrl: detailPage.url(),
  });
  const downloadResult = await downloadPackingManifestPdfForGroup({
    config,
    downloadDirectory,
    detailUrl: linkInfo.href,
    groupNo: no,
    linkInfo,
    page: detailPage,
  });
  if (detailPage !== page && !detailPage.isClosed()) {
    await detailPage.close().catch(() => {});
  }
  const attempt = {
    ok: true,
    no,
    poNumber,
    poFilterFilled: true,
    ...fillResult,
    linkInfo,
    ...downloadResult,
  };
  log("Packing List NO group downloaded.", {
    runId: activeRun.runId,
    no,
    poNumber,
    filePath: downloadResult.filePath,
  });
  await showPackingListAutomationBadge(detailPage, `NO ${no} 已下载箱单`, {
    phase: "group-downloaded",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex + 1,
    successCount: groupIndex + 1,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });

  return {
    ok: true,
    attempt,
    groupResult: {
      ok: true,
      no,
      poNumbers,
      attemptedPoNumbers: [poNumber],
      successfulPoNumber: poNumber,
      attemptedPoCount: 1,
      totalPoCount: poNumbers.length,
      attempts: [attempt],
      fileName: downloadResult.fileName,
      filePath: downloadResult.filePath,
      downloadSource: downloadResult.downloadSource,
    },
    session,
  };
}

export async function recordPackingListPoAttemptError(options) {
  const {
    activeRun,
    downloadDirectory,
    error,
    group,
    groupIndex,
    groupTotal,
    log = () => {},
    poIndex,
    session,
  } = options;
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const poNumber = String(poNumbers[poIndex] || "").trim();
  const message = error instanceof Error ? error.message : String(error || "");
  const page = session?.pageRef?.current || session?.page;
  const debugSnapshot = page && !page.isClosed()
    ? await writePackingManifestDebugSnapshot({
      downloadDirectory,
      no,
      page,
      poNumber,
      reason: message.includes("Apply") ? "apply-button-not-found" : "attempt-error",
      runId: activeRun.runId,
    }).catch((snapshotError) => ({
      error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError || ""),
    }))
    : null;
  const attempt = {
    ok: false,
    no,
    poNumber,
    step: "download",
    error: message,
    debugSnapshot,
  };
  log("Packing List PO attempt failed, trying next PO in same NO group.", {
    runId: activeRun.runId,
    no,
    poNumber,
    message,
    debugSnapshot,
  });
  if (page && !page.isClosed()) {
    await showPackingListAutomationBadge(page, `PO ${poNumber} 下载失败，继续下一个`, {
      phase: "error",
      no,
      poNumber,
      totalCount: groupTotal,
      completedCount: groupIndex,
      failedCount: 1,
      attemptedCount: poIndex + 1,
      currentPoIndex: poIndex + 1,
      totalPoCount: poNumbers.length,
    });
  }
  return attempt;
}

export function buildPackingListAutoDownloadFailedGroupResult({ group, attempts = [] }) {
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  return {
    ok: false,
    no,
    poNumbers,
    attemptedPoNumbers: attempts.map((item) => item.poNumber).filter(Boolean),
    failedPoNumbers: poNumbers,
    successfulPoNumber: "",
    attemptedPoCount: attempts.length,
    totalPoCount: poNumbers.length,
    attempts,
    error: `NO ${no} 中 ${poNumbers.length} 个 PO No1 均未成功下载箱单。`,
  };
}

export async function updatePackingListAutoDownloadGroupProgress(options) {
  const {
    activeRun,
    groupResults,
    groupTotal,
    session,
  } = options;
  const downloadedCount = groupResults.filter((item) => item.ok).length;
  const failedCount = groupResults.length - downloadedCount;
  const downloadedFilePaths = groupResults
    .filter((item) => item.ok && item.filePath)
    .map((item) => item.filePath);
  setRunProgress(activeRun, {
    phase: "下载箱单",
    message: `已处理 ${groupResults.length}/${groupTotal} 个 NO 批次，已下载 ${downloadedCount}，失败 ${failedCount}。`,
    completedCount: groupResults.length,
    downloadedCount,
    failedCount,
    downloadedFilePaths,
    lastDownloadedFilePath: downloadedFilePaths[downloadedFilePaths.length - 1] || "",
    packingManifestOpened: true,
    currentPackingListNumbers: [],
    currentPoNumbers: [],
  });
  const page = session?.pageRef?.current || session?.page;
  if (page && !page.isClosed()) {
    await showPackingListAutomationBadge(page, `已处理 ${groupResults.length}/${groupTotal} 个 NO 批次`, {
      phase: "group-progress",
      totalCount: groupTotal,
      completedCount: groupResults.length,
      successCount: downloadedCount,
      failedCount,
    });
  }
}

export async function finalizePackingListAutoDownloadBrowserSession(options) {
  const {
    activeRun,
    config,
    groups,
    log = () => {},
    groupResults,
    safePageTitle,
    safePageUrl,
    session,
  } = options;
  const finalPage = session.pageRef?.current || session.page;
  const finalDownloadedFilePaths = groupResults
    .filter((item) => item.ok && item.filePath)
    .map((item) => item.filePath);
  await showPackingListAutomationBadge(finalPage, `自动下载箱单完成，已下载 ${finalDownloadedFilePaths.length}/${groups.length} 个 NO 批次`, {
    phase: failedCountFromGroupResults(groupResults) > 0 ? "completed-with-failures" : "complete",
    totalCount: groups.length,
    completedCount: groupResults.length,
    successCount: finalDownloadedFilePaths.length,
    failedCount: failedCountFromGroupResults(groupResults),
    meta: finalDownloadedFilePaths.slice(-2).map((filePath) => `保存 ${filePath}`),
    filePath: finalDownloadedFilePaths[finalDownloadedFilePaths.length - 1] || "",
  });
  const finalUrl = typeof safePageUrl === "function" ? safePageUrl(finalPage) : finalPage.url();
  const title = typeof safePageTitle === "function"
    ? await safePageTitle(finalPage)
    : await finalPage.title().catch(() => "");
  log("Packing List auto-download processed NO groups through LangGraph.", {
    runId: activeRun.runId,
    finalUrl,
    totalGroupCount: groups.length,
    downloadedGroupCount: groupResults.filter((item) => item.ok).length,
    failedGroupCount: groupResults.filter((item) => !item.ok).length,
  });

  if (config.keepBrowserOpenOnSuccessMs > 0) {
    await finalPage.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
  }

  return {
    packingManifestOpened: true,
    groupResults,
    authMethod: session.authMethod,
    finalUrl,
    title,
  };
}

export async function closePackingListAutoDownloadBrowserSession(session) {
  if (!session || typeof session !== "object") {
    return;
  }
  await session.context?.close().catch(() => {});
  await session.browser?.close().catch(() => {});
}

export function buildPackingListAutoDownloadResult(options) {
  const {
    activeRun,
    browserResult,
    inputFileName,
    requestSession,
    runState,
  } = options;
  const groups = Array.isArray(runState?.allGroups) ? runState.allGroups : (Array.isArray(runState?.groups) ? runState.groups : []);
  const poNumbers = Array.isArray(runState?.totalPoNumbers) ? runState.totalPoNumbers : (Array.isArray(runState?.poNumbers) ? runState.poNumbers : []);
  const downloadedPackingListCount = browserResult.groupResults.filter((item) => item.ok).length;
  const failedPackingListCount = browserResult.groupResults.length - downloadedPackingListCount;
  const downloadedFilePaths = browserResult.groupResults
    .filter((item) => item.ok && item.filePath)
    .map((item) => item.filePath);
  const failedPackingLists = browserResult.groupResults
    .filter((item) => !item.ok)
    .map((item) => normalizeFailedPackingListResult(item));
  const firstSuccessfulAttempt = browserResult.groupResults
    .flatMap((group) => group.attempts || [])
    .find((attempt) => attempt.ok);

  return {
    ok: failedPackingListCount === 0,
    statusCode: failedPackingListCount === 0 ? 200 : 207,
    runId: activeRun.runId,
    generatedAt: runState.generatedAt,
    stage: "自动下载箱单 PDF 下载",
    message: failedPackingListCount === 0
      ? `自动下载箱单完成，已下载 ${downloadedPackingListCount}/${groups.length} 个 NO 批次。`
      : `自动下载箱单未全部完成，已下载 ${downloadedPackingListCount}/${groups.length} 个 NO 批次，失败 ${failedPackingListCount} 个。`,
    detail: "当前按 NO 批次处理：同一 NO 下 PO No1 逐个搜索，任意一个 PO 搜到 PackingManifest 并保存 PDF 后，该 NO 批次即算成功。",
    inputFileName,
    inputMode: "packing-list-auto-download",
    automationImplemented: true,
    downloadImplemented: true,
    searchStepImplemented: true,
    downloadDirectory: options.downloadDirectory,
    homeOpened: true,
    packingManifestOpened: browserResult.packingManifestOpened,
    poFilterFilled: browserResult.groupResults.some((item) => item.attempts?.some((attempt) => attempt.poFilterFilled)),
    flexViewPostObserved: browserResult.groupResults.some((item) => item.attempts?.some((attempt) => attempt.flexViewPostObserved)),
    flexViewPostStatus: firstSuccessfulAttempt?.flexViewPostStatus || 0,
    flexViewPostUrl: firstSuccessfulAttempt?.flexViewPostUrl || "",
    authMethod: browserResult.authMethod || requestSession.authMethod,
    finalUrl: browserResult.finalUrl,
    title: browserResult.title,
    searchedPoNumber: firstSuccessfulAttempt?.poNumber || poNumbers[0],
    totalGroupCount: groups.length,
    totalPoCount: poNumbers.length,
    totalPackingListCount: groups.length,
    downloadedPackingListCount,
    downloadedPoCount: downloadedPackingListCount,
    completedPoCount: downloadedPackingListCount,
    failedPackingListCount,
    failedPoCount: failedPackingListCount,
    failedPackingLists,
    failedNoBatches: failedPackingLists,
    downloadedFilePaths,
    firstDownloadedFilePath: downloadedFilePaths[0] || "",
    groupResults: browserResult.groupResults,
    poNumbers,
    progress: activeRun?.progress || null,
  };
}

async function openPackingManifestAndDownloadGroups(options) {
  const {
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    downloadDirectory,
    ensureLoggedIn,
    groups,
    allGroups = groups,
    headless,
    log,
    requestSession,
    safePageTitle,
    safePageUrl,
    skippedGroupResults = [],
  } = options;
  const engine = browserEngines?.[config.browser] || browserEngines?.chromium;
  if (!engine) {
    throw new Error("自动下载箱单无法打开浏览器：未找到可用 Playwright 浏览器引擎。");
  }

  const loginOrigin = requestSession?.loginOrigin || resolveLoginOrigin(config.loginUrl);
  const homeUrl = new URL(INFORNEXUS_HOME_PATH, loginOrigin).toString();
  const packingManifestUrl = new URL(PACKING_MANIFEST_VIEW_PATH, loginOrigin).toString();
  let authMethod = requestSession?.authMethod || "request-login";
  const launchOptions = {
    slowMo: Number(config.packingListSlowMo ?? 0),
    ...(config.launchOptions && typeof config.launchOptions === "object" ? config.launchOptions : {}),
    headless: toBoolean(headless, config.headless),
  };
  const browserLaunchOptions = typeof buildVisibleBrowserLaunchOptions === "function"
    ? buildVisibleBrowserLaunchOptions(launchOptions, config.browser)
    : launchOptions;

  let browser = null;
  let context = null;
  let page = null;
  let browserLoginCompleted = false;
  const groupResults = [];
  try {
    browser = await engine.launch(browserLaunchOptions);
    context = await browser.newContext({
      viewport: null,
      acceptDownloads: true,
    });
    await addRequestSessionCookiesToContext(context, requestSession, loginOrigin);
    page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
    await showPackingListAutomationBadge(page, "正在打开箱单查询页", {
      phase: "open-home",
      totalCount: groups.length,
      completedCount: 0,
    });

    setRunProgress(activeRun, {
      phase: "打开箱单页面",
      message: "正在打开 PackingManifestView.jsp；如未登录会自动登录。",
      currentPackingListNumbers: [groups[0]?.no || ""].filter(Boolean),
      currentPoNumbers: groups[0]?.poNumbers?.slice(0, 1) || [],
    });
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await waitForPageSettled(page, config);
    await showPackingListAutomationBadge(page, "正在确认 Infor Nexus 登录状态", {
      phase: "login-check",
      totalCount: groups.length,
      completedCount: 0,
    });

    if (await needsInforNexusLogin(page)) {
      if (typeof ensureLoggedIn !== "function") {
        throw new Error("自动下载箱单浏览器会话未登录，且缺少 ensureLoggedIn 登录辅助。");
      }
      log("Packing List auto-download request cookies did not open home; using visible login fallback.", {
        runId: activeRun.runId,
        url: page.url(),
      });
      authMethod = "browser-login-fallback";
      await page.goto(config.loginUrl || `${loginOrigin}/`, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await showPackingListAutomationBadge(page, "正在登录 Infor Nexus", {
        phase: "browser-login",
        totalCount: groups.length,
        completedCount: 0,
      });
      await ensureLoggedIn(page, credentials);
      browserLoginCompleted = true;
      if (config.postLoginWaitMs > 0) {
        await page.waitForTimeout(Math.min(config.postLoginWaitMs, 150)).catch(() => {});
      }
      await page.goto(homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await showPackingListAutomationBadge(page, "登录完成，正在进入箱单页面", {
        phase: "home-opened",
        totalCount: groups.length,
        completedCount: 0,
      });
    }

    if (await needsInforNexusLogin(page)) {
      throw new Error("自动下载箱单打开主页后仍停留在 Infor Nexus 登录页，请检查账号或 Access Code 状态。");
    }

    setRunProgress(activeRun, {
      phase: "打开箱单页面",
      message: "正在打开 PackingManifestView.jsp。",
      homeOpened: true,
      currentPackingListNumbers: [groups[0]?.no || ""].filter(Boolean),
      currentPoNumbers: groups[0]?.poNumbers?.slice(0, 1) || [],
    });
    if (!isPackingManifestViewUrl(page.url())) {
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
    }
    await showPackingListAutomationBadge(page, "已打开箱单查询页", {
      phase: "packing-manifest",
      totalCount: groups.length,
      completedCount: 0,
    });
    if (await needsInforNexusLogin(page) && typeof ensureLoggedIn === "function") {
      authMethod = "browser-login-fallback";
      if (!browserLoginCompleted) {
        await ensureLoggedIn(page, credentials);
        browserLoginCompleted = true;
        if (config.postLoginWaitMs > 0) {
          await page.waitForTimeout(Math.min(config.postLoginWaitMs, 150)).catch(() => {});
        }
      }
      await page.goto(packingManifestUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      await showPackingListAutomationBadge(page, "已重新打开箱单查询页", {
        phase: "packing-manifest",
        totalCount: groups.length,
        completedCount: 0,
      });
    }
    if (await needsInforNexusLogin(page)) {
      throw new Error("Infor Nexus 登录会话已失效：打开箱单页面时返回登录页。");
    }

    await ensurePackingManifestSearchReady(page, packingManifestUrl, config);

    const pageRef = { current: page };
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const result = await processPackingManifestGroup({
        activeRun,
        config,
        context,
        downloadDirectory,
        group,
        groupIndex: index,
        groupTotal: groups.length,
        log,
        pageRef,
        packingManifestUrl,
      });
      page = pageRef.current || page;
      groupResults.push(result);
      const downloadedCount = groupResults.filter((item) => item.ok).length;
      const failedCount = groupResults.length - downloadedCount;
      const downloadedFilePaths = groupResults
        .filter((item) => item.ok && item.filePath)
        .map((item) => item.filePath);
      setRunProgress(activeRun, {
        phase: failedCount === 0 ? "下载箱单" : "下载箱单",
        message: `已处理 ${groupResults.length}/${groups.length} 个 NO 批次，已下载 ${downloadedCount}，失败 ${failedCount}。`,
        completedCount: groupResults.length,
        downloadedCount,
        failedCount,
        downloadedFilePaths,
        lastDownloadedFilePath: downloadedFilePaths[downloadedFilePaths.length - 1] || "",
        packingManifestOpened: true,
        currentPackingListNumbers: [],
        currentPoNumbers: [],
      });
      await persistPackingListAutoDownloadCheckpoint(options, {
        allGroups,
        groupResult: result,
        groupResults: [
          ...skippedGroupResults,
          ...groupResults,
        ],
        status: failedCount > 0 ? "partial" : "running",
        message: `已处理 ${groupResults.length}/${groups.length} 个 NO 批次，已下载 ${downloadedCount}，失败 ${failedCount}。`,
      });
      await showPackingListAutomationBadge(page, `已处理 ${groupResults.length}/${groups.length} 个 NO 批次`, {
        phase: "group-progress",
        totalCount: groups.length,
        completedCount: groupResults.length,
        successCount: downloadedCount,
        failedCount,
      });
    }

    const finalPage = pageRef.current || page;
    const finalDownloadedFilePaths = groupResults
      .filter((item) => item.ok && item.filePath)
      .map((item) => item.filePath);
    await showPackingListAutomationBadge(finalPage, `自动下载箱单完成，已下载 ${finalDownloadedFilePaths.length}/${groups.length} 个 NO 批次`, {
      phase: failedCountFromGroupResults(groupResults) > 0 ? "completed-with-failures" : "complete",
      totalCount: groups.length,
      completedCount: groupResults.length,
      successCount: finalDownloadedFilePaths.length,
      failedCount: failedCountFromGroupResults(groupResults),
      meta: finalDownloadedFilePaths.slice(-2).map((filePath) => `保存 ${filePath}`),
      filePath: finalDownloadedFilePaths[finalDownloadedFilePaths.length - 1] || "",
    });
    const finalUrl = typeof safePageUrl === "function" ? safePageUrl(finalPage) : finalPage.url();
    const title = typeof safePageTitle === "function"
      ? await safePageTitle(finalPage)
      : await finalPage.title().catch(() => "");
    log("Packing List auto-download processed NO groups.", {
      runId: activeRun.runId,
      finalUrl,
      totalGroupCount: groups.length,
      downloadedGroupCount: groupResults.filter((item) => item.ok).length,
      failedGroupCount: groupResults.filter((item) => !item.ok).length,
    });

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
    }

    return {
      packingManifestOpened: true,
      groupResults,
      authMethod,
      finalUrl,
      title,
    };
  } catch (error) {
    await persistPackingListAutoDownloadCheckpoint(options, {
      allGroups,
      groupResults: [
        ...skippedGroupResults,
        ...groupResults,
      ],
      status: "interrupted",
      message: error instanceof Error ? error.message : String(error || "Packing list automation interrupted."),
    });
    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }
    throw error;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function processPackingManifestGroup(options) {
  const {
    activeRun,
    config,
    context,
    downloadDirectory,
    group,
    groupIndex,
    groupTotal,
    log,
    pageRef,
    packingManifestUrl,
  } = options;
  const no = String(group?.no || "").trim();
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const attempts = [];

  for (let poIndex = 0; poIndex < poNumbers.length; poIndex += 1) {
    const poNumber = String(poNumbers[poIndex] || "").trim();
    if (!poNumber) continue;

    setRunProgress(activeRun, {
      phase: "搜索箱单",
      message: `正在处理 NO ${no} (${groupIndex + 1}/${groupTotal})，搜索 PO ${poNumber} (${poIndex + 1}/${poNumbers.length})。`,
      currentPackingListNumbers: [no],
      currentPoNumbers: [poNumber],
    });

    try {
      let page = await ensurePackingManifestWorkingPage({
        activeRun,
        config,
        context,
        log,
        pageRef,
      });
      await showPackingListAutomationBadge(page, `正在搜索 PO ${poNumber}`, {
        phase: "search-po",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      setRunProgress(activeRun, {
        phase: "打开箱单筛选",
        message: `NO ${no} / PO ${poNumber}: 正在打开筛选面板。`,
        currentPackingListNumbers: [no],
        currentPoNumbers: [poNumber],
      });
      await resetPackingManifestSearchPageAfterFailedAttempt({
        attempts,
        config,
        groupIndex,
        groupTotal,
        no,
        page,
        packingManifestUrl,
        poIndex,
        poNumber,
        poNumbers,
      });
      await openPackingManifestSearchPage(page, packingManifestUrl, config, poNumber);
      await showPackingListAutomationBadge(page, `正在定位 PO ${poNumber} 输入框`, {
        phase: "locate-po-input",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      setRunProgress(activeRun, {
        phase: "定位 PO 输入框",
        message: `NO ${no} / PO ${poNumber}: 正在定位 PO Number(s) 输入框。`,
        currentPackingListNumbers: [no],
        currentPoNumbers: [poNumber],
      });
      const poInput = await resolvePackingManifestPoInput(page, config);
      await showPackingListAutomationBadge(page, `正在填写 PO ${poNumber} 并点击 Apply`, {
        phase: "fill-po",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      setRunProgress(activeRun, {
        phase: "填写 PO",
        message: `NO ${no} / PO ${poNumber}: 正在填写 PO 并点击 Apply。`,
        currentPackingListNumbers: [no],
        currentPoNumbers: [poNumber],
      });
      let fillResult = null;
      const maxFilterAttempts = 3;
      for (let filterAttempt = 1; filterAttempt <= maxFilterAttempts; filterAttempt += 1) {
        const currentPoInput = filterAttempt === 1
          ? poInput
          : await resolvePackingManifestPoInput(page, config);
        fillResult = await fillPackingManifestPoFilter(page, currentPoInput, poNumber, config);
        if (!isPackingManifestFilterStillPending(fillResult)) {
          break;
        }
        log("Packing List PO filter did not apply to current PO; retrying from a clean query page.", {
          runId: activeRun.runId,
          no,
          poNumber,
          filterAttempt,
          reason: fillResult.searchOutcome?.reason || "",
        });
        await showPackingListAutomationBadge(page, `PO ${poNumber} filter not applied; retry ${filterAttempt}/${maxFilterAttempts}`, {
          phase: "retry-po-filter",
          no,
          poNumber,
          totalCount: groupTotal,
          completedCount: groupIndex,
          attemptedCount: poIndex + 1,
          currentPoIndex: poIndex + 1,
          totalPoCount: poNumbers.length,
        });
        if (filterAttempt >= maxFilterAttempts) {
          break;
        }
        await page.goto(packingManifestUrl, {
          waitUntil: "domcontentloaded",
          timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 12000),
        }).catch(() => null);
        await waitForPageSettled(page, config);
        await openPackingManifestSearchPage(page, packingManifestUrl, config, poNumber);
      }
      if (isPackingManifestFilterStillPending(fillResult)) {
        const debugSnapshot = await writePackingManifestDebugSnapshot({
          downloadDirectory,
          no,
          page,
          poNumber,
          reason: "po-filter-not-applied",
          runId: activeRun.runId,
        }).catch((error) => ({
          error: error instanceof Error ? error.message : String(error || ""),
        }));
        attempts.push({
          ok: false,
          no,
          poNumber,
          poFilterFilled: true,
          ...fillResult,
          debugSnapshot,
          step: "po-filter-apply",
          noResults: false,
          error: `PO ${poNumber} filter was not applied after ${maxFilterAttempts} attempts.`,
        });
        continue;
      }
      await showPackingListAutomationBadge(page, `PO ${poNumber} 已 Apply，正在读取结果`, {
        phase: "wait-result",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      setRunProgress(activeRun, {
        phase: "等待箱单结果",
        message: `NO ${no} / PO ${poNumber}: Apply 已触发，正在读取查询结果。`,
        currentPackingListNumbers: [no],
        currentPoNumbers: [poNumber],
      });
      if (page.isClosed()) {
        page = await ensurePackingManifestWorkingPage({
          activeRun,
          config,
          context,
          log,
          pageRef,
        });
      }
      let openResult = fillResult.searchOutcome?.notFound
        ? {
            page,
            linkInfo: null,
            notFound: true,
            reason: fillResult.searchOutcome.reason || "no-results",
          }
        : await openFirstPackingManifestSearchResult(
            page,
            fillResult.responseLinkInfo,
            config,
            poNumber,
          );
      if (openResult?.pageClosed || page.isClosed()) {
        page = await ensurePackingManifestWorkingPage({
          activeRun,
          config,
          context,
          log,
          pageRef,
        });
        openResult = await openFirstPackingManifestSearchResult(page, null, config, poNumber);
      }
      if (!openResult?.linkInfo) {
        const noResults = Boolean(openResult?.notFound) || await hasNoPackingManifestResults(page, poNumber).catch(() => false);
        const linkDiagnostics = await collectPackingManifestResultLinkDiagnostics(page);
        const debugSnapshot = await writePackingManifestDebugSnapshot({
          downloadDirectory,
          no,
          page,
          poNumber,
          reason: noResults ? "no-results" : "result-link-not-found",
          runId: activeRun.runId,
        }).catch((error) => ({
          error: error instanceof Error ? error.message : String(error || ""),
        }));
        log(noResults ? "Packing List search returned no results." : "Packing List result link not found after search.", {
          runId: activeRun.runId,
          no,
          poNumber,
          finalUrl: page.isClosed() ? "page-closed" : page.url(),
          linkDiagnosticsCount: linkDiagnostics.length,
          debugSnapshot,
        });
        await showPackingListAutomationBadge(page, noResults
          ? `PO ${poNumber} 搜索为空，继续下一个`
          : `PO ${poNumber} 未找到详情链接，继续下一个`, {
          phase: noResults ? "no-results" : "result-link-not-found",
          no,
          poNumber,
          totalCount: groupTotal,
          completedCount: groupIndex,
          attemptedCount: poIndex + 1,
          currentPoIndex: poIndex + 1,
          totalPoCount: poNumbers.length,
        });
        attempts.push({
          ok: false,
          no,
          poNumber,
          poFilterFilled: true,
          ...fillResult,
          linkDiagnostics,
          debugSnapshot,
          step: "search-result",
          noResults,
          error: noResults
            ? `PO ${poNumber} 搜索为空，已记录并继续下一个 PO。`
            : `PO ${poNumber} 未搜到 PackingManifest 结果。`,
        });
        continue;
      }

      const linkInfo = openResult.linkInfo;
      log("Packing List result link found.", {
        runId: activeRun.runId,
        no,
        poNumber,
        href: linkInfo.href || linkInfo.rawHref || "",
        source: linkInfo.source || "",
        text: linkInfo.text || "",
      });
      setRunProgress(activeRun, {
        phase: "请求箱单详情",
        message: `NO ${no} 的 PO ${poNumber} 已搜到结果，正在请求箱单详情并下载 PDF。`,
        currentPackingListNumbers: [no],
        currentPoNumbers: [poNumber],
      });
      const detailPage = openResult.page || page;
      await showPackingListAutomationBadge(detailPage, `已搜到 PO ${poNumber}，正在下载箱单`, {
        phase: "download-pdf",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      log("Packing List detail request prepared.", {
        runId: activeRun.runId,
        no,
        poNumber,
        url: linkInfo.href || "",
        browserUrl: detailPage.url(),
      });
      const downloadResult = await downloadPackingManifestPdfForGroup({
        config,
        downloadDirectory,
        detailUrl: linkInfo.href,
        groupNo: no,
        linkInfo,
        page: detailPage,
      });
      if (detailPage !== page && !detailPage.isClosed()) {
        await detailPage.close().catch(() => {});
      }
      const attempt = {
        ok: true,
        no,
        poNumber,
        poFilterFilled: true,
        ...fillResult,
        linkInfo,
        ...downloadResult,
      };
      attempts.push(attempt);
      log("Packing List NO group downloaded.", {
        runId: activeRun.runId,
        no,
        poNumber,
        filePath: downloadResult.filePath,
      });
      await showPackingListAutomationBadge(detailPage, `NO ${no} 已下载箱单`, {
        phase: "group-downloaded",
        no,
        poNumber,
        totalCount: groupTotal,
        completedCount: groupIndex + 1,
        successCount: groupIndex + 1,
        attemptedCount: poIndex + 1,
        currentPoIndex: poIndex + 1,
        totalPoCount: poNumbers.length,
      });
      return {
        ok: true,
        no,
        poNumbers,
        attemptedPoNumbers: attempts.map((item) => item.poNumber).filter(Boolean),
        successfulPoNumber: poNumber,
        attemptedPoCount: attempts.length,
        totalPoCount: poNumbers.length,
        attempts,
        fileName: downloadResult.fileName,
        filePath: downloadResult.filePath,
        downloadSource: downloadResult.downloadSource,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      const page = pageRef?.current;
      const debugSnapshot = page && !page.isClosed()
        ? await writePackingManifestDebugSnapshot({
          downloadDirectory,
          no,
          page,
          poNumber,
          reason: message.includes("Apply") ? "apply-button-not-found" : "attempt-error",
          runId: activeRun.runId,
        }).catch((snapshotError) => ({
          error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError || ""),
        }))
        : null;
      attempts.push({
        ok: false,
        no,
        poNumber,
        step: "download",
        error: message,
        debugSnapshot,
      });
      log("Packing List PO attempt failed, trying next PO in same NO group.", {
        runId: activeRun.runId,
        no,
        poNumber,
        message,
        debugSnapshot,
      });
      if (page && !page.isClosed()) {
        await showPackingListAutomationBadge(page, `PO ${poNumber} 下载失败，继续下一个`, {
          phase: "error",
          no,
          poNumber,
          totalCount: groupTotal,
          completedCount: groupIndex,
          failedCount: 1,
          attemptedCount: poIndex + 1,
          currentPoIndex: poIndex + 1,
          totalPoCount: poNumbers.length,
        });
      }
    }
  }

  return {
    ok: false,
    no,
    poNumbers,
    attemptedPoNumbers: attempts.map((item) => item.poNumber).filter(Boolean),
    failedPoNumbers: poNumbers,
    successfulPoNumber: "",
    attemptedPoCount: attempts.length,
    totalPoCount: poNumbers.length,
    attempts,
    error: `NO ${no} 下 ${poNumbers.length} 个 PO No1 均未成功下载箱单。`,
  };
}

function buildPackingListResumePlan({ checkpoint, groups, mode }) {
  const normalizedMode = normalizePackingListResumeMode(mode || checkpoint?.mode);
  if (!checkpoint || normalizedMode === "new" || normalizedMode === "restart") {
    return {
      mode: normalizedMode,
      groups,
      skippedGroupResults: [],
      previousGroupResults: [],
    };
  }

  const previousGroupResults = Array.isArray(checkpoint.groupResults)
    ? checkpoint.groupResults.filter((item) => item && typeof item === "object")
    : [];
  const items = Array.isArray(checkpoint.items)
    ? checkpoint.items.filter((item) => item && typeof item === "object")
    : [];
  const successfulNos = new Set();
  const failedNos = new Set();

  for (const item of items) {
    const no = String(item.no || item.groupKey || "").trim();
    const status = String(item.status || "").trim().toLowerCase();
    if (!no) continue;
    if (status === "success") successfulNos.add(no);
    if (["failed", "error", "interrupted"].includes(status)) failedNos.add(no);
  }
  for (const groupResult of previousGroupResults) {
    const no = String(groupResult.no || "").trim();
    if (!no) continue;
    if (groupResult.ok) successfulNos.add(no);
    else failedNos.add(no);
  }

  const skippedGroupResults = previousGroupResults
    .filter((item) => item?.ok && successfulNos.has(String(item.no || "").trim()))
    .map((item) => ({ ...item, resumedFromCheckpoint: true }));
  const runnableGroups = groups.filter((group) => {
    const no = String(group?.no || "").trim();
    if (!no) return true;
    if (normalizedMode === "retry-failed") {
      return failedNos.has(no);
    }
    return !successfulNos.has(no);
  });

  return {
    mode: normalizedMode,
    groups: runnableGroups,
    skippedGroupResults,
    previousGroupResults,
  };
}

function normalizePackingListResumeMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  return ["continue", "retry-failed", "restart", "new"].includes(value) ? value : "new";
}

function collectPackingListPoNumbers(groups) {
  const seen = new Set();
  const values = [];
  for (const group of groups || []) {
    for (const poNumber of group?.poNumbers || []) {
      const normalized = String(poNumber || "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      values.push(normalized);
    }
  }
  return values;
}

async function persistPackingListAutoDownloadCheckpoint(options, input = {}) {
  const checkpointConfig = options?.checkpoint;
  if (!checkpointConfig?.enabled || !checkpointConfig.backendBaseUrl || !checkpointConfig.batchId) {
    return;
  }
  const allGroups = Array.isArray(input.allGroups) ? input.allGroups : [];
  const groupResults = Array.isArray(input.groupResults) ? input.groupResults : [];
  const checkpoint = buildPackingListAutoDownloadCheckpointSnapshot({
    allGroups,
    groupResults,
    mode: checkpointConfig.mode || options?.resumeMode || "continue",
    message: input.message || input.result?.message || "",
    result: input.result || null,
    status: input.status || "running",
  });
  const payload = {
    runId: checkpointConfig.runId || options?.activeRun?.runId || "",
    attemptId: checkpointConfig.attemptId || "",
    mode: checkpointConfig.mode || options?.resumeMode || "continue",
    status: input.status || "running",
    message: input.message || input.result?.message || "",
    checkpoint,
    groupResult: input.groupResult || null,
    result: input.result || null,
    files: await buildPackingListAutoDownloadCheckpointFiles(input),
  };
  const url = `${String(checkpointConfig.backendBaseUrl).replace(/\/+$/, "")}/api/automation/packing-list-auto-download/batches/${encodeURIComponent(checkpointConfig.batchId)}/checkpoint`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`checkpoint HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
  } catch (error) {
    options?.log?.("Packing List direct checkpoint persistence failed.", {
      batchId: checkpointConfig.batchId,
      attemptId: checkpointConfig.attemptId,
      message: error instanceof Error ? error.message : String(error || ""),
    });
  }
}

function buildPackingListAutoDownloadCheckpointSnapshot({
  allGroups,
  groupResults,
  mode,
  message,
  result,
  status,
}) {
  const resultByNo = new Map();
  for (const groupResult of groupResults || []) {
    const no = String(groupResult?.no || "").trim();
    if (!no) continue;
    resultByNo.set(no, groupResult);
  }
  const items = (allGroups || []).map((group) => {
    const no = String(group?.no || "").trim();
    const groupResult = resultByNo.get(no);
    if (!groupResult) {
      return {
        no,
        status: "pending",
        message: "",
        poNumbers: group?.poNumbers || [],
      };
    }
    return {
      no,
      status: groupResult.ok ? "success" : "failed",
      message: groupResult.error || "",
      poNumbers: groupResult.poNumbers || group?.poNumbers || [],
      successfulPoNumber: groupResult.successfulPoNumber || "",
      downloadedFilePath: groupResult.filePath || "",
      updatedAt: new Date().toISOString(),
    };
  });
  const completedCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const totalCount = items.length;
  return {
    mode,
    status: status || (result?.ok ? "success" : (failedCount > 0 ? "partial" : "running")),
    message: message || "",
    totalCount,
    completedCount,
    failedCount,
    pendingCount: Math.max(0, totalCount - completedCount - failedCount),
    items,
    groupResults,
    result: result || null,
    updatedAt: new Date().toISOString(),
  };
}

async function buildPackingListAutoDownloadCheckpointFiles(input = {}) {
  const files = [];
  const groupResult = input.groupResult;
  if (groupResult?.ok && groupResult.filePath) {
    const content = await readFile(groupResult.filePath).catch(() => null);
    if (content) {
      files.push({
        fileName: groupResult.fileName || `Packing list ${groupResult.no || "download"}.pdf`,
        fileRole: "packing_list_pdf",
        contentType: "application/pdf",
        contentBase64: content.toString("base64"),
      });
    }
  }
  if (input.result) {
    const resultContent = Buffer.from(JSON.stringify(input.result, null, 2), "utf8");
    files.push({
      fileName: "result.json",
      fileRole: "result_json",
      contentType: "application/json; charset=utf-8",
      contentBase64: resultContent.toString("base64"),
    });
  }
  return files;
}

function failedCountFromGroupResults(groupResults = []) {
  return Array.isArray(groupResults) ? groupResults.filter((item) => !item?.ok).length : 0;
}

function normalizeFailedPackingListResult(item) {
  const attempts = Array.isArray(item?.attempts) ? item.attempts : [];
  const attemptedPoNumbers = attempts.map((attempt) => attempt?.poNumber).filter(Boolean);
  return {
    no: item?.no || "",
    poNumbers: Array.isArray(item?.poNumbers) ? item.poNumbers : [],
    attemptedPoNumbers,
    failedPoNumbers: Array.isArray(item?.failedPoNumbers) ? item.failedPoNumbers : (Array.isArray(item?.poNumbers) ? item.poNumbers : attemptedPoNumbers),
    attemptedPoCount: item?.attemptedPoCount || attemptedPoNumbers.length,
    totalPoCount: item?.totalPoCount || (Array.isArray(item?.poNumbers) ? item.poNumbers.length : 0),
    error: item?.error || attempts.find((attempt) => attempt?.error)?.error || "",
    attempts: attempts.map((attempt) => ({
      no: attempt?.no || item?.no || "",
      poNumber: attempt?.poNumber || "",
      step: attempt?.step || "",
      noResults: Boolean(attempt?.noResults),
      error: attempt?.error || "",
      debugSnapshot: attempt?.debugSnapshot || null,
      linkDiagnostics: attempt?.linkDiagnostics || [],
    })),
  };
}

async function ensurePackingManifestWorkingPage({ activeRun, config, context, log, pageRef }) {
  let page = pageRef?.current || null;
  if (page && !page.isClosed()) {
    return preparePackingManifestPage(page, config);
  }
  if (!context) {
    throw new Error("自动下载箱单浏览器页面已关闭，且无法重新打开。");
  }

  page = await findReusablePackingManifestPage(context);
  if (page) {
    page = await preparePackingManifestPage(page, config);
    if (pageRef) {
      pageRef.current = page;
    }
    if (typeof log === "function") {
      log("Packing List browser page handle was closed; reattached to an existing Infor page.", {
        runId: activeRun?.runId,
        url: page.url(),
      });
    }
    return page;
  }

  page = await preparePackingManifestPage(await context.newPage(), config);
  if (pageRef) {
    pageRef.current = page;
  }
  if (typeof log === "function") {
    log("Packing List browser page was closed; opened a fresh search page.", {
      runId: activeRun?.runId,
    });
  }
  return page;
}

async function preparePackingManifestPage(page, config, message = "自动下载箱单运行中") {
  page.setDefaultTimeout(config.navigationTimeoutMs);
  page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
  await showPackingListAutomationBadge(page, message, {
    phase: "running",
  });
  return page;
}

async function findReusablePackingManifestPage(context) {
  const pages = typeof context?.pages === "function"
    ? context.pages().filter((item) => item && !item.isClosed())
    : [];
  const reversed = [...pages].reverse();
  return reversed.find((item) => /network\.infornexus\.com/i.test(item.url()))
    || reversed.find((item) => item.url() !== "about:blank")
    || reversed[0]
    || null;
}

async function resetPackingManifestSearchPageAfterFailedAttempt(options) {
  const {
    attempts = [],
    config,
    groupIndex = 0,
    groupTotal = 0,
    no = "",
    page,
    packingManifestUrl,
    poIndex = 0,
    poNumber = "",
    poNumbers = [],
  } = options;
  if (!Array.isArray(attempts) || attempts.length === 0 || !page || page.isClosed()) {
    return false;
  }
  await showPackingListAutomationBadge(page, `上一 PO 未成功，正在重新进入查询页处理 ${poNumber}`, {
    phase: "reset-search-page",
    no,
    poNumber,
    totalCount: groupTotal,
    completedCount: groupIndex,
    attemptedCount: poIndex + 1,
    currentPoIndex: poIndex + 1,
    totalPoCount: poNumbers.length,
  });
  await page.goto(packingManifestUrl, {
    waitUntil: "domcontentloaded",
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 12000),
  }).catch(() => null);
  await waitForPageSettled(page, config);
  return true;
}

async function openPackingManifestSearchPage(page, packingManifestUrl, config, poNumber = "") {
  await showPackingListAutomationBadge(page, "正在确认箱单查询页", {
    phase: "open-packing-manifest",
  });
  if (isPackingManifestViewUrl(page.url()) && !(await isBrowserLoginPage(page))) {
    if (poNumber) {
      await clearMismatchedPackingManifestPoFilterChip(page, poNumber);
    }
    if (await hasReadyPackingManifestPoInput(page)) {
      await showPackingListAutomationBadge(page, "箱单查询页已就绪", {
        phase: "packing-manifest-ready",
      });
      return;
    }
    if (await openPackingManifestFilterPanel(page)) {
      await page.waitForTimeout(120).catch(() => {});
      if (await hasReadyPackingManifestPoInput(page)) {
        await showPackingListAutomationBadge(page, "箱单查询页已就绪", {
          phase: "packing-manifest-ready",
        });
        return;
      }
    }
    await showPackingListAutomationBadge(page, "箱单筛选面板未就绪，快速重新进入查询页", {
      phase: "open-packing-manifest",
    });
    return;
  }

  const beforeUrl = page.url();
  await page.goto(packingManifestUrl, {
    waitUntil: "domcontentloaded",
    timeout: Math.min(config.navigationTimeoutMs, 15000),
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error || "");
    if (!page.isClosed() && isPackingManifestResultsUrl(page.url() || beforeUrl) && isRecoverableNavigationError(message)) {
      return;
    }
    throw error;
  });
  await waitForPageSettled(page, config);
  await showPackingListAutomationBadge(page, "箱单查询页已就绪", {
    phase: "packing-manifest-ready",
  });
  if (await isBrowserLoginPage(page)) {
    throw new Error("Infor Nexus 登录会话已失效：返回箱单查询页时进入登录页。");
  }
}

async function ensurePackingManifestSearchReady(page, packingManifestUrl, config) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await openPackingManifestSearchPage(page, packingManifestUrl, config);
    if (await hasReadyPackingManifestPoInput(page)) {
      return true;
    }
    await openPackingManifestFilterPanel(page);
    await page.waitForTimeout(150).catch(() => {});
    if (await hasReadyPackingManifestPoInput(page)) {
      return true;
    }
    if (isPackingManifestViewUrl(page.url()) && !(await isBrowserLoginPage(page))) {
      continue;
    }
    await page.goto(packingManifestUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 12000),
    });
    await waitForPageSettled(page, config);
  }
  await resolvePackingManifestPoInput(page, config);
  return true;
}

async function hasReadyPackingManifestPoInput(page) {
  for (const root of [page, ...page.frames()]) {
    const input = await locatePackingManifestPoInputInFilterPanel(root).catch(() => null);
    if (input && await isLocatorVisible(input, 150)) {
      return true;
    }
  }
  return false;
}

async function clearMismatchedPackingManifestPoFilterChip(page, poNumber) {
  const expected = String(poNumber || "").trim();
  if (!expected) return false;
  if (await hasPackingManifestPoFilterChip(page, expected).catch(() => false)) {
    return false;
  }

  let cleared = false;
  for (const root of [page, ...page.frames()]) {
    const didClear = await root.evaluate((targetPo) => {
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none";
      };
      const chip = Array.from(document.querySelectorAll("button, span, div"))
        .filter(visible)
        .find((element) => {
          const text = normalize(element.textContent);
          return /PO Number\(s\)\s+contains/i.test(text) && !text.includes(targetPo);
        });
      if (!chip) return false;
      const closeIcon = chip.querySelector('use[href*="icon-close"], use[xlink\\:href*="icon-close"], svg.icon-close');
      const closeButton = closeIcon?.closest("button, [role='button'], span, div")
        || Array.from(chip.querySelectorAll("button, [role='button'], span, svg"))
          .reverse()
          .find(visible);
      if (closeButton) {
        closeButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        closeButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        closeButton.click();
        return true;
      }
      chip.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
      return false;
    }, expected).catch(() => false);
    if (didClear) {
      cleared = true;
      await page.waitForTimeout(180).catch(() => {});
      break;
    }
  }
  return cleared;
}

async function openPackingManifestFilterPanel(page) {
  for (const root of [page, ...page.frames()]) {
    const clicked = await root.evaluate(() => {
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none";
      };
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
        .filter((element) => visible(element) && !element.disabled);
      const scoreButton = (element) => {
        const text = String(element.textContent || "").replace(/\s+/g, " ").trim();
        const title = String(element.getAttribute("title") || "");
        const aria = String(element.getAttribute("aria-label") || "");
        const dataName = String(element.getAttribute("data-buttonname") || "");
        const html = String(element.innerHTML || "");
        if (/constraintApplyButton/i.test(dataName) || /^Apply$/i.test(text)) return 0;
        if (/^\+\s*Filter$/i.test(text)) return 140;
        if (/^Filter$/i.test(text)) return 120;
        if (/\$filter|filterButton/i.test(dataName)) return 105;
        if (/icon-filter/i.test(html)) return 95;
        if (/^Filter$/i.test(title) || /^Filter$/i.test(aria)) return 90;
        if (/Filter/i.test(`${title} ${aria} ${dataName}`)) return 60;
        return 0;
      };
      const candidate = buttons
        .map((element) => ({ element, score: scoreButton(element) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.element;
      if (!candidate) return false;
      candidate.scrollIntoView({ block: "center", inline: "center" });
      candidate.click();
      return true;
    }).catch(() => false);
    if (clicked) {
      return true;
    }
  }
  return false;
}

async function resolvePackingManifestResultLink(page, poNumber, config) {
  const deadline = Date.now() + PACKING_MANIFEST_RESULT_WAIT_MS;
  while (Date.now() < deadline) {
    const roots = [page, ...page.frames()];
    for (const root of roots) {
      const domLink = await findPackingManifestDocumentLink(root);
      if (domLink) {
        return domLink;
      }
      const candidates = [
        root.locator('td.preserveLineBreaks.first-cell-content a:not(.folderIconHoverLink)[href*="PageResolver.jsp"][href*="pageResolverType=OrdersViewDocumentResolver"][href*="docType=PackingManifest"]').filter({ hasText: /^\s*\d+\s*$/ }).first(),
        root.locator('a:not(.folderIconHoverLink)[href*="PageResolver.jsp"][href*="pageResolverType=OrdersViewDocumentResolver"][href*="docType=PackingManifest"]').filter({ hasText: /^\s*\d+\s*$/ }).first(),
        root.locator('a:not(.folderIconHoverLink)[href*="PageResolver.jsp"][href*="pageResolverType=OrdersViewDocumentResolver"][href*="docType=PackingManifest"]').first(),
        root.locator('td.first-cell-content a[href*="docType=PackingManifest"]').first(),
        root.locator('a[href*="PageResolver.jsp"][href*="docType=PackingManifest"]').first(),
        root.locator('a[href*="docType=PackingManifest"]').first(),
        root.locator('a[href*="PackingManifest"]').first(),
      ];
      for (const candidate of candidates) {
        if (await isLocatorVisible(candidate, 500)) {
          return candidate;
        }
      }
    }
    await page.waitForTimeout(200).catch(() => {});
  }
  return null;
}

async function resolvePackingManifestResultLinkInfo(page, poNumber, config) {
  const deadline = Date.now() + PACKING_MANIFEST_RESULT_WAIT_MS;
  while (Date.now() < deadline) {
    for (const root of [page, ...page.frames()]) {
      const linkInfo = await readPackingManifestLinkFromActiveDom(root).catch(() => null);
      if (linkInfo?.href) {
        return linkInfo;
      }
    }
    await page.waitForTimeout(200).catch(() => {});
  }
  return null;
}

async function openFirstPackingManifestSearchResult(page, responseLinkInfo, config, poNumber = "") {
  if (page.isClosed()) {
    return null;
  }

  const responseLink = responseLinkInfo?.href || responseLinkInfo?.rawHref
    ? {
        ...responseLinkInfo,
        href: new URL(responseLinkInfo.href || responseLinkInfo.rawHref, page.url()).toString(),
        source: responseLinkInfo.source || "flex-view-response",
      }
    : null;
  if (responseLink?.href) {
    return {
      page,
      linkInfo: responseLink,
    };
  }

  if (await hasNoPackingManifestResults(page, poNumber).catch(() => false)) {
    return {
      page,
      linkInfo: null,
      notFound: true,
      reason: "no-results",
    };
  }

  const linkInfo = await waitForAndNavigatePackingManifestResultInPage(page, config, poNumber);
  if (linkInfo?.notFound) {
    return {
      page,
      linkInfo: null,
      notFound: true,
      reason: linkInfo.reason || "no-results",
    };
  }
  if (linkInfo?.pageClosed) {
    return {
      page,
      linkInfo: null,
      pageClosed: true,
      reason: linkInfo.reason || "page-closed",
    };
  }
  if (!linkInfo?.href) {
    return null;
  }
  return {
    page,
    linkInfo,
  };
}

async function waitForAndNavigatePackingManifestResultInPage(page, config, poNumber = "") {
  const timeout = Math.min(Number(config.navigationTimeoutMs) || 30000, PACKING_MANIFEST_RESULT_WAIT_MS);
  const deadline = Date.now() + timeout;
  let linkInfo = null;

  while (Date.now() < deadline) {
    if (page.isClosed()) {
      return {
        pageClosed: true,
        reason: "page-closed-during-result-wait",
      };
    }

    for (const root of [page, ...page.frames()]) {
      const outcome = await readPackingManifestSearchOutcome(root, poNumber).catch(() => null);
      if (outcome?.notFound) {
        return outcome;
      }
      if (outcome?.linkInfo?.href) {
        linkInfo = outcome.linkInfo;
        break;
      }
    }

    if (linkInfo?.href) {
      break;
    }

    await page.waitForTimeout(150).catch(() => {});
  }

  if (linkInfo?.notFound) {
    return linkInfo;
  }
  if (linkInfo?.pageClosed) {
    return linkInfo;
  }
  if (!linkInfo?.href) {
    return null;
  }

  const detailUrl = new URL(linkInfo.href, page.url()).toString();
  return {
    ...linkInfo,
    href: detailUrl,
  };
}

async function clickExactPackingManifestResultAnchor(page, linkInfo, config) {
  const rawHref = String(linkInfo?.rawHref || linkInfo?.href || "");
  const linkText = String(linkInfo?.text || "").replace(/\s+/g, " ").trim();
  const hrefFolderId = rawHref.match(/folderId=(\d{6,})/i)?.[1] || linkText;
  const exactAnchorSelector = [
    "#active",
    "td.preserveLineBreaks.first-cell-content",
    "a[href*=\"PageResolver.jsp\"]",
    "[href*=\"pageResolverType=OrdersViewDocumentResolver\"]",
    "[href*=\"docType=PackingManifest\"]",
    ":not(.folderIconHoverLink)",
  ].join(" ");

  for (const root of [page, ...page.frames()]) {
    const anchors = root.locator(exactAnchorSelector);
    const count = await anchors.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const anchor = anchors.nth(index);
      const text = await anchor.innerText({ timeout: 300 }).catch(() => "");
      const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
      if (hrefFolderId && normalizedText && normalizedText !== hrefFolderId) {
        continue;
      }
      await anchor.click({
        timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 3000),
      });
      return true;
    }
  }
  return false;
}

async function extractPackingManifestResultLinkInfoFromResponse(response, baseUrl, poNumber = "") {
  if (!response) return null;
  const variants = await readResponseTextVariants(response);
  const expectedPo = String(poNumber || "").trim();
  for (const text of variants) {
    const linkInfo = extractPackingManifestResultLinkInfoFromText(text, baseUrl, expectedPo);
    if (linkInfo?.href) {
      return {
        ...linkInfo,
        source: "flex-view-response",
        flexViewResponseUrl: response.url?.() || "",
      };
    }
  }
  return null;
}

async function readResponseTextVariants(response) {
  const variants = [];
  const push = (value) => {
    const text = String(value || "");
    if (text && !variants.includes(text)) {
      variants.push(text);
    }
  };

  const buffer = Buffer.from(await response.body());
  push(buffer.toString("utf8"));
  for (const inflate of [inflateSync, unzipSync]) {
    try {
      push(inflate(buffer).toString("utf8"));
    } catch {
      // FlexView usually arrives as text, but some deployments wrap the RPC body.
    }
  }
  return variants;
}

function extractPackingManifestResultLinkInfoFromText(text, baseUrl, poNumber = "") {
  const variants = [
    String(text || ""),
    htmlDecode(String(text || "")),
    safeDecodeURIComponent(String(text || "")),
    htmlDecode(safeDecodeURIComponent(String(text || ""))),
  ].filter(Boolean);

  for (const variant of variants) {
    const hrefs = findPackingManifestPageResolverHrefs(variant);
    const href = hrefs.find((candidate) => packingManifestCandidateMatchesPo(variant, candidate, poNumber));
    if (href) {
      return buildPackingManifestLinkInfoFromHref(href, baseUrl, "response-href");
    }
  }

  for (const variant of variants) {
    const folderId = findPackingManifestFolderIds(variant)
      .find((candidate) => packingManifestCandidateMatchesPo(variant, candidate, poNumber));
    if (folderId) {
      const href = `PageResolver.jsp?pageResolverType=OrdersViewDocumentResolver&folderId=${folderId}&docType=PackingManifest`;
      return buildPackingManifestLinkInfoFromHref(href, baseUrl, "response-folder-id");
    }
  }
  return null;
}

function findPackingManifestPageResolverHref(text) {
  return findPackingManifestPageResolverHrefs(text)[0] || "";
}

function findPackingManifestPageResolverHrefs(text) {
  const patterns = [
    /href\s*=\s*\\?["']([^"']*PageResolver\.jsp[^"']*OrdersViewDocumentResolver[^"']*docType=PackingManifest[^"']*)\\?["']/gi,
    /\\?["']([^"']*PageResolver\.jsp[^"']*OrdersViewDocumentResolver[^"']*docType=PackingManifest[^"']*)\\?["']/gi,
    /\b(PageResolver\.jsp\?[^"'<>\\\s]*OrdersViewDocumentResolver[^"'<>\\\s]*docType=PackingManifest[^"'<>\\\s]*)/gi,
    /\b(\/en\/trade\/PageResolver\.jsp\?[^"'<>\\\s]*OrdersViewDocumentResolver[^"'<>\\\s]*docType=PackingManifest[^"'<>\\\s]*)/gi,
  ];
  const hrefs = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of String(text || "").matchAll(pattern)) {
      if (match?.[1]) {
        const href = cleanExtractedHref(match[1]);
        if (href && !hrefs.includes(href)) {
          hrefs.push(href);
        }
      }
    }
  }
  return hrefs;
}

function findPackingManifestFolderId(text) {
  return findPackingManifestFolderIds(text)[0] || "";
}

function findPackingManifestFolderIds(text) {
  if (!/docType=PackingManifest|OrdersViewDocumentResolver|PackingManifest/i.test(text)) {
    return [];
  }
  const patterns = [
    /folderId(?:=|%3D|\\?["']?\s*:\s*\\?["']?)(\d{6,})/gi,
    /ManifestFolder\?key=(\d{6,})/gi,
    /Packing\s*List\s*Ref\s*Number[\s\S]{0,500}?(\d{6,})/gi,
  ];
  const folderIds = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of String(text || "").matchAll(pattern)) {
      if (match?.[1] && !folderIds.includes(match[1])) {
        folderIds.push(match[1]);
      }
    }
  }
  return folderIds;
}

function packingManifestCandidateMatchesPo(text, candidate, poNumber = "") {
  const expectedPo = String(poNumber || "").trim();
  if (!expectedPo) return true;
  const haystack = String(text || "");
  const values = [candidate];
  const folderId = extractFolderIdFromPackingManifestCandidate(candidate);
  if (folderId) {
    values.push(folderId);
  }
  for (const value of values.filter(Boolean)) {
    let index = haystack.indexOf(value);
    while (index >= 0) {
      const context = haystack.slice(Math.max(0, index - 1200), index + value.length + 1800);
      if (context.includes(expectedPo)) {
        return true;
      }
      index = haystack.indexOf(value, index + value.length);
    }
  }
  return false;
}

function extractFolderIdFromPackingManifestCandidate(candidate) {
  const value = cleanExtractedHref(candidate);
  try {
    return new URL(value, "https://network.infornexus.com/en/trade/PackingManifestView.jsp").searchParams.get("folderId") || "";
  } catch {
    const match = value.match(/(?:folderId=|ManifestFolder\?key=)(\d{6,})/i);
    return match?.[1] || "";
  }
}

function buildPackingManifestLinkInfoFromHref(href, baseUrl, source) {
  const rawHref = cleanExtractedHref(href);
  const absoluteHref = new URL(rawHref, baseUrl || "https://network.infornexus.com/en/trade/PackingManifestView.jsp").toString();
  const folderId = new URL(absoluteHref).searchParams.get("folderId") || "";
  return {
    href: absoluteHref,
    rawHref,
    text: folderId,
    className: "",
    source,
  };
}

function cleanExtractedHref(value) {
  return htmlDecode(String(value || ""))
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .trim()
    .replace(/\\+$/g, "")
    .replace(/["']+$/g, "")
    .trim();
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readPackingManifestLinkFromActiveDom(root) {
  return root.evaluate(() => {
    const active = document.querySelector("#active") || document;
    const firstCell = active.querySelector("td.preserveLineBreaks.first-cell-content") || active;
    const anchors = Array.from(firstCell.querySelectorAll("a[href]"));
    let anchor = anchors.find((item) => {
      const href = `${item.getAttribute("href") || ""} ${item.href || ""}`;
      const text = String(item.textContent || "").replace(/\s+/g, " ").trim();
      const className = String(item.className || "");
      return !className.includes("folderIconHoverLink")
        && href.includes("PageResolver.jsp")
        && href.includes("OrdersViewDocumentResolver")
        && href.includes("docType=PackingManifest")
        && /^\d+$/.test(text);
    });
    if (!anchor) {
      const folderAnchor = anchors.find((item) => {
        const href = `${item.getAttribute("href") || ""} ${item.href || ""}`;
        return href.includes("ManifestFolder?key=");
      });
      const match = String(folderAnchor?.getAttribute("href") || folderAnchor?.href || "").match(/ManifestFolder\?key=(\d{6,})/i);
      if (match?.[1]) {
        return {
          href: new URL(`PageResolver.jsp?pageResolverType=OrdersViewDocumentResolver&folderId=${match[1]}&docType=PackingManifest`, window.location.href).toString(),
          rawHref: `PageResolver.jsp?pageResolverType=OrdersViewDocumentResolver&folderId=${match[1]}&docType=PackingManifest`,
          text: match[1],
          className: String(folderAnchor?.className || ""),
          source: "manifest-folder-dom-fallback",
        };
      }
    }
    if (!anchor) {
      return null;
    }
    return {
      href: anchor.href || anchor.getAttribute("href") || "",
      rawHref: anchor.getAttribute("href") || "",
      text: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
      className: String(anchor.className || ""),
      source: "page-resolver-dom",
    };
  });
}

async function readPackingManifestSearchOutcome(root, poNumber = "") {
  return root.evaluate((searchedPoNumber) => {
    const active = document.querySelector("#active") || document;
    const normalizedPo = String(searchedPoNumber || "").trim();
    const activeText = String(active?.innerText || "").replace(/\s+/g, " ").trim();
    const bodyClone = document.body?.cloneNode(true);
    bodyClone?.querySelectorAll?.("#tos-packing-list-auto-download-badge, #tos-packing-list-auto-download-progress")
      ?.forEach((element) => element.remove());
    const bodyText = String((bodyClone || document.body)?.innerText || "").replace(/\s+/g, " ").trim();
    const hasCurrentPoInPage = !normalizedPo
      || activeText.includes(normalizedPo)
      || bodyText.includes(`PO Number(s) contains ${normalizedPo}`)
      || bodyText.includes(`PO Number(s) contains ${normalizedPo} `);
    const firstCell = active.querySelector("td.preserveLineBreaks.first-cell-content") || active;
    const anchors = Array.from(firstCell.querySelectorAll("a[href]"));
    const pageResolverAnchor = anchors.find((anchor) => {
      const href = `${anchor.getAttribute("href") || ""} ${anchor.href || ""}`;
      const linkText = String(anchor.textContent || "").replace(/\s+/g, " ").trim();
      const className = String(anchor.className || "");
      return !className.includes("folderIconHoverLink")
        && href.includes("PageResolver.jsp")
        && href.includes("OrdersViewDocumentResolver")
        && href.includes("docType=PackingManifest")
        && /^\d+$/.test(linkText);
    });
    if (pageResolverAnchor) {
      if (normalizedPo && !activeText.includes(normalizedPo)) {
        return {
          pendingApply: true,
          reason: "result-does-not-match-po",
          text: activeText.slice(0, 300),
          poNumber: normalizedPo,
        };
      }
      return {
        linkInfo: {
          href: pageResolverAnchor.href || pageResolverAnchor.getAttribute("href") || "",
          rawHref: pageResolverAnchor.getAttribute("href") || "",
          text: String(pageResolverAnchor.textContent || "").replace(/\s+/g, " ").trim(),
          className: String(pageResolverAnchor.className || ""),
          source: "page-resolver-dom-outcome",
        },
      };
    }

    const folderAnchor = anchors.find((anchor) => {
      const href = `${anchor.getAttribute("href") || ""} ${anchor.href || ""}`;
      return href.includes("ManifestFolder?key=");
    });
    const match = String(folderAnchor?.getAttribute("href") || folderAnchor?.href || "").match(/ManifestFolder\?key=(\d{6,})/i);
    if (match?.[1]) {
      if (normalizedPo && !activeText.includes(normalizedPo)) {
        return {
          pendingApply: true,
          reason: "folder-result-does-not-match-po",
          text: activeText.slice(0, 300),
          poNumber: normalizedPo,
        };
      }
      return {
        linkInfo: {
          href: new URL(`PageResolver.jsp?pageResolverType=OrdersViewDocumentResolver&folderId=${match[1]}&docType=PackingManifest`, window.location.href).toString(),
          rawHref: `PageResolver.jsp?pageResolverType=OrdersViewDocumentResolver&folderId=${match[1]}&docType=PackingManifest`,
          text: match[1],
          className: String(folderAnchor?.className || ""),
          source: "manifest-folder-dom-outcome",
        },
      };
    }

    const noResultCell = active.querySelector(".flexresults tbody tr.noresults td") || active.querySelector("tr.noresults td");
    const noResultText = String(noResultCell?.textContent || "").replace(/\s+/g, " ").trim();
    const hasApplyPrompt = /^Please apply filter criteria$/i.test(noResultText);
    const hasNoResults = /^No Results$/i.test(noResultText);
    if (hasNoResults) {
      if (!hasCurrentPoInPage) {
        return {
          pendingApply: true,
          reason: "no-results-does-not-match-po",
          text: bodyText.slice(0, 300),
          activeText: activeText.slice(0, 300),
          poNumber: normalizedPo,
        };
      }
      return {
        notFound: true,
        reason: "no-results-dom",
        text: noResultText,
        source: "no-results-dom",
        poNumber: normalizedPo,
      };
    }

    return {
      pendingApply: hasApplyPrompt,
      text: noResultText,
      poNumber: normalizedPo,
    };
  }, poNumber);
}

function isPackingManifestFilterStillPending(fillResult) {
  if (!fillResult) return true;
  if (fillResult.searchOutcome?.pendingApply) return true;
  if (fillResult.searchOutcome?.notFound) return false;
  if (fillResult.searchOutcome?.linkInfo?.href) return false;
  if (fillResult.responseLinkInfo?.href) return false;
  return !fillResult.filterApplied;
}

async function findPackingManifestDocumentLink(root) {
  const links = root.locator("#active td.preserveLineBreaks.first-cell-content a[href]");
  const index = await links.evaluateAll((anchors) => anchors.findIndex((anchor) => {
    const href = `${anchor.getAttribute("href") || ""} ${anchor.href || ""}`;
    const text = String(anchor.textContent || "").replace(/\s+/g, " ").trim();
    const className = String(anchor.className || "");
    return !className.includes("folderIconHoverLink")
      && href.includes("PageResolver.jsp")
      && href.includes("OrdersViewDocumentResolver")
      && href.includes("docType=PackingManifest")
      && /^\d+$/.test(text);
  })).catch(() => -1);
  return index >= 0 ? links.nth(index) : null;
}

async function hasNoPackingManifestResults(page, poNumber) {
  for (const root of [page, ...page.frames()]) {
    const outcome = await readPackingManifestSearchOutcome(root, poNumber).catch(() => null);
    if (outcome?.notFound) {
      return true;
    }
  }
  return false;
}

async function collectPackingManifestResultLinkDiagnostics(page) {
  const diagnostics = [];
  for (const root of [page, ...page.frames()]) {
    const frameUrl = typeof root.url === "function" ? root.url() : page.url();
    const locatorLinks = await root.locator("a[href]").evaluateAll((anchors) => anchors
      .map((anchor) => ({
        text: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || "",
        absoluteHref: anchor.href || "",
        className: anchor.className || "",
      }))
      .filter((item) => /PageResolver|PackingManifest|ManifestFolder/i.test(`${item.href} ${item.absoluteHref} ${item.text}`))
      .slice(0, 20)).catch(() => []);
    const links = await root.locator("body").first().evaluate(() => Array
      .from(document.querySelectorAll("a[href]"))
      .map((anchor) => ({
        text: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") || "",
        absoluteHref: anchor.href || "",
        className: anchor.className || "",
      }))
      .filter((item) => /PageResolver|PackingManifest|ManifestFolder/i.test(`${item.href} ${item.absoluteHref} ${item.text}`))
      .slice(0, 20)).catch(() => []);
    diagnostics.push(...locatorLinks.map((item) => ({ frameUrl, source: "locator", ...item })));
    diagnostics.push(...links.map((item) => ({ frameUrl, source: "querySelector", ...item })));
  }
  return diagnostics.slice(0, 30);
}

async function writePackingManifestDebugSnapshot(options) {
  const {
    no,
    page,
    poNumber,
    reason,
    runId,
  } = options;
  const debugDirectory = resolvePackingManifestDebugDirectory(runId);
  await mkdir(debugDirectory, { recursive: true });
  const baseName = sanitizeFileName(`${runId || "run"}-${no || "no"}-${poNumber || "po"}-${reason || "debug"}`) || "packing-list-debug";
  const jsonPath = path.join(debugDirectory, `${baseName}.json`);
  const screenshotPath = path.join(debugDirectory, `${baseName}.png`);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    reason,
    runId,
    no,
    poNumber,
    pageClosed: page.isClosed(),
  };

  if (!page.isClosed()) {
    Object.assign(snapshot, await page.evaluate(() => {
      const active = document.querySelector("#active") || document;
      const bodyText = String(document.body?.innerText || "");
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        bodyText: bodyText.slice(0, 5000),
        activeText: String(active?.innerText || "").slice(0, 5000),
        activeHtml: String(active?.outerHTML || document.documentElement?.outerHTML || "").slice(0, 40000),
        links: Array.from(document.querySelectorAll("a[href]")).map((anchor) => ({
          text: String(anchor.textContent || "").replace(/\s+/g, " ").trim(),
          href: anchor.getAttribute("href") || "",
          absoluteHref: anchor.href || "",
          className: String(anchor.className || ""),
          html: String(anchor.outerHTML || "").slice(0, 500),
        })).filter((item) => /PageResolver|PackingManifest|ManifestFolder|571/i.test(`${item.text} ${item.href} ${item.absoluteHref} ${item.html}`)).slice(0, 80),
        clickables: Array.from(document.querySelectorAll("button, a, [role='button'], .btn, input[type='button'], input[type='submit'], span, div"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tagName: String(element.tagName || ""),
              text: String(element.textContent || element.value || element.getAttribute("aria-label") || element.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 160),
              className: String(element.className || "").slice(0, 200),
              id: String(element.id || ""),
              role: String(element.getAttribute("role") || ""),
              title: String(element.getAttribute("title") || ""),
              dataButtonName: String(element.getAttribute("data-buttonname") || ""),
              type: String(element.getAttribute("type") || ""),
              visible: rect.width > 0 && rect.height > 0,
              rect: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              html: String(element.outerHTML || "").slice(0, 600),
            };
          })
          .filter((item) => /Apply|Cancel|Filter|PO Number/i.test(`${item.text} ${item.className} ${item.id} ${item.title} ${item.dataButtonName} ${item.html}`))
          .slice(0, 120),
        filterCandidates: Array.from(document.querySelectorAll(".popover, .dropdown, .modal, .dialog, .filter, .constraint, [role='dialog'], div"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tagName: String(element.tagName || ""),
              className: String(element.className || "").slice(0, 200),
              id: String(element.id || ""),
              text: String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500),
              visible: rect.width > 0 && rect.height > 0,
              rect: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              html: String(element.outerHTML || "").slice(0, 1200),
            };
          })
          .filter((item) => item.visible && /Filter|PO Number|Apply/i.test(`${item.text} ${item.className} ${item.html}`))
          .slice(0, 80),
      };
    }));
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    snapshot.screenshotPath = screenshotPath;
  }

  await writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return {
    jsonPath,
    screenshotPath: snapshot.screenshotPath || "",
    linkCount: Array.isArray(snapshot.links) ? snapshot.links.length : 0,
    url: snapshot.url || "",
    pageClosed: snapshot.pageClosed,
  };
}

function resolvePackingManifestDebugDirectory(runId = "") {
  const appDataRoot = process.env.APPDATA
    ? path.join(process.env.APPDATA, "TOS-Automation-Helper", "automation-apps", "shipping-automation-demo")
    : "";
  const roots = [
    process.env.TMS_PLAYWRIGHT_DATA_DIR,
    process.env.TOS_AUTOMATION_APP_DATA_DIR,
    appDataRoot,
    process.cwd(),
  ].map((item) => String(item || "").trim()).filter(Boolean);
  const root = roots[0] || process.cwd();
  const runFolder = sanitizeFileName(String(runId || "run")) || "run";
  return path.join(root, "run-artifacts", "packing-list-debug", runFolder);
}

async function openPackingManifestDetail(page, resultLink, config, linkInfo = null) {
  const href = String(linkInfo?.href || await resultLink.getAttribute("href").catch(() => "") || "").trim();
  const linkText = String(linkInfo?.text || "").trim();
  if (href) {
    const beforeUrl = page.url();
    const detailUrl = new URL(href, beforeUrl).toString();
    await forceNavigatePackingManifestDocumentLink(page, resultLink, detailUrl, config);
    await page.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
    await waitForPageSettled(page, config);

    if (await isStillOnPackingManifestResultsPage(page, beforeUrl)) {
      throw new Error(`已找到箱单详情链接 ${linkText || href}，但点击后仍停留在搜索结果页：${detailUrl}`);
    }
    if (await isBrowserLoginPage(page)) {
      throw new Error("Infor Nexus 登录会话已失效：打开箱单详情时返回登录页。");
    }
    return page;
  }

  const popupPromise = page.waitForEvent("popup", { timeout: 3000 }).catch(() => null);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    clickResultLinkWithFallback(resultLink, config),
  ]);
  const popup = await popupPromise;
  const detailPage = popup || page;
  await detailPage.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
  await waitForPageSettled(detailPage, config);
  if (await isBrowserLoginPage(detailPage)) {
    throw new Error("Infor Nexus 登录会话已失效：打开箱单详情时返回登录页。");
  }
  return detailPage;
}

async function openPackingManifestDetailByUrl(page, linkInfo, config) {
  const href = String(linkInfo?.href || linkInfo?.rawHref || "").trim();
  if (!href) {
    throw new Error("PackingManifest result link href is empty.");
  }
  const beforeUrl = page.url();
  const detailUrl = new URL(href, beforeUrl).toString();
  const urlChangePromise = page.waitForURL((url) => !isPackingManifestResultsUrl(url.toString()), {
    timeout: 2000,
  }).catch(() => null);
  await page.evaluate((url) => {
    window.location.assign(url);
  }, detailUrl).catch(() => null);
  await urlChangePromise;
  if (isPackingManifestResultsUrl(page.url())) {
    await page.goto(detailUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 8000),
    });
  }
  await page.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
  await waitForPageSettled(page, config);
  if (await isStillOnPackingManifestResultsPage(page, beforeUrl)) {
    throw new Error(`PackingManifest detail link stayed on results page: ${linkInfo?.text || href} -> ${detailUrl}`);
  }
  if (await isBrowserLoginPage(page)) {
    throw new Error("Infor Nexus login session expired while opening PackingManifest detail.");
  }
  return page;
}

async function forceNavigatePackingManifestDocumentLink(page, resultLink, detailUrl, config) {
  const quickTimeout = 2000;
  await resultLink.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});

  const urlChangePromise = page.waitForURL((url) => !isPackingManifestResultsUrl(url.toString()), {
    timeout: quickTimeout,
  }).catch(() => null);

  const openedUrl = await resultLink.evaluate((element, fallbackUrl) => {
    const anchor = element.closest('a[href*="PageResolver.jsp"][href*="docType=PackingManifest"]') || element;
    const url = anchor.href || anchor.getAttribute("href") || fallbackUrl;
    if (anchor instanceof HTMLAnchorElement) {
      anchor.target = "_self";
    }
    try {
      window.top.location.assign(url);
    } catch {
      window.location.assign(url);
    }
    return url;
  }, detailUrl).catch(async () => {
    await page.evaluate((url) => {
      window.location.assign(url);
    }, detailUrl).catch(() => null);
    return detailUrl;
  });

  await urlChangePromise;
  if (!isPackingManifestResultsUrl(page.url())) {
    return openedUrl || detailUrl;
  }

  await page.goto(openedUrl || detailUrl, {
    waitUntil: "domcontentloaded",
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 8000),
  });
  await page.waitForURL((url) => !isPackingManifestResultsUrl(url.toString()), {
    timeout: quickTimeout,
  }).catch(() => null);
  return openedUrl || detailUrl;
}

async function clickPackingManifestDocumentLink(page, resultLink, href, linkText, config) {
  const timeout = Math.min(config.navigationTimeoutMs, 8000);
  await resultLink.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

  try {
    await resultLink.click({ timeout });
    return "locator-click";
  } catch {
    // Some Infor Nexus grid links are visible, but pointer clicks may only select
    // the row. Invoke the anchor itself before falling back to a page-level lookup.
  }

  try {
    await resultLink.evaluate((element) => {
      if (element instanceof HTMLAnchorElement) {
        element.target = "_self";
      }
      element.scrollIntoView({ block: "center", inline: "center" });
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      element.click();
    });
    return "locator-dom-click";
  } catch {
    // Final fallback below locates the exact PageResolver anchor again in the page.
  }

  if (!href) {
    throw new Error("PackingManifest result was found, but its detail href is empty.");
  }

  const clicked = await page.evaluate(({ href: targetHref, text }) => {
    const normalizeHref = (value) => String(value || "").replace(/&amp;/g, "&");
    const wanted = normalizeHref(targetHref);
    const wantedText = String(text || "").trim();
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const anchor = anchors.find((item) => {
      const attributeHref = item.getAttribute("href") || "";
      const itemHref = normalizeHref(item.href || attributeHref);
      const itemText = String(item.textContent || "").replace(/\s+/g, " ").trim();
      const hrefMatches = itemHref === wanted
        || itemHref.endsWith(wanted)
        || wanted.endsWith(attributeHref);
      const textMatches = !wantedText || itemText === wantedText;
      return hrefMatches && textMatches;
    });
    if (!anchor) return false;
    if (anchor instanceof HTMLAnchorElement) {
      anchor.target = "_self";
    }
    anchor.scrollIntoView({ block: "center", inline: "center" });
    anchor.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
    anchor.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    anchor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    anchor.click();
    return true;
  }, { href, text: linkText }).catch(() => false);

  if (!clicked) {
    throw new Error(`PackingManifest detail link could not be clicked: ${linkText || href}`);
  }
  return "page-dom-click";
}

async function clickResultLinkWithFallback(resultLink, config) {
  try {
    await resultLink.click({ timeout: Math.min(config.navigationTimeoutMs, 8000) });
    return;
  } catch {
    await resultLink.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      element.click();
    });
  }
}

async function isStillOnPackingManifestResultsPage(page, beforeUrl) {
  const currentUrl = page.url();
  if (!isPackingManifestResultsUrl(currentUrl) && currentUrl !== beforeUrl) {
    return false;
  }
  const hasViewPdfAction = await page
    .locator('a[href="javascript:loadPDF();"], a[href*="loadPDF"]')
    .first()
    .count()
    .catch(() => 0);
  if (hasViewPdfAction > 0) {
    return false;
  }
  const hasResultLink = await page
    .locator('a[href*="PageResolver.jsp"][href*="docType=PackingManifest"]')
    .first()
    .count()
    .catch(() => 0);
  return hasResultLink > 0 || isPackingManifestResultsUrl(currentUrl);
}

function isPackingManifestResultsUrl(value) {
  return String(value || "").includes("/PackingManifestView.jsp");
}

function isPackingManifestViewUrl(value) {
  return String(value || "").includes("/PackingManifestView.jsp");
}

function isRecoverableNavigationError(message) {
  return /net::ERR_ABORTED|frame was detached|Execution context was destroyed|Navigation failed because page was closed/i
    .test(String(message || ""));
}

async function downloadPackingManifestPdfForGroup(options) {
  const {
    config,
    downloadDirectory,
    detailUrl = "",
    groupNo,
    linkInfo = null,
    page,
  } = options;
  await mkdir(downloadDirectory, { recursive: true });
  const baseName = sanitizeFileName(`Packing list ${groupNo}.pdf`) || "Packing list.pdf";
  const fileName = await nextAvailableFileName(downloadDirectory, baseName);
  const filePath = path.join(downloadDirectory, fileName);
  let downloadPage = page;
  let context = downloadPage.context();
  const absoluteDetailUrl = detailUrl
    ? new URL(detailUrl, downloadPage.url()).toString()
    : "";

  const directRequestResult = absoluteDetailUrl
    ? await downloadPackingManifestPdfByDetailRequest({
      context,
      detailUrl: absoluteDetailUrl,
      fileName,
      filePath,
      linkInfo,
      referer: downloadPage.url(),
    })
    : null;
  if (directRequestResult) {
    return directRequestResult;
  }

  if (absoluteDetailUrl && isPackingManifestResultsUrl(downloadPage.url())) {
    downloadPage = await openPackingManifestDetailByUrl(downloadPage, {
      ...linkInfo,
      href: absoluteDetailUrl,
      rawHref: absoluteDetailUrl,
    }, config);
    context = downloadPage.context();
  }

  if (isPackingManifestResultsUrl(downloadPage.url())) {
    throw new Error(`PackingManifest detail page was not opened; refusing to look for View PDF on the results page: ${absoluteDetailUrl || "missing detail url"}`);
  }

  const directPdfUrl = await resolvePackingManifestPdfUrlFromDetailPage(downloadPage);
  if (directPdfUrl) {
    const directFetchResult = await fetchAndSavePackingManifestPdfUrl({
      context,
      fileName,
      filePath,
      pdfUrl: directPdfUrl,
      referer: downloadPage.url(),
      source: "packing-manifest-pdf-request",
    });
    if (directFetchResult) {
      return directFetchResult;
    }
  }

  const pdfResponsePromise = context.waitForEvent("response", (response) => (
    isLikelyPackingManifestPdfResponse(response)
  ), {
    timeout: Math.min(PACKING_MANIFEST_PDF_WAIT_MS, 8000),
  }).catch(() => null);
  const mainDownloadPromise = downloadPage.waitForEvent("download", {
    timeout: Math.min(PACKING_MANIFEST_PDF_WAIT_MS, 8000),
  }).catch(() => null);

  const viewPdfItem = await openPackingManifestViewPdfMenuItem(downloadPage, config);
  const popupPromise = downloadPage.waitForEvent("popup", { timeout: 8000 }).catch(() => null);
  await viewPdfItem.click({ timeout: Math.min(config.navigationTimeoutMs, 8000) });
  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
  }
  const popupDownloadPromise = popup
    ? popup.waitForEvent("download", { timeout: PACKING_MANIFEST_PDF_WAIT_MS }).catch(() => null)
    : Promise.resolve(null);

  const earlyDownload = await Promise.race([
    mainDownloadPromise,
    popupDownloadPromise,
    delay(3000).then(() => null),
  ]);
  if (earlyDownload) {
    return saveDownloadAs(earlyDownload, filePath, fileName, "playwright-download");
  }

  const response = await Promise.race([
    pdfResponsePromise,
    delay(3000).then(() => null),
  ]);
  if (response) {
    const responseResult = await trySavePackingManifestPdfResponse({
      context,
      fileName,
      filePath,
      response,
    });
    if (responseResult) {
      return responseResult;
    }
  }

  const pdfViewerPage = popup || downloadPage;
  if (pdfViewerPage) {
    await waitForPdfViewerSurface(pdfViewerPage, 5000);
    const viewerDownload = await triggerPdfViewerSaveDownload(pdfViewerPage, config);
    if (viewerDownload) {
      return saveDownloadAs(viewerDownload, filePath, fileName, "pdf-viewer-save-button");
    }

    const embedSrc = await findPdfEmbedSource(pdfViewerPage, 8000);
    if (embedSrc && embedSrc !== "about:blank") {
      const pdfUrl = new URL(embedSrc, pdfViewerPage.url()).toString();
      const fetchResult = await fetchAndSavePackingManifestPdfUrl({
        context,
        fileName,
        filePath,
        pdfUrl,
        source: "pdf-embed-src",
      });
      if (fetchResult) {
        return fetchResult;
      }
    }
  }

  throw new Error("已点击 View PDF，但未能捕获 PDF 下载、PDF 响应或可保存的 PDF 地址。");
}

async function resolvePackingManifestPdfUrlFromDetailRequest(options) {
  const {
    context,
    detailUrl,
    referer = "",
  } = options;
  const absoluteDetailUrl = String(detailUrl || "").trim();
  if (!absoluteDetailUrl) {
    return null;
  }

  const response = await context.request.get(absoluteDetailUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
    timeout: Math.min(PACKING_MANIFEST_PDF_WAIT_MS, 12000),
  }).catch(() => null);
  if (!response || !response.ok()) {
    return null;
  }

  const html = await response.text().catch(() => "");
  const pdfUrl = extractPackingManifestPdfUrlFromDetailHtml(html, response.url());
  if (!pdfUrl) {
    return null;
  }
  return {
    detailUrl: response.url() || absoluteDetailUrl,
    pdfUrl,
    source: "page-resolver-html",
  };
}

function extractPackingManifestPdfUrlFromDetailHtml(html, baseUrl) {
  const variants = [
    String(html || ""),
    htmlDecode(String(html || "")),
    safeDecodeURIComponent(String(html || "")),
    htmlDecode(safeDecodeURIComponent(String(html || ""))),
  ].filter(Boolean);

  for (const text of variants) {
    const directUrlMatch = text.match(/PackingManifestPDF\.jsp\?[^"'<>\\\s]*/i);
    if (directUrlMatch?.[0]) {
      return new URL(cleanExtractedHref(directUrlMatch[0]), baseUrl).toString();
    }

    const documentPdfMatch = text.match(/loadDocumentPDF\s*\(\s*["']PackingManifest["']\s*,\s*["']?(\d{6,})["']?\s*\)/i);
    if (documentPdfMatch?.[1]) {
      return new URL(
        `PackingManifestPDF.jsp?key=${documentPdfMatch[1]}&OrderAssignment=&OrderAssignmentTYPE=`,
        baseUrl,
      ).toString();
    }
  }
  return "";
}

async function resolvePackingManifestPdfUrlFromDetailPage(page) {
  return page.evaluate(() => {
    const candidates = [];
    const pushText = (text) => {
      const value = String(text || "");
      if (value) candidates.push(value);
    };

    try {
      if (typeof window.loadPDF === "function") {
        pushText(String(window.loadPDF));
      }
    } catch {
      // Some deployments wrap document functions; continue with DOM/script scan.
    }

    for (const script of Array.from(document.scripts || [])) {
      pushText(script.textContent || "");
    }
    for (const element of Array.from(document.querySelectorAll("a[href], button, input"))) {
      pushText(element.getAttribute("href") || "");
      pushText(element.getAttribute("onclick") || "");
      pushText(element.outerHTML || "");
    }

    for (const text of candidates) {
      const directUrlMatch = text.match(/PackingManifestPDF\.jsp\?[^"'<>\\\s]*/i);
      if (directUrlMatch?.[0]) {
        return new URL(directUrlMatch[0].replace(/&amp;/g, "&"), window.location.href).toString();
      }

      const documentPdfMatch = text.match(/loadDocumentPDF\s*\(\s*["']PackingManifest["']\s*,\s*["']?(\d{6,})["']?\s*\)/i);
      if (documentPdfMatch?.[1]) {
        return new URL(
          `PackingManifestPDF.jsp?key=${documentPdfMatch[1]}&OrderAssignment=&OrderAssignmentTYPE=`,
          window.location.href,
        ).toString();
      }
    }
    return "";
  }).catch(() => "");
}

async function openPackingManifestViewPdfMenuItem(page, config) {
  const existingItem = await findVisibleViewPdfMenuItem(page);
  if (existingItem) {
    return existingItem;
  }

  const printPdfButton = page.locator('button[title="Print / PDF"], button').filter({ hasText: /Print\s*\/\s*PDF/i }).first();
  if (await isLocatorVisible(printPdfButton, 1500)) {
    await printPdfButton.click({ timeout: Math.min(config.navigationTimeoutMs, 3000) });
    const viewPdf = await findVisibleViewPdfMenuItem(page);
    if (viewPdf) {
      return viewPdf;
    }
  }

  const roots = [page, ...page.frames()];
  for (const root of roots) {
    const dropdownCandidates = [
      root.locator('button:has(svg.icon-dropdown), button:has(use[href*="icon-dropdown"])'),
      root.locator('a:has(svg.icon-dropdown), a:has(use[href*="icon-dropdown"])'),
      root.locator(".dropdownArrow, .buttonDropdown, .toolbarDropdown"),
      root.locator("svg.icon-dropdown"),
    ];

    for (const group of dropdownCandidates) {
      const count = Math.min(await group.count().catch(() => 0), 12);
      for (let index = count - 1; index >= 0; index -= 1) {
        const candidate = group.nth(index);
        if (!await isLocatorVisible(candidate, 500)) {
          continue;
        }
        await candidate.click({ timeout: Math.min(config.navigationTimeoutMs, 3000) }).catch(() => {});
        const menuItem = await findVisibleViewPdfMenuItem(page);
        if (menuItem) {
          return menuItem;
        }
      }
    }
  }

  throw new Error("未找到箱单详情页的 View PDF 下拉菜单项。");
}

async function findVisibleViewPdfMenuItem(page) {
  for (const root of [page, ...page.frames()]) {
    const candidates = [
      root.locator('a[href="javascript:loadPDF();"]').first(),
      root.locator('a[href*="loadPDF"]').filter({ hasText: /^View PDF$/i }).first(),
      root.locator('a[role="menuitem"], li[role="none"] a, a').filter({ hasText: /^View PDF$/i }).first(),
    ];
    for (const item of candidates) {
      if (await isLocatorVisible(item, 800)) {
        return item;
      }
    }
  }
  return null;
}

function isLikelyPackingManifestPdfResponse(response) {
  const headers = response.headers();
  const contentType = String(headers["content-type"] || "").toLowerCase();
  const url = response.url().toLowerCase();
  return contentType.includes("pdf")
    || (url.includes("pdf") && (url.includes("packing") || url.includes("manifest") || url.includes("dyncon")));
}

async function clickPdfViewerSaveButton(page, config) {
  const selectors = [
    '[title="Save"]',
    '[aria-label="Save"]',
    '[title="Download"]',
    '[aria-label="Download"]',
    "#download",
    "#downloads",
    "cr-icon-button#download",
    'button:has(svg use[href*="save"])',
    'button:has(svg use[href*="download"])',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await isLocatorVisible(locator, 1000)) {
      await locator.click({ timeout: Math.min(config.navigationTimeoutMs, 3000) }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function triggerPdfViewerSaveDownload(page, config) {
  const downloadPromise = page.waitForEvent("download", {
    timeout: Math.min(PACKING_MANIFEST_PDF_WAIT_MS, 12000),
  }).catch(() => null);

  const clickedSave = await clickPdfViewerSaveButton(page, config);
  if (clickedSave) {
    const download = await Promise.race([
      downloadPromise,
      delay(1500).then(() => null),
    ]);
    if (download) {
      return download;
    }
  }

  await page.keyboard.press("Control+S").catch(() => {});
  let download = await Promise.race([
    downloadPromise,
    delay(1500).then(() => null),
  ]);
  if (download) {
    return download;
  }

  for (const point of await buildPdfViewerSaveClickPoints(page)) {
    await page.mouse.click(point.x, point.y).catch(() => {});
    download = await Promise.race([
      downloadPromise,
      delay(1200).then(() => null),
    ]);
    if (download) {
      return download;
    }
  }

  download = await Promise.race([downloadPromise, delay(2500).then(() => null)]);
  return download;
}

async function waitForPdfViewerSurface(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hasViewer = await page.evaluate(() => {
      const text = String(document.body?.innerText || "");
      return Boolean(document.querySelector('embed[type="application/pdf"], iframe[src*="pdf"], iframe[src*=".pdf"]'))
        || /This file has limited permissions|Reopen|View Permissions|Save|Download/i.test(text);
    }).catch(() => false);
    if (hasViewer) {
      return true;
    }
    await page.waitForTimeout(250).catch(() => {});
  }
  return false;
}

async function buildPdfViewerSaveClickPoints(page) {
  const viewport = page.viewportSize?.() || { width: 1280, height: 800 };
  const rects = await page.evaluate(() => Array.from(document.querySelectorAll("body, embed, iframe, div"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((rect) => rect.width > 500 && rect.height > 250)
    .sort((a, b) => (a.width * a.height) - (b.width * b.height))
    .slice(0, 6)).catch(() => []);

  const points = [];
  const add = (x, y) => {
    const point = {
      x: Math.max(8, Math.min(Math.round(x), viewport.width - 8)),
      y: Math.max(8, Math.min(Math.round(y), viewport.height - 8)),
    };
    if (!points.some((item) => Math.abs(item.x - point.x) < 4 && Math.abs(item.y - point.y) < 4)) {
      points.push(point);
    }
  };

  for (const rect of rects) {
    add(rect.right - 88, rect.top + 92);
    add(rect.right - 52, rect.top + 92);
    add(rect.right - 88, rect.top + 118);
  }
  add(viewport.width - 90, 118);
  add(viewport.width - 280, 118);
  add(1064, 118);
  add(1038, 118);
  return points;
}

async function findPdfEmbedSource(page, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const src = await page.locator('embed[type="application/pdf"], iframe[src*=".pdf"], iframe[src*="pdf"]')
      .first()
      .getAttribute("src", { timeout: 500 })
      .catch(() => "");
    if (src && src !== "about:blank") {
      return src;
    }
    await page.waitForTimeout(300).catch(() => {});
  }
  return "";
}

async function saveDownloadAs(download, filePath, fileName, source) {
  await download.saveAs(filePath);
  const buffer = await readFile(filePath);
  if (!isPdfBuffer(buffer)) {
    await unlink(filePath).catch(() => {});
    const preview = buffer.toString("utf8", 0, Math.min(buffer.length, 180));
    throw new Error(`浏览器保存的箱单文件不是有效 PDF：${fileName} ${preview}`);
  }
  return {
    fileName,
    filePath,
    downloadSource: source,
    size: buffer.length,
  };
}

async function trySavePackingManifestPdfResponse(options) {
  const {
    context,
    fileName,
    filePath,
    response,
  } = options;
  const buffer = await response.body();
  if (isPdfBuffer(buffer)) {
    await writeFile(filePath, buffer);
    return {
      fileName,
      filePath,
      downloadSource: "pdf-response",
      pdfUrl: response.url(),
      size: buffer.length,
    };
  }

  const html = buffer.toString("utf8");
  const embeddedUrl = extractPdfUrlFromHtml(html, response.url());
  if (embeddedUrl) {
    return fetchAndSavePackingManifestPdfUrl({
      context,
      fileName,
      filePath,
      pdfUrl: embeddedUrl,
      source: "pdf-response-embed-src",
    });
  }
  return null;
}

async function fetchAndSavePackingManifestPdfUrl(options) {
  const {
    context,
    fileName,
    filePath,
    pdfUrl,
    referer = "",
    source,
  } = options;
  const response = await context.request.get(pdfUrl, {
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*",
      ...(referer ? { Referer: referer } : {}),
    },
    timeout: PACKING_MANIFEST_PDF_WAIT_MS,
  }).catch(() => null);
  if (!response) {
    return null;
  }
  const buffer = await response.body();
  if (!isPdfBuffer(buffer)) {
    return null;
  }
  await writeFile(filePath, buffer);
  return {
    fileName,
    filePath,
    downloadSource: source,
    pdfUrl,
    size: buffer.length,
  };
}

function extractPdfUrlFromHtml(html, baseUrl) {
  const patterns = [
    /\bsrc\s*=\s*["']([^"']+\.pdf[^"']*)["']/i,
    /\bsrc\s*=\s*["']([^"']*PackingManifestPDF\.jsp[^"']*)["']/i,
    /\bhref\s*=\s*["']([^"']*PackingManifestPDF\.jsp[^"']*)["']/i,
  ];
  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);
    const rawUrl = match?.[1] ? htmlDecode(match[1]) : "";
    if (rawUrl && rawUrl !== "about:blank") {
      return new URL(rawUrl, baseUrl).toString();
    }
  }
  return "";
}

async function writePdfBuffer(filePath, buffer, sourceUrl) {
  if (!buffer?.length) {
    throw new Error(`PDF 响应为空：${sourceUrl || "unknown source"}`);
  }
  if (!isPdfBuffer(buffer)) {
    const preview = Buffer.from(buffer).toString("utf8", 0, Math.min(buffer.length, 180));
    throw new Error(`View PDF 返回内容不是 PDF：${sourceUrl || ""} ${preview}`);
  }
  await writeFile(filePath, buffer);
}

function isPdfBuffer(buffer) {
  return Buffer.from(buffer || []).subarray(0, 4).toString("utf8") === "%PDF";
}

async function readLocatorLinkInfo(locator) {
  return locator.evaluate((element) => ({
    href: element.href || element.getAttribute("href") || "",
    text: element.textContent?.replace(/\s+/g, " ").trim() || "",
  })).catch(() => ({
    href: "",
    text: "",
  }));
}

async function createPackingListHomeRequestSession(options) {
  const credentials = options.credentials || {};
  const config = options.config || {};
  const log = typeof options.log === "function" ? options.log : () => {};
  const runId = String(options.runId || "");
  const jar = createCookieJar();
  const loginOrigin = resolveLoginOrigin(config.loginUrl);
  const entryUrl = config.loginUrl || `${loginOrigin}/`;
  const loginUrl = new URL(INFORNEXUS_LOGIN_PATH, loginOrigin).toString();
  const homeUrl = new URL(INFORNEXUS_HOME_PATH, loginOrigin).toString();

  const entryResponse = await requestWithCookieJar(entryUrl, {
    headers: buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }),
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

  const homeResponse = await requestWithCookieJar(homeUrl, {
    headers: buildBrowserHeaders({
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      referer: redirectedUrl,
    }),
    jar,
    redirect: "manual",
  });
  const homeHtml = await homeResponse.text().catch(() => "");
  if (homeResponse.status >= 400 || (homeResponse.status >= 300 && homeResponse.status < 400)) {
    throw new Error(`Infor Nexus 主页请求失败：HTTP ${homeResponse.status}。${stripHtmlForMessage(homeHtml).slice(0, 240)}`);
  }
  if (isLikelyLoginPage(homeHtml)) {
    throw new Error("Infor Nexus 登录会话已失效：打开主页时返回登录页。请重新登录后再试。");
  }

  log("Packing List auto-download request login reached Infor Nexus home.", {
    runId,
    cookieNames: jar.names(),
    finalUrl: homeUrl,
  });

  return {
    cookieHeader: jar.header(),
    cookieJar: jar,
    cookieMap: jar.entries(),
    loginOrigin,
    sToken: jar.get("sToken"),
    finalUrl: homeUrl,
    title: "",
    method: "request-login",
    authMethod: "request-login",
  };
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

function canUseBrowserLoginFallback(options) {
  const engine = options.browserEngines?.[options.config?.browser] || options.browserEngines?.chromium;
  return Boolean(engine && typeof options.ensureLoggedIn === "function");
}

async function addRequestSessionCookiesToContext(context, requestSession, loginOrigin) {
  const cookieMap = requestSession?.cookieMap || {};
  const cookies = Object.entries(cookieMap)
    .filter(([name]) => String(name || "").trim())
    .map(([name, value]) => ({
      name: String(name).trim(),
      value: String(value ?? ""),
      url: loginOrigin,
    }));
  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }
}

async function resolvePackingManifestPoInput(page, config) {
  const deadline = Date.now() + Math.min(Number(config.navigationTimeoutMs) || 30000, 4500);
  let lastError = "";

  while (Date.now() < deadline) {
    const roots = [page, ...page.frames()];
    for (const root of roots) {
      try {
        const input = await locatePackingManifestPoInputInFilterPanel(root);
        if (input) {
          return input;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error || "");
      }
    }
    await page.waitForTimeout(100).catch(() => {});
  }

  throw new Error(`未找到箱单页面的 PO Number(s) contains 输入框。${lastError ? `最后一次等待信息：${lastError}` : ""}`);
}

async function locatePackingManifestPoInputInFilterPanel(root) {
  const token = `tos-packing-list-po-input-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const found = await root.evaluate((marker) => {
    const searchRoot = document;
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== "hidden"
        && style.display !== "none";
    };
    const isTextInput = (element) => {
      if (!element || element.tagName !== "INPUT") return false;
      const type = String(element.getAttribute("type") || "text").toLowerCase();
      return type !== "hidden" && !element.disabled && visible(element);
    };
    const firstVisibleInput = (container) => Array
      .from(container.querySelectorAll("input"))
      .find(isTextInput);
    const isPoContainsLabel = (element) => {
      const text = normalize(element.textContent);
      return /PO Number\(s\)/i.test(text)
        && /\bcontains\b/i.test(text)
        && text.length <= 80
        && visible(element);
    };

    const labels = Array
      .from(searchRoot.querySelectorAll("label, span, div"))
      .filter(isPoContainsLabel)
      .filter((element) => !element.closest("table, thead, tbody, tr, th, td"))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (ar.top - br.top) || (ar.left - br.left);
      });

    for (const label of labels) {
      let container = label;
      for (let depth = 0; container && depth < 5; depth += 1) {
        const insideInput = firstVisibleInput(container);
        if (insideInput) {
          insideInput.setAttribute("data-tos-packing-list-po-input", marker);
          return true;
        }
        container = container.parentElement;
      }

      const labelRect = label.getBoundingClientRect();
      const nearbyInput = Array
        .from(searchRoot.querySelectorAll("input"))
        .filter(isTextInput)
        .map((input) => ({
          input,
          rect: input.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect.top >= labelRect.top - 4 && rect.top - labelRect.bottom <= 90)
        .filter(({ rect }) => rect.right >= labelRect.left - 30 && rect.left <= labelRect.right + 380)
        .sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left))[0]?.input;
      if (nearbyInput) {
        nearbyInput.setAttribute("data-tos-packing-list-po-input", marker);
        return true;
      }
    }

    return false;
  }, token).catch(() => false);

  if (!found) {
    return null;
  }
  const locator = root.locator(`input[data-tos-packing-list-po-input="${token}"]`).first();
  await locator.waitFor({ state: "visible", timeout: 300 });
  return locator;
}

async function fillPackingManifestPoFilter(page, input, poNumber, config) {
  await input.click({ timeout: Math.min(config.navigationTimeoutMs, 900) }).catch(() => {});
  await input.press(process.platform === "darwin" ? "Meta+A" : "Control+A", {
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 800),
  }).catch(() => {});
  await input.press("Backspace", {
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 800),
  }).catch(() => {});
  await input.type(poNumber, {
    delay: 8,
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 1800),
  }).catch(async () => {
    await input.fill(poNumber, {
      timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 1200),
    });
  }).catch(async () => {
    await input.evaluate((element, value) => {
      element.focus();
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.blur();
    }, poNumber, { timeout: 1200 });
  });
  await dispatchInputEvents(input);
  await commitPackingManifestPoInput(input, page);

  const actualValue = await input.inputValue({ timeout: 500 })
    .catch(() => input.evaluate((element) => element.value || "", undefined, { timeout: 600 }).catch(() => ""));
  if (actualValue.trim() !== poNumber) {
    throw new Error(`箱单 PO Number(s) 输入框填入失败：期望 ${poNumber}，当前为 ${actualValue || "空值"}。`);
  }

  const enterResponsePromise = waitForFlexViewPost(page, Math.min(FLEX_VIEW_POST_WAIT_MS, 1600));
  await input.press("Enter", {
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 900),
  }).catch(() => {});
  const enterResponse = await Promise.race([
    enterResponsePromise,
    delay(350).then(() => null),
  ]).catch(() => null);
  const responsePromise = enterResponse
    ? Promise.resolve(enterResponse)
    : waitForFlexViewPost(page, Math.min(FLEX_VIEW_POST_WAIT_MS, 4500));
  let applyClicked = Boolean(enterResponse);
  let earlyOutcome = null;
  if (!enterResponse) {
    try {
      applyClicked = await clickPackingManifestApplyButton(page, config);
    } catch (error) {
      earlyOutcome = await waitForPackingManifestSearchOutcome(page, poNumber, 900).catch(() => null);
      const hasCurrentChip = await hasPackingManifestPoFilterChip(page, poNumber).catch(() => false);
      if (earlyOutcome?.notFound || earlyOutcome?.linkInfo?.href || hasCurrentChip) {
        applyClicked = true;
      } else {
        throw error;
      }
    }
  }
  if (!applyClicked) {
    throw new Error("箱单页面精确 Apply 按钮点击失败。");
  }
  await dispatchInputEvents(input);
  const firstOutcome = earlyOutcome
    || await waitForPackingManifestSearchOutcome(page, poNumber, PACKING_MANIFEST_APPLY_RESULT_FAST_WAIT_MS).catch(() => null);
  const response = await Promise.race([
    responsePromise,
    delay(firstOutcome?.pendingApply ? 2400 : 500).then(() => null),
  ]).catch(() => null);
  if (response) {
    await waitForPageSettled(page, config);
  }
  const outcome = (firstOutcome?.linkInfo?.href || firstOutcome?.notFound)
    ? firstOutcome
    : await waitForPackingManifestSearchOutcome(page, poNumber, response ? PACKING_MANIFEST_RESULT_WAIT_MS : 1800).catch(() => firstOutcome);

  const responseLinkInfo = await extractPackingManifestResultLinkInfoFromResponse(response, page.url(), poNumber).catch(() => null);
  const filterApplied = !outcome?.pendingApply
    && (Boolean(outcome?.notFound)
      || Boolean(outcome?.linkInfo?.href)
      || Boolean(responseLinkInfo?.href)
      || await hasPackingManifestPoFilterChip(page, poNumber));

  return {
    applyClicked,
    flexViewPostObserved: Boolean(response),
    flexViewPostStatus: response?.status?.() || 0,
    flexViewPostUrl: response?.url?.() || "",
    filterApplied,
    inputValueAfterApply: actualValue,
    responseLinkInfo,
    searchOutcome: outcome,
  };
}

async function clickPackingManifestApplyButton(page, config) {
  const exactApplySelector = "button.btn.btn-primary[title='Apply'][data-buttonname='constraintApplyButton']";
  const directClicked = await clickExactApplyButtonInDom(page, exactApplySelector).catch(() => false);
  if (directClicked) {
    return true;
  }

  const deadline = Date.now() + Math.min(Number(config.navigationTimeoutMs) || 30000, 1200);
  let lastError = "";
  while (Date.now() < deadline) {
    for (const root of [page, ...page.frames()]) {
      const applyButtons = root.locator(exactApplySelector);
      const count = Math.min(await applyButtons.count().catch(() => 0), 8);
      for (let index = count - 1; index >= 0; index -= 1) {
        const applyButton = applyButtons.nth(index);
        try {
          await applyButton.click({
            force: true,
            timeout: 350,
          });
          return true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error || "");
        }
      }
      const textApplyButtons = root.locator("button.btn-primary, button").filter({ hasText: /^Apply$/ });
      const textCount = Math.min(await textApplyButtons.count().catch(() => 0), 10);
      for (let index = textCount - 1; index >= 0; index -= 1) {
        const applyButton = textApplyButtons.nth(index);
        try {
          await applyButton.click({
            force: true,
            timeout: 500,
          });
          return true;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error || "");
        }
      }
      const applyText = root.getByText(/^Apply$/).last();
      try {
        await applyText.click({
          force: true,
          timeout: 500,
        });
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error || "");
      }
    }
    await page.waitForTimeout(80).catch(() => {});
  }
  throw new Error(`未找到箱单页面精确 Apply 按钮：button.btn.btn-primary[title='Apply'][data-buttonname='constraintApplyButton']。${lastError ? `最后一次等待信息：${lastError}` : ""}`);
}

async function clickExactApplyButtonInDom(page, exactApplySelector) {
  for (const root of [page, ...page.frames()]) {
    const clicked = await root.evaluate((selector) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || "1") > 0
          && rect.width > 0
          && rect.height > 0;
      };
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const isClickable = (element) => {
        if (!element) return false;
        const tagName = String(element.tagName || "").toLowerCase();
        const className = String(element.className || "");
        const role = String(element.getAttribute?.("role") || "");
        return tagName === "button"
          || tagName === "a"
          || role === "button"
          || className.includes("btn");
      };
      const clickableAncestor = (element) => {
        let current = element;
        while (current && current !== document.documentElement) {
          if (isClickable(current)) return current;
          current = current.parentElement;
        }
        return element;
      };
      const clickElement = (element) => {
        if (!element || element.disabled) return false;
        element.scrollIntoView({ block: "center", inline: "center" });
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
          element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
        element.click();
        return true;
      };
      const isFilterApplyElement = (element) => {
        const text = normalize(element.textContent || element.value || element.getAttribute("aria-label") || element.getAttribute("title"));
        const className = String(element.className || "");
        if (text !== "Apply" || element.disabled || !isVisible(element)) return false;
        if (!className.includes("btn-primary") && !className.includes("primary")) return false;
        const container = element.closest(".popover, .dropdown, .modal, .dialog, .filter, .constraint, [role='dialog'], body");
        const containerText = normalize(container?.textContent || "");
        return /Filter/i.test(containerText) && /PO Number\(s\)/i.test(containerText);
      };
      const buttons = Array.from(document.querySelectorAll(selector));
      const button = buttons.find((candidate) => !candidate.disabled && isVisible(candidate))
        || Array.from(document.querySelectorAll("button, a, [role='button'], .btn, input[type='button'], input[type='submit'], span, div"))
          .find(isFilterApplyElement)
        || buttons.find((candidate) => !candidate.disabled)
        || null;
      if (button && clickElement(clickableAncestor(button))) {
        return true;
      }

      const filterContainers = Array.from(document.querySelectorAll(".popover, .dropdown, .modal, .dialog, .filter, .constraint, [role='dialog'], div"))
        .map((element) => ({
          element,
          rect: element.getBoundingClientRect(),
          text: normalize(element.textContent || ""),
        }))
        .filter(({ rect, text }) => rect.width > 250
          && rect.height > 180
          && rect.right > 0
          && rect.bottom > 0
          && rect.left < window.innerWidth
          && rect.top < window.innerHeight
          && /Filter/i.test(text)
          && /PO Number\(s\)/i.test(text)
          && /\bApply\b/i.test(text))
        .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));

      for (const { rect } of filterContainers.slice(0, 3)) {
        const points = [
          { x: rect.right - 72, y: rect.bottom - 46 },
          { x: rect.right - 88, y: rect.bottom - 48 },
          { x: rect.right - 56, y: rect.bottom - 50 },
        ];
        for (const point of points) {
          const x = Math.max(8, Math.min(window.innerWidth - 8, point.x));
          const y = Math.max(8, Math.min(window.innerHeight - 8, point.y));
          const target = clickableAncestor(document.elementFromPoint(x, y));
          const targetText = normalize(target?.textContent || target?.value || target?.getAttribute?.("aria-label") || target?.getAttribute?.("title") || "");
          if (target && /Apply/i.test(targetText) && clickElement(target)) {
            return true;
          }
        }
      }
      return false;
    }, exactApplySelector).catch(() => false);
    if (clicked) {
      return true;
    }
  }
  return false;
}

async function waitForPackingManifestSearchOutcome(page, poNumber, timeoutMs = PACKING_MANIFEST_RESULT_WAIT_MS) {
  const deadline = Date.now() + Math.max(100, Number(timeoutMs) || PACKING_MANIFEST_RESULT_WAIT_MS);
  let lastOutcome = null;
  while (Date.now() < deadline) {
    for (const root of [page, ...page.frames()]) {
      const outcome = await readPackingManifestSearchOutcome(root, poNumber).catch(() => null);
      if (outcome?.notFound || outcome?.linkInfo?.href) {
        return outcome;
      }
      if (outcome?.pendingApply) {
        lastOutcome = outcome;
      }
    }
    await page.waitForTimeout(60).catch(() => {});
  }
  return lastOutcome;
}

async function hasPackingManifestPoFilterChip(page, poNumber) {
  const expected = String(poNumber || "").trim();
  if (!expected) return false;
  const pattern = new RegExp(`PO\\s*Number\\(s\\)\\s*contains\\s*${escapeRegExp(expected)}`, "i");
  for (const root of [page, ...page.frames()]) {
    const text = await root.locator("body").first().innerText({ timeout: 500 }).catch(() => "");
    if (text.includes(expected) && pattern.test(text)) {
      return true;
    }
  }
  return false;
}

async function dispatchInputEvents(input) {
  await input.evaluate((element) => {
    element.focus();
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "0", bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  }, undefined, { timeout: 600 }).catch(() => {});
}

async function commitPackingManifestPoInput(input, page) {
  await input.press("Tab", { timeout: 800 }).catch(async () => {
    await input.evaluate((element) => {
      element.blur();
    }, undefined, { timeout: 600 }).catch(() => {});
  });
  await page.waitForTimeout(80).catch(() => {});
}

function waitForFlexViewPost(page, timeoutMs) {
  return page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && response.url().includes(FLEX_VIEW_RPC_PATH);
  }, {
    timeout: timeoutMs,
  }).catch(() => null);
}

async function waitForPageSettled(page, config) {
  await page.waitForLoadState("domcontentloaded", {
    timeout: Math.min(Number(config.navigationTimeoutMs) || 30000, 5000),
  }).catch(() => {});
  await page.waitForTimeout(80).catch(() => {});
}

async function isBrowserLoginPage(page) {
  const url = page.url();
  if (/\/login\.jsp(?:[?#]|$)/i.test(url)) {
    return true;
  }
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    return /User\s*ID|Password|Log\s*In/i.test(text)
      && /login\.jsp|e-Identity|Access Code/i.test(document.documentElement?.innerHTML || "");
  }).catch(() => false);
}

async function needsInforNexusLogin(page) {
  const url = String(page.url() || "");
  if (/___bounce=1/i.test(url)) {
    return true;
  }
  return isBrowserLoginPage(page);
}

async function isLocatorVisible(locator, timeoutMs) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

function delay(timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
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

function setRunProgress(activeRun, patch) {
  if (!activeRun || typeof activeRun !== "object") {
    return;
  }
  activeRun.progress = {
    ...(activeRun.progress || {}),
    ...(patch || {}),
    updatedAt: new Date().toISOString(),
  };
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
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
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

function isLikelyLoginPage(html) {
  const normalized = String(html || "").toLowerCase();
  return normalized.includes("login.jsp")
    && normalized.includes("password")
    && !normalized.includes("homepage.jsp");
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
