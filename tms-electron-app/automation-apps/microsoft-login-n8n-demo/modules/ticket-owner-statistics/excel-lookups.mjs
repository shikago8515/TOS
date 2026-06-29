import { normalizeText } from "./ticket-fields.mjs";

const RELEASE_PAYLOAD_KEYS = [
  ["releaseLookupFileName", "releaseLookupFileBase64"],
  ["releaseUnreleaseFileName", "releaseUnreleaseFileBase64"],
  ["releaseFileName", "releaseFileBase64"],
  ["unreleaseFileName", "unreleaseFileBase64"],
];

const FACTORY_PRICE_PAYLOAD_KEYS = [
  ["factoryPriceFileName", "factoryPriceFileBase64"],
  ["factoryLookupFileName", "factoryLookupFileBase64"],
];

const HEADER_ALIASES = {
  poNumber: [
    "po",
    "po no",
    "po no.",
    "po number",
    "po#",
    "po / contract no#",
    "po/contract no#",
    "po contract no",
    "purchase order",
    "purchase order number",
  ],
  factory: [
    "factory",
    "factory code",
    "factorycode",
    "factory id",
    "factory no",
    "supplier factory",
    "vendor factory",
  ],
  workingNumber: [
    "working",
    "working no",
    "working no.",
    "working no#",
    "working number",
    "workingnumber",
    "work no",
    "article no",
    "article no.",
    "article number",
  ],
  merch: [
    "merch",
    "merchant",
    "merchandiser",
    "merchandiser name",
    "merch name",
    "owner",
    "pic",
  ],
};

export function buildTicketOwnerExcelLookups(xlsx, body = {}) {
  const releasePayload = findWorkbookPayload(body, RELEASE_PAYLOAD_KEYS);
  const factoryPricePayload = findWorkbookPayload(body, FACTORY_PRICE_PAYLOAD_KEYS);
  const releaseLookup = releasePayload
    ? parseReleaseLookupWorkbook(xlsx, releasePayload)
    : createEmptyLookup("release-unrelease");
  const factoryPriceLookup = factoryPricePayload
    ? parseFactoryPriceWorkbook(xlsx, factoryPricePayload)
    : createEmptyLookup("factory-price");

  return {
    releaseLookup,
    factoryPriceLookup,
    hasReleaseLookup: Boolean(releasePayload),
    hasFactoryPriceLookup: Boolean(factoryPricePayload),
    summary: {
      releaseLookupFileName: releasePayload?.fileName || "",
      releaseLookupRowCount: releaseLookup.rowCount,
      factoryPriceFileName: factoryPricePayload?.fileName || "",
      factoryPriceRowCount: factoryPriceLookup.rowCount,
      warnings: [
        ...releaseLookup.warnings,
        ...factoryPriceLookup.warnings,
      ],
    },
  };
}

export function applyTicketOwnerExcelLookups({ task, fields, row, lookups }) {
  const nextFields = { ...(fields || {}) };
  const attempts = [];
  if (!lookups) {
    return { fields: nextFields, attempts, changed: false, source: "" };
  }

  let changed = false;
  const poNumber = normalizePoNumber(nextFields.poNumber || row?.["PO Number"] || task?.poNumber);
  const workingNumber = normalizeWorkingNumber(nextFields.workingNumber || row?.["Working Number"] || task?.workingNumber);
  const factory = normalizeText(nextFields.factory || nextFields.factoryCode || row?.Factory || task?.factory || task?.factoryCode);

  if (!factory && poNumber) {
    const releaseMatch = lookups.releaseLookup?.byPo?.get(normalizePoKey(poNumber));
    attempts.push({
      type: "release-unrelease",
      key: poNumber,
      found: Boolean(releaseMatch),
    });
    if (releaseMatch?.factory) {
      nextFields.factory = releaseMatch.factory;
      nextFields.factoryCode = nextFields.factoryCode || releaseMatch.factory;
      changed = true;
    }
  }

  const currentFactory = normalizeText(nextFields.factory || nextFields.factoryCode || factory);
  const currentWorkingNumber = normalizeWorkingNumber(nextFields.workingNumber || workingNumber);
  const factoryPriceMatch = findFactoryPriceMatch(lookups.factoryPriceLookup, {
    poNumber,
    factory: currentFactory,
    workingNumber: currentWorkingNumber,
  });
  attempts.push({
    type: "factory-price",
    factory: currentFactory,
    workingNumber: currentWorkingNumber,
    found: Boolean(factoryPriceMatch),
    matchMode: factoryPriceMatch?.matchMode || "",
  });

  if (factoryPriceMatch?.factory && !normalizeText(nextFields.factory || nextFields.factoryCode)) {
    nextFields.factory = factoryPriceMatch.factory;
    nextFields.factoryCode = nextFields.factoryCode || factoryPriceMatch.factory;
    changed = true;
  }
  if (factoryPriceMatch?.workingNumber && !normalizeWorkingNumber(nextFields.workingNumber)) {
    nextFields.workingNumber = factoryPriceMatch.workingNumber;
    nextFields.releaseLookupWorkingNumber = nextFields.releaseLookupWorkingNumber || factoryPriceMatch.workingNumber;
    changed = true;
  }
  if (factoryPriceMatch?.merch && !normalizeText(nextFields.merch)) {
    nextFields.merch = factoryPriceMatch.merch;
    changed = true;
  }

  const source = attempts.find((attempt) => attempt.found)?.type || "";
  return { fields: nextFields, attempts, changed, source };
}

