const PO_HEADER_ALIASES = new Set([
  "po",
  "pono",
  "po#",
  "ponumber",
  "purchaseorder",
  "purchaseorderno",
  "purchaseordernumber",
]);

const UPDATE_VALUE_ALIASES = new Set([
  "releasedqty",
  "releasedquantity",
  "releaseqty",
  "releasequantity",
  "qty",
  "quantity",
  "status",
  "releasedstatus",
]);

const RELEASED_BULK_EXCLUDED_UPDATE_HEADERS = new Set([
  "itemkey",
  "pono",
  "workingno",
  "hashcode",
  "linehashcode",
  "mainitemid",
  "activityinfo",
  "modifyrivision",
  "rawinfo",
  "writablecells",
  "rowsuffix",
]);

const RELEASED_BULK_DELAY_DROPDOWN_HEADERS = new Set([
  "delaypopsddupdatem",
  "delaypopdupdatem",
]);

const RELEASED_BULK_EXACT_COLUMN_HEADERS = new Map([
  ["delaypopsddupdatem", "Delay - PO PSDD Update (M)"],
  ["delaypopdupdatem", "Delay - PO PD Update (M)"],
  ["supplierconfirmed", "Supplier Confirmed"],
]);

function buildReleasedBulkReminderCopy({
  mode,
  poCount,
  updatedRowCount,
  failedRowCount,
}) {
  if (mode === "failure") {
    return {
      title: "Released Bulk \u90e8\u5206 PO \u672a\u5b8c\u6210",
      body: `\u5df2\u6210\u529f ${updatedRowCount}/${poCount} \u4e2a PO\uff0c\u5931\u8d25 ${failedRowCount} \u4e2a\u3002\u81ea\u52a8\u5316\u672a\u81ea\u52a8\u70b9\u51fb Save\u3002`,
      hint: "\u8bf7\u5148\u68c0\u67e5\u4e0b\u65b9\u5931\u8d25\u660e\u7ec6\u3002\u82e5\u9700\u4fdd\u5b58\uff0c\u8bf7\u81ea\u5df1\u70b9\u51fb\u9875\u9762\u9876\u90e8\u84dd\u8272 Save\uff1b\u4e0d\u4fdd\u5b58\u5219\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u5173\u95ed\u6d4f\u89c8\u5668\u3002",
      closeLabel: "\u5173\u95ed\u6d4f\u89c8\u5668",
      emptyFailureList: "\u672a\u83b7\u53d6\u5230\u5931\u8d25\u660e\u7ec6\u3002",
    };
  }

  return {
    title: "Released Bulk \u5df2\u4fee\u6539\u5b8c\u6210",
    body: `\u5df2\u66f4\u65b0 ${updatedRowCount}/${poCount} \u4e2a PO\u3002\u8bf7\u68c0\u67e5\u9875\u9762\u7ed3\u679c\u540e\u9009\u62e9\u662f\u5426\u4fdd\u5b58\u3002`,
    hint: "\u9700\u8981\u4fdd\u5b58\uff1a\u8bf7\u70b9\u51fb\u9875\u9762\u9876\u90e8\u84dd\u8272 Save\u3002\u70b9\u51fb\u540e\u81ea\u52a8\u5316\u4f1a\u68c0\u6d4b\u5230\u5e76\u5173\u95ed\u6d4f\u89c8\u5668\u3002",
    closeLabel: "\u4e0d\u4fdd\u5b58\uff0c\u5173\u95ed\u6d4f\u89c8\u5668",
    emptyFailureList: "\u672a\u83b7\u53d6\u5230\u5931\u8d25\u660e\u7ec6\u3002",
  };
}

