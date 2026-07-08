const SUPPORTED_FACTORIES = ["SLT", "VENT", "XO"];
const ZEQS_CHARGE_CODE = "ZEQS";

const INVOICE_HEADER_ALIASES = new Set([
  "invoice",
  "invoice#",
  "invoiceno",
  "invoicenum",
  "invoicenumber",
  "inv",
  "inv#",
  "invno",
  "invnumber",
]);

const CHARGE_CODE_HEADER_ALIASES = new Set([
  "charge",
  "chargecode",
  "reason",
  "reasoncode",
  "code",
]);

const UPCHARGE_AMOUNT_HEADER_ALIASES = new Set([
  "amount",
  "fee",
  "total",
  "upcharge",
  "upchargetotal",
  "upchargeusd",
  "upchargeusdtotal",
  "upcharge$total",
]);

const PODD_HEADER_ALIASES = new Set([
  "podd",
  "poddate",
  "podddate",
  "submission",
  "submissiondate",
  "submitdate",
]);

const PO_HEADER_ALIASES = new Set([
  "po",
  "po#",
  "pono",
  "ponumber",
]);

export function parseTcInvWorkbookPayload(body, deps) {
  const { xlsx } = deps;
  const workbookBuffer = assertWorkbookPayload(body);

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, { type: "buffer" });
  } catch (error) {
    const parseError = new Error(`XO TC INV Excel parse failed: ${error.message || error}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const sheetName = resolveWorksheetName(workbook, body?.sheetName, xlsx);
  if (!sheetName) {
    const error = new Error("XO TC INV Excel does not contain a readable worksheet.");
    error.statusCode = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[sheetName];
  const sheetRows = readSheetRows(worksheet, xlsx);
  const headerInfo = findSorHeaderRow(sheetRows);
  if (!headerInfo) {
    const error = new Error("XO TC INV Excel header was not found. Please upload the PO issue list with columns: Inv No, Charge Code, upcharge $ total.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedRows = normalizeRows(sheetRows, headerInfo);
  if (normalizedRows.length === 0) {
    const error = new Error("XO TC INV Excel does not contain executable SOR rows.");
    error.statusCode = 400;
    throw error;
  }

  const adjustmentsByInvoice = collectInvoiceActionsByInvoice(normalizedRows);
  const invoiceNumbers = collectInvoiceNumbers(normalizedRows, adjustmentsByInvoice);
  if (invoiceNumbers.length === 0) {
    const error = new Error("XO TC INV Excel did not contain any executable Invoice rows.");
    error.statusCode = 400;
    throw error;
  }

  const factories = collectFactories(normalizedRows);
  const poddDatesByInvoice = collectPoddDatesByInvoice(normalizedRows);
  const firstPoddDate = invoiceNumbers.length > 0 ? poddDatesByInvoice[invoiceNumbers[0]] || "" : "";

  return {
    adjustmentsByInvoice,
    factories,
    firstInvoiceNumber: invoiceNumbers[0],
    firstPoddDate,
    headerRowIndex: headerInfo.rowIndex,
    invoiceNumbers,
    poddDatesByInvoice,
    rowCount: normalizedRows.length,
    rows: normalizedRows,
    sheetName,
    warnings: buildWorkbookWarnings(factories, invoiceNumbers, normalizedRows),
  };
}

function assertWorkbookPayload(body) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();
  if (!fileBase64) {
    const error = new Error("Please upload the XO TC INV Excel file.");
    error.statusCode = 400;
    throw error;
  }

  const inputFileName = String(body?.fileName || body?.filename || "").trim();
  if (inputFileName && !/\.(xlsx|xls)$/i.test(inputFileName)) {
    const error = new Error("XO TC INV automation only supports .xlsx or .xls files.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");
  const workbookBuffer = Buffer.from(normalizedBase64, "base64");
  if (!workbookBuffer.length) {
    const error = new Error("XO TC INV Excel file is empty. Please upload it again.");
    error.statusCode = 400;
    throw error;
  }

  return workbookBuffer;
}

function resolveWorksheetName(workbook, preferredSheetName, xlsx) {
  if (preferredSheetName && workbook?.SheetNames?.includes(preferredSheetName)) {
    return preferredSheetName;
  }

  const sheetNames = workbook?.SheetNames || [];
  const sorSheetName = sheetNames.find((name) => /^sor$/i.test(String(name || "").trim()));
  if (sorSheetName && worksheetHasSorHeader(workbook.Sheets[sorSheetName], xlsx)) {
    return sorSheetName;
  }

  const detectedSheetName = sheetNames.find((name) => worksheetHasSorHeader(workbook.Sheets[name], xlsx));
  return detectedSheetName || sheetNames[0] || "";
}

function worksheetHasSorHeader(worksheet, xlsx) {
  return Boolean(findSorHeaderRow(readSheetRows(worksheet, xlsx)));
}

function readSheetRows(worksheet, xlsx) {
  return xlsx.utils.sheet_to_json(worksheet, {
    blankrows: true,
    defval: "",
    header: 1,
    raw: false,
  });
}

function findSorHeaderRow(sheetRows) {
  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index] || [];
    const columns = resolveHeaderColumns(row);
    if (columns.invoiceColumn >= 0 && columns.amountColumn >= 0) {
      return {
        ...columns,
        headers: row.map((cell) => normalizeCellValue(cell)),
        rowIndex: index + 1,
        zeroBasedRowIndex: index,
      };
    }
  }
  return null;
}

function resolveHeaderColumns(row) {
  const columns = {
    amountColumn: -1,
    chargeCodeColumn: -1,
    factoryColumn: -1,
    invoiceColumn: -1,
    poddColumn: -1,
    poColumn: -1,
  };

  row.forEach((cell, index) => {
    const label = normalizeHeaderLabel(cell);
    if (!label) return;
    if (columns.invoiceColumn < 0 && INVOICE_HEADER_ALIASES.has(label)) {
      columns.invoiceColumn = index;
    }
    if (columns.chargeCodeColumn < 0 && CHARGE_CODE_HEADER_ALIASES.has(label)) {
      columns.chargeCodeColumn = index;
    }
    if (columns.amountColumn < 0 && UPCHARGE_AMOUNT_HEADER_ALIASES.has(label)) {
      columns.amountColumn = index;
    }
    if (columns.poddColumn < 0 && PODD_HEADER_ALIASES.has(label)) {
      columns.poddColumn = index;
    }
    if (columns.poColumn < 0 && PO_HEADER_ALIASES.has(label)) {
      columns.poColumn = index;
    }
    if (columns.factoryColumn < 0 && /factory|factorycode|vendor|supplier|fty/i.test(label)) {
      columns.factoryColumn = index;
    }
  });

  return columns;
}

function normalizeRows(sheetRows, headerInfo) {
  const rows = [];
  let activeInvoiceNumber = "";

  for (let index = headerInfo.zeroBasedRowIndex + 1; index < sheetRows.length; index += 1) {
    const rowValues = sheetRows[index] || [];
    if (!rowValues.some((cell) => normalizeCellValue(cell))) {
      continue;
    }

    const normalized = normalizeSorRow(rowValues, headerInfo, index + 1);
    if (normalized.invoiceNumber) {
      activeInvoiceNumber = normalized.invoiceNumber;
      normalized.groupInvoiceNumber = normalized.invoiceNumber;
    } else if (activeInvoiceNumber && (normalized.hasZeqsAmount || normalized.poNumber || normalized.chargeCode)) {
      normalized.invoiceNumber = activeInvoiceNumber;
      normalized.groupInvoiceNumber = activeInvoiceNumber;
    }
    if (!normalized.groupInvoiceNumber) {
      normalized.groupInvoiceNumber = normalized.invoiceNumber || activeInvoiceNumber || "";
    }

    rows.push(normalized);
  }

  return rows;
}

function normalizeSorRow(rowValues, headerInfo, rowIndex) {
  const originalRow = buildOriginalRow(rowValues, headerInfo.headers);
  const invoiceNumber = normalizeInvoiceNumber(rowValues[headerInfo.invoiceColumn]);
  const rawChargeCode = headerInfo.chargeCodeColumn >= 0 ? rowValues[headerInfo.chargeCodeColumn] : "";
  const chargeCode = normalizeChargeCode(rawChargeCode);
  const amountRawValue = rowValues[headerInfo.amountColumn];
  const amountText = normalizeCellValue(amountRawValue);
  const upchargeAmount = normalizeAmount(amountRawValue);
  const effectiveChargeCode = chargeCode || (amountText ? ZEQS_CHARGE_CODE : "");
  const isZeqsCharge = effectiveChargeCode === ZEQS_CHARGE_CODE;
  const poddDate = headerInfo.poddColumn >= 0 ? normalizePoddDate(rowValues[headerInfo.poddColumn]) : "";
  const poNumber = headerInfo.poColumn >= 0 ? normalizeCellValue(rowValues[headerInfo.poColumn]) : "";

  return {
    chargeCode,
    effectiveChargeCode,
    factory: detectFactory(originalRow),
    groupInvoiceNumber: invoiceNumber,
    hasExplicitInvoiceCell: Boolean(invoiceNumber),
    hasZeqsAmount: isZeqsCharge && amountText !== "",
    invoiceNumber,
    invoiceSourceHeader: headerInfo.headers[headerInfo.invoiceColumn] || "",
    isZeqsCharge,
    nonEmptyCellCount: Object.values(originalRow).filter(Boolean).length,
    originalRow,
    poddDate,
    poddSourceHeader: headerInfo.poddColumn >= 0 ? headerInfo.headers[headerInfo.poddColumn] || "" : "",
    poNumber,
    rowIndex,
    upchargeAmount,
    upchargeInputValue: formatCurrencyAmount(upchargeAmount),
    upchargeSourceHeader: headerInfo.headers[headerInfo.amountColumn] || "",
    zeqsAmount: isZeqsCharge ? upchargeAmount : 0,
  };
}

function buildOriginalRow(rowValues, headers) {
  const row = {};
  headers.forEach((header, index) => {
    const normalizedHeader = normalizeCellValue(header);
    if (!normalizedHeader) return;
    const value = normalizeCellValue(rowValues[index]);
    if (Object.prototype.hasOwnProperty.call(row, normalizedHeader)) {
      row[`${normalizedHeader}_${index + 1}`] = value;
    } else {
      row[normalizedHeader] = value;
    }
  });
  return row;
}

function collectInvoiceNumbers(rows, adjustmentsByInvoice) {
  const invoiceNumbers = [];
  const seen = new Set();
  for (const row of rows) {
    const invoiceNumber = row.groupInvoiceNumber || row.invoiceNumber || "";
    if (!invoiceNumber || seen.has(invoiceNumber) || !adjustmentsByInvoice[invoiceNumber]) continue;
    seen.add(invoiceNumber);
    invoiceNumbers.push(invoiceNumber);
  }
  return invoiceNumbers;
}

function collectPoddDatesByInvoice(rows) {
  const datesByInvoice = {};
  for (const row of rows) {
    const invoiceNumber = row.groupInvoiceNumber || row.invoiceNumber || "";
    if (!invoiceNumber || !row.poddDate || datesByInvoice[invoiceNumber]) continue;
    datesByInvoice[invoiceNumber] = row.poddDate;
  }
  return datesByInvoice;
}

function collectInvoiceActionsByInvoice(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const invoiceNumber = row.groupInvoiceNumber || row.invoiceNumber || "";
    if (!invoiceNumber) continue;

    const group = grouped.get(invoiceNumber) || {
      amount: 0,
      hasZeqsAmount: false,
      poNumbers: [],
      sourceRows: [],
    };
    if (row.isZeqsCharge && row.hasZeqsAmount) {
      group.amount = roundCurrency(group.amount + row.zeqsAmount);
      group.hasZeqsAmount = true;
    }
    if (row.poNumber) group.poNumbers.push(row.poNumber);
    group.sourceRows.push(row.rowIndex);
    grouped.set(invoiceNumber, group);
  }

  const adjustmentsByInvoice = {};
  for (const [invoiceNumber, group] of grouped.entries()) {
    const hasZeqsAmount = Boolean(group.hasZeqsAmount);
    adjustmentsByInvoice[invoiceNumber] = {
      chargeCode: hasZeqsAmount ? ZEQS_CHARGE_CODE : "",
      hasZeqsAmount,
      noCharge: !hasZeqsAmount,
      poNumbers: Array.from(new Set(group.poNumbers)),
      skipBuild: !hasZeqsAmount,
      sourceRows: group.sourceRows,
      upchargeAmount: group.amount,
      upchargeInputValue: hasZeqsAmount ? formatCurrencyAmount(group.amount) : "",
      zeqsAmount: group.amount,
      zeqsInputValue: hasZeqsAmount ? formatCurrencyAmount(group.amount) : "",
    };
  }
  return adjustmentsByInvoice;
}

function collectFactories(rows) {
  const factories = new Set();
  for (const row of rows) {
    if (row.factory) factories.add(row.factory);
  }
  return Array.from(factories);
}

function detectFactory(row) {
  for (const [key, value] of Object.entries(row)) {
    const header = String(key || "").toLowerCase();
    const cell = String(value || "").trim().toUpperCase();
    if (/(factory|vendor|supplier|fty)/i.test(header)) {
      const matched = SUPPORTED_FACTORIES.find((factory) => cell.includes(factory));
      if (matched) return matched;
    }
  }

  const allText = Object.values(row).join(" ").toUpperCase();
  return SUPPORTED_FACTORIES.find((factory) => allText.includes(factory)) || "";
}

function buildWorkbookWarnings(factories, invoiceNumbers, rows) {
  const warnings = [];
  const unsupportedChargeCodes = Array.from(new Set(
    rows
      .map((row) => row.effectiveChargeCode)
      .filter((code) => code && code !== ZEQS_CHARGE_CODE),
  ));
  if (unsupportedChargeCodes.length > 0) {
    warnings.push(`Ignored non-ZEQS charge code rows: ${unsupportedChargeCodes.join(", ")}.`);
  }
  if (invoiceNumbers.length > 1) {
    warnings.push(`Detected ${invoiceNumbers.length} invoices. They will be processed in Excel order.`);
  }
  return warnings;
}

function normalizeCellValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeHeaderLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[#＃]/g, "#")
    .replace(/\$/g, "usd")
    .replace(/[^A-Za-z0-9#]+/g, "")
    .toLowerCase();
}

function normalizeInvoiceNumber(value) {
  const text = normalizeCellValue(value);
  if (!text || /^(total|subtotal)$/i.test(text)) return "";
  if (!/\d/.test(text)) return "";
  return text;
}

function normalizeChargeCode(value) {
  return normalizeCellValue(value)
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

function normalizeAmount(value) {
  const text = normalizeCellValue(value);
  if (!text) return 0;

  const isParenthesizedNegative = /^\(.*\)$/.test(text);
  const numericText = text
    .replace(/[,\s$￥¥]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^0-9.-]/g, "");
  if (!numericText || numericText === "-" || numericText === ".") return 0;

  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) return 0;
  return roundCurrency(isParenthesizedNegative ? -Math.abs(parsed) : parsed);
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatCurrencyAmount(value) {
  return roundCurrency(value).toFixed(2);
}

function normalizePoddDate(value) {
  const text = normalizeCellValue(value);
  if (!text) return "";

  const excelSerial = Number(text);
  if (/^\d{5,6}(?:\.\d+)?$/.test(text) && Number.isFinite(excelSerial)) {
    return normalizeDatePartsFromDate(new Date(Date.UTC(1899, 11, 30 + Math.floor(excelSerial))));
  }

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return normalizeDateParts(compact[1], compact[2], compact[3]);
  }

  const yearFirst = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirst) {
    return normalizeDateParts(yearFirst[1], yearFirst[2], yearFirst[3]);
  }

  const dayMonthName = text.match(/^(\d{1,2})[-\s/]?([A-Za-z]{3,9})[-,\s/]+(\d{2,4})$/);
  if (dayMonthName) {
    return normalizeDateParts(dayMonthName[3], parseMonthName(dayMonthName[2]), dayMonthName[1]);
  }

  const monthNameFirst = text.match(/^([A-Za-z]{3,9})[-\s/]+(\d{1,2})[-,\s/]+(\d{2,4})$/);
  if (monthNameFirst) {
    return normalizeDateParts(monthNameFirst[3], parseMonthName(monthNameFirst[1]), monthNameFirst[2]);
  }

  const numeric = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    if (first > 12) {
      return normalizeDateParts(numeric[3], second, first);
    }
    return normalizeDateParts(numeric[3], first, second);
  }

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return normalizeDatePartsFromDate(parsedDate);
  }

  return "";
}

function normalizeDatePartsFromDate(date) {
  return normalizeDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function normalizeDateParts(yearValue, monthValue, dayValue) {
  const year = normalizeYear(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!year || !month || !day) return "";

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return 0;
  if (year >= 0 && year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function parseMonthName(value) {
  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return months[String(value || "").trim().toLowerCase()] || 0;
}
