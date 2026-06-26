import {
  normalizeText,
  resolveTicketOwnerRow,
} from "./ticket-fields.mjs";

const MAIN_SERVICE_BASE = "/zscmnggtstkfs.comadidasproductsupplyzscmnggtstkfs/v2/main-service/";
const DECISIONS_SERVICE_BASE = "/zscpoadecfs.comadidasproductsupplyzscpoadecfs/v2/make-decisions/";
const WORKFLOW_RUNTIME_BASES = [
  "/comsapspaprocessautomation.comsapspainbox/~4f0f2ece-6dff-48d2-9fef-baea8f87263d~/bpmworkflowruntime/v1/tcm/",
  "/comsapspaprocessautomation.comsapspainbox/bpmworkflowruntime/v1/tcm/",
];

const REQUIRED_OUTPUT_FIELDS = [
  "Case Number",
  "Task Type",
  "Request",
  "PO Number",
  "Working Number",
];

export async function buildTicketOwnerRowsFromTaskCenterTasks(page, tasks, options = {}) {
  const maxTicketCount = normalizePositiveInteger(options.maxTicketCount, 200);
  const maxTaskLookupCount = normalizePositiveInteger(
    options.maxTaskLookupCount,
    Math.max(maxTicketCount * 5, 10)
  );
  const lookupCache = new Map();
  const rows = [];
  const ticketResults = [];
  const failedTickets = [];
  const lookupDiagnostics = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (rows.length >= maxTicketCount) {
      break;
    }
    if (lookupDiagnostics.length >= maxTaskLookupCount) {
      break;
    }
    if (!isSupportedTaskType(task.taskType)) {
      continue;
    }

    const base = taskToBaseFields(task);
    const lookup = await resolveTicketLookup(page, base, task, lookupCache, options);
    lookupDiagnostics.push({
      caseNumber: base.caseNumber,
      taskType: base.taskType,
      poNumber: base.poNumber,
      resolvedPoNumber: lookup.poNumber,
      workingNumber: lookup.workingNumber,
      requestId: lookup.requestId,
      userTaskId: lookup.userTaskId,
      source: lookup.source,
      attempts: lookup.attempts,
    });

    const row = resolveTicketOwnerRow({
      caseNumber: base.caseNumber,
      taskType: base.taskType,
      request: base.request,
      poNumber: lookup.poNumber || base.poNumber,
      workingNumber: lookup.workingNumber || base.workingNumber,
    });
    const missingFields = collectMissingRequiredFields(row);

    if (missingFields.length > 0) {
      failedTickets.push({
        ok: false,
        requestFirst: true,
        caseNumber: base.caseNumber,
        taskType: base.taskType,
        request: base.request,
        poNumber: lookup.poNumber || base.poNumber,
        missingFields,
        message: `request-first OData lookup missing: ${missingFields.join(", ")}`,
      });
      continue;
    }

    rows.push(row);
    ticketResults.push({
      ok: true,
      requestFirst: true,
      odataLookup: true,
      taskKey: `${base.caseNumber}|${base.taskType}|${lookup.poNumber || base.poNumber}`,
      branchId: row.branchId,
      caseNumber: row["Case Number"],
      taskType: row["Task Type"],
      request: row.Request,
      poNumber: row["PO Number"],
      workingNumber: row["Working Number"],
      source: lookup.source,
      warnings: [],
    });
  }

  return {
    rows,
    ticketResults,
    failedTickets,
    lookupDiagnostics,
  };
}

async function resolveTicketLookup(page, base, task, cache, options = {}) {
  const cacheKey = [base.caseNumber, base.poNumber].map(normalizeText).join("|");
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const attempts = [];
  let poNumber = base.poNumber;
  let workingNumber = base.workingNumber;
  let source = "";
  let requestId = base.requestId;
  let userTaskId = base.userTaskId;

  if (!requestId) {
    const workflowLookup = await lookupWorkflowContextByTask(page, task, attempts);
    requestId = workflowLookup.requestId || requestId;
    userTaskId = workflowLookup.userTaskId || userTaskId;
    source = workflowLookup.source || source;
  }

  if (options.workflowTaskOnly) {
    const result = {
      poNumber,
      workingNumber,
      requestId,
      userTaskId,
      source,
      attempts,
    };
    cache.set(cacheKey, result);
    return result;
  }

  if (requestId) {
    const requestLookup = await lookupDecisionRequestItems(page, requestId, userTaskId, poNumber, attempts);
    poNumber = requestLookup.poNumber || poNumber;
    workingNumber = requestLookup.workingNumber || workingNumber;
    source = requestLookup.source || source;
  }

  if (!poNumber && base.caseNumber) {
    const ticketLookup = await lookupTicketPoAndWorkingNumber(page, base.caseNumber, attempts);
    poNumber = ticketLookup.poNumber || poNumber;
    workingNumber = ticketLookup.workingNumber || workingNumber;
    source = ticketLookup.source || source;
  }

  if (requestId && poNumber && !workingNumber) {
    const poLookup = await lookupWorkingNumberByPo(page, poNumber, attempts);
    workingNumber = poLookup.workingNumber || workingNumber;
    source = poLookup.source || source;
  }

  const result = {
    poNumber,
    workingNumber,
    requestId,
    userTaskId,
    source,
    attempts,
  };
  cache.set(cacheKey, result);
  return result;
}

