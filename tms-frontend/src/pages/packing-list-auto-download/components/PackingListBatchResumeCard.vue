<template>
  <section class="plr-card">
    <div class="plr-card__head">
      <span class="plr-card__icon"><AppIcon name="clock" /></span>
      <div>
        <strong>{{ text('断点续跑') }}</strong>
        <small>{{ text('最近批次') }}</small>
      </div>
      <button class="plr-icon-btn" type="button" :disabled="refreshing" :aria-label="text('刷新批次')" @click="emit('refresh')">
        <AppIcon name="refresh-cw" :class="{ 'plr-spin': refreshing }" />
      </button>
    </div>

    <div v-if="batch" class="plr-card__body">
      <button class="plr-batch" type="button" @click="openFilesModal">
        <span class="plr-batch__top">
          <strong>{{ batch.sourceFileName || batch.batchName }}</strong>
          <em :class="`plr-badge plr-badge--${effectiveBatchStatus}`">{{ batchStatusText }}</em>
        </span>
        <span class="plr-batch__summary">{{ batchSummary }}</span>
        <span class="plr-meter" aria-hidden="true">
          <i :style="{ width: `${progress}%` }" />
        </span>
        <span class="plr-batch__meta">
          <span>{{ progress }}%</span>
          <span>{{ downloadFiles.length }} {{ text('个文件') }}</span>
        </span>
      </button>

      <div class="plr-stat-grid">
        <span>
          <b>{{ counts.completed }}</b>
          {{ text('已下载') }}
        </span>
        <span>
          <b>{{ counts.failed }}</b>
          {{ text('失败') }}
        </span>
        <span>
          <b>{{ counts.pending }}</b>
          {{ text('待继续') }}
        </span>
      </div>

      <div class="plr-actions">
        <button class="plr-action plr-action--ghost" type="button" :disabled="!downloadFiles.length || downloading" @click="openFilesModal">
          <AppIcon name="files" />
          <span>{{ text('查看文件') }}</span>
          <b v-if="downloadFiles.length">{{ downloadFiles.length }}</b>
        </button>
        <button class="plr-action plr-action--ghost" type="button" :disabled="historyLoading" @click="openHistoryModal">
          <AppIcon name="layers" />
          <span>{{ text('历史批次') }}</span>
          <b v-if="batches.length">{{ batches.length }}</b>
        </button>
        <button class="plr-action plr-action--primary" type="button" :disabled="!canResume || sending" :title="resumeDisabledHint" @click="emit('continue', batch)">
          <AppIcon name="play-circle" />
          <span>{{ text('继续未完成') }}</span>
        </button>
        <button class="plr-action plr-action--ghost" type="button" :disabled="!canRetryFailed || sending" :title="retryDisabledHint" @click="emit('retryFailed', batch)">
          <AppIcon name="refresh-cw" />
          <span>{{ text('只重试失败') }}</span>
        </button>
      </div>
    </div>

    <div v-else class="plr-empty">
      <strong>{{ text('暂无可续跑批次') }}</strong>
      <p>{{ text('执行后会在这里显示最近批次、进度和文件入口。') }}</p>
      <button class="plr-action plr-action--ghost plr-empty__history" type="button" :disabled="historyLoading" @click="openHistoryModal">
        <AppIcon name="layers" />
        <span>{{ text('查看历史批次') }}</span>
      </button>
    </div>
  </section>

  <Teleport to="body">
    <transition name="plr-modal-fade">
      <div v-if="filesModalOpen" class="plr-modal-overlay" @click.self="closeFilesModal">
      <transition name="plr-modal-pop" appear>
        <section class="plr-batch-modal" role="dialog" aria-modal="true" :aria-label="text('批次文件')">
          <header class="plr-batch-modal__head">
            <div class="plr-batch-modal__title">
              <span><AppIcon name="files" /></span>
              <div>
                <h3>{{ text('批次文件') }}</h3>
                <p>{{ modalSubtitle }}</p>
              </div>
            </div>
            <button class="plr-batch-modal__close" type="button" :aria-label="text('关闭')" @click="closeFilesModal">
              <AppIcon name="stop-circle" />
            </button>
          </header>

          <div v-if="batch" class="plr-batch-modal__batch">
            <div>
              <strong>{{ batch.sourceFileName || batch.batchName }}</strong>
              <span>{{ batchStatusText }} · {{ batchSummary }}</span>
            </div>
            <div class="plr-batch-modal__stats">
              <span><b>{{ counts.completed }}</b>{{ text('已下载') }}</span>
              <span><b>{{ counts.failed }}</b>{{ text('失败') }}</span>
              <span><b>{{ counts.pending }}</b>{{ text('待继续') }}</span>
            </div>
          </div>

          <div class="plr-batch-modal__toolbar">
            <button class="plr-toolbar-btn plr-toolbar-btn--primary" type="button" :disabled="!downloadFiles.length || downloading" @click="downloadAllFiles">
              <AppIcon :name="downloading ? 'loader' : 'download'" :class="{ 'plr-spin': downloading }" />
              {{ text('全量下载') }}
            </button>
            <button class="plr-toolbar-btn" type="button" :disabled="refreshing" @click="emit('refresh')">
              <AppIcon name="refresh-cw" :class="{ 'plr-spin': refreshing }" />
              {{ text('刷新') }}
            </button>
          </div>

          <div v-if="!downloadFiles.length" class="plr-batch-modal__empty">
            <AppIcon name="info" />
            <strong>{{ text('当前批次暂无可下载文件') }}</strong>
            <p>{{ text('每完成一个箱单，文件会自动归档到这里。') }}</p>
          </div>

          <div v-else class="plr-batch-modal__content">
            <div v-if="checkpointItems.length" class="plr-modal-section">
              <div class="plr-modal-section__head">
                <strong>{{ text('箱单状态') }}</strong>
                <small>{{ text('已下载、失败和待继续一眼可见') }}</small>
              </div>
              <div class="plr-checkpoints" :aria-label="text('箱单状态')">
                <span v-for="item in checkpointItems" :key="item.no" :class="`plr-checkpoint plr-checkpoint--${item.status || 'pending'}`">
                  <b>{{ item.no || '-' }}</b>
                  <small>{{ formatCheckpointStatus(item.status) }}</small>
                </span>
              </div>
            </div>

            <div class="plr-modal-section">
              <div class="plr-modal-section__head">
                <strong>{{ text('文件下载') }}</strong>
                <small>{{ text('可单独下载，也可全量下载') }}</small>
              </div>
              <div class="plr-file-list">
                <button v-for="file in downloadFiles" :key="file.key" class="plr-file" type="button" :disabled="downloading" @click="downloadFile(file)">
                  <span class="plr-file__icon"><AppIcon :name="file.source ? 'upload' : 'download'" /></span>
                  <span class="plr-file__main">
                    <strong>{{ file.originalFilename || file.label }}</strong>
                    <small>{{ file.label }}<template v-if="file.itemNo"> · {{ file.itemNo }}</template></small>
                  </span>
                  <span class="plr-file__action"><AppIcon name="download" /></span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </transition>
    </div>
  </transition>
