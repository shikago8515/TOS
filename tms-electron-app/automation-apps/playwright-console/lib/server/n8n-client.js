const fs = require('node:fs/promises');

async function probeN8n(n8nConfig = {}) {
  if (!n8nConfig.enabled) {
    return {
      enabled: false,
      reachable: false,
      statusCode: null,
      checkedUrl: '',
      error: ''
    };
  }

  const candidates = buildProbeTargets(n8nConfig.baseUrl);
  const timeoutMs = Number(n8nConfig.statusTimeoutMs || 2500);

  for (const target of candidates) {
    const response = await requestText(target, {
      method: 'GET',
      timeoutMs
    });

    if (response.ok) {
      return {
        enabled: true,
        reachable: true,
        statusCode: response.statusCode,
        checkedUrl: target,
        error: ''
      };
    }
  }

  return {
    enabled: true,
    reachable: false,
    statusCode: null,
    checkedUrl: candidates[0] || '',
    error: 'n8n server did not respond successfully.'
  };
}

async function uploadExcelToWebhook(options) {
  const {
    webhookUrl,
    filePath,
    originalFileName,
    extraFields = {},
    timeoutMs = 45000
  } = options;

  if (!webhookUrl) {
    throw new Error('n8n webhook URL is required.');
  }

  const bytes = await fs.readFile(filePath);
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([bytes], { type: guessMimeType(originalFileName) }),
    originalFileName || 'upload.xlsx'
  );

  Object.entries(extraFields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    formData.append(key, String(value));
  });

  const response = await requestText(webhookUrl, {
    method: 'POST',
    body: formData,
    timeoutMs
  });

  return {
    ...response,
    json: safeJsonParse(response.body)
  };
}

async function postSummaryWebhook(webhookUrl, payload, timeoutMs = 15000) {
  if (!webhookUrl) {
    return {
      sent: false,
      skipped: true,
      reason: 'No summary webhook URL was configured.'
    };
  }

  const response = await requestText(webhookUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json'
    },
    timeoutMs
  });

  return {
    sent: response.ok,
    skipped: false,
    statusCode: response.statusCode,
    error: response.ok ? '' : `HTTP ${response.statusCode}`,
    bodyPreview: String(response.body || '').slice(0, 500)
  };
}

async function requestText(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 10000
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'follow'
    });

    const text = await response.text();
    return {
      ok: response.ok,
      statusCode: response.status,
      body: text
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      body: '',
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildProbeTargets(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return [];
  }

  return [
    `${trimmed}/healthz`,
    `${trimmed}/healthz/readiness`,
    trimmed
  ];
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function guessMimeType(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.xls')) {
    return 'application/vnd.ms-excel';
  }
  if (lower.endsWith('.csv')) {
    return 'text/csv';
  }
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

module.exports = {
  probeN8n,
  uploadExcelToWebhook,
  postSummaryWebhook
};
