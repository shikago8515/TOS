import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE
  || "D:\\TOSHelperTest\\TOS-Automation-Helper\\automation-apps\\playwright-console\\node_modules\\playwright";
const { chromium } = require(PLAYWRIGHT_MODULE);

const USERNAME = process.env.INFOR_NEXUS_USERNAME || "";
const PASSWORD = process.env.INFOR_NEXUS_PASSWORD || "";
const OUTPUT_DIR = process.env.PACKING_LIST_PROBE_DIR || "D:\\TOS-Shipping-test";
const LOGIN_URL = "https://network.infornexus.com";
const HOME_URL = "https://network.infornexus.com/en/trade/Homepage.jsp?nav=Homenav";
const PACKING_URL = "https://network.infornexus.com/en/trade/PackingManifestView.jsp";
const PO_LIST = (process.env.PACKING_LIST_PROBE_POS || "0902694567,0902694602,0902694606,0902695967,0902695969,0902697667")
  .split(/[,;\s]+/)
  .map((item) => item.trim())
  .filter(Boolean);

if (!USERNAME || !PASSWORD) {
  throw new Error("Set INFOR_NEXUS_USERNAME and INFOR_NEXUS_PASSWORD before running the probe.");
}

const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  slowMo: 60,
});
const context = await browser.newContext({
  viewport: null,
  acceptDownloads: true,
});
await context.addInitScript(() => {
  window.__tosDescribeElement = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const attrs = {};
    for (const attr of Array.from(element.attributes || [])) {
      attrs[attr.name] = attr.value;
    }
    return {
      tagName: element.tagName,
      id: element.id || "",
      className: String(element.className || ""),
      name: element.getAttribute("name") || "",
      type: element.getAttribute("type") || "",
      title: element.getAttribute("title") || "",
      role: element.getAttribute("role") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      dataButtonName: element.getAttribute("data-buttonname") || "",
      text: String(element.textContent || element.getAttribute("value") || "").replace(/\s+/g, " ").trim().slice(0, 300),
      href: element.href || element.getAttribute("href") || "",
      onclick: String(element.getAttribute("onclick") || ""),
      attributes: attrs,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      outerHTML: String(element.outerHTML || "").slice(0, 1200),
    };
  };
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(30000);

const result = {
  generatedAt: new Date().toISOString(),
  urls: {
    login: LOGIN_URL,
    home: HOME_URL,
    packing: PACKING_URL,
  },
  probes: [],
};

try {
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
  await settle(page);
  if (!await page.locator("#navmenu__applications").first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Username").fill(USERNAME);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click({ force: true, noWaitAfter: true });
    await waitForLoggedIn(page);
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await settle(page);
  }

  for (const poNumber of PO_LIST) {
    const probe = await probePo(page, poNumber);
    result.probes.push(probe);
    const hasResult = probe.outcome?.type === "result";
    const emptyCount = result.probes.filter((item) => item.outcome?.type === "empty").length;
    if (hasResult && emptyCount > 0) {
      break;
    }
  }
} finally {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `packing-list-element-probe-${Date.now()}.json`);
  result.finalUrl = page.url();
  result.title = await page.title().catch(() => "");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(outputPath);
  await page.waitForTimeout(5000).catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

async function probePo(page, poNumber) {
  const probe = {
    poNumber,
    startedAt: new Date().toISOString(),
  };
  await page.goto(PACKING_URL, { waitUntil: "domcontentloaded" });
  await settle(page);
  probe.initialUrl = page.url();
  probe.initialTitle = await page.title().catch(() => "");
  probe.initialElements = await capturePackingElements(page);

  const poInput = page.locator('div.filter.hasOperator:has(span.fieldDisplay:has-text("PO Number(s)")) input.fieldEdit').first();
  await poInput.waitFor({ state: "visible", timeout: 15000 });
  await poInput.click();
  await poInput.fill("");
  await poInput.type(poNumber, { delay: 15 });
  await poInput.evaluate((element) => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
  });
  probe.afterFillElements = await capturePackingElements(page);

  const applyButton = page.locator('button:has-text("Apply"), input[type="button"][value="Apply"], a:has-text("Apply")').first();
  await applyButton.waitFor({ state: "visible", timeout: 5000 });
  probe.applyClickElement = await captureLocatorElement(applyButton);

  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && response.url().includes("/remotes/f2.bridge/inline.gtnexus.trade.flexView")
  ), { timeout: 12000 }).catch(() => null);
  await applyButton.click({ timeout: 5000 });
  const response = await responsePromise;
  probe.flexViewResponse = response
    ? { status: response.status(), url: response.url() }
    : null;

  probe.outcome = await waitForOutcome(page, poNumber);
  probe.finalUrl = page.url();
  probe.finalElements = await capturePackingElements(page);
  return probe;
}

