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
