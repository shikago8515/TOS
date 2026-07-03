import { persistTicketOwnerStatisticsArtifacts } from "./artifacts.mjs";
import { collectTicketOwnerStatistics } from "./task-center-page.mjs";
import { resolveTicketOwnerRow } from "./ticket-fields.mjs";
import {
  buildTicketOwnerExcelLookups,
  enrichTicketOwnerRowsWithExcelLookups,
} from "./excel-lookups.mjs";
import {
  buildTicketOwnerCheckpointFromCollection,
  createTicketOwnerCheckpointWriter,
  mergeTicketOwnerCollectionWithCheckpoint,
  shouldSkipTicketOwnerCollection,
} from "./checkpoint.mjs";

const GRAPH_NAME = "ticket-owner-statistics";

export async function runTicketOwnerStatisticsLangGraphWorkflow(deps, context) {
  const initialState = {
    deps,
    body: context.body || {},
    runOptions: context.runOptions || {},
    moduleDefinition: context.moduleDefinition,
    reportProgress: context.reportProgress,
    startedAt: context.startedAt || new Date().toISOString(),
    graphStartedAt: new Date().toISOString(),
    events: [],
    currentNode: "",
    graphStatus: "running",
    excelLookups: null,
    checkpointWriter: null,
    collection: null,
    loginResult: null,
    artifacts: null,
    result: null,
    error: null,
  };

  const langGraph = await loadLangGraph();
  const finishedState = langGraph
    ? await runCompiledGraph(langGraph, initialState)
    : await runSequentialGraph(initialState);

  if (finishedState.result) {
    return attachGraphSummary(finishedState.result, finishedState, Boolean(langGraph));
  }
  return attachGraphSummary(buildFailureResult(finishedState), finishedState, Boolean(langGraph));
}

async function loadLangGraph() {
  try {
    return await import("@langchain/langgraph");
  } catch (_error) {
    return null;
  }
}

async function runCompiledGraph(langGraph, initialState) {
  const { Annotation, END, START, StateGraph } = langGraph;
  const State = Annotation.Root({
    deps: overwriteAnnotation(Annotation, null),
    body: overwriteAnnotation(Annotation, {}),
    runOptions: overwriteAnnotation(Annotation, {}),
    moduleDefinition: overwriteAnnotation(Annotation, null),
    reportProgress: overwriteAnnotation(Annotation, null),
    startedAt: overwriteAnnotation(Annotation, ""),
    graphStartedAt: overwriteAnnotation(Annotation, ""),
    graphStatus: overwriteAnnotation(Annotation, "running"),
    currentNode: overwriteAnnotation(Annotation, ""),
    excelLookups: overwriteAnnotation(Annotation, null),
    checkpointWriter: overwriteAnnotation(Annotation, null),
    collection: overwriteAnnotation(Annotation, null),
    loginResult: overwriteAnnotation(Annotation, null),
    artifacts: overwriteAnnotation(Annotation, null),
    result: overwriteAnnotation(Annotation, null),
    error: overwriteAnnotation(Annotation, null),
    events: Annotation({
      reducer: (left, right) => [...(left || []), ...(right || [])],
      default: () => [],
    }),
  });

  const graph = new StateGraph(State)
    .addNode("prepare-input", prepareInputNode)
    .addNode("load-checkpoint", loadCheckpointNode)
    .addNode("plan-items", planItemsNode)
    .addNode("ensure-session", ensureSessionNode)
    .addNode("process-ticket-pages", processTicketPagesNode)
    .addNode("store-artifacts", storeArtifactsNode)
    .addNode("write-final-checkpoint", writeFinalCheckpointNode)
    .addNode("finalize-batch", finalizeBatchNode)
    .addNode("handle-interruption", handleInterruptionNode)
    .addEdge(START, "prepare-input")
    .addConditionalEdges("prepare-input", routeAfterNode, { next: "load-checkpoint", failed: "handle-interruption" })
    .addConditionalEdges("load-checkpoint", routeAfterNode, { next: "plan-items", failed: "handle-interruption" })
    .addConditionalEdges("plan-items", routeAfterPlan, { next: "ensure-session", finalize: "finalize-batch", failed: "handle-interruption" })
    .addConditionalEdges("ensure-session", routeAfterNode, { next: "process-ticket-pages", failed: "handle-interruption" })
    .addConditionalEdges("process-ticket-pages", routeAfterNode, { next: "store-artifacts", failed: "handle-interruption" })
    .addConditionalEdges("store-artifacts", routeAfterNode, { next: "write-final-checkpoint", failed: "handle-interruption" })
    .addConditionalEdges("write-final-checkpoint", routeAfterNode, { next: "finalize-batch", failed: "handle-interruption" })
    .addEdge("finalize-batch", END)
    .addEdge("handle-interruption", END)
    .compile();

  return await graph.invoke(initialState);
}

