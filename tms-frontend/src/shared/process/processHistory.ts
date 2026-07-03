import {
  buildBackendDownloadUrl,
  downloadUrlAsFile,
  requestBackendJson,
  type BackendTarget,
} from '../api/backendClient'

export type ProcessHistoryStatus = 'success' | 'error'

export interface ProcessSummaryItem {
  label: string
  value: string
  note?: string
}

export interface ProcessHistoryResultFile {
  id: number
  filename: string
  contentType?: string
  fileSize?: number
  sha256?: string
  downloadPath: string
}

export interface ProcessHistoryRecord {
  id: string
  personId?: string
  moduleId: string
  moduleName: string
  status: ProcessHistoryStatus
  durationMs: number
  message: string
  inputFiles: string[]
  outputFile?: string
  resultFile?: ProcessHistoryResultFile
  resultDownloadPath?: string
  resultDownloadBackendTarget?: BackendTarget
  historyWarnings?: string[]
  summary: ProcessSummaryItem[]
  createdAt: string
}

export type BackendProcessHistoryMetadata = object

export type AppendProcessHistoryRecord = Omit<ProcessHistoryRecord, 'createdAt' | 'id'> & {
  id?: string
}

const storagePrefix = 'tos.process-history.'
const processHistoryPath = '/api/process-history/records'

export interface ProcessHistoryListParams {
  moduleIds?: string[]
  status?: ProcessHistoryStatus
  personId?: string
  createdFrom?: string
  createdTo?: string
  downloadableOnly?: boolean
  page?: number
  pageSize?: number
  backendTarget?: BackendTarget
}

export interface ProcessHistoryPagination {
  page: number
  pageSize: number
  total: number
}

export interface ProcessHistoryPageResult {
  records: ProcessHistoryRecord[]
  pagination: ProcessHistoryPagination
}

export interface CurrentProcessResultDownloadOptions {
  outputFile?: string
  resultDownloadPath?: string
  resultDownloadBackendTarget?: BackendTarget
  resultFile?: ProcessHistoryResultFile
  legacyDownloadPath: (filename: string) => string
  fallbackFilename?: string
}

interface ProcessHistoryListResponse {
  records?: unknown[]
  pagination?: Partial<ProcessHistoryPagination>
}

interface ProcessHistorySaveResponse {
  record?: unknown
}

export function readProcessHistoryMetadata(
  payload: BackendProcessHistoryMetadata,
): Partial<Pick<ProcessHistoryRecord, 'id' | 'resultDownloadPath' | 'resultDownloadBackendTarget' | 'resultFile' | 'historyWarnings'>> {
  const metadata: Partial<Pick<ProcessHistoryRecord, 'id' | 'resultDownloadPath' | 'resultDownloadBackendTarget' | 'resultFile' | 'historyWarnings'>> = {}
  const source = isObjectRecord(payload) ? payload : {}
  const historyId = typeof source.history_id === 'string' ? source.history_id.trim() : ''
  const resultDownloadPath = typeof source.result_download_path === 'string'
    ? source.result_download_path.trim()
    : ''
  const resultDownloadBackendTarget = readBackendTarget(source.result_download_backend_target)
  const historyWarnings = Array.isArray(source.history_warnings)
    ? source.history_warnings
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : []
  const resultFile = source.result_file

  if (historyId) {
    metadata.id = historyId
  }
  if (resultDownloadPath) {
    metadata.resultDownloadPath = resultDownloadPath
  }
  if (resultDownloadBackendTarget) {
    metadata.resultDownloadBackendTarget = resultDownloadBackendTarget
  }
  if (historyWarnings.length > 0) {
    metadata.historyWarnings = historyWarnings
  }
  if (isObjectRecord(resultFile)) {
    const fileId = Number(resultFile.id || 0)
    const filename = String(resultFile.filename || '').trim()
    const downloadPath = String(resultFile.downloadPath || resultDownloadPath).trim()
    if (fileId > 0 && filename && downloadPath) {
      metadata.resultFile = {
        id: fileId,
        filename,
        contentType: readOptionalString(resultFile.contentType),
        fileSize: readOptionalNumber(resultFile.fileSize),
        sha256: readOptionalString(resultFile.sha256),
        downloadPath,
      }
    }
  }

  return metadata
}

