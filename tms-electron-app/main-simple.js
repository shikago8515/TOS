const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { registerAdidasMaterialsCollector } = require('./adidas-materials-main');
const automationLauncherCore = loadAutomationLauncherCore();
const { normalizeAllowedExternalUrl } = require('./external-url-allowlist');
const {
  describeBackendCompatibilityFailure,
  evaluateBackendCompatibility,
  requiredBackendOpenapiPaths,
  selectBackendPortCandidates
} = require('./backend-compatibility');

let mainWindow;
let backendProcess = null;
const automationAppProcesses = new Map();
let automationLauncherProcess = null;
let automationLauncherStartPromise = null;
let protocolCommandQueue = [];
let protocolQueueBusy = false;
const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 8000;
const BACKEND_PORT_CANDIDATES = [8000, 8001, 8002, 8003, 8004, 8005];
const REQUIRED_BACKEND_OPENAPI_PATHS = requiredBackendOpenapiPaths;
const REMOTE_BACKEND_URL = normalizeBackendBaseUrl(
  process.env.TOS_REMOTE_BACKEND_URL || process.env.VITE_BACKEND_URL || 'https://ai.tomwell.net:56130/tos/desktop-api'
);
const USE_REMOTE_BACKEND = process.env.TOS_DESKTOP_BACKEND_MODE === 'remote';
let activeBackendPort = BACKEND_PORT;
let activeBackendUrl = USE_REMOTE_BACKEND ? REMOTE_BACKEND_URL : buildBackendUrl(BACKEND_PORT);
const APP_DISPLAY_NAME = 'TOS'/*12345678*/;
const AUTOMATION_LAUNCHER_HOST = '127.0.0.1';
const AUTOMATION_LAUNCHER_PORT = 3210;
const AUTOMATION_LAUNCHER_URL = `http://${AUTOMATION_LAUNCHER_HOST}:${AUTOMATION_LAUNCHER_PORT}`;
const AUTOMATION_PROTOCOL = 'tos';
const AUTOMATION_LAUNCHER_BACKGROUND_FLAG = '--automation-launcher-background';
const DEFAULT_INSTALLER_MANIFEST_URL = process.env.TOS_INSTALLER_MANIFEST_URL
  || 'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/installer-versions';
const DEFAULT_UPDATE_FEED_URL = process.env.TOS_UPDATE_FEED_URL || process.env.TMS_UPDATE_FEED_URL || '';
const UPDATE_SOURCE_CONFIG_FILE = 'update-source.json';
const UPDATE_STATUS_CHANNEL = 'update-status';
const MANUAL_DOWNLOADS_FILE = 'manual-downloads.json';
const AUTOMATION_HELPER_VERSION_FILE = 'automation-helper-version.json';

function loadAutomationLauncherCore() {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'automation-launcher', 'core.js') : '',
    path.join(__dirname, 'automation-launcher', 'core.js'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  const searchedPaths = candidates.join(', ');
  throw new Error(`Cannot find automation launcher core. Searched: ${searchedPaths}`);
}

const externalModules = {
  infornexus: {
    name: 'Infornexus',
    description: 'External Electron sub-application for the Infornexus workflow',
    executable: 'electron-app.exe'
  }
};

const DIAGNOSTIC_SECRET_KEY_PATTERN = /password|token|cookie|secret|authorization|credential/i;
const DIAGNOSTIC_MAX_STRING_LENGTH = 4000;
const DIAGNOSTIC_MAX_ARRAY_LENGTH = 100;
const DIAGNOSTIC_MAX_FILE_SIZE = 25 * 1024 * 1024;

let updaterConfigured = false;
let updateFeedUrl = '';
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  feedUrl: DEFAULT_UPDATE_FEED_URL,
  feedUrlSource: 'package',
  updateAvailable: false,
  checking: false,
  downloading: false,
  downloaded: false,
  updateInfo: null,
  manualDownload: null,
  changelog: null,
  progress: null,
  error: null
};

function normalizeUpdateFeedUrl(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function readConfiguredUpdateFeed() {
  const envUrl = normalizeUpdateFeedUrl(process.env.TOS_UPDATE_FEED_URL || process.env.TMS_UPDATE_FEED_URL);
  if (envUrl) {
    return { url: envUrl, source: 'env' };
  }

  try {
    const configPath = path.join(app.getPath('userData'), UPDATE_SOURCE_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      const payload = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const fileUrl = normalizeUpdateFeedUrl(payload && payload.url);
      if (fileUrl) {
        return { url: fileUrl, source: 'user-config' };
      }
    }
  } catch (error) {
    writeDiagnosticEvent('updater', 'feed-config-read-failure', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    url: normalizeUpdateFeedUrl(DEFAULT_UPDATE_FEED_URL),
    source: DEFAULT_UPDATE_FEED_URL ? 'package' : 'not-configured'
  };
}

function isPlaceholderUpdateFeedUrl(url) {
  return /your-server\.example\.com/i.test(url);
}

function resolveInstallerPackageDownloadUrl(downloadPath) {
  const rawPath = typeof downloadPath === 'string' ? downloadPath.trim() : '';
  if (!rawPath) return '';

  try {
    if (/^https?:\/\//i.test(rawPath)) {
      return new URL(rawPath).toString();
    }

    const manifestUrl = new URL(DEFAULT_INSTALLER_MANIFEST_URL);
    if (rawPath.startsWith('/api/')) {
      const backendPrefix = manifestUrl.pathname.includes('/tos/desktop-api/')
        ? '/tos/desktop-api'
        : '';
      return `${manifestUrl.origin}${backendPrefix}${rawPath}`;
    }

    return new URL(rawPath, DEFAULT_INSTALLER_MANIFEST_URL).toString();
  } catch (_error) {
    return '';
  }
}

function getPublicUpdateStatus() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    feedUrl: updateFeedUrl || updateState.feedUrl || normalizeUpdateFeedUrl(DEFAULT_UPDATE_FEED_URL)
  };
}

function emitUpdateStatus(patch = {}) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    feedUrl: updateFeedUrl || updateState.feedUrl || normalizeUpdateFeedUrl(DEFAULT_UPDATE_FEED_URL)
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UPDATE_STATUS_CHANNEL, getPublicUpdateStatus());
  }

  return getPublicUpdateStatus();
}

function serializeUpdateInfo(info) {
  if (!info || typeof info !== 'object') return null;
  return {
    version: typeof info.version === 'string' ? info.version : '',
    releaseName: typeof info.releaseName === 'string' ? info.releaseName : '',
    releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : '',
    releaseNotes: info.releaseNotes || null
  };
}

function normalizeChangelogList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
}

function normalizeChangelogPayload(payload, version) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    version: typeof payload.version === 'string' ? payload.version : version || '',
    date: typeof payload.date === 'string' ? payload.date : '',
    added: normalizeChangelogList(payload.added),
    improved: normalizeChangelogList(payload.improved),
    fixed: normalizeChangelogList(payload.fixed)
  };
}

function normalizeManualDownloadPayload(payload, version) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.files)) return null;

  const payloadVersion = typeof payload.version === 'string' && payload.version ? payload.version : '';
  const expectedVersion = typeof version === 'string' && version ? version : payloadVersion;
  if (expectedVersion && payloadVersion && payloadVersion !== expectedVersion) return null;

  const file = payload.files.find((item) => item && item.type === 'windows-x64-unpacked');
  if (!file || typeof file.url !== 'string' || !file.url.trim()) return null;

  let resolvedUrl;
  try {
    resolvedUrl = new URL(file.url, updateFeedUrl).toString();
  } catch (_error) {
    return null;
  }

  return {
    type: 'windows-x64-unpacked',
    label: typeof file.label === 'string' && file.label.trim() ? file.label.trim() : 'Windows x64 免安装版',
    version: payloadVersion || expectedVersion || '',
    url: resolvedUrl,
    sha512: typeof file.sha512 === 'string' ? file.sha512 : '',
    size: Number.isFinite(file.size) ? file.size : 0
  };
}

