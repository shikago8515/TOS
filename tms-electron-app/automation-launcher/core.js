const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const os = require('os')
const path = require('path')
const { execFile, spawn } = require('child_process')

const DEFAULT_AUTOMATION_MODULE_MANIFEST_URL = 'https://ai.tomwell.net:56130/tos/desktop-api/api/system/config/automation-modules'
const AUTOMATION_MODULE_CACHE_DIR = 'automation-module-cache'

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

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
  const appDir = safeRelativePath(automationApp.appDir || automationApp.id, automationApp.id)
  return path.join(automationAppRoot, appDir)
}

function getAutomationAppById(appId, options) {
  const registry = loadAutomationAppRegistry(options.automationAppRoot)
  const automationApp = registry.find((item) => item.id === appId)
  if (!automationApp) {
    return null
  }

  const bundled = buildAutomationAppRuntime(
    automationApp,
    getAutomationAppPath(options.automationAppRoot, automationApp),
    'bundled',
  )
  const cached = readCachedAutomationModule(automationApp, options)
  return chooseNewestAutomationApp(bundled, cached)
}

function getAutomationDataDir(userDataDir, appId) {
  return path.join(userDataDir, 'automation-apps', appId)
}

function getSharedExecutorRoot(automationAppRoot) {
  return path.join(automationAppRoot, 'playwright-console')
}

function getAutomationDependencyPaths(automationApp, options) {
  const automationAppRoot = options.automationAppRoot
  const bundledAppDir = getAutomationAppPath(automationAppRoot, automationApp)
  return [
    path.join(bundledAppDir, 'node_modules'),
    path.join(getSharedExecutorRoot(automationAppRoot), 'node_modules'),
    path.join(automationAppRoot, 'node_modules'),
    path.join(path.dirname(automationAppRoot), 'node_modules'),
  ].filter((candidate, index, all) => (
    fs.existsSync(candidate) && all.indexOf(candidate) === index
  ))
}

function buildNodePath(automationApp, options, inheritedNodePath) {
  const paths = getAutomationDependencyPaths(automationApp, options)
  const inherited = String(inheritedNodePath || '').trim()
  if (inherited) {
    paths.push(...inherited.split(path.delimiter).filter(Boolean))
  }
  return Array.from(new Set(paths)).join(path.delimiter)
}

function getAutomationModuleCacheRoot(userDataDir) {
  return path.join(userDataDir, AUTOMATION_MODULE_CACHE_DIR)
}

async function requestJson(url, timeoutMs = 1500) {
  try {
    const body = await requestText(url, timeoutMs)
    return JSON.parse(body)
  } catch (_error) {
    return null
  }
}

function requestText(url, timeoutMs = 1500, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (!url || redirectCount > 5) {
      reject(new Error('Too many redirects.'))
      return
    }

    const client = String(url).startsWith('https:') ? https : http
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
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => resolve(body))
    })

    request.on('timeout', () => request.destroy(new Error('Request timed out.')))
    request.on('error', reject)
  })
}

async function requestAutomationAppHealthPayload(automationApp, timeoutMs = 1500) {
  const payload = await requestJson(`${automationApp.url || getAutomationAppUrl(automationApp)}/api/health`, timeoutMs)
  return payload && payload.ok ? payload : null
}

async function requestAutomationAppHealth(automationApp, timeoutMs = 1500) {
  return Boolean(await requestAutomationAppHealthPayload(automationApp, timeoutMs))
}

