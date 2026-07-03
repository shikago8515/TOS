import {
  createTaskCenterRequestRecorder,
  extractTaskCenterTasksFromRequestRecords,
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
import {
  buildTicketOwnerRowsFromTaskCenterTasks,
  lookupTicketOwnerFields,
} from "./odata-lookups.mjs";
import {
  parseTaskListCountText,
  readTaskListCounts,
} from "./task-center-list.mjs";
import {
  emitDetailProgress,
  estimateTicketProgress,
  reportTicketOwnerProgress,
  showTicketOwnerProgress,
} from "./progress-overlay.mjs";
import {
  applyTicketOwnerExcelLookups,
  enrichTicketOwnerRowsWithExcelLookups,
} from "./excel-lookups.mjs";

const TASK_CENTER_TILE_SELECTORS = [
  "#__tile32",
  "a[href*='taskcenter-display']",
  "text=/^Task Center$/",
];

const TASK_CENTER_INBOX_HASH = "taskcenter-display?sap-ui-app-id-hint=saas_approuter_com.sap.bpm.tc.inbox&/";

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

const DEFAULT_DETAIL_CONCURRENCY = 3;
const DEFAULT_DETAIL_PAGE_TIMEOUT_MS = 18000;

export async function collectTicketOwnerStatistics(page, options = {}) {
  page.__tosTicketOwnerProgressOverlayEnabled = options.showBrowserProgressOverlay !== false;
  const timeoutMs = Number(options.navigationTimeoutMs || 45000);
  const maxTicketCount = normalizePositiveInteger(options.maxTicketCount, 200);
  const excelLookups = options.excelLookups || null;
  const maxAttemptCount = normalizePositiveInteger(
    options.maxTicketAttemptCount,
    Math.max(maxTicketCount * 8, 25)
  );
  const requestFirst = options.requestFirst !== false;
  const requestRecorder = requestFirst
    ? createTaskCenterRequestRecorder(page, {
        maxRecords: options.diagnoseOnly ? 320 : 180,
      })
    : null;

  let requestDiagnostics = null;
  try {
    await reportTicketOwnerProgress(page, options, {
      phase: "opening",
      message: "正在打开 SAP Task Center",
      percent: 6,
    });
    await openTaskCenter(page, timeoutMs);
    await reportTicketOwnerProgress(page, options, {
      phase: "filtering",
      message: "正在筛选任务类型",
      percent: 10,
    });
    const selectedTaskTypes = await configureTicketOwnerTaskTypeFilter(page, timeoutMs);
    await reportTicketOwnerProgress(page, options, {
      phase: "queue",
      message: "正在读取工单列表",
      percent: 16,
    });
    await pageWait(page, 1200);
    const taskListCounts = await readTaskListCounts(page);
    if (requestFirst && taskListCounts.filteredCount > 0) {
      await reportTicketOwnerProgress(page, options, {
        phase: "queue",
        message: `筛选后共有 ${taskListCounts.filteredCount} 个工单，正在补充读取列表请求`,
        percent: 17,
        filteredTotalCount: taskListCounts.filteredCount,
        taskCenterTotalCount: taskListCounts.totalCount,
      });
      await hydrateTaskCenterTaskRequests(page, requestRecorder, {
        targetCount: taskListCounts.filteredCount,
        maxAttemptCount,
      });
    }

    const requestRows = requestFirst
      ? extractCompleteRowsFromRequestRecords(requestRecorder.records, maxTicketCount)
      : [];
    const requestCandidates = requestFirst
      ? extractTicketOwnerRowsFromRequestRecords(requestRecorder.records)
      : [];
    const taskCenterTasks = requestFirst
      ? extractTaskCenterTasksFromRequestRecords(requestRecorder.records)
      : [];
    const expectedTicketCount = estimateExpectedTicketCount(taskCenterTasks, maxTicketCount);
    const appSourceDiagnostics = options.diagnoseOnly && options.diagnoseAppSources
      ? await inspectBusinessAppSources(page)
      : [];
    const odataLookup = requestFirst && !options.diagnoseSkipODataLookup
      ? await buildTicketOwnerRowsFromTaskCenterTasks(page, taskCenterTasks, {
        maxTicketCount,
        maxTaskLookupCount: maxAttemptCount,
        expectedTicketCount,
        filteredTotalCount: taskListCounts.filteredCount,
        taskCenterTotalCount: taskListCounts.totalCount,
        requestLookupConcurrency: options.requestLookupConcurrency,
        reportProgress: async (progress) => {
          await reportTicketOwnerProgress(page, options, progress);
        },
        workflowTaskOnly: options.diagnoseWorkflowTaskOnly === true,
      })
      : null;

    let uiLinkDiagnostics = [];
    if (options.diagnoseOnly && options.diagnoseOpenUiLinks) {
      uiLinkDiagnostics = await inspectTaskUiLinks(page, requestRecorder.records, options, timeoutMs);
    }

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
        odataLookup,
        uiLinkDiagnostics,
        appSourceDiagnostics,
        requestCandidates: requestCandidates.slice(0, 30),
        finalTaskCenterUrl: page.url(),
        message: `诊断模式已捕获 ${requestDiagnostics.recordCount} 条相关请求，识别 ${requestDiagnostics.candidateCount} 个候选 ticket。`,
      };
    }

    if (options.detailFirst !== true && odataLookup?.rows?.length > 0) {
      await reportTicketOwnerProgress(page, options, {
        phase: "export",
        message: "正在生成 Excel",
        percent: 96,
        totalCount: Math.min(expectedTicketCount, odataLookup.rows.length + odataLookup.failedTickets.length),
        completedCount: odataLookup.rows.length,
        successCount: odataLookup.rows.length,
        failedCount: odataLookup.failedTickets.length,
        attemptedCount: odataLookup.rows.length + odataLookup.failedTickets.length,
      });
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        rowCount: odataLookup.rows.length,
        failedTicketCount: odataLookup.failedTickets.length,
        attemptedTicketCount: odataLookup.rows.length + odataLookup.failedTickets.length,
        selectedTaskTypes,
        rows: enrichTicketOwnerRowsWithExcelLookups(odataLookup.rows, excelLookups),
        ticketResults: odataLookup.ticketResults,
        failedTickets: odataLookup.failedTickets,
        requestFirst: requestDiagnostics,
        odataLookup,
        detailFirst: null,
        excelLookup: excelLookups?.summary || null,
        finalTaskCenterUrl: page.url(),
        message: `已通过 Task Center + OData 请求生成 ${odataLookup.rows.length} 条 Ticket ownership 记录。`,
      };
    }

    const detailFirstCollection = options.detailFirst !== false
      ? await collectTicketOwnerRowsFromDetailPages(page, taskCenterTasks, {
        ...options,
        maxTicketCount,
        maxAttemptCount,
        sampleAcrossBranches: options.sampleAcrossBranches === true,
        timeoutMs,
        excelLookups,
      })
      : null;

    if (detailFirstCollection?.rows?.length > 0) {
      await reportTicketOwnerProgress(page, options, {
        phase: "export",
        message: "正在生成 Excel",
        percent: 96,
        totalCount: Math.min(maxTicketCount, detailFirstCollection.rows.length),
        completedCount: detailFirstCollection.rows.length,
        successCount: detailFirstCollection.rows.length,
        failedCount: 0,
        attemptedCount: detailFirstCollection.attemptedTicketCount,
        diagnosticFailedCount: detailFirstCollection.failedTickets.length,
      });
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        rowCount: detailFirstCollection.rows.length,
        failedTicketCount: 0,
        attemptedTicketCount: detailFirstCollection.attemptedTicketCount,
        selectedTaskTypes,
        rows: detailFirstCollection.rows,
        ticketResults: detailFirstCollection.ticketResults,
        failedTickets: [],
        requestFirst: requestDiagnostics,
        odataLookup,
        detailFirst: detailFirstCollection,
        excelLookup: excelLookups?.summary || null,
        finalTaskCenterUrl: page.url(),
        message: `已按 ticket 详情页 A/B/C 规则生成 ${detailFirstCollection.rows.length} 条 Ticket ownership 记录。`,
      };
    }

    if (odataLookup?.rows?.length > 0) {
      await reportTicketOwnerProgress(page, options, {
        phase: "export",
        message: "正在生成 Excel",
        percent: 96,
        totalCount: Math.min(maxTicketCount, odataLookup.rows.length + odataLookup.failedTickets.length),
        completedCount: odataLookup.rows.length,
        successCount: odataLookup.rows.length,
        failedCount: odataLookup.failedTickets.length,
        attemptedCount: odataLookup.rows.length + odataLookup.failedTickets.length,
        diagnosticFailedCount: detailFirstCollection?.failedTickets?.length || 0,
      });
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        rowCount: odataLookup.rows.length,
        failedTicketCount: odataLookup.failedTickets.length,
        attemptedTicketCount: odataLookup.rows.length + odataLookup.failedTickets.length,
        selectedTaskTypes,
        rows: enrichTicketOwnerRowsWithExcelLookups(odataLookup.rows, excelLookups),
        ticketResults: odataLookup.ticketResults,
        failedTickets: odataLookup.failedTickets,
        requestFirst: requestDiagnostics,
        odataLookup,
        detailFirst: detailFirstCollection,
        excelLookup: excelLookups?.summary || null,
        finalTaskCenterUrl: page.url(),
        message: `已通过 Task Center + OData 请求生成 ${odataLookup.rows.length} 条 Ticket ownership 记录。`,
      };
    }

    if (requestRows.length > 0) {
      await reportTicketOwnerProgress(page, options, {
        phase: "export",
        message: "正在生成 Excel",
        percent: 96,
        totalCount: maxTicketCount,
        completedCount: requestRows.length,
        successCount: requestRows.length,
        failedCount: 0,
      });
      requestDiagnostics = requestRecorder.summarize();
      return {
        ok: true,
        rowCount: requestRows.length,
        failedTicketCount: 0,
        attemptedTicketCount: requestRows.length,
        selectedTaskTypes,
        rows: enrichTicketOwnerRowsWithExcelLookups(requestRows, excelLookups),
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
        excelLookup: excelLookups?.summary || null,
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
        await showTicketOwnerProgress(
          page,
          `正在打开第 ${processedKeys.size} 个工单`,
          estimateTicketProgress(rows.length, maxTicketCount)
        );
        const selected = await focusTaskRow(page, nextTask);
        if (!selected) {
          throw new Error(`没有找到可点击的 Task Center 行：${summarizeTask(nextTask)}`);
        }

        await showTicketOwnerProgress(
          page,
          "正在认领并打开详情页",
          estimateTicketProgress(rows.length, maxTicketCount) + 2
        );
        const claim = await claimTaskIfAvailable(page);
        const openInApp = await openSelectedTaskInApp(page, timeoutMs);
        if (openInApp?.appPage) {
          openInApp.appPage.__tosTicketOwnerProgressOverlayEnabled = options.showBrowserProgressOverlay !== false;
        }
        await showTicketOwnerProgress(
          openInApp.appPage,
          "正在采集 A/B/C 字段",
          estimateTicketProgress(rows.length, maxTicketCount) + 4
        );
        const detail = await readTicketDetail(openInApp.appPage, nextTask, timeoutMs, openInApp.detailFrame);
        const resolved = await resolveOwnerRowFromDetailPage(openInApp.appPage, nextTask, detail, { excelLookups });
        const ownerRow = resolved.row;
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
        await showTicketOwnerProgress(
          page,
          `已完成 ${rows.length} 条，正在继续下一条`,
          estimateTicketProgress(rows.length, maxTicketCount)
        );
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
          lookupAttempts: resolved.lookup?.attempts || [],
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
      await showTicketOwnerProgress(
        page,
        rows.length > 0
          ? "正在生成 Excel"
          : "没有采集到可导出的 ticket，正在整理诊断信息...",
        96
      );

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
      excelLookup: excelLookups?.summary || null,
      finalTaskCenterUrl: page.url(),
      message: rows.length > 0
        ? `已生成 ${rows.length} 条 Ticket ownership 记录。`
        : failedTickets.length > 0
          ? `已尝试 ${failedTickets.length} 条 ticket，但都缺少生成 Ticket ownership 所需的关键字段。`
          : "没有采集到可生成 Ticket ownership 的 ticket。",
    };
  } catch (error) {
    await reportTicketOwnerProgress(page, options, {
      phase: "failed",
      message: `自动化已停止：${error?.message || "Task Center 采集失败"}`,
      percent: 100,
    }).catch(() => {});
    throw error;
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

async function inspectTaskUiLinks(page, records, options, timeoutMs) {
  const maxLinks = normalizePositiveInteger(options.diagnoseUiLinkCount, 3);
  const tasks = pickDiagnosticUiLinkTasks(
    extractTaskCenterTasksFromRequestRecords(records)
      .filter((task) => task.uiLink && isTicketOwnerCandidate(task)),
    maxLinks
  );
  const inspected = [];

  for (const task of tasks) {
    const appPage = await page.context().newPage();
    try {
      await appPage.goto(task.uiLink, {
        waitUntil: "domcontentloaded",
        timeout: Math.max(timeoutMs, 60000),
      });
      await showTicketOwnerProgress(
        appPage,
        `正在诊断 Ticket 详情页 ${task.caseNumber || ""}`.trim(),
        18,
        {
          phase: "diagnose-detail-page",
          currentTickets: [task.caseNumber].filter(Boolean),
        }
      );
      await appPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await pageWait(appPage, Number(options.diagnoseUiLinkWaitMs || 2500));
      const sectionClicks = await clickDiagnosticSections(appPage);

      inspected.push({
        ok: true,
        caseNumber: task.caseNumber,
        taskType: task.taskType,
        status: task.status,
        uiLink: task.uiLink,
        finalUrl: appPage.url(),
        title: await safeTitle(appPage),
        sectionClicks,
        bodyTextSnippet: normalizeText(await readAllBodyText(appPage).catch(() => "")).slice(0, 1200),
      });
    } catch (error) {
      inspected.push({
        ok: false,
        caseNumber: task.caseNumber,
        taskType: task.taskType,
        status: task.status,
        uiLink: task.uiLink,
        finalUrl: appPage.url(),
        title: await safeTitle(appPage),
        message: error?.message || "uiLink diagnostic failed",
      });
    } finally {
      await appPage.close().catch(() => {});
      await page.bringToFront().catch(() => {});
    }
  }

  return inspected;
}

function pickDiagnosticUiLinkTasks(tasks, maxLinks) {
  const picked = [];
  const preferred = [
    "provide feedback",
    "review main ticket resolution",
    "review sub-ticket resolution",
  ];

  for (const taskType of preferred) {
    const task = tasks.find((item) => normalizeComparable(item.taskType).includes(taskType));
    if (task && !picked.includes(task)) {
      picked.push(task);
    }
    if (picked.length >= maxLinks) {
      return picked;
    }
  }

  for (const task of tasks) {
    if (!picked.includes(task)) {
      picked.push(task);
    }
    if (picked.length >= maxLinks) {
      break;
    }
  }

  return picked;
}

async function clickDiagnosticSections(page) {
  const labels = [
    "Release",
    "Unrelease",
    "Factory Price",
    "PO Information",
    "Customer Information",
    "Product Information",
    "Information",
  ];
  const results = [];

  for (const label of labels) {
    const clicked = await clickFirstVisibleText(page, label);
    if (clicked) {
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await pageWait(page, 800);
    }
    results.push({ label, clicked });
  }

  return results;
}

async function inspectBusinessAppSources(page) {
  const appRoots = [
    "/zscpoadecfs.comadidasproductsupplyzscpoadecfs/",
    "/zscmnggtstkfs.comadidasproductsupplyzscmnggtstkfs/",
  ];
  const sourceFiles = [
    "Component-preload.js",
    "Component.js",
    "manifest.json",
  ];
  const needles = [
    "workingNumber",
    "_RequestID",
    "RequestID",
    "userTaskId",
    "currentStepCode",
    "getCurrentTaskSettings",
    "currentTaskSettings",
    "startupParameters",
    "CustomAttribute",
    "customAttributes",
    "PurchaseOrders",
    "PurchaseOrderItems",
    "ProcessRequests_Head",
    "ProcessRequests_Items",
    "ProcessRequests_Details_AggregationTree",
    "MainAndSubProcessRequestItems",
    "DetailsWithSingleItem",
    "read(",
    ".bind",
    "bindList",
  ];
  const diagnostics = [];

  for (const root of appRoots) {
    for (const file of sourceFiles) {
      const path = `${root}${file}`;
      const source = await fetchTextFromPage(page, path);
      diagnostics.push({
        path,
        ok: source.ok,
        status: source.status,
        length: source.text.length,
        error: source.error || "",
        hits: collectSourceHits(source.text, needles),
      });
    }
  }

  return diagnostics;
}

async function fetchTextFromPage(page, path) {
  return page.evaluate(async (path) => {
    const url = new URL(path, window.location.origin);
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "text/javascript, application/javascript, application/json, text/plain, */*",
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text: text.slice(0, 1200000),
    };
  }, path).catch((error) => ({
    ok: false,
    status: 0,
    text: "",
    error: error?.message || "fetch failed",
  }));
}