function readBackendTarget(value: unknown): BackendTarget | undefined {
  if (value === 'default' || value === 'local' || value === 'remote') {
    return value
  }
  return undefined
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readOptionalNonEmptyString(value: unknown): string | undefined {
  const text = readString(value)
  return text || undefined
}

function readNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, value)
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => readString(item))
    .filter(Boolean)
}

function readStatus(value: unknown): ProcessHistoryStatus {
  return value === 'error' ? 'error' : 'success'
}

function readOutputFile(value: unknown): string | undefined {
  const directOutputFile = readOptionalNonEmptyString(value)
  if (directOutputFile) {
    return directOutputFile
  }
  if (!isObjectRecord(value)) {
    return undefined
  }
  return readOptionalNonEmptyString(value.filename)
}

function readSummaryItems(value: unknown): ProcessSummaryItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item): ProcessSummaryItem[] => {
    if (!isObjectRecord(item)) {
      return []
    }
    const label = readString(item.label)
    const summaryValue = readString(item.value)
    if (!label || !summaryValue) {
      return []
    }
    const note = readOptionalNonEmptyString(item.note)
    return [{
      label,
      value: summaryValue,
      ...(note ? { note } : {}),
    }]
  })
}

function readResultFile(
  value: unknown,
  fallbackDownloadPath = '',
): ProcessHistoryResultFile | undefined {
  if (!isObjectRecord(value)) {
    return undefined
  }

  const fileId = readNonNegativeNumber(value.id)
  const filename = readString(value.filename)
  const downloadPath = readString(value.downloadPath) || fallbackDownloadPath
  if (fileId <= 0 || !filename || !downloadPath) {
    return undefined
  }

  const resultFile: ProcessHistoryResultFile = {
    id: fileId,
    filename,
    downloadPath,
  }
  const contentType = readOptionalNonEmptyString(value.contentType)
  const fileSize = readOptionalNumber(value.fileSize)
  const sha256 = readOptionalNonEmptyString(value.sha256)
  if (contentType) {
    resultFile.contentType = contentType
  }
  if (typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize >= 0) {
    resultFile.fileSize = fileSize
  }
  if (sha256) {
    resultFile.sha256 = sha256
  }
  return resultFile
}

function normalizeProcessHistoryRecord(value: unknown): ProcessHistoryRecord | null {
  if (!isObjectRecord(value)) {
    return null
  }

  const id = readString(value.id)
  const moduleId = readString(value.moduleId)
  if (!id || !moduleId) {
    return null
  }

  const resultDownloadPath = readString(value.resultDownloadPath)
  const resultFile = readResultFile(value.resultFile, resultDownloadPath)
  const resultDownloadBackendTarget = readBackendTarget(value.resultDownloadBackendTarget)
  const personId = readOptionalNonEmptyString(value.personId)
  const outputFile = readOutputFile(value.outputFile)
  const historyWarnings = readStringList(value.historyWarnings)
  const normalizedRecord: ProcessHistoryRecord = {
    id,
    ...(personId ? { personId } : {}),
    moduleId,
    moduleName: readString(value.moduleName) || moduleId,
    status: readStatus(value.status),
    durationMs: readNonNegativeNumber(value.durationMs),
    message: readString(value.message),
    inputFiles: readStringList(value.inputFiles),
    ...(outputFile ? { outputFile } : {}),
    ...(resultFile ? { resultFile } : {}),
    ...(resultDownloadPath || resultFile?.downloadPath
      ? { resultDownloadPath: resultDownloadPath || resultFile?.downloadPath }
      : {}),
    ...(resultDownloadBackendTarget ? { resultDownloadBackendTarget } : {}),
    ...(historyWarnings.length > 0 ? { historyWarnings } : {}),
    summary: readSummaryItems(value.summary),
    createdAt: readString(value.createdAt),
  }

  return normalizedRecord
}

function normalizeProcessHistoryRecords(value: unknown): ProcessHistoryRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => normalizeProcessHistoryRecord(item))
    .filter((item): item is ProcessHistoryRecord => Boolean(item))
}

export function loadModuleHistory(moduleId: string): ProcessHistoryRecord[] {
  const raw = window.localStorage.getItem(storagePrefix + moduleId)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return normalizeProcessHistoryRecords(parsed)
  } catch {
    return []
  }
}

