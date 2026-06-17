import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultBackendUrl = 'http://127.0.0.1:8000'

export async function checkBackendVersion({
  repoRoot = defaultRepoRoot,
  backendUrl = defaultBackendUrl,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable; use Node.js 18+ or pass fetchImpl.')
  }

  const expectedVersion = await readExpectedVersion(repoRoot)
  const backendPayload = await fetchJson(fetchImpl, buildBackendUrl(backendUrl, '/'))
  const backendVersion = normalizeVersion(backendPayload.version)

  if (backendVersion !== expectedVersion) {
    throw new Error(
      [
        `Backend root version mismatch: expected ${expectedVersion}, got ${backendVersion || '<missing>'}.`,
        'Restart tms-backend/main.py from the current branch before testing the frontend.',
      ].join(' '),
    )
  }

  const releaseUpdatesPayload = await fetchJson(
    fetchImpl,
    buildBackendUrl(backendUrl, '/api/release-updates?limit=1'),
  )
  const releaseUpdatesVersion = normalizeVersion(releaseUpdatesPayload.version)

  if (releaseUpdatesVersion !== expectedVersion) {
    throw new Error(
      [
        `Release updates runtime version mismatch: expected ${expectedVersion}, got ${releaseUpdatesVersion || '<missing>'}.`,
        'Restart tms-backend/main.py and refresh /api/release-updates before validating release notes.',
      ].join(' '),
    )
  }

  return {
    expectedVersion,
    backendVersion,
    releaseUpdatesVersion,
  }
}

async function readExpectedVersion(repoRoot) {
  const appVersionPath = resolve(repoRoot, 'app-version.json')
  const payload = JSON.parse(await readFile(appVersionPath, 'utf8'))
  const version = normalizeVersion(payload.version)

  if (!version) {
    throw new Error(`Missing version in ${appVersionPath}`)
  }

  return version
}

async function fetchJson(fetchImpl, url) {
  let response
  try {
    response = await fetchImpl(url, { method: 'GET' })
  } catch (error) {
    throw new Error(`Unable to reach backend at ${url}: ${formatError(error)}`)
  }

  if (!response.ok) {
    throw new Error(`Backend request failed at ${url}: HTTP ${response.status}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

function buildBackendUrl(backendUrl, path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${backendUrl.replace(/\/$/, '')}${normalizedPath}`
}

function normalizeVersion(version) {
  return typeof version === 'string'
    ? version.trim().replace(/^v/i, '')
    : ''
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}

async function main() {
  const backendUrl = process.argv[2] || defaultBackendUrl
  const result = await checkBackendVersion({ backendUrl })
  console.log(
    `Backend version OK: ${result.backendVersion}; release updates version OK: ${result.releaseUpdatesVersion}`,
  )
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
