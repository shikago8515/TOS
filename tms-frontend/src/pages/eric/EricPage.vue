<template>
  <ExcelProcessPageShell
    title="Eric 数据处理"
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
        />

        <section v-if="logs.length > 0" class="jane-section">
          <div class="jane-section__head">
            <h3>{{ text('处理日志') }}</h3>
            <span class="jane-section__badge">{{ logs.length }} {{ text('条') }}</span>
          </div>
          <div class="eric-log">
            <div v-for="(line, index) in logs" :key="index">{{ text(line) }}</div>
          </div>
        </section>
      </div>

      <div class="jane-side">
        <FilePrecheckPanel :groups="fileGroups" />

        <section class="jane-section">
          <div class="jane-section__head">
            <h3>{{ text('结果指标') }}</h3>
          </div>
          <div class="eric-stats">
            <article v-for="stat in statItems" :key="stat.label" class="eric-stat">
              <span>{{ text(stat.label) }}</span>
              <strong>{{ text(stat.value) }}</strong>
            </article>
          </div>
        </section>
      </div>
    </div>
  </ExcelProcessPageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import { areRequiredFilesReady } from '../../shared/files/fileGroups'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
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
import {
  downloadEricResult,
  processEricFile,
  reconcileEricFiles,
} from './ericApi'
import {
  buildEricStats,
  readEricDifferenceCount,
  readEricRowCount,
} from './ericModel'

const packFiles = ref<File[]>([])
const yticFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const success = ref<boolean | null>(null)
const message = ref('')
const logs = ref<string[]>([])
const outputFile = ref('')
const rowCount = ref('-')
const differenceCount = ref('-')
const { text } = useAppLanguage()

const packFile = computed(() => packFiles.value[0] ?? null)
const yticFile = computed(() => yticFiles.value[0] ?? null)
const canReconcile = computed(() => Boolean(packFile.value && yticFile.value))
const sourceCount = computed(() => [packFile.value, yticFile.value].filter(Boolean).length)

const uploadFields = computed<ExcelFileField[]>(() => [
  {
    id: 'pack',
    label: 'Size Breakdown Excel',
    files: packFiles.value,
    hint: '用于生成 Final_Data',
    accept: '.xlsx,.xlsm',
    acceptLabel: '支持 .xlsx / .xlsm',
    expectedCount: 1,
  },
  {
    id: 'ytic',
    label: 'Check Excel',
    files: yticFiles.value,
    hint: '用于提取尺寸、目的地和 SP 核对信息',
    accept: '.xls,.xlsx,.xlsm',
    acceptLabel: '支持 .xls / .xlsx / .xlsm',
    expectedCount: 1,
  },
])

const fileGroups = computed(() => buildExcelFileGroups(uploadFields.value))

const statusText = computed(() => {
  if (processing.value) return '处理中'
  if (success.value === true) return '成功'
  if (success.value === false) return '失败'
  return '待处理'
})

const pageStats = computed<ExcelPageStat[]>(() => [
  {
    id: 'source-files',
    label: '源文件',
    value: `${sourceCount.value}/2`,
    iconText: 'ER',
    tone: 'blue',
  },
  {
    id: 'process-status',
    label: '处理状态',
    value: statusText.value,
    iconText: 'ST',
    tone: success.value === true ? 'green' : success.value === false ? 'orange' : 'slate',
  },
])

const toolbarStatus = computed(() => {
  const readyCount = fileGroups.value.filter((group) => group.files.length > 0).length
  return `${text('已就绪')} ${readyCount}/2 ${text('组文件')}`
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
    id: 'final-data',
    label: '仅生成 Final_Data',
    icon: 'file-search',
    disabled: !packFile.value || processing.value,
    onClick: startFinalDataOnly,
  },
  {
    id: 'download',
    label: '下载结果',
    icon: 'download',
    visible: success.value === true && Boolean(outputFile.value),
    onClick: downloadResult,
  },
  {
    id: 'reconcile',
    label: processing.value ? '处理中...' : '开始核对',
    icon: processing.value ? 'loader' : 'play-circle',
    primary: true,
    disabled: !canReconcile.value || processing.value,
    onClick: startReconcile,
  },
])

