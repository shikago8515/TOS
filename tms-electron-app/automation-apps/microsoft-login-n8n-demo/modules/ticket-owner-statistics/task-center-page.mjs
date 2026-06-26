import {
  createTaskCenterRequestRecorder,
  extractTicketOwnerRowsFromRequestRecords,
  summarizeTaskCenterRequestRecords,
} from "./request-first.mjs";
import {
  EXCLUDED_TASK_TYPE,
  extractTaskInfoFromText,
  extractTicketFieldsFromText,
  normalizeComparable,
  normalizeText,
  resolveTicketOwnerRow,
} from "./ticket-fields.mjs";

const TASK_CENTER_TILE_SELECTORS = [
  "#__tile32",
  "a[href*='taskcenter-display']",
  "text=Task Center",
];

const TASK_CENTER_READY_SELECTORS = [
  "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
  "#application-taskcenter-display-component---inboxTable--searchField-I",
  "[id$='taskDefinitionFilter-arrow']",
  "[id$='searchField-I']",
  "[id*='inboxTable']",
  "text=Task Type",
  "button:has-text(\"Go\")",
];

const TASK_ROW_SELECTOR = [
  "tr[role='row'][aria-level='1']",
  "[id*='inboxTable'] tr[role='row']",
  "[id*='inboxTable'] .sapMLIB",
  "tbody tr[role='row']",
  ".sapMListTblRow",
].join(", ");

