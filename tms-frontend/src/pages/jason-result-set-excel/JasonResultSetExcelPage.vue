<template>
  <ExcelProcessPageShell
    title="Jason / Result Set Excel"
    subtitle="To ERIC Result Set -> test 目标表"
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
          badge="1 组必传"
          @update:files="updateUploadFiles"
        >
          <template #after-fields>
            <div class="jason-result-filters">
              <label class="jason-result-filter">
                <span class="jason-result-filter__label">
                  <AppIcon name="calendar" />
                  {{ text('日期范围') }}
                </span>
                <div class="jason-date-range">
                  <input
                    v-model="dateFrom"
                    type="date"
                    :disabled="processing"
                    :aria-label="text('开始日期')"
                    @input="markDateRangeTouched"
                  />
                  <span class="jason-date-range__separator">TO</span>
                  <input
                    v-model="dateTo"
                    type="date"
                    :disabled="processing"
                    :aria-label="text('结束日期')"
                    @input="markDateRangeTouched"
                  />
                </div>
              </label>

              <div class="jason-result-filter">
                <span class="jason-result-filter__label">
                  <AppIcon name="layers" />
                  {{ text('Order Type') }}
                </span>
                <div class="jason-order-type-toggle" role="radiogroup" :aria-label="text('Order Type')">
                  <button
                    v-for="option in orderTypeOptions"
                    :key="option.value"
                    type="button"
                    :class="{ 'is-active': orderTypeFilter === option.value }"
                    :disabled="processing"
                    role="radio"
                    :aria-checked="orderTypeFilter === option.value"
                    @click="orderTypeFilter = option.value"
                  >
                    {{ text(option.label) }}
                  </button>
                </div>
              </div>
            </div>
          </template>

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
import {
  appendModuleHistory,
  clearModuleHistory,
  downloadCurrentProcessResult,
  loadModuleHistory,
  readProcessHistoryMetadata,
  type BackendProcessHistoryMetadata,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import { useProcessHistoryResultPageLink } from '../../shared/process/useProcessHistoryResultPageLink'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import AppIcon from '../../shared/ui/AppIcon.vue'
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
import { processJasonResultSetExcel } from './jasonResultSetExcelApi'
import {
  buildJasonResultSetExcelSummary,
  buildDateFilterLabel,
  getDateFilterMode,
  getOrderTypeLabel,
  inferTargetDateRangeFromFilename,
  isValidDateRangeSelection,
  jasonResultSetExcelOrderTypeOptions,
  jasonResultSetExcelModuleId,
  jasonResultSetExcelModuleName,
  type JasonResultSetExcelDateRange,
  type JasonResultSetExcelOrderTypeFilter,
} from './jasonResultSetExcelModel'

type CurrentResultDownloadMetadata = ReturnType<typeof readProcessHistoryMetadata>

const resultSetFiles = ref<File[]>([])
const dateFrom = ref('')
const dateTo = ref('')
const lastAutoDateRange = ref<JasonResultSetExcelDateRange>(emptyDateRange())
const orderTypeFilter = ref<JasonResultSetExcelOrderTypeFilter>('bulk')
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyWarnings = ref<string[]>([])
const downloadError = ref('')
const currentResultDownload = ref<CurrentResultDownloadMetadata>({})
const historyRecords = ref<ProcessHistoryRecord[]>(loadModuleHistory(jasonResultSetExcelModuleId))
const { text } = useAppLanguage()

function emptyDateRange(): JasonResultSetExcelDateRange {
  return { dateFrom: '', dateTo: '' }
}

const {
  historyResultToolbarTitle,
  openHistoryResultPage,
} = useProcessHistoryResultPageLink({
  moduleId: jasonResultSetExcelModuleId,
  processing,
})

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'result-set',
    label: 'To ERIC Result Set',
    files: resultSetFiles.value,
    hint: '上传 1 个 .xlsx / .xlsm 文件',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const totalFiles = computed(() => resultSetFiles.value.length)
const dateRangeReady = computed(() => isValidDateRangeSelection(dateFrom.value, dateTo.value))
const dateFilterMode = computed(() => getDateFilterMode(dateFrom.value, dateTo.value))
const dateFilterLabel = computed(() => buildDateFilterLabel(dateFrom.value, dateTo.value))
const orderTypeLabel = computed(() => getOrderTypeLabel(orderTypeFilter.value))
const orderTypeOptions = jasonResultSetExcelOrderTypeOptions
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value) && dateRangeReady.value)
const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'date-range',
    label: '日期范围',
    value: dateFilterLabel.value,
    icon: 'calendar',
    tone: 'teal',
  },
  {
    id: 'order-type',
    label: 'Order Type',
    value: orderTypeLabel.value,
    icon: 'layers',
    tone: 'orange',
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
  const dateText = dateRangeReady.value ? dateFilterLabel.value : text('日期范围未完整')
  return `${text('已就绪')} ${totalFiles.value}/1 ${text('个文件')}，${text('日期范围')} ${dateText}，${text('Order Type')} ${orderTypeLabel.value}`
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
    label: processing.value ? '处理中...' : '开始处理',
    icon: processing.value ? 'loader' : 'play-circle',
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
  if (fieldId !== 'result-set') {
    return
  }

  resultSetFiles.value = files
  const inferredDateRange = files[0] ? inferTargetDateRangeFromFilename(files[0].name) : emptyDateRange()
  if (inferredDateRange.dateFrom && shouldReplaceDateRange()) {
    dateFrom.value = inferredDateRange.dateFrom
    dateTo.value = inferredDateRange.dateTo
    lastAutoDateRange.value = inferredDateRange
  }
  if (!files[0]) {
    lastAutoDateRange.value = emptyDateRange()
  }
}

