const fs = require('node:fs/promises');
const path = require('node:path');
const { BaseWorkflow } = require('./base-workflow');
const { runtimeDataRoot, delay } = require('../core/utils');

class BtpPoDecisionsWorkflow extends BaseWorkflow {
  async execute(page, parsedWorkbook, logger) {
    const behavior = this.config.behavior || {};
    const results = [];
    const taskGroups = groupItemsByTask(parsedWorkbook.items);

    logger(`Ready to process ${parsedWorkbook.items.length} BTP decision row(s) in ${taskGroups.length} task group(s).`);
    await this.showVisualStatus(page, '自动化准备开始', {
      '总行数': parsedWorkbook.items.length,
      '任务数': taskGroups.length
    });

    const worklist = await this.openTaskCenter(page, logger);
    await this.applyTaskFilter(worklist, logger);

    for (const [index, group] of taskGroups.entries()) {
      const label = describeTaskGroup(group);
      logger(`[${index + 1}/${taskGroups.length}] Processing ${label}.`);

      try {
        const groupResults = await this.processTaskGroup(page, worklist, group, logger);
        results.push(...groupResults);
        logger(`${label} completed.`);
      } catch (error) {
        const groupResults = Array.isArray(error.workflowResults)
          ? error.workflowResults
          : group.map((item) => ({ ...item, status: 'failed', error: error.message }));
        results.push(...groupResults);
        logger(`${label} failed: ${error.message}`);

        if (!behavior.continueOnError) {
          error.workflowResults = results;
          throw error;
        }
      }

      if (behavior.pauseBetweenItemsMs && index < taskGroups.length - 1) {
        await delay(behavior.pauseBetweenItemsMs);
      }
    }

    return { results };
  }

  async openTaskCenter(page, logger) {
    const selectors = this.config.selectors || {};
    const patterns = selectors.taskCenterLinkPatterns || ['Task Center'];
    const candidates = patterns.map((pattern) => () =>
      page.getByRole('link', { name: new RegExp(pattern, 'i') })
    );

    let link;
    try {
      link = await this.waitForAnyLocator(candidates, {
        timeoutMs: 30000,
        description: 'Task Center link'
      });
    } catch {
      logger('Task Center was not visible yet. Finish login in the opened browser window.');
      link = await this.waitForAnyLocator(candidates, {
        timeoutMs: this.config.loginWaitMs || 180000,
        description: 'Task Center link after login'
      });
    }

    await this.showVisualStatus(page, '进入 Task Center', {
      '下一步': '打开任务列表'
    });
    await this.clickWhenReady(link, 'Task Center', logger);
    await delay(this.config.afterTaskCenterClickMs || 3000);
    return this.getApplicationSurface(page, logger);
  }

  async getApplicationSurface(page, logger) {
    const frameSelector = this.config.selectors?.applicationFrame || 'iframe[title="Application"]';
    const frame = page.locator(frameSelector).contentFrame();
    await frame.locator('body').first().waitFor({ state: 'visible', timeout: 30000 });
    logger('Application frame is ready.');
    return frame;
  }

  async applyTaskFilter(worklist, logger) {
    const selectors = this.config.selectors || {};
    const filter = this.config.taskFilter || {};
    const required = filter.required === true;

    if (!filter.taskTypeName) {
      logger('No task filter configured; using the current Task Center list.');
      return;
    }

    try {
    const arrow = await this.waitForAnyLocator([
      () => worklist.locator(selectors.taskDefinitionFilterArrow)
    ], {
      timeoutMs: 15000,
      description: 'task type filter'
    });
    await this.showVisualStatus(worklist, '筛选任务类型', {
      '任务类型': filter.taskTypeName
    });
    await this.clickWhenReady(arrow, 'task type filter', logger);

    if (filter.clearExistingSelection !== false) {
      const selectAll = await this.waitForAnyLocator([
        () => worklist.getByRole('checkbox', { name: /Select All/i }),
        () => worklist.getByText(/Select All/i)
      ], {
        timeoutMs: 8000,
        description: 'Select All checkbox'
      });
      await this.clickWhenReady(selectAll, 'Select All checkbox', logger);
    }

    const option = await this.waitForAnyLocator([
      () => worklist.getByLabel(/Available Values/i).getByText(filter.taskTypeName, { exact: true }),
      () => worklist.getByText(filter.taskTypeName, { exact: true })
    ], {
      timeoutMs: 10000,
      description: `task type "${filter.taskTypeName}"`
    });
    await this.clickWhenReady(option, `task type "${filter.taskTypeName}"`, logger);

    const goButton = await this.waitForAnyLocator([
      () => worklist.getByRole('button', { name: new RegExp(filter.goButtonName || 'Go', 'i') })
    ], {
      timeoutMs: 10000,
      description: 'Go button'
    });
    await this.clickWhenReady(goButton, 'Go button', logger);
    await delay(filter.afterGoMs || 3000);
    } catch (error) {
      if (required) {
        throw error;
      }
      logger(`Task type filter was skipped: ${error.message}`);
    }
  }