export async function collectTicketOwnerStatistics(page, options = {}) {
  const timeoutMs = Number(options.navigationTimeoutMs || 45000);
  const maxTicketCount = normalizePositiveInteger(options.maxTicketCount, 200);
  const maxAttemptCount = normalizePositiveInteger(
    options.maxTicketAttemptCount,
    Math.max(maxTicketCount * 8, 25)
  );
  const requestFirst = options.requestFirst !== false;
  const requestRecorder = requestFirst
    ? createTaskCenterRequestRecorder(page)
    : null;

  let requestDiagnostics = null;
  try {
    await openTaskCenter(page, timeoutMs);
    const selectedTaskTypes = await configureTicketOwnerTaskTypeFilter(page, timeoutMs);
    await pageWait(page, 1200);

    const requestRows = requestFirst
      ? extractCompleteRowsFromRequestRecords(requestRecorder.records, maxTicketCount)
      : [];
    const requestCandidates = requestFirst
      ? extractTicketOwnerRowsFromRequestRecords(requestRecorder.records)
      : [];

    if (options.diagnoseOnly) {
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        diagnoseOnly: true,
        rowCount: 0,
        failedTicketCount: 0,
        attemptedTicketCount: 0,
        selectedTaskTypes,
        rows: [],
        ticketResults: [],
        failedTickets: [],
        requestFirst: requestDiagnostics,
        requestCandidates: requestCandidates.slice(0, 30),
        finalTaskCenterUrl: page.url(),
        message: `诊断模式已捕获 ${requestDiagnostics.recordCount} 条相关请求，识别 ${requestDiagnostics.candidateCount} 个候选 ticket。`,
      };
    }

    if (requestRows.length > 0) {
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        rowCount: requestRows.length,
        failedTicketCount: 0,
        attemptedTicketCount: requestRows.length,
        selectedTaskTypes,
        rows: requestRows,
        ticketResults: requestRows.map((row, index) => ({
          ok: true,
          requestFirst: true,
          taskKey: `request-first-${index + 1}`,
          branchId: row.branchId,
          caseNumber: row["Case Number"],
          taskType: row["Task Type"],
          request: row.Request,
          poNumber: row["PO Number"],
          workingNumber: row["Working Number"],
          warnings: [],
        })),
        failedTickets: [],
        requestFirst: requestDiagnostics,
        finalTaskCenterUrl: page.url(),
        message: `已通过请求优先模式生成 ${requestRows.length} 条 Ticket ownership 记录。`,
      };
    }

    const taskCenterUrl = page.url();

    const rows = [];
    const ticketResults = [];
    const failedTickets = [];
    const processedKeys = new Set();
    let exhaustedVisibleRows = false;

    while (rows.length < maxTicketCount && processedKeys.size < maxAttemptCount) {
      const visibleTasks = await collectVisibleTaskRows(page, maxAttemptCount * 2);
      const nextTask = visibleTasks.find((task) => {
        if (!isTicketOwnerCandidate(task)) {
          return false;
        }
        return !processedKeys.has(buildTaskKey(task));
      });

      if (!nextTask) {
        if (exhaustedVisibleRows) {
          break;
        }
        exhaustedVisibleRows = true;
        const scrolled = await scrollTaskCenterRows(page);
        if (!scrolled) {
          break;
        }
        await pageWait(page, 700);
        continue;
      }

      exhaustedVisibleRows = false;
      const taskKey = buildTaskKey(nextTask);
      processedKeys.add(taskKey);

      try {
        const selected = await focusTaskRow(page, nextTask);
        if (!selected) {
          throw new Error(`没有找到可点击的 Task Center 行：${summarizeTask(nextTask)}`);
        }

        const claim = await claimTaskIfAvailable(page);
        const openInApp = await openSelectedTaskInApp(page, timeoutMs);
        const detail = await readTicketDetail(openInApp.appPage, nextTask, timeoutMs);
        const ownerRow = resolveTicketOwnerRow(nextTask, detail.fields);
        ownerRow.warnings = collectOwnerRowWarnings(ownerRow);
        const missingRequiredFields = collectMissingRequiredOwnerFields(ownerRow);

        if (ownerRow.branchId === "UNKNOWN") {
          throw new Error(`当前 ticket 不属于 PPT 中 A/B/C 三类：${summarizeTask(nextTask)}`);
        }
        if (missingRequiredFields.length > 0) {
          throw new Error(
            `ticket 明细缺少关键字段：${missingRequiredFields.join(", ")}。` +
            `当前页面片段：${detail.rawTextSnippet.slice(0, 500)}`
          );
        }

        rows.push(ownerRow);
        ticketResults.push({
          ok: true,
          taskKey,
          branchId: ownerRow.branchId,
          caseNumber: ownerRow["Case Number"],
          taskType: ownerRow["Task Type"],
          request: ownerRow.Request,
          poNumber: ownerRow["PO Number"],
          workingNumber: ownerRow["Working Number"],
          warnings: ownerRow.warnings,
          claim,
          openInApp: openInApp.summary,
          detailTextSnippet: detail.rawTextSnippet,
        });

        await restoreTaskCenter(page, openInApp, taskCenterUrl, timeoutMs);
      } catch (error) {
        const message = error?.message || "ticket 采集失败。";
        failedTickets.push({
          ok: false,
          taskKey,
          caseNumber: nextTask.caseNumber,
          taskType: nextTask.taskType,
          request: nextTask.request,
          rowTextSnippet: normalizeText(nextTask.text).slice(0, 300),
          message,
        });
        await recoverTaskCenter(page, taskCenterUrl, timeoutMs);
      }
    }

    requestDiagnostics = requestRecorder?.summarize?.() || summarizeTaskCenterRequestRecords([]);

    return {
      ok: rows.length > 0,
      rowCount: rows.length,
      failedTicketCount: failedTickets.length,
      attemptedTicketCount: processedKeys.size,
      selectedTaskTypes,
      rows,
      ticketResults,
      failedTickets,
      requestFirst: requestDiagnostics,
      finalTaskCenterUrl: page.url(),
      message: rows.length > 0
        ? `已生成 ${rows.length} 条 Ticket ownership 记录。`
        : failedTickets.length > 0
          ? `已尝试 ${failedTickets.length} 条 ticket，但都缺少生成 Ticket ownership 所需的关键字段。`
          : "没有采集到可生成 Ticket ownership 的 ticket。",
    };
  } finally {
    requestRecorder?.stop?.();
  }
}

function extractCompleteRowsFromRequestRecords(records, maxTicketCount) {
  return extractTicketOwnerRowsFromRequestRecords(records)
    .filter((candidate) => candidate.missingFields.length === 0)
    .map((candidate) => candidate.row)
    .slice(0, maxTicketCount);
}

async function openTaskCenter(page, timeoutMs) {
  if (page.url().includes("taskcenter-display")) {
    if (isTaskCenterDetailUrl(page.url())) {
      return false;
    }
    await waitForTaskCenterReady(page, timeoutMs);
    return;
  }

  await waitForAny(page, TASK_CENTER_TILE_SELECTORS, timeoutMs);
  await clickFirstVisible(page, TASK_CENTER_TILE_SELECTORS);
  await waitFor(async () => {
    return page.url().includes("taskcenter-display") || await anyVisible(page, TASK_CENTER_READY_SELECTORS);
  }, timeoutMs, 250);
  await waitForTaskCenterReady(page, timeoutMs);
}

