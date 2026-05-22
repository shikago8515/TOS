const { ipcRenderer } = require('electron');

let latestState = null;
let autoRunning = false;
let stopRequested = false;
let panelReady = false;

const PANEL_ID = 'adidas-materials-collector-panel';
const AUTO_RUN_SESSION_KEY = 'adidas_materials_auto_run_after_refresh';
const AUTO_FIRST_PAGE_TIMEOUT_MS = 60000;
const AUTO_PAGE_TIMEOUT_MS = 60000;
const AUTO_SAVE_IDLE_TIMEOUT_MS = 180000;
const AUTO_PAGE_COOLDOWN_MS = 1800;
const AUTO_SOFT_REFRESH_EVERY = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readAutoRunSession() {
  try {
    const raw = sessionStorage.getItem(AUTO_RUN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function writeAutoRunSession(value) {
  try {
    sessionStorage.setItem(AUTO_RUN_SESSION_KEY, JSON.stringify(value));
  } catch (_error) {}
}

function clearAutoRunSession() {
  try {
    sessionStorage.removeItem(AUTO_RUN_SESSION_KEY);
  } catch (_error) {}
}

function isDisabled(element) {
  if (!element) return true;
  return Boolean(
    element.disabled ||
    element.getAttribute('aria-disabled') === 'true' ||
    /\bdisabled\b/i.test(element.className || '')
  );
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function buttonText(element, includeClassName) {
  return [
    element.getAttribute('aria-label') || '',
    element.getAttribute('title') || '',
    element.getAttribute('data-testid') || '',
    element.textContent || '',
    includeClassName ? element.className || '' : ''
  ].join(' ').toLowerCase();
}

function getPageInput() {
  const selectors = [
    'input[data-testid="pagination-page-input"]',
    '.pagination___y-v2-21-2 .yarn-input__control',
    '.pagination___y-v2-21-2 input'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isVisible(element)) return element;
  }

  return null;
}

function paginationButtonsByClass() {
  const selector = '.btn-pagination___y-v2-21-2.btn-pagination--icon___y-v2-21-2';
  return Array.from(document.querySelectorAll(selector)).filter(isVisible);
}

function getPaginationRoot() {
  const input = getPageInput();
  if (!input) return null;

  let current = input.parentElement;
  for (let depth = 0; current && depth < 8; depth++) {
    const buttons = Array.from(current.querySelectorAll('button, [role="button"]')).filter(isVisible);
    if (buttons.length >= 2) return current;
    current = current.parentElement;
  }

  return null;
}

function findPaginationButton(direction) {
  const matcher = direction === 'next'
    ? /(next|right|forward|下一页|后一页|下页|chevron-right|arrow-right)/
    : /(prev|previous|上一页|前一页|上页|chevron-left|arrow-left)/;

  const classButtons = paginationButtonsByClass();
  if (classButtons.length >= 2) {
    const fallback = direction === 'next' ? classButtons[classButtons.length - 1] : classButtons[0];
    return isDisabled(fallback) ? null : fallback;
  }

  const root = getPaginationRoot();
  if (!root) return null;

  const input = getPageInput();
  const inputRect = input ? input.getBoundingClientRect() : null;
  const buttons = Array.from(root.querySelectorAll('button, [role="button"]')).filter(isVisible);
  const semanticMatch = buttons.find((button) => matcher.test(buttonText(button, true)) && !isDisabled(button));
  if (semanticMatch) return semanticMatch;

  if (inputRect) {
    const sorted = buttons
      .filter((button) => !isDisabled(button))
      .map((button) => ({ button, rect: button.getBoundingClientRect() }))
      .sort((a, b) => a.rect.left - b.rect.left);
    const candidates = direction === 'next'
      ? sorted.filter((entry) => entry.rect.left > inputRect.right)
      : sorted.filter((entry) => entry.rect.right < inputRect.left).reverse();
    if (candidates.length > 0) {
      return candidates[0].button;
    }
  }

  return null;
}

function getCurrentPageNumber() {
  const element = getPageInput();
  if (element) {
    const pageNumber = parseInt(element.value || element.textContent || '', 10);
    if (!Number.isNaN(pageNumber) && pageNumber > 0) {
      return pageNumber;
    }
  }

  return 0;
}

async function getState() {
  latestState = await ipcRenderer.invoke('adidas-materials:get-state');
  updatePanel();
  return latestState;
}

async function waitForDataAfter(startTime, timeoutMs) {
  const endAt = Date.now() + timeoutMs;

  while (!stopRequested && Date.now() < endAt) {
    const state = await getState();
    if (state.lastDataAt && state.lastDataAt > startTime) {
      return state;
    }
    await sleep(800);
  }

  return null;
}

async function waitForSaveIdle(timeoutMs) {
  const endAt = Date.now() + timeoutMs;
  let state = await getState();

  while (
    !stopRequested
    && state
    && (state.isSaving || (state.currentBatchSize >= state.batchSize && state.currentBatchSize > 0))
    && Date.now() < endAt
  ) {
    setStatus('正在写入本批次文件，完成后继续翻页...', 'info');
    await sleep(1200);
    state = await getState();
  }

  return state;
}

function setStatus(message, kind) {
  const status = document.getElementById('adm-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind || 'info';
}

function setAutoButtons() {
  const startButton = document.getElementById('adm-start');
  const stopButton = document.getElementById('adm-stop');
  if (startButton) startButton.disabled = autoRunning;
  if (stopButton) stopButton.disabled = !autoRunning;
}

function normalizeNavigationUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.href;
  } catch (_error) {
    return '';
  }
}

function currentDisplayUrl() {
  if (window.location.protocol === 'data:') return '';
  return window.location.href;
}

function navigateToInputUrl() {
  const input = document.getElementById('adm-url');
  const url = normalizeNavigationUrl(input && input.value);
  if (!url) {
    setStatus('请输入有效的网址，例如 https://acp.adidas.com', 'warn');
    return;
  }
  setStatus('正在打开网页...', 'info');
  window.location.assign(url);
}

function goBack() {
  window.history.back();
}

function goForward() {
  window.history.forward();
}

function reloadPage() {
  window.location.reload();
}

async function triggerCurrentPageCapture() {
  setStatus('正在刷新当前页以捕获第一页数据...', 'info');
  const startedAt = Date.now();
  window.location.reload();

  const state = await waitForDataAfter(startedAt, AUTO_FIRST_PAGE_TIMEOUT_MS);
  if (state) {
    setStatus('当前页数据已捕获', 'success');
    return true;
  }

  setStatus('刷新后仍未捕获到当前页接口，将尝试继续向后翻页', 'warn');
  return false;
}

async function startAutoRun() {
  if (autoRunning) return;

  autoRunning = true;
  stopRequested = false;
  setAutoButtons();
  const startedAt = Date.now();
  writeAutoRunSession({ startedAt, pagesSinceRefresh: 0 });
  setStatus('正在刷新当前页以捕获第一页数据...', 'info');
  window.location.reload();
}

async function continueAutoRunAfterCurrentPage() {
  setStatus('自动翻页采集中...', 'info');
  const session = readAutoRunSession() || {};
  let pagesSinceRefresh = Number.isFinite(session.pagesSinceRefresh) ? session.pagesSinceRefresh : 0;
  let handoffToReload = false;

  try {
    let consecutiveFails = 0;

    while (!stopRequested) {
      const nextButton = findPaginationButton('next');
      if (!nextButton) {
        setStatus('没有可用的下一页按钮，采集结束', 'success');
        break;
      }

      const pageBefore = getCurrentPageNumber();
      const startedAt = Date.now();
      nextButton.click();
      setStatus(`正在等待第 ${pageBefore ? pageBefore + 1 : ''} 页接口...`, 'info');

      let state = await waitForDataAfter(startedAt, AUTO_PAGE_TIMEOUT_MS);
      if (!state) {
        const idleState = await waitForSaveIdle(AUTO_SAVE_IDLE_TIMEOUT_MS);
        if (idleState && idleState.lastDataAt && idleState.lastDataAt > startedAt) {
          state = idleState;
        }
      }

      if (state) {
        consecutiveFails = 0;
        if (state.isSaving || (state.currentBatchSize >= state.batchSize && state.currentBatchSize > 0)) {
          state = await waitForSaveIdle(AUTO_SAVE_IDLE_TIMEOUT_MS) || state;
        }
        setStatus(`已捕获：新增 ${state.lastNewItemCount} 条，累计 ${state.totalCollected} 条`, 'success');
        pagesSinceRefresh += 1;

        if (pagesSinceRefresh >= AUTO_SOFT_REFRESH_EVERY) {
          writeAutoRunSession({ startedAt: Date.now(), pagesSinceRefresh: 0, softRefresh: true });
          setStatus('已采集多页，正在刷新页面释放浏览器资源...', 'info');
          handoffToReload = true;
          await sleep(500);
          window.location.reload();
          return;
        }
      } else {
        consecutiveFails += 1;
        setStatus(`等待接口超时，连续失败 ${consecutiveFails} 次`, 'warn');
        if (consecutiveFails >= 3) {
          setStatus('连续 3 次没有捕获到接口，已自动暂停', 'warn');
          break;
        }
      }

      writeAutoRunSession({ startedAt: Date.now(), pagesSinceRefresh });
      await sleep(AUTO_PAGE_COOLDOWN_MS);
    }
  } catch (error) {
    setStatus(`自动采集异常: ${error.message}`, 'error');
  } finally {
    if (!handoffToReload) {
      autoRunning = false;
      stopRequested = false;
      clearAutoRunSession();
      setAutoButtons();
    }
  }
}

async function resumeAutoRunIfNeeded() {
  const session = readAutoRunSession();
  if (!session || autoRunning) return;

  autoRunning = true;
  stopRequested = false;
  setAutoButtons();
  setStatus('页面已刷新，正在等待第一页接口...', 'info');

  const state = await waitForDataAfter(session.startedAt || 0, AUTO_FIRST_PAGE_TIMEOUT_MS);
  if (state) {
    if (state.isSaving || (state.currentBatchSize >= state.batchSize && state.currentBatchSize > 0)) {
      await waitForSaveIdle(AUTO_SAVE_IDLE_TIMEOUT_MS);
    }
    setStatus(`第一页已捕获：新增 ${state.lastNewItemCount} 条，累计 ${state.totalCollected} 条`, 'success');
  } else {
    setStatus('刷新后仍未捕获到第一页接口，继续尝试翻页...', 'warn');
    await sleep(1200);
  }

  await continueAutoRunAfterCurrentPage();
}

async function flushBatch() {
  const result = await ipcRenderer.invoke('adidas-materials:flush-batch');
  latestState = result.state;
  updatePanel();
  if (result.success && result.saved) {
    setStatus(`已保存 ${result.saved.count} 条`, 'success');
  } else if (result.success) {
    setStatus('当前没有待保存数据', 'info');
  } else {
    setStatus(result.error || '保存失败', 'error');
  }
}

async function chooseOutputDir() {
  const result = await ipcRenderer.invoke('adidas-materials:select-output-dir');
  latestState = result.state;
  updatePanel();
}

async function openOutputDir() {
  const result = await ipcRenderer.invoke('adidas-materials:open-output-dir');
  if (!result.success) {
    setStatus(result.error || '打开目录失败', 'error');
  }
}

async function updateBatchSize() {
  const input = document.getElementById('adm-batch-size');
  const batchSize = parseInt(input && input.value, 10);
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    setStatus('批次大小必须是正整数', 'warn');
    return;
  }

  const result = await ipcRenderer.invoke('adidas-materials:update-settings', { batchSize });
  latestState = result.state;
  updatePanel();
}

async function clearState() {
  if (!window.confirm('确认清空采集进度？已保存到目录里的文件不会删除。')) return;
  const result = await ipcRenderer.invoke('adidas-materials:clear-state');
  latestState = result.state;
  updatePanel();
  setStatus('采集状态已清空', 'success');
}

function formatTime(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function updatePanel() {
  if (!panelReady || !latestState) return;

  const pairs = {
    'adm-count': latestState.totalCollected,
    'adm-pages': latestState.pagesCaptured,
    'adm-current-batch': `${latestState.currentBatchSize}/${latestState.batchSize}`,
    'adm-batch-number': latestState.batchNumber,
    'adm-last-page': latestState.lastPageItemCount,
    'adm-last-new': latestState.lastNewItemCount,
    'adm-saving': latestState.isSaving ? '保存中' : '空闲',
    'adm-last-time': formatTime(latestState.lastDataAt),
    'adm-output': latestState.outputDir || '-'
  };

  Object.keys(pairs).forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(pairs[id]);
  });

  const batchInput = document.getElementById('adm-batch-size');
  if (batchInput && document.activeElement !== batchInput) {
    batchInput.value = String(latestState.batchSize);
  }

  const urlInput = document.getElementById('adm-url');
  if (urlInput && document.activeElement !== urlInput) {
    urlInput.value = currentDisplayUrl();
  }

  const captureBadge = document.getElementById('adm-capture-ready');
  if (captureBadge) {
    captureBadge.textContent = latestState.captureReady ? '接口捕获：已启用' : '接口捕获：未启用';
    captureBadge.dataset.ready = latestState.captureReady ? 'true' : 'false';
  }

  const logs = document.getElementById('adm-logs');
  if (logs) {
    logs.innerHTML = (latestState.logs || []).slice(0, 10).map((entry) => (
      `<div class="adm-log adm-log-${entry.level}"><span>${entry.time}</span>${escapeHtml(entry.message)}</div>`
    )).join('');
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function panelStyles() {
  return `
    #${PANEL_ID} {
      position: fixed;
      top: 82px;
      right: 18px;
      width: 350px;
      max-height: min(600px, calc(100vh - 130px));
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 2147483647;
      background: #ffffff;
      color: #1f2937;
      border: 1px solid #d7dde8;
      border-radius: 8px;
      box-shadow: 0 12px 38px rgba(15, 23, 42, 0.22);
      font-family: Arial, "Microsoft YaHei", sans-serif;
      font-size: 13px;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .adm-header {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
      flex: 0 0 auto;
    }
    #${PANEL_ID} .adm-title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    #${PANEL_ID} .adm-badge {
      display: inline-flex;
      padding: 3px 8px;
      border-radius: 999px;
      background: #fee2e2;
      color: #991b1b;
      font-size: 12px;
    }
    #${PANEL_ID} .adm-badge[data-ready="true"] {
      background: #dcfce7;
      color: #166534;
    }
    #${PANEL_ID} .adm-body {
      padding: 10px 12px 12px;
      overflow: auto;
      flex: 1 1 auto;
    }
    #${PANEL_ID} .adm-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    #${PANEL_ID} .adm-stat {
      min-height: 48px;
      padding: 7px 8px;
      border: 1px solid #edf0f5;
      border-radius: 6px;
      background: #f9fafb;
    }
    #${PANEL_ID} .adm-label {
      display: block;
      margin-bottom: 3px;
      color: #64748b;
      font-size: 11px;
    }
    #${PANEL_ID} .adm-value {
      display: block;
      color: #111827;
      font-size: 14px;
      font-weight: 700;
      word-break: break-all;
    }
    #${PANEL_ID} .adm-output {
      margin-bottom: 8px;
      padding: 7px 8px;
      border: 1px solid #edf0f5;
      border-radius: 6px;
      background: #f8fafc;
      color: #334155;
      line-height: 1.45;
      word-break: break-all;
      max-height: 48px;
      overflow: auto;
    }
    #${PANEL_ID} .adm-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 8px;
    }
    #${PANEL_ID} button {
      min-height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      color: #1f2937;
      cursor: pointer;
      font-weight: 600;
    }
    #${PANEL_ID} button:hover:not(:disabled) { background: #f1f5f9; }
    #${PANEL_ID} button:disabled { opacity: 0.5; cursor: not-allowed; }
    #${PANEL_ID} .adm-primary {
      border-color: #2563eb;
      background: #2563eb;
      color: #ffffff;
    }
    #${PANEL_ID} .adm-primary:hover:not(:disabled) { background: #1d4ed8; }
    #${PANEL_ID} .adm-danger {
      border-color: #dc2626;
      background: #dc2626;
      color: #ffffff;
    }
    #${PANEL_ID} .adm-danger:hover:not(:disabled) { background: #b91c1c; }
    #${PANEL_ID} .adm-setting {
      display: grid;
      grid-template-columns: 1fr 86px;
      gap: 6px;
      margin-bottom: 8px;
    }
    #${PANEL_ID} .adm-url-row {
      display: grid;
      grid-template-columns: 1fr 64px;
      gap: 6px;
      margin-bottom: 6px;
    }
    #${PANEL_ID} .adm-nav-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }
    #${PANEL_ID} input {
      height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 8px;
      font: inherit;
    }
    #${PANEL_ID} #adm-status {
      margin: 8px 0;
      padding: 7px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      line-height: 1.45;
    }
    #${PANEL_ID} #adm-status[data-kind="success"] { background: #ecfdf5; color: #047857; }
    #${PANEL_ID} #adm-status[data-kind="warn"] { background: #fffbeb; color: #b45309; }
    #${PANEL_ID} #adm-status[data-kind="error"] { background: #fef2f2; color: #b91c1c; }
    #${PANEL_ID} .adm-logs {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 92px;
      overflow: auto;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }
    #${PANEL_ID} .adm-log {
      line-height: 1.35;
      color: #475569;
    }
    #${PANEL_ID} .adm-log span {
      display: inline-block;
      margin-right: 6px;
      color: #94a3b8;
    }
    #${PANEL_ID} .adm-log-success { color: #047857; }
    #${PANEL_ID} .adm-log-error { color: #b91c1c; }
    #${PANEL_ID} .adm-log-warn { color: #b45309; }
  `;
}

function createPanel() {
  if (!document.body || document.getElementById(PANEL_ID)) return;

  const style = document.createElement('style');
  style.textContent = panelStyles();
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="adm-header">
      <h2 class="adm-title">外部浏览器采集器</h2>
      <span id="adm-capture-ready" class="adm-badge">接口捕获：检测中</span>
    </div>
    <div class="adm-body">
      <div class="adm-grid">
        <div class="adm-stat"><span class="adm-label">累计新增</span><span id="adm-count" class="adm-value">0</span></div>
        <div class="adm-stat"><span class="adm-label">捕获页数</span><span id="adm-pages" class="adm-value">0</span></div>
        <div class="adm-stat"><span class="adm-label">当前批次</span><span id="adm-current-batch" class="adm-value">0/2000</span></div>
        <div class="adm-stat"><span class="adm-label">批次号</span><span id="adm-batch-number" class="adm-value">1</span></div>
        <div class="adm-stat"><span class="adm-label">上次接口</span><span id="adm-last-page" class="adm-value">0</span></div>
        <div class="adm-stat"><span class="adm-label">上次新增</span><span id="adm-last-new" class="adm-value">0</span></div>
        <div class="adm-stat"><span class="adm-label">保存状态</span><span id="adm-saving" class="adm-value">空闲</span></div>
      </div>
      <span class="adm-label">保存目录</span>
      <div id="adm-output" class="adm-output">-</div>
      <span class="adm-label">网页地址</span>
      <div class="adm-url-row">
        <input id="adm-url" type="text" placeholder="粘贴登录入口或当前系统网址" />
        <button id="adm-go">前往</button>
      </div>
      <div class="adm-nav-row">
        <button id="adm-back">后退</button>
        <button id="adm-forward">前进</button>
        <button id="adm-page-reload">刷新</button>
      </div>
      <div class="adm-setting">
        <input id="adm-batch-size" type="number" min="100" step="100" value="2000" />
        <button id="adm-set-batch">设置批次</button>
      </div>
      <div class="adm-controls">
        <button id="adm-grab">获取当前页</button>
        <button id="adm-start" class="adm-primary">开始自动翻页</button>
        <button id="adm-stop" class="adm-danger" disabled>暂停</button>
        <button id="adm-flush">保存当前批次</button>
        <button id="adm-dir">选择目录</button>
        <button id="adm-open-dir">打开目录</button>
        <button id="adm-refresh">刷新状态</button>
        <button id="adm-clear">清空进度</button>
      </div>
      <div class="adm-stat">
        <span class="adm-label">上次捕获时间</span>
        <span id="adm-last-time" class="adm-value">-</span>
      </div>
      <div id="adm-status" data-kind="info">请先在上方地址栏打开登录入口，在外部浏览器中登录并进入 Materials 列表页，再点击获取当前页或开始自动翻页。</div>
      <div id="adm-logs" class="adm-logs"></div>
    </div>
  `;

  document.body.appendChild(panel);
  panelReady = true;

  document.getElementById('adm-grab').addEventListener('click', triggerCurrentPageCapture);
  document.getElementById('adm-start').addEventListener('click', startAutoRun);
  document.getElementById('adm-stop').addEventListener('click', () => {
    stopRequested = true;
    clearAutoRunSession();
    setStatus('正在暂停...', 'warn');
  });
  document.getElementById('adm-flush').addEventListener('click', flushBatch);
  document.getElementById('adm-dir').addEventListener('click', chooseOutputDir);
  document.getElementById('adm-open-dir').addEventListener('click', openOutputDir);
  document.getElementById('adm-refresh').addEventListener('click', getState);
  document.getElementById('adm-clear').addEventListener('click', clearState);
  document.getElementById('adm-set-batch').addEventListener('click', updateBatchSize);
  document.getElementById('adm-go').addEventListener('click', navigateToInputUrl);
  document.getElementById('adm-back').addEventListener('click', goBack);
  document.getElementById('adm-forward').addEventListener('click', goForward);
  document.getElementById('adm-page-reload').addEventListener('click', reloadPage);
  document.getElementById('adm-url').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateToInputUrl();
    }
  });

  getState().finally(() => {
    resumeAutoRunIfNeeded();
  });
  setAutoButtons();
}

function ensurePanel() {
  if (document.getElementById(PANEL_ID)) return;
  createPanel();
}

ipcRenderer.on('adidas-materials:state', (_event, state) => {
  latestState = state;
  updatePanel();
});

window.addEventListener('DOMContentLoaded', createPanel);

if (document.readyState !== 'loading') {
  createPanel();
}

let ensurePanelTimer = null;
const observer = new MutationObserver(() => {
  if (ensurePanelTimer) return;
  ensurePanelTimer = setTimeout(() => {
    ensurePanelTimer = null;
    ensurePanel();
  }, 1000);
});

function startPanelObserver() {
  const root = document.body || document.documentElement;
  if (!root) return;
  try {
    observer.observe(root, { childList: true });
  } catch (_error) {}
}

startPanelObserver();
