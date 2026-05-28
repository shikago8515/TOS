const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IMPORTANT_KEY_PATTERN = /(decision|task|po|case|comment|status|action|outcome)/i;
const IMPORTANT_URL_PATTERN = /(decision|submit|complete|workflow|task|approval|inbox)/i;
const CANDIDATE_SCORE_THRESHOLD = 50;

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase();
}

function getPayloadKeys(payload) {
  if (!payload || !Array.isArray(payload.keys)) {
    return [];
  }

  return payload.keys.map((key) => String(key));
}

function hasDecisionKey(keys) {
  return keys.some((key) => key.toLowerCase() === 'decision');
}

function scoreRecord(record = {}) {
  const method = normalizeMethod(record.method);
  const url = String(record.url || '');
  const action = record.action == null ? '' : String(record.action);
  const requestKeys = getPayloadKeys(record.requestPayload);
  const responseKeys = getPayloadKeys(record.responsePayload);
  const allKeys = [...requestKeys, ...responseKeys];
  const reasons = [];
  let score = 0;

  if (WRITE_METHODS.has(method)) {
    score += 35;
    reasons.push('write-method');
  }

  if (IMPORTANT_URL_PATTERN.test(url)) {
    score += 20;
    reasons.push('important-url');
  }

  if (hasDecisionKey(allKeys)) {
    score += 25;
    reasons.push('decision-payload');
  }

  if (allKeys.some((key) => IMPORTANT_KEY_PATTERN.test(key))) {
    score += 15;
    reasons.push('business-keys');
  }

  if (/submit/i.test(action)) {
    score += 20;
    reasons.push('submit-action');
  }

  // 非写入请求通常不能直接作为快速 API 模板，保留低分用于诊断但避免误判。
  if (!WRITE_METHODS.has(method)) {
    score = Math.min(score, 20);
  }

  return {
    method,
    url,
    status: record.status,
    action: record.action,
    score,
    reasons,
    requestKeys,
    responseKeys
  };
}

function analyzeCapture(capture = {}) {
  const records = Array.isArray(capture.records) ? capture.records : [];
  const candidates = records
    .map(scoreRecord)
    .filter((candidate) => candidate.score >= CANDIDATE_SCORE_THRESHOLD)
    .sort((left, right) => right.score - left.score);

  return {
    totalRecords: records.length,
    candidates
  };
}

function formatKeys(keys = []) {
  return keys.length > 0 ? keys.join(', ') : '无';
}

function createCaptureReportMarkdown(capture = {}) {
  const analysis = capture.analysis || analyzeCapture(capture);
  const records = Array.isArray(capture.records) ? capture.records : [];
  const totalRecords = analysis.totalRecords == null ? records.length : analysis.totalRecords;
  const lines = [
    '# 网页自动化接口捕获报告',
    '',
    `Workflow: ${capture.workflowId || 'unknown'}`,
    `Captured At: ${capture.capturedAt || 'unknown'}`,
    `Total Records: ${totalRecords}`,
    '',
    '> 安全提醒：不要直接启用快速 API，必须先人工确认接口语义、鉴权方式、幂等性和失败回滚策略。',
    '',
    '## 候选接口'
  ];

  const candidates = Array.isArray(analysis.candidates) ? analysis.candidates : [];
  if (candidates.length === 0) {
    lines.push('', '未发现高置信候选接口。');
    return lines.join('\n');
  }

  candidates.forEach((candidate, index) => {
    lines.push(
      '',
      `### ${index + 1}. ${candidate.method || 'UNKNOWN'} ${candidate.url || ''}`,
      '',
      `- Score: ${candidate.score}`,
      `- Status: ${candidate.status == null ? 'unknown' : candidate.status}`,
      `- Reasons: ${formatKeys(candidate.reasons)}`,
      `- Request Keys: ${formatKeys(candidate.requestKeys)}`,
      `- Response Keys: ${formatKeys(candidate.responseKeys)}`
    );
  });

  return lines.join('\n');
}

module.exports = {
  WRITE_METHODS,
  IMPORTANT_KEY_PATTERN,
  IMPORTANT_URL_PATTERN,
  analyzeCapture,
  createCaptureReportMarkdown,
  scoreRecord
};