async function runSequentialGraph(initialState) {
  let state = initialState;
  for (const node of [
    prepareInputNode,
    loadCheckpointNode,
    planItemsNode,
    ensureSessionNode,
    processTicketPagesNode,
    storeArtifactsNode,
    writeFinalCheckpointNode,
    finalizeBatchNode,
  ]) {
    const update = await node(state);
    state = mergeState(state, update);
    if (state.error) {
      return mergeState(state, await handleInterruptionNode(state));
    }
    if (state.result) {
      return state;
    }
  }
  return state;
}

async function prepareInputNode(state) {
  const startedAt = new Date().toISOString();
  try {
    const checkpointWriter = createTicketOwnerCheckpointWriter(state.body);
    console.info("[ticket-owner-statistics] checkpoint writer prepared", {
      enabled: checkpointWriter.enabled,
      backendBaseUrl: Boolean(checkpointWriter.backendBaseUrl),
      batchId: checkpointWriter.batchId,
      attemptId: checkpointWriter.attemptId,
      mode: checkpointWriter.mode,
    });
    if (!checkpointWriter.enabled) {
      logCheckpointWriteFailure("prepare-input-disabled", new Error("ticket owner checkpoint writer is disabled"), {
        backendBaseUrl: Boolean(checkpointWriter.backendBaseUrl),
        batchId: Boolean(checkpointWriter.batchId),
        attemptId: Boolean(checkpointWriter.attemptId),
        mode: checkpointWriter.mode,
      });
    }
    const excelLookups = buildTicketOwnerExcelLookups(state.deps.xlsx, state.body);
    await checkpointWriter.write({
      status: "running",
      event: "prepare-input",
      message: "正在准备 ticket 归属统计输入。",
      checkpoint: {
        status: "running",
        event: "prepare-input",
        message: "正在准备 ticket 归属统计输入。",
        sourceFiles: readSourceFileSummary(state.body),
      },
    }).catch((error) => logCheckpointWriteFailure("prepare-input", error));
    return nodeSuccess("prepare-input", startedAt, "已准备 ticket 归属统计输入。", {
      checkpointWriter,
      excelLookups,
    });
  } catch (error) {
    return nodeFailure("prepare-input", startedAt, error);
  }
}

async function loadCheckpointNode(state) {
  const startedAt = new Date().toISOString();
  const checkpointWriter = state.checkpointWriter;
  try {
    await checkpointWriter.write({
      status: "running",
      event: "checkpoint-loaded",
      message: "正在读取断点状态。",
      checkpoint: {
        status: "running",
        event: "checkpoint-loaded",
        message: "正在读取断点状态。",
        resumeMode: checkpointWriter.mode,
        snapshotStatus: checkpointWriter.snapshot?.status || "",
      },
    }).catch((error) => logCheckpointWriteFailure("checkpoint-loaded", error));
    return nodeSuccess("load-checkpoint", startedAt, "已读取断点状态。");
  } catch (error) {
    return nodeFailure("load-checkpoint", startedAt, error);
  }
}

