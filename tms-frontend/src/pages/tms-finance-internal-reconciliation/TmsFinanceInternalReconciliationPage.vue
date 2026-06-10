<template>
  <ExcelProcessPageShell
    title="TMS财务表格数据处理"
    :subtitle="activeProcess.subtitle"
    :stats="pageStats"
    :toolbar-status="toolbarStatus"
    :actions="toolbarActions"
  >
    <section class="tms-finance-switcher" aria-label="TMS 财务处理流程">
      <button
        v-for="option in tmsFinanceProcessOptions"
        :key="option.id"
        class="tms-finance-switcher__item"
        :class="{ 'is-active': option.id === activeProcessId }"
        type="button"
        :disabled="processing || option.id === activeProcessId"
        :aria-pressed="option.id === activeProcessId"
        @click="switchProcess(option)"
      >
        <span class="tms-finance-switcher__icon">
          <AppIcon :name="option.icon" />
        </span>
        <span class="tms-finance-switcher__copy">
          <strong>{{ text(option.label) }}</strong>
          <small>{{ text(option.subtitle) }}</small>
        </span>
        <span class="tms-finance-switcher__badge">{{ text(option.badge) }}</span>
      </button>
    </section>

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
import { useRoute, useRouter } from 'vue-router'

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
import AppIcon from '../../shared/ui/AppIcon.vue'
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
  tmsFinanceProcessOptions,
  type TmsFinanceProcessId,
  type TmsFinanceProcessOption,
} from './tmsFinancePageModel'

const route = useRoute()
const router = useRouter()
const activeProcessId = ref<TmsFinanceProcessId>(resolveProcessIdFromRoute(route.name))
const internalSourceFiles = ref<File[]>([])
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
  () => getTmsFinanceProcessById(activeProcessId.value),
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
      id: 'internal-sources',
      label: 'Sample/Bulk 来源文件',
      files: internalSourceFiles.value,
      hint: '可一次上传多个合并Sample、合并BULK工作簿，按上传顺序回填',
      multiple: true,
      accept: '.xlsx,.xlsm',
      acceptLabel: '支持 .xlsx / .xlsm',
    },
    {
      id: 'target',
      label: '内销对账单',
      files: reconciliationTargetFiles.value,
      hint: '上传要回填未清账尾部已有行的内销对账大表',
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

  if (fieldId === 'iplix') {
    iplixFiles.value = files
    return
  }

  if (fieldId === 'work-sales-reference') {
    workSalesReferenceFiles.value = files
  }
}

function resolveProcessIdFromRoute(routeName: unknown): TmsFinanceProcessId {
  return getTmsFinanceProcessByRoute(routeName).id
}

function switchProcess(option: TmsFinanceProcessOption): void {
  if (processing.value || option.id === activeProcessId.value) {
    return
  }

  void router.push({ name: option.routeName })
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

.tms-finance-switcher {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.tms-finance-switcher__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 86px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.tms-finance-switcher__item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #99f6e4;
  box-shadow: 0 10px 24px rgba(13, 148, 136, 0.1);
}

.tms-finance-switcher__item.is-active {
  border-color: #14b8a6;
  background: #f0fdfa;
  box-shadow:
    inset 0 0 0 1px rgba(20, 184, 166, 0.18),
    0 8px 20px rgba(13, 148, 136, 0.08);
}

.tms-finance-switcher__item:disabled {
  cursor: default;
}

.tms-finance-switcher__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  box-shadow: 0 5px 12px rgba(13, 148, 136, 0.22);
}

.tms-finance-switcher__icon .app-icon {
  width: 20px;
  height: 20px;
}

.tms-finance-switcher__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tms-finance-switcher__copy strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 1.3;
}

.tms-finance-switcher__copy small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
  white-space: normal;
}

.tms-finance-switcher__badge {
  align-self: start;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .tms-finance-switcher {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .tms-finance-switcher__item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tms-finance-switcher__badge {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
