const fs = require('fs')
const path = require('path')
const { syncAutomationApps, verifyAutomationApps } = require('./run-pack-default')

const electronDir = path.resolve(__dirname, '..')
const markerPath = path.join(electronDir, 'dist', '.pack-default-start.json')
const unpackedDir = path.join(electronDir, 'dist', 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')
const electronExe = path.join(unpackedDir, 'electron.exe')

function readStartedAt() {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
    return typeof marker.startedAt === 'number' ? marker.startedAt : 0
  } catch {
    return 0
  }
}

function hasFreshApp(startedAt) {
  if (
    startedAt <= 0 ||
    !fs.existsSync(appAsar) ||
    (!fs.existsSync(productExe) && !fs.existsSync(electronExe))
  ) {
    return false
  }

  return fs.statSync(appAsar).mtimeMs >= startedAt - 5000
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function waitForFreshApp(startedAt, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (hasFreshApp(startedAt)) return true
    sleepSync(250)
  }

  return hasFreshApp(startedAt)
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
}

const startedAt = readStartedAt()

if (!waitForFreshApp(startedAt)) {
  console.error(`Packed default app is incomplete or stale: ${unpackedDir}`)
  process.exit(1)
}

if (!waitForStableUnpackedApp()) {
  console.error(`Packed default app did not settle: ${unpackedDir}`)
  process.exit(1)
}

finalizeUnpackedApp()
syncAutomationApps(unpackedDir)
verifyAutomationApps(unpackedDir)

if (!fs.existsSync(productExe)) {
  console.error(`Packed default app is missing executable: ${productExe}`)
  process.exit(1)
}

console.warn('pack verified fresh win-unpacked output after a non-zero builder exit.')
console.log(`Packed default app: ${productExe}`)
