import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { syncVersion } from './sync-version.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..', '..')
const defaultGiteaApiBaseUrl = 'http://172.16.48.208:3001/api/v1'
const defaultRepository = 'luenthai-ai/TOS'
const frontendReleaseHistoryPath = 'tms-frontend/src/shared/version/releaseHistory.json'
const backendReleaseUpdatesSeedPath = 'tms-backend/data/release_updates_seed.json'

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
    showPopupOverride: pluginConfig.showPopupOverride,
  })
  const releaseAnnouncement = buildTosReleaseAnnouncement({
    version,
    tag: context.nextRelease?.gitTag || `v${version}`,
    releaseDate,
    releaseNotes,
  })
  const releaseManifest = buildTosReleaseManifest({
    version,
    tag: context.nextRelease?.gitTag || `v${version}`,
    gitSha: context.nextRelease?.gitHead || process.env.GITEA_SHA || process.env.GITHUB_SHA || '',
    releaseDate,
    channel: pluginConfig.channel || context.branch?.channel || context.branch?.prerelease || '',
    releaseNotes,
    announcement: releaseAnnouncement,
  })
  await writeReleaseNotes(repoRoot, releaseNotes)
  await writeReleaseManifest(repoRoot, releaseManifest)
  await writeReleaseUpdateFallbackRecords(repoRoot, buildReleaseUpdateRecord({
    version,
    releaseNotes,
    releaseManifest,
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
  showPopupOverride = process.env.TOS_RELEASE_SHOW_POPUP,
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
  let hasFeatureCommit = false
  let hasBreakingChange = false

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit)
    if (!parsed) {
      continue
    }

    if (parsed.type === 'feat') {
      hasFeatureCommit = true
    }
    if (parsed.breaking) {
      hasBreakingChange = true
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

  notes.showPopup = resolveShowPopup({
    override: showPopupOverride,
    hasFeatureCommit,
    hasBreakingChange,
  })

  return notes
}

export function buildTosReleaseAnnouncement({
  version,
  tag,
  releaseDate = currentShanghaiDate(),
  releaseNotes,
}) {
  return {
    noticeId: tag || releaseNotes?.noticeId || `v${version}`,
    version,
    releaseDate: releaseNotes?.date || releaseDate,
    showPopup: Boolean(releaseNotes?.showPopup),
    level: releaseNotes?.showPopup ? 'feature' : 'maintenance',
    title: '本次更新内容',
    groups: buildAnnouncementGroups(releaseNotes),
  }
}

export function buildTosReleaseManifest({
  version,
  tag,
  gitSha = '',
  releaseDate = currentShanghaiDate(),
  channel = '',
  releaseNotes,
  announcement,
}) {
  return {
    schemaVersion: 1,
    version,
    tag: tag || `v${version}`,
    gitSha,
    releaseDate,
    channel,
    releaseNotes,
    announcement: announcement ?? buildTosReleaseAnnouncement({
      version,
      tag: tag || `v${version}`,
      releaseDate,
      releaseNotes,
    }),
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
  const match = firstLine.match(/^([a-z]+)(?:\([^)]+\))?(!)?:\s*(.+)$/i)
  if (!match) {
    return null
  }

  const description = match[3].trim()
  if (!description) {
    return null
  }

  const message = String(commit.message || commit.subject || '')
  return {
    type: match[1].toLowerCase(),
    description,
    breaking: Boolean(match[2]) || /(?:^|\n)BREAKING CHANGE:/i.test(message),
  }
}

function resolveShowPopup({ override, hasFeatureCommit, hasBreakingChange }) {
  const normalizedOverride = String(override ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalizedOverride)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalizedOverride)) {
    return false
  }

  return Boolean(hasFeatureCommit || hasBreakingChange)
}

function buildAnnouncementGroups(releaseNotes) {
  const moduleGroups = buildModuleAnnouncementGroups(releaseNotes)
  if (moduleGroups.length > 0) {
    return moduleGroups
  }

  return [
    buildFlatAnnouncementGroup('新增', 'sparkles', releaseNotes?.added),
    buildFlatAnnouncementGroup('优化', 'activity', releaseNotes?.improved),
    buildFlatAnnouncementGroup('修复', 'check-circle', releaseNotes?.fixed),
  ].filter(Boolean)
}

function buildModuleAnnouncementGroups(releaseNotes) {
  if (!Array.isArray(releaseNotes?.modules)) {
    return []
  }

  return releaseNotes.modules
    .map((moduleRecord) => {
      const items = [
        ...prefixAnnouncementItems('新增', moduleRecord?.added),
        ...prefixAnnouncementItems('优化', moduleRecord?.improved),
        ...prefixAnnouncementItems('修复', moduleRecord?.fixed),
      ]
      if (!moduleRecord?.name || items.length === 0) {
        return null
      }
      return {
        title: String(moduleRecord.name),
        icon: 'layers',
        items,
      }
    })
    .filter(Boolean)
}

function buildFlatAnnouncementGroup(title, icon, items) {
  const normalizedItems = normalizeAnnouncementItems(items)
  if (normalizedItems.length === 0) {
    return null
  }
  return { title, icon, items: normalizedItems }
}