function shouldReplaceDateRange(): boolean {
  const lastRange = lastAutoDateRange.value
  return (!dateFrom.value && !dateTo.value)
    || (dateFrom.value === lastRange.dateFrom && dateTo.value === lastRange.dateTo)
}

function markDateRangeTouched(): void {
  const lastRange = lastAutoDateRange.value
  if (dateFrom.value !== lastRange.dateFrom || dateTo.value !== lastRange.dateTo) {
    lastAutoDateRange.value = emptyDateRange()
  }
}

async function startProcess(): Promise<void> {
  const resultSetFile = resultSetFiles.value[0]
  if (!canProcess.value || !resultSetFile) {
    message.value = dateRangeReady.value
      ? '请先按预检查提示补齐文件'
      : '请选择有效日期范围'
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
    const response = await processJasonResultSetExcel(
      {
        resultSetFile,
        dateFilterMode: dateFilterMode.value,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        orderTypeFilter: orderTypeFilter.value,
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.output_file ?? ''
    message.value = response.error
      ? `${response.message} - ${response.error}`
      : response.message
    summaryItems.value = buildJasonResultSetExcelSummary(response, {
      resultSetFileCount: resultSetFiles.value.length,
      dateFilterLabel: dateFilterLabel.value,
      orderTypeLabel: orderTypeLabel.value,
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
      legacyDownloadPath: (filename) => `/api/jason/result-set-excel/download/${encodeURIComponent(filename)}`,
      fallbackFilename: 'jason_result_set_excel.xlsx',
    })
  } catch (error) {
    downloadError.value = readErrorMessage(error, '下载结果失败，请稍后重试')
  }
}

function resetForm(): void {
  resultSetFiles.value = []
  dateFrom.value = ''
  dateTo.value = ''
  lastAutoDateRange.value = emptyDateRange()
  orderTypeFilter.value = 'bulk'
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
    moduleId: jasonResultSetExcelModuleId,
    moduleName: jasonResultSetExcelModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(jasonResultSetExcelModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';

.jason-result-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 360px);
  gap: 16px;
  margin-top: 16px;
}

.jason-result-filter {
  display: grid;
  gap: 8px;
}

.jason-result-filter__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.jason-result-filter__label .app-icon {
  width: 16px;
  height: 16px;
  color: #0d9488;
}

.jason-date-range {
  display: grid;
  grid-template-columns: minmax(0, 180px) auto minmax(0, 180px);
  align-items: center;
  gap: 8px;
}

.jason-date-range input {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #d8e2ec;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.jason-date-range input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14);
}

.jason-date-range__separator {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.jason-order-type-toggle {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(420px, 100%);
  min-height: 42px;
  padding: 4px;
  background: #f1f5f9;
  border: 1px solid #d8e2ec;
  border-radius: 10px;
  gap: 4px;
}

.jason-order-type-toggle button {
  min-width: 0;
  padding: 0 10px;
  color: #475569;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
}

.jason-order-type-toggle button:hover:not(:disabled) {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.65);
}

.jason-order-type-toggle button.is-active {
  color: #0f766e;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.jason-order-type-toggle button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 760px) {
  .jason-result-filters {
    grid-template-columns: 1fr;
  }

  .jason-date-range {
    grid-template-columns: 1fr;
  }

  .jason-date-range__separator {
    display: none;
  }

  .jason-order-type-toggle {
    width: 100%;
  }
}
</style>
