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
    const rows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerInfo = resolveHeaderInfo(rows);
    const releasedBulkRows = [];

    for (let rowIndex = headerInfo.firstDataRowIndex; rowIndex < rows.length; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const poNo = normalizeCellValue(row[headerInfo.poColumnIndex]);
      if (!poNo || PO_HEADER_ALIASES.has(normalizeHeaderName(poNo))) {
        continue;
      }

      releasedBulkRows.push({
        rowIndex: rowIndex + 1,
        poNo,
        updateValue: headerInfo.updateColumnIndex >= 0
          ? normalizeCellValue(row[headerInfo.updateColumnIndex])
          : "",
        originalRow: row,
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
    if (await isReleasedBulkFilterTextareaVisible(page, 300)) {
      return;
    }

    const poNoHeader = page
      .locator('.ui_app_spreadsheet_TitleHeaderCell-layout[title="PO No"]')
      .first();
    await poNoHeader.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
    await poNoHeader.scrollIntoViewIfNeeded().catch(() => {});

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
      if (await isReleasedBulkFilterTextareaVisible(page, 900)) {
        log?.("Released Bulk PO No filter opened.", { target: target.label });
        return;
      }
    }

    await poNoHeader.evaluate((header) => {
      const target = header.querySelector(".ows-header-has-active-filter span")
        || header.querySelector(".ows-header-has-active-filter svg.ows-clickable-svg-icon")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilterSwitch-layout span")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilter-layout")
        || header.querySelector(".ui_app_worksheet_HeaderCellFilterSwitch-layout")
        || header.querySelector("svg.ows-clickable-svg-icon");
      if (!target) {
        return;
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
    });
    if (await isReleasedBulkFilterTextareaVisible(page, 1200)) {
      log?.("Released Bulk PO No filter opened.", { target: "dom-dispatch" });
      return;
    }

    throw new Error("Released Bulk PO No filter input did not open after clicking the PO No header filter.");
  }

  async function clickReleasedBulkFilterTarget(page, locator, label) {
    const attached = await locator
      .waitFor({ state: "attached", timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (!attached) {
      return false;
    }
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + (box.width / 2), box.y + (box.height / 2));
      await page.waitForTimeout(150);
      return true;
    }
    if (typeof forceClickLocator === "function") {
      await forceClickLocator(locator, label);
    } else {
      await locator.click({ force: true });
    }
    await page.waitForTimeout(150);
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
      textarea.focus();
      if (typeof window.worksheet?.changeActiveTextField === "function") {
        try {
          window.worksheet.changeActiveTextField(textarea);
        } catch {
          // Best-effort only.
        }
      }
      textarea.value = "";
      textarea.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      textarea.value = value;
      for (const type of ["input", "change", "keyup"]) {
        textarea.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }

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
    return page.evaluate((rows) => {
      const normalize = (value) => String(value ?? "").trim();
      const normalizeForMatch = (value) => normalize(value).replace(/\s+/g, "").toLowerCase();
      const dispatchValueEvents = (element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const domRows = Array.from(document.querySelectorAll(
        "tr.x-grid3-row, div.x-grid3-row, tbody tr, [role='row']",
      ));

      return rows.map((target) => {
        const poNo = normalize(target.poNo);
        const normalizedPoNo = normalizeForMatch(poNo);
        const matchedRow = domRows.find((row) => normalizeForMatch(row.textContent).includes(normalizedPoNo));
        if (!matchedRow) {
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: false,
            error: "\u5728 Released Bulk \u5de5\u4f5c\u8868\u4e2d\u672a\u627e\u5230\u8be5 PO\u3002",
          };
        }

        const checkbox = matchedRow.querySelector("input[type='checkbox']:not([disabled])");
        if (checkbox) {
          checkbox.checked = true;
          dispatchValueEvents(checkbox);
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: true,
            action: "checked",
          };
        }

        const editable = matchedRow.querySelector(
          "input:not([type='hidden']):not([type='checkbox']):not([disabled]), textarea:not([disabled]), select:not([disabled])",
        );
        const updateValue = normalize(target.updateValue);
        if (editable && updateValue) {
          editable.value = updateValue;
          dispatchValueEvents(editable);
          return {
            rowIndex: target.rowIndex,
            poNo,
            ok: true,
            action: "updated",
            updateValue,
          };
        }

        return {
          rowIndex: target.rowIndex,
          poNo,
          ok: false,
          error: "\u5339\u914d\u5230\u7684\u884c\u91cc\u6ca1\u6709\u53ef\u7f16\u8f91\u7684 Released Bulk \u63a7\u4ef6\u3002",
        };
      });
    }, targetRows);
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
    .map((row) => ({
      poNo: String(row?.poNo || "").trim(),
      message: String(row?.error || "\u672a\u83b7\u53d6\u5230\u5177\u4f53\u5931\u8d25\u539f\u56e0\u3002").trim(),
    }));
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
