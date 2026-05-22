const path = require('node:path');

function isConfigured(value) {
  return Boolean(value) && !String(value).startsWith('TODO_SET_');
}

function fillTemplate(template, variables) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    return variables[key] === undefined ? `{${key}}` : String(variables[key]);
  });
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function parseNumber(value) {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildAliasMap(headerAliases) {
  const aliasMap = new Map();

  for (const [canonicalKey, aliases] of Object.entries(headerAliases)) {
    for (const alias of aliases) {
      aliasMap.set(normalizeHeader(alias), canonicalKey);
    }
  }

  return aliasMap;
}

function rowToRecord(row, headerRow, aliasMap) {
  const record = {};

  headerRow.forEach((headerCell, columnIndex) => {
    const canonicalKey = aliasMap.get(normalizeHeader(headerCell));
    if (canonicalKey) {
      record[canonicalKey] = row[columnIndex];
    }
  });

  return record;
}

function parseSelector(selectorConfig) {
  if (typeof selectorConfig === 'string') {
    return selectorConfig;
  }

  if (typeof selectorConfig === 'object' && selectorConfig.type && selectorConfig.value) {
    const { type, value } = selectorConfig;

    switch (type) {
      case 'text':
        return `text=${value}`;
      case 'id':
        return `#${value}`;
      case 'class':
        return `.${value}`;
      case 'xpath':
        return value;
      case 'role':
        return `role=${value}`;
      case 'label':
        return `label=${value}`;
      case 'placeholder':
        return `input[placeholder="${value}"]`;
      case 'attribute':
        return `[${value}]`;
      default:
        return value;
    }
  }

  return String(selectorConfig || '');
}

function buildLocator(page, selectorConfig, frame = null) {
  const selector = parseSelector(selectorConfig);
  const target = frame || page;
  return target.locator(selector).first();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const appRoot = path.resolve(__dirname, '..', '..');
const runtimeDataRoot = process.env.TMS_PLAYWRIGHT_DATA_DIR || appRoot;

module.exports = {
  isConfigured,
  fillTemplate,
  hasValue,
  parseNumber,
  normalizeHeader,
  buildAliasMap,
  rowToRecord,
  parseSelector,
  buildLocator,
  delay,
  appRoot,
  runtimeDataRoot
};
