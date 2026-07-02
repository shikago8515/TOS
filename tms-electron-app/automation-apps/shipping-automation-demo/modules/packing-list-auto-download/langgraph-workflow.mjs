import { readFile } from "node:fs/promises";

import {
  buildPackingListAutoDownloadFailedGroupResult,
  buildPackingListAutoDownloadResult,
  closePackingListAutoDownloadBrowserSession,
  createPackingListAutoDownloadRequestSession,
  downloadPackingListPoPdfAttempt,
  finalizePackingListAutoDownloadBrowserSession,
  openPackingListAutoDownloadBrowserSession,
  openPackingListPoSearchResultAttempt,
  preparePackingListAutoDownloadRun,
  preparePackingListPoFilterAttempt,
  processPackingListAutoDownloadGraphGroup,
  recordPackingListPoAttemptError,
  resolvePackingListDownloadConcurrency,
  runPackingListAutoDownloadWorkflow,
  updatePackingListAutoDownloadGroupProgress,
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

async function loadLangGraph() {
  try {
    return await import("@langchain/langgraph");
  } catch (_error) {
    return null;
  }
}

function buildPackingListGraph(langGraph) {
  const { Annotation, END, START, StateGraph } = langGraph;
  const State = Annotation.Root({
    options: overwriteAnnotation(Annotation, null),
    runState: overwriteAnnotation(Annotation, null),
    requestSession: overwriteAnnotation(Annotation, null),
    browserSession: overwriteAnnotation(Annotation, null),
    browserResult: overwriteAnnotation(Annotation, null),
    result: overwriteAnnotation(Annotation, null),
    error: overwriteAnnotation(Annotation, null),
    groupIndex: overwriteAnnotation(Annotation, 0),
    groupResults: overwriteAnnotation(Annotation, []),
    poIndex: overwriteAnnotation(Annotation, 0),
    groupAttempts: overwriteAnnotation(Annotation, []),
    currentFilterAttempt: overwriteAnnotation(Annotation, null),
    currentSearchAttempt: overwriteAnnotation(Annotation, null),
    currentDownloadAttempt: overwriteAnnotation(Annotation, null),
    currentGroupResult: overwriteAnnotation(Annotation, null),
    events: Annotation({
      reducer: (left, right) => [...(left || []), ...(right || [])],
      default: () => [],
    }),
    graphStartedAt: Annotation({
      reducer: (left, right) => right || left,
      default: () => "",
    }),
    graphStatus: overwriteAnnotation(Annotation, "pending"),
    currentNode: overwriteAnnotation(Annotation, ""),
  });

  return new StateGraph(State)
    .addNode("prepare-workbook", prepareWorkbookNode)
    .addNode("create-request-session", createRequestSessionNode)
    .addNode("open-packing-manifest", openPackingManifestNode)
    .addNode("start-group", startGroupNode)
    .addNode("apply-po-filter", applyPoFilterNode)
    .addNode("open-search-result", openSearchResultNode)
    .addNode("download-pdf", downloadPdfNode)
    .addNode("settle-po-attempt", settlePoAttemptNode)
    .addNode("finish-group", finishGroupNode)
    .addNode("finalize", finalizeNode)
    .addNode("failed", failedNode)
    .addEdge(START, "prepare-workbook")
    .addConditionalEdges("prepare-workbook", routeAfterStep, {
      next: "create-request-session",
      failed: "failed",
    })
    .addConditionalEdges("create-request-session", routeAfterStep, {
      next: "open-packing-manifest",
      failed: "failed",
    })
    .addConditionalEdges("open-packing-manifest", routeAfterOpen, {
      process: "start-group",
      finalize: "finalize",
      failed: "failed",
    })
    .addConditionalEdges("start-group", routeAfterStartGroup, {
      apply: "apply-po-filter",
      finish: "finish-group",
      finalize: "finalize",
      failed: "failed",
    })
    .addConditionalEdges("apply-po-filter", routeAfterApplyFilter, {
      open: "open-search-result",
      settle: "settle-po-attempt",
      failed: "failed",
    })
    .addConditionalEdges("open-search-result", routeAfterOpenSearchResult, {
      download: "download-pdf",
      settle: "settle-po-attempt",
      failed: "failed",
    })
    .addEdge("download-pdf", "settle-po-attempt")
    .addConditionalEdges("settle-po-attempt", routeAfterSettlePoAttempt, {
      apply: "apply-po-filter",
      finish: "finish-group",
      failed: "failed",
    })
    .addConditionalEdges("finish-group", routeAfterFinishGroup, {
      process: "start-group",
      finalize: "finalize",
      failed: "failed",
    })
    .addConditionalEdges("finalize", routeAfterFinalize, {
      complete: END,
      failed: "failed",
    })
    .addEdge("failed", END)
    .compile();
}

function overwriteAnnotation(Annotation, defaultValue) {
  return Annotation({
    reducer: (_left, right) => right,
    default: () => defaultValue,
  });
}

async function prepareWorkbookNode(state) {
  const startedAt = new Date().toISOString();
  updateGraphProgress(state.options, {
    status: "running",
    currentNode: "prepare-workbook",
    events: state.events,
    message: "LangGraph 正在准备自动下载箱单数据。",
  });

  try {
    const runState = await preparePackingListAutoDownloadRun(state.options);
    const event = createGraphEvent({
      node: "prepare-workbook",
      status: "success",
      startedAt,
      message: "已读取箱单下载 Excel，并完成 NO / PO 批次准备。",
      detail: {
        totalGroupCount: runState.groups.length,
        totalPoCount: runState.poNumbers.length,
      },
    });
    updateGraphProgress(state.options, {
      status: "running",
      currentNode: "prepare-workbook",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "prepare-workbook",
      graphStatus: "running",
      runState,
      groupIndex: 0,
      groupResults: runState.skippedGroupResults || [],
      events: [event],
    };
  } catch (error) {
    return buildFailedNodeUpdate(state, error, "prepare-workbook", startedAt);
  }
}

async function createRequestSessionNode(state) {
  const startedAt = new Date().toISOString();
  updateGraphProgress(state.options, {
    status: "running",
    currentNode: "create-request-session",
    events: state.events,
    message: "LangGraph 正在准备 Infor Nexus 登录会话。",
  });

  try {
    const requestSession = await createPackingListAutoDownloadRequestSession(state.options);
    const event = createGraphEvent({
      node: "create-request-session",
      status: "success",
      startedAt,
      message: `Infor Nexus 登录会话已准备：${requestSession?.authMethod || "unknown"}。`,
      detail: {
        authMethod: requestSession?.authMethod || "",
      },
    });
    updateGraphProgress(state.options, {
      status: "running",
      currentNode: "create-request-session",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "create-request-session",
      graphStatus: "running",
      requestSession,
      events: [event],
    };
  } catch (error) {
    return buildFailedNodeUpdate(state, error, "create-request-session", startedAt);
  }
}

async function openPackingManifestNode(state) {
  const startedAt = new Date().toISOString();
  updateGraphProgress(state.options, {
    status: "running",
    currentNode: "open-packing-manifest",
    events: state.events,
    message: "LangGraph 正在启动浏览器并打开 PackingManifestView。",
  });

  try {
    const browserSession = await openPackingListAutoDownloadBrowserSession({
      ...state.options,
      groups: state.runState.groups,
      requestSession: state.requestSession,
    });
    const event = createGraphEvent({
      node: "open-packing-manifest",
      status: "success",
      startedAt,
      message: "已打开 Infor Nexus PackingManifest 查询页面。",
      detail: {
        authMethod: browserSession.authMethod,
        totalGroupCount: state.runState.groups.length,
      },
    });
    updateGraphProgress(state.options, {
      status: "running",
      currentNode: "open-packing-manifest",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "open-packing-manifest",
      graphStatus: "running",
      browserSession,
      events: [event],
    };
  } catch (error) {
    return buildFailedNodeUpdate(state, error, "open-packing-manifest", startedAt);
  }
}

async function processGroupNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group) {
    return {
      currentNode: "process-group",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
    };
  }

  updateGraphProgress(state.options, {
    status: state.graphStatus === "partial" ? "partial" : "running",
    currentNode: "process-group",
    events: state.events,
    message: `LangGraph 正在处理 NO ${group.no || state.groupIndex + 1}。`,
  });

  try {
    const { result, session } = await processPackingListAutoDownloadGraphGroup({
      ...state.options,
      group,
      groupIndex: state.groupIndex,
      groupResults: state.groupResults,
      groupTotal: groups.length,
      session: state.browserSession,
    });
    const nextGroupResults = [...(state.groupResults || []), result];
    const nextGroupIndex = state.groupIndex + 1;
    const graphStatus = state.graphStatus === "partial" || !result.ok ? "partial" : "running";
    const event = createGraphEvent({
      node: "process-group",
      status: result.ok ? "success" : "partial",
      startedAt,
      message: result.ok
        ? `NO ${result.no || group.no || ""} 已下载箱单。`
        : `NO ${result.no || group.no || ""} 未完成下载，继续后续批次。`,
      detail: {
        no: result.no || group.no || "",
        ok: Boolean(result.ok),
        groupIndex: nextGroupIndex,
        totalGroupCount: groups.length,
        attemptedPoCount: result.attemptedPoCount || 0,
        successfulPoNumber: result.successfulPoNumber || "",
        filePath: result.filePath || "",
        error: result.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: graphStatus,
      currentNode: "process-group",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "process-group",
      graphStatus,
      browserSession: session,
      groupIndex: nextGroupIndex,
      groupResults: nextGroupResults,
      events: [event],
    };
  } catch (error) {
    return buildFailedNodeUpdate(state, error, "process-group", startedAt);
  }
}

async function startGroupNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group) {
    return {
      currentNode: "start-group",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
    };
  }

  const event = createGraphEvent({
    node: "start-group",
    status: "success",
    startedAt,
    message: `开始处理 NO ${group.no || state.groupIndex + 1}。`,
    detail: {
      no: group.no || "",
      groupIndex: state.groupIndex + 1,
      totalGroupCount: groups.length,
      totalPoCount: Array.isArray(group.poNumbers) ? group.poNumbers.length : 0,
    },
  });
  updateGraphProgress(state.options, {
    status: state.graphStatus === "partial" ? "partial" : "running",
    currentNode: "start-group",
    events: [...(state.events || []), event],
    message: event.message,
  });

  return {
    currentNode: "start-group",
    graphStatus: state.graphStatus === "partial" ? "partial" : "running",
    poIndex: 0,
    groupAttempts: [],
    currentFilterAttempt: null,
    currentSearchAttempt: null,
    currentDownloadAttempt: null,
    currentGroupResult: null,
    events: [event],
  };
}

async function applyPoFilterNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group) {
    return {
      currentNode: "apply-po-filter",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
    };
  }

  try {
    const currentFilterAttempt = await preparePackingListPoFilterAttempt({
      ...state.options,
      attempts: state.groupAttempts,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      poIndex: state.poIndex,
      session: state.browserSession,
    });
    const status = currentFilterAttempt.ok ? "success" : "partial";
    const event = createGraphEvent({
      node: "apply-po-filter",
      status,
      startedAt,
      message: currentFilterAttempt.ok
        ? `PO ${currentFilterAttempt.poNumber || ""} 已完成 Apply。`
        : `PO 筛选未完成，记录失败并继续。`,
      detail: {
        no: group.no || "",
        poIndex: state.poIndex + 1,
        totalPoCount: Array.isArray(group.poNumbers) ? group.poNumbers.length : 0,
        error: currentFilterAttempt.attempt?.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: state.graphStatus === "partial" || !currentFilterAttempt.ok ? "partial" : "running",
      currentNode: "apply-po-filter",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "apply-po-filter",
      graphStatus: state.graphStatus === "partial" || !currentFilterAttempt.ok ? "partial" : "running",
      browserSession: currentFilterAttempt.session || state.browserSession,
      currentFilterAttempt,
      currentSearchAttempt: null,
      currentDownloadAttempt: null,
      events: [event],
    };
  } catch (error) {
    const attempt = await recordPackingListPoAttemptError({
      ...state.options,
      error,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      poIndex: state.poIndex,
      session: state.browserSession,
    });
    const event = createGraphEvent({
      node: "apply-po-filter",
      status: "partial",
      startedAt,
      message: attempt.error || "PO 筛选失败，继续下一个 PO。",
      detail: {
        no: group.no || "",
        poNumber: attempt.poNumber || "",
        error: attempt.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: "partial",
      currentNode: "apply-po-filter",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "apply-po-filter",
      graphStatus: "partial",
      currentFilterAttempt: {
        ok: false,
        attempt,
        session: state.browserSession,
      },
      events: [event],
    };
  }
}

async function openSearchResultNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group || !state.currentFilterAttempt?.ok) {
    const currentSearchAttempt = {
      ok: false,
      attempt: state.currentFilterAttempt?.attempt || null,
      session: state.currentFilterAttempt?.session || state.browserSession,
    };
    return {
      currentNode: "open-search-result",
      graphStatus: "partial",
      currentSearchAttempt,
    };
  }

  try {
    const currentSearchAttempt = await openPackingListPoSearchResultAttempt({
      ...state.options,
      fillResult: state.currentFilterAttempt.fillResult,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      poIndex: state.poIndex,
      session: state.currentFilterAttempt.session || state.browserSession,
    });
    const status = currentSearchAttempt.ok ? "success" : "partial";
    const event = createGraphEvent({
      node: "open-search-result",
      status,
      startedAt,
      message: currentSearchAttempt.ok
        ? `已找到 PO 的 PackingManifest 详情链接。`
        : `未找到 PO 的 PackingManifest 详情链接，继续下一个 PO。`,
      detail: {
        no: group.no || "",
        poIndex: state.poIndex + 1,
        linkSource: currentSearchAttempt.linkInfo?.source || "",
        error: currentSearchAttempt.attempt?.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: state.graphStatus === "partial" || !currentSearchAttempt.ok ? "partial" : "running",
      currentNode: "open-search-result",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "open-search-result",
      graphStatus: state.graphStatus === "partial" || !currentSearchAttempt.ok ? "partial" : "running",
      browserSession: currentSearchAttempt.session || state.browserSession,
      currentSearchAttempt,
      currentDownloadAttempt: null,
      events: [event],
    };
  } catch (error) {
    const attempt = await recordPackingListPoAttemptError({
      ...state.options,
      error,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      poIndex: state.poIndex,
      session: state.browserSession,
    });
    const event = createGraphEvent({
      node: "open-search-result",
      status: "partial",
      startedAt,
      message: attempt.error || "读取搜索结果失败，继续下一个 PO。",
      detail: {
        no: group.no || "",
        poNumber: attempt.poNumber || "",
        error: attempt.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: "partial",
      currentNode: "open-search-result",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "open-search-result",
      graphStatus: "partial",
      currentSearchAttempt: {
        ok: false,
        attempt,
        session: state.browserSession,
      },
      events: [event],
    };
  }
}

async function downloadPdfNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group || !state.currentSearchAttempt?.ok) {
    const currentDownloadAttempt = {
      ok: false,
      attempt: state.currentSearchAttempt?.attempt || state.currentFilterAttempt?.attempt || null,
      session: state.currentSearchAttempt?.session || state.browserSession,
    };
    return {
      currentNode: "download-pdf",
      graphStatus: "partial",
      currentDownloadAttempt,
    };
  }

  try {
    const currentDownloadAttempt = await downloadPackingListPoPdfAttempt({
      ...state.options,
      fillResult: state.currentFilterAttempt.fillResult,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      linkInfo: state.currentSearchAttempt.linkInfo,
      openResult: state.currentSearchAttempt.openResult,
      poIndex: state.poIndex,
      session: state.currentSearchAttempt.session || state.browserSession,
    });
    const event = createGraphEvent({
      node: "download-pdf",
      status: "success",
      startedAt,
      message: `NO ${currentDownloadAttempt.groupResult?.no || group.no || ""} 已下载箱单 PDF。`,
      detail: {
        no: currentDownloadAttempt.groupResult?.no || group.no || "",
        poNumber: currentDownloadAttempt.groupResult?.successfulPoNumber || "",
        filePath: currentDownloadAttempt.groupResult?.filePath || "",
      },
    });
    updateGraphProgress(state.options, {
      status: state.graphStatus === "partial" ? "partial" : "running",
      currentNode: "download-pdf",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "download-pdf",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
      browserSession: currentDownloadAttempt.session || state.browserSession,
      currentDownloadAttempt,
      currentGroupResult: currentDownloadAttempt.groupResult,
      events: [event],
    };
  } catch (error) {
    const attempt = await recordPackingListPoAttemptError({
      ...state.options,
      error,
      group,
      groupIndex: state.groupIndex,
      groupTotal: groups.length,
      poIndex: state.poIndex,
      session: state.browserSession,
    });
    const event = createGraphEvent({
      node: "download-pdf",
      status: "partial",
      startedAt,
      message: attempt.error || "下载 PDF 失败，继续下一个 PO。",
      detail: {
        no: group.no || "",
        poNumber: attempt.poNumber || "",
        error: attempt.error || "",
      },
    });
    updateGraphProgress(state.options, {
      status: "partial",
      currentNode: "download-pdf",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "download-pdf",
      graphStatus: "partial",
      currentDownloadAttempt: {
        ok: false,
        attempt,
        session: state.browserSession,
      },
      events: [event],
    };
  }
}

async function settlePoAttemptNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  const poNumbers = Array.isArray(group?.poNumbers) ? group.poNumbers : [];
  const previousAttempts = Array.isArray(state.groupAttempts) ? state.groupAttempts : [];
  const downloadAttempt = state.currentDownloadAttempt || {};

  if (downloadAttempt.ok && downloadAttempt.groupResult) {
    const successAttempt = downloadAttempt.attempt || null;
    const attempts = successAttempt
      ? [...previousAttempts, successAttempt]
      : previousAttempts;
    const groupResult = {
      ...downloadAttempt.groupResult,
      attemptedPoNumbers: attempts.map((item) => item.poNumber).filter(Boolean),
      attemptedPoCount: attempts.length,
      attempts,
    };
    const event = createGraphEvent({
      node: "settle-po-attempt",
      status: "success",
      startedAt,
      message: `NO ${groupResult.no || group?.no || ""} 已完成，进入下一个 NO。`,
      detail: {
        no: groupResult.no || group?.no || "",
        successfulPoNumber: groupResult.successfulPoNumber || "",
        attemptedPoCount: groupResult.attemptedPoCount || 0,
      },
    });
    updateGraphProgress(state.options, {
      status: state.graphStatus === "partial" ? "partial" : "running",
      currentNode: "settle-po-attempt",
      events: [...(state.events || []), event],
      message: event.message,
    });
    return {
      currentNode: "settle-po-attempt",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
      currentGroupResult: groupResult,
      groupAttempts: attempts,
      events: [event],
    };
  }

  const failedAttempt = downloadAttempt.attempt || state.currentSearchAttempt?.attempt || state.currentFilterAttempt?.attempt || null;
  const attempts = failedAttempt ? [...previousAttempts, failedAttempt] : previousAttempts;
  const event = createGraphEvent({
    node: "settle-po-attempt",
    status: "partial",
    startedAt,
    message: failedAttempt?.error || "当前 PO 未完成，继续下一个 PO。",
    detail: {
      no: group?.no || "",
      poNumber: failedAttempt?.poNumber || poNumbers[state.poIndex] || "",
      poIndex: state.poIndex + 1,
      totalPoCount: poNumbers.length,
    },
  });
  updateGraphProgress(state.options, {
    status: "partial",
    currentNode: "settle-po-attempt",
    events: [...(state.events || []), event],
    message: event.message,
  });
  return {
    currentNode: "settle-po-attempt",
    graphStatus: "partial",
    groupAttempts: attempts,
    poIndex: state.poIndex + 1,
    currentFilterAttempt: null,
    currentSearchAttempt: null,
    currentDownloadAttempt: null,
    events: [event],
  };
}

async function finishGroupNode(state) {
  const startedAt = new Date().toISOString();
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group) {
    return {
      currentNode: "finish-group",
      graphStatus: state.graphStatus === "partial" ? "partial" : "running",
    };
  }

  const groupResult = state.currentGroupResult || buildPackingListAutoDownloadFailedGroupResult({
    group,
    attempts: state.groupAttempts || [],
  });
  const groupResults = [...(state.groupResults || []), groupResult];
  await updatePackingListAutoDownloadGroupProgress({
    activeRun: state.options?.activeRun,
    groupResults,
    groupTotal: groups.length,
    session: state.browserSession,
  });

  const graphStatus = state.graphStatus === "partial" || !groupResult.ok ? "partial" : "running";
  const event = createGraphEvent({
    node: "finish-group",
    status: groupResult.ok ? "success" : "partial",
    startedAt,
    message: groupResult.ok
      ? `NO ${groupResult.no || group.no || ""} 已归档成功。`
      : `NO ${groupResult.no || group.no || ""} 已归档失败，继续后续 NO。`,
    detail: {
      no: groupResult.no || group.no || "",
      ok: Boolean(groupResult.ok),
      groupIndex: state.groupIndex + 1,
      totalGroupCount: groups.length,
      attemptedPoCount: groupResult.attemptedPoCount || 0,
      successfulPoNumber: groupResult.successfulPoNumber || "",
      filePath: groupResult.filePath || "",
      error: groupResult.error || "",
    },
  });
  updateGraphProgress(state.options, {
    status: graphStatus,
    currentNode: "finish-group",
    events: [...(state.events || []), event],
    message: event.message,
  });
  await persistPackingListCheckpoint(state, {
    event,
    groupResult,
    groupResults,
    status: graphStatus,
  });
  return {
    currentNode: "finish-group",
    graphStatus,
    groupIndex: state.groupIndex + 1,
    groupResults,
    poIndex: 0,
    groupAttempts: [],
    currentFilterAttempt: null,
    currentSearchAttempt: null,
    currentDownloadAttempt: null,
    currentGroupResult: null,
    events: [event],
  };
}

async function finalizeNode(state) {
  const startedAt = new Date().toISOString();
  updateGraphProgress(state.options, {
    status: state.graphStatus === "partial" ? "partial" : "running",
    currentNode: "finalize",
    events: state.events,
    message: "LangGraph 正在汇总箱单下载结果并关闭浏览器。",
  });

  try {
    const browserResult = await finalizePackingListAutoDownloadBrowserSession({
      ...state.options,
      groups: state.runState.allGroups || state.runState.groups,
      groupResults: state.groupResults,
      session: state.browserSession,
    });
    const result = buildPackingListAutoDownloadResult({
      ...state.options,
      browserResult,
      requestSession: state.requestSession,
      runState: state.runState,
    });
    await closePackingListAutoDownloadBrowserSession(state.browserSession);
    const finalStatus = result.ok ? "success" : "partial";
    const event = createGraphEvent({
      node: "finalize",
      status: finalStatus,
      startedAt,
      message: result.message || "自动下载箱单流程图已完成。",
      detail: {
        totalGroupCount: result.totalGroupCount,
        downloadedPackingListCount: result.downloadedPackingListCount,
        failedPackingListCount: result.failedPackingListCount,
      },
    });
    const events = [...(state.events || []), event];
    const metadata = buildLangGraphMetadata({
      ...state,
      currentNode: "finalize",
      graphStatus: finalStatus,
      events,
    });
    updateGraphProgress(state.options, {
      status: finalStatus,
      currentNode: "finalize",
      events,
      message: event.message,
    });
    await persistPackingListCheckpoint({
      ...state,
      graphStatus: finalStatus,
      events,
    }, {
      event,
      groupResults: state.groupResults,
      result: {
        ...result,
        langGraph: metadata,
      },
      status: finalStatus,
    });
    return {
      currentNode: "finalize",
      graphStatus: finalStatus,
      browserResult,
      browserSession: null,
      result: {
        ...result,
        langGraph: metadata,
      },
      events: [event],
    };
  } catch (error) {
    return buildFailedNodeUpdate(state, error, "finalize", startedAt);
  }
}

async function failedNode(state) {
  const startedAt = new Date().toISOString();
  const error = state.error || new Error("自动下载箱单流程图执行失败。");
  const page = state.browserSession?.pageRef?.current || state.browserSession?.page || null;
  if (page && !page.isClosed?.() && state.options?.config?.keepBrowserOpenOnErrorMs > 0) {
    await page.waitForTimeout(state.options.config.keepBrowserOpenOnErrorMs).catch(() => {});
  }
  await closePackingListAutoDownloadBrowserSession(state.browserSession);
  const event = createGraphEvent({
    node: "failed",
    status: "failed",
    startedAt,
    message: error.message || "自动下载箱单流程图已进入失败终态。",
    detail: {
      name: error.name || "Error",
      statusCode: error.statusCode || 500,
    },
  });
  const events = [...(state.events || []), event];
  updateGraphProgress(state.options, {
    status: "failed",
    currentNode: "failed",
    events,
    message: event.message,
  });
  await persistPackingListCheckpoint(
    {
      ...state,
      graphStatus: "interrupted",
      events,
    },
    {
      event,
      groupResults: state.groupResults || [],
      status: "interrupted",
    },
  );
  return {
    currentNode: "failed",
    graphStatus: "failed",
    browserSession: null,
    error,
    events: [event],
  };
}

async function persistPackingListCheckpoint(state, input) {
  const checkpointConfig = state.options?.checkpoint;
  if (!checkpointConfig?.enabled || !checkpointConfig.backendBaseUrl || !checkpointConfig.batchId) {
    return;
  }
  const runState = state.runState || {};
  const allGroups = Array.isArray(runState.allGroups) ? runState.allGroups : (runState.groups || []);
  const groupResults = Array.isArray(input.groupResults) ? input.groupResults : (state.groupResults || []);
  const checkpoint = buildPackingListCheckpointSnapshot({
    allGroups,
    event: input.event,
    groupResults,
    mode: checkpointConfig.mode || state.options?.resumeMode || "continue",
    result: input.result,
  });
  const files = await buildPackingListCheckpointFiles(input);
  const payload = {
    runId: checkpointConfig.runId || state.options?.activeRun?.runId || "",
    attemptId: checkpointConfig.attemptId || "",
    mode: checkpointConfig.mode || state.options?.resumeMode || "continue",
    status: input.status || state.graphStatus || "running",
    message: input.event?.message || input.result?.message || "",
    checkpoint,
    groupResult: input.groupResult || null,
    result: input.result || null,
    files,
  };
  const url = `${String(checkpointConfig.backendBaseUrl).replace(/\/+$/, "")}/api/automation/packing-list-auto-download/batches/${encodeURIComponent(checkpointConfig.batchId)}/checkpoint`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`checkpoint HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
  } catch (error) {
    state.options?.log?.("Packing List checkpoint persistence failed.", {
      batchId: checkpointConfig.batchId,
      attemptId: checkpointConfig.attemptId,
      message: error instanceof Error ? error.message : String(error || ""),
    });
  }
}

function buildPackingListCheckpointSnapshot({ allGroups, event, groupResults, mode, result }) {
  const byNo = new Map();
  for (const groupResult of groupResults || []) {
    const no = String(groupResult?.no || "").trim();
    if (!no) continue;
    byNo.set(no, groupResult);
  }
  const items = (allGroups || []).map((group) => {
    const no = String(group?.no || "").trim();
    const groupResult = byNo.get(no);
    if (!groupResult) {
      return {
        no,
        status: "pending",
        message: "",
        poNumbers: group?.poNumbers || [],
      };
    }
    return {
      no,
      status: groupResult.ok ? "success" : "failed",
      message: groupResult.error || "",
      poNumbers: groupResult.poNumbers || group?.poNumbers || [],
      successfulPoNumber: groupResult.successfulPoNumber || "",
      downloadedFilePath: groupResult.filePath || "",
      updatedAt: event?.finishedAt || new Date().toISOString(),
    };
  });
  const completedCount = items.filter((item) => item.status === "success").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const totalCount = items.length;
  return {
    mode,
    status: result?.ok ? "success" : (failedCount > 0 ? "partial" : "running"),
    message: result?.message || event?.message || "",
    totalCount,
    completedCount,
    failedCount,
    pendingCount: Math.max(0, totalCount - completedCount - failedCount),
    items,
    groupResults,
    result: result || null,
    lastEvent: event || null,
    updatedAt: new Date().toISOString(),
  };
}

async function buildPackingListCheckpointFiles(input) {
  const files = [];
  const groupResult = input.groupResult;
  if (groupResult?.ok && groupResult.filePath) {
    const content = await readFile(groupResult.filePath).catch(() => null);
    if (content) {
      files.push({
        fileName: groupResult.fileName || `Packing list ${groupResult.no || "download"}.pdf`,
        fileRole: "packing_list_pdf",
        contentType: "application/pdf",
        contentBase64: content.toString("base64"),
      });
    }
  }
  if (input.result) {
    const resultContent = Buffer.from(JSON.stringify(input.result, null, 2), "utf8");
    files.push({
      fileName: "result.json",
      fileRole: "result_json",
      contentType: "application/json; charset=utf-8",
      contentBase64: resultContent.toString("base64"),
    });
  }
  return files;
}

function routeAfterStep(state) {
  return state.error ? "failed" : "next";
}

function routeAfterOpen(state) {
  if (state.error) return "failed";
  const groups = state.runState?.groups || [];
  return groups.length > 0 ? "process" : "finalize";
}

function routeAfterStartGroup(state) {
  if (state.error) return "failed";
  const groups = state.runState?.groups || [];
  const group = groups[state.groupIndex];
  if (!group) return "finalize";
  const poNumbers = Array.isArray(group.poNumbers)
    ? group.poNumbers.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return poNumbers.length > 0 ? "apply" : "finish";
}

function routeAfterApplyFilter(state) {
  if (state.error) return "failed";
  return state.currentFilterAttempt?.ok ? "open" : "settle";
}

function routeAfterOpenSearchResult(state) {
  if (state.error) return "failed";
  return state.currentSearchAttempt?.ok ? "download" : "settle";
}

function routeAfterSettlePoAttempt(state) {
  if (state.error) return "failed";
  if (state.currentGroupResult?.ok) return "finish";
  const group = state.runState?.groups?.[state.groupIndex];
  const poNumbers = Array.isArray(group?.poNumbers)
    ? group.poNumbers.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return state.poIndex < poNumbers.length ? "apply" : "finish";
}

function routeAfterFinishGroup(state) {
  if (state.error) return "failed";
  const groups = state.runState?.groups || [];
  return state.groupIndex < groups.length ? "process" : "finalize";
}

function routeAfterProcessGroup(state) {
  if (state.error) return "failed";
  const groups = state.runState?.groups || [];
  return state.groupIndex < groups.length ? "process" : "finalize";
}

function routeAfterFinalize(state) {
  return state.error ? "failed" : "complete";
}

function buildFailedNodeUpdate(state, error, node, startedAt) {
  const event = createGraphEvent({
    node,
    status: "failed",
    startedAt,
    message: error?.message || `${node} failed.`,
    detail: {
      name: error?.name || "Error",
      statusCode: error?.statusCode || 500,
    },
  });
  updateGraphProgress(state.options, {
    status: "failed",
    currentNode: node,
    events: [...(state.events || []), event],
    message: event.message,
  });
  return {
    currentNode: node,
    graphStatus: "failed",
    error,
    events: [event],
  };
}

function createGraphEvent(input) {
  const startedAt = input.startedAt || new Date().toISOString();
  const finishedAt = new Date().toISOString();
  return {
    graph: GRAPH_NAME,
    node: input.node,
    status: input.status,
    message: input.message || "",
    detail: input.detail || null,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
  };
}

function buildLangGraphMetadata(state) {
  const events = Array.isArray(state?.events) ? state.events : [];
  const startedAt = state?.graphStartedAt || events[0]?.startedAt || new Date().toISOString();
  const finishedAt = events[events.length - 1]?.finishedAt || new Date().toISOString();
  return {
    enabled: true,
    graph: GRAPH_NAME,
    status: state?.graphStatus || "unknown",
    currentNode: state?.currentNode || "",
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    nodeCount: events.length,
    processedGroupCount: Array.isArray(state?.groupResults) ? state.groupResults.length : 0,
    events,
  };
}

function updateGraphProgress(options, patch) {
  const activeRun = options?.activeRun;
  if (!activeRun || typeof activeRun !== "object") {
    return;
  }
  const existingProgress = activeRun.progress || {};
  const events = Array.isArray(patch.events) ? patch.events.slice(-30) : [];
  activeRun.progress = {
    ...existingProgress,
    graphEngine: "LangGraph",
    langGraph: {
      enabled: true,
      graph: GRAPH_NAME,
      status: patch.status || "running",
      currentNode: patch.currentNode || "",
      events,
      updatedAt: new Date().toISOString(),
    },
    graphStatus: patch.status || "running",
    graphNode: patch.currentNode || "",
    message: patch.message || existingProgress.message,
    updatedAt: new Date().toISOString(),
  };
}
