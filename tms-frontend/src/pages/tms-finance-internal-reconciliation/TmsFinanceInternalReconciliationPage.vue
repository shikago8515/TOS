<template>
  <ExcelProcessPageShell
    title="TMS财务表格数据处理"
    :subtitle="activeProcess.subtitle"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <ExcelResultNotice
      :visible="Boolean(message)"
      :tone="messageTone"
      :message="message"
    />

    <div class="jane-grid">
      <div class="jane-main">
        <ExcelUploadSection
          :fields="uploadFields"
          :processing="processing"
          :progress="progress"
          :progress-label="activeProcess.progressLabel"
          :badge="activeProcess.badge"
          @update:files="updateUploadFiles"
        >
          <ResultSummary
            v-if="summaryItems.length > 0"
            :items="summaryItems"
            :status="success ? 'success' : 'error'"
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

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
  type ExcelNoticeTone,
  type ExcelPageStat,
  type ExcelToolbarAction,
} from '../../shared/ui/excel-process'
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
import ProcessHistoryPanel from '../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../shared/ui/ResultSummary.vue'
import {
  downloadTmsFinanceInternalReconciliationResult,
  processTmsFinanceInternalReconciliationFiles,
} from './tmsFinanceInternalReconciliationApi'
import {
  buildTmsFinanceInternalReconciliationSummary,
  tmsFinanceInternalReconciliationModuleId,
} from './tmsFinanceInternalReconciliationModel'
import {
  downloadTmsFinanceWorkSalesResult,
  processTmsFinanceWorkSalesFiles,
} from './tmsFinanceWorkSalesApi'
import { buildTmsFinanceWorkSalesSummary } from './tmsFinanceWorkSalesModel'
import {
  getTmsFinanceProcessById,
  getTmsFinanceProcessByRoute,
  getTmsFinanceResultMetricValue,
  buildTmsFinanceProcessErrorSummary,
  type TmsFinanceProcessId,
  type TmsFinanceProcessOption,
} from './tmsFinancePageModel'
import { buildTmsFinanceUploadFields } from './tmsFinanceUploadFields'

const route = useRoute()
const activeProcessId = ref<TmsFinanceProcessId>(resolveProcessIdFromRoute(route.name))
const internalSourceFiles = ref<File[]>([])
const reconciliationTargetFiles = ref<File[]>([])
const workSalesBulkSalesFiles = ref<File[]>([])
const workSalesTurnoverFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const messageTone = ref<ExcelNoticeTone>('info')
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(tmsFinanceInternalReconciliationModuleId),
)
const { text } = useAppLanguage()

const activeProcess = computed<TmsFinanceProcessOption>(
  () => getTmsFinanceProcessById(activeProcessId.value),
)

const uploadFields = computed(() =>
  buildTmsFinanceUploadFields(activeProcessId.value, {
    internalSourceFiles: internalSourceFiles.value,
    reconciliationTargetFiles: reconciliationTargetFiles.value,
    workSalesBulkSalesFiles: workSalesBulkSalesFiles.value,
    workSalesTurnoverFiles: workSalesTurnoverFiles.value,
  }),
)

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const readyGroupCount = computed(
  () => fileGroups.value.filter((group) => group.files.length > 0).length,
)
const totalFiles = computed(() =>
  activeProcessId.value === 'work-sales'
    ? workSalesBulkSalesFiles.value.length + workSalesTurnoverFiles.value.length
    : internalSourceFiles.value.length + reconciliationTargetFiles.value.length,
)
const resultMetricValue = computed(() =>
  getTmsFinanceResultMetricValue(summaryItems.value, activeProcess.value),
)

const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'result-count',
    label: activeProcess.value.resultMetricLabel,
    value: resultMetricValue.value,
    icon: 'plus',
    tone: 'green',
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
  () =>
    `${text('已就绪')} ${readyGroupCount.value}/${activeProcess.value.requiredGroups} ${text('组文件')}，${text('当前共')} ${totalFiles.value} ${text('个文件')}`,
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
    id: 'process',
    label: processing.value
      ? activeProcess.value.processingActionLabel
      : activeProcess.value.idleActionLabel,
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])