async function planItemsNode(state) {
  const startedAt = new Date().toISOString();
  try {
    if (shouldSkipTicketOwnerCollection(state.checkpointWriter)) {
      const snapshotResult = state.checkpointWriter.snapshot?.result || {};
      const collection = {
        ok: true,
        resumedFromCheckpoint: true,
        rowCount: Number(snapshotResult.rowCount || 0),
        failedTicketCount: Number(snapshotResult.failedTicketCount || 0),
        attemptedTicketCount: Number(snapshotResult.attemptedTicketCount || 0),
        rows: Array.isArray(snapshotResult.rows) ? snapshotResult.rows : [],
        ticketResults: Array.isArray(state.checkpointWriter.snapshot?.items) ? state.checkpointWriter.snapshot.items : [],
        failedTickets: Array.isArray(snapshotResult.failedTickets) ? snapshotResult.failedTickets : [],
        selectedTaskTypes: [],
        message: "该批次已完成，已从断点状态恢复结果。",
      };
      return nodeSuccess("plan-items", startedAt, "该批次已完成，跳过重复采集。", {
        collection,
        loginResult: buildWorkflowResult({
          loginSuccess: true,
          finalUrl: "checkpoint://ticket-owner-statistics",
          message: collection.message,
          moduleDefinition: state.moduleDefinition,
          collection,
          workflowMode: "ticket-owner-statistics-checkpoint",
          simulated: false,
        }),
      });
    }
    return nodeSuccess("plan-items", startedAt, "已规划 ticket 采集任务。");
  } catch (error) {
    return nodeFailure("plan-items", startedAt, error);
  }
}

async function ensureSessionNode(state) {
  const startedAt = new Date().toISOString();
  try {
    state.reportProgress?.({
      phase: "ensure-session",
      message: "正在准备 Microsoft / SAP BTP 会话。",
      percent: 8,
    });
    await state.checkpointWriter.write({
      status: "running",
      event: "ensure-session",
      message: "正在准备 Microsoft / SAP BTP 会话。",
      checkpoint: {
        status: "running",
        event: "ensure-session",
        message: "正在准备 Microsoft / SAP BTP 会话。",
      },
    }).catch((error) => logCheckpointWriteFailure("ensure-session", error));
    return nodeSuccess("ensure-session", startedAt, "已进入会话准备节点。");
  } catch (error) {
    return nodeFailure("ensure-session", startedAt, error);
  }
}

