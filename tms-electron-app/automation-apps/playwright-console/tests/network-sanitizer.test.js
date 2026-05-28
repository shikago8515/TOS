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
    'x-csrf-token': 'token',
    'Content-Type': 'application/json'
  });

  assert.equal(result.authorization, '[redacted]');
  assert.equal(result.cookie, '[redacted]');
  assert.equal(result['x-csrf-token'], '[redacted]');
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