  async processItem(page, worklist, item, logger) {
    await this.showVisualStatus(page, '正在查找任务', {
      'Case Number': item.caseNumber,
      'PO': item.poNumber,
      'Task ID': item.taskId,
      '决策': item.decision
    });
    const row = await this.findTaskRow(worklist, item);
    const detailPage = await this.openTaskDetail(page, worklist, row, logger, item);
    const detailSurface = await this.getDetailSurface(detailPage, logger);

    try {
      await this.showVisualStatus(detailPage, '正在处理这一条', {
        'Case Number': item.caseNumber,
        'PO': item.poNumber,
        'Task ID': item.taskId,
        '决策': item.decision
      });
      const detailRow = await this.findDetailRow(detailSurface, item);
      await this.expandDetailRowIfNeeded(detailRow, logger);
      await this.selectDecision(detailPage, detailSurface, detailRow, item, logger);
      await this.fillComments(detailSurface, item, logger);
      await this.submitIfConfigured(detailPage, detailSurface, logger);
    } catch (error) {
      error.screenshotPath = await this.capturePage(detailPage, item, logger).catch(() => null);
      throw error;
    } finally {
      if (detailPage !== page && !detailPage.isClosed()) {
        await detailPage.close();
      }
    }
  }

  async processTaskGroup(page, worklist, items, logger) {
    const behavior = this.config.behavior || {};
    const anchorItem = items[0];
    const results = [];

    await this.showVisualStatus(page, '正在查找任务', {
      'Case Number': anchorItem.caseNumber,
      'PO 数量': items.length,
      'Task ID': anchorItem.taskId
    });

    const row = await this.findTaskRow(worklist, anchorItem);
    const detailPage = await this.openTaskDetail(page, worklist, row, logger, anchorItem);
    const detailSurface = await this.getDetailSurface(detailPage, logger);

    try {
      for (const [index, item] of items.entries()) {
        try {
          await this.showVisualStatus(detailPage, '正在匹配 PO', {
            'Case Number': item.caseNumber,
            'PO': item.poNumber,
            '当前行': `${index + 1}/${items.length}`,
            '决策': item.decision
          });
          const detailRow = await this.findDetailRow(detailSurface, item);
          await this.expandDetailRowIfNeeded(detailRow, logger);
          await this.selectDecision(detailPage, detailSurface, detailRow, item, logger);
          await this.fillComments(detailSurface, item, logger);
          results.push({ ...item, status: 'ok' });
          logger(`${describeItem(item)} decision selected.`);
        } catch (error) {
          results.push({ ...item, status: 'failed', error: error.message });
          logger(`${describeItem(item)} failed in detail page: ${error.message}`);

          if (!behavior.continueOnError) {
            error.workflowResults = results;
            throw error;
          }
        }
      }

      if (results.some((item) => item.status === 'ok')) {
        await this.submitIfConfigured(detailPage, detailSurface, logger);
      }

      return results;
    } catch (error) {
      error.screenshotPath = await this.capturePage(detailPage, anchorItem, logger).catch(() => null);
      error.workflowResults = error.workflowResults || results;
      throw error;
    } finally {
      if (detailPage !== page && !detailPage.isClosed()) {
        await detailPage.close();
      }
    }
  }

  async findTaskRow(worklist, item) {
    const directRow = await this.findTaskRowInCurrentList(worklist, item, 8000).catch(() => null);

    if (directRow) {
      return directRow;
    }

    if (getTaskSearchText(item)) {
      await this.searchTaskList(worklist, item);
      return this.findTaskRowInCurrentList(worklist, item, this.config.taskRowTimeoutMs || 20000);
    }

    throw new Error(`No search key was supplied for ${describeItem(item)}.`);
  }

