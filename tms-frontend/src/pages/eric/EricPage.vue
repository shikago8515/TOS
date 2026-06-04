<template>
  <section class="jane-page-container">
    <div class="jane-header">
      <div class="jane-header__title">
        <h2>{{ text('Eric 数据处理') }}</h2>
      </div>
      <div class="jane-header__stats">
        <div class="jane-stat">
          <div class="jane-stat__icon jane-stat__icon--blue">ER</div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text('源文件') }}</span>
            <span class="jane-stat__value">{{ sourceCount }}/2</span>
          </div>
        </div>
        <div class="jane-stat">
          <div class="jane-stat__icon" :class="success === true ? 'jane-stat__icon--green' : success === false ? 'jane-stat__icon--orange' : 'jane-stat__icon--slate'">ST</div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text('处理状态') }}</span>
            <span class="jane-stat__value">{{ statusText }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="jane-toolbar">
      <span class="jane-toolbar__status">{{ toolbarStatus }}</span>
      <div class="jane-toolbar__actions">
        <button class="jane-toolbar__btn" type="button" :disabled="processing" @click="resetForm">
          {{ text('重置') }}
        </button>
        <button
          class="jane-toolbar__btn"
          type="button"
          :disabled="!packFile || processing"
          @click="startFinalDataOnly"
        >
          {{ text('仅生成 Final_Data') }}
        </button>
        <button
          class="jane-toolbar__btn jane-toolbar__btn--primary"
          type="button"
          :disabled="!canReconcile || processing"
          @click="startReconcile"
        >
          {{ processing ? text('处理中...') : text('开始核对') }}
        </button>
      </div>
    </div>

    <div class="jane-grid">
      <div class="jane-main">
        <section class="jane-section">
          <div class="jane-section__head">
            <h3>{{ text('文件上传') }}</h3>
            <span class="jane-section__badge">{{ text('2 组必传') }}</span>
          </div>

          <div class="jane-upload-grid">
            <FileUploadBox
              v-model:files="packFiles"
              label="Size Breakdown Excel"
              :hint="text('用于生成 Final_Data')"
              accept=".xlsx,.xlsm"
              :accept-label="text('支持 .xlsx / .xlsm')"
            />
            <FileUploadBox
              v-model:files="yticFiles"
              label="Check Excel"
              :hint="text('用于提取尺寸、目的地和 SP 核对信息')"
              accept=".xls,.xlsx,.xlsm"
              :accept-label="text('支持 .xls / .xlsx / .xlsm')"
            />
          </div>

          <div v-if="processing" class="jane-progress">
            <div class="jane-progress__label">
              <strong>{{ text('处理进度') }}</strong>
              <span>{{ progress }}%</span>
            </div>
            <div class="jane-progress__track">
              <div class="jane-progress__fill" :style="{ width: `${progress}%` }" />
            </div>
          </div>

          <section
            v-if="message"
            class="jane-alert"
            :class="success === true ? 'jane-alert--success' : success === false ? 'jane-alert--error' : ''"
          >
            <p>{{ text(message) }}</p>
            <button v-if="success === true && outputFile" class="jane-alert__btn" type="button" @click="downloadResult">
              {{ text('下载结果文件') }}
            </button>
          </section>
        </section>

        <section v-if="logs.length > 0" class="jane-section">
          <div class="jane-section__head">
            <h3>{{ text('处理日志') }}</h3>
            <span class="jane-section__badge">{{ logs.length }} {{ text('条') }}</span>
          </div>
          <div class="eric-log">
            <div v-for="(line, i) in logs" :key="i">{{ text(line) }}</div>
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
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import {
  areRequiredFilesReady,
  type FileGroupState,
} from '../../shared/files/fileGroups'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
import FileUploadBox from '../../shared/ui/FileUploadBox.vue'
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

const fileGroups = computed<FileGroupState[]>(() => [
  {
    label: 'Size Breakdown Excel',
    files: packFiles.value,
    required: true,
    multiple: false,
    expectedCount: 1,
  },
  {
    label: 'Check Excel',
    files: yticFiles.value,
    required: true,
    multiple: false,
    expectedCount: 1,
  },
])

const statusText = computed(() => {
  if (processing.value) return '处理中'
  if (success.value === true) return '成功'
  if (success.value === false) return '失败'
  return '待处理'
})

const toolbarStatus = computed(() => {
  const readyCount = fileGroups.value.filter((g) => g.files.length > 0).length
  return `${text('已就绪')} ${readyCount}/2 ${text('组文件')}`
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
      (p) => { progress.value = p },
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
      (p) => { progress.value = p },
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
