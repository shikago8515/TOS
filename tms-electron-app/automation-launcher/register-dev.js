const path = require('path')
const { spawnSync } = require('child_process')

if (process.platform !== 'win32') {
  console.error('The dev launcher registration helper currently supports Windows only.')
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const shouldUnregister = args.has('--unregister')
const shouldInstallStartup = args.has('--startup')
const shouldStart = args.has('--start')

const nodeExe = process.execPath
const bootstrapScript = path.resolve(__dirname, 'bootstrap.js')
const electronIconSource = path.resolve(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
const iconSource = require('fs').existsSync(electronIconSource) ? electronIconSource : nodeExe
const commandValue = quoteCommand(nodeExe, bootstrapScript, '--protocol', '%1')
const startupCommandValue = quoteCommand(nodeExe, bootstrapScript, '--startup')
const protocolRoot = 'HKCU\\Software\\Classes\\tos'
const startupRoot = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const startupName = 'TOSAutomationLauncherDev'

function main() {
  if (shouldUnregister) {
    deleteRegistryTree(protocolRoot)
    deleteRegistryValue(startupRoot, startupName)
    console.log('Removed dev launcher protocol/startup registration.')
    return
  }

  addRegistryValue(protocolRoot, undefined, 'REG_SZ', 'URL:TOS Automation Launcher (Dev)')
  addRegistryValue(protocolRoot, 'URL Protocol', 'REG_SZ', '')
  addRegistryValue(`${protocolRoot}\\DefaultIcon`, undefined, 'REG_SZ', iconSource)
  addRegistryValue(`${protocolRoot}\\shell\\open\\command`, undefined, 'REG_SZ', commandValue)

  if (shouldInstallStartup) {
    addRegistryValue(startupRoot, startupName, 'REG_SZ', startupCommandValue)
  }

  console.log('Registered current source workspace as the tos:// launcher handler.')
  console.log(`Protocol command: ${commandValue}`)
  if (shouldInstallStartup) {
    console.log(`Startup command:  ${startupCommandValue}`)
  }

  if (shouldStart) {
    const result = spawnSync(nodeExe, [bootstrapScript], {
      cwd: path.dirname(bootstrapScript),
      stdio: 'inherit',
    })
    if (result.status && result.status !== 0) {
      process.exit(result.status)
    }
  }
}

function quoteCommand(executable, scriptPath, ...extraArgs) {
  return [executable, scriptPath, ...extraArgs]
    .map((value) => `"${String(value).replace(/"/g, '\\"')}"`)
    .join(' ')
}

function addRegistryValue(key, name, type, value) {
  const regArgs = ['add', key, '/f', '/t', type]
  if (name) {
    regArgs.push('/v', name)
  } else {
    regArgs.push('/ve')
  }
  regArgs.push('/d', value)
  runReg(regArgs)
}

function deleteRegistryTree(key) {
  runReg(['delete', key, '/f'], true)
}

function deleteRegistryValue(key, name) {
  runReg(['delete', key, '/v', name, '/f'], true)
}

function runReg(regArgs, allowFailure = false) {
  const result = spawnSync('reg.exe', regArgs, {
    shell: false,
    encoding: 'utf8',
  })

  if (allowFailure && result.status !== 0) {
    return
  }

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    const stdout = (result.stdout || '').trim()
    throw new Error(stderr || stdout || `reg.exe failed with exit code ${result.status}`)
  }
}

main()
