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

  return records
}

export function clearModuleHistory(moduleId: string): void {
  window.localStorage.removeItem(storagePrefix + moduleId)
}
