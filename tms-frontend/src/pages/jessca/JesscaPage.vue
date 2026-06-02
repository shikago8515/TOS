<template>
  <section class="jane-page-container">
    <div class="jane-header">
      <div class="jane-header__title">
        <h2>{{ text('对账核对') }}</h2>
      </div>
      <div class="jane-header__stats">
        <div class="jane-stat">
          <div class="jane-stat__icon jane-stat__icon--blue">
            <AppIcon name="files" />
          </div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text('已选文件') }}</span>
            <span class="jane-stat__value">{{ totalSelectedCount }}</span>
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
          {{ text('重置') }}
        </button>
        <button
          v-if="success && resultFile"
          class="jane-toolbar__btn"
          type="button"
          @click="downloadResult"
        >
          {{ text('下载结果') }}
        </button>
        <button
          class="jane-toolbar__btn jane-toolbar__btn--primary"
          type="button"
          :disabled="!canProcess || processing"
          @click="startProcess"
        >
          {{ processing ? text('核对中...') : text('开始核对') }}
        </button>
      </div>
    </div>

    <div v-if="message" class="jane-alert" :class="`jane-alert--${messageTone}`">
      <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'activity'" />
      <span>{{ message }}</span>
    </div>

    <JesscaManagerPanel
      :invoice-files="invoiceFiles"
      :reference-files="referenceFiles"
      :file-groups="fileGroups"
      :processing="processing"
      :progress="progress"
      :success="success"
      :summary-items="summaryItems"
      :history-records="historyRecords"
      @update:invoice-files="invoiceFiles = $event"
      @update:reference-files="referenceFiles = $event"
      @clear-history="clearHistory"
    />
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
import JesscaManagerPanel from './components/JesscaManagerPanel.vue'
import { downloadJesscaResult, processJesscaFiles } from './jesscaApi'
import { buildJesscaSummary, jesscaModuleId, jesscaModuleName } from './jesscaModel'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'

const invoiceFiles = ref<File[]>([])
const referenceFiles = ref<File[]>([])
const processing = ref(false)
const progress = ref(0)
const message = ref('')
const success = ref(false)
const resultFile = ref('')
const summaryItems = ref<ProcessSummaryItem[]>([])
const historyRecords = ref<ProcessHistoryRecord[]>(loadModuleHistory(jesscaModuleId))
const messageTone = ref<NoticeTone>('info')
const { text } = useAppLanguage()

const fileGroups = computed<FileGroupState[]>(() => [
  {
    label: '发票文件',
    files: invoiceFiles.value,
    required: true,
    multiple: true,
  },
  {
    label: '参考表文件',
    files: referenceFiles.value,
    required: true,
    multiple: false,
    expectedCount: 1,
  },
])

const canProcess = computed(() => areRequiredFilesReady(fileGroups.value))
const readyGroupCount = computed(
  () => fileGroups.value.filter((group) => group.files.length > 0).length,
)
const totalSelectedCount = computed(
  () => invoiceFiles.value.length + referenceFiles.value.length,
)
const toolbarStatus = computed(
  () => `${text('已就绪')} ${readyGroupCount.value}/2 ${text('组文件')}，${text('当前共')} ${totalSelectedCount.value} ${text('个文件')}`,
)

async function startProcess(): Promise<void> {
  if (!canProcess.value || !referenceFiles.value[0]) {
    messageTone.value = 'warning'
    message.value = '请先补齐必传文件，再开始核对。'
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
    const response = await processJesscaFiles(
      {
        invoiceFiles: invoiceFiles.value,
        referenceFile: referenceFiles.value[0],
      },
      (nextProgress) => {
        progress.value = nextProgress
      },
    )

    success.value = response.success
    resultFile.value = response.result_file ?? response.output_file ?? ''
    messageTone.value = response.success ? 'success' : 'error'
    message.value = response.error ? `${response.message} - ${response.error}` : response.message
    summaryItems.value = buildJesscaSummary(response, invoiceFiles.value.length)
    recordHistory(response.success ? 'success' : 'error', startedAt, inputFiles)
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
    await downloadJesscaResult(resultFile.value)
  }
}

function resetForm(): void {
  invoiceFiles.value = []
  referenceFiles.value = []
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
): void {
  historyRecords.value = appendModuleHistory({
    moduleId: jesscaModuleId,
    moduleName: jesscaModuleName,
    status,
    durationMs: Date.now() - startedAt,
    message: message.value || (status === 'success' ? '处理完成' : '处理失败'),
    inputFiles,
    outputFile: resultFile.value,
    summary: summaryItems.value,
  })
}

function clearHistory(): void {
  clearModuleHistory(jesscaModuleId)
  historyRecords.value = []
}
</script>

<style lang="scss">
@use '../../shared/styles/jane-page.scss';
</style>