watch(activeProcessId, () => {
  resetFeedback()
  historyRecords.value = loadModuleHistory(activeProcess.value.moduleId)
})

watch(
  () => route.name,
  (routeName) => {
    const nextProcessId = resolveProcessIdFromRoute(routeName)
    if (nextProcessId !== activeProcessId.value) {
      activeProcessId.value = nextProcessId
    }
  },
)

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'internal-sources') {
    internalSourceFiles.value = files
    return
  }

  if (fieldId === 'target') {
    reconciliationTargetFiles.value = files
    return
  }

  if (fieldId === 'work-sales-bulk-sales') {
    workSalesBulkSalesFiles.value = files
    return
  }

  if (fieldId === 'work-sales-turnover') {
    workSalesTurnoverFiles.value = files
  }
}

function resolveProcessIdFromRoute(routeName: unknown): TmsFinanceProcessId {
  return getTmsFinanceProcessByRoute(routeName).id
}

async function startProcess(): Promise<void> {
  if (!canProcess.value) {
    messageTone.value = 'warning'
    message.value = '请先按预检查提示补齐文件。'
    success.value = false
    return
  }

  if (activeProcessId.value === 'work-sales') {
    await startWorkSalesProcess()
    return
  }

  await startInternalReconciliationProcess()
}

async function startInternalReconciliationProcess(): Promise<void> {
  if (internalSourceFiles.value.length === 0 || !reconciliationTargetFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先上传 Sample/Bulk 来源文件和内销对账单。'
    success.value = false
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)
  beginProcessing()

  try {
    const response = await processTmsFinanceInternalReconciliationFiles(
      {
        sourceFiles: internalSourceFiles.value,
        targetFile: reconciliationTargetFiles.value[0],
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.error ? `${response.message} - ${response.error}` : response.message
    summaryItems.value = buildTmsFinanceInternalReconciliationSummary(response)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
  } catch (error) {
    handleProcessError(error, startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

async function startWorkSalesProcess(): Promise<void> {
  if (!workSalesBulkSalesFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先上传 BULK Sales 导出表。'
    success.value = false
    return
  }

  if (!workSalesTurnoverFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先上传 TURNOVER 目标表。'
    success.value = false
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)
  beginProcessing()

  try {
    const response = await processTmsFinanceWorkSalesFiles(
      {
        bulkSalesFile: workSalesBulkSalesFiles.value[0],
        turnoverFile: workSalesTurnoverFiles.value[0],
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.error ? `${response.message} - ${response.error}` : response.message
    summaryItems.value = buildTmsFinanceWorkSalesSummary(response)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
  } catch (error) {
    handleProcessError(error, startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

function beginProcessing(): void {
  processing.value = true
  progress.value = 0
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []
  messageTone.value = 'info'
}

function handleProcessError(
  error: unknown,
  startedAt: number,
  inputFiles: string[],
): void {
  success.value = false
  messageTone.value = 'error'
  message.value = readErrorMessage(error, '处理失败，请重试')
  summaryItems.value = buildTmsFinanceProcessErrorSummary(message.value)
  recordHistory('error', startedAt, inputFiles)
}

async function downloadResult(): Promise<void> {
  if (!resultFile.value) {
    return
  }

  if (activeProcessId.value === 'work-sales') {
    await downloadTmsFinanceWorkSalesResult(resultFile.value)
    return
  }

  await downloadTmsFinanceInternalReconciliationResult(resultFile.value)
}

function resetForm(): void {
  if (activeProcessId.value === 'work-sales') {
    workSalesBulkSalesFiles.value = []
    workSalesTurnoverFiles.value = []
  } else {
    internalSourceFiles.value = []
    reconciliationTargetFiles.value = []
  }
  processing.value = false
  resetFeedback()
}

function resetFeedback(): void {
  progress.value = 0
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []
  messageTone.value = 'info'
}

function recordHistory(
  status: ProcessHistoryStatus,
  startedAt: number,
  inputFiles: string[],
): void {
  historyRecords.value = appendModuleHistory({
    moduleId: activeProcess.value.moduleId,
    moduleName: activeProcess.value.moduleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(activeProcess.value.moduleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
