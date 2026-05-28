# Web Automation API Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe capture-and-analysis foundation for eventually bypassing slow UI automation with verified SAP BTP API calls.

**Architecture:** Keep the current Playwright UI workflow as the source of truth, then add a capture layer around it that records write requests, redacts sensitive data, and produces a local candidate-interface report. The first implementation ships `debug-ui` and `capture` modes only; `fast-api` and `hybrid` remain explicit unsupported modes until a real captured template is confirmed.

**Tech Stack:** Node.js CommonJS, Express 5, Playwright 1.60, built-in `node:test`, browser-side vanilla JavaScript, existing `playwright-console` app.

---

## File Structure

- Create `tms-electron-app/automation-apps/playwright-console/lib/network/sanitizer.js`: header and payload redaction helpers.
- Create `tms-electron-app/automation-apps/playwright-console/lib/network/api-template-analyzer.js`: candidate scoring and report generation from captured network records.
- Create `tms-electron-app/automation-apps/playwright-console/lib/network/network-capture.js`: Playwright page request/response capture and local artifact writing.
- Create `tms-electron-app/automation-apps/playwright-console/lib/network/index.js`: exports for the network module.
- Create `tms-electron-app/automation-apps/playwright-console/tests/network-sanitizer.test.js`: tests for sensitive header and payload handling.
- Create `tms-electron-app/automation-apps/playwright-console/tests/api-template-analyzer.test.js`: tests for candidate ranking and Markdown report content.
- Create `tms-electron-app/automation-apps/playwright-console/tests/run-mode.test.js`: tests for mode parsing and unsupported fast path guard.
- Modify `tms-electron-app/automation-apps/playwright-console/package.json`: add `test` script and include network files in `check`.
- Modify `tms-electron-app/automation-apps/playwright-console/lib/index.js`: export the network module.
- Modify `tms-electron-app/automation-apps/playwright-console/lib/workflows/base-workflow.js`: add a small event hook used by capture mode.
- Modify `tms-electron-app/automation-apps/playwright-console/lib/workflows/btp-po-decisions-workflow.js`: emit workflow context events around task lookup, decision selection, and submit.
- Modify `tms-electron-app/automation-apps/playwright-console/lib/workflows/workflow-runner.js`: parse run modes, attach capture, and return capture artifacts.
- Modify `tms-electron-app/automation-apps/playwright-console/lib/server/index.js`: accept `runMode`, validate it, and return clear errors for unsupported modes.
- Modify `tms-electron-app/automation-apps/playwright-console/public/index.html`: add a run mode selector.
- Modify `tms-electron-app/automation-apps/playwright-console/public/app.js`: submit and render run mode and capture artifacts.
- Modify `tms-electron-app/automation-apps/playwright-console/public/styles.css`: add small status styles for capture artifacts.

## Task 1: Test Harness And Redaction Helpers

**Files:**
- Modify: `tms-electron-app/automation-apps/playwright-console/package.json`
- Create: `tms-electron-app/automation-apps/playwright-console/tests/network-sanitizer.test.js`
- Create: `tms-electron-app/automation-apps/playwright-console/lib/network/sanitizer.js`
- Create: `tms-electron-app/automation-apps/playwright-console/lib/network/index.js`

- [ ] **Step 1: Add a test script before production code**

Modify `package.json` scripts to include `test`. Keep `check` syntax-only for source files.

```json
{
  "scripts": {
    "start": "node bin/start.js",
    "dev": "node bin/start.js",
    "test": "node --test tests/*.test.js",
    "check": "node --check lib/index.js && node --check public/app.js && node --check lib/server/index.js && node --check lib/workflows/btp-po-decisions-workflow.js && node --check lib/excel/btp-po-decisions-parser.js && node --check lib/network/sanitizer.js && node --check lib/network/api-template-analyzer.js && node --check lib/network/network-capture.js"
  }
}
```

- [ ] **Step 2: Write failing redaction tests**

Create `tests/network-sanitizer.test.js`.

```js
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
```

- [ ] **Step 3: Run test and verify it fails for missing module**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: `FAIL` with `Cannot find module '../lib/network/sanitizer'`.

- [ ] **Step 4: Implement minimal redaction helpers**