  async findTaskRowInCurrentList(worklist, item, timeoutMs) {
    const selectors = this.config.selectors || {};
    const key = getTaskSearchText(item);
    const patterns = selectors.taskRowPatterns || ['{caseNumber}', '{taskId}', '{poNumber}'];
    const candidates = [];

    for (const pattern of patterns) {
      const regex = templateToRegex(pattern, item);
      if (!regex) {
        continue;
      }
      candidates.push(() => worklist.getByRole('row', { name: regex }));
    }

    if (key) {
      candidates.push(() => worklist.locator('[role="row"]').filter({ hasText: key }));
      candidates.push(() => worklist.getByText(key).locator('xpath=ancestor::*[@role="row"][1]'));
      candidates.push(() => worklist.getByText(key).locator('xpath=ancestor::tr[1]'));
      candidates.push(() => worklist.getByText(key).locator('xpath=ancestor::*[@role="listitem"][1]'));
    }

    return this.waitForAnyLocator(candidates, {
      timeoutMs,
      description: `task row for ${describeItem(item)}`
    });
  }

  async searchTaskList(worklist, item) {
    const searchText = getTaskSearchText(item);
    const selectors = this.config.selectors || {};
    const placeholder = selectors.taskSearchPlaceholder || 'Search by Task Title';
    const search = await this.waitForAnyLocator([
      () => worklist.getByPlaceholder(placeholder),
      () => worklist.getByRole('searchbox'),
      () => worklist.locator('input[type="search"]')
    ], {
      timeoutMs: 10000,
      description: 'task search field'
    });

    await this.showVisualStatus(worklist, '搜索任务', {
      '搜索内容': searchText
    });
    await search.fill(searchText);
    await search.press('Enter');
    await delay(this.config.taskSearchDelayMs || 1500);
  }

  async openTaskDetail(page, worklist, row, logger, item = {}) {
    const selectors = this.config.selectors || {};
    const menuName = selectors.openMenuName || 'Open Menu';
    const openInAppName = selectors.openInAppName || 'Open in App';

    const popupPromise = page.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    const titleTarget = await this.findTaskTitleTarget(row, item).catch(() => null);
    if (titleTarget) {
      await this.clickWhenReady(titleTarget, `task title ${getTaskSearchText(item)}`, logger);
      const popup = await popupPromise;
      const detailPage = popup || page;
      await detailPage.waitForLoadState('domcontentloaded').catch(() => {});
      await delay(this.config.detailLoadDelayMs || 2000);
      return detailPage;
    }

    const menuButton = await this.waitForAnyLocator([
      () => row.getByLabel(menuName, { exact: true }),
      () => row.getByRole('button', { name: new RegExp(menuName, 'i') })
    ], {
      timeoutMs: 10000,
      description: 'row open menu button'
    });
    await this.clickWhenReady(menuButton, 'row open menu', logger);

    const openInApp = await this.waitForAnyLocator([
      () => worklist.getByRole('menuitem', { name: new RegExp(openInAppName, 'i') }),
      () => worklist.getByText(openInAppName, { exact: true }),
      () => page.getByRole('menuitem', { name: new RegExp(openInAppName, 'i') })
    ], {
      timeoutMs: 10000,
      description: `"${openInAppName}" menu item`
    });
    await this.clickWhenReady(openInApp, openInAppName, logger);

    const popup = await popupPromise;
    const detailPage = popup || page;
    await detailPage.waitForLoadState('domcontentloaded').catch(() => {});
    await delay(this.config.detailLoadDelayMs || 2000);
    return detailPage;
  }

  async findTaskTitleTarget(row, item) {
    const searchText = getTaskSearchText(item);
    const candidates = [];

    if (searchText) {
      const textPattern = new RegExp(escapeRegExp(searchText), 'i');
      candidates.push(() => row.getByRole('link', { name: textPattern }));
      candidates.push(() => row.getByRole('button', { name: textPattern }));
      candidates.push(() => row.getByText(textPattern));
    }

    candidates.push(() => row.locator('a').first());
    return this.waitForAnyLocator(candidates, {
      timeoutMs: 5000,
      description: `task title for ${describeItem(item)}`
    });
  }

