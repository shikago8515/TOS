const path = require('node:path');
const { BaseParser } = require('./base-parser');
const {
  buildAliasMap,
  rowToRecord,
  ExcelParseError
} = require('../core');

class BtpPoDecisionsParser extends BaseParser {
  parse(filePath) {
    const { sheetName, sheet } = this.loadWorkbook(filePath);
    const rows = this.sheetToRows(sheet);
    const aliasMap = buildAliasMap(this.workflowConfig.excel.headerAliases);
    const headerRowIndex = this.findHeaderRow(rows, aliasMap, 1);
    const headerRow = rows[headerRowIndex];
    const items = [];

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }

      const record = rowToRecord(row, headerRow, aliasMap);
      const caseNumber = clean(record.caseNumber);
      const poNumber = clean(record.poNumber);
      const taskId = clean(record.taskId);

      if (!caseNumber && !poNumber && !taskId) {
        continue;
      }

      items.push({
        caseNumber,
        poNumber,
        taskId,
        decision: normalizeDecision(record.decision),
        comments: clean(record.comments),
        sourceRow: rowIndex + 1
      });
    }

    if (!items.length) {
      throw new ExcelParseError('No rows with Case Number, PO Number or Task ID were found.');
    }

    return {
      workflowId: 'sap-btp-po-decisions',
      fileName: path.basename(filePath),
      sheetName,
      totalRows: items.length,
      preview: items.slice(0, 20),
      items
    };
  }
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeDecision(value) {
  const raw = clean(value);
  const lower = raw.toLowerCase();

  if (!raw || lower === 'accept' || raw === '接受' || raw === '同意' || raw === '批准') {
    return 'Accept';
  }

  if (lower === 'reject' || raw === '拒绝' || raw === '驳回') {
    return 'Reject';
  }

  return raw;
}

module.exports = { BtpPoDecisionsParser };
