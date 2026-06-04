<template>
  <ExcelProcessPageShell
    title="BOM汇总"
    subtitle="多 BOM 文件 + Pack 映射 → MAIN COMPONENT 汇总"
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
import {
  appendModuleHistory,
  clearModuleHistory,
  loadModuleHistory,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
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
  downloadJaneBomSummaryResult,
  processJaneBomSummaryFiles,
} from './janeBomSummaryApi'
import {
  buildJaneBomSummary,
  janeBomSummaryModuleId,
  janeBomSummaryModuleName,
} from './janeBomSummaryModel'

const bomFiles = ref<File[]>([])
const packFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(janeBomSummaryModuleId),
)
const { text } = useAppLanguage()

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'bom',
    label: 'BOM 文件（可多选）',
    files: bomFiles.value,
    hint: '支持 .xlsx / .xlsm',
    multiple: true,
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
  },
  {
    id: 'pack',
    label: 'Pack.xlsx',
    files: packFiles.value,
    hint: '包含 Pack、Season、Working Number',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const totalFiles = computed(() => bomFiles.value.length + packFiles.value.length)
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
    label: processing.value ? '处理中...' : '开始处理',
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])
const resultNoticeTone = computed<ExcelNoticeTone>(() => (success.value ? 'success' : 'error'))

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'bom') {
    bomFiles.value = files
    return
  }

  if (fieldId === 'pack') {
    packFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !packFiles.value[0]) {
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
    const response = await processJaneBomSummaryFiles(
      {
        bomFiles: bomFiles.value,
        packFile: packFiles.value[0],
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
    summaryItems.value = buildJaneBomSummary(response, {
      bom: bomFiles.value.length,
      pack: packFiles.value.length,
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
    await downloadJaneBomSummaryResult(resultFile.value)
  }
}

function resetForm(): void {
  bomFiles.value = []
  packFiles.value = []
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
    moduleId: janeBomSummaryModuleId,
    moduleName: janeBomSummaryModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(janeBomSummaryModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