async function processTicketPagesNode(state) {
  const startedAt = new Date().toISOString();
  if (state.collection && state.loginResult) {
    return nodeSuccess("process-ticket-pages", startedAt, "已从断点恢复采集结果。");
  }
  try {
    if (state.body?.simulate === true) {
      const collection = buildSimulatedTicketOwnerStatistics(state.body, state.excelLookups);
      return nodeSuccess("process-ticket-pages", startedAt, collection.message, {
        collection,
        loginResult: buildWorkflowResult({
          loginSuccess: true,
          finalUrl: "simulation://sap-btp-task-center",
          message: "模拟请求已生成 Ticket ownership Excel。",
          moduleDefinition: state.moduleDefinition,
          collection,
          workflowMode: "ticket-owner-statistics-simulated",
          simulated: true,
        }),
      });
    }

    const itemEvents = [];
    const reportProgress = (progress) => {
      state.checkpointWriter.writeProgress(progress);
      state.reportProgress?.(progress);
    };
    const loginResult = await state.deps.runLogin([], {
      ...state.runOptions,
      maxTicketCount: normalizePositiveInteger(state.body?.maxTicketCount, 200),
      maxTicketAttemptCount: normalizePositiveInteger(state.body?.maxTicketAttemptCount, undefined),
      maxTaskLookupCount: normalizePositiveInteger(state.body?.maxTaskLookupCount, undefined),
      requestLookupConcurrency: normalizePositiveInteger(state.body?.requestLookupConcurrency, undefined),
      detailConcurrency: normalizePositiveInteger(state.body?.detailConcurrency, 6),
      detailPageTimeoutMs: normalizePositiveInteger(state.body?.detailPageTimeoutMs, 18000),
      requestFirst: state.body?.requestFirst !== false,
      diagnoseOnly: state.body?.diagnoseOnly === true,
      diagnoseOpenUiLinks: state.body?.diagnoseOpenUiLinks === true,
      diagnoseAppSources: state.body?.diagnoseAppSources === true,
      diagnoseSkipODataLookup: state.body?.diagnoseSkipODataLookup === true,
      diagnoseWorkflowTaskOnly: state.body?.diagnoseWorkflowTaskOnly === true,
      diagnoseUiLinkCount: normalizePositiveInteger(state.body?.diagnoseUiLinkCount, undefined),
      diagnoseUiLinkWaitMs: normalizePositiveInteger(state.body?.diagnoseUiLinkWaitMs, undefined),
      detailFirst: typeof state.body?.detailFirst === "boolean" ? state.body.detailFirst : undefined,
      sampleAcrossBranches: state.body?.sampleAcrossBranches === true,
      excelLookups: state.excelLookups,
      reportProgress,
      workflowMode: "ticket-owner-statistics",
      workflowLabel: state.moduleDefinition.title,
      successMessage: "已完成 SAP BTP ticket 归属采集，并生成 Ticket ownership Excel。",
      afterLogin: async (page, options) => {
        await state.checkpointWriter.write({
          status: "running",
          event: "item-started",
          message: "正在读取 Task Center ticket 列表。",
          checkpoint: {
            status: "running",
            event: "item-started",
            message: "正在读取 Task Center ticket 列表。",
          },
        }).catch(() => null);
        return await collectTicketOwnerStatistics(page, {
          ...options,
          checkpointSnapshot: state.checkpointWriter.snapshot || {},
          shouldSkipTicketOwnerItem: (candidate) => state.checkpointWriter.shouldSkipItem(candidate),
          onTicketOwnerItemResult: async (itemResult, progress) => {
            const itemStartedAt = new Date().toISOString();
            itemEvents.push(createGraphEvent({
              node: "process-ticket-item",
              status: itemResult?.ok === false ? "failed" : "success",
              startedAt: itemStartedAt,
              message: buildTicketItemEventMessage(itemResult),
            }));
            await state.checkpointWriter.writeItemResult({
              graphNode: "process-ticket-item",
              ...itemResult,
            }, progress);
            itemEvents.push(createGraphEvent({
              node: "write-item-checkpoint",
              status: "success",
              startedAt: itemStartedAt,
              message: buildTicketItemCheckpointMessage(itemResult),
            }));
          },
        });
      },
    });

    const collection = loginResult.workflowResult
      ? mergeTicketOwnerCollectionWithCheckpoint(loginResult.workflowResult, state.checkpointWriter)
      : null;
    if (collection) {
      collection.graphItemEvents = itemEvents;
      loginResult.workflowResult = collection;
      loginResult.ticketOwnerStatistics = buildTicketOwnerStatisticsPayload(collection);
      loginResult.ok = Boolean(loginResult.loginSuccess && collection.ok);
      loginResult.message = collection.message || loginResult.message;
    }

    return nodeSuccess("process-ticket-pages", startedAt, loginResult.message || "ticket 页面采集已完成。", {
      loginResult,
      collection,
      events: itemEvents,
    });
  } catch (error) {
    return nodeFailure("process-ticket-pages", startedAt, error);
  }
}

async function storeArtifactsNode(state) {
  const startedAt = new Date().toISOString();
  try {
    if (!state.collection) {
      return nodeSuccess("store-artifacts", startedAt, "没有可归档的 ticket 结果。");
    }
    const artifacts = await persistTicketOwnerStatisticsArtifacts(state.deps, state.collection);
    const collection = {
      ...state.collection,
      artifacts,
    };
    const loginResult = state.loginResult ? {
      ...state.loginResult,
      workflowResult: collection,
      ticketOwnerStatistics: buildTicketOwnerStatisticsPayload(collection),
      artifacts,
    } : null;
    return nodeSuccess("store-artifacts", startedAt, "本机结果文件已生成。", {
      artifacts,
      collection,
      loginResult,
    });
  } catch (error) {
    return nodeFailure("store-artifacts", startedAt, error);
  }
}

