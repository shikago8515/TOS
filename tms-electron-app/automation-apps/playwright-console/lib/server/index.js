const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { appRoot, runtimeDataRoot } = require('../core');
const { loadConfig } = require('../config');
const { runAutomation } = require('../workflows');

const config = loadConfig();
const app = express();
const port = Number(process.env.TMS_PLAYWRIGHT_PORT || config.app.port || 3100);
const uploadsDir = path.join(runtimeDataRoot, 'uploads');
const runsDir = path.join(runtimeDataRoot, 'runs');
const upload = multer({
  dest: uploadsDir
});

app.use(express.json());
app.use(express.static(path.join(appRoot, 'public')));
app.use('/runs', express.static(runsDir));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    port,
    dataDir: runtimeDataRoot
  });
});

app.get('/api/workflows', (_request, response) => {
  const workflows = Object.entries(config.workflows).map(([id, workflow]) => ({
    id,
    name: workflow.name,
    description: workflow.description,
    startUrl: workflow.startUrl,
    available: workflow.available !== false,
    statusLabel: workflow.statusLabel || '',
    disabledReason: workflow.disabledReason || ''
  }));

  response.json({
    workflows
  });
});

app.post('/api/run', upload.single('excelFile'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({
      error: 'Please upload an Excel file first.'
    });
    return;
  }

  const logs = [];
  const workflowId = request.body.workflowId;
  const targetUrl = String(request.body.targetUrl || '').trim();
  const dryRun = String(request.body.dryRun || 'true') === 'true';

  try {
    const workflowConfig = config.workflows[workflowId];
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

    response.json({
      ok: true,
      logs,
      result,
      screenshotUrl: toRunsUrl(result?.workflowResult?.screenshotPath)
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      logs,
      error: error.message,
      screenshotPath: error.screenshotPath || null,
      screenshotUrl: toRunsUrl(error.screenshotPath),
      workflowResults: error.workflowResults || null,
      result: error.parsedWorkbook ? {
        mode: error.mode || 'live',
        parsedWorkbook: error.parsedWorkbook,
        workflowResult: {
          results: error.workflowResults || []
        }
      } : null
    });
  } finally {
    await fs.rm(request.file.path, { force: true });
  }
});

app.use((_request, response) => {
  response.sendFile(path.join(appRoot, 'public', 'index.html'));
});

function startServer() {
  fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});
  fs.mkdir(runsDir, { recursive: true }).catch(() => {});

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Playwright app is ready at http://127.0.0.1:${port}`);
  });

  return server;
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
