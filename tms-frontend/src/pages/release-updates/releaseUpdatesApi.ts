import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import bundledReleaseHistory from '../../shared/version/releaseHistory.json'

export type ReleaseUpdateCategory = 'added' | 'improved' | 'fixed' | string
export type ReleaseUpdatesSource = 'backend' | 'server' | 'bundled'

const serverReleaseUpdatesUrl = 'https://ai.tomwell.net:56130/tos/desktop-api/api/release-updates'

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
  try {
    const payload = await requestBackendJson<ReleaseUpdatesResponse>({
      path: `/api/release-updates?limit=${safeLimit}`,
    })
    return normalizeReleaseUpdatesPayload(payload, 'backend')
  } catch (error) {
    try {
      const payload = await requestServerReleaseUpdates(safeLimit)
      return normalizeReleaseUpdatesPayload(payload, 'server')
    } catch (_serverError) {
      if (isRecoverableReleaseUpdatesError(error)) {
        return buildBundledReleaseUpdates(safeLimit)
      }

      throw error
    }
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

async function requestServerReleaseUpdates(limit: number): Promise<ReleaseUpdatesResponse> {
  const response = await fetch(`${serverReleaseUpdatesUrl}?limit=${limit}`, {
    cache: 'no-store',
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) as ReleaseUpdatesResponse : {} as ReleaseUpdatesResponse

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return payload
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

function isRecoverableReleaseUpdatesError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message === '无法连接后端服务'
    || error.message === 'Failed to fetch'
    || error.message.includes('缺少此接口')
  )
}