function collectSourceHits(source, needles) {
  const text = String(source || "");
  const hits = [];
  for (const needle of needles) {
    let index = text.indexOf(needle);
    let count = 0;
    while (index >= 0 && count < 5) {
      hits.push({
        needle,
        index,
        snippet: normalizeText(text.slice(Math.max(0, index - 360), index + 780)),
      });
      index = text.indexOf(needle, index + needle.length);
      count += 1;
    }
  }
  return hits;
}

async function openTaskCenter(page, timeoutMs) {
  if (page.url().includes("taskcenter-display")) {
    if (isTaskCenterDetailUrl(page.url())) {
      return false;
    }
    await normalizeTaskCenterInboxRoute(page, timeoutMs);
    await waitForTaskCenterReady(page, timeoutMs);
    return;
  }

  await waitForAny(page, TASK_CENTER_TILE_SELECTORS, timeoutMs);
  const clicked = await clickTaskCenterTile(page);
  if (!clicked) {
    const targetUrl = buildTaskCenterUrl(page.url());
    if (targetUrl) {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 20000) });
    } else {
      await clickFirstVisible(page, TASK_CENTER_TILE_SELECTORS);
    }
  }
  await waitFor(async () => {
    return page.url().includes("taskcenter-display") || await anyVisible(page, TASK_CENTER_READY_SELECTORS);
  }, timeoutMs, 250);
  await waitForTaskCenterReady(page, timeoutMs);
}

