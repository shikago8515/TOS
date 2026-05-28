const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRunMode,
  assertSupportedRunMode
} = require('../lib/workflows/workflow-runner');

test('normalizeRunMode defaults to debug-ui', () => {
  assert.equal(normalizeRunMode(''), 'debug-ui');
  assert.equal(normalizeRunMode(undefined), 'debug-ui');
});

test('normalizeRunMode accepts capture mode', () => {
  assert.equal(normalizeRunMode('capture'), 'capture');
});

test('assertSupportedRunMode rejects fast-api until a template exists', () => {
  assert.throws(
    () => assertSupportedRunMode('fast-api'),
    /Fast API mode is not enabled yet/
  );
});