async function lookupTicketPoAndWorkingNumber(page, caseNumber, attempts) {
  const ticketFilters = [
    `BTPTicketNumber eq '${escapeODataString(caseNumber)}'`,
    `substringof('${escapeODataString(caseNumber)}',BTPTicketNumber)`,
  ];
  const ticketEntitySets = [
    "ProcessRequest_SubTicket",
    "ProcessRequests",
    "ServiceProcessRequestSearchApp",
  ];

  for (const entitySet of ticketEntitySets) {
    for (const filter of ticketFilters) {
      const ticketResponse = await odataGet(page, MAIN_SERVICE_BASE, entitySet, {
        "$filter": filter,
        "$select": "RequestID,mainRequestID,BTPTicketNumber,requestArea,requestAreaName,RequestCategory_ID,subject",
        "$top": "5",
      });
      attempts.push(summarizeODataAttempt("ticket", entitySet, filter, ticketResponse));
      const ticket = firstODataResult(ticketResponse);
      const requestId = normalizeODataValue(ticket?.RequestID);
      const mainRequestId = normalizeODataValue(ticket?.mainRequestID);
      const detailLookup = await lookupRequestDetails(page, requestId, mainRequestId, attempts);
      if (detailLookup.poNumber || detailLookup.workingNumber) {
        return detailLookup;
      }
    }
  }

  return {
    poNumber: "",
    workingNumber: "",
    source: "",
  };
}

async function lookupWorkflowContextByTask(page, task, attempts) {
  const taskInstanceId = extractTaskInstanceId(task);
  if (!taskInstanceId) {
    return {
      requestId: "",
      userTaskId: "",
      source: "",
    };
  }

  for (const base of WORKFLOW_RUNTIME_BASES) {
    const encodedKey = `TaskCollection(SAP__Origin='NA',InstanceID='${escapeODataString(taskInstanceId)}')`;
    const response = await odataGetPath(page, `${base}${encodedKey}`, {
      "$format": "json",
      "$expand": "CustomAttributeData",
    });
    attempts.push(summarizeODataAttempt("workflow-task", "TaskCollection", taskInstanceId, response));
    const item = firstODataResult(response);
    const attributes = collectWorkflowTaskAttributes(item);
    const requestId = pickFirstValue(
      attributes.workflowId,
      attributes.WorkflowId,
      attributes.RequestID,
      attributes.requestId,
      attributes.workflowInstanceId,
      item?.workflowId,
      item?.WorkflowId,
      item?.RequestID,
      parseWorkflowIdFromText(JSON.stringify(item || {}))
    );
    const userTaskId = pickFirstValue(item?.InstanceID, item?.TaskInstanceID, taskInstanceId);
    if (requestId || (response.ok && item)) {
      return {
        requestId,
        userTaskId,
        source: `${base}TaskCollection`,
      };
    }
  }

  return {
    requestId: "",
    userTaskId: taskInstanceId,
    source: "",
  };
}

