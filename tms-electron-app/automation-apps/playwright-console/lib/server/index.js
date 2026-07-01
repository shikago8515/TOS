const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { appRoot, runtimeDataRoot } = require('../core');
const { loadConfig, defaultConfigPath, localConfigPath } = require('../config');
const { runAutomation } = require('../workflows');
const { persistRunArtifacts } = require('./artifacts');
const { probeN8n, uploadExcelToWebhook, postSummaryWebhook } = require('./n8n-client');

const app = express();
const uploadsDir = path.join(runtimeDataRoot, 'uploads');
const runsDir = path.join(runtimeDataRoot, 'runs');
const upload = multer({ dest: uploadsDir });

let lastLocalRun = null;
let lastWebhookRun = null;

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

app.use(express.json());
app.use(express.static(path.join(appRoot, 'public')));
app.use('/runs', express.static(runsDir));

app.get('/api/health', async (_request, response) => {
  const config = getConfig();
  const port = getPort(config);
  const n8n = await probeN8n(config.n8n);

  response.json({
    ok: true,
    port,
    dataDir: runtimeDataRoot,
    localConfigPath,
    hasLocalConfig: fs.existsSync(localConfigPath),
    n8n
  });
});

app.get('/api/runtime', async (_request, response) => {
  const config = getConfig();
  const n8n = await probeN8n(config.n8n);

  response.json({
    ok: true,
    dataDir: runtimeDataRoot,
    defaultConfigPath,
    localConfigPath,
    hasLocalConfig: fs.existsSync(localConfigPath),
    n8n: {
      ...n8n,
      baseUrl: String(config.n8n?.baseUrl || ''),
      openUrl: String(config.n8n?.openUrl || config.n8n?.baseUrl || ''),
      webhookUrl: String(config.n8n?.webhookUrl || ''),
      summaryWebhookUrl: String(config.n8n?.summaryWebhookUrl || '')
    },
    lastLocalRun,
    lastWebhookRun
  });
});

app.get('/api/workflows', (_request, response) => {
  const config = getConfig();
  const workflows = Object.entries(config.workflows || {}).map(([id, workflow]) => ({
    id,
    name: workflow.name,
    description: workflow.description,
    startUrl: workflow.startUrl,
    available: workflow.available !== false,
    statusLabel: workflow.statusLabel || '',
    disabledReason: workflow.disabledReason || ''
  }));

  response.json({ workflows });
});

app.post('/api/n8n/upload', upload.any(), async (request, response) => {
  const uploadedFile = findUploadedFile(request.files);
  if (!uploadedFile) {
    response.status(400).json({
      ok: false,
      error: 'Please upload an Excel file first.'
    });
    return;
  }

  try {
    const config = getConfig();
    const webhookUrl = String(request.body.webhookUrl || config.n8n?.webhookUrl || '').trim();
    const timeoutMs = Number(config.n8n?.requestTimeoutMs || 45000);
    const result = await uploadExcelToWebhook({
      webhookUrl,
      filePath: uploadedFile.path,
      originalFileName: uploadedFile.originalname,
      extraFields: sanitizeWebhookFields(request.body),
      timeoutMs
    });

    const payload = {
      ok: result.ok,
      webhookUrl,
      statusCode: result.statusCode,
      message: result.ok
        ? 'n8n webhook request completed.'
        : (result.error || `n8n webhook returned HTTP ${result.statusCode || 'unknown'}.`),
      rawResponse: result.body,
      jsonResponse: result.json
    };

    lastWebhookRun = {
      completedAt: new Date().toISOString(),
      ok: payload.ok,
      statusCode: payload.statusCode,
      webhookUrl,
      fileName: uploadedFile.originalname
    };

    response.status(result.ok ? 200 : 502).json(payload);
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await cleanupUploadedFiles(request.files);
  }
});

app.post('/api/run', upload.single('excelFile'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({
      ok: false,
      error: 'Please upload an Excel file first.'
    });
    return;
  }

  const logs = [];
  const workflowId = String(request.body.workflowId || '').trim();
  const targetUrl = String(request.body.targetUrl || '').trim();
  const dryRun = String(request.body.dryRun || 'true') === 'true';

  try {
    const config = getConfig();
    const workflowConfig = config.workflows?.[workflowId];
    if (!workflowConfig) {
      response.status(400).json({
        ok: false,
        logs,
        error: `Workflow "${workflowId}" was not found.`
      });
      return;
    }

    if (workflowConfig.available === false) {
      response.status(400).json({
        ok: false,
        logs,
        error: workflowConfig.disabledReason || `Workflow "${workflowConfig.name}" is not available yet.`
      });
      return;
    }

    const result = await runAutomation({
      workflowId,
      excelPath: request.file.path,
      originalFileName: request.file.originalname,
      targetUrl,
      dryRun,
      onLog: (message) => logs.push(message)
    });

    const payload = {
      ok: true,
      logs,
      result,
      screenshotPath: result?.workflowResult?.screenshotPath || null,
      screenshotUrl: toRunsUrl(result?.workflowResult?.screenshotPath)
    };

    await attachArtifactsAndWebhook(payload, workflowId, config, request.file.originalname);
    lastLocalRun = buildLastLocalRun(workflowId, request.file.originalname, payload);
    response.json(payload);
  } catch (error) {
    const payload = {
      ok: false,
      logs,
      error: error instanceof Error ? error.message : String(error),
      screenshotPath: error?.screenshotPath || null,
      screenshotUrl: toRunsUrl(error?.screenshotPath),
      workflowResults: error?.workflowResults || null,
      result: error?.parsedWorkbook ? {
        mode: error?.mode || 'live',
        parsedWorkbook: error.parsedWorkbook,
        workflowResult: {
          results: error.workflowResults || []
        }
      } : null
    };

    try {
      const config = getConfig();
      await attachArtifactsAndWebhook(payload, workflowId, config, request.file.originalname);
      lastLocalRun = buildLastLocalRun(workflowId, request.file.originalname, payload);
    } catch (attachError) {
      logs.push(`Artifact export failed: ${attachError.message}`);
    }

    response.status(500).json(payload);
  } finally {
    await fsp.rm(request.file.path, { force: true }).catch(() => {});
  }
});

