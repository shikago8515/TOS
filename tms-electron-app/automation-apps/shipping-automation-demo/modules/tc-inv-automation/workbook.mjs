const SUPPORTED_FACTORIES = ["SLT", "VENT", "XO"];

const INVOICE_HEADER_ALIASES = new Set([
  "invoice#",
  "invoice",
  "invoiceno",
  "invoicenum",
  "invoicenumber",
  "inv#",
  "invno",
  "invnumber",
  "发票号",
  "发票号码",
  "商业发票号",
]);

const PODD_HEADER_ALIASES = new Set([
  "podd",
  "poddate",
  "podddate",
  "podd日期",
  "podd日",
  "podd时间",
]);

const ZADD_HEADER_ALIASES = new Set([
  "zadd",
]);

const ZDOC_HEADER_ALIASES = new Set([
  "zdoc",
]);

const ZEQS_HEADER_ALIASES = new Set([
  "zeqs",
]);

const OTHER_COST_HEADER_ALIASES = new Set([
  "othercost",
  "othercharge",
  "othercharges",
  "otherfee",
  "otherfees",
]);

export function parseTcInvWorkbookPayload(body, deps) {
  const { xlsx } = deps;
  const workbookBuffer = assertWorkbookPayload(body);

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, { type: "buffer" });
  } catch (error) {
    const parseError = new Error(`TC INV Excel 解析失败：${error.message || error}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const sheetName = resolveWorksheetName(workbook, body?.sheetName);
  if (!sheetName) {
    const error = new Error("TC INV Excel 中没有可读取的工作表。请上传包含出货明细的 .xlsx 或 .xls 文件。");
    error.statusCode = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });
  const normalizedRows = normalizeRows(rawRows);

  if (normalizedRows.length === 0) {
    const error = new Error("TC INV Excel 没有可执行的数据行。请确认文件包含出货明细、交期或费用信息。");
    error.statusCode = 400;
    throw error;
  }

  const invoiceNumbers = collectInvoiceNumbers(normalizedRows);
  if (invoiceNumbers.length === 0) {
    const error = new Error("TC INV Excel 未找到 Invoice# 列的有效发票号。请确认第一行表头包含 Invoice#，且下面填写了发票号码。");
    error.statusCode = 400;
    throw error;
  }

  const factories = collectFactories(normalizedRows);
  const poddDatesByInvoice = collectPoddDatesByInvoice(normalizedRows);
  const adjustmentsByInvoice = collectAdjustmentsByInvoice(normalizedRows);
  const firstPoddDate = invoiceNumbers.length > 0 ? poddDatesByInvoice[invoiceNumbers[0]] || "" : "";
  return {
    adjustmentsByInvoice,
    factories,
    firstInvoiceNumber: invoiceNumbers[0],
    firstPoddDate,
    invoiceNumbers,
    poddDatesByInvoice,
    rowCount: normalizedRows.length,
    rows: normalizedRows,
    sheetName,
    warnings: buildWorkbookWarnings(factories, invoiceNumbers),
  };
}

function assertWorkbookPayload(body) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();
  if (!fileBase64) {
    const error = new Error("请上传 TC INV Excel 文件。");
    error.statusCode = 400;
    throw error;
  }

  const inputFileName = String(body?.fileName || body?.filename || "").trim();
  if (inputFileName && !/\.(xlsx|xls)$/i.test(inputFileName)) {
    const error = new Error("TC INV 自动化仅支持 .xlsx 或 .xls 文件。");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");
  const workbookBuffer = Buffer.from(normalizedBase64, "base64");
  if (!workbookBuffer.length) {
    const error = new Error("TC INV Excel 文件内容为空，请重新上传。");
    error.statusCode = 400;
    throw error;
  }

  return workbookBuffer;
}

function resolveWorksheetName(workbook, preferredSheetName) {
  if (preferredSheetName && workbook?.SheetNames?.includes(preferredSheetName)) {
    return preferredSheetName;
  }
  return workbook?.SheetNames?.[0] || "";
}

function normalizeRows(rawRows) {
  const normalizedRows = [];
  let activeInvoiceNumber = "";

  rawRows.forEach((row, index) => {
    const normalized = normalizeTcInvRow(row, index + 2);
    if (normalized.nonEmptyCellCount === 0) {
      return;
    }

    if (normalized.invoiceNumber) {
      activeInvoiceNumber = normalized.invoiceNumber;
      normalized.groupInvoiceNumber = normalized.invoiceNumber;
    } else if (normalized.isInvoiceTotalRow) {
      normalized.groupInvoiceNumber = activeInvoiceNumber;
      activeInvoiceNumber = "";
    } else if (!normalized.hasExplicitInvoiceCell && activeInvoiceNumber) {
      normalized.invoiceNumber = activeInvoiceNumber;
      normalized.groupInvoiceNumber = activeInvoiceNumber;
    }
    if (!normalized.groupInvoiceNumber) {
      normalized.groupInvoiceNumber = normalized.invoiceNumber || activeInvoiceNumber || "";
    }

    normalizedRows.push(normalized);
  });

  return normalizedRows;
}

function normalizeTcInvRow(row, rowIndex) {
  const entries = Object.entries(row || {});
  const normalized = {};
  for (const [key, value] of entries) {
    const header = String(key || "").trim();
    if (!header) continue;
    normalized[header] = normalizeCellValue(value);
  }

  const invoiceCell = findInvoiceCell(normalized);
  const invoiceNumber = normalizeInvoiceNumber(invoiceCell.value);
  const poddCell = findPoddCell(normalized);
  const poddDate = normalizePoddDate(poddCell.value);
  const zaddCell = findAmountCell(normalized, ZADD_HEADER_ALIASES);
  const zdocCell = findAmountCell(normalized, ZDOC_HEADER_ALIASES);
  const zeqsCell = findAmountCell(normalized, ZEQS_HEADER_ALIASES);
  const otherCostCell = findAmountCell(normalized, OTHER_COST_HEADER_ALIASES);
  const values = Object.values(normalized).filter(Boolean);
  return {
    rowIndex,
    factory: detectFactory(normalized),
    hasExplicitInvoiceCell: invoiceCell.found && Boolean(String(invoiceCell.value || "").trim()),
    invoiceNumber,
    invoiceSourceHeader: invoiceCell.header,
    isInvoiceTotalRow: isInvoiceTotalMarker(invoiceCell.value),
    nonEmptyCellCount: values.length,
    originalRow: normalized,
    poddDate,
    poddSourceHeader: poddCell.header,
    zaddAmount: normalizeAmount(zaddCell.value),
    zaddSourceHeader: zaddCell.header,
    zdocAmount: normalizeAmount(zdocCell.value),
    zdocSourceHeader: zdocCell.header,
    hasZdocAmount: zdocCell.found && normalizeCellValue(zdocCell.value) !== "",
    zeqsAmount: normalizeAmount(zeqsCell.value),
    zeqsSourceHeader: zeqsCell.header,
    hasZeqsAmount: zeqsCell.found && normalizeCellValue(zeqsCell.value) !== "",
    otherCostAmount: normalizeAmount(otherCostCell.value),
    otherCostSourceHeader: otherCostCell.header,
  };
}

function normalizeCellValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function findInvoiceCell(row) {
  for (const [key, value] of Object.entries(row)) {
    if (INVOICE_HEADER_ALIASES.has(normalizeHeaderLabel(key))) {
      return { found: true, header: key, value };
    }
  }
  return { found: false, header: "", value: "" };
}

function findPoddCell(row) {
  for (const [key, value] of Object.entries(row)) {
    if (PODD_HEADER_ALIASES.has(normalizeHeaderLabel(key))) {
      return { found: true, header: key, value };
    }
  }
  return { found: false, header: "", value: "" };
}

function findAmountCell(row, aliases) {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.has(normalizeHeaderLabel(key))) {
      return { found: true, header: key, value };
    }
  }
  return { found: false, header: "", value: "" };
}

function normalizeHeaderLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[＃#]/g, "#")
    .replace(/[\s_\-./:：]+/g, "")
    .toLowerCase();
}

function normalizeInvoiceNumber(value) {
  const text = normalizeCellValue(value);
  if (!text || isInvoiceTotalMarker(text)) return "";
  if (!/\d/.test(text)) return "";
  return text;
}

function normalizeAmount(value) {
  const text = normalizeCellValue(value);
  if (!text) return 0;

  const isParenthesizedNegative = /^\(.*\)$/.test(text);
  const numericText = text
    .replace(/[,\s$￥¥€£]/g, "")
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

function isInvoiceTotalMarker(value) {
  return /^(total|subtotal|合计|总计|小计)$/i.test(normalizeCellValue(value));
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

  const chineseDate = text.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?$/);
  if (chineseDate) {
    return normalizeDateParts(chineseDate[1], chineseDate[2], chineseDate[3]);
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

function collectInvoiceNumbers(rows) {
  const invoiceNumbers = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row.invoiceNumber || seen.has(row.invoiceNumber)) continue;
    seen.add(row.invoiceNumber);
    invoiceNumbers.push(row.invoiceNumber);
  }
  return invoiceNumbers;
}

function collectPoddDatesByInvoice(rows) {
  const datesByInvoice = {};
  for (const row of rows) {
    if (!row.invoiceNumber || !row.poddDate || datesByInvoice[row.invoiceNumber]) continue;
    datesByInvoice[row.invoiceNumber] = row.poddDate;
  }
  return datesByInvoice;
}

function collectAdjustmentsByInvoice(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const invoiceNumber = row.groupInvoiceNumber || row.invoiceNumber || "";
    if (!invoiceNumber) continue;

    const group = grouped.get(invoiceNumber) || createAdjustmentGroup();
    if (row.isInvoiceTotalRow) {
      group.totalZaddAmount = roundCurrency(group.totalZaddAmount + row.zaddAmount);
      group.totalOtherCostAmount = roundCurrency(group.totalOtherCostAmount + row.otherCostAmount);
      group.totalZdocAmount = roundCurrency(group.totalZdocAmount + row.zdocAmount);
      group.totalZeqsAmount = roundCurrency(group.totalZeqsAmount + row.zeqsAmount);
      group.hasTotalZaddAmount = group.hasTotalZaddAmount || row.zaddAmount !== 0;
      group.hasTotalOtherCostAmount = group.hasTotalOtherCostAmount || row.otherCostAmount !== 0;
      group.hasTotalZdocAmount = group.hasTotalZdocAmount || row.hasZdocAmount;
      group.hasTotalZeqsAmount = group.hasTotalZeqsAmount || row.hasZeqsAmount;
    } else {
      group.detailZaddAmount = roundCurrency(group.detailZaddAmount + row.zaddAmount);
      group.detailOtherCostAmount = roundCurrency(group.detailOtherCostAmount + row.otherCostAmount);
      group.detailZdocAmount = roundCurrency(group.detailZdocAmount + row.zdocAmount);
      group.detailZeqsAmount = roundCurrency(group.detailZeqsAmount + row.zeqsAmount);
      group.hasDetailZaddAmount = group.hasDetailZaddAmount || row.zaddAmount !== 0;
      group.hasDetailOtherCostAmount = group.hasDetailOtherCostAmount || row.otherCostAmount !== 0;
      group.hasDetailZdocAmount = group.hasDetailZdocAmount || row.hasZdocAmount;
      group.hasDetailZeqsAmount = group.hasDetailZeqsAmount || row.hasZeqsAmount;
    }
    grouped.set(invoiceNumber, group);
  }

  const adjustmentsByInvoice = {};
  for (const [invoiceNumber, group] of grouped.entries()) {
    const zaddAmount = group.hasTotalZaddAmount ? group.totalZaddAmount : group.detailZaddAmount;
    const otherCostAmount = group.hasTotalOtherCostAmount ? group.totalOtherCostAmount : group.detailOtherCostAmount;
    const zdocAmount = group.hasTotalZdocAmount ? group.totalZdocAmount : group.detailZdocAmount;
    const hasZdocAmount = group.hasTotalZdocAmount || group.hasDetailZdocAmount;
    const zeqsAmount = group.hasTotalZeqsAmount ? group.totalZeqsAmount : group.detailZeqsAmount;
    const hasZeqsAmount = group.hasTotalZeqsAmount || group.hasDetailZeqsAmount;
    const zaddPlusOtherCostAmount = roundCurrency(zaddAmount + otherCostAmount);

    adjustmentsByInvoice[invoiceNumber] = {
      zaddAmount,
      otherCostAmount,
      zaddPlusOtherCostAmount,
      zaddPlusOtherCostInputValue: formatCurrencyAmount(zaddPlusOtherCostAmount),
      zdocAmount,
      zdocInputValue: hasZdocAmount ? formatCurrencyAmount(zdocAmount) : "",
      hasZdocAmount,
      zeqsAmount,
      zeqsInputValue: hasZeqsAmount ? formatCurrencyAmount(zeqsAmount) : "",
      hasZeqsAmount,
    };
  }
  return adjustmentsByInvoice;
}

function createAdjustmentGroup() {
  return {
    detailZaddAmount: 0,
    detailOtherCostAmount: 0,
    detailZdocAmount: 0,
    detailZeqsAmount: 0,
    totalZaddAmount: 0,
    totalOtherCostAmount: 0,
    totalZdocAmount: 0,
    totalZeqsAmount: 0,
    hasDetailZaddAmount: false,
    hasDetailOtherCostAmount: false,
    hasDetailZdocAmount: false,
    hasDetailZeqsAmount: false,
    hasTotalZaddAmount: false,
    hasTotalOtherCostAmount: false,
    hasTotalZdocAmount: false,
    hasTotalZeqsAmount: false,
  };
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
    if (/(factory|工厂|厂别|厂区|vendor|supplier|fty)/i.test(header)) {
      const matched = SUPPORTED_FACTORIES.find((factory) => cell.includes(factory));
      if (matched) return matched;
    }
  }

  const allText = Object.values(row).join(" ").toUpperCase();
  return SUPPORTED_FACTORIES.find((factory) => allText.includes(factory)) || "";
}

function buildWorkbookWarnings(factories, invoiceNumbers) {
  const warnings = [];
  if (factories.length === 0) {
    warnings.push("未在 Excel 中识别到 SLT、VENT 或 XO 工厂字段；当前阶段会先按 Invoice# 进入 TC INV 详情页。");
  }
  if (invoiceNumbers.length > 1) {
    warnings.push(`已识别 ${invoiceNumbers.length} 张发票，将按 Invoice# 顺序批量处理；查不到的发票会记录后继续下一张。`);
  }
  return warnings;
}
