const assert = require('node:assert/strict')
const test = require('node:test')

const backendApiContract = require('../backend-api-contract.json')
const {
  evaluateBackendCompatibility,
  requiredBackendOpenapiPaths,
  selectBackendPortCandidates,
} = require('../backend-compatibility')

test('backend API contract includes Draft Packing compare routes', () => {
  assert.deepEqual(
    requiredBackendOpenapiPaths.filter((routePath) => routePath.startsWith('/api/draft-packing-compare/')).sort(),
    [
      '/api/draft-packing-compare/download/{filename}',
      '/api/draft-packing-compare/process',
    ]
  )
  assert.equal(backendApiContract.requiredOpenapiPaths.length, requiredBackendOpenapiPaths.length)
})

test('backend API contract includes iPlex dual table compare routes', () => {
  assert.deepEqual(
    requiredBackendOpenapiPaths.filter((routePath) => routePath.startsWith('/api/iplex/dual-table-compare/')).sort(),
    [
      '/api/iplex/dual-table-compare/download/{filename}',
      '/api/iplex/dual-table-compare/inspect',
      '/api/iplex/dual-table-compare/process',
    ]
  )
})

test('backend API contract includes release and system config routes', () => {
  assert.deepEqual(
    requiredBackendOpenapiPaths.filter((routePath) => (
      routePath === '/api/release-updates' || routePath.startsWith('/api/system/config/')
    )).sort(),
    [
      '/api/release-updates',
      '/api/system/config/automation-helper/download',
      '/api/system/config/automation-helper/payload',
      '/api/system/config/automation-helper/payload/{payload_sha256}',
      '/api/system/config/installer-versions',
      '/api/system/config/summary',
      '/api/system/config/tos-desktop-full/download',
      '/api/system/config/tos-desktop/download',
      '/api/system/config/tos-desktop/payload',
      '/api/system/config/tos-desktop/payload/{payload_sha256}',
    ]
  )
})

test('backend compatibility rejects healthy backend with an older version', () => {
  const readiness = evaluateBackendCompatibility({
    healthOk: true,
    expectedVersion: '0.9.8-beta.3.4',
    openapi: {
      info: { version: '0.9.8-beta.3.2' },
      paths: Object.fromEntries(requiredBackendOpenapiPaths.map((routePath) => [routePath, {}])),
    },
  })

  assert.equal(readiness.healthy, true)
  assert.equal(readiness.compatible, false)
  assert.equal(readiness.versionMismatch, true)
  assert.equal(readiness.version, '0.9.8-beta.3.2')
  assert.equal(readiness.expectedVersion, '0.9.8-beta.3.4')
})

test('backend compatibility rejects healthy backend missing contract routes', () => {
  const paths = Object.fromEntries(requiredBackendOpenapiPaths.map((routePath) => [routePath, {}]))
  delete paths['/api/draft-packing-compare/process']

  const readiness = evaluateBackendCompatibility({
    healthOk: true,
    expectedVersion: '0.9.8-beta.3.4',
    openapi: {
      info: { version: '0.9.8-beta.3.4' },
      paths,
    },
  })

  assert.equal(readiness.healthy, true)
  assert.equal(readiness.compatible, false)
  assert.deepEqual(readiness.missingPaths, ['/api/draft-packing-compare/process'])
})

test('backend startup skips default port when default backend is incompatible', () => {
  assert.deepEqual(
    selectBackendPortCandidates({
      defaultReadiness: {
        healthy: true,
        compatible: false,
        versionMismatch: true,
        missingPaths: [],
      },
      portCandidates: [8000, 8001, 8002],
      defaultPort: 8000,
    }),
    [8001, 8002]
  )
})
