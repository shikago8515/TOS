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
