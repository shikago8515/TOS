<template>
  <section class="file-upload-box">
    <div class="upload-label-row">
      <strong>{{ label }}</strong>
      <span v-if="required" class="upload-badge">必传</span>
    </div>

    <p v-if="hint" class="upload-hint">{{ hint }}</p>

    <label
      class="upload-dropzone"
      :class="{ 'upload-dropzone--has-files': files.length > 0 }"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <input
        type="file"
        :accept="accept"
        :multiple="multiple"
        @change="handleInput"
      />
      <span class="upload-icon" aria-hidden="true">{{ files.length > 0 ? '✓' : '+' }}</span>
      <span class="upload-main">
        {{ files.length > 0 ? `${files.length} 个文件已选择` : '点击或拖入文件' }}
      </span>
      <span class="upload-sub">{{ acceptLabel }}</span>
    </label>

    <ul v-if="files.length > 0" class="selected-files">
      <li v-for="file in files" :key="`${file.name}-${file.lastModified}`">
        <span class="file-meta">
          <strong>{{ file.name }}</strong>
          <small>{{ formatFileSize(file.size) }}</small>
        </span>
        <button type="button" aria-label="移除文件" @click="removeFile(file)">×</button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { formatFileSize } from '../files/fileGroups'

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

function handleInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const nextFiles = Array.from(input.files ?? [])
  emit('update:files', props.multiple ? nextFiles : nextFiles.slice(0, 1))
  input.value = ''
}

function handleDrop(event: DragEvent): void {
  const nextFiles = Array.from(event.dataTransfer?.files ?? [])
  emit('update:files', props.multiple ? nextFiles : nextFiles.slice(0, 1))
}

function removeFile(file: File): void {
  emit('update:files', props.files.filter((entry) => entry !== file))
}
</script>

<style scoped>
.file-upload-box {
  display: grid;
  align-self: start;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.upload-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.upload-label-row strong {
  color: #303846;
  font-size: 14px;
}

.upload-badge {
  padding: 4px 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
}

.upload-hint {
  margin: 0;
  color: #687789;
  font-size: 12px;
}

.upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 138px;
  padding: 18px;
  cursor: pointer;
  background: #ffffff;
  border: 2px dashed #cfd9e3;
  border-radius: 8px;
}

.upload-dropzone:hover {
  border-color: #75a9d5;
  background: #f7fbff;
}

.upload-dropzone--has-files {
  background: #f0f9eb;
  border-color: #67c23a;
}

input {
  display: none;
}

.upload-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #1f7a5d;
  font-size: 20px;
  font-weight: 900;
  background: #e5f5ef;
  border-radius: 999px;
}

.upload-main {
  margin-top: 10px;
  color: #475569;
  font-size: 14px;
  font-weight: 800;
}

.upload-sub {
  margin-top: 4px;
  color: #8a98a8;
  font-size: 12px;
}

.selected-files {
  display: grid;
  gap: 6px;
  max-height: 232px;
  overflow: auto;
  padding: 0;
  margin: 0;
  list-style: none;
  scrollbar-gutter: stable;
}

.selected-files li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #e6edf4;
  border-radius: 8px;
}

.file-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.file-meta strong {
  overflow: hidden;
  color: #172033;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta small {
  color: #8a98a8;
  font-size: 12px;
}

button {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  color: #8a98a8;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  background: transparent;
  border: 0;
}

button:hover {
  color: #dc2626;
}
</style>