function buildTaskCenterUrl(currentUrl) {
  try {
    const url = new URL(currentUrl);
    if (!url.origin || !url.pathname.includes("/site")) {
      return "";
    }
    url.searchParams.delete("sap-ushell-config");
    url.hash = TASK_CENTER_INBOX_HASH;
    return normalizeTaskCenterUrl(url.toString());
  } catch (_error) {
    return "";
  }
}

async function normalizeTaskCenterInboxRoute(page, timeoutMs) {
  const currentUrl = page.url();
  const parsedUrl = parseUrl(currentUrl);
  const normalizedUrl = normalizeTaskCenterUrl(currentUrl);
  if (
    !currentUrl.includes("taskcenter-display") ||
    isTaskCenterDetailUrl(currentUrl) ||
    (
      currentUrl.includes("&/") &&
      currentUrl === normalizedUrl &&
      parsedUrl?.searchParams?.get("sap-ushell-config") !== "lean"
    )
  ) {
    return false;
  }

  const targetUrl = buildTaskCenterUrl(currentUrl);
  if (!targetUrl || targetUrl === currentUrl) {
    return false;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: Math.min(timeoutMs, 20000),
  });
  await pageWait(page, 1200);
  return true;
}

function normalizeTaskCenterUrl(value) {
  return String(value || "").replace(/&\/(?:&\/)+/g, "&/");
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
}

