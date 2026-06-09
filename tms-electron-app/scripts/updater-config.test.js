const assert = require('assert')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const mainProcessPath = path.resolve(__dirname, '..', 'main-simple.js')
const preloadPath = path.resolve(__dirname, '..', 'preload.js')
const packagePath = path.resolve(__dirname, '..', 'package.json')

test('disables differential updater downloads for NSIS releases', () => {
  const source = fs.readFileSync(mainProcessPath, 'utf8')
  const configureStart = source.indexOf('function configureAutoUpdater()')
  const configureEnd = source.indexOf('function buildUpdateErrorResult')

  assert(configureStart >= 0, 'configureAutoUpdater function not found')
  assert(configureEnd > configureStart, 'configureAutoUpdater function boundary not found')

  const configureSource = source.slice(configureStart, configureEnd)
  assert.match(configureSource, /autoUpdater\.disableDifferentialDownload\s*=\s*true/)
})

test('exposes manual zip fallback download separately from NSIS updater install', () => {
  const mainSource = fs.readFileSync(mainProcessPath, 'utf8')
  const preloadSource = fs.readFileSync(preloadPath, 'utf8')

  assert.match(mainSource, /MANUAL_DOWNLOADS_FILE\s*=\s*'manual-downloads\.json'/)
  assert.match(mainSource, /function fetchManualDownloads\(/)
  assert.match(mainSource, /ipcMain\.handle\('open-manual-download'/)
  assert.match(preloadSource, /openManualDownload:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-manual-download'\)/)
})

test('uses canonical dot-separated installer artifact names', () => {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

  assert.equal(pkg.build.artifactName, 'TOS.Setup.${version}.${ext}')
})
