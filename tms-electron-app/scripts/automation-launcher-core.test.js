const assert = require('assert')
const fs = require('fs')
const { spawn } = require('child_process')
const net = require('net')
const os = require('os')
const path = require('path')
const test = require('node:test')

const {
  getAutomationAppById,
  getAutomationApps,
  launchAutomationApp,
  shutdownAutomationApps,
} = require('../automation-launcher/core')

test('automation launcher app info includes required helper version', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-launcher-app-info-'))
  const automationAppRoot = path.join(root, 'automation-apps')
  const appDir = path.join(automationAppRoot, 'demo-app')
  fs.mkdirSync(path.join(appDir, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(appDir, 'bin', 'start.js'), '')
  fs.writeFileSync(
    path.join(automationAppRoot, 'registry.json'),
    JSON.stringify([
      {
        id: 'demo-app',
        name: 'Demo App',
        version: '0.9.8-beta.3.28',
        requiredHelperVersion: '0.9.8-beta.3.27',
        appDir: 'demo-app',
        entry: 'bin/start.js',
        defaultPort: 3999,
      },
    ], null, 2),
  )

  const apps = await getAutomationApps({
    automationAppRoot,
    processMap: new Map(),
  })

  assert.equal(apps.length, 1)
  assert.equal(apps[0].requiredHelperVersion, '0.9.8-beta.3.27')
})

test('automation launcher prefers cached automation module over bundled app', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-launcher-module-cache-'))
  const automationAppRoot = path.join(root, 'automation-apps')
  const userDataDir = path.join(root, 'user-data')
  const bundledAppDir = path.join(automationAppRoot, 'demo-app')
  const cachedAppDir = path.join(
    userDataDir,
    'automation-module-cache',
    'demo-app',
    '1.1.0',
    'app',
  )

  fs.mkdirSync(path.join(bundledAppDir, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(bundledAppDir, 'bin', 'start.js'), '')
  fs.writeFileSync(
    path.join(automationAppRoot, 'registry.json'),
    JSON.stringify([
      {
        id: 'demo-app',
        name: 'Demo App',
        version: '1.0.0',
        appDir: 'demo-app',
        entry: 'bin/start.js',
        defaultPort: 3999,
      },
    ], null, 2),
  )

  fs.mkdirSync(path.join(cachedAppDir, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(cachedAppDir, 'bin', 'start.js'), '')
  fs.writeFileSync(
    path.join(userDataDir, 'automation-module-cache', 'demo-app', 'current.json'),
    JSON.stringify({
      id: 'demo-app',
      name: 'Demo App',
      version: '1.1.0',
      entry: 'bin/start.js',
      defaultPort: 3999,
      versionSegment: '1.1.0',
      baseDir: path.join('1.1.0', 'app'),
      sha256: 'b'.repeat(64),
      installedAt: '2026-06-26T02:00:00.000Z',
    }, null, 2),
  )

  const options = {
    automationAppRoot,
    userDataDir,
    processMap: new Map(),
  }
  const apps = await getAutomationApps(options)
  const app = getAutomationAppById('demo-app', options)

  assert.equal(apps.length, 1)
  assert.equal(apps[0].version, '1.1.0')
  assert.equal(apps[0].moduleSource, 'remote-cache')
  assert.equal(app.version, '1.1.0')
  assert.equal(app.moduleSource, 'remote-cache')
  assert(app.entryPath.includes(path.join('automation-module-cache', 'demo-app', '1.1.0', 'app')))
})

test('automation launcher injects helper version when starting an app', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-launcher-helper-env-'))
  const automationAppRoot = path.join(root, 'automation-apps')
  const userDataDir = path.join(root, 'user-data')
  const appDir = path.join(automationAppRoot, 'demo-app')
  const port = await getFreePort()
  const processMap = new Map()

  fs.mkdirSync(path.join(appDir, 'bin'), { recursive: true })
  fs.writeFileSync(
    path.join(appDir, 'bin', 'start.js'),
    [
      "const fs = require('fs')",
      "const http = require('http')",
      "const path = require('path')",
      "const dataDir = process.env.TMS_PLAYWRIGHT_DATA_DIR",
      "fs.mkdirSync(dataDir, { recursive: true })",
      "fs.writeFileSync(path.join(dataDir, 'helper-version.txt'), process.env.TOS_AUTOMATION_HELPER_VERSION || '')",
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/api/health') {",
      "    res.writeHead(200, { 'Content-Type': 'application/json' })",
      "    res.end(JSON.stringify({ ok: true }))",
      "    return",
      "  }",
      "  res.writeHead(404)",
      "  res.end()",
      "})",
      "server.listen(Number(process.env.TMS_PLAYWRIGHT_PORT), '127.0.0.1')",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)))",
      "process.on('SIGINT', () => server.close(() => process.exit(0)))",
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(automationAppRoot, 'registry.json'),
    JSON.stringify([
      {
        id: 'demo-app',
        name: 'Demo App',
        version: '0.9.8-beta.3.28',
        appDir: 'demo-app',
        entry: 'bin/start.js',
        defaultPort: port,
      },
    ], null, 2),
  )

  try {
    const result = await launchAutomationApp('demo-app', {
      automationAppRoot,
      userDataDir,
      processMap,
      processExecPath: process.execPath,
      helperVersion: '0.9.8-beta.3.19',
    })

    assert.equal(result.success, true)
    assert.equal(
      fs.readFileSync(path.join(userDataDir, 'automation-apps', 'demo-app', 'helper-version.txt'), 'utf8'),
      '0.9.8-beta.3.19',
    )
  } finally {
    shutdownAutomationApps({ processMap })
  }
})