async function clickTaskCenterTile(page) {
  for (const target of listTargets(page)) {
    const clicked = await target.evaluate(() => {
      const isTosOverlay = (element) => Boolean(element?.closest?.(
        "#tos-ticket-owner-progress, #tos-browser-automation-status-badge, [data-tos-ticket-owner-progress='true']"
      ));
      const textOf = (element) => String(element?.innerText || element?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const candidates = [
        ...document.querySelectorAll("#__tile32, a[href*='taskcenter-display'], [role='button'], .sapMGT, .sapMGenericTile"),
      ];
      const tile = candidates.find((element) => {
        if (!element || isTosOverlay(element)) {
          return false;
        }
        const text = textOf(element);
        return /\bTask Center\b/i.test(text);
      });
      if (!tile) {
        return false;
      }
      tile.scrollIntoView({ block: "center", inline: "center" });
      tile.click();
      return true;
    }).catch(() => false);
    if (clicked) {
      return true;
    }
  }
  return false;
}

async function waitForTaskCenterReady(page, timeoutMs) {
  await normalizeTaskCenterInboxRoute(page, timeoutMs).catch(() => false);

  const ready = await waitFor(async () => {
    return (
      await anyVisible(page, TASK_CENTER_READY_SELECTORS) ||
      await isTaskCenterSurfaceReady(page)
    );
  }, Math.max(45000, Math.min(Number(timeoutMs) || 45000, 90000)), 500)
    .then(() => true)
    .catch(() => false);

  if (ready) {
    await pageWait(page, 400);
    return;
  }

  const debug = await collectPageDebug(page);
  if (isTaskCenterShellOnly(debug)) {
    const recovered = await recoverTaskCenterReadyFromShell(page, timeoutMs);

    if (recovered) {
      await pageWait(page, 600);
      return;
    }
    const finalDebug = await collectPageDebug(page).catch(() => debug);
    throw new Error(`Task Center 页面长时间停留在 SAP 外壳，没有加载出工单列表，无法开始采集。Debug: ${JSON.stringify(finalDebug)}`);
  }
  throw new Error(`Task Center 页面没有就绪，无法开始采集。Debug: ${JSON.stringify(debug)}`);
}

async function recoverTaskCenterReadyFromShell(page, timeoutMs) {
  const targetUrl = buildTaskCenterUrl(page.url());
  const attempts = [
    async () => {
      if (!targetUrl) return false;
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: Math.min(timeoutMs, 20000),
      }).catch(() => {});
      return true;
    },
    async () => {
      await page.reload({
        waitUntil: "domcontentloaded",
        timeout: Math.min(timeoutMs, 20000),
      }).catch(() => {});
      return true;
    },
    async () => {
      if (!targetUrl) return false;
      await page.goto(targetUrl, {
        waitUntil: "load",
        timeout: Math.min(timeoutMs, 30000),
      }).catch(() => {});
      return true;
    },
  ];

  for (const attempt of attempts) {
    await attempt();
    await pageWait(page, 1500);
    const recovered = await waitFor(async () => {
      return (
        await anyVisible(page, TASK_CENTER_READY_SELECTORS) ||
        await isTaskCenterSurfaceReady(page)
      );
    }, 60000, 500)
      .then(() => true)
      .catch(() => false);
    if (recovered) {
      return true;
    }
  }
  return false;
}

function isTaskCenterShellOnly(debug) {
  const url = String(debug?.url || "");
  const title = normalizeComparable(debug?.title || "");
  const bodyText = normalizeText(debug?.bodyTextSnippet || "");
  const comparableBody = normalizeComparable(bodyText);
  if (!url.includes("taskcenter-display") || !title.includes("task center")) {
    return false;
  }
  if (!comparableBody.includes("task center")) {
    return false;
  }
  return !(
    comparableBody.includes("task type") ||
    comparableBody.includes("adapt filters") ||
    comparableBody.includes("claim") ||
    comparableBody.includes("release") ||
    /\bTasks\s*\(/i.test(bodyText)
  );
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
      const taskTypeFromFirstColumn = extractTaskTypeFromTaskCell(cells[0]);
      const task = {
        ...extracted,
        taskType: taskTypeFromFirstColumn || extracted.taskType,
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


async function hydrateTaskCenterTaskRequests(page, requestRecorder, options = {}) {
  if (!requestRecorder?.records) {
    return;
  }

  const targetCount = normalizePositiveInteger(options.targetCount, 0);
  const maxAttemptCount = normalizePositiveInteger(options.maxAttemptCount, 200);
  const desiredCount = targetCount > 0 ? Math.min(targetCount, maxAttemptCount) : maxAttemptCount;
  let stableRounds = 0;
  let lastCount = extractTaskCenterTasksFromRequestRecords(requestRecorder.records).length;

  for (let round = 0; round < 10 && lastCount < desiredCount && stableRounds < 3; round += 1) {
    const changed = await scrollTaskCenterRows(page);
    await pageWait(page, changed ? 850 : 450);
    const currentCount = extractTaskCenterTasksFromRequestRecords(requestRecorder.records).length;
    if (currentCount <= lastCount) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }
    lastCount = currentCount;
  }
}

async function collectTicketOwnerRowsFromDetailPages(page, taskCenterTasks, options = {}) {
  const maxTicketCount = normalizePositiveInteger(options.maxTicketCount, 200);
  const maxAttemptCount = normalizePositiveInteger(options.maxAttemptCount, Math.max(maxTicketCount * 8, 25));
  const timeoutMs = Number(options.detailPageTimeoutMs || DEFAULT_DETAIL_PAGE_TIMEOUT_MS);
  const concurrency = Math.min(
    DEFAULT_DETAIL_CONCURRENCY,
    normalizePositiveInteger(options.detailConcurrency, DEFAULT_DETAIL_CONCURRENCY)
  );
  const rows = [];
  const ticketResults = [];
  const failedTickets = [];
  const processedKeys = new Set();
  const queue = buildDetailTaskQueue(taskCenterTasks, {
    sampleAcrossBranches: options.sampleAcrossBranches === true,
  }).slice(0, maxAttemptCount);
  const plannedCount = Math.max(1, Math.min(maxTicketCount, queue.length || maxTicketCount));
  const progressState = {
    totalCount: plannedCount,
    completedCount: 0,
    successCount: 0,
    failedCount: 0,
    attemptedCount: 0,
    diagnosticFailedCount: 0,
    active: new Map(),
  };
  let nextIndex = 0;

  await emitDetailProgress(page, options, progressState, "正在准备详情页队列", 18);

  async function worker(workerIndex) {
    while (rows.length < maxTicketCount && processedKeys.size < maxAttemptCount) {
      const task = queue[nextIndex];
      nextIndex += 1;
      if (!task) {
        return;
      }

      const taskKey = buildTaskKey(task);
      if (processedKeys.has(taskKey)) {
        continue;
      }
      processedKeys.add(taskKey);
      progressState.attemptedCount = processedKeys.size;

      const displayName = task.caseNumber || task.subject || `worker-${workerIndex + 1}`;
      progressState.active.set(taskKey, displayName);
      await emitDetailProgress(page, options, progressState, `正在打开第 ${processedKeys.size} 个工单详情`, estimateTicketProgress(progressState.completedCount, plannedCount));

      const result = await processTicketOwnerDetailTask(page, task, {
        ...options,
        taskKey,
        timeoutMs,
        progressState,
      });

      progressState.active.delete(taskKey);

      if (result.ok) {
        if (rows.length < maxTicketCount) {
          rows.push(result.ownerRow);
          ticketResults.push(result.ticketResult);
        }
      } else {
        failedTickets.push(result.failedTicket);
      }
      progressState.completedCount = rows.length;
      progressState.successCount = rows.length;
      progressState.failedCount = 0;
      progressState.diagnosticFailedCount = failedTickets.length;

      await emitDetailProgress(
        page,
        options,
        progressState,
        rows.length >= maxTicketCount ? "已达到目标数量，正在整理结果" : "当前工单已处理，继续下一条",
        estimateTicketProgress(progressState.completedCount, plannedCount)
      );
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, queue.length || 1));
  await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));

  return {
    rows,
    ticketResults,
    failedTickets,
    attemptedTicketCount: processedKeys.size,
  };
}

