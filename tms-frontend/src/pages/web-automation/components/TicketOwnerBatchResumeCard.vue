<template>
  <PackingListBatchResumeCard
    :batch="latestBatch"
    :batches="batchHistory"
    :sending="sending"
    :refreshing="batchRefreshing"
    :history-loading="batchHistoryLoading"
    :executor-active="sending"
    :allow-delete="true"
    :deleting-batch-id="deletingBatchId"
    @refresh="refreshLatestBatch"
    @refresh-history="refreshBatchHistory"
    @select-batch="selectMappedBatch"
    @continue="emitMappedResume('continue', $event)"
    @retry-failed="emitMappedResume('retry-failed', $event)"
    @delete-batch="deleteMappedBatch"
    @notice="handleNotice"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PackingListBatchResumeCard from '../../packing-list-auto-download/components/PackingListBatchResumeCard.vue'
import { showAppAlert, showAppConfirm } from '../../../shared/ui/appAlert'
import type {
  AutomationStoredFileDownloadRef,
  PackingListBatchRecord,
  PackingListCheckpointItem,
  TicketOwnerBatchRecord,
  TicketOwnerSourceFileRef,
} from '../webAutomationApi'
import {
  deleteTicketOwnerStatisticsBatch,
  fetchLatestTicketOwnerStatisticsBatch,
  fetchTicketOwnerStatisticsBatches,
} from '../webAutomationApi'

type TicketOwnerResumeMode = 'continue' | 'retry-failed' | 'restart'

const props = defineProps<{
  sending: boolean
  refreshSignal?: unknown
}>()

const emit = defineEmits<{
  resume: [payload: { mode: TicketOwnerResumeMode; batch: TicketOwnerBatchRecord }]
}>()

const latestBatch = ref<PackingListBatchRecord | null>(null)
const batchHistory = ref<PackingListBatchRecord[]>([])
const rawBatchById = ref(new Map<string, TicketOwnerBatchRecord>())
const batchRefreshing = ref(false)
const batchHistoryLoading = ref(false)
const deletingBatchId = ref('')
let batchPollingTimer: number | null = null

onMounted(() => {
  void refreshAllBatches()
})

onBeforeUnmount(() => {
  stopBatchPolling()
})

watch(() => props.refreshSignal, () => {
  void refreshAllBatches()
})

watch(() => props.sending, (sending) => {
  if (sending) {
    startBatchPolling()
  } else {
    stopBatchPolling()
    void refreshAllBatches()
  }
}, { immediate: true })

async function refreshAllBatches(): Promise<void> {
  batchRefreshing.value = true
  batchHistoryLoading.value = true
  try {
    const [latest, history] = await Promise.all([
      fetchLatestTicketOwnerStatisticsBatch(),
      fetchTicketOwnerStatisticsBatches(20),
    ])
    rememberRawBatches([latest, ...history].filter(Boolean) as TicketOwnerBatchRecord[])
    batchHistory.value = history.map(mapTicketOwnerBatch)
    latestBatch.value = latest ? mapTicketOwnerBatch(latest) : (batchHistory.value[0] || null)
  } finally {
    batchRefreshing.value = false
    batchHistoryLoading.value = false
  }
}

async function refreshLatestBatch(silent = false): Promise<void> {
  if (!silent) batchRefreshing.value = true
  try {
    const latest = await fetchLatestTicketOwnerStatisticsBatch()
    if (latest) {
      rememberRawBatches([latest])
      latestBatch.value = mapTicketOwnerBatch(latest)
    }
  } finally {
    if (!silent) batchRefreshing.value = false
  }
}

async function refreshBatchHistory(): Promise<void> {
  batchHistoryLoading.value = true
  try {
    const history = await fetchTicketOwnerStatisticsBatches(20)
    rememberRawBatches(history)
    batchHistory.value = history.map(mapTicketOwnerBatch)
    if (!latestBatch.value) latestBatch.value = batchHistory.value[0] || null
  } finally {
    batchHistoryLoading.value = false
  }
}

function startBatchPolling(): void {
  if (batchPollingTimer !== null) return
  void refreshLatestBatch(true)
  batchPollingTimer = window.setInterval(() => {
    void refreshLatestBatch(true)
  }, 2000)
}