test('automation launcher restarts an old running app when cached module is newer', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-launcher-restart-old-app-'))
  const automationAppRoot = path.join(root, 'automation-apps')
  const userDataDir = path.join(root, 'user-data')
  const bundledAppDir = path.join(automationAppRoot, 'demo-app')
  const cachedAppDir = path.join(
    userDataDir,
    'automation-module-cache',
    'demo-app',
    '1.1.0',
    'app',
  )
  const port = await getFreePort()
  const processMap = new Map()
  const oldLogFd = fs.openSync(path.join(root, 'old-app.log'), 'a')

  fs.mkdirSync(path.join(bundledAppDir, 'bin'), { recursive: true })
  fs.writeFileSync(path.join(bundledAppDir, 'bin', 'start.js'), '')
  fs.writeFileSync(
    path.join(automationAppRoot, 'registry.json'),
    JSON.stringify([
      {
        id: 'demo-app',
        name: 'Demo App',
        version: '1.0.0',
        appDir: 'demo-app',
        entry: 'bin/start.js',
        defaultPort: port,
      },
    ], null, 2),
  )

  fs.mkdirSync(path.join(cachedAppDir, 'bin'), { recursive: true })
  fs.writeFileSync(
    path.join(cachedAppDir, 'bin', 'start.js'),
    [
      "const fs = require('fs')",
      "const http = require('http')",
      "const path = require('path')",
      "const dataDir = process.env.TMS_PLAYWRIGHT_DATA_DIR",
      "fs.mkdirSync(dataDir, { recursive: true })",
      "fs.writeFileSync(path.join(dataDir, 'started-module-version.txt'), process.env.TOS_AUTOMATION_MODULE_VERSION || '')",
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/api/health') {",
      "    res.writeHead(200, { 'Content-Type': 'application/json' })",
      "    res.end(JSON.stringify({ ok: true, moduleVersion: process.env.TOS_AUTOMATION_MODULE_VERSION || '' }))",
      "    return",
      "  }",
      "  res.writeHead(404)",
      "  res.end()",
      "})",
      "server.listen(Number(process.env.TMS_PLAYWRIGHT_PORT), '127.0.0.1')",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)))",
      "process.on('SIGINT', () => server.close(() => process.exit(0)))",
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(userDataDir, 'automation-module-cache', 'demo-app', 'current.json'),
    JSON.stringify({
      id: 'demo-app',
      name: 'Demo App',
      version: '1.1.0',
      entry: 'bin/start.js',
      defaultPort: port,
      versionSegment: '1.1.0',
      baseDir: path.join('1.1.0', 'app'),
      sha256: 'c'.repeat(64),
      installedAt: '2026-06-26T02:00:00.000Z',
    }, null, 2),
  )

  const oldScriptPath = path.join(root, 'old-app.js')
  fs.writeFileSync(
    oldScriptPath,
    [
      "const http = require('http')",
      "const server = http.createServer((req, res) => {",
      "  if (req.url === '/api/health') {",
      "    res.writeHead(200, { 'Content-Type': 'application/json' })",
      "    res.end(JSON.stringify({ ok: true }))",
      "    return",
      "  }",
      "  res.writeHead(404)",
      "  res.end()",
      "})",
      "server.listen(Number(process.env.TMS_PLAYWRIGHT_PORT), '127.0.0.1')",
      "process.on('SIGTERM', () => server.close(() => process.exit(0)))",
    ].join('\n'),
  )
  const oldChild = spawn(process.execPath, [oldScriptPath], {
    env: { ...process.env, TMS_PLAYWRIGHT_PORT: String(port) },
    stdio: ['ignore', oldLogFd, oldLogFd],
  })
  processMap.set('demo-app', { child: oldChild, logFd: oldLogFd, logPath: path.join(root, 'old-app.log') })

  try {
    assert.equal(await waitForHealth(`http://127.0.0.1:${port}/api/health`), true)
    const result = await launchAutomationApp('demo-app', {
      automationAppRoot,
      userDataDir,
      processMap,
      processExecPath: process.execPath,
      enableModuleUpdates: false,
    })

    assert.equal(result.success, true)
    assert.notEqual(result.alreadyRunning, true)
    assert.equal(
      fs.readFileSync(path.join(userDataDir, 'automation-apps', 'demo-app', 'started-module-version.txt'), 'utf8'),
      '1.1.0',
    )
  } finally {
    shutdownAutomationApps({ processMap })
    if (!oldChild.killed) oldChild.kill()
  }
})

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function waitForHealth(url, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch (_error) {
      // Keep waiting while the test server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}
