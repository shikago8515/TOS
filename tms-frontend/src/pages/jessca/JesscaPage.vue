<template>
  <ExcelProcessPageShell
    title="Invoice 核对"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <ExcelResultNotice
      :visible="Boolean(noticeMessage)"
      :tone="messageTone"
      :message="noticeMessage"
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
          <ResultSummary
            v-if="summaryItems.length > 0"
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
import { processJesscaFiles } from './jesscaApi'
import { buildJesscaSummary, jesscaModuleId, jesscaModuleName } from './jesscaModel'

type CurrentResultDownloadMetadata = ReturnType<typeof readProcessHistoryMetadata>

const invoiceFiles = ref<File[]>([])
const referenceFiles = ref<File[]>([])
const tcInvoiceFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyWarnings = ref<string[]>([])
const downloadError = ref('')
const currentResultDownload = ref<CurrentResultDownloadMetadata>({})
const historyRecords = ref<ProcessHistoryRecord[]>(loadModuleHistory(jesscaModuleId))
const messageTone = ref<ExcelNoticeTone>('info')
const { text } = useAppLanguage()

const {
  historyResultToolbarTitle,
  openHistoryResultPage,
} = useProcessHistoryResultPageLink({
  moduleId: jesscaModuleId,
  processing,
})

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'invoice',
    label: '发票文件（可多选）',
    files: invoiceFiles.value,
    multiple: true,
  },
  {
    id: 'reference',
    label: '参考表文件',
    files: referenceFiles.value,
    expectedCount: 1,
  },
  {
    id: 'tc-invoice',
    label: 'TC INV PDF（可多选）',
    files: tcInvoiceFiles.value,
    multiple: true,
    required: false,
    accept: '.pdf',
    acceptLabel: '支持 .pdf',
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const readyGroupCount = computed(
  () => fileGroups.value.filter((group) => group.required && group.files.length > 0).length,
)
const totalSelectedCount = computed(
  () => invoiceFiles.value.length + referenceFiles.value.length + tcInvoiceFiles.value.length,
)

const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalSelectedCount.value,
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

const toolbarStatus = computed(
  () => `${text('已就绪')} ${readyGroupCount.value}/2 ${text('组文件')}，${text('当前共')} ${totalSelectedCount.value} ${text('个文件')}`,
)

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
    label: processing.value ? '核对中...' : '开始核对',
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])

const noticeMessage = computed(() => downloadError.value || message.value)

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'invoice') {
    invoiceFiles.value = files
    return
  }

  if (fieldId === 'reference') {
    referenceFiles.value = files
    return
  }

  if (fieldId === 'tc-invoice') {
    tcInvoiceFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !referenceFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先补齐必传文件，再开始核对。'
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
    const response = await processJesscaFiles(
      {
        invoiceFiles: invoiceFiles.value,
        referenceFile: referenceFiles.value[0],
        tcInvoiceFiles: tcInvoiceFiles.value,
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.error ? `${response.message} - ${response.error}` : response.message
    summaryItems.value = buildJesscaSummary(response, invoiceFiles.value.length, tcInvoiceFiles.value.length)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles, response)
  } catch (error) {
    success.value = false
    messageTone.value = 'error'
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
      legacyDownloadPath: (filename) => `/api/jessca/download/${encodeURIComponent(filename)}`,
      fallbackFilename: 'jessca_result.xlsx',
    })
  } catch (error) {
    downloadError.value = readErrorMessage(error, '下载结果失败，请稍后重试')
    messageTone.value = 'error'
  }
}

function resetForm(): void {
  invoiceFiles.value = []
  referenceFiles.value = []
  tcInvoiceFiles.value = []
  processing.value = false
  progress.value = 0
  message.value = ''
  downloadError.value = ''
  success.value = false
  resultFile.value = ''
  currentResultDownload.value = {}
  summaryItems.value = []
  historyWarnings.value = []
  messageTone.value = 'info'
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
    moduleId: jesscaModuleId,
    moduleName: jesscaModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(jesscaModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
