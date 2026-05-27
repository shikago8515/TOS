const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(electronDir, '..')
const backendDir = path.join(repoRoot, 'tms-backend')
const runtimeRoot = path.join(electronDir, 'backend-runtime')
const runtimeDir = path.join(runtimeRoot, 'tos-backend')
const workPath = path.join(backendDir, 'build', 'pyinstaller')
const launcherPath = path.join(backendDir, 'backend_launcher.py')

function assertInside(parent, target) {
  const resolvedParent = path.resolve(parent)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(resolvedParent, resolvedTarget)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${resolvedParent}: ${resolvedTarget}`)
  }
}

function getPyInstallerCommand() {
  const venvCommand = process.platform === 'win32'
    ? path.join(backendDir, '.venv', 'Scripts', 'pyinstaller.exe')
    : path.join(backendDir, '.venv', 'bin', 'pyinstaller')

  return fs.existsSync(venvCommand) ? venvCommand : 'pyinstaller'
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`)
  }
}

function main() {
  requireFile(launcherPath, 'backend launcher')
  fs.mkdirSync(runtimeRoot, { recursive: true })

  // 发布包优先运行 backend-runtime，所以每次打包前必须用当前后端源码重建它。
  assertInside(runtimeRoot, runtimeDir)
  fs.rmSync(runtimeDir, { recursive: true, force: true })

  const pyinstaller = getPyInstallerCommand()
  const args = [
    '--noconfirm',
    '--clean',
    '--onedir',
    '--name',
    'tos-backend',
    '--specpath',
    workPath,
    '--distpath',
    runtimeRoot,
    '--workpath',
    workPath,
    launcherPath
  ]

  const result = spawnSync(pyinstaller, args, {
    cwd: backendDir,
    stdio: 'inherit',
    shell: false
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`PyInstaller exited with code ${result.status}`)
  }

  const runtimeExe = process.platform === 'win32'
    ? path.join(runtimeDir, 'tos-backend.exe')
    : path.join(runtimeDir, 'tos-backend')
  requireFile(runtimeExe, 'backend runtime executable')
  requireFile(path.join(runtimeDir, '_internal', 'base_library.zip'), 'backend runtime base library')

  console.log(`Backend runtime rebuilt: ${runtimeDir}`)
}

main()