Create `lib/network/sanitizer.js`.

```js
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'sap-contextid'
]);

const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|authorization|cookie|session|csrf)/i;

function redactHeaders(headers = {}) {
  const redacted = {};

  for (const [name, value] of Object.entries(headers || {})) {
    const lowerName = String(name).toLowerCase();
    redacted[lowerName] = SENSITIVE_HEADER_NAMES.has(lowerName)
      ? '[redacted]'
      : String(value);
  }

  return redacted;
}

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function redactValue(value, key = '') {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[redacted]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => redactValue(item));
  }

  if (value && typeof value === 'object') {
    return redactObject(value);
  }

  return value;
}

function redactObject(input = {}) {
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = redactValue(value, key);
  }

  return output;
}

function summarizePayload(text) {
  if (!text) {
    return { kind: 'empty', size: 0, keys: [], preview: null };
  }

  const parsed = safeJsonParse(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      kind: 'json',
      size: Buffer.byteLength(text),
      keys: Object.keys(parsed).sort(),
      preview: redactObject(parsed)
    };
  }

  return {
    kind: 'text',
    size: Buffer.byteLength(String(text)),
    keys: [],
    preview: String(text).slice(0, 500)
  };
}

module.exports = {
  redactHeaders,
  safeJsonParse,
  summarizePayload
};
```

Create `lib/network/index.js`.

```js
const sanitizer = require('./sanitizer');

module.exports = {
  ...sanitizer
};
```

- [ ] **Step 5: Run test and verify it passes**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: `PASS` for all three sanitizer tests.

- [ ] **Step 6: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\package.json tms-electron-app\automation-apps\playwright-console\tests\network-sanitizer.test.js tms-electron-app\automation-apps\playwright-console\lib\network\sanitizer.js tms-electron-app\automation-apps\playwright-console\lib\network\index.js
git commit -m "test: add network redaction helpers"
```

## Task 2: API Template Analyzer

**Files:**
- Create: `tms-electron-app/automation-apps/playwright-console/tests/api-template-analyzer.test.js`
- Create: `tms-electron-app/automation-apps/playwright-console/lib/network/api-template-analyzer.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/network/index.js`

- [ ] **Step 1: Write failing analyzer tests**

Create `tests/api-template-analyzer.test.js`.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeCapture,
  createCaptureReportMarkdown
} = require('../lib/network/api-template-analyzer');

test('analyzeCapture ranks write request with decision payload as best candidate', () => {
  const capture = {
    records: [
      {
        method: 'GET',
        url: 'https://example.test/task',
        status: 200,
        requestPayload: { kind: 'empty', keys: [] },
        responsePayload: { kind: 'json', keys: ['items'] }
      },
      {
        method: 'POST',
        url: 'https://example.test/workflow/complete',
        status: 204,
        action: 'submit-click',
        context: { poNumber: '45000001', decision: 'Accept' },
        requestPayload: {
          kind: 'json',
          keys: ['decision', 'taskId', 'comments'],
          preview: { decision: 'Accept', taskId: 'TASK-1', comments: 'ok' }
        },
        responsePayload: { kind: 'empty', keys: [] }
      }
    ]
  };

  const result = analyzeCapture(capture);

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].method, 'POST');
  assert.equal(result.candidates[0].score >= 70, true);
  assert.equal(result.candidates[0].reasons.includes('write-method'), true);
  assert.equal(result.candidates[0].reasons.includes('decision-payload'), true);
});

test('createCaptureReportMarkdown includes candidate url and safety warning', () => {
  const report = createCaptureReportMarkdown({
    workflowId: 'sap-btp-po-decisions',
    capturedAt: '2026-05-28T00:00:00.000Z',
    records: [],
    analysis: {
      candidates: [{
        method: 'POST',
        url: 'https://example.test/workflow/complete',
        status: 204,
        score: 90,
        reasons: ['write-method', 'submit-action']
      }]
    }
  });

  assert.match(report, /sap-btp-po-decisions/);
  assert.match(report, /workflow\/complete/);
  assert.match(report, /不要直接启用快速 API/);
});
```

- [ ] **Step 2: Run analyzer tests and verify missing module failure**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: `FAIL` with `Cannot find module '../lib/network/api-template-analyzer'`.

