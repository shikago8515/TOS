<template>
  <section class="jane-page-container">
    <div class="jane-header">
      <div class="jane-header__title">
        <h2>{{ text('OUTBOUND核对') }}</h2>
        <p class="jane-header__subtitle">{{ text('T1 OUTBOUND × TMS 报表 → 出库差异核对') }}</p>
      </div>
      <div class="jane-header__stats">
        <div class="jane-stat">
          <div class="jane-stat__icon jane-stat__icon--teal">
            <AppIcon name="files" />
          </div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text('已选文件') }}</span>
            <span class="jane-stat__value">{{ totalFiles }}</span>
          </div>
        </div>
        <div class="jane-stat">
          <div class="jane-stat__icon jane-stat__icon--slate">
            <AppIcon name="clock" />
          </div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text('处理记录') }}</span>
            <span class="jane-stat__value">{{ historyRecords.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="jane-toolbar">
      <span class="jane-toolbar__status">{{ toolbarStatus }}</span>
      <div class="jane-toolbar__actions">
        <button class="jane-toolbar__btn" type="button" :disabled="processing" @click="resetForm">
          <AppIcon name="refresh-cw" />
          {{ text('重置') }}
        </button>
        <button
          class="jane-toolbar__btn jane-toolbar__btn--primary"
          type="button"
          :disabled="!canProcess || processing"
          @click="startProcess"
        >
          <AppIcon :name="processing ? 'loader' : 'target'" />
          {{ processing ? text('处理中...') : text('开始核对') }}
        </button>
      </div>
    </div>

    <div class="jane-grid">
      <div class="jane-main">
        <section class="jane-section">
          <div class="jane-section__head">
            <h3>
              <AppIcon name="radar" />
              {{ text('文件上传') }}
            </h3>
            <span class="jane-section__badge">
              <AppIcon name="check-circle" />
              {{ text('2 组必传') }}
            </span>
          </div>

          <div class="jane-upload-grid">
            <FileUploadBox
              v-model:files="outboundFiles"
              :label="text('T1 OUTBOUND 文件')"
              :hint="text('输出会保留原表样式并标红差异')"
              accept=".xlsx,.xlsm"
              :accept-label="text('支持 .xlsx / .xlsm')"
            />
            <FileUploadBox
              v-model:files="tmsFiles"
              :label="text('Copy of TMS')"
              :hint="text('包含 Result Set 的 TMS 报表')"
              accept=".xlsx,.xlsm"
              :accept-label="text('支持 .xlsx / .xlsm')"
            />
          </div>

          <div v-if="processing" class="jane-progress">
            <div class="jane-progress__label">
              <strong>
                <AppIcon name="activity" />
                {{ text('核对进度') }}
              </strong>
              <span>{{ progress }}%</span>
            </div>
            <div class="jane-progress__track">
              <div class="jane-progress__fill" :style="{ width: `${progress}%` }" />
            </div>
          </div>

          <ResultSummary :items="summaryItems" :status="success ? 'success' : 'error'" />

          <section
            v-if="message"
            class="jane-alert"
            :class="success ? 'jane-alert--success' : 'jane-alert--error'"
          >
            <p>
              <AppIcon :name="success ? 'check-circle' : 'alert-circle'" />
              {{ text(message) }}
            </p>
            <button v-if="success && resultFile" class="jane-alert__btn" type="button" @click="downloadResult">
              <AppIcon name="download" />
              {{ text('下载结果文件') }}
            </button>
          </section>
        </section>
      </div>

      <div class="jane-side">
        <FilePrecheckPanel :groups="fileGroups" />
        <ProcessHistoryPanel :records="historyRecords" @clear="clearHistory" />
      </div>
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
import AppIcon from '../../shared/ui/AppIcon.vue'
import FilePrecheckPanel from '../../shared/ui/FilePrecheckPanel.vue'
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
const totalFiles = computed(() => outboundFiles.value.length + tmsFiles.value.length)
const toolbarStatus = computed(() => {
  const readyCount = fileGroups.value.filter((g) => g.files.length > 0).length
  return `${text('已就绪')} ${readyCount}/2 ${text('组文件')}，${text('当前共')} ${totalFiles.value} ${text('个文件')}`
})

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

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