async function writeFinalCheckpointNode(state) {
  const startedAt = new Date().toISOString();
  try {
    if (!state.collection) {
      return nodeSuccess("write-final-checkpoint", startedAt, "没有结果需要写入断点。");
    }
    const failedCount = Number(state.collection.failedTicketCount || 0);
    const completedCount = Number(state.collection.rowCount || state.collection.rows?.length || 0);
    const status = state.collection.ok === false
      ? (completedCount > 0 ? "partial" : "failed")
      : (failedCount > 0 ? "partial" : "success");
    const checkpoint = buildTicketOwnerCheckpointFromCollection(state.collection, {
      status,
      event: "batch-finalized",
      message: state.collection.message || "Ticket ownership Excel 已生成。",
    });
    const checkpointResponse = await state.checkpointWriter.write({
      status,
      event: "batch-finalized",
      message: checkpoint.message,
      checkpoint,
      result: {
        ...state.collection,
        artifacts: state.artifacts || state.collection.artifacts || null,
      },
    }).catch((error) => ({ checkpointError: error?.message || String(error) }));
    const publicCheckpoint = checkpointResponse?.batch?.checkpoint || checkpoint;
    const collection = {
      ...state.collection,
      checkpoint: publicCheckpoint,
    };
    const loginResult = state.loginResult ? {
      ...state.loginResult,
      workflowResult: collection,
      ticketOwnerStatistics: buildTicketOwnerStatisticsPayload(collection),
      artifacts: collection.artifacts,
      checkpoint: publicCheckpoint,
      storedFiles: publicCheckpoint.storedFiles || [],
    } : null;
    return nodeSuccess("write-final-checkpoint", startedAt, "后端断点和结果文件已写入。", {
      collection,
      loginResult,
    });
  } catch (error) {
    return nodeFailure("write-final-checkpoint", startedAt, error);
  }
}

async function finalizeBatchNode(state) {
  const startedAt = new Date().toISOString();
  try {
    const loginResult = state.loginResult || buildFailureResult(state);
    return nodeSuccess("finalize-batch", startedAt, loginResult.message || "ticket 归属统计已结束。", {
      result: loginResult,
      graphStatus: loginResult.ok ? "success" : "partial",
    });
  } catch (error) {
    return nodeFailure("finalize-batch", startedAt, error);
  }
}

async function handleInterruptionNode(state) {
  const startedAt = new Date().toISOString();
  const message = formatErrorMessage(state.error) || "ticket 归属统计执行被中断。";
  await state.checkpointWriter?.write?.({
    status: "interrupted",
    event: "browser-interrupted",
    message,
    checkpoint: {
      status: "interrupted",
      event: "browser-interrupted",
      message,
      updatedAt: new Date().toISOString(),
    },
  }).catch(() => null);
  const result = buildFailureResult({ ...state, message });
  return nodeSuccess("handle-interruption", startedAt, message, {
    result,
    graphStatus: "interrupted",
  });
}

function routeAfterNode(state) {
  return state.error ? "failed" : "next";
}

function routeAfterPlan(state) {
  if (state.error) return "failed";
  if (state.collection && state.loginResult) return "finalize";
  return "next";
}

function overwriteAnnotation(Annotation, defaultValue) {
  return Annotation({
    reducer: (_left, right) => right,
    default: () => defaultValue,
  });
}

function mergeState(left, right) {
  return {
    ...left,
    ...right,
    events: [...(left.events || []), ...(right.events || [])],
  };
}

function nodeSuccess(node, startedAt, message, extra = {}) {
  const finishedAt = new Date().toISOString();
  const extraEvents = Array.isArray(extra.events) ? extra.events : [];
  const { events: _events, ...rest } = extra;
  return {
    ...rest,
    currentNode: node,
    events: [
      ...extraEvents,
      createGraphEvent({ node, status: "success", startedAt, finishedAt, message }),
    ],
  };
}

