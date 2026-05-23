const path = require('node:path');
const { BaseParser } = require('./base-parser');
const {
  buildAliasMap,
  rowToRecord,
  hasValue,
  parseNumber,
  fillTemplate,
  ExcelParseError
} = require('../core');

class InvoiceAdjustmentsParser extends BaseParser {
  parse(filePath) {
    const { workbook, sheetName, sheet } = this.loadWorkbook(filePath);
    const rows = this.sheetToRows(sheet);
    const aliasMap = buildAliasMap(this.workflowConfig.excel.headerAliases);
    const headerRowIndex = this.findHeaderRow(rows, aliasMap, 2);
    const headerRow = rows[headerRowIndex];
    const items = [];

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) {
        continue;
      }

      const record = rowToRecord(row, headerRow, aliasMap);
      if (!hasValue(record.poNumber)) {
        continue;
      }

      const baseItem = {
        invoiceNo: String(record.invoiceNo ?? '').trim(),
        poNumber: String(record.poNumber ?? '').trim(),
        customerNo: String(record.customerNo ?? '').trim(),
        remarks: String(record.remarks ?? '').trim(),
        sourceRow: rowIndex + 1
      };

      for (const reasonCode of ['ZADD', 'ZDOC']) {
        const value = parseNumber(record[reasonCode.toLowerCase()]);
        if (value === null || value === 0) {
          continue;
        }

        items.push({
          ...baseItem,
          reasonCode,
          value,
          comment: buildComment(
            this.workflowConfig.defaults?.commentTemplate || '{invoiceNo}-{poNumber}-{reasonCode}',
            { ...baseItem, reasonCode, value }
          )
        });
      }
    }

    if (!items.length) {
      throw new ExcelParseError('No usable ZADD/ZDOC rows found');
    }

    const totalsByCode = items.reduce((acc, item) => {
      acc[item.reasonCode] = (acc[item.reasonCode] || 0) + item.value;
      return acc;
    }, {});

    return {
      workflowId: 'invoice-adjustments',
      fileName: path.basename(filePath),
      sheetName,
      totalRows: items.length,
      totalsByCode,
      preview: items.slice(0, 20),
      items
    };
  }
}

function buildComment(template, item) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return item[key] === null || item[key] === undefined ? '' : String(item[key]);
  });
}

module.exports = { InvoiceAdjustmentsParser };
