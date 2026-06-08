const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const vm = require('vm')

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tos-clean-artifacts-'))
}

function runCleanerAgainst(rootDir) {
  const scriptPath = path.join(__dirname, 'clean-update-artifacts.js')
  const script = fs.readFileSync(scriptPath, 'utf8')
  const sandbox = {
    __dirname: path.join(rootDir, 'scripts'),
    console: { log() {} },
    module: { exports: {} },
    exports: {},
    require,
  }

  fs.mkdirSync(sandbox.__dirname, { recursive: true })
  vm.runInNewContext(script, sandbox, { filename: scriptPath })
}

test('removes stale unpacked zip download artifacts from the top-level dist folder', () => {
  const root = makeTempDir()
  const distDir = path.join(root, 'dist')
  const unpackedZip = path.join(distDir, 'TOS_v0.9.7-beta.1.4_Windows_x64_unpacked.zip')
  const nestedZip = path.join(distDir, 'win-unpacked', 'TOS_v0.9.7-beta.1.4_Windows_x64_unpacked.zip')

  fs.mkdirSync(path.dirname(nestedZip), { recursive: true })
  fs.writeFileSync(unpackedZip, 'stale')
  fs.writeFileSync(nestedZip, 'nested')

  runCleanerAgainst(root)

  assert.equal(fs.existsSync(unpackedZip), false)
  assert.equal(fs.existsSync(nestedZip), true)
})

test('removes generated manual download metadata and downloads folder', () => {
  const root = makeTempDir()
  const distDir = path.join(root, 'dist')
  const manifest = path.join(distDir, 'manual-downloads.json')
  const manualZip = path.join(distDir, 'downloads', '0.9.7-beta.1.4', 'TOS_v0.9.7-beta.1.4_Windows_x64_unpacked.zip')
  const packagedResource = path.join(distDir, 'win-unpacked', 'resources', 'app.asar')

  fs.mkdirSync(path.dirname(manualZip), { recursive: true })
  fs.mkdirSync(path.dirname(packagedResource), { recursive: true })
  fs.writeFileSync(manifest, '{}')
  fs.writeFileSync(manualZip, 'manual zip')
  fs.writeFileSync(packagedResource, 'asar')

  runCleanerAgainst(root)

  assert.equal(fs.existsSync(manifest), false)
  assert.equal(fs.existsSync(path.join(distDir, 'downloads')), false)
  assert.equal(fs.existsSync(packagedResource), true)
})

test('removes canonical and legacy installer artifacts from the top-level dist folder', () => {
  const root = makeTempDir()
  const distDir = path.join(root, 'dist')
  const canonicalInstaller = path.join(distDir, 'TOS.Setup.0.9.8-beta.0.5.exe')
  const canonicalBlockmap = path.join(distDir, 'TOS.Setup.0.9.8-beta.0.5.exe.blockmap')
  const legacyInstaller = path.join(distDir, 'TOS Setup 0.9.8-beta.0.5.exe')
  const legacyBlockmap = path.join(distDir, 'TOS Setup 0.9.8-beta.0.5.exe.blockmap')
  const packagedResource = path.join(distDir, 'win-unpacked', 'resources', 'app.asar')

  fs.mkdirSync(path.dirname(packagedResource), { recursive: true })
  fs.writeFileSync(canonicalInstaller, 'installer')
  fs.writeFileSync(canonicalBlockmap, 'blockmap')
  fs.writeFileSync(legacyInstaller, 'legacy installer')
  fs.writeFileSync(legacyBlockmap, 'legacy blockmap')
  fs.writeFileSync(packagedResource, 'asar')

  runCleanerAgainst(root)

  assert.equal(fs.existsSync(canonicalInstaller), false)
  assert.equal(fs.existsSync(canonicalBlockmap), false)
  assert.equal(fs.existsSync(legacyInstaller), false)
  assert.equal(fs.existsSync(legacyBlockmap), false)
  assert.equal(fs.existsSync(packagedResource), true)
})