function nodeFailure(node, startedAt, error) {
  const finishedAt = new Date().toISOString();
  return {
    currentNode: node,
    error: {
      node,
      message: formatErrorMessage(error),
      stack: error?.stack || "",
    },
    events: [createGraphEvent({ node, status: "failed", startedAt, finishedAt, message: formatErrorMessage(error) })],
  };
}

function createGraphEvent({ node, status, startedAt, finishedAt = new Date().toISOString(), message }) {
  return {
    graph: GRAPH_NAME,
    node,
    status,
    message,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
  };
}

function logCheckpointWriteFailure(stage, error, details = {}) {
  const message = error?.message || String(error || "unknown checkpoint write failure");
  console.warn("[ticket-owner-statistics] checkpoint write skipped", {
    stage,
    message,
    ...details,
  });
}

function buildTicketItemEventMessage(itemResult = {}) {
  const label = itemResult.caseNumber || itemResult.taskKey || itemResult.itemKey || "ticket";
  if (itemResult.ok === false) {
    return `ticket item failed: ${label}`;
  }
  return `ticket item processed: ${label}`;
}

function buildTicketItemCheckpointMessage(itemResult = {}) {
  const label = itemResult.caseNumber || itemResult.taskKey || itemResult.itemKey || "ticket";
  return `ticket item checkpoint written: ${label}`;
}

function attachGraphSummary(result, state, langGraphLoaded) {
  const finishedAt = new Date().toISOString();
  return {
    ...result,
    langGraph: {
      enabled: true,
      libraryLoaded: langGraphLoaded,
      graph: GRAPH_NAME,
      mode: langGraphLoaded ? "state-graph" : "sequential-state-graph",
      status: state.graphStatus || (result.ok ? "success" : "partial"),
      currentNode: state.currentNode || "",
      startedAt: state.graphStartedAt,
      finishedAt,
      durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(state.graphStartedAt).getTime()),
      nodeCount: Array.isArray(state.events) ? state.events.length : 0,
      checkpointEnabled: Boolean(state.checkpointWriter?.enabled),
      batchId: state.checkpointWriter?.batchId || "",
      attemptId: state.checkpointWriter?.attemptId || "",
      resumeMode: state.checkpointWriter?.mode || "new",
      events: state.events || [],
    },
  };
}

function buildWorkflowResult({
  loginSuccess,
  finalUrl,
  message,
  moduleDefinition,
  collection,
  workflowMode,
  simulated,
}) {
  return {
    ok: Boolean(collection.ok),
    loginSuccess,
    uploadedRowCount: 0,
    generatedAt: new Date().toISOString(),
    finalUrl,
    title: moduleDefinition.title,
    pageTextSnippet: simulated ? "Simulated SAP BTP Task Center ticket ownership run." : "",
    visibleError: "",
    rowsPreview: [],
    taskCenter: null,
    workflowResult: collection,
    workflowMode,
    workflowLabel: moduleDefinition.title,
    simulated: Boolean(simulated),
    ticketOwnerStatistics: buildTicketOwnerStatisticsPayload(collection),
    artifacts: collection.artifacts,
    message,
  };
}

function buildFailureResult(state) {
  const message = state.message || formatErrorMessage(state.error) || "ticket 归属统计执行失败。";
  return {
    ok: false,
    loginSuccess: false,
    uploadedRowCount: 0,
    generatedAt: new Date().toISOString(),
    finalUrl: "",
    title: state.moduleDefinition?.title || GRAPH_NAME,
    workflowMode: "ticket-owner-statistics",
    workflowLabel: state.moduleDefinition?.title || GRAPH_NAME,
    workflowResult: state.collection || null,
    ticketOwnerStatistics: buildTicketOwnerStatisticsPayload(state.collection || {}),
    artifacts: state.collection?.artifacts || null,
    checkpoint: state.collection?.checkpoint || null,
    message,
  };
}

