const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')

const {
  collectReleasePackageIssues,
} = require('./verify-release-package')

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tos-release-verify-'))
}

function touch(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

test('reports missing runtime resources in an unpacked app directory', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(appOutDir, 'resources', 'app.asar'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.2',
  })

  assert(issues.some((issue) => issue.includes('resources/browser-plugins/registry.json')))
  assert(issues.some((issue) => issue.includes('resources/backend/main.py')))
  assert(issues.some((issue) => issue.includes('resources/backend-runtime/tos-backend/tos-backend.exe')))
  assert(issues.some((issue) => issue.includes('resources/external-apps/infornexus/electron-app.exe')))
})

test('reports latest.yml when the referenced installer is missing', () => {
  const root = makeTempDir()
  const appOutDir = path.join(root, 'win-unpacked')
  touch(path.join(appOutDir, 'resources', 'browser-plugins', 'registry.json'), '[]')
  touch(path.join(appOutDir, 'resources', 'browser-plugins', 'infornexus-auto-add', 'manifest.json'), '{}')
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'registry.json'), '[]')
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'playwright-console', 'bin', 'start.js'))
  touch(path.join(appOutDir, 'resources', 'automation-apps', 'playwright-console', 'node_modules', 'statuses', 'index.js'))
  touch(path.join(appOutDir, 'resources', 'backend', 'main.py'))
  touch(path.join(appOutDir, 'resources', 'backend-runtime', 'tos-backend', 'tos-backend.exe'))
  touch(path.join(appOutDir, 'resources', 'external-apps', 'infornexus', 'electron-app.exe'))
  touch(path.join(root, 'latest.yml'), [
    'version: 0.9.6-beta.2',
    'path: TOS Setup 0.9.6-beta.2.exe',
  ].join('\n'))

  const issues = collectReleasePackageIssues({
    distDir: root,
    appOutDir,
    expectedVersion: '0.9.6-beta.2',
  })

  assert(issues.some((issue) => issue.includes('latest.yml path target is missing')))
})
