import { requestBackendJson, type BackendTarget } from '../api/backendClient'

export type ProcessHistoryStatus = 'success' | 'error'

export interface ProcessSummaryItem {
  label: string
  value: string
  note?: string
}

export interface ProcessHistoryRecord {
  id: string
  moduleId: string
  moduleName: string
  status: ProcessHistoryStatus
  durationMs: number
  message: string
  inputFiles: string[]
  outputFile?: string
  summary: ProcessSummaryItem[]
  createdAt: string
}

const storagePrefix = 'tos.process-history.'
const processHistoryPath = '/api/process-history/records'

export interface ProcessHistoryListParams {
  moduleIds?: string[]
  status?: ProcessHistoryStatus
  page?: number
  pageSize?: number
  backendTarget?: BackendTarget
}

interface ProcessHistoryListResponse {
  records?: ProcessHistoryRecord[]
}

interface ProcessHistorySaveResponse {
  record?: ProcessHistoryRecord
}

export function loadModuleHistory(moduleId: string): ProcessHistoryRecord[] {
  const raw = window.localStorage.getItem(storagePrefix + moduleId)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendModuleHistory(
  record: Omit<ProcessHistoryRecord, 'id' | 'createdAt'>,
): ProcessHistoryRecord[] {
  const nextRecord: ProcessHistoryRecord = {
    ...record,
    id: `${record.moduleId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  const records = [nextRecord, ...loadModuleHistory(record.moduleId)].slice(0, 20)
  window.localStorage.setItem(storagePrefix + record.moduleId, JSON.stringify(records))
  void persistProcessHistoryRecord(nextRecord).catch(() => {
    // Local history is still useful when the backend or remote MySQL is temporarily unavailable.
  })

  return records
}

export function clearModuleHistory(moduleId: string): void {
  window.localStorage.removeItem(storagePrefix + moduleId)
}

export async function fetchPersistedProcessHistoryRecords(
  params: ProcessHistoryListParams = {},
): Promise<ProcessHistoryRecord[]> {
  const query = new URLSearchParams()
  const moduleIds = (params.moduleIds || [])
    .map((moduleId) => moduleId.trim())
    .filter(Boolean)
  if (moduleIds.length > 0) {
    query.set('moduleIds', moduleIds.join(','))
  }
  if (params.status) {
    query.set('status', params.status)
  }
  query.set('page', String(params.page || 1))
  query.set('limit', String(params.pageSize || 80))

  const payload = await requestBackendJson<ProcessHistoryListResponse>({
    path: `${processHistoryPath}?${query.toString()}`,
    backendTarget: params.backendTarget,
  })
  return Array.isArray(payload.records) ? payload.records : []
}

export async function persistProcessHistoryRecord(
  record: ProcessHistoryRecord,
): Promise<ProcessHistoryRecord | null> {
  const payload = await requestBackendJson<ProcessHistorySaveResponse>({
    method: 'POST',
    path: processHistoryPath,
    body: record,
    timeoutMs: 8000,
  })
  return payload.record || null
}