function prefixAnnouncementItems(prefix, items) {
  return normalizeAnnouncementItems(items).map((item) => `${prefix}: ${item}`)
}

function normalizeAnnouncementItems(items) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
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

function buildReleaseUpdateRecord({ version, releaseNotes, releaseManifest }) {
  const tag = String(releaseManifest?.tag || `v${version}`).trim()
  const gitSha = String(releaseManifest?.gitSha || '').trim()
  const channel = String(releaseManifest?.channel || '').trim()
  const releaseDate = String(releaseManifest?.releaseDate || releaseNotes?.date || currentShanghaiDate()).trim()
  const noteSummary = summarizeReleaseNotes(releaseNotes || {})
  const detailParts = [
    `Release ${tag}`,
    channel ? `Channel: ${channel}` : '',
    gitSha ? `Commit: ${gitSha}` : '',
    noteSummary ? `Release notes: ${noteSummary}` : `Version: ${version}`,
  ].filter(Boolean)

  return {
    recordKey: `release-${tag || version}`,
    version,
    releaseDate,
    category: 'improved',
    pageName: 'Version Release',
    pagePath: '/release-updates',
    title: `Release ${tag || version}`.slice(0, 255),
    description: `${detailParts.join('. ')}.`,
  }
}

async function writeReleaseUpdateFallbackRecords(repoRoot, releaseRecord) {
  const releaseHistoryPath = resolve(repoRoot, frontendReleaseHistoryPath)
  const backendSeedPath = resolve(repoRoot, backendReleaseUpdatesSeedPath)
  const releaseHistory = await readReleaseUpdateRecords(releaseHistoryPath)
  const mergedRecords = mergeReleaseUpdateRecords([releaseRecord, ...releaseHistory])

  await writeFile(releaseHistoryPath, `${JSON.stringify(mergedRecords, null, 2)}\n`)
  await writeFile(backendSeedPath, `${JSON.stringify(mergedRecords, null, 2)}\n`)
}

async function readReleaseUpdateRecords(filePath) {
  const payload = JSON.parse(await readFile(filePath, 'utf8'))
  if (!Array.isArray(payload)) {
    throw new Error(`${filePath} must contain a JSON array.`)
  }
  return payload
}

function mergeReleaseUpdateRecords(records) {
  const seenKeys = new Set()
  const merged = []

  records.forEach((rawRecord, order) => {
    const record = normalizeReleaseUpdateRecord(rawRecord)
    if (!record.recordKey || seenKeys.has(record.recordKey)) {
      return
    }
    seenKeys.add(record.recordKey)
    merged.push({ record, order })
  })

  merged.sort(compareReleaseUpdateRecords)
  return merged.map(({ record }) => record)
}

function normalizeReleaseUpdateRecord(rawRecord) {
  return {
    recordKey: String(rawRecord?.recordKey || rawRecord?.record_key || '').trim(),
    version: String(rawRecord?.version || '').trim(),
    releaseDate: String(rawRecord?.releaseDate || rawRecord?.release_date || '').trim(),
    category: String(rawRecord?.category || 'improved').trim() || 'improved',
    pageName: String(rawRecord?.pageName || rawRecord?.page_name || 'Version Release').trim(),
    pagePath: String(rawRecord?.pagePath || rawRecord?.page_path || '').trim(),
    title: String(rawRecord?.title || '').trim(),
    description: String(rawRecord?.description || '').trim(),
  }
}

function compareReleaseUpdateRecords(left, right) {
  return (
    compareVersionSortKey(versionSortKey(right.record.version), versionSortKey(left.record.version))
    || right.record.releaseDate.localeCompare(left.record.releaseDate)
    || left.order - right.order
  )
}

function versionSortKey(version) {
  return [...String(version || '').toLowerCase().replace(/^v/, '').matchAll(/\d+/g)]
    .map((match) => Number.parseInt(match[0], 10))
}

function compareVersionSortKey(left, right) {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }
  return left.length - right.length
}

function summarizeReleaseNotes(releaseNotes) {
  const moduleNotes = Array.isArray(releaseNotes.modules)
    ? releaseNotes.modules
      .flatMap((moduleRecord) => summarizeReleaseNoteModule(moduleRecord))
      .filter(Boolean)
    : []

  if (moduleNotes.length > 0) {
    return moduleNotes.slice(0, 3).join('；')
  }

  return ['added', 'improved', 'fixed']
    .flatMap((key) => {
      const items = releaseNotes[key]
      return Array.isArray(items) ? items : []
    })
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('；')
}

function summarizeReleaseNoteModule(moduleRecord) {
  const name = String(moduleRecord?.name || '').trim()
  if (!name) {
    return []
  }

  return [
    ...summarizeReleaseNoteItems(moduleRecord.added, name, '新增'),
    ...summarizeReleaseNoteItems(moduleRecord.improved, name, '优化'),
    ...summarizeReleaseNoteItems(moduleRecord.fixed, name, '修复'),
  ]
}

function summarizeReleaseNoteItems(items, moduleName, category) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => `${moduleName} ${category}: ${item}`)
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