async function waitForTaskCenterReady(page, timeoutMs) {
  const ready = await waitFor(async () => {
    return (
      await anyVisible(page, TASK_CENTER_READY_SELECTORS) ||
      await isTaskCenterSurfaceReady(page)
    );
  }, Math.max(timeoutMs, 60000), 500)
    .then(() => true)
    .catch(() => false);

  if (ready) {
    await pageWait(page, 400);
    return;
  }

  const debug = await collectPageDebug(page);
  throw new Error(`Task Center 页面没有就绪，无法开始采集。Debug: ${JSON.stringify(debug)}`);
}

async function configureTicketOwnerTaskTypeFilter(page, timeoutMs) {
  await openTaskTypePopup(page, timeoutMs);
  const optionTexts = await collectTaskTypeOptionTexts(page);
  if (!optionTexts.length) {
    const debug = await collectPageDebug(page);
    throw new Error(`Task Type 下拉选项没有加载出来。Debug: ${JSON.stringify(debug)}`);
  }

  const selectedTaskTypes = [];
  for (const optionText of optionTexts) {
    if (isSelectAllOption(optionText)) {
      continue;
    }

    const shouldSelect = !isExcludedTaskType(optionText);
    const changed = await setTaskTypeOptionSelected(page, optionText, shouldSelect, timeoutMs);
    if (shouldSelect && changed !== false) {
      selectedTaskTypes.push(optionText);
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
  await clickGoButton(page);
  await pageWait(page, 900);

  return selectedTaskTypes;
}

async function openTaskTypePopup(page, timeoutMs) {
  if (await anyVisible(page, taskTypePopupSelectors())) {
    return;
  }

  const filterArrowSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-arrow",
    "[id$='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter-arrow']",
    "[id*='taskDefinitionFilter'] .sapMInputBaseIcon",
    "xpath=//*[normalize-space()='Task Type']/following::*[contains(@id,'arrow') or contains(@class,'sapMInputBaseIcon')][1]",
  ];
  const filterFieldSelectors = [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter",
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-inner",
    "[id$='taskDefinitionFilter']",
    "[id$='taskDefinitionFilter-inner']",
    "[id*='taskDefinitionFilter'] input[role='combobox']",
    "input[name='taskDefinition']",
    "[role='combobox'][aria-label*='Task Type']",
    "input[aria-label*='Task Type']",
    "xpath=//*[normalize-space()='Task Type']/following::*[@role='combobox' or self::input or contains(@class,'sapMInputBase')][1]",
  ];

  if (await anyVisible(page, filterArrowSelectors)) {
    await clickFirstVisible(page, filterArrowSelectors);
  } else {
    const filterField = await firstVisibleTarget(page, filterFieldSelectors);
    if (!filterField) {
      throw new Error("没有找到 Task Type 筛选控件。");
    }
    await filterField.locator.click().catch(() => {});
    await page.keyboard.press("Alt+ArrowDown").catch(() => {});
  }

  await waitForAny(page, taskTypePopupSelectors(), Math.min(timeoutMs, 18000));
  await pageWait(page, 250);
}

async function collectTaskTypeOptionTexts(page) {
  const optionTexts = [];
  for (const target of listTargets(page)) {
    const options = target.locator("li.sapMMultiComboBoxItem[role='option'], li[role='option'].sapMMultiComboBoxItem, li[role='option']");
    const count = await options.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      if (!await option.isVisible().catch(() => false)) {
        continue;
      }
      const text = normalizeText(await option.innerText().catch(() => ""));
      if (text && !optionTexts.includes(text)) {
        optionTexts.push(text);
      }
    }
  }
  return optionTexts;
}

async function setTaskTypeOptionSelected(page, optionText, selected, timeoutMs) {
  await openTaskTypePopup(page, timeoutMs).catch(() => {});
  const option = await findTaskTypeOption(page, optionText);
  if (!option) {
    return false;
  }

  const isSelected = await isTaskTypeOptionSelected(option);
  if (isSelected === selected) {
    return true;
  }

  await option.scrollIntoViewIfNeeded().catch(() => {});
  const checkbox = option.locator(".sapMCbBg, [role='checkbox']").first();
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.click().catch(async () => option.click());
  } else {
    await option.click();
  }
  await pageWait(page, 200);
  return true;
}

