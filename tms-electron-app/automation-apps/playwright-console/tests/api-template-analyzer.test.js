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
