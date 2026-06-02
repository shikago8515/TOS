const fs = require('node:fs/promises');
const path = require('node:path');
const xlsx = require('xlsx');

async function persistRunArtifacts(options) {
  const {
    runsDir,
    workflowId,
    payload,
    runKind = 'local-run'
  } = options;

  const runId = buildRunId(runKind, workflowId);
  const runDir = path.join(runsDir, runId);
  await fs.mkdir(runDir, { recursive: true });

  const resultJsonPath = path.join(runDir, 'result.json');
  const failedJsonPath = path.join(runDir, 'failed-rows.json');
  const failedCsvPath = path.join(runDir, 'failed-rows.csv');
  const failedXlsxPath = path.join(runDir, 'failed-rows.xlsx');
  const manifestPath = path.join(runDir, 'manifest.json');

  const failedRows = collectFailedRows(payload);
  const manifest = buildManifest({
    runId,
    workflowId,
    payload,
    failedRows
  });

  await fs.writeFile(resultJsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(failedJsonPath, JSON.stringify(failedRows, null, 2), 'utf8');
  await fs.writeFile(failedCsvPath, toCsv(failedRows), 'utf8');
  writeXlsx(failedRows, failedXlsxPath);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    runId,
    runDir,
    manifest,
    resultJsonPath,
    failedJsonPath,
    failedCsvPath,
    failedXlsxPath,
    manifestPath,
    failedRows
  };
}

function buildRunId(runKind, workflowId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeWorkflowId = String(workflowId || 'workflow')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workflow';

  return `${runKind}-${safeWorkflowId}-${stamp}`;
}

function buildManifest({ runId, workflowId, payload, failedRows }) {
  const result = payload?.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};
  const workflowResult = result.workflowResult || {};
  const rowResults = Array.isArray(workflowResult.results) ? workflowResult.results : [];
  const completedRowCount = rowResults.filter((item) => item.status === 'ok').length;
  const failedRowCount = failedRows.length;

  return {
    runId,
    workflowId,
    ok: payload?.ok !== false,
    mode: result.mode || 'unknown',
    generatedAt: new Date().toISOString(),
    fileName: parsedWorkbook.fileName || '',
    sheetName: parsedWorkbook.sheetName || '',
    totalRows: Number(parsedWorkbook.totalRows || rowResults.length || 0),
    completedRowCount,
    failedRowCount,
    screenshotPath: payload?.screenshotPath || null,
    error: payload?.error || '',
    logsCount: Array.isArray(payload?.logs) ? payload.logs.length : 0
  };
}

function collectFailedRows(payload) {
  const result = payload?.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};
  const sourceItems = Array.isArray(parsedWorkbook.items) ? parsedWorkbook.items : [];
  const workflowRows = Array.isArray(result.workflowResult?.results)
    ? result.workflowResult.results
    : [];
  const fallbackReason = summarizeFailureReason(
    payload?.error || 'This row was not completed by the automation run.'
  );

  if (workflowRows.length === 0) {
    return payload?.ok === false
      ? sourceItems.map((item) => toFailedRow(item, fallbackReason))
      : [];
  }

  const sourceMap = new Map();
  const resolvedKeys = new Set();
  sourceItems.forEach((item, index) => {
    sourceMap.set(buildRowKey(item, index), item);
  });

  const failedRows = [];

  workflowRows.forEach((row, index) => {
    const rowKey = buildRowKey(row, index);
    resolvedKeys.add(rowKey);

    if (row?.status !== 'failed') {
      return;
    }

    const sourceItem = sourceMap.get(rowKey);
    failedRows.push({
      ...pickRowFields(sourceItem || row),
      reason: summarizeFailureReason(row?.error || payload?.error || fallbackReason)
    });
  });

  if (payload?.ok === false) {
    sourceItems.forEach((item, index) => {
      const rowKey = buildRowKey(item, index);
      if (resolvedKeys.has(rowKey)) {
        return;
      }
      failedRows.push(toFailedRow(item, fallbackReason));
    });
  }

  return dedupeRows(failedRows).sort((left, right) => {
    return Number(left.sourceRow || 0) - Number(right.sourceRow || 0);
  });
}

function buildRowKey(item, index) {
  const sourceRow = Number(item?.sourceRow);
  if (Number.isFinite(sourceRow) && sourceRow > 0) {
    return `row:${sourceRow}`;
  }

  return [
    `idx:${index}`,
    clean(item?.caseNumber),
    clean(item?.poNumber),
    clean(item?.taskId),
    clean(item?.decision)
  ].join('|');
}

function toFailedRow(item, reason) {
  return {
    ...pickRowFields(item),
    reason: summarizeFailureReason(reason)
  };
}

function pickRowFields(item) {
  return {
    sourceRow: Number(item?.sourceRow || 0) || '',
    caseNumber: clean(item?.caseNumber),
    poNumber: clean(item?.poNumber),
    taskId: clean(item?.taskId),
    decision: clean(item?.decision),
    comments: clean(item?.comments)
  };
}

function dedupeRows(rows) {
  const seen = new Set();
  const uniqueRows = [];

  rows.forEach((row) => {
    const key = [
      row.sourceRow,
      row.caseNumber,
      row.poNumber,
      row.taskId,
      row.decision,
      row.reason
    ].join('|');

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueRows.push(row);
  });

  return uniqueRows;
}

function toCsv(rows) {
  const headers = ['sourceRow', 'caseNumber', 'poNumber', 'taskId', 'decision', 'comments', 'reason'];
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const values = headers.map((header) => csvEscape(row?.[header] ?? ''));
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeXlsx(rows, outputPath) {
  const workbook = xlsx.utils.book_new();
  const sheetRows = rows.length ? rows : [{ sourceRow: '', caseNumber: '', poNumber: '', taskId: '', decision: '', comments: '', reason: '' }];
  const sheet = xlsx.utils.json_to_sheet(sheetRows);
  xlsx.utils.book_append_sheet(workbook, sheet, 'Failed Rows');
  xlsx.writeFile(workbook, outputPath);
}

function summarizeFailureReason(reason) {
  const text = clean(reason);
  if (!text) {
    return 'Automation failed.';
  }

  const concise = text
    .split(' Failed rows:')[0]
    .split('. Failed rows:')[0]
    .split(' Preview:')[0]
    .split('. Preview:')[0]
    .split(' Root error:')[0]
    .trim();

  if (concise.length <= 220) {
    return concise;
  }

  return `${concise.slice(0, 217)}...`;
}

function clean(value) {
  return String(value ?? '').trim();
}

module.exports = {
  persistRunArtifacts
};