async function findTaskTypeOption(page, optionText) {
  for (const target of listTargets(page)) {
    const option = target
      .locator("li.sapMMultiComboBoxItem[role='option'], li[role='option'].sapMMultiComboBoxItem, li[role='option']")
      .filter({ hasText: optionText })
      .first();
    if (await option.isVisible().catch(() => false)) {
      return option;
    }
  }
  return null;
}

async function isTaskTypeOptionSelected(option) {
  return option.evaluate((node) => {
    if (node.getAttribute("aria-selected") === "true") {
      return true;
    }
    if (node.querySelector(".sapMCbMarkChecked")) {
      return true;
    }
    const checkbox = node.querySelector("[role='checkbox']");
    return checkbox?.getAttribute("aria-checked") === "true";
  }).catch(() => false);
}

async function clickGoButton(page) {
  const goButtonSelectors = [
    "#application-taskcenter-display-component---worklist--filterBar-btnGo",
    "[id$='filterBar-btnGo']",
    "[id*='filterBar-btnGo']",
    "button:has-text(\"Go\")",
  ];
  if (await anyVisible(page, goButtonSelectors)) {
    await clickFirstVisible(page, goButtonSelectors);
  }
}

async function collectVisibleTaskRows(page, limit) {
  const collected = [];
  const seen = new Set();

  for (const target of listTargets(page)) {
    const rows = target.locator(TASK_ROW_SELECTOR);
    const count = await rows.count().catch(() => 0);
    for (let index = 0; index < count && collected.length < limit; index += 1) {
      const row = rows.nth(index);
      if (!await row.isVisible().catch(() => false)) {
        continue;
      }

      const text = normalizeText(await row.innerText().catch(() => ""));
      if (!text || seen.has(text)) {
        continue;
      }

      const cells = await collectRowCells(row);
      const extracted = extractTaskInfoFromText(text, cells);
      const task = {
        ...extracted,
        text,
        cells,
        rowIndex: index,
        frameUrl: typeof target.url === "function" ? target.url() : "",
      };

      seen.add(text);
      collected.push(task);
    }
  }

  return collected;
}

async function collectRowCells(row) {
  const cells = row.locator("[role='gridcell'], td, .sapMListTblCell, .sapMText, .sapMObjectIdentifierTitle, .sapMObjectAttributeText");
  const values = [];
  const count = await cells.count().catch(() => 0);
  for (let index = 0; index < Math.min(count, 24); index += 1) {
    const text = normalizeText(await cells.nth(index).innerText().catch(() => ""));
    if (text && !values.includes(text)) {
      values.push(text);
    }
  }
  return values;
}

function isTicketOwnerCandidate(task) {
  const taskType = normalizeComparable(task.taskType || task.text);
  if (!taskType) {
    return false;
  }
  if (isExcludedTaskType(taskType)) {
    return false;
  }
  return (
    taskType.includes("provide feedback") ||
    taskType.includes("review main ticket resolution") ||
    taskType.includes("review sub-ticket resolution")
  );
}

async function focusTaskRow(page, task) {
  for (const target of listTargets(page)) {
    const rows = target.locator(TASK_ROW_SELECTOR);
    const count = await rows.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      if (!await row.isVisible().catch(() => false)) {
        continue;
      }
      const text = normalizeText(await row.innerText().catch(() => ""));
      if (!rowMatchesTask(text, task)) {
        continue;
      }

      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.click({ timeout: 5000 });
      await pageWait(page, 250);
      return true;
    }
  }
  return false;
}

async function claimTaskIfAvailable(page) {
  const claimSelectors = [
    "button:has-text(\"Claim\")",
    "[role='button']:has-text(\"Claim\")",
    "text=Claim",
  ];
  if (!await anyVisible(page, claimSelectors)) {
    return {
      clicked: false,
      reason: "Claim button was not visible; the task may already be claimed.",
    };
  }

  await clickFirstVisible(page, claimSelectors);
  await pageWait(page, 900);
  return {
    clicked: true,
  };
}

