<template>
  <ExcelProcessPageShell
    title="成品表生成"
    subtitle="Copy of TMS + 国家区域统计 → 标准成品表"
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
          <template #after-fields>
            <label class="jane-filter">
              <span>
                <AppIcon name="file-search" />
                {{ text('Working Number 筛选（可选）') }}
              </span>
              <input
                v-model="workingFilters"
                type="text"
                :placeholder="text('多个值用英文逗号分隔')"
              />
            </label>
          </template>

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
  readProcessHistoryMetadata,
  type BackendProcessHistoryMetadata,
  type ProcessHistoryRecord,
  type ProcessHistoryStatus,
  type ProcessSummaryItem,
} from '../../shared/process/processHistory'
import { useProcessHistoryResultDownload } from '../../shared/process/useProcessHistoryResultDownload'
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
import {
  downloadJaneResult,
  processJaneFiles,
} from './janeApi'
import {
  buildJaneSummary,
  janeModuleId,
  janeModuleName,
} from './janeModel'

const customerFiles = ref<File[]>([])
const countryFiles = ref<File[]>([])
const workingFilters = ref('')
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(loadModuleHistory(janeModuleId))
const { text } = useAppLanguage()

const {
  latestHistoryResultRecord,
  historyResultToolbarTitle,
  downloadLatestHistoryResult,
} = useProcessHistoryResultDownload({
  historyRecords,
  processing,
  onError: (nextMessage) => {
    success.value = false
    message.value = nextMessage
  },
})

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'customer',
    label: 'Copy of TMS',
    files: customerFiles.value,
    hint: '上传 1 个 Copy of TMS 文件',
    expectedCount: 1,
  },
  {
    id: 'country',
    label: 'country.xlsx',
    files: countryFiles.value,
    hint: '上传国家/区域统计文件',
    accept: '.xlsx',
    acceptLabel: '支持 .xlsx',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const totalFiles = computed(() => customerFiles.value.length + countryFiles.value.length)
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
    disabled: processing.value || !latestHistoryResultRecord.value,
    title: historyResultToolbarTitle.value,
    onClick: downloadLatestHistoryResult,
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
  if (fieldId === 'customer') {
    customerFiles.value = files
    return
  }

  if (fieldId === 'country') {
    countryFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value || !customerFiles.value[0] || !countryFiles.value[0]) {
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
    const response = await processJaneFiles(
      {
        tmsFile: customerFiles.value[0],
        countryFile: countryFiles.value[0],
        workingFilters: workingFilters.value,
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
    summaryItems.value = buildJaneSummary(response, {
      customerFileCount: customerFiles.value.length,
      countryFileCount: countryFiles.value.length,
      workingFilters: workingFilters.value,
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
  if (resultFile.value) {
    await downloadJaneResult(resultFile.value)
  }
}

function resetForm(): void {
  customerFiles.value = []
  countryFiles.value = []
  workingFilters.value = ''
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
  metadata: BackendProcessHistoryMetadata = {},
): void {
  historyRecords.value = appendModuleHistory({
    ...readProcessHistoryMetadata(metadata),
    moduleId: janeModuleId,
    moduleName: janeModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(janeModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
