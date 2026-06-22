import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { syncVersion } from './sync-version.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultGitCodeApiBaseUrl = 'https://api.gitcode.com/api/v5'
const defaultRepository = 'shikago8515/TOS'

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
  context.logger?.log?.(`Synced TOS version and release notes for ${version}.`)
}

export async function publish(pluginConfig = {}, context = {}) {
  const token = pluginConfig.gitCodeToken || process.env.GITCODE_TOKEN
  const repository = pluginConfig.repository || process.env.GITCODE_REPOSITORY || defaultRepository
  const fetchImpl = pluginConfig.fetchImpl || globalThis.fetch

  if (!token) {
    context.logger?.warn?.('GITCODE_TOKEN is not configured; skipping GitCode Release creation.')
    return
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable; use Node.js 18+ or pass fetchImpl.')
  }

  const request = buildGitCodeReleaseRequest({
    apiBaseUrl: pluginConfig.gitCodeApiBaseUrl || process.env.GITCODE_API_BASE_URL || defaultGitCodeApiBaseUrl,
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
    throw new Error(`GitCode Release creation failed: HTTP ${response.status} ${sanitizeResponseText(text)}`)
  }

  context.logger?.log?.(`Created GitCode Release ${request.body.tag_name}.`)
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

export function buildGitCodeReleaseRequest({
  apiBaseUrl = defaultGitCodeApiBaseUrl,
  repository = defaultRepository,
  token,
  nextRelease,
}) {
  if (!token) {
    throw new Error('Missing GitCode token.')
  }
  if (!nextRelease?.gitTag) {
    throw new Error('semantic-release did not provide nextRelease.gitTag.')
  }

  const normalizedBaseUrl = String(apiBaseUrl).replace(/\/$/, '')
  const normalizedRepository = String(repository).replace(/^\/|\/$/g, '')
  return {
    url: `${normalizedBaseUrl}/repos/${normalizedRepository}/releases`,
    headers: {
      Authorization: `Bearer ${token}`,
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
