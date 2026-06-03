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
  const engine = browserEngines[config.browser] || chromium;
  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMo,
    ...config.launchOptions,
  };

  let browser = null;
  let context = null;
  let page = null;
  let latestScreenshotPath = "";
  const startedAt = new Date().toISOString();

  try {
    browser = await engine.launch(launchOptions);
    context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
    });
    page = await context.newPage();
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
    await clickLocator(
      page.locator('div.sidepanellinks a[href="#Shipment%20Scan"]'),
      "Shipment Scan",
    );
    await waitForShipmentScanDialog(page);

    latestScreenshotPath = path.join(artifactsDir, `shipment-scan-success-${Date.now()}.png`);
    await page.screenshot({ path: latestScreenshotPath, fullPage: true });

    const result = {
      ok: true,
      loginSuccess: true,
      shipmentScanOpened: true,
      message: "Infor Nexus Shipment Scan opened successfully.",
      generatedAt: new Date().toISOString(),
      finalUrl: page.url(),
      title: await page.title(),
      artifacts: {
        latestScreenshotPath,
      },
    };

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs);
    }

    return result;
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error);
    if (page) {
      latestScreenshotPath = path.join(artifactsDir, `shipment-scan-error-${Date.now()}.png`);
      await page.screenshot({ path: latestScreenshotPath, fullPage: true }).catch(() => {});
    }

    const result = {
      ok: false,
      loginSuccess: false,
      shipmentScanOpened: false,
      message: failureMessage || "Shipment Scan automation failed.",
      generatedAt: new Date().toISOString(),
      finalUrl: page?.url?.() || "",
      title: page ? await page.title().catch(() => "") : "",
      artifacts: {
        latestScreenshotPath,
      },
    };

    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs);
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
    await loginButton.click();
  }

  await waitForAny(page, [
    () => page.waitForURL(/\/en\/trade\//, { timeout: config.navigationTimeoutMs }),
    () => page.locator("#navmenu__applications").waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    }),
  ]);

  await page.waitForTimeout(config.postLoginWaitMs);
}

async function waitForShipmentScanDialog(page) {
  await waitForAny(page, [
    () => page.waitForURL(/#Shipment%20Scan/, { timeout: config.navigationTimeoutMs }),
    () => page.locator("text=Shipment Scan - Select Filters").first().waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    }),
  ]);
  await page.locator("text=Shipment Scan - Select Filters").first().waitFor({
    state: "visible",
    timeout: config.navigationTimeoutMs,
  });
}

async function clickLocator(locator, label) {
  await locator.first().waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await locator.first().click();
  log(`Clicked ${label}.`);
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