export function createShipping2ReleasedBulkAutomation({
  config,
  log,
  forceClickLocator,
  xlsx,
  assertWorkbookPayload,
  resolveWorksheetName,
}) {
  if (!xlsx || !assertWorkbookPayload || !resolveWorksheetName) {
    throw new Error("Shipping2 Released Bulk automation dependencies are incomplete.");
  }

  function extractShipping2ReleasedBulkRowsFromWorkbookPayload(body) {
    const workbookBuffer = assertWorkbookPayload(body);

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
    const range = worksheet?.["!ref"]
      ? xlsx.utils.decode_range(worksheet["!ref"])
      : null;
    if (!range) {
      const error = new Error("Released Bulk workbook worksheet is empty.");
      error.statusCode = 400;
      throw error;
    }

    const headerRowIndex = findReleasedBulkHeaderRowIndex(worksheet, range);
    if (headerRowIndex < 0) {
      const error = new Error("Released Bulk workbook must contain a PO No column.");
      error.statusCode = 400;
      throw error;
    }

    const headers = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      headers.push(getReleasedWorksheetCellDisplayValue(worksheet, headerRowIndex, columnIndex, ""));
    }

    const poColumnOffset = headers.findIndex((header) => PO_HEADER_ALIASES.has(normalizeHeaderName(header)));
    if (poColumnOffset < 0) {
      const error = new Error("Released Bulk workbook must contain a PO No column.");
      error.statusCode = 400;
      throw error;
    }

    const releasedBulkRows = [];
    const seenPoNumbers = new Set();

    for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
      const values = {};
      let hasAnyValue = false;

      for (let columnOffset = 0; columnOffset < headers.length; columnOffset += 1) {
        const header = String(headers[columnOffset] || "").trim();
        if (!header) {
          continue;
        }
        const columnIndex = range.s.c + columnOffset;
        const value = getReleasedWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, header);
        if (value) {
          hasAnyValue = true;
        }
        values[header] = value;
      }

      if (!hasAnyValue) {
        continue;
      }

      const poHeader = headers[poColumnOffset];
      const poNo = normalizeCellValue(values[poHeader]);
      if (!poNo || PO_HEADER_ALIASES.has(normalizeHeaderName(poNo)) || seenPoNumbers.has(poNo)) {
        continue;
      }

      seenPoNumbers.add(poNo);
      releasedBulkRows.push({
        rowIndex: rowIndex + 1,
        poNo,
        values,
      });
    }

    if (releasedBulkRows.length === 0) {
      const error = new Error("Uploaded workbook must contain at least one Released Bulk PO number.");
      error.statusCode = 400;
      throw error;
    }

    return releasedBulkRows;
  }

  async function processShipping2ReleasedBulkWorksheet(page, releasedBulkRows) {
    const targetRows = Array.isArray(releasedBulkRows)
      ? releasedBulkRows.filter((row) => normalizeCellValue(row?.poNo))
      : [];

    if (targetRows.length === 0) {
      return buildReleasedBulkResult([], {
        attempted: false,
        ok: true,
        message: "\u672a\u63d0\u4f9b Released Bulk \u7684 PO \u6570\u636e\u3002",
      });
    }

    await page.locator("body").waitFor({
      state: "visible",
      timeout: config.navigationTimeoutMs,
    });
    await page.waitForTimeout(Math.min(Number(config.postLoginWaitMs || 0), 1500));

    const poNumbers = targetRows
      .map((row) => String(row?.poNo || "").trim())
      .filter(Boolean);
    await applyShipping2ReleasedBulkPoFilter(page, poNumbers);

    const rowResults = await updateReleasedBulkRowsInPage(page, targetRows);
    const updatedRowCount = rowResults.filter((row) => row.ok).length;
    const failedRowCount = rowResults.filter((row) => !row.ok).length;
    const saveResult = failedRowCount > 0
      ? await waitForReleasedBulkFailureDecision(page, {
        poCount: targetRows.length,
        updatedRowCount,
        failedRowCount,
        rowResults,
      })
      : await waitForReleasedBulkSaveDecision(page, {
        poCount: targetRows.length,
        updatedRowCount,
      });

    return buildReleasedBulkResult(rowResults, saveResult, poNumbers);
  }

  function formatReleasedBulkSaveDecisionMessage(saveResult) {
    const decision = String(saveResult?.decision || "");
    const reason = String(saveResult?.reason || "");

    if (!saveResult?.attempted) {
      return saveResult?.message || "\u672a\u6267\u884c\u4fdd\u5b58\u64cd\u4f5c\u3002";
    }
    if (reason === "row-update-failed") {
      if (decision === "saved-by-user") {
        return "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u4f60\u5df2\u70b9\u51fb Save\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
      }
      if (decision === "close-after-failure" || decision === "close-without-save") {
        return "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u4f60\u9009\u62e9\u4e0d\u4fdd\u5b58\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
      }
      return "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u5728\u8d85\u65f6\u524d\u672a\u6536\u5230\u5904\u7406\u51b3\u5b9a\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
    }
    if (decision === "saved-by-user") {
      return "\u4f60\u5df2\u70b9\u51fb Save\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
    }
    if (decision === "close-without-save") {
      return "\u4f60\u9009\u62e9\u4e0d\u4fdd\u5b58\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
    }
    if (decision === "timeout") {
      return "\u5728\u8d85\u65f6\u524d\u672a\u6536\u5230\u4fdd\u5b58\u51b3\u5b9a\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002";
    }

    return saveResult.ok
      ? saveResult.message || "\u5de5\u4f5c\u8868\u4fdd\u5b58\u5df2\u5b8c\u6210\u3002"
      : saveResult.message || "\u5de5\u4f5c\u8868\u4fdd\u5b58\u5931\u8d25\u3002";
  }

  async function waitForReleasedBulkSaveDecision(page, summary) {
    const decisionKey = `tosReleasedBulkSaveDecision:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const timeoutMs = 30 * 60 * 1000;
    const reminderCopy = buildReleasedBulkReminderCopy({
      mode: "success",
      poCount: Number(summary?.poCount || 0),
      updatedRowCount: Number(summary?.updatedRowCount || 0),
      failedRowCount: 0,
    });

    await injectReleasedBulkSaveReminder(page, {
      decisionKey,
      mode: "success",
      reminderCopy,
      failures: [],
    });

    const decision = await waitForReleasedBulkDecision(page, decisionKey, timeoutMs, "timeout");
    if (decision?.decision === "saved-by-user") {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
    }
    await removeReleasedBulkSaveReminder(page, decisionKey);

    const result = {
      attempted: true,
      ok: decision?.decision === "saved-by-user",
      saved: decision?.decision === "saved-by-user",
      decision: decision?.decision || "unknown",
      decidedAt: decision?.at || "",
      message: decision?.decision === "saved-by-user"
        ? "\u4f60\u5df2\u70b9\u51fb Save\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002"
        : decision?.decision === "close-without-save"
          ? "\u4f60\u9009\u62e9\u4e0d\u4fdd\u5b58\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002"
          : "\u5728\u8d85\u65f6\u524d\u672a\u6536\u5230\u4fdd\u5b58\u51b3\u5b9a\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002",
    };
    log?.("Released Bulk user save decision received.", result);
    return result;
  }

  async function waitForReleasedBulkFailureDecision(page, summary) {
    const decisionKey = `tosReleasedBulkFailureDecision:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const timeoutMs = 30 * 60 * 1000;
    const failures = summarizeReleasedBulkFailures(summary?.rowResults || []);
    const reminderCopy = buildReleasedBulkReminderCopy({
      mode: "failure",
      poCount: Number(summary?.poCount || 0),
      updatedRowCount: Number(summary?.updatedRowCount || 0),
      failedRowCount: Number(summary?.failedRowCount || 0),
    });

    await injectReleasedBulkSaveReminder(page, {
      decisionKey,
      mode: "failure",
      reminderCopy,
      failures,
    });

    const decision = await waitForReleasedBulkDecision(page, decisionKey, timeoutMs, "timeout-after-failure");
    if (decision?.decision === "saved-by-user") {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
    }
    await removeReleasedBulkSaveReminder(page, decisionKey);

    const result = {
      attempted: true,
      ok: false,
      saved: decision?.decision === "saved-by-user",
      skipped: decision?.decision !== "saved-by-user",
      decision: decision?.decision || "row-update-failed",
      decidedAt: decision?.at || "",
      reason: "row-update-failed",
      message: decision?.decision === "saved-by-user"
        ? "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u4f60\u5df2\u70b9\u51fb Save\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002"
        : decision?.decision === "close-after-failure"
          ? "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u4f60\u9009\u62e9\u4e0d\u4fdd\u5b58\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002"
          : "\u90e8\u5206\u884c\u6216\u5b57\u6bb5\u4fee\u6539\u5931\u8d25\uff1b\u5728\u8d85\u65f6\u524d\u672a\u6536\u5230\u5904\u7406\u51b3\u5b9a\uff0c\u6d4f\u89c8\u5668\u5df2\u5173\u95ed\u3002",
    };
    log?.("Released Bulk failure close decision received.", result);
    return result;
  }

  async function injectReleasedBulkSaveReminder(page, options) {
    await page.evaluate(({ decisionKey, mode, reminderCopy, failures }) => {
      const makePanelDraggable = (panel, handle) => {
        if (!(panel instanceof HTMLElement) || !(handle instanceof HTMLElement)) {
          return;
        }
        let dragging = false;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;
        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
        const beginDrag = (clientX, clientY) => {
          const rect = panel.getBoundingClientRect();
          panel.style.left = `${rect.left}px`;
          panel.style.top = `${rect.top}px`;
          panel.style.right = "auto";
          panel.style.bottom = "auto";
          panel.style.transform = "none";
          pointerOffsetX = clientX - rect.left;
          pointerOffsetY = clientY - rect.top;
          dragging = true;
        };
        const movePanel = (clientX, clientY) => {
          if (!dragging) {
            return;
          }
          const maxLeft = Math.max(window.innerWidth - panel.offsetWidth, 8);
          const maxTop = Math.max(window.innerHeight - panel.offsetHeight, 8);
          panel.style.left = `${clamp(clientX - pointerOffsetX, 8, maxLeft)}px`;
          panel.style.top = `${clamp(clientY - pointerOffsetY, 8, maxTop)}px`;
        };
        const stopDrag = () => {
          dragging = false;
        };

        handle.style.cursor = "move";
        handle.style.userSelect = "none";
        handle.addEventListener("mousedown", (event) => {
          beginDrag(event.clientX, event.clientY);
          event.preventDefault();
        });
        window.addEventListener("mousemove", (event) => movePanel(event.clientX, event.clientY));
        window.addEventListener("mouseup", stopDrag);
      };
      const setDecision = (decision) => {
        localStorage.setItem(decisionKey, JSON.stringify({
          decision,
          at: new Date().toISOString(),
        }));
      };

      document.getElementById("tos-released-bulk-save-reminder")?.remove();
      localStorage.removeItem(decisionKey);

      const panel = document.createElement("div");
      panel.id = "tos-released-bulk-save-reminder";
      panel.setAttribute("data-tos-released-bulk-reminder", "true");
      panel.style.cssText = [
        "position:fixed",
        "top:78px",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "width:560px",
        "max-width:calc(100vw - 32px)",
        "max-height:55vh",
        "overflow:auto",
        "box-sizing:border-box",
        "background:#111827",
        "color:#f9fafb",
        "border:2px solid #2563eb",
        "box-shadow:0 18px 48px rgba(0,0,0,.38)",
        "border-radius:8px",
        "font-family:Arial,Helvetica,sans-serif",
        "padding:14px 16px 12px",
        "line-height:1.45",
        "pointer-events:auto",
      ].join(";");

      const title = document.createElement("div");
      title.style.cssText = "font-size:16px;font-weight:700;margin-bottom:6px;";
      title.textContent = String(reminderCopy?.title || "");

      const body = document.createElement("div");
      body.style.cssText = "font-size:13px;color:#d1d5db;margin-bottom:10px;";
      body.textContent = String(reminderCopy?.body || "");

      const hint = document.createElement("div");
      hint.style.cssText = mode === "failure"
        ? "font-size:13px;color:#fee2e2;background:#7f1d1d;border:1px solid #991b1b;border-radius:6px;padding:8px;margin-bottom:10px;"
        : "font-size:13px;color:#fef3c7;background:#78350f;border:1px solid #92400e;border-radius:6px;padding:8px;margin-bottom:10px;";
      hint.textContent = String(reminderCopy?.hint || "");

      panel.append(title, body, hint);

      if (mode === "failure") {
        const list = document.createElement("div");
        list.style.cssText = "font-size:12px;color:#f9fafb;background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:10px;white-space:pre-wrap;max-height:120px;overflow:auto;";
        const shown = Array.isArray(failures) ? failures.slice(0, 8) : [];
        list.textContent = shown.length
          ? shown.map((item) => `${item.poNo || "-"}: ${item.message || ""}`).join("\n")
          : String(reminderCopy?.emptyFailureList || "");
        panel.append(list);
      }

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.id = "tos-released-bulk-close-without-save";
      closeButton.style.cssText = "width:100%;height:36px;border:0;border-radius:6px;background:#dc2626;color:white;font-weight:700;cursor:pointer;font-size:13px;";
      closeButton.textContent = String(reminderCopy?.closeLabel || "");
      closeButton.addEventListener("click", () => {
        setDecision(mode === "failure" ? "close-after-failure" : "close-without-save");
      });
      panel.append(closeButton);
      document.body.appendChild(panel);
      makePanelDraggable(panel, title);

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (target.closest("#tos-released-bulk-save-reminder")) {
          return;
        }
        const action = target.closest('button, input[type="button"], input[type="submit"], a');
        if (!action) {
          return;
        }
        const text = String(action.textContent || action.value || "").replace(/\s+/g, " ").trim();
        if (/^save$/i.test(text)) {
          setDecision("saved-by-user");
        }
      }, true);
    }, options);
  }

  async function waitForReleasedBulkDecision(page, decisionKey, timeoutMs, timeoutDecision) {
    return page.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      try {
        return JSON.parse(raw);
      } catch {
        return { decision: raw };
      }
    }, decisionKey, { timeout: timeoutMs })
      .then((handle) => handle.jsonValue())
      .catch(() => ({
        decision: timeoutDecision,
        at: new Date().toISOString(),
      }));
  }

  async function removeReleasedBulkSaveReminder(page, decisionKey) {
    await page.evaluate((key) => {
      document.getElementById("tos-released-bulk-save-reminder")?.remove();
      localStorage.removeItem(key);
    }, decisionKey).catch(() => {});
  }

  async function applyShipping2ReleasedBulkPoFilter(page, poNumbers) {
    const normalizedPoNumbers = Array.from(new Set(
      poNumbers.map((poNo) => String(poNo || "").trim()).filter(Boolean),
    ));
    if (normalizedPoNumbers.length === 0) {
      throw new Error("Released Bulk PO filter list is empty.");
    }

    await clickReleasedBulkPoNoFilter(page);
    await fillReleasedBulkPoFilterTextarea(page, normalizedPoNumbers);
    await clickReleasedBulkQueryButton(page);
    await waitForReleasedBulkFilteredRows(page, normalizedPoNumbers);
    log?.("Released Bulk PO filter applied.", {
      poCount: normalizedPoNumbers.length,
    });
  }

  async function clickReleasedBulkPoNoFilter(page) {
    if (await isReleasedBulkFilterTextareaVisible(page, 80)) {
      return;
    }

    const poNoHeader = page
      .locator('.ui_app_spreadsheet_TitleHeaderCell-layout[title="PO No"]')
      .first();
    await poNoHeader.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
    await poNoHeader.scrollIntoViewIfNeeded().catch(() => {});

    const domClicked = await dispatchReleasedBulkPoNoFilterClick(page, poNoHeader);
    if (domClicked && await isReleasedBulkFilterTextareaVisible(page, 260)) {
      log?.("Released Bulk PO No filter opened.", { target: "dom-dispatch-fast" });
      return;
    }

    const clickTargets = [
      {
        locator: poNoHeader.locator(".ows-header-has-active-filter span").first(),
        label: "Released PO No active filter icon span",
      },
      {
        locator: poNoHeader.locator(".ows-header-has-active-filter svg.ows-clickable-svg-icon").first(),
        label: "Released PO No active filter svg",
      },
      {
        locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilterSwitch-layout span").first(),
        label: "Released PO No filter icon span",
      },
      {
        locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilter-layout").first(),
        label: "Released PO No HeaderCellFilter layout",
      },
      {
        locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilterSwitch-layout").first(),
        label: "Released PO No HeaderCellFilter switch",
      },
      {
        locator: poNoHeader.locator("svg.ows-clickable-svg-icon").first(),
        label: "Released PO No filter svg",
      },
    ];

    for (const target of clickTargets) {
      const clicked = await clickReleasedBulkFilterTarget(page, target.locator, target.label);
      if (!clicked) {
        continue;
      }
      if (await isReleasedBulkFilterTextareaVisible(page, 260)) {
        log?.("Released Bulk PO No filter opened.", { target: target.label });
        return;
      }
    }

    await dispatchReleasedBulkPoNoFilterClick(page, poNoHeader);
    if (await isReleasedBulkFilterTextareaVisible(page, 450)) {
      log?.("Released Bulk PO No filter opened.", { target: "dom-dispatch" });
      return;
    }

    throw new Error("Released Bulk PO No filter input did not open after clicking the PO No header filter.");
  }

  async function dispatchReleasedBulkPoNoFilterClick(page, poNoHeader) {
    return poNoHeader.evaluate((header) => {
      const target = header.querySelector(".ows-header-has-active-filter span")
        || header.querySelector(".ows-header-has-active-filter svg.ows-clickable-svg-icon")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilterSwitch-layout span")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilter-layout")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilterSwitch-layout")
        || header.querySelector("svg.ows-clickable-svg-icon");
      if (!target) {
        return false;
      }
      for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
        target.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
      }
      if (typeof target.click === "function") {
        target.click();
      }
      return true;
    }).catch(() => false);
  }

  async function clickReleasedBulkFilterTarget(page, locator, label) {
    const attached = await locator
      .waitFor({ state: "attached", timeout: 120 })
      .then(() => true)
      .catch(() => false);
    if (!attached) {
      return false;
    }
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
      await page.waitForTimeout(40);
      return true;
    }
    if (typeof forceClickLocator === "function") {
      await forceClickLocator(locator, label);
    } else {
      await locator.click({ force: true });
    }
    await page.waitForTimeout(40);
    return true;
  }

  async function isReleasedBulkFilterTextareaVisible(page, timeoutMs = 300) {
    return page.waitForFunction(() => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const popover = Array.from(document.querySelectorAll(".ows-text-filterform-popover, .ows-filter-popover-container"))
        .find((element) => isVisible(element));
      const textarea = Array.from(document.querySelectorAll('textarea.formInput[name="filter_tal_31"], textarea[name^="filter_tal_"].formInput, textarea[name^="filter_tal_"]'))
        .find((element) => isVisible(element));
      return Boolean(popover && textarea);
    }, null, { timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
  }

  async function fillReleasedBulkPoFilterTextarea(page, poNumbers) {
    const ready = await page.waitForFunction(() => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      return Array.from(document.querySelectorAll('textarea.formInput[name="filter_tal_31"], textarea[name^="filter_tal_"].formInput, textarea[name^="filter_tal_"]'))
        .some((element) => isVisible(element));
    }, null, { timeout: config.navigationTimeoutMs })
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      throw new Error("Released Bulk PO No filter input opened but no visible textarea was found.");
    }

    const result = await page.evaluate((values) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const textareas = Array.from(document.querySelectorAll('textarea.formInput[name="filter_tal_31"], textarea[name^="filter_tal_"].formInput, textarea[name^="filter_tal_"]'));
      const textarea = textareas.find((element) => isVisible(element));
      if (!textarea) {
        return { ok: false, reason: "visible-textarea-not-found", textareaCount: textareas.length };
      }

      const value = values.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
      const setNativeValue = (element, nextValue) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
        if (descriptor?.set) {
          descriptor.set.call(element, nextValue);
        } else {
          element.value = nextValue;
        }
        element.setAttribute("value", nextValue);
      };
      textarea.focus();
      if (typeof window.worksheet?.changeActiveTextField === "function") {
        try {
          window.worksheet.changeActiveTextField(textarea);
        } catch {
          // Best-effort only.
        }
      }
      if (typeof window.getWorksheet === "function") {
        try {
          window.getWorksheet()?.changeActiveTextField?.(textarea);
        } catch {
          // Best-effort only.
        }
      }
      setNativeValue(textarea, "");
      textarea.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      setNativeValue(textarea, value);
      textarea.dispatchEvent(new FocusEvent("focus", { bubbles: true, cancelable: true }));
      for (const type of ["input", "change", "keyup"]) {
        textarea.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }
      textarea.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));

      return {
        ok: true,
        name: textarea.getAttribute("name") || "",
        value: textarea.value,
        lineCount: value ? value.split("\n").length : 0,
      };
    }, poNumbers);

    if (!result?.ok) {
      throw new Error(`Released Bulk PO No filter textarea could not be filled. ${JSON.stringify(result || {})}`);
    }
    log?.("Entered Released Bulk PO filter list.", {
      textareaName: result.name,
      poCount: poNumbers.length,
      lineCount: result.lineCount,
      valuePreview: String(result.value || "").split("\n").slice(0, 5),
    });
  }

  async function clickReleasedBulkQueryButton(page) {
    const clicked = await page.evaluate(() => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const button = Array.from(document.querySelectorAll('input.ows-submit-btn[value="Query"], input[type="button"][value="Query"]'))
        .find((element) => isVisible(element));
      if (!button) {
        return false;
      }
      for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
        button.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
      }
      if (typeof button.click === "function") {
        button.click();
      }
      return true;
    });
    if (!clicked) {
      const queryButton = page
        .locator('input.ows-submit-btn[value="Query"], input[type="button"][value="Query"]')
        .first();
      if (typeof forceClickLocator === "function") {
        await forceClickLocator(queryButton, "Released Bulk Query");
      } else {
        await queryButton.click({ force: true });
      }
    }
    log?.("Clicked Released Bulk Query.");
  }

  async function waitForReleasedBulkFilteredRows(page, poNumbers, timeoutMs = config.navigationTimeoutMs) {
    const expectedPoNumbers = poNumbers.map((poNo) => String(poNo || "").trim()).filter(Boolean);
    const startedAt = Date.now();
    let lastFoundCount = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const visiblePoNumbers = await page.evaluate((targets) => {
        const text = document.body?.innerText || "";
        return targets.filter((poNo) => text.includes(poNo));
      }, expectedPoNumbers).catch(() => []);
      lastFoundCount = Array.isArray(visiblePoNumbers) ? visiblePoNumbers.length : 0;
      if (lastFoundCount >= expectedPoNumbers.length) {
        return;
      }
      await page.waitForTimeout(250);
    }

    throw new Error(`Released Bulk Query did not show all requested PO No values. Found ${lastFoundCount}/${expectedPoNumbers.length}.`);
  }

  async function updateReleasedBulkRowsInPage(page, targetRows) {
    const rowResults = [];

    for (const targetRow of targetRows) {
      const poNo = normalizeCellValue(targetRow?.poNo);
      try {
        let plan = await markReleasedBulkRowEditTargets(page, targetRow);
        if (Array.isArray(plan?.missingHeaders) && plan.missingHeaders.length > 0) {
          throw new Error(`Released Bulk row for PO No ${poNo} is missing worksheet columns: ${plan.missingHeaders.join(", ")}.`);
        }
        if (!Array.isArray(plan?.cells) || plan.cells.length === 0) {
          throw new Error(`Released Bulk row for PO No ${poNo} had no matched editable worksheet cells.`);
        }

        const selectionResult = await selectReleasedBulkWorksheetRowByPo(page, poNo);
        await page.waitForTimeout(180);
        plan = await markReleasedBulkRowEditTargets(page, targetRow);
        if (Array.isArray(plan?.missingHeaders) && plan.missingHeaders.length > 0) {
          throw new Error(`Released Bulk row for PO No ${poNo} is missing worksheet columns after row selection: ${plan.missingHeaders.join(", ")}.`);
        }

        const cellResults = [];
        for (const cell of plan.cells) {
          try {
            assertReleasedBulkMatchedColumn(cell);
            if (!shouldForceReleasedBulkDropdownSelection(cell.header)
              && releasedBulkCellValueMatches(cell.currentValue, cell.value)) {
              cellResults.push({
                header: cell.header,
                ok: true,
                value: cell.value,
                method: "already-matched",
              });
              continue;
            }

            const cellLocator = page.locator(`[data-tos-released-bulk-edit="${cell.token}"]`).first();
            const editResult = await editReleasedBulkWorksheetCell(page, cellLocator, cell.value, cell.header);
            await page.waitForTimeout(150);
            const currentValue = await cellLocator.evaluate((element) => {
              const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
              const booleanCell = element.querySelector(".ows-boolean-tri-state-buttonset");
              if (booleanCell) {
                if (booleanCell.querySelector(".true-toggle-button.is-selected")) return "true";
                if (booleanCell.querySelector(".false-toggle-button.is-selected")) return "false";
              }
              const select = element.querySelector("select");
              if (select && select.selectedIndex >= 0) {
                return cleanText(select.options[select.selectedIndex]?.textContent || select.value || "");
              }
              const field = element.querySelector("input.typeText, textarea, input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio'])");
              return cleanText(field?.value || element.innerText || element.textContent || "");
            });
            if (!releasedBulkCellValueMatches(currentValue, cell.value)) {
              throw new Error(`Expected "${cell.value}", current value is "${currentValue}".`);
            }
            cellResults.push({
              header: cell.header,
              ok: true,
              value: cell.value,
              currentValue,
              method: editResult.method,
            });
          } catch (error) {
            cellResults.push({
              header: cell.header,
              ok: false,
              value: cell.value,
              currentValue: cell.currentValue,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const verification = await verifyReleasedBulkRowValues(page, targetRow);

        const failedCellCount = [
          ...cellResults,
          ...(Array.isArray(verification?.cellResults) ? verification.cellResults : []),
        ].filter((item) => !item?.ok).length;

        const ok = cellResults.every((item) => item.ok) && Boolean(verification?.ok) && failedCellCount === 0;
        rowResults.push({
          rowIndex: targetRow?.rowIndex,
          poNo,
          ok,
          changedCellCount: cellResults.filter((item) => item.ok).length,
          failedCellCount,
          selectionResult,
          cellResults,
          verification,
          error: ok ? "" : String(verification?.error || "").trim(),
        });

        log?.("Released Bulk row update checked.", {
          poNo,
          ok,
          changedCellCount: cellResults.filter((item) => item.ok).length,
          failedCellCount,
        });
      } catch (error) {
        rowResults.push({
          rowIndex: targetRow?.rowIndex,
          poNo,
          ok: false,
          changedCellCount: 0,
          failedCellCount: 1,
          cellResults: [],
          verification: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return rowResults;
  }

  async function selectReleasedBulkWorksheetRowByPo(page, poNo) {
    const targetPoNo = normalizeCellValue(poNo);
    if (!targetPoNo) {
      throw new Error("Released Bulk row is missing PO No.");
    }

    const result = await page.evaluate((targetPoNoInPage) => {
      const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
      const normalizeHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const headerLabel = (headerCell) => {
        const fromTitle = cleanText(headerCell?.getAttribute?.("title") || "");
        if (fromTitle) {
          return fromTitle;
        }
        const headerText = headerCell?.querySelector?.(".ui_app_spreadsheet_HeaderText-layout");
        return cleanText(headerText?.innerText || headerText?.textContent || headerCell?.innerText || headerCell?.textContent || "");
      };
      const headerCells = Array.from(document.querySelectorAll(".ui_app_spreadsheet_TitleHeaderCell-layout"));
      const headerMap = new Map();
      headerCells.forEach((cell, index) => {
        const normalized = normalizeHeader(headerLabel(cell));
        if (normalized && !headerMap.has(normalized)) {
          headerMap.set(normalized, index);
        }
      });
      const poColumnIndex = headerMap.get("pono");
      if (poColumnIndex === undefined) {
        return { ok: false, reason: "po-header-not-found" };
      }

      const dataRows = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"));
      let matchedRow = null;
      let matchedRowIndex = -1;
      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
        const row = dataRows[rowIndex];
        const cells = Array.from(row.querySelectorAll(".ui_app_spreadsheet_DataCell-layout"));
        const poCell = cells[poColumnIndex];
        if (poCell && cleanText(poCell.textContent).includes(targetPoNoInPage)) {
          matchedRow = row;
          matchedRowIndex = rowIndex;
          break;
        }
      }
      if (!matchedRow) {
        return { ok: false, reason: "row-not-found", poNo: targetPoNoInPage, dataRowCount: dataRows.length };
      }

      const rowRect = matchedRow.getBoundingClientRect();
      const rowCenterY = rowRect.top + (rowRect.height / 2);
      const candidates = Array.from(document.querySelectorAll(
        'input[type="checkbox"].cellfont.fieldEdit, span.checkbox input[type="checkbox"].fieldEdit',
      )).filter((checkbox) => !checkbox.disabled);
      const visibleCandidates = candidates.filter((checkbox) => isVisible(checkbox));
      const checkbox = visibleCandidates
        .map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            item,
            distance: Math.abs((rect.top + (rect.height / 2)) - rowCenterY),
          };
        })
        .sort((left, right) => left.distance - right.distance)[0]?.item
        || candidates[matchedRowIndex]
        || null;

      if (!checkbox) {
        return {
          ok: false,
          reason: "checkbox-not-found",
          poNo: targetPoNoInPage,
          rowIndex: matchedRowIndex,
          checkboxCount: candidates.length,
          visibleCheckboxCount: visibleCandidates.length,
        };
      }

      const token = `tos-released-bulk-checkbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      checkbox.setAttribute("data-tos-released-bulk-checkbox", token);
      return {
        ok: true,
        token,
        poNo: targetPoNoInPage,
        rowIndex: matchedRowIndex,
        alreadyChecked: Boolean(checkbox.checked),
        checkboxCount: candidates.length,
        visibleCheckboxCount: visibleCandidates.length,
      };
    }, targetPoNo);

    if (!result?.ok) {
      throw new Error(`Released Bulk row checkbox was not found for PO No ${targetPoNo}. ${JSON.stringify(result || {})}`);
    }

    if (!result.alreadyChecked) {
      const checkbox = page.locator(`[data-tos-released-bulk-checkbox="${result.token}"]`).first();
      await checkbox.check({ force: true }).catch(async () => {
        if (typeof forceClickLocator === "function") {
          await forceClickLocator(checkbox, "Released Bulk row checkbox");
          return;
        }
        await checkbox.click({ force: true });
      });
      await page.waitForTimeout(150);
    }

    const checked = await page.evaluate((token) => {
      const checkbox = document.querySelector(`[data-tos-released-bulk-checkbox="${token}"]`);
      return Boolean(checkbox?.checked);
    }, result.token).catch(() => false);
    if (!checked) {
      throw new Error(`Released Bulk row checkbox did not become checked for PO No ${targetPoNo}.`);
    }

    log?.("Selected Released Bulk worksheet row.", {
      poNo: targetPoNo,
      rowIndex: result.rowIndex,
      alreadyChecked: Boolean(result.alreadyChecked),
    });

    return {
      ok: true,
      poNo: targetPoNo,
      rowIndex: result.rowIndex,
      alreadyChecked: Boolean(result.alreadyChecked),
    };
  }

  async function verifyReleasedBulkRowValues(page, targetRow) {
    const poNo = normalizeCellValue(targetRow?.poNo);
    const plan = await markReleasedBulkRowEditTargets(page, targetRow);
    const cellResults = [];

    if (Array.isArray(plan?.missingHeaders) && plan.missingHeaders.length > 0) {
      return {
        ok: false,
        poNo,
        missingHeaders: plan.missingHeaders,
        cellResults: plan.missingHeaders.map((header) => ({
          header,
          ok: false,
          error: `Worksheet column was not matched for "${header}".`,
        })),
      };
    }

    for (const cell of plan.cells || []) {
      try {
        assertReleasedBulkMatchedColumn(cell);
        if (!releasedBulkCellValueMatches(cell.currentValue, cell.value)) {
          throw new Error(`Expected "${cell.value}", current value is "${cell.currentValue}".`);
        }
        cellResults.push({
          header: cell.header,
          ok: true,
          expectedValue: cell.value,
          currentValue: cell.currentValue,
        });
      } catch (error) {
        cellResults.push({
          header: cell.header,
          ok: false,
          expectedValue: cell.value,
          currentValue: cell.currentValue,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      ok: cellResults.every((item) => item.ok),
      poNo,
      missingHeaders: [],
      cellResults,
    };
  }

  async function markReleasedBulkRowEditTargets(page, targetRow) {
    const poNo = normalizeCellValue(targetRow?.poNo);
    const values = targetRow?.values && typeof targetRow.values === "object" ? targetRow.values : {};
    const editableValues = Object.entries(values)
      .filter(([header, value]) => {
        const normalizedHeader = normalizeHeaderName(header);
        return !RELEASED_BULK_EXCLUDED_UPDATE_HEADERS.has(normalizedHeader)
          && value !== undefined
          && value !== null
          && String(value).trim() !== "";
      })
      .map(([header, value]) => ({ header, value: String(value).trim() }));

    if (!poNo) {
      throw new Error("Released Bulk row is missing PO No.");
    }
    if (editableValues.length === 0) {
      return { poNo, cells: [] };
    }

    return page.evaluate(({ targetPoNo, targetValues }) => {
      const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const cellText = (cell) => String(cell?.innerText || cell?.textContent || "").replace(/\s+/g, " ").trim();
      const readCellValue = (cell) => {
        const booleanCell = cell?.querySelector?.(".ows-boolean-tri-state-buttonset");
        if (booleanCell) {
          if (booleanCell.querySelector(".true-toggle-button.is-selected")) return "true";
          if (booleanCell.querySelector(".false-toggle-button.is-selected")) return "false";
        }
        const select = cell?.querySelector?.("select");
        if (select && select.selectedIndex >= 0) {
          const option = select.options[select.selectedIndex];
          const optionText = String(option?.textContent || "").replace(/\s+/g, " ").trim();
          if (optionText) return optionText;
          const optionValue = String(option?.value || "").trim();
          if (optionValue) return optionValue;
        }
        const field = cell?.querySelector?.("input.typeText, textarea, input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio'])");
        const fieldValue = String(field?.value || "").replace(/\s+/g, " ").trim();
        if (fieldValue) return fieldValue;
        return cellText(cell);
      };
      const headerLabel = (headerCell) => {
        const fromTitle = String(headerCell?.getAttribute?.("title") || "").trim();
        if (fromTitle) return fromTitle;
        const headerText = headerCell?.querySelector?.(".ui_app_spreadsheet_HeaderText-layout");
        return cellText(headerText || headerCell);
      };

      const headerCells = Array.from(document.querySelectorAll(".ui_app_spreadsheet_TitleHeaderCell-layout"));
      const headerEntries = headerCells.map((cell, index) => ({
        index,
        label: headerLabel(cell),
        normalized: normalize(headerLabel(cell)),
      }));
      const headerMap = new Map();
      headerEntries.forEach((entry) => {
        if (entry.normalized && !headerMap.has(entry.normalized)) {
          headerMap.set(entry.normalized, entry.index);
        }
      });

      const poColumnIndex = headerMap.get("pono");
      if (poColumnIndex === undefined) {
        throw new Error("Released Bulk PO No column was not found in the worksheet grid.");
      }

      const dataRows = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"));
      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
        const row = dataRows[rowIndex];
        const cells = Array.from(row.querySelectorAll(".ui_app_spreadsheet_DataCell-layout"));
        const poCell = cells[poColumnIndex];
        if (!poCell || !cellText(poCell).includes(targetPoNo)) {
          continue;
        }

        const rowToken = `tos-released-bulk-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        row.setAttribute("data-tos-released-bulk-row", rowToken);
        const markedCells = [];
        const missingHeaders = [];
        targetValues.forEach((item, itemIndex) => {
          const columnIndex = headerMap.get(normalize(item.header));
          if (columnIndex === undefined || !cells[columnIndex]) {
            missingHeaders.push(item.header);
            return;
          }
          const token = `tos-released-bulk-edit-${Date.now()}-${Math.random().toString(36).slice(2)}-${itemIndex}`;
          cells[columnIndex].setAttribute("data-tos-released-bulk-edit", token);
          markedCells.push({
            token,
            header: item.header,
            matchedHeaderTitle: headerEntries[columnIndex]?.label || "",
            value: item.value,
            currentValue: readCellValue(cells[columnIndex]),
            columnIndex,
          });
        });

        return {
          poNo: targetPoNo,
          rowToken,
          rowIndex,
          missingHeaders,
          cells: markedCells,
        };
      }

      throw new Error(`Released Bulk row for PO No ${targetPoNo} was not found in the worksheet grid.`);
    }, {
      targetPoNo: poNo,
      targetValues: editableValues,
    });
  }

  function assertReleasedBulkMatchedColumn(cell) {
    const expected = normalizeHeaderName(cell?.header);
    const actual = normalizeHeaderName(cell?.matchedHeaderTitle || cell?.header);
    const expectedLabel = RELEASED_BULK_EXACT_COLUMN_HEADERS.get(expected);
    if (expectedLabel && actual !== expected) {
      throw new Error(`Released Bulk column mismatch: expected ${expectedLabel}, matched "${String(cell?.matchedHeaderTitle || "").trim()}".`);
    }
  }

  function shouldForceReleasedBulkDropdownSelection(header) {
    return RELEASED_BULK_DELAY_DROPDOWN_HEADERS.has(normalizeHeaderName(header));
  }

  function normalizeReleasedBulkComparableValue(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    const lowered = text.toLowerCase();
    if (/^(yes|y|true|1|checked)$/i.test(lowered)) return "true";
    if (/^(no|n|false|0|unchecked)$/i.test(lowered)) return "false";
    const dateMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return lowered;
  }

  function releasedBulkCellValueMatches(currentValue, nextValue) {
    const current = normalizeReleasedBulkComparableValue(currentValue);
    const next = normalizeReleasedBulkComparableValue(nextValue);
    if (current && next && current === next) return true;
    const currentCode = String(currentValue ?? "").match(/\b(\d{4})\b/)?.[1] || "";
    const nextCode = String(nextValue ?? "").match(/\b(\d{4})\b/)?.[1] || "";
    return Boolean(currentCode && nextCode && currentCode === nextCode);
  }

  async function editReleasedBulkWorksheetCell(page, cellLocator, value, header = "") {
    const normalizedValue = String(value ?? "");
    await cellLocator.scrollIntoViewIfNeeded().catch(() => {});

    if (normalizeHeaderName(header) === "supplierconfirmed") {
      return editReleasedBulkBooleanCell(page, cellLocator, normalizedValue, header);
    }
    if (shouldForceReleasedBulkDropdownSelection(header)) {
      return editReleasedBulkDropdownCell(page, cellLocator, normalizedValue, header);
    }
    return editReleasedBulkTextCell(page, cellLocator, normalizedValue, header);
  }

  async function editReleasedBulkBooleanCell(page, cellLocator, value, header) {
    const target = await cellLocator.evaluate((cell, nextValue) => {
      const normalized = String(nextValue || "").trim().toLowerCase();
      const targetBool = /^(yes|y|true|1|checked)$/i.test(normalized)
        ? true
        : /^(no|n|false|0|unchecked)$/i.test(normalized)
          ? false
          : null;
      if (targetBool === null) return { ok: false, reason: "invalid-boolean-value" };
      const button = targetBool ? cell.querySelector(".true-toggle-button") : cell.querySelector(".false-toggle-button");
      if (!button) return { ok: false, reason: "boolean-button-not-found" };
      const cellToken = `tos-released-bulk-boolean-cell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const token = `tos-released-bulk-boolean-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cell.setAttribute("data-tos-released-bulk-boolean-cell", cellToken);
      button.setAttribute("data-tos-released-bulk-boolean-button", token);
      return { ok: true, cellToken, token, expected: targetBool ? "true" : "false" };
    }, value);
    if (!target?.ok) {
      throw new Error(`Released Bulk boolean cell "${String(header || "").trim()}" could not be edited: ${JSON.stringify(target || {})}`);
    }
    const button = page.locator(`[data-tos-released-bulk-boolean-button="${target.token}"]`).first();
    if (typeof forceClickLocator === "function") {
      await forceClickLocator(button, `Released Bulk ${header} ${target.expected}`);
    } else {
      await button.click({ force: true });
    }
    await page.waitForTimeout(120);
    const selected = await page.waitForFunction(({ cellToken, expected }) => {
      const cell = document.querySelector(`[data-tos-released-bulk-boolean-cell="${cellToken}"]`);
      if (!cell) return false;
      const expectedBool = expected === "true";
      const hiddenValue = cell.querySelector('input[type="hidden"][name="value"]');
      const selectedButton = expectedBool
        ? cell.querySelector(".true-toggle-button")
        : cell.querySelector(".false-toggle-button");
      return String(hiddenValue?.value || "").toLowerCase() === expected
        || selectedButton?.classList.contains("is-selected");
    }, {
      cellToken: target.cellToken,
      expected: target.expected,
    }, {
      timeout: 1200,
      polling: 100,
    }).then(() => ({ ok: true, method: "boolean-click" })).catch(() => page.evaluate(({ cellToken, expected }) => {
      const dispatch = (element, type) => element?.dispatchEvent?.(new Event(type, {
        bubbles: true,
        cancelable: true,
      }));
      const cell = document.querySelector(`[data-tos-released-bulk-boolean-cell="${cellToken}"]`);
      if (!cell) return { ok: false, reason: "cell-not-found" };
      const expectedBool = expected === "true";
      const hiddenValue = cell.querySelector('input[type="hidden"][name="value"]');
      const selectedButton = expectedBool
        ? cell.querySelector(".true-toggle-button")
        : cell.querySelector(".false-toggle-button");
      const otherButton = expectedBool
        ? cell.querySelector(".false-toggle-button")
        : cell.querySelector(".true-toggle-button");
      if (!hiddenValue || !selectedButton) {
        return { ok: false, reason: "boolean-control-not-found" };
      }
      hiddenValue.value = expected;
      hiddenValue.setAttribute("value", expected);
      selectedButton.classList.add("is-selected");
      otherButton?.classList.remove("is-selected");
      dispatch(hiddenValue, "input");
      dispatch(hiddenValue, "change");
      dispatch(selectedButton, "input");
      dispatch(selectedButton, "change");
      dispatch(cell, "input");
      dispatch(cell, "change");
      return {
        ok: String(hiddenValue.value || "").toLowerCase() === expected
          || selectedButton.classList.contains("is-selected"),
        method: "boolean-fallback",
      };
    }, {
      cellToken: target.cellToken,
      expected: target.expected,
    }));
    if (!selected?.ok) {
      throw new Error(`Released Bulk boolean selection did not stick for "${String(header || "").trim()}": ${JSON.stringify(selected || {})}`);
    }
    return { method: "boolean-click", selectedValue: target.expected };
  }

  async function editReleasedBulkDropdownCell(page, cellLocator, value, header) {
    const target = await cellLocator.evaluate((cell, nextValue) => {
      const clean = (item) => String(item || "").replace(/\s+/g, " ").trim();
      const normalize = (item) => clean(item).toLowerCase();
      const targetText = normalize(nextValue);
      const targetCode = targetText.match(/\b(\d{4})\b/)?.[1] || "";
      const select = cell.querySelector("select");
      if (!select) return { ok: false, reason: "select-not-found" };
      const option = Array.from(select.options).find((item) => {
        const optionValue = normalize(item.value);
        const optionText = normalize(item.textContent);
        return optionValue === targetText
          || optionText === targetText
          || (targetCode && optionValue === targetCode)
          || (targetCode && optionText.includes(targetCode))
          || (targetText && optionText.includes(targetText));
      });
      if (!option) {
        return {
          ok: false,
          reason: "option-not-found",
          optionsPreview: Array.from(select.options).slice(0, 8).map((item) => ({
            value: item.value,
            text: clean(item.textContent || ""),
          })),
        };
      }
      const button = cell.querySelector('input[type="button"][value="\u25bc"], input[type="button"]');
      const buttonToken = `tos-released-bulk-dropdown-button-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const selectToken = `tos-released-bulk-dropdown-select-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (button) button.setAttribute("data-tos-released-bulk-dropdown-button", buttonToken);
      select.setAttribute("data-tos-released-bulk-dropdown-select", selectToken);
      return {
        ok: true,
        hasButton: Boolean(button),
        buttonToken,
        selectToken,
        optionValue: option.value,
        optionText: clean(option.textContent || ""),
      };
    }, value);

    if (!target?.ok) {
      throw new Error(`Released Bulk dropdown "${String(header || "").trim()}" could not be edited: ${JSON.stringify(target || {})}`);
    }

    if (target.hasButton) {
      const button = page.locator(`[data-tos-released-bulk-dropdown-button="${target.buttonToken}"]`).first();
      if (typeof forceClickLocator === "function") {
        await forceClickLocator(button, `Released Bulk ${header} dropdown`);
      } else {
        await button.click({ force: true });
      }
      await page.waitForTimeout(120);
    }

    const select = page.locator(`[data-tos-released-bulk-dropdown-select="${target.selectToken}"]`).first();
    await select.selectOption({ value: target.optionValue }).catch(async () => {
      await select.evaluate((element, optionValue) => {
        element.value = optionValue;
        element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      }, target.optionValue);
    });
    await select.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(160);
    return {
      method: "dropdown-select-click",
      selectedValue: target.optionValue,
      selectedText: target.optionText,
    };
  }

  async function editReleasedBulkTextCell(page, cellLocator, value, header) {
    const result = await cellLocator.evaluate((cell, nextValue) => {
      const field = Array.from(cell.querySelectorAll("textarea, input:not([type='hidden'])"))
        .find((element) => !element.readOnly && !element.disabled && !["button", "submit", "checkbox", "radio"].includes(String(element.type || "").toLowerCase()));
      if (!field) return { ok: false, reason: "editable-input-not-found" };
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value");
      if (descriptor?.set) descriptor.set.call(field, nextValue);
      else field.value = nextValue;
      field.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      field.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      field.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
      return { ok: true };
    }, value);
    if (!result?.ok) {
      throw new Error(`Released Bulk text cell "${String(header || "").trim()}" could not be edited: ${JSON.stringify(result || {})}`);
    }
    return { method: "text-input" };
  }

  async function applyOrVerifyReleasedBulkRowValues(page, targetRow, { apply, selectionAlreadyDone = false }) {
    return page.evaluate((payload) => {
      const target = payload?.targetRow || {};
      const poNo = String(target?.poNo || "").trim();
      const values = target?.values && typeof target.values === "object" ? target.values : {};
      const excludedHeaders = new Set(payload?.excludedHeaders || []);
      const exactHeaders = payload?.exactHeaders || {};
      const forceDropdownHeaders = new Set(payload?.forceDropdownHeaders || []);
      const shouldApply = Boolean(payload?.apply);
      const selectionAlreadyDone = Boolean(payload?.selectionAlreadyDone);
      const normalizeHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
      const compact = (value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      };
      const fire = (element, type) => {
        element?.dispatchEvent?.(new Event(type, {
          bubbles: true,
          cancelable: true,
        }));
      };
      const fireMouse = (element, type) => {
        element?.dispatchEvent?.(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
      };
      const setNativeValue = (element, value) => {
        if (!element) {
          return;
        }
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
        if (descriptor?.set) {
          descriptor.set.call(element, value);
        } else {
          element.value = value;
        }
        element.setAttribute("value", value);
        fire(element, "input");
        fire(element, "change");
        fire(element, "blur");
      };
      const normalizeComparable = (value) => {
        const text = cleanText(value);
        const lowered = text.toLowerCase();
        if (/^(yes|y|true|1|checked)$/i.test(lowered)) {
          return "true";
        }
        if (/^(no|n|false|0|unchecked)$/i.test(lowered)) {
          return "false";
        }
        const dateMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
        return lowered;
      };
      const valueMatches = (currentValue, nextValue) => {
        const current = normalizeComparable(currentValue);
        const next = normalizeComparable(nextValue);
        if (current && next && current === next) {
          return true;
        }
        const nextCode = cleanText(nextValue).match(/\b(\d{4})\b/)?.[1] || "";
        const currentCode = cleanText(currentValue).match(/\b(\d{4})\b/)?.[1] || "";
        if (nextCode && currentCode && nextCode === currentCode) {
          return true;
        }
        return Boolean(compact(currentValue) && compact(nextValue) && (
          compact(currentValue).includes(compact(nextValue))
          || compact(nextValue).includes(compact(currentValue))
        ));
      };
      const readCellValue = (cell) => {
        const booleanCell = cell?.querySelector?.(".ows-boolean-tri-state-buttonset");
        if (booleanCell) {
          const trueSelected = booleanCell.querySelector(".true-toggle-button.is-selected");
          const falseSelected = booleanCell.querySelector(".false-toggle-button.is-selected");
          if (trueSelected) {
            return "true";
          }
          if (falseSelected) {
            return "false";
          }
        }

        const select = cell?.querySelector?.("select");
        if (select && select.selectedIndex >= 0) {
          const option = select.options[select.selectedIndex];
          const optionText = cleanText(option?.textContent || "");
          if (optionText) {
            return optionText;
          }
          const optionValue = cleanText(option?.value || "");
          if (optionValue) {
            return optionValue;
          }
        }

        const field = cell?.querySelector?.("input.typeText, textarea, input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio'])");
        const fieldValue = cleanText(field?.value || "");
        if (fieldValue) {
          return fieldValue;
        }

        return cleanText(cell?.innerText || cell?.textContent || "");
      };
      const headerLabel = (headerCell) => {
        const fromTitle = cleanText(headerCell?.getAttribute?.("title") || "");
        if (fromTitle) {
          return fromTitle;
        }
        const headerText = headerCell?.querySelector?.(".ui_app_spreadsheet_HeaderText-layout");
        return cleanText(headerText?.innerText || headerText?.textContent || headerCell?.innerText || headerCell?.textContent || "");
      };
      const editableValues = Object.entries(values)
        .filter(([header, value]) => {
          const normalizedHeader = normalizeHeader(header);
          return !excludedHeaders.has(normalizedHeader)
            && value !== undefined
            && value !== null
            && String(value).trim() !== "";
        })
        .map(([header, value]) => ({
          header,
          normalizedHeader: normalizeHeader(header),
          value: String(value).trim(),
        }));
      const selectWorksheetRow = (row, rowIndex) => {
        const rowRect = row?.getBoundingClientRect?.();
        const rowCenterY = rowRect ? rowRect.top + (rowRect.height / 2) : Number.NaN;
        const candidates = Array.from(document.querySelectorAll(
          'input[type="checkbox"].cellfont.fieldEdit, span.checkbox input[type="checkbox"].fieldEdit',
        )).filter((checkbox) => !checkbox.disabled);
        const visibleCandidates = candidates.filter((checkbox) => isVisible(checkbox));
        let checkbox = null;
        let method = "";
        if (Number.isFinite(rowCenterY) && visibleCandidates.length) {
          checkbox = visibleCandidates
            .map((item) => {
              const rect = item.getBoundingClientRect();
              return {
                item,
                distance: Math.abs((rect.top + (rect.height / 2)) - rowCenterY),
              };
            })
            .sort((left, right) => left.distance - right.distance)[0]?.item || null;
          method = "closest-y";
        }
        if (!checkbox && Number.isInteger(rowIndex)) {
          checkbox = visibleCandidates[rowIndex] || candidates[rowIndex] || null;
          method = "row-index";
        }
        if (!checkbox) {
          return {
            ok: false,
            checkboxCount: candidates.length,
            visibleCheckboxCount: visibleCandidates.length,
          };
        }
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.setAttribute("checked", "checked");
          fire(checkbox, "input");
          fire(checkbox, "change");
          fire(checkbox, "blur");
        }
        return {
          ok: Boolean(checkbox.checked),
          alreadyChecked: Boolean(checkbox.defaultChecked),
          method,
          checkboxCount: candidates.length,
          visibleCheckboxCount: visibleCandidates.length,
        };
      };
      const closeDropdownCell = (cell) => {
        Array.from(cell?.querySelectorAll?.(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv") || [])
          .forEach((dropdownDiv) => {
            dropdownDiv.style.display = "none";
            dropdownDiv.setAttribute("aria-hidden", "true");
          });
        Array.from(cell?.querySelectorAll?.("select, input.typeText, input[type='button']") || [])
          .forEach((element) => element.blur?.());
      };
      const setBooleanCell = (cell, nextValue) => {
        const normalizedValue = cleanText(nextValue).toLowerCase();
        const targetBool = /^(yes|y|true|1|checked)$/i.test(normalizedValue)
          ? true
          : /^(no|n|false|0|unchecked)$/i.test(normalizedValue)
            ? false
            : null;
        if (targetBool === null) {
          return { ok: false, method: "boolean", error: `无法识别布尔值 "${nextValue}"。` };
        }
        const selectedButton = targetBool
          ? cell.querySelector(".true-toggle-button")
          : cell.querySelector(".false-toggle-button");
        const otherButton = targetBool
          ? cell.querySelector(".false-toggle-button")
          : cell.querySelector(".true-toggle-button");
        const hiddenValue = cell.querySelector('input[type="hidden"][name="value"], input[type="hidden"]');
        if (!selectedButton || !hiddenValue) {
          return { ok: false, method: "boolean", error: "未找到 true/false 控件。" };
        }
        for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
          fireMouse(selectedButton, type);
        }
        setNativeValue(hiddenValue, targetBool ? "true" : "false");
        selectedButton.classList.add("is-selected");
        otherButton?.classList.remove("is-selected");
        fire(selectedButton, "input");
        fire(selectedButton, "change");
        fire(cell, "input");
        fire(cell, "change");
        fire(cell, "blur");
        const currentValue = readCellValue(cell);
        return {
          ok: valueMatches(currentValue, nextValue),
          method: "boolean",
          currentValue,
          error: valueMatches(currentValue, nextValue)
            ? ""
            : `写入后读回 "${currentValue}"，期望 "${nextValue}"。`,
        };
      };
      const findMatchingOption = (select, nextValue) => {
        const targetText = cleanText(nextValue).toLowerCase();
        const targetCompact = compact(nextValue);
        const targetCode = targetText.match(/\b(\d{4})\b/)?.[1] || "";
        return Array.from(select.options).find((option) => {
          const optionValue = cleanText(option.value).toLowerCase();
          const optionText = cleanText(option.textContent).toLowerCase();
          const optionCompact = compact(option.textContent);
          return optionValue === targetText
            || optionText === targetText
            || (targetCode && optionValue === targetCode)
            || (targetCode && optionText.includes(targetCode))
            || (targetText && optionText.includes(targetText))
            || (targetCompact && optionCompact.includes(targetCompact))
            || (optionCompact && targetCompact.includes(optionCompact));
        });
      };
      const setDropdownCell = (cell, nextValue) => {
        const select = cell.querySelector("select");
        if (!select) {
          return { ok: false, method: "dropdown", error: "未找到下拉框 select。" };
        }
        const dropdownButton = cell.querySelector('input[type="button"][value="\u25bc"], input[type="button"]');
        if (dropdownButton) {
          dropdownButton.focus?.();
          for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
            fireMouse(dropdownButton, type);
          }
          dropdownButton.click?.();
        }
        select.focus?.();
        for (const type of ["mouseover", "mousedown", "click"]) {
          fireMouse(select, type);
        }
        const option = findMatchingOption(select, nextValue);
        if (!option) {
          return {
            ok: false,
            method: "dropdown",
            error: `下拉框里没有匹配 "${nextValue}" 的选项。`,
            optionsPreview: Array.from(select.options).slice(0, 10).map((item) => cleanText(item.textContent || item.value)),
          };
        }
        const selectedText = cleanText(option.textContent || "");
        const selectedValue = cleanText(option.value || "");
        option.scrollIntoView?.({ block: "nearest" });
        option.focus?.();
        for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
          fireMouse(option, type);
        }
        option.click?.();
        option.selected = true;
        select.value = selectedValue;
        select.selectedIndex = option.index;
        for (const type of ["mouseup", "click"]) {
          fireMouse(select, type);
        }
        fire(select, "input");
        fire(select, "change");
        fire(select, "blur");
        const hiddenInput = cell.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          setNativeValue(hiddenInput, selectedValue);
        }
        const displayInput = cell.querySelector('input.typeText, input:not([type="hidden"]):not([type="button"])');
        if (displayInput) {
          setNativeValue(displayInput, selectedText || nextValue);
        }
        for (const type of ["mousedown", "mouseup", "click"]) {
          fireMouse(option, type);
        }
        const currentValue = readCellValue(cell);
        return {
          ok: valueMatches(currentValue, nextValue),
          method: "dropdown",
          selectedValue,
          selectedText,
          currentValue,
          error: valueMatches(currentValue, nextValue)
            ? ""
            : `下拉选择后读回 "${currentValue}"，期望 "${nextValue}"。`,
        };
      };
      const setTextCell = (cell, nextValue) => {
        const field = Array.from(cell.querySelectorAll("textarea, input:not([type='hidden'])"))
          .find((element) => !element.readOnly && !element.disabled && !["button", "submit", "checkbox", "radio"].includes(String(element.type || "").toLowerCase()));
        if (!field) {
          return { ok: false, method: "text", error: "未找到可输入控件。" };
        }
        setNativeValue(field, String(nextValue ?? ""));
        const currentValue = readCellValue(cell);
        return {
          ok: valueMatches(currentValue, nextValue),
          method: "text",
          currentValue,
          error: valueMatches(currentValue, nextValue)
            ? ""
            : `输入后读回 "${currentValue}"，期望 "${nextValue}"。`,
        };
      };
      const findPlan = () => {
        const headerCells = Array.from(document.querySelectorAll(".ui_app_spreadsheet_TitleHeaderCell-layout"));
        const headerEntries = headerCells.map((cell, index) => ({
          index,
          label: headerLabel(cell),
          normalized: normalizeHeader(headerLabel(cell)),
        }));
        const headerMap = new Map();
        headerEntries.forEach((entry) => {
          if (entry.normalized && !headerMap.has(entry.normalized)) {
            headerMap.set(entry.normalized, entry.index);
          }
        });
        const poColumnIndex = headerMap.get("pono");
        if (poColumnIndex === undefined) {
          return { ok: false, error: "页面表头里没有找到 PO No 列。" };
        }

        const dataRows = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"));
        for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
          const row = dataRows[rowIndex];
          const cells = Array.from(row.querySelectorAll(".ui_app_spreadsheet_DataCell-layout"));
          const poCell = cells[poColumnIndex];
          if (!poCell || !cleanText(poCell.textContent).includes(poNo)) {
            continue;
          }

          const missingHeaders = [];
          const cellsToEdit = [];
          editableValues.forEach((item) => {
            const columnIndex = headerMap.get(item.normalizedHeader);
            if (columnIndex === undefined || !cells[columnIndex]) {
              missingHeaders.push(item.header);
              return;
            }
            cellsToEdit.push({
              header: item.header,
              normalizedHeader: item.normalizedHeader,
              matchedHeaderTitle: headerEntries[columnIndex]?.label || "",
              value: item.value,
              currentValue: readCellValue(cells[columnIndex]),
              columnIndex,
              cell: cells[columnIndex],
            });
          });

          return {
            ok: true,
            row,
            rowIndex,
            cellsToEdit,
            missingHeaders,
            headerCount: headerCells.length,
            cellCount: cells.length,
          };
        }
        return { ok: false, error: `在 Released Bulk 工作表中未找到 PO ${poNo}。` };
      };

      if (!poNo) {
        return { ok: false, poNo, error: "Excel 行缺少 PO No。", cellResults: [] };
      }
      if (editableValues.length === 0) {
        return { ok: false, poNo, error: "Excel 这一行没有可写入的字段。", cellResults: [] };
      }

      const plan = findPlan();
      if (!plan.ok) {
        return { ok: false, poNo, error: plan.error, cellResults: [] };
      }

      const selectionResult = shouldApply && selectionAlreadyDone
        ? { ok: true, method: "real-click-before-edit" }
        : shouldApply
          ? selectWorksheetRow(plan.row, plan.rowIndex)
          : { ok: true, method: "verify-only" };
      if (shouldApply && !selectionResult.ok) {
        return {
          ok: false,
          poNo,
          selectionResult,
          error: `PO ${poNo} 的行复选框未能勾选。`,
          cellResults: [],
        };
      }

      const cellResults = [];
      plan.missingHeaders.forEach((header) => {
        cellResults.push({
          header,
          ok: false,
          expectedValue: cleanText(values[header]),
          currentValue: "",
          error: `页面表头没有匹配到 Excel 列 "${header}"。`,
        });
      });

      plan.cellsToEdit.forEach((item) => {
        const expectedColumnLabel = exactHeaders[item.normalizedHeader] || "";
        if (expectedColumnLabel && normalizeHeader(item.matchedHeaderTitle) !== item.normalizedHeader) {
          cellResults.push({
            header: item.header,
            matchedHeaderTitle: item.matchedHeaderTitle,
            ok: false,
            expectedValue: item.value,
            currentValue: item.currentValue,
            error: `列匹配错误，期望 "${expectedColumnLabel}"，实际匹配 "${item.matchedHeaderTitle}"。`,
          });
          return;
        }

        const currentBefore = readCellValue(item.cell);
        if (!shouldApply) {
          cellResults.push({
            header: item.header,
            matchedHeaderTitle: item.matchedHeaderTitle,
            ok: valueMatches(currentBefore, item.value),
            expectedValue: item.value,
            currentValue: currentBefore,
            method: "verify",
            error: valueMatches(currentBefore, item.value)
              ? ""
              : `校验失败：当前 "${currentBefore}"，期望 "${item.value}"。`,
          });
          return;
        }

        let editResult;
        if (normalizeHeader(item.header) === "supplierconfirmed" || item.cell.querySelector(".ows-boolean-tri-state-buttonset")) {
          editResult = setBooleanCell(item.cell, item.value);
        } else if (forceDropdownHeaders.has(item.normalizedHeader) || item.cell.querySelector("select")) {
          editResult = setDropdownCell(item.cell, item.value);
        } else {
          editResult = setTextCell(item.cell, item.value);
        }
        const currentAfter = readCellValue(item.cell);
        const ok = Boolean(editResult?.ok) && valueMatches(currentAfter, item.value);
        cellResults.push({
          header: item.header,
          matchedHeaderTitle: item.matchedHeaderTitle,
          ok,
          expectedValue: item.value,
          currentBefore,
          currentValue: currentAfter,
          method: editResult?.method || "",
          error: ok
            ? ""
            : String(editResult?.error || `写入失败：当前 "${currentAfter}"，期望 "${item.value}"。`),
        });
      });

      return {
        ok: cellResults.every((item) => item.ok),
        poNo,
        selectionResult,
        cellResults,
      };
    }, {
      targetRow,
      apply,
      selectionAlreadyDone: Boolean(selectionAlreadyDone),
      excludedHeaders: Array.from(RELEASED_BULK_EXCLUDED_UPDATE_HEADERS),
      exactHeaders: Object.fromEntries(RELEASED_BULK_EXACT_COLUMN_HEADERS),
      forceDropdownHeaders: Array.from(RELEASED_BULK_DELAY_DROPDOWN_HEADERS),
    });
  }

  async function closeReleasedBulkOpenDropdowns(page) {
    await page.evaluate(() => {
      const closeDropdownCell = (cell) => {
        if (!cell) {
          return;
        }
        Array.from(cell.querySelectorAll(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv"))
          .forEach((dropdownDiv) => {
            dropdownDiv.style.display = "none";
            dropdownDiv.setAttribute("aria-hidden", "true");
          });
        Array.from(cell.querySelectorAll("select, input.typeText, input[type='button']"))
          .forEach((element) => element.blur?.());
      };
      Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataCell-layout"))
        .forEach((cell) => closeDropdownCell(cell));
      document.activeElement?.blur?.();
      document.body?.dispatchEvent?.(new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }

  function findReleasedBulkHeaderRowIndex(worksheet, range) {
    for (let rowIndex = range.s.r; rowIndex <= Math.min(range.e.r, range.s.r + 20); rowIndex += 1) {
      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        const value = getReleasedWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, "");
        if (PO_HEADER_ALIASES.has(normalizeHeaderName(value))) {
          return rowIndex;
        }
      }
    }
    return -1;
  }

  function getReleasedWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, header) {
    const address = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell = worksheet[address];
    if (!cell) {
      return "";
    }

    const rawValue = cell.v;
    if (rawValue === undefined || rawValue === null) {
      return "";
    }

    if (isReleasedBulkDateHeader(header)) {
      const normalizedDate = formatReleasedBulkDateValue(rawValue, cell);
      if (normalizedDate) {
        return normalizedDate;
      }
    }

    return String(cell.w ?? rawValue ?? "").trim();
  }

  function isReleasedBulkDateHeader(header) {
    const normalizedHeader = normalizeHeaderName(header);
    return normalizedHeader.includes("date")
      || normalizedHeader.includes("podd")
      || normalizedHeader.includes("lpd");
  }

  function formatReleasedBulkDateValue(rawValue, cell) {
    if (typeof rawValue === "number") {
      const parsedDate = xlsx.SSF.parse_date_code(rawValue);
      if (parsedDate?.y && parsedDate?.m && parsedDate?.d) {
        return `${parsedDate.y}/${parsedDate.m}/${parsedDate.d}`;
      }
    }

    const text = String(cell?.w ?? rawValue ?? "").trim();
    const directMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (directMatch) {
      return `${Number(directMatch[1])}/${Number(directMatch[2])}/${Number(directMatch[3])}`;
    }

    const shortMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (shortMatch) {
      const yearPart = Number(shortMatch[3]);
      const year = yearPart < 100 ? 2000 + yearPart : yearPart;
      return `${year}/${Number(shortMatch[1])}/${Number(shortMatch[2])}`;
    }

    return text;
  }

  return {
    extractShipping2ReleasedBulkRowsFromWorkbookPayload,
    processShipping2ReleasedBulkWorksheet,
    formatReleasedBulkSaveDecisionMessage,
  };
}

function buildReleasedBulkResult(rowResults, saveResult, poNumbers = []) {
  const normalizedRows = Array.isArray(rowResults) ? rowResults : [];
  return {
    filterApplied: normalizedRows.length > 0,
    saved: Boolean(saveResult?.saved),
    saveResult,
    poNumbers,
    rowResults: normalizedRows,
    updatedRowCount: normalizedRows.filter((row) => row.ok).length,
    failedRowCount: normalizedRows.filter((row) => !row.ok).length,
  };
}

function summarizeReleasedBulkFailures(rowResults) {
  if (!Array.isArray(rowResults)) {
    return [];
  }

  return rowResults
    .filter((row) => !row?.ok)
    .map((row) => {
      const details = [];
      if (row?.error) {
        details.push(String(row.error).trim());
      }
      for (const cell of Array.isArray(row?.cellResults) ? row.cellResults : []) {
        if (cell?.ok) {
          continue;
        }
        details.push(formatReleasedBulkCellFailure(cell));
      }
      for (const cell of Array.isArray(row?.verification?.cellResults) ? row.verification.cellResults : []) {
        if (cell?.ok) {
          continue;
        }
        details.push(`复核 ${formatReleasedBulkCellFailure(cell)}`);
      }
      return {
        poNo: String(row?.poNo || "").trim(),
        message: details.filter(Boolean).slice(0, 6).join("；") || "\u672a\u83b7\u53d6\u5230\u5177\u4f53\u5931\u8d25\u539f\u56e0\u3002",
      };
    });
}

function formatReleasedBulkCellFailure(cell) {
  const header = String(cell?.header || "\u672a\u77e5\u5217").trim();
  const currentValue = String(cell?.currentValue ?? "").trim();
  const expectedValue = String(cell?.expectedValue ?? "").trim();
  const reason = String(cell?.error || "").trim();
  if (reason) {
    return `${header}: ${reason}`;
  }
  return `${header}: 当前 "${currentValue}"，期望 "${expectedValue}"。`;
}

function resolveHeaderInfo(rows) {
  const scanLimit = Math.min(Array.isArray(rows) ? rows.length : 0, 20);
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const headerNames = row.map((cell) => normalizeHeaderName(cell));
    const poColumnIndex = headerNames.findIndex((name) => PO_HEADER_ALIASES.has(name));
    if (poColumnIndex >= 0) {
      return {
        firstDataRowIndex: rowIndex + 1,
        poColumnIndex,
        updateColumnIndex: headerNames.findIndex((name) => UPDATE_VALUE_ALIASES.has(name)),
      };
    }
  }

  return {
    firstDataRowIndex: 0,
    poColumnIndex: 0,
    updateColumnIndex: -1,
  };
}

function normalizeCellValue(value) {
  return String(value ?? "").trim();
}

function normalizeHeaderName(value) {
  return normalizeCellValue(value).toLowerCase().replace(/[^a-z0-9#]/g, "");
}
