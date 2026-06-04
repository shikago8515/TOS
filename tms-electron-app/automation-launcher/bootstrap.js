const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const { resolveUserDataDir } = require('./core')

const host = process.env.TMS_AUTOMATION_LAUNCHER_HOST || '127.0.0.1'
const port = Number(process.env.TMS_AUTOMATION_LAUNCHER_PORT || 3210)
const automationAppRoot = process.env.TMS_AUTOMATION_APP_ROOT
  ? path.resolve(process.env.TMS_AUTOMATION_APP_ROOT)
  : path.resolve(__dirname, '..', 'automation-apps')
const userDataDir = resolveUserDataDir({
  userDataDir: process.env.TMS_AUTOMATION_LAUNCHER_DATA_DIR,
  appName: process.env.TMS_AUTOMATION_APP_NAME || 'TOS',
})
const logDir = path.join(userDataDir, 'logs')
const logPath = path.join(logDir, 'automation-launcher.log')
const launcherScriptPath = path.join(__dirname, 'server.js')

async function main() {
  if (await requestLauncherHealth(1000)) {
    writeStdout(`Automation launcher already ready at http://${host}:${port}\n`)
    return
  }

  if (!fs.existsSync(launcherScriptPath)) {
    throw new Error(`Automation launcher entry not found: ${launcherScriptPath}`)
  }

  fs.mkdirSync(logDir, { recursive: true })
  const logFd = fs.openSync(logPath, 'a')
  const env = {
    ...process.env,
    TMS_AUTOMATION_LAUNCHER_HOST: host,
    TMS_AUTOMATION_LAUNCHER_PORT: String(port),
    TMS_AUTOMATION_APP_ROOT: automationAppRoot,
    TMS_AUTOMATION_LAUNCHER_DATA_DIR: userDataDir,
    TMS_AUTOMATION_APP_NAME: process.env.TMS_AUTOMATION_APP_NAME || 'TOS',
  }

  if (process.versions.electron) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }

  try {
    const child = spawn(process.execPath, [launcherScriptPath], {
      cwd: __dirname,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
      env,
    })
    child.unref()
  } finally {
    fs.closeSync(logFd)
  }

  const ready = await waitForLauncher(15000, 500)
  if (!ready) {
    throw new Error(`Automation launcher did not become ready. Log: ${logPath}`)
  }

  writeStdout(`Automation launcher started at http://${host}:${port}\n`)
}

function requestLauncherHealth(timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/health`, { timeout: timeoutMs }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(false)
          return
        }
        try {
          const payload = body ? JSON.parse(body) : {}
          resolve(Boolean(payload && payload.ok))
        } catch (_error) {
          resolve(false)
        }
      })
    })

    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForLauncher(timeoutMs, intervalMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestLauncherHealth(1000)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

function writeStdout(message) {
  try {
    process.stdout.write(message)
  } catch (_error) {
    // Ignore stdout errors in detached bootstrap flows.
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