export function appendModuleHistory(
  record: AppendProcessHistoryRecord,
): ProcessHistoryRecord[] {
  const nextRecord: ProcessHistoryRecord = {
    ...record,
    id: record.id || `${record.moduleId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  const normalizedRecord = normalizeProcessHistoryRecord(nextRecord)

  if (!normalizedRecord) {
    return loadModuleHistory(record.moduleId)
  }

  const records = [normalizedRecord, ...loadModuleHistory(normalizedRecord.moduleId)].slice(0, 20)
  window.localStorage.setItem(storagePrefix + normalizedRecord.moduleId, JSON.stringify(records))
  void persistProcessHistoryRecord(normalizedRecord).catch(() => {
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
  return (await fetchPersistedProcessHistoryRecordPage(params)).records
}

export async function fetchPersistedProcessHistoryRecordPage(
  params: ProcessHistoryListParams = {},
): Promise<ProcessHistoryPageResult> {
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
  const personId = params.personId?.trim()
  if (personId) {
    query.set('personId', personId)
  }
  const createdFrom = params.createdFrom?.trim()
  if (createdFrom) {
    query.set('createdFrom', createdFrom)
  }
  const createdTo = params.createdTo?.trim()
  if (createdTo) {
    query.set('createdTo', createdTo)
  }
  if (params.downloadableOnly) {
    query.set('downloadableOnly', 'true')
  }
  query.set('page', String(params.page || 1))
  query.set('limit', String(params.pageSize || 80))

  const payload = await requestBackendJson<ProcessHistoryListResponse>({
    path: `${processHistoryPath}?${query.toString()}`,
    backendTarget: params.backendTarget,
  })
  const records = normalizeProcessHistoryRecords(payload.records)
  const pagination = payload.pagination || {}
  return {
    records,
    pagination: {
      page: Number(pagination.page || params.page || 1),
      pageSize: Number(pagination.pageSize || params.pageSize || 80),
      total: Number(pagination.total || records.length),
    },
  }
}

export async function persistProcessHistoryRecord(
  record: ProcessHistoryRecord,
): Promise<ProcessHistoryRecord | null> {
  const payload = await requestBackendJson<ProcessHistorySaveResponse>({
    method: 'POST',
    path: processHistoryPath,
    body: record,
    timeoutMs: 8000,
    backendTarget: 'remote',
  })
  return normalizeProcessHistoryRecord(payload.record)
}

export function findLatestDownloadableHistoryRecord(
  records: readonly ProcessHistoryRecord[],
): ProcessHistoryRecord | null {
  return records.find((record) => Boolean(record.resultDownloadPath)) ?? null
}

export async function downloadCurrentProcessResult(
  options: CurrentProcessResultDownloadOptions,
): Promise<void> {
  const archivedDownloadPath = options.resultFile?.downloadPath || options.resultDownloadPath

  if (archivedDownloadPath) {
    const downloadUrl = await buildBackendDownloadUrl(
      archivedDownloadPath,
      options.resultDownloadBackendTarget || 'remote',
    )
    await downloadUrlAsFile(
      downloadUrl,
      options.resultFile?.filename || options.outputFile || options.fallbackFilename || 'process-result.xlsx',
    )
    return
  }

  const outputFile = String(options.outputFile || '').trim()
  if (!outputFile) {
    throw new Error('当前结果文件未生成，无法下载。')
  }

  const downloadUrl = await buildBackendDownloadUrl(options.legacyDownloadPath(outputFile))
  await downloadUrlAsFile(downloadUrl, outputFile || options.fallbackFilename || 'process-result.xlsx')
}

export async function buildProcessHistoryResultDownloadUrl(
  record: ProcessHistoryRecord,
): Promise<string> {
  if (!record.resultDownloadPath) {
    throw new Error('历史结果文件未归档，无法下载。')
  }
  return buildBackendDownloadUrl(
    record.resultDownloadPath,
    record.resultDownloadBackendTarget || 'remote',
  )
}

export async function downloadProcessHistoryResult(record: ProcessHistoryRecord): Promise<void> {
  const downloadUrl = await buildProcessHistoryResultDownloadUrl(record)
  await downloadUrlAsFile(
    downloadUrl,
    record.resultFile?.filename || record.outputFile || 'process-result.xlsx',
  )
}