  async getDetailSurface(detailPage, logger) {
    const frameSelector = this.config.selectors?.applicationFrame || 'iframe[title="Application"]';

    try {
      const frame = detailPage.locator(frameSelector).contentFrame();
      await frame.locator('body').first().waitFor({ state: 'visible', timeout: 12000 });
      logger('Detail application frame is ready.');
      return frame;
    } catch {
      logger('Detail page has no application iframe; using the page directly.');
      return detailPage;
    }
  }

  async findDetailRow(surface, item) {
    const selectors = this.config.selectors || {};
    const key = item.poNumber || item.taskId || item.caseNumber;
    const patterns = selectors.detailRowPatterns || ['{poNumber}', '{taskId}', '{caseNumber}'];
    const candidates = [];

    for (const pattern of patterns) {
      const regex = templateToRegex(pattern, item);
      if (regex) {
        candidates.push(() => surface.getByRole('row', { name: regex }));
      }
    }

    if (key) {
      candidates.push(() => surface.locator('[role="row"]').filter({ hasText: key }));
      candidates.push(() => surface.getByText(key).locator('xpath=ancestor::*[@role="row"][1]'));
      candidates.push(() => surface.getByText(key).locator('xpath=ancestor::tr[1]'));
      candidates.push(() => surface.getByText(key).locator('xpath=ancestor::*[@role="listitem"][1]'));
    }

    return this.waitForAnyLocator(candidates, {
      timeoutMs: this.config.detailRowTimeoutMs || 20000,
      description: `detail row for ${describeItem(item)}`
    });
  }

  async expandDetailRowIfNeeded(row, logger) {
    if (this.config.behavior?.expandDetailRow === false) {
      return;
    }

    const expander = await this.waitForAnyLocator([
      () => row.locator('[aria-expanded="false"]').first(),
      () => row.getByRole('button', { name: /Expand/i }).first()
    ], {
      timeoutMs: 2500,
      description: 'collapsed detail row expander'
    }).catch(() => null);

    if (expander) {
      await this.clickWhenReady(expander, 'detail row expander', logger);
      await delay(500);
    }
  }

  async selectDecision(detailPage, surface, row, item, logger) {
    const selectors = this.config.selectors || {};
    const optionTexts = normalizeDecisionOptions(item.decision, this.config.decisionOptions);
    const labelPattern = new RegExp(selectors.decisionLabel || 'Decision', 'i');

    const combobox = await this.waitForAnyLocator([
      () => row.getByRole('combobox', { name: labelPattern }),
      () => row.getByRole('combobox'),
      () => row.getByLabel(labelPattern),
      () => surface.getByLabel(labelPattern),
      () => surface.getByRole('combobox', { name: labelPattern })
    ], {
      timeoutMs: 15000,
      description: 'Decision combobox'
    });

    await this.clickWhenReady(combobox, 'Decision combobox', logger);

    for (const optionText of optionTexts) {
      const optionRegex = new RegExp(`^\\s*${escapeRegExp(optionText)}\\s*$`, 'i');
      const option = await this.waitForAnyLocator([
        () => surface.getByRole('option', { name: optionRegex }),
        () => detailPage.getByRole('option', { name: optionRegex }),
        () => surface.getByLabel(/Available Values/i).getByText(optionRegex),
        () => detailPage.getByLabel(/Available Values/i).getByText(optionRegex),
        () => surface.getByText(optionRegex),
        () => detailPage.getByText(optionRegex),
        () => row.getByText(optionRegex)
      ], {
        timeoutMs: 2500,
        description: `decision option "${optionText}"`
      }).catch(() => null);

      if (option) {
        await this.showVisualStatus(detailPage, '选择决策', {
          '决策': optionText,
          'PO': item.poNumber,
          'Task ID': item.taskId
        });
        await this.clickWhenReady(option, `decision option "${optionText}"`, logger);
        return;
      }
    }

    const fallbackText = optionTexts[0];
    try {
      await combobox.fill(fallbackText);
      await combobox.press('Enter');
      logger(`Typed decision option "${fallbackText}" and pressed Enter.`);
    } catch (error) {
      throw new Error(`Could not find decision option "${fallbackText}". ${error.message}`);
    }
  }

