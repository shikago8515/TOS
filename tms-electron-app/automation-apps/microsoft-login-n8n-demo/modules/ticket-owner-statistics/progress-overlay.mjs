export function estimateTicketProgress(completedCount, totalCount) {
  const total = Math.max(1, Number(totalCount) || 1);
  const completed = Math.max(0, Number(completedCount) || 0);
  return Math.min(94, 18 + Math.round((completed / total) * 74));
}

export async function reportTicketOwnerProgress(target, options, progress = {}) {
  const normalized = normalizeTicketOwnerProgress(progress);
  if (typeof options?.reportProgress === "function") {
    options.reportProgress(normalized);
  }
  await showTicketOwnerProgress(
    target,
    formatProgressMessage(normalized.message, normalized),
    normalized.percent,
    {
      ...normalized,
      showBrowserProgressOverlay: options?.showBrowserProgressOverlay !== false,
    }
  );
}

export async function emitDetailProgress(target, options, state, message, percent) {
  await reportTicketOwnerProgress(target, options, {
    phase: "detail-pages",
    message,
    percent,
    ...progressDetailsFromState(state),
  });
}

export async function showTicketOwnerProgress(target, message, percent = 0, details = {}) {
  if (!target || typeof target.evaluate !== "function") {
    return;
  }
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const targets = [target];
  if (typeof target.frames === "function") {
    targets.push(...target.frames());
  }

  if (
    details?.showBrowserProgressOverlay === false ||
    target.__tosTicketOwnerProgressOverlayEnabled === false
  ) {
    await Promise.all(
      targets.map((progressTarget) =>
        removeTicketOwnerProgress(progressTarget)
      )
    );
    return;
  }

  await Promise.all(
    targets.map((progressTarget) =>
      injectTicketOwnerProgress(progressTarget, message, safePercent, details)
    )
  );
}

async function removeTicketOwnerProgress(target) {
  await target.evaluate(() => {
    document.getElementById("tos-ticket-owner-progress")?.remove();
  }).catch(() => {});
}