async function lookupDecisionRequestItems(page, requestId, userTaskId, preferredPoNumber, attempts) {
  const keyPath = `ProcessRequests_Head(guid'${escapeODataString(requestId)}')`;
  const response = await odataGetPath(page, `${DECISIONS_SERVICE_BASE}${keyPath}`, {
    "$format": "json",
    "$expand": "Items",
    userTaskId,
  });
  attempts.push(summarizeODataAttempt("decision-head", "ProcessRequests_Head", requestId, response));
  const head = firstODataResult(response);
  const items = extractODataResults(head?.Items || head?.to_Items || response?.json?.d?.Items);
  const selected = pickItemByPo(items, preferredPoNumber) || items[0] || null;
  const poNumber = pickFirstValue(
    selected?.POContractNumber,
    selected?.s4PONumber,
    selected?.s4marketPoNumber,
    selected?.purchaseOrderNumber,
    selected?.marketPurchaseOrderNumber,
    head?.POContractNumber
  );
  const workingNumber = pickFirstValue(
    selected?.workingNumber,
    selected?.WorkingNumber,
    head?.workingNumber
  );
  if (poNumber || workingNumber) {
    return {
      poNumber,
      workingNumber,
      source: "ProcessRequests_Head/Items",
    };
  }

  const itemResponse = await odataGet(page, DECISIONS_SERVICE_BASE, "ProcessRequests_Items", {
    "$filter": `RequestID eq guid'${escapeODataString(requestId)}'`,
    "$select": "RequestID,POContractNumber,POContractItem,workingNumber",
    "$top": "20",
    userTaskId,
  });
  attempts.push(summarizeODataAttempt("decision-items", "ProcessRequests_Items", requestId, itemResponse));
  const item = pickItemByPo(extractODataResults(itemResponse?.json), preferredPoNumber)
    || firstODataResult(itemResponse);
  return {
    poNumber: pickFirstValue(item?.POContractNumber, item?.s4PONumber, item?.s4marketPoNumber),
    workingNumber: pickFirstValue(item?.workingNumber, item?.WorkingNumber),
    source: item ? "ProcessRequests_Items" : "",
  };
}

async function lookupRequestDetails(page, requestId, mainRequestId, attempts) {
  const ids = [requestId, mainRequestId].map(normalizeText).filter(Boolean);
  const entities = [
    {
      entitySet: "ProcessRequests_Details_AggregationTree",
      select: "RequestID,POContractNumber,marketPurchaseOrderNumber,workingNumber",
    },
    {
      entitySet: "MainAndSubProcessRequestItems",
      select: "RequestID,mainRequestID,BTPTicketNumber,POContractNumber,s4marketPoNumber,contractNumber",
    },
    {
      entitySet: "DetailsWithSingleItem",
      select: "RequestID,POContractNumber,s4PONumber,s4marketPoNumber,contractNumber",
    },
    {
      entitySet: "ProcessRequest_Details",
      select: "RequestID,POContractNumber,marketPurchaseOrderNumber",
    },
  ];

  for (const id of ids) {
    for (const entity of entities) {
      for (const field of ["RequestID", "mainRequestID"]) {
        const filter = `${field} eq guid'${escapeODataString(id)}'`;
        const response = await odataGet(page, MAIN_SERVICE_BASE, entity.entitySet, {
          "$filter": filter,
          "$select": entity.select,
          "$top": "10",
        });
        attempts.push(summarizeODataAttempt("request-detail", entity.entitySet, filter, response));
        const item = firstODataResult(response);
        const poNumber = pickFirstValue(
          item?.POContractNumber,
          item?.s4PONumber,
          item?.marketPurchaseOrderNumber,
          item?.s4marketPoNumber,
          item?.contractNumber
        );
        const workingNumber = normalizeODataValue(item?.workingNumber);
        if (poNumber || workingNumber) {
          return {
            poNumber,
            workingNumber,
            source: `${entity.entitySet}:${field}`,
          };
        }
      }
    }
  }

  return {
    poNumber: "",
    workingNumber: "",
    source: "",
  };
}

