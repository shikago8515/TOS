const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { requiredBackendOpenapiPaths } = require('../backend-compatibility')

const repoRoot = path.resolve(__dirname, '..', '..')
const frontendRoot = path.join(repoRoot, 'tms-frontend', 'src')
const fastApiSourceRoots = [
  path.join(frontendRoot, 'pages'),
  path.join(frontendRoot, 'shared'),
]
const excludedFrontendPathParts = [
  `${path.sep}web-automation${path.sep}`,
  `${path.sep}shipping-automation-2${path.sep}`,
  `${path.sep}adidas-materials${path.sep}`,
]

function listFrontendSources(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return listFrontendSources(fullPath)
    }
    if (!/\.(ts|vue|html)$/.test(entry.name)) {
      return []
    }
    if (excludedFrontendPathParts.some((part) => fullPath.includes(part))) {
      return []
    }
    return [fullPath]
  })
}

function normalizeFrontendApiPath(rawPath, filePath) {
  if (filePath.includes(`${path.sep}it-invoice-pdf-reorder${path.sep}`)) {
    return rawPath.startsWith('/api/it-invoice-pdf-reorder/')
      ? rawPath
      : `/api/it-invoice-pdf-reorder${rawPath.slice('/api'.length)}`
  }
  return rawPath
}

function extractFrontendFastApiPaths(source, filePath) {
  const paths = new Set()
  const literalPatterns = [
    /path:\s*'([^']+)'/g,
    /postForm\('([^']+)'/g,
    /fetch\(api\('([^']+)'/g,
  ]

  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) {
      const routePath = match[1]
      if (routePath.startsWith('/api/')) {
        paths.add(normalizeFrontendApiPath(routePath, filePath))
      }
    }
  }

  for (const match of source.matchAll(/buildBackendDownloadUrl\(\s*`([^`]+)`/g)) {
    const routePath = match[1]
      .replace(/\$\{encodeURIComponent\(filename\)\}/g, '{filename}')
      .replace(/\$\{encodeURIComponent\(jobId\)\}/g, '{job_id}')
      .replace(/\$\{encodeURIComponent\(job_id\)\}/g, '{job_id}')
    if (routePath.startsWith('/api/')) {
      paths.add(normalizeFrontendApiPath(routePath, filePath))
    }
  }

  return paths
}

test('desktop backend API contract covers frontend FastAPI paths', () => {
  const contractPaths = new Set(requiredBackendOpenapiPaths)
  const frontendPaths = new Set()

  for (const sourceRoot of fastApiSourceRoots) {
    for (const filePath of listFrontendSources(sourceRoot)) {
      const source = fs.readFileSync(filePath, 'utf8')
      for (const routePath of extractFrontendFastApiPaths(source, filePath)) {
        frontendPaths.add(routePath)
      }
    }
  }

  const missingPaths = Array.from(frontendPaths)
    .filter((routePath) => !contractPaths.has(routePath))
    .sort()

  assert.deepEqual(missingPaths, [])
})