function requestRemoteJson(url, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (_error) {
      resolve(null);
      return;
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.get(parsedUrl, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (_error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function fetchManualDownloads(version) {
  if (!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    return null;
  }

  try {
    // 免安装包清单和 latest.yml 同源发布，只作为人工下载兜底，不参与自动安装。
    const manifestUrl = new URL(MANUAL_DOWNLOADS_FILE, updateFeedUrl).toString();
    const payload = await requestRemoteJson(manifestUrl);
    return normalizeManualDownloadPayload(payload, version);
  } catch (error) {
    writeDiagnosticEvent('updater', 'manual-downloads-fetch-failure', {
      version,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function fetchUpdateChangelog(version) {
  if (!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    return null;
  }

  try {
    // 更新日志和 latest.yml 放在同一个目录，便于静态服务器发布。
    const changelogUrl = new URL('changelog.json', updateFeedUrl).toString();
    const payload = await requestRemoteJson(changelogUrl);
    return normalizeChangelogPayload(payload, version);
  } catch (error) {
    writeDiagnosticEvent('updater', 'changelog-fetch-failure', {
      version,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function compareVersionStrings(left, right) {
  const leftParts = String(left || '').replace(/^v/i, '').split(/[^0-9]+/).filter(Boolean).map(Number);
  const rightParts = String(right || '').replace(/^v/i, '').split(/[^0-9]+/).filter(Boolean).map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function normalizeInstallerManifestDownload(payload, currentVersion, options = {}) {
  if (!payload || typeof payload !== 'object') return null;
  const requireNewerVersion = options.requireNewerVersion !== false;
  const version = typeof payload.version === 'string' && payload.version.trim()
    ? payload.version.trim()
    : '';
  if (!version) return null;
  if (requireNewerVersion && compareVersionStrings(version, currentVersion) <= 0) return null;

  const packages = Array.isArray(payload.packages) ? payload.packages : [];
  const packageInfo = packages.find((item) => item && item.id === 'tos-desktop-full')
    || packages.find((item) => item && item.id === 'tos-desktop');
  if (!packageInfo || typeof packageInfo.downloadPath !== 'string' || !packageInfo.downloadPath.trim()) {
    return null;
  }

  const resolvedUrl = resolveInstallerPackageDownloadUrl(packageInfo.downloadPath);
  if (!resolvedUrl) {
    return null;
  }

  return {
    updateInfo: {
      version,
      releaseName: typeof packageInfo.filename === 'string' ? packageInfo.filename : '',
      releaseDate: typeof packageInfo.updatedAt === 'string' ? packageInfo.updatedAt : '',
      releaseNotes: null
    },
    manualDownload: {
      type: 'windows-x64-unpacked',
      label: typeof packageInfo.label === 'string' && packageInfo.label.trim()
        ? packageInfo.label.trim()
        : 'TOS 安装包',
      version,
      url: resolvedUrl,
      sha512: typeof packageInfo.sha256 === 'string' ? packageInfo.sha256 : '',
      size: Number.isFinite(packageInfo.fileSize) ? packageInfo.fileSize : 0
    }
  };
}

async function checkServerInstallerManifestForUpdates() {
  const payload = await requestRemoteJson(DEFAULT_INSTALLER_MANIFEST_URL, 6000);
  const manifestUpdate = normalizeInstallerManifestDownload(payload, app.getVersion());

  if (!manifestUpdate) {
    const nextStatus = emitUpdateStatus({
      status: 'not-available',
      checking: false,
      updateAvailable: false,
      downloaded: false,
      updateInfo: null,
      manualDownload: null,
      changelog: null,
      progress: null,
      error: null,
      feedUrl: DEFAULT_INSTALLER_MANIFEST_URL,
      feedUrlSource: 'server-manifest'
    });
    return { success: true, status: nextStatus };
  }

  const nextStatus = emitUpdateStatus({
    status: 'available',
    checking: false,
    updateAvailable: true,
    downloaded: false,
    updateInfo: manifestUpdate.updateInfo,
    manualDownload: manifestUpdate.manualDownload,
    changelog: null,
    progress: null,
    error: null,
    feedUrl: DEFAULT_INSTALLER_MANIFEST_URL,
    feedUrlSource: 'server-manifest'
  });
  return { success: true, status: nextStatus };
}

function configureAutoUpdater() {
  if (updaterConfigured) return;

  const configuredFeed = readConfiguredUpdateFeed();
  updateFeedUrl = configuredFeed.url;
  updaterConfigured = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // 不同静态更新源的 Range/缓存行为不完全一致，发布版统一下载完整安装包。
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = false;

  if (updateFeedUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateFeedUrl
    });
  }

  emitUpdateStatus({
    feedUrl: updateFeedUrl,
    feedUrlSource: configuredFeed.source
  });

  autoUpdater.on('checking-for-update', () => {
    emitUpdateStatus({
      status: 'checking',
      checking: true,
      downloading: false,
      downloaded: false,
      manualDownload: null,
      error: null
    });
  });

  autoUpdater.on('update-available', (info) => {
    const updateInfo = serializeUpdateInfo(info);
    emitUpdateStatus({
      status: 'available',
      checking: false,
      updateAvailable: true,
      downloaded: false,
      updateInfo,
      manualDownload: null,
      changelog: null,
      progress: null,
      error: null
    });

    fetchUpdateChangelog(updateInfo && updateInfo.version).then((changelog) => {
      if (!changelog) return;
      emitUpdateStatus({ changelog });
    });

    fetchManualDownloads(updateInfo && updateInfo.version).then((manualDownload) => {
      if (!manualDownload) return;
      emitUpdateStatus({ manualDownload });
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    emitUpdateStatus({
      status: 'not-available',
      checking: false,
      updateAvailable: false,
      downloaded: false,
      updateInfo: serializeUpdateInfo(info),
      manualDownload: null,
      changelog: null,
      progress: null,
      error: null
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    emitUpdateStatus({
      status: 'downloading',
      checking: false,
      downloading: true,
      downloaded: false,
      progress: {
        percent: Number.isFinite(progress.percent) ? Math.round(progress.percent) : 0,
        transferred: progress.transferred || 0,
        total: progress.total || 0,
        bytesPerSecond: progress.bytesPerSecond || 0
      },
      error: null
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    emitUpdateStatus({
      status: 'downloaded',
      checking: false,
      downloading: false,
      downloaded: true,
      updateInfo: serializeUpdateInfo(info),
      progress: {
        ...(updateState.progress || {}),
        percent: 100
      },
      error: null
    });
  });

  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    writeDiagnosticEvent('updater', 'error', { error: message });
    emitUpdateStatus({
      status: 'error',
      checking: false,
      downloading: false,
      error: message
    });
  });
}

function buildUpdateErrorResult(message, status = 'error') {
  const nextStatus = emitUpdateStatus({
    status,
    checking: false,
    downloading: false,
    error: message
  });

  return {
    success: false,
    error: message,
    status: nextStatus
  };
}

function ensureUpdaterCanRun() {
  configureAutoUpdater();

  if (!app.isPackaged) {
    return buildUpdateErrorResult('自动更新只支持 NSIS 安装版，当前是开发环境。', 'unsupported');
  }

  if (!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    return buildUpdateErrorResult('请先配置正式更新地址，再检查更新。', 'not-configured');
  }

  return null;
}

async function checkForUpdates() {
  configureAutoUpdater();

  if (!app.isPackaged) {
    return buildUpdateErrorResult('自动更新只支持 NSIS 安装版，当前是开发环境。', 'unsupported');
  }

  if (!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    emitUpdateStatus({ status: 'checking', checking: true, downloading: false, error: null });
    return checkServerInstallerManifestForUpdates();
  }

  try {
    await autoUpdater.checkForUpdates();
    return { success: true, status: getPublicUpdateStatus() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildUpdateErrorResult(message);
  }
}

async function downloadUpdate() {
  configureAutoUpdater();

  if ((!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) && updateState.manualDownload?.url) {
    await shell.openExternal(updateState.manualDownload.url);
    return { success: true, url: updateState.manualDownload.url, status: getPublicUpdateStatus() };
  }

  const unavailable = ensureUpdaterCanRun();
  if (unavailable) return unavailable;

  if (!updateState.updateAvailable) {
    return buildUpdateErrorResult('当前没有可下载的新版本。');
  }

  try {
    emitUpdateStatus({
      status: 'downloading',
      downloading: true,
      downloaded: false,
      error: null
    });
    await autoUpdater.downloadUpdate();
    return { success: true, status: getPublicUpdateStatus() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildUpdateErrorResult(message);
  }
}

function installUpdate() {
  const unavailable = ensureUpdaterCanRun();
  if (unavailable) return unavailable;

  if (!updateState.downloaded) {
    return buildUpdateErrorResult('更新包尚未下载完成。');
  }

  emitUpdateStatus({
    status: 'installing',
    checking: false,
    downloading: false,
    error: null
  });

  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });

  return { success: true, status: getPublicUpdateStatus() };
}

async function openManualDownload() {
  configureAutoUpdater();

  if (!updateFeedUrl || isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    emitUpdateStatus({ status: 'checking', checking: true, downloading: false, error: null });
    await checkServerInstallerManifestForUpdates();
  }

  let manualDownload = updateState.manualDownload;
  if (!manualDownload) {
    manualDownload = await fetchManualDownloads(updateState.updateInfo && updateState.updateInfo.version);
    if (manualDownload) {
      emitUpdateStatus({ manualDownload });
    }
  }

  if (!manualDownload) {
    try {
      const payload = await requestRemoteJson(DEFAULT_INSTALLER_MANIFEST_URL, 6000);
      const manifestDownload = normalizeInstallerManifestDownload(payload, app.getVersion(), {
        requireNewerVersion: false
      });
      if (manifestDownload) {
        manualDownload = manifestDownload.manualDownload;
        emitUpdateStatus({
          updateInfo: manifestDownload.updateInfo,
          manualDownload,
          feedUrl: DEFAULT_INSTALLER_MANIFEST_URL,
          feedUrlSource: 'server-manifest',
          error: null
        });
      }
    } catch (error) {
      writeDiagnosticEvent('updater', 'installer-manifest-manual-download-failure', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (!manualDownload || !manualDownload.url) {
    return buildUpdateErrorResult('更新源暂未提供免安装版下载。');
  }

  const allowedUrl = normalizeAllowedExternalUrl(manualDownload.url, { updateFeedUrl });
  if (!allowedUrl) {
    return buildUpdateErrorResult('Unsupported external URL');
  }

  await shell.openExternal(allowedUrl);
  return {
    success: true,
    url: allowedUrl,
    status: getPublicUpdateStatus()
  };
}

function getLogsDir() {
  return path.join(app.getPath('userData'), 'logs');
}

function getDiagnosticsLogPath() {
  return path.join(getLogsDir(), 'diagnostics.jsonl');
}

function limitDiagnosticString(value) {
  if (value.length <= DIAGNOSTIC_MAX_STRING_LENGTH) return value;
  return `${value.slice(0, DIAGNOSTIC_MAX_STRING_LENGTH)}... [truncated]`;
}

function sanitizeDiagnosticValue(value, depth = 0) {
  if (depth > 6) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return limitDiagnosticString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, DIAGNOSTIC_MAX_ARRAY_LENGTH).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 100).map(([key, item]) => {
        if (DIAGNOSTIC_SECRET_KEY_PATTERN.test(key)) {
          return [key, '[redacted]'];
        }
        return [key, sanitizeDiagnosticValue(item, depth + 1)];
      })
    );
  }
  return String(value);
}

function writeDiagnosticEvent(moduleName, action, payload = {}) {
  try {
    fs.mkdirSync(getLogsDir(), { recursive: true });
    const record = {
      time: new Date().toISOString(),
      module: String(moduleName || 'app'),
      action: String(action || 'event'),
      payload: sanitizeDiagnosticValue(payload)
    };
    fs.appendFileSync(getDiagnosticsLogPath(), `${JSON.stringify(record)}${os.EOL}`, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function copyFileForDiagnostics(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.size > DIAGNOSTIC_MAX_FILE_SIZE) return false;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function copyDirectoryForDiagnostics(sourceDir, targetDir, options = {}) {
  if (!fs.existsSync(sourceDir)) return;
  const skipDirNames = new Set(options.skipDirNames || []);
  const allowedExtensions = options.allowedExtensions ? new Set(options.allowedExtensions) : null;

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      if (skipDirNames.has(entry.name)) continue;
      copyDirectoryForDiagnostics(sourcePath, targetPath, options);
      continue;
    }

    if (!entry.isFile()) continue;
    if (allowedExtensions && !allowedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    copyFileForDiagnostics(sourcePath, targetPath);
  }
}

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `PowerShell exited with code ${code}`));
      }
    });
  });
}

function getExternalModulePath(moduleId) {
  const moduleConfig = externalModules[moduleId];
  if (!moduleConfig) {
    return null;
  }

  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, 'external-apps', moduleId)
    : path.join(__dirname, 'external-apps', moduleId);

  return {
    ...moduleConfig,
    baseDir,
    executablePath: path.join(baseDir, moduleConfig.executable)
  };
}

function getBrowserPluginRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'browser-plugins')
    : path.join(__dirname, 'browser-plugins');
}

function loadBrowserPluginRegistry() {
  const registryPath = path.join(getBrowserPluginRoot(), 'registry.json');
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return Array.isArray(registry) ? registry : [];
  } catch (error) {
    console.error(`Browser plugin registry load failed: ${error.message}`);
    return [];
  }
}

function getBrowserPluginPath(plugin) {
  const extensionDir = plugin.extensionDir || plugin.id;
  return path.join(getBrowserPluginRoot(), extensionDir);
}

function getBrowserCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env['PROGRAMFILES(X86)'];
  const candidates = [
    {
      name: 'Google Chrome',
      executablePaths: [
        process.env.CHROME_PATH,
        localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        programFilesX86 && path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
      ]
    },
    {
      name: 'Microsoft Edge',
      executablePaths: [
        process.env.EDGE_PATH,
        localAppData && path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ]
    }
  ];

  return candidates
    .map((candidate) => {
      const executablePath = candidate.executablePaths.find((candidatePath) => {
        return candidatePath && fs.existsSync(candidatePath);
      });
      return executablePath ? { name: candidate.name, executablePath } : null;
    })
    .filter(Boolean);
}

function getBrowserPlugins() {
  const availableBrowsers = getBrowserCandidates();
  return loadBrowserPluginRegistry().map((plugin) => {
    const extensionPath = getBrowserPluginPath(plugin);
    const manifestPath = path.join(extensionPath, 'manifest.json');
    return {
      id: plugin.id,
      name: plugin.name,
      provider: plugin.provider || '',
      category: plugin.category || '浏览器插件',
      version: plugin.version || '',
      description: plugin.description || '',
      targetUrl: plugin.targetUrl || '',
      matchPatterns: Array.isArray(plugin.matchPatterns) ? plugin.matchPatterns : [],
      extensionPath,
      available: fs.existsSync(manifestPath),
      browserAvailable: availableBrowsers.length > 0,
      browsers: availableBrowsers
    };
  });
}

function getBrowserPluginById(pluginId) {
  return getBrowserPlugins().find((plugin) => plugin.id === pluginId) || null;
}

function getBrowserPluginProfileDir(pluginId) {
  return path.join(app.getPath('userData'), 'browser-plugin-profiles', pluginId);
}

async function launchBrowserPlugin(pluginId) {
  const plugin = getBrowserPluginById(pluginId);
  if (!plugin) {
    return { success: false, error: `Unknown browser plugin: ${pluginId}` };
  }

  if (!plugin.available) {
    return {
      success: false,
      error: `Browser plugin manifest not found: ${path.join(plugin.extensionPath, 'manifest.json')}`
    };
  }

  const browser = plugin.browsers[0];
  if (!browser) {
    return { success: false, error: '未找到可用的 Google Chrome 或 Microsoft Edge' };
  }

  const profileDir = getBrowserPluginProfileDir(plugin.id);
  fs.mkdirSync(profileDir, { recursive: true });

  const args = [
    `--user-data-dir=${profileDir}`,
    `--load-extension=${plugin.extensionPath}`,
    `--disable-extensions-except=${plugin.extensionPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    plugin.targetUrl
  ].filter(Boolean);

  try {
    const child = spawn(browser.executablePath, args, {
      cwd: path.dirname(browser.executablePath),
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return {
      success: true,
      pluginId: plugin.id,
      browser: browser.name,
      profileDir,
      extensionPath: plugin.extensionPath,
      targetUrl: plugin.targetUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getAutomationAppRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'automation-apps')
    : path.join(__dirname, 'automation-apps');
}

function getAutomationRegistryPath() {
  return path.join(getAutomationAppRoot(), 'registry.json');
}

function getAutomationHelperVersionPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, AUTOMATION_HELPER_VERSION_FILE)
    : path.join(__dirname, AUTOMATION_HELPER_VERSION_FILE);
}

function readAutomationHelperVersion() {
  const envVersion = String(process.env.TOS_AUTOMATION_HELPER_VERSION || '').trim();
  if (envVersion) {
    return envVersion;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(getAutomationHelperVersionPath(), 'utf8'));
    return String(payload.version || '').trim();
  } catch (_error) {
    return '';
  }
}

function loadAutomationAppRegistry() {
  const registryPath = getAutomationRegistryPath();
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return Array.isArray(registry) ? registry : [];
  } catch (error) {
    console.error(`Automation app registry load failed at ${registryPath}: ${error.message}`);
    return [];
  }
}

function getAutomationAppPath(automationApp) {
  const appDir = automationApp.appDir || automationApp.id;
  return path.join(getAutomationAppRoot(), appDir);
}

function getAutomationAppUrl(automationApp) {
  const port = Number(automationApp.defaultPort || 3100);
  return `http://127.0.0.1:${port}`;
}

function requestJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (_error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function requestAutomationAppHealth(automationApp, timeoutMs = 1500) {
  const url = `${getAutomationAppUrl(automationApp)}/api/health`;
  const payload = await requestJson(url, timeoutMs);
  return Boolean(payload && payload.ok);
}

async function getAutomationApps() {
  const registry = loadAutomationAppRegistry();
  return Promise.all(registry.map(async (automationApp) => {
    const baseDir = getAutomationAppPath(automationApp);
    const entryPath = path.join(baseDir, automationApp.entry || 'bin/start.js');
    const port = Number(automationApp.defaultPort || 3100);
    const url = getAutomationAppUrl(automationApp);
    const tracked = automationAppProcesses.get(automationApp.id);
    const running = (tracked && !tracked.child.killed) || await requestAutomationAppHealth(automationApp, 500);

    return {
      id: automationApp.id,
      name: automationApp.name,
      provider: automationApp.provider || '',
      category: automationApp.category || '网页自动化',
      version: automationApp.version || '',
      requiredHelperVersion: automationApp.requiredHelperVersion || '',
      description: automationApp.description || '',
      baseDir,
      entryPath,
      port,
      url,
      available: fs.existsSync(entryPath),
      running: Boolean(running)
    };
  }));
}

function getAutomationAppById(appId) {
  const automationApp = loadAutomationAppRegistry().find((item) => item.id === appId);
  if (!automationApp) {
    return null;
  }
  const baseDir = getAutomationAppPath(automationApp);
  return {
    ...automationApp,
    baseDir,
    entryPath: path.join(baseDir, automationApp.entry || 'bin/start.js'),
    port: Number(automationApp.defaultPort || 3100),
    url: getAutomationAppUrl(automationApp)
  };
}

function getAutomationDataDir(appId) {
  return path.join(app.getPath('userData'), 'automation-apps', appId);
}

async function waitForAutomationApp(automationApp, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestAutomationAppHealth(automationApp, 1000)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function launchAutomationApp(appId) {
  const automationApp = getAutomationAppById(appId);
  if (!automationApp) {
    const registry = loadAutomationAppRegistry();
    const knownApps = registry.map((item) => item.id).filter(Boolean).join(', ') || '(none)';
    return {
      success: false,
      error: `Unknown automation app: ${appId}. Registry: ${getAutomationRegistryPath()}. Known apps: ${knownApps}`,
    };
  }

  if (!fs.existsSync(automationApp.entryPath)) {
    return { success: false, error: `Automation app entry not found: ${automationApp.entryPath}` };
  }

  if (await requestAutomationAppHealth(automationApp)) {
    return { success: true, alreadyRunning: true, appId, url: automationApp.url };
  }

  const tracked = automationAppProcesses.get(appId);
  if (tracked && !tracked.child.killed) {
    return { success: true, alreadyRunning: true, appId, url: automationApp.url };
  }

  const logDir = path.join(app.getPath('userData'), 'logs');
  const dataDir = getAutomationDataDir(appId);
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const logPath = path.join(logDir, `${appId}.log`);
  const logFd = fs.openSync(logPath, 'a');
  const env = {
    ...process.env,
    TMS_PLAYWRIGHT_PORT: String(automationApp.port),
    TMS_PLAYWRIGHT_DATA_DIR: dataDir
  };
  const helperVersion = readAutomationHelperVersion();
  if (helperVersion) {
    env.TOS_AUTOMATION_HELPER_VERSION = helperVersion;
  }

  if (process.versions.electron) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  try {
    const child = spawn(process.execPath, [automationApp.entryPath], {
      cwd: automationApp.baseDir,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
      env
    });

    automationAppProcesses.set(appId, { child, logFd });

    child.once('exit', () => {
      const latest = automationAppProcesses.get(appId);
      if (latest && latest.child === child) {
        automationAppProcesses.delete(appId);
      }
      try {
        fs.closeSync(logFd);
      } catch (_error) {
        // Ignore close failures for shutdown diagnostics.
      }
    });

    const isReady = await waitForAutomationApp(automationApp);
    if (!isReady) {
      child.kill();
      return { success: false, error: `Automation app did not become ready. Log: ${logPath}` };
    }

    return { success: true, appId, url: automationApp.url, dataDir, logPath };
  } catch (error) {
    try {
      fs.closeSync(logFd);
    } catch (_closeError) {
      // Ignore close failures after launch errors.
    }
    automationAppProcesses.delete(appId);
    return { success: false, error: error instanceof Error ? error.message : String(error), logPath };
  }
}

function stopAutomationApp(appId) {
  const tracked = automationAppProcesses.get(appId);
  if (!tracked || tracked.child.killed) {
    return { success: true, alreadyStopped: true, appId };
  }

  tracked.child.kill();
  automationAppProcesses.delete(appId);
  try {
    fs.closeSync(tracked.logFd);
  } catch (_error) {
    // Ignore close failures during explicit stop.
  }
  return { success: true, appId };
}

function getCoreAutomationOptions() {
  const helperVersion = readAutomationHelperVersion();
  return {
    automationAppRoot: getAutomationAppRoot(),
    processMap: automationAppProcesses,
    userDataDir: app.getPath('userData'),
    helperVersion,
    processExecPath: process.execPath,
    windowsHide: true,
    markElectronRunAsNode: Boolean(process.versions.electron),
    automationModuleManifestUrl: process.env.TOS_AUTOMATION_MODULE_MANIFEST_URL
      || process.env.TMS_AUTOMATION_MODULE_MANIFEST_URL
      || automationLauncherCore.DEFAULT_AUTOMATION_MODULE_MANIFEST_URL,
    enableModuleUpdates: process.env.TOS_AUTOMATION_MODULE_UPDATES !== '0',
    baseEnv: helperVersion
      ? { TOS_AUTOMATION_HELPER_VERSION: helperVersion }
      : {},
  };
}

async function getCoreAutomationApps() {
  return automationLauncherCore.getAutomationApps(getCoreAutomationOptions());
}

async function launchCoreAutomationApp(appId, options = {}) {
  const launchOptions = options && typeof options === 'object' ? options : {};
  const result = await automationLauncherCore.launchAutomationApp(appId, {
    ...getCoreAutomationOptions(),
    forceUpdate: Boolean(launchOptions.forceUpdate),
  });
  if (!result.success && /^Unknown automation app:/i.test(String(result.error || ''))) {
    const registry = loadAutomationAppRegistry();
    const knownApps = registry.map((item) => item.id).filter(Boolean).join(', ') || '(none)';
    return {
      ...result,
      error: `${result.error}. Registry: ${getAutomationRegistryPath()}. Known apps: ${knownApps}`,
    };
  }
  return result;
}

function stopCoreAutomationApp(appId) {
  return automationLauncherCore.stopAutomationApp(appId, getCoreAutomationOptions());
}

function getAutomationLauncherRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'automation-launcher')
    : path.join(__dirname, 'automation-launcher');
}

function getAutomationLauncherScriptPath() {
  return path.join(getAutomationLauncherRoot(), 'server.js');
}

function getAutomationLauncherLogPath() {
  return path.join(app.getPath('userData'), 'logs', 'automation-launcher.log');
}

function requestLauncherJson(method, pathname, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const requestBody = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request({
      host: AUTOMATION_LAUNCHER_HOST,
      port: AUTOMATION_LAUNCHER_PORT,
      path: pathname,
      method,
      headers: requestBody
        ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        }
        : undefined,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const parsed = safeJsonParse(body);
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          const errorMessage = parsed && parsed.error
            ? parsed.error
            : parsed && parsed.message
              ? parsed.message
              : `Launcher request failed with HTTP ${res.statusCode}.`;
          reject(new Error(errorMessage));
          return;
        }
        resolve(parsed || {});
      });
    });

    req.on('error', (error) => reject(error));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Launcher request timed out.'));
    });

    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

