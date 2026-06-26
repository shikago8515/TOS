import path from "node:path";

const INVOICES_PAGE_PATH = "/en/trade/InvoicesView.jsp";
const INVOICES_NAV_SELECTOR = "#navmenu__inprogressinvoices";
const INVOICE_FILTER_SELECTOR = 'input[name="InProgressInvoicePageManagerinvoiceFilterInvoice"]';
const APPLY_BUTTON_SELECTOR = 'input[type="button"][value="Apply"], input.styledActionButton[value="Apply"]';
const INVOICE_RESULT_LINK_SELECTOR = 'td.listtablecell a[href*="InvoicePageResolver"], a[href*="InvoicePageResolver"][href*="CommercialInvoice"]';

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
    workbook,
  } = options;

  const startedAt = new Date().toISOString();
  const invoiceNumber = workbook.firstInvoiceNumber || workbook.invoiceNumbers?.[0] || "";
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

  try {
    browser = await engine.launch(launchOptions);
    context = await browser.newContext({ viewport: null });
    page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await page.goto(config.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await ensureLoggedIn(page, credentials);
    await page.waitForTimeout(config.postLoginWaitMs);
    homeOpened = true;
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "home");

    stage = "打开 Invoices 页面";
    const navigationMode = await openInvoicesPage(page, config, log, activeRun.runId);
    invoicesOpened = true;
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "invoices");

    stage = `输入 Invoice# ${invoiceNumber} 并点击 Apply`;
    await applyInvoiceFilter(page, invoiceNumber, config);
    invoiceFilterApplied = true;
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "applied");

    stage = `打开 Invoice ${invoiceNumber} 详情页`;
    clickedInvoiceText = await openInvoiceDetail(page, invoiceNumber, config);
    invoiceDetailOpened = true;
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "detail");

    const finalUrl = safePageUrl(page);
    const title = await safePageTitle(page);
    log("TC INV workflow opened invoice detail page.", {
      runId: activeRun.runId,
      finalUrl,
      invoiceNumber,
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
      clickedInvoiceText,
      invoiceNumbers: workbook.invoiceNumbers,
      totalRowCount: workbook.rows.length,
      factories: workbook.factories,
      workbookWarnings: workbook.warnings,
      finalUrl,
      title,
      latestScreenshotPath,
      message: `TC INV 自动化已登录 Infor Nexus，进入 Invoices，搜索 Invoice# ${invoiceNumber}，并打开发票详情页。`,
    };
  } catch (error) {
    latestScreenshotPath = await captureTcInvScreenshot(page, artifactsDir, activeRun.runId, "error").catch(() => "");
    const finalUrl = safePageUrl(page);
    const title = await safePageTitle(page);

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
      clickedInvoiceText,
      invoiceNumbers: workbook.invoiceNumbers,
      totalRowCount: workbook.rows.length,
      factories: workbook.factories,
      workbookWarnings: workbook.warnings,
      finalUrl,
      title,
      latestScreenshotPath,
      message: buildTcInvFailureMessage(error, stage, invoiceNumber),
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function openInvoicesPage(page, config, log, runId) {
  const input = page.locator(INVOICE_FILTER_SELECTOR).first();
  if (await isLocatorVisible(input, 1000)) {
    return "already-on-invoices";
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
  let matchedExactInvoice = await isLocatorVisible(exactLink, config.navigationTimeoutMs);

  if (!matchedExactInvoice) {
    targetLink = resultLinks.first();
    if (!await isLocatorVisible(targetLink, 1500)) {
      throw new Error(`Apply 后未找到 Invoice# ${invoiceNumber} 的结果链接。请确认 Infor Nexus 中存在该发票，或筛选条件是否返回数据。`);
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
  await page.waitForLoadState("networkidle", { timeout: Math.min(config.navigationTimeoutMs, 8000) }).catch(() => {});
  await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
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
