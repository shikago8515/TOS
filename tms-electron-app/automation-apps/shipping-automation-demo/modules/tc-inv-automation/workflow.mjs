import path from "node:path";

const INVOICES_PAGE_PATH = "/en/trade/InvoicesView.jsp";
const INVOICES_NAV_SELECTOR = "#navmenu__inprogressinvoices";
const INVOICE_FILTER_SELECTOR = 'input[name="InProgressInvoicePageManagerinvoiceFilterInvoice"]';
const APPLY_BUTTON_SELECTOR = 'input[type="button"][value="Apply"], input.styledActionButton[value="Apply"]';
const INVOICE_RESULT_LINK_SELECTOR = 'td.listtablecell a[href*="InvoicePageResolver"], a[href*="InvoicePageResolver"][href*="CommercialInvoice"]';
const CARGO_HANDOVER_DATE_PREFIX = "CommercialInvoice_reference__27_propertyValue";
const CARGO_HANDOVER_DATE_TRIGGER_SELECTOR = `#${CARGO_HANDOVER_DATE_PREFIX}trigger`;
const CARGO_HANDOVER_DATE_LABEL_PATTERN = /Cargo\s*handover\s*\/\s*FCR\s*date/i;
const BUILD_STEP_SELECTOR = "span.stepoff";
const PRIMARY_ADJUSTMENT_APPLY_AS_SELECTOR = "#CommercialInvoice_adjustment__2_applyAs";
const ANY_ADJUSTMENT_APPLY_AS_SELECTOR = 'select[name^="CommercialInvoice_adjustment__"][name$="_applyAs"]';
const ADJUSTMENT_APPLY_AS_CHARGE_VALUE = "Fee";
const ZADD_ADJUSTMENT_ROW_INDEX = 2;
const ZDOC_ADJUSTMENT_ROW_INDEX = 3;
const PREVIEW_STEP_LINK_SELECTOR = 'a[href*="jumpToStep"][href*="Review"]';
const INVOICE_RESULT_WAIT_MS = 7000;
const PAGE_NETWORK_IDLE_WAIT_MS = 2500;
const PAGE_SETTLE_EXTRA_WAIT_MS = 250;
const LOGIN_PAGE_OPEN_RETRY_COUNT = 3;
const NO_INVOICE_RESULTS_PATTERN = /There are no invoices at this time with the specified filters/i;

