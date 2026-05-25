<template>
  <section class="eric-page">
    <div class="eric-panel">
      <section class="eric-card eric-hero">
        <div>
          <p class="eric-kicker">Excel 处理</p>
          <h2 class="eric-title">Excel数据处理整合工具-Eric</h2>
          <p class="eric-desc">
            将 Pack Size breakdown 生成的 Final_Data 作为过渡明细，并自动解析 YTIC check 完成最终数量核对。
          </p>
        </div>
        <span class="eric-stage">核对流程 v0.2.0-alpha.1</span>
      </section>

      <div class="eric-alert">
        默认流程会输出诊断包：Summary、Size_Check、PO_Check、Final_Data 和 YTIC 审计明细。
      </div>

      <section class="eric-card">
        <div class="eric-upload-grid">
          <FileUploadBox
            v-model:files="packFiles"
            label="Pack Size breakdown"
            hint="用于生成 Final_Data"
            accept=".xlsx,.xlsm"
            accept-label="支持 .xlsx / .xlsm"
          />
          <FileUploadBox
            v-model:files="yticFiles"
            label="YTIC check"
            hint="用于提取尺寸、目的地和 SP 核对信息"
            accept=".xls,.xlsx,.xlsm"
            accept-label="支持 .xls / .xlsx / .xlsm"
          />
        </div>

        <div class="eric-steps">
          <article v-for="step in ericWorkflowSteps" :key="step.index" class="eric-step">
            <span>{{ step.index }}</span>
            <strong>{{ step.title }}</strong>
            <p>{{ step.description }}</p>
          </article>
        </div>

        <div class="eric-actions">
          <button
            class="eric-btn eric-btn--primary"
            type="button"
            :disabled="!canReconcile || processing"
            @click="startReconcile"
          >
            {{ processing ? '处理中...' : '开始核对' }}
          </button>
          <button
            class="eric-btn"
            type="button"
            :disabled="!packFile || processing"
            @click="startFinalDataOnly"
          >
            仅生成 Final_Data
          </button>
          <button class="eric-btn" type="button" :disabled="processing" @click="resetForm">重置</button>
          <button
            v-if="outputFile"
            class="eric-btn"
            type="button"
            @click="downloadResult"
          >
            下载结果
          </button>
        </div>

        <div v-if="processing" class="eric-progress">
          <span>上传进度 {{ progress }}%</span>
          <progress :value="progress" max="100" />
        </div>
      </section>

      <section class="eric-card">
        <div class="eric-summary">
          <article v-for="stat in stats" :key="stat.label" class="eric-stat">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        </div>

        <div
          v-if="message"
          class="eric-message"
          :class="{
            'eric-message--success': success === true,
            'eric-message--error': success === false,
          }"
        >
          {{ message }}
        </div>

        <div class="eric-log">
          <div v-if="logs.length === 0">处理记录会显示在这里。</div>
          <template v-else>
            <div v-for="line in logs" :key="line">{{ line }}</div>
          </template>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import FileUploadBox from '../../shared/ui/FileUploadBox.vue'
import {
  downloadEricResult,
  processEricFile,
  reconcileEricFiles,
} from './ericApi'
import {
  buildEricStats,
  ericWorkflowSteps,
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

const packFile = computed(() => packFiles.value[0] ?? null)
const yticFile = computed(() => yticFiles.value[0] ?? null)
const canReconcile = computed(() => Boolean(packFile.value && yticFile.value))

const stats = computed(() =>
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
  if (!packFile.value) {
    return failValidation('请上传 Pack Size breakdown 文件')
  }

  if (!isPackFile(packFile.value)) {
    return failValidation('Pack Size breakdown 仅支持 .xlsx / .xlsm')
  }

  return true
}

function validateYtic(): boolean {
  if (!yticFile.value) {
    return failValidation('请上传 YTIC check 文件')
  }

  if (!isYticFile(yticFile.value)) {
    return failValidation('YTIC check 仅支持 .xls / .xlsx / .xlsm')
  }

  return true
}

async function startReconcile(): Promise<void> {
  if (processing.value || !validatePack() || !validateYtic() || !packFile.value || !yticFile.value) {
    return
  }

  processing.value = true
  resetResultState()

  try {
    const response = await reconcileEricFiles(
      {
        packFile: packFile.value,
        yticFile: yticFile.value,
      },
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
  if (processing.value || !validatePack() || !packFile.value) {
    return
  }

  processing.value = true
  resetResultState()

  try {
    const response = await processEricFile(
      {
        excelFile: packFile.value,
      },
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
  successMessage: string,
  failureMessage: string,
): void {
  success.value = response.success
  message.value = response.message || (response.success ? successMessage : failureMessage)
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
  if (outputFile.value) {
    await downloadEricResult(outputFile.value)
  }
}
</script>

<style scoped>
.eric-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.eric-panel {
  display: grid;
  gap: 22px;
}

.eric-card {
  padding: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.eric-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eric-kicker,
.eric-title,
.eric-desc {
  margin: 0;
}

.eric-kicker {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.eric-title {
  color: #0f172a;
  font-size: 28px;
  line-height: 1.25;
}

.eric-desc {
  max-width: 920px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.eric-stage {
  flex: 0 0 auto;
  padding: 6px 12px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  background: #ecfdf5;
  border: 1px solid #99f6e4;
  border-radius: 999px;
}

.eric-alert {
  padding: 13px 16px;
  color: #075985;
  font-size: 14px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.eric-upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.eric-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.eric-step {
  min-width: 0;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.eric-step span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
}

.eric-step strong {
  display: block;
  margin: 7px 0 4px;
  color: #0f172a;
  font-size: 14px;
}

.eric-step p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.eric-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  margin-top: 24px;
}

.eric-btn {
  min-height: 40px;
  padding: 0 18px;
  color: #334155;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.eric-btn--primary {
  color: #ffffff;
  background: #2563eb;
  border-color: #1d4ed8;
}

.eric-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.eric-progress {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.eric-progress span {
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.eric-progress progress {
  width: 100%;
  height: 18px;
}

.eric-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.eric-stat {
  min-width: 0;
  padding: 15px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.eric-stat span {
  display: block;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.eric-stat strong {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eric-message {
  margin-top: 16px;
  padding: 13px 16px;
  color: #1e40af;
  font-size: 14px;
  background: #eff6ff;
  border-radius: 8px;
}

.eric-message--success {
  color: #15803d;
  background: #f0fdf4;
}

.eric-message--error {
  color: #dc2626;
  background: #fef2f2;
}

.eric-log {
  display: grid;
  gap: 7px;
  max-height: 260px;
  margin-top: 16px;
  overflow: auto;
}

.eric-log div {
  padding-bottom: 7px;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
  border-bottom: 1px solid #e2e8f0;
}

@media (max-width: 1100px) {
  .eric-steps,
  .eric-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .eric-hero,
  .eric-upload-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .eric-steps,
  .eric-summary {
    grid-template-columns: 1fr;
  }

  .eric-stage {
    justify-self: start;
    white-space: normal;
  }
}
</style>
