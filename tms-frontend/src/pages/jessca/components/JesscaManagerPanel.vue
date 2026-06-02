<template>
  <div class="jane-grid">
    <div class="jane-main">
      <section class="jane-section">
        <div class="jane-section__head">
          <h3>{{ text('文件上传') }}</h3>
          <span class="jane-section__badge">{{ text('2 组必传') }}</span>
        </div>

        <div class="jane-upload-grid">
          <FileUploadBox
            :files="invoiceFiles"
            label="发票文件（可多选）"
            hint="上传一张或多张发票文件"
            multiple
            @update:files="$emit('update:invoiceFiles', $event)"
          />
          <FileUploadBox
            :files="referenceFiles"
            label="参考表文件"
            hint="上传 1 个参考表文件"
            @update:files="$emit('update:referenceFiles', $event)"
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

        <ResultSummary
          v-if="summaryItems.length > 0"
          :items="summaryItems"
          :status="success ? 'success' : 'error'"
        />
      </section>
    </div>

    <div class="jane-side">
      <FilePrecheckPanel :groups="fileGroups" />
      <ProcessHistoryPanel :records="historyRecords" @clear="$emit('clear-history')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileGroupState } from '../../../shared/files/fileGroups'
import type { ProcessHistoryRecord, ProcessSummaryItem } from '../../../shared/process/processHistory'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import FilePrecheckPanel from '../../../shared/ui/FilePrecheckPanel.vue'
import FileUploadBox from '../../../shared/ui/FileUploadBox.vue'
import ProcessHistoryPanel from '../../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../../shared/ui/ResultSummary.vue'

defineEmits<{
  (e: 'update:invoiceFiles', files: File[]): void
  (e: 'update:referenceFiles', files: File[]): void
  (e: 'clear-history'): void
}>()

defineProps<{
  invoiceFiles: File[]
  referenceFiles: File[]
  fileGroups: FileGroupState[]
  processing: boolean
  progress: number
  success: boolean
  summaryItems: ProcessSummaryItem[]
  historyRecords: ProcessHistoryRecord[]
}>()

const { text } = useAppLanguage()
</script>