export async function runTcInvInvoiceSearchWorkflow(options) {
  const {
    activeRun,
    artifactsDir,
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
    showAutomationBadge,
    workbook,
  } = options;

  const startedAt = new Date().toISOString();
  const invoiceNumbersToProcess = Array.isArray(workbook.invoiceNumbers) ? workbook.invoiceNumbers : [];
  const invoiceNumber = workbook.firstInvoiceNumber || invoiceNumbersToProcess[0] || "";
  const poddDate = workbook.firstPoddDate || (invoiceNumber ? workbook.poddDatesByInvoice?.[invoiceNumber] : "") || "";
  const invoiceAdjustments = invoiceNumber ? workbook.adjustmentsByInvoice?.[invoiceNumber] || null : null;
  const engine = browserEngines[config.browser] || browserEngines.chromium;
  const launchOptions = buildVisibleBrowserLaunchOptions({
    slowMo: config.slowMo,
    ...config.launchOptions,
    headless,
  }, config.browser);

  let browser = null;
  let context = null;
  let page = null;
  let latestScreenshotPath = "";
  let stage = "登录 Infor Nexus";
  let homeOpened = false;
  let invoicesOpened = false;
  let invoiceFilterApplied = false;
  let invoiceDetailOpened = false;
  let clickedInvoiceText = "";
  let cargoHandoverDateResult = createSkippedCargoHandoverDateResult(poddDate, "not-reached");
  let buildAdjustmentResult = createSkippedBuildAdjustmentResult("not-reached", invoiceAdjustments);
  let previewResult = createSkippedPreviewResult("not-reached");
  let currentInvoiceNumber = invoiceNumber;
  const processedInvoiceResults = [];
  const showTcInvBadge = async (message, details = {}) => {
    if (typeof showAutomationBadge !== "function") return;
    await showAutomationBadge(page, {
      title: "TC INV 自动化",
      message,
      details: {
        phase: "tc-inv",
        inputFileName,
        invoiceNumber: currentInvoiceNumber || invoiceNumber,
        totalCount: invoiceNumbersToProcess.length,
        ...details,
      },
    });
  };

  try {
    browser = await engine.launch(launchOptions);
    context = await browser.newContext({ viewport: null });
    page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await showTcInvBadge("正在打开 Infor Nexus 登录页", {
      phase: "open-login",
    });

    await openLoginPageWithRetry(page, config, log, activeRun.runId);
    await showTcInvBadge("正在确认 Infor Nexus 登录状态", {
      phase: "login",
    });
    await ensureLoggedIn(page, credentials);
    await page.waitForTimeout(config.postLoginWaitMs);
    homeOpened = true;
    await showTcInvBadge("登录完成，正在打开 Invoices 页面", {
      phase: "open-invoices",
    });
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "home");

    stage = "打开 Invoices 页面";
    const navigationMode = await openInvoicesPage(page, config, log, activeRun.runId);
    invoicesOpened = true;
    await showTcInvBadge("Invoices 页面已打开", {
      phase: "invoices-ready",
    });
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "invoices");

    for (let invoiceIndex = 0; invoiceIndex < invoiceNumbersToProcess.length; invoiceIndex += 1) {
      currentInvoiceNumber = invoiceNumbersToProcess[invoiceIndex];
      const invoiceOrdinal = invoiceIndex + 1;
      const currentPoddDate = workbook.poddDatesByInvoice?.[currentInvoiceNumber] || "";
      const currentInvoiceAdjustments = workbook.adjustmentsByInvoice?.[currentInvoiceNumber] || null;
      clickedInvoiceText = "";
      cargoHandoverDateResult = createSkippedCargoHandoverDateResult(currentPoddDate, "not-reached");
      buildAdjustmentResult = createSkippedBuildAdjustmentResult("not-reached", currentInvoiceAdjustments);
      previewResult = createSkippedPreviewResult("not-reached");

      try {
        if (invoiceIndex > 0) {
          stage = `返回 Invoices 页面 (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
          await showTcInvBadge(`正在返回 Invoices 页面 (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`, {
            phase: "open-invoices",
            currentCount: invoiceOrdinal,
            invoiceNumber: currentInvoiceNumber,
          });
          await openInvoicesPage(page, config, log, activeRun.runId);
          latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `invoices-${invoiceOrdinal}`);
        }

        stage = `输入 Invoice# ${currentInvoiceNumber} 并点击 Apply (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
        await showTcInvBadge(`正在查询 Invoice ${currentInvoiceNumber}`, {
          phase: "invoice-search",
          currentCount: invoiceOrdinal,
          invoiceNumber: currentInvoiceNumber,
        });
        await applyInvoiceFilter(page, currentInvoiceNumber, config);
        invoiceFilterApplied = true;
        latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `applied-${invoiceOrdinal}`);

        stage = `打开 Invoice ${currentInvoiceNumber} 详情页 (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
        await showTcInvBadge(`正在打开 Invoice ${currentInvoiceNumber} 详情页`, {
          phase: "invoice-detail",
          currentCount: invoiceOrdinal,
          invoiceNumber: currentInvoiceNumber,
        });
        clickedInvoiceText = await openInvoiceDetail(page, currentInvoiceNumber, config);
        invoiceDetailOpened = true;
        latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `detail-${invoiceOrdinal}`);

        if (await isInvoicePreviewPage(page)) {
          previewResult = await buildAlreadyOpenPreviewResult(page, currentInvoiceNumber);
          cargoHandoverDateResult = createSkippedCargoHandoverDateResult(currentPoddDate, "already-on-preview");
          buildAdjustmentResult = createSkippedBuildAdjustmentResult("already-on-preview", currentInvoiceAdjustments);
          processedInvoiceResults.push({
            ok: true,
            invoiceIndex,
            invoiceNumber: currentInvoiceNumber,
            clickedInvoiceText,
            poddDate: currentPoddDate,
            cargoHandoverDateResult,
            buildAdjustmentResult,
            previewResult,
            finalUrl: safePageUrl(page),
          });
          await showTcInvBadge(`Invoice ${currentInvoiceNumber} 已完成`, {
            phase: "invoice-complete",
            currentCount: invoiceOrdinal,
            completedCount: processedInvoiceResults.filter((item) => item.ok).length,
            failedCount: processedInvoiceResults.filter((item) => !item.ok).length,
            invoiceNumber: currentInvoiceNumber,
          });
          continue;
        }

        stage = `填 Cargo handover/FCR date (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
        await showTcInvBadge(`正在处理 Invoice ${currentInvoiceNumber} 的 Cargo handover/FCR date`, {
          phase: "invoice-date",
          currentCount: invoiceOrdinal,
          invoiceNumber: currentInvoiceNumber,
        });
        cargoHandoverDateResult = await fillOptionalCargoHandoverFcrDate(page, currentPoddDate, config, log, activeRun.runId);
        if (cargoHandoverDateResult.attempted) {
          latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `detail-podd-${invoiceOrdinal}`);
        }

        stage = `打开 Build 并录入费用 (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
        await showTcInvBadge(`正在处理 Invoice ${currentInvoiceNumber} 的 Build 费用`, {
          phase: "invoice-build",
          currentCount: invoiceOrdinal,
          invoiceNumber: currentInvoiceNumber,
        });
        buildAdjustmentResult = await openBuildStepAndApplyAdjustments(page, currentInvoiceAdjustments, config, log, activeRun.runId);
        latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `build-charge-${invoiceOrdinal}`);

        stage = `打开 Preview (${invoiceOrdinal}/${invoiceNumbersToProcess.length})`;
        await showTcInvBadge(`正在打开 Invoice ${currentInvoiceNumber} Preview`, {
          phase: "invoice-preview",
          currentCount: invoiceOrdinal,
          invoiceNumber: currentInvoiceNumber,
        });
        previewResult = await openPreviewStep(page, config, log, activeRun.runId, currentInvoiceNumber);
        latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `preview-${invoiceOrdinal}`);

        processedInvoiceResults.push({
          ok: true,
          invoiceIndex,
          invoiceNumber: currentInvoiceNumber,
          clickedInvoiceText,
          poddDate: currentPoddDate,
          cargoHandoverDateResult,
          buildAdjustmentResult,
          previewResult,
          finalUrl: safePageUrl(page),
        });
        await showTcInvBadge(`Invoice ${currentInvoiceNumber} 已完成`, {
          phase: "invoice-complete",
          currentCount: invoiceOrdinal,
          completedCount: processedInvoiceResults.filter((item) => item.ok).length,
          failedCount: processedInvoiceResults.filter((item) => !item.ok).length,
          invoiceNumber: currentInvoiceNumber,
        });
      } catch (invoiceError) {
        const invoiceErrorMessage = invoiceError instanceof Error ? invoiceError.message : String(invoiceError || "");
        latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, `invoice-error-${invoiceOrdinal}`).catch(() => latestScreenshotPath);
        processedInvoiceResults.push({
          ok: false,
          invoiceIndex,
          invoiceNumber: currentInvoiceNumber,
          clickedInvoiceText,
          poddDate: currentPoddDate,
          cargoHandoverDateResult,
          buildAdjustmentResult,
          previewResult,
          errorStage: stage,
          errorMessage: invoiceErrorMessage,
          finalUrl: safePageUrl(page),
          latestScreenshotPath,
        });
        await showTcInvBadge(`Invoice ${currentInvoiceNumber} 处理失败，已记录`, {
          phase: "failed",
          currentCount: invoiceOrdinal,
          completedCount: processedInvoiceResults.filter((item) => item.ok).length,
          failedCount: processedInvoiceResults.filter((item) => !item.ok).length,
          invoiceNumber: currentInvoiceNumber,
        });
        log("TC INV invoice failed, continuing with next invoice.", {
          runId: activeRun.runId,
          invoiceNumber: currentInvoiceNumber,
          stage,
          message: invoiceErrorMessage,
        });
      }
    }

    const invoiceSummary = summarizeInvoiceResults(processedInvoiceResults, invoiceNumbersToProcess.length);
    await showTcInvBadge(
      invoiceSummary.failedInvoiceCount > 0
        ? "TC INV 自动化已完成，存在失败记录"
        : "TC INV 自动化已全部完成",
      {
        phase: invoiceSummary.failedInvoiceCount > 0 ? "failed" : "complete",
        completedCount: invoiceSummary.completedInvoiceCount,
        failedCount: invoiceSummary.failedInvoiceCount,
        currentCount: invoiceSummary.attemptedInvoiceCount,
        totalCount: invoiceSummary.attemptedInvoiceCount,
      },
    );
    const finalUrl = safePageUrl(page);
    const title = await safePageTitle(page);
    log("TC INV workflow opened invoice detail page.", {
      runId: activeRun.runId,
      finalUrl,
      invoiceNumber,
      attemptedInvoiceCount: invoiceSummary.attemptedInvoiceCount,
      completedInvoiceCount: invoiceSummary.completedInvoiceCount,
      failedInvoiceCount: invoiceSummary.failedInvoiceCount,
      totalInvoiceCount: invoiceNumbersToProcess.length,
      poddDate,
      cargoHandoverDateResult,
      buildAdjustmentResult,
      previewResult,
      navigationMode,
      title,
      totalRowCount: workbook.rows.length,
    });

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
    }

    return {
      ok: true,
      runId: activeRun.runId,
      startedAt,
      generatedAt: new Date().toISOString(),
      automationId: "tc-inv-automation",
      inputMode: "tc-inv-invoice-search",
      inputFileName,
      homeOpened,
      invoicesOpened,
      invoiceFilterApplied,
      invoiceDetailOpened,
      searchedInvoiceNumber: invoiceNumber,
      currentInvoiceNumber,
      attemptedInvoiceCount: invoiceSummary.attemptedInvoiceCount,
      completedInvoiceNumbers: invoiceSummary.completedInvoiceNumbers,
      completedInvoiceCount: invoiceSummary.completedInvoiceCount,
      failedInvoiceNumbers: invoiceSummary.failedInvoiceNumbers,
      failedInvoiceCount: invoiceSummary.failedInvoiceCount,
      hasInvoiceFailures: invoiceSummary.hasInvoiceFailures,
      allInvoicesAttempted: invoiceSummary.allInvoicesAttempted,
      processedInvoiceResults,
      clickedInvoiceText,
      firstPoddDate: poddDate,
      cargoHandoverDateResult,
      cargoHandoverDateFilled: cargoHandoverDateResult.filled,
      buildAdjustmentResult,
      buildStepOpened: buildAdjustmentResult.opened,
      adjustmentChargeSelected: buildAdjustmentResult.chargeSelected,
      previewResult,
      previewOpened: invoiceSummary.completedInvoiceResults.some((item) => item.previewResult?.opened),
      invoiceNumbers: workbook.invoiceNumbers,
      totalRowCount: workbook.rows.length,
      factories: workbook.factories,
      workbookWarnings: workbook.warnings,
      finalUrl,
      title,
      latestScreenshotPath,
      message: buildTcInvCompletionMessage(invoiceSummary),
    };
  } catch (error) {
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "error").catch(() => "");
    const finalUrl = safePageUrl(page);
    const title = await safePageTitle(page);
    const invoiceSummary = summarizeInvoiceResults(processedInvoiceResults, invoiceNumbersToProcess.length);
    await showTcInvBadge("TC INV 自动化失败，已记录错误信息", {
      phase: "failed",
      completedCount: invoiceSummary.completedInvoiceCount,
      failedCount: invoiceSummary.failedInvoiceCount,
      currentCount: invoiceSummary.attemptedInvoiceCount,
      totalCount: invoiceSummary.attemptedInvoiceCount,
    });

    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }

    return {
      ok: false,
      runId: activeRun.runId,
      startedAt,
      generatedAt: new Date().toISOString(),
      automationId: "tc-inv-automation",
      inputMode: "tc-inv-invoice-search",
      inputFileName,
      stage,
      homeOpened,
      invoicesOpened,
      invoiceFilterApplied,
      invoiceDetailOpened,
      searchedInvoiceNumber: invoiceNumber,
      currentInvoiceNumber,
      attemptedInvoiceCount: invoiceSummary.attemptedInvoiceCount,
      completedInvoiceNumbers: invoiceSummary.completedInvoiceNumbers,
      completedInvoiceCount: invoiceSummary.completedInvoiceCount,
      failedInvoiceNumbers: invoiceSummary.failedInvoiceNumbers,
      failedInvoiceCount: invoiceSummary.failedInvoiceCount,
      hasInvoiceFailures: invoiceSummary.hasInvoiceFailures,
      allInvoicesAttempted: invoiceSummary.allInvoicesAttempted,
      processedInvoiceResults,
      clickedInvoiceText,
      firstPoddDate: poddDate,
      cargoHandoverDateResult,
      cargoHandoverDateFilled: cargoHandoverDateResult.filled,
      buildAdjustmentResult,
      buildStepOpened: buildAdjustmentResult.opened,
      adjustmentChargeSelected: buildAdjustmentResult.chargeSelected,
      previewResult,
      previewOpened: previewResult.opened,
      invoiceNumbers: workbook.invoiceNumbers,
      totalRowCount: workbook.rows.length,
      factories: workbook.factories,
      workbookWarnings: workbook.warnings,
      finalUrl,
      title,
      latestScreenshotPath,
      message: buildTcInvFailureMessage(error, stage, currentInvoiceNumber || invoiceNumber),
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function openLoginPageWithRetry(page, config, log, runId) {
  let lastErrorMessage = "";
  for (let attempt = 1; attempt <= LOGIN_PAGE_OPEN_RETRY_COUNT; attempt += 1) {
    try {
      await page.goto(config.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
      const browserError = await readBrowserNetworkError(page);
      if (browserError) {
        throw new Error(browserError);
      }
      return;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error || "");
      log("TC INV login page open failed, retrying.", {
        runId,
        attempt,
        maxAttempts: LOGIN_PAGE_OPEN_RETRY_COUNT,
        message: lastErrorMessage,
      });
      if (attempt < LOGIN_PAGE_OPEN_RETRY_COUNT) {
        await page.waitForTimeout(1000 * attempt).catch(() => {});
      }
    }
  }

  throw new Error(`打开 Infor Nexus 登录页失败，已重试 ${LOGIN_PAGE_OPEN_RETRY_COUNT} 次：${lastErrorMessage || "未知网络错误"}`);
}

async function readBrowserNetworkError(page) {
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  if (/chrome-error:\/\//i.test(url) || /ERR_CONNECTION_RESET|无法访问此页面|This site can.?t be reached/i.test(bodyText)) {
    const code = bodyText.match(/ERR_[A-Z0-9_]+/)?.[0] || "browser network error";
    return `浏览器网络错误页：${code}`;
  }
  return "";
}

async function openInvoicesPage(page, config, log, runId) {
  const input = page.locator(INVOICE_FILTER_SELECTOR).first();
  if (await isLocatorVisible(input, 1000)) {
    return "already-on-invoices";
  }

  const applicationsNav = page.locator("#navmenu__applications").first();
  if (await isLocatorVisible(applicationsNav, 3000)) {
    try {
      await applicationsNav.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
      const invoicesNavFromApplications = page.locator(INVOICES_NAV_SELECTOR).first();
      if (await isLocatorVisible(invoicesNavFromApplications, Math.min(config.navigationTimeoutMs, 8000))) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
          invoicesNavFromApplications.click({ timeout: config.navigationTimeoutMs }),
        ]);
        await input.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
        await waitForPageSettled(page, config);
        return "applications-invoices-nav";
      }
    } catch (error) {
      log("TC INV Applications -> Invoices nav failed, trying direct Invoices nav.", {
        runId,
        message: error instanceof Error ? error.message : String(error || ""),
      });
    }
  }

  const nav = page.locator(INVOICES_NAV_SELECTOR).first();
  if (await isLocatorVisible(nav, Math.min(config.navigationTimeoutMs, 8000))) {
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
        nav.click({ timeout: config.navigationTimeoutMs }),
      ]);
      await input.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
      await waitForPageSettled(page, config);
      return "nav-click";
    } catch (error) {
      log("TC INV Invoices nav click failed, falling back to direct URL.", {
        runId,
        message: error instanceof Error ? error.message : String(error || ""),
      });
    }
  }

  await page.goto(buildInforNexusUrl(config, INVOICES_PAGE_PATH), {
    waitUntil: "domcontentloaded",
    timeout: config.navigationTimeoutMs,
  });
  await input.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await waitForPageSettled(page, config);
  return "direct-url";
}

async function applyInvoiceFilter(page, invoiceNumber, config) {
  if (!invoiceNumber) {
    throw new Error("Excel 中没有可用于查询的 Invoice#。");
  }

  const input = page.locator(INVOICE_FILTER_SELECTOR).first();
  await input.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await input.fill("");
  await input.fill(invoiceNumber);

  const actualValue = await input.inputValue().catch(() => "");
  if (actualValue.trim() !== invoiceNumber) {
    throw new Error(`Invoice# 输入框填入失败：期望 ${invoiceNumber}，当前为 ${actualValue || "空值"}。`);
  }

  const applyButton = page.locator(APPLY_BUTTON_SELECTOR).first();
  await applyButton.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    applyButton.click({ timeout: config.navigationTimeoutMs }),
  ]);
  await waitForPageSettled(page, config);
}

