const test = require('node:test');
const assert = require('node:assert/strict');
const {
  redactHeaders,
  summarizePayload,
  safeJsonParse
} = require('../lib/network/sanitizer');

test('redactHeaders hides authentication and session headers case-insensitively', () => {
  const result = redactHeaders({
    Authorization: 'Bearer secret',
    Cookie: 'SESSION=secret',
    'Set-Cookie': 'SESSION=secret',
    'x-csrf-token': 'token',
    'sap-contextid': 'sap-secret',
    'Content-Type': 'application/json'
  });

  assert.equal(result.authorization, '[redacted]');
  assert.equal(result.cookie, '[redacted]');
  assert.equal(result['set-cookie'], '[redacted]');
  assert.equal(result['x-csrf-token'], '[redacted]');
  assert.equal(result['sap-contextid'], '[redacted]');
  assert.equal(result['content-type'], 'application/json');
});

test('summarizePayload returns json keys and redacts sensitive values', () => {
  const result = summarizePayload(JSON.stringify({
    decision: 'Accept',
    password: 'secret',
    nested: { token: 'secret-token' }
  }));

  assert.equal(result.kind, 'json');
  assert.deepEqual(result.keys, ['decision', 'nested', 'password']);
  assert.equal(result.preview.password, '[redacted]');
  assert.equal(result.preview.nested.token, '[redacted]');
});

test('safeJsonParse returns null for non-json text', () => {
  assert.equal(safeJsonParse('not json'), null);
});

test('summarizePayload returns empty summary for empty payloads', () => {
  assert.deepEqual(summarizePayload(''), {
    kind: 'empty',
    size: 0,
    keys: [],
    preview: null
  });
});

test('summarizePayload returns byte size and 500-character preview for text payloads', () => {
  const payload = `${'a'.repeat(500)}汉`;
  const result = summarizePayload(payload);

  assert.equal(result.kind, 'text');
  assert.equal(result.size, Buffer.byteLength(payload));
  assert.deepEqual(result.keys, []);
  assert.equal(result.preview, 'a'.repeat(500));
});

test('summarizePayload truncates array previews to 5 items', () => {
  const result = summarizePayload(JSON.stringify({
    values: [1, 2, 3, 4, 5, 6, 7]
  }));

  assert.deepEqual(result.preview.values, [1, 2, 3, 4, 5]);
});