function stopBatchPolling(): void {
  if (batchPollingTimer === null) return
  window.clearInterval(batchPollingTimer)
  batchPollingTimer = null
}

function selectMappedBatch(batch: PackingListBatchRecord): void {
  const raw = rawBatchById.value.get(batch.batchId)
  latestBatch.value = raw ? mapTicketOwnerBatch(raw) : batch
}

function emitMappedResume(mode: Exclude<TicketOwnerResumeMode, 'restart'>, batch: PackingListBatchRecord): void {
  const raw = rawBatchById.value.get(batch.batchId)
  if (!raw) return
  emit('resume', { mode, batch: raw })
}

async function deleteMappedBatch(batch: PackingListBatchRecord): Promise<void> {
  const raw = rawBatchById.value.get(batch.batchId)
  if (!raw || deletingBatchId.value || props.sending) return
  const confirmed = await showAppConfirm(
    `确认删除历史批次“${batch.sourceFileName || batch.batchName || batch.batchId}”？删除后它不会再出现在断点续跑列表中。`,
    {
      title: '删除历史批次',
      confirmText: '删除',
      cancelText: '取消',
      tone: 'warning',
    },
  )
  if (!confirmed) return

  deletingBatchId.value = batch.batchId
  try {
    await deleteTicketOwnerStatisticsBatch(batch.batchId)
    rawBatchById.value.delete(batch.batchId)
    batchHistory.value = batchHistory.value.filter((item) => item.batchId !== batch.batchId)
    if (latestBatch.value?.batchId === batch.batchId) {
      latestBatch.value = batchHistory.value[0] || null
    }
    await refreshAllBatches()
    void showAppAlert('历史批次已删除。', { tone: 'success', autoCloseMs: 1800 })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : '历史批次删除失败。'
    void showAppAlert(message, { tone: 'error' })
  } finally {
    deletingBatchId.value = ''
  }
}

function handleNotice(notice: { tone: 'success' | 'error'; message: string }): void {
  if (!notice.message) return
  void showAppAlert(notice.message, { tone: notice.tone === 'error' ? 'warning' : 'success' })
}

function rememberRawBatches(batches: TicketOwnerBatchRecord[]): void {
  const next = new Map(rawBatchById.value)
  for (const batch of batches) {
    if (batch?.batchId) next.set(batch.batchId, batch)
  }
  rawBatchById.value = next
}

function mapTicketOwnerBatch(batch: TicketOwnerBatchRecord): PackingListBatchRecord {
  const sourceBundle = buildSourceBundle(batch)
  const checkpointItems = buildCheckpointItems(batch)
  return {
    batchId: batch.batchId,
    automationId: batch.automationId,
    moduleId: batch.moduleId,
    runId: batch.runId,
    batchName: batch.batchName || 'Ticket ownership',
    status: batch.status || batch.checkpoint?.status || 'pending',
    message: batch.message || batch.checkpoint?.message || '',
    sourceFileName: sourceBundle?.originalFilename || batch.sourceFileName || batch.batchName || 'Ticket ownership',
    sourceFileSha256: sourceBundle?.sha256 || batch.sourceFileSha256 || '',
    sourceFile: sourceBundle || undefined,
    totalCount: Number(batch.totalCount || batch.checkpoint?.totalCount || 0),
    completedCount: Number(batch.completedCount || batch.checkpoint?.completedCount || 0),
    failedCount: Number(batch.failedCount || batch.checkpoint?.failedCount || 0),
    pendingCount: Number(batch.pendingCount || batch.checkpoint?.pendingCount || 0),
    checkpoint: {
      status: batch.checkpoint?.status || batch.status,
      message: batch.checkpoint?.message || batch.message,
      runId: batch.checkpoint?.runId || batch.runId,
      attemptId: batch.checkpoint?.attemptId,
      totalCount: Number(batch.checkpoint?.totalCount || batch.totalCount || 0),
      completedCount: Number(batch.checkpoint?.completedCount || batch.completedCount || 0),
      failedCount: Number(batch.checkpoint?.failedCount || batch.failedCount || 0),
      pendingCount: Number(batch.checkpoint?.pendingCount || batch.pendingCount || 0),
      items: checkpointItems,
      result: batch.checkpoint?.result || null,
    },
    bucket: '',
    objectPrefix: '',
    resumable: Boolean(batch.resumable),
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  }
}

