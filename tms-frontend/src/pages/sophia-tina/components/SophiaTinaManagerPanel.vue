<template>
  <div class="excel-process-panel">
    <div class="excel-process-grid">
      <div class="excel-process-main">
        <section class="excel-panel-section">
          <div class="section-head">
            <div>
              <h3>文件上传</h3>
            </div>
            <span class="section-badge">4 组必传</span>
          </div>

          <div class="upload-grid upload-grid--4">
            <FileUploadBox
              :files="tmsFiles"
              label="TMS 文件（可多选）"
              hint="上传一个或多个 TMS 文件"
              multiple
              @update:files="$emit('update:tmsFiles', $event)"
            />
            <FileUploadBox
              :files="articleFiles"
              label="Article 文件（可多选）"
              hint="上传一个或多个 Article 文件"
              multiple
              @update:files="$emit('update:articleFiles', $event)"
            />
            <FileUploadBox
              :files="priceFiles"
              label="Factory Price 文件（可多选）"
              hint="上传一个或多个 Factory Price 文件"
              multiple
              @update:files="$emit('update:priceFiles', $event)"
            />
            <FileUploadBox
              :files="packFiles"
              label="Pack 文件（可多选）"
              hint="上传一个或多个 Pack 文件"
              multiple
              @update:files="$emit('update:packFiles', $event)"
            />
          </div>
        </section>

        <section v-if="processing" class="excel-panel-section excel-panel-section--compact">
          <div class="progress-row">
            <strong>处理进度</strong>
            <span>{{ progress }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
        </section>

        <ResultSummary
          v-if="summaryItems.length > 0"
          :items="summaryItems"
          :status="success ? 'success' : 'error'"
        />
      </div>

      <div class="excel-process-side">
        <FilePrecheckPanel :groups="fileGroups" />
        <ProcessHistoryPanel :records="historyRecords" @clear="$emit('clear-history')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileGroupState } from '../../../shared/files/fileGroups'
import type { ProcessHistoryRecord, ProcessSummaryItem } from '../../../shared/process/processHistory'
import FilePrecheckPanel from '../../../shared/ui/FilePrecheckPanel.vue'
import FileUploadBox from '../../../shared/ui/FileUploadBox.vue'
import ProcessHistoryPanel from '../../../shared/ui/ProcessHistoryPanel.vue'
import ResultSummary from '../../../shared/ui/ResultSummary.vue'

defineEmits<{
  (e: 'update:tmsFiles', files: File[]): void
  (e: 'update:articleFiles', files: File[]): void
  (e: 'update:priceFiles', files: File[]): void
  (e: 'update:packFiles', files: File[]): void
  (e: 'clear-history'): void
}>()

defineProps<{
  tmsFiles: File[]
  articleFiles: File[]
  priceFiles: File[]
  packFiles: File[]
  fileGroups: FileGroupState[]
  processing: boolean
  progress: number
  success: boolean
  summaryItems: ProcessSummaryItem[]
  historyRecords: ProcessHistoryRecord[]
}>()
</script>

<style lang="scss">
@use '../../../shared/styles/excel-process-panel.scss';
</style>
