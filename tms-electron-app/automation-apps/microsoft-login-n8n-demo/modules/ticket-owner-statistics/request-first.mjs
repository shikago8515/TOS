import {
  extractTaskInfoFromText,
  extractTicketFieldsFromText,
  normalizeText,
  resolveTicketOwnerRow,
} from "./ticket-fields.mjs";

const RELEVANT_URL_PATTERN = /(task|workflow|inbox|bpm|odata|process|ticket|case|gts|release|unrelease|factory|price|purchase|po|s4|opu|api)/i;
const RELEVANT_TEXT_PATTERN = /(Provide Feedback|Review Main Ticket Resolution|Review Sub-Ticket Resolution|PO Number|Working Number|Case Number|Task Type|Request|Release|Unrelease|Factory Price|S4 PO|BTP Ticket|RC\d{4,})/i;

export function createTaskCenterRequestRecorder(page, options = {}) {
  const records = [];
  const maxBodyChars = Number(options.maxBodyChars || 120000);
  const maxRecords = Number(options.maxRecords || 220);
  const eventTarget = options.scope === "page"
    ? page
    : page.context?.() || page;

  async function handleResponse(response) {
    if (records.length >= maxRecords) {
      return;
    }

    const url = response.url();
    const contentType = response.headers()["content-type"] || "";
    if (!isRelevantResponse(url, contentType)) {
      return;
    }

    const record = {
      url,
      status: response.status(),
      method: response.request()?.method?.() || "",
      contentType,
      bodyKind: "",
      bodySnippet: "",
      json: null,
      error: "",
    };

    try {
      const text = await response.text();
      if (!RELEVANT_TEXT_PATTERN.test(text) && !RELEVANT_URL_PATTERN.test(url)) {
        return;
      }

      record.bodySnippet = normalizeText(text).slice(0, maxBodyChars);
      if (contentType.toLowerCase().includes("json") || looksLikeJson(text)) {
        record.bodyKind = "json";
        record.json = JSON.parse(text);
      } else {
        record.bodyKind = "text";
      }
    } catch (error) {
      record.error = error?.message || "response body read failed";
    }

    records.push(record);
  }

  eventTarget.on("response", handleResponse);

  return {
    records,
    stop() {
      eventTarget.off("response", handleResponse);
    },
    summarize() {
      return summarizeTaskCenterRequestRecords(records);
    },
  };
}

export function extractTicketOwnerRowsFromRequestRecords(records) {
  const candidates = [];
  const seen = new Set();

  for (const record of Array.isArray(records) ? records : []) {
    const sourceItems = collectRecordSourceItems(record);
    for (const item of sourceItems) {
      const task = extractTaskInfoFromText(item.text);
      const detail = extractTicketFieldsFromText(item.text, task);
      const row = resolveTicketOwnerRow(task, detail);
      const key = [
        row["Case Number"],
        row["Task Type"],
        row.Request,
        row["PO Number"],
        row["Working Number"],
      ].join("|");

      if (seen.has(key) || !row["Task Type"]) {
        continue;
      }

      seen.add(key);
      candidates.push({
        row,
        sourceUrl: record.url,
        sourcePath: item.path,
        completeness: scoreRowCompleteness(row),
        missingFields: collectMissingFields(row),
        sourceSnippet: item.text.slice(0, 800),
      });
    }
  }

  candidates.sort((left, right) => right.completeness - left.completeness);
  return candidates;
}

export function summarizeTaskCenterRequestRecords(records) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const urls = [];
  for (const record of normalizedRecords) {
    const item = {
      status: record.status,
      method: record.method,
      bodyKind: record.bodyKind,
      url: trimUrl(record.url),
      snippet: normalizeText(record.bodySnippet).slice(0, 260),
      error: record.error || "",
    };
    urls.push(item);
  }

  const candidates = extractTicketOwnerRowsFromRequestRecords(normalizedRecords);
  const taskSamples = extractTaskCenterTasksFromRequestRecords(normalizedRecords);
  return {
    recordCount: normalizedRecords.length,
    candidateCount: candidates.length,
    completeCandidateCount: candidates.filter((item) => item.missingFields.length === 0).length,
    endpointGroups: groupRecordsByEndpoint(normalizedRecords),
    taskDefinitionHints: extractTaskDefinitionHints(normalizedRecords),
    taskSamples: taskSamples.slice(0, 40),
    manifestHints: extractManifestHints(normalizedRecords),
    odataMetadataHints: extractODataMetadataHints(normalizedRecords),
    uiLinkSamples: taskSamples
      .filter((item) => item.uiLink)
      .slice(0, 20)
      .map((item) => ({
        caseNumber: item.caseNumber,
        taskType: item.taskType,
        status: item.status,
        uiLink: item.uiLink,
      })),
    records: urls,
    candidates: candidates.slice(0, 10).map((item) => ({
      row: item.row,
      missingFields: item.missingFields,
      sourceUrl: trimUrl(item.sourceUrl),
      sourcePath: item.sourcePath,
      sourceSnippet: item.sourceSnippet,
    })),
  };
}

