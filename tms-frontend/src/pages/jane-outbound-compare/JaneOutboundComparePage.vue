<template>
  <ExcelProcessPageShell
    title="OUTBOUND核对"
    subtitle="T1 OUTBOUND × TMS 报表 → 出库差异核对"
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
          badge="2 组必传"
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
  downloadJaneOutboundCompareResult,
  processJaneOutboundCompareFiles,
} from './janeOutboundCompareApi'
import {
  buildJaneOutboundCompareSummary,
  janeOutboundCompareModuleId,
  janeOutboundCompareModuleName,
} from './janeOutboundCompareModel'

const outboundFiles = ref<File[]>([])
const tmsFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(janeOutboundCompareModuleId),
)
const { text } = useAppLanguage()

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'outbound',
    label: 'T1 OUTBOUND 文件',
    files: outboundFiles.value,
    hint: '输出会保留原表样式并标红差异',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
  {
    id: 'tms',
    label: 'Copy of TMS',
    files: tmsFiles.value,
    hint: '包含 Result Set 的 TMS 报表',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const totalFiles = computed(() => outboundFiles.value.length + tmsFiles.value.length)
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
  const readyCount = fileGroups.value.filter((g) => g.files.length > 0).length
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
  if (fieldId === 'outbound') {
    outboundFiles.value = files
    return
  }

  if (fieldId === 'tms') {
    tmsFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !outboundFiles.value[0] || !tmsFiles.value[0]) {
    message.value = '请先按预检查提示补齐文件'
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
    const response = await processJaneOutboundCompareFiles(
      {
        outboundFile: outboundFiles.value[0],
        tmsFile: tmsFiles.value[0],
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    message.value = response.error
      ? `${response.message} - ${response.error}`
      : response.message
    summaryItems.value = buildJaneOutboundCompareSummary(response, {
      outbound: outboundFiles.value.length,
      tms: tmsFiles.value.length,
    })
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, '处理失败，请重试')
    summaryItems.value = [
      {
        label: '处理状态',
        value: '失败',
        note: '可导出诊断包发给开发排查',
      },
    ]
    recordHistory('error', startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

async function downloadResult(): Promise<void> {
  if (resultFile.value) {
    await downloadJaneOutboundCompareResult(resultFile.value)
  }
}

function resetForm(): void {
  outboundFiles.value = []
  tmsFiles.value = []
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
    moduleId: janeOutboundCompareModuleId,
    moduleName: janeOutboundCompareModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(janeOutboundCompareModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