async function openInvoiceDetail(page, invoiceNumber, config) {
  const resultLinks = page.locator(INVOICE_RESULT_LINK_SELECTOR);
  const exactLink = resultLinks.filter({ hasText: invoiceNumber }).first();
  let targetLink = exactLink;
  const resultState = await waitForInvoiceSearchResult(page, exactLink, resultLinks, config);
  let matchedExactInvoice = resultState === "exact";

  if (resultState === "none") {
    throw new Error(`Apply 后未找到 Invoice# ${invoiceNumber}。页面提示没有符合筛选条件的发票，已记录并继续下一张。`);
  }

  if (resultState === "timeout") {
    throw new Error(`Apply 后等待 Invoice# ${invoiceNumber} 查询结果超时，已记录并继续下一张。`);
  }

  if (!matchedExactInvoice) {
    targetLink = resultLinks.first();
    if (!await isLocatorVisible(targetLink, 800)) {
      throw new Error(`Apply 后未找到 Invoice# ${invoiceNumber} 的结果链接，已记录并继续下一张。`);
    }
  }

  const linkText = normalizeVisibleText(await targetLink.innerText().catch(() => ""));
  if (!matchedExactInvoice && linkText && linkText !== invoiceNumber) {
    throw new Error(`Apply 后没有找到精确匹配的 Invoice# ${invoiceNumber}，页面第一条结果为 ${linkText}。请确认 Excel 发票号是否正确。`);
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    targetLink.click({ timeout: config.navigationTimeoutMs }),
  ]);
  await waitForPageSettled(page, config);
  return linkText || invoiceNumber;
}

