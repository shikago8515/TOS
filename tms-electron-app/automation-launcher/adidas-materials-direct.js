const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

let collectorBridge = null

async function launchAdidasMaterialsCollector(options = {}) {
  const bridge = getCollectorBridge(options)
  return bridge.launchCollector()
}

function getCollectorBridge(options) {
  if (collectorBridge) {
    return collectorBridge
  }

  const { registerAdidasMaterialsCollector } = require(resolveAdidasMaterialsMainPath())
  collectorBridge = registerAdidasMaterialsCollector({
    app: createAppAdapter(options.userDataDir),
    BrowserWindow: null,
    ipcMain: createIpcMainAdapter(),
    dialog: createDialogAdapter(),
    shell: createShellAdapter(),
    getParentWindow: () => null,
  })

  if (!collectorBridge || typeof collectorBridge.launchCollector !== 'function') {
    throw new Error('adidas materials collector bridge is unavailable.')
  }

  return collectorBridge
}

function resolveAdidasMaterialsMainPath() {
  const envPath = process.env.TMS_ADIDAS_MATERIALS_MAIN_PATH
  const candidates = [
    envPath,
    path.resolve(__dirname, '..', 'adidas-materials-main.js'),
    process.resourcesPath
      ? path.join(process.resourcesPath, 'app.asar', 'adidas-materials-main.js')
      : '',
    process.resourcesPath
      ? path.join(process.resourcesPath, 'app', 'adidas-materials-main.js')
      : '',
  ].filter(Boolean)

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw new Error(`adidas materials collector entry not found. Checked: ${candidates.join('; ')}`)
  }

  return found
}

function createAppAdapter(userDataDir) {
  const resolvedUserDataDir = path.resolve(userDataDir || getDefaultUserDataDir())

  return {
    getPath(name) {
      if (name === 'userData') return resolvedUserDataDir
      if (name === 'downloads') return path.join(os.homedir(), 'Downloads')
      if (name === 'temp') return os.tmpdir()
      return resolvedUserDataDir
    },
    on(eventName, handler) {
      if (eventName !== 'before-quit' || typeof handler !== 'function') {
        return
      }
      process.once('SIGINT', handler)
      process.once('SIGTERM', handler)
    },
  }
}

function getDefaultUserDataDir() {
  const roamingRoot = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  return path.join(roamingRoot, process.env.TMS_AUTOMATION_APP_NAME || 'TOS')
}

function createIpcMainAdapter() {
  const handlers = new Map()
  return {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    async invoke(channel, ...args) {
      const handler = handlers.get(channel)
      if (!handler) {
        throw new Error(`No handler registered for ${channel}`)
      }
      return handler({}, ...args)
    },
  }
}

function createDialogAdapter() {
  return {
    async showOpenDialog() {
      return {
        canceled: true,
        filePaths: [],
      }
    },
  }
}

function createShellAdapter() {
  return {
    async openPath(targetPath) {
      try {
        await openPathWithSystemShell(targetPath)
        return ''
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
    },
  }
}

function openPathWithSystemShell(targetPath) {
  return new Promise((resolve, reject) => {
    const launcher = buildPathLauncher(targetPath)
    const child = spawn(launcher.command, launcher.args, {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })

    let settled = false
    child.once('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })

    child.unref()
    setTimeout(() => {
      if (settled) return
      settled = true
      resolve()
    }, 250)
  })
}

function buildPathLauncher(targetPath) {
  if (process.platform === 'win32') {
    return {
      command: 'explorer.exe',
      args: [targetPath],
    }
  }

  if (process.platform === 'darwin') {
    return {
      command: 'open',
      args: [targetPath],
    }
  }

  return {
    command: 'xdg-open',
    args: [targetPath],
  }
}

module.exports = {
  launchAdidasMaterialsCollector,
}
