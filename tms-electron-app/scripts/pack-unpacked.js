const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

require('./copy-frontend')

const electronDir = path.resolve(__dirname, '..')
const builderCli = path.join(electronDir, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
const unpackedDir = path.join(electronDir, 'dist', 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

const result = spawnSync(process.execPath, [builderCli, '--dir', '--publish=never'], {
  cwd: electronDir,
  shell: false,
  stdio: 'inherit',
})

if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
  fs.renameSync(electronExe, productExe)
}

if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
  process.exit(result.status || 1)
}

if (result.status !== 0) {
  console.warn('electron-builder returned a non-zero code after producing win-unpacked; kept the generated app.')
}

console.log(`Packed unpacked app: ${productExe}`)
