const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0";
const INFORNEXUS_LOGIN_PATH = "/en/trade/login.jsp";
const INFORNEXUS_HOME_PATH = "/en/trade/Homepage.jsp?nav=Homenav";
const PACKING_MANIFEST_VIEW_PATH = "/en/trade/PackingManifestView.jsp";
const FLEX_VIEW_RPC_PATH = "/remotes/f2.bridge/inline.gtnexus.trade.flexView";
const PAGE_NETWORK_IDLE_WAIT_MS = 2500;
const PAGE_SETTLE_EXTRA_WAIT_MS = 300;
const FLEX_VIEW_POST_WAIT_MS = 15000;

export async function runPackingListAutoDownloadWorkflow(options) {
  const {
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    ensureLoggedIn,
    headless,
    inputFileName,
    log = () => {},
    safePageTitle,
    safePageUrl,
    workbook,
  } = options;
  const generatedAt = new Date().toISOString();
  const poNumbers = Array.isArray(workbook?.poNumbers) ? workbook.poNumbers : [];
  const poNumber = workbook?.firstPoNumber || poNumbers[0] || "";
  if (!poNumber) {
    const error = new Error("自动下载箱单 Excel 中没有可用于查询的 PO 号。");
    error.statusCode = 400;
    throw error;
  }

  setRunProgress(activeRun, {
    phase: "登录 Infor Nexus",
    message: "正在使用 Invoice 自动下载同款请求登录逻辑建立会话。",
    currentPoNumbers: [poNumber],
  });
  let requestSession = null;
  try {
    requestSession = await createPackingListHomeRequestSession({
      config,
      credentials,
      log,
      runId: activeRun.runId,
    });
  } catch (requestError) {
    if (!canUseBrowserLoginFallback({ browserEngines, config, ensureLoggedIn })) {
      throw requestError;
    }
    log("Packing List auto-download request login failed; trying browser login fallback.", {
      runId: activeRun.runId,
      error: requestError instanceof Error ? requestError.message : String(requestError || ""),
    });
    requestSession = {
      authMethod: "browser-login-fallback",
      cookieMap: {},
      loginOrigin: resolveLoginOrigin(config.loginUrl),
      requestLoginError: requestError instanceof Error ? requestError.message : String(requestError || ""),
    };
  }
  const browserResult = await openPackingManifestAndFillPo({
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    ensureLoggedIn,
    headless,
    log,
    poNumber,
    requestSession,
    safePageTitle,
    safePageUrl,
  });

  return {
    ok: true,
    statusCode: 200,
    runId: activeRun.runId,
    generatedAt,
    stage: "自动下载箱单 PO 查询",
    message: browserResult.flexViewPostObserved
      ? `自动下载箱单已打开箱单页面，并已输入 PO ${poNumber} 触发 FlexView 请求；箱单下载步骤尚未实现。`
      : `自动下载箱单已打开箱单页面，并已输入 PO ${poNumber}；未观察到 FlexView POST，箱单下载步骤尚未实现。`,
    detail: "当前已实现请求登录到主页、打开 PackingManifestView.jsp，并在 PO Number(s) contains 输入框填入 Excel 第一条 PO。后续箱单结果选择和下载会继续在本模块内实现。",
    inputFileName,
    inputMode: "packing-list-auto-download",
    automationImplemented: true,
    downloadImplemented: false,
    searchStepImplemented: true,
    homeOpened: true,
    packingManifestOpened: browserResult.packingManifestOpened,
    poFilterFilled: browserResult.poFilterFilled,
    flexViewPostObserved: browserResult.flexViewPostObserved,
    flexViewPostStatus: browserResult.flexViewPostStatus,
    flexViewPostUrl: browserResult.flexViewPostUrl,
    authMethod: browserResult.authMethod || requestSession.authMethod,
    finalUrl: browserResult.finalUrl,
    title: browserResult.title,
    searchedPoNumber: poNumber,
    totalPoCount: poNumbers.length,
    poNumbers,
    progress: activeRun?.progress || null,
  };
}

