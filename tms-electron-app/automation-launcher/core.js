const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

function resolveUserDataDir(options = {}) {
  const explicitDir = typeof options.userDataDir === 'string' ? options.userDataDir.trim() : ''
  if (explicitDir) {
    return path.resolve(explicitDir)
  }

  const envDir = typeof process.env.TMS_AUTOMATION_LAUNCHER_DATA_DIR === 'string'
    ? process.env.TMS_AUTOMATION_LAUNCHER_DATA_DIR.trim()
    : ''
  if (envDir) {
    return path.resolve(envDir)
  }

  const appName = typeof options.appName === 'string' && options.appName.trim()
    ? options.appName.trim()
    : 'TOS'
  const roamingRoot = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return path.join(roamingRoot, appName)
}

function getAutomationAppUrl(automationApp) {
  const port = Number(automationApp.defaultPort || automationApp.port || 3100)
  return `http://127.0.0.1:${port}`
}

function loadAutomationAppRegistry(automationAppRoot) {
  const registryPath = path.join(automationAppRoot, 'registry.json')
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    return Array.isArray(registry) ? registry : []
  } catch (error) {
    console.error(`Automation app registry load failed: ${error.message}`)
    return []
  }
}

function getAutomationAppPath(automationAppRoot, automationApp) {
  const appDir = automationApp.appDir || automationApp.id
  return path.join(automationAppRoot, appDir)
}

function getAutomationAppById(appId, options) {
  const registry = loadAutomationAppRegistry(options.automationAppRoot)
  const automationApp = registry.find((item) => item.id === appId)
  if (!automationApp) {
    return null
  }

  const baseDir = getAutomationAppPath(options.automationAppRoot, automationApp)
  return {
    ...automationApp,
    baseDir,
    entryPath: path.join(baseDir, automationApp.entry || 'bin/start.js'),
    port: Number(automationApp.defaultPort || 3100),
    url: getAutomationAppUrl(automationApp),
  }
}

function getAutomationDataDir(userDataDir, appId) {
  return path.join(userDataDir, 'automation-apps', appId)
}

function requestJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch (_error) {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(null)
    })
  })
}

async function requestAutomationAppHealth(automationApp, timeoutMs = 1500) {
  const payload = await requestJson(`${automationApp.url || getAutomationAppUrl(automationApp)}/api/health`, timeoutMs)
  return Boolean(payload && payload.ok)
}

async function getAutomationApps(options) {
  const registry = loadAutomationAppRegistry(options.automationAppRoot)
  const processMap = options.processMap || new Map()

  return Promise.all(registry.map(async (automationApp) => {
    const baseDir = getAutomationAppPath(options.automationAppRoot, automationApp)
    const entryPath = path.join(baseDir, automationApp.entry || 'bin/start.js')
    const port = Number(automationApp.defaultPort || 3100)
    const url = getAutomationAppUrl(automationApp)
    const tracked = processMap.get(automationApp.id)
    const running = (tracked && tracked.child && !tracked.child.killed)
      || await requestAutomationAppHealth({ ...automationApp, url }, 500)

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
      running: Boolean(running),
    }
  }))
}

async function waitForAutomationApp(automationApp, timeoutMs = 15000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestAutomationAppHealth(automationApp, 1000)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function launchAutomationApp(appId, options) {
  const processMap = options.processMap || new Map()
  const userDataDir = resolveUserDataDir(options)
  const automationApp = getAutomationAppById(appId, options)

  if (!automationApp) {
    return { success: false, error: `Unknown automation app: ${appId}` }
  }

  if (!fs.existsSync(automationApp.entryPath)) {
    return { success: false, error: `Automation app entry not found: ${automationApp.entryPath}` }
  }

  if (await requestAutomationAppHealth(automationApp)) {
    return { success: true, alreadyRunning: true, appId, url: automationApp.url }
  }

  const tracked = processMap.get(appId)
  if (tracked && tracked.child && !tracked.child.killed) {
    return { success: true, alreadyRunning: true, appId, url: automationApp.url }
  }

  const logDir = path.join(userDataDir, 'logs')
  const dataDir = getAutomationDataDir(userDataDir, appId)
  fs.mkdirSync(logDir, { recursive: true })
  fs.mkdirSync(dataDir, { recursive: true })

  const logPath = path.join(logDir, `${appId}.log`)
  const logFd = fs.openSync(logPath, 'a')
  const env = {
    ...process.env,
    ...(options.baseEnv || {}),
    TMS_PLAYWRIGHT_PORT: String(automationApp.port),
    TMS_PLAYWRIGHT_DATA_DIR: dataDir,
  }
  const helperVersion = String(options.helperVersion || env.TOS_AUTOMATION_HELPER_VERSION || '').trim()
  if (helperVersion) {
    env.TOS_AUTOMATION_HELPER_VERSION = helperVersion
  }

  if (options.markElectronRunAsNode) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }

  try {
    const child = spawn(options.processExecPath || process.execPath, [automationApp.entryPath], {
      cwd: automationApp.baseDir,
      windowsHide: options.windowsHide !== false,
      stdio: ['ignore', logFd, logFd],
      env,
    })

    processMap.set(appId, { child, logFd, logPath, dataDir })

    child.once('exit', () => {
      const latest = processMap.get(appId)
      if (latest && latest.child === child) {
        processMap.delete(appId)
      }
      try {
        fs.closeSync(logFd)
      } catch (_error) {
        // Ignore close failures for shutdown cleanup.
      }
    })

    const isReady = await waitForAutomationApp(automationApp)
    if (!isReady) {
      child.kill()
      return { success: false, error: `Automation app did not become ready. Log: ${logPath}` }
    }

    return {
      success: true,
      appId,
      url: automationApp.url,
      dataDir,
      logPath,
    }
  } catch (error) {
    try {
      fs.closeSync(logFd)
    } catch (_closeError) {
      // Ignore close failures after launch errors.
    }
    processMap.delete(appId)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      logPath,
    }
  }
}

function stopAutomationApp(appId, options) {
  const processMap = options.processMap || new Map()
  const tracked = processMap.get(appId)
  if (!tracked || !tracked.child || tracked.child.killed) {
    return { success: true, alreadyStopped: true, appId }
  }

  tracked.child.kill()
  processMap.delete(appId)
  try {
    fs.closeSync(tracked.logFd)
  } catch (_error) {
    // Ignore close failures during explicit stop.
  }
  return { success: true, appId }
}

function shutdownAutomationApps(options) {
  const processMap = options.processMap || new Map()
  for (const [appId, tracked] of processMap.entries()) {
    if (tracked.child && !tracked.child.killed) {
      tracked.child.kill()
    }
    try {
      fs.closeSync(tracked.logFd)
    } catch (_error) {
      // Ignore close failures during shutdown.
    }
    processMap.delete(appId)
  }
}

module.exports = {
  getAutomationAppById,
  getAutomationAppPath,
  getAutomationAppUrl,
  getAutomationApps,
  getAutomationDataDir,
  launchAutomationApp,
  loadAutomationAppRegistry,
  requestAutomationAppHealth,
  requestJson,
  resolveUserDataDir,
  shutdownAutomationApps,
  stopAutomationApp,
  waitForAutomationApp,
}