app.use((_request, response) => {
  response.sendFile(path.join(appRoot, 'public', 'index.html'));
});

function startServer() {
  const config = getConfig();
  const port = getPort(config);

  fsp.mkdir(uploadsDir, { recursive: true }).catch(() => {});
  fsp.mkdir(runsDir, { recursive: true }).catch(() => {});

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Playwright app is ready at http://127.0.0.1:${port}`);
  });

  return server;
}

function getConfig() {
  return loadConfig();
}

function getPort(config) {
  return Number(process.env.TMS_PLAYWRIGHT_PORT || config.app?.port || 3100);
}

async function attachArtifactsAndWebhook(payload, workflowId, config, originalFileName) {
  const artifactResult = await persistRunArtifacts({
    runsDir,
    workflowId,
    payload,
    runKind: 'local-run'
  });

  payload.artifacts = mapArtifactsToResponse(artifactResult);

  const summaryPayload = buildSummaryPayload({
    workflowId,
    originalFileName,
    payload
  });

  payload.summaryWebhook = await postSummaryWebhook(
    String(config.n8n?.summaryWebhookUrl || '').trim(),
    summaryPayload,
    Number(config.n8n?.requestTimeoutMs || 15000)
  ).catch((error) => ({
    sent: false,
    skipped: false,
    error: error instanceof Error ? error.message : String(error)
  }));
}

function buildSummaryPayload({ workflowId, originalFileName, payload }) {
  const result = payload.result || {};
  const parsedWorkbook = result.parsedWorkbook || {};
  const workflowResult = result.workflowResult || {};
  const rowResults = Array.isArray(workflowResult.results) ? workflowResult.results : [];

  return {
    workflowId,
    ok: payload.ok !== false,
    mode: result.mode || 'unknown',
    fileName: parsedWorkbook.fileName || originalFileName || '',
    sheetName: parsedWorkbook.sheetName || '',
    totalRows: Number(parsedWorkbook.totalRows || rowResults.length || 0),
    completedRowCount: rowResults.filter((item) => item.status === 'ok').length,
    failedRowCount: Number(payload.artifacts?.failedRowCount || 0),
    error: payload.error || '',
    screenshotUrl: payload.screenshotUrl || '',
    artifacts: payload.artifacts || null,
    generatedAt: new Date().toISOString()
  };
}

function mapArtifactsToResponse(artifactResult) {
  return {
    runId: artifactResult.runId,
    failedRowCount: artifactResult.failedRows.length,
    manifest: artifactResult.manifest,
    files: {
      resultJson: {
        path: artifactResult.resultJsonPath,
        url: toRunsUrl(artifactResult.resultJsonPath)
      },
      failedJson: {
        path: artifactResult.failedJsonPath,
        url: toRunsUrl(artifactResult.failedJsonPath)
      },
      failedCsv: {
        path: artifactResult.failedCsvPath,
        url: toRunsUrl(artifactResult.failedCsvPath)
      },
      failedXlsx: {
        path: artifactResult.failedXlsxPath,
        url: toRunsUrl(artifactResult.failedXlsxPath)
      },
      manifest: {
        path: artifactResult.manifestPath,
        url: toRunsUrl(artifactResult.manifestPath)
      }
    },
    failedRowsPreview: artifactResult.failedRows.slice(0, 5)
  };
}

function buildLastLocalRun(workflowId, fileName, payload) {
  return {
    completedAt: new Date().toISOString(),
    workflowId,
    fileName,
    ok: payload.ok !== false,
    mode: payload.result?.mode || 'unknown',
    failedRowCount: Number(payload.artifacts?.failedRowCount || 0),
    screenshotUrl: payload.screenshotUrl || '',
    artifacts: payload.artifacts || null
  };
}

function findUploadedFile(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  return files.find((item) => item.fieldname === 'excelFile' || item.fieldname === 'file') || files[0];
}

function sanitizeWebhookFields(fields = {}) {
  const sanitized = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (key === 'webhookUrl') {
      return;
    }
    if (value === undefined || value === null || value === '') {
      return;
    }
    sanitized[key] = value;
  });
  return sanitized;
}

async function cleanupUploadedFiles(files) {
  if (!Array.isArray(files)) {
    return;
  }

  await Promise.all(files.map((file) => {
    return fsp.rm(file.path, { force: true }).catch(() => {});
  }));
}

function toRunsUrl(filePath) {
  if (!filePath) {
    return null;
  }

  const relative = path.relative(runsDir, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return `/runs/${relative.split(path.sep).map(encodeURIComponent).join('/')}`;
}

module.exports = {
  app,
  startServer
};
