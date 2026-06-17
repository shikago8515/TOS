import { requestBackendJson } from '../../shared/api/backendClient'
import { fallbackAppVersion } from '../../shared/version/appVersion'
import bundledReleaseHistory from '../../shared/version/releaseHistory.json'

export type ReleaseUpdateCategory = 'added' | 'improved' | 'fixed' | string
export type ReleaseUpdatesSource = 'backend' | 'bundled'

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
    return normalizeReleaseUpdatesPayload(remotePayload, 'backend')
  }

  try {
    const payload = await requestBackendJson<ReleaseUpdatesResponse>({
      path,
    })
    return normalizeReleaseUpdatesPayload(payload, 'backend')
  } catch (error) {
    if (isRecoverableReleaseUpdatesError(error)) {
      return buildBundledReleaseUpdates(safeLimit)
    }

    throw error
  }
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
