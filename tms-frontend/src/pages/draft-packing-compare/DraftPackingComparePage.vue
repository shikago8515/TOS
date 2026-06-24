<template>
  <ExcelProcessPageShell
    :title="draftPackingCompareModuleName"
    subtitle="产地证 × Packing List → 字段提取与上下对比 Excel"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <ExcelResultNotice
      :visible="Boolean(message)"
      :tone="resultNoticeTone"
      :message="message"
    />

    <div class="jane-grid">
      <div class="jane-main">
        <ExcelUploadSection
          :fields="uploadFields"
          :processing="processing"
          :progress="progress"
          progress-label="核对进度"
          badge="2 份 PDF 必传"
          @update:files="updateUploadFiles"
        >
          <ResultSummary :items="summaryItems" :status="success ? 'success' : 'error'" />
        </ExcelUploadSection>
      </div>

      <div class="jane-side">
        <FilePrecheckPanel :groups="fileGroups" />
        <ProcessHistoryPanel :records="historyRecords" @clear="clearHistory" />
      </div>
    </div>
  </ExcelProcessPageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import {
  areRequiredFilesReady,
  serializeInputFiles,
} from '../../shared/files/fileGroups'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import {
  appendModuleHistory,
  clearModuleHistory,
  loadModuleHistory,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import {
  buildExcelFileGroups,
  ExcelProcessPageShell,
  ExcelResultNotice,
  ExcelUploadSection,
  type ExcelFileField,
  type ExcelNoticeTone,
  type ExcelPageStat,
  type ExcelToolbarAction,
} from '../../shared/ui/excel-process'
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
import ProcessHistoryPanel from '../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../shared/ui/ResultSummary.vue'
import {
  downloadDraftPackingCompareResult,
  processDraftPackingCompareFiles,
} from './draftPackingCompareApi'
import {
  buildDraftPackingCompareSummary,
  draftPackingCompareModuleId,
  draftPackingCompareModuleName,
} from './draftPackingCompareModel'

const draftFiles = ref<File[]>([])
const packingFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(draftPackingCompareModuleId),
)
const { text } = useAppLanguage()

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'draft',
    label: '产地证PDF',
    files: draftFiles.value,
    hint: '包含 PO、Article、Style、Cust、Quantity、Cartons、HS Code',
    accept: '.pdf',
    acceptLabel: '支持 .pdf',
    expectedCount: 1,
  },
  {
    id: 'packing',
    label: 'Packing List PDF',
    files: packingFiles.value,
    hint: '包含装箱摘要、Market PO、HTS、Goods Description',
    accept: '.pdf',
    acceptLabel: '支持 .pdf',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const totalFiles = computed(() => draftFiles.value.length + packingFiles.value.length)
const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'history-records',
    label: '处理记录',
    value: historyRecords.value.length,
    icon: 'clock',
    tone: 'slate',
  },
])
const toolbarStatus = computed(() => {
  const readyCount = fileGroups.value.filter((group) => group.files.length > 0).length
  return `${text('已就绪')} ${readyCount}/2 ${text('组文件')}，${text('当前共')} ${totalFiles.value} ${text('个文件')}`
})
const toolbarActions = computed<ExcelToolbarAction[]>(() => [
  {
    id: 'reset',
    label: '重置',
    icon: 'refresh-cw',
    disabled: processing.value,
    onClick: resetForm,
  },
  {
    id: 'download',
    label: '下载结果',
    icon: 'download',
    visible: success.value && Boolean(resultFile.value),
    onClick: downloadResult,
  },
  {
    id: 'process',
    label: processing.value ? '处理中...' : '开始核对',
    icon: processing.value ? 'loader' : 'target',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])
const resultNoticeTone = computed<ExcelNoticeTone>(() => (success.value ? 'success' : 'error'))

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'draft') {
    draftFiles.value = files
    return
  }

  if (fieldId === 'packing') {
    packingFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !draftFiles.value[0] || !packingFiles.value[0]) {
    message.value = '请先按预检查提示补齐 PDF 文件'
    success.value = false
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)

  processing.value = true
  progress.value = 0
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []

  try {
    const response = await processDraftPackingCompareFiles(
      {
        draftFile: draftFiles.value[0],
        packingFile: packingFiles.value[0],
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.output_file ?? ''
    message.value = response.message
    summaryItems.value = buildDraftPackingCompareSummary(response, {
      draft: draftFiles.value.length,
      packing: packingFiles.value.length,
    })
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, '处理失败，请重试')
    summaryItems.value = [
      {
        label: '处理状态',
        value: '失败',
        note: '可将原始 PDF 和错误提示发给开发排查',
      },
    ]
    recordHistory('error', startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

async function downloadResult(): Promise<void> {
  if (resultFile.value) {
    await downloadDraftPackingCompareResult(resultFile.value)
  }
}

function resetForm(): void {
  draftFiles.value = []
  packingFiles.value = []
  processing.value = false
  progress.value = 0
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []
}

function recordHistory(
  status: ProcessHistoryStatus,
  startedAt: number,
  inputFiles: string[],
): void {
  historyRecords.value = appendModuleHistory({
    moduleId: draftPackingCompareModuleId,
    moduleName: draftPackingCompareModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(draftPackingCompareModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
