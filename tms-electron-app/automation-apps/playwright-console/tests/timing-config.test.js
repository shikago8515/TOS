const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDelayMs } = require('../lib/core/utils');

test('resolveDelayMs preserves explicit zero delays', () => {
  assert.equal(resolveDelayMs(0, 3000), 0);
  assert.equal(resolveDelayMs('0', 3000), 0);
});

test('resolveDelayMs uses fallback only for missing or invalid values', () => {
  assert.equal(resolveDelayMs(undefined, 3000), 3000);
  assert.equal(resolveDelayMs(null, 3000), 3000);
  assert.equal(resolveDelayMs('', 3000), 3000);
  assert.equal(resolveDelayMs('abc', 3000), 3000);
  assert.equal(resolveDelayMs(-1, 3000), 3000);
});

test('resolveDelayMs accepts positive numeric configuration', () => {
  assert.equal(resolveDelayMs(250, 3000), 250);
  assert.equal(resolveDelayMs('250', 3000), 250);
});