async function waitForInvoiceSearchResult(page, exactLink, resultLinks, config) {
  const timeout = Math.min(config.navigationTimeoutMs, INVOICE_RESULT_WAIT_MS);
  const noResults = page.getByText(NO_INVOICE_RESULTS_PATTERN).first();
  const exactPromise = exactLink.waitFor({ state: "visible", timeout }).then(() => "exact").catch(() => "");
  const anyPromise = resultLinks.first().waitFor({ state: "visible", timeout }).then(() => "any").catch(() => "");
  const nonePromise = noResults.waitFor({ state: "visible", timeout }).then(() => "none").catch(() => "");
  const firstResult = await Promise.race([exactPromise, anyPromise, nonePromise]);
  if (firstResult) {
    return firstResult;
  }

  if (await isLocatorVisible(noResults, 300)) return "none";
  if (await isLocatorVisible(exactLink, 300)) return "exact";
  if (await isLocatorVisible(resultLinks.first(), 300)) return "any";
  return "timeout";
}

async function isInvoicePreviewPage(page) {
  const title = await page.title().catch(() => "");
  if (/Invoice\s*-\s*Preview/i.test(title)) {
    return true;
  }

  const heading = page.locator("text=/Invoice\\s*-\\s*Preview/i").first();
  if (await isLocatorVisible(heading, 1000)) {
    return true;
  }

  const reopenButton = page.locator("button, a").filter({ hasText: /^Reopen$/i }).first();
  return isLocatorVisible(reopenButton, 1000);
}

