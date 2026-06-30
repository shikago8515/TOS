const fs = require('node:fs/promises');
const path = require('node:path');
const { runtimeDataRoot, createLogger } = require('../core');
const { loadConfig } = require('../config');

const SUPPORTED_RUN_MODES = new Set(['debug-ui', 'capture']);
const KNOWN_RUN_MODES = new Set(['debug-ui', 'capture', 'hybrid', 'fast-api']);
const AVAILABLE_RUN_MODES_MESSAGE = 'Available now: debug-ui, capture. Planned but disabled: hybrid, fast-api.';
const VISIBLE_CHROMIUM_WINDOW_ARGS = ['--start-maximized', '--window-position=0,0'];

async function showAutomationBadge(page, options = {}) {
  if (!page || typeof page.evaluate !== 'function') {
    return;
  }

  const targets = [page];
  if (typeof page.frames === 'function') {
    targets.push(...page.frames());
  }

  const payload = {
    id: 'tos-browser-automation-status-badge',
    title: String(options.title || 'TOS Playwright 自动化'),
    message: String(options.message || '自动化正在执行'),
    details: {
      phase: String(options.details?.phase || ''),
      workflowId: String(options.details?.workflowId || ''),
      inputFileName: String(options.details?.inputFileName || ''),
    }
  };

  await Promise.allSettled(
    Array.from(new Set(targets))
      .filter((target) => target && typeof target.evaluate === 'function')
      .map((target) => injectAutomationBadge(target, payload))
  );
}

async function injectAutomationBadge(target, payload) {
  await target.evaluate(({ id, title, message, details }) => {
    const asText = (value) => String(value || '').trim();
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement('div');
      root.id = id;
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('data-tos-browser-automation-badge', 'true');
      root.style.cssText = [
        'position:fixed',
        'left:18px',
        'top:18px',
        'z-index:2147483647',
        'width:320px',
        'max-width:calc(100vw - 36px)',
        'box-sizing:border-box',
        'padding:10px 12px',
        'border:2px solid #0ea5e9',
        'border-radius:8px',
        'background:#f8fafc',
        'color:#0f172a',
        'box-shadow:0 12px 32px rgba(15,23,42,.20)',
        'font-family:Segoe UI,Microsoft YaHei,Arial,sans-serif',
        'font-size:13px',
        'line-height:1.35',
        'pointer-events:none'
      ].join(';');

      const titleNode = document.createElement('div');
      titleNode.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;margin-bottom:5px;';
      const dot = document.createElement('span');
      dot.setAttribute('data-tos-badge-dot', 'true');
      dot.style.cssText = 'width:8px;height:8px;border-radius:999px;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.14);flex:0 0 auto;';
      const titleText = document.createElement('span');
      titleText.setAttribute('data-tos-badge-title', 'true');
      titleText.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      titleNode.append(dot, titleText);

      const messageNode = document.createElement('div');
      messageNode.setAttribute('data-tos-badge-message', 'true');
      messageNode.style.cssText = 'font-size:12px;color:#334155;word-break:break-word;';

      const metaNode = document.createElement('div');
      metaNode.setAttribute('data-tos-badge-meta', 'true');
      metaNode.style.cssText = 'margin-top:5px;font-size:11px;color:#0369a1;word-break:break-word;';
      root.append(titleNode, messageNode, metaNode);
      document.documentElement.appendChild(root);
    }

    const phase = asText(details.phase);
    const failed = phase === 'failed' || phase === 'error';
    const complete = phase === 'complete' || phase.endsWith('-complete');
    root.style.borderColor = failed ? '#dc2626' : complete ? '#059669' : '#0ea5e9';
    root.style.background = failed ? '#fef2f2' : complete ? '#ecfdf5' : '#f8fafc';

    const dot = root.querySelector('[data-tos-badge-dot]');
    if (dot) {
      const color = failed ? '#ef4444' : complete ? '#10b981' : '#0ea5e9';
      dot.style.background = color;
      dot.style.boxShadow = failed
        ? '0 0 0 5px rgba(239,68,68,.14)'
        : complete
          ? '0 0 0 5px rgba(16,185,129,.14)'
          : '0 0 0 5px rgba(14,165,233,.14)';
    }

    const titleNode = root.querySelector('[data-tos-badge-title]');
    if (titleNode) titleNode.textContent = title;
    const messageNode = root.querySelector('[data-tos-badge-message]');
    if (messageNode) messageNode.textContent = message || '自动化正在执行';

    const metaNode = root.querySelector('[data-tos-badge-meta]');
    if (metaNode) {
      const parts = [];
      const workflowId = asText(details.workflowId);
      const inputFileName = asText(details.inputFileName);
      if (workflowId) parts.push(workflowId);
      if (inputFileName) parts.push(inputFileName);
      metaNode.textContent = parts.join(' · ');
      metaNode.style.display = parts.length ? 'block' : 'none';
    }
  }, payload).catch(() => {});
}

function mergeBrowserArgs(currentArgs, requiredArgs) {
  const args = Array.isArray(currentArgs) ? currentArgs : [];
  const merged = [...args];
  for (const arg of requiredArgs) {
    if (!merged.includes(arg)) {
      merged.push(arg);
    }
  }
  return merged;
}

function normalizeRunMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode || 'debug-ui';
}

function assertSupportedRunMode(mode) {
  const normalized = normalizeRunMode(mode);

  if (!KNOWN_RUN_MODES.has(normalized)) {
    throw new Error(`Unknown run mode: ${normalized}. ${AVAILABLE_RUN_MODES_MESSAGE}`);
  }

  if (!SUPPORTED_RUN_MODES.has(normalized)) {
    if (normalized === 'fast-api') {
      throw new Error('Fast API mode is not enabled yet. Run mode "fast-api" requires a captured interface template.');
    }

    throw new Error(`Run mode "${normalized}" is not enabled yet. Run capture mode first and confirm the captured interface template.`);
  }

  return normalized;
}

async function launchPage(browserConfig, targetUrl, logger, badgeOptions = {}) {
  const { chromium } = require('playwright');
  const userDataDir = path.resolve(runtimeDataRoot, browserConfig.userDataDir);
  await fs.mkdir(userDataDir, { recursive: true });

  const launchOptions = {
    channel: browserConfig.channel,
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMo || 0,
    ...(browserConfig.launchOptions || {})
  };
  if (!launchOptions.headless) {
    launchOptions.args = mergeBrowserArgs(launchOptions.args, VISIBLE_CHROMIUM_WINDOW_ARGS);
    launchOptions.viewport = null;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  const page = context.pages()[0] || (await context.newPage());
  await showAutomationBadge(page, {
    title: badgeOptions.title || 'TOS Playwright 自动化',
    message: '正在打开自动化目标页面',
    details: badgeOptions.details || {}
  });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await showAutomationBadge(page, {
    title: badgeOptions.title || 'TOS Playwright 自动化',
    message: '目标页面已打开，准备执行 workflow',
    details: {
      ...(badgeOptions.details || {}),
      phase: 'target-ready'
    }
  });
  logger(`Opened ${targetUrl}`);

  return { context, page };
}

async function captureFailure(page, workflowId, logger) {
  const runsDir = path.join(runtimeDataRoot, 'runs');
  await fs.mkdir(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(runsDir, `${workflowId}-${stamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  logger(`Saved failure screenshot: ${screenshotPath}`);
  return screenshotPath;
}

async function runAutomation(options) {
  const { workflowId, excelPath, targetUrl, dryRun, onLog, originalFileName, runMode } = options;
  const normalizedRunMode = assertSupportedRunMode(runMode);

  if (normalizedRunMode === 'capture') {
    throw new Error('Capture mode is not wired yet. Complete network capture integration before using run mode "capture".');
  }

  const { parseWorkbook } = require('../excel');
  const { createWorkflow } = require('./workflow-registry');
  
  const config = loadConfig();
  const workflowConfig = config.workflows[workflowId];

  if (!workflowConfig) {
    throw new Error(`Workflow "${workflowId}" was not found.`);
  }

  const logger = createLogger(onLog);
  const parsedWorkbook = parseWorkbook(excelPath, workflowId, workflowConfig);
  if (originalFileName) {
    parsedWorkbook.fileName = originalFileName;
  }
  logger(`Parsed ${parsedWorkbook.totalRows} actionable rows from ${parsedWorkbook.fileName}.`);

  if (dryRun) {
    logger('Dry run enabled. Browser automation was skipped.');
    return {
      mode: 'dry-run',
      parsedWorkbook
    };
  }

  const { context, page } = await launchPage(
    config.browser,
    targetUrl || workflowConfig.startUrl,
    logger,
    {
      title: workflowConfig.title || workflowId,
      details: {
        phase: 'open-target',
        workflowId,
        inputFileName: parsedWorkbook.fileName
      }
    }
  );

  try {
    const workflow = createWorkflow(workflowId, workflowConfig);
    let workflowResult;

    try {
      await showAutomationBadge(page, {
        title: workflowConfig.title || workflowId,
        message: `正在执行 workflow ${workflowId}`,
        details: {
          phase: 'workflow-running',
          workflowId,
          inputFileName: parsedWorkbook.fileName
        }
      });
      workflowResult = await workflow.execute(page, parsedWorkbook, logger);
    } catch (error) {
      await showAutomationBadge(page, {
        title: workflowConfig.title || workflowId,
        message: `workflow ${workflowId} 执行失败，已截图记录`,
        details: {
          phase: 'failed',
          workflowId,
          inputFileName: parsedWorkbook.fileName
        }
      });
      error.mode = 'live';
      error.parsedWorkbook = parsedWorkbook;
      error.screenshotPath = error.screenshotPath || await captureFailure(page, workflowId, logger).catch(() => null);
      throw error;
    }

    await showAutomationBadge(page, {
      title: workflowConfig.title || workflowId,
      message: `workflow ${workflowId} 已完成`,
      details: {
        phase: 'complete',
        workflowId,
        inputFileName: parsedWorkbook.fileName
      }
    });
    logger('Automation finished.');
    return {
      mode: 'live',
      parsedWorkbook,
      workflowResult
    };
  } finally {
    await context.close();
  }
}

module.exports = {
  runAutomation,
  launchPage,
  normalizeRunMode,
  assertSupportedRunMode
};
