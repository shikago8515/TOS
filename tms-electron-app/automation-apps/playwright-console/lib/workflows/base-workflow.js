const { createCursor, CursorType } = require('../cursor');
const { delay, resolveDelayMs } = require('../core/utils');

class BaseWorkflow {
  constructor(workflowConfig, options = {}) {
    this.config = workflowConfig;
    this.options = options;
    this.cursorType = options.cursorType || CursorType.HUMAN;
  }

  async execute(page, parsedWorkbook, logger) {
    throw new Error('execute() must be implemented by subclass');
  }

  async waitForReadyMarker(page, selector, timeoutMs = 180000, logger) {
    if (!selector) {
      return;
    }

    try {
      await page.locator(selector).first().waitFor({
        state: 'visible',
        timeout: timeoutMs
      });
    } catch (error) {
      logger?.('The page is not ready yet. Please complete login manually in the opened Edge window.');
      await page.locator(selector).first().waitFor({
        state: 'visible',
        timeout: timeoutMs
      });
    }
  }

  async waitForAnyLocator(candidates, options = {}) {
    const {
      timeoutMs = 30000,
      description = 'matching element',
      state = 'visible'
    } = options;
    const startedAt = Date.now();
    let lastError = null;

    if (!candidates.length) {
      throw new Error(`Could not find ${description}. No locator candidates were configured.`);
    }

    while (Date.now() - startedAt < timeoutMs) {
      for (const candidate of candidates) {
        const locator = typeof candidate === 'function' ? candidate() : candidate;
        if (!locator) {
          continue;
        }

        try {
          const first = locator.first ? locator.first() : locator;
          await first.waitFor({ state, timeout: 750 });
          return first;
        } catch (error) {
          lastError = error;
        }
      }
    }

    const suffix = lastError?.message ? ` Last error: ${lastError.message}` : '';
    throw new Error(`Could not find ${description}.${suffix}`);
  }

  async clickWhenReady(locator, description, logger) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await this.highlight(locator, description);
    await locator.click({ timeout: 15000 });
    logger?.(`Clicked ${description}.`);
  }

  async highlight(locator, label = '') {
    const visual = this.config.visual || {};
    if (visual.enabled === false) {
      return;
    }

    await locator.evaluate((element, text) => {
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const previousOutline = element.style.outline;
      const previousBoxShadow = element.style.boxShadow;
      element.dataset.codexPreviousOutline = previousOutline;
      element.dataset.codexPreviousBoxShadow = previousBoxShadow;
      element.style.outline = '4px solid #2563eb';
      element.style.boxShadow = '0 0 0 8px rgba(37, 99, 235, 0.22)';
      element.setAttribute('data-codex-highlight-label', text || '');
      setTimeout(() => {
        element.style.outline = element.dataset.codexPreviousOutline || '';
        element.style.boxShadow = element.dataset.codexPreviousBoxShadow || '';
      }, 1800);
    }, label).catch(() => {});

    await delay(resolveDelayMs(visual.actionDelayMs, 700));
  }

  async showVisualStatus(page, title, details = {}) {
    const visual = this.config.visual || {};
    if (visual.enabled === false || !page?.evaluate) {
      return;
    }

    await page.evaluate(({ title, details }) => {
      const id = 'codex-business-status-overlay';
      let overlay = document.getElementById(id);

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.position = 'fixed';
        overlay.style.top = '18px';
        overlay.style.right = '18px';
        overlay.style.zIndex = '2147483647';
        overlay.style.maxWidth = '420px';
        overlay.style.padding = '14px 16px';
        overlay.style.border = '2px solid #93c5fd';
        overlay.style.borderRadius = '8px';
        overlay.style.background = '#eff6ff';
        overlay.style.color = '#111827';
        overlay.style.boxShadow = '0 16px 42px rgba(15, 23, 42, 0.28)';
        overlay.style.fontFamily = 'Segoe UI, Microsoft YaHei, sans-serif';
        overlay.style.fontSize = '15px';
        overlay.style.lineHeight = '1.45';
        document.documentElement.appendChild(overlay);
      }

      const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      const rows = Object.entries(details || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`)
        .join('');

      overlay.innerHTML = `
        <div style="font-weight:700;font-size:18px;margin-bottom:6px;">${escapeHtml(title)}</div>
        ${rows}
      `;
    }, { title, details }).catch(() => {});

    await delay(resolveDelayMs(visual.statusDelayMs, 500));
  }

  createCursor(page, options = {}) {
    return createCursor(page, this.cursorType, options);
  }

  getRequiredSelectors() {
    return [];
  }
}

module.exports = { BaseWorkflow };
