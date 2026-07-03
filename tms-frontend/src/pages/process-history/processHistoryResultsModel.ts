import type { ProcessHistoryRecord } from '../../shared/process/processHistory'
import { getProcessHistoryModulesForPerson } from '../../shared/process/processHistoryPeople'

export const processHistoryLookbackDays = 30

export interface ProcessHistoryRange {
  createdFrom: string
  createdTo: string
}

export interface LocalProcessHistoryFilter {
  personId: string
  moduleId?: string
  moduleIds?: string[]
  createdFrom: string
  createdTo: string
}

export function buildDefaultHistoryRange(now = new Date()): ProcessHistoryRange {
  const createdTo = new Date(now)
  const createdFrom = new Date(now)
  createdFrom.setDate(createdFrom.getDate() - processHistoryLookbackDays)

  return {
    createdFrom: createdFrom.toISOString(),
    createdTo: createdTo.toISOString(),
  }
}

export function filterDownloadableProcessRecords(
  records: readonly ProcessHistoryRecord[],
): ProcessHistoryRecord[] {
  return records.filter((record) => Boolean(record.resultDownloadPath))
}

export function filterLocalDownloadableProcessRecords(
  records: readonly ProcessHistoryRecord[],
  filters: LocalProcessHistoryFilter,
): ProcessHistoryRecord[] {
  const personModuleIds = new Set(
    getProcessHistoryModulesForPerson(filters.personId).flatMap((module) => module.historyModuleIds),
  )
  const selectedModuleIds = new Set(filters.moduleIds ?? (filters.moduleId ? [filters.moduleId] : []))
  const createdFromMs = Date.parse(filters.createdFrom)
  const createdToMs = Date.parse(filters.createdTo)

  return records
    .filter((record) => {
      if (!personModuleIds.has(record.moduleId)) return false
      if (selectedModuleIds.size > 0 && !selectedModuleIds.has(record.moduleId)) return false
      if (!record.resultDownloadPath) return false
      const createdAtMs = Date.parse(record.createdAt)
      if (Number.isNaN(createdAtMs)) return false
      if (!Number.isNaN(createdFromMs) && createdAtMs < createdFromMs) return false
      if (!Number.isNaN(createdToMs) && createdAtMs > createdToMs) return false
      return true
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export function formatHistoryFileSize(value?: number): string {
  const size = Number(value || 0)
  if (size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function readHistoryFileName(record: ProcessHistoryRecord): string {
  return record.resultFile?.filename || readFileName(record.outputFile || '') || 'process-result.xlsx'
}

export function readHistoryMessage(record: ProcessHistoryRecord): string {
  if (record.summary.length > 0) {
    return record.summary
      .slice(0, 2)
      .map((item) => `${item.label}: ${item.value}`)
      .join(' / ')
  }
  return record.message || '-'
}

function readFileName(path: unknown): string {
  if (typeof path !== 'string') {
    return ''
  }
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).pop() || ''
}
