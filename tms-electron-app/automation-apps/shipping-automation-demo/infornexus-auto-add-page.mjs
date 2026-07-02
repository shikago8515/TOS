const INFORNEXUS_AUTO_ADD_ORIGIN = "https://network.infornexus.com";

export const INFORNEXUS_AUTO_ADD_SEARCH_PATH =
  "/en/trade/Search.jsp?___bounce=1&userAction=search&unifiedUser=true&TradeSearchCriteria_newSearchParams_searchText=&refSearchUsed=true#searchResults";

export const INFORNEXUS_AUTO_ADD_SEARCH_URL =
  new URL(INFORNEXUS_AUTO_ADD_SEARCH_PATH, INFORNEXUS_AUTO_ADD_ORIGIN).toString();

export const INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR =
  '[name="tradecardForm"] [name="TradeSearchCriteria_newSearchParams_searchText"]';

export const INFORNEXUS_AUTO_ADD_SEARCH_BUTTON_SELECTOR = [
  '[name="tradecardForm"] input[value="Search"]',
  '[name="tradecardForm"] button:has-text("Search")',
  '[name="tradecardForm"] [role="button"]:has-text("Search")',
].join(", ");

export function getInfornexusAutoAddSearchInput(page) {
  return page.locator(INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR).first();
}

export function getInfornexusAutoAddSearchButton(page) {
  return page.locator(INFORNEXUS_AUTO_ADD_SEARCH_BUTTON_SELECTOR).first();
}

export function resolveInfornexusAutoAddSearchUrl(loginUrl, searchUrl = "") {
  const loginOrigin = resolveInfornexusLoginOrigin(loginUrl);
  const rawSearchUrl = String(searchUrl || INFORNEXUS_AUTO_ADD_SEARCH_PATH).trim();
  const normalizedSearchUrl = rawSearchUrl === INFORNEXUS_AUTO_ADD_SEARCH_URL
    ? INFORNEXUS_AUTO_ADD_SEARCH_PATH
    : rawSearchUrl || INFORNEXUS_AUTO_ADD_SEARCH_PATH;
  const resolvedUrl = new URL(normalizedSearchUrl, loginOrigin);

  if (resolvedUrl.protocol !== "https:") {
    throw new Error(`Infornexus auto-add search URL must use https: ${resolvedUrl.toString()}`);
  }
  if (resolvedUrl.origin !== loginOrigin) {
    throw new Error(
      `Infornexus auto-add search URL must stay on login origin ${loginOrigin}: ${resolvedUrl.toString()}`,
    );
  }

  return resolvedUrl.toString();
}

export async function openInfornexusAutoAddSearchPage(page, options = {}) {
  const navigationTimeoutMs = Number(options?.navigationTimeoutMs || 45000);
  const postLoginWaitMs = Number(options?.postLoginWaitMs || 0);
  const targetUrl = resolveInfornexusAutoAddSearchUrl(options?.loginUrl, options?.searchUrl);

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: navigationTimeoutMs,
  });

  if (typeof page.waitForLoadState === "function") {
    await page
      .waitForLoadState("domcontentloaded", { timeout: Math.min(navigationTimeoutMs, 5000) })
      .catch(() => {});
  }
  if (postLoginWaitMs > 0 && typeof page.waitForTimeout === "function") {
    await page.waitForTimeout(postLoginWaitMs);
  }

  return targetUrl;
}