export function enrichTicketOwnerRowsWithExcelLookups(rows, lookups) {
  if (!Array.isArray(rows) || !lookups) {
    return rows;
  }
  return rows.map((row) => enrichTicketOwnerRowWithExcelLookups(row, lookups));
}

export function enrichTicketOwnerRowWithExcelLookups(row, lookups) {
  if (!row || !lookups) {
    return row;
  }

  const next = { ...row };
  const poNumber = normalizePoNumber(next["PO Number"]);
  let factory = normalizeText(next.Factory);
  let workingNumber = normalizeWorkingNumber(next["Working Number"]);

  if (!factory && poNumber) {
    const releaseMatch = lookups.releaseLookup?.byPo?.get(normalizePoKey(poNumber));
    if (releaseMatch?.factory) {
      factory = releaseMatch.factory;
      next.Factory = factory;
    }
  }

  const factoryPriceMatch = findFactoryPriceMatch(lookups.factoryPriceLookup, {
    poNumber,
    factory,
    workingNumber,
  });
  if (factoryPriceMatch?.factory && !factory) {
    factory = factoryPriceMatch.factory;
    next.Factory = factory;
  }
  if (factoryPriceMatch?.workingNumber && !workingNumber) {
    workingNumber = factoryPriceMatch.workingNumber;
    next["Working Number"] = workingNumber;
  }
  if (factoryPriceMatch?.merch && !normalizeText(next.Merch)) {
    next.Merch = factoryPriceMatch.merch;
  }
  return next;
}

function parseReleaseLookupWorkbook(xlsx, payload) {
  const lookup = createEmptyLookup("release-unrelease");
  for (const sheet of readWorkbookSheets(xlsx, payload)) {
    const table = findHeaderTable(sheet.rows, ["poNumber", "factory"], 2);
    if (!table) {
      lookup.warnings.push(`${payload.fileName || "Release/Unrelease"}:${sheet.name} missing PO/Factory headers`);
      continue;
    }
    for (let index = table.headerRowIndex + 1; index < sheet.rows.length; index += 1) {
      const record = readRecordFromRow(sheet.rows[index], table.columns);
      const poNumber = normalizePoNumber(record.poNumber);
      const factory = normalizeText(record.factory);
      if (!poNumber || !factory) {
        continue;
      }
      const poKey = normalizePoKey(poNumber);
      if (!lookup.byPo.has(poKey)) {
        lookup.byPo.set(poKey, {
          poNumber,
          factory,
          sheetName: sheet.name,
          rowNumber: index + 1,
        });
        lookup.rowCount += 1;
      }
    }
  }
  return lookup;
}

function parseFactoryPriceWorkbook(xlsx, payload) {
  const lookup = createEmptyLookup("factory-price");
  lookup.byPo = new Map();
  lookup.byFactory = new Map();
  lookup.byWorking = new Map();
  lookup.byFactoryWorking = new Map();

  for (const sheet of readWorkbookSheets(xlsx, payload)) {
    const table = findHeaderTable(sheet.rows, ["factory", "workingNumber", "merch"], 2);
    if (!table) {
      lookup.warnings.push(`${payload.fileName || "Factory Price"}:${sheet.name} missing Factory/Working/Merch headers`);
      continue;
    }
    for (let index = table.headerRowIndex + 1; index < sheet.rows.length; index += 1) {
      const record = normalizeFactoryPriceRecord(readRecordFromRow(sheet.rows[index], table.columns), sheet.name, index + 1);
      if (!record.factory && !record.workingNumber) {
        continue;
      }
      addFactoryPriceRecord(lookup, record);
    }
  }

  return lookup;
}

