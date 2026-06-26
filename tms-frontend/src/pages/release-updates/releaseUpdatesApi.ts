import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import bundledReleaseHistory from '../../shared/version/releaseHistory.json'

export type ReleaseUpdateCategory = 'added' | 'improved' | 'fixed' | string
export type ReleaseUpdatesSource = 'backend' | 'cache' | 'bundled'

export interface ReleaseUpdateRecord {
  id: number
  recordKey: string
  version: string
  releaseDate: string
  category: ReleaseUpdateCategory
  pageName: string
  pagePath: string
  title: string
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ReleaseUpdatesResponse {
  ok: boolean
  source: ReleaseUpdatesSource
  version: string
  records: ReleaseUpdateRecord[]
  total: number
}

const defaultReleaseUpdatesBackendUrl = 'https://ai.tomwell.net:56130/tos/desktop-api'
const releaseUpdatesCacheKey = 'tos.releaseUpdates.cache.v1'
const releaseUpdatesRequestTimeoutMs = 6000

interface BundledReleaseHistoryRecord {
  recordKey: string
  version: string
  releaseDate: string
  category: ReleaseUpdateCategory
  pageName: string
  pagePath: string
  title: string
  description: string
}

export async function fetchReleaseUpdates(limit = 120): Promise<ReleaseUpdatesResponse> {
  const safeLimit = Math.max(1, Math.min(limit, 300))
  const path = `/api/release-updates?limit=${safeLimit}`

  const remotePayload = await requestRemoteReleaseUpdates(path)
  if (remotePayload) {
    const normalized = normalizeReleaseUpdatesPayload(remotePayload, 'backend')
    writeReleaseUpdatesCache(normalized)
    return normalized
  }

  try {
    const payload = await requestBackendJson<ReleaseUpdatesResponse>({
      path,
      timeoutMs: releaseUpdatesRequestTimeoutMs,
    })
    const normalized = normalizeReleaseUpdatesPayload(payload, 'backend')
    writeReleaseUpdatesCache(normalized)
    return normalized
  } catch (error) {
    if (isRecoverableReleaseUpdatesError(error)) {
      return readCachedReleaseUpdates(safeLimit)
    }

    throw error
  }
}

export function readCachedReleaseUpdates(limit = 120): ReleaseUpdatesResponse {
  const safeLimit = Math.max(1, Math.min(limit, 300))
  const cachedPayload = readReleaseUpdatesCache()
  if (cachedPayload) {
    return sliceReleaseUpdatesPayload(cachedPayload, safeLimit, 'cache')
  }

  return buildBundledReleaseUpdates(safeLimit)
}

export function readBundledReleaseUpdates(limit = 120): ReleaseUpdatesResponse {
  const safeLimit = Math.max(1, Math.min(limit, 300))
  return buildBundledReleaseUpdates(safeLimit)
}

async function requestRemoteReleaseUpdates(
  path: string,
): Promise<Partial<ReleaseUpdatesResponse> | undefined> {
  for (const baseUrl of readReleaseUpdatesBackendUrls()) {
    try {
      return await requestReleaseUpdatesFromUrl(baseUrl, path)
    } catch (_error) {
      // Try the next configured release-update backend before falling back.
    }
  }

  return undefined
}

function readReleaseUpdatesBackendUrls(): string[] {
  const urls: string[] = []
  const configuredUrl = import.meta.env.VITE_RELEASE_UPDATES_BACKEND_URL

  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    urls.push(configuredUrl.trim())
  }

  if (
    typeof window !== 'undefined'
    && window.location?.pathname?.startsWith('/tos')
  ) {
    urls.push('/tos/desktop-api')
  }

  urls.push(defaultReleaseUpdatesBackendUrl)

  return Array.from(new Set(urls.map((url) => url.replace(/\/$/, ''))))
}

async function requestReleaseUpdatesFromUrl(
  baseUrl: string,
  path: string,
): Promise<Partial<ReleaseUpdatesResponse>> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), releaseUpdatesRequestTimeoutMs)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      signal: controller.signal,
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) as Partial<ReleaseUpdatesResponse> : {}

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return data
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function normalizeReleaseUpdatesPayload(
  payload: Partial<ReleaseUpdatesResponse>,
  source: ReleaseUpdatesSource,
): ReleaseUpdatesResponse {
  return {
    ok: Boolean(payload.ok),
    source,
    version: String(payload.version || ''),
    records: Array.isArray(payload.records) ? payload.records : [],
    total: Number(payload.total || 0),
  }
}

function buildBundledReleaseUpdates(limit: number): ReleaseUpdatesResponse {
  const records = (bundledReleaseHistory as BundledReleaseHistoryRecord[])
    .slice(0, limit)
    .map((record) => buildBundledRecord(record))

  return {
    ok: true,
    source: 'bundled',
    version: fallbackAppVersion,
    records,
    total: records.length,
  }
}

function buildBundledRecord(record: BundledReleaseHistoryRecord): ReleaseUpdateRecord {
  return {
    id: 0,
    recordKey: String(record.recordKey || ''),
    version: String(record.version || ''),
    releaseDate: String(record.releaseDate || ''),
    category: record.category || 'improved',
    pageName: String(record.pageName || '本地版本说明'),
    pagePath: String(record.pagePath || ''),
    title: String(record.title || ''),
    description: String(record.description || ''),
    createdBy: 'bundled',
    createdAt: '',
    updatedAt: '',
  }
}

function readReleaseUpdatesCache(): ReleaseUpdatesResponse | undefined {
  const storage = getLocalStorage()
  if (!storage) {
    return undefined
  }

  try {
    const rawValue = storage.getItem(releaseUpdatesCacheKey)
    if (!rawValue) {
      return undefined
    }

    const payload = JSON.parse(rawValue) as Partial<ReleaseUpdatesResponse>
    if (!Array.isArray(payload.records) || payload.records.length === 0) {
      return undefined
    }

    return normalizeReleaseUpdatesPayload(payload, 'cache')
  } catch (_error) {
    storage.removeItem(releaseUpdatesCacheKey)
    return undefined
  }
}

function writeReleaseUpdatesCache(payload: ReleaseUpdatesResponse): void {
  const storage = getLocalStorage()
  if (!storage || payload.records.length === 0) {
    return
  }

  try {
    storage.setItem(
      releaseUpdatesCacheKey,
      JSON.stringify({
        ok: true,
        source: 'backend',
        version: payload.version,
        records: payload.records,
        total: payload.records.length,
      }),
    )
  } catch (_error) {
    // Local cache is an optimization only.
  }
}

function sliceReleaseUpdatesPayload(
  payload: ReleaseUpdatesResponse,
  limit: number,
  source: ReleaseUpdatesSource,
): ReleaseUpdatesResponse {
  const records = payload.records.slice(0, limit)
  return {
    ok: true,
    source,
    version: payload.version || fallbackAppVersion,
    records,
    total: records.length,
  }
}

function getLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch (_error) {
    return undefined
  }
}

function isRecoverableReleaseUpdatesError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes('无法连接后端服务')
    || error.message === 'Failed to fetch'
    || error.message.includes('缺少此接口')
  )
}
