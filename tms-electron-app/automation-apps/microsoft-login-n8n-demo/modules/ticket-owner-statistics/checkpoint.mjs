export function createTicketOwnerCheckpointWriter(body = {}) {
  const checkpoint = body?.checkpoint && typeof body.checkpoint === "object" ? body.checkpoint : {};
  const backendBaseUrl = normalizeBaseUrl(
    checkpoint.backendBaseUrl ||
    body.backendBaseUrl ||
    ""
  );
  const batchId = String(checkpoint.batchId || body.batchId || "").trim();
  const attemptId = String(checkpoint.attemptId || body.attemptId || "").trim();
  const runId = String(checkpoint.runId || body.backendRunId || body.runId || "").trim();
  const mode = String(checkpoint.mode || body.resumeMode || "new").trim() || "new";
  const snapshot = checkpoint.snapshot && typeof checkpoint.snapshot === "object" ? checkpoint.snapshot : {};
  const enabled = Boolean(
    checkpoint.enabled !== false &&
    (body.checkpointEnabled === true || checkpoint.enabled === true) &&
    backendBaseUrl &&
    batchId
  );

  let lastProgressWrite = 0;
  let lastProgressMessage = "";

  async function write(input = {}) {
    if (!enabled) {
      return null;
    }
    const payload = sanitizeCheckpointPayload({
      runId,
      attemptId,
      mode,
      status: input.status || "running",
      event: input.event || "",
      message: input.message || "",
      checkpoint: input.checkpoint || {},
      itemResult: input.itemResult || null,
      result: input.result || null,
      files: Array.isArray(input.files) ? input.files : [],
    });

    const response = await fetch(`${backendBaseUrl}/api/automation/ticket-owner-statistics/batches/${encodeURIComponent(batchId)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ticket-owner checkpoint failed: HTTP ${response.status} ${text}`.trim());
    }
    return await response.json().catch(() => null);
  }

  function writeProgress(progress = {}) {
    if (!enabled) {
      return;
    }
    const now = Date.now();
    const message = String(progress.message || "").trim();
    if (now - lastProgressWrite < 5000 && message === lastProgressMessage) {
      return;
    }
    lastProgressWrite = now;
    lastProgressMessage = message;
    void write({
      status: "running",
      event: "progress",
      message,
      checkpoint: {
        status: "running",
        event: "progress",
        message,
        progress,
        totalCount: toNonNegativeInteger(progress.totalCount),
        completedCount: toNonNegativeInteger(progress.completedCount || progress.successCount),
        failedCount: toNonNegativeInteger(progress.failedCount),
        pendingCount: toNonNegativeInteger(progress.pendingCount),
        updatedAt: new Date().toISOString(),
      },
    }).catch(() => {});
  }

  async function writeItemResult(result = {}, progress = {}) {
    if (!enabled) {
      return null;
    }
    const item = normalizeTicketResultItem({
      graphNode: "process-ticket-item",
      ...result,
    });
    const success = item.status === "success";
    const event = success ? "item-checkpointed" : "item-failed";
    const message = progress.message ||
      item.message ||
      (success ? `Ticket ${item.caseNumber || item.taskKey || ""} 已采集。` : `Ticket ${item.caseNumber || item.taskKey || ""} 采集失败。`);
    return await write({
      status: "running",
      event,
      message,
      itemResult: item,
      checkpoint: {
        status: "running",
        event,
        currentNode: "write-item-checkpoint",
        message,
        items: [item],
        totalCount: toNonNegativeInteger(progress.totalCount),
        completedCount: toNonNegativeInteger(progress.completedCount || progress.successCount),
        failedCount: toNonNegativeInteger(progress.failedCount),
        pendingCount: toNonNegativeInteger(progress.pendingCount),
        currentItem: item,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function shouldSkipItem(candidate = {}) {
    return shouldSkipTicketOwnerItem({ mode, snapshot }, candidate);
  }

  return {
    enabled,
    backendBaseUrl,
    batchId,
    attemptId,
    runId,
    mode,
    snapshot,
    write,
    writeProgress,
    writeItemResult,
    shouldSkipItem,
  };
}

export function buildTicketOwnerCheckpointFromCollection(collection = {}, extra = {}) {
  const rows = Array.isArray(collection.rows) ? collection.rows : [];
  const ticketResults = Array.isArray(collection.ticketResults) ? collection.ticketResults : [];
  const failedTickets = Array.isArray(collection.failedTickets) ? collection.failedTickets : [];
  const items = [];
  const seen = new Set();

  for (const result of ticketResults) {
    if (!result || typeof result !== "object") {
      continue;
    }
    const item = normalizeTicketResultItem(result);
    if (!item.itemKey || seen.has(item.itemKey)) {
      continue;
    }
    seen.add(item.itemKey);
    items.push(item);
  }

  for (const failed of failedTickets) {
    if (!failed || typeof failed !== "object") {
      continue;
    }
    const item = normalizeTicketResultItem({ ...failed, ok: false });
    if (!item.itemKey || seen.has(item.itemKey)) {
      continue;
    }
    seen.add(item.itemKey);
    items.push(item);
  }

  const completedCount = rows.length;
  const failedCount = failedTickets.length || items.filter((item) => item.status === "failed").length;
  const totalCount = Math.max(
    toNonNegativeInteger(collection.attemptedTicketCount),
    completedCount + failedCount,
    items.length
  );

  return {
    status: extra.status || (failedCount > 0 ? "partial" : "success"),
    event: extra.event || "batch-finalized",
    message: extra.message || collection.message || "",
    totalCount,
    completedCount,
    failedCount,
    pendingCount: Math.max(0, totalCount - completedCount - failedCount),
    items,
    result: {
      rowCount: completedCount,
      failedTicketCount: failedCount,
      attemptedTicketCount: totalCount,
      rows,
      failedTickets,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function shouldSkipTicketOwnerCollection(checkpointWriter) {
  const mode = checkpointWriter?.mode || "new";
  if (mode === "restart" || mode === "new") {
    return false;
  }
  const snapshot = checkpointWriter?.snapshot || {};
  const status = String(snapshot.status || "").toLowerCase();
  return mode === "continue" && status === "success";
}

export function shouldSkipTicketOwnerItem(checkpointWriter, candidate = {}) {
  const mode = checkpointWriter?.mode || "new";
  if (mode === "new" || mode === "restart") {
    return false;
  }
  const match = findSnapshotItem(checkpointWriter?.snapshot || {}, candidate);
  if (!match) {
    return mode === "retry-failed";
  }
  const status = String(match.status || "").toLowerCase();
  if (mode === "continue") {
    return status === "success";
  }
  if (mode === "retry-failed") {
    return !["failed", "error", "interrupted"].includes(status);
  }
  return false;
}

export function mergeTicketOwnerCollectionWithCheckpoint(collection = {}, checkpointWriter = null) {
  const snapshot = checkpointWriter?.snapshot || {};
  const snapshotResult = snapshot.result && typeof snapshot.result === "object" ? snapshot.result : {};
  const previousRows = Array.isArray(snapshotResult.rows) ? snapshotResult.rows : [];
  const previousItems = Array.isArray(snapshot.items) ? snapshot.items : [];
  const currentRows = Array.isArray(collection.rows) ? collection.rows : [];
  const currentTicketResults = Array.isArray(collection.ticketResults) ? collection.ticketResults : [];
  const currentFailedTickets = Array.isArray(collection.failedTickets) ? collection.failedTickets : [];
  const rows = [];
  const ticketResults = [];
  const seen = new Set();

  previousRows.forEach((row, index) => {
    const item = normalizeTicketResultItem({
      row,
      ...(previousItems[index] || {}),
      ok: true,
    });
    const key = item.itemKey || `previous-${index + 1}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push(row);
    ticketResults.push({
      ...item,
      ok: true,
      resumedFromCheckpoint: true,
    });
  });

  currentRows.forEach((row, index) => {
    const result = currentTicketResults[index] || { row, ok: true };
    const item = normalizeTicketResultItem({ ...result, row, ok: result.ok !== false });
    const key = item.itemKey || `current-${index + 1}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push(row);
    ticketResults.push(result);
  });

  return {
    ...collection,
    rows,
    ticketResults,
    failedTickets: currentFailedTickets,
    rowCount: rows.length,
    failedTicketCount: currentFailedTickets.length,
    attemptedTicketCount: Math.max(
      toNonNegativeInteger(collection.attemptedTicketCount),
      rows.length + currentFailedTickets.length
    ),
    resumedRowCount: Math.max(0, rows.length - currentRows.length),
  };
}

function normalizeTicketResultItem(result) {
  const row = result.row && typeof result.row === "object" ? result.row : {};
  const caseNumber = firstText(result.caseNumber, result.ticketId, row["Case Number"]);
  const taskType = firstText(result.taskType, row["Task Type"]);
  const request = firstText(result.request, row.Request);
  const poNumber = firstText(result.poNumber, row["PO Number"]);
  const workingNumber = firstText(result.workingNumber, row["Working Number"]);
  const itemKey = firstText(
    result.itemKey,
    result.taskKey,
    result.ticketId,
    [caseNumber, taskType, request, poNumber, workingNumber].filter(Boolean).join("|")
  );
  const explicitStatus = firstText(result.status, result.state).toLowerCase();
  return {
    itemKey,
    taskKey: firstText(result.taskKey, itemKey),
    status: explicitStatus || (result.ok === false ? "failed" : "success"),
    graphNode: firstText(result.graphNode, result.node),
    caseNumber,
    taskType,
    request,
    poNumber,
    workingNumber,
    message: firstText(result.message, result.error, result.errorMessage),
    updatedAt: new Date().toISOString(),
  };
}

function findSnapshotItem(snapshot, candidate) {
  const normalizedCandidate = normalizeTicketResultItem(candidate);
  const candidateKeys = new Set([
    normalizedCandidate.itemKey,
    normalizedCandidate.taskKey,
    [
      normalizedCandidate.caseNumber,
      normalizedCandidate.taskType,
      normalizedCandidate.request,
      normalizedCandidate.poNumber,
      normalizedCandidate.workingNumber,
    ].filter(Boolean).join("|"),
  ].map((value) => firstText(value)).filter(Boolean));
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  for (const item of items) {
    const normalizedItem = normalizeTicketResultItem(item);
    const itemKeys = [
      normalizedItem.itemKey,
      normalizedItem.taskKey,
      [
        normalizedItem.caseNumber,
        normalizedItem.taskType,
        normalizedItem.request,
        normalizedItem.poNumber,
        normalizedItem.workingNumber,
      ].filter(Boolean).join("|"),
    ].map((value) => firstText(value)).filter(Boolean);
    if (itemKeys.some((key) => candidateKeys.has(key))) {
      return normalizedItem;
    }
  }
  return null;
}

function sanitizeCheckpointPayload(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  removeSensitiveKeys(clone);
  return clone;
}

function removeSensitiveKeys(value) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const key of Object.keys(value)) {
    if (/password|token|cookie|authorization|credential/i.test(key)) {
      delete value[key];
      continue;
    }
    removeSensitiveKeys(value[key]);
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/automation(?:\/.*)?$/i, "");
}