const resultNoticeTone = computed<ExcelNoticeTone>(() => {
  if (success.value === true) return 'success'
  if (success.value === false) return 'error'
  return 'info'
})

const statItems = computed(() =>
  buildEricStats({
    packReady: Boolean(packFile.value),
    yticReady: Boolean(yticFile.value),
    processing: processing.value,
    success: success.value,
    rowCount: rowCount.value,
    differenceCount: differenceCount.value,
    outputFile: outputFile.value,
  }),
)

function updateUploadFiles(fieldId: string, files: File[]): void {
  if (fieldId === 'pack') {
    packFiles.value = files
    return
  }

  if (fieldId === 'ytic') {
    yticFiles.value = files
  }
}

function isPackFile(file: File): boolean {
  return /\.(xlsx|xlsm)$/i.test(file.name)
}

function isYticFile(file: File): boolean {
  return /\.(xls|xlsx|xlsm)$/i.test(file.name)
}

function resetResultState(): void {
  progress.value = 0
  success.value = null
  message.value = ''
  logs.value = []
  outputFile.value = ''
  rowCount.value = '-'
  differenceCount.value = '-'
}

function failValidation(nextMessage: string): boolean {
  success.value = false
  message.value = nextMessage
  logs.value = [nextMessage]
  outputFile.value = ''
  rowCount.value = '-'
  differenceCount.value = '-'
  return false
}

function validatePack(): boolean {
  if (!packFile.value) return failValidation('请上传 Pack Size breakdown 文件')
  if (!isPackFile(packFile.value)) return failValidation('Pack Size breakdown 仅支持 .xlsx / .xlsm')
  return true
}

function validateYtic(): boolean {
  if (!yticFile.value) return failValidation('请上传 YTIC check 文件')
  if (!isYticFile(yticFile.value)) return failValidation('YTIC check 仅支持 .xls / .xlsx / .xlsm')
  return true
}

async function startReconcile(): Promise<void> {
  if (processing.value || !validatePack() || !validateYtic() || !packFile.value || !yticFile.value) return

  processing.value = true
  resetResultState()

  try {
    const response = await reconcileEricFiles(
      { packFile: packFile.value, yticFile: yticFile.value },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )
    applyResponse(response, '核对完成', '核对失败')
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, '核对失败')
    logs.value = [message.value]
  } finally {
    processing.value = false
  }
}

async function startFinalDataOnly(): Promise<void> {
  if (processing.value || !validatePack() || !packFile.value) return

  processing.value = true
  resetResultState()

  try {
    const response = await processEricFile(
      { excelFile: packFile.value },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )
    applyResponse(response, 'Final_Data 生成完成', 'Final_Data 生成失败')
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, 'Final_Data 生成失败')
    logs.value = [message.value]
  } finally {
    processing.value = false
  }
}

function applyResponse(
  response: Awaited<ReturnType<typeof reconcileEricFiles>>,
  successMsg: string,
  failMsg: string,
): void {
  success.value = response.success
  message.value = response.message || (response.success ? successMsg : failMsg)
  logs.value = Array.isArray(response.logs) ? response.logs : []
  outputFile.value = response.output_file ?? ''
  rowCount.value = readEricRowCount(response)
  differenceCount.value = readEricDifferenceCount(response)
}

function resetForm(): void {
  packFiles.value = []
  yticFiles.value = []
  processing.value = false
  resetResultState()
}

async function downloadResult(): Promise<void> {
  if (outputFile.value) await downloadEricResult(outputFile.value)
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';

.eric-log {
  display: grid;
  gap: 8px;
  max-height: 280px;
  overflow: auto;
}

.eric-log div {
  padding: 8px 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.eric-stats {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.eric-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.eric-stat:hover {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.eric-stat span {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.eric-stat strong {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
}
</style>