- [ ] **Step 3: Implement analyzer**

Create `lib/network/api-template-analyzer.js`.

```js
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IMPORTANT_KEY_PATTERN = /(decision|task|po|case|comment|status|action|outcome)/i;
const IMPORTANT_URL_PATTERN = /(decision|submit|complete|workflow|task|approval|inbox)/i;

function analyzeCapture(capture = {}) {
  const records = Array.isArray(capture.records) ? capture.records : [];
  const candidates = records
    .map((record) => scoreRecord(record))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    totalRecords: records.length,
    candidates
  };
}

function scoreRecord(record = {}) {
  const method = String(record.method || '').toUpperCase();
  const keys = [
    ...(record.requestPayload?.keys || []),
    ...(record.responsePayload?.keys || [])
  ];
  const reasons = [];
  let score = 0;

  if (WRITE_METHODS.has(method)) {
    score += 35;
    reasons.push('write-method');
  }

  if (IMPORTANT_URL_PATTERN.test(record.url || '')) {
    score += 20;
    reasons.push('important-url');
  }

  if (keys.some((key) => /^decision$/i.test(key))) {
    score += 25;
    reasons.push('decision-payload');
  }

  if (keys.some((key) => IMPORTANT_KEY_PATTERN.test(key))) {
    score += 15;
    reasons.push('business-keys');
  }

  if (String(record.action || '').includes('submit')) {
    score += 20;
    reasons.push('submit-action');
  }

  if (!WRITE_METHODS.has(method)) {
    score = Math.min(score, 20);
  }

  return {
    method,
    url: record.url,
    status: record.status,
    action: record.action || '',
    score,
    reasons,
    requestKeys: record.requestPayload?.keys || [],
    responseKeys: record.responsePayload?.keys || []
  };
}

function createCaptureReportMarkdown(capture = {}) {
  const analysis = capture.analysis || analyzeCapture(capture);
  const lines = [
    '# 网页自动化接口捕获报告',
    '',
    `- Workflow: ${capture.workflowId || '-'}`,
    `- Captured At: ${capture.capturedAt || '-'}`,
    `- Total Records: ${analysis.totalRecords ?? (capture.records || []).length}`,
    '',
    '> 安全提示：候选接口只代表一次真实 UI 操作中观察到的网络请求，不要直接启用快速 API；必须先人工确认 URL、headers、payload、CSRF token 和业务响应字段。',
    '',
    '## 候选接口',
    ''
  ];

  if (!analysis.candidates.length) {
    lines.push('未发现高置信候选接口。');
    return lines.join('\n');
  }

  analysis.candidates.forEach((candidate, index) => {
    lines.push(`### ${index + 1}. ${candidate.method} ${candidate.url}`);
    lines.push('');
    lines.push(`- Score: ${candidate.score}`);
    lines.push(`- Status: ${candidate.status || '-'}`);
    lines.push(`- Reasons: ${candidate.reasons.join(', ') || '-'}`);
    lines.push(`- Request Keys: ${candidate.requestKeys.join(', ') || '-'}`);
    lines.push(`- Response Keys: ${candidate.responseKeys.join(', ') || '-'}`);
    lines.push('');
  });

  return lines.join('\n');
}

module.exports = {
  analyzeCapture,
  createCaptureReportMarkdown
};
```

- [ ] **Step 4: Export analyzer**

Modify `lib/network/index.js`.

```js
const sanitizer = require('./sanitizer');
const analyzer = require('./api-template-analyzer');

module.exports = {
  ...sanitizer,
  ...analyzer
};
```

- [ ] **Step 5: Run tests and verify analyzer passes**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: sanitizer and analyzer tests pass.

- [ ] **Step 6: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\tests\api-template-analyzer.test.js tms-electron-app\automation-apps\playwright-console\lib\network\api-template-analyzer.js tms-electron-app\automation-apps\playwright-console\lib\network\index.js
git commit -m "feat: analyze captured automation requests"
```

## Task 3: Run Mode Parsing And Guardrails

**Files:**
- Create: `tms-electron-app/automation-apps/playwright-console/tests/run-mode.test.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/workflows/workflow-runner.js`

