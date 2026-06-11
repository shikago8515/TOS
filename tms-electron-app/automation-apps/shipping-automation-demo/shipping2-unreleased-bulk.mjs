const UNRELEASED_BULK_EXCLUDED_UPDATE_HEADERS = new Set([
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
const UNRELEASED_BULK_DELAY_DROPDOWN_HEADERS = new Set([
  "delayearlyconfirmationcrdm",
  "delayearlyconfirmationpdm",
]);
const UNRELEASED_BULK_EXACT_COLUMN_HEADERS = new Map([
  ["delayearlyconfirmationcrdm", "Delay/Early - Confirmation CRD (M)"],
  ["delayearlyconfirmationpdm", "Delay/Early- Confirmation PD (M)"],
  ["supplierconfirmed", "Supplier Confirmed"],
]);

function buildUnreleasedBulkReminderCopy({
  mode,
  poCount,
  updatedRowCount,
  failedRowCount,
}) {
  if (mode === "failure") {
    return {
      title: "Unreleased Bulk \u90e8\u5206 PO \u672a\u5b8c\u6210",
      body: `\u5df2\u6210\u529f ${updatedRowCount}/${poCount} \u4e2a PO\uff0c\u5931\u8d25 ${failedRowCount} \u4e2a\u3002\u81ea\u52a8\u5316\u672a\u81ea\u52a8\u70b9\u51fb Save\u3002`,
      hint: "\u8bf7\u5148\u68c0\u67e5\u4e0b\u65b9\u5931\u8d25\u660e\u7ec6\u3002\u82e5\u9700\u4fdd\u5b58\uff0c\u8bf7\u81ea\u5df1\u70b9\u51fb\u9875\u9762\u9876\u90e8\u84dd\u8272 Save\uff1b\u4e0d\u4fdd\u5b58\u5219\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u5173\u95ed\u6d4f\u89c8\u5668\u3002",
      closeLabel: "\u5173\u95ed\u6d4f\u89c8\u5668",
      emptyFailureList: "\u672a\u83b7\u53d6\u5230\u5931\u8d25\u660e\u7ec6\u3002",
    };
  }

  return {
    title: "Unreleased Bulk \u5df2\u4fee\u6539\u5b8c\u6210",
    body: `\u5df2\u66f4\u65b0 ${updatedRowCount}/${poCount} \u4e2a PO\u3002\u8bf7\u68c0\u67e5\u9875\u9762\u7ed3\u679c\u540e\u9009\u62e9\u662f\u5426\u4fdd\u5b58\u3002`,
    hint: "\u9700\u8981\u4fdd\u5b58\uff1a\u8bf7\u70b9\u51fb\u9875\u9762\u9876\u90e8\u84dd\u8272 Save\u3002\u70b9\u51fb\u540e\u81ea\u52a8\u5316\u4f1a\u68c0\u6d4b\u5230\u5e76\u5173\u95ed\u6d4f\u89c8\u5668\u3002",
    closeLabel: "\u4e0d\u4fdd\u5b58\uff0c\u5173\u95ed\u6d4f\u89c8\u5668",
    emptyFailureList: "\u672a\u83b7\u53d6\u5230\u5931\u8d25\u660e\u7ec6\u3002",
  };
}

export function createShipping2UnreleasedBulkAutomation(dependencies) {
  const config = dependencies.config;
  const log = typeof dependencies.log === "function" ? dependencies.log : () => {};
  const forceClickLocator = dependencies.forceClickLocator;
  const xlsx = dependencies.xlsx;
  const assertWorkbookPayload = dependencies.assertWorkbookPayload;
  const resolveWorksheetName = dependencies.resolveWorksheetName;

async function processShipping2UnreleasedBulkWorksheet(page, unreleasedBulkRows) {
  if (!Array.isArray(unreleasedBulkRows) || unreleasedBulkRows.length === 0) {
    throw new Error("Unreleased Bulk workbook did not contain any PO No rows.");
  }

  const poNumbers = unreleasedBulkRows
    .map((row) => String(row?.poNo || "").trim())
    .filter(Boolean);
  await applyShipping2UnreleasedBulkPoFilter(page, poNumbers);
  const rowResults = await updateShipping2UnreleasedBulkRows(page, unreleasedBulkRows);
  const failedRowCount = rowResults.filter((row) => !row.ok).length;
  const updatedRowCount = rowResults.filter((row) => row.ok).length;
  const saveResult = failedRowCount === 0
    ? await waitForUnreleasedBulkSaveDecision(page, {
      poCount: poNumbers.length,
      updatedRowCount,
    })
    : await waitForUnreleasedBulkFailureDecision(page, {
      poCount: poNumbers.length,
      updatedRowCount,
      failedRowCount,
      rowResults,
    });

  return {
    filterApplied: true,
    saved: Boolean(saveResult.saved),
    saveResult,
    poNumbers,
    rowResults,
    updatedRowCount,
    failedRowCount,
  };
}

async function waitForUnreleasedBulkSaveDecision(page, summary) {
  const decisionKey = `tosUnreleasedBulkSaveDecision:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const timeoutMs = 30 * 60 * 1000;
  const reminderCopy = buildUnreleasedBulkReminderCopy({
    mode: "success",
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    failedRowCount: 0,
  });

  await closeUnreleasedBulkOpenDropdowns(page);
  await page.evaluate(({ key, reminderCopy }) => {
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

    const existing = document.getElementById("tos-unreleased-bulk-save-reminder");
    if (existing) {
      existing.remove();
    }
    localStorage.removeItem(key);

    const panel = document.createElement("div");
    panel.id = "tos-unreleased-bulk-save-reminder";
    panel.setAttribute("data-tos-unreleased-bulk-reminder", "true");
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "width:360px",
      "box-sizing:border-box",
      "background:#111827",
      "color:#f9fafb",
      "border:1px solid #374151",
      "box-shadow:0 18px 45px rgba(0,0,0,.32)",
      "border-radius:8px",
      "font-family:Arial,Helvetica,sans-serif",
      "padding:14px 14px 12px",
      "line-height:1.45",
    ].join(";");
    const title = document.createElement("div");
    title.style.cssText = "font-size:15px;font-weight:700;margin-bottom:6px;";
    title.textContent = String(reminderCopy?.title || "");

    const body = document.createElement("div");
    body.style.cssText = "font-size:13px;color:#d1d5db;margin-bottom:10px;";
    body.textContent = String(reminderCopy?.body || "");

    const saveHint = document.createElement("div");
    saveHint.style.cssText = "font-size:13px;color:#fef3c7;background:#78350f;border:1px solid #92400e;border-radius:6px;padding:8px;margin-bottom:10px;";
    saveHint.textContent = String(reminderCopy?.hint || "");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "tos-unreleased-bulk-close-without-save";
    closeButton.style.cssText = "width:100%;height:34px;border:0;border-radius:6px;background:#dc2626;color:white;font-weight:700;cursor:pointer;";
    closeButton.textContent = String(reminderCopy?.closeLabel || "");
    panel.append(title, body, saveHint, closeButton);
    document.body.appendChild(panel);
    makePanelDraggable(panel, title);

    const setDecision = (decision) => {
      localStorage.setItem(key, JSON.stringify({
        decision,
        at: new Date().toISOString(),
      }));
    };

    document.getElementById("tos-unreleased-bulk-close-without-save")?.addEventListener("click", () => {
      setDecision("close-without-save");
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest("#tos-unreleased-bulk-save-reminder")) {
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
  }, {
    key: decisionKey,
    reminderCopy,
  });
  const injectedFrameCount = await injectUnreleasedBulkSaveReminderIntoFrames(page, {
    key: decisionKey,
    mode: "success",
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    failedRowCount: 0,
    failures: [],
    reminderCopy,
  });

  log("Unreleased Bulk is waiting for user save decision.", {
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    injectedFrameCount,
  });

  const decision = await page.waitForFunction((key) => {
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
      decision: "timeout",
      at: new Date().toISOString(),
    }));

  if (decision?.decision === "saved-by-user") {
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(config.postLoginWaitMs).catch(() => {});
  }

  await page.evaluate((key) => {
    document.getElementById("tos-unreleased-bulk-save-reminder")?.remove();
    localStorage.removeItem(key);
  }, decisionKey).catch(() => {});

  const result = {
    saved: decision?.decision === "saved-by-user",
    skipped: decision?.decision !== "saved-by-user",
    decision: decision?.decision || "unknown",
    decidedAt: decision?.at || "",
  };
  log("Unreleased Bulk user save decision received.", result);
  return result;
}

async function waitForUnreleasedBulkFailureDecision(page, summary) {
  const decisionKey = `tosUnreleasedBulkFailureDecision:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const timeoutMs = 30 * 60 * 1000;
  const failures = summarizeUnreleasedBulkFailures(summary?.rowResults || []);
  const reminderCopy = buildUnreleasedBulkReminderCopy({
    mode: "failure",
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    failedRowCount: Number(summary?.failedRowCount || 0),
  });

  await closeUnreleasedBulkOpenDropdowns(page);
  await page.evaluate(({ key, failures: failureItems, reminderCopy }) => {
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

    const existing = document.getElementById("tos-unreleased-bulk-save-reminder");
    if (existing) {
      existing.remove();
    }
    localStorage.removeItem(key);

    const panel = document.createElement("div");
    panel.id = "tos-unreleased-bulk-save-reminder";
    panel.setAttribute("data-tos-unreleased-bulk-reminder", "true");
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "width:420px",
      "max-height:55vh",
      "overflow:auto",
      "box-sizing:border-box",
      "background:#111827",
      "color:#f9fafb",
      "border:1px solid #7f1d1d",
      "box-shadow:0 18px 45px rgba(0,0,0,.32)",
      "border-radius:8px",
      "font-family:Arial,Helvetica,sans-serif",
      "padding:14px 14px 12px",
      "line-height:1.45",
    ].join(";");

    const title = document.createElement("div");
    title.style.cssText = "font-size:15px;font-weight:700;margin-bottom:6px;";
    title.textContent = String(reminderCopy?.title || "");

    const body = document.createElement("div");
    body.style.cssText = "font-size:13px;color:#d1d5db;margin-bottom:10px;";
    body.textContent = String(reminderCopy?.body || "");

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:13px;color:#fee2e2;background:#7f1d1d;border:1px solid #991b1b;border-radius:6px;padding:8px;margin-bottom:10px;";
    hint.textContent = String(reminderCopy?.hint || "");

    const list = document.createElement("div");
    list.style.cssText = "font-size:12px;color:#f9fafb;background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:10px;";
    const shown = Array.isArray(failureItems) ? failureItems.slice(0, 8) : [];
    list.textContent = shown.length
      ? shown.map((item) => `${item.poNo || "-"}: ${item.message || ""}`).join("\n")
      : String(reminderCopy?.emptyFailureList || "");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.id = "tos-unreleased-bulk-close-without-save";
    closeButton.style.cssText = "width:100%;height:34px;border:0;border-radius:6px;background:#dc2626;color:white;font-weight:700;cursor:pointer;";
    closeButton.textContent = String(reminderCopy?.closeLabel || "");
    panel.append(title, body, hint, list, closeButton);
    document.body.appendChild(panel);
    makePanelDraggable(panel, title);

    const setDecision = (decision) => {
      localStorage.setItem(key, JSON.stringify({
        decision,
        at: new Date().toISOString(),
      }));
    };
    closeButton.addEventListener("click", () => setDecision("close-after-failure"));
  }, {
    key: decisionKey,
    failures,
    reminderCopy,
  });
  const injectedFrameCount = await injectUnreleasedBulkSaveReminderIntoFrames(page, {
    key: decisionKey,
    mode: "failure",
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    failedRowCount: Number(summary?.failedRowCount || 0),
    failures,
    reminderCopy,
  });

  log("Unreleased Bulk is waiting after row update failures.", {
    poCount: Number(summary?.poCount || 0),
    updatedRowCount: Number(summary?.updatedRowCount || 0),
    failedRowCount: Number(summary?.failedRowCount || 0),
    failures,
    injectedFrameCount,
  });

  const decision = await page.waitForFunction((key) => {
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
      decision: "timeout-after-failure",
      at: new Date().toISOString(),
    }));

  await page.evaluate((key) => {
    document.getElementById("tos-unreleased-bulk-save-reminder")?.remove();
    localStorage.removeItem(key);
  }, decisionKey).catch(() => {});

  const result = {
    saved: false,
    skipped: true,
    decision: decision?.decision || "row-update-failed",
    decidedAt: decision?.at || "",
    reason: "row-update-failed",
  };
  log("Unreleased Bulk failure close decision received.", result);
  return result;
}

async function injectUnreleasedBulkSaveReminderIntoFrames(page, options) {
  let injectedCount = 0;
  const frames = page.frames();
  for (const frame of frames) {
    const ok = await frame.evaluate((payload) => {
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
        const message = {
          __tosUnreleasedBulkSaveDecision: true,
          key: payload.key,
          decision,
          at: new Date().toISOString(),
        };
        try {
          localStorage.setItem(payload.key, JSON.stringify({
            decision,
            at: message.at,
          }));
        } catch {
          // Ignore storage failures in child frames; postMessage below is the fallback.
        }
        try {
          window.top?.postMessage(message, "*");
        } catch {
          // Cross-origin frames may block top access; localStorage is still attempted above.
        }
      };

      if (!window.__tosUnreleasedBulkDecisionListenerInstalled) {
        window.__tosUnreleasedBulkDecisionListenerInstalled = true;
        window.addEventListener("message", (event) => {
          const data = event?.data;
          if (!data || data.__tosUnreleasedBulkSaveDecision !== true || !data.key) {
            return;
          }
          try {
            localStorage.setItem(data.key, JSON.stringify({
              decision: data.decision,
              at: data.at || new Date().toISOString(),
            }));
          } catch {
            // Nothing else to do; the waiting code will eventually timeout.
          }
        });
      }

      const existing = document.getElementById("tos-unreleased-bulk-save-reminder");
      if (existing) {
        existing.remove();
      }

      const panel = document.createElement("div");
      panel.id = "tos-unreleased-bulk-save-reminder";
      panel.setAttribute("data-tos-unreleased-bulk-reminder", "true");
      panel.style.cssText = [
        "position:fixed",
        "top:78px",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483647",
        "width:560px",
        "max-width:calc(100vw - 32px)",
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
      title.textContent = String(payload?.reminderCopy?.title || "");

      const body = document.createElement("div");
      body.style.cssText = "font-size:13px;color:#d1d5db;margin-bottom:10px;";
      body.textContent = String(payload?.reminderCopy?.body || "");

      const hint = document.createElement("div");
      hint.style.cssText = "font-size:13px;color:#fef3c7;background:#78350f;border:1px solid #92400e;border-radius:6px;padding:8px;margin-bottom:10px;";
      hint.textContent = String(payload?.reminderCopy?.hint || "");

      panel.append(title, body, hint);

      if (payload.mode === "failure") {
        const list = document.createElement("div");
        list.style.cssText = "font-size:12px;color:#f9fafb;background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:10px;white-space:pre-wrap;max-height:120px;overflow:auto;";
        const shown = Array.isArray(payload.failures) ? payload.failures.slice(0, 8) : [];
        list.textContent = shown.length
          ? shown.map((item) => `${item.poNo || "-"}: ${item.message || ""}`).join("\n")
          : String(payload?.reminderCopy?.emptyFailureList || "");
        panel.append(list);
      }

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.id = "tos-unreleased-bulk-close-without-save";
      closeButton.style.cssText = "width:100%;height:36px;border:0;border-radius:6px;background:#dc2626;color:white;font-weight:700;cursor:pointer;font-size:13px;";
      closeButton.textContent = String(payload?.reminderCopy?.closeLabel || "");
      closeButton.addEventListener("click", () => {
        setDecision(payload.mode === "failure" ? "close-after-failure" : "close-without-save");
      });
      panel.append(closeButton);
      document.body.appendChild(panel);
      makePanelDraggable(panel, title);

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (target.closest("#tos-unreleased-bulk-save-reminder")) {
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

      return true;
    }, options).catch(() => false);
    if (ok) {
      injectedCount += 1;
    }
  }
  return injectedCount;
}

function summarizeUnreleasedBulkFailures(rowResults) {
  if (!Array.isArray(rowResults)) {
    return [];
  }

  return rowResults
    .filter((row) => !row?.ok)
    .flatMap((row) => {
      const poNo = String(row?.poNo || "").trim();
      if (row?.error) {
        return [{
          poNo,
          message: String(row.error || "").trim(),
        }];
      }
      const failedCells = Array.isArray(row?.cellResults)
        ? row.cellResults.filter((cell) => !cell?.ok)
        : [];
      const failedVerificationCells = Array.isArray(row?.verification?.cellResults)
        ? row.verification.cellResults.filter((cell) => !cell?.ok)
        : [];
      const combinedFailures = failedCells.length > 0
        ? failedCells
        : failedVerificationCells;
      if (combinedFailures.length === 0) {
        return [{
          poNo,
          message: "Unknown row update failure.",
        }];
      }
      return combinedFailures.map((cell) => ({
        poNo,
        message: `${String(cell?.header || "").trim()}: ${String(cell?.error || "failed").trim()}`,
      }));
    });
}

function formatUnreleasedBulkSaveDecisionMessage(saveResult) {
  const decision = String(saveResult?.decision || "");
  if (decision === "saved-by-user") {
    return "你已点击 Save，浏览器已关闭。";
  }
  if (decision === "close-without-save") {
    return "你选择不保存，浏览器已关闭。";
  }
  if (decision === "timeout") {
    return "在超时前未收到保存决定，浏览器已关闭。";
  }
  if (String(saveResult?.reason || "") === "row-update-failed") {
    return "部分行或字段修改失败，浏览器已等待你处理。";
  }
  return "未触发保存等待逻辑。";
}

async function applyShipping2UnreleasedBulkPoFilter(page, poNumbers) {
  const normalizedPoNumbers = Array.from(new Set(
    poNumbers.map((poNo) => String(poNo || "").trim()).filter(Boolean),
  ));
  if (normalizedPoNumbers.length === 0) {
    throw new Error("Unreleased Bulk PO filter list is empty.");
  }

  await clickUnreleasedBulkPoNoFilter(page);
  await fillUnreleasedBulkPoFilterTextarea(page, normalizedPoNumbers);
  await clickUnreleasedBulkQueryButton(page);
  const filterResult = await waitForUnreleasedBulkFilteredRows(page, normalizedPoNumbers);
  log("Unreleased Bulk PO filter applied.", {
    poCount: normalizedPoNumbers.length,
    foundCount: filterResult?.foundCount ?? 0,
    missingPoNumbers: filterResult?.missingPoNumbers || [],
  });
}

async function fillUnreleasedBulkPoFilterTextarea(page, poNumbers) {
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
    throw new Error("Unreleased Bulk PO No filter input opened but no visible textarea was found.");
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
        // The inline focus handler is best-effort; the value assignment below is authoritative.
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
    throw new Error(`Unreleased Bulk PO No filter textarea could not be filled. ${JSON.stringify(result || {})}`);
  }
  log("Entered Unreleased Bulk PO filter list.", {
    textareaName: result.name,
    poCount: poNumbers.length,
    lineCount: result.lineCount,
    valuePreview: String(result.value || "").split("\n").slice(0, 5),
  });
}

async function clickUnreleasedBulkQueryButton(page) {
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
    await forceClickLocator(queryButton, "Unreleased Bulk Query");
  }
  log("Clicked Unreleased Bulk Query.");
}

