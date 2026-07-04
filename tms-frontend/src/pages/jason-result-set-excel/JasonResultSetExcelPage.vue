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
            <label class="jason-result-month">
              <span>
                <AppIcon name="calendar" />
                {{ text('目标月份') }}
              </span>
              <input
                v-model="targetMonth"
                type="month"
                :disabled="processing"
                @input="markTargetMonthTouched"
              />
            </label>
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
  inferTargetMonthFromFilename,
  isValidTargetMonth,
  jasonResultSetExcelModuleId,
  jasonResultSetExcelModuleName,
} from './jasonResultSetExcelModel'

type CurrentResultDownloadMetadata = ReturnType<typeof readProcessHistoryMetadata>

const resultSetFiles = ref<File[]>([])
const targetMonth = ref('')
const lastAutoTargetMonth = ref('')
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
const targetMonthReady = computed(() => isValidTargetMonth(targetMonth.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value) && targetMonthReady.value)
const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'target-month',
    label: '目标月份',
    value: targetMonth.value || '-',
    icon: 'calendar',
    tone: 'teal',
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
  const monthText = targetMonthReady.value ? targetMonth.value : text('未选择月份')
  return `${text('已就绪')} ${totalFiles.value}/1 ${text('个文件')}，${text('目标月份')} ${monthText}`
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
  const inferredMonth = files[0] ? inferTargetMonthFromFilename(files[0].name) : ''
  if (inferredMonth && (!targetMonth.value || targetMonth.value === lastAutoTargetMonth.value)) {
    targetMonth.value = inferredMonth
    lastAutoTargetMonth.value = inferredMonth
  }
  if (!files[0]) {
    lastAutoTargetMonth.value = ''
  }
}

function markTargetMonthTouched(): void {
  if (targetMonth.value !== lastAutoTargetMonth.value) {
    lastAutoTargetMonth.value = ''
  }
}

async function startProcess(): Promise<void> {
  const resultSetFile = resultSetFiles.value[0]
  if (!canProcess.value || !resultSetFile) {
    message.value = targetMonthReady.value
      ? '请先按预检查提示补齐文件'
      : '请选择有效目标月份'
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
        targetMonth: targetMonth.value,
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
      targetMonth: targetMonth.value,
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
  targetMonth.value = ''
  lastAutoTargetMonth.value = ''
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

.jason-result-month {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.jason-result-month span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.jason-result-month .app-icon {
  width: 16px;
  height: 16px;
  color: #0d9488;
}

.jason-result-month input {
  width: min(240px, 100%);
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

.jason-result-month input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14);
}
</style>
