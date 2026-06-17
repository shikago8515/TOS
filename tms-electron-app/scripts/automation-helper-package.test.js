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