async function clickUnreleasedBulkPoNoFilter(page) {
  if (await isUnreleasedBulkFilterTextareaVisible(page, 80)) {
    return;
  }

  const poNoHeader = page
    .locator('.ui_app_spreadsheet_TitleHeaderCell-layout[title="PO No"]')
    .first();
  await poNoHeader.waitFor({ state: "visible", timeout: config.navigationTimeoutMs });
  await poNoHeader.scrollIntoViewIfNeeded().catch(() => {});

  const domClicked = await dispatchUnreleasedBulkPoNoFilterClick(page, poNoHeader);
  if (domClicked && await isUnreleasedBulkFilterTextareaVisible(page, 260)) {
    log("Unreleased Bulk PO No filter opened.", { target: "dom-dispatch-fast" });
    return;
  }

  const clickTargets = [
    {
      locator: poNoHeader.locator(".ows-header-has-active-filter span").first(),
      label: "PO No active filter icon span",
    },
    {
      locator: poNoHeader.locator(".ows-header-has-active-filter svg.ows-clickable-svg-icon").first(),
      label: "PO No active filter svg",
    },
    {
      locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilterSwitch-layout span").first(),
      label: "PO No filter icon span",
    },
    {
      locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilter-layout").first(),
      label: "PO No HeaderCellFilter layout",
    },
    {
      locator: poNoHeader.locator(".ui_app_worksheet_HeaderCellFilterSwitch-layout").first(),
      label: "PO No HeaderCellFilter switch",
    },
    {
      locator: poNoHeader.locator('svg.ows-clickable-svg-icon').first(),
      label: "PO No filter svg",
    },
  ];

  for (const target of clickTargets) {
    const clicked = await clickUnreleasedBulkFilterTarget(page, target.locator, target.label);
    if (!clicked) {
      continue;
    }
    if (await isUnreleasedBulkFilterTextareaVisible(page, 260)) {
      log("Unreleased Bulk PO No filter opened.", { target: target.label });
      return;
    }
  }

  await dispatchUnreleasedBulkPoNoFilterClick(page, poNoHeader);
  if (await isUnreleasedBulkFilterTextareaVisible(page, 450)) {
    log("Unreleased Bulk PO No filter opened.", { target: "dom-dispatch" });
    return;
  }

  throw new Error("Unreleased Bulk PO No filter input did not open after clicking the PO No header filter.");
}

