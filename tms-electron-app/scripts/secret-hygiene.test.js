const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')

const {
  copyDirectoryFiltered,
  findIncompleteFilteredFiles,
} = require('./run-pack-default')

const repoRoot = path.resolve(__dirname, '..', '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('keeps local automation secrets and launcher data out of git tracking', () => {
  const gitignore = readRepoFile('.gitignore')

  assert.match(gitignore, /(^|\n)\*\.secret\.local\.json\r?\n/)
  assert.match(gitignore, /(^|\n)\*\.local\.json\r?\n/)
  assert.match(gitignore, /(^|\n)\.local-launcher-data\/\r?\n/)
})

test('excludes local automation secrets from packaged Electron resources', () => {
  const electronPackage = JSON.parse(readRepoFile('tms-electron-app/package.json'))
  const automationAppsResource = electronPackage.build.extraResources.find((resource) => (
    resource.from === 'automation-apps'
  ))

  assert(automationAppsResource, 'automation-apps extraResource entry not found')
  assert(automationAppsResource.filter.includes('!**/*.secret.local.json'))
  assert(automationAppsResource.filter.includes('!**/*.local.json'))
  assert(automationAppsResource.filter.includes('!**/executor.secret*.json'))
})

test('does not prefill automation scenario passwords in frontend source', () => {
  const source = readRepoFile('tms-frontend/src/pages/web-automation/WebAutomationScenarioPage.vue')

  assert.doesNotMatch(source, /const\s+default[A-Za-z]*Password\s*=\s*['"][^'"]+['"]/)
})

test('filters local automation runtime data during package resource sync', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-automation-filter-'))
  const sourceRoot = path.join(root, 'source')
  const targetRoot = path.join(root, 'target')

  fs.mkdirSync(path.join(sourceRoot, 'demo-app', 'bin'), { recursive: true })
  fs.mkdirSync(path.join(sourceRoot, 'demo-app', 'run-artifacts'), { recursive: true })
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'package.json'), '{}')
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'bin', 'start.js'), '')
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'executor.config.json'), '{}')
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'executor.secret.local.json'), '{"password":"secret"}')
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'direct-upload.stdout.json'), '{}')
  fs.writeFileSync(path.join(sourceRoot, 'demo-app', 'run-artifacts', 'last-result.json'), '{}')

  copyDirectoryFiltered(sourceRoot, targetRoot)

  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'package.json')), true)
  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'bin', 'start.js')), true)
  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'executor.config.json')), true)
  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'executor.secret.local.json')), false)
  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'direct-upload.stdout.json')), false)
  assert.equal(fs.existsSync(path.join(targetRoot, 'demo-app', 'run-artifacts')), false)
  assert.deepEqual(findIncompleteFilteredFiles(sourceRoot, targetRoot), [])
})