</Teleport>

<Teleport to="body">
  <transition name="plr-modal-fade">
    <div v-if="historyModalOpen" class="plr-modal-overlay" @click.self="closeHistoryModal">
      <transition name="plr-modal-pop" appear>
        <section class="plr-batch-modal plr-history-modal" role="dialog" aria-modal="true" :aria-label="text('历史批次')">
          <header class="plr-batch-modal__head">
            <div class="plr-batch-modal__title">
              <span><AppIcon name="layers" /></span>
              <div>
                <h3>{{ text('历史批次') }}</h3>
                <p>{{ text('选择任意批次继续下载，不限最近一次。') }}</p>
              </div>
            </div>
            <button class="plr-batch-modal__close" type="button" :aria-label="text('关闭')" @click="closeHistoryModal">
              <AppIcon name="stop-circle" />
            </button>
          </header>

          <div class="plr-batch-modal__toolbar">
            <button class="plr-toolbar-btn" type="button" :disabled="historyLoading" @click="emit('refreshHistory')">
              <AppIcon name="refresh-cw" :class="{ 'plr-spin': historyLoading }" />
              {{ text('刷新') }}
            </button>
          </div>

          <div v-if="!batches.length && !historyLoading" class="plr-batch-modal__empty">
            <AppIcon name="info" />
            <strong>{{ text('暂无历史批次') }}</strong>
            <p>{{ text('执行一次自动下载后，这里会显示可继续和可查看的批次。') }}</p>
          </div>

          <div v-else class="plr-history-list">
            <div
              v-for="item in batches"
              :key="item.batchId"
              class="plr-history-item"
              :class="{ 'plr-history-item--active': item.batchId === batch?.batchId }"
            >
              <button class="plr-history-item__select" type="button" @click="chooseHistoryBatch(item)">
                <span class="plr-history-item__main">
                  <strong>{{ item.sourceFileName || item.batchName || item.batchId }}</strong>
                  <small>{{ formatBatchDate(item.updatedAt || item.createdAt) }} · {{ formatBatchStatus(item.status) }} · {{ formatBatchSummary(item) }}</small>
                </span>
                <span class="plr-history-item__action">{{ item.resumable ? text('选择续跑') : text('查看文件') }}</span>
              </button>
              <button
                v-if="allowDelete"
                class="plr-history-item__delete"
                type="button"
                :disabled="sending || deletingBatchId === item.batchId"
                @click.stop="emit('deleteBatch', item)"
              >
                <AppIcon :name="deletingBatchId === item.batchId ? 'loader' : 'trash-2'" :class="{ 'plr-spin': deletingBatchId === item.batchId }" />
                <span>{{ text('删除') }}</span>
              </button>
            </div>
          </div>
        </section>
      </transition>
    </div>
  </transition>
</Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import { showAppAlert } from '../../../shared/ui/appAlert'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import type { PackingListBatchRecord, PackingListCheckpointItem } from '../../web-automation/webAutomationApi'
import { downloadAutomationStoredFile } from '../../web-automation/webAutomationApi'

type PackingListStoredFile = NonNullable<PackingListCheckpointItem['storedFiles']>[number]
type BatchDownloadFile = PackingListStoredFile & {
  key: string
  label: string
  itemNo?: string
  source?: boolean
}

const props = defineProps<{
  batch: PackingListBatchRecord | null
  batches: PackingListBatchRecord[]
  sending: boolean
  refreshing: boolean
  historyLoading: boolean
  executorActive: boolean
  allowDelete?: boolean
  deletingBatchId?: string
}>()

const emit = defineEmits<{
  refresh: []
  refreshHistory: []
  selectBatch: [batch: PackingListBatchRecord]
  continue: [batch: PackingListBatchRecord]
  retryFailed: [batch: PackingListBatchRecord]
  deleteBatch: [batch: PackingListBatchRecord]
  notice: [notice: { tone: 'success' | 'error'; message: string }]
}>()

const { isEnglish, text } = useAppLanguage()
const filesModalOpen = ref(false)
const historyModalOpen = ref(false)
const downloading = ref(false)

const checkpointItems = computed(() => {
  const items = props.batch?.checkpoint?.items
  return Array.isArray(items) ? items.slice(0, 18) : []
})

const counts = computed(() => {
  const batch = props.batch
  if (!batch) return { total: 0, completed: 0, failed: 0, pending: 0 }
  const rawTotal = Number(batch.totalCount || batch.checkpoint?.totalCount || 0)
  const rawCompleted = Number(batch.completedCount || batch.checkpoint?.completedCount || 0)
  const rawFailed = Number(batch.failedCount || batch.checkpoint?.failedCount || 0)
  const total = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0
  const completed = Number.isFinite(rawCompleted) && rawCompleted > 0 ? rawCompleted : 0
  const failed = Number.isFinite(rawFailed) && rawFailed > 0 ? rawFailed : 0
  const pendingValue = Number(batch.pendingCount || batch.checkpoint?.pendingCount || 0)
  const pending = Number.isFinite(pendingValue) && pendingValue > 0
    ? pendingValue
    : Math.max(0, total - completed - failed)
  return { total, completed, failed, pending }
})

const progress = computed(() => {
  if (counts.value.total <= 0) return counts.value.completed > 0 ? 100 : 0
  return Math.min(100, Math.max(0, Math.round((counts.value.completed / counts.value.total) * 100)))
})

const batchSummary = computed(() => {
  const { total, completed, failed, pending } = counts.value
  if (isEnglish.value) return `Completed ${completed}/${total || '-'}, failed ${failed}, pending ${pending}`
  return `已完成 ${completed}/${total || '-'}，失败 ${failed}，待继续 ${pending}`
})

const modalSubtitle = computed(() => {
  if (!downloadFiles.value.length) return text('暂无可下载文件')
  if (isEnglish.value) return `${downloadFiles.value.length} files available`
  return `${downloadFiles.value.length} 个文件可下载`
})

