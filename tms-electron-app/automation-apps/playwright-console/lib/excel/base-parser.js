const xlsx = require('xlsx');
const path = require('node:path');
const { normalizeHeader, buildAliasMap, hasValue, ExcelParseError } = require('../core');

class BaseParser {
  constructor(workflowConfig) {
    this.workflowConfig = workflowConfig;
  }

  parse(filePath) {
    throw new Error('parse() must be implemented by subclass');
  }

  loadWorkbook(filePath) {
    try {
      const workbook = xlsx.readFile(filePath, { cellDates: true });
      const sheetName = this.workflowConfig.worksheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new ExcelParseError(`Worksheet "${sheetName}" not found`, {
          details: { filePath, sheetName }
        });
      }

      return { workbook, sheetName, sheet };
    } catch (error) {
      if (error instanceof ExcelParseError) {
        throw error;
      }
      throw new ExcelParseError(`Failed to load workbook: ${error.message}`, {
        details: { filePath }
      });
    }
  }

  sheetToRows(sheet) {
    return xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: ''
    });
  }

  findHeaderRow(rows, aliasMap, minimumMatches = 2) {
    let bestMatch = null;

    rows.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) {
        return;
      }

      const matches = row.reduce((count, cell) => {
        return count + (aliasMap.has(normalizeHeader(cell)) ? 1 : 0);
      }, 0);

      if (!bestMatch || matches > bestMatch.matches) {
        bestMatch = { rowIndex, matches };
      }
    });

    if (!bestMatch || bestMatch.matches < minimumMatches) {
      throw new ExcelParseError('Could not find valid header row');
    }

    return bestMatch.rowIndex;
  }
}

module.exports = { BaseParser };
