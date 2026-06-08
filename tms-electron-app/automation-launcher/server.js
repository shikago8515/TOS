const http = require('http')
const path = require('path')
const { launchAdidasMaterialsCollector } = require('./adidas-materials-direct')
const {
  getAutomationApps,
  launchAutomationApp,
  resolveUserDataDir,
  shutdownAutomationApps,
  stopAutomationApp,
} = require('./core')

const processMap = new Map()
const host = process.env.TMS_AUTOMATION_LAUNCHER_HOST || '127.0.0.1'
const port = Number(process.env.TMS_AUTOMATION_LAUNCHER_PORT || 3210)
const automationAppRoot = process.env.TMS_AUTOMATION_APP_ROOT
  ? path.resolve(process.env.TMS_AUTOMATION_APP_ROOT)
  : path.resolve(__dirname, '..', 'automation-apps')
const userDataDir = resolveUserDataDir({
  userDataDir: process.env.TMS_AUTOMATION_LAUNCHER_DATA_DIR,
  appName: process.env.TMS_AUTOMATION_APP_NAME || 'TOS',
})

const sharedOptions = {
  automationAppRoot,
  processMap,
  userDataDir,
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

    if (req.method === 'GET' && (requestUrl.pathname === '/health' || requestUrl.pathname === '/api/health')) {
      sendJson(res, 200, {
        ok: true,
        host,
        port,
        pid: process.pid,
        automationAppRoot,
        userDataDir,
        trackedAppCount: processMap.size,
      })
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function shutdown() {
  server.close(() => {
    shutdownAutomationApps(sharedOptions)
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
