const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

require('./copy-frontend')

const electronDir = path.resolve(__dirname, '..')
const unpackedDir = path.join(electronDir, 'dist', 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

function hasGeneratedUnpackedApp() {
  return fs.existsSync(appAsar) && (fs.existsSync(productExe) || fs.existsSync(electronExe))
}

function finalizeUnpackedApp() {
  if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, productExe)
  }

  if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
    throw new Error(`Packed app is incomplete: ${unpackedDir}`)
  }
}

function runElectronBuilder() {
  const source = [
    "const { build } = require('electron-builder')",
    'build({',
    '  projectDir: process.cwd(),',
    '  dir: true,',
    "  publish: 'never',",
    '}).catch((error) => {',
    '  console.error(error)',
    '  process.exit(1)',
    '})',
  ].join('\n')

  return spawnSync(process.execPath, ['-e', source], {
    cwd: electronDir,
    shell: false,
    stdio: 'inherit',
  })
}

async function main() {
  const result = runElectronBuilder()
  if (result.status !== 0) {
    if (!hasGeneratedUnpackedApp()) {
      process.exit(result.status || 1)
    }
    console.warn('electron-builder returned a non-zero code after producing win-unpacked; kept the generated app.')
  }

  finalizeUnpackedApp()
  console.log(`Packed unpacked app: ${productExe}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