async function lookupWorkingNumberByPo(page, poNumber, attempts) {
  const escapedPo = escapeODataString(poNumber);
  const filters = [
    `POContractNumber eq '${escapedPo}'`,
    `purchaseOrderNumber eq '${escapedPo}'`,
    `marketPurchaseOrderNumber eq '${escapedPo}'`,
    `purchaseOrderOrMarketPurchaseOrderNumber eq '${escapedPo}'`,
    `legacyPONumber eq '${escapedPo}'`,
  ];
  const queryTargets = [
    {
      base: MAIN_SERVICE_BASE,
      entitySet: "PurchaseOrders",
      select: "POContractNumber,purchaseOrderNumber,marketPurchaseOrderNumber,purchaseOrderOrMarketPurchaseOrderNumber,workingNumber",
    },
    {
      base: MAIN_SERVICE_BASE,
      entitySet: "PurchaseOrdersExt",
      select: "POContractNumber,purchaseOrderNumber,marketPurchaseOrderNumber,purchaseOrderOrMarketPurchaseOrderNumber,workingNumber,factoryCode",
    },
    {
      base: MAIN_SERVICE_BASE,
      entitySet: "PurchaseOrderItems",
      select: "POContractNumber,POContractItem,workingNumber",
    },
    {
      base: MAIN_SERVICE_BASE,
      entitySet: "PurchaseOrderItemsExt",
      select: "POContractNumber,POContractItem,workingNumber,factoryCode",
    },
    {
      base: DECISIONS_SERVICE_BASE,
      entitySet: "PurchaseOrders",
      select: "POContractNumber,purchaseOrderNumber,marketPurchaseOrderNumber,purchaseOrderOrMarketPurchaseOrderNumber,workingNumber",
    },
    {
      base: DECISIONS_SERVICE_BASE,
      entitySet: "PurchaseOrderItems",
      select: "POContractNumber,POContractItem,workingNumber",
    },
  ];

  for (const target of queryTargets) {
    for (const filter of filters) {
      const response = await odataGet(page, target.base, target.entitySet, {
        "$filter": filter,
        "$select": target.select,
        "$top": "5",
      });
      attempts.push(summarizeODataAttempt("po-working", target.entitySet, filter, response));
      const item = firstODataResult(response);
      const workingNumber = normalizeODataValue(item?.workingNumber);
      if (workingNumber) {
        return {
          workingNumber,
          source: `${target.entitySet}:${filter}`,
        };
      }
    }
  }

  return {
    workingNumber: "",
    source: "",
  };
}

async function odataGet(page, basePath, entitySet, params = {}) {
  const path = `${basePath}${entitySet}`;
  const query = {
    "$format": "json",
    ...params,
  };
  return page.evaluate(async ({ path, query }) => {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(query)) {
      if (value != null && String(value) !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "accept": "application/json",
      },
    });
    const text = await response.text();
    clearTimeout(timer);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      url: url.toString(),
      json,
      textSnippet: text.slice(0, 800),
    };
  }, { path, query }).catch((error) => ({
    ok: false,
    status: 0,
    url: path,
    json: null,
    textSnippet: "",
    error: error?.message || "OData request failed",
  }));
}

async function odataGetPath(page, path, params = {}) {
  const query = {
    "$format": "json",
    ...params,
  };
  return page.evaluate(async ({ path, query }) => {
    const url = new URL(path, window.location.origin);
    for (const [key, value] of Object.entries(query)) {
      if (value != null && String(value) !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
      headers: {
        "accept": "application/json",
      },
    });
    const text = await response.text();
    clearTimeout(timer);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      url: url.toString(),
      json,
      textSnippet: text.slice(0, 1200),
    };
  }, { path, query }).catch((error) => ({
    ok: false,
    status: 0,
    url: path,
    json: null,
    textSnippet: "",
    error: error?.message || "OData request failed",
  }));
}

function firstODataResult(response) {
  const results = extractODataResults(response?.json);
  return results[0] || null;
}

function extractODataResults(json) {
  if (!json) {
    return [];
  }
  if (Array.isArray(json.value)) {
    return json.value;
  }
  if (Array.isArray(json.d?.results)) {
    return json.d.results;
  }
  if (Array.isArray(json.results)) {
    return json.results;
  }
  if (json.d && typeof json.d === "object") {
    return [json.d];
  }
  if (typeof json === "object") {
    return [json];
  }
  return [];
}

function summarizeODataAttempt(kind, entitySet, filter, response) {
  const first = firstODataResult(response) || {};
  return {
    kind,
    entitySet,
    filter,
    ok: Boolean(response?.ok),
    status: response?.status || 0,
    resultCount: extractODataResults(response?.json).length,
    firstKeys: Object.keys(first).slice(0, 80),
    importantValues: collectImportantAttemptValues(first),
    error: response?.error || "",
    snippet: normalizeText(response?.textSnippet).slice(0, 1200),
  };
}

function taskToBaseFields(task) {
  const named = task.namedCustomAttributes || {};
  return {
    caseNumber: normalizeODataValue(task.caseNumber || named["BTP Ticket No"]),
    taskType: normalizeODataValue(task.taskType),
    requestId: pickFirstValue(named.workflowId, named.WorkflowId, named.RequestID, named.requestId),
    userTaskId: extractTaskInstanceId(task),
    request: resolveRequestValue(task),
    poNumber: pickFirstValue(
      named["S4 PO No"],
      named["S4 Market PO No"],
      named.POContractNumber,
      named.purchaseOrderNumber,
      named.marketPurchaseOrderNumber
    ),
    workingNumber: pickFirstValue(named.workingNumber, named["Working Number"]),
  };
}