function safeJsonParse(rawText) {
  try {
    return rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    return null;
  }
}

async function requestAutomationLauncherHealth(timeoutMs = 1000) {
  const payload = await requestJson(`${AUTOMATION_LAUNCHER_URL}/health`, timeoutMs);
  return Boolean(payload && payload.ok);
}

async function waitForAutomationLauncher(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestAutomationLauncherHealth(1000)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureAutomationLauncher() {
  if (await requestAutomationLauncherHealth()) {
    return {
      success: true,
      alreadyRunning: true,
      url: AUTOMATION_LAUNCHER_URL,
    };
  }

  if (automationLauncherStartPromise) {
    return automationLauncherStartPromise;
  }

  automationLauncherStartPromise = (async () => {
    const launcherScriptPath = getAutomationLauncherScriptPath();
    if (!fs.existsSync(launcherScriptPath)) {
      throw new Error(`Automation launcher entry not found: ${launcherScriptPath}`);
    }

    const logDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = getAutomationLauncherLogPath();
    const logFd = fs.openSync(logPath, 'a');
    const helperVersion = readAutomationHelperVersion();
    const env = {
      ...process.env,
      TMS_AUTOMATION_LAUNCHER_HOST: AUTOMATION_LAUNCHER_HOST,
      TMS_AUTOMATION_LAUNCHER_PORT: String(AUTOMATION_LAUNCHER_PORT),
      TMS_AUTOMATION_APP_ROOT: getAutomationAppRoot(),
      TMS_AUTOMATION_LAUNCHER_DATA_DIR: app.getPath('userData'),
      TMS_AUTOMATION_APP_NAME: APP_DISPLAY_NAME,
      TOS_AUTOMATION_HELPER_VERSION_FILE: getAutomationHelperVersionPath(),
      TOS_AUTOMATION_MODULE_MANIFEST_URL: process.env.TOS_AUTOMATION_MODULE_MANIFEST_URL
        || process.env.TMS_AUTOMATION_MODULE_MANIFEST_URL
        || automationLauncherCore.DEFAULT_AUTOMATION_MODULE_MANIFEST_URL,
      TOS_AUTOMATION_MODULE_UPDATES: process.env.TOS_AUTOMATION_MODULE_UPDATES || '1',
      ELECTRON_RUN_AS_NODE: '1',
    };
    if (helperVersion) {
      env.TOS_AUTOMATION_HELPER_VERSION = helperVersion;
    }

    try {
      const child = spawn(process.execPath, [launcherScriptPath], {
        cwd: getAutomationLauncherRoot(),
        detached: true,
        windowsHide: true,
        stdio: ['ignore', logFd, logFd],
        env,
      });
      automationLauncherProcess = child;
      child.unref();
      fs.closeSync(logFd);
    } catch (error) {
      try {
        fs.closeSync(logFd);
      } catch (_closeError) {
        // Ignore close failures after launcher startup errors.
      }
      throw error;
    }

    const ready = await waitForAutomationLauncher();
    if (!ready) {
      throw new Error(`Automation launcher did not become ready. Log: ${logPath}`);
    }

    return {
      success: true,
      url: AUTOMATION_LAUNCHER_URL,
      logPath,
    };
  })();

  try {
    return await automationLauncherStartPromise;
  } finally {
    automationLauncherStartPromise = null;
  }
}

async function getAutomationLauncherApps() {
  await ensureAutomationLauncher();
  const payload = await requestLauncherJson('GET', '/api/apps');
  return Array.isArray(payload.apps) ? payload.apps : [];
}

async function launchAutomationLauncherApp(appId, options = {}) {
  await ensureAutomationLauncher();
  return requestLauncherJson('POST', `/api/apps/${encodeURIComponent(appId)}/start`, options);
}

async function stopAutomationLauncherApp(appId) {
  await ensureAutomationLauncher();
  return requestLauncherJson('POST', `/api/apps/${encodeURIComponent(appId)}/stop`);
}

function extractProtocolUrl(args) {
  return Array.isArray(args)
    ? args.find((value) => typeof value === 'string' && value.startsWith(`${AUTOMATION_PROTOCOL}://`))
    : '';
}

function hasAutomationLauncherBackgroundFlag(args) {
  return Array.isArray(args)
    ? args.includes(AUTOMATION_LAUNCHER_BACKGROUND_FLAG)
    : false;
}

function isAutomationLauncherProtocolUrl(rawUrl) {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === `${AUTOMATION_PROTOCOL}:`
      && parsed.hostname === 'automation'
      && parsed.pathname === '/launcher/start';
  } catch (_error) {
    return false;
  }
}