export function createInfornexusAutoAddManualSessionManager(dependencies = {}) {
  let currentSession = null;
  const log = typeof dependencies.log === "function" ? dependencies.log : () => {};
  const createManualSessionId = typeof dependencies.createManualSessionId === "function"
    ? dependencies.createManualSessionId
    : () => `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const showAutomationBadge = typeof dependencies.showAutomationBadge === "function"
    ? dependencies.showAutomationBadge
    : async () => {};

  async function open(credentials, options = {}) {
    await close("replaced");

    const config = dependencies.config || {};
    const browserName = String(config.browser || "chromium");
    const engine = dependencies.browserEngines?.[browserName] || dependencies.browserEngines?.chromium;
    if (!engine?.launch) {
      throw new Error(`Unsupported Infornexus manual browser engine: ${browserName}`);
    }

    const launchOptions = {
      slowMo: config.slowMo,
      ...(config.launchOptions || {}),
      headless: Boolean(options.headless),
    };
    const browserLaunchOptions = typeof dependencies.buildVisibleBrowserLaunchOptions === "function"
      ? dependencies.buildVisibleBrowserLaunchOptions(launchOptions, browserName)
      : launchOptions;

    const manualSessionId = createManualSessionId();
    const startedAt = new Date().toISOString();
    let browser = null;
    let context = null;
    let page = null;

    try {
      browser = await engine.launch(browserLaunchOptions);
      context = await browser.newContext({
        viewport: null,
      });
      page = await context.newPage();

      if (typeof page.setDefaultTimeout === "function") {
        page.setDefaultTimeout(Number(config.navigationTimeoutMs || 45000));
      }
      if (typeof page.setDefaultNavigationTimeout === "function") {
        page.setDefaultNavigationTimeout(Number(config.navigationTimeoutMs || 45000));
      }

      const showManualBadge = async (message, details = {}) => showAutomationBadge(page, {
        title: "Infor Nexus Auto Add 手动会话",
        message,
        details: {
          phase: "auto-add-manual",
          ...details,
        },
      });

      const session = {
        autoAddSearchUrl: "",
        browser,
        closed: false,
        context,
        finalUrl: "",
        manualSessionId,
        page,
        startedAt,
        title: "",
      };
      bindSessionLifecycle(session);
      currentSession = session;

      await showManualBadge("正在打开 Infor Nexus 登录页", {
        phase: "open-login",
      });
      await page.goto(config.loginUrl || INFORNEXUS_AUTO_ADD_ORIGIN, {
        waitUntil: "domcontentloaded",
        timeout: Number(config.navigationTimeoutMs || 45000),
      });
      if (typeof dependencies.ensureLoggedIn !== "function") {
        throw new Error("Infornexus manual session requires ensureLoggedIn.");
      }
      await showManualBadge("正在确认 Infor Nexus 登录状态", {
        phase: "login",
      });
      await dependencies.ensureLoggedIn(page, credentials);
      if (Number(config.postLoginWaitMs || 0) > 0 && typeof page.waitForTimeout === "function") {
        await page.waitForTimeout(Number(config.postLoginWaitMs || 0));
      }

      await showManualBadge("登录完成，正在打开 Auto Add 查询页", {
        phase: "open-search",
      });
      const autoAddSearchUrl = await openInfornexusAutoAddSearchPage(page, {
        loginUrl: config.loginUrl,
        navigationTimeoutMs: Number(config.navigationTimeoutMs || 45000),
        postLoginWaitMs: Number(config.postLoginWaitMs || 0),
        searchUrl: config.autoAddSearchUrl,
      });
      session.autoAddSearchUrl = autoAddSearchUrl;
      session.finalUrl = getSafePageUrl(page);
      session.title = await getSafePageTitle(page);
      await showManualBadge("Auto Add 查询页已打开，等待手动操作", {
        phase: "ready",
      });

      if (typeof dependencies.onManualSessionReady === "function") {
        await dependencies.onManualSessionReady(session);
      }

      log("Opened Infornexus auto-add manual search session.", {
        autoAddSearchUrl,
        finalUrl: session.finalUrl,
        manualSessionId,
      });

      return {
        ok: true,
        loginSuccess: true,
        searchOpened: true,
        manualSessionId,
        autoAddSearchUrl,
        finalUrl: session.finalUrl,
        title: session.title,
        message: "Infor Nexus auto-add search page opened successfully.",
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      await showAutomationBadge(page, {
        title: "Infor Nexus Auto Add 手动会话",
        message: "Auto Add 手动会话打开失败",
        details: {
          phase: "failed",
        },
      });
      if (currentSession?.manualSessionId === manualSessionId) {
        currentSession = null;
      }
      await context?.close?.().catch(() => {});
      await browser?.close?.().catch(() => {});
      throw error;
    }
  }

  async function close(reason = "manual-close") {
    const session = currentSession;
    if (!session) {
      return null;
    }

    currentSession = null;
    session.closed = true;
    session.closedAt = new Date().toISOString();
    session.closeReason = reason;
    await session.context?.close?.().catch(() => {});
    await session.browser?.close?.().catch(() => {});
    log("Closed Infornexus auto-add manual search session.", {
      manualSessionId: session.manualSessionId,
      reason,
    });
    return {
      manualSessionId: session.manualSessionId,
      reason,
    };
  }

  function getSessionSummary() {
    if (!currentSession) {
      return null;
    }

    if (currentSession.page?.isClosed?.()) {
      markSessionClosed(currentSession, "page-closed");
      return null;
    }

    currentSession.finalUrl = getSafePageUrl(currentSession.page) || currentSession.finalUrl;
    return {
      manualSessionId: currentSession.manualSessionId,
      startedAt: currentSession.startedAt,
      autoAddSearchUrl: currentSession.autoAddSearchUrl,
      finalUrl: currentSession.finalUrl,
      title: currentSession.title,
    };
  }

  function bindSessionLifecycle(session) {
    session.page?.on?.("close", () => markSessionClosed(session, "page-close"));
    session.page?.on?.("crash", () => markSessionClosed(session, "page-crash"));
    session.context?.on?.("close", () => markSessionClosed(session, "context-close"));
    session.browser?.on?.("disconnected", () => markSessionClosed(session, "browser-disconnected"));
  }

  function markSessionClosed(session, reason) {
    session.closed = true;
    session.closedAt = new Date().toISOString();
    session.closeReason = reason;
    if (currentSession?.manualSessionId === session.manualSessionId) {
      currentSession = null;
    }
  }

  function getSafePageUrl(page) {
    if (typeof dependencies.safePageUrl === "function") {
      return String(dependencies.safePageUrl(page) || "");
    }
    return safePageUrl(page);
  }

  async function getSafePageTitle(page) {
    if (typeof dependencies.safePageTitle === "function") {
      return String(await dependencies.safePageTitle(page) || "");
    }
    return safePageTitle(page);
  }

  return {
    close,
    getSessionSummary,
    open,
  };
}

export async function collectInfornexusAutoAddSearchDiagnostics(page) {
  const [title, pageState] = await Promise.all([
    safePageTitle(page),
    page.evaluate((inputSelector) => {
      const candidates = Array.from(
        document.querySelectorAll('[name="TradeSearchCriteria_newSearchParams_searchText"]'),
      ).slice(0, 10).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visible = Boolean(
          rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden",
        );

        return {
          id: element.getAttribute("id") || "",
          name: element.getAttribute("name") || "",
          placeholder: element.getAttribute("placeholder") || "",
          title: element.getAttribute("title") || "",
          type: element.getAttribute("type") || "",
          formName: element.form?.getAttribute("name") || "",
          visible,
        };
      });

      return {
        hasTradecardForm: Boolean(document.querySelector('[name="tradecardForm"]')),
        targetInputCount: document.querySelectorAll(inputSelector).length,
        candidateCount: candidates.length,
        candidates,
      };
    }, INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR).catch((error) => ({
      hasTradecardForm: false,
      targetInputCount: 0,
      candidateCount: 0,
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
    })),
  ]);

  return {
    url: safePageUrl(page),
    title,
    ...pageState,
  };
}

export function formatInfornexusAutoAddSearchDiagnostics(diagnostics, screenshotPath = "") {
  const candidates = Array.isArray(diagnostics?.candidates)
    ? diagnostics.candidates.map(formatCandidate).join("; ")
    : "";
  const parts = [
    "Diagnostics:",
    `url=${formatValue(diagnostics?.url)}`,
    `title=${formatValue(diagnostics?.title)}`,
    `screenshot=${formatValue(screenshotPath)}`,
    `tradecardForm=${Boolean(diagnostics?.hasTradecardForm)}`,
    `targetInputCount=${Number(diagnostics?.targetInputCount || 0)}`,
    `candidateCount=${Number(diagnostics?.candidateCount || 0)}`,
    `candidates=${candidates || "none"}`,
  ];

  if (diagnostics?.error) {
    parts.push(`diagnosticError=${formatValue(diagnostics.error)}`);
  }

  return parts.join(" ");
}

function formatCandidate(candidate) {
  return `{id=${formatValue(candidate?.id)}, name=${formatValue(candidate?.name)}, placeholder=${formatValue(candidate?.placeholder)}, title=${formatValue(candidate?.title)}, type=${formatValue(candidate?.type)}, form=${formatValue(candidate?.formName)}, visible=${Boolean(candidate?.visible)}}`;
}

function resolveInfornexusLoginOrigin(loginUrl) {
  const parsedUrl = new URL(String(loginUrl || INFORNEXUS_AUTO_ADD_ORIGIN).trim() || INFORNEXUS_AUTO_ADD_ORIGIN);
  if (parsedUrl.protocol !== "https:") {
    throw new Error(`Infornexus login URL must use https: ${parsedUrl.toString()}`);
  }
  return parsedUrl.origin;
}

function formatValue(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || "(empty)";
}

function safePageUrl(page) {
  try {
    return String(page?.url?.() || "");
  } catch {
    return "";
  }
}

async function safePageTitle(page) {
  try {
    return String(await page?.title?.() || "");
  } catch {
    return "";
  }
}