- [ ] **Step 1: Write failing run mode tests**

Create `tests/run-mode.test.js`.

```js
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
```

- [ ] **Step 2: Run tests and verify missing exports failure**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: `FAIL` because `normalizeRunMode` is not exported.

- [ ] **Step 3: Add mode helpers**

Modify `lib/workflows/workflow-runner.js` near the top.

```js
const SUPPORTED_RUN_MODES = new Set(['debug-ui', 'capture']);
const KNOWN_RUN_MODES = new Set(['debug-ui', 'capture', 'hybrid', 'fast-api']);

function normalizeRunMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode || 'debug-ui';
}

function assertSupportedRunMode(mode) {
  const normalized = normalizeRunMode(mode);

  if (!KNOWN_RUN_MODES.has(normalized)) {
    throw new Error(`Unknown run mode: ${normalized}`);
  }

  if (!SUPPORTED_RUN_MODES.has(normalized)) {
    throw new Error('Fast API mode is not enabled yet. Run capture mode first and confirm the captured interface template.');
  }

  return normalized;
}
```

Export them at the bottom.

```js
module.exports = {
  runAutomation,
  launchPage,
  normalizeRunMode,
  assertSupportedRunMode
};
```

- [ ] **Step 4: Run tests and verify mode helpers pass**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\tests\run-mode.test.js tms-electron-app\automation-apps\playwright-console\lib\workflows\workflow-runner.js
git commit -m "feat: guard unsupported automation run modes"
```

## Task 4: Network Capture Module

**Files:**
- Create: `tms-electron-app/automation-apps/playwright-console/lib/network/network-capture.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/network/index.js`

- [ ] **Step 1: Add failing capture behavior to analyzer test file**

Append this test to `tests/api-template-analyzer.test.js` so capture artifact shape is pinned before implementation.

```js
test('network capture writes analysis-ready shape', async () => {
  const { NetworkCapture } = require('../lib/network/network-capture');
  const capture = new NetworkCapture({
    workflowId: 'sap-btp-po-decisions',
    outputDir: require('node:os').tmpdir()
  });

  capture.mark('submit-click', { poNumber: '45000001', decision: 'Accept' });
  capture.addRecord({
    method: 'POST',
    url: 'https://example.test/workflow/complete',
    resourceType: 'xhr',
    status: 204,
    requestHeaders: { Cookie: 'secret' },
    responseHeaders: { 'Content-Type': 'application/json' },
    requestPostData: JSON.stringify({ decision: 'Accept', taskId: 'TASK-1' }),
    responseText: ''
  });

  const payload = capture.toJSON();

  assert.equal(payload.workflowId, 'sap-btp-po-decisions');
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].action, 'submit-click');
  assert.equal(payload.records[0].context.poNumber, '45000001');
  assert.equal(payload.records[0].requestHeaders.cookie, '[redacted]');
  assert.equal(payload.analysis.candidates.length, 1);
});
```

- [ ] **Step 2: Run tests and verify missing capture module failure**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: `FAIL` with `Cannot find module '../lib/network/network-capture'`.

- [ ] **Step 3: Implement NetworkCapture**

Create `lib/network/network-capture.js`.

```js
const fs = require('node:fs/promises');
const path = require('node:path');
const { redactHeaders, summarizePayload } = require('./sanitizer');
const { analyzeCapture, createCaptureReportMarkdown } = require('./api-template-analyzer');

const CAPTURED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CAPTURED_RESOURCE_TYPES = new Set(['fetch', 'xhr']);

class NetworkCapture {
  constructor(options = {}) {
    this.workflowId = options.workflowId || 'unknown-workflow';
    this.outputDir = options.outputDir;
    this.records = [];
    this.currentAction = '';
    this.currentContext = {};
    this.attachedPages = new WeakSet();
    this.capturedAt = new Date().toISOString();
  }

  mark(action, context = {}) {
    this.currentAction = action || '';
    this.currentContext = { ...context };
  }

  attachPage(page, label = 'page') {
    if (!page || this.attachedPages.has(page)) {
      return;
    }

    this.attachedPages.add(page);
    page.on('popup', (popup) => this.attachPage(popup, 'popup'));
    page.on('requestfinished', async (request) => {
      await this.captureRequest(request, label).catch(() => {});
    });
    page.on('requestfailed', async (request) => {
      await this.captureRequest(request, label, true).catch(() => {});
    });
  }

