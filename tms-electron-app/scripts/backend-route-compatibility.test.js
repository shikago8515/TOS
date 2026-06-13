const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function extractRequiredBackendOpenapiPaths(source) {
  const match = source.match(/const REQUIRED_BACKEND_OPENAPI_PATHS = \[([\s\S]*?)\];/)
  assert(match, 'REQUIRED_BACKEND_OPENAPI_PATHS should be declared in main-simple.js')

  return Array.from(match[1].matchAll(/'([^']+)'/g), (item) => item[1])
}

test('backend compatibility probe requires Draft Packing compare routes', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main-simple.js'), 'utf8')
  const requiredPaths = extractRequiredBackendOpenapiPaths(mainSource)

  assert.deepEqual(
    requiredPaths.filter((routePath) => routePath.startsWith('/api/draft-packing-compare/')).sort(),
    [
      '/api/draft-packing-compare/download/{filename}',
      '/api/draft-packing-compare/process',
    ],
    'Electron must reject stale backends that do not expose Draft Packing compare APIs'
  )
})
