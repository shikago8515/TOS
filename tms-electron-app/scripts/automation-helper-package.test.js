const assert = require('assert')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const scriptsDir = __dirname

const helperInstallerScripts = [
  'build-automation-helper-installer.ps1',
  'build-automation-helper-nsis-installer.ps1',
]

test('automation helper installer payload includes adidas Materials collector entries and dependencies', () => {
  for (const scriptName of helperInstallerScripts) {
    const source = fs.readFileSync(path.join(scriptsDir, scriptName), 'utf8')

    assert.match(
      source,
      /Require-Path \(Join-Path \$ElectronDir "adidas-materials-main\.js"\) "adidas Materials collector entry"/,
      `${scriptName} must validate the adidas Materials collector entry`,
    )
    assert.match(
      source,
      /Copy-Item -LiteralPath \(Join-Path \$ElectronDir "adidas-materials-main\.js"\) -Destination \(Join-Path \$PayloadRoot "adidas-materials-main\.js"\) -Force/,
      `${scriptName} must copy the adidas Materials collector entry into the helper payload root`,
    )
    assert.match(
      source,
      /Require-Path \(Join-Path \$ElectronDir "adidas-materials-preload\.js"\) "adidas Materials preload entry"/,
      `${scriptName} must validate the adidas Materials preload entry`,
    )
    assert.match(
      source,
      /Copy-Item -LiteralPath \(Join-Path \$ElectronDir "adidas-materials-preload\.js"\) -Destination \(Join-Path \$PayloadRoot "adidas-materials-preload\.js"\) -Force/,
      `${scriptName} must copy the adidas Materials preload entry into the helper payload root`,
    )
    assert.match(
      source,
      /copy-automation-helper-dependencies\.js"\) \(Join-Path \$ElectronDir "node_modules"\) \(Join-Path \$PayloadRoot "node_modules"\) ws exceljs/,
      `${scriptName} must copy the collector runtime dependency closure`,
    )
  }
})

test('automation helper installers use the independent helper version file', () => {
  for (const scriptName of helperInstallerScripts) {
    const source = fs.readFileSync(path.join(scriptsDir, scriptName), 'utf8')

    assert.match(
      source,
      /automation-helper-version\.json/,
      `${scriptName} must read the independent helper version file`,
    )
    assert.doesNotMatch(
      source,
      /Join-Path \$RepoRoot "app-version\.json"/,
      `${scriptName} must not derive the helper installer version from the TOS app version`,
    )
    assert.match(
      source,
      /Copy-Item -LiteralPath \(Join-Path \$ElectronDir "automation-helper-version\.json"\) -Destination \(Join-Path \$PayloadRoot "automation-helper-version\.json"\) -Force/,
      `${scriptName} must copy the helper version file into the helper payload root`,
    )
  }
})

test('automation launcher reports helper version from the independent version file', () => {
  const source = fs.readFileSync(path.join(scriptsDir, '..', 'automation-launcher', 'server.js'), 'utf8')

  assert.match(
    source,
    /automation-helper-version\.json/,
    'automation launcher must read the independent helper version file',
  )
  assert.match(
    source,
    /TOS_AUTOMATION_HELPER_VERSION/,
    'automation launcher must still allow an explicit helper version override',
  )
})

test('automation helper dependency copier preserves nested Node resolution', () => {
  const { copyDependencyClosure } = require('./copy-automation-helper-dependencies')
  const root = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tos-helper-deps-'))
  const sourceRoot = path.join(root, 'source-node-modules')
  const targetRoot = path.join(root, 'target-node-modules')

  writePackage(sourceRoot, 'collector', {
    dependencies: {
      lazystream: '1.0.0',
    },
  })
  writePackage(sourceRoot, 'lazystream', {
    dependencies: {
      'readable-stream': '2.0.0',
    },
  })
  writePackage(path.join(sourceRoot, 'lazystream', 'node_modules'), 'readable-stream', {
    dependencies: {
      'process-nextick-args': '1.0.0',
    },
  })
  writePackage(sourceRoot, 'readable-stream', {
    dependencies: {},
  })
  writePackage(sourceRoot, 'process-nextick-args', {
    dependencies: {},
  })

  const copied = copyDependencyClosure({
    sourceRoot,
    targetRoot,
    packageNames: ['collector'],
  })

  assert.deepEqual(copied, [
    'collector',
    'lazystream',
    'lazystream/node_modules/readable-stream',
    'process-nextick-args',
  ])
  assert.equal(fs.existsSync(path.join(targetRoot, 'lazystream', 'node_modules', 'readable-stream')), true)
  assert.equal(fs.existsSync(path.join(targetRoot, 'process-nextick-args')), true)
})

function writePackage(sourceRoot, packageName, packageJson) {
  const packageDir = path.join(sourceRoot, ...packageName.split('/'))
  fs.mkdirSync(packageDir, { recursive: true })
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ name: packageName, version: '1.0.0', ...packageJson }, null, 2),
  )
  fs.writeFileSync(path.join(packageDir, 'index.js'), '')
}