async function openSelectedTaskInApp(page, timeoutMs) {
  const context = page.context();
  const beforeUrl = page.url();
  const beforePages = context.pages().filter((candidate) => !candidate.isClosed());
  const directOpenSelectors = [
    "button:has-text(\"Open in App\")",
    "[role='button']:has-text(\"Open in App\")",
  ];
  const actionMenuButtonSelectors = [
    "button[id*='responseOptionsButtonMenu'][id$='-arrowButton']",
    "[id*='responseOptionsButtonMenu'] button[aria-label='Open Menu']",
    "button[title='Open Menu'][aria-haspopup='menu']",
    "button[aria-label='Open Menu'][aria-haspopup='menu']",
  ];
  const openInAppMenuItemSelectors = [
    "li.sapMMenuItem:has-text(\"Open in App\")",
    "[role='menuitem']:has-text(\"Open in App\")",
    ".sapMMenuItemText:text-is(\"Open in App\")",
    "li.sapMMenuItem:has-text(\"Open\")",
    "[role='menuitem']:has-text(\"Open\")",
  ];

  if (await anyVisible(page, directOpenSelectors)) {
    await clickFirstVisible(page, directOpenSelectors);
  } else {
    await waitForAny(page, actionMenuButtonSelectors, timeoutMs);
    await clickFirstVisible(page, actionMenuButtonSelectors);
    await waitForAny(page, openInAppMenuItemSelectors, Math.min(timeoutMs, 12000));
    await clickFirstVisible(page, openInAppMenuItemSelectors);
  }

  const opened = await waitForOpenInAppTarget(page, beforePages, beforeUrl, timeoutMs);
  await opened.appPage.waitForLoadState("domcontentloaded", { timeout: Math.min(timeoutMs, 20000) }).catch(() => {});
  await waitForOpenInAppReady(opened.appPage, timeoutMs);

  return {
    ...opened,
    summary: {
      openedIn: opened.openedIn,
      finalUrl: opened.appPage.url(),
      title: await safeTitle(opened.appPage),
    },
  };
}

async function waitForOpenInAppTarget(page, beforePages, beforeUrl, timeoutMs) {
  const context = page.context();
  const startedAt = Date.now();
  while (Date.now() - startedAt < Math.min(timeoutMs, 30000)) {
    const livePages = context.pages().filter((candidate) => !candidate.isClosed());
    const popup = livePages.find((candidate) => {
      if (candidate === page) {
        return false;
      }
      return !beforePages.includes(candidate) || candidate.url() !== "about:blank";
    });

    if (popup) {
      return {
        appPage: popup,
        openedIn: "popup",
      };
    }

    if (page.url() !== beforeUrl || await isPotentialOpenInAppSurface(page)) {
      return {
        appPage: page,
        openedIn: page.url() !== beforeUrl ? "same_page_navigation" : "same_page",
      };
    }

    await pageWait(page, 250);
  }

  throw new Error("Open in App 后没有检测到 ticket 页面。");
}

async function waitForOpenInAppReady(page, timeoutMs) {
  const ready = await waitFor(async () => {
    const bodyText = await readAllBodyText(page);
    const lowered = bodyText.toLowerCase();
    const textLength = normalizeText(bodyText).length;
    return textLength > 120 && (
      lowered.includes("provide feedback") ||
      lowered.includes("review main ticket resolution") ||
      lowered.includes("review sub-ticket resolution") ||
      lowered.includes("po number") ||
      lowered.includes("working number") ||
      lowered.includes("object status") ||
      lowered.includes("request")
    );
  }, Math.max(timeoutMs, 60000), 500).then(() => true).catch(() => false);

  if (!ready) {
    const debug = await collectPageDebug(page);
    throw new Error(`Open in App 页面已打开，但没有识别到 ticket 明细内容。Debug: ${JSON.stringify(debug)}`);
  }
  await pageWait(page, 500);
}

async function readTicketDetail(page, task, timeoutMs) {
  await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeoutMs, 20000) }).catch(() => {});
  const text = await collectTicketDetailText(page);
  const fields = extractTicketFieldsFromText(text, task);
  return {
    fields,
    rawTextSnippet: normalizeText(text).slice(0, 1000),
  };
}

async function collectTicketDetailText(page) {
  const textParts = [];
  const initialText = await readAllBodyText(page);
  appendUniqueText(textParts, initialText);

  const detailSectionLabels = [
    "PO Information",
    "Customer Information",
    "Product Information",
    "Release",
    "Unrelease",
    "Information",
  ];

  for (const label of detailSectionLabels) {
    const clicked = await clickFirstVisibleText(page, label);
    if (!clicked) {
      continue;
    }
    await pageWait(page, 700);
    appendUniqueText(textParts, await readAllBodyText(page));
  }

  return textParts.join("\n");
}