async function openPackingManifestAndFillPo(options) {
  const {
    activeRun,
    browserEngines,
    buildVisibleBrowserLaunchOptions,
    config,
    credentials,
    ensureLoggedIn,
    headless,
    log,
    poNumber,
    requestSession,
    safePageTitle,
    safePageUrl,
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
    slowMo: config.slowMo,
    ...(config.launchOptions && typeof config.launchOptions === "object" ? config.launchOptions : {}),
    headless: toBoolean(headless, config.headless),
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
    await addRequestSessionCookiesToContext(context, requestSession, loginOrigin);
    page = await context.newPage();
    page.setDefaultTimeout(config.navigationTimeoutMs);
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

    setRunProgress(activeRun, {
      phase: "打开 Infor Nexus 主页",
      message: "请求登录会话已建立，正在浏览器中打开主页。",
      currentPoNumbers: [poNumber],
    });
    await page.goto(homeUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await waitForPageSettled(page, config);

    if (await isBrowserLoginPage(page)) {
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
      await ensureLoggedIn(page, credentials);
      if (config.postLoginWaitMs > 0) {
        await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
      }
      await page.goto(homeUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await waitForPageSettled(page, config);
    }

    if (await isBrowserLoginPage(page)) {
      throw new Error("自动下载箱单打开主页后仍停留在 Infor Nexus 登录页，请检查账号或 Access Code 状态。");
    }

    setRunProgress(activeRun, {
      phase: "打开箱单页面",
      message: "正在打开 PackingManifestView.jsp。",
      homeOpened: true,
      currentPoNumbers: [poNumber],
    });
    await page.goto(packingManifestUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.navigationTimeoutMs,
    });
    await waitForPageSettled(page, config);
    if (await isBrowserLoginPage(page)) {
      throw new Error("Infor Nexus 登录会话已失效：打开箱单页面时返回登录页。");
    }

    setRunProgress(activeRun, {
      phase: "输入 PO 号",
      message: `已打开箱单页面，正在输入 PO ${poNumber}。`,
      packingManifestOpened: true,
      currentPoNumbers: [poNumber],
    });
    const poInput = await resolvePackingManifestPoInput(page, config);
    const fillResult = await fillPackingManifestPoFilter(page, poInput, poNumber, config);

    const finalUrl = typeof safePageUrl === "function" ? safePageUrl(page) : page.url();
    const title = typeof safePageTitle === "function"
      ? await safePageTitle(page)
      : await page.title().catch(() => "");
    setRunProgress(activeRun, {
      phase: "已输入 PO 号",
      message: fillResult.flexViewPostObserved
        ? `PO ${poNumber} 已填入，并已观察到 FlexView 请求。`
        : `PO ${poNumber} 已填入，等待后未观察到 FlexView 请求。`,
      packingManifestOpened: true,
      poFilterFilled: true,
      flexViewPostObserved: fillResult.flexViewPostObserved,
      currentPoNumbers: [poNumber],
    });

    log("Packing List auto-download filled PO filter on PackingManifestView.", {
      runId: activeRun.runId,
      poNumber,
      finalUrl,
      flexViewPostObserved: fillResult.flexViewPostObserved,
      flexViewPostStatus: fillResult.flexViewPostStatus,
    });

    if (config.keepBrowserOpenOnSuccessMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnSuccessMs).catch(() => {});
    }

    return {
      packingManifestOpened: true,
      poFilterFilled: true,
      ...fillResult,
      authMethod,
      finalUrl,
      title,
    };
  } catch (error) {
    if (page && config.keepBrowserOpenOnErrorMs > 0) {
      await page.waitForTimeout(config.keepBrowserOpenOnErrorMs).catch(() => {});
    }
    throw error;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
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
  const deadline = Date.now() + Math.max(Number(config.navigationTimeoutMs) || 30000, 5000);
  let lastError = "";

  while (Date.now() < deadline) {
    const roots = [page, ...page.frames()];
    for (const root of roots) {
      const candidates = [
        root
          .locator("div.filter.hasOperator")
          .filter({ hasText: /PO\s*Number\(s\)|PO\s*Number/i })
          .locator("input.fieldEdit, input[type='text']")
          .first(),
        root
          .locator("div.filter")
          .filter({ hasText: /PO\s*Number/i })
          .locator("input.fieldEdit, input[type='text']")
          .first(),
        root.locator("span.fieldDisplay").filter({ hasText: /PO\s*Number/i }).locator("xpath=ancestor::div[contains(@class, 'filter')]//input[contains(@class, 'fieldEdit')]").first(),
      ];

      for (const candidate of candidates) {
        try {
          await candidate.waitFor({ state: "visible", timeout: 500 });
          return candidate;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error || "");
        }
      }
    }
    await page.waitForTimeout(300).catch(() => {});
  }

  throw new Error(`未找到箱单页面的 PO Number(s) contains 输入框。${lastError ? `最后一次等待信息：${lastError}` : ""}`);
}

async function fillPackingManifestPoFilter(page, input, poNumber, config) {
  const firstPostPromise = waitForFlexViewPost(page, Math.min(FLEX_VIEW_POST_WAIT_MS, 5000));
  await input.click({ timeout: Math.min(config.navigationTimeoutMs, 5000) });
  await input.fill("");
  await input.type(poNumber, { delay: 20 });
  await dispatchInputEvents(input);

  let response = await firstPostPromise;
  if (!response) {
    const secondPostPromise = waitForFlexViewPost(page, FLEX_VIEW_POST_WAIT_MS);
    await input.press("Enter").catch(() => page.keyboard.press("Enter").catch(() => {}));
    await dispatchInputEvents(input);
    await input.evaluate((element) => element.blur()).catch(() => {});
    response = await secondPostPromise;
  }

  const actualValue = await input.inputValue().catch(() => "");
  if (actualValue.trim() !== poNumber) {
    throw new Error(`箱单 PO Number(s) 输入框填入失败：期望 ${poNumber}，当前为 ${actualValue || "空值"}。`);
  }

  if (response) {
    await waitForPageSettled(page, config);
  }

  return {
    flexViewPostObserved: Boolean(response),
    flexViewPostStatus: response?.status?.() || 0,
    flexViewPostUrl: response?.url?.() || "",
  };
}

async function dispatchInputEvents(input) {
  await input.evaluate((element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }).catch(() => {});
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
  await page.waitForLoadState("domcontentloaded", { timeout: config.navigationTimeoutMs }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: Math.min(config.navigationTimeoutMs, PAGE_NETWORK_IDLE_WAIT_MS) }).catch(() => {});
  await page.waitForTimeout(Math.min(config.postLoginWaitMs || 0, PAGE_SETTLE_EXTRA_WAIT_MS)).catch(() => {});
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
