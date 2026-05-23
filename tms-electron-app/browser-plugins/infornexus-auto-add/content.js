(function () {
  'use strict';

  const PANEL_ID = 'infornexus-auto-add-panel';
  const STORAGE_KEY = 'infornexus_auto_add_panel_state_v1';

  if (window.top !== window) return;
  if (document.getElementById(PANEL_ID)) return;

  const state = {
    ids: [],
    index: 0,
    running: false,
    columnIndex: 2,
    autoClickAdd: false,
    delayMs: 1800,
    collapsed: false,
    logs: []
  };

  function normalizeId(value) {
    const text = String(value || '').trim();
    const direct = text.replace(/\s+/g, '');
    if (/^\d{10}$/.test(direct)) return direct;
    const match = text.match(/\b\d{10}\b/);
    return match ? match[0] : '';
  }

  function uniqueIds(values) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      const id = normalizeId(value);
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push(id);
    });
    return result;
  }

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 4
      && rect.height > 4
      && style.visibility !== 'hidden'
      && style.display !== 'none'
      && Number(style.opacity || 1) > 0;
  }

  function setNativeValue(input, value) {
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(target) {
    ['keydown', 'keypress', 'keyup'].forEach((type) => {
      target.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      }));
    });
  }

  function findSearchInput() {
    const selectors = [
      'input[type="search"]',
      'input[placeholder*="Search" i]',
      'input[aria-label*="Search" i]',
      'input[name*="search" i]',
      'input[id*="search" i]',
      '[role="search"] input',
      '.search input',
      '.global-search input'
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (element instanceof HTMLInputElement && visible(element)) candidates.push(element);
      });
    });

    return candidates
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })[0] || null;
  }

  function textOf(element) {
    return String(element && element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function findSearchButtonNear(input) {
    const roots = [
      input.closest('form'),
      input.parentElement,
      input.parentElement && input.parentElement.parentElement,
      document
    ].filter(Boolean);

    for (const root of roots) {
      const buttons = Array.from(root.querySelectorAll('button, [role="button"], a'));
      const match = buttons.find((button) => {
        if (!visible(button)) return false;
        const label = [
          textOf(button),
          button.getAttribute('aria-label') || '',
          button.getAttribute('title') || '',
          button.className || ''
        ].join(' ');
        return /search|查找|搜索/i.test(label);
      });
      if (match) return match;
    }

    return null;
  }

  function findAddButtonForId(id) {
    const rowSelectors = [
      'tr',
      '[role="row"]',
      'li',
      '.row',
      '.x-grid-row',
      '.x-grid3-row',
      '.result',
      '.search-result'
    ];
    const buttonSelector = 'button, [role="button"], a, input[type="button"], input[type="submit"]';
    const addText = /^(add|select|choose|添加|加入|选择)$/i;

    for (const selector of rowSelectors) {
      const row = Array.from(document.querySelectorAll(selector)).find((element) => {
        return visible(element) && textOf(element).includes(id);
      });
      if (!row) continue;
      const button = Array.from(row.querySelectorAll(buttonSelector)).find((element) => {
        const label = textOf(element) || element.value || element.getAttribute('aria-label') || element.getAttribute('title') || '';
        return visible(element) && addText.test(String(label).trim());
      });
      if (button) return button;
    }

    return Array.from(document.querySelectorAll(buttonSelector)).find((element) => {
      const label = textOf(element) || element.value || element.getAttribute('aria-label') || element.getAttribute('title') || '';
      return visible(element) && addText.test(String(label).trim());
    }) || null;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ids: state.ids,
        index: state.index,
        columnIndex: state.columnIndex,
        autoClickAdd: state.autoClickAdd,
        delayMs: state.delayMs,
        collapsed: state.collapsed
      }));
    } catch (_error) {
      // Ignore storage failures in restricted pages.
    }
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (Array.isArray(saved.ids)) state.ids = uniqueIds(saved.ids);
      if (Number.isFinite(saved.index)) state.index = Math.min(Math.max(saved.index, 0), state.ids.length);
      if (Number.isFinite(saved.columnIndex) && saved.columnIndex > 0) state.columnIndex = saved.columnIndex;
      if (typeof saved.autoClickAdd === 'boolean') state.autoClickAdd = saved.autoClickAdd;
      if (Number.isFinite(saved.delayMs) && saved.delayMs >= 500) state.delayMs = saved.delayMs;
      if (typeof saved.collapsed === 'boolean') state.collapsed = saved.collapsed;
    } catch (_error) {
      // Ignore stale state.
    }
  }

  function addLog(level, message) {
    const time = new Date().toLocaleTimeString();
    state.logs.unshift({ level, message, time });
    state.logs = state.logs.slice(0, 80);
    render();
  }

  function readCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (char !== '\r') {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some((value) => String(value).trim() !== '')) rows.push(row);
    return rows;
  }

  async function parseFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'xlsm'].includes(extension) && window.XLSX) {
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false });
    }

    const text = await file.text();
    return readCsvRows(text);
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      addLog('info', `读取文件：${file.name}`);
      const rows = await parseFile(file);
      const column = Math.max(1, Number(state.columnIndex) || 2) - 1;
      const ids = uniqueIds(rows.map((row) => Array.isArray(row) ? row[column] : ''));
      state.ids = ids;
      state.index = 0;
      saveState();
      addLog(ids.length > 0 ? 'success' : 'warn', `已读取 ${ids.length} 个 10 位 ID`);
      render();
    } catch (error) {
      addLog('error', `读取失败：${error.message}`);
    }
  }

  async function runCurrent() {
    const id = state.ids[state.index];
    if (!id) {
      addLog('warn', '没有可执行的 ID');
      return false;
    }

    const input = findSearchInput();
    if (!input) {
      addLog('error', '未找到页面搜索框，请确认已进入 InforNexus 页面');
      return false;
    }

    input.scrollIntoView({ block: 'center', inline: 'center' });
    input.focus();
    setNativeValue(input, id);

    const searchButton = findSearchButtonNear(input);
    if (searchButton) {
      searchButton.click();
    } else {
      pressEnter(input);
      const form = input.closest('form');
      if (form && typeof form.requestSubmit === 'function') {
        try {
          form.requestSubmit();
        } catch (_error) {
          // Some framework-controlled forms reject requestSubmit; Enter is enough there.
        }
      }
    }

    addLog('info', `已搜索：${id}`);

    if (state.autoClickAdd) {
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      const addButton = findAddButtonForId(id);
      if (addButton) {
        addButton.click();
        addLog('success', `已点击添加：${id}`);
      } else {
        addLog('warn', `未找到添加按钮：${id}`);
      }
    }

    state.index += 1;
    saveState();
    render();
    return true;
  }

  async function runAuto() {
    if (state.running) return;
    state.running = true;
    render();
    addLog('info', '自动执行开始');
    while (state.running && state.index < state.ids.length) {
      const ok = await runCurrent();
      if (!ok) break;
      if (state.running && state.index < state.ids.length) {
        await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      }
    }
    state.running = false;
    saveState();
    addLog('info', '自动执行结束');
    render();
  }

  function clearAll() {
    state.ids = [];
    state.index = 0;
    state.running = false;
    saveState();
    addLog('info', '已清空 ID 列表');
    render();
  }

  function setIdsFromTextarea(value) {
    const ids = uniqueIds(String(value || '').split(/[\s,;，；]+/));
    state.ids = ids;
    state.index = 0;
    saveState();
    addLog(ids.length > 0 ? 'success' : 'warn', `已粘贴 ${ids.length} 个 10 位 ID`);
    render();
  }

  function createPanel() {
    const host = document.createElement('div');
    host.id = PANEL_ID;
    host.style.position = 'fixed';
    host.style.top = '112px';
    host.style.right = '18px';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: Arial, "Microsoft YaHei", sans-serif; }
        .panel { width: 340px; color: #1f2937; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 18px 42px rgba(15,23,42,.22); overflow: hidden; }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #111827; color: #fff; padding: 10px 12px; cursor: move; }
        .title { min-width: 0; }
        .title strong { display: block; font-size: 14px; line-height: 1.3; }
        .title span { display: block; color: #cbd5e1; font-size: 11px; line-height: 1.3; margin-top: 2px; }
        .head-actions { display: flex; gap: 6px; }
        .icon-btn { width: 28px; height: 28px; border: 1px solid rgba(255,255,255,.2); border-radius: 6px; color: #fff; background: rgba(255,255,255,.08); cursor: pointer; font-size: 14px; }
        .body { padding: 12px; display: grid; gap: 10px; }
        .panel.collapsed .body { display: none; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #f8fafc; }
        .stat span { display: block; color: #64748b; font-size: 11px; }
        .stat strong { display: block; color: #111827; font-size: 18px; line-height: 1.2; margin-top: 3px; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row > * { min-width: 0; }
        label { color: #475569; font-size: 12px; font-weight: 700; }
        input[type="number"], textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font-size: 12px; outline: none; }
        input[type="number"]:focus, textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.12); }
        textarea { min-height: 58px; resize: vertical; }
        .check { display: flex; align-items: center; gap: 6px; color: #334155; font-size: 12px; }
        .btn { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1f2937; cursor: pointer; font-size: 12px; font-weight: 700; min-height: 34px; padding: 8px 10px; }
        .btn:hover { background: #f8fafc; }
        .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .btn.primary:hover { background: #1d4ed8; }
        .btn.danger { color: #b91c1c; border-color: #fecaca; }
        .btn:disabled { cursor: not-allowed; opacity: .55; }
        .file { display: none; }
        .button-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .current { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 8px; padding: 9px; font-size: 12px; color: #1e40af; overflow-wrap: anywhere; }
        .logs { border-top: 1px solid #e5e7eb; display: grid; gap: 6px; max-height: 180px; overflow: auto; padding-top: 8px; }
        .log { display: grid; gap: 2px; border-radius: 6px; background: #f8fafc; padding: 7px; font-size: 11px; line-height: 1.35; }
        .log small { color: #94a3b8; }
        .log.info { border-left: 3px solid #2563eb; }
        .log.success { border-left: 3px solid #16a34a; }
        .log.warn { border-left: 3px solid #d97706; }
        .log.error { border-left: 3px solid #dc2626; }
      </style>
      <div class="panel">
        <div class="head" id="dragHandle">
          <div class="title">
            <strong>InforNexus 自动搜索并添加</strong>
            <span>读取第二列 10 位 ID，在当前网页执行搜索</span>
          </div>
          <div class="head-actions">
            <button class="icon-btn" id="collapseBtn" title="收起/展开">−</button>
          </div>
        </div>
        <div class="body">
          <div class="stats">
            <div class="stat"><span>总数</span><strong id="total">0</strong></div>
            <div class="stat"><span>进度</span><strong id="progress">0</strong></div>
            <div class="stat"><span>剩余</span><strong id="remain">0</strong></div>
          </div>
          <div class="current" id="current">当前没有 ID</div>
          <div class="row">
            <button class="btn primary" id="pickFile">选择 Excel/CSV</button>
            <input class="file" id="fileInput" type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt" />
            <label style="flex:1">读取第 <input id="columnIndex" type="number" min="1" max="20" value="2" /> 列</label>
          </div>
          <textarea id="manualIds" placeholder="也可以直接粘贴 10 位 ID，多个 ID 用空格、换行或逗号分隔"></textarea>
          <button class="btn" id="loadManual">读取粘贴内容</button>
          <div class="row">
            <label class="check"><input id="autoClickAdd" type="checkbox" /> 搜索后自动点击 Add/Select</label>
            <label style="width:112px">间隔 ms<input id="delayMs" type="number" min="500" step="100" value="1800" /></label>
          </div>
          <div class="button-grid">
            <button class="btn primary" id="runOne">执行当前</button>
            <button class="btn primary" id="runAuto">自动执行</button>
            <button class="btn" id="stopRun">停止</button>
            <button class="btn danger" id="clearAll">清空</button>
          </div>
          <div class="logs" id="logs"></div>
        </div>
      </div>
    `;

    return { host, shadow };
  }

  let elements;

  function bindPanel(host, shadow) {
    elements = {
      panel: shadow.querySelector('.panel'),
      total: shadow.getElementById('total'),
      progress: shadow.getElementById('progress'),
      remain: shadow.getElementById('remain'),
      current: shadow.getElementById('current'),
      fileInput: shadow.getElementById('fileInput'),
      pickFile: shadow.getElementById('pickFile'),
      columnIndex: shadow.getElementById('columnIndex'),
      manualIds: shadow.getElementById('manualIds'),
      loadManual: shadow.getElementById('loadManual'),
      autoClickAdd: shadow.getElementById('autoClickAdd'),
      delayMs: shadow.getElementById('delayMs'),
      runOne: shadow.getElementById('runOne'),
      runAuto: shadow.getElementById('runAuto'),
      stopRun: shadow.getElementById('stopRun'),
      clearAll: shadow.getElementById('clearAll'),
      logs: shadow.getElementById('logs'),
      collapseBtn: shadow.getElementById('collapseBtn'),
      dragHandle: shadow.getElementById('dragHandle')
    };

    elements.pickFile.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', () => handleFile(elements.fileInput.files[0]));
    elements.loadManual.addEventListener('click', () => setIdsFromTextarea(elements.manualIds.value));
    elements.runOne.addEventListener('click', () => runCurrent());
    elements.runAuto.addEventListener('click', () => runAuto());
    elements.stopRun.addEventListener('click', () => {
      state.running = false;
      addLog('info', '已请求停止');
      render();
    });
    elements.clearAll.addEventListener('click', clearAll);
    elements.columnIndex.addEventListener('change', () => {
      state.columnIndex = Math.max(1, Number(elements.columnIndex.value) || 2);
      saveState();
      render();
    });
    elements.autoClickAdd.addEventListener('change', () => {
      state.autoClickAdd = elements.autoClickAdd.checked;
      saveState();
      render();
    });
    elements.delayMs.addEventListener('change', () => {
      state.delayMs = Math.max(500, Number(elements.delayMs.value) || 1800);
      saveState();
      render();
    });
    elements.collapseBtn.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      saveState();
      render();
    });

    let dragging = null;
    elements.dragHandle.addEventListener('pointerdown', (event) => {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      const rect = host.getBoundingClientRect();
      dragging = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      elements.dragHandle.setPointerCapture(event.pointerId);
    });
    elements.dragHandle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const left = Math.max(8, Math.min(window.innerWidth - 80, dragging.left + event.clientX - dragging.startX));
      const top = Math.max(8, Math.min(window.innerHeight - 40, dragging.top + event.clientY - dragging.startY));
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      host.style.right = 'auto';
    });
    elements.dragHandle.addEventListener('pointerup', () => {
      dragging = null;
    });
  }

  function render() {
    if (!elements) return;
    const total = state.ids.length;
    const done = Math.min(state.index, total);
    elements.panel.classList.toggle('collapsed', state.collapsed);
    elements.collapseBtn.textContent = state.collapsed ? '+' : '−';
    elements.total.textContent = String(total);
    elements.progress.textContent = String(done);
    elements.remain.textContent = String(Math.max(0, total - done));
    elements.current.textContent = total > 0
      ? `当前：${state.ids[state.index] || '已完成'}`
      : '当前没有 ID';
    elements.columnIndex.value = String(state.columnIndex);
    elements.autoClickAdd.checked = state.autoClickAdd;
    elements.delayMs.value = String(state.delayMs);
    elements.runOne.disabled = state.running || state.index >= total;
    elements.runAuto.disabled = state.running || state.index >= total;
    elements.stopRun.disabled = !state.running;
    elements.logs.innerHTML = state.logs.map((log) => `
      <div class="log ${log.level}">
        <small>${log.time}</small>
        <div>${escapeHtml(log.message)}</div>
      </div>
    `).join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    if (!document.documentElement || document.getElementById(PANEL_ID)) return;
    loadState();
    const panel = createPanel();
    bindPanel(panel.host, panel.shadow);
    addLog('success', '面板已加载');
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