function appendUniqueText(textParts, text) {
  const normalized = normalizeText(text);
  if (normalized && !textParts.includes(normalized)) {
    textParts.push(normalized);
  }
}

async function restoreTaskCenter(page, openInApp, taskCenterUrl, timeoutMs) {
  if (openInApp?.openedIn === "popup") {
    if (openInApp.appPage && openInApp.appPage !== page) {
      await openInApp.appPage.close().catch(() => {});
    }
    await page.bringToFront().catch(() => {});
    await waitForTaskCenterReady(page, Math.min(timeoutMs, 15000)).catch(() => {});
    return;
  }

  if (page.url().includes("taskcenter-display")) {
    if (!isTaskCenterDetailUrl(page.url())) {
      await waitForTaskCenterReady(page, Math.min(timeoutMs, 15000)).catch(() => {});
      return;
    }
  }

  await page.goBack({ waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 15000) }).catch(async () => {
    await page.goto(taskCenterUrl, { waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 15000) }).catch(() => {});
  });
  await waitForTaskCenterReady(page, Math.min(timeoutMs, 20000));
}

async function recoverTaskCenter(page, taskCenterUrl, timeoutMs) {
  for (const candidate of page.context().pages()) {
    if (candidate !== page && !candidate.isClosed()) {
      await candidate.close().catch(() => {});
    }
  }

  if (!page.url().includes("taskcenter-display") || isTaskCenterDetailUrl(page.url())) {
    await page.goto(taskCenterUrl, { waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 20000) }).catch(() => {});
  }
  await waitForTaskCenterReady(page, Math.min(timeoutMs, 20000)).catch(() => {});
}

async function scrollTaskCenterRows(page) {
  let scrolled = false;
  for (const target of listTargets(page)) {
    const changed = await target.evaluate(() => {
      const candidates = [
        ...document.querySelectorAll("[id*='inboxTable'] .sapMList, [id*='inboxTable'] .sapMListUl, .sapMPageEnableScrolling, .sapUiTableCCnt, .sapUiTableVSb"),
        document.scrollingElement,
      ].filter(Boolean);

      for (const element of candidates) {
        const before = element.scrollTop || 0;
        const maxScroll = Math.max(0, (element.scrollHeight || 0) - (element.clientHeight || 0));
        if (maxScroll <= before) {
          continue;
        }
        element.scrollTop = Math.min(maxScroll, before + Math.max(240, Math.floor((element.clientHeight || 400) * 0.8)));
        if ((element.scrollTop || 0) !== before) {
          return true;
        }
      }

      window.scrollBy(0, Math.max(240, Math.floor(window.innerHeight * 0.8)));
      return true;
    }).catch(() => false);
    scrolled = scrolled || changed;
  }
  return scrolled;
}

async function readAllBodyText(page) {
  const textParts = [];
  for (const target of listTargets(page)) {
    const text = await target.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    const normalized = normalizeText(text);
    if (normalized && !textParts.includes(normalized)) {
      textParts.push(normalized);
    }
  }
  return textParts.join("\n");
}

