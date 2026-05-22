const path = require('node:path');
const { BaseParser } = require('./base-parser');
const {
  buildAliasMap,
  rowToRecord,
  hasValue,
  ExcelParseError
} = require('../core');

class GenericFormFillParser extends BaseParser {
  parse(filePath) {
    const { workbook, sheetName, sheet } = this.loadWorkbook(filePath);
    const rows = this.sheetToRows(sheet);
    const aliasMap = buildAliasMap(this.workflowConfig.excel.headerAliases);
    const headerRowIndex = this.findHeaderRow(rows, aliasMap, 1);
    const headerRow = rows[headerRowIndex];
    const keyColumn = this.workflowConfig.excel.keyColumn || 'poNumber';
    const items = [];

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }

      const record = rowToRecord(row, headerRow, aliasMap);
      const keyValue = String(record[keyColumn] ?? '').trim();
      
      if (keyValue) {
        const item = {
          sourceRow: rowIndex + 1
        };
        
        for (const canonicalKey of aliasMap.values()) {
          item[canonicalKey] = String(record[canonicalKey] ?? '').trim();
        }
        
        items.push(item);
      }
    }

    if (!items.length) {
      throw new ExcelParseError(`No rows with ${keyColumn} found`);
    }

    return {
      workflowId: 'generic-form-fill',
      fileName: path.basename(filePath),
      sheetName,
      totalRows: items.length,
      keyColumn,
      preview: items.slice(0, 20),
      items
    };
  }
}

module.exports = { GenericFormFillParser };