async function buildAlreadyOpenPreviewResult(page, invoiceNumber) {
  return {
    opened: true,
    alreadyOpen: true,
    invoiceNumber,
    title: await page.title().catch(() => ""),
    url: page.url(),
  };
}

async function fillOptionalCargoHandoverFcrDate(page, poddDate, config, log, runId) {
  const resultBase = {
    attempted: false,
    filled: false,
    requestedDate: poddDate || "",
    skippedReason: "",
  };

  if (!poddDate) {
    return {
      ...resultBase,
      skippedReason: "Excel PODD is empty or could not be parsed.",
    };
  }

  const targetDate = parseIsoDateParts(poddDate);
  if (!targetDate) {
    return {
      ...resultBase,
      skippedReason: `PODD date is not a valid YYYY-MM-DD value: ${poddDate}`,
    };
  }

  try {
    if (!await hasCargoHandoverFcrDateLabel(page)) {
      return {
        ...resultBase,
        skippedReason: "Cargo handover/FCR date field is not present on this invoice page.",
      };
    }

    const monthSelect = page.locator(`#${CARGO_HANDOVER_DATE_PREFIX}_month`).first();
    const daySelect = page.locator(`#${CARGO_HANDOVER_DATE_PREFIX}_day`).first();
    const yearSelect = page.locator(`#${CARGO_HANDOVER_DATE_PREFIX}_year`).first();
    const trigger = page.locator(CARGO_HANDOVER_DATE_TRIGGER_SELECTOR).first();
    const controlsVisible = await isLocatorVisible(monthSelect, 1000) &&
      await isLocatorVisible(daySelect, 1000) &&
      await isLocatorVisible(yearSelect, 1000);
    const triggerVisible = await isLocatorVisible(trigger, 1000);

    if (!controlsVisible && !triggerVisible) {
      return {
        ...resultBase,
        skippedReason: "Cargo handover/FCR date label exists, but the date controls were not found.",
      };
    }

    let selectionMethod = "";
    let calendarWarning = "";
    if (triggerVisible) {
      try {
        await trigger.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
        const calendarSelected = await selectCargoHandoverDateFromCalendar(page, targetDate, config);
        if (calendarSelected) {
          selectionMethod = "calendar";
        }
      } catch (error) {
        calendarWarning = error instanceof Error ? error.message : String(error || "");
      }
    }

    if (!selectionMethod) {
      await setCargoHandoverDateByDropdowns(page, targetDate);
      selectionMethod = "dropdown";
    }

    const currentValue = await readCargoHandoverDateValue(page);
    const filled = isCargoHandoverDateSelected(currentValue, targetDate, poddDate);
    const result = {
      ...resultBase,
      attempted: true,
      filled,
      selectionMethod,
      currentValue,
      calendarWarning,
      skippedReason: filled ? "" : "Cargo handover/FCR date controls were found, but the selected value did not match PODD.",
    };

    log("TC INV optional Cargo handover/FCR date step finished.", {
      runId,
      ...result,
    });
    return result;
  } catch (error) {
    const result = {
      ...resultBase,
      attempted: true,
      filled: false,
      skippedReason: error instanceof Error ? error.message : String(error || ""),
    };
    log("TC INV optional Cargo handover/FCR date step skipped after error.", {
      runId,
      ...result,
    });
    return result;
  }
}

async function openBuildStepAndApplyAdjustments(page, invoiceAdjustments, config, log, runId) {
  const buildStep = page.locator(BUILD_STEP_SELECTOR).filter({ hasText: /^[\s\u00a0]*Build[\s\u00a0]*$/i }).first();
  if (!await isLocatorVisible(buildStep, Math.min(config.navigationTimeoutMs, 8000))) {
    throw new Error("Build step is not visible on the invoice detail page.");
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    buildStep.click({ timeout: config.navigationTimeoutMs }),
  ]);
  await waitForPageSettled(page, config);

  const result = {
    opened: true,
    chargeSelected: false,
    selectedLabel: "",
    selectedValue: "",
    zadd: null,
    zdoc: null,
    adjustments: invoiceAdjustments || null,
  };

  if (!invoiceAdjustments) {
    throw new Error("Excel did not provide adjustment values for the current Invoice#.");
  }

  result.zadd = await applyAdjustmentRow(page, {
    amountInputValue: invoiceAdjustments.zaddPlusOtherCostInputValue || "0.00",
    reasonCode: "ZADD",
    rowIndex: ZADD_ADJUSTMENT_ROW_INDEX,
  }, config);
  result.chargeSelected = result.zadd.chargeSelected;
  result.selectedLabel = result.zadd.selectedLabel;
  result.selectedValue = result.zadd.selectedValue;

  if (invoiceAdjustments.hasZdocAmount) {
    result.zdoc = await applyAdjustmentRow(page, {
      amountInputValue: invoiceAdjustments.zdocInputValue,
      reasonCode: "ZDOC",
      rowIndex: ZDOC_ADJUSTMENT_ROW_INDEX,
    }, config);
  }

  log("TC INV Build step adjustment rows applied.", {
    runId,
    ...result,
  });
  return result;
}

