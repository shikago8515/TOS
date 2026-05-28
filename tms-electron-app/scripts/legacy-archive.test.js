const assert = require('assert')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const appDir = path.resolve(__dirname, '..')
const packageJson = require('../package.json')

const legacyFiles = [
  {
    activePath: 'build.ps1',
    archivePath: 'archive/legacy-packaging/build.ps1',
  },
  {
    activePath: 'main.js',
    archivePath: 'archive/legacy-packaging/main.js',
  },
  {
    activePath: 'scripts/build-source-frontend.js',
    archivePath: 'archive/legacy-packaging/scripts/build-source-frontend.js',
  },
  {
    activePath: 'scripts/pack-portable-release.js',
    archivePath: 'archive/legacy-packaging/scripts/pack-portable-release.js',
  },
  {
    activePath: 'scripts/pack-source-unpacked.js',
    archivePath: 'archive/legacy-packaging/scripts/pack-source-unpacked.js',
  },
  {
    activePath: 'scripts/pack-unpacked.js',
    archivePath: 'archive/legacy-packaging/scripts/pack-unpacked.js',
  },
]

function exists(relativePath) {
  return fs.existsSync(path.join(appDir, relativePath))
}

test('legacy packaging entrypoints are archived outside active paths', () => {
  for (const legacyFile of legacyFiles) {
    assert.equal(exists(legacyFile.activePath), false, `${legacyFile.activePath} should not remain active`)
    assert.equal(exists(legacyFile.archivePath), true, `${legacyFile.archivePath} should exist`)
  }
})

test('electron-builder excludes archived legacy files from app.asar', () => {
  assert(
    packageJson.build.files.includes('!archive/**/*'),
    'build.files should exclude archive/**/* so legacy files are not packaged',
  )
})

test('portable release entrypoints stay disabled', () => {
  assert.equal(packageJson.scripts['pack:portable'], undefined)
  assert.equal(packageJson.build.portable, undefined)

  const winTargets = packageJson.build.win.target.map((target) => target.target)
  assert.deepEqual(winTargets, ['nsis'])
})
