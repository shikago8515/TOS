import { requestBackendJson } from '../../shared/api/backendClient'

export type ReleaseUpdateCategory = 'added' | 'improved' | 'fixed' | string

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
  version: string
  records: ReleaseUpdateRecord[]
  total: number
}

export async function fetchReleaseUpdates(limit = 120): Promise<ReleaseUpdateRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 300))
  const payload = await requestBackendJson<ReleaseUpdatesResponse>({
    path: `/api/release-updates?limit=${safeLimit}`,
  })
  return Array.isArray(payload.records) ? payload.records : []
}