export function extractTaskCenterTasksFromRequestRecords(records) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const definitionLookup = buildTaskDefinitionLookup(extractTaskDefinitionHints(normalizedRecords));
  const tasks = [];
  const seen = new Set();

  for (const record of normalizedRecords) {
    if (!record?.json || !isTaskListEndpoint(record.url)) {
      continue;
    }

    for (const task of collectTaskObjects(record.json)) {
      const summary = summarizeTaskCenterTask(task, definitionLookup);
      if (!summary.urn && !summary.subject) {
        continue;
      }

      const key = summary.urn || [summary.caseNumber, summary.taskType, summary.uiLink].join("|");
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tasks.push(summary);
    }
  }

  return tasks;
}

function isRelevantResponse(url, contentType) {
  const lowerType = String(contentType || "").toLowerCase();
  return (
    RELEVANT_URL_PATTERN.test(url) &&
    (
      lowerType.includes("json") ||
      lowerType.includes("text") ||
      lowerType.includes("xml") ||
      lowerType.includes("html") ||
      !lowerType
    )
  );
}

function collectRecordSourceItems(record) {
  const items = [];
  if (record?.json) {
    walkJson(record.json, "$", items);
  }

  const snippet = normalizeText(record?.bodySnippet);
  if (snippet) {
    items.push({
      path: "$body",
      text: snippet,
    });
  }

  return items.filter((item) => RELEVANT_TEXT_PATTERN.test(item.text));
}

function groupRecordsByEndpoint(records) {
  const groups = new Map();
  for (const record of records) {
    const key = endpointKey(record.url);
    if (!groups.has(key)) {
      groups.set(key, {
        endpoint: key,
        count: 0,
        methods: new Set(),
        statuses: new Set(),
        exampleUrl: trimUrl(record.url),
        bodyKinds: new Set(),
      });
    }

    const group = groups.get(key);
    group.count += 1;
    if (record.method) group.methods.add(record.method);
    if (record.status) group.statuses.add(record.status);
    if (record.bodyKind) group.bodyKinds.add(record.bodyKind);
  }

  return Array.from(groups.values()).map((group) => ({
    endpoint: group.endpoint,
    count: group.count,
    methods: Array.from(group.methods),
    statuses: Array.from(group.statuses),
    bodyKinds: Array.from(group.bodyKinds),
    exampleUrl: group.exampleUrl,
  })).sort((left, right) => right.count - left.count);
}

function extractTaskDefinitionHints(records) {
  const hints = [];
  for (const record of records) {
    if (!record?.json || !String(record.url || "").includes("/taskDefinitions")) {
      continue;
    }

    const definitions = Array.isArray(record.json) ? record.json : [record.json];
    for (const definition of definitions) {
      if (!definition || typeof definition !== "object") {
        continue;
      }
      const customAttributes = Array.isArray(definition.customAttributes)
        ? definition.customAttributes
        : [];
      hints.push({
        name: definition.name || "",
        localId: definition.localId || "",
        definitionId: definition.definitionId || definition.urn || "",
        customAttributes: customAttributes.map((item) => ({
          code: item.code || "",
          name: item.name || "",
          type: item.type || "",
          rank: item.rank ?? "",
        })).filter((item) => item.code || item.name),
      });
    }
  }

  return hints.slice(0, 80);
}

function extractManifestHints(records) {
  const hints = [];
  for (const record of records) {
    if (!record?.json || !String(record.url || "").includes("manifest.json")) {
      continue;
    }

    const app = record.json["sap.app"] || {};
    const ui5 = record.json["sap.ui5"] || {};
    const dataSources = app.dataSources || {};
    hints.push({
      url: trimUrl(record.url),
      appId: app.id || "",
      title: app.title || "",
      applicationVersion: app.applicationVersion?.version || "",
      componentName: ui5.componentName || "",
      dataSources: Object.entries(dataSources).map(([name, source]) => ({
        name,
        uri: source?.uri || "",
        type: source?.type || "",
        odataVersion: source?.settings?.odataVersion || "",
        localUri: source?.settings?.localUri || "",
      })),
      models: Object.entries(ui5.models || {}).map(([name, model]) => ({
        name,
        dataSource: model?.dataSource || "",
        type: model?.type || "",
      })),
    });
  }

  return hints.slice(0, 40);
}