async function getAutomationApps(options) {
  const registry = loadAutomationAppRegistry(options.automationAppRoot)
  const processMap = options.processMap || new Map()

  return Promise.all(registry.map(async (automationApp) => {
    const bundled = buildAutomationAppRuntime(
      automationApp,
      getAutomationAppPath(options.automationAppRoot, automationApp),
      'bundled',
    )
    const cached = readCachedAutomationModule(automationApp, options)
    const selected = chooseNewestAutomationApp(bundled, cached)
    const tracked = processMap.get(automationApp.id)
    const running = (tracked && tracked.child && !tracked.child.killed)
      || await requestAutomationAppHealth(selected, 500)

    return {
      id: selected.id,
      name: selected.name,
      provider: selected.provider || '',
      category: selected.category || 'Web Automation',
      version: selected.version || '',
      requiredHelperVersion: selected.requiredHelperVersion || '',
      description: selected.description || '',
      baseDir: selected.baseDir,
      entryPath: selected.entryPath,
      port: selected.port,
      url: selected.url,
      available: fs.existsSync(selected.entryPath),
      running: Boolean(running),
      source: selected.source || selected.moduleSource || 'bundled',
      moduleSource: selected.moduleSource || 'bundled',
      packageSha256: selected.packageSha256 || '',
      moduleUpdatedAt: selected.moduleUpdatedAt || '',
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
  const forceUpdate = Boolean(options.forceUpdate)
  const automationApp = await resolveAutomationAppRuntime(appId, options, { checkRemote: true, forceUpdate })

  if (!automationApp) {
    return { success: false, error: `Unknown automation app: ${appId}` }
  }

  if (automationApp.moduleUpdateBlocked) {
    return {
      success: false,
      error: automationApp.moduleUpdateBlocked.message,
      code: 'HELPER_VERSION_TOO_OLD',
    }
  }

  if (!fs.existsSync(automationApp.entryPath)) {
    return { success: false, error: `Automation app entry not found: ${automationApp.entryPath}` }
  }

  const runningHealth = await requestAutomationAppHealthPayload(automationApp)
  if (runningHealth) {
    if (shouldReuseRunningAutomationApp(automationApp, runningHealth, { forceUpdate })) {
      return {
        success: true,
        alreadyRunning: true,
        appId,
        url: automationApp.url,
        source: automationApp.moduleSource || 'bundled',
        version: automationApp.version || '',
        moduleUpdateError: automationApp.moduleUpdateError || '',
      }
    }

    if (isAutomationAppBusy(runningHealth)) {
      return {
        success: true,
        alreadyRunning: true,
        updatePending: true,
        appId,
        url: automationApp.url,
        source: runningHealth.moduleSource || runningHealth.automationModuleSource || 'running',
        version: runningHealth.moduleVersion || runningHealth.automationModuleVersion || '',
        pendingSource: automationApp.moduleSource || 'bundled',
        pendingVersion: automationApp.version || '',
        pendingSha256: automationApp.packageSha256 || '',
        message: `Automation app ${appId} is busy. The downloaded module will be switched after the current task finishes.`,
      }
    }

    stopAutomationApp(appId, options)
    let stopped = await waitForAutomationAppToStop(automationApp)
    if (!stopped && shouldAutoStopUnmanagedAutomationApp(automationApp, runningHealth, { forceUpdate })) {
      const unmanagedStop = await stopUnmanagedAutomationAppByPort(automationApp)
      if (unmanagedStop.success) {
        stopped = await waitForAutomationAppToStop(automationApp, 8000)
      }
    }
    if (!stopped) {
      return {
        success: false,
        error: `自动化执行器 ${appId} 已在小助手之外运行，当前小助手无法接管并更新它。请先关闭旧执行器进程，再从 TOS 页面重新启动。`,
        code: 'UNMANAGED_EXECUTOR_RUNNING',
        appId,
        url: automationApp.url,
      }
    }
  }

  const tracked = processMap.get(appId)
  if (tracked && tracked.child && !tracked.child.killed) {
    if (automationApp.moduleSource !== 'remote-cache' && !forceUpdate) {
      return {
        success: true,
        alreadyRunning: true,
        appId,
        url: automationApp.url,
        source: automationApp.moduleSource || 'bundled',
        version: automationApp.version || '',
        moduleUpdateError: automationApp.moduleUpdateError || '',
      }
    }

    stopAutomationApp(appId, options)
    const stopped = await waitForAutomationAppToStop(automationApp)
    if (!stopped) {
      return {
        success: false,
        error: `自动化执行器 ${appId} 重启前未能停止。请先关闭旧执行器进程，再从 TOS 页面重新启动。`,
        code: 'EXECUTOR_STOP_TIMEOUT',
        appId,
        url: automationApp.url,
      }
    }
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
    TMS_AUTOMATION_APP_ROOT: options.automationAppRoot,
    TMS_AUTOMATION_SHARED_EXECUTOR_ROOT: getSharedExecutorRoot(options.automationAppRoot),
    TOS_AUTOMATION_APP_ID: String(appId),
    TOS_AUTOMATION_MODULE_VERSION: String(automationApp.version || ''),
    TOS_AUTOMATION_MODULE_SOURCE: String(automationApp.moduleSource || automationApp.source || 'bundled'),
    TOS_AUTOMATION_MODULE_SHA256: String(automationApp.packageSha256 || ''),
  }
  const nodePath = buildNodePath(automationApp, options, env.NODE_PATH)
  if (nodePath) {
    env.NODE_PATH = nodePath
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
      source: automationApp.moduleSource || 'bundled',
      version: automationApp.version || '',
      moduleUpdateError: automationApp.moduleUpdateError || '',
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

async function waitForAutomationAppToStop(automationApp, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (!await requestAutomationAppHealth(automationApp, 500)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return false
}

function shouldReuseRunningAutomationApp(automationApp, health, options = {}) {
  if ((automationApp.moduleSource || automationApp.source) !== 'remote-cache') {
    return !options.forceUpdate
  }

  const runningModuleVersion = String(
    health?.moduleVersion
    || health?.automationModuleVersion
    || health?.config?.moduleVersion
    || '',
  ).trim()
  if (!runningModuleVersion) {
    return false
  }

  if (compareVersionStrings(runningModuleVersion, automationApp.version) < 0) {
    return false
  }

  const desiredSha = normalizePackageSha(automationApp.packageSha256)
  if (!desiredSha) {
    return true
  }

  const runningSha = normalizePackageSha(
    health?.moduleSha256
    || health?.automationModuleSha256
    || health?.config?.moduleSha256
    || '',
  )
  if (!runningSha) {
    return !options.forceUpdate
  }

  return runningSha === desiredSha
}

function isAutomationAppBusy(health) {
  if (!health || typeof health !== 'object') {
    return false
  }

  if (health.busy === true || health.isBusy === true) {
    return true
  }

  const activeRunCount = Number(
    health.activeRunCount
    || health.activeRuns?.length
    || health.config?.activeRunCount
    || 0,
  )
  if (Number.isFinite(activeRunCount) && activeRunCount > 0) {
    return true
  }

  return Boolean(health.activeRun)
}

function shouldAutoStopUnmanagedAutomationApp(automationApp, health, options = {}) {
  if (!options.forceUpdate || !health || health.ok !== true) {
    return false
  }

  const runningAppId = String(health.appId || health.automationAppId || health.config?.appId || '').trim()
  if (runningAppId && runningAppId === automationApp.id) {
    return true
  }

  const desiredSha = normalizePackageSha(automationApp.packageSha256)
  const runningSha = normalizePackageSha(
    health.moduleSha256
    || health.automationModuleSha256
    || health.config?.moduleSha256
    || '',
  )
  if (desiredSha && runningSha && desiredSha === runningSha) {
    return true
  }

  const hasAutomationHealthShape = Boolean(
    health.moduleVersion
    || health.automationModuleVersion
    || health.moduleSource
    || health.capabilities
    || health.activeRun !== undefined
    || health.activeRunCount !== undefined
  )
  const runningPort = Number(health.port || health.config?.port || 0)
  const expectedPort = Number(automationApp.port || automationApp.defaultPort || 0)
  return hasAutomationHealthShape && expectedPort > 0 && runningPort === expectedPort
}

async function stopUnmanagedAutomationAppByPort(automationApp) {
  const port = Number(automationApp.port || automationApp.defaultPort || 0)
  if (!port) {
    return { success: false, error: 'Automation app port is unknown.' }
  }

  const pid = await findListeningPidByPort(port)
  if (!pid || pid === process.pid) {
    return { success: false, error: `No external PID found for port ${port}.` }
  }

  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true })
    } else {
      process.kill(pid, 'SIGTERM')
    }
    return { success: true, pid, port }
  } catch (error) {
    return {
      success: false,
      pid,
      port,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function findListeningPidByPort(port) {
  if (process.platform === 'win32') {
    return findWindowsListeningPidByPort(port)
  }
  return findUnixListeningPidByPort(port)
}

async function findWindowsListeningPidByPort(port) {
  try {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true })
    const portPattern = new RegExp(`[:.]${port}\\s+`, 'i')
    for (const line of String(stdout || '').split(/\r?\n/)) {
      if (!/\bLISTENING\b/i.test(line) || !portPattern.test(line)) {
        continue
      }
      const parts = line.trim().split(/\s+/)
      const pid = Number(parts[parts.length - 1])
      if (Number.isFinite(pid) && pid > 0) {
        return pid
      }
    }
  } catch (_error) {
    return 0
  }
  return 0
}

async function findUnixListeningPidByPort(port) {
  try {
    const { stdout } = await execFileAsync('sh', ['-c', `lsof -ti tcp:${Number(port)} -sTCP:LISTEN | head -n 1`])
    const pid = Number(String(stdout || '').trim())
    return Number.isFinite(pid) && pid > 0 ? pid : 0
  } catch (_error) {
    return 0
  }
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

async function resolveAutomationAppRuntime(appId, options, updateOptions = {}) {
  const registry = loadAutomationAppRegistry(options.automationAppRoot)
  const automationApp = registry.find((item) => item.id === appId)
  if (!automationApp) {
    return null
  }

  const bundled = buildAutomationAppRuntime(
    automationApp,
    getAutomationAppPath(options.automationAppRoot, automationApp),
    'bundled',
  )
  const cached = readCachedAutomationModule(automationApp, options)
  let selected = chooseNewestAutomationApp(bundled, cached)

  if (updateOptions.checkRemote === false || options.enableModuleUpdates === false) {
    return selected
  }

  const remoteModule = await getRemoteAutomationModule(appId, automationApp, options)
  if (!remoteModule || !shouldInstallRemoteModule(remoteModule, selected, { forceUpdate: updateOptions.forceUpdate })) {
    return selected
  }

  if (!isHelperVersionCompatible(options.helperVersion, remoteModule.requiredHelperVersion)) {
    return {
      ...selected,
      moduleUpdateBlocked: {
        requiredHelperVersion: remoteModule.requiredHelperVersion,
        helperVersion: String(options.helperVersion || ''),
        message: `Automation module ${appId} requires TOS automation helper ${remoteModule.requiredHelperVersion} or later. Current helper: ${options.helperVersion || 'unknown'}. Please update TOS automation helper first.`,
      },
    }
  }

  try {
    selected = await installAutomationModule(remoteModule, options)
  } catch (error) {
    selected = {
      ...selected,
      moduleUpdateError: error instanceof Error ? error.message : String(error),
    }
  }

  return selected
}

async function syncAutomationModules(options = {}) {
  const startedAt = new Date().toISOString()
  const manifestUrl = resolveAutomationModuleManifestUrl(options)
  const result = {
    ok: true,
    startedAt,
    finishedAt: '',
    manifestUrl,
    enabled: options.enableModuleUpdates !== false,
    checked: 0,
    installed: 0,
    upToDate: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
    pendingRestart: 0,
    modules: [],
  }

  if (options.enableModuleUpdates === false) {
    result.finishedAt = new Date().toISOString()
    result.skippedReason = 'module-updates-disabled'
    return result
  }

  if (!manifestUrl) {
    result.ok = false
    result.finishedAt = new Date().toISOString()
    result.error = 'Automation module manifest URL is empty.'
    return result
  }

  const manifest = await requestJson(manifestUrl, Number(options.moduleManifestTimeoutMs || 3500))
  if (!manifest || manifest.ok === false) {
    result.ok = false
    result.finishedAt = new Date().toISOString()
    result.error = 'Automation module manifest is unavailable.'
    return result
  }

  const remoteModules = new Map(
    normalizeManifestModules(manifest).map((item) => [item.id, item]),
  )
  const registry = loadAutomationAppRegistry(options.automationAppRoot)

  for (const registryApp of registry) {
    const bundled = buildAutomationAppRuntime(
      registryApp,
      getAutomationAppPath(options.automationAppRoot, registryApp),
      'bundled',
    )
    const cached = readCachedAutomationModule(registryApp, options)
    const selected = chooseNewestAutomationApp(bundled, cached)
    const moduleResult = {
      id: registryApp.id,
      name: registryApp.name || registryApp.id,
      selectedVersion: selected.version || '',
      selectedSource: selected.moduleSource || selected.source || 'bundled',
      status: 'up-to-date',
    }

    result.checked += 1
    const remoteInfo = remoteModules.get(registryApp.id)
    if (!remoteInfo) {
      moduleResult.status = 'skipped'
      moduleResult.reason = 'not-in-manifest'
      result.skipped += 1
      result.modules.push(moduleResult)
      continue
    }

    const remoteModule = normalizeRemoteAutomationModule(remoteInfo, bundled, manifestUrl)
    moduleResult.remoteVersion = remoteModule.version || ''
    moduleResult.remoteSha256 = normalizePackageSha(remoteModule.packageSha256)

    if (!shouldInstallRemoteModule(remoteModule, selected, { forceUpdate: options.forceUpdate })) {
      result.upToDate += 1
      result.modules.push(moduleResult)
      continue
    }

    if (!isHelperVersionCompatible(options.helperVersion, remoteModule.requiredHelperVersion)) {
      moduleResult.status = 'blocked'
      moduleResult.code = 'HELPER_VERSION_TOO_OLD'
      moduleResult.requiredHelperVersion = remoteModule.requiredHelperVersion || ''
      moduleResult.helperVersion = String(options.helperVersion || '')
      moduleResult.message = `Automation module ${registryApp.id} requires TOS automation helper ${remoteModule.requiredHelperVersion} or later. Current helper: ${options.helperVersion || 'unknown'}.`
      result.blocked += 1
      result.modules.push(moduleResult)
      continue
    }

    try {
      const installed = await installAutomationModule(remoteModule, options)
      moduleResult.status = 'installed'
      moduleResult.installedVersion = installed.version || ''
      moduleResult.installedSha256 = normalizePackageSha(installed.packageSha256)
      result.installed += 1

      const runningHealth = await requestAutomationAppHealthPayload(installed, Number(options.moduleHealthTimeoutMs || 700))
      if (runningHealth) {
        moduleResult.status = 'installed-pending-restart'
        moduleResult.pendingRestart = true
        moduleResult.runningVersion = runningHealth.moduleVersion || runningHealth.automationModuleVersion || ''
        moduleResult.runningSha256 = normalizePackageSha(
          runningHealth.moduleSha256
          || runningHealth.automationModuleSha256
          || runningHealth.config?.moduleSha256
          || '',
        )
        moduleResult.runningBusy = isAutomationAppBusy(runningHealth)
        result.pendingRestart += 1
      }
    } catch (error) {
      moduleResult.status = 'failed'
      moduleResult.error = error instanceof Error ? error.message : String(error)
      result.failed += 1
    }

    result.modules.push(moduleResult)
  }

  result.ok = result.failed === 0 && result.blocked === 0
  result.finishedAt = new Date().toISOString()
  return result
}

async function getRemoteAutomationModule(appId, bundledApp, options) {
  const manifestUrl = resolveAutomationModuleManifestUrl(options)
  if (!manifestUrl) {
    return null
  }

  const manifest = await requestJson(manifestUrl, Number(options.moduleManifestTimeoutMs || 3500))
  if (!manifest || manifest.ok === false) {
    return null
  }

  const modules = normalizeManifestModules(manifest)
  const remote = modules.find((item) => item.id === appId)
  return remote ? normalizeRemoteAutomationModule(remote, bundledApp, manifestUrl) : null
}

function resolveAutomationModuleManifestUrl(options = {}) {
  const explicit = String(options.automationModuleManifestUrl || '').trim()
  if (explicit) {
    return explicit
  }

  const envUrl = String(
    process.env.TOS_AUTOMATION_MODULE_MANIFEST_URL
      || process.env.TMS_AUTOMATION_MODULE_MANIFEST_URL
      || '',
  ).trim()
  if (envUrl) {
    return envUrl
  }

  return DEFAULT_AUTOMATION_MODULE_MANIFEST_URL
}

function normalizeManifestModules(manifest) {
  const rawModules = Array.isArray(manifest.modules)
    ? manifest.modules
    : manifest.modules && typeof manifest.modules === 'object'
      ? Object.entries(manifest.modules).map(([id, value]) => ({ id, ...(value || {}) }))
      : []

  return rawModules
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({ ...item, id: String(item.id || '').trim() }))
    .filter((item) => item.id)
}

function normalizeRemoteAutomationModule(moduleInfo, bundledApp, manifestUrl) {
  const entry = safeRelativePath(moduleInfo.entry || bundledApp.entry || 'bin/start.js', 'bin/start.js')
  const version = String(moduleInfo.version || bundledApp.version || '').trim()
  const downloadValue = moduleInfo.packageUrl || moduleInfo.downloadUrl || moduleInfo.downloadPath || ''
  return {
    ...bundledApp,
    ...moduleInfo,
    id: String(moduleInfo.id || bundledApp.id || '').trim(),
    name: String(moduleInfo.name || bundledApp.name || moduleInfo.id || ''),
    appDir: safeRelativePath(moduleInfo.appDir || bundledApp.appDir || moduleInfo.id, moduleInfo.id),
    entry,
    version,
    defaultPort: Number(moduleInfo.defaultPort || bundledApp.defaultPort || 3100),
    requiredHelperVersion: String(moduleInfo.requiredHelperVersion || bundledApp.requiredHelperVersion || '').trim(),
    packageUrl: resolveManifestDownloadUrl(downloadValue, manifestUrl),
    packageSha256: String(moduleInfo.sha256 || moduleInfo.packageSha256 || '').trim().toLowerCase(),
    packageFileSize: Number(moduleInfo.fileSize || moduleInfo.packageFileSize || 0) || null,
  }
}

function resolveManifestDownloadUrl(value, manifestUrl) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw
  }

  const base = new URL(manifestUrl)
  if (raw.startsWith('/api/')) {
    const apiIndex = base.pathname.indexOf('/api/')
    if (apiIndex >= 0) {
      base.pathname = `${base.pathname.slice(0, apiIndex)}${raw}`
      base.search = ''
      base.hash = ''
      return base.toString()
    }
  }

  return new URL(raw, manifestUrl).toString()
}

function shouldInstallRemoteModule(remoteModule, selectedApp, options = {}) {
  if (!remoteModule.packageUrl || !remoteModule.version) {
    return false
  }

  const versionCompare = compareVersionStrings(remoteModule.version, selectedApp.version || '')
  if (versionCompare > 0) {
    return true
  }

  if (versionCompare < 0) {
    return false
  }

  const remoteSha = normalizePackageSha(remoteModule.packageSha256)
  if (remoteSha) {
    const selectedSha = normalizePackageSha(selectedApp.packageSha256)
    return !selectedSha || selectedSha !== remoteSha
  }

  return Boolean(options.forceUpdate && selectedApp.moduleSource !== 'remote-cache')
}

async function installAutomationModule(remoteModule, options) {
  const userDataDir = resolveUserDataDir(options)
  const moduleCacheRoot = getAutomationModuleCacheRoot(userDataDir)
  const moduleDir = path.join(moduleCacheRoot, sanitizePathSegment(remoteModule.id))
  const versionSegment = sanitizePathSegment(remoteModule.version || remoteModule.packageSha256 || 'latest')
  const versionDir = path.join(moduleDir, versionSegment)
  const finalAppDir = path.join(versionDir, 'app')
  const metadataPath = path.join(versionDir, 'module.json')
  const entryPath = resolveInside(finalAppDir, remoteModule.entry || 'bin/start.js')

  const existingMetadata = readJsonFile(metadataPath)
  if (
    fs.existsSync(entryPath)
    && (!remoteModule.packageSha256 || String(existingMetadata.sha256 || '').toLowerCase() === remoteModule.packageSha256)
  ) {
    writeCurrentModuleMetadata(moduleDir, remoteModule, versionSegment)
    return buildAutomationAppRuntime(
      metadataToAutomationApp(remoteModule),
      finalAppDir,
      'remote-cache',
      {
        packageSha256: remoteModule.packageSha256 || '',
        moduleUpdatedAt: existingMetadata.installedAt || '',
      },
    )
  }

  const tempRoot = path.join(moduleDir, `.tmp-${process.pid}-${Date.now()}`)
  const tempZipPath = path.join(tempRoot, 'package.zip')
  const extractDir = path.join(tempRoot, 'extract')

  await fs.promises.mkdir(tempRoot, { recursive: true })
  try {
    await downloadFile(remoteModule.packageUrl, tempZipPath)
    if (remoteModule.packageSha256) {
      const actualSha256 = await hashFile(tempZipPath)
      if (actualSha256.toLowerCase() !== remoteModule.packageSha256) {
        throw new Error(`Automation module checksum mismatch for ${remoteModule.id}.`)
      }
    }

    await fs.promises.mkdir(extractDir, { recursive: true })
    await expandZip(tempZipPath, extractDir)
    const extractedAppDir = findExtractedAutomationAppDir(extractDir, remoteModule)

    await fs.promises.rm(versionDir, { recursive: true, force: true })
    await fs.promises.mkdir(versionDir, { recursive: true })
    await fs.promises.rename(extractedAppDir, finalAppDir)

    const metadata = writeModuleMetadata(versionDir, remoteModule, versionSegment)
    writeCurrentModuleMetadata(moduleDir, remoteModule, versionSegment, metadata)

    return buildAutomationAppRuntime(
      metadataToAutomationApp(remoteModule),
      finalAppDir,
      'remote-cache',
      {
        packageSha256: remoteModule.packageSha256 || '',
        moduleUpdatedAt: metadata.installedAt || '',
      },
    )
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

function readCachedAutomationModule(automationApp, options) {
  const userDataDir = resolveUserDataDir(options)
  const moduleDir = path.join(getAutomationModuleCacheRoot(userDataDir), sanitizePathSegment(automationApp.id))
  const metadata = readJsonFile(path.join(moduleDir, 'current.json'))
  if (!metadata || metadata.id !== automationApp.id) {
    return null
  }

  const baseDir = resolveInside(moduleDir, metadata.baseDir || path.join(metadata.versionSegment || '', 'app'))
  const entry = safeRelativePath(metadata.entry || automationApp.entry || 'bin/start.js', 'bin/start.js')
  const entryPath = resolveInside(baseDir, entry)
  if (!fs.existsSync(entryPath)) {
    return null
  }

  const cachedApp = buildAutomationAppRuntime(
    {
      ...automationApp,
      ...metadata,
      entry,
    },
    baseDir,
    'remote-cache',
    {
      packageSha256: String(metadata.sha256 || '').toLowerCase(),
      moduleUpdatedAt: metadata.installedAt || '',
    },
  )

  return compareVersionStrings(cachedApp.version || '', automationApp.version || '') >= 0
    ? cachedApp
    : null
}

function chooseNewestAutomationApp(bundled, cached) {
  if (!cached) {
    return bundled
  }
  return compareVersionStrings(cached.version || '', bundled.version || '') >= 0
    ? cached
    : bundled
}

function normalizePackageSha(value) {
  return String(value || '').trim().toLowerCase()
}

function buildAutomationAppRuntime(automationApp, baseDir, source, extra = {}) {
  const entry = safeRelativePath(automationApp.entry || 'bin/start.js', 'bin/start.js')
  const port = Number(automationApp.defaultPort || automationApp.port || 3100)
  return {
    ...automationApp,
    ...extra,
    entry,
    baseDir,
    entryPath: resolveInside(baseDir, entry),
    port,
    defaultPort: port,
    url: getAutomationAppUrl({ ...automationApp, defaultPort: port }),
    source,
    moduleSource: source,
  }
}

function metadataToAutomationApp(remoteModule) {
  return {
    id: remoteModule.id,
    name: remoteModule.name,
    provider: remoteModule.provider || '',
    category: remoteModule.category || 'Web Automation',
    version: remoteModule.version || '',
    requiredHelperVersion: remoteModule.requiredHelperVersion || '',
    description: remoteModule.description || '',
    appDir: remoteModule.appDir || remoteModule.id,
    entry: remoteModule.entry || 'bin/start.js',
    defaultPort: remoteModule.defaultPort || remoteModule.port || 3100,
  }
}

function writeModuleMetadata(versionDir, remoteModule, versionSegment) {
  const metadata = {
    kind: 'tos-automation-module-cache',
    id: remoteModule.id,
    name: remoteModule.name || '',
    provider: remoteModule.provider || '',
    category: remoteModule.category || 'Web Automation',
    version: remoteModule.version || '',
    requiredHelperVersion: remoteModule.requiredHelperVersion || '',
    description: remoteModule.description || '',
    appDir: remoteModule.appDir || remoteModule.id,
    entry: remoteModule.entry || 'bin/start.js',
    defaultPort: Number(remoteModule.defaultPort || remoteModule.port || 3100),
    versionSegment,
    baseDir: path.join(versionSegment, 'app'),
    packageUrl: remoteModule.packageUrl || '',
    sha256: remoteModule.packageSha256 || '',
    fileSize: remoteModule.packageFileSize || null,
    installedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(versionDir, 'module.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  return metadata
}

function writeCurrentModuleMetadata(moduleDir, remoteModule, versionSegment, metadata = null) {
  const current = metadata || {
    kind: 'tos-automation-module-cache',
    id: remoteModule.id,
    name: remoteModule.name || '',
    provider: remoteModule.provider || '',
    category: remoteModule.category || 'Web Automation',
    version: remoteModule.version || '',
    requiredHelperVersion: remoteModule.requiredHelperVersion || '',
    description: remoteModule.description || '',
    appDir: remoteModule.appDir || remoteModule.id,
    entry: remoteModule.entry || 'bin/start.js',
    defaultPort: Number(remoteModule.defaultPort || remoteModule.port || 3100),
    versionSegment,
    baseDir: path.join(versionSegment, 'app'),
    packageUrl: remoteModule.packageUrl || '',
    sha256: remoteModule.packageSha256 || '',
    fileSize: remoteModule.packageFileSize || null,
    installedAt: new Date().toISOString(),
  }
  fs.mkdirSync(moduleDir, { recursive: true })
  fs.writeFileSync(path.join(moduleDir, 'current.json'), `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}

function findExtractedAutomationAppDir(extractDir, remoteModule) {
  const entry = safeRelativePath(remoteModule.entry || 'bin/start.js', 'bin/start.js')
  const candidates = [
    extractDir,
    path.join(extractDir, safeRelativePath(remoteModule.appDir || remoteModule.id, remoteModule.id)),
    path.join(extractDir, sanitizePathSegment(remoteModule.id)),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(resolveInside(candidate, entry))) {
      return candidate
    }
  }

  const directories = fs.readdirSync(extractDir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => path.join(extractDir, item.name))
  if (directories.length === 1 && fs.existsSync(resolveInside(directories[0], entry))) {
    return directories[0]
  }

  throw new Error(`Automation module entry not found after extract: ${entry}`)
}

function expandZip(zipPath, destinationDir) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'powershell.exe' : 'unzip'
    const args = process.platform === 'win32'
      ? [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          '& { param($zipPath, $destinationDir) Expand-Archive -LiteralPath $zipPath -DestinationPath $destinationDir -Force }',
          zipPath,
          destinationDir,
        ]
      : ['-q', zipPath, '-d', destinationDir]

    execFile(command, args, { windowsHide: true, timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to extract automation module package: ${stderr || stdout || error.message}`))
        return
      }
      resolve()
    })
  })
}

