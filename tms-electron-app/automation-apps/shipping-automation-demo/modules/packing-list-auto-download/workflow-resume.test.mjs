import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { preparePackingListAutoDownloadRun } from "./workflow.mjs";

const workbook = {
  groups: [
    { no: "NO-001", poNumbers: ["PO-001"] },
    { no: "NO-002", poNumbers: ["PO-002"] },
    { no: "NO-003", poNumbers: ["PO-003"] },
  ],
  poNumbers: ["PO-001", "PO-002", "PO-003"],
};

const checkpoint = {
  mode: "continue",
  items: [
    { no: "NO-001", status: "success" },
    { no: "NO-002", status: "failed" },
    { no: "NO-003", status: "pending" },
  ],
  groupResults: [
    { no: "NO-001", ok: true, filePath: "Packing list NO-001.pdf" },
    { no: "NO-002", ok: false, error: "not found" },
  ],
};

async function prepareWithMode(resumeMode) {
  const downloadDirectory = await mkdtemp(path.join(os.tmpdir(), "tos-plad-resume-"));
  const activeRun = { runId: `run-${resumeMode}` };
  try {
    const result = await preparePackingListAutoDownloadRun({
      activeRun,
      downloadDirectory,
      workbook,
      resumeMode,
      checkpoint: { snapshot: checkpoint },
    });
    return { activeRun, result };
  } finally {
    await rm(downloadDirectory, { recursive: true, force: true });
  }
}

const continued = await prepareWithMode("continue");
assert.deepEqual(continued.result.groups.map((item) => item.no), ["NO-002", "NO-003"]);
assert.deepEqual(continued.result.poNumbers, ["PO-002", "PO-003"]);
assert.equal(continued.result.skippedGroupResults.length, 1);
assert.equal(continued.activeRun.progress.pendingGroupCount, 2);
assert.equal(continued.activeRun.progress.skippedGroupCount, 1);

const retryFailed = await prepareWithMode("retry-failed");
assert.deepEqual(retryFailed.result.groups.map((item) => item.no), ["NO-002"]);
assert.deepEqual(retryFailed.result.poNumbers, ["PO-002"]);
assert.equal(retryFailed.result.skippedGroupResults.length, 1);

const restarted = await prepareWithMode("restart");
assert.deepEqual(restarted.result.groups.map((item) => item.no), ["NO-001", "NO-002", "NO-003"]);
assert.deepEqual(restarted.result.poNumbers, ["PO-001", "PO-002", "PO-003"]);
assert.equal(restarted.result.skippedGroupResults.length, 0);

console.log("packing-list-auto-download workflow resume tests passed");
