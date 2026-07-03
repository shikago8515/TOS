<template>
  <ExcelProcessPageShell
    title="PRODUCTION核对"
    subtitle="T1 PRODUCTION × BOM汇总 → PRODUCTION差异核对"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <ExcelResultNotice
      :visible="Boolean(noticeMessage)"
      :tone="resultNoticeTone"
      :message="noticeMessage"
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
          <ResultSummary
            :items="summaryItems"
            :status="success ? 'success' : 'error'"
            :warnings="historyWarnings"
          />
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
  downloadCurrentProcessResult,
  clearModuleHistory,
  loadModuleHistory,
  readProcessHistoryMetadata,
  type BackendProcessHistoryMetadata,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import { useProcessHistoryResultPageLink } from '../../shared/process/useProcessHistoryResultPageLink'
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
  processJaneBomCompareFiles,
} from './janeBomCompareApi'
import {
  buildJaneBomCompareSummary,
  janeBomCompareModuleId,
  janeBomCompareModuleName,
} from './janeBomCompareModel'

type CurrentResultDownloadMetadata = ReturnType<typeof readProcessHistoryMetadata>

const productionFiles = ref<File[]>([])
const bomSummaryFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyWarnings = ref<string[]>([])
const downloadError = ref('')
const currentResultDownload = ref<CurrentResultDownloadMetadata>({})
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(janeBomCompareModuleId),
)
const { text } = useAppLanguage()

const {
  historyResultToolbarTitle,
  openHistoryResultPage,
} = useProcessHistoryResultPageLink({
  moduleId: janeBomCompareModuleId,
  processing,
})

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'production',
    label: 'T1 PRODUCTION 文件',
    files: productionFiles.value,
    hint: '检查 C-D-E-F、材料多缺、Supplier、颜色并计算料率',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
  {
    id: 'bom-summary',
    label: 'BOM汇总 文件',
    files: bomSummaryFiles.value,
    hint: 'BOM汇总 生成的材料清单',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const totalFiles = computed(() => productionFiles.value.length + bomSummaryFiles.value.length)
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
    id: 'download-history-result',
    label: '下载历史结果',
    icon: 'download-cloud',
    disabled: processing.value,
    title: historyResultToolbarTitle.value,
    onClick: openHistoryResultPage,
  },
  {
    id: 'process',
    label: processing.value ? '处理中...' : '开始核对',
    icon: processing.value ? 'loader' : 'shield-check',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])
const noticeMessage = computed(() => downloadError.value || message.value)
const resultNoticeTone = computed<ExcelNoticeTone>(() => {
  if (downloadError.value) return 'error'
  return success.value ? 'success' : 'error'
})

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'production') {
    productionFiles.value = files
    return
  }

  if (fieldId === 'bom-summary') {
    bomSummaryFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !productionFiles.value[0]) {
    message.value = '请先按预检查提示补齐文件'
    success.value = false
    downloadError.value = ''
    currentResultDownload.value = {}
    historyWarnings.value = []
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)

  processing.value = true
  progress.value = 0
  message.value = ''
  downloadError.value = ''
  success.value = false
  resultFile.value = ''
  currentResultDownload.value = {}
  summaryItems.value = []
  historyWarnings.value = []

  try {
    const response = await processJaneBomCompareFiles(
      {
        productionFile: productionFiles.value[0],
        bomSummaryFile: bomSummaryFiles.value[0],
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
    summaryItems.value = buildJaneBomCompareSummary(response, {
      production: productionFiles.value.length,
      bomSummary: bomSummaryFiles.value.length,
    })
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles, response)
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
  downloadError.value = ''

  try {
    await downloadCurrentProcessResult({
      outputFile: resultFile.value,
      resultDownloadPath: currentResultDownload.value.resultDownloadPath,
      resultDownloadBackendTarget: currentResultDownload.value.resultDownloadBackendTarget,
      resultFile: currentResultDownload.value.resultFile,
      legacyDownloadPath: (filename) => `/api/jane-bom-compare/download/${encodeURIComponent(filename)}`,
      fallbackFilename: 'production_compare.xlsx',
    })
  } catch (error) {
    downloadError.value = readErrorMessage(error, '下载结果失败，请稍后重试')
  }
}

function resetForm(): void {
  productionFiles.value = []
  bomSummaryFiles.value = []
  processing.value = false
  progress.value = 0
  message.value = ''
  downloadError.value = ''
  success.value = false
  resultFile.value = ''
  currentResultDownload.value = {}
  summaryItems.value = []
  historyWarnings.value = []
}

function recordHistory(
  status: ProcessHistoryStatus,
  startedAt: number,
  inputFiles: string[],
  metadata: BackendProcessHistoryMetadata = {},
): void {
  const historyMetadata = readProcessHistoryMetadata(metadata)
  currentResultDownload.value = historyMetadata
  historyWarnings.value = historyMetadata.historyWarnings ?? []
  historyRecords.value = appendModuleHistory({
    ...historyMetadata,
    moduleId: janeBomCompareModuleId,
    moduleName: janeBomCompareModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(janeBomCompareModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