function extractODataMetadataHints(records) {
  const hints = [];
  for (const record of records) {
    if (!String(record?.url || "").includes("$metadata")) {
      continue;
    }

    const text = record.bodySnippet || "";
    hints.push({
      url: trimUrl(record.url),
      entitySets: uniqueMatches(text, /<EntitySet\s+Name="([^"]+)"/g).slice(0, 80),
      entityTypes: uniqueMatches(text, /<EntityType\s+Name="([^"]+)"/g).slice(0, 80),
      entityDetails: extractMetadataEntityDetails(text),
      functionImports: uniqueMatches(text, /<FunctionImport\s+Name="([^"]+)"/g).slice(0, 80),
      actionImports: uniqueMatches(text, /<ActionImport\s+Name="([^"]+)"/g).slice(0, 80),
      singletons: uniqueMatches(text, /<Singleton\s+Name="([^"]+)"/g).slice(0, 80),
    });
  }

  return hints.slice(0, 40);
}

function extractMetadataEntityDetails(text) {
  const wantedPattern = /(ProcessRequests|ProcessRequest|PurchaseOrder|POs|Decision|Feedback|History|Item|Head|Detail|Ticket|BusinessPartner)/i;
  const details = [];
  const entityRegex = /<EntityType\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/g;
  for (const match of String(text || "").matchAll(entityRegex)) {
    const name = normalizeText(match[1]);
    if (!wantedPattern.test(name)) {
      continue;
    }

    const body = match[2] || "";
    details.push({
      name,
      keys: uniqueMatches(body, /<PropertyRef\s+Name="([^"]+)"/g).slice(0, 20),
      properties: Array.from(body.matchAll(/<Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g))
        .map((propertyMatch) => ({
          name: normalizeText(propertyMatch[1]),
          type: normalizeText(propertyMatch[2]),
        }))
        .slice(0, 80),
      navigationProperties: Array.from(body.matchAll(/<NavigationProperty\s+Name="([^"]+)"\s+[^>]*Type="([^"]+)"/g))
        .map((navigationMatch) => ({
          name: normalizeText(navigationMatch[1]),
          type: normalizeText(navigationMatch[2]),
        }))
        .slice(0, 50),
    });
  }

  return details.slice(0, 80);
}

function buildTaskDefinitionLookup(hints) {
  const lookup = new Map();
  for (const hint of hints) {
    const keys = [
      hint.definitionId,
      hint.localId,
      hint.name,
      normalizeDefinitionLocalId(hint.definitionId),
    ].map((value) => normalizeComparableKey(value)).filter(Boolean);

    for (const key of keys) {
      lookup.set(key, hint);
    }
  }
  return lookup;
}

function summarizeTaskCenterTask(task, definitionLookup) {
  const subject = normalizeText(task.subject || task.title || task.name || task.description);
  const subjectInfo = extractTaskInfoFromText(subject);
  const definitionId = normalizeText(task.definitionId || task.taskDefinitionId || task.definition?.id || task.taskDefinition?.id);
  const definitionLocalId = normalizeDefinitionLocalId(definitionId || task.localId);
  const definition = findTaskDefinition(definitionLookup, {
    definitionId,
    definitionLocalId,
    name: subjectInfo.taskType || task.definitionName || task.taskDefinitionName,
  });
  const codeValues = collectCustomCodeValues(task);
  const namedCustomAttributes = mapNamedCustomAttributes(codeValues, definition);

  return {
    urn: normalizeText(task.urn || task.id || task.taskId),
    localId: normalizeText(task.localId || task.taskLocalId),
    definitionId,
    definitionLocalId,
    status: normalizeText(task.status),
    subject,
    caseNumber: subjectInfo.caseNumber,
    taskType: subjectInfo.taskType || definition?.name || normalizeText(task.definitionName || task.taskDefinitionName),
    uiLink: normalizeText(task.uiLink || task.applicationLink || task.url || task.link),
    priority: normalizeText(task.priority),
    createdAt: normalizeText(task.createdAt),
    modifiedAt: normalizeText(task.modifiedAt),
    customCodeValues: Object.fromEntries(Object.entries(codeValues).slice(0, 30)),
    namedCustomAttributes,
    requestCandidates: pickNamedValues(namedCustomAttributes, [
      "Type Of Process",
      "Request Area",
      "Request Category",
      "Task Of Process",
    ]),
    poCandidates: pickNamedValues(namedCustomAttributes, [
      "S4 PO No",
      "S4 Market PO No",
      "PO Number",
    ]),
  };
}

function findTaskDefinition(definitionLookup, task) {
  const keys = [
    task.definitionId,
    task.definitionLocalId,
    task.name,
  ].map((value) => normalizeComparableKey(value)).filter(Boolean);

  for (const key of keys) {
    if (definitionLookup.has(key)) {
      return definitionLookup.get(key);
    }
  }
  return null;
}