function buildTicketOwnerStatisticsPayload(collection) {
  return {
    rowCount: collection.rowCount ?? 0,
    failedTicketCount: collection.failedTicketCount ?? 0,
    attemptedTicketCount: collection.attemptedTicketCount ?? 0,
    selectedTaskTypes: collection.selectedTaskTypes || [],
    ticketResults: collection.ticketResults || [],
    failedTickets: collection.failedTickets || [],
    graphItemEvents: collection.graphItemEvents || [],
    requestFirst: collection.requestFirst || null,
    odataLookup: collection.odataLookup || null,
    excelLookup: collection.excelLookup || null,
    uiLinkDiagnostics: collection.uiLinkDiagnostics || [],
    expectedOutput: "Ticket ownership.xlsx",
    generatedWorkbookName: collection.artifacts?.workbookFileName || "Ticket ownership.xlsx",
  };
}

function buildSimulatedTicketOwnerStatistics(body, excelLookups) {
  const simulatedRows = Array.isArray(body?.simulatedRows) && body.simulatedRows.length > 0
    ? body.simulatedRows
    : defaultSimulatedRows();
  const rows = enrichTicketOwnerRowsWithExcelLookups(
    simulatedRows.map((item) => resolveTicketOwnerRow(item.task || item, item.detail || item)),
    excelLookups
  );
  const ticketResults = rows.map((row, index) => ({
    ok: true,
    simulated: true,
    taskKey: `simulated-${index + 1}`,
    branchId: row.branchId,
    caseNumber: row["Case Number"],
    taskType: row["Task Type"],
    request: row.Request,
    poNumber: row["PO Number"],
    workingNumber: row["Working Number"],
    row,
    warnings: [],
    claim: {
      clicked: false,
      simulated: true,
    },
    openInApp: {
      openedIn: "simulated",
      finalUrl: "simulation://sap-btp-task-center/open-in-app",
      title: "Simulated My Inbox",
    },
  }));

  return {
    ok: true,
    simulated: true,
    rowCount: rows.length,
    failedTicketCount: 0,
    attemptedTicketCount: rows.length,
    selectedTaskTypes: [
      "Provide Feedback",
      "Review Main Ticket Resolution",
      "Review Sub-Ticket Resolution",
    ],
    rows,
    ticketResults,
    failedTickets: [],
    finalTaskCenterUrl: "simulation://sap-btp-task-center",
    excelLookup: excelLookups?.summary || null,
    message: `模拟请求已生成 ${rows.length} 条 Ticket ownership 记录。`,
  };
}

function defaultSimulatedRows() {
  return [
    {
      caseNumber: "10682971",
      taskType: "Provide Feedback",
      request: "Transport Mode Change",
      poNumber: "0902793368",
      workingNumber: "RC2606OW001",
    },
    {
      caseNumber: "GTS82580",
      taskType: "Review Main Ticket Resolution",
      request: "Order Cancellation",
      poNumber: "4501913718",
      workingNumber: "RC2617OW009",
    },
    {
      caseNumber: "GTS71240-3",
      taskType: "Review Sub-Ticket Resolution",
      request: "Bulk - Additional Support on WFM",
      poNumber: "0901943835",
      releaseLookupWorkingNumber: "RC2610OM005",
    },
  ];
}

function readSourceFileSummary(body) {
  const releaseLookupFiles = Array.isArray(body.releaseLookupFiles) ? body.releaseLookupFiles : [];
  const factoryPriceFiles = Array.isArray(body.factoryPriceFiles) ? body.factoryPriceFiles : [];
  return {
    releaseLookupFileName: body.releaseLookupFileName || releaseLookupFiles.map((file) => file?.fileName || file?.name || "").filter(Boolean).join(", "),
    releaseLookupFileCount: releaseLookupFiles.length || (body.releaseLookupFileName ? 1 : 0),
    factoryPriceFileName: body.factoryPriceFileName || factoryPriceFiles.map((file) => file?.fileName || file?.name || "").filter(Boolean).join(", "),
    factoryPriceFileCount: factoryPriceFiles.length || (body.factoryPriceFileName ? 1 : 0),
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || String(error);
}
