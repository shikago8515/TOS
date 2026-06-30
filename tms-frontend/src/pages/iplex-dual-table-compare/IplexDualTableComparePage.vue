<template>
  <ExcelProcessPageShell
    title="数据核对"
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
          :processing="processing || inspecting"
          :progress="progress"
          progress-label="处理进度"
          badge="2 张 Excel 必传"
          @update:files="updateUploadFiles"
        >
          <template #after-fields>
            <section
              class="iplex-preview"
              :class="{
                'iplex-preview--alert': success && previewRows.length > 0,
                'iplex-preview--ready': success && previewRows.length === 0,
              }"
            >
              <div class="iplex-preview__head">
                <div>
                  <h3>{{ text('核对异常列表') }}</h3>
                </div>
                <span>{{ success ? text(`${previewRows.length} 行`) : text('待生成') }}</span>
              </div>
              <div v-if="!success" class="iplex-preview__empty iplex-preview__empty--pending">
                {{ text('上传两张 Excel 后点击生成，系统会自动识别固定业务列并在这里显示核对结果。') }}
              </div>
              <div v-else-if="previewRows.length === 0" class="iplex-preview__empty">
                {{ text('全部一致，未发现差值不为 0 的行。') }}
              </div>
              <div v-else class="iplex-preview__table-wrap">
                <table class="iplex-preview__table">
                  <thead>
                    <tr>
                      <th>{{ text('RC 行号') }}</th>
                      <th>BUYER ORDER NO.</th>
                      <th>{{ text('状态') }}</th>
                      <th>{{ text('RC 单价') }}</th>
                      <th>{{ text('PO 单价') }}</th>
                      <th>{{ text('单价差值') }}</th>
                      <th>{{ text('RC 金额') }}</th>
                      <th>{{ text('PO 金额') }}</th>
                      <th>{{ text('金额差值') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in previewRows" :key="`${row.row_number}-${row.key}`">
                      <td>{{ row.row_number }}</td>
                      <td>{{ row.key || '-' }}</td>
                      <td>
                        <span class="iplex-preview__status">{{ text(row.status) }}</span>
                      </td>
                      <td>{{ row.four_digit.main_value || '-' }}</td>
                      <td>{{ row.four_digit.lookup_value || '-' }}</td>
                      <td>{{ row.four_digit.difference || '-' }}</td>
                      <td>{{ row.two_digit.main_value || '-' }}</td>
                      <td>{{ row.two_digit.lookup_value || '-' }}</td>
                      <td>{{ row.two_digit.difference || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
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
import { useAppLanguage } from '../../shared/i18n/appLanguage'
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
  downloadIplexDualTableCompareResult,
  inspectIplexDualTableWorkbook,
  processIplexDualTableCompareFiles,
  type IplexDualTableInspectionResponse,
  type IplexDualTableComparePreviewRow,
} from './iplexDualTableCompareApi'
import {
  buildAutoIplexDualTableCompareProcessRequest,
  buildIplexDualTableCompareSummary,
  getIplexDualTablePreviewRows,
  iplexDualTableCompareModuleId,
  iplexDualTableCompareModuleName,
} from './iplexDualTableCompareModel'

const mainFiles = ref<File[]>([])
const lookupFiles = ref<File[]>([])
const inspecting = ref(false)
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const previewRows = ref<IplexDualTableComparePreviewRow[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(iplexDualTableCompareModuleId),
)
const { text } = useAppLanguage()

const {
  hasProcessHistoryRecords,
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
    id: 'main',
    label: 'Total Adjustment & Shas Vas Price 汇总表',
    files: mainFiles.value,
    accept: '.xls,.xlsx,.xlsm',
    acceptLabel: '支持 .xls / .xlsx / .xlsm',
    expectedCount: 1,
  },
  {
    id: 'lookup',
    label: 'Total Adjustment & Shas Vas Price',
    files: lookupFiles.value,
    accept: '.xls,.xlsx,.xlsm',
    acceptLabel: '支持 .xls / .xlsx / .xlsm',
    expectedCount: 1,
  },
])
const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))
const canProcess = computed(() => areRequiredFilesReady(fileGroups.value) && !inspecting.value && !processing.value)
const totalFiles = computed(() => mainFiles.value.length + lookupFiles.value.length)
const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'selected-files',
    label: '已选文件',
    value: totalFiles.value,
    icon: 'files',
    tone: 'blue',
  },
  {
    id: 'matched',
    label: '匹配行',
    value: summaryValue('匹配行数'),
    icon: 'target',
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
const toolbarStatus = computed(() => {
  if (processing.value) {
    return '正在生成核对结果'
  }
  if (inspecting.value) {
    return '正在自动识别表头'
  }
  return canProcess.value
    ? '文件已就绪，可生成核对结果'
    : `已就绪 ${fileGroups.value.filter((group) => group.files.length > 0).length}/2 组文件`
})
const toolbarActions = computed<ExcelToolbarAction[]>(() => [
  {
    id: 'reset',
    label: '重置',
    icon: 'refresh-cw',
    disabled: inspecting.value || processing.value,
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
    visible: hasProcessHistoryRecords.value,
    disabled: inspecting.value || processing.value || !latestHistoryResultRecord.value,
    title: historyResultToolbarTitle.value,
    onClick: downloadLatestHistoryResult,
  },
  {
    id: 'process',
    label: processing.value ? '生成中...' : '生成核对结果',
    icon: processing.value ? 'loader' : 'target',
    primary: true,
    disabled: !canProcess.value,
    onClick: startProcess,
  },
])
const resultNoticeTone = computed<ExcelNoticeTone>(() => (success.value ? 'success' : 'error'))

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'main') {
    mainFiles.value = files
    clearResultState()
    return
  }

  if (fieldId === 'lookup') {
    lookupFiles.value = files
    clearResultState()
  }
}