function mapNamedCustomAttributes(codeValues, definition) {
  const mapped = {};
  const attributes = Array.isArray(definition?.customAttributes)
    ? definition.customAttributes
    : [];
  const nameByCode = new Map(attributes.map((item) => [item.code, item.name]));

  for (const [code, value] of Object.entries(codeValues)) {
    const name = nameByCode.get(code) || code;
    mapped[name] = value;
  }
  return mapped;
}

function pickNamedValues(namedCustomAttributes, names) {
  const picked = {};
  for (const name of names) {
    const value = normalizeText(namedCustomAttributes?.[name]);
    if (value) {
      picked[name] = value;
    }
  }
  return picked;
}

function collectTaskObjects(value, depth = 0) {
  if (depth > 4 || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTaskObjects(item, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  if (isTaskObject(value)) {
    return [value];
  }

  const likelyContainers = [
    value.value,
    value.results,
    value.items,
    value.tasks,
    value.data,
    value.d?.results,
  ].filter(Boolean);

  return likelyContainers.flatMap((item) => collectTaskObjects(item, depth + 1));
}

function collectCustomCodeValues(value, values = {}, depth = 0) {
  if (depth > 6 || value == null) {
    return values;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && /^string\d+$/i.test(String(item.code || ""))) {
        const directValue = firstScalarValue(
          item.value,
          item.displayValue,
          item.stringValue,
          item.text,
          item.label,
          item.content
        );
        if (directValue) {
          values[item.code] = normalizeText(directValue);
        }
      }
      collectCustomCodeValues(item, values, depth + 1);
    }
    return values;
  }

  if (typeof value !== "object") {
    return values;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/^string\d+$/i.test(key)) {
      const directValue = firstScalarValue(child);
      if (directValue) {
        values[key] = normalizeText(directValue);
      }
      continue;
    }

    if (["attributes", "customAttributes", "context", "data", "details"].includes(key)) {
      collectCustomCodeValues(child, values, depth + 1);
    }
  }

  return values;
}

function firstScalarValue(...values) {
  for (const value of values) {
    if (value == null) {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const normalized = normalizeText(value);
      if (normalized) {
        return normalized;
      }
    }
    if (typeof value === "object") {
      const nested = firstScalarValue(value.value, value.displayValue, value.text, value.label, value.content);
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

function isTaskListEndpoint(url) {
  const text = String(url || "");
  return (
    text.includes("/task-center-service/v1/tasks") &&
    !text.includes("/tasks/$count") &&
    !text.includes("/taskDefinitions")
  );
}

function isTaskObject(value) {
  const urn = String(value?.urn || value?.id || "");
  return Boolean(
    (urn.includes("sap.odm.bpm.task") || value?.uiLink || value?.applicationLink) &&
    (value?.subject || value?.definitionId || value?.taskDefinitionId)
  );
}

function normalizeDefinitionLocalId(value) {
  const text = normalizeText(value);
  const match = text.match(/:(\d+)$/);
  return match ? match[1] : text;
}

function normalizeComparableKey(value) {
  return normalizeText(value).toLowerCase();
}

function endpointKey(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname
      .replace(/\/urn%3A.+$/i, "/:taskUrn")
      .replace(/\/urn:sap\..+$/i, "/:taskUrn");
  } catch {
    return String(url || "").split("?")[0];
  }
}

function walkJson(value, path, items) {
  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 250).forEach((item, index) => walkJson(item, `${path}[${index}]`, items));
    return;
  }

  if (typeof value === "object") {
    const text = objectToSearchText(value);
    if (RELEVANT_TEXT_PATTERN.test(text)) {
      items.push({
        path,
        text,
      });
    }

    for (const [key, child] of Object.entries(value)) {
      walkJson(child, `${path}.${key}`, items);
    }
  }
}

function objectToSearchText(value) {
  const parts = [];
  for (const [key, child] of Object.entries(value || {})) {
    if (child == null) {
      continue;
    }
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      parts.push(`${key}: ${child}`);
    }
  }
  return normalizeText(parts.join(" "));
}

function scoreRowCompleteness(row) {
  const fields = [
    "Case Number",
    "Task Type",
    "Request",
    "PO Number",
    "Working Number",
  ];
  return fields.filter((field) => normalizeText(row?.[field])).length;
}

function collectMissingFields(row) {
  return [
    "Case Number",
    "Task Type",
    "Request",
    "PO Number",
    "Working Number",
  ].filter((field) => !normalizeText(row?.[field]));
}

function looksLikeJson(text) {
  const trimmed = String(text || "").trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function uniqueMatches(text, regex) {
  return Array.from(new Set(
    Array.from(String(text || "").matchAll(regex))
      .map((match) => normalizeText(match[1]))
      .filter(Boolean)
  ));
}

function trimUrl(url) {
  const text = String(url || "");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}
