const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const ExcelJS = require('exceljs');

const TARGET_URL = 'https://acp.adidas.com/libraries/materials';
const DEFAULT_BATCH_SIZE = 2000;
const STATE_SAVE_DELAY_MS = 800;
const MAX_LOGS = 120;
const STANDARD_BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MASTER_WORKBOOK_FILENAMES = {
  fabric: 'adidas_materials_fabric_master.xlsx',
  trim: 'adidas_materials_trim_master.xlsx',
  mixed: 'adidas_materials_master.xlsx'
};
const BLOCKED_BROWSER_RESOURCE_URLS = [
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.avif'
];

class CdpClient {
  constructor(target) {
    this.target = target;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.target.webSocketDebuggerUrl);
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', () => this.handleClose());
      this.ws.on('error', () => {});
    });
  }

  handleMessage(data) {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch (_error) {
      return;
    }

    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result || {});
      }
      return;
    }

    if (message.method && this.handlers.has(message.method)) {
      for (const handler of this.handlers.get(message.method)) {
        handler(message.params || {});
      }
    }
  }

  handleClose() {
    this.closed = true;
    for (const { reject } of this.pending.values()) {
      reject(new Error('CDP target closed'));
    }
    this.pending.clear();
  }

  on(method, handler) {
    if (!this.handlers.has(method)) {
      this.handlers.set(method, []);
    }
    this.handlers.get(method).push(handler);
  }

  send(method, params = {}) {
    if (!this.ws || this.closed || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP target is not connected'));
    }

    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15000);
    });
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.handleClose();
  }
}

function startPageDataUrl() {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>adidas 外部浏览器采集器</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #f8fafc;
      color: #1e293b;
      font-family: Arial, "Microsoft YaHei", sans-serif;
    }
    main {
      max-width: 780px;
      padding: 72px 460px 72px 72px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 30px;
      line-height: 1.25;
    }
    p {
      margin: 0 0 18px;
      color: #64748b;
      line-height: 1.8;
      font-size: 15px;
    }
    .steps {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }
    .step {
      padding: 16px 18px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      color: #334155;
      line-height: 1.65;
    }
    code {
      padding: 2px 6px;
      border-radius: 4px;
      background: #eef2ff;
      color: #3730a3;
      font-family: Consolas, monospace;
    }
  </style>
</head>
<body>
  <main>
    <h1>外部浏览器采集 Materials 数据</h1>
    <p>这个窗口运行在系统 Edge/Chrome 中。它不会自动打开 adidas Materials 地址，避免直接请求触发 403。请使用右侧面板顶部的地址栏进入你的登录入口。</p>
    <div class="steps">
      <div class="step">1. 在右侧 <code>网页地址</code> 输入框粘贴你平时使用的 adidas ACP 登录入口，然后点击 <code>前往</code>。</div>
      <div class="step">2. 登录成功后，像平时一样在这个浏览器里进入 Materials 列表页。</div>
      <div class="step">3. 停留在 Materials 列表页后，点击右侧 <code>获取当前页</code> 或 <code>开始自动翻页</code>。</div>
      <div class="step">4. 采集结束前点击 <code>保存当前批次</code>，剩余数据会保存到本地目录。</div>
    </div>
  </main>
</body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}

