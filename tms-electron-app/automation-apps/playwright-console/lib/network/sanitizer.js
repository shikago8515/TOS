const REDACTED = '[redacted]';
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'sap-contextid'
]);
const SENSITIVE_PAYLOAD_KEY_PATTERN = /(password|passwd|secret|token|authorization|cookie|session|csrf)/i;
const TEXT_PREVIEW_LIMIT = 500;
const ARRAY_PREVIEW_LIMIT = 5;

function redactHeaders(headers = {}) {
  return Object.entries(headers || {}).reduce((result, [name, value]) => {
    const normalizedName = String(name).toLowerCase();
    result[normalizedName] = SENSITIVE_HEADERS.has(normalizedName) ? REDACTED : value;
    return result;
  }, {});
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function redactPayloadPreview(value, key = '') {
  if (SENSITIVE_PAYLOAD_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.slice(0, ARRAY_PREVIEW_LIMIT).map((item) => redactPayloadPreview(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [childKey, childValue]) => {
      result[childKey] = redactPayloadPreview(childValue, childKey);
      return result;
    }, {});
  }

  return value;
}

function summarizePayload(text) {
  const payloadText = text == null ? '' : String(text);
  const size = payloadText.length;

  if (!payloadText) {
    return { kind: 'empty', size: 0, keys: [], preview: null };
  }

  const parsedPayload = safeJsonParse(payloadText);
  if (parsedPayload && !Array.isArray(parsedPayload) && typeof parsedPayload === 'object') {
    return {
      kind: 'json',
      size,
      keys: Object.keys(parsedPayload).sort(),
      preview: redactPayloadPreview(parsedPayload)
    };
  }

  return {
    kind: 'text',
    size,
    keys: [],
    preview: payloadText.slice(0, TEXT_PREVIEW_LIMIT)
  };
}

module.exports = {
  redactHeaders,
  safeJsonParse,
  summarizePayload
};
