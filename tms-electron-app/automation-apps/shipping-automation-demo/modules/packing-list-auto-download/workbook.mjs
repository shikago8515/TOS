const PO_HEADER_ALIASES = new Set([
  "po",
  "po#",
  "pono",
  "pono1",
  "ponos",
  "ponumber",
  "ponumber1",
  "ponumbers",
  "purchaseorder",
  "purchaseorderno",
  "purchaseordernumber",
  "customerpo",
  "customerpono",
  "customerponumber",
  "po号",
  "po号码",
  "po编号",
  "客户po",
  "客户po号",
  "采购订单",
  "采购订单号",
  "订单号",
]);

const NO_HEADER_ALIASES = new Set([
  "invoice",
  "invoice#",
  "invoiceno",
  "invoicenumber",
  "invoiceid",
  "inv",
  "inv#",
  "invno",
  "invnumber",
  "no",
  "no.",
  "number",
  "batch",
  "batchno",
  "batchnumber",
  "批次",
  "批次号",
  "编号",
]);

const PODD_HEADER_ALIASES = new Set([
  "podd",
  "podddate",
  "podddates",
  "podeliverydate",
  "poddrequired",
]);

const STATUS_HEADER_ALIASES = new Set([
  "status",
  "状态",
]);

export function validatePackingListWorkbookPayload(body, deps) {
  const inputFileName = deps.normalizeUploadFileName(body);
  const workbookBuffer = assertWorkbookPayload(body, inputFileName);
  const xlsx = deps.xlsx;
  if (!xlsx?.read || !xlsx?.utils?.sheet_to_json) {
    const error = new Error("自动下载箱单执行器缺少 Excel 解析能力，请确认 xlsx 依赖已注入。");
    error.statusCode = 500;
    throw error;
  }

  let workbook;
  try {
    workbook = xlsx.read(workbookBuffer, { type: "buffer" });
  } catch (error) {
    const parseError = new Error(`自动下载箱单 Excel 解析失败：${error.message || error}`);
    parseError.statusCode = 400;
    throw parseError;
  }

  const sheetName = resolveWorksheetName(workbook, body?.sheetName);
  if (!sheetName) {
    const error = new Error("自动下载箱单 Excel 中没有可读取的工作表。请上传包含 PO 号的 .xlsx 或 .xls 文件。");
    error.statusCode = 400;
    throw error;
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });
  const rows = normalizeRows(rawRows);
  if (rows.length === 0) {
    const error = new Error("自动下载箱单 Excel 没有可执行的数据行。请确认文件包含 PO 号。");
    error.statusCode = 400;
    throw error;
  }

  const poNumbers = collectPoNumbers(rows);
  if (poNumbers.length === 0) {
    const error = new Error("自动下载箱单 Excel 未找到 PO No1 / PO Number 列的有效 PO 号。请确认第一行表头包含 PO No1、PO Number、PO# 或 PO号。");
    error.statusCode = 400;
    throw error;
  }

  const groups = collectNoGroups(rows);
  if (groups.length === 0) {
    const error = new Error("自动下载箱单 Excel 未找到 Invoice# 批次。请确认第一行表头包含 Invoice# 或 NO，且至少第一条 PO 行填写了批次号。");
    error.statusCode = 400;
    throw error;
  }

  return {
    inputFileName,
    byteLength: workbookBuffer.length,
    firstNo: groups[0]?.no || "",
    firstPoNumber: poNumbers[0],
    groups,
    poNumbers,
    rowCount: rows.length,
    rows,
    sheetName,
  };
}