async function applyAdjustmentRow(page, options, config) {
  const { amountInputValue, reasonCode, rowIndex } = options;
  const applyAsSelect = await resolveAdjustmentApplyAsSelect(page, config, rowIndex);
  await selectChargeApplyAs(applyAsSelect, config);
  const selected = await readSelectedOption(applyAsSelect);
  const chargeSelected = selected.value === ADJUSTMENT_APPLY_AS_CHARGE_VALUE || selected.label === "Charge";
  if (!chargeSelected) {
    throw new Error(`Adjustment row ${rowIndex} Apply As did not select Charge. Current value: ${selected.value || "empty"}, label: ${selected.label || "empty"}.`);
  }

  await openReasonCatalogAndSelectCode(page, rowIndex, reasonCode, config);
  const reason = await readAdjustmentReason(page, rowIndex);
  if (reason.code !== reasonCode) {
    throw new Error(`Adjustment row ${rowIndex} reason did not select ${reasonCode}. Current code: ${reason.code || "empty"}.`);
  }

  const amountInput = page.locator(`input[name="CommercialInvoice_adjustment__${rowIndex}_amount_value"]`).first();
  await amountInput.waitFor({ state: "visible", timeout: Math.min(config.navigationTimeoutMs, 5000) });
  await amountInput.fill("");
  await amountInput.fill(String(amountInputValue || ""));
  await amountInput.evaluate((element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }).catch(() => {});
  const actualAmount = await amountInput.inputValue().catch(() => "");
  if (String(actualAmount).trim() !== String(amountInputValue || "").trim()) {
    throw new Error(`Adjustment row ${rowIndex} amount did not match. Expected ${amountInputValue}, current ${actualAmount || "empty"}.`);
  }

  return {
    amountInputValue,
    actualAmount,
    chargeSelected,
    reason,
    reasonCode,
    rowIndex,
    selectedLabel: selected.label,
    selectedValue: selected.value,
  };
}

async function resolveAdjustmentApplyAsSelect(page, config, rowIndex = ZADD_ADJUSTMENT_ROW_INDEX) {
  const primarySelector = rowIndex === ZADD_ADJUSTMENT_ROW_INDEX
    ? PRIMARY_ADJUSTMENT_APPLY_AS_SELECTOR
    : `#CommercialInvoice_adjustment__${rowIndex}_applyAs`;
  const primary = page.locator(primarySelector).first();
  if (await isLocatorVisible(primary, Math.min(config.navigationTimeoutMs, 5000))) {
    return primary;
  }

  const fallback = page.locator(ANY_ADJUSTMENT_APPLY_AS_SELECTOR).nth(Math.max(rowIndex - ZADD_ADJUSTMENT_ROW_INDEX, 0));
  if (await isLocatorVisible(fallback, Math.min(config.navigationTimeoutMs, 5000))) {
    return fallback;
  }

  throw new Error(`Adjustment row ${rowIndex} Apply As select was not found on the Build page.`);
}

async function selectChargeApplyAs(applyAsSelect, config) {
  try {
    await applyAsSelect.selectOption({ value: ADJUSTMENT_APPLY_AS_CHARGE_VALUE }, {
      timeout: Math.min(config.navigationTimeoutMs, 5000),
    });
  } catch {
    await applyAsSelect.selectOption({ label: "Charge" }, {
      timeout: Math.min(config.navigationTimeoutMs, 5000),
    });
  }
  await applyAsSelect.evaluate((element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }).catch(() => {});
}

async function readSelectedOption(selectLocator) {
  return selectLocator.evaluate((select) => {
    const selected = select.options?.[select.selectedIndex] || null;
    return {
      label: selected?.textContent?.trim() || "",
      value: selected?.value || select.value || "",
    };
  }).catch(() => ({
    label: "",
    value: "",
  }));
}

async function openReasonCatalogAndSelectCode(page, rowIndex, reasonCode, config) {
  await closeReasonCatalogModalIfPresent(page, config);
  const existingReason = await readAdjustmentReason(page, rowIndex);
  if (existingReason.code === reasonCode) {
    return;
  }

  const lookup = page.locator(`a[href*="CommercialInvoice_adjustment__${rowIndex}_reason_code"][href*="ReasonCatalogPopUp"]`).first();
  if (!await isLocatorVisible(lookup, Math.min(config.navigationTimeoutMs, 5000))) {
    throw new Error(`Adjustment row ${rowIndex} reason lookup button was not found.`);
  }

  const popupPromise = page.waitForEvent("popup", { timeout: 3000 }).catch(() => null);
  await lookup.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
  const popup = await popupPromise;

  if (popup) {
    await popup.waitForLoadState("domcontentloaded", { timeout: Math.min(config.navigationTimeoutMs, 8000) }).catch(() => {});
    await clickReasonCodeInPageOrFrames(popup, reasonCode, config);
    await popup.waitForEvent("close", { timeout: 3000 }).catch(() => {});
    await waitForAdjustmentReason(page, rowIndex, reasonCode, config);
    await page.waitForTimeout(250).catch(() => {});
    return;
  }

  await clickReasonCodeInPageOrFrames(page, reasonCode, config);
  await waitForAdjustmentReason(page, rowIndex, reasonCode, config);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!await isReasonCatalogModalVisible(page)) {
      break;
    }
    await closeReasonCatalogModalIfPresent(page, config);
    await page.waitForTimeout(200).catch(() => {});
  }
  await page.waitForTimeout(250).catch(() => {});
}

async function clickReasonCodeInPageOrFrames(page, reasonCode, config) {
  const reasonSelector = `a[onclick*="setReason('${reasonCode}'"]`;
  const pageReasonLink = page.locator(reasonSelector).first();
  if (await isLocatorVisible(pageReasonLink, Math.min(config.navigationTimeoutMs, 5000))) {
    await pageReasonLink.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
    return true;
  }

  for (const frame of page.frames()) {
    const frameReasonLink = frame.locator(reasonSelector).first();
    if (await isLocatorVisible(frameReasonLink, 1000)) {
      await frameReasonLink.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
      return true;
    }
  }

  throw new Error(`ReasonCatalog option ${reasonCode} was not found.`);
}

async function waitForAdjustmentReason(page, rowIndex, reasonCode, config) {
  await page.waitForFunction(
    ({ index, code }) => {
      const input = document.querySelector(`input[name="CommercialInvoice_adjustment__${index}_reason_code"]`);
      return String(input?.value || "").trim() === code;
    },
    { index: rowIndex, code: reasonCode },
    { timeout: Math.min(config.navigationTimeoutMs, 5000) },
  );
}

