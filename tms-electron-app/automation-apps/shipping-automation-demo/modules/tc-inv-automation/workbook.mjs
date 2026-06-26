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
  return {
    factories,
    firstInvoiceNumber: invoiceNumbers[0],
    invoiceNumbers,
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
    } else if (normalized.isInvoiceTotalRow) {
      activeInvoiceNumber = "";
    } else if (!normalized.hasExplicitInvoiceCell && activeInvoiceNumber) {
      normalized.invoiceNumber = activeInvoiceNumber;
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

function isInvoiceTotalMarker(value) {
  return /^(total|subtotal|合计|总计|小计)$/i.test(normalizeCellValue(value));
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
    warnings.push(`当前阶段先处理第一张发票 ${invoiceNumbers[0]}；其余 ${invoiceNumbers.length - 1} 张发票会在后续批量录入阶段接入。`);
  }
  return warnings;
}
