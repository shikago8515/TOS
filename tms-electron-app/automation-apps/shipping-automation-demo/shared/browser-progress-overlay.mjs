export async function showBrowserIdentityBadge(target, options = {}) {
  if (!target || typeof target.evaluate !== "function") {
    return;
  }

  const targets = collectTargets(target);
  await Promise.all(targets.map((item) => injectIdentityBadge(item, normalizeIdentityOptions(options))));
}

export async function showBrowserProgress(target, options = {}) {
  if (!target || typeof target.evaluate !== "function") {
    return;
  }

  const normalized = normalizeProgressOptions(options);
  const targets = collectTargets(target);
  await Promise.all(targets.map((item) => injectProgressOverlay(item, normalized)));
}

function collectTargets(target) {
  const targets = [target];
  if (typeof target.frames === "function") {
    targets.push(...target.frames());
  }
  return targets.filter((item) => item && typeof item.evaluate === "function");
}

function normalizeIdentityOptions(options = {}) {
  return {
    id: String(options.id || "tos-browser-automation-status-badge"),
    title: String(options.title || "TOS 自动化"),
    message: String(options.message || "自动化运行中"),
    phase: String(options.phase || "running"),
    meta: normalizeMeta(options.meta),
  };
}

function normalizeProgressOptions(options = {}) {
  const totalCount = toCount(options.totalCount);
  const completedCount = toCount(options.completedCount);
  const percent = Number.isFinite(Number(options.percent))
    ? clamp(Math.round(Number(options.percent)), 0, 100)
    : estimatePercent(completedCount, totalCount, options.phase);
  return {
    id: String(options.id || "tos-browser-automation-progress"),
    title: String(options.title || "TOS 正在执行自动化"),
    message: String(options.message || "正在处理"),
    phase: String(options.phase || "running"),
    percent,
    totalCount,
    completedCount,
    successCount: toCount(options.successCount),
    failedCount: toCount(options.failedCount),
    attemptedCount: toCount(options.attemptedCount),
    activeCount: toCount(options.activeCount),
    currentNo: String(options.currentNo || "").trim(),
    currentPo: String(options.currentPo || "").trim(),
    meta: normalizeMeta(options.meta),
  };
}

function normalizeMeta(meta) {
  if (!Array.isArray(meta)) {
    return [];
  }
  return meta.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
}

