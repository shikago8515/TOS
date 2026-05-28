const fs = require('fs')
const path = require('path')
const { build } = require('electron-builder')
const {
  buildSourceFrontend,
  copySourceFrontend,
  syncAutomationApps,
  verifyAutomationApps,
} = require('./run-pack-default')

process.noAsar = true

const electronDir = path.resolve(__dirname, '..')
const outputDirName = 'dist-source-frontend'
const outputDir = path.join(electronDir, outputDirName)
const unpackedDir = path.join(outputDir, 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')
const bundledBackendExe = path.join(
  unpackedDir,
  'resources',
  'backend-runtime',
  'tos-backend',
  'tos-backend.exe',
)

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`)
  }
}

function finalizeUnpackedApp() {
  if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, productExe)
  }
}

async function main() {
  requireFile(
    path.join(electronDir, 'backend-runtime', 'tos-backend', 'tos-backend.exe'),
    'bundled backend executable',
  )

  fs.rmSync(outputDir, { recursive: true, force: true })

  buildSourceFrontend()
  copySourceFrontend()

  await build({
    projectDir: electronDir,
    dir: true,
    publish: 'never',
    config: {
      directories: {
        output: outputDirName,
      },
    },
  })

  finalizeUnpackedApp()
  syncAutomationApps(unpackedDir)
  verifyAutomationApps(unpackedDir)

  requireFile(appAsar, 'app.asar')
  requireFile(productExe, 'TOS executable')
  requireFile(bundledBackendExe, 'bundled backend executable in package')

  console.log(`Portable app ready: ${productExe}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