async function closeReasonCatalogModalIfPresent(page, config) {
  if (!await isReasonCatalogModalVisible(page)) {
    return false;
  }

  const modalRoot = page.locator("div, section, dialog").filter({ hasText: /Adjustment Reason/i }).last();
  const closeCandidates = [
    modalRoot.getByRole("button", { name: /^Close$/ }).last(),
    modalRoot.locator("button").filter({ hasText: /^Close$/ }).last(),
    modalRoot.locator("a").filter({ hasText: /^Close$/ }).last(),
    modalRoot.locator('[aria-label="Close"], [title="Close"]').first(),
    modalRoot.locator("text=\u00d7").first(),
  ];

  for (const candidate of closeCandidates) {
    if (await isLocatorVisible(candidate, 500)) {
      await candidate.click({ timeout: Math.min(config.navigationTimeoutMs, 3000) }).catch(() => {});
      if (await waitForReasonCatalogModalClosed(page)) {
        return true;
      }
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
  if (await waitForReasonCatalogModalClosed(page)) {
    return true;
  }

  await page.evaluate(() => {
    for (const element of Array.from(document.querySelectorAll("button, a, span, div"))) {
      if (/^(\u00d7|Close)$/i.test(String(element.textContent || "").trim())) {
        element.click();
        break;
      }
    }
  }).catch(() => {});
  return waitForReasonCatalogModalClosed(page);
}

async function isReasonCatalogModalVisible(page) {
  return page.locator("text=Adjustment Reason").first().isVisible({ timeout: 500 }).catch(() => false);
}

async function waitForReasonCatalogModalClosed(page) {
  try {
    await page.locator("text=Adjustment Reason").first().waitFor({ state: "hidden", timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

async function readAdjustmentReason(page, rowIndex) {
  return page.evaluate((index) => {
    const code = document.querySelector(`input[name="CommercialInvoice_adjustment__${index}_reason_code"]`)?.value || "";
    const description = document.querySelector(`input[name="CommercialInvoice_adjustment__${index}_reason_description"]`)?.value || "";
    return {
      code: code.trim(),
      description: description.trim(),
    };
  }, rowIndex).catch(() => ({
    code: "",
    description: "",
  }));
}

function createSkippedBuildAdjustmentResult(skippedReason, invoiceAdjustments = null) {
  return {
    adjustments: invoiceAdjustments,
    opened: false,
    chargeSelected: false,
    selectedLabel: "",
    selectedValue: "",
    zadd: null,
    zdoc: null,
    skippedReason,
  };
}

async function openPreviewStep(page, config, log, runId, invoiceNumber) {
  const previewLink = await resolvePreviewStepLocator(page, config);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs }).catch(() => null),
    previewLink.click({ timeout: Math.min(config.navigationTimeoutMs, 8000) }),
  ]);
  await waitForPageSettled(page, config);

  const result = {
    opened: true,
    invoiceNumber,
    title: await page.title().catch(() => ""),
    url: page.url(),
  };
  log("TC INV Preview step opened.", {
    runId,
    ...result,
  });
  return result;
}

async function resolvePreviewStepLocator(page, config) {
  const link = page.locator(PREVIEW_STEP_LINK_SELECTOR).filter({ hasText: /Preview/i }).first();
  if (await isLocatorVisible(link, Math.min(config.navigationTimeoutMs, 5000))) {
    return link;
  }

  const textFallback = page.locator("a").filter({ hasText: /^[\s\u00a0]*Preview[\s\u00a0]*$/i }).first();
  if (await isLocatorVisible(textFallback, Math.min(config.navigationTimeoutMs, 5000))) {
    return textFallback;
  }

  const spanFallback = page.locator(BUILD_STEP_SELECTOR).filter({ hasText: /^[\s\u00a0]*Preview[\s\u00a0]*$/i }).first();
  if (await isLocatorVisible(spanFallback, Math.min(config.navigationTimeoutMs, 5000))) {
    return spanFallback;
  }

  throw new Error("Preview step link was not found after applying adjustment rows.");
}

function createSkippedPreviewResult(skippedReason) {
  return {
    opened: false,
    invoiceNumber: "",
    title: "",
    url: "",
    skippedReason,
  };
}

function summarizeInvoiceResults(processedInvoiceResults, totalInvoiceCount) {
  const completedInvoiceResults = processedInvoiceResults.filter((item) => item?.ok !== false);
  const failedInvoiceResults = processedInvoiceResults.filter((item) => item?.ok === false);
  const completedInvoiceNumbers = completedInvoiceResults.map((item) => item.invoiceNumber).filter(Boolean);
  const failedInvoiceNumbers = failedInvoiceResults.map((item) => item.invoiceNumber).filter(Boolean);
  return {
    allInvoicesAttempted: processedInvoiceResults.length === totalInvoiceCount,
    attemptedInvoiceCount: processedInvoiceResults.length,
    completedInvoiceCount: completedInvoiceResults.length,
    completedInvoiceNumbers,
    completedInvoiceResults,
    failedInvoiceCount: failedInvoiceResults.length,
    failedInvoiceNumbers,
    failedInvoiceResults,
    hasInvoiceFailures: failedInvoiceResults.length > 0,
    totalInvoiceCount,
  };
}

function buildTcInvCompletionMessage(summary) {
  const base = `TC INV 自动化已尝试 ${summary.attemptedInvoiceCount}/${summary.totalInvoiceCount} 张 Invoice，完成 ${summary.completedInvoiceCount} 张`;
  if (summary.failedInvoiceCount > 0) {
    const failedList = summary.failedInvoiceNumbers.join(", ");
    return `${base}，记录失败 ${summary.failedInvoiceCount} 张${failedList ? `：${failedList}` : ""}。`;
  }
  return `${base}，并已进入 Preview。`;
}

async function hasCargoHandoverFcrDateLabel(page) {
  const label = page.locator("font.inputfieldlabel").filter({ hasText: CARGO_HANDOVER_DATE_LABEL_PATTERN }).first();
  if (await isLocatorVisible(label, 1500)) {
    return true;
  }

  return page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, "i");
    return pattern.test(document.body?.innerText || "");
  }, CARGO_HANDOVER_DATE_LABEL_PATTERN.source).catch(() => false);
}

