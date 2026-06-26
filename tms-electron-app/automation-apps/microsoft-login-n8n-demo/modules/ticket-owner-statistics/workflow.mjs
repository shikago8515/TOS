import { persistTicketOwnerStatisticsArtifacts } from "./artifacts.mjs";
import { collectTicketOwnerStatistics } from "./task-center-page.mjs";
import { resolveTicketOwnerRow } from "./ticket-fields.mjs";

export async function runTicketOwnerStatisticsWorkflow(deps, { runOptions, body, moduleDefinition }) {
  if (body?.simulate === true) {
    const collection = buildSimulatedTicketOwnerStatistics(body);
    const artifacts = await persistTicketOwnerStatisticsArtifacts(deps, collection);
    return buildWorkflowResult({
      loginSuccess: true,
      finalUrl: "simulation://sap-btp-task-center",
      message: "模拟请求已生成 Ticket ownership Excel。",
      moduleDefinition,
      collection: {
        ...collection,
        artifacts,
      },
      workflowMode: "ticket-owner-statistics-simulated",
      simulated: true,
    });
  }

  const loginResult = await deps.runLogin([], {
    ...runOptions,
    maxTicketCount: normalizePositiveInteger(body?.maxTicketCount, 200),
    maxTicketAttemptCount: normalizePositiveInteger(body?.maxTicketAttemptCount, undefined),
    workflowMode: "ticket-owner-statistics",
    workflowLabel: moduleDefinition.title,
    successMessage: "已完成 SAP BTP ticket 归属采集，并生成 Ticket ownership Excel。",
    afterLogin: async (page, options) => {
      const collection = await collectTicketOwnerStatistics(page, options);
      const artifacts = await persistTicketOwnerStatisticsArtifacts(deps, collection);
      return {
        ...collection,
        artifacts,
      };
    },
  });

  const collection = loginResult.workflowResult || null;
  if (collection) {
    loginResult.ticketOwnerStatistics = buildTicketOwnerStatisticsPayload(collection);
    loginResult.artifacts = collection.artifacts;
    loginResult.ok = Boolean(loginResult.loginSuccess && collection.ok);
    loginResult.message = collection.message || loginResult.message;
  }

  return loginResult;
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

function buildTicketOwnerStatisticsPayload(collection) {
  return {
    rowCount: collection.rowCount ?? 0,
    failedTicketCount: collection.failedTicketCount ?? 0,
    attemptedTicketCount: collection.attemptedTicketCount ?? 0,
    selectedTaskTypes: collection.selectedTaskTypes || [],
    ticketResults: collection.ticketResults || [],
    failedTickets: collection.failedTickets || [],
    expectedOutput: "Ticket ownership.xlsx",
    generatedWorkbookName: collection.artifacts?.workbookFileName || "Ticket ownership.xlsx",
  };
}

function buildSimulatedTicketOwnerStatistics(body) {
  const simulatedRows = Array.isArray(body?.simulatedRows) && body.simulatedRows.length > 0
    ? body.simulatedRows
    : defaultSimulatedRows();
  const rows = simulatedRows.map((item) => resolveTicketOwnerRow(item.task || item, item.detail || item));
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

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
