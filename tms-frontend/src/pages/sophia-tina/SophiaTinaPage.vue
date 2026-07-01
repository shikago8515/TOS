<template>
  <ExcelProcessPageShell
    title="Sophia - 报表合并"
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
          badge="3 组必传 + 2 组可选"
          @update:files="updateUploadFiles"
        >
          <ResultSummary
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
import { downloadSophiaTinaResult, processSophiaTinaFiles } from './sophiaTinaApi'
import {
  buildSophiaTinaSummary,
  sophiaTinaModuleId,
  sophiaTinaModuleName,
} from './sophiaTinaModel'

const tmsFiles = ref<File[]>([])
const tmsPriceFiles = ref<File[]>([])
const priceFiles = ref<File[]>([])
const allocationFiles = ref<File[]>([])
const shipmentMethodFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(loadModuleHistory(sophiaTinaModuleId))
const messageTone = ref<ExcelNoticeTone>('info')
const { text } = useAppLanguage()

const {
  historyResultToolbarTitle,
  openHistoryResultPage,
} = useProcessHistoryResultPageLink({
  moduleId: sophiaTinaModuleId,
  processing,
})

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'tms',
    label: 'TMS 文件（可多选）',
    files: tmsFiles.value,
    hint: '上传一个或多个 TMS 文件',
    multiple: true,
  },
  {
    id: 'tms-price',
    label: 'TMS Price 文件（可多选）',
    files: tmsPriceFiles.value,
    hint: '上传 article-season-cbd-app-hdw 类型文件，用于 Season、Marketing Forecast 和 TMS Price',
    multiple: true,
  },
  {
    id: 'price',
    label: 'Factory Price 文件（可多选）',
    files: priceFiles.value,
    hint: '上传一个或多个 Factory Price 文件',
    multiple: true,
  },
  {
    id: 'allocation',
    label: 'Allocation Factory 文件（可选，可多选）',
    files: allocationFiles.value,
    hint: '按 PO 覆盖 Result 中的 Factory；未上传时使用 TMS Factory',
    multiple: true,
    required: false,
  },
  {
    id: 'shipment-method',
    label: 'Shipment Method 文件（可选，可多选）',
    files: shipmentMethodFiles.value,
    hint: '按 PO 覆盖 Shipment Method、PODD 和 Quantity；未上传时使用 TMS 字段',
    multiple: true,
    required: false,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const readyGroupCount = computed(
  () => fileGroups.value.filter((group) => group.required && group.files.length > 0).length,
)
const totalSelectedCount = computed(
  () =>
    tmsFiles.value.length +
    tmsPriceFiles.value.length +
    priceFiles.value.length +
    allocationFiles.value.length +
    shipmentMethodFiles.value.length,
)
const toolbarStatus = computed(
  () => `${text('必传就绪')} ${readyGroupCount.value}/3 ${text('组文件')}，${text('当前共')} ${totalSelectedCount.value} ${text('个文件')}`,
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
    label: processing.value ? '合并中...' : '开始合并',
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canProcess.value || processing.value,
    onClick: startProcess,
  },
])

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'tms') {
    tmsFiles.value = files
    return
  }

  if (fieldId === 'tms-price') {
    tmsPriceFiles.value = files
    return
  }

  if (fieldId === 'price') {
    priceFiles.value = files
    return
  }

  if (fieldId === 'allocation') {
    allocationFiles.value = files
    return
  }

  if (fieldId === 'shipment-method') {
    shipmentMethodFiles.value = files
  }
}

async function startProcess(): Promise<void> {
  if (!canProcess.value) {
    messageTone.value = 'warning'
    message.value = '请先补齐 TMS、TMS Price 和 Factory Price 文件，再开始合并。'
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
    const response = await processSophiaTinaFiles(
      {
        tmsFiles: tmsFiles.value,
        tmsPriceFiles: tmsPriceFiles.value,
        priceFiles: priceFiles.value,
        allocationFiles: allocationFiles.value,
        shipmentMethodFiles: shipmentMethodFiles.value,
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.error ? `${response.message} - ${response.error}` : response.message
    summaryItems.value = buildSophiaTinaSummary(response, {
      tms: tmsFiles.value.length,
      tmsPrice: tmsPriceFiles.value.length,
      price: priceFiles.value.length,
      allocation: allocationFiles.value.length,
      shipmentMethod: shipmentMethodFiles.value.length,
    })
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
  if (resultFile.value) {
    await downloadSophiaTinaResult(resultFile.value)
  }
}

function resetForm(): void {
  tmsFiles.value = []
  tmsPriceFiles.value = []
  priceFiles.value = []
  allocationFiles.value = []
  shipmentMethodFiles.value = []
  processing.value = false
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
  metadata: BackendProcessHistoryMetadata = {},
): void {
  historyRecords.value = appendModuleHistory({
    ...readProcessHistoryMetadata(metadata),
    moduleId: sophiaTinaModuleId,
    moduleName: sophiaTinaModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(sophiaTinaModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
