const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { runtimeDataRoot, createLogger } = require('../core');
const { loadConfig } = require('../config');
const { parseWorkbook } = require('../excel');
const { createWorkflow } = require('./workflow-registry');

async function launchPage(browserConfig, targetUrl, logger) {
  const userDataDir = path.resolve(runtimeDataRoot, browserConfig.userDataDir);
  await fs.mkdir(userDataDir, { recursive: true });

  const launchOptions = {
    channel: browserConfig.channel,
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMo || 0,
    ...(browserConfig.launchOptions || {})
  };

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  const page = context.pages()[0] || (await context.newPage());
  
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
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
  const { workflowId, excelPath, targetUrl, dryRun, onLog, originalFileName } = options;
  
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
    logger
  );

  try {
    const workflow = createWorkflow(workflowId, workflowConfig);
    let workflowResult;

    try {
      workflowResult = await workflow.execute(page, parsedWorkbook, logger);
    } catch (error) {
      error.mode = 'live';
      error.parsedWorkbook = parsedWorkbook;
      error.screenshotPath = error.screenshotPath || await captureFailure(page, workflowId, logger).catch(() => null);
      throw error;
    }

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
  launchPage
};