function assertWorkbookPayload(body, inputFileName) {
  const fileBase64 = String(body?.fileBase64 || body?.fileContentBase64 || "").trim();

  if (!fileBase64) {
    const error = new Error("请上传自动下载箱单 Excel 文件。");
    error.statusCode = 400;
    throw error;
  }

  if (inputFileName && !/\.(xlsx|xls)$/i.test(inputFileName)) {
    const error = new Error("自动下载箱单仅支持 .xlsx 或 .xls 文件。");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBase64 = fileBase64.replace(/^data:.*;base64,/, "");
  const workbookBuffer = Buffer.from(normalizedBase64, "base64");
  if (!workbookBuffer.length) {
    const error = new Error("自动下载箱单 Excel 文件内容为空，请重新上传。");
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
  let activeNo = "";
  rawRows.forEach((row, index) => {
    const normalized = normalizePackingListRow(row, index + 2);
    if (normalized.nonEmptyCellCount === 0) {
      return;
    }
    if (normalized.no) {
      activeNo = normalized.no;
    } else if (activeNo) {
      normalized.no = activeNo;
    }
    normalizedRows.push(normalized);
  });
  return normalizedRows;
}

function normalizePackingListRow(row, rowIndex) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    const header = String(key || "").trim();
    if (!header) continue;
    normalized[header] = normalizeCellValue(value);
  }

  const poCell = findCellByAliases(normalized, PO_HEADER_ALIASES);
  const poNumbers = splitPoNumbers(poCell.value);
  const noCell = findCellByAliases(normalized, NO_HEADER_ALIASES);
  const poddCell = findCellByAliases(normalized, PODD_HEADER_ALIASES);
  const statusCell = findCellByAliases(normalized, STATUS_HEADER_ALIASES);
  return {
    rowIndex,
    no: normalizeNoValue(noCell.value),
    noSourceHeader: noCell.header,
    nonEmptyCellCount: Object.values(normalized).filter(Boolean).length,
    originalRow: normalized,
    poNumber: poNumbers[0] || "",
    poNumbers,
    poSourceHeader: poCell.header,
    poddDate: normalizeCellValue(poddCell.value),
    poddSourceHeader: poddCell.header,
    status: normalizeCellValue(statusCell.value),
    statusSourceHeader: statusCell.header,
  };
}

function findCellByAliases(row, aliases) {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.has(normalizeHeaderLabel(key))) {
      return { found: true, header: key, value };
    }
  }
  return { found: false, header: "", value: "" };
}

function splitPoNumbers(value) {
  return String(value || "")
    .split(/[,，;；\r\n]+/)
    .map((item) => normalizePoNumber(item))
    .filter(Boolean);
}

function collectPoNumbers(rows) {
  const seen = new Set();
  const poNumbers = [];
  for (const row of rows) {
    for (const poNumber of row.poNumbers || []) {
      if (seen.has(poNumber)) continue;
      seen.add(poNumber);
      poNumbers.push(poNumber);
    }
  }
  return poNumbers;
}

function collectNoGroups(rows) {
  const groups = [];
  const groupsByNo = new Map();
  for (const row of rows) {
    const no = normalizeNoValue(row.no);
    if (!no) continue;
    const poNumbers = Array.isArray(row.poNumbers) ? row.poNumbers : [];
    if (poNumbers.length === 0) continue;

    let group = groupsByNo.get(no);
    if (!group) {
      group = {
        no,
        firstPoddDate: "",
        poddDates: [],
        rows: [],
        poNumbers: [],
      };
      groupsByNo.set(no, group);
      groups.push(group);
    }
    group.rows.push(row);
    const poddDate = normalizeCellValue(row.poddDate);
    if (poddDate && !group.poddDates.includes(poddDate)) {
      group.poddDates.push(poddDate);
      if (!group.firstPoddDate) {
        group.firstPoddDate = poddDate;
      }
    }
    for (const poNumber of poNumbers) {
      if (!group.poNumbers.includes(poNumber)) {
        group.poNumbers.push(poNumber);
      }
    }
  }
  return groups.filter((group) => group.poNumbers.length > 0);
}

function normalizePoNumber(value) {
  const text = normalizeCellValue(value);
  if (!text || /^(total|subtotal|合计|总计|小计)$/i.test(text)) {
    return "";
  }
  return text;
}

function normalizeNoValue(value) {
  const text = normalizeCellValue(value);
  if (!text || /^(total|subtotal|合计|总计|小计)$/i.test(text)) {
    return "";
  }
  return text;
}

function normalizeCellValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeHeaderLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[＃#]/g, "#")
    .replace(/[\s_\-./:：()（）]+/g, "")
    .toLowerCase();
}