  async captureRequest(request, pageLabel, failed = false) {
    const method = String(request.method() || '').toUpperCase();
    const resourceType = request.resourceType();

    if (!CAPTURED_METHODS.has(method) || !CAPTURED_RESOURCE_TYPES.has(resourceType)) {
      return;
    }

    const response = failed ? null : await request.response().catch(() => null);
    const responseText = response ? await response.text().catch(() => '') : '';

    this.addRecord({
      method,
      url: request.url(),
      resourceType,
      pageLabel,
      failed,
      status: response?.status() || 0,
      requestHeaders: request.headers(),
      responseHeaders: response ? await response.allHeaders().catch(() => response.headers()) : {},
      requestPostData: request.postData() || '',
      responseText
    });
  }

  addRecord(record) {
    this.records.push({
      capturedAt: new Date().toISOString(),
      method: String(record.method || '').toUpperCase(),
      url: record.url || '',
      resourceType: record.resourceType || '',
      pageLabel: record.pageLabel || '',
      failed: Boolean(record.failed),
      status: record.status || 0,
      action: this.currentAction,
      context: { ...this.currentContext },
      requestHeaders: redactHeaders(record.requestHeaders || {}),
      responseHeaders: redactHeaders(record.responseHeaders || {}),
      requestPayload: summarizePayload(record.requestPostData || ''),
      responsePayload: summarizePayload(record.responseText || '')
    });
  }

  toJSON() {
    const payload = {
      workflowId: this.workflowId,
      capturedAt: this.capturedAt,
      records: this.records
    };
    payload.analysis = analyzeCapture(payload);
    return payload;
  }

  async writeArtifacts() {
    if (!this.outputDir) {
      return null;
    }

    await fs.mkdir(this.outputDir, { recursive: true });
    const stamp = this.capturedAt.replace(/[:.]/g, '-');
    const jsonPath = path.join(this.outputDir, `${this.workflowId}-${stamp}.json`);
    const reportPath = path.join(this.outputDir, `${this.workflowId}-${stamp}.md`);
    const payload = this.toJSON();

    await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.writeFile(reportPath, createCaptureReportMarkdown(payload), 'utf8');

    return {
      jsonPath,
      reportPath,
      recordCount: payload.records.length,
      candidateCount: payload.analysis.candidates.length
    };
  }
}

module.exports = { NetworkCapture };
```

- [ ] **Step 4: Export NetworkCapture**

Modify `lib/network/index.js`.

```js
const sanitizer = require('./sanitizer');
const analyzer = require('./api-template-analyzer');
const { NetworkCapture } = require('./network-capture');

module.exports = {
  ...sanitizer,
  ...analyzer,
  NetworkCapture
};
```

- [ ] **Step 5: Run tests and verify capture passes**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\tests\api-template-analyzer.test.js tms-electron-app\automation-apps\playwright-console\lib\network\network-capture.js tms-electron-app\automation-apps\playwright-console\lib\network\index.js
git commit -m "feat: capture write requests during automation"
```

## Task 5: Workflow Capture Integration

**Files:**
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/index.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/workflows/base-workflow.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/workflows/btp-po-decisions-workflow.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/workflows/workflow-runner.js`

- [ ] **Step 1: Write failing runner integration test**

Append this test to `tests/run-mode.test.js`.

```js
test('assertSupportedRunMode allows capture mode', () => {
  assert.equal(assertSupportedRunMode('capture'), 'capture');
});
```

Run `npm test` to verify this passes before integration; this guards the mode while implementation changes proceed.

- [ ] **Step 2: Export network module from app entry**

Modify `lib/index.js`.

```js
const core = require('./core');
const config = require('./config');
const cursor = require('./cursor');
const workflows = require('./workflows');
const excel = require('./excel');
const server = require('./server');
const network = require('./network');

