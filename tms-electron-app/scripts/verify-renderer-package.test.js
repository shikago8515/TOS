const assert = require('assert')
const test = require('node:test')

const {
  collectPackagedAppHygieneIssues,
} = require('./verify-renderer-package')

test('packaged app hygiene allows normal renderer assets', () => {
  const issues = collectPackagedAppHygieneIssues(__dirname, [
    'dist-frontend/index.html',
    'dist-frontend/assets/index.js',
    'dist-frontend/assets/index.css',
    'main-simple.js',
    'preload.js',
  ])

  assert.deepEqual(issues, [])
})

test('packaged app hygiene rejects generated package outputs and duplicate resources', () => {
  const issues = collectPackagedAppHygieneIssues(__dirname, [
    'dist-frontend/index.html',
    'dist-next-test/win-unpacked/TOS.exe',
    'dist-next-test/win-unpacked/resources/app.asar',
    'backend-runtime/tos-backend/tos-backend.exe',
    'automation-launcher/server.js',
  ])

  assert(issues.some((issue) => issue.includes('generated dist output leaked into app.asar')))
  assert(issues.some((issue) => issue.includes('nested win-unpacked output leaked into app.asar')))
  assert(issues.some((issue) => issue.includes('nested app.asar leaked into app.asar')))
  assert(issues.some((issue) => issue.includes('extraResources content was also packed into app.asar')))
})