function downloadFile(url, targetPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects while downloading automation module.'))
      return
    }

    const client = String(url).startsWith('https:') ? https : http
    const request = client.get(url, { timeout: 120000 }, (response) => {
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
        reject(new Error(`Automation module download failed with status ${statusCode}.`))
        return
      }

      const file = fs.createWriteStream(targetPath)
      response.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    })

    request.on('timeout', () => request.destroy(new Error('Automation module download timed out.')))
    request.on('error', reject)
  })
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (_error) {
    return {}
  }
}

function safeRelativePath(value, fallback) {
  const raw = String(value || fallback || '').trim()
  const normalized = path.normalize(raw)
  if (
    !normalized
    || normalized.includes('\0')
    || path.isAbsolute(normalized)
    || normalized === '..'
    || normalized.startsWith(`..${path.sep}`)
  ) {
    return path.normalize(fallback || '')
  }
  return normalized
}

function resolveInside(baseDir, relativePath) {
  const normalizedBase = path.resolve(baseDir)
  const normalizedTarget = path.resolve(normalizedBase, safeRelativePath(relativePath, ''))
  if (!isPathInside(normalizedBase, normalizedTarget)) {
    throw new Error(`Resolved path escapes base directory: ${relativePath}`)
  }
  return normalizedTarget
}

function isPathInside(baseDir, targetPath) {
  const relative = path.relative(path.resolve(baseDir), path.resolve(targetPath))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function sanitizePathSegment(value) {
  return String(value || 'module')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'module'
}

function isHelperVersionCompatible(currentVersion, requiredVersion) {
  const required = String(requiredVersion || '').trim()
  if (!required) {
    return true
  }
  const current = String(currentVersion || '').trim()
  if (!current) {
    return false
  }
  return compareVersionStrings(current, required) >= 0
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

module.exports = {
  DEFAULT_AUTOMATION_MODULE_MANIFEST_URL,
  compareVersionStrings,
  getAutomationAppById,
  getAutomationAppPath,
  getAutomationAppUrl,
  getAutomationApps,
  getAutomationDataDir,
  getAutomationModuleCacheRoot,
  isAutomationAppBusy,
  launchAutomationApp,
  loadAutomationAppRegistry,
  requestAutomationAppHealth,
  requestAutomationAppHealthPayload,
  requestJson,
  resolveAutomationAppRuntime,
  resolveAutomationModuleManifestUrl,
  resolveUserDataDir,
  shutdownAutomationApps,
  syncAutomationModules,
  stopAutomationApp,
  waitForAutomationApp,
}
