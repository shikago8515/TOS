<template>
  <section class="jane-section">
    <div class="jane-section__head">
      <h3>
        <AppIcon v-if="titleIcon" :name="titleIcon" />
        {{ text(title) }}
      </h3>
      <span v-if="badge" class="jane-section__badge">
        <AppIcon v-if="badgeIcon" :name="badgeIcon" />
        {{ text(badge) }}
      </span>
    </div>

    <div class="jane-upload-grid" :class="{ 'jane-upload-grid--1': fields.length === 1 }">
      <FileUploadBox
        v-for="field in fields"
        :key="field.id"
        :files="field.files"
        :label="field.label"
        :hint="field.hint"
        :multiple="field.multiple"
        :required="field.required"
        :accept="field.accept"
        :accept-label="field.acceptLabel"
        @update:files="$emit('update:files', field.id, $event)"
      />
    </div>

    <slot name="after-fields" />

    <div v-if="processing" class="jane-progress">
      <div class="jane-progress__label">
        <strong>
          <AppIcon name="activity" />
          {{ text(progressLabel) }}
        </strong>
        <span>{{ progress }}%</span>
      </div>
      <div class="jane-progress__track">
        <div class="jane-progress__fill" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { useAppLanguage } from '../../i18n/appLanguage'
import AppIcon from '../AppIcon.vue'
import FileUploadBox from '../FileUploadBox.vue'
import type { ExcelFileField } from './types'

withDefaults(
  defineProps<{
    fields: ExcelFileField[]
    processing: boolean
    progress: number
    title?: string
    titleIcon?: string
    badge?: string
    badgeIcon?: string
    progressLabel?: string
  }>(),
  {
    title: '文件上传',
    titleIcon: 'download-cloud',
    badge: '',
    badgeIcon: 'check-circle',
    progressLabel: '处理进度',
  },
)

defineEmits<{
  'update:files': [fieldId: string, files: File[]]
}>()

const { text } = useAppLanguage()
</script>
