import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { syncVersion } from './sync-version.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultGiteaApiBaseUrl = 'http://172.16.48.208:3001/api/v1'
const defaultRepository = 'luenthai-ai/TOS'

const releaseTypeMap = {
  feat: 'added',
  fix: 'fixed',
  perf: 'improved',
  refactor: 'improved',
  build: 'improved',
  ci: 'improved',
}

export async function prepare(pluginConfig = {}, context = {}) {
  const repoRoot = resolve(pluginConfig.repoRoot || defaultRepoRoot)
  const version = context.nextRelease?.version
  if (!version) {
    throw new Error('semantic-release did not provide nextRelease.version.')
  }

  const releaseDate = pluginConfig.releaseDate || currentShanghaiDate()
  await syncVersion({
    repoRoot,
    nextVersion: version,
    releaseDate,
  })

  const releaseNotes = buildTosReleaseNotes({
    version,
    releaseDate,
    commits: context.commits || [],
  })
  await writeReleaseNotes(repoRoot, releaseNotes)
  await writeReleaseManifest(repoRoot, buildTosReleaseManifest({
    version,
    tag: context.nextRelease?.gitTag || `v${version}`,
    gitSha: context.nextRelease?.gitHead || process.env.GITEA_SHA || process.env.GITHUB_SHA || '',
    releaseDate,
    channel: pluginConfig.channel || context.branch?.channel || context.branch?.prerelease || '',
    releaseNotes,
  }))
  context.logger?.log?.(`Synced TOS version and release notes for ${version}.`)
}

export async function publish(pluginConfig = {}, context = {}) {
  const token = pluginConfig.giteaToken || process.env.GITEA_TOKEN || process.env.TOS_GITEA_TOKEN
  const repository = pluginConfig.repository || process.env.GITEA_REPOSITORY || defaultRepository
  const fetchImpl = pluginConfig.fetchImpl || globalThis.fetch

  if (!token) {
    context.logger?.warn?.('GITEA_TOKEN is not configured; skipping Gitea Release creation.')
    return
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable; use Node.js 18+ or pass fetchImpl.')
  }

  const request = buildGiteaReleaseRequest({
    apiBaseUrl: pluginConfig.giteaApiBaseUrl || process.env.GITEA_API_BASE_URL || defaultGiteaApiBaseUrl,
    repository,
    token,
    nextRelease: context.nextRelease,
  })

  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  })
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`Gitea Release creation failed: HTTP ${response.status} ${sanitizeResponseText(text)}`)
  }

  context.logger?.log?.(`Created Gitea Release ${request.body.tag_name}.`)
}

export function buildTosReleaseNotes({
  version,
  releaseDate = currentShanghaiDate(),
  commits = [],
}) {
  const notes = {
    version,
    date: releaseDate,
    noticeId: `${releaseDate}-v${version}`,
    showPopup: false,
    added: [],
    improved: [],
    fixed: [],
    modules: [],
  }

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit)
    if (!parsed) {
      continue
    }

    const bucket = releaseTypeMap[parsed.type]
    if (!bucket) {
      continue
    }
    notes[bucket].push(parsed.description)
  }

  if (!hasReleaseNotesContent(notes)) {
    notes.improved.push(`发布 ${version}`)
  }

  return notes
}

export function buildTosReleaseManifest({
  version,
  tag,
  gitSha = '',
  releaseDate = currentShanghaiDate(),
  channel = '',
  releaseNotes,
}) {
  return {
    schemaVersion: 1,
    version,
    tag: tag || `v${version}`,
    gitSha,
    releaseDate,
    channel,
    releaseNotes,
    artifacts: {
      serverPackage: null,
      desktopInstaller: null,
      desktopFullInstaller: null,
      automationHelper: null,
    },
  }
}

export function buildGiteaReleaseRequest({
  apiBaseUrl = defaultGiteaApiBaseUrl,
  repository = defaultRepository,
  token,
  nextRelease,
}) {
  if (!token) {
    throw new Error('Missing Gitea token.')
  }
  if (!nextRelease?.gitTag) {
    throw new Error('semantic-release did not provide nextRelease.gitTag.')
  }

  const normalizedBaseUrl = String(apiBaseUrl).replace(/\/$/, '')
  const normalizedRepository = String(repository).replace(/^\/|\/$/g, '')
  return {
    url: `${normalizedBaseUrl}/repos/${normalizedRepository}/releases`,
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: {
      tag_name: nextRelease.gitTag,
      name: nextRelease.gitTag,
      body: nextRelease.notes || '',
    },
  }
}

function parseConventionalCommit(commit) {
  const firstLine = String(commit.subject || commit.message || '')
    .split(/\r?\n/, 1)[0]
    .trim()
  const match = firstLine.match(/^([a-z]+)(?:\([^)]+\))?!?:\s*(.+)$/i)
  if (!match) {
    return null
  }

  const description = match[2].trim()
  if (!description) {
    return null
  }

  return {
    type: match[1].toLowerCase(),
    description,
  }
}

function hasReleaseNotesContent(releaseNotes) {
  return ['added', 'improved', 'fixed'].some((key) => (
    Array.isArray(releaseNotes[key]) && releaseNotes[key].length > 0
  ))
}

async function writeReleaseNotes(repoRoot, releaseNotes) {
  const releaseNotesPath = resolve(
    repoRoot,
    'tms-frontend',
    'src',
    'shared',
    'version',
    'releaseNotes.json',
  )
  const current = JSON.parse(await readFile(releaseNotesPath, 'utf8'))
  const next = {
    ...current,
    ...releaseNotes,
  }
  await writeFile(releaseNotesPath, `${JSON.stringify(next, null, 2)}\n`)
}

async function writeReleaseManifest(repoRoot, releaseManifest) {
  const releaseManifestPath = resolve(
    repoRoot,
    'tms-frontend',
    'src',
    'shared',
    'version',
    'releaseManifest.json',
  )
  await writeFile(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`)
}

function currentShanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function sanitizeResponseText(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9_=-]{24,}/g, '[redacted]')
    .slice(0, 500)
}
