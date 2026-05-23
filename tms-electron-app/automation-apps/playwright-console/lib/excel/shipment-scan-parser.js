const path = require('node:path');
const { BaseParser } = require('./base-parser');
const {
  buildAliasMap,
  rowToRecord,
  hasValue,
  ExcelParseError
} = require('../core');

class ShipmentScanParser extends BaseParser {
  parse(filePath) {
    const { workbook, sheetName, sheet } = this.loadWorkbook(filePath);
    const rows = this.sheetToRows(sheet);
    const aliasMap = buildAliasMap(this.workflowConfig.excel.headerAliases);
    const headerRowIndex = this.findHeaderRow(rows, aliasMap, 1);
    const headerRow = rows[headerRowIndex];
    
    const values = [];
    const keys = Array.from(aliasMap.values());
    const firstKey = keys[0];

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }

      const record = rowToRecord(row, headerRow, aliasMap);
      const scanValue = String(record[firstKey] ?? '').trim();
      
      if (scanValue) {
        values.push({
          scanValue,
          sourceRow: rowIndex + 1
        });
      }
    }

    if (!values.length) {
      throw new ExcelParseError('No scan values found');
    }

    return {
      workflowId: 'shipment-scan',
      fileName: path.basename(filePath),
      sheetName,
      totalRows: values.length,
      preview: values.slice(0, 20),
      items: values
    };
  }
}

module.exports = { ShipmentScanParser };
