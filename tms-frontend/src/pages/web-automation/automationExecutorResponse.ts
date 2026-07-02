export type JsonRecord = Record<string, unknown>

export interface ExecutorArtifactDownloadUrls extends JsonRecord {
  resultExcelUrl?: unknown
  resultJsonUrl?: unknown
  failedPoExcelUrl?: unknown
  failedPoJsonUrl?: unknown
  failedRowsExcelUrl?: unknown
  failedRowsJsonUrl?: unknown
}

export interface ExecutorArtifacts extends JsonRecord {
  downloadUrls?: ExecutorArtifactDownloadUrls
  failedRowCount?: unknown
  resultExcelPath?: unknown
  runId?: unknown
}

export interface ExecutorProgress extends JsonRecord {
  phase?: unknown
  message?: unknown
  percent?: unknown
  activeInvoiceCount?: unknown
  activeCount?: unknown
  totalCount?: unknown
  plannedCount?: unknown
  completedCount?: unknown
  successCount?: unknown
  downloadedCount?: unknown
  failedCount?: unknown
  attemptedCount?: unknown
  pendingCount?: unknown
  skippedCount?: unknown
  filteredTotalCount?: unknown
  taskCenterTotalCount?: unknown
  discoveredTaskCount?: unknown
  concurrencyCount?: unknown
  currentInvoiceNumbers?: unknown
  currentTickets?: unknown
}

export interface LocalExecutorRun extends JsonRecord {
  action?: unknown
  inputMode?: unknown
  moduleId?: unknown
  inputFileName?: unknown
  startedAt?: unknown
  finishedAt?: unknown
  generatedAt?: unknown
  generatedRowCount?: unknown
  failedTicketCount?: unknown
  resultExcelPath?: unknown
  progress?: unknown
  artifacts?: ExecutorArtifacts
  ticketOwnerStatistics?: JsonRecord
}

export interface ExecutorResponsePayload extends LocalExecutorRun {
  ok?: unknown
  message?: unknown
  detail?: unknown
  error?: unknown
  downloadedInvoiceCount?: unknown
  downloadedPoCount?: unknown
  totalInvoiceCount?: unknown
  totalPoCount?: unknown
  failedInvoiceCount?: unknown
  failedPoCount?: unknown
  skippedInvoiceCount?: unknown
  failedInvoiceDetails?: unknown
  invoiceResults?: unknown
  poResults?: unknown
  ticketOwnerStatistics?: JsonRecord
}

export interface ExecutorRunContainer {
  ok?: unknown
  activeRun?: unknown
  activeRuns?: unknown
  lastRun?: unknown
  progress?: unknown
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function safeParseExecutorJson(rawText: string): ExecutorResponsePayload | null {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return null

  try {
    const payload = JSON.parse(trimmed) as unknown
    return toExecutorResponsePayload(payload)
  } catch {
    return null
  }
}

export function toExecutorResponsePayload(value: unknown): ExecutorResponsePayload | null {
  return isJsonRecord(value) ? value as ExecutorResponsePayload : null
}

export function toLocalExecutorRun(value: unknown): LocalExecutorRun | null {
  return isJsonRecord(value) ? value as LocalExecutorRun : null
}

export function collectExecutorActiveRuns(payload: ExecutorRunContainer | null | undefined): LocalExecutorRun[] {
  const runs: LocalExecutorRun[] = []
  const activeRun = toLocalExecutorRun(payload?.activeRun)
  if (activeRun) runs.push(activeRun)

  if (Array.isArray(payload?.activeRuns)) {
    for (const item of payload.activeRuns) {
      const run = toLocalExecutorRun(item)
      if (run) runs.push(run)
    }
  }

  return runs
}

export function extractExecutorRunProgress(
  payload: ExecutorRunContainer | LocalExecutorRun | ExecutorResponsePayload | null | undefined,
): ExecutorProgress | null {
  const activeRunProgress = readRunProgress(toLocalExecutorRun(payload?.activeRun))
  if (activeRunProgress) return activeRunProgress

  if (Array.isArray(payload?.activeRuns)) {
    for (const item of payload.activeRuns) {
      const progress = readRunProgress(toLocalExecutorRun(item))
      if (progress) return progress
    }
  }

  const lastRunProgress = readRunProgress(toLocalExecutorRun(payload?.lastRun))
  if (lastRunProgress) return lastRunProgress

  return toExecutorProgress(payload?.progress)
}

export function getExecutorArtifactDownloadUrls(
  payload: ExecutorResponsePayload | LocalExecutorRun | null | undefined,
): ExecutorArtifactDownloadUrls | null {
  const artifacts = isJsonRecord(payload?.artifacts) ? payload.artifacts : null
  const downloadUrls = isJsonRecord(artifacts?.downloadUrls) ? artifacts.downloadUrls : null
  return downloadUrls ? downloadUrls as ExecutorArtifactDownloadUrls : null
}

export function getExecutorArtifacts(
  payload: ExecutorResponsePayload | LocalExecutorRun | null | undefined,
): ExecutorArtifacts | null {
  return isJsonRecord(payload?.artifacts) ? payload.artifacts as ExecutorArtifacts : null
}

export function readExecutorResponseText(payload: ExecutorResponsePayload | null | undefined): string {
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (message) return message

  const detail = typeof payload?.detail === 'string' ? payload.detail.trim() : ''
  if (detail) return detail

  const error = typeof payload?.error === 'string' ? payload.error.trim() : ''
  return error
}

function readRunProgress(run: LocalExecutorRun | null): ExecutorProgress | null {
  return toExecutorProgress(run?.progress)
}

function toExecutorProgress(value: unknown): ExecutorProgress | null {
  return isJsonRecord(value) ? value as ExecutorProgress : null
}