function estimateExpectedTicketCount(taskCenterTasks, maxTicketCount) {
  const supportedCount = (Array.isArray(taskCenterTasks) ? taskCenterTasks : [])
    .filter((task) => isTicketOwnerCandidate(task))
    .length;
  const fallback = normalizePositiveInteger(maxTicketCount, 200);
  return Math.max(1, Math.min(fallback, supportedCount || fallback));
}

async function processTicketOwnerDetailTask(taskCenterPage, task, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_DETAIL_PAGE_TIMEOUT_MS);
  const taskKey = options.taskKey || buildTaskKey(task);
  let taskPage = null;
  let openInApp = null;
  let claim = { clicked: false, reason: "Task was opened from Task Center uiLink." };

  try {
    if (!task.uiLink) {
      throw new Error(`Task Center API 没有提供可打开的详情链接：${summarizeTask(task)}`);
    }

    taskPage = await openTaskCenterTaskLink(taskCenterPage, task.uiLink, timeoutMs);
    taskPage.__tosTicketOwnerProgressOverlayEnabled = options.showBrowserProgressOverlay !== false;
    await showTicketOwnerProgress(
      taskPage,
      formatProgressMessage("正在认领并打开详情页", options.progressState),
      estimateTicketProgress(options.progressState?.completedCount || 0, options.progressState?.totalCount || 1) + 2,
      progressDetailsFromState(options.progressState)
    );
    claim = await claimTaskIfAvailable(taskPage);
    openInApp = await openSelectedTaskInApp(taskPage, timeoutMs);
    if (openInApp?.appPage) {
      openInApp.appPage.__tosTicketOwnerProgressOverlayEnabled = options.showBrowserProgressOverlay !== false;
    }
    await showTicketOwnerProgress(
      openInApp.appPage,
      formatProgressMessage("正在采集 A/B/C 字段", options.progressState),
      estimateTicketProgress(options.progressState?.completedCount || 0, options.progressState?.totalCount || 1) + 4,
      progressDetailsFromState(options.progressState)
    );

    const detail = await readTicketDetail(openInApp.appPage, task, timeoutMs, openInApp.detailFrame);
    const resolved = await resolveOwnerRowFromDetailPage(openInApp.appPage, task, detail, {
      excelLookups: options.excelLookups || null,
    });
    const ownerRow = resolved.row;
    const missingRequiredFields = collectMissingRequiredOwnerFields(ownerRow);

    if (ownerRow.branchId === "UNKNOWN") {
      throw new Error(`当前 ticket 详情页不属于 PPT 中 A/B/C 三类：${summarizeTask(task)}`);
    }
    if (missingRequiredFields.length > 0) {
      throw new Error(
        `ticket 明细缺少关键字段：${missingRequiredFields.join(", ")}。` +
        `当前页面片段：${detail.rawTextSnippet.slice(0, 500)}`
      );
    }

    return {
      ok: true,
      ownerRow,
      ticketResult: {
        ok: true,
        detailFirst: true,
        taskKey,
        branchId: ownerRow.branchId,
        caseNumber: ownerRow["Case Number"],
        taskType: ownerRow["Task Type"],
        request: ownerRow.Request,
        poNumber: ownerRow["PO Number"],
        workingNumber: ownerRow["Working Number"],
        source: resolved.lookup?.source || "ticket-detail-page",
        warnings: ownerRow.warnings || [],
        claim,
        openInApp: openInApp.summary,
        detailTextSnippet: detail.rawTextSnippet,
        lookupAttempts: resolved.lookup?.attempts || [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      failedTicket: {
        ok: false,
        detailFirst: true,
        taskKey,
        caseNumber: task.caseNumber,
        taskType: task.taskType,
        request: task.request,
        message: error?.message || "ticket 详情页采集失败。",
      },
    };
  } finally {
    await closeDetailPages(taskCenterPage, taskPage, openInApp);
  }
}

function buildDetailTaskQueue(taskCenterTasks, options = {}) {
  const candidates = (Array.isArray(taskCenterTasks) ? taskCenterTasks : [])
    .filter((task) => task.uiLink && isTicketOwnerCandidate(task));
  if (options.sampleAcrossBranches !== true) {
    return candidates;
  }

  const buckets = new Map([
    ["provide feedback", []],
    ["review main ticket resolution", []],
    ["review sub-ticket resolution", []],
    ["other", []],
  ]);
  for (const task of candidates) {
    const taskType = normalizeComparable(task.taskType || task.subject || "");
    const key = taskType.includes("provide feedback")
      ? "provide feedback"
      : taskType.includes("review main ticket resolution")
        ? "review main ticket resolution"
        : taskType.includes("review sub-ticket resolution")
          ? "review sub-ticket resolution"
          : "other";
    buckets.get(key).push(task);
  }

  const balanced = [];
  let added = true;
  while (added) {
    added = false;
    for (const bucket of buckets.values()) {
      const task = bucket.shift();
      if (task) {
        balanced.push(task);
        added = true;
      }
    }
  }
  return balanced;
}

async function openTaskCenterTaskLink(page, uiLink, timeoutMs) {
  const taskPage = await page.context().newPage();
  await taskPage.goto(uiLink, {
    waitUntil: "domcontentloaded",
    timeout: Math.min(Math.max(timeoutMs, 12000), 30000),
  });
  await waitForTaskInboxDetailReady(taskPage, timeoutMs);
  return taskPage;
}

async function resolveOwnerRowFromDetailPage(page, task, detail, options = {}) {
  let fields = { ...(detail.fields || {}) };
  let row = resolveTicketOwnerRow(task, fields);
  let excelLookup = applyTicketOwnerExcelLookups({
    task,
    fields,
    row,
    lookups: options.excelLookups || null,
  });
  if (excelLookup.changed) {
    fields = excelLookup.fields;
    row = resolveTicketOwnerRow(task, fields);
  }
  let lookup = null;
  if (!row["PO Number"] || !row["Working Number"]) {
    lookup = await lookupTicketOwnerFields(page, task, fields);
    fields = {
      ...fields,
      poNumber: fields.poNumber || lookup.poNumber || "",
      workingNumber: fields.workingNumber || lookup.workingNumber || "",
      releaseLookupWorkingNumber: fields.releaseLookupWorkingNumber || lookup.workingNumber || "",
    };
    row = resolveTicketOwnerRow(task, fields);
    excelLookup = applyTicketOwnerExcelLookups({
      task,
      fields,
      row,
      lookups: options.excelLookups || null,
    });
    if (excelLookup.changed) {
      fields = excelLookup.fields;
      row = resolveTicketOwnerRow(task, fields);
    }
  }
  const excelAttempts = excelLookup.attempts || [];
  if (excelAttempts.length > 0) {
    lookup = {
      ...(lookup || {}),
      source: excelLookup.source || lookup?.source || "excel-lookups",
      attempts: [
        ...excelAttempts,
        ...(lookup?.attempts || []),
      ],
    };
  }
  row.warnings = collectOwnerRowWarnings(row);
  return { row, fields, lookup };
}

async function closeDetailPages(taskCenterPage, taskPage, openInApp) {
  const pages = new Set();
  if (openInApp?.appPage && openInApp.appPage !== taskCenterPage) {
    pages.add(openInApp.appPage);
  }
  if (taskPage && taskPage !== taskCenterPage) {
    pages.add(taskPage);
  }
  for (const page of pages) {
    await page.close().catch(() => {});
  }
}

async function collectRowCells(row) {
  let cells = row.locator(":scope > [role='gridcell'], :scope > td, :scope > th");
  let count = await cells.count().catch(() => 0);
  if (count === 0) {
    cells = row.locator("[role='gridcell'], td, .sapMListTblCell, .sapMText, .sapMObjectIdentifierTitle, .sapMObjectAttributeText");
    count = await cells.count().catch(() => 0);
  }
  const values = [];
  for (let index = 0; index < Math.min(count, 24); index += 1) {
    const text = normalizeText(await cells.nth(index).innerText().catch(() => ""));
    if (text && !values.includes(text)) {
      values.push(text);
    }
  }
  return values;
}

function extractTaskTypeFromTaskCell(value) {
  const normalized = normalizeComparable(value);
  if (normalized.includes("provide feedback")) {
    return "Provide Feedback";
  }
  if (normalized.includes("review main ticket resolution")) {
    return "Review Main Ticket Resolution";
  }
  if (normalized.includes("review sub-ticket resolution")) {
    return "Review Sub-Ticket Resolution";
  }
  return "";
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
  const detailFrame = opened.detailFrame || await waitForBusinessDetailReady(opened.appPage, timeoutMs);

  return {
    ...opened,
    detailFrame,
    summary: {
      openedIn: opened.openedIn,
      finalUrl: opened.appPage.url(),
      title: await safeTitle(opened.appPage),
      frameUrl: typeof detailFrame?.url === "function" ? detailFrame.url() : "",
    },
  };
}

async function waitForOpenInAppTarget(page, beforePages, beforeUrl, timeoutMs) {
  const context = page.context();
  const startedAt = Date.now();
  while (Date.now() - startedAt < Math.min(Math.max(timeoutMs, 12000), 25000)) {
    const livePages = context.pages().filter((candidate) => !candidate.isClosed());
    for (const candidate of livePages) {
      const detailFrame = await findTicketBusinessFrame(candidate);
      if (detailFrame) {
        return {
          appPage: candidate,
          detailFrame,
          openedIn: candidate === page
            ? (page.url() !== beforeUrl ? "same_page_navigation" : "same_page")
            : "popup",
        };
      }
    }

    if (page.url() !== beforeUrl && await isPotentialOpenInAppSurface(page)) {
      return {
        appPage: page,
        openedIn: "same_page_navigation",
      };
    }

    await pageWait(page, 250);
  }

  throw new Error("Open in App 后没有检测到 ticket 页面。");
}

async function waitForTaskInboxDetailReady(page, timeoutMs) {
  const waitMs = Math.min(Math.max(timeoutMs, 12000), 25000);
  const ready = await waitFor(async () => await anyVisible(page, [
    "#application-taskcenter-display-component---detail--openTaskButton",
    "button:has-text(\"Open in App\")",
    "[role='button']:has-text(\"Open in App\")",
    "button:has-text(\"Claim\")",
    "button:has-text(\"Release\")",
  ]), waitMs, 350).then(() => true).catch(() => false);

  if (!ready) {
    const debug = await collectPageDebug(page);
    throw new Error(`Task Center ticket detail did not become ready. Debug: ${JSON.stringify(debug)}`);
  }
  await pageWait(page, 500);
}

async function waitForBusinessDetailReady(page, timeoutMs) {
  let detailFrame = null;
  const waitMs = Math.min(Math.max(timeoutMs, 12000), 30000);
  const ready = await waitFor(async () => {
    detailFrame = await findTicketBusinessFrame(page);
    return Boolean(detailFrame);
  }, waitMs, 350).then(() => true).catch(() => false);

  if (!ready || !detailFrame) {
    const debug = await collectPageDebug(page);
    throw new Error(`Open in App did not expose a ticket business detail frame. Debug: ${JSON.stringify(debug)}`);
  }
  await pageWait(page, 500);
  return detailFrame;
}

async function findTicketBusinessFrame(page) {
  for (const target of listTargets(page)) {
    const detected = await target.evaluate(() => {
      const textOf = (element) => String(element?.innerText || element?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const bodyText = textOf(document.body);
      if (!bodyText) {
        return false;
      }

      const hasProvideFeedbackObjectPage = Boolean(document.getElementById("__component1---ObjectPage"))
        && /Provide Feedback|PO Information|Working No#|BTP Ticket Number/i.test(bodyText);
      const hasReviewTicketPoDetails = Boolean(
        document.querySelector("[id*='smartTable.PODetails'], [id*='section.PODetails']")
      ) && /Review (Main|Sub)-Ticket Resolution|PO Details|PO \/ Contract No#/i.test(bodyText);

      return hasProvideFeedbackObjectPage || hasReviewTicketPoDetails;
    }).catch(() => false);

    if (detected) {
      return target;
    }
  }
  return null;
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

async function readTicketDetail(page, task, timeoutMs, detailFrame = null) {
  await page.waitForLoadState("domcontentloaded", { timeout: Math.min(timeoutMs, 20000) }).catch(() => {});
  const targetFrame = detailFrame || await waitForBusinessDetailReady(page, timeoutMs);
  await expandTicketDetailSections(targetFrame);
  const structured = await waitForStructuredTicketFields(targetFrame, task, timeoutMs);
  const text = await collectTicketDetailText(page, targetFrame);
  const textFields = extractTicketFieldsFromText(text, task);
  const fields = mergeTicketFields(textFields, structured.fields);
  return {
    fields,
    detailKind: structured.kind,
    rawTextSnippet: normalizeText(text).slice(0, 1000),
  };
}

async function waitForStructuredTicketFields(targetFrame, task, timeoutMs) {
  let latest = await extractTicketFieldsFromBusinessFrame(targetFrame, task);
  const startedAt = Date.now();
  const waitMs = Math.min(Math.max(Number(timeoutMs || 0), 12000), 30000);

  while (!isStructuredTicketFieldsReady(latest, task) && Date.now() - startedAt < waitMs) {
    await pageWait(targetFrame, 500);
    await expandTicketDetailSections(targetFrame);
    latest = await extractTicketFieldsFromBusinessFrame(targetFrame, task);
  }

  return latest;
}

function isStructuredTicketFieldsReady(structured, task) {
  const fields = structured?.fields || {};
  const taskType = normalizeComparable(fields.taskType || task?.taskType);
  if (taskType.includes("provide feedback")) {
    return Boolean(
      normalizeText(fields.caseNumber) &&
      normalizeText(fields.request) &&
      normalizeText(fields.poNumber) &&
      normalizeText(fields.workingNumber)
    );
  }

  if (
    taskType.includes("review main ticket resolution") ||
    taskType.includes("review sub-ticket resolution")
  ) {
    return Boolean(
      normalizeText(fields.caseNumber) &&
      normalizeText(fields.request) &&
      normalizeText(fields.poNumber)
    );
  }

  return Boolean(
    normalizeText(fields.caseNumber) ||
    normalizeText(fields.poNumber) ||
    normalizeText(fields.workingNumber)
  );
}

async function collectTicketDetailText(page, detailFrame = null) {
  const textParts = [];
  const initialText = detailFrame
    ? await detailFrame.locator("body").innerText({ timeout: 3000 }).catch(() => "")
    : await readAllBodyText(page);
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
    const clicked = detailFrame
      ? await clickFirstVisibleTextInTarget(detailFrame, label)
      : await clickFirstVisibleText(page, label);
    if (!clicked) {
      continue;
    }
    await pageWait(page, 700);
    const nextText = detailFrame
      ? await detailFrame.locator("body").innerText({ timeout: 3000 }).catch(() => "")
      : await readAllBodyText(page);
    appendUniqueText(textParts, nextText);
  }

  return textParts.join("\n");
}

async function expandTicketDetailSections(target) {
  const showMoreSelectors = [
    "[id$='--seeMore']:has-text(\"Show More\")",
    "[id*='PODetails--seeMore']:has-text(\"Show More\")",
    "button:has-text(\"Show More\")",
  ];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let clicked = false;
    for (const selector of showMoreSelectors) {
      const button = target.locator(selector).first();
      if (!await button.isVisible().catch(() => false)) {
        continue;
      }
      await button.scrollIntoViewIfNeeded().catch(() => {});
      await button.click({ timeout: 5000 }).catch(() => {});
      clicked = true;
      break;
    }
    if (!clicked) {
      return;
    }
    await pageWait(target, 700);
  }
}

async function extractTicketFieldsFromBusinessFrame(target, task) {
  const extracted = await target.evaluate(() => {
    const normalize = (value) => String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cleanValue = (value) => {
      const normalized = normalize(value);
      return /^(?:-|–)?\s*Empty Value$/i.test(normalized) ? "" : normalized;
    };
    const textOf = (element) => cleanValue(element?.innerText || element?.textContent || element?.value || "");
    const firstTextByIdSuffix = (root, suffix) => {
      const selector = `[id$="${suffix.replace(/["\\]/g, "\\$&")}"]`;
      return textOf(root.querySelector(selector));
    };
    const extractAfterLabel = (source, label, nextLabels = []) => {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedNext = nextLabels.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const boundary = escapedNext.length > 0
        ? `(?=\\s+(?:${escapedNext.join("|")})\\b|$)`
        : "(?=$)";
      const match = source.match(new RegExp(`${escapedLabel}\\s*:?\\s*(.+?)${boundary}`, "i"));
      return cleanValue(match?.[1] || "");
    };
    const poRegex = /\b(?:0\d{8,11}|[1-9]\d{8,11})\b/;
    const workingRegex = /\bRC[A-Z0-9]{6,}\b/i;
    const firstPo = (value) => normalize(value).match(poRegex)?.[0] || "";
    const firstWorking = (value) => normalize(value).match(workingRegex)?.[0] || "";
    const readDomTextById = (id) => textOf(document.getElementById(id));
    const readControlValue = (id, contextFieldNames = []) => {
      const core = window.sap?.ui?.getCore?.();
      const control = core?.byId?.(id);
      if (control) {
        for (const method of ["getValue", "getText", "getSelectedKey"]) {
          try {
            const value = typeof control[method] === "function" ? cleanValue(control[method]()) : "";
            if (value) {
              return value;
            }
          } catch {}
        }

        try {
          const innerControls = typeof control.getInnerControls === "function" ? control.getInnerControls() : [];
          for (const innerControl of innerControls || []) {
            for (const method of ["getValue", "getText", "getSelectedKey"]) {
              try {
                const value = typeof innerControl?.[method] === "function" ? cleanValue(innerControl[method]()) : "";
                if (value) {
                  return value;
                }
              } catch {}
            }
          }
        } catch {}

        try {
          const contextObject = control.getBindingContext?.()?.getObject?.();
          for (const fieldName of contextFieldNames) {
            const value = cleanValue(contextObject?.[fieldName]);
            if (value) {
              return value;
            }
          }
        } catch {}
      }

      return readDomTextById(`${id}-text`) || readDomTextById(id);
    };
    const requestTypeLabels = {
      EHSH: "Early/Hold Shipment",
      TMC: "Transport Mode Change",
      MOT: "Transport Mode Change",
    };
    const objectPage = document.getElementById("__component1---ObjectPage");

    if (objectPage) {
      const objectText = textOf(objectPage);
      const requestContext = window.sap?.ui?.getCore?.()
        ?.byId?.("__component1---ObjectPage--btpTicketNumberSmartField")
        ?.getBindingContext?.()
        ?.getObject?.();
      const requestTypeCode = cleanValue(requestContext?.requestTypeCode).toUpperCase();
      return {
        kind: "provide-feedback-object-page",
        fields: {
          caseNumber: readControlValue("__component1---ObjectPage--btpTicketNumberSmartField", [
            "BTPTicketNumber",
          ]),
          taskType: readDomTextById("__title0-inner")
            || (objectText.includes("Provide Feedback") ? "Provide Feedback" : ""),
          request: readDomTextById("__component1---ObjectPage--titleExpandedHeading-inner")
            || readDomTextById("__component1---ObjectPage--titleSnappedHeading-inner")
            || requestTypeLabels[requestTypeCode]
            || cleanValue(requestContext?.requestCategoryLabel)
            || cleanValue(requestContext?.RequestReasonLabel),
          poNumber: readControlValue("__component1---ObjectPage--purchaseOrderNumberSmartField", [
            "purchaseOrderNumber",
          ]),
          workingNumber: readControlValue("__component1---ObjectPage--workingNumberSmartField", [
            "workingNumber",
          ]),
          factoryCode: readControlValue("__component1---ObjectPage--factoryCodeSmartField", [
            "factoryCode",
          ]),
        },
      };
    }

    const root = document.querySelector("#__component1---App, [id$='--page'], body") || document.body;
    const rootText = textOf(root);
    const poDetails = document.querySelector("[id*='smartTable.PODetails']")
      || document.querySelector("[id*='section.PODetails']");
    const poDetailsText = textOf(poDetails);
    let poNumber = "";
    let workingNumber = "";
    let factoryCode = "";

    if (poDetails) {
      const headers = [...poDetails.querySelectorAll("th, td[role='columnheader'], [role='columnheader']")]
        .map((header) => textOf(header))
        .filter(Boolean);
      const poIndex = headers.findIndex((header) => /PO\s*\/\s*Contract\s*No#?|PO\s*(?:No|Number)#?/i.test(header));
      const workingIndex = headers.findIndex((header) => /Working\s*(?:No|Number)#?/i.test(header));
      const factoryIndex = headers.findIndex((header) => /Factory/i.test(header));
      const rows = [...poDetails.querySelectorAll("tr[role='row'], tr.sapUiTableRow, tr.sapMListTblRow, [role='row']")];

      for (const row of rows) {
        const rowText = textOf(row);
        if (!rowText || /PO \/ Contract No#|Aggregator|Cost Validation/i.test(rowText)) {
          continue;
        }

        const cells = [...row.querySelectorAll("td, [role='gridcell'], .sapMListTblCell")]
          .map((cell) => textOf(cell));
        if (poIndex >= 0 && cells[poIndex]) {
          poNumber = firstPo(cells[poIndex]);
        }
        poNumber = poNumber || firstPo(cells.join(" ")) || firstPo(rowText);
        if (workingIndex >= 0 && cells[workingIndex]) {
          workingNumber = firstWorking(cells[workingIndex]);
        }
        if (factoryIndex >= 0 && cells[factoryIndex]) {
          factoryCode = cleanValue(cells[factoryIndex]);
        }
        workingNumber = workingNumber || firstWorking(rowText);
        if (poNumber || workingNumber) {
          break;
        }
      }

      poNumber = poNumber || firstPo(poDetailsText);
      workingNumber = workingNumber || firstWorking(poDetailsText);
    }

    const taskType = rootText.match(/\bReview Main Ticket Resolution\b/i)?.[0]
      || rootText.match(/\bReview Sub-Ticket Resolution\b/i)?.[0]
      || "";
    const requestLabels = [
      "Request Category",
      "Subject",
      "Description",
      "PO Details",
      "Comments",
      "Related Documents",
      "Main Ticket Tracking",
      "Sub-Ticket Tracking",
    ];

    return {
      kind: "review-ticket-po-details",
      fields: {
        caseNumber: rootText.match(/\bCase Number:?\s*([A-Z0-9-]+)/i)?.[1] || "",
        taskType,
        request: extractAfterLabel(rootText, "Request Area", requestLabels)
          || extractAfterLabel(rootText, "Request Category", requestLabels),
        poNumber,
        workingNumber,
        factoryCode,
      },
    };
  }).catch(() => ({ kind: "unknown", fields: {} }));

  const fields = extracted?.fields || {};
  return {
    kind: extracted?.kind || "unknown",
    fields: {
      caseNumber: fields.caseNumber || "",
      taskType: fields.taskType || task?.taskType || "",
      request: fields.request || "",
      poNumber: fields.poNumber || "",
      workingNumber: fields.workingNumber || "",
      factoryCode: fields.factoryCode || "",
      factory: fields.factory || fields.factoryCode || "",
      rawTextSnippet: "",
    },
  };
}

function mergeTicketFields(baseFields, preferredFields) {
  const merged = { ...(baseFields || {}) };
  for (const [key, value] of Object.entries(preferredFields || {})) {
    const normalized = normalizeText(value);
    if (normalized) {
      merged[key] = normalized;
    }
  }
  return merged;
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
    const text = await target.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      const clone = body.cloneNode(true);
      clone.querySelectorAll([
        "#tos-ticket-owner-progress",
        "#tos-browser-automation-status-badge",
        "[data-tos-ticket-owner-progress='true']",
        "[data-tos-browser-automation-badge='true']",
        "[data-tos-progress-message]",
        "[data-tos-progress-meta]",
      ].join(",")).forEach((element) => element.remove());
      return clone.innerText || clone.textContent || "";
    }).catch(() => "");
    const normalized = normalizeText(text);
    if (normalized && !textParts.includes(normalized)) {
      textParts.push(normalized);
    }
  }
  return textParts.join("\n");
}

async function clickFirstVisibleTextInTarget(target, label) {
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
  return false;
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
    return Boolean(await findTicketBusinessFrame(page));
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
  const parsedCounts = parseTaskListCountText(bodyText);
  const hasTaskCenterTitle = lowered.includes("task center");
  const hasTaskTable = parsedCounts.filteredCount > 0 ||
    /\bTasks\s*\(\s*\d+\s*(?:[\/／]\s*\d+)?\s*\)/i.test(bodyText);
  const hasTaskTypeColumn = lowered.includes("task type");
  const hasRows = await anyVisible(page, [TASK_ROW_SELECTOR]).catch(() => false);
  const hasAction = lowered.includes("claim") || lowered.includes("release");
  const hasFilterControls = lowered.includes("go") || lowered.includes("adapt filters");
  return hasTaskCenterTitle && (
    hasFilterControls ||
    hasTaskTable ||
    hasRows ||
    hasAction ||
    hasTaskTypeColumn
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
  if (!row.Factory) {
    warnings.push("Factory 为空");
  }
  if (!row.Merch) {
    warnings.push("Merch 为空");
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