function extractTaskInstanceId(task) {
  const uiLink = normalizeText(task?.uiLink);
  const uiMatch = uiLink.match(/InstanceID='([^']+)'/i) || uiLink.match(/\/detail_deep\/[^/]+\/([^/]+)/i);
  if (uiMatch) {
    return uiMatch[1];
  }

  const urn = normalizeText(task?.urn);
  const urnMatch = urn.match(/:([0-9a-f]{8}-[0-9a-f-]{27,})$/i);
  return urnMatch ? urnMatch[1] : normalizeText(task?.localId);
}

function collectWorkflowTaskAttributes(task) {
  const attributes = {};
  const customAttributes = task?.CustomAttributeData?.results
    || task?.CustomAttributeData
    || task?.customAttributeData?.results
    || task?.customAttributeData
    || task?.CustomAttributes?.results
    || task?.CustomAttributes
    || [];

  for (const item of Array.isArray(customAttributes) ? customAttributes : []) {
    const name = normalizeODataValue(
      item.Name || item.name || item.Label || item.label || item.AttributeName || item.attributeName
    );
    const value = pickFirstValue(
      item.Value,
      item.value,
      item.Text,
      item.text,
      item.StringValue,
      item.stringValue
    );
    if (name && value) {
      attributes[name] = value;
    }
  }

  for (const [key, value] of Object.entries(task || {})) {
    if (/workflow|request|step/i.test(key)) {
      attributes[key] = pickFirstValue(value);
    }
    const workflowId = parseWorkflowIdFromText(value);
    if (workflowId && !attributes.workflowId) {
      attributes.workflowId = workflowId;
    }
  }

  return attributes;
}

function collectImportantAttemptValues(item) {
  const important = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (/workflow|request|url|link|custom|step|context|application|task/i.test(key)) {
      const normalized = typeof value === "object"
        ? normalizeText(JSON.stringify(value)).slice(0, 500)
        : normalizeText(value);
      if (normalized) {
        important[key] = normalized;
      }
    }
  }
  const workflowId = parseWorkflowIdFromText(JSON.stringify(item || {}));
  if (workflowId) {
    important.parsedWorkflowId = workflowId;
  }
  return important;
}

function parseWorkflowIdFromText(value) {
  const rawText = normalizeText(value);
  const decodedText = safeDecodeURIComponent(rawText);
  const text = `${rawText} ${decodedText}`;
  const match = text.match(/workflowId[=:'"% ]+([0-9a-f]{8}-[0-9a-f-]{27,})/i)
    || text.match(/RequestID[=:'"% ]+([0-9a-f]{8}-[0-9a-f-]{27,})/i);
  return match ? match[1] : "";
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function pickItemByPo(items, preferredPoNumber) {
  const normalizedPo = normalizeODataValue(preferredPoNumber);
  if (!normalizedPo || !Array.isArray(items)) {
    return null;
  }
  return items.find((item) => {
    return [
      item?.POContractNumber,
      item?.s4PONumber,
      item?.s4marketPoNumber,
      item?.purchaseOrderNumber,
      item?.marketPurchaseOrderNumber,
    ].map(normalizeODataValue).includes(normalizedPo);
  }) || null;
}

function resolveRequestValue(task) {
  const named = task.namedCustomAttributes || {};
  const taskType = normalizeText(task.taskType).toLowerCase();
  if (taskType.includes("review sub")) {
    return pickFirstValue(named["Request Area"], named["Request Category"], named["Type Of Process"]);
  }
  return pickFirstValue(named["Type Of Process"], named["Request Area"], named["Request Category"], named["Task Of Process"]);
}

function pickFirstValue(...values) {
  for (const value of values) {
    const normalized = normalizeODataValue(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function normalizeODataValue(value) {
  const normalized = normalizeText(value);
  return normalized && normalized.toLowerCase() !== "null" ? normalized : "";
}

function isSupportedTaskType(taskType) {
  const normalized = normalizeText(taskType).toLowerCase();
  return (
    normalized.includes("provide feedback") ||
    normalized.includes("review main ticket resolution") ||
    normalized.includes("review sub-ticket resolution")
  );
}

function collectMissingRequiredFields(row) {
  return REQUIRED_OUTPUT_FIELDS.filter((field) => !normalizeText(row?.[field]));
}

function escapeODataString(value) {
  return String(value || "").replace(/'/g, "''");
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
