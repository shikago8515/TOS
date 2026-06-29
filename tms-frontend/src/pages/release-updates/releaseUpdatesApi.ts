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

function normalizeReleaseUpdatesPayload(
  payload: Partial<ReleaseUpdatesResponse>,
  source: ReleaseUpdatesSource,
): ReleaseUpdatesResponse {
  const records = Array.isArray(payload.records) ? payload.records : []
  return {
    ok: Boolean(payload.ok),
    source,
    version: String(payload.version || ''),
    records,
    total: normalizeTotal(payload.total, records.length),
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
        total: normalizeTotal(payload.total, payload.records.length),
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
    total: normalizeTotal(payload.total, payload.records.length),
  }
}

function normalizeTotal(value: unknown, fallback: number): number {
  const total = Number(value)
  if (Number.isFinite(total) && total >= fallback) {
    return total
  }
  return fallback
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