async function waitForOutcome(page, poNumber) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const outcome = await page.evaluate((targetPo) => {
      const active = document.querySelector("#active") || document;
      const firstCellLinks = Array.from(active.querySelectorAll("td.first-cell-content a[href]"));
      const detailLink = firstCellLinks.find((anchor) => {
        const href = `${anchor.getAttribute("href") || ""} ${anchor.href || ""}`;
        const className = String(anchor.className || "");
        return !className.includes("folderIconHoverLink")
          && href.includes("PageResolver.jsp")
          && href.includes("OrdersViewDocumentResolver")
          && href.includes("docType=PackingManifest");
      });
      if (detailLink) {
        return {
          type: "result",
          detailLink: window.__tosDescribeElement(detailLink),
          resultRow: window.__tosDescribeElement(detailLink.closest("tr")),
        };
      }
      const folderLink = firstCellLinks.find((anchor) => {
        const href = `${anchor.getAttribute("href") || ""} ${anchor.href || ""}`;
        return href.includes("ManifestFolder?key=");
      });
      if (folderLink) {
        return {
          type: "result-folder-only",
          folderLink: window.__tosDescribeElement(folderLink),
          resultRow: window.__tosDescribeElement(folderLink.closest("tr")),
        };
      }
      const noResultRow = active.querySelector(".flexresults tbody tr.noresults");
      const noResultText = String(noResultRow?.textContent || "").replace(/\s+/g, " ").trim();
      if (/No\s+Results/i.test(noResultText)) {
        return {
          type: "empty",
          noResultRow: window.__tosDescribeElement(noResultRow),
          noResultCell: window.__tosDescribeElement(noResultRow.querySelector("td")),
        };
      }
      if (/Please\s+apply\s+filter\s+criteria/i.test(noResultText)) {
        return {
          type: "not-applied",
          noResultRow: window.__tosDescribeElement(noResultRow),
          noResultCell: window.__tosDescribeElement(noResultRow.querySelector("td")),
        };
      }
      const bodyText = String(document.body?.innerText || "");
      return {
        type: "pending",
        activeText: String(active?.innerText || "").slice(0, 1000),
        hasTargetPoInBody: targetPo ? bodyText.includes(targetPo) : false,
      };
    }, poNumber);

    if (["result", "result-folder-only", "empty", "not-applied"].includes(outcome?.type)) {
      return outcome;
    }
    await page.waitForTimeout(250);
  }
  return {
    type: "timeout",
    snapshot: await capturePackingElements(page),
  };
}

async function capturePackingElements(page) {
  return page.evaluate(() => {
    const active = document.querySelector("#active") || document;
    const filters = Array.from(active.querySelectorAll("div.filter")).map((filter) => {
      const label = filter.querySelector(".fieldDisplay");
      const input = filter.querySelector("input, textarea, select");
      return {
        filter: window.__tosDescribeElement(filter),
        label: window.__tosDescribeElement(label),
        input: window.__tosDescribeElement(input),
      };
    });
    const actions = Array.from(document.querySelectorAll("button, input[type=button], input[type=submit], a[role=button], a")).map((element) => {
      const text = String(element.textContent || element.getAttribute("value") || "").replace(/\s+/g, " ").trim();
      const title = String(element.getAttribute("title") || "");
      const role = String(element.getAttribute("role") || "");
      const buttonName = String(element.getAttribute("data-buttonname") || "");
      return { text, title, role, buttonName, element: window.__tosDescribeElement(element) };
    }).filter((item) => /Apply|Filter|Packing|PDF|Actions|Tools|^\.\.\.$/i.test(`${item.text} ${item.title} ${item.role} ${item.buttonName}`)).slice(0, 80);
    return {
      url: window.location.href,
      title: document.title,
      activeText: String(active?.innerText || "").slice(0, 2500),
      filters,
      actions,
      noResultRows: Array.from(active.querySelectorAll(".flexresults tbody tr.noresults")).map(window.__tosDescribeElement),
      firstCellLinks: Array.from(active.querySelectorAll("td.first-cell-content a[href]")).map(window.__tosDescribeElement),
    };
  });
}

async function captureLocatorElement(locator) {
  return locator.evaluate((element) => window.__tosDescribeElement(element)).catch(() => null);
}

async function waitForLoggedIn(page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const applicationsVisible = await page.locator("#navmenu__applications").first().isVisible({ timeout: 300 }).catch(() => false);
    const state = await page.evaluate(() => {
      const text = String(document.body?.innerText || "");
      return {
        url: window.location.href,
        hasLoginForm: Boolean(document.querySelector('input[placeholder="Username"], input[name*="user" i]')),
        hasAccessCodeChallenge: /Access Code/i.test(text) && /(e-Identity|without providing an Access Code|required to log in)/i.test(text),
        hasLoginFailure: /(invalid|incorrect|not recognized|authentication failed|login failed|try again)/i.test(text),
      };
    }).catch(() => ({}));
    if (state.hasAccessCodeChallenge) throw new Error("Infor Nexus login requires Access Code.");
    if (state.hasLoginFailure) throw new Error("Infor Nexus login failed.");
    if (applicationsVisible || (/\/en\/trade\//i.test(state.url || "") && !state.hasLoginForm)) return;
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for Infor Nexus login.");
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(500);
}
