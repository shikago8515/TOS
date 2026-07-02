import {
  showBrowserIdentityBadge,
  showBrowserProgress,
} from "../../shared/browser-progress-overlay.mjs";

const IDENTITY_ID = "tos-packing-list-auto-download-badge";
const PROGRESS_ID = "tos-packing-list-auto-download-progress";
const TITLE = "TOS 自动下载箱单";

export async function showPackingListAutomationBadge(target, message = "自动下载箱单运行中", details = {}) {
  const normalized = normalizePackingListProgress(message, details);
  await showBrowserIdentityBadge(target, {
    id: IDENTITY_ID,
    title: TITLE,
    message: normalized.identityMessage,
    phase: normalized.phase,
    meta: normalized.identityMeta,
  });
  await showBrowserProgress(target, {
    id: PROGRESS_ID,
    title: TITLE,
    message: normalized.message,
    phase: normalized.phase,
    percent: normalized.percent,
    totalCount: normalized.totalCount,
    completedCount: normalized.completedCount,
    successCount: normalized.successCount,
    failedCount: normalized.failedCount,
    attemptedCount: normalized.attemptedCount,
    activeCount: normalized.activeCount,
    currentNo: normalized.currentNo,
    currentPo: normalized.currentPo,
    meta: normalized.meta,
  });
}

function normalizePackingListProgress(message, details = {}) {
  const phase = String(details?.phase || "running");
  const totalCount = toCount(details?.totalCount);
  const completedCount = toCount(details?.completedCount);
  const successCount = toCount(details?.successCount ?? details?.downloadedCount);
  const failedCount = toCount(details?.failedCount);
  const attemptedCount = toCount(details?.attemptedCount);
  const currentNo = String(details?.no || details?.currentNo || "").trim();
  const currentPo = String(details?.poNumber || details?.currentPo || "").trim();
  const concurrencyCount = toCount(details?.concurrencyCount ?? details?.downloadConcurrency);
  const rawActiveCount = toCount(details?.activeCount) || (currentPo ? 1 : 0);
  const isTerminal = phase === "complete" || phase === "completed" || phase === "failed" || phase === "error";
  const activeCount = concurrencyCount > 1 && !isTerminal
    ? Math.max(rawActiveCount, concurrencyCount)
    : rawActiveCount;
  const filePath = String(details?.filePath || details?.lastDownloadedFilePath || "").trim();
  const currentPoIndex = toCount(details?.currentPoIndex);
  const totalPoCount = toCount(details?.totalPoCount);
  const percent = Number.isFinite(Number(details?.percent))
    ? Number(details.percent)
    : estimatePackingListPercent({ phase, completedCount, totalCount });
  const meta = [];
  if (concurrencyCount > 1) meta.push(`并发 ${concurrencyCount} 路`);
  if (currentPoIndex > 0 && totalPoCount > 0) meta.push(`PO ${currentPoIndex}/${totalPoCount}`);
  if (filePath) meta.push(`保存 ${filePath}`);
  if (Array.isArray(details?.meta)) {
    meta.push(...details.meta
      .map((item) => String(item || "").trim())
      .filter((item) => item && !/^并发\s/.test(item)));
  }

  return {
    phase,
    message: String(message || "自动下载箱单运行中"),
    identityMessage: identityMessageForPhase(phase, message),
    percent,
    totalCount,
    completedCount,
    successCount,
    failedCount,
    attemptedCount,
    activeCount,
    currentNo,
    currentPo,
    meta,
    identityMeta: [
      totalCount > 0 ? `${completedCount}/${totalCount}` : "",
      concurrencyCount > 1 ? `并发 ${concurrencyCount} 路` : "",
      currentNo ? `NO ${currentNo}` : "",
      currentPo ? `PO ${currentPo}` : "",
    ].filter(Boolean),
  };
}

function estimatePackingListPercent({ phase, completedCount, totalCount }) {
  if (phase === "complete" || phase === "completed") return 100;
  if (phase === "failed" || phase === "error") return Math.max(6, completedCount > 0 ? 92 : 10);
  if (totalCount > 0) {
    return Math.max(8, Math.min(96, 8 + Math.round((completedCount / totalCount) * 88)));
  }
  if (/login|home|open/i.test(phase)) return 8;
  if (/search/i.test(phase)) return 18;
  if (/download/i.test(phase)) return 72;
  return 12;
}

function identityMessageForPhase(phase, message) {
  if (phase === "complete" || phase === "completed") return "箱单自动下载完成";
  if (phase === "failed" || phase === "error") return "箱单自动下载异常";
  return String(message || "自动下载箱单运行中");
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
