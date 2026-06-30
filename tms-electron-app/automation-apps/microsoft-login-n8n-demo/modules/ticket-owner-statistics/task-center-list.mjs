import { normalizeText } from "./ticket-fields.mjs";

export async function readTaskListCounts(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const target of listTargets(page)) {
      const titleTexts = await target.locator([
        "[id*='inboxTable'][id*='Title']",
        "[id*='inboxTable'][id*='title']",
        ".sapMTitle",
        "h2",
        "h3",
      ].join(", ")).allInnerTexts().catch(() => []);
      const bodyText = await target.locator("body").innerText({ timeout: 1500 }).catch(() => "");
      for (const text of [...titleTexts, bodyText]) {
        const parsed = parseTaskListCountText(text);
        if (parsed.filteredCount > 0 || parsed.totalCount > 0) {
          return parsed;
        }
      }
    }
    await pageWait(page, 500);
  }
  return {
    filteredCount: 0,
    totalCount: 0,
    label: "",
  };
}

export function parseTaskListCountText(value) {
  const text = normalizeText(value);
  const match = text.match(/\bTasks\s*\(\s*(\d+)\s*[\/／]\s*(\d+)\s*\)/i);
  if (!match) {
    return {
      filteredCount: 0,
      totalCount: 0,
      label: "",
    };
  }
  return {
    filteredCount: Number(match[1]) || 0,
    totalCount: Number(match[2]) || 0,
    label: match[0],
  };
}

function listTargets(page) {
  return [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
}

async function pageWait(page, ms) {
  await page.waitForTimeout(Math.max(0, Number(ms) || 0)).catch(() => {});
}
