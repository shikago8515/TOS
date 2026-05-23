const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { buildSourceFrontend, copySourceFrontend } = require('./run-pack-default')

const electronDir = path.resolve(__dirname, '..')
const outputDirName = 'dist-source-frontend'
const outputDir = path.join(electronDir, outputDirName)
const markerPath = path.join(outputDir, '.pack-source-start.json')
const unpackedDir = path.join(outputDir, 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

function nodeEnv() {
  const env = { ...process.env }

  for (const key of Object.keys(env)) {
    if (key.toLowerCase().startsWith('npm_')) {
      delete env[key]
    }
  }

  if (process.versions.electron) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }

  return env
}

function runElectronBuilder() {
  const source = [
    "const { build } = require('electron-builder')",
    'const options = {',
    '  projectDir: process.cwd(),',
    '  dir: true,',
    "  publish: 'never',",
    `  config: { directories: { output: ${JSON.stringify(outputDirName)} } },`,
    '}',
    'build(options).then(() => {',
    '  process.exit(0)',
    '}).catch((error) => {',
    '  console.error(error)',
    '  process.exit(1)',
    '})',
  ].join('\n')

  return spawnSync(process.execPath, ['-e', source], {
    cwd: electronDir,
    shell: false,
    stdio: 'inherit',
    env: nodeEnv(),
  })
}

function hasGeneratedUnpackedApp() {
  return fs.existsSync(appAsar) && (fs.existsSync(productExe) || fs.existsSync(electronExe))
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function waitForGeneratedUnpackedApp(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (hasGeneratedUnpackedApp()) return true
    sleepSync(250)
  }

  return hasGeneratedUnpackedApp()
}

function newestMtimeMs(targetPath) {
  if (!fs.existsSync(targetPath)) return 0

  const stat = fs.statSync(targetPath)
  let newest = stat.mtimeMs

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      newest = Math.max(newest, newestMtimeMs(path.join(targetPath, entry)))
    }
  }

  return newest
}

function waitForStableUnpackedApp(stableMs = 3000, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs
  let lastMtime = -1
  let lastChangedAt = Date.now()

  while (Date.now() < deadline) {
    const currentMtime = newestMtimeMs(unpackedDir)

    if (currentMtime > 0 && currentMtime === lastMtime && Date.now() - lastChangedAt >= stableMs) {
      return true
    }

    if (currentMtime !== lastMtime) {
      lastMtime = currentMtime
      lastChangedAt = Date.now()
    }

    sleepSync(500)
  }

  return false
}

function finalizeUnpackedApp() {
  if (fs.existsSync(appAsar) && !fs.existsSync(productExe) && fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, productExe)
  }

  if (!fs.existsSync(appAsar) || !fs.existsSync(productExe)) {
    throw new Error(`Packed app is incomplete: ${unpackedDir}`)
  }
}

async function main() {
  fs.rmSync(outputDir, { recursive: true, force: true })
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(markerPath, JSON.stringify({ startedAt: Date.now() }), 'utf8')

  console.log('[1/3] Build rebuilt frontend')
  buildSourceFrontend()

  console.log('[2/3] Copy rebuilt frontend into Electron staging')
  copySourceFrontend()

  console.log('[3/3] Pack independent win-unpacked test app')
  const result = runElectronBuilder()
  const generated = waitForGeneratedUnpackedApp()

  if (result.status !== 0 && !generated) {
    process.exit(result.status || 1)
  }

  if (!generated) {
    throw new Error(`Packed app was not generated: ${unpackedDir}`)
  }

  if (!waitForStableUnpackedApp()) {
    throw new Error(`Packed app did not settle: ${unpackedDir}`)
  }

  if (result.status !== 0) {
    console.warn('electron-builder returned a non-zero code after producing win-unpacked; kept the generated app.')
  }

  finalizeUnpackedApp()
  console.log(`Packed source-frontend test app: ${productExe}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
