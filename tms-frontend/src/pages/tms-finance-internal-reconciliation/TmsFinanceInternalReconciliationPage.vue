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
  type ExcelFileField,
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
  tmsFinanceInternalReconciliationModuleName,
} from './tmsFinanceInternalReconciliationModel'
import {
  downloadTmsFinanceWorkSalesResult,
  processTmsFinanceWorkSalesFiles,
} from './tmsFinanceWorkSalesApi'
import {
  buildTmsFinanceWorkSalesSummary,
  tmsFinanceWorkSalesModuleId,
  tmsFinanceWorkSalesModuleName,
} from './tmsFinanceWorkSalesModel'

type TmsFinanceProcessId = 'internal-reconciliation' | 'work-sales'

interface TmsFinanceProcessOption {
  id: TmsFinanceProcessId
  label: string
  subtitle: string
  badge: string
  requiredGroups: number
  progressLabel: string
  idleActionLabel: string
  processingActionLabel: string
  moduleId: string
  moduleName: string
  routeName: string
}

const processOptions: TmsFinanceProcessOption[] = [
  {
    id: 'internal-reconciliation',
    label: '内销对账单导入',
    subtitle: '合并Sample + 合并BULK → 内销对账单',
    badge: '3 组必传',
    requiredGroups: 3,
    progressLabel: '导入进度',
    idleActionLabel: '开始导入',
    processingActionLabel: '导入中...',
    moduleId: tmsFinanceInternalReconciliationModuleId,
    moduleName: tmsFinanceInternalReconciliationModuleName,
    routeName: 'tms-finance-internal-reconciliation',
  },
  {
    id: 'work-sales',
    label: 'Work Sales 数据提取',
    subtitle: 'iPlix Turnover Details + 补充参考表 → Work Sales 汇总',
    badge: '2 组必传',
    requiredGroups: 2,
    progressLabel: '导入进度',
    idleActionLabel: '开始导入',
    processingActionLabel: '导入中...',
    moduleId: tmsFinanceWorkSalesModuleId,
    moduleName: tmsFinanceWorkSalesModuleName,
    routeName: 'tms-finance-work-sales',
  },
]

const route = useRoute()
const activeProcessId = ref<TmsFinanceProcessId>(resolveProcessIdFromRoute(route.name))
const sampleFiles = ref<File[]>([])
const bulkFiles = ref<File[]>([])
const reconciliationTargetFiles = ref<File[]>([])
const iplixFiles = ref<File[]>([])
const workSalesReferenceFiles = ref<File[]>([])
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
  () =>
    processOptions.find((process) => process.id === activeProcessId.value)
    ?? processOptions[0],
)

const uploadFields = computed<ExcelFileField[]>(() => {
  if (activeProcessId.value === 'work-sales') {
    return [
      {
        id: 'iplix',
        label: 'iPlix 导出 Excel',
        files: iplixFiles.value,
        hint: '上传包含 Turnover Details Sheet 的 iPlix 导出文件',
        accept: '.xlsx,.xlsm',
        acceptLabel: '支持 .xlsx / .xlsm',
        expectedCount: 1,
      },
      {
        id: 'work-sales-reference',
        label: '补充参考表',
        files: workSalesReferenceFiles.value,
        hint: '上传含 Buyer、Factory、Customer 及 SAS/Promo/Upcharge 的匹配表',
        accept: '.xls,.xlsx,.xlsm',
        acceptLabel: '支持 .xls / .xlsx / .xlsm',
        expectedCount: 1,
      },
    ]
  }

  return [
    {
      id: 'sample',
      label: '合并Sample 文件',
      files: sampleFiles.value,
      hint: '上传目标月份的合并Sample工作簿',
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
    {
      id: 'bulk',
      label: '合并BULK 文件',
      files: bulkFiles.value,
      hint: '上传目标月份的合并BULK工作簿',
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
    {
      id: 'target',
      label: '内销对账单',
      files: reconciliationTargetFiles.value,
      hint: '上传要追加未清账的内销对账单工作簿',
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
      expectedCount: 1,
    },
  ]
})

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const readyGroupCount = computed(
  () => fileGroups.value.filter((group) => group.files.length > 0).length,
)
const totalFiles = computed(() =>
  activeProcessId.value === 'work-sales'
    ? iplixFiles.value.length + workSalesReferenceFiles.value.length
    : sampleFiles.value.length + bulkFiles.value.length + reconciliationTargetFiles.value.length,
)
const appendedCount = computed(() => {
  const item = summaryItems.value.find((entry) => entry.label === '新增行')
  return item?.value ?? '-'
})

const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'appended-count',
    label: '新增行',
    value: appendedCount.value,
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
  if (fieldId === 'sample') {
    sampleFiles.value = files
    return
  }

  if (fieldId === 'bulk') {
    bulkFiles.value = files
    return
  }

  if (fieldId === 'target') {
    reconciliationTargetFiles.value = files
    return
  }

  if (fieldId === 'iplix') {
    iplixFiles.value = files
    return
  }

  if (fieldId === 'work-sales-reference') {
    workSalesReferenceFiles.value = files
  }
}

function resolveProcessIdFromRoute(routeName: unknown): TmsFinanceProcessId {
  return routeName === 'tms-finance-work-sales'
    ? 'work-sales'
    : 'internal-reconciliation'
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
  if (!sampleFiles.value[0] || !bulkFiles.value[0] || !reconciliationTargetFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先补齐合并Sample、合并BULK和内销对账单文件。'
    success.value = false
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)
  beginProcessing()

  try {
    const response = await processTmsFinanceInternalReconciliationFiles(
      {
        sampleFile: sampleFiles.value[0],
        bulkFile: bulkFiles.value[0],
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
  if (!iplixFiles.value[0] || !workSalesReferenceFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先补齐 iPlix 导出 Excel 和补充参考表。'
    success.value = false
    return
  }

  const startedAt = Date.now()
  const inputFiles = serializeInputFiles(fileGroups.value)
  beginProcessing()

  try {
    const response = await processTmsFinanceWorkSalesFiles(
      {
        iplixFile: iplixFiles.value[0],
        referenceFile: workSalesReferenceFiles.value[0],
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
  summaryItems.value = [
    {
      label: '处理状态',
      value: '失败',
      note: '可导出诊断包发给开发排查',
    },
  ]
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
    iplixFiles.value = []
    workSalesReferenceFiles.value = []
  } else {
    sampleFiles.value = []
    bulkFiles.value = []
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
