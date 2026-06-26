const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { launchAdidasMaterialsCollector } = require('./adidas-materials-direct')
const {
  getAutomationApps,
  launchAutomationApp,
  loadAutomationAppRegistry,
  resolveUserDataDir,
  shutdownAutomationApps,
  stopAutomationApp,
} = require('./core')

const processMap = new Map()
const host = process.env.TMS_AUTOMATION_LAUNCHER_HOST || '127.0.0.1'
const port = Number(process.env.TMS_AUTOMATION_LAUNCHER_PORT || 3210)
const helperPackageId = process.env.TOS_AUTOMATION_HELPER_PACKAGE_ID || 'automation-helper'
const installerVersionsUrl = process.env.TOS_INSTALLER_VERSIONS_URL
  || 'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/installer-versions'
const helperInstallerDownloadUrl = process.env.TOS_AUTOMATION_HELPER_DOWNLOAD_URL
  || 'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/automation-helper/download'
const automationModuleManifestUrl = process.env.TOS_AUTOMATION_MODULE_MANIFEST_URL
  || process.env.TMS_AUTOMATION_MODULE_MANIFEST_URL
  || 'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/automation-modules'
const enableModuleUpdates = process.env.TOS_AUTOMATION_MODULE_UPDATES !== '0'
const automationAppRoot = process.env.TMS_AUTOMATION_APP_ROOT
  ? path.resolve(process.env.TMS_AUTOMATION_APP_ROOT)
  : path.resolve(__dirname, '..', 'automation-apps')
const userDataDir = resolveUserDataDir({
  userDataDir: process.env.TMS_AUTOMATION_LAUNCHER_DATA_DIR,
  appName: process.env.TMS_AUTOMATION_APP_NAME || 'TOS',
})

const helperVersion = resolveHelperVersion()
const sharedOptions = {
  automationAppRoot,
  processMap,
  userDataDir,
  helperVersion,
  automationModuleManifestUrl,
  enableModuleUpdates,
  baseEnv: helperVersion
    ? { TOS_AUTOMATION_HELPER_VERSION: helperVersion }
    : {},
}

const server = http.createServer(async (req, res) => {
  try {
    setCorsHeaders(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`)

    if (req.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/update')) {
      sendHtml(res, 200, renderUpdatePanelHtml())
      return
    }

    if (req.method === 'GET' && (requestUrl.pathname === '/health' || requestUrl.pathname === '/api/health')) {
      sendJson(res, 200, {
        ok: true,
        version: helperVersion,
        helperVersion,
        host,
        port,
        pid: process.pid,
        automationAppRoot,
        userDataDir,
        automationModuleManifestUrl,
        enableModuleUpdates,
        trackedAppCount: processMap.size,
      })
      return
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/update/status') {
      const status = await getHelperUpdateStatus()
      sendJson(res, status.ok ? 200 : 502, status)
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/update/download') {
      const status = await getHelperUpdateStatus()
      if (!status.ok) {
        sendJson(res, 502, status)
        return
      }

      const result = await downloadLatestHelperInstaller(status)
      sendJson(res, result.success ? 200 : 500, result)
      return
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/apps') {
      const apps = await getAutomationApps(sharedOptions)
      sendJson(res, 200, {
        ok: true,
        apps,
      })
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/adidas-materials/start') {
      const result = await launchAdidasMaterialsCollector({ userDataDir })
      sendJson(res, result.success ? 200 : 500, result)
      return
    }

    const appRouteMatch = requestUrl.pathname.match(/^\/api\/apps\/([^/]+)\/(start|stop)$/)
    if (req.method === 'POST' && appRouteMatch) {
      const appId = decodeURIComponent(appRouteMatch[1])
      const action = appRouteMatch[2]
      const result = action === 'start'
        ? await launchAutomationApp(appId, sharedOptions)
        : stopAutomationApp(appId, sharedOptions)
      sendJson(res, result.success ? 200 : 500, result)
      return
    }

    sendJson(res, 404, {
      ok: false,
      message: 'Not found',
      path: requestUrl.pathname,
      method: req.method,
    })
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(port, host, () => {
  console.log(`Automation launcher listening on http://${host}:${port}`)
})

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function resolveHelperVersion() {
  const envVersion = String(process.env.TOS_AUTOMATION_HELPER_VERSION || '').trim()
  if (envVersion) {
    return envVersion
  }

  const helperVersionPath = process.env.TOS_AUTOMATION_HELPER_VERSION_FILE
    ? path.resolve(process.env.TOS_AUTOMATION_HELPER_VERSION_FILE)
    : path.resolve(__dirname, '..', 'automation-helper-version.json')
  try {
    const payload = JSON.parse(fs.readFileSync(helperVersionPath, 'utf8'))
    const fileVersion = String(payload.version || '').trim()
    if (fileVersion) {
      return fileVersion
    }
  } catch (_error) {
    // Fall back to legacy registry-derived helper versions for older payloads.
  }

  const versions = loadAutomationAppRegistry(automationAppRoot)
    .map((app) => String(app.version || '').trim())
    .filter(Boolean)
  return versions[0] || ''
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
  })
  res.end(html)
}