module.exports = {
  ...core,
  ...config,
  ...cursor,
  ...workflows,
  ...excel,
  ...server,
  ...network
};
```

- [ ] **Step 3: Add workflow event hook**

Modify `lib/workflows/base-workflow.js` inside `BaseWorkflow`.

```js
  emitAutomationEvent(type, detail = {}) {
    if (typeof this.options.onAutomationEvent === 'function') {
      this.options.onAutomationEvent({
        type,
        detail,
        timestamp: new Date().toISOString()
      });
    }
  }
```

- [ ] **Step 4: Emit context from BTP workflow**

Modify `lib/workflows/btp-po-decisions-workflow.js`.

Add before `findTaskRow(worklist, anchorItem)` in `processTaskGroup`:

```js
    this.emitAutomationEvent('task-group-start', {
      caseNumber: anchorItem.caseNumber,
      poNumber: anchorItem.poNumber,
      taskId: anchorItem.taskId,
      itemCount: items.length
    });
```

Add before `findDetailRow(detailSurface, item)` in the group loop:

```js
          this.emitAutomationEvent('item-start', {
            caseNumber: item.caseNumber,
            poNumber: item.poNumber,
            taskId: item.taskId,
            decision: item.decision
          });
```

Add at the start of `selectDecision`:

```js
    this.emitAutomationEvent('decision-select', {
      caseNumber: item.caseNumber,
      poNumber: item.poNumber,
      taskId: item.taskId,
      decision: item.decision
    });
```

Add before clicking submit button in `submitIfConfigured`:

```js
      this.emitAutomationEvent('submit-click', {
        buttonNames: names
      });
```

- [ ] **Step 5: Attach capture in runner**

Modify `lib/workflows/workflow-runner.js`.

Add imports:

```js
const { NetworkCapture } = require('../network');
```

Inside `runAutomation`, normalize the mode before dry run:

```js
  const runMode = assertSupportedRunMode(options.runMode);
```

After `launchPage`, create capture when needed:

```js
  const capture = runMode === 'capture'
    ? new NetworkCapture({
        workflowId,
        outputDir: path.join(runtimeDataRoot, 'runs', 'network-captures')
      })
    : null;

  capture?.attachPage(page, 'main');
```

Create the workflow with an event sink:

```js
    const workflow = createWorkflow(workflowId, workflowConfig, {
      onAutomationEvent: (event) => {
        capture?.mark(event.type, event.detail);
      }
    });
```

Before return, write artifacts:

```js
    const networkCapture = capture ? await capture.writeArtifacts() : null;
```

Return:

```js
    return {
      mode: 'live',
      runMode,
      parsedWorkbook,
      workflowResult: {
        ...workflowResult,
        networkCapture
      }
    };
```

- [ ] **Step 6: Run tests and syntax check**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
npm run check
```

Expected: tests pass and `node --check` exits 0.

- [ ] **Step 7: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\lib\index.js tms-electron-app\automation-apps\playwright-console\lib\workflows\base-workflow.js tms-electron-app\automation-apps\playwright-console\lib\workflows\btp-po-decisions-workflow.js tms-electron-app\automation-apps\playwright-console\lib\workflows\workflow-runner.js tms-electron-app\automation-apps\playwright-console\tests\run-mode.test.js
git commit -m "feat: integrate capture mode with workflow runner"
```

## Task 6: Server And UI Run Mode Entry

**Files:**
- Modify: `tms-electron-app/automation-apps/playwright-console/lib/server/index.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/public/index.html`
- Modify: `tms-electron-app/automation-apps/playwright-console/public/app.js`
- Modify: `tms-electron-app/automation-apps/playwright-console/public/styles.css`

- [ ] **Step 1: Add server request parsing**

Modify `lib/server/index.js`.

Add to `/api/run` body parsing:

```js
  const runMode = String(request.body.runMode || 'debug-ui').trim();
```

Pass `runMode` to `runAutomation`:

```js
    const result = await runAutomation({
      workflowId,
      excelPath: request.file.path,
      originalFileName: request.file.originalname,
      targetUrl,
      dryRun,
      runMode,
      onLog: (message) => logs.push(message)
    });
```

- [ ] **Step 2: Add run mode selector**

Modify `public/index.html` inside the form after workflow select.

```html
          <label class="field field-wide">
            <span>运行模式</span>
            <select id="runMode" name="runMode">
              <option value="debug-ui">调试 UI 模式（稳定回退）</option>
              <option value="capture">捕获分析模式（记录接口）</option>
              <option value="fast-api" disabled>快速 API 模式（等待接口模板）</option>
              <option value="hybrid" disabled>混合模式（等待接口模板）</option>
            </select>
          </label>
