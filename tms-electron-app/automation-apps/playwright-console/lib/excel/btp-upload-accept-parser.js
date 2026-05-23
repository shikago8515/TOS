const path = require('node:path');
const { BaseParser } = require('./base-parser');
const {
  buildAliasMap,
  rowToRecord,
  hasValue,
  ExcelParseError
} = require('../core');

class BtpUploadAcceptParser extends BaseParser {
  parse(filePath) {
    const { workbook, sheetName, sheet } = this.loadWorkbook(filePath);
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
      const taskId = String(record.taskId ?? '').trim();
      const decision = String(record.decision ?? '').trim();
      
      if (taskId) {
        items.push({
          taskId,
          decision: decision.toLowerCase(),
          comments: String(record.comments ?? '').trim(),
          sourceRow: rowIndex + 1
        });
      }
    }

    if (!items.length) {
      throw new ExcelParseError('No task rows found');
    }

    return {
      workflowId: 'btp-upload-accept',
      fileName: path.basename(filePath),
      sheetName,
      totalRows: items.length,
      preview: items.slice(0, 20),
      items
    };
  }
}

module.exports = { BtpUploadAcceptParser };
