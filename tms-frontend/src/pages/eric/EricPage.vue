<template>
  <section class="eric-page">
    <div class="eric-panel">
      <section class="eric-card">
        <div class="eric-header">
          <div>
            <p class="eric-kicker">Excel 处理</p>
            <h2 class="eric-title">Excel数据处理整合工具-Eric</h2>
            <p class="eric-desc">
              将 PO Number1 / Article Number1 辅助列填充、PO 区块拆分和尺码列逆透视整合到 Final_Data 工作表。
            </p>
          </div>
          <span class="eric-stage">测试版 v0.1.2-alpha.1</span>
        </div>
      </section>

      <div class="eric-alert">
        测试阶段：请用 Eric 现有样例文件试跑，记录失败样例和期望输出后再转正式模块。
      </div>

      <section class="eric-card">
        <div class="eric-upload-grid">
          <div class="upload-column">
            <label
              class="eric-upload"
              :class="{ 'eric-upload--dragging': dragging, 'eric-upload--selected': selectedFile }"
              @dragover.prevent="dragging = true"
              @dragleave="dragging = false"
              @drop.prevent="handleDrop"
            >
              <input
                type="file"
                accept=".xlsx,.xlsm"
                @change="handleInput"
              />
              <span>
                <strong>{{ selectedFile ? '已选择文件' : '点击上传 Excel' }}</strong>
                <small>支持 .xlsx / .xlsm</small>
              </span>
            </label>

            <div v-if="selectedFile" class="eric-file">
              <div>
                <strong>{{ selectedFile.name }}</strong>
                <span>{{ formatFileSize(selectedFile.size) }}</span>
              </div>
              <button type="button" aria-label="移除文件" @click="removeFile">×</button>
            </div>
          </div>

          <div class="eric-steps">
            <article v-for="step in ericWorkflowSteps" :key="step.index" class="eric-step">
              <span>{{ step.index }}</span>
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </article>
          </div>
        </div>

        <div class="eric-actions">
          <button
            class="eric-btn eric-btn--primary"
            type="button"
            :disabled="!selectedFile || processing"
            @click="startProcess"
          >
            {{ processing ? '处理中...' : '开始处理' }}
          </button>
          <button class="eric-btn" type="button" @click="resetForm">重置</button>
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
import { formatFileSize } from '../../shared/files/fileGroups'
import {
  downloadEricResult,
  processEricFile,
} from './ericApi'
import {
  buildEricStats,
  ericWorkflowSteps,
  readEricRowCount,
} from './ericModel'

const selectedFile = ref<File | null>(null)
const dragging = ref(false)
const processing = ref(false)
const progress = ref(0)
const success = ref<boolean | null>(null)
const message = ref('')
const logs = ref<string[]>([])
const outputFile = ref('')
const rowCount = ref('-')

const stats = computed(() =>
  buildEricStats({
    hasFile: Boolean(selectedFile.value),
    processing: processing.value,
    success: success.value,
    rowCount: rowCount.value,
    outputFile: outputFile.value,
  }),
)

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  input.value = ''
  setSelectedFile(file)
}

function handleDrop(event: DragEvent): void {
  dragging.value = false
  setSelectedFile(event.dataTransfer?.files?.[0] ?? null)
}

function setSelectedFile(file: File | null): void {
  if (file && !/\.(xlsx|xlsm)$/i.test(file.name)) {
    selectedFile.value = null
    success.value = false
    message.value = '请选择 .xlsx / .xlsm Excel 文件'
    outputFile.value = ''
    rowCount.value = '-'
    logs.value = [message.value]
    return
  }

  selectedFile.value = file
  success.value = null
  message.value = ''
  outputFile.value = ''
  rowCount.value = '-'
  logs.value = []
}

function removeFile(): void {
  setSelectedFile(null)
}

async function startProcess(): Promise<void> {
  if (!selectedFile.value || processing.value) {
    return
  }

  processing.value = true
  progress.value = 0
  success.value = null
  message.value = ''
  logs.value = []
  outputFile.value = ''
  rowCount.value = '-'

  try {
    const response = await processEricFile(
      {
        excelFile: selectedFile.value,
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    message.value = response.message || (response.success ? '处理完成' : '处理失败')
    logs.value = Array.isArray(response.logs) ? response.logs : []
    outputFile.value = response.output_file ?? ''
    rowCount.value = readEricRowCount(response)
  } catch (error) {
    success.value = false
    message.value = readErrorMessage(error, '处理失败')
    logs.value = [message.value]
  } finally {
    processing.value = false
  }
}

function resetForm(): void {
  selectedFile.value = null
  dragging.value = false
  processing.value = false
  progress.value = 0
  success.value = null
  message.value = ''
  logs.value = []
  outputFile.value = ''
  rowCount.value = '-'
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

.eric-header {
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
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.eric-stage {
  flex: 0 0 auto;
  padding: 6px 12px;
  color: #ea580c;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
}

.eric-alert {
  padding: 13px 16px;
  color: #c2410c;
  font-size: 14px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.eric-upload-grid {
  display: grid;
  grid-template-columns: minmax(280px, 480px) 1fr;
  gap: 18px;
}

.upload-column {
  display: grid;
  align-content: start;
  gap: 12px;
}

.eric-upload {
  display: grid;
  min-height: 176px;
  padding: 22px;
  color: #1d4ed8;
  text-align: center;
  cursor: pointer;
  background: #eff6ff;
  border: 2px dashed #93c5fd;
  border-radius: 8px;
  place-items: center;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.eric-upload:hover,
.eric-upload--dragging,
.eric-upload--selected {
  background: #dbeafe;
  border-color: #2563eb;
}

.eric-upload input {
  display: none;
}

.eric-upload strong {
  display: block;
  margin-bottom: 8px;
  color: #0f172a;
  font-size: 17px;
}

.eric-upload small {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.eric-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.eric-file strong {
  display: block;
  max-width: 360px;
  margin-bottom: 3px;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eric-file span {
  color: #64748b;
  font-size: 12px;
}

.eric-file button {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  color: #94a3b8;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.eric-file button:hover {
  color: #dc2626;
}

.eric-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.eric-step {
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
  background: #409eff;
  border-color: #2563eb;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

@media (max-width: 900px) {
  .eric-header,
  .eric-upload-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .eric-steps,
  .eric-summary {
    grid-template-columns: 1fr;
  }
}
</style>