async function dispatchUnreleasedBulkPoNoFilterClick(page, poNoHeader) {
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

async function clickUnreleasedBulkFilterTarget(page, locator, label) {
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
  await forceClickLocator(locator, label);
  await page.waitForTimeout(40);
  return true;
}

async function isUnreleasedBulkFilterTextareaVisible(page, timeoutMs = 300) {
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

async function waitForUnreleasedBulkFilteredRows(page, poNumbers, timeoutMs = Math.min(Number(config.navigationTimeoutMs || 10000), 10000)) {
  const expectedPoNumbers = poNumbers.map((poNo) => String(poNo || "").trim()).filter(Boolean);
  const startedAt = Date.now();
  let lastFoundCount = 0;
  let lastFoundPoNumbers = [];

  while (Date.now() - startedAt < timeoutMs) {
    const visiblePoNumbers = await page.evaluate((targets) => {
      const text = document.body?.innerText || "";
      return targets.filter((poNo) => text.includes(poNo));
    }, expectedPoNumbers).catch(() => []);
    lastFoundCount = Array.isArray(visiblePoNumbers) ? visiblePoNumbers.length : 0;
    lastFoundPoNumbers = Array.isArray(visiblePoNumbers) ? visiblePoNumbers : [];
    if (lastFoundCount >= expectedPoNumbers.length) {
      return {
        foundCount: lastFoundCount,
        foundPoNumbers: lastFoundPoNumbers,
        missingPoNumbers: [],
      };
    }
    if (lastFoundCount > 0 && Date.now() - startedAt > 1200) {
      await page.waitForTimeout(350);
      return {
        foundCount: lastFoundCount,
        foundPoNumbers: lastFoundPoNumbers,
        missingPoNumbers: expectedPoNumbers.filter((poNo) => !lastFoundPoNumbers.includes(poNo)),
      };
    }
    await page.waitForTimeout(250);
  }

  return {
    foundCount: lastFoundCount,
    foundPoNumbers: lastFoundPoNumbers,
    missingPoNumbers: expectedPoNumbers.filter((poNo) => !lastFoundPoNumbers.includes(poNo)),
  };
}

async function updateShipping2UnreleasedBulkRows(page, unreleasedBulkRows) {
  const rowResults = [];
  for (const row of unreleasedBulkRows) {
    const poNo = String(row?.poNo || "").trim();
    try {
      let plan = await markUnreleasedBulkRowEditTargets(page, row);
      if (Array.isArray(plan?.missingHeaders) && plan.missingHeaders.length > 0) {
        throw new Error(`Unreleased Bulk row for PO No ${poNo} is missing worksheet columns: ${plan.missingHeaders.join(", ")}.`);
      }
      if (plan.cells.length === 0) {
        throw new Error(`Unreleased Bulk row for PO No ${poNo} had no matched editable worksheet cells.`);
      }
      const selectionResult = await selectUnreleasedBulkWorksheetRowByPo(page, poNo);
      await page.waitForTimeout(250);
      plan = await markUnreleasedBulkRowEditTargets(page, row);
      if (Array.isArray(plan?.missingHeaders) && plan.missingHeaders.length > 0) {
        throw new Error(`Unreleased Bulk row for PO No ${poNo} is missing worksheet columns after row selection: ${plan.missingHeaders.join(", ")}.`);
      }
      log("Unreleased Bulk row edit plan.", {
        poNo,
        source: plan.source || "",
        rowIndex: plan.rowIndex,
        cells: plan.cells.map((cell) => ({
          header: cell.header,
          matchedHeaderTitle: cell.matchedHeaderTitle || "",
          columnIndex: cell.columnIndex,
          currentValue: cell.currentValue,
          nextValue: cell.value,
        })),
      });

      const cellResults = [];
      for (const cell of plan.cells) {
        try {
          assertUnreleasedBulkMatchedColumn(cell);
          if (!shouldForceUnreleasedBulkDropdownSelection(cell.header)
            && unreleasedBulkCellValueMatches(cell.currentValue, cell.value)) {
            cellResults.push({
              header: cell.header,
              ok: true,
              value: cell.value,
              method: "skipped-same-value",
            });
            continue;
          }
          const cellLocator = page.locator(`[data-tos-unreleased-bulk-edit="${cell.token}"]`).first();
          const editResult = await editUnreleasedBulkWorksheetCell(page, cellLocator, cell.value, cell.header, {
            poNo,
            rowIndex: plan.rowIndex,
            columnIndex: cell.columnIndex,
          });
          cellResults.push({
            header: cell.header,
            ok: true,
            value: cell.value,
            method: editResult.method,
          });
        } catch (error) {
          cellResults.push({
            header: cell.header,
            ok: false,
            value: cell.value,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const failedCellCount = cellResults.filter((item) => !item.ok).length;
      await closeUnreleasedBulkOpenDropdowns(page);
      await page.waitForTimeout(150);
      const verification = await verifyUnreleasedBulkRowValues(page, row);
      const verificationFailures = Array.isArray(verification?.cellResults)
        ? verification.cellResults.filter((item) => !item.ok)
        : [];
      rowResults.push({
        poNo,
        ok: failedCellCount === 0 && verificationFailures.length === 0,
        changedCellCount: cellResults.filter((item) => item.ok).length,
        failedCellCount: failedCellCount + verificationFailures.length,
        selectionResult,
        cellResults,
        verification,
      });
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      const friendlyError = /Unreleased Bulk row for PO No .* was not found in the worksheet grid/i.test(rawError)
        ? `Unreleased Bulk 查询结果中未找到 PO ${poNo}，页面没有可勾选/可修改的行。`
        : rawError;
      rowResults.push({
        poNo,
        ok: false,
        changedCellCount: 0,
        failedCellCount: 1,
        error: friendlyError,
      });
    }
  }

  return rowResults;
}

async function verifyUnreleasedBulkRowValues(page, unreleasedBulkRow) {
  const poNo = String(unreleasedBulkRow?.poNo || "").trim();
  const plan = await markUnreleasedBulkRowEditTargets(page, unreleasedBulkRow);
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

  for (const cell of plan.cells) {
    try {
      assertUnreleasedBulkMatchedColumn(cell);
      if (!unreleasedBulkCellValueMatches(cell.currentValue, cell.value)) {
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

async function selectUnreleasedBulkWorksheetRowByPo(page, poNo) {
  const targetPoNo = String(poNo || "").trim();
  if (!targetPoNo) {
    throw new Error("Unreleased Bulk row is missing PO No.");
  }

  const result = await page.evaluate((targetPoNoInPage) => {
    const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const normalizeHeader = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const visibleRect = (element) => {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return rect;
    };
    const headerLabel = (headerCell) => {
      const fromTitle = cleanText(headerCell?.getAttribute?.("title") || "");
      if (fromTitle) return fromTitle;
      const headerText = headerCell?.querySelector?.(".ui_app_spreadsheet_HeaderText-layout");
      return cleanText(headerText?.innerText || headerText?.textContent || headerCell?.innerText || headerCell?.textContent || "");
    };
    const elementCenterY = (element) => {
      const rect = visibleRect(element)
        || visibleRect(element?.closest?.(".ui_app_worksheet_WorksheetIndexCell-lineNumber"))
        || visibleRect(element?.closest?.("span.checkbox"))
        || visibleRect(element?.closest?.("label"));
      if (!rect) return Number.NaN;
      return rect.top + (rect.height / 2);
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
      '.ui_app_worksheet_WorksheetIndexCell-lineNumber input[type="checkbox"].cellfont.fieldEdit, input[type="checkbox"].cellfont.fieldEdit, span.checkbox input[type="checkbox"].fieldEdit',
    )).filter((checkbox) => !checkbox.disabled);
    const ranked = candidates
      .map((item, index) => {
        const centerY = elementCenterY(item);
        return {
          item,
          index,
          centerY,
          distance: Number.isFinite(centerY) ? Math.abs(centerY - rowCenterY) : Number.POSITIVE_INFINITY,
        };
      })
      .sort((left, right) => left.distance - right.distance);
    const checkbox = ranked[0]?.item || candidates[matchedRowIndex] || null;

    if (!checkbox) {
      return {
        ok: false,
        reason: "checkbox-not-found",
        poNo: targetPoNoInPage,
        rowIndex: matchedRowIndex,
        checkboxCount: candidates.length,
      };
    }

    const checkboxShell = checkbox.closest("span.checkbox");
    const label = checkboxShell?.querySelector?.("label");
    const clickTarget = label
      || checkboxShell
      || checkbox
      || checkbox.closest(".ui_app_worksheet_WorksheetIndexCell-lineNumber");
    const token = `tos-unreleased-bulk-checkbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const clickToken = `tos-unreleased-bulk-checkbox-target-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    checkbox.setAttribute("data-tos-unreleased-bulk-row-checkbox", token);
    clickTarget?.setAttribute?.("data-tos-unreleased-bulk-row-checkbox-target", clickToken);
    return {
      ok: true,
      token,
      clickToken,
      poNo: targetPoNoInPage,
      rowIndex: matchedRowIndex,
      alreadyChecked: Boolean(checkbox.checked),
      checkboxCount: candidates.length,
      method: "po-row-line-number-checkbox",
      lineNumberText: cleanText(clickTarget?.innerText || clickTarget?.textContent || ""),
      distance: ranked[0]?.distance ?? null,
    };
  }, targetPoNo);

  if (!result?.ok) {
    throw new Error(`Unreleased Bulk row checkbox was not found for PO No ${targetPoNo}. ${JSON.stringify(result || {})}`);
  }

  const checkbox = page.locator(`[data-tos-unreleased-bulk-row-checkbox="${result.token}"]`).first();
  if (!result.alreadyChecked) {
    const clickTarget = page.locator(`[data-tos-unreleased-bulk-row-checkbox-target="${result.clickToken}"]`).first();
    const clickLineCheckbox = typeof forceClickLocator === "function"
      ? forceClickLocator(clickTarget, "Unreleased Bulk row line checkbox")
      : clickTarget.click({ force: true });
    await clickLineCheckbox.catch(async () => {
      await clickTarget.click({ force: true }).catch(async () => {
        await checkbox.click({ force: true });
      });
    });
    await page.waitForTimeout(180);
  }

  let checkedAfterClick = await page.evaluate((token) => {
    const checkboxElement = document.querySelector(`[data-tos-unreleased-bulk-row-checkbox="${token}"]`);
    return Boolean(checkboxElement?.checked);
  }, result.token).catch(() => false);

  if (!checkedAfterClick && !result.alreadyChecked) {
    checkedAfterClick = await page.evaluate(({ token, clickToken }) => {
      const checkboxElement = document.querySelector(`[data-tos-unreleased-bulk-row-checkbox="${token}"]`);
      const clickElement = document.querySelector(`[data-tos-unreleased-bulk-row-checkbox-target="${clickToken}"]`)
        || checkboxElement?.closest?.("span.checkbox")
        || checkboxElement;
      const fireMouse = (element, type) => {
        element?.dispatchEvent?.(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }));
      };
      const fire = (element, type) => {
        element?.dispatchEvent?.(new Event(type, {
          bubbles: true,
          cancelable: true,
        }));
      };

      for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
        fireMouse(clickElement, type);
      }
      if (checkboxElement && !checkboxElement.checked) {
        checkboxElement.click?.();
      }
      if (checkboxElement && !checkboxElement.checked) {
        checkboxElement.checked = true;
      }
      fire(checkboxElement, "input");
      fire(checkboxElement, "change");
      fire(checkboxElement, "blur");
      return Boolean(checkboxElement?.checked);
    }, {
      token: result.token,
      clickToken: result.clickToken,
    }).catch(() => false);
    await page.waitForTimeout(180);
  }

  if (!checkedAfterClick) {
    await checkbox.check({ force: true }).catch(async () => {
      if (typeof forceClickLocator === "function") {
        await forceClickLocator(checkbox, "Unreleased Bulk row checkbox fallback");
        return;
      }
      await checkbox.click({ force: true });
    });
    await page.waitForTimeout(180);
  }

  const checked = await page.waitForFunction((token) => {
    const checkboxElement = document.querySelector(`[data-tos-unreleased-bulk-row-checkbox="${token}"]`);
    return Boolean(checkboxElement?.checked);
  }, result.token, {
    timeout: 1500,
    polling: 100,
  }).then(() => true).catch(() => false);

  if (!checked) {
    throw new Error(`Unreleased Bulk row checkbox did not become checked for PO No ${targetPoNo}.`);
  }

  log("Selected Unreleased Bulk worksheet row.", {
    poNo: targetPoNo,
    rowIndex: result.rowIndex,
    method: result.method,
    lineNumberText: result.lineNumberText,
  });

  return {
    ok: true,
    poNo: targetPoNo,
    method: result.method,
    rowIndex: result.rowIndex,
    alreadyChecked: Boolean(result.alreadyChecked),
  };
}

async function selectUnreleasedBulkWorksheetRow(page, plan) {
  const result = await page.evaluate(({ rowToken, rowIndex, poNo }) => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const dataRows = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"));
    const matchedRow = rowToken
      ? document.querySelector(`[data-tos-unreleased-bulk-row="${rowToken}"]`)
      : dataRows[rowIndex];
    const rowRect = matchedRow?.getBoundingClientRect?.();
    const rowCenterY = rowRect ? rowRect.top + (rowRect.height / 2) : Number.NaN;
    const candidates = Array.from(document.querySelectorAll(
      'input[type="checkbox"].cellfont.fieldEdit, span.checkbox input[type="checkbox"].fieldEdit',
    )).filter((checkbox) => !checkbox.disabled);

    let checkbox = null;
    let method = "";
    const visibleCandidates = candidates.filter((item) => isVisible(item));
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

    if (!checkbox && Number.isInteger(rowIndex) && rowIndex >= 0) {
      checkbox = visibleCandidates[rowIndex] || candidates[rowIndex] || null;
      method = "row-index";
    }

    if (!checkbox) {
      return {
        ok: false,
        poNo,
        rowIndex,
        checkboxCount: candidates.length,
        visibleCheckboxCount: visibleCandidates.length,
      };
    }

    const token = `tos-rb-checkbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    checkbox.setAttribute("data-tos-unreleased-bulk-row-checkbox", token);
    return {
      ok: true,
      token,
      poNo,
      rowIndex,
      alreadyChecked: Boolean(checkbox.checked),
      method,
      checkboxCount: candidates.length,
      visibleCheckboxCount: visibleCandidates.length,
    };
  }, {
    rowToken: String(plan?.rowToken || ""),
    rowIndex: Number(plan?.rowIndex),
    poNo: String(plan?.poNo || ""),
  });

  if (!result?.ok) {
    throw new Error(`Unreleased Bulk row checkbox was not found for PO No ${String(plan?.poNo || "").trim()}. ${JSON.stringify(result || {})}`);
  }

  if (!result.alreadyChecked) {
    const checkbox = page.locator(`[data-tos-unreleased-bulk-row-checkbox="${result.token}"]`).first();
    await checkbox.check({ force: true }).catch(async () => {
      await forceClickLocator(checkbox, "Unreleased Bulk row checkbox");
    });
    await page.waitForTimeout(150);
  }

  const checked = await page.evaluate((token) => {
    const checkbox = document.querySelector(`[data-tos-unreleased-bulk-row-checkbox="${token}"]`);
    return Boolean(checkbox?.checked);
  }, result.token).catch(() => false);
  if (!checked) {
    throw new Error(`Unreleased Bulk row checkbox did not become checked for PO No ${String(plan?.poNo || "").trim()}.`);
  }

  log("Selected Unreleased Bulk worksheet row.", {
    poNo: String(plan?.poNo || "").trim(),
    rowIndex: result.rowIndex,
    method: result.method,
  });
  return {
    ok: true,
    method: result.method,
    rowIndex: result.rowIndex,
    alreadyChecked: Boolean(result.alreadyChecked),
  };
}

async function markUnreleasedBulkRowEditTargets(page, unreleasedBulkRow) {
  const poNo = String(unreleasedBulkRow?.poNo || "").trim();
  const values = unreleasedBulkRow?.values && typeof unreleasedBulkRow.values === "object"
    ? unreleasedBulkRow.values
    : {};
  const editableValues = Object.entries(values)
    .filter(([header, value]) => {
      const normalizedHeader = normalizeHeaderName(header);
      return !UNRELEASED_BULK_EXCLUDED_UPDATE_HEADERS.has(normalizedHeader)
        && value !== undefined
        && value !== null
        && String(value).trim() !== "";
    })
    .map(([header, value]) => ({ header, value: String(value).trim() }));

  if (!poNo) {
    throw new Error("Unreleased Bulk row is missing PO No.");
  }
  if (editableValues.length === 0) {
    return { poNo, cells: [] };
  }

  return page.evaluate(({ targetPoNo, targetValues }) => {
    const normalize = (value) => String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const cellText = (cell) => String(cell?.innerText || cell?.textContent || "").replace(/\s+/g, " ").trim();
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
        const optionText = String(option?.textContent || "").replace(/\s+/g, " ").trim();
        if (optionText) {
          return optionText;
        }
        const optionValue = String(option?.value || "").trim();
        if (optionValue) {
          return optionValue;
        }
      }

      const field = cell?.querySelector?.("input.typeText, textarea, input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio'])");
      const fieldValue = String(field?.value || "").replace(/\s+/g, " ").trim();
      if (fieldValue) {
        return fieldValue;
      }

      return cellText(cell);
    };
    const headerLabel = (headerCell) => {
      const fromTitle = String(headerCell?.getAttribute?.("title") || "").trim();
      if (fromTitle) {
        return fromTitle;
      }
      const headerText = headerCell?.querySelector?.(".ui_app_spreadsheet_HeaderText-layout");
      return cellText(headerText || headerCell);
    };
    const markGridCells = () => {
      const headerCells = Array.from(document.querySelectorAll(".ui_app_spreadsheet_TitleHeaderCell-layout"));
      const headerEntries = headerCells.map((cell, index) => ({
        index,
        label: headerLabel(cell),
        normalized: normalize(headerLabel(cell)),
      }));
      const headerMap = new Map();
      headerEntries.forEach((entry) => {
        const normalizedHeader = entry.normalized;
        if (normalizedHeader && !headerMap.has(normalizedHeader)) {
          headerMap.set(normalizedHeader, entry.index);
        }
      });

      const poColumnIndex = headerMap.get("pono");
      if (poColumnIndex === undefined) {
        return null;
      }

      const dataRows = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"));
      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
        const row = dataRows[rowIndex];
        const cells = Array.from(row.querySelectorAll(".ui_app_spreadsheet_DataCell-layout"));
        const poCell = cells[poColumnIndex];
        if (!poCell || !cellText(poCell).includes(targetPoNo)) {
          continue;
        }

        const rowToken = `tos-rb-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        row.setAttribute("data-tos-unreleased-bulk-row", rowToken);
        const markedCells = [];
        const missingHeaders = [];
        targetValues.forEach((item, itemIndex) => {
          const columnIndex = headerMap.get(normalize(item.header));
          if (columnIndex === undefined || !cells[columnIndex]) {
            missingHeaders.push(item.header);
            return;
          }
          const token = `tos-rb-${Date.now()}-${Math.random().toString(36).slice(2)}-${itemIndex}`;
          cells[columnIndex].setAttribute("data-tos-unreleased-bulk-edit", token);
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
          source: "infor-grid",
          rowToken,
          rowIndex,
          headerCount: headerCells.length,
          cellCount: cells.length,
          missingHeaders,
          cells: markedCells,
        };
      }

      return null;
    };

    const gridMatch = markGridCells();
    if (gridMatch) {
      return gridMatch;
    }

    const allTables = Array.from(document.querySelectorAll("table"));

    for (let tableIndex = 0; tableIndex < allTables.length; tableIndex += 1) {
      const table = allTables[tableIndex];
      const rows = Array.from(table.querySelectorAll("tr"));
      for (let headerRowIndex = 0; headerRowIndex < rows.length; headerRowIndex += 1) {
        const headerCells = Array.from(rows[headerRowIndex].children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
        const headerMap = new Map();
        headerCells.forEach((cell, index) => {
          const normalizedHeader = normalize(cellText(cell));
          if (normalizedHeader) {
            headerMap.set(normalizedHeader, index);
          }
        });
        const poColumnIndex = headerMap.get("pono");
        if (poColumnIndex === undefined) {
          continue;
        }

        for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
          const poCell = cells[poColumnIndex];
          const rowPoText = cellText(poCell);
          if (!rowPoText.includes(targetPoNo)) {
            continue;
          }

          const rowToken = `tos-rb-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          row.setAttribute("data-tos-unreleased-bulk-row", rowToken);
          const markedCells = [];
          targetValues.forEach((item, itemIndex) => {
            const columnIndex = headerMap.get(normalize(item.header));
            if (columnIndex === undefined || !cells[columnIndex]) {
              return;
            }
            const token = `tos-rb-${Date.now()}-${Math.random().toString(36).slice(2)}-${itemIndex}`;
            cells[columnIndex].setAttribute("data-tos-unreleased-bulk-edit", token);
            markedCells.push({
              token,
              header: item.header,
              matchedHeaderTitle: cellText(headerCells[columnIndex]) || "",
              value: item.value,
              currentValue: readCellValue(cells[columnIndex]),
            });
          });

          return {
            poNo: targetPoNo,
            rowToken,
            tableIndex,
            headerRowIndex,
            rowIndex,
            cells: markedCells,
          };
        }
      }
    }

    throw new Error(`Unreleased Bulk row for PO No ${targetPoNo} was not found in the worksheet grid.`);
  }, {
    targetPoNo: poNo,
    targetValues: editableValues,
  });
}

function normalizeUnreleasedBulkComparableValue(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
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
}

function unreleasedBulkCellValueMatches(currentValue, nextValue) {
  const current = normalizeUnreleasedBulkComparableValue(currentValue);
  const next = normalizeUnreleasedBulkComparableValue(nextValue);
  return current !== "" && next !== "" && current === next;
}

function assertUnreleasedBulkMatchedColumn(cell) {
  const expected = normalizeHeaderName(cell?.header);
  const actual = normalizeHeaderName(cell?.matchedHeaderTitle || cell?.header);
  const expectedLabel = UNRELEASED_BULK_EXACT_COLUMN_HEADERS.get(expected);
  if (expectedLabel && actual !== expected) {
    throw new Error(`Unreleased Bulk column mismatch: expected ${expectedLabel}, matched "${String(cell?.matchedHeaderTitle || "").trim()}".`);
  }
}

function shouldForceUnreleasedBulkDropdownSelection(header) {
  return UNRELEASED_BULK_DELAY_DROPDOWN_HEADERS.has(normalizeHeaderName(header));
}

function isUnreleasedBulkSupplierConfirmedHeader(header) {
  return normalizeHeaderName(header) === "supplierconfirmed";
}

async function editUnreleasedBulkBooleanCell(page, cellLocator, value, header, metadata = {}) {
  const target = await cellLocator.evaluate((cell, payload) => {
    const normalizedValue = String(payload?.value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const targetBool = /^(yes|y|true|1|checked)$/i.test(normalizedValue)
      ? true
      : /^(no|n|false|0|unchecked)$/i.test(normalizedValue)
        ? false
        : null;
    if (targetBool === null) {
      return {
        ok: false,
        reason: "invalid-boolean-value",
        value: payload?.value,
      };
    }

    const button = targetBool
      ? cell.querySelector(".true-toggle-button")
      : cell.querySelector(".false-toggle-button");
    const hiddenValue = cell.querySelector('input[type="hidden"][name="value"]');
    if (!button || !hiddenValue) {
      return {
        ok: false,
        reason: "boolean-control-not-found",
        hasTrueButton: Boolean(cell.querySelector(".true-toggle-button")),
        hasFalseButton: Boolean(cell.querySelector(".false-toggle-button")),
        hasHiddenValue: Boolean(hiddenValue),
      };
    }

    const cellToken = `tos-rb-boolean-cell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const buttonToken = `tos-rb-boolean-button-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cell.setAttribute("data-tos-unreleased-bulk-boolean-cell", cellToken);
    button.setAttribute("data-tos-unreleased-bulk-boolean-button", buttonToken);
    return {
      ok: true,
      cellToken,
      buttonToken,
      expected: targetBool ? "true" : "false",
      alreadySelected: String(hiddenValue.value || "").toLowerCase() === (targetBool ? "true" : "false")
        || button.classList.contains("is-selected"),
    };
  }, {
    value: String(value ?? ""),
  });

  if (!target?.ok) {
    throw new Error(`Unreleased Bulk boolean cell "${String(header || "").trim()}" could not be edited: ${JSON.stringify(target || {})}`);
  }

  if (!target.alreadySelected) {
    const buttonLocator = page.locator(`[data-tos-unreleased-bulk-boolean-button="${target.buttonToken}"]`).first();
    await forceClickLocator(buttonLocator, `Unreleased Bulk ${header} ${target.expected}`);
  }

  const selected = await page.waitForFunction(({ cellToken, expected }) => {
    const cell = document.querySelector(`[data-tos-unreleased-bulk-boolean-cell="${cellToken}"]`);
    if (!cell) {
      return false;
    }
    const expectedBool = expected === "true";
    const hiddenValue = cell.querySelector('input[type="hidden"][name="value"]');
    const trueButton = cell.querySelector(".true-toggle-button");
    const falseButton = cell.querySelector(".false-toggle-button");
    const selectedButton = expectedBool ? trueButton : falseButton;
    return String(hiddenValue?.value || "").toLowerCase() === expected
      || selectedButton?.classList.contains("is-selected");
  }, {
    cellToken: target.cellToken,
    expected: target.expected,
  }, {
    timeout: 1200,
    polling: 100,
  }).then(() => ({
    ok: true,
    method: target.alreadySelected ? "already-selected" : "click",
  })).catch(() => applyUnreleasedBulkBooleanFallback(page, target, metadata));

  if (!selected?.ok) {
    throw new Error(`Unreleased Bulk boolean selection did not stick for "${String(header || "").trim()}": ${JSON.stringify(selected || {})}`);
  }

  return {
    method: target.alreadySelected ? "cell-boolean-skipped-same-value" : "cell-boolean-toggle",
    selectedValue: target.expected,
  };
}

async function applyUnreleasedBulkBooleanFallback(page, target, metadata = {}) {
  return page.evaluate(({ cellToken, expected, rowIndex, columnIndex }) => {
    const dispatch = (element, eventName) => {
      element?.dispatchEvent?.(new Event(eventName, {
        bubbles: true,
        cancelable: true,
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
      dispatch(element, "input");
      dispatch(element, "change");
      dispatch(element, "blur");
    };

    const resolveCellByPosition = () => {
      if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || columnIndex < 0) {
        return null;
      }
      const row = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"))[rowIndex];
      return Array.from(row?.querySelectorAll?.(".ui_app_spreadsheet_DataCell-layout") || [])[columnIndex] || null;
    };

    const cell = document.querySelector(`[data-tos-unreleased-bulk-boolean-cell="${cellToken}"]`)
      || resolveCellByPosition();
    if (!cell) {
      return { ok: false, reason: "cell-not-found-after-click" };
    }

    const expectedBool = expected === "true";
    const hiddenValue = cell.querySelector('input[type="hidden"][name="value"]');
    const trueButton = cell.querySelector(".true-toggle-button");
    const falseButton = cell.querySelector(".false-toggle-button");
    const selectedButton = expectedBool ? trueButton : falseButton;
    const otherButton = expectedBool ? falseButton : trueButton;

    if (!selectedButton || !hiddenValue) {
      return {
        ok: false,
        reason: "boolean-control-missing-after-click",
        hasSelectedButton: Boolean(selectedButton),
        hasHiddenValue: Boolean(hiddenValue),
      };
    }

    setNativeValue(hiddenValue, expected);
    selectedButton.classList.add("is-selected");
    otherButton?.classList.remove("is-selected");
    dispatch(selectedButton, "input");
    dispatch(selectedButton, "change");
    dispatch(cell, "input");
    dispatch(cell, "change");
    dispatch(cell, "blur");

    return {
      ok: String(hiddenValue.value || "").toLowerCase() === expected
        || selectedButton.classList.contains("is-selected"),
      method: "dom-fallback",
      selectedValue: String(hiddenValue.value || ""),
      selectedClass: Boolean(selectedButton.classList.contains("is-selected")),
    };
  }, {
    cellToken: target.cellToken,
    expected: target.expected,
    rowIndex: Number(metadata?.rowIndex),
    columnIndex: Number(metadata?.columnIndex),
  });
}

async function editUnreleasedBulkWorksheetCell(page, cellLocator, value, header = "", metadata = {}) {
  const normalizedValue = String(value ?? "");
  await cellLocator.scrollIntoViewIfNeeded().catch(() => {});

  if (isUnreleasedBulkSupplierConfirmedHeader(header)) {
    return editUnreleasedBulkBooleanCell(page, cellLocator, normalizedValue, header, metadata);
  }

  const dropdownTarget = await cellLocator.evaluate((cell, payload) => {
    const normalize = (item) => String(item || "").replace(/\s+/g, " ").trim().toLowerCase();
    const targetText = normalize(payload?.value);
    const targetCode = targetText.match(/\b(\d{4})\b/)?.[1] || "";
    const select = cell.querySelector("select");
    if (!select) {
      return { ok: false, reason: "no-select" };
    }
    const matchingOption = Array.from(select.options).find((option) => {
      const optionValue = normalize(option.value);
      const optionText = normalize(option.textContent);
      return optionValue === targetText
        || optionText === targetText
        || (targetCode && optionValue === targetCode)
        || (targetCode && optionText.includes(targetCode))
        || (targetText && optionText.includes(targetText))
        || (optionText && targetText.includes(optionText));
    });
    if (!matchingOption) {
      return {
        ok: false,
        reason: "option-not-found",
        optionsPreview: Array.from(select.options).slice(0, 8).map((option) => ({
          value: option.value,
          text: String(option.textContent || "").replace(/\s+/g, " ").trim(),
        })),
      };
    }

    const button = cell.querySelector('input[type="button"][value="\u25bc"], input[type="button"]');
    const cellToken = `tos-rb-dropdown-cell-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const selectToken = `tos-rb-dropdown-select-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const buttonToken = `tos-rb-dropdown-button-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cell.setAttribute("data-tos-unreleased-bulk-dropdown-cell", cellToken);
    select.setAttribute("data-tos-unreleased-bulk-dropdown-select", selectToken);
    if (button) {
      button.setAttribute("data-tos-unreleased-bulk-dropdown-button", buttonToken);
    }
    return {
      ok: true,
      cellToken,
      selectToken,
      buttonToken,
      hasButton: Boolean(button),
      optionValue: matchingOption.value,
      optionText: String(matchingOption.textContent || "").replace(/\s+/g, " ").trim(),
    };
  }, {
    value: normalizedValue,
    header: String(header || ""),
  });

  if (dropdownTarget?.ok) {
    return editUnreleasedBulkDropdownCellWithMenu(page, dropdownTarget, normalizedValue, header, metadata);
  }

  const inputResult = await cellLocator.evaluate((cell, payload) => {
    const nextValue = String(payload?.value ?? "");
    const normalizedTarget = nextValue.replace(/\s+/g, " ").trim().toLowerCase();
    const targetCodeMatch = normalizedTarget.match(/\b(\d{4})\b/);
    const targetCode = targetCodeMatch ? targetCodeMatch[1] : "";
    const truthy = /^(yes|y|true|1|checked)$/i.test(normalizedTarget);
    const falsey = /^(no|n|false|0|unchecked)$/i.test(normalizedTarget);
    const setNativeValue = (element, value) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    };

    const select = cell.querySelector("select");
    if (select) {
      const normalize = (item) => String(item || "").replace(/\s+/g, " ").trim().toLowerCase();
      const matchingOption = Array.from(select.options).find((option) => {
        const optionValue = normalize(option.value);
        const optionText = normalize(option.textContent);
        return optionValue === normalizedTarget
          || optionText === normalizedTarget
          || (targetCode && optionValue === targetCode)
          || (targetCode && optionText.includes(targetCode))
          || (normalizedTarget && optionText.includes(normalizedTarget))
          || (optionText && normalizedTarget.includes(optionText));
      });
      if (matchingOption) {
        select.value = matchingOption.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const displayInput = cell.querySelector('input.typeText, input:not([type="hidden"])');
        if (displayInput) {
          setNativeValue(displayInput, String(matchingOption.textContent || nextValue).replace(/\s+/g, " ").trim());
        }
        return {
          ok: true,
          method: "cell-select",
          selectedValue: matchingOption.value,
        };
      }
    }

    if (truthy || falsey) {
      const button = truthy
        ? cell.querySelector(".true-toggle-button")
        : cell.querySelector(".false-toggle-button");
      const hiddenValue = cell.querySelector('input[type="hidden"][name="value"], input[type="hidden"]');
      if (hiddenValue) {
        hiddenValue.value = truthy ? "true" : "false";
        hiddenValue.dispatchEvent(new Event("input", { bubbles: true }));
        hiddenValue.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (button) {
        for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
          button.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
          }));
        }
        return { ok: true, method: truthy ? "cell-boolean-true" : "cell-boolean-false" };
      }
    }

    const field = Array.from(cell.querySelectorAll("textarea, input:not([type='hidden'])"))
      .find((element) => !element.readOnly && !element.disabled && !["button", "submit", "checkbox", "radio"].includes(String(element.type || "").toLowerCase()));
    if (field) {
      setNativeValue(field, nextValue);
      return { ok: true, method: "cell-field" };
    }

    return { ok: false };
  }, {
    value: normalizedValue,
    header: String(header || ""),
  });

  if (inputResult?.ok) {
    return { method: inputResult.method || "cell-field" };
  }

  await cellLocator.dblclick({ force: true }).catch(async () => {
    await cellLocator.click({ force: true });
  });
  await page.waitForTimeout(150);

  const editor = page
    .locator('textarea.formInput:not([name^="filter_tal_"]), input.formInput:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea:not([name^="filter_tal_"]):visible, input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):visible')
    .last();
  const editorVisible = await editor.isVisible().catch(() => false);
  if (editorVisible) {
    await editor.fill(normalizedValue);
    await editor.evaluate((element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    });
    await page.keyboard.press("Tab").catch(() => {});
    await page.waitForTimeout(100);
    return { method: "active-editor" };
  }

  throw new Error(`Unreleased Bulk worksheet cell "${String(header || "").trim()}" did not expose an editable control.`);
}

async function editUnreleasedBulkDropdownCellWithNativeSelect(page, dropdownTarget, value, header, metadata = {}) {
  if (dropdownTarget?.hasButton) {
    const button = page.locator(`[data-tos-unreleased-bulk-dropdown-button="${dropdownTarget.buttonToken}"]`).first();
    if (typeof forceClickLocator === "function") {
      await forceClickLocator(button, `Unreleased Bulk ${header} dropdown`);
    } else {
      await button.click({ force: true });
    }
    await page.waitForTimeout(120);
  }

  const selectLocator = page.locator(`[data-tos-unreleased-bulk-dropdown-select="${dropdownTarget.selectToken}"]`).first();
  await selectLocator.selectOption({ value: dropdownTarget.optionValue }).catch(async () => {
    await selectLocator.evaluate((element, optionValue) => {
      element.value = optionValue;
      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    }, dropdownTarget.optionValue);
  });

  const selected = await page.evaluate(({ cellToken, selectToken, optionValue, optionText, nextValue, rowIndex, columnIndex }) => {
    const clean = (item) => String(item || "").replace(/\s+/g, " ").trim();
    const normalize = (item) => clean(item).toLowerCase();
    const normalizeCompact = (item) => normalize(item).replace(/[^a-z0-9]/g, "");
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
    const setNativeValue = (element, newValue) => {
      if (!element) {
        return;
      }
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) {
        descriptor.set.call(element, newValue);
      } else {
        element.value = newValue;
      }
      element.setAttribute("value", newValue);
      fire(element, "input");
      fire(element, "change");
      fire(element, "blur");
    };
    const closeDropdownCell = (targetCell) => {
      Array.from(targetCell.querySelectorAll(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv"))
        .forEach((dropdownDiv) => {
          dropdownDiv.style.display = "none";
          dropdownDiv.setAttribute("aria-hidden", "true");
        });
      Array.from(targetCell.querySelectorAll("select, input.typeText, input[type='button']"))
        .forEach((element) => element.blur?.());
    };

    const resolveCellByPosition = () => {
      if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || columnIndex < 0) {
        return null;
      }
      const row = Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataRow-layout"))[rowIndex];
      return Array.from(row?.querySelectorAll?.(".ui_app_spreadsheet_DataCell-layout") || [])[columnIndex] || null;
    };
    const optionMatches = (item) => {
      const targetText = normalize(nextValue);
      const targetCompact = normalizeCompact(nextValue);
      const targetCode = targetText.match(/\b(\d{4})\b/)?.[1] || normalize(optionValue);
      const expectedOptionValue = normalize(optionValue);
      const expectedOptionText = normalize(optionText);
      const valueText = normalize(item.value);
      const text = normalize(item.textContent);
      const compactText = normalizeCompact(item.textContent);
      return valueText === expectedOptionValue
        || valueText === targetCode
        || text === expectedOptionText
        || text === targetText
        || (targetCode && text.includes(targetCode))
        || (targetText && text.includes(targetText))
        || (targetCompact && compactText.includes(targetCompact))
        || (compactText && targetCompact.includes(compactText));
    };

    const cell = document.querySelector(`[data-tos-unreleased-bulk-dropdown-cell="${cellToken}"]`)
      || resolveCellByPosition();
    if (!cell) {
      return { ok: false, reason: "cell-not-found" };
    }
    let select = cell.querySelector("select")
      || document.querySelector(`[data-tos-unreleased-bulk-dropdown-select="${selectToken}"]`);
    if (!select) {
      select = Array.from(document.querySelectorAll(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv select, select"))
        .find((item) => Array.from(item.options || []).some(optionMatches)) || null;
    }
    if (!select) {
      const currentText = clean(cell.textContent || "");
      const expectedCode = clean(nextValue).match(/\b(\d{4})\b/)?.[1] || clean(optionValue);
      const currentMatches = Boolean(
        (expectedCode && normalize(currentText).includes(normalize(expectedCode)))
        || normalize(currentText).includes(normalize(optionText))
        || normalize(currentText).includes(normalize(nextValue)),
      );
      return {
        ok: currentMatches,
        reason: currentMatches ? "display-text-already-matches" : "select-not-found",
        selectedValue: clean(optionValue),
        selectedText: clean(optionText || nextValue),
        currentValue: "",
        displayText: currentText,
      };
    }

    const targetText = normalize(nextValue);
    const targetCompact = normalizeCompact(nextValue);
    const targetCode = targetText.match(/\b(\d{4})\b/)?.[1] || normalize(optionValue);
    const expectedOptionValue = normalize(optionValue);
    const expectedOptionText = normalize(optionText);
    const options = Array.from(select.options);
    const option = options.find(optionMatches);

    if (!option) {
      return {
        ok: false,
        reason: "native-option-not-found",
        optionCount: options.length,
        optionsPreview: options.slice(0, 10).map((item) => ({
          value: item.value,
          text: clean(item.textContent || ""),
        })),
      };
    }

    const selectedText = clean(option.textContent || "");
    const selectedValue = clean(option.value || "");
    option.selected = true;
    select.value = selectedValue;
    select.selectedIndex = option.index;

    const hiddenInput = cell.querySelector('input[type="hidden"]');
    if (hiddenInput) {
      setNativeValue(hiddenInput, selectedValue);
    }

    const displayInput = cell.querySelector('input.typeText, input:not([type="hidden"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
    if (displayInput) {
      setNativeValue(displayInput, selectedText);
    }

    fireMouse(select, "mousedown");
    fireMouse(option, "mousedown");
    fireMouse(option, "mouseup");
    fireMouse(option, "click");
    fire(select, "input");
    fire(select, "change");
    fire(select, "blur");

    const displayText = clean(displayInput?.value || cell.textContent || "");
    const currentValue = clean(select.value || hiddenInput?.value || "");
    const expectedCode = normalize(selectedValue || selectedText).match(/\b(\d{4})\b/)?.[1] || normalize(selectedValue);

    closeDropdownCell(cell);
    return {
      ok: normalize(currentValue) === normalize(selectedValue)
        || (expectedCode && normalize(currentValue) === expectedCode)
        || (expectedCode && normalize(displayText).includes(expectedCode))
        || normalize(displayText).includes(normalize(selectedText)),
      selectedValue,
      selectedText,
      currentValue,
      displayText,
      optionIndex: option.index,
    };
  }, {
    cellToken: dropdownTarget.cellToken,
    selectToken: dropdownTarget.selectToken,
    optionValue: dropdownTarget.optionValue,
    optionText: dropdownTarget.optionText,
    nextValue: String(value ?? ""),
    rowIndex: Number(metadata?.rowIndex),
    columnIndex: Number(metadata?.columnIndex),
  });

  if (!selected?.ok) {
    throw new Error(`Unreleased Bulk dropdown select click failed for "${String(header || "").trim()}": ${JSON.stringify(selected || {})}`);
  }

  return {
    method: "cell-dropdown-select-click",
    selectedValue: selected.selectedValue,
    selectedText: selected.selectedText,
  };
}

async function editUnreleasedBulkDropdownCellWithMenu(page, dropdownTarget, value, header, metadata = {}) {
  return editUnreleasedBulkDropdownCellWithNativeSelect(page, dropdownTarget, value, header, metadata);
}

async function closeUnreleasedBulkOpenDropdowns(page) {
  await page.evaluate(() => {
    const closeDropdownCell = (cell) => {
      if (!cell) {
        return;
      }
      const dropdownDivs = Array.from(cell.querySelectorAll(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv"));
      dropdownDivs.forEach((dropdownDiv) => {
        dropdownDiv.style.display = "none";
        dropdownDiv.setAttribute("aria-hidden", "true");
      });
      Array.from(cell.querySelectorAll("select, input.typeText, input[type='button']")).forEach((element) => {
        element.blur?.();
      });
    };

    Array.from(document.querySelectorAll(".ui_app_spreadsheet_DataCell-layout")).forEach(closeDropdownCell);
    Array.from(document.querySelectorAll(".ui_app_worksheet_MilestoneDropdownDataCell-dropdownDiv")).forEach((dropdownDiv) => {
      dropdownDiv.style.display = "none";
      dropdownDiv.setAttribute("aria-hidden", "true");
    });
    document.activeElement?.blur?.();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }));
  }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(120).catch(() => {});
}
function extractShipping2UnreleasedBulkRowsFromWorkbookPayload(body) {
  const workbookBuffer = assertWorkbookPayload(body);

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, {
      type: "buffer",
      cellDates: false,
    });
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
  const range = worksheet?.["!ref"] ? xlsx.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    const error = new Error("Uploaded workbook worksheet is empty.");
    error.statusCode = 400;
    throw error;
  }

  const headerRowIndex = findUnreleasedBulkHeaderRowIndex(worksheet, range);
  if (headerRowIndex < 0) {
    const error = new Error("Unreleased Bulk workbook must contain a PO No header.");
    error.statusCode = 400;
    throw error;
  }

  const headers = [];
  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const header = getWorksheetCellDisplayValue(worksheet, headerRowIndex, columnIndex, "");
    headers.push(header);
  }

  const poColumnOffset = headers.findIndex((header) => normalizeHeaderName(header) === "pono");
  if (poColumnOffset < 0) {
    const error = new Error("Unreleased Bulk workbook must contain a PO No column.");
    error.statusCode = 400;
    throw error;
  }

  const unreleasedBulkRows = [];
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
      const value = getWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, header);
      if (value) {
        hasAnyValue = true;
      }
      values[header] = value;
    }

    if (!hasAnyValue) {
      continue;
    }

    const poHeader = headers[poColumnOffset];
    const poNo = String(values[poHeader] || "").trim();
    if (!poNo) {
      continue;
    }
    if (seenPoNumbers.has(poNo)) {
      continue;
    }

    seenPoNumbers.add(poNo);
    unreleasedBulkRows.push({
      rowIndex: rowIndex + 1,
      poNo,
      values,
    });
  }

  if (unreleasedBulkRows.length === 0) {
    const error = new Error("Unreleased Bulk workbook must contain at least one non-empty PO No value.");
    error.statusCode = 400;
    throw error;
  }

  return unreleasedBulkRows;
}

