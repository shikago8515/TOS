const backendApiContract = require('./backend-api-contract.json')

const requiredBackendOpenapiPaths = Object.freeze(
  [...backendApiContract.requiredOpenapiPaths].sort()
)

function getOpenapiPaths(openapi) {
  return openapi && typeof openapi === 'object' && openapi.paths && typeof openapi.paths === 'object'
    ? openapi.paths
    : {}
}

function getOpenapiVersion(openapi) {
  return openapi && typeof openapi === 'object' && openapi.info && typeof openapi.info.version === 'string'
    ? openapi.info.version
    : ''
}

function evaluateBackendCompatibility({
  healthOk,
  openapi,
  expectedVersion,
  requiredPaths = requiredBackendOpenapiPaths,
}) {
  const normalizedExpectedVersion = typeof expectedVersion === 'string' ? expectedVersion.trim() : ''

  if (!healthOk) {
    return {
      healthy: false,
      compatible: false,
      version: '',
      expectedVersion: normalizedExpectedVersion,
      missingPaths: [...requiredPaths],
      versionMismatch: Boolean(normalizedExpectedVersion),
    }
  }

  const openapiPaths = getOpenapiPaths(openapi)
  const version = getOpenapiVersion(openapi)
  const missingPaths = requiredPaths.filter((routePath) => !Object.prototype.hasOwnProperty.call(openapiPaths, routePath))
  const versionMismatch = Boolean(normalizedExpectedVersion) && version !== normalizedExpectedVersion

  return {
    healthy: true,
    compatible: missingPaths.length === 0 && !versionMismatch,
    version,
    expectedVersion: normalizedExpectedVersion,
    missingPaths,
    versionMismatch,
  }
}

function selectBackendPortCandidates({ defaultReadiness, portCandidates, defaultPort }) {
  if (defaultReadiness && defaultReadiness.healthy && !defaultReadiness.compatible) {
    return portCandidates.filter((port) => port !== defaultPort)
  }

  return [...portCandidates]
}

function describeBackendCompatibilityFailure(backendUrl, readiness) {
  if (!readiness || !readiness.healthy || readiness.compatible) {
    return ''
  }

  const details = []
  if (readiness.versionMismatch) {
    details.push(`version ${readiness.version || 'unknown'} expected ${readiness.expectedVersion || 'unknown'}`)
  } else if (readiness.version) {
    details.push(`version ${readiness.version}`)
  }
  if (Array.isArray(readiness.missingPaths) && readiness.missingPaths.length > 0) {
    details.push(`missing ${readiness.missingPaths.join(', ')}`)
  }

  return `${backendUrl} is an incompatible backend${details.length > 0 ? ` (${details.join('; ')})` : ''}`
}

module.exports = {
  describeBackendCompatibilityFailure,
  evaluateBackendCompatibility,
  requiredBackendOpenapiPaths,
  selectBackendPortCandidates,
}