async function inspectUploadedWorkbooks(): Promise<{
  poInspection: IplexDualTableInspectionResponse
  rcInspection: IplexDualTableInspectionResponse
}> {
  inspecting.value = true

  try {
    const [poInspection, rcInspection] = await Promise.all([
      inspectIplexDualTableWorkbook({
        file: mainFiles.value[0] as File,
        headerRow: 1,
      }),
      inspectIplexDualTableWorkbook({
        file: lookupFiles.value[0] as File,
        headerRow: 1,
      }),
    ])

    return { poInspection, rcInspection }
  } finally {
    inspecting.value = false
  }
}

async function startProcess(): Promise<void> {
  if (!mainFiles.value[0] || !lookupFiles.value[0]) {
    message.value = '请先上传 PO 调整表和 RC 核对表'
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
    previewRows.value = []

  try {
    progress.value = 8
    const { poInspection, rcInspection } = await inspectUploadedWorkbooks()
    progress.value = 24
    const response = await processIplexDualTableCompareFiles(
      buildAutoIplexDualTableCompareProcessRequest({
        poFile: mainFiles.value[0],
        rcFile: lookupFiles.value[0],
        poInspection,
        rcInspection,
      }),
      (nextProgress) => {
        progress.value = Math.max(24, nextProgress)
      },
    )

    success.value = response.success
    resultFile.value = response.output_file ?? ''
    message.value = response.message
    summaryItems.value = buildIplexDualTableCompareSummary(response)
    previewRows.value = getIplexDualTablePreviewRows(response)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles, response)
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, '处理失败，请确认文件模板和固定业务列')
    summaryItems.value = [
      {
        label: '处理状态',
        value: '失败',
        note: '请检查 PO #、BUYER ORDER NO.、Adjustment_per_unit、SHAS PRICE PER UNIT、Total Adjustment Amount 和 TOTAL ADJUSTMENT',
      },
    ]
    previewRows.value = []
    recordHistory('error', startedAt, inputFiles)
  } finally {
    processing.value = false
  }
}

async function downloadResult(): Promise<void> {
  if (resultFile.value) {
    await downloadIplexDualTableCompareResult(resultFile.value)
  }
}

function resetForm(): void {
  mainFiles.value = []
  lookupFiles.value = []
  inspecting.value = false
  processing.value = false
  progress.value = 0
  clearResultState()
}

function clearResultState(): void {
  message.value = ''
  success.value = false
  resultFile.value = ''
  summaryItems.value = []
  previewRows.value = []
}

function summaryValue(label: string): string {
  return summaryItems.value.find((item) => item.label === label)?.value ?? '-'
}

function recordHistory(
  status: ProcessHistoryStatus,
  startedAt: number,
  inputFiles: string[],
  metadata: BackendProcessHistoryMetadata = {},
): void {
  historyRecords.value = appendModuleHistory({
    ...readProcessHistoryMetadata(metadata),
    moduleId: iplexDualTableCompareModuleId,
    moduleName: iplexDualTableCompareModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(iplexDualTableCompareModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';

.iplex-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.72);
}

.iplex-preview--alert {
  border-color: rgba(248, 113, 113, 0.36);
  background: #fffafa;
}

.iplex-preview--ready {
  border-color: rgba(34, 197, 94, 0.28);
  background: #f8fffb;
}

.iplex-preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.iplex-preview__head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.iplex-preview__head span {
  flex: 0 0 auto;
  border-radius: 999px;
  background: #e0f2fe;
  color: #075985;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
}

.iplex-preview--alert .iplex-preview__head h3 {
  color: #991b1b;
}

.iplex-preview--alert .iplex-preview__head span {
  background: #fee2e2;
  color: #991b1b;
}

.iplex-preview--ready .iplex-preview__head span {
  background: #dcfce7;
  color: #166534;
}

.iplex-preview__empty {
  border: 1px dashed #bbf7d0;
  border-radius: 8px;
  background: #f0fdf4;
  color: #166534;
  font-size: 13px;
  font-weight: 600;
  padding: 12px;
}

.iplex-preview__empty--pending {
  border-color: #bae6fd;
  background: #f0f9ff;
  color: #075985;
}

.iplex-preview__table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #ffffff;
}

.iplex-preview__table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 13px;
}

.iplex-preview__table th,
.iplex-preview__table td {
  border-bottom: 1px solid #fee2e2;
  padding: 9px 10px;
  text-align: right;
  white-space: nowrap;
}

.iplex-preview__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fef2f2;
  color: #7f1d1d;
  font-weight: 700;
}

.iplex-preview__table th:nth-child(2),
.iplex-preview__table th:nth-child(3),
.iplex-preview__table td:nth-child(2),
.iplex-preview__table td:nth-child(3) {
  text-align: left;
}

.iplex-preview__status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
}

</style>