  async fillComments(surface, item, logger) {
    if (!item.comments) {
      return;
    }

    const labels = this.config.selectors?.commentFieldLabels || [];
    for (const label of labels) {
      const field = await this.waitForAnyLocator([
        () => surface.getByLabel(new RegExp(label, 'i')),
        () => surface.getByPlaceholder(new RegExp(label, 'i'))
      ], {
        timeoutMs: 1500,
        description: `comment field "${label}"`
      }).catch(() => null);

      if (field) {
        await field.fill(item.comments);
        logger(`Filled comments: ${item.comments}`);
        return;
      }
    }
  }

  async submitIfConfigured(detailPage, surface, logger) {
    const submit = this.config.submit || {};
    if (!submit.enabled) {
      logger('Submit is disabled in config; decision was selected but not submitted.');
      return;
    }

    const names = submit.buttonNames || ['Submit', 'Save', 'OK', 'Confirm'];
    const candidates = names.flatMap((name) => {
      const pattern = new RegExp(name, 'i');
      return [
        () => surface.getByRole('button', { name: pattern }),
        () => detailPage.getByRole('button', { name: pattern })
      ];
    });

    const button = await this.waitForAnyLocator(candidates, {
      timeoutMs: submit.timeoutMs || 8000,
      description: `submit button (${names.join(', ')})`
    }).catch((error) => {
      if (submit.required) {
        throw error;
      }
      logger('No submit button was found; continuing because submit.required is false.');
      return null;
    });

    if (button) {
      await this.showVisualStatus(detailPage, '提交当前结果', {
        '按钮': 'Submit / Save / OK / Confirm'
      });
      await this.clickWhenReady(button, 'submit button', logger);
      await delay(submit.afterSubmitMs || 1500);
    }
  }

  async capturePage(page, item, logger) {
    const runsDir = path.join(runtimeDataRoot, 'runs');
    await fs.mkdir(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeKey = (item.caseNumber || item.poNumber || item.taskId || 'item').replace(/[^\w.-]+/g, '_');
    const screenshotPath = path.join(runsDir, `detail-${safeKey}-${stamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger(`Saved detail failure screenshot: ${screenshotPath}`);
    return screenshotPath;
  }
}

function describeItem(item) {
  const parts = [];
  if (item.caseNumber) {
    parts.push(`case ${item.caseNumber}`);
  }
  if (item.poNumber) {
    parts.push(`PO ${item.poNumber}`);
  }
  if (item.taskId) {
    parts.push(`task ${item.taskId}`);
  }
  return parts.join(' / ') || 'item';
}

function describeTaskGroup(items) {
  const anchorItem = items[0] || {};
  const label = anchorItem.caseNumber
    ? `case ${anchorItem.caseNumber}`
    : describeItem(anchorItem);
  return `${label} (${items.length} row${items.length === 1 ? '' : 's'})`;
}

function groupItemsByTask(items) {
  const groups = new Map();

  for (const item of items) {
    const key = getTaskSearchText(item) || `row-${item.sourceRow || groups.size + 1}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return [...groups.values()];
}

function getTaskSearchText(item) {
  return item.caseNumber || item.taskId || item.poNumber;
}

function normalizeDecisionOption(decision, options = {}) {
  const lower = String(decision || '').trim().toLowerCase();
  if (lower === 'reject' || decision === '拒绝' || decision === '驳回') {
    return options.reject || 'Reject';
  }
  return options.accept || 'Accept';
}

function normalizeDecisionOptions(decision, options = {}) {
  const lower = String(decision || '').trim().toLowerCase();
  if (lower === 'reject' || decision === '拒绝' || decision === '驳回') {
    return unique([...(options.rejectAliases || []), options.reject || 'Reject', 'Reject', 'Rejected', '拒绝']);
  }
  return unique([...(options.acceptAliases || []), options.accept || 'Accept', 'Accept', 'Approve', 'Approved', '接受']);
}

function templateToRegex(template, item) {
  let missingValue = false;
  const rendered = String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const value = item[key];
    if (!value) {
      missingValue = true;
      return '';
    }
    return escapeRegExp(value);
  });

  if (missingValue || !rendered.trim()) {
    return null;
  }

  return new RegExp(rendered, 'i');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = { BtpPoDecisionsWorkflow };
