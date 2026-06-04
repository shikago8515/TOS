import http from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = __dirname;
const runtimeDataRoot = process.env.TMS_PLAYWRIGHT_DATA_DIR
  ? path.resolve(process.env.TMS_PLAYWRIGHT_DATA_DIR)
  : appRoot;
const bundledConfigPath = path.join(appRoot, "executor.config.json");
const bundledSecretPath = path.join(appRoot, "executor.secret.local.json");
const runtimeConfigPath = path.join(runtimeDataRoot, "executor.config.local.json");
const runtimeSecretPath = path.join(runtimeDataRoot, "executor.secret.local.json");
const artifactsDir = path.join(runtimeDataRoot, "run-artifacts");

const sharedExecutorRoot = path.resolve(appRoot, "..", "playwright-console");
const sharedPackageJson = path.join(sharedExecutorRoot, "package.json");
const requireShared = createRequire(sharedPackageJson);
const { chromium, firefox, webkit } = requireShared("playwright");
const xlsx = requireShared("xlsx");

const browserEngines = { chromium, firefox, webkit };

await ensureRuntimeFiles();
const config = await loadConfig();

let activeRun = null;
let lastRun = null;

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/health" || req.url === "/api/health")) {
      sendJson(res, 200, buildHealthPayload());
      return;
    }

    if (req.method === "POST" && (req.url === "/open-shipment-scan" || req.url === "/api/open-shipment-scan")) {
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

      const credentials = resolveCredentials(body);
      activeRun = {
        startedAt: new Date().toISOString(),
        action: "open-shipment-scan",
        browser: config.browser,
      };

      try {
        const result = await openShipmentScan(credentials);
        lastRun = {
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          shipmentScanOpened: result.shipmentScanOpened,
        };
        sendJson(res, result.ok ? 200 : 500, result);
      } finally {
        activeRun = null;
      }
      return;
    }

    if (req.method === "POST" && (req.url === "/run-shipping-file" || req.url === "/api/run-shipping-file")) {
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

      const credentials = resolveCredentials(body);
      const poRows = extractPoRowsFromWorkbookPayload(body);
      const inputFileName = normalizeUploadFileName(body);
      activeRun = {
        startedAt: new Date().toISOString(),
        action: "run-shipping-file",
        browser: config.browser,
        inputFileName,
        inputMode: "local-file",
        totalPoCount: poRows.length,
      };

      try {
        const result = await runShippingFile(credentials, poRows, inputFileName);
        result.artifacts = await persistRunArtifacts(result, poRows);
        lastRun = {
          startedAt: activeRun.startedAt,
          finishedAt: result.generatedAt,
          ok: result.ok,
          finalUrl: result.finalUrl,
          inputFileName,
          totalPoCount: result.totalPoCount,
          completedPoCount: result.completedPoCount,
          failedPoCount: result.failedPoCount,
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
  const secretPath = existsSync(runtimeSecretPath) ? runtimeSecretPath : bundledSecretPath;
  const secret = await readJsonIfExists(secretPath, {});
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
    username: String(secret.username || ""),
    password: String(secret.password || ""),
    browser: String(merged.browser || "chromium"),
    headless: Boolean(merged.headless),
    slowMo: Number(merged.slowMo ?? 120),
    navigationTimeoutMs: Number(merged.navigationTimeoutMs ?? 45000),
    postLoginWaitMs: Number(merged.postLoginWaitMs ?? 1200),
    keepBrowserOpenOnSuccessMs: Number(merged.keepBrowserOpenOnSuccessMs ?? 120000),
    keepBrowserOpenOnErrorMs: Number(merged.keepBrowserOpenOnErrorMs ?? 120000),
    launchOptions: merged.launchOptions && typeof merged.launchOptions === "object"
      ? merged.launchOptions
      : {},
  };
}

function buildHealthPayload() {
  return {
    ok: true,
    busy: Boolean(activeRun),
    activeRun,
    lastRun,
    dataDir: runtimeDataRoot,
    runtimeConfigPath,
    runtimeSecretPath,
    config: {
      loginUrl: config.loginUrl,
      browser: config.browser,
      headless: config.headless,
      slowMo: config.slowMo,
      navigationTimeoutMs: config.navigationTimeoutMs,
      postLoginWaitMs: config.postLoginWaitMs,
      keepBrowserOpenOnSuccessMs: config.keepBrowserOpenOnSuccessMs,
      keepBrowserOpenOnErrorMs: config.keepBrowserOpenOnErrorMs,
      launchOptions: config.launchOptions,
      hasStoredCredentials: Boolean(config.username && config.password),
    },
  };
}

function resolveCredentials(body) {
  const username = String(body?.username || body?.userId || config.username || "").trim();
  const password = String(body?.password || config.password || "");
  if (!username || !password) {
    const error = new Error("Username and password are required.");
    error.statusCode = 400;
    throw error;
  }
  return { username, password };
}

async function openShipmentScan(credentials) {
  return runShippingWorkflow(credentials, {
    poRows: [],
    inputFileName: "",
    fillPoNumbers: false,
  });
}

async function runShippingFile(credentials, poRows, inputFileName) {
  return runShippingWorkflow(credentials, {
    poRows,
    inputFileName,
    fillPoNumbers: true,
  });
}

async function runShippingWorkflow(credentials, runContext) {
  const engine = browserEngines[config.browser] || chromium;
  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMo,
    ...config.launchOptions,
  };

  let browser = null;
  let context = null;
  let page = null;
  let lifecycle = null;
  let latestScreenshotPath = "";
  const startedAt = new Date().toISOString();
  const poRows = Array.isArray(runContext?.poRows) ? runContext.poRows : [];
  const shouldFillPoNumbers = Boolean(runContext?.fillPoNumbers);
  const poResults = [];
  const createShipmentResults = [];
  let createShipmentEquipmentIds = [];

  try {
    browser = await engine.launch(launchOptions);
    context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
    });
    page = await context.newPage();
    lifecycle = trackBrowserLifecycle(page, context, browser);
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    await page.goto(config.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });

    await ensureLoggedIn(page, credentials);
    await clickLocator(page.locator("#navmenu__applications"), "Applications");
    await clickLocator(
      page.locator("#navmenu__inprogressmanifestsprintscanship"),
      "Print-Scan-Ship",
    );
    await page.waitForURL(/\/en\/trade\/PackByScan/, { timeout: config.navigationTimeoutMs });
    await page.waitForTimeout(config.postLoginWaitMs);
    if (shouldFillPoNumbers) {
      for (let index = 0; index < poRows.length; index += 1) {
        const poRow = poRows[index];
        const nextPoRow = poRows[index + 1] || null;
        try {
          await processShipmentPoRow(page, poRow);
          poResults.push({
            ...poRow,
            ok: true,
          });
          if (nextPoRow && !hasPageLifecycleEnded(page, lifecycle)) {
            await prepareForNextShipmentPoIteration(page, poRow.poNo, nextPoRow.poNo);
          }
        } catch (error) {
          const normalizedError = normalizeRunError(
            error,
            page,
            lifecycle,
            `PO No ${String(poRow?.poNo || "").trim()}: browser page became unavailable during Shipment Scan.`,
          );
          poResults.push({
            ...poRow,
            ok: false,
            error: normalizedError.message,
          });
          if (hasPageLifecycleEnded(page, lifecycle) || isClosedTargetError(error)) {
            throw normalizedError;
          }
          if (nextPoRow) {
            await prepareForNextShipmentPoIteration(page, poRow.poNo, nextPoRow.poNo);
          }
        }
      }

      createShipmentEquipmentIds = collectUniqueChangeEquipmentIds(
        poResults.filter((item) => item?.ok),
      );

      for (const changeEquipmentId of createShipmentEquipmentIds) {
        try {
          await processCreateShipmentEquipmentId(page, changeEquipmentId);
          createShipmentResults.push({
            changeEquipmentId,
            ok: true,
          });
        } catch (error) {
          const normalizedError = normalizeRunError(
            error,
            page,
            lifecycle,
            `Change Equipment ID ${changeEquipmentId}: browser page became unavailable during Create Shipment.`,
          );
          createShipmentResults.push({
            changeEquipmentId,
            ok: false,
            error: normalizedError.message,
          });
          if (hasPageLifecycleEnded(page, lifecycle) || isClosedTargetError(error)) {
            throw normalizedError;
          }
        }
      }
    } else {
      await openShipmentScanDialog(page);
    }

    if (hasPageLifecycleEnded(page, lifecycle)) {
      throw normalizeRunError(
        new Error("Browser page became unavailable before capturing the final state."),
        page,
        lifecycle,
        "Browser page became unavailable before capturing the final state.",
      );
    }

    latestScreenshotPath = path.join(artifactsDir, `shipment-scan-success-${Date.now()}.png`);
    await page.screenshot({ path: latestScreenshotPath, fullPage: true });

    const failedPoCount = poResults.filter((item) => !item.ok).length;
    const completedPoCount = poResults.filter((item) => item.ok).length;
    const failedCreateShipmentCount = createShipmentResults.filter((item) => !item.ok).length;
    const completedCreateShipmentCount = createShipmentResults.filter((item) => item.ok).length;

    const result = {
      ok: failedPoCount === 0 && failedCreateShipmentCount === 0,
      loginSuccess: true,
      shipmentScanOpened: true,
      inputMode: shouldFillPoNumbers ? "local-file" : "open-only",
      inputFileName: runContext?.inputFileName || "",
      totalPoCount: poRows.length,
      completedPoCount,
      failedPoCount,
      poResults,
      uniqueChangeEquipmentIdCount: createShipmentEquipmentIds.length,
      completedCreateShipmentCount,
      failedCreateShipmentCount,
      createShipmentResults,
      selectedAction: shouldFillPoNumbers ? "Remove/Change Equipment ID" : "",
      message: shouldFillPoNumbers
        ? `Shipment Scan processed ${completedPoCount}/${poRows.length} PO rows and Create Shipment processed ${completedCreateShipmentCount}/${createShipmentEquipmentIds.length} unique equipment IDs.`
        : "Infor Nexus Shipment Scan opened successfully.",
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
      "Shipment Scan automation browser session became unavailable.",
    );
    const failureMessage = normalizedError.message;
    if (page && !page.isClosed()) {
      latestScreenshotPath = path.join(artifactsDir, `shipment-scan-error-${Date.now()}.png`);
      await page.screenshot({ path: latestScreenshotPath, fullPage: true }).catch(() => {});
    }

    const result = {
      ok: false,
      loginSuccess: false,
      shipmentScanOpened: false,
      inputMode: shouldFillPoNumbers ? "local-file" : "open-only",
      inputFileName: runContext?.inputFileName || "",
      totalPoCount: poRows.length,
      completedPoCount: poResults.filter((item) => item.ok).length,
      failedPoCount: Math.max(
        poRows.length - poResults.filter((item) => item.ok).length,
        poResults.filter((item) => !item.ok).length,
      ),
      poResults,
      uniqueChangeEquipmentIdCount: createShipmentEquipmentIds.length,
      completedCreateShipmentCount: createShipmentResults.filter((item) => item.ok).length,
      failedCreateShipmentCount: createShipmentResults.filter((item) => !item.ok).length,
      createShipmentResults,
      message: failureMessage || "Shipment Scan automation failed.",
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
  const usernameField = page.getByPlaceholder("Username");
  const passwordField = page.getByPlaceholder("Password");
  const loginButton = page.getByRole("button", { name: "Log In" });

  const loginVisible = await usernameField.isVisible().catch(() => false);
  if (loginVisible) {
    await usernameField.fill(credentials.username);
    await passwordField.fill(credentials.password);
    await loginButton.click({ force: true });
    log("Submitted Infor Nexus login.");
  }

  await waitForAny(page, [
    () => page.waitForURL(/\/en\/trade\//, { timeout: config.navigationTimeoutMs }),
    () => page.locator("#navmenu__applications").waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    }),
  ]);
}