function estimatePercent(completedCount, totalCount, phase) {
  const phaseText = String(phase || "");
  if (phaseText === "complete" || phaseText === "completed") return 100;
  if (phaseText === "failed" || phaseText === "error") return Math.max(2, completedCount > 0 ? 90 : 8);
  if (totalCount > 0) {
    return clamp(8 + Math.round((completedCount / totalCount) * 88), 8, 96);
  }
  return 8;
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function injectIdentityBadge(target, options) {
  await target.evaluate((input) => {
    let root = document.getElementById(input.id);
    if (!root) {
      root = document.createElement("div");
      root.id = input.id;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("data-tos-browser-identity-badge", "true");
      root.style.cssText = [
        "position:fixed",
        "left:18px",
        "top:18px",
        "z-index:2147483647",
        "width:300px",
        "max-width:calc(100vw - 36px)",
        "box-sizing:border-box",
        "padding:10px 12px",
        "border:2px solid #2563eb",
        "border-radius:8px",
        "background:#eff6ff",
        "color:#0f172a",
        "box-shadow:0 14px 36px rgba(15,23,42,.22)",
        "font-family:Segoe UI,Microsoft YaHei,Arial,sans-serif",
        "font-size:13px",
        "line-height:1.35",
        "pointer-events:none",
      ].join(";");

      const title = document.createElement("div");
      title.style.cssText = "display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:5px;";
      const dot = document.createElement("span");
      dot.setAttribute("data-tos-identity-dot", "true");
      dot.style.cssText = "width:8px;height:8px;border-radius:999px;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.14);flex:0 0 auto;";
      const titleText = document.createElement("span");
      titleText.setAttribute("data-tos-identity-title", "true");
      title.append(dot, titleText);

      const messageNode = document.createElement("div");
      messageNode.setAttribute("data-tos-identity-message", "true");
      messageNode.style.cssText = "font-size:12px;color:#334155;word-break:break-word;";

      const metaNode = document.createElement("div");
      metaNode.setAttribute("data-tos-identity-meta", "true");
      metaNode.style.cssText = "margin-top:5px;font-size:11px;color:#1d4ed8;word-break:break-word;";

      root.append(title, messageNode, metaNode);
      document.documentElement.appendChild(root);
    }

    const isFailed = input.phase === "failed" || input.phase === "error";
    root.style.borderColor = isFailed ? "#dc2626" : "#2563eb";
    root.style.background = isFailed ? "#fef2f2" : "#eff6ff";
    const dot = root.querySelector("[data-tos-identity-dot]");
    if (dot) {
      dot.style.background = isFailed ? "#ef4444" : "#10b981";
      dot.style.boxShadow = isFailed
        ? "0 0 0 5px rgba(239,68,68,.14)"
        : "0 0 0 5px rgba(16,185,129,.14)";
    }

    const titleNode = root.querySelector("[data-tos-identity-title]");
    const messageNode = root.querySelector("[data-tos-identity-message]");
    const metaNode = root.querySelector("[data-tos-identity-meta]");
    if (titleNode) titleNode.textContent = input.title;
    if (messageNode) messageNode.textContent = input.message;
    if (metaNode) {
      metaNode.textContent = input.meta.join(" · ");
      metaNode.style.display = input.meta.length ? "block" : "none";
    }
  }, options).catch(() => {});
}

async function injectProgressOverlay(target, options) {
  await target.evaluate((input) => {
    let root = document.getElementById(input.id);
    if (!root) {
      root = document.createElement("div");
      root.id = input.id;
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("data-tos-browser-progress", "true");
      root.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:2147483647",
        "width:360px",
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
      dot.setAttribute("data-tos-progress-dot", "true");
      dot.style.cssText = "width:9px;height:9px;border-radius:999px;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.16);flex:0 0 auto;";
      const titleText = document.createElement("span");
      titleText.setAttribute("data-tos-progress-title", "true");
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

    const isFailed = input.phase === "failed" || input.phase === "error";
    root.style.borderColor = isFailed ? "#ef4444" : "#0ea5e9";
    root.style.background = isFailed ? "#fef2f2" : "#eff6ff";
    root.style.color = isFailed ? "#7f1d1d" : "#111827";
    const dot = root.querySelector("[data-tos-progress-dot]");
    if (dot) {
      dot.style.background = isFailed ? "#ef4444" : "#10b981";
      dot.style.boxShadow = isFailed
        ? "0 0 0 5px rgba(239,68,68,.16)"
        : "0 0 0 5px rgba(16,185,129,.16)";
    }

    const titleNode = root.querySelector("[data-tos-progress-title]");
    const messageNode = root.querySelector("[data-tos-progress-message]");
    const metaNode = root.querySelector("[data-tos-progress-meta]");
    const barNode = root.querySelector("[data-tos-progress-bar]");
    if (titleNode) titleNode.textContent = input.title;
    if (messageNode) messageNode.textContent = input.message;
    if (metaNode) {
      const parts = [];
      if (input.totalCount > 0) parts.push(`已处理 ${input.completedCount}/${input.totalCount}`);
      if (input.successCount > 0) parts.push(`成功 ${input.successCount}`);
      if (input.failedCount > 0) parts.push(`失败 ${input.failedCount}`);
      if (input.attemptedCount > 0) parts.push(`已尝试 ${input.attemptedCount}`);
      if (input.activeCount > 0) parts.push(`进行中 ${input.activeCount}`);
      if (input.currentNo) parts.push(`NO ${input.currentNo}`);
      if (input.currentPo) parts.push(`PO ${input.currentPo}`);
      parts.push(...input.meta);
      metaNode.textContent = parts.join(" · ");
      metaNode.style.display = parts.length ? "flex" : "none";
    }
    if (barNode) {
      barNode.style.width = `${input.percent}%`;
    }
  }, options).catch(() => {});
}