const downloadFiles = computed(() => collectBatchDownloadFiles(props.batch))
const rawBatchStatus = computed(() => String(props.batch?.status || 'pending').toLowerCase())
const effectiveBatchStatus = computed(() => {
  if (rawBatchStatus.value !== 'running') return rawBatchStatus.value || 'pending'
  if (props.executorActive) return 'running'
  if (counts.value.total > 0 && counts.value.completed >= counts.value.total && counts.value.failed <= 0) return 'success'
  return counts.value.completed > 0 || counts.value.pending > 0 ? 'interrupted' : 'pending'
})
const batchStatusText = computed(() => formatBatchStatus(effectiveBatchStatus.value))
const isActuallyRunningBatch = computed(() => effectiveBatchStatus.value === 'running')
const canResume = computed(() => {
  return Boolean(
    props.batch?.resumable
      && !props.executorActive
      && (counts.value.total > 0 || checkpointItems.value.length > 0),
  )
})
const canRetryFailed = computed(() => canResume.value && counts.value.failed > 0)
const resumeDisabledHint = computed(() => {
  if (canResume.value) return ''
  if (isActuallyRunningBatch.value) return text('当前批次正在执行，停止后才可以继续未完成。')
  if (!props.batch?.resumable) return text('当前批次已完成，不需要续跑。')
  return text('当前批次没有可继续的箱单。')
})
const retryDisabledHint = computed(() => {
  if (canRetryFailed.value) return ''
  if (isActuallyRunningBatch.value) return text('当前批次正在执行，停止后才可以重试失败项。')
  if (counts.value.failed <= 0) return text('当前批次没有失败项。')
  return text('当前批次暂不可重试。')
})

function openFilesModal(): void {
  if (!props.batch) return
  filesModalOpen.value = true
}

function closeFilesModal(): void {
  if (downloading.value) return
  filesModalOpen.value = false
}

function closeAnyModal(): void {
  if (downloading.value) return
  filesModalOpen.value = false
  historyModalOpen.value = false
}

function openHistoryModal(): void {
  historyModalOpen.value = true
  emit('refreshHistory')
}

function closeHistoryModal(): void {
  historyModalOpen.value = false
}

function chooseHistoryBatch(batch: PackingListBatchRecord): void {
  emit('selectBatch', batch)
  historyModalOpen.value = false
}

async function downloadFile(file: BatchDownloadFile): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    await downloadAutomationStoredFile(file)
    emit('notice', { tone: 'success', message: text('文件下载已开始。') })
  } catch (error) {
    const message = readErrorMessage(error, text('文件下载失败。'))
    emit('notice', { tone: 'error', message })
    void showAppAlert(message, { tone: 'error' })
  } finally {
    downloading.value = false
  }
}

async function downloadAllFiles(): Promise<void> {
  if (downloading.value || !downloadFiles.value.length) return
  downloading.value = true
  let downloaded = 0
  try {
    for (const file of downloadFiles.value) {
      await downloadAutomationStoredFile(file)
      downloaded += 1
      await new Promise((resolve) => window.setTimeout(resolve, 160))
    }
    emit('notice', {
      tone: 'success',
      message: isEnglish.value ? `Started downloading ${downloaded} files.` : `已开始下载 ${downloaded} 个文件。`,
    })
  } catch (error) {
    const message = readErrorMessage(error, text('批次文件下载失败。'))
    emit('notice', { tone: 'error', message })
    void showAppAlert(message, { tone: 'error' })
  } finally {
    downloading.value = false
  }
}

function collectBatchDownloadFiles(batch: PackingListBatchRecord | null): BatchDownloadFile[] {
  if (!batch) return []
  const files: BatchDownloadFile[] = []
  const seen = new Set<string>()
  const pushFile = (file: PackingListStoredFile | null | undefined, input: { label: string; itemNo?: string; source?: boolean }) => {
    const downloadPath = String(file?.downloadPath || '').trim()
    if (!downloadPath || seen.has(downloadPath)) return
    seen.add(downloadPath)
    files.push({
      ...file,
      downloadPath,
      key: `${input.source ? 'source' : input.itemNo || 'file'}-${downloadPath}`,
      label: input.label,
      itemNo: input.itemNo,
      source: input.source,
    })
  }

  if (batch.sourceFile?.downloadPath) {
    pushFile({
      fileRole: 'source_excel',
      originalFilename: batch.sourceFile.originalFilename || batch.sourceFileName || batch.batchName,
      downloadPath: batch.sourceFile.downloadPath,
    }, { label: text('源 Excel'), source: true })
  }

  const items = Array.isArray(batch.checkpoint?.items) ? batch.checkpoint.items : []
  for (const item of items) {
    const itemNo = String(item.no || '').trim()
    const storedFiles = Array.isArray(item.storedFiles) ? item.storedFiles : []
    for (const file of storedFiles) {
      pushFile(file, { label: formatStoredFileRole(file.fileRole), itemNo })
    }
  }
  return files
}

