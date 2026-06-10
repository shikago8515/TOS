<template>
  <section class="file-upload-box">
    <div class="upload-label-row">
      <strong>{{ text(label) }}</strong>
      <span v-if="required" class="upload-badge">{{ text('必传') }}</span>
    </div>

    <p v-if="hint" class="upload-hint">{{ text(hint) }}</p>
    <p v-if="validationMessage" class="upload-error">{{ text(validationMessage) }}</p>

    <label
      class="upload-dropzone"
      :class="{
        'upload-dropzone--has-files': files.length > 0,
        'upload-dropzone--dragging': isDragging,
      }"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input
        type="file"
        :accept="accept"
        :multiple="multiple"
        @change="handleInput"
      />
      <div class="upload-icon-wrap" :class="{ 'upload-icon-wrap--active': files.length > 0 }">
        <AppIcon :name="files.length > 0 ? 'check-circle' : 'download-cloud'" />
      </div>
      <span class="upload-main">
        {{ files.length > 0 ? text(`${files.length} 个文件已选择`) : text('点击或拖入文件') }}
      </span>
      <span class="upload-sub">{{ text(acceptLabel) }}</span>
      <div v-if="isDragging" class="upload-drag-overlay">
        <AppIcon name="download" />
        <span>{{ text('释放文件') }}</span>
      </div>
    </label>

    <TransitionGroup name="file-list" tag="ul" v-if="files.length > 0" class="selected-files">
      <li v-for="(file, index) in files" :key="`${file.name}-${file.lastModified}`">
        <span class="file-index">{{ index + 1 }}</span>
        <span class="file-meta">
          <strong>{{ file.name }}</strong>
          <small>{{ formatFileSize(file.size) }}</small>
        </span>
        <button type="button" :aria-label="text('移除文件')" @click="removeFile(file)">
          <AppIcon name="stop-circle" />
        </button>
      </li>
    </TransitionGroup>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { filterAcceptedFiles } from '../files/fileAcceptance'
import { formatFileSize } from '../files/fileGroups'
import { useAppLanguage } from '../i18n/appLanguage'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    files: File[]
    label: string
    hint?: string
    multiple?: boolean
    required?: boolean
    accept?: string
    acceptLabel?: string
  }>(),
  {
    hint: '',
    multiple: false,
    required: true,
    accept: '.xlsx,.xls',
    acceptLabel: '支持 .xls / .xlsx',
  },
)

const emit = defineEmits<{
  'update:files': [files: File[]]
}>()

const { text } = useAppLanguage()
const isDragging = ref(false)
const validationMessage = ref('')

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const nextFiles = Array.from(input.files ?? [])
  applySelectedFiles(nextFiles)
  input.value = ''
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false
  const nextFiles = Array.from(event.dataTransfer?.files ?? [])
  applySelectedFiles(nextFiles)
}

function removeFile(file: File): void {
  validationMessage.value = ''
  emit('update:files', props.files.filter((entry) => entry !== file))
}

function applySelectedFiles(files: File[]): void {
  const { accepted, rejectedNames } = filterAcceptedFiles(files, props.accept)

  validationMessage.value =
    rejectedNames.length > 0
      ? `不支持的文件格式：${rejectedNames.join('、')}`
      : ''

  if (accepted.length === 0) {
    return
  }

  emit('update:files', props.multiple ? accepted : accepted.slice(0, 1))
}
</script>

<style scoped>
.file-upload-box {
  display: grid;
  align-self: start;
  align-content: start;
  gap: 10px;
  min-width: 0;
  animation: fadeSlideUp 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.upload-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.upload-label-row strong {
  color: #1e293b;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.upload-badge {
  padding: 4px 12px;
  color: #0d9488;
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, #f0fdfa, #ecfdf5);
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  letter-spacing: 0.3px;
}

.upload-hint {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.upload-error {
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

/* --- Dropzone --- */
.upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 24px 20px;
  cursor: pointer;
  background: linear-gradient(135deg, #fafcff, #f8fafc);
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
  position: relative;
  overflow: hidden;
}

.upload-dropzone::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 120%, rgba(13, 148, 136, 0.06), transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.upload-dropzone:hover::before {
  opacity: 1;
}

.upload-dropzone:hover {
  border-color: #5eead4;
  background: linear-gradient(135deg, #f0fdfa, #f0fdf4);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(13, 148, 136, 0.08);
}

.upload-dropzone--has-files {
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border-color: #86efac;
  border-style: solid;
}

.upload-dropzone--has-files:hover {
  border-color: #34d399;
  box-shadow: 0 4px 16px rgba(5, 150, 105, 0.1);
}

.upload-dropzone--dragging {
  border-color: #0d9488;
  background: linear-gradient(135deg, #f0fdfa, #ccfbf1);
  border-style: solid;
  transform: scale(1.02);
  box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.1);
}

input {
  display: none;
}

/* --- Icon --- */
.upload-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: #ffffff;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
  position: relative;
  z-index: 1;
}

.upload-icon-wrap .app-icon {
  width: 24px;
  height: 24px;
}

.upload-icon-wrap--active {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
  border-radius: 50%;
}

.upload-dropzone:hover .upload-icon-wrap {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 8px 20px rgba(13, 148, 136, 0.3);
}

.upload-main {
  margin-top: 14px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  position: relative;
  z-index: 1;
}

.upload-sub {
  margin-top: 6px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* --- Drag Overlay --- */
.upload-drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(240, 253, 250, 0.92);
  backdrop-filter: blur(4px);
  z-index: 10;
  border-radius: 14px;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.upload-drag-overlay .app-icon {
  width: 32px;
  height: 32px;
  color: #0d9488;
  animation: bounce 0.6s ease infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-6px); }
}

.upload-drag-overlay span {
  color: #0d9488;
  font-size: 14px;
  font-weight: 700;
}

/* --- File List --- */
.selected-files {
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
  padding: 0;
  margin: 0;
  list-style: none;
  scrollbar-gutter: stable;
}

.selected-files li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 50px;
  padding: 10px 14px;
  background: #ffffff;
  border: 1px solid #e8eef3;
  border-radius: 12px;
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.selected-files li:hover {
  background: #f0fdfa;
  border-color: #99f6e4;
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.06);
}

.file-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0fdfa, #ecfdf5);
  color: #0d9488;
  font-size: 11px;
  font-weight: 800;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid #ccfbf1;
}

.file-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.file-meta strong {
  overflow: hidden;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta small {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}

button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  color: #cbd5e1;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

button .app-icon {
  width: 16px;
  height: 16px;
}

.selected-files li:hover button {
  color: #94a3b8;
}

button:hover {
  color: #ef4444 !important;
  background: #fef2f2;
}

/* --- Transition Group --- */
.file-list-enter-active {
  transition: all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.file-list-leave-active {
  transition: all 0.2s ease;
}

.file-list-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.file-list-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.file-list-move {
  transition: transform 0.3s ease;
}
</style>