async function waitForShipmentScanDialog(page) {
  const dialog = getShipmentScanDialog(page);
  await waitForAny(page, [
    () => page.waitForURL(/#Shipment%20Scan/, { timeout: config.navigationTimeoutMs }),
    () => dialog.waitFor({ state: "visible", timeout: config.navigationTimeoutMs }),
  ]);
  await dialog.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
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

function getShipmentScanWorkspace(page) {
  return page
    .locator("div.x-panel:visible")
    .filter({
      has: page.locator("span.x-panel-header-text", {
        hasText: /^Undo Shipment Scan$/i,
      }),
    })
    .first();
}

function getShipmentScanGrid(page) {
  return getShipmentScanWorkspace(page)
    .locator("div.x-grid3:visible")
    .first();
}

async function openShipmentScanDialog(page) {
  const dialogTitle = page.locator("text=Shipment Scan - Select Filters").last();
  const alreadyVisible = await dialogTitle.isVisible().catch(() => false);
  if (!alreadyVisible) {
    await clickShipmentScanSideLink(page);
  }

  await waitForShipmentScanDialog(page);
  const dialog = getShipmentScanDialog(page);
  await waitForShipmentScanDialogControls(dialog);
  log("Shipment Scan dialog ready.");
  return dialog;
}

async function clickShipmentScanSideLink(page) {
  await clickLocator(
    page.locator('div.sidepanellinks a[href="#Shipment%20Scan"]'),
    "Shipment Scan",
  );
}

async function prepareForNextShipmentPoIteration(page, currentPoNo, nextPoNo) {
  const normalizedCurrentPoNo = String(currentPoNo || "").trim();
  const normalizedNextPoNo = String(nextPoNo || "").trim();
  if (!normalizedNextPoNo) {
    return;
  }

  await clickShipmentScanSideLink(page).catch(() => {});
  await waitForShipmentScanDialog(page).catch(() => {});
  log("Prepared Shipment Scan for next PO.", {
    currentPoNo: normalizedCurrentPoNo,
    nextPoNo: normalizedNextPoNo,
  });
}

async function waitForShipmentScanDialogControls(dialog) {
  const poInput = dialog.locator('input[name="poNum"], input[name="poNumbers"]').first();
  const manualTarget = dialog.locator("div.x-form-check-wrap").filter({
    hasText: /^Remove\/Change Equipment ID$/i,
  }).first();
  const removeChangeLabel = manualTarget.locator("label.x-form-cb-label", {
    hasText: /^Remove\/Change Equipment ID$/i,
  }).first();
  const removeChangeRadio = manualTarget.locator('input[type="radio"][name="radioGroup"]').first();
  const okButton = dialog.locator("button.x-btn-text").filter({ hasText: /^OK$/ }).first();

  await poInput.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await manualTarget.waitFor({ state: "attached", timeout: config.navigationTimeoutMs });
  await removeChangeLabel.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await removeChangeRadio.waitFor({ state: "attached", timeout: config.navigationTimeoutMs });
  await okButton.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
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

async function selectRemoveChangeEquipmentId(dialog) {
  const manualTarget = dialog.locator("div.x-form-check-wrap").filter({
    hasText: /^Remove\/Change Equipment ID$/i,
  }).first();
  await manualTarget.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });

  const radio = manualTarget.locator('input[type="radio"][name="radioGroup"]').first();
  const label = manualTarget.locator("label.x-form-cb-label").first();

  if (await isShipmentScanModeSelected(manualTarget, radio)) {
    log("Selected Remove/Change Equipment ID.");
    return;
  }

  await radio.scrollIntoViewIfNeeded().catch(() => {});
  await dialogPause(dialog, 250);

  await radio.check({ force: true }).catch(() => {});
  if (await waitForShipmentScanModeSelected(manualTarget, radio, 1200)) {
    log("Selected Remove/Change Equipment ID.", { target: "radio.check" });
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
      log("Selected Remove/Change Equipment ID.", { target: target.label });
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
    log("Selected Remove/Change Equipment ID.", { target: "dom-dispatch" });
    return;
  }

  throw new Error("Remove/Change Equipment ID radio was not selected.");
}

async function processShipmentPoRow(page, poRow) {
  const normalizedChangeEquipmentId = String(poRow?.changeEquipmentId || "").trim();
  if (!normalizedChangeEquipmentId) {
    throw new Error(`Change equipment ID is empty for PO No ${String(poRow?.poNo || "").trim()}.`);
  }

  await confirmShipmentScanFilters(page, poRow.poNo);
  await waitForShipmentGridRows(page, poRow.poNo);
  await selectShipmentGridRows(page, poRow.poNo);
  const dialog = await openChangeEquipmentIdDialog(page, poRow.poNo);
  await fillChangeEquipmentIdDialog(dialog, normalizedChangeEquipmentId);
  await applyChangeEquipmentIdDialog(page, dialog, poRow.poNo);
  await page.waitForTimeout(config.postLoginWaitMs);
  log("Completed shipment PO row.", {
    poNo: String(poRow?.poNo || "").trim(),
    changeEquipmentId: normalizedChangeEquipmentId,
  });
}

async function confirmShipmentScanFilters(page, poNo) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const shipmentDialog = await openShipmentScanDialog(page);
      await fillShipmentPoNumber(shipmentDialog, poNo);
      await selectRemoveChangeEquipmentId(shipmentDialog);
      await dialogPause(shipmentDialog, 350);
      await clickShipmentScanOk(shipmentDialog);
      await page.waitForTimeout(config.postLoginWaitMs);
      log("Confirmed PO No.", {
        poNo: String(poNo || "").trim(),
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

async function waitForShipmentGridRows(page, poNo) {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 20000);
  const startedAt = Date.now();
  let lastDialogError = "";
  let lastState = null;
  let noDataSince = 0;
  let stableMatchCount = 0;
  let lastSignature = "";

  while (Date.now() - startedAt < timeoutMs) {
    lastDialogError = (await getVisibleDialogErrorText(page)) || lastDialogError;
    if (lastDialogError) {
      throw new Error(`PO No ${poNo}: ${lastDialogError}`);
    }

    const state = await getShipmentGridState(page, poNo);
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

    if (state.noDataVisible && state.rowCount === 0) {
      noDataSince = noDataSince || Date.now();
      if (Date.now() - noDataSince >= 1200) {
        throw new Error(`PO No ${poNo}: no shipment rows were loaded after clicking OK.`);
      }
    } else {
      noDataSince = 0;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`PO No ${poNo}: timed out waiting for shipment rows. State: ${JSON.stringify(lastState || {})}`);
}

async function selectShipmentGridRows(page, poNo) {
  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();
  let lastState = null;
  let stableSelectedCount = 0;
  let lastSignature = "";
  const grid = getShipmentScanGrid(page);

  while (Date.now() - startedAt < timeoutMs) {
    const selectionState = await getShipmentGridState(page, poNo);
    lastState = selectionState;

    if (selectionState.noDataVisible && selectionState.rowCount === 0) {
      throw new Error(`PO No ${poNo}: no shipment rows were loaded after clicking OK.`);
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

  throw new Error(`PO No ${poNo}: shipment rows were not fully selected. State: ${JSON.stringify(lastState || {})}`);
}

async function openChangeEquipmentIdDialog(page, poNo) {
  const selectionState = await getShipmentGridState(page, poNo);
  if (selectionState.rowCount === 0
    || selectionState.matchedPoRowCount === 0
    || selectionState.packagesSelectedCount === 0) {
    throw new Error(`PO No ${poNo}: shipment rows were not ready for Change Equipment ID. State: ${JSON.stringify(selectionState)}`);
  }

  const button = getShipmentScanWorkspace(page)
    .locator("button.x-btn-text.icon-edit-small")
    .filter({ hasText: /^Change Equipment ID$/ })
    .first();
  await button.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await button.click();
  log("Clicked Change Equipment ID.", { poNo });

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
      log("Change Equipment ID dialog opened.", {
        poNo,
        dialogId: dialogInfo.id,
      });
      return dialog;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`PO No ${poNo}: Change Equipment ID dialog did not appear.`);
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
        const failureMessage = await recoverFromRecoverableChangeEquipmentIdError(page, dialog, poNo, errorText);
        throw new Error(failureMessage);
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
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`PO No ${poNo}: Change Equipment ID Apply did not finish.`);
}

async function processCreateShipmentEquipmentId(page, changeEquipmentId) {
  const normalizedChangeEquipmentId = String(changeEquipmentId || "").trim();
  if (!normalizedChangeEquipmentId) {
    throw new Error("Create Shipment change equipment ID is empty.");
  }

  const dialog = await openCreateShipmentDialog(page);
  await clearCreateShipmentPoNumber(dialog);
  await fillCreateShipmentBrowseDays(dialog, "601");
  await fillCreateShipmentEquipmentId(dialog, normalizedChangeEquipmentId);
  await clickDialogOk(dialog, "Create Shipment");
  await page.waitForTimeout(config.postLoginWaitMs);
  log("Completed Create Shipment row.", {
    changeEquipmentId: normalizedChangeEquipmentId,
  });
}

async function openCreateShipmentDialog(page) {
  await clickLocator(
    page.locator('div.sidepanellinks a[href="#Create%20Shipment"]'),
    "Create Shipment",
  );

  const timeoutMs = Math.min(config.navigationTimeoutMs, 15000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const errorText = await getVisibleDialogErrorText(page);
    if (errorText) {
      throw new Error(errorText);
    }

    const dialogInfo = await getTopVisibleDialogInfo(page);
    const names = new Set((dialogInfo?.inputs || []).map((input) => input.name));
    if (dialogInfo?.id
      && names.has("EquipmentJM")
      && names.has("poNum")
      && names.has("executionDateDays")) {
      const dialog = page.locator(`[id="${dialogInfo.id}"]`).first();
      log("Create Shipment dialog opened.", {
        dialogId: dialogInfo.id,
      });
      return dialog;
    }

    await page.waitForTimeout(250);
  }

  throw new Error("Create Shipment dialog did not appear.");
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

async function clickDialogOk(dialog, label) {
  await clickDialogButton(dialog, label, /^OK$/);
}

async function clickDialogButton(dialog, label, buttonPattern) {
  const button = dialog.locator("button.x-btn-text").filter({ hasText: buttonPattern }).first();
  await button.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await forceClickLocator(button, `${label} button`);
  await dialog.waitFor({ state: "hidden", timeout: config.navigationTimeoutMs }).catch(() => {});
  log(`Clicked ${label} button.`, {
    buttonPattern: String(buttonPattern),
  });
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

async function getShipmentGridState(page, poNo) {
  const normalizedPoNo = String(poNo || "").trim();
  return page.evaluate((targetPo) => {
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

    const workspace = Array.from(document.querySelectorAll("div.x-panel"))
      .find((element) => isVisible(element)
        && Array.from(element.querySelectorAll("span.x-panel-header-text"))
          .some((header) => /Undo Shipment Scan/i.test(normalize(header.textContent))));
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
  }, normalizedPoNo).catch(() => ({
    rowCount: 0,
    selectedRowCount: 0,
    headerSelected: false,
    matchedPoRowCount: 0,
    packagesSelectedCount: 0,
    noDataVisible: false,
    rowSignature: "",
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

  const failureDetails = [];
  if (sawShadow) {
    failureDetails.push("x-shadow modal detected");
  }
  failureDetails.push(errorText);

  const failureMessage = `PO No ${poNo}: ${failureDetails.join(". ")}`;
  log("Recovered from Change Equipment ID conflict and moved to next PO.", {
    poNo,
    sawShadow,
    errorText,
  });
  return failureMessage;
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

async function persistRunArtifacts(result, poRows) {
  await mkdir(artifactsDir, { recursive: true });

  const latestResultPath = path.join(artifactsDir, "last-result.json");
  const latestFailedJsonPath = path.join(artifactsDir, "last-failed-po-rows.json");
  const latestFailedExcelPath = path.join(artifactsDir, "last-failed-po-rows.xlsx");
  const failedRows = extractFailedPoRows(result, poRows);

  await writeFile(latestResultPath, JSON.stringify(result, null, 2), "utf8");
  await writeFile(latestFailedJsonPath, JSON.stringify(failedRows, null, 2), "utf8");
  await writeFailedPoWorkbook(latestFailedExcelPath, failedRows);

  return {
    latestResultPath,
    latestFailedJsonPath,
    latestFailedExcelPath,
    failedRowCount: failedRows.length,
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
        failedStep: classifyPoFailureStep(resultRow?.error || result?.message || ""),
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
    failureReason: row.reason || "",
    ...(row.originalRow && typeof row.originalRow === "object" ? row.originalRow : {}),
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportRows, {
    header: exportRows.length > 0
      ? undefined
      : ["rowIndex", "poNo", "changeEquipmentId", "failedStep", "failureReason"],
  });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Failed PO Rows");

  const buffer = xlsx.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  await writeFile(targetPath, buffer);
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

  if (normalizedReason.includes("shipment scan ok button")) {
    return "Shipment Scan Confirm";
  }

  if (normalizedReason.includes("timed out waiting for shipment rows")) {
    return "Shipment Scan Result Wait";
  }

  if (normalizedReason.includes("no shipment rows were loaded")) {
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

function extractPoRowsFromWorkbookPayload(body) {
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
  const rows = xlsx.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  const poRows = rows
    .map((row, index) => ({
      rowIndex: index + 2,
      poNo: extractPoNoValue(row),
      changeEquipmentId: extractChangeEquipmentIdValue(row),
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

function extractPoNoValue(row) {
  if (!row || typeof row !== "object") {
    return "";
  }

  const directValue = row["PO No"] ?? row["PO NO"] ?? row["PO no"] ?? row["PO No."] ?? row["PO Number"] ?? row["PO"];
  if (directValue !== undefined && directValue !== null && String(directValue).trim()) {
    return String(directValue).trim();
  }

  const poKey = Object.keys(row).find((key) => normalizeHeaderName(key) === "pono");
  return poKey ? String(row[poKey] ?? "").trim() : "";
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

function normalizeUploadFileName(body) {
  return String(body?.fileName || body?.filename || "").trim();
}

async function waitForAny(page, attempts) {
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt(page);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No expected page state was reached.");
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
  browser.on("disconnected", () => {
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Executor-Token");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload, null, 2));
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