function formatStoredFileRole(role: string | undefined): string {
  const normalized = String(role || '').toLowerCase()
  if (normalized.includes('source')) return text('源 Excel')
  if (normalized.includes('pdf') || normalized.includes('packing')) return text('箱单 PDF')
  if (normalized.includes('json')) return text('结果 JSON')
  if (normalized.includes('excel')) return text('结果 Excel')
  return text('归档文件')
}

function formatBatchStatus(status: string): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'success') return text('已完成')
  if (normalized === 'partial') return text('部分完成')
  if (normalized === 'failed') return text('失败')
  if (normalized === 'interrupted') return text('已中断')
  if (normalized === 'running') return text('执行中')
  if (counts.value.total <= 0) return text('待执行')
  return text('待继续')
}

function formatCheckpointStatus(status: string): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'success') return text('已下载')
  if (normalized === 'failed' || normalized === 'error') return text('失败')
  if (normalized === 'running') return text('执行中')
  if (normalized === 'interrupted') return text('已中断')
  return text('待继续')
}

function formatBatchSummary(batch: PackingListBatchRecord): string {
  const total = Number(batch.totalCount || batch.checkpoint?.totalCount || 0)
  const completed = Number(batch.completedCount || batch.checkpoint?.completedCount || 0)
  const failed = Number(batch.failedCount || batch.checkpoint?.failedCount || 0)
  const pending = Math.max(0, Number(batch.pendingCount || batch.checkpoint?.pendingCount || total - completed - failed || 0))
  if (isEnglish.value) return `Completed ${completed}/${total || '-'}, failed ${failed}, pending ${pending}`
  return `已完成 ${completed}/${total || '-'}，失败 ${failed}，待继续 ${pending}`
}