async function getHelperUpdateStatus() {
  try {
    const manifest = await requestJson(installerVersionsUrl)
    const packages = Array.isArray(manifest.packages) ? manifest.packages : []
    const packageInfo = packages.find((item) => item && item.id === helperPackageId)

    if (!packageInfo) {
      return {
        ok: false,
        currentVersion: helperVersion,
        latestVersion: '',
        updateAvailable: false,
        message: `Installer package not found in manifest: ${helperPackageId}`,
      }
    }

    const latestVersion = String(packageInfo.version || manifest.version || '').trim()
    const currentVersion = String(helperVersion || '').trim()
    const updateAvailable = latestVersion
      ? compareVersionStrings(latestVersion, currentVersion) > 0
      : false

    return {
      ok: true,
      currentVersion,
      latestVersion,
      updateAvailable,
      manifestVersion: String(manifest.version || '').trim(),
      manifestUpdatedAt: typeof manifest.manifestUpdatedAt === 'string' ? manifest.manifestUpdatedAt : null,
      downloadUrl: helperInstallerDownloadUrl,
      package: normalizeInstallerPackage(packageInfo),
    }
  } catch (error) {
    return {
      ok: false,
      currentVersion: helperVersion,
      latestVersion: '',
      updateAvailable: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function downloadLatestHelperInstaller(status) {
  if (!status.updateAvailable) {
    return {
      success: true,
      downloaded: false,
      opened: false,
      message: 'Current helper is already up to date.',
      status,
    }
  }

  const packageInfo = status.package || {}
  const filename = sanitizeFilename(
    packageInfo.filename
      || packageInfo.defaultFilename
      || `TOS-Automation-Helper-Setup-${status.latestVersion || 'latest'}.exe`,
  )
  const downloadDir = path.join(os.homedir(), 'Downloads')
  const installerPath = path.join(downloadDir, filename)
  const tempPath = `${installerPath}.download`

  try {
    await fs.promises.mkdir(downloadDir, { recursive: true })
    await safeUnlink(tempPath)
    await downloadFile(status.downloadUrl, tempPath)

    if (packageInfo.sha256) {
      const actualSha256 = await hashFile(tempPath)
      if (actualSha256.toLowerCase() !== String(packageInfo.sha256).toLowerCase()) {
        await safeUnlink(tempPath)
        throw new Error('Downloaded installer checksum does not match server manifest.')
      }
    }

    await safeUnlink(installerPath)
    await fs.promises.rename(tempPath, installerPath)
    const opened = openInstaller(installerPath)

    return {
      success: true,
      downloaded: true,
      opened,
      installerPath,
      status,
    }
  } catch (error) {
    await safeUnlink(tempPath)
    return {
      success: false,
      downloaded: false,
      opened: false,
      installerPath,
      error: error instanceof Error ? error.message : String(error),
      status,
    }
  }
}

function normalizeInstallerPackage(packageInfo) {
  return {
    id: String(packageInfo.id || ''),
    label: String(packageInfo.label || ''),
    version: String(packageInfo.version || ''),
    filename: String(packageInfo.filename || ''),
    defaultFilename: String(packageInfo.defaultFilename || ''),
    fileSize: typeof packageInfo.fileSize === 'number' ? packageInfo.fileSize : null,
    sha256: typeof packageInfo.sha256 === 'string' ? packageInfo.sha256 : null,
    updatedAt: typeof packageInfo.updatedAt === 'string' ? packageInfo.updatedAt : null,
  }
}

function requestJson(url, timeoutMs = 8000, redirectCount = 0) {
  return requestText(url, timeoutMs, redirectCount).then((body) => JSON.parse(body))
}

function requestText(url, timeoutMs = 8000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects while requesting update manifest.'))
      return
    }

    const client = url.startsWith('https:') ? https : http
    const request = client.get(url, { timeout: timeoutMs }, (response) => {
      const statusCode = response.statusCode || 0
      const redirectLocation = response.headers.location

      if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
        response.resume()
        const nextUrl = new URL(redirectLocation, url).toString()
        requestText(nextUrl, timeoutMs, redirectCount + 1).then(resolve, reject)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume()
        reject(new Error(`Request failed with status ${statusCode}.`))
        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => resolve(body))
    })

    request.on('timeout', () => request.destroy(new Error('Request timed out.')))
    request.on('error', reject)
  })
}

