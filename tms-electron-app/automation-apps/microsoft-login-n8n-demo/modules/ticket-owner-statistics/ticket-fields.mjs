export const TICKET_OWNER_COLUMNS = [
  "Case Number",
  "Task Type",
  "Request",
  "PO Number",
  "Working Number",
  "Factory",
  "Merch",
];

export const EXCLUDED_TASK_TYPE = "Initiate Cancellation Request";

export const TASK_TYPE_BRANCHES = {
  provideFeedback: {
    id: "A",
    title: "Provide Feedback",
    description: "Provide Feedback: collect PO and Working Number from the opened ticket page.",
  },
  reviewMain: {
    id: "B",
    title: "Review Main Ticket Resolution",
    description: "Review Main Ticket Resolution: collect PO and existing Working Number from the opened ticket page.",
  },
  releaseLookup: {
    id: "C",
    title: "Release / Unrelease lookup",
    description: "Review ticket without a direct Working Number: use PO Number to look up Working Number from Release / Unrelease content.",
  },
  unknown: {
    id: "UNKNOWN",
    title: "Unknown",
    description: "Task Type was not recognized by the A/B/C ticket ownership rules.",
  },
};

const KNOWN_TASK_TYPES = [
  "Provide Feedback",
  "Review Main Ticket Resolution",
  "Review Sub-Ticket Resolution",
];

const KNOWN_REQUESTS = [
  "Bulk - Additional Support on WFM",
  "Additional Support on WFM",
  "Advance Shipment Notification (ASN)",
  "aSL Finance - GR/IR/Customer Invoice Cancellation",
  "Clarify Quantity / Cost",
  "Delivery",
  "Documentation",
  "Labelling & Packaging",
  "Labeling & Packaging",
  "PO Adjustments",
  "Others",
  "PO Mgmt. (Sample)",
  "PO Mgmt. (Customization)",
  "PO Quantity Change",
  "PO Cancellation",
  "Transport Mode Change",
  "Partial Shipment",
  "Early/Hold Shipment",
  "Early / Hold Shipment",
  "Preferential Document",
  "Short Shipment (Shortage Management)",
  "Short Shipment (Capacity Management)",
  "Labeling-ILA Data/Physical label & Hangtag",
  "Labelling-ILA Data/Physical label & Hangtag",
  "Early Shipment",
  "Order Cancellation",
];

const PO_NUMBER_REGEX = /\b(?:0\d{8,11}|[1-9]\d{8,11})\b/g;
const WORKING_NUMBER_REGEX = /\bRC[A-Z0-9]{6,}\b/gi;
const CASE_NUMBER_REGEX = /\b(?:GTS\d{4,}(?:-\d+)?|\d{7,9})\b/i;

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeComparable(value) {
  return normalizeText(value).toLowerCase();
}

export function extractTaskInfoFromText(text, cells = []) {
  const normalizedText = normalizeText(text);
  const normalizedCells = Array.isArray(cells)
    ? cells.map(normalizeText).filter(Boolean)
    : [];

  return {
    caseNumber: extractCaseNumber(normalizedText, normalizedCells),
    taskType: extractKnownValue(normalizedText, normalizedCells, KNOWN_TASK_TYPES),
    request: extractKnownValue(normalizedText, normalizedCells, KNOWN_REQUESTS),
    poNumber: extractPoNumber(normalizedText),
    workingNumber: extractWorkingNumber(normalizedText),
  };
}

export function extractTicketFieldsFromText(text, fallback = {}) {
  const normalizedText = normalizeText(text);
  const poNumber = extractByLabels(normalizedText, [
    "PO Number",
    "PO No",
    "Purchase Order",
  ]) || extractPoNumber(normalizedText);

  const workingNumber = extractByLabels(normalizedText, [
    "Working Number",
    "Working No",
    "Working",
  ]) || extractWorkingNumber(normalizedText);

  return {
    caseNumber: extractByLabels(normalizedText, [
      "Case Number",
      "Case No",
      "Case",
      "Ticket Number",
    ]) || fallback.caseNumber || extractCaseNumber(normalizedText, []),
    taskType: extractKnownValue(normalizedText, [], KNOWN_TASK_TYPES) || fallback.taskType || "",
    request: extractKnownValue(normalizedText, [], KNOWN_REQUESTS)
      || extractByLabels(normalizedText, [
        "Request Area",
        "Request Category",
        "Request Type",
      ])
      || fallback.request
      || "",
    poNumber: poNumber || fallback.poNumber || "",
    workingNumber: workingNumber || fallback.workingNumber || "",
    releaseLookupWorkingNumber: poNumber
      ? extractWorkingNumberNearPo(normalizedText, poNumber)
      : "",
    rawTextSnippet: normalizedText.slice(0, 1000),
  };
}

export function classifyTicketBranch(task, detail = {}) {
  const taskType = normalizeComparable(detail.taskType || task.taskType);
  const request = normalizeComparable(detail.request || task.request);
  const workingNumber = normalizeText(detail.workingNumber || task.workingNumber);
  const poNumber = normalizeText(detail.poNumber || task.poNumber);

  if (taskType.includes("provide feedback")) {
    return TASK_TYPE_BRANCHES.provideFeedback;
  }

  if (taskType.includes("review sub-ticket resolution")) {
    return TASK_TYPE_BRANCHES.releaseLookup;
  }

  if (taskType.includes("review main ticket resolution")) {
    return TASK_TYPE_BRANCHES.reviewMain;
  }

  if (request.includes("additional support on wfm") && poNumber) {
    return TASK_TYPE_BRANCHES.releaseLookup;
  }

  return TASK_TYPE_BRANCHES.unknown;
}

