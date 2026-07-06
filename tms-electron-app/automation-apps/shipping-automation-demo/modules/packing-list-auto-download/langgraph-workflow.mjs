import {
  resolvePackingListDownloadConcurrency,
  runPackingListAutoDownloadWorkflow,
} from "./workflow.mjs";

const GRAPH_NAME = "packing-list-auto-download";

export async function runPackingListAutoDownloadLangGraphWorkflow(options) {
  const downloadConcurrency = resolvePackingListDownloadConcurrency(options);
  const startedAt = new Date().toISOString();
  const result = await runPackingListAutoDownloadWorkflow({
    ...options,
    downloadConcurrency,
  });
  const finishedAt = new Date().toISOString();

  return {
    ...result,
    langGraph: {
      enabled: true,
      graph: GRAPH_NAME,
      mode: "concurrent-worker-pool",
      status: result.ok ? "success" : "partial",
      currentNode: "process-groups-concurrently",
      startedAt,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
      nodeCount: 1,
      processedGroupCount: Array.isArray(result.groupResults) ? result.groupResults.length : 0,
      downloadConcurrency,
      checkpointEnabled: Boolean(options?.checkpoint?.enabled),
      events: [{
        graph: GRAPH_NAME,
        node: "process-groups-concurrently",
        status: result.ok ? "success" : "partial",
        message: result.message || `Packing list NO-batch worker pool completed with concurrency ${downloadConcurrency}.`,
        detail: {
          totalGroupCount: result.totalGroupCount || 0,
          downloadedPackingListCount: result.downloadedPackingListCount || 0,
          failedPackingListCount: result.failedPackingListCount || 0,
          downloadConcurrency,
        },
        startedAt,
        finishedAt,
        durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
      }],
    },
  };
}