function formatBatchDate(value: string | undefined): string {
  if (!value) return text('时间未知')
  const normalized = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(isEnglish.value ? 'en-US' : 'zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}
</script>

<style scoped lang="scss">
.plr-card {
  overflow: hidden;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius, 16px);
  background: var(--soft-surface, #fff);
  box-shadow: var(--soft-shadow-sm, 0 6px 16px rgba(31, 51, 73, .07));
}

.plr-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--border-color, #dcdfe6);

  > div {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 13px;
    font-weight: 700;
  }

  small {
    color: var(--soft-text-secondary, #64748b);
    font-size: 10px;
  }
}

.plr-card__icon,
.plr-icon-btn {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.plr-card__icon {
  width: 30px;
  height: 30px;
  border-radius: 11px;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
}

.plr-icon-btn {
  width: 28px;
  height: 28px;
  margin-left: auto;
  border: 0;
  border-radius: 10px;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
  cursor: pointer;
  transition: background .18s ease;

  &:hover:not(:disabled) {
    background: var(--el-color-primary-light-7, #b7d4d2);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: .55;
  }
}

.plr-card__body {
  display: grid;
  gap: 10px;
  padding: 12px 14px 14px;
}

.plr-batch {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-sm, 12px);
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text, #1e293b);
  text-align: left;
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease;

  &:hover {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
  }
}

.plr-batch__top,
.plr-batch__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plr-batch__top {
  justify-content: space-between;

  strong {
    min-width: 0;
    color: var(--soft-text, #1e293b);
    font-size: 12px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
}

.plr-badge {
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--el-color-primary-light-8, #cfe2e1);
  color: var(--el-color-primary, #0f766e);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;

  &--success {
    background: var(--el-color-primary-light-9, #e7f1f0);
    color: var(--el-color-primary-dark-2, #0b5f59);
  }

  &--failed,
  &--partial,
  &--interrupted {
    background: #fef3c7;
    color: #b45309;
  }

  &--running {
    background: #dbeafe;
    color: #1d4ed8;
  }
}

.plr-batch__summary {
  color: var(--soft-text-secondary, #64748b);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
}

.plr-meter {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border-color, #dcdfe6);

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--el-color-primary, #0f766e);
    transition: width .35s ease;
  }
}

.plr-batch__meta {
  justify-content: space-between;
  color: var(--soft-text-muted, #94a3b8);
  font-size: 10px;
}

.plr-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;

  span {
    display: grid;
    justify-items: center;
    gap: 3px;
    min-width: 0;
    padding: 7px 4px;
    border: 1px solid var(--border-color, #dcdfe6);
    border-radius: var(--soft-radius-xs, 10px);
    background: var(--soft-surface, #fff);
    color: var(--soft-text-secondary, #64748b);
    font-size: 10px;
  }

  b {
    color: var(--soft-text, #1e293b);
    font-size: 18px;
    line-height: 1;
  }
}

.plr-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.plr-action,
.plr-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-xs, 10px);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease;

  :deep(.app-icon) {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: .45;
  }
}

.plr-action {
  min-height: 32px;
  padding: 6px 8px;

  span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  b {
    display: inline-grid;
    place-items: center;
    min-width: 17px;
    height: 17px;
    border-radius: 999px;
    background: var(--el-color-primary-light-8, #cfe2e1);
    color: var(--el-color-primary, #0f766e);
    font-size: 9px;
  }
}

.plr-action--primary,
.plr-toolbar-btn--primary {
  border-color: var(--el-color-primary, #0f766e);
  background: var(--el-color-primary, #0f766e);
  color: #fff;

  &:hover:not(:disabled) {
    background: var(--el-color-primary-dark-2, #0b5f59);
    border-color: var(--el-color-primary-dark-2, #0b5f59);
  }
}

.plr-action--ghost,
.plr-toolbar-btn {
  background: var(--soft-surface, #fff);
  color: var(--soft-text, #1e293b);

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
    color: var(--el-color-primary, #0f766e);
  }
}

.plr-empty {
  display: grid;
  gap: 4px;
  padding: 18px 14px;
  color: var(--soft-text-secondary, #64748b);

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 13px;
  }

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
  }
}

.plr-empty__history {
  width: 100%;
  margin-top: 8px;
}

/* ── Modal ── */
.plr-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1090;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, .36);
  backdrop-filter: blur(5px);
}

.plr-batch-modal {
  display: flex;
  flex-direction: column;
  gap: 13px;
  width: min(620px, calc(100vw - 40px));
  max-height: min(720px, calc(100vh - 48px));
  padding: 20px;
  border-radius: var(--soft-radius, 16px);
  background: var(--soft-surface, #fff);
  box-shadow: 0 24px 70px rgba(15, 23, 42, .24);

  &.plr-history-modal {
    width: min(680px, calc(100vw - 40px));
  }
}

.plr-batch-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.plr-batch-modal__title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  > span {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 13px;
    background: var(--soft-accent-light, #f0fdfa);
    color: var(--el-color-primary, #0f766e);
  }

  h3 {
    margin: 0;
    color: var(--soft-text, #1e293b);
    font-size: 17px;
  }

  p {
    margin: 3px 0 0;
    color: var(--soft-text-secondary, #64748b);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
}

.plr-batch-modal__close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 11px;
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  cursor: pointer;
  transition: background .18s ease;

  &:hover {
    color: var(--soft-text, #1e293b);
    background: var(--border-color, #dcdfe6);
  }
}

.plr-batch-modal__batch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-xs, 10px);
  background: var(--soft-bg, #f0f4f8);

  > div:first-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  span {
    color: var(--soft-text-secondary, #64748b);
    font-size: 11px;
  }
}

.plr-batch-modal__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(52px, 1fr));
  gap: 6px;
  flex: 0 0 auto;

  span {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--soft-surface, #fff);
    color: var(--soft-text-secondary, #64748b);
    font-size: 10px;
  }

  b {
    color: var(--soft-text, #1e293b);
    font-size: 16px;
    line-height: 1;
  }
}

.plr-batch-modal__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.plr-toolbar-btn {
  min-height: 34px;
  padding: 0 13px;
}

.plr-batch-modal__empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 34px 18px;
  border: 1px dashed var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-sm, 12px);
  background: var(--soft-bg, #f0f4f8);
  color: var(--soft-text-secondary, #64748b);
  text-align: center;

  .app-icon {
    color: var(--soft-text-muted, #94a3b8);
    font-size: 24px;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 13px;
  }

  p {
    margin: 0;
    font-size: 12px;
  }
}

.plr-batch-modal__content {
  display: flex;
  flex-direction: column;
  gap: 13px;
  max-height: 400px;
  overflow-y: auto;
}

.plr-modal-section {
  display: grid;
  gap: 8px;
}

.plr-modal-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 12px;
    font-weight: 700;
  }

  small {
    color: var(--soft-text-secondary, #64748b);
    font-size: 10px;
  }
}

.plr-checkpoints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border-radius: var(--soft-radius-xs, 10px);
  background: var(--soft-bg, #f0f4f8);
}

.plr-history-list {
  display: grid;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.plr-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-sm, 12px);
  background: var(--soft-surface, #fff);
  color: var(--soft-text, #1e293b);
  text-align: left;
  transition: border-color .18s ease, background .18s ease;

  &:hover,
  &--active {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
  }
}

.plr-history-item__select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.plr-history-item__main {
  display: grid;
  gap: 4px;
  min-width: 0;

  strong,
  small {
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 12px;
    font-weight: 700;
  }

  small {
    color: var(--soft-text-secondary, #64748b);
    font-size: 11px;
  }
}

.plr-history-item__action {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
  font-size: 10px;
  font-weight: 600;
}

.plr-history-item__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid #fecaca;
  border-radius: 999px;
  background: #fff;
  color: #dc2626;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;

  &:hover:not(:disabled) {
    border-color: #f87171;
    background: #fff1f2;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: .55;
  }
}

.plr-checkpoint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 7px;
  border-radius: 999px;
  color: var(--soft-text-secondary, #64748b);
  background: var(--soft-surface, #fff);
  font-size: 10px;
  overflow-wrap: anywhere;

  b,
  small {
    font: inherit;
  }

  &--success {
    color: var(--el-color-primary-dark-2, #0b5f59);
    background: var(--el-color-primary-light-9, #e7f1f0);
  }

  &--failed,
  &--error {
    color: #b91c1c;
    background: #fef2f2;
  }

  &--pending,
  &--running,
  &--interrupted {
    color: #b45309;
    background: #fffbeb;
  }
}

.plr-file-list {
  display: grid;
  gap: 8px;
}

.plr-file {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: var(--soft-radius-xs, 10px);
  background: var(--soft-surface, #fff);
  color: var(--soft-text, #1e293b);
  text-align: left;
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease;

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary, #0f766e);
    background: var(--soft-accent-light, #f0fdfa);
  }

  &:disabled {
    cursor: wait;
    opacity: .65;
  }
}

.plr-file__icon,
.plr-file__action {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 11px;
}

.plr-file__icon {
  width: 34px;
  height: 34px;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
}

.plr-file__main {
  display: grid;
  gap: 3px;
  min-width: 0;

  strong,
  small {
    overflow-wrap: anywhere;
  }

  strong {
    color: var(--soft-text, #1e293b);
    font-size: 12px;
  }

  small {
    color: var(--soft-text-secondary, #64748b);
    font-size: 11px;
  }
}

.plr-file__action {
  width: 28px;
  height: 28px;
  margin-left: auto;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--el-color-primary, #0f766e);
}

/* ── Transitions ── */
.plr-modal-fade-enter-active,
.plr-modal-fade-leave-active {
  transition: opacity .22s ease;
}

.plr-modal-fade-enter-from,
.plr-modal-fade-leave-to {
  opacity: 0;
}

.plr-modal-pop-enter-active,
.plr-modal-pop-leave-active {
  transition: opacity .22s ease, transform .22s cubic-bezier(.22, 1, .36, 1);
}

.plr-modal-pop-enter-from,
.plr-modal-pop-leave-to {
  opacity: 0;
  transform: scale(.97) translateY(-6px);
}

.plr-spin {
  animation: plr-spin .85s linear infinite;
}

@keyframes plr-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .plr-modal-overlay {
    padding: 14px;
  }

  .plr-batch-modal {
    padding: 14px;
  }

  .plr-batch-modal__toolbar {
    flex-direction: column;
  }
}
</style>
