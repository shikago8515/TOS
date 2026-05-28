<template>
  <section class="jane-outbound-compare-page">
    <div class="card-section">
      <h2 class="section-title">{{ text('Jane-OUTBOUND核对') }}</h2>
      <p class="section-desc">
        {{
          text(
            '上传 T1 OUTBOUND.xlsx 和 Copy of TMS 报表，按 Style/PO/Line/Factory 核对数量、PODD 和 Working Number。',
          )
        }}
      </p>

      <FileRequirementGuide owner="Jane-OUTBOUND核对" mode="compact" />
      <FilePrecheckPanel :groups="fileGroups" />

      <div class="upload-grid">
        <FileUploadBox
          v-model:files="outboundFiles"
          :label="text('T1 OUTBOUND 文件')"
          :hint="text('上传 1 个 T1 OUTBOUND.xlsx，输出会保留原表样式并标红差异。')"
          accept=".xlsx,.xlsm"
          :accept-label="text('支持 .xlsx / .xlsm')"
        />
        <FileUploadBox
          v-model:files="tmsFiles"
          :label="text('Copy of TMS')"
          :hint="text('上传 1 个包含 Result Set 的 Copy of TMS 报表。')"
          accept=".xlsx,.xlsm"
          :accept-label="text('支持 .xlsx / .xlsm')"
        />
      </div>

      <div class="action-row">
        <button
          class="primary-action"
          type="button"
          :disabled="!canProcess || processing"
          @click="startProcess"
        >
          {{ processing ? text('处理中...') : text('开始处理') }}
        </button>
        <button class="secondary-action" type="button" @click="resetForm">
          {{ text('重置') }}
        </button>
      </div>

      <div v-if="processing" class="progress-block">
        <span class="progress-label">{{ text('上传进度') }} {{ progress }}%</span>
        <progress :value="progress" max="100" />
      </div>

      <ResultSummary :items="summaryItems" :status="success ? 'success' : 'error'" />

      <section
        v-if="message"
        class="result-alert"
        :class="success ? 'result-alert--success' : 'result-alert--error'"
      >
        <p>{{ text(message) }}</p>
        <button v-if="success && resultFile" type="button" @click="downloadResult">
          {{ text('下载结果文件') }}
        </button>
      </section>

      <ProcessHistoryPanel :records="historyRecords" @clear="clearHistory" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { readErrorMessage } from '../../shared/api/backendClient'
import {
  areRequiredFilesReady,
  serializeInputFiles,
  type FileGroupState,
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
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
import FileRequirementGuide from '../../shared/ui/FileRequirementGuide.vue'
import FileUploadBox from '../../shared/ui/FileUploadBox.vue'
import ProcessHistoryPanel from '../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../shared/ui/ResultSummary.vue'
import {
  downloadJaneOutboundCompareResult,
  processJaneOutboundCompareFiles,
} from './janeOutboundCompareApi'
import {
  buildJaneOutboundCompareSummary,
  janeOutboundCompareModuleId,
  janeOutboundCompareModuleName,
} from './janeOutboundCompareModel'

const outboundFiles = ref<File[]>([])
const tmsFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(
  loadModuleHistory(janeOutboundCompareModuleId),
)
const { text } = useAppLanguage()

const fileGroups = computed<FileGroupState[]>(() => [
  {
    label: 'T1 OUTBOUND 文件',
    files: outboundFiles.value,
    required: true,
    multiple: false,
    expectedCount: 1,
  },
  {
    label: 'Copy of TMS',
    files: tmsFiles.value,
    required: true,
    multiple: false,
    expectedCount: 1,
  },
])

const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))

async function startProcess(): Promise<void> {
  if (!canProcess.value || !outboundFiles.value[0] || !tmsFiles.value[0]) {
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
    const response = await processJaneOutboundCompareFiles(
      {
        outboundFile: outboundFiles.value[0],
        tmsFile: tmsFiles.value[0],
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
    summaryItems.value = buildJaneOutboundCompareSummary(response, {
      outbound: outboundFiles.value.length,
      tms: tmsFiles.value.length,
    })
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
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
    await downloadJaneOutboundCompareResult(resultFile.value)
  }
}

function resetForm(): void {
  outboundFiles.value = []
  tmsFiles.value = []
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
): void {
  historyRecords.value = appendModuleHistory({
    moduleId: janeOutboundCompareModuleId,
    moduleName: janeOutboundCompareModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(janeOutboundCompareModuleId)
  historyRecords.value = []
}
</script>

<style scoped>
.jane-outbound-compare-page {
  max-width: 1120px;
  margin: 0 auto;
}

.card-section {
  padding: 28px;
  background: #ffffff;
  border: 1px solid #dbe5ee;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(23, 42, 63, 0.08);
}

.section-title,
.section-desc {
  margin: 0;
}

.section-title {
  color: #172033;
  font-size: 24px;
  font-weight: 800;
}

.section-desc {
  max-width: 820px;
  margin-top: 8px;
  margin-bottom: 22px;
  color: #64748b;
  line-height: 1.65;
}

.upload-grid {
  display: grid;
  align-items: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.action-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}

.primary-action,
.secondary-action,
.result-alert button {
  min-height: 40px;
  padding: 0 18px;
  font-weight: 800;
  cursor: pointer;
  border-radius: 7px;
}

.primary-action {
  color: #ffffff;
  background: #2563eb;
  border: 1px solid #1d4ed8;
}

.primary-action:disabled {
  cursor: not-allowed;
  background: #9eb6e7;
  border-color: #9eb6e7;
}

.secondary-action {
  color: #475569;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}

.progress-block {
  display: grid;
  gap: 8px;
  margin-top: 24px;
}

.progress-label {
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

progress {
  width: 100%;
  height: 18px;
}

.result-alert {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 8px;
}

.result-alert p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.result-alert--success {
  color: #14532d;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.result-alert--error {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.result-alert button {
  justify-self: start;
  color: #ffffff;
  background: #1d6fa7;
  border: 1px solid #185782;
}

@media (max-width: 860px) {
  .upload-grid {
    grid-template-columns: 1fr;
  }
}
</style>