function registerAutomationProtocol() {
  try {
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient(AUTOMATION_PROTOCOL);
      return;
    }

    if (process.defaultApp) {
      app.setAsDefaultProtocolClient(AUTOMATION_PROTOCOL, process.execPath, [path.resolve(process.argv[1] || '')]);
      return;
    }

    app.setAsDefaultProtocolClient(AUTOMATION_PROTOCOL);
  } catch (error) {
    writeDiagnosticEvent('web-automation', 'protocol-register-failure', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function queueProtocolCommand(url) {
  if (!url) return;
  protocolCommandQueue.push(url);
  void flushProtocolCommands();
}

async function flushProtocolCommands() {
  if (protocolQueueBusy || !app.isReady()) return;
  protocolQueueBusy = true;

  try {
    while (protocolCommandQueue.length > 0) {
      const url = protocolCommandQueue.shift();
      if (!url) {
        continue;
      }
      try {
        await handleProtocolCommand(url);
      } catch (error) {
        writeDiagnosticEvent('web-automation', 'protocol-command-failure', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    protocolQueueBusy = false;
  }
}

async function handleProtocolCommand(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== `${AUTOMATION_PROTOCOL}:`) {
    return;
  }

  if (parsed.hostname === 'automation' && parsed.pathname === '/launcher/start') {
    await ensureAutomationLauncher();
    return;
  }

  const startMatch = parsed.pathname.match(/^\/apps\/([^/]+)\/start\/?$/);
  if (parsed.hostname === 'automation' && startMatch) {
    await launchAutomationLauncherApp(decodeURIComponent(startMatch[1]));
  }
}

function getDiagnosticsTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

async function buildDiagnosticsManifest() {
  const appPath = app.getAppPath();
  const backendDir = getBackendDir();
  const automationAppRoot = getAutomationAppRoot();
  const browserPluginRoot = getBrowserPluginRoot();

  return {
    createdAt: new Date().toISOString(),
    app: {
      name: APP_DISPLAY_NAME,
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      appPath,
      resourcesPath: process.resourcesPath,
      userData: app.getPath('userData')
    },
    runtime: {
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    checks: {
      frontendIndexExists: fs.existsSync(path.join(appPath, 'dist-frontend', 'index.html')),
      backendMainExists: fs.existsSync(path.join(backendDir, 'main.py')),
      automationRegistryExists: fs.existsSync(path.join(automationAppRoot, 'registry.json')),
      browserPluginRegistryExists: fs.existsSync(path.join(browserPluginRoot, 'registry.json')),
      backendHealth: await requestBackendHealth(activeBackendPort, 800)
    },
    paths: {
      logsDir: getLogsDir(),
      backendDir,
      automationAppRoot,
      browserPluginRoot
    },
    automationApps: await getCoreAutomationApps(),
    browserPlugins: getBrowserPlugins().map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      provider: plugin.provider,
      category: plugin.category,
      version: plugin.version,
      available: plugin.available,
      browserAvailable: plugin.browserAvailable,
      targetUrl: plugin.targetUrl,
      matchPatterns: plugin.matchPatterns,
      browsers: plugin.browsers.map((browser) => browser.name)
    }))
  };
}

function writeDiagnosticsReadme(stagingDir) {
  const readme = [
    'TMS 集成工具诊断包',
    '',
    '请把整个 zip 文件发给开发人员排查。',
    '',
    '包含内容：',
    '- logs: 后端、网页自动化和前端事件日志',
    '- manifest.json: 程序版本、运行路径、模块可用状态',
    '- automation-runs: 网页自动化截图等运行结果',
    '- adidas-materials-collector: adidas 采集状态和本地结果文件',
    '',
    '默认不包含浏览器登录态、Cookie、上传原始 Excel 文件。'
  ].join(os.EOL);
  fs.writeFileSync(path.join(stagingDir, 'README.txt'), readme, 'utf8');
}

async function exportDiagnosticsPackage() {
  const timestamp = getDiagnosticsTimestamp();
  const defaultPath = path.join(app.getPath('desktop'), `TMS诊断包-${timestamp}.zip`);
  const dialogResult = await dialog.showSaveDialog(mainWindow, {
    title: '导出诊断包',
    defaultPath,
    filters: [{ name: 'Zip 压缩包', extensions: ['zip'] }]
  });

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, canceled: true };
  }

  const zipPath = dialogResult.filePath;
  const stagingDir = path.join(app.getPath('temp'), `tms-diagnostics-${timestamp}`);
  writeDiagnosticEvent('diagnostics', 'export-start', { zipPath });

  try {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.mkdirSync(stagingDir, { recursive: true });

    const manifest = await buildDiagnosticsManifest();
    fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    writeDiagnosticsReadme(stagingDir);

    copyDirectoryForDiagnostics(getLogsDir(), path.join(stagingDir, 'logs'), {
      allowedExtensions: new Set(['.log', '.jsonl', '.txt'])
    });

    const automationDataDir = path.join(app.getPath('userData'), 'automation-apps');
    copyDirectoryForDiagnostics(automationDataDir, path.join(stagingDir, 'automation-runs'), {
      skipDirNames: new Set(['uploads', 'playwright-user-data']),
      allowedExtensions: new Set(['.log', '.json', '.jsonl', '.txt', '.png', '.jpg', '.jpeg', '.webp'])
    });

    copyDirectoryForDiagnostics(
      path.join(app.getPath('userData'), 'adidas-materials-collector'),
      path.join(stagingDir, 'adidas-materials-collector'),
      {
        allowedExtensions: new Set(['.json', '.csv', '.log', '.txt'])
      }
    );

    const automationRegistryPath = path.join(getAutomationAppRoot(), 'registry.json');
    const browserPluginRegistryPath = path.join(getBrowserPluginRoot(), 'registry.json');
    if (fs.existsSync(automationRegistryPath)) {
      copyFileForDiagnostics(automationRegistryPath, path.join(stagingDir, 'registries', 'automation-apps.json'));
    }
    if (fs.existsSync(browserPluginRegistryPath)) {
      copyFileForDiagnostics(browserPluginRegistryPath, path.join(stagingDir, 'registries', 'browser-plugins.json'));
    }

    const script = [
      '$ErrorActionPreference = "Stop"',
      `$source = ${psSingleQuote(path.join(stagingDir, '*'))}`,
      `$dest = ${psSingleQuote(zipPath)}`,
      'if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }',
      'Compress-Archive -Path $source -DestinationPath $dest -Force'
    ].join('; ');

    await runPowerShell(script);
    fs.rmSync(stagingDir, { recursive: true, force: true });
    shell.showItemInFolder(zipPath);
    writeDiagnosticEvent('diagnostics', 'export-success', { zipPath });
    return { success: true, filePath: zipPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    writeDiagnosticEvent('diagnostics', 'export-failure', { zipPath, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

function getBackendDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.resolve(__dirname, '..', 'tms-backend');
}

function getBundledBackendExecutable() {
  if (!app.isPackaged) {
    return null;
  }

  const backendRuntimeDir = path.join(process.resourcesPath, 'backend-runtime');
  const candidates = process.platform === 'win32'
    ? ['tos-backend.exe', path.join('tos-backend', 'tos-backend.exe')]
    : ['tos-backend', path.join('tos-backend', 'tos-backend')];

  for (const candidate of candidates) {
    const executablePath = path.join(backendRuntimeDir, candidate);
    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  }

  return null;
}

function getBackendDataDir() {
  return path.join(app.getPath('userData'), 'backend-data');
}

function getBackendConfigDir(preferRuntime = false) {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '..', 'tms-backend', 'config');
  }

  const runtimeConfigDir = path.join(process.resourcesPath, 'backend-runtime', 'tos-backend', '_internal', 'config');
  const sourceConfigDir = path.join(process.resourcesPath, 'backend', 'config');
  if (preferRuntime && fs.existsSync(runtimeConfigDir)) {
    return runtimeConfigDir;
  }
  if (fs.existsSync(sourceConfigDir)) {
    return sourceConfigDir;
  }
  return runtimeConfigDir;
}

function buildBackendProcessEnv(port, preferRuntimeConfig = false) {
  const configDir = getBackendConfigDir(preferRuntimeConfig);
  const settingsFile = path.join(configDir, 'settings.yaml');
  const credentialKeyFile = path.join(configDir, 'credential.key');
  const env = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    TOS_BACKEND_HOST: BACKEND_HOST,
    TOS_BACKEND_PORT: String(port),
    TMS_BACKEND_DATA_DIR: getBackendDataDir(),
  };

  if (fs.existsSync(settingsFile)) {
    env.TOS_SETTINGS_FILE = settingsFile;
  }
  if (fs.existsSync(credentialKeyFile)) {
    env.TOS_CREDENTIAL_KEY_FILE = credentialKeyFile;
  }

  return env;
}

function normalizeBackendBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildBackendUrl(port = activeBackendPort) {
  return `http://${BACKEND_HOST}:${port}`;
}

function requestBackendJson(port, pathname, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`${buildBackendUrl(port)}${pathname}`, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (_error) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function requestBackendHealth(port = activeBackendPort, timeoutMs = 1500) {
  const payload = await requestBackendJson(port, '/health', timeoutMs);
  return Boolean(payload && /ok/i.test(JSON.stringify(payload)));
}

async function requestBackendCompatibility(port = activeBackendPort, timeoutMs = 2500) {
  const healthOk = await requestBackendHealth(port, timeoutMs);
  const openapi = healthOk
    ? await requestBackendJson(port, '/openapi.json', timeoutMs)
    : null;

  return evaluateBackendCompatibility({
    healthOk,
    openapi,
    expectedVersion: app.getVersion(),
    requiredPaths: REQUIRED_BACKEND_OPENAPI_PATHS
  });
}

async function waitForBackend(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const readiness = await requestBackendCompatibility(port, 1000);
    if (readiness.compatible) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function spawnBackendWith(candidate, backendDir, logStream, port) {
  const args = [
    ...candidate.args,
    '-m',
    'uvicorn',
    'main:app',
    '--host',
    BACKEND_HOST,
    '--port',
    String(port)
  ];

  const child = spawn(candidate.command, args, {
    cwd: backendDir,
    windowsHide: true,
    stdio: ['ignore', logStream, logStream],
    env: buildBackendProcessEnv(port, false)
  });

  let spawnError = null;
  child.once('error', (error) => {
    spawnError = error;
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  if (spawnError) {
    throw spawnError;
  }

  return child;
}

async function spawnBundledBackend(executablePath, logStream, port) {
  const child = spawn(executablePath, [], {
    cwd: path.dirname(executablePath),
    windowsHide: true,
    stdio: ['ignore', logStream, logStream],
    env: buildBackendProcessEnv(port, true)
  });

  let spawnError = null;
  child.once('error', (error) => {
    spawnError = error;
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  if (spawnError) {
    throw spawnError;
  }

  return child;
}

async function startBackendServer() {
  if (USE_REMOTE_BACKEND) {
    activeBackendUrl = REMOTE_BACKEND_URL;
    return {
      success: true,
      alreadyRunning: true,
      remote: true,
      url: activeBackendUrl,
      expectedVersion: app.getVersion(),
      missingPaths: [],
      versionMismatch: false
    };
  }

  if (backendProcess && !backendProcess.killed) {
    return {
      success: true,
      alreadyRunning: true,
      url: activeBackendUrl,
      port: activeBackendPort,
      expectedVersion: app.getVersion(),
      missingPaths: [],
      versionMismatch: false
    };
  }

  const defaultReadiness = await requestBackendCompatibility(BACKEND_PORT);
  if (defaultReadiness.compatible) {
    activeBackendPort = BACKEND_PORT;
    activeBackendUrl = buildBackendUrl(BACKEND_PORT);
    return {
      success: true,
      alreadyRunning: true,
      url: activeBackendUrl,
      port: activeBackendPort,
      version: defaultReadiness.version,
      expectedVersion: defaultReadiness.expectedVersion,
      missingPaths: defaultReadiness.missingPaths,
      versionMismatch: defaultReadiness.versionMismatch
    };
  }

  const backendDir = getBackendDir();
  const bundledBackendExecutable = getBundledBackendExecutable();

  fs.mkdirSync(getBackendDataDir(), { recursive: true });
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'backend.log');
  const logStream = fs.openSync(logPath, 'a');

  const errors = [];
  if (defaultReadiness.healthy && !defaultReadiness.compatible) {
    errors.push(describeBackendCompatibilityFailure(buildBackendUrl(BACKEND_PORT), defaultReadiness));
  }
  const candidatePorts = selectBackendPortCandidates({
    defaultReadiness,
    portCandidates: BACKEND_PORT_CANDIDATES,
    defaultPort: BACKEND_PORT
  });

  if (bundledBackendExecutable) {
    for (const port of candidatePorts) {
      try {
        const child = await spawnBundledBackend(bundledBackendExecutable, logStream, port);
        const isReady = await waitForBackend(port);
        if (isReady) {
          const readiness = await requestBackendCompatibility(port);
          backendProcess = child;
          activeBackendPort = port;
          activeBackendUrl = buildBackendUrl(port);
          return {
            success: true,
            url: activeBackendUrl,
            port,
            command: bundledBackendExecutable,
            version: readiness.version,
            expectedVersion: readiness.expectedVersion,
            missingPaths: readiness.missingPaths,
            versionMismatch: readiness.versionMismatch
          };
        }
        child.kill();
        errors.push(`${bundledBackendExecutable} on ${buildBackendUrl(port)}: backend did not become ready`);
      } catch (error) {
        errors.push(`${bundledBackendExecutable} on ${buildBackendUrl(port)}: ${error.message}`);
      }
    }
  }

  if (!fs.existsSync(path.join(backendDir, 'main.py'))) {
    try {
      fs.closeSync(logStream);
    } catch (_error) {
      // Ignore close failures for startup diagnostics.
    }
    const missingBackend = bundledBackendExecutable
      ? `Bundled backend failed and source backend not found: ${backendDir}`
      : `Backend not found: ${backendDir}`;
    return { success: false, error: [missingBackend, ...errors].join('; ') };
  }

  const candidates = [
    { command: 'py', args: ['-3'] },
    { command: 'python', args: [] },
    { command: 'python3', args: [] }
  ];

  for (const candidate of candidates) {
    for (const port of candidatePorts) {
      try {
        const child = await spawnBackendWith(candidate, backendDir, logStream, port);
        const isReady = await waitForBackend(port);
        if (isReady) {
          const readiness = await requestBackendCompatibility(port);
          backendProcess = child;
          activeBackendPort = port;
          activeBackendUrl = buildBackendUrl(port);
          return {
            success: true,
            url: activeBackendUrl,
            port,
            command: candidate.command,
            version: readiness.version,
            expectedVersion: readiness.expectedVersion,
            missingPaths: readiness.missingPaths,
            versionMismatch: readiness.versionMismatch
          };
        }
        child.kill();
        errors.push(`${candidate.command} on ${buildBackendUrl(port)}: backend did not become ready`);
      } catch (error) {
        errors.push(`${candidate.command} on ${buildBackendUrl(port)}: ${error.message}`);
      }
    }
  }

  try {
    fs.closeSync(logStream);
  } catch (_error) {
    // Ignore close failures for startup diagnostics.
  }

  return { success: false, error: errors.join('; '), logPath };
}

function registerIpcHandlers() {
  ipcMain.handle('get-backend-url', () => activeBackendUrl);
  ipcMain.handle('start-backend-server', () => startBackendServer());
  ipcMain.handle('get-app-version', () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged
  }));
  ipcMain.handle('get-update-status', () => {
    configureAutoUpdater();
    return getPublicUpdateStatus();
  });
  ipcMain.handle('check-for-updates', () => checkForUpdates());
  ipcMain.handle('download-update', () => downloadUpdate());
  ipcMain.handle('install-update', () => installUpdate());
  ipcMain.handle('open-manual-download', () => openManualDownload());

  ipcMain.handle('record-diagnostic-event', (_event, diagnosticEvent) => {
    if (!diagnosticEvent || typeof diagnosticEvent !== 'object') {
      return { success: false, error: 'Invalid diagnostic event' };
    }
    return writeDiagnosticEvent(diagnosticEvent.module, diagnosticEvent.action, diagnosticEvent.payload || {});
  });

  ipcMain.handle('export-diagnostics-package', () => exportDiagnosticsPackage());

  ipcMain.handle('open-external', async (_event, url) => {
    const allowedUrl = normalizeAllowedExternalUrl(url, { updateFeedUrl });
    if (!allowedUrl) {
      return { success: false, error: 'Unsupported external URL' };
    }
    await shell.openExternal(allowedUrl);
    return { success: true };
  });

  ipcMain.handle('get-external-modules', () => {
    return Object.keys(externalModules).map((moduleId) => {
      const moduleInfo = getExternalModulePath(moduleId);
      return {
        id: moduleId,
        name: moduleInfo.name,
        description: moduleInfo.description || '',
        path: moduleInfo.executablePath,
        executablePath: moduleInfo.executablePath,
        available: fs.existsSync(moduleInfo.executablePath)
      };
    });
  });

  ipcMain.handle('get-browser-plugins', () => getBrowserPlugins());

  ipcMain.handle('launch-browser-plugin', async (_event, pluginId) => {
    if (typeof pluginId !== 'string' || !pluginId) {
      return { success: false, error: 'Invalid browser plugin id' };
    }
    writeDiagnosticEvent('browser-plugin', 'launch-start', { pluginId });
    const result = await launchBrowserPlugin(pluginId);
    writeDiagnosticEvent('browser-plugin', result.success ? 'launch-success' : 'launch-failure', { pluginId, result });
    return result;
  });

  ipcMain.handle('get-automation-apps', () => getCoreAutomationApps());

  ipcMain.handle('launch-automation-app', async (_event, appId, options = {}) => {
    if (typeof appId !== 'string' || !appId) {
      return { success: false, error: 'Invalid automation app id' };
    }
    const launchOptions = options && typeof options === 'object' ? options : {};
    writeDiagnosticEvent('web-automation', 'launch-start', { appId, forceUpdate: Boolean(launchOptions.forceUpdate) });
    const result = await launchCoreAutomationApp(appId, launchOptions);
    writeDiagnosticEvent('web-automation', result.success ? 'launch-success' : 'launch-failure', { appId, forceUpdate: Boolean(launchOptions.forceUpdate), result });
    return result;
  });

  ipcMain.handle('stop-automation-app', async (_event, appId) => {
    if (typeof appId !== 'string' || !appId) {
      return { success: false, error: 'Invalid automation app id' };
    }
    const result = await stopCoreAutomationApp(appId);
    writeDiagnosticEvent('web-automation', result.success ? 'stop-success' : 'stop-failure', { appId, result });
    return result;
  });

  ipcMain.handle('select-directory', async (_event, options = {}) => {
    try {
      const dialogOptions = options && typeof options === 'object' ? options : {};
      const title = typeof dialogOptions.title === 'string' && dialogOptions.title.trim()
        ? dialogOptions.title.trim()
        : '选择文件夹';
      const defaultPath = typeof dialogOptions.defaultPath === 'string' && dialogOptions.defaultPath.trim()
        ? dialogOptions.defaultPath.trim()
        : undefined;
      const result = await dialog.showOpenDialog(mainWindow, {
        title,
        defaultPath,
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || !result.filePaths || !result.filePaths[0]) {
        return { success: true, canceled: true };
      }
      return { success: true, canceled: false, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('launch-external-module', async (_event, moduleId) => {
    const moduleInfo = getExternalModulePath(moduleId);
    if (!moduleInfo) {
      return { success: false, error: `Unknown module: ${moduleId}` };
    }

    if (!fs.existsSync(moduleInfo.executablePath)) {
      return {
        success: false,
        error: `Module executable not found: ${moduleInfo.executablePath}`
      };
    }

    try {
      const child = spawn(moduleInfo.executablePath, [], {
        cwd: moduleInfo.baseDir,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      const result = {
        success: true,
        moduleId,
        path: moduleInfo.executablePath
      };
      writeDiagnosticEvent('external-module', 'launch-success', { moduleId, path: moduleInfo.executablePath });
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      writeDiagnosticEvent('external-module', 'launch-failure', { moduleId, result });
      return result;
    }
  });

  registerAdidasMaterialsCollector({
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    getParentWindow: () => mainWindow
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadRendererFallbackPage(browserWindow, message, details = {}) {
  const detailRows = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>TOS 启动失败</title>
  <style>
    body { margin: 0; font-family: "Microsoft YaHei", Arial, sans-serif; background: #f4f8fb; color: #102033; }
    main { max-width: 760px; margin: 72px auto; padding: 32px; background: #fff; border: 1px solid #d8e2ec; border-radius: 8px; }
    h1 { margin: 0 0 16px; font-size: 28px; }
    p { margin: 0 0 20px; color: #506176; line-height: 1.7; }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; margin: 0; font-size: 13px; }
    dt { color: #6b7b8f; }
    dd { margin: 0; word-break: break-all; font-family: Consolas, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>TOS 启动失败</h1>
    <p>${escapeHtml(message)}</p>
    <dl>${detailRows}</dl>
  </main>
</body>
</html>`;
  browserWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function loadPackagedRenderer(browserWindow) {
  const appPath = app.getAppPath();
  const indexPath = path.join(appPath, 'dist-frontend', 'index.html');

  if (!fs.existsSync(indexPath)) {
    const payload = {
      appPath,
      indexPath,
      resourcesPath: process.resourcesPath
    };
    writeDiagnosticEvent('frontend', 'index-missing', payload);
    // 生产包缺前端入口时直接显示错误页，避免用户只看到空白窗口。
    loadRendererFallbackPage(browserWindow, '未找到前端入口文件，请重新安装完整安装包。', payload);
    return;
  }

  browserWindow.loadFile(indexPath).catch((error) => {
    const payload = {
      appPath,
      indexPath,
      error: error instanceof Error ? error.message : String(error)
    };
    writeDiagnosticEvent('frontend', 'load-failure', payload);
    loadRendererFallbackPage(browserWindow, '前端页面加载失败，请导出诊断包后反馈。', payload);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: APP_DISPLAY_NAME
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeDiagnosticEvent('frontend', 'did-fail-load', {
      errorCode,
      errorDescription,
      validatedURL
    });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeDiagnosticEvent('frontend', 'render-process-gone', details);
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    loadPackagedRenderer(mainWindow);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowedUrl = normalizeAllowedExternalUrl(url, { updateFeedUrl });
    if (allowedUrl) {
      shell.openExternal(allowedUrl);
    }
    return { action: 'deny' };
  });
}

const initialProtocolUrl = extractProtocolUrl(process.argv);
const automationLauncherBootstrapOnly = hasAutomationLauncherBackgroundFlag(process.argv)
  || isAutomationLauncherProtocolUrl(initialProtocolUrl);
const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const incomingUrl = extractProtocolUrl(commandLine);
    if (incomingUrl) {
      queueProtocolCommand(incomingUrl);
    }

    if (!isAutomationLauncherProtocolUrl(incomingUrl) && mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    queueProtocolCommand(url);
  });
}

registerIpcHandlers();
app.whenReady().then(async () => {
  registerAutomationProtocol();
  if (automationLauncherBootstrapOnly) {
    try {
      await ensureAutomationLauncher();
      writeDiagnosticEvent('web-automation', 'launcher-bootstrap-success', {
        url: AUTOMATION_LAUNCHER_URL,
        mode: hasAutomationLauncherBackgroundFlag(process.argv) ? 'background-flag' : 'protocol',
      });
    } catch (error) {
      writeDiagnosticEvent('web-automation', 'launcher-bootstrap-failure', {
        error: error instanceof Error ? error.message : String(error),
      });
      app.exit(1);
      return;
    }

    if (initialProtocolUrl) {
      queueProtocolCommand(initialProtocolUrl);
    }
    await flushProtocolCommands();
    app.quit();
    return;
  }
  // 正式界面不暴露 Electron 默认菜单，避免与业务导航重复。
  Menu.setApplicationMenu(null);
  createWindow();

  const backendStatus = await startBackendServer();
  if (!backendStatus.success) {
    console.error(`Backend startup failed: ${backendStatus.error}`);
    writeDiagnosticEvent('backend', 'startup-failure', backendStatus);
  } else {
    writeDiagnosticEvent('backend', 'startup-success', backendStatus);
  }
  writeDiagnosticEvent('web-automation', 'embedded-automation-ready', {
    automationAppRoot: getAutomationAppRoot(),
    launcherMode: 'browser-only',
  });
  if (initialProtocolUrl) {
    queueProtocolCommand(initialProtocolUrl);
  }
  void flushProtocolCommands();
  configureAutoUpdater();
  if (app.isPackaged && updateFeedUrl && !isPlaceholderUpdateFeedUrl(updateFeedUrl)) {
    setTimeout(() => {
      checkForUpdates().catch((error) => {
        writeDiagnosticEvent('updater', 'startup-check-failure', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, 4000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});
