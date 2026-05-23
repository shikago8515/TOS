const fs = require('fs')
const path = require('path')

const electronDir = path.resolve(__dirname, '..')
const markerPath = path.join(electronDir, 'dist-source-frontend', '.pack-source-start.json')
const unpackedDir = path.join(electronDir, 'dist-source-frontend', 'win-unpacked')
const appAsar = path.join(unpackedDir, 'resources', 'app.asar')
const productExe = path.join(unpackedDir, 'TOS.exe')

function readStartedAt() {
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'))
    return typeof marker.startedAt === 'number' ? marker.startedAt : 0
  } catch {
    return 0
  }
}

const startedAt = readStartedAt()
const hasFreshApp =
  startedAt > 0 &&
  fs.existsSync(appAsar) &&
  fs.existsSync(productExe) &&
  fs.statSync(appAsar).mtimeMs >= startedAt - 5000

if (!hasFreshApp) {
  console.error(`Packed source-frontend app is incomplete or stale: ${unpackedDir}`)
  process.exit(1)
}

console.warn('pack:source verified fresh win-unpacked output after a non-zero builder exit.')
console.log(`Packed source-frontend test app: ${productExe}`)
