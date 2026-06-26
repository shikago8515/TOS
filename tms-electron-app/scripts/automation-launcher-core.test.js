const assert = require('assert')
const fs = require('fs')
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