function progressDetailsFromState(state = {}) {
  const currentTickets = Array.from(state?.active?.values?.() || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return {
    totalCount: toProgressCount(state.totalCount),
    completedCount: toProgressCount(state.completedCount),
    successCount: toProgressCount(state.successCount),
    failedCount: toProgressCount(state.failedCount),
    attemptedCount: toProgressCount(state.attemptedCount),
    diagnosticFailedCount: toProgressCount(state.diagnosticFailedCount),
    activeCount: currentTickets.length,
    pendingCount: Math.max(
      0,
      toProgressCount(state.totalCount) - toProgressCount(state.completedCount)
    ),
    currentTickets,
  };
}

function normalizeTicketOwnerProgress(progress) {
  const input = progress && typeof progress === "object" ? progress : {};
  return {
    phase: String(input.phase || "running"),
    message: String(input.message || "正在执行"),
    percent: Math.max(0, Math.min(100, Math.round(Number(input.percent) || 0))),
    totalCount: toProgressCount(input.totalCount),
    completedCount: toProgressCount(input.completedCount),
    successCount: toProgressCount(input.successCount),
    failedCount: toProgressCount(input.failedCount),
    attemptedCount: toProgressCount(input.attemptedCount),
    diagnosticFailedCount: toProgressCount(input.diagnosticFailedCount),
    activeCount: toProgressCount(input.activeCount),
    pendingCount: toProgressCount(input.pendingCount),
    filteredTotalCount: toProgressCount(input.filteredTotalCount),
    taskCenterTotalCount: toProgressCount(input.taskCenterTotalCount),
    discoveredTaskCount: toProgressCount(input.discoveredTaskCount),
    plannedCount: toProgressCount(input.plannedCount),
    skippedCount: toProgressCount(input.skippedCount),
    concurrencyCount: toProgressCount(input.concurrencyCount),
    currentTickets: Array.isArray(input.currentTickets)
      ? input.currentTickets.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}

function toProgressCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formatProgressMessage(message, progress = {}) {
  const details = normalizeTicketOwnerProgress({
    ...progress,
    message,
  });
  const parts = [String(message || "正在执行")];
  if (details.filteredTotalCount > 0) {
    parts.push(`筛选 ${details.filteredTotalCount}${details.taskCenterTotalCount > 0 ? `/${details.taskCenterTotalCount}` : ""}`);
  }
  if (details.plannedCount > 0 && details.plannedCount !== details.totalCount) {
    parts.push(`计划处理 ${details.plannedCount}`);
  }
  if (details.discoveredTaskCount > 0 && details.discoveredTaskCount !== details.filteredTotalCount) {
    parts.push(`已识别 ${details.discoveredTaskCount}`);
  }
  if (details.skippedCount > 0) {
    parts.push(`非目标类型 ${details.skippedCount}`);
  }
  if (details.concurrencyCount > 1) {
    parts.push(`并发 ${details.concurrencyCount}`);
  }
  if (details.totalCount > 0) {
    parts.push(`已生成 ${details.completedCount}/${details.totalCount}`);
  }
  if (details.attemptedCount > 0) {
    parts.push(`已尝试 ${details.attemptedCount}`);
  }
  if (details.failedCount > 0) {
    parts.push(`最终未获取 ${details.failedCount}`);
  }
  if (details.activeCount > 0) {
    const current = details.currentTickets.length
      ? `：${details.currentTickets.join("、")}`
      : "";
    parts.push(`正在处理 ${details.activeCount} 个${current}`);
  }
  if (details.pendingCount > 0) {
    parts.push(`待处理 ${details.pendingCount}`);
  }
  return parts.join(" · ");
}

async function injectTicketOwnerProgress(target, message, percent, details = {}) {
  await target.evaluate(({ message: progressMessage, percent: progressPercent, details: progressDetails }) => {
    const id = "tos-ticket-owner-progress";
    document.getElementById("tos-browser-automation-status-badge")?.remove();
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement("div");
      root.id = id;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("aria-hidden", "true");
      root.setAttribute("data-tos-ticket-owner-progress", "true");
      root.style.cssText = [
        "position:fixed",
        "left:18px",
        "top:18px",
        "z-index:2147483647",
        "width:340px",
        "max-width:calc(100vw - 36px)",
        "box-sizing:border-box",
        "padding:14px 16px",
        "border:2px solid #0ea5e9",
        "border-radius:10px",
        "background:#eff6ff",
        "color:#111827",
        "box-shadow:0 18px 48px rgba(15,23,42,.28)",
        "font-family:Segoe UI,Microsoft YaHei,Arial,sans-serif",
        "font-size:14px",
        "line-height:1.45",
        "pointer-events:none",
      ].join(";");

      const title = document.createElement("div");
      title.style.cssText = "display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;margin-bottom:8px;";
      const dot = document.createElement("span");
      dot.style.cssText = "width:9px;height:9px;border-radius:999px;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.16);flex:0 0 auto;";
      const titleText = document.createElement("span");
      titleText.textContent = "TOS 正在统计工单归属";
      title.append(dot, titleText);

      const messageNode = document.createElement("div");
      messageNode.setAttribute("data-tos-progress-message", "true");
      messageNode.style.cssText = "font-size:13px;color:#334155;margin-bottom:10px;word-break:break-word;";

      const metaNode = document.createElement("div");
      metaNode.setAttribute("data-tos-progress-meta", "true");
      metaNode.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;font-size:12px;color:#075985;";

      const track = document.createElement("div");
      track.style.cssText = "height:7px;border-radius:999px;background:#dbeafe;overflow:hidden;";
      const bar = document.createElement("div");
      bar.setAttribute("data-tos-progress-bar", "true");
      bar.style.cssText = "height:100%;width:0%;background:#0284c7;border-radius:999px;transition:width .28s ease;";
      track.appendChild(bar);

      root.append(title, messageNode, metaNode, track);
      document.documentElement.appendChild(root);
    }

    root.style.pointerEvents = "none";
    root.querySelectorAll("*").forEach((element) => {
      element.style.pointerEvents = "none";
    });

    const phase = String(progressDetails?.phase || "");
    const isFailed = phase === "failed" || phase === "error";
    root.style.borderColor = isFailed ? "#ef4444" : "#0ea5e9";
    root.style.background = isFailed ? "#fef2f2" : "#eff6ff";
    root.style.color = isFailed ? "#7f1d1d" : "#111827";
    const dotNode = root.querySelector("span");
    if (dotNode) {
      dotNode.style.background = isFailed ? "#ef4444" : "#10b981";
      dotNode.style.boxShadow = isFailed
        ? "0 0 0 5px rgba(239,68,68,.16)"
        : "0 0 0 5px rgba(16,185,129,.16)";
    }

    const messageNode = root.querySelector("[data-tos-progress-message]");
    const metaNode = root.querySelector("[data-tos-progress-meta]");
    const barNode = root.querySelector("[data-tos-progress-bar]");
    if (messageNode) {
      messageNode.textContent = progressMessage;
    }
    if (metaNode) {
      const total = Number(progressDetails?.totalCount || 0);
      const completed = Number(progressDetails?.completedCount || 0);
      const attempted = Number(progressDetails?.attemptedCount || 0);
      const failed = Number(progressDetails?.failedCount || 0);
      const active = Number(progressDetails?.activeCount || 0);
      const filteredTotal = Number(progressDetails?.filteredTotalCount || 0);
      const taskCenterTotal = Number(progressDetails?.taskCenterTotalCount || 0);
      const discovered = Number(progressDetails?.discoveredTaskCount || 0);
      const planned = Number(progressDetails?.plannedCount || 0);
      const skipped = Number(progressDetails?.skippedCount || 0);
      const concurrency = Number(progressDetails?.concurrencyCount || 0);
      const parts = [];
      if (filteredTotal > 0) {
        parts.push(`筛选 ${filteredTotal}${taskCenterTotal > 0 ? `/${taskCenterTotal}` : ""}`);
      }
      if (planned > 0 && planned !== total) {
        parts.push(`计划处理 ${planned}`);
      }
      if (discovered > 0 && discovered !== filteredTotal) {
        parts.push(`已识别 ${discovered}`);
      }
      if (skipped > 0) {
        parts.push(`非目标类型 ${skipped}`);
      }
      if (concurrency > 1) {
        parts.push(`并发 ${concurrency}`);
      }
      if (total > 0) {
        parts.push(`已生成 ${completed}/${total}`);
      }
      if (attempted > 0) {
        parts.push(`已尝试 ${attempted}`);
      }
      if (failed > 0) {
        parts.push(`最终未获取 ${failed}`);
      }
      if (active > 0) {
        parts.push(`正在处理 ${active} 个`);
      }
      metaNode.textContent = parts.join(" · ");
      metaNode.style.display = metaNode.textContent ? "flex" : "none";
    }
    if (barNode) {
      barNode.style.width = `${progressPercent}%`;
    }
  }, {
    message: String(message || ""),
    percent,
    details,
  }).catch(() => {});
}