function downloadFile(url, targetPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects while downloading installer.'))
      return
    }

    const client = url.startsWith('https:') ? https : http
    const request = client.get(url, { timeout: 60000 }, (response) => {
      const statusCode = response.statusCode || 0
      const redirectLocation = response.headers.location

      if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
        response.resume()
        const nextUrl = new URL(redirectLocation, url).toString()
        downloadFile(nextUrl, targetPath, redirectCount + 1).then(resolve, reject)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume()
        reject(new Error(`Installer download failed with status ${statusCode}.`))
        return
      }

      const file = fs.createWriteStream(targetPath)
      response.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    })

    request.on('timeout', () => request.destroy(new Error('Installer download timed out.')))
    request.on('error', reject)
  })
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function safeUnlink(filePath) {
  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error
    }
  }
}

function openInstaller(installerPath) {
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/c', 'start', '', installerPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      return true
    }

    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
    const child = spawn(opener, [installerPath], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    return true
  } catch (_error) {
    return false
  }
}

function sanitizeFilename(filename) {
  const value = String(filename || '').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  return value || 'TOS-Automation-Helper-Setup.exe'
}

function compareVersionStrings(left, right) {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)
  const mainLength = Math.max(leftVersion.main.length, rightVersion.main.length, 3)

  for (let index = 0; index < mainLength; index += 1) {
    const leftPart = leftVersion.main[index] || 0
    const rightPart = rightVersion.main[index] || 0
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1
    }
  }

  if (leftVersion.pre.length === 0 && rightVersion.pre.length > 0) return 1
  if (leftVersion.pre.length > 0 && rightVersion.pre.length === 0) return -1

  const preLength = Math.max(leftVersion.pre.length, rightVersion.pre.length)
  for (let index = 0; index < preLength; index += 1) {
    const leftPart = leftVersion.pre[index]
    const rightPart = rightVersion.pre[index]
    if (leftPart === undefined && rightPart !== undefined) return -1
    if (leftPart !== undefined && rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    const leftNumber = Number(leftPart)
    const rightNumber = Number(rightPart)
    const leftNumeric = Number.isFinite(leftNumber) && String(leftNumber) === leftPart
    const rightNumeric = Number.isFinite(rightNumber) && String(rightNumber) === rightPart

    if (leftNumeric && rightNumeric) return leftNumber > rightNumber ? 1 : -1
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return String(leftPart).localeCompare(String(rightPart))
  }

  return 0
}

function parseVersion(version) {
  const normalized = String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('+')[0]
  const [mainPart = '', prePart = ''] = normalized.split('-', 2)
  const main = mainPart
    .split('.')
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) ? part : 0))
  const pre = prePart
    ? prePart.split('.').map((part) => part.trim()).filter(Boolean)
    : []

  return { main, pre }
}

function renderUpdatePanelHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TOS 自动化助手更新</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --surface: #ffffff;
      --border: #dbe5f0;
      --text: #142033;
      --muted: #64748b;
      --primary: #0f766e;
      --primary-soft: #e8fbf7;
      --warning: #b45309;
      --warning-soft: #fff7ed;
      --danger: #b91c1c;
      --danger-soft: #fef2f2;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    main {
      width: min(860px, calc(100% - 32px));
      margin: 0 auto;
      padding: 36px 0;
    }

    .panel {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 24px 28px;
      border-bottom: 1px solid var(--border);
      background: #fbfdff;
    }

    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }

    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.7;
    }

    .status-pill {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border-radius: 999px;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    .body {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      padding: 24px 28px 10px;
    }

    .metric {
      min-height: 92px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
    }

    .metric span {
      display: block;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .metric strong {
      display: block;
      margin-top: 10px;
      font-size: 22px;
      line-height: 1.2;
      word-break: break-all;
    }

    .message {
      margin: 6px 28px 0;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--muted);
      background: #f8fafc;
      line-height: 1.7;
      font-size: 14px;
    }

    .message.warning {
      border-color: #fed7aa;
      background: var(--warning-soft);
      color: var(--warning);
    }

    .message.error {
      border-color: #fecaca;
      background: var(--danger-soft);
      color: var(--danger);
    }

    footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 28px 26px;
    }

    button {
      min-height: 38px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0 16px;
      background: #ffffff;
      color: var(--text);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    button.primary {
      border-color: var(--primary);
      background: var(--primary);
      color: #ffffff;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .path {
      margin: 0 28px 24px;
      color: var(--muted);
      font-size: 12px;
      word-break: break-all;
    }

    @media (max-width: 680px) {
      header {
        flex-direction: column;
        align-items: flex-start;
      }

      .body {
        grid-template-columns: 1fr;
      }

      footer {
        flex-direction: column;
      }

      button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <header>
        <div>
          <h1>TOS 自动化助手更新</h1>
          <p class="subtitle">检查本机网页桥接小助手是否为服务器最新版本，并下载最新版安装包进行覆盖安装。</p>
        </div>
        <span id="statusPill" class="status-pill">正在检查</span>
      </header>
      <div class="body">
        <div class="metric">
          <span>当前版本</span>
          <strong id="currentVersion">-</strong>
        </div>
        <div class="metric">
          <span>服务器最新版本</span>
          <strong id="latestVersion">-</strong>
        </div>
      </div>
      <div id="message" class="message">正在连接服务器版本清单...</div>
      <footer>
        <button id="checkButton" type="button">检查最新版</button>
        <button id="downloadButton" class="primary" type="button" disabled>下载并打开安装包</button>
      </footer>
      <p id="pathText" class="path"></p>
    </section>
  </main>
  <script>
    const currentVersion = document.getElementById('currentVersion')
    const latestVersion = document.getElementById('latestVersion')
    const statusPill = document.getElementById('statusPill')
    const message = document.getElementById('message')
    const checkButton = document.getElementById('checkButton')
    const downloadButton = document.getElementById('downloadButton')
    const pathText = document.getElementById('pathText')
    let lastStatus = null

    async function checkStatus() {
      setBusy(true, '正在检查')
      message.className = 'message'
      message.textContent = '正在连接服务器版本清单...'
      pathText.textContent = ''

      try {
        const response = await fetch('/api/update/status')
        const payload = await response.json()
        lastStatus = payload
        renderStatus(payload)
      } catch (error) {
        statusPill.textContent = '检查失败'
        message.className = 'message error'
        message.textContent = error && error.message ? error.message : String(error)
        downloadButton.disabled = true
      } finally {
        setBusy(false)
      }
    }

    function renderStatus(payload) {
      currentVersion.textContent = formatVersion(payload.currentVersion)
      latestVersion.textContent = formatVersion(payload.latestVersion)

      if (!payload.ok) {
        statusPill.textContent = '无法连接'
        message.className = 'message error'
        message.textContent = payload.message || '无法获取服务器版本清单。'
        downloadButton.disabled = true
        return
      }

      if (payload.updateAvailable) {
        statusPill.textContent = '发现更新'
        message.className = 'message warning'
        message.textContent = '服务器已有最新版小助手。点击“下载并打开安装包”后，安装包会保存到本机下载目录并自动打开，请按安装向导覆盖安装。'
        downloadButton.disabled = false
        return
      }

      statusPill.textContent = '已是最新'
      message.className = 'message'
      message.textContent = '当前小助手版本已经和服务器保持一致。'
      downloadButton.disabled = true
    }

    async function downloadUpdate() {
      if (!lastStatus || !lastStatus.ok || !lastStatus.updateAvailable) {
        return
      }

      setBusy(true, '正在下载')
      message.className = 'message warning'
      message.textContent = '正在下载最新版安装包，请稍候...'
      pathText.textContent = ''

      try {
        const response = await fetch('/api/update/download', { method: 'POST' })
        const payload = await response.json()

        if (!payload.success) {
          throw new Error(payload.error || payload.message || '下载安装包失败。')
        }

        statusPill.textContent = payload.opened ? '已打开安装包' : '下载完成'
        message.className = 'message'
        message.textContent = payload.opened
          ? '安装包已打开，请按安装向导覆盖安装最新小助手。'
          : '安装包已下载，请在下载目录中打开并覆盖安装。'
        pathText.textContent = payload.installerPath ? '保存位置：' + payload.installerPath : ''
      } catch (error) {
        statusPill.textContent = '下载失败'
        message.className = 'message error'
        message.textContent = error && error.message ? error.message : String(error)
      } finally {
        setBusy(false)
      }
    }

    function setBusy(isBusy, label) {
      checkButton.disabled = isBusy
      downloadButton.disabled = isBusy || !lastStatus || !lastStatus.updateAvailable
      if (label) {
        statusPill.textContent = label
      }
    }

    function formatVersion(version) {
      if (!version) return '-'
      return /^v/i.test(version) ? version : 'V' + version
    }

    checkButton.addEventListener('click', checkStatus)
    downloadButton.addEventListener('click', downloadUpdate)
    checkStatus()
  </script>
</body>
</html>`
}

function shutdown() {
  server.close(() => {
    shutdownAutomationApps(sharedOptions)
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