async function clickFirstVisibleText(page, label) {
  for (const target of listTargets(page)) {
    const candidates = [
      target.getByText(label, { exact: true }).first(),
      target.locator(`[aria-label="${cssEscape(label)}"]`).first(),
      target.locator(`[title="${cssEscape(label)}"]`).first(),
    ];

    for (const candidate of candidates) {
      if (!await candidate.isVisible().catch(() => false)) {
        continue;
      }
      await candidate.scrollIntoViewIfNeeded().catch(() => {});
      await candidate.click({ timeout: 5000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function isPotentialOpenInAppSurface(page) {
  if (page.isClosed?.()) {
    return false;
  }
  const url = page.url() || "";
  if (
    url.includes("WorkflowTask-DisplayMyInbox") ||
    url.includes("detail_deep")
  ) {
    return true;
  }
  if (url.includes("taskcenter-display")) {
    return false;
  }
  if (url && !url.includes("taskcenter-display")) {
    return true;
  }

  const bodyText = await readAllBodyText(page).catch(() => "");
  const lowered = bodyText.toLowerCase();
  return lowered.includes("my inbox");
}

async function isTaskCenterSurfaceReady(page) {
  if (!page.url().includes("taskcenter-display")) {
    return false;
  }

  const bodyText = await readAllBodyText(page).catch(() => "");
  const lowered = normalizeComparable(bodyText);
  return (
    lowered.includes("task center") &&
    lowered.includes("task type") &&
    lowered.includes("go")
  );
}

function collectOwnerRowWarnings(row) {
  const warnings = [];
  if (!row["Case Number"]) {
    warnings.push("Case Number 为空");
  }
  if (!row["PO Number"]) {
    warnings.push("PO Number 为空");
  }
  if (!row["Working Number"]) {
    warnings.push("Working Number 为空");
  }
  if (!row.Request) {
    warnings.push("Request 为空");
  }
  return warnings;
}

function collectMissingRequiredOwnerFields(row) {
  return [
    "Case Number",
    "Task Type",
    "Request",
    "PO Number",
    "Working Number",
  ].filter((field) => !normalizeText(row?.[field]));
}

function rowMatchesTask(text, task) {
  const normalizedText = normalizeText(text);
  if (normalizedText === normalizeText(task.text)) {
    return true;
  }

  const checks = [
    task.caseNumber,
    task.taskType,
    task.request,
  ].map(normalizeText).filter(Boolean);

  return checks.length > 0 && checks.every((value) => normalizedText.includes(value));
}

function buildTaskKey(task) {
  return [
    task.caseNumber,
    task.taskType,
    task.request,
    task.poNumber,
    normalizeText(task.text).slice(0, 120),
  ].map(normalizeText).join("|");
}

function isTaskCenterDetailUrl(url) {
  const normalizedUrl = String(url || "");
  return (
    normalizedUrl.includes("#taskcenter-display") &&
    (
      normalizedUrl.includes("/detail/") ||
      normalizedUrl.includes("TwoColumns")
    )
  );
}

function summarizeTask(task) {
  return [
    task.caseNumber || "Case Number 未识别",
    task.taskType || "Task Type 未识别",
    task.request || "Request 未识别",
  ].join(" / ");
}

function isExcludedTaskType(value) {
  return normalizeComparable(value).includes(EXCLUDED_TASK_TYPE.toLowerCase());
}

function isSelectAllOption(value) {
  const normalized = normalizeComparable(value);
  return normalized === "select all" || normalized === "all" || normalized.includes("全选");
}

function taskTypePopupSelectors() {
  return [
    "#application-taskcenter-display-component---worklist--taskDefinitionFilter-popup-list-listUl",
    "[id$='taskDefinitionFilter-popup-list-listUl']",
    "ul[role='listbox'][aria-multiselectable='true'].sapMListUl",
    "li.sapMMultiComboBoxItem[role='option']",
  ];
}

function listTargets(page) {
  return [page, ...page.frames().filter((frame) => frame !== page.mainFrame())];
}

async function anyVisible(page, selectors) {
  return Boolean(await firstVisibleTarget(page, selectors));
}

async function firstVisibleTarget(page, selectors) {
  for (const target of listTargets(page)) {
    for (const selector of selectors) {
      const locator = target.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return {
          target,
          selector,
          locator,
        };
      }
    }
  }
  return null;
}

async function clickFirstVisible(page, selectors) {
  const found = await firstVisibleTarget(page, selectors);
  if (!found) {
    throw new Error(`没有找到可点击元素：${selectors.join(", ")}`);
  }
  await found.locator.click();
}

async function waitForAny(page, selectors, timeoutMs) {
  await waitFor(async () => await anyVisible(page, selectors), timeoutMs, 250);
}

async function waitFor(predicate, timeoutMs, intervalMs) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await predicate()) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await pageWait(null, intervalMs);
  }
  throw lastError || new Error(`Timed out after ${timeoutMs}ms.`);
}

async function pageWait(page, ms) {
  if (page?.waitForTimeout) {
    await page.waitForTimeout(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeTitle(page) {
  return await page.title().catch(() => "");
}

async function collectPageDebug(page) {
  return {
    url: page.url(),
    title: await safeTitle(page),
    bodyTextSnippet: normalizeText(await readAllBodyText(page).catch(() => "")).slice(0, 600),
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function cssEscape(value) {
  return String(value || "").replace(/["\\]/g, "\\$&");
}