export function resolveTicketOwnerRow(task, detail = {}) {
  const branch = classifyTicketBranch(task, detail);
  const caseNumber = normalizeText(detail.caseNumber || task.caseNumber);
  const taskType = normalizeText(detail.taskType || task.taskType);
  const request = normalizeText(detail.request || task.request);
  const poNumber = normalizeText(detail.poNumber || task.poNumber);
  const factory = normalizeText(detail.factory || detail.factoryCode || task.factory || task.factoryCode);
  const merch = normalizeText(detail.merch || task.merch);
  let workingNumber = normalizeText(detail.workingNumber || task.workingNumber);

  if (branch.id === "C" && !workingNumber) {
    workingNumber = normalizeText(detail.releaseLookupWorkingNumber);
  }

  return {
    "Case Number": caseNumber,
    "Task Type": taskType,
    "Request": request,
    "PO Number": normalizePoNumber(poNumber),
    "Working Number": normalizeWorkingNumber(workingNumber),
    Factory: factory,
    Merch: merch,
    branchId: branch.id,
    branchTitle: branch.title,
    sourceNotes: branch.description,
  };
}

export function toTicketOwnerWorkbookRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const normalized = {};
    for (const column of TICKET_OWNER_COLUMNS) {
      normalized[column] = normalizeText(row?.[column]);
    }
    return normalized;
  });
}

function extractCaseNumber(text, cells) {
  const labelValue = extractByLabels(text, [
    "Case Number",
    "Case No",
    "Case",
    "Ticket Number",
  ]);
  if (labelValue) {
    return labelValue;
  }

  const cellMatch = cells.find((cell) => {
    CASE_NUMBER_REGEX.lastIndex = 0;
    return CASE_NUMBER_REGEX.test(cell);
  });
  if (cellMatch) {
    CASE_NUMBER_REGEX.lastIndex = 0;
    return cellMatch.match(CASE_NUMBER_REGEX)?.[0] || "";
  }

  CASE_NUMBER_REGEX.lastIndex = 0;
  return text.match(CASE_NUMBER_REGEX)?.[0] || "";
}

function extractKnownValue(text, cells, candidates) {
  const lowerText = normalizeComparable(text);
  const candidate = candidates.find((item) => lowerText.includes(item.toLowerCase()));
  if (candidate) {
    return candidate;
  }

  for (const cell of cells) {
    const lowerCell = normalizeComparable(cell);
    const matched = candidates.find((item) => lowerCell === item.toLowerCase());
    if (matched) {
      return matched;
    }
  }

  return "";
}

function extractPoNumber(text) {
  PO_NUMBER_REGEX.lastIndex = 0;
  const matches = [...String(text || "").matchAll(PO_NUMBER_REGEX)]
    .map((match) => match[0])
    .filter((value) => value.length >= 9);
  return matches[0] || "";
}

function extractWorkingNumber(text) {
  WORKING_NUMBER_REGEX.lastIndex = 0;
  const match = String(text || "").match(WORKING_NUMBER_REGEX);
  return match?.[0] || "";
}

function extractWorkingNumberNearPo(text, poNumber) {
  const normalizedPo = normalizePoNumber(poNumber);
  if (!normalizedPo) {
    return "";
  }

  const lines = String(text || "")
    .split(/[\r\n]+| {2,}/)
    .map(normalizeText)
    .filter(Boolean);

  for (const line of lines) {
    if (!line.includes(normalizedPo)) {
      continue;
    }
    const workingNumber = extractWorkingNumber(line);
    if (workingNumber) {
      return workingNumber;
    }
  }

  const index = text.indexOf(normalizedPo);
  if (index < 0) {
    return "";
  }

  const nearby = text.slice(Math.max(0, index - 180), index + 240);
  return extractWorkingNumber(nearby);
}

function extractByLabels(text, labels) {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const pattern = new RegExp(`${escaped}\\s*[:：]?\\s*([^\\n\\r|]{2,80})`, "i");
    const match = String(text || "").match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const value = normalizeText(match[1])
      .replace(/^(is|=)\s+/i, "")
      .replace(/\s+(Task Type|Request|PO Number|Working Number|Factory|Merch)\b.*$/i, "")
      .trim();
    if (value && value.toLowerCase() !== label.toLowerCase()) {
      return value;
    }
  }

  return "";
}

function normalizePoNumber(value) {
  const normalized = normalizeText(value)
    .replace(/\s+/g, "")
    .replace(/^O(?=\d)/i, "0")
    .replace(/\.0+$/, "");
  PO_NUMBER_REGEX.lastIndex = 0;
  const match = normalized.match(PO_NUMBER_REGEX);
  return match?.[0] || normalized.replace(/^#+/, "");
}

function normalizeWorkingNumber(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "").toUpperCase();
  WORKING_NUMBER_REGEX.lastIndex = 0;
  const match = normalized.match(WORKING_NUMBER_REGEX);
  return match?.[0] || normalized.replace(/^#+/, "");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