```

- [ ] **Step 3: Submit and render mode in browser script**

Modify `public/app.js`.

Add DOM reference:

```js
const runModeSelect = document.getElementById("runMode");
```

Append mode to form body:

```js
  body.append("runMode", runModeSelect.value);
```

Update `modeLabel`:

```js
  const runMode = result.runMode || "debug-ui";
  const modeLabel = result.mode === "live"
    ? runModeText(runMode)
    : "仅预览";
```

Add helper:

```js
function runModeText(runMode) {
  if (runMode === "capture") {
    return "捕获分析模式";
  }
  if (runMode === "fast-api") {
    return "快速 API 模式";
  }
  if (runMode === "hybrid") {
    return "混合模式";
  }
  return "调试 UI 模式";
}
```

Add capture artifact panel after screenshot panel:

```js
    ${renderNetworkCapture(workflowResult.networkCapture)}
```

Add helper:

```js
function renderNetworkCapture(capture) {
  if (!capture) {
    return "";
  }

  return `
    <div class="capture-panel">
      <strong>接口捕获报告</strong>
      <p>已捕获 ${capture.recordCount || 0} 条写请求，候选接口 ${capture.candidateCount || 0} 个。</p>
      <code>${escapeHtml(capture.reportPath || "")}</code>
    </div>
  `;
}
```

Add technical details lines:

```js
  if (workflowResult.networkCapture) {
    lines.push("");
    lines.push(`接口捕获报告: ${workflowResult.networkCapture.reportPath || "-"}`);
    lines.push(`捕获请求数: ${workflowResult.networkCapture.recordCount || 0}`);
    lines.push(`候选接口数: ${workflowResult.networkCapture.candidateCount || 0}`);
  }
```

- [ ] **Step 4: Add capture panel styling**

Modify `public/styles.css`.

```css
.capture-panel {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1e3a8a;
  background: #eff6ff;
}

.capture-panel strong {
  color: #17202c;
}

.capture-panel p {
  margin: 0;
}

.capture-panel code {
  overflow-wrap: anywhere;
  color: #334155;
}
```

- [ ] **Step 5: Run test and check**

Run:

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
npm run check
```

Expected: all tests and syntax checks pass.

- [ ] **Step 6: Commit**

```powershell
git add tms-electron-app\automation-apps\playwright-console\lib\server\index.js tms-electron-app\automation-apps\playwright-console\public\index.html tms-electron-app\automation-apps\playwright-console\public\app.js tms-electron-app\automation-apps\playwright-console\public\styles.css
git commit -m "feat: expose automation capture mode"
```

## Task 7: Final Verification

**Files:**
- Verify: `tms-electron-app/automation-apps/playwright-console/package.json`
- Verify: `tms-electron-app/automation-apps/playwright-console/lib/network/*`
- Verify: `tms-electron-app/automation-apps/playwright-console/lib/workflows/*`
- Verify: `tms-electron-app/automation-apps/playwright-console/public/*`

- [ ] **Step 1: Run Playwright console tests**

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm test
```

Expected: all `node:test` tests pass.

- [ ] **Step 2: Run syntax check**

```powershell
cd tms-electron-app\automation-apps\playwright-console
npm run check
```

Expected: all `node --check` commands exit 0.

- [ ] **Step 3: Run frontend typecheck and build only if Vue files changed**

If no `tms-frontend/src` files changed, do not run frontend checks. Record: "未修改 `tms-frontend/src`，无需运行 `npm run typecheck` / `npm run build`。"

- [ ] **Step 4: Inspect Git status**

```powershell
git status --short --branch
git log --oneline -5
```

Expected: branch is `codex/web-automation-performance`; only intended commits are present.

- [ ] **Step 5: Final summary**

Summarize:

- Files changed.
- Tests run.
- Capture mode limitations: it records candidate interfaces but does not enable production `fast-api`.
- Next step after a real SAP capture: confirm candidate endpoint and implement template-specific executor.