function registerAdidasMaterialsCollector({ app, BrowserWindow, ipcMain, dialog, shell, getParentWindow }) {
  const runtimeDir = path.join(app.getPath('userData'), 'adidas-materials-collector');
  const stateFile = path.join(runtimeDir, 'collector-state.json');
  const pendingBatchFile = path.join(runtimeDir, 'pending-batch.json');

  let collectorWindow = null;
  let saveTimer = null;
  let requestMap = new Map();
  let externalBrowser = null;
  let externalPollTimer = null;
  let externalPageClients = new Map();
  let state = loadState();

  function defaultOutputDir() {
    return path.join(app.getPath('downloads'), 'adidas-materials');
  }

  function ensureRuntimeDir() {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }

  function safeReadJson(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
      return fallback;
    }
  }

  function loadState() {
    const saved = safeReadJson(stateFile, {});
    const pendingBatch = safeReadJson(pendingBatchFile, []);

    return {
      collectedIds: new Set(Array.isArray(saved.collectedIds) ? saved.collectedIds : []),
      currentBatch: Array.isArray(pendingBatch) ? pendingBatch : [],
      totalCollected: Number.isFinite(saved.totalCollected) ? saved.totalCollected : 0,
      batchNumber: Number.isFinite(saved.batchNumber) ? saved.batchNumber : 1,
      capturedPageKeys: new Set(Array.isArray(saved.capturedPageKeys) ? saved.capturedPageKeys : []),
      pagesCaptured: Number.isFinite(saved.pagesCaptured) ? saved.pagesCaptured : 0,
      batchSize: Number.isFinite(saved.batchSize) && saved.batchSize > 0 ? saved.batchSize : DEFAULT_BATCH_SIZE,
      outputDir: typeof saved.outputDir === 'string' && saved.outputDir ? saved.outputDir : defaultOutputDir(),
      lastDataAt: Number.isFinite(saved.lastDataAt) ? saved.lastDataAt : 0,
      lastPageItemCount: Number.isFinite(saved.lastPageItemCount) ? saved.lastPageItemCount : 0,
      lastNewItemCount: Number.isFinite(saved.lastNewItemCount) ? saved.lastNewItemCount : 0,
      lastDuplicateCount: Number.isFinite(saved.lastDuplicateCount) ? saved.lastDuplicateCount : 0,
      lastSourceUrl: typeof saved.lastSourceUrl === 'string' ? saved.lastSourceUrl : '',
      recentFiles: Array.isArray(saved.recentFiles) ? saved.recentFiles.slice(0, 20) : [],
      logs: [],
      captureReady: false,
      isSaving: false,
      currentUrl: '',
      lastError: ''
    };
  }

  function persistStateNow() {
    ensureRuntimeDir();
    const persisted = {
      collectedIds: Array.from(state.collectedIds),
      totalCollected: state.totalCollected,
      batchNumber: state.batchNumber,
      capturedPageKeys: Array.from(state.capturedPageKeys),
      pagesCaptured: state.pagesCaptured,
      batchSize: state.batchSize,
      outputDir: state.outputDir,
      lastDataAt: state.lastDataAt,
      lastPageItemCount: state.lastPageItemCount,
      lastNewItemCount: state.lastNewItemCount,
      lastDuplicateCount: state.lastDuplicateCount,
      lastSourceUrl: state.lastSourceUrl,
      recentFiles: state.recentFiles,
      savedAt: new Date().toISOString()
    };

    atomicWriteJson(stateFile, persisted);
    atomicWriteJson(pendingBatchFile, state.currentBatch);
  }

  function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        persistStateNow();
      } catch (error) {
        appendLog('error', `保存状态失败: ${error.message}`);
      }
    }, STATE_SAVE_DELAY_MS);
  }

  function atomicWriteJson(filePath, value) {
    ensureRuntimeDir();
    const tmpFile = `${filePath}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmpFile, filePath);
  }

  function appendLog(level, message) {
    const entry = {
      level,
      message,
      time: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    state.logs.unshift(entry);
    if (state.logs.length > MAX_LOGS) {
      state.logs = state.logs.slice(0, MAX_LOGS);
    }
    if (level === 'error') {
      state.lastError = message;
    }
    publishState();
  }

  function publicState() {
    return {
      targetUrl: TARGET_URL,
      outputDir: state.outputDir,
      totalCollected: state.totalCollected,
      batchNumber: state.batchNumber,
      batchSize: state.batchSize,
      currentBatchSize: state.currentBatch.length,
      pagesCaptured: state.pagesCaptured,
      lastDataAt: state.lastDataAt,
      lastPageItemCount: state.lastPageItemCount,
      lastNewItemCount: state.lastNewItemCount,
      lastDuplicateCount: state.lastDuplicateCount,
      lastSourceUrl: state.lastSourceUrl,
      recentFiles: state.recentFiles,
      logs: state.logs,
      captureReady: state.captureReady || externalPageClients.size > 0,
      isSaving: !!state.isSaving,
      currentUrl: collectorWindow && !collectorWindow.isDestroyed() ? collectorWindow.webContents.getURL() : '',
      browserMode: externalBrowser ? 'external' : 'electron',
      externalBrowser: externalBrowser ? {
        name: externalBrowser.name,
        port: externalBrowser.port,
        profileDir: externalBrowser.profileDir,
        connectedPages: externalPageClients.size
      } : null,
      lastError: state.lastError
    };
  }

  function sendStateToWindow() {
    if (!collectorWindow || collectorWindow.isDestroyed()) return;
    collectorWindow.webContents.send('adidas-materials:state', publicState());
  }

  function broadcastExternalState() {
    const stateJson = JSON.stringify(publicState());
    for (const client of externalPageClients.values()) {
      client.send('Runtime.evaluate', {
        expression: `window.__admReceiveState && window.__admReceiveState(${stateJson});`,
        awaitPromise: false
      }).catch(() => {});
    }
  }

  function publishState() {
    sendStateToWindow();
    broadcastExternalState();
  }

  function getUniqueId(item) {
    if (!item || typeof item !== 'object') return '';

    const id = item.refNum || item.id || '';
    const supplier = item.supplier && typeof item.supplier === 'object' ? item.supplier : {};
    const supplierNode = supplier.supplier && typeof supplier.supplier === 'object' ? supplier.supplier : {};
    const supplierCode = supplierNode.code || supplier.code || '';
    const supplierMaterialId = supplier.supplierMaterialId || item.supplierMaterialId || '';

    if (supplierMaterialId) return String(supplierMaterialId);
    if (id) return `${id}_${supplierCode}`;
    return '';
  }

  function isMaterialLikeItem(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Boolean(
      value.refNum ||
      value.supplierMaterialId ||
      value.materialType ||
      (value.supplier && (value.id || value.name || value.status))
    );
  }

  function isMaterialArray(value) {
    if (!Array.isArray(value) || value.length === 0) return false;
    const sample = value.slice(0, Math.min(value.length, 8));
    return sample.filter(isMaterialLikeItem).length >= Math.max(1, Math.ceil(sample.length / 2));
  }

  function extractItems(payload) {
    if (!payload) return [];
    if (isMaterialArray(payload)) return payload.filter(isMaterialLikeItem);

    const directCandidates = [
      payload && payload._embedded && payload._embedded.items,
      payload.items,
      payload.content,
      payload.results,
      payload.data
    ];

    for (const candidate of directCandidates) {
      if (isMaterialArray(candidate)) {
        return candidate.filter(isMaterialLikeItem);
      }
    }

    const seen = new Set();
    const found = [];

    function visit(value, depth) {
      if (!value || typeof value !== 'object' || depth > 5 || seen.has(value)) return;
      seen.add(value);

      if (isMaterialArray(value)) {
        found.push(value.filter(isMaterialLikeItem));
        return;
      }

      if (Array.isArray(value)) {
        value.slice(0, 20).forEach((entry) => visit(entry, depth + 1));
        return;
      }

      Object.keys(value).forEach((key) => {
        if (found.length > 0) return;
        visit(value[key], depth + 1);
      });
    }

    visit(payload, 0);
    return found.length > 0 ? found[0] : [];
  }

  function isMaterialResponseUrl(url) {
    if (typeof url !== 'string') return false;
    return /material/i.test(url);
  }

  function getCapturedPageKey(items, sourceUrl) {
    const materialTypeKey = formatCompoundValue(getMaterialTypeLevel1(items[0]) || 'unknown').toLowerCase() || 'unknown';

    try {
      const parsedUrl = new URL(sourceUrl);
      const pageParamNames = [
        'page',
        'pageNumber',
        'pageIndex',
        'offset',
        'start',
        'from',
        'skip'
      ];
      const sizeParamNames = ['size', 'limit', 'pageSize', 'count'];
      const parts = [];

      for (const name of pageParamNames.concat(sizeParamNames)) {
        if (parsedUrl.searchParams.has(name)) {
          parts.push(`${name}=${parsedUrl.searchParams.get(name)}`);
        }
      }

      if (parts.length > 0) {
        return `${materialTypeKey}|${parsedUrl.origin}${parsedUrl.pathname}?${parts.join('&')}`;
      }
    } catch (_error) {
      // Some CDP URLs can be relative or opaque; fall back to item signature.
    }

    const firstId = getUniqueId(items[0]) || JSON.stringify(items[0] || {}).slice(0, 80);
    const lastId = getUniqueId(items[items.length - 1]) || JSON.stringify(items[items.length - 1] || {}).slice(0, 80);
    return `${materialTypeKey}|${items.length}:${firstId}:${lastId}`;
  }

  async function processPayload(payload, sourceUrl) {
    const items = extractItems(payload);
    if (items.length === 0) return;

    const pageKey = getCapturedPageKey(items, sourceUrl || '');
    const isNewPageCapture = pageKey && !state.capturedPageKeys.has(pageKey);
    let newCount = 0;

    if (pageKey && !isNewPageCapture) {
      state.lastDataAt = Date.now();
      state.lastPageItemCount = items.length;
      state.lastNewItemCount = 0;
      state.lastDuplicateCount = items.length;
      state.lastSourceUrl = sourceUrl || '';
      appendLog('info', `当前页已采集过，已跳过 ${items.length} 条，避免重复写入`);
      schedulePersist();
      publishState();
      return;
    }

    if (isNewPageCapture) {
      state.capturedPageKeys.add(pageKey);
      state.pagesCaptured = state.capturedPageKeys.size;
    }

    for (const item of items) {
      state.currentBatch.push(item);
      state.totalCollected += 1;
      newCount += 1;
    }

    if (!pageKey && newCount > 0) {
      state.pagesCaptured += 1;
    }
    state.lastDataAt = Date.now();
    state.lastPageItemCount = items.length;
    state.lastNewItemCount = newCount;
    state.lastDuplicateCount = 0;
    state.lastSourceUrl = sourceUrl || '';

    appendLog(
      newCount > 0 ? 'success' : 'info',
      `捕获 ${items.length} 条，已保存 ${newCount} 条${isNewPageCapture ? '' : '，页数未重复计入'}`
    );
    schedulePersist();
    publishState();

    if (state.currentBatch.length >= state.batchSize) {
      await saveCurrentBatch('auto');
    }
  }

  function ensureOutputDir() {
    fs.mkdirSync(state.outputDir, { recursive: true });
  }

  function timestampForFile() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('-') + '_' + [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('');
  }

  function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function isEmptyExportValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (!isEmptyExportValue(value)) return value;
    }
    return '';
  }

  function getPathValue(source, pathText) {
    if (!source || typeof source !== 'object') return undefined;
    return String(pathText)
      .split('.')
      .reduce((current, part) => {
        if (!current || typeof current !== 'object') return undefined;
        return current[part];
      }, source);
  }

  function normalizeAttributeName(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function getAttributeValue(item, names) {
    const targetNames = names.map(normalizeAttributeName);
    const containers = [
      item && item.attributes,
      item && item.attributeValues,
      item && item.values,
      getPathValue(item, '_embedded.attributes')
    ].filter(Boolean);

    for (const container of containers) {
      if (Array.isArray(container)) {
        for (const entry of container) {
          if (!entry || typeof entry !== 'object') continue;
          const label = firstNonEmpty(entry.name, entry.displayName, entry.attributeName, entry.label, entry.code, entry.key);
          if (!targetNames.includes(normalizeAttributeName(label))) continue;
          return firstNonEmpty(entry.value, entry.values, entry.display, entry.text, entry.name);
        }
      } else if (typeof container === 'object') {
        for (const [key, value] of Object.entries(container)) {
          if (targetNames.includes(normalizeAttributeName(key))) return value;
        }
      }
    }

    return '';
  }

  function formatCompoundValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value
        .map((entry) => formatCompoundValue(entry))
        .filter((entry) => !isEmptyExportValue(entry))
        .join('; ');
    }
    if (typeof value === 'object') {
      const displayValue = firstNonEmpty(value.display, value.name, value.label, value.description, value.code, value.value);
      if (!isEmptyExportValue(displayValue)) return formatCompoundValue(displayValue);
      return Object.entries(value)
        .map(([key, entryValue]) => {
          const formatted = formatCompoundValue(entryValue);
          return isEmptyExportValue(formatted) ? '' : `${key}: ${formatted}`;
        })
        .filter(Boolean)
        .join('; ');
    }
    return String(value).trim();
  }

  function formatComposition(value) {
    if (!Array.isArray(value)) return formatCompoundValue(value);
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return formatCompoundValue(entry);
        const description = firstNonEmpty(entry.description, entry.display, entry.name, entry.material, entry.code);
        const percentage = firstNonEmpty(entry.percentage, entry.percent, entry.value);
        if (isEmptyExportValue(description)) return formatCompoundValue(entry);
        if (isEmptyExportValue(percentage)) return formatCompoundValue(description);
        const pctText = String(percentage).includes('%') ? String(percentage) : `${percentage}%`;
        return `${pctText} ${formatCompoundValue(description)}`;
      })
      .filter((entry) => !isEmptyExportValue(entry))
      .join('; ');
  }

  function supplierParts(item) {
    const supplier = item && item.supplier && typeof item.supplier === 'object' ? item.supplier : {};
    const supplierNode = supplier.supplier && typeof supplier.supplier === 'object' ? supplier.supplier : {};
    return { supplier, supplierNode };
  }

  function getMaterialTypeLevel1(item) {
    const directValue = firstNonEmpty(
      item && item.materialTypeLevel1,
      item && item.materialTypeLevelOne,
      getAttributeValue(item, ['MATERIAL TYPE (LEVEL 1)', 'MATERIAL TYPE LEVEL 1'])
    );
    if (!isEmptyExportValue(directValue)) return directValue;

    const materialTypes = Array.isArray(item && item.materialTypes) ? item.materialTypes : [];
    const levelOneType = materialTypes.find((entry) => String(entry && entry.level) === '2')
      || materialTypes[1]
      || materialTypes.find((entry) => String(entry && entry.level) === '1')
      || materialTypes[0];

    return levelOneType ? firstNonEmpty(levelOneType.display, levelOneType.name, levelOneType.code) : '';
  }

  function getMasterWorkbookPath(schema) {
    const schemaKey = schema && schema.key;
    const fileName = (schema && schema.masterWorkbookFilename)
      || MASTER_WORKBOOK_FILENAMES[schemaKey]
      || MASTER_WORKBOOK_FILENAMES.mixed;
    return path.join(state.outputDir, fileName);
  }

  const commonExportGetters = {
    materialId: (item) => firstNonEmpty(item && item.refNum, item && item.materialId, item && item.materialID, item && item.id),
    materialName: (item) => firstNonEmpty(item && item.name, item && item.materialName),
    mtlSuppLifecycleState: (item) => {
      const { supplier } = supplierParts(item);
      return firstNonEmpty(supplier.lifecycleState, item && item.mtlSuppLifecycleState, item && item.lifecycleState, item && item.status);
    },
    materialTypeLevel1: getMaterialTypeLevel1,
    supplierMaterialId: (item) => {
      const { supplier } = supplierParts(item);
      return firstNonEmpty(supplier.supplierMaterialId, item && item.supplierMaterialId);
    },
    supplierCode: (item) => {
      const { supplier, supplierNode } = supplierParts(item);
      return firstNonEmpty(supplierNode.code, supplier.code, item && item.supplierCode);
    },
    supplierName: (item) => {
      const { supplier, supplierNode } = supplierParts(item);
      return firstNonEmpty(supplierNode.display, supplierNode.name, supplier.display, supplier.name, item && item.supplierName);
    },
    supplierMaterialName: (item) => {
      const { supplier } = supplierParts(item);
      return firstNonEmpty(supplier.supplierMaterialName, item && item.supplierMaterialName);
    },
    composition: (item) => formatComposition(firstNonEmpty(
      item && item.composition,
      item && item.legalComposition,
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].composition : '',
      getAttributeValue(item, ['COMPOSITION'])
    )),
    construction: (item) => firstNonEmpty(
      item && item.construction,
      getPathValue(item, 'constructions.general'),
      getPathValue(item, 'constructions.main'),
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].construction : '',
      getAttributeValue(item, ['CONSTRUCTION'])
    ),
    trimType: (item) => firstNonEmpty(
      item && item.trimType,
      item && item.trimTypeName,
      item && item.trimCategory,
      item && item.fabricCategory,
      getAttributeValue(item, ['TRIM TYPE']),
      Array.isArray(item && item.materialTypes) && item.materialTypes[2] ? item.materialTypes[2].display : ''
    ),
    trimComposition: (item) => formatComposition(firstNonEmpty(
      item && item.trimComposition,
      item && item.composition,
      item && item.legalComposition,
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].composition : '',
      getAttributeValue(item, ['TRIM COMPOSITION', 'COMPOSITION'])
    )),
    trimConstruction: (item) => firstNonEmpty(
      item && item.trimConstruction,
      item && item.trimConstructions,
      getPathValue(item, 'constructions.general'),
      getPathValue(item, 'constructions.trim'),
      getPathValue(item, 'constructions.main'),
      item && item.construction,
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].construction : '',
      getAttributeValue(item, ['TRIM CONSTRUCTION', 'CONSTRUCTION'])
    ),
    weight: (item) => firstNonEmpty(
      item && item.weight,
      getPathValue(item, 'measurements.totalWeight'),
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].weight : '',
      getAttributeValue(item, ['WEIGHT'])
    ),
    weightUom: (item) => firstNonEmpty(item && item.weightUOM, item && item.weightUom, getAttributeValue(item, ['WEIGHT UOM'])),
    width: (item) => {
      const { supplier } = supplierParts(item);
      return firstNonEmpty(item && item.width, supplier.width, getAttributeValue(item, ['WIDTH']));
    },
    widthUom: (item) => {
      const { supplier } = supplierParts(item);
      return firstNonEmpty(item && item.widthUOM, item && item.widthUom, supplier.widthUOM, supplier.widthUom, getAttributeValue(item, ['WIDTH UOM']));
    },
    technology: (item) => firstNonEmpty(
      item && item.technology,
      Array.isArray(item && item.layers) && item.layers[0] ? item.layers[0].technology : '',
      item && item.technologies,
      getAttributeValue(item, ['TECHNOLOGY'])
    ),
    hangtags: (item) => firstNonEmpty(item && item.hangtags, item && item.hangTags, getAttributeValue(item, ['HANGTAGS'])),
    developer: (item) => firstNonEmpty(item && item.developer, getAttributeValue(item, ['DEVELOPER'])),
    developerLocation: (item) => firstNonEmpty(item && item.developerLocation, getAttributeValue(item, ['DEVELOPER LOCATION'])),
    managementModel: (item) => firstNonEmpty(item && item.managementModel, getAttributeValue(item, ['MANAGEMENT MODEL'])),
    firstSeason: (item) => firstNonEmpty(item && item.firstSeason, getAttributeValue(item, ['FIRST SEASON']))
  };

  const FABRIC_EXPORT_COLUMNS = [
    { header: 'MATERIAL ID', key: 'materialId', width: 15, get: commonExportGetters.materialId },
    { header: 'MATERIAL NAME', key: 'materialName', width: 34, get: commonExportGetters.materialName },
    { header: 'MTL-SUPP LIFECYCLE STATE', key: 'mtlSuppLifecycleState', width: 20, get: commonExportGetters.mtlSuppLifecycleState },
    { header: 'MATERIAL TYPE (LEVEL 1)', key: 'materialTypeLevel1', width: 22, get: commonExportGetters.materialTypeLevel1 },
    { header: 'SUPPLIER MATERIAL ID', key: 'supplierMaterialId', width: 25, get: commonExportGetters.supplierMaterialId },
    { header: 'SUPPLIER CODE', key: 'supplierCode', width: 15, get: commonExportGetters.supplierCode },
    { header: 'SUPPLIER NAME', key: 'supplierName', width: 30, get: commonExportGetters.supplierName },
    { header: 'COMPOSITION', key: 'composition', width: 42, get: commonExportGetters.composition },
    { header: 'CONSTRUCTION', key: 'construction', width: 24, get: commonExportGetters.construction },
    { header: 'WEIGHT', key: 'weight', width: 11, get: commonExportGetters.weight },
    { header: 'WEIGHT UOM', key: 'weightUom', width: 13, get: commonExportGetters.weightUom },
    { header: 'WIDTH', key: 'width', width: 11, get: commonExportGetters.width },
    { header: 'WIDTH UOM', key: 'widthUom', width: 13, get: commonExportGetters.widthUom },
    { header: 'TECHNOLOGY', key: 'technology', width: 22, get: commonExportGetters.technology },
    { header: 'HANGTAGS', key: 'hangtags', width: 26, get: commonExportGetters.hangtags },
    { header: 'DEVELOPER', key: 'developer', width: 24, get: commonExportGetters.developer },
    { header: 'MANAGEMENT MODEL', key: 'managementModel', width: 20, get: commonExportGetters.managementModel },
    { header: 'FIRST SEASON', key: 'firstSeason', width: 22, get: commonExportGetters.firstSeason }
  ];

  const TRIM_EXPORT_COLUMNS = [
    { header: 'MATERIAL ID', key: 'materialId', width: 15, get: commonExportGetters.materialId },
    { header: 'MATERIAL NAME', key: 'materialName', width: 34, get: commonExportGetters.materialName },
    { header: 'MTL-SUPP LIFECYCLE STATE', key: 'mtlSuppLifecycleState', width: 20, get: commonExportGetters.mtlSuppLifecycleState },
    { header: 'MATERIAL TYPE (LEVEL 1)', key: 'materialTypeLevel1', width: 22, get: commonExportGetters.materialTypeLevel1 },
    { header: 'TRIM TYPE', key: 'trimType', width: 20, get: commonExportGetters.trimType },
    { header: 'SUPPLIER MATERIAL ID', key: 'supplierMaterialId', width: 25, get: commonExportGetters.supplierMaterialId },
    { header: 'SUPPLIER CODE', key: 'supplierCode', width: 15, get: commonExportGetters.supplierCode },
    { header: 'SUPPLIER NAME', key: 'supplierName', width: 30, get: commonExportGetters.supplierName },
    { header: 'SUPPLIER MATERIAL NAME', key: 'supplierMaterialName', width: 34, get: commonExportGetters.supplierMaterialName },
    { header: 'TRIM COMPOSITION', key: 'trimComposition', width: 42, get: commonExportGetters.trimComposition },
    { header: 'TRIM CONSTRUCTION', key: 'trimConstruction', width: 26, get: commonExportGetters.trimConstruction },
    { header: 'WEIGHT', key: 'weight', width: 11, get: commonExportGetters.weight },
    { header: 'WEIGHT UOM', key: 'weightUom', width: 13, get: commonExportGetters.weightUom },
    { header: 'HANGTAGS', key: 'hangtags', width: 26, get: commonExportGetters.hangtags },
    { header: 'DEVELOPER', key: 'developer', width: 24, get: commonExportGetters.developer },
    { header: 'DEVELOPER LOCATION', key: 'developerLocation', width: 20, get: commonExportGetters.developerLocation },
    { header: 'MANAGEMENT MODEL', key: 'managementModel', width: 20, get: commonExportGetters.managementModel },
    { header: 'FIRST SEASON', key: 'firstSeason', width: 22, get: commonExportGetters.firstSeason }
  ];

  const EXPORT_SCHEMAS = {
    fabric: {
      key: 'fabric',
      label: 'Fabric',
      sheetName: 'Fabric',
      fileSuffix: 'fabric',
      masterWorkbookFilename: MASTER_WORKBOOK_FILENAMES.fabric,
      columns: FABRIC_EXPORT_COLUMNS
    },
    trim: {
      key: 'trim',
      label: 'Trim',
      sheetName: 'Trim',
      fileSuffix: 'trim',
      masterWorkbookFilename: MASTER_WORKBOOK_FILENAMES.trim,
      columns: TRIM_EXPORT_COLUMNS
    }
  };
  const DEFAULT_EXPORT_SCHEMA = EXPORT_SCHEMAS.fabric;

  const CENTER_ALIGNED_EXPORT_KEYS = new Set([
    'mtlSuppLifecycleState',
    'materialTypeLevel1',
    'trimType',
    'supplierCode',
    'weight',
    'weightUom',
    'width',
    'widthUom',
    'developerLocation',
    'managementModel'
  ]);
  const NUMERIC_EXPORT_KEYS = new Set(['weight', 'width']);
  const BODY_BORDER_COLOR = 'FFE5E7EB';
  const BODY_ALT_FILL_COLOR = 'FFF8FAFC';

  function normalizeCellValueForColumn(column, value) {
    const formatted = formatCompoundValue(value);
    if (NUMERIC_EXPORT_KEYS.has(column.key) && !isEmptyExportValue(formatted)) {
      const numericValue = Number(String(formatted).replace(/,/g, ''));
      if (Number.isFinite(numericValue)) return numericValue;
    }
    return isEmptyExportValue(formatted) ? '' : String(formatted);
  }

  function getExportSchemaForItem(item) {
    const materialType = formatCompoundValue(getMaterialTypeLevel1(item)).toLowerCase();
    return materialType.includes('trim') ? EXPORT_SCHEMAS.trim : DEFAULT_EXPORT_SCHEMA;
  }

  function groupItemsByExportSchema(items) {
    const grouped = new Map();
    for (const item of items) {
      const schema = getExportSchemaForItem(item);
      if (!grouped.has(schema.key)) {
        grouped.set(schema.key, { schema, items: [] });
      }
      grouped.get(schema.key).items.push(item);
    }
    return Array.from(grouped.values());
  }

  function itemToExportRow(item, columns) {
    const row = {};
    for (const column of columns) {
      row[column.key] = normalizeCellValueForColumn(column, column.get(item || {}));
    }
    return row;
  }

  function comparableCellText(value) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value
        .map((entry) => comparableCellText(entry))
        .filter(Boolean)
        .join('; ');
    }
    if (typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'result')) return comparableCellText(value.result);
      if (Array.isArray(value.richText)) {
        return value.richText
          .map((entry) => comparableCellText(entry && entry.text))
          .filter(Boolean)
          .join('');
      }
      if (Object.prototype.hasOwnProperty.call(value, 'text')) return comparableCellText(value.text);
      return comparableCellText(formatCompoundValue(value));
    }
    return String(value).trim();
  }

  function normalizeComparableValue(value) {
    return comparableCellText(value).replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function getRowIdentityKey(rowData) {
    const supplierMaterialId = normalizeComparableValue(rowData.supplierMaterialId);
    if (supplierMaterialId) return `supplier-material:${supplierMaterialId}`;

    const materialId = normalizeComparableValue(rowData.materialId);
    const supplierCode = normalizeComparableValue(rowData.supplierCode);
    if (materialId && supplierCode) return `material-supplier:${materialId}|${supplierCode}`;

    return '';
  }

  function getRowFingerprint(rowData, columns) {
    return columns
      .map((column) => `${column.key}=${normalizeComparableValue(rowData[column.key])}`)
      .join('\u001F');
  }

  function worksheetRowToData(row, columns) {
    const rowData = {};
    columns.forEach((column, index) => {
      rowData[column.key] = row.getCell(index + 1).value;
    });
    return rowData;
  }

  function collectExistingWorkbookRows(worksheet, columns) {
    const exactFingerprints = new Set();
    const fingerprintsByIdentity = new Map();

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = worksheetRowToData(row, columns);
      const fingerprint = getRowFingerprint(rowData, columns);
      const identityKey = getRowIdentityKey(rowData);

      exactFingerprints.add(fingerprint);
      if (identityKey) {
        if (!fingerprintsByIdentity.has(identityKey)) fingerprintsByIdentity.set(identityKey, new Set());
        fingerprintsByIdentity.get(identityKey).add(fingerprint);
      }
    });

    return { exactFingerprints, fingerprintsByIdentity };
  }

  function itemToCsvRow(item, columns) {
    const row = itemToExportRow(item, columns);
    return columns.map((column) => row[column.key]);
  }

  function buildCsv(items, schema) {
    const columns = schema.columns;
    const headers = columns.map((column) => column.header);
    const lines = [headers.map(csvEscape).join(',')];
    for (const item of items) {
      lines.push(itemToCsvRow(item, columns).map(csvEscape).join(','));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  function getBatchBaseName(schema, batchNumberText, stamp, count) {
    return `adidas_materials_${schema.fileSuffix}_batch_${batchNumberText}_${stamp}_${count}`;
  }

  function applyHeaderStyle(worksheet) {
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF111827' } },
        left: { style: 'thin', color: { argb: 'FF374151' } },
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } },
        right: { style: 'thin', color: { argb: 'FF374151' } }
      };
    });
  }

  function estimateRowHeight(rowData, columns) {
    const wrappedUnits = columns.reduce((max, column) => {
      const value = rowData && rowData[column.key] !== undefined ? rowData[column.key] : '';
      const text = String(value || '');
      if (!text) return max;
      const explicitLines = text.split(/\r\n|\r|\n/).length;
      const width = Math.max(8, column.width || 12);
      return Math.max(max, explicitLines, Math.ceil(text.length / Math.max(12, width * 1.1)));
    }, 1);

    if (wrappedUnits >= 4) return 48;
    if (wrappedUnits === 3) return 38;
    if (wrappedUnits === 2) return 30;
    return 22;
  }

  function applyBodyStyle(row, rowData, columns) {
    row.height = estimateRowHeight(rowData, columns);
    for (let index = 1; index <= columns.length; index += 1) {
      const column = columns[index - 1];
      const cell = row.getCell(index);
      const horizontal = CENTER_ALIGNED_EXPORT_KEYS.has(column.key) ? 'center' : 'left';
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'middle', horizontal, wrapText: true };
      cell.numFmt = NUMERIC_EXPORT_KEYS.has(column.key) ? '0.##' : '@';
      if (row.number % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BODY_ALT_FILL_COLOR } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: BODY_BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BODY_BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BODY_BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BODY_BORDER_COLOR } }
      };
    }
  }

  function ensureWorksheetLayout(worksheet, columns) {
    worksheet.properties.defaultRowHeight = 22;
    worksheet.properties.defaultColWidth = 14;
    worksheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
      style: {
        font: { name: 'Calibri', size: 10 },
        numFmt: NUMERIC_EXPORT_KEYS.has(column.key) ? '0.##' : '@'
      }
    }));
    worksheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length }
    };
    applyHeaderStyle(worksheet);
  }

  function applyExistingBodyStylesIfNeeded(worksheet, columns) {
    if (worksheet.rowCount <= 1 || worksheet.getRow(2).height) return;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = {};
      columns.forEach((column, index) => {
        rowData[column.key] = row.getCell(index + 1).value;
      });
      applyBodyStyle(row, rowData, columns);
    });
  }

  function getWorksheetForSchema(workbook, schema) {
    if (schema.key === 'fabric' && !workbook.getWorksheet(schema.sheetName)) {
      const legacyWorksheet = workbook.getWorksheet('Materials');
      if (legacyWorksheet) {
        legacyWorksheet.name = schema.sheetName;
        return legacyWorksheet;
      }
    }
    return workbook.getWorksheet(schema.sheetName) || workbook.addWorksheet(schema.sheetName);
  }

  async function appendItemsToWorkbook(items, schema) {
    const workbookPath = getMasterWorkbookPath(schema);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TMS adidas materials collector';
    workbook.modified = new Date();

    if (fs.existsSync(workbookPath)) {
      await workbook.xlsx.readFile(workbookPath);
    }

    const worksheet = getWorksheetForSchema(workbook, schema);
    ensureWorksheetLayout(worksheet, schema.columns);
    applyExistingBodyStylesIfNeeded(worksheet, schema.columns);

    let appended = 0;
    let exactDuplicates = 0;
    let changedExisting = 0;
    const existingRows = collectExistingWorkbookRows(worksheet, schema.columns);

    for (const item of items) {
      const rowData = itemToExportRow(item, schema.columns);
      const identityKey = getRowIdentityKey(rowData);
      const fingerprint = getRowFingerprint(rowData, schema.columns);
      const identityFingerprints = identityKey ? existingRows.fingerprintsByIdentity.get(identityKey) : null;

      if (identityFingerprints && identityFingerprints.has(fingerprint)) {
        exactDuplicates += 1;
        continue;
      }

      if (!identityKey && existingRows.exactFingerprints.has(fingerprint)) {
        exactDuplicates += 1;
        continue;
      }

      if (identityFingerprints) {
        changedExisting += 1;
        continue;
      }

      const row = worksheet.addRow(rowData);
      applyBodyStyle(row, rowData, schema.columns);
      existingRows.exactFingerprints.add(fingerprint);
      if (identityKey) {
        if (!existingRows.fingerprintsByIdentity.has(identityKey)) {
          existingRows.fingerprintsByIdentity.set(identityKey, new Set());
        }
        existingRows.fingerprintsByIdentity.get(identityKey).add(fingerprint);
      }
      appended += 1;
    }

    await workbook.xlsx.writeFile(workbookPath);
    return { workbookPath, appended, exactDuplicates, changedExisting };
  }

  async function appendBatchToWorkbooks(items) {
    let appended = 0;
    let exactDuplicates = 0;
    let changedExisting = 0;
    const appendedByType = {};
    const skippedByType = {};
    const xlsxPaths = {};

    for (const group of groupItemsByExportSchema(items)) {
      const result = await appendItemsToWorkbook(group.items, group.schema);
      xlsxPaths[group.schema.key] = result.workbookPath;
      appendedByType[group.schema.label] = (appendedByType[group.schema.label] || 0) + result.appended;
      skippedByType[group.schema.label] = (skippedByType[group.schema.label] || 0)
        + result.exactDuplicates
        + result.changedExisting;
      appended += result.appended;
      exactDuplicates += result.exactDuplicates;
      changedExisting += result.changedExisting;
    }

    return {
      xlsxPath: Object.values(xlsxPaths)[0] || getMasterWorkbookPath(),
      xlsxPaths,
      excelAppended: appended,
      excelAppendedByType: appendedByType,
      excelSkipped: exactDuplicates + changedExisting,
      excelExactDuplicates: exactDuplicates,
      excelChangedExisting: changedExisting,
      excelSkippedByType: skippedByType
    };
  }

  async function saveCurrentBatch(reason) {
    if (state.isSaving) {
      appendLog('warn', '正在保存上一批数据，请稍后再试');
      return null;
    }

    if (state.currentBatch.length === 0) {
      appendLog('info', '当前批次没有可保存的数据');
      return null;
    }

    state.isSaving = true;
    publishState();

    try {
    ensureOutputDir();
    const batchNumber = state.batchNumber;
    const batchNumberText = String(batchNumber).padStart(3, '0');
    const stamp = timestampForFile();
    const count = state.currentBatch.length;
    const batchItems = state.currentBatch.slice();
    const groupedBatchItems = groupItemsByExportSchema(batchItems);
    const jsonPaths = {};
    const csvPaths = {};
    const saved = {
      jsonPath: '',
      jsonPaths,
      csvPath: '',
      csvPaths,
      xlsxPath: groupedBatchItems[0] ? getMasterWorkbookPath(groupedBatchItems[0].schema) : '',
      xlsxPaths: {},
      count,
      reason,
      savedAt: new Date().toISOString()
    };

    for (const group of groupedBatchItems) {
      const typedBaseName = getBatchBaseName(group.schema, batchNumberText, stamp, group.items.length);
      const typedJsonPath = path.join(state.outputDir, `${typedBaseName}.json`);
      const typedCsvPath = path.join(state.outputDir, `${typedBaseName}.csv`);
      fs.writeFileSync(typedJsonPath, JSON.stringify({ _embedded: { items: group.items } }, null, 2), 'utf8');
      fs.writeFileSync(typedCsvPath, buildCsv(group.items, group.schema), 'utf8');
      jsonPaths[group.schema.key] = typedJsonPath;
      csvPaths[group.schema.key] = typedCsvPath;
      if (!saved.jsonPath) saved.jsonPath = typedJsonPath;
      if (!saved.csvPath) saved.csvPath = typedCsvPath;
    }
    state.currentBatch = [];
    state.batchNumber += 1;
    persistStateNow();

    try {
      Object.assign(saved, await appendBatchToWorkbooks(batchItems));
      const typeSummary = saved.excelAppendedByType
        ? Object.entries(saved.excelAppendedByType).map(([type, value]) => `${type} ${value}`).join('，')
        : '';
      const skippedSummary = saved.excelSkipped > 0
        ? `；总表已跳过 ${saved.excelSkipped} 条（完全重复 ${saved.excelExactDuplicates} 条，已有ID但内容不同 ${saved.excelChangedExisting} 条）`
        : '';
      appendLog('success', `Excel已追加 ${saved.excelAppended} 条${typeSummary ? `（${typeSummary}）` : ''}${skippedSummary}`);
    } catch (error) {
      saved.excelError = error.message;
      appendLog('error', `Excel追加失败：${error.message}`);
    }

    state.recentFiles.unshift(saved);
    state.recentFiles = state.recentFiles.slice(0, 20);
    persistStateNow();
    appendLog('success', `已保存第 ${batchNumber} 批：${count} 条，CSV已按材料类型列生成`);
    sendStateToWindow();

    return saved;
    } finally {
      state.isSaving = false;
      publishState();
    }
  }

  async function handleResponseBody(requestId) {
    if (!collectorWindow || collectorWindow.isDestroyed()) return;
    const requestInfo = requestMap.get(requestId);
    requestMap.delete(requestId);

    if (!requestInfo || !isMaterialResponseUrl(requestInfo.url)) return;

    try {
      const responseBody = await collectorWindow.webContents.debugger.sendCommand('Network.getResponseBody', { requestId });
      const rawBody = responseBody.base64Encoded
        ? Buffer.from(responseBody.body, 'base64').toString('utf8')
        : responseBody.body;
      const body = String(rawBody || '').trim();

      if (!body || !/^[{\[]/.test(body)) return;
      await processPayload(JSON.parse(body), requestInfo.url);
    } catch (error) {
      if (!/No resource with given identifier found/i.test(error.message)) {
        appendLog('warn', `读取接口响应失败: ${error.message}`);
      }
    }
  }

  function attachNetworkCapture(win) {
    const webContents = win.webContents;

    try {
      webContents.debugger.attach('1.3');
      webContents.debugger.sendCommand('Network.enable')
        .then(() => {
          webContents.debugger.sendCommand('Network.setBlockedURLs', { urls: BLOCKED_BROWSER_RESOURCE_URLS }).catch(() => {});
          state.captureReady = true;
          appendLog('success', '接口捕获已启用');
        })
        .catch((error) => {
          state.captureReady = false;
          appendLog('error', `接口捕获启用失败: ${error.message}`);
        });
    } catch (error) {
      state.captureReady = false;
      appendLog('error', `接口捕获启用失败: ${error.message}`);
      return;
    }

    webContents.debugger.on('message', (_event, method, params) => {
      try {
        if (method === 'Network.responseReceived') {
          const url = params && params.response && params.response.url;
          const resourceType = params && params.type;
          if (isMaterialResponseUrl(url) && (!resourceType || resourceType === 'Fetch' || resourceType === 'XHR')) {
            requestMap.set(params.requestId, {
              url,
              mimeType: params.response.mimeType || '',
              status: params.response.status,
              resourceType
            });
          }
        }

        if (method === 'Network.loadingFinished') {
          handleResponseBody(params.requestId);
        }
      } catch (error) {
        appendLog('warn', `处理网络事件失败: ${error.message}`);
      }
    });

    webContents.debugger.on('detach', (_event, reason) => {
      state.captureReady = false;
      appendLog('warn', `接口捕获已断开: ${reason}`);
      publishState();
    });
  }

  function cleanupWindow() {
    if (collectorWindow && !collectorWindow.isDestroyed() && collectorWindow.webContents.debugger.isAttached()) {
      try {
        collectorWindow.webContents.debugger.detach();
      } catch (_error) {
        // Ignore detach errors during shutdown.
      }
    }
    collectorWindow = null;
    requestMap = new Map();
    state.captureReady = false;
    schedulePersist();
  }

  function buildExternalPanelScript() {
    const preloadPath = path.join(__dirname, 'adidas-materials-preload.js');
    const preloadSource = fs
      .readFileSync(preloadPath, 'utf8')
      .replace("const { ipcRenderer } = require('electron');", '');

    return `(function() {
  if (window.__admExternalPreloadInstalled) return;
  window.__admExternalPreloadInstalled = true;

  var __admNextRequestId = 1;
  var __admPendingRequests = {};

  window.__admResolve = function(requestId, result) {
    var pending = __admPendingRequests[requestId];
    if (!pending) return;
    delete __admPendingRequests[requestId];
    if (result && result.__error) {
      pending.reject(new Error(result.__error));
    } else {
      pending.resolve(result);
    }
  };

  window.__admReceiveState = function(state) {
    window.dispatchEvent(new CustomEvent('__adidasMaterialsState', { detail: state }));
  };

  const ipcRenderer = {
    invoke: function(channel) {
      var args = Array.prototype.slice.call(arguments, 1);
      var requestId = String(__admNextRequestId++);
      return new Promise(function(resolve, reject) {
        __admPendingRequests[requestId] = { resolve: resolve, reject: reject };
        window.__adidasMaterialsCollector(JSON.stringify({
          requestId: requestId,
          channel: channel,
          args: args
        }));
        setTimeout(function() {
          if (!__admPendingRequests[requestId]) return;
          delete __admPendingRequests[requestId];
          reject(new Error('外部浏览器通信超时'));
        }, 30000);
      });
    },
    on: function(channel, handler) {
      if (channel !== 'adidas-materials:state') return;
      window.addEventListener('__adidasMaterialsState', function(event) {
        handler(null, event.detail);
      });
    }
  };

${preloadSource}
})();`;
  }

  function getBrowserCandidates() {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';

    return [
      { name: 'Microsoft Edge', path: path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { name: 'Microsoft Edge', path: path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { name: 'Microsoft Edge', path: path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { name: 'Google Chrome', path: path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { name: 'Google Chrome', path: path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { name: 'Google Chrome', path: path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') }
    ];
  }

  function findBrowserExecutable() {
    return getBrowserCandidates().find((candidate) => fs.existsSync(candidate.path));
  }

  function getFreePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
  }

  function readJsonFromDebugEndpoint(port, endpoint) {
    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: endpoint,
        timeout: 5000
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('Debug endpoint timeout'));
      });
    });
  }

  async function waitForDebugEndpoint(port) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      try {
        await readJsonFromDebugEndpoint(port, '/json/version');
        return;
      } catch (_error) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    throw new Error('外部浏览器调试端口启动超时');
  }

  async function handleExternalResponseBody(client, requestId) {
    const requestKey = `${client.target.id}:${requestId}`;
    const requestInfo = requestMap.get(requestKey);
    requestMap.delete(requestKey);

    if (!requestInfo || !isMaterialResponseUrl(requestInfo.url)) return;

    try {
      const responseBody = await client.send('Network.getResponseBody', { requestId });
      const rawBody = responseBody.base64Encoded
        ? Buffer.from(responseBody.body, 'base64').toString('utf8')
        : responseBody.body;
      const body = String(rawBody || '').trim();

      if (!body || !/^[{\[]/.test(body)) return;
      await processPayload(JSON.parse(body), requestInfo.url);
    } catch (error) {
      if (!/No resource with given identifier found/i.test(error.message)) {
        appendLog('warn', `读取外部浏览器接口响应失败: ${error.message}`);
      }
    }
  }

  async function handleExternalPanelCommand(client, payloadText) {
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (error) {
      appendLog('warn', `面板消息解析失败: ${error.message}`);
      return;
    }

    const requestId = payload.requestId;
    const channel = payload.channel;
    const args = Array.isArray(payload.args) ? payload.args : [];

    async function respond(result) {
      const resultJson = JSON.stringify(result);
      await client.send('Runtime.evaluate', {
        expression: `window.__admResolve && window.__admResolve(${JSON.stringify(requestId)}, ${resultJson});`,
        awaitPromise: false
      }).catch(() => {});
    }

    try {
      if (channel === 'adidas-materials:get-state') {
        await respond(publicState());
        return;
      }

      if (channel === 'adidas-materials:flush-batch') {
        const saved = await saveCurrentBatch('manual');
        await respond({ success: true, saved, state: publicState() });
        return;
      }

      if (channel === 'adidas-materials:open-output-dir') {
        ensureOutputDir();
        const errorMessage = await shell.openPath(state.outputDir);
        await respond({ success: !errorMessage, error: errorMessage || undefined });
        return;
      }

      if (channel === 'adidas-materials:update-settings') {
        const settings = args[0];
        if (settings && Number.isFinite(settings.batchSize) && settings.batchSize > 0) {
          state.batchSize = Math.max(100, Math.min(20000, Math.floor(settings.batchSize)));
          persistStateNow();
          appendLog('success', `批次大小已设置为 ${state.batchSize}`);
        }
        await respond({ success: true, state: publicState() });
        return;
      }

      if (channel === 'adidas-materials:clear-state') {
        state.collectedIds.clear();
        state.currentBatch = [];
        state.totalCollected = 0;
        state.batchNumber = 1;
        state.capturedPageKeys.clear();
        state.pagesCaptured = 0;
        state.lastDataAt = 0;
        state.lastPageItemCount = 0;
        state.lastNewItemCount = 0;
        state.lastDuplicateCount = 0;
        state.lastSourceUrl = '';
        state.lastError = '';
        persistStateNow();
        appendLog('success', '采集状态已清空，已保存的批次文件不会删除');
        await respond({ success: true, state: publicState() });
        return;
      }

      if (channel === 'adidas-materials:select-output-dir') {
        const parent = getParentWindow && getParentWindow();
        const result = await dialog.showOpenDialog(parent || undefined, {
          title: '选择材料数据保存目录',
          defaultPath: state.outputDir,
          properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
          await respond({ success: false, canceled: true, state: publicState() });
          return;
        }

        state.outputDir = result.filePaths[0];
        persistStateNow();
        appendLog('success', `保存目录已更新: ${state.outputDir}`);
        await respond({ success: true, state: publicState() });
        return;
      }

      await respond({ success: false, error: `Unsupported channel: ${channel}` });
    } catch (error) {
      await respond({ success: false, __error: error.message });
    }
  }

  async function attachExternalPageTarget(target) {
    if (!target.id || !target.webSocketDebuggerUrl || externalPageClients.has(target.id)) return;

    const client = new CdpClient(target);
    await client.connect();
    client.target = target;
    externalPageClients.set(target.id, client);

    client.on('Network.responseReceived', (params) => {
      const url = params && params.response && params.response.url;
      const resourceType = params && params.type;
      if (isMaterialResponseUrl(url) && (!resourceType || resourceType === 'Fetch' || resourceType === 'XHR')) {
        requestMap.set(`${target.id}:${params.requestId}`, {
          url,
          mimeType: params.response.mimeType || '',
          status: params.response.status,
          resourceType
        });
      }
    });

    client.on('Network.loadingFinished', (params) => {
      handleExternalResponseBody(client, params.requestId);
    });

    client.on('Runtime.bindingCalled', (params) => {
      handleExternalPanelCommand(client, params.payload);
    });

    client.on('Page.loadEventFired', () => {
      client.send('Runtime.evaluate', {
        expression: buildExternalPanelScript(),
        awaitPromise: false
      }).then(() => broadcastExternalState()).catch(() => {});
    });

    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Network.setBlockedURLs', { urls: BLOCKED_BROWSER_RESOURCE_URLS }).catch(() => {});
    await client.send('Runtime.addBinding', { name: '__adidasMaterialsCollector' }).catch(() => {});
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: buildExternalPanelScript() });
    await client.send('Runtime.evaluate', {
      expression: buildExternalPanelScript(),
      awaitPromise: false
    });

    appendLog('success', `已连接外部浏览器页面: ${target.title || target.url || target.id}`);
    publishState();
  }

  async function pollExternalTargets() {
    if (!externalBrowser) return;

    try {
      const targets = await readJsonFromDebugEndpoint(externalBrowser.port, '/json');
      const pageTargets = Array.isArray(targets)
        ? targets.filter((target) => target.type === 'page' && target.webSocketDebuggerUrl)
        : [];
      const activeIds = new Set(pageTargets.map((target) => target.id));

      for (const target of pageTargets) {
        attachExternalPageTarget(target).catch((error) => {
          appendLog('warn', `连接外部浏览器页面失败: ${error.message}`);
        });
      }

      for (const [targetId, client] of externalPageClients.entries()) {
        if (!activeIds.has(targetId) || client.closed) {
          client.close();
          externalPageClients.delete(targetId);
        }
      }

      state.captureReady = externalPageClients.size > 0;
      publishState();
    } catch (error) {
      appendLog('warn', `检查外部浏览器页面失败: ${error.message}`);
    }
  }

  function startExternalPolling() {
    if (externalPollTimer) clearInterval(externalPollTimer);
    externalPollTimer = setInterval(() => {
      pollExternalTargets();
    }, 1500);
    pollExternalTargets();
  }

  function cleanupExternalBrowser(options = {}) {
    if (externalPollTimer) {
      clearInterval(externalPollTimer);
      externalPollTimer = null;
    }

    for (const client of externalPageClients.values()) {
      client.close();
    }
    externalPageClients.clear();

    if (options.killProcess && externalBrowser && externalBrowser.process && !externalBrowser.process.killed) {
      try {
        externalBrowser.process.kill();
      } catch (_error) {
        // Browser may already be closed.
      }
    }

    externalBrowser = null;
    state.captureReady = false;
    publishState();
  }

  async function launchExternalBrowserCollector() {
    if (externalBrowser) {
      startExternalPolling();
      return { success: true, alreadyOpen: true, mode: 'external-browser' };
    }

    const browser = findBrowserExecutable();
    if (!browser) {
      return { success: false, error: '未找到 Microsoft Edge 或 Google Chrome' };
    }

    ensureRuntimeDir();
    const port = await getFreePort();
    const profileDir = path.join(runtimeDir, 'external-browser-profile');
    fs.mkdirSync(profileDir, { recursive: true });

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--new-window',
      startPageDataUrl()
    ];

    const child = spawn(browser.path, args, {
      detached: false,
      stdio: 'ignore'
    });

    child.on('exit', () => {
      appendLog('warn', '外部浏览器已关闭');
      cleanupExternalBrowser();
    });

    externalBrowser = {
      process: child,
      port,
      profileDir,
      name: browser.name,
      executablePath: browser.path
    };

    try {
      await waitForDebugEndpoint(port);
      appendLog('success', `${browser.name} 已以采集模式打开`);
      startExternalPolling();
      return { success: true, mode: 'external-browser', browser: browser.name, port, profileDir };
    } catch (error) {
      cleanupExternalBrowser({ killProcess: true });
      return { success: false, error: error.message };
    }
  }

  async function launchCollectorWindow() {
    return launchExternalBrowserCollector();

    if (collectorWindow && !collectorWindow.isDestroyed()) {
      collectorWindow.show();
      collectorWindow.focus();
      return { success: true, alreadyOpen: true };
    }

    const preloadPath = path.join(__dirname, 'adidas-materials-preload.js');
    collectorWindow = new BrowserWindow({
      width: 1500,
      height: 960,
      minWidth: 1180,
      minHeight: 760,
      title: 'adidas 外部浏览器采集器',
      parent: typeof getParentWindow === 'function' ? getParentWindow() || undefined : undefined,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: 'persist:adidas-materials-acp'
      }
    });

    attachNetworkCapture(collectorWindow);
    collectorWindow.webContents.setUserAgent(STANDARD_BROWSER_USER_AGENT);

    collectorWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        collectorWindow.loadURL(url);
      }
      return { action: 'deny' };
    });

    collectorWindow.webContents.on('did-finish-load', () => {
      publishState();
    });

    collectorWindow.webContents.on('render-process-gone', (_event, details) => {
      appendLog('error', `采集窗口渲染进程异常退出: ${details.reason}`);
    });

    collectorWindow.webContents.on('unresponsive', () => {
      appendLog('warn', '采集窗口暂时无响应，请等待页面恢复');
    });

    collectorWindow.on('closed', cleanupWindow);

    try {
      await collectorWindow.loadURL(startPageDataUrl());
      return { success: true };
    } catch (error) {
      appendLog('error', `打开采集起始页失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async function launchCollectorSafely() {
    try {
      return await launchCollectorWindow();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  ipcMain.handle('launch-adidas-material-collector', launchCollectorSafely);

  ipcMain.handle('adidas-materials:get-state', () => publicState());

  ipcMain.handle('adidas-materials:select-output-dir', async () => {
    const parent = collectorWindow && !collectorWindow.isDestroyed() ? collectorWindow : getParentWindow && getParentWindow();
    const result = await dialog.showOpenDialog(parent || undefined, {
      title: '选择材料数据保存目录',
      defaultPath: state.outputDir,
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true, state: publicState() };
    }

    state.outputDir = result.filePaths[0];
    persistStateNow();
    appendLog('success', `保存目录已更新: ${state.outputDir}`);
    return { success: true, state: publicState() };
  });

  ipcMain.handle('adidas-materials:flush-batch', async () => {
    try {
      const saved = await saveCurrentBatch('manual');
      return { success: true, saved, state: publicState() };
    } catch (error) {
      appendLog('error', `保存当前批次失败: ${error.message}`);
      return { success: false, error: error.message, state: publicState() };
    }
  });

  ipcMain.handle('adidas-materials:open-output-dir', async () => {
    try {
      ensureOutputDir();
      const errorMessage = await shell.openPath(state.outputDir);
      return { success: !errorMessage, error: errorMessage || undefined };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('adidas-materials:update-settings', (_event, settings) => {
    if (settings && Number.isFinite(settings.batchSize) && settings.batchSize > 0) {
      state.batchSize = Math.max(100, Math.min(20000, Math.floor(settings.batchSize)));
      persistStateNow();
      appendLog('success', `批次大小已设置为 ${state.batchSize}`);
    }
    return { success: true, state: publicState() };
  });

  ipcMain.handle('adidas-materials:clear-state', () => {
    state.collectedIds.clear();
    state.currentBatch = [];
    state.totalCollected = 0;
    state.batchNumber = 1;
    state.capturedPageKeys.clear();
    state.pagesCaptured = 0;
    state.lastDataAt = 0;
    state.lastPageItemCount = 0;
    state.lastNewItemCount = 0;
    state.lastDuplicateCount = 0;
    state.lastSourceUrl = '';
    state.lastError = '';
    persistStateNow();
    appendLog('success', '采集状态已清空，已保存的批次文件不会删除');
    return { success: true, state: publicState() };
  });

  app.on('before-quit', () => {
    try {
      persistStateNow();
      cleanupExternalBrowser({ killProcess: true });
    } catch (_error) {
      // The app is quitting; keep shutdown deterministic.
    }
  });

  return {
    launchCollector: launchCollectorSafely
  };
}

module.exports = {
  registerAdidasMaterialsCollector
};