function addFactoryPriceRecord(lookup, record) {
  const poKey = normalizePoKey(record.poNumber);
  const factoryKey = normalizeFactoryKey(record.factory);
  const workingKey = normalizeWorkingKey(record.workingNumber);
  if (poKey && !lookup.byPo.has(poKey)) {
    lookup.byPo.set(poKey, record);
  }
  if (factoryKey && workingKey) {
    lookup.byFactoryWorking.set(`${factoryKey}|${workingKey}`, record);
  }
  if (factoryKey) {
    const list = lookup.byFactory.get(factoryKey) || [];
    list.push(record);
    lookup.byFactory.set(factoryKey, list);
  }
  if (workingKey && !lookup.byWorking.has(workingKey)) {
    lookup.byWorking.set(workingKey, record);
  }
  lookup.rowCount += 1;
}

function findFactoryPriceMatch(lookup, { poNumber, factory, workingNumber }) {
  if (!lookup) {
    return null;
  }
  const poKey = normalizePoKey(poNumber);
  const factoryKey = normalizeFactoryKey(factory);
  const workingKey = normalizeWorkingKey(workingNumber);
  if (poKey) {
    const byPo = lookup.byPo?.get(poKey);
    if (byPo && (!factoryKey || normalizeFactoryKey(byPo.factory) === factoryKey)) {
      return { ...byPo, matchMode: factoryKey ? "po+factory" : "po" };
    }
  }
  if (factoryKey && workingKey) {
    const exact = lookup.byFactoryWorking?.get(`${factoryKey}|${workingKey}`);
    if (exact) {
      return { ...exact, matchMode: "factory+working" };
    }
    return null;
  }
  if (factoryKey) {
    const records = lookup.byFactory?.get(factoryKey) || [];
    if (records.length === 1) {
      return { ...records[0], matchMode: "factory" };
    }
  }
  if (workingKey) {
    const byWorking = lookup.byWorking?.get(workingKey);
    if (byWorking) {
      return { ...byWorking, matchMode: "working" };
    }
  }
  return null;
}

function normalizeFactoryPriceRecord(record, sheetName, rowNumber) {
  return {
    poNumber: normalizePoNumber(record.poNumber),
    factory: normalizeText(record.factory),
    workingNumber: normalizeWorkingNumber(record.workingNumber),
    merch: normalizeText(record.merch),
    sheetName,
    rowNumber,
  };
}

function findWorkbookPayload(body, keys) {
  for (const [fileNameKey, fileBase64Key] of keys) {
    const fileBase64 = normalizeText(body?.[fileBase64Key]);
    if (!fileBase64) {
      continue;
    }
    return {
      fileName: normalizeText(body?.[fileNameKey]) || "lookup.xlsx",
      fileBase64,
    };
  }
  return null;
}

function readWorkbookSheets(xlsx, payload) {
  if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) {
    throw new Error("ticket-owner-statistics Excel lookup dependency is missing: xlsx");
  }
  const buffer = Buffer.from(stripDataUrlPrefix(payload.fileBase64), "base64");
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: false });
  return workbook.SheetNames.map((name) => ({
    name,
    rows: xlsx.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }),
  }));
}

function findHeaderTable(rows, requiredFields, minMatches) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex += 1) {
    const columns = {};
    const row = rows[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const fieldName = identifyHeaderField(row[columnIndex]);
      if (fieldName && columns[fieldName] === undefined) {
        columns[fieldName] = columnIndex;
      }
    }
    const matchCount = requiredFields.filter((field) => columns[field] !== undefined).length;
    if (matchCount >= minMatches) {
      return { headerRowIndex: rowIndex, columns };
    }
  }
  return null;
}

function identifyHeaderField(value) {
  const header = normalizeHeader(value);
  if (!header) {
    return "";
  }
  for (const [fieldName, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === header)) {
      return fieldName;
    }
  }
  return "";
}

function readRecordFromRow(row, columns) {
  const record = {};
  for (const [fieldName, columnIndex] of Object.entries(columns || {})) {
    record[fieldName] = row?.[columnIndex] ?? "";
  }
  return record;
}

function createEmptyLookup(type) {
  return {
    type,
    rowCount: 0,
    warnings: [],
    byPo: new Map(),
  };
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^,]+,/i, "");
}

function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[#/\\_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePoNumber(value) {
  const normalized = normalizeText(value)
    .replace(/\s+/g, "")
    .replace(/^O(?=\d)/i, "0")
    .replace(/\.0+$/, "");
  const match = normalized.match(/\b(?:0\d{8,11}|[1-9]\d{8,11})\b/);
  return match?.[0] || normalized.replace(/^#+/, "");
}

function normalizeWorkingNumber(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(/\bRC[A-Z0-9]{6,}\b/i);
  return match?.[0]?.toUpperCase() || normalized.replace(/^#+/, "");
}

function normalizePoKey(value) {
  return normalizePoNumber(value).toUpperCase();
}

function normalizeFactoryKey(value) {
  return normalizeText(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeWorkingKey(value) {
  return normalizeWorkingNumber(value).toUpperCase();
}