async function selectCargoHandoverDateFromCalendar(page, targetDate, config) {
  const calendar = page.locator("table").filter({ has: page.locator("td.title") }).last();
  await calendar.waitFor({ state: "visible", timeout: Math.min(config.navigationTimeoutMs, 3000) });

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const title = normalizeVisibleText(await calendar.locator("td.title").first().innerText().catch(() => ""));
    const visibleDate = parseCalendarTitle(title);
    if (!visibleDate) break;

    const monthDelta = (targetDate.year - visibleDate.year) * 12 + (targetDate.month - visibleDate.month);
    if (monthDelta === 0) {
      const dayCell = calendar.locator("tbody td.day:not(.wn)").filter({
        hasText: new RegExp(`^${targetDate.day}$`),
      }).first();
      await dayCell.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
      await page.waitForTimeout(250).catch(() => {});
      return true;
    }

    const navButtonIndex = monthDelta > 0 ? 2 : 1;
    const navButton = calendar.locator("thead tr.headrow td.button.nav div").nth(navButtonIndex);
    await navButton.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
    await page.waitForTimeout(120).catch(() => {});
  }

  return false;
}

async function setCargoHandoverDateByDropdowns(page, targetDate) {
  const updateResult = await page.evaluate(({ prefix, target }) => {
    const monthEl = document.getElementById(`${prefix}_month`);
    const dayEl = document.getElementById(`${prefix}_day`);
    const yearEl = document.getElementById(`${prefix}_year`);
    if (!monthEl || !dayEl || !yearEl) {
      return { ok: false, reason: "date dropdowns not found" };
    }

    const fireChange = (element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const pad = (value) => String(value).padStart(2, "0");

    monthEl.value = String(target.month);
    dayEl.value = String(target.day);
    yearEl.value = String(target.year);
    fireChange(monthEl);
    fireChange(dayEl);
    fireChange(yearEl);

    const fullString = document.getElementById(`${prefix}fullString`);
    if (fullString) {
      fullString.value = `${target.month}/${target.day}/${target.year}`;
      fireChange(fullString);
    }

    const hiddenValue = document.getElementById(prefix);
    if (hiddenValue) {
      hiddenValue.value = `${target.year}-${pad(target.month)}-${pad(target.day)}`;
      fireChange(hiddenValue);
    }

    return {
      ok: true,
      month: monthEl.value,
      day: dayEl.value,
      year: yearEl.value,
      hidden: hiddenValue?.value || "",
      fullString: fullString?.value || "",
    };
  }, {
    prefix: CARGO_HANDOVER_DATE_PREFIX,
    target: targetDate,
  });

  if (!updateResult?.ok) {
    throw new Error(updateResult?.reason || "Cargo handover/FCR date dropdown update failed.");
  }
}

async function readCargoHandoverDateValue(page) {
  return page.evaluate((prefix) => {
    const monthEl = document.getElementById(`${prefix}_month`);
    const dayEl = document.getElementById(`${prefix}_day`);
    const yearEl = document.getElementById(`${prefix}_year`);
    const hiddenValue = document.getElementById(prefix);
    const fullString = document.getElementById(`${prefix}fullString`);
    return {
      month: monthEl?.value || "",
      day: dayEl?.value || "",
      year: yearEl?.value || "",
      hidden: hiddenValue?.value || "",
      fullString: fullString?.value || "",
    };
  }, CARGO_HANDOVER_DATE_PREFIX).catch(() => ({
    month: "",
    day: "",
    year: "",
    hidden: "",
    fullString: "",
  }));
}

function isCargoHandoverDateSelected(currentValue, targetDate, isoDate) {
  if (!currentValue) return false;
  if (currentValue.hidden === isoDate) return true;
  return (
    Number(currentValue.month) === targetDate.month &&
    Number(currentValue.day) === targetDate.day &&
    Number(currentValue.year) === targetDate.year
  );
}

function createSkippedCargoHandoverDateResult(poddDate, skippedReason) {
  return {
    attempted: false,
    filled: false,
    requestedDate: poddDate || "",
    skippedReason,
  };
}

function parseIsoDateParts(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseCalendarTitle(value) {
  const match = String(value || "").trim().match(/^([A-Za-z]+),\s*(\d{4})$/);
  if (!match) return null;
  const month = parseCalendarMonthName(match[1]);
  const year = Number(match[2]);
  if (!month || !year) return null;
  return { month, year };
}

function parseCalendarMonthName(value) {
  const months = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  return months[String(value || "").trim().toLowerCase()] || 0;
}

async function isLocatorVisible(locator, timeoutMs) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function waitForPageSettled(page, config) {
  await page.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: Math.min(config.navigationTimeoutMs, PAGE_NETWORK_IDLE_WAIT_MS) }).catch(() => {});
  await page.waitForTimeout(Math.min(config.postLoginWaitMs || 0, PAGE_SETTLE_EXTRA_WAIT_MS)).catch(() => {});
}

async function captureTcInvScreenshot(page, artifactsDir, runId, label) {
  if (!page || page.isClosed()) {
    return "";
  }
  const filePath = path.join(artifactsDir, `tc-inv-${runId}-${label}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
}

function buildInforNexusUrl(config, pathname) {
  const fallbackOrigin = "https://network.infornexus.com";
  try {
    return new URL(pathname, String(config?.loginUrl || fallbackOrigin)).toString();
  } catch {
    return `${fallbackOrigin}${pathname}`;
  }
}

function normalizeVisibleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildTcInvFailureMessage(error, stage, invoiceNumber) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  if (/Access Code|e-Identity|without providing an Access Code|required to log in/i.test(rawMessage)) {
    return "TC INV 自动化登录失败：Infor Nexus 要求 Access Code 验证。请先在可视浏览器中完成验证后重试。";
  }
  if (/invalid|incorrect|not recognized|authentication failed|login failed/i.test(rawMessage)) {
    return "TC INV 自动化登录失败：Infor Nexus 账号或密码不正确，请检查账号档案后重试。";
  }
  if (/timeout|waiting|navigation|Timeout/i.test(rawMessage)) {
    return `TC INV 自动化在【${stage}】阶段超时：${invoiceNumber ? `当前 Invoice# 为 ${invoiceNumber}。` : ""}请检查 Infor Nexus 页面是否加载完成、网络是否正常，或手动确认该入口是否可打开。`;
  }
  return `TC INV 自动化在【${stage}】阶段失败：${rawMessage || "未知错误"}`;
}