function buildSourceBundle(batch: TicketOwnerBatchRecord): PackingListBatchRecord['sourceFile'] | null {
  const source = batch.sourceFile
  if (!source) return null
  const firstFile = Array.isArray(source.files) ? source.files.find((file) => file?.downloadPath) : null
  const bundle = source.bundle || null
  const downloadPath = String(source.downloadPath || firstFile?.downloadPath || '').trim()
  if (!downloadPath) return null
  return {
    originalFilename: bundle?.originalFilename || firstFile?.originalFilename || batch.sourceFileName || batch.batchName,
    contentType: bundle?.contentType || firstFile?.contentType || '',
    fileSize: Number(bundle?.fileSize || firstFile?.fileSize || 0),
    sha256: bundle?.sha256 || firstFile?.sha256 || batch.sourceFileSha256 || '',
    downloadPath,
  }
}

function buildCheckpointItems(batch: TicketOwnerBatchRecord): PackingListCheckpointItem[] {
  const sourceFiles = normalizeSourceFiles(batch.sourceFile?.files)
  const resultFiles = mergeStoredFiles(
    normalizeStoredFiles(batch.checkpoint?.storedFiles),
    normalizeStoredFiles(batch.storedFiles),
  )
  const rawItems = Array.isArray(batch.checkpoint?.items) ? batch.checkpoint.items : []
  const items: PackingListCheckpointItem[] = rawItems.map((item, index) => ({
    no: readItemNo(item, index),
    status: String(item?.status || 'pending'),
    message: readItemMessage(item),
    poNumbers: readItemPoNumbers(item),
    successfulPoNumber: readItemPoNumbers(item)[0],
    storedFiles: normalizeStoredFiles(item?.storedFiles),
  }))

  if (sourceFiles.length) {
    items.unshift({
      no: '辅助表',
      status: 'success',
      storedFiles: sourceFiles,
    })
  }
  if (resultFiles.length) {
    items.push({
      no: '结果文件',
      status: batch.checkpoint?.status || batch.status || 'success',
      storedFiles: resultFiles,
    })
  }
  return items
}

function normalizeSourceFiles(files: TicketOwnerSourceFileRef[] | undefined): AutomationStoredFileDownloadRef[] {
  if (!Array.isArray(files)) return []
  return normalizeStoredFiles(files)
}

function normalizeStoredFiles(files: unknown): AutomationStoredFileDownloadRef[] {
  if (!Array.isArray(files)) return []
  return files
    .map((file) => {
      if (!file || typeof file !== 'object') return null
      const candidate = file as Record<string, unknown>
      const downloadPath = String(candidate.downloadPath || '').trim()
      if (!downloadPath) return null
      return {
        id: typeof candidate.id === 'number' ? candidate.id : null,
        fileRole: String(candidate.fileRole || ''),
        originalFilename: String(candidate.originalFilename || ''),
        downloadPath,
      }
    })
    .filter(Boolean) as AutomationStoredFileDownloadRef[]
}

function mergeStoredFiles(...groups: AutomationStoredFileDownloadRef[][]): AutomationStoredFileDownloadRef[] {
  const seen = new Set<string>()
  const merged: AutomationStoredFileDownloadRef[] = []
  for (const group of groups) {
    for (const file of group) {
      const key = file.downloadPath || `${file.fileRole}:${file.originalFilename}`
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(file)
    }
  }
  return merged
}

function readItemNo(item: Record<string, unknown>, index: number): string {
  const value = item.no || item.caseNumber || item.ticketId || item.taskTitle || item.poNumber || item.request
  return String(value || index + 1)
}

function readItemMessage(item: Record<string, unknown>): string {
  return String(item.message || item.error || item.reason || '')
}

function readItemPoNumbers(item: Record<string, unknown>): string[] {
  const raw = item.poNumber || item.poNumbers
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean)
  const value = String(raw || '').trim()
  return value ? [value] : []
}
</script>
