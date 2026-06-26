import {
  extractTaskInfoFromText,
  extractTicketFieldsFromText,
  normalizeText,
  resolveTicketOwnerRow,
} from "./ticket-fields.mjs";

const RELEVANT_URL_PATTERN = /(task|workflow|inbox|bpm|odata|process|ticket|case|gts)/i;
const RELEVANT_TEXT_PATTERN = /(Provide Feedback|Review Main Ticket Resolution|Review Sub-Ticket Resolution|PO Number|Working Number|Case Number|Task Type|Request)/i;

export function createTaskCenterRequestRecorder(page, options = {}) {
  const records = [];
  const maxBodyChars = Number(options.maxBodyChars || 50000);
  const maxRecords = Number(options.maxRecords || 80);

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

  page.on("response", handleResponse);

  return {
    records,
    stop() {
      page.off("response", handleResponse);
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
  return {
    recordCount: normalizedRecords.length,
    candidateCount: candidates.length,
    completeCandidateCount: candidates.filter((item) => item.missingFields.length === 0).length,
    endpointGroups: groupRecordsByEndpoint(normalizedRecords),
    taskDefinitionHints: extractTaskDefinitionHints(normalizedRecords),
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

function trimUrl(url) {
  const text = String(url || "");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}