function findUnreleasedBulkHeaderRowIndex(worksheet, range) {
  for (let rowIndex = range.s.r; rowIndex <= Math.min(range.e.r, range.s.r + 20); rowIndex += 1) {
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const value = getWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, "");
      if (normalizeHeaderName(value) === "pono") {
        return rowIndex;
      }
    }
  }
  return -1;
}

function getWorksheetCellDisplayValue(worksheet, rowIndex, columnIndex, header) {
  const address = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = worksheet[address];
  if (!cell) {
    return "";
  }

  const rawValue = cell.v;
  if (rawValue === undefined || rawValue === null) {
    return "";
  }

  if (isUnreleasedBulkDateHeader(header)) {
    const normalizedDate = formatUnreleasedBulkDateValue(rawValue, cell);
    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return String(cell.w ?? rawValue ?? "").trim();
}

function isUnreleasedBulkDateHeader(header) {
  const normalizedHeader = normalizeHeaderName(header);
  return normalizedHeader.includes("date")
    || normalizedHeader.includes("podd")
    || normalizedHeader.includes("lpd");
}

function formatUnreleasedBulkDateValue(rawValue, cell) {
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


function normalizeHeaderName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

  return {
    extractShipping2UnreleasedBulkRowsFromWorkbookPayload,
    processShipping2UnreleasedBulkWorksheet,
    formatUnreleasedBulkSaveDecisionMessage,
  };
}
