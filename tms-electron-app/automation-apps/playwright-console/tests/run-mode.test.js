const test = require('node:test');
const assert = require('node:assert/strict');
const {
  runAutomation,
  normalizeRunMode,
  assertSupportedRunMode
} = require('../lib/workflows/workflow-runner');

test('normalizeRunMode defaults to debug-ui', () => {
  assert.equal(normalizeRunMode(''), 'debug-ui');
  assert.equal(normalizeRunMode(undefined), 'debug-ui');
});

test('normalizeRunMode accepts capture mode', () => {
  assert.equal(normalizeRunMode('capture'), 'capture');
  assert.equal(normalizeRunMode(' Capture '), 'capture');
});

test('assertSupportedRunMode accepts normalized capture mode', () => {
  assert.equal(assertSupportedRunMode(' Capture '), 'capture');
});

test('assertSupportedRunMode rejects fast-api until a template exists', () => {
  assert.throws(
    () => assertSupportedRunMode('fast-api'),
    /Fast API mode is not enabled yet/
  );
});

test('runAutomation rejects capture before workflow, excel, or browser errors', async () => {
  await assert.rejects(
    () => runAutomation({
      runMode: 'capture',
      workflowId: 'missing',
      excelPath: 'missing.xlsx'
    }),
    /Capture mode is not wired yet/
  );
});

test('assertSupportedRunMode rejects hybrid with mode-specific disabled message', () => {
  assert.throws(
    () => assertSupportedRunMode('hybrid'),
    /hybrid.*not enabled yet/
  );
});

test('assertSupportedRunMode rejects unknown modes with available modes', () => {
  assert.throws(
    () => assertSupportedRunMode('nonsense'),
    /Unknown run mode: nonsense.*debug-ui, capture/
  );
});

test('runAutomation rejects fast-api before workflow, excel, or browser errors', async () => {
  await assert.rejects(
    () => runAutomation({
      runMode: 'fast-api',
      workflowId: 'missing',
      excelPath: 'missing.xlsx'
    }),
    /Fast API mode is not enabled yet/
  );
});
