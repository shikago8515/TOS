<template>
  <section class="workbench-col workbench-col--right">
    <!-- 3. Focus PO Matching and Generation Card -->
    <article class="card card--focus">
      <div class="card-glow-bar card-glow-bar--green" />
      <header class="card-header">
        <div class="card-heading">
          <div class="card-icon card-icon--green">
            <AppIcon name="check-circle" />
          </div>
          <div>
            <h2>PO PDF 匹配与生成</h2>
            <p>上传 PO PDF，一键生成重排后的最终文件</p>
          </div>
        </div>
        <span class="badge success">{{ poPagesSize }} 个PO</span>
      </header>

      <div class="card-body">
        <div class="field-label">
          <span>PO 原始文件 PDF</span>
          <small>{{ poPagesSize }} 个已识别 PO</small>
        </div>
        <label
          class="dropzone"
          :class="{ 'has-file': Boolean(poFile), dragging: localDraggingTarget === 'po' }"
          @dragenter.prevent="localDraggingTarget = 'po'"
          @dragover.prevent
          @dragleave.prevent="localDraggingTarget = null"
          @drop.prevent="onPoFileDrop"
        >
          <input
            :key="poInputKey"
            type="file"
            accept="application/pdf,.pdf"
            @change="onPoFileChange"
          >
          <template v-if="poFile">
            <div class="dropzone-file-capsule">
              <AppIcon name="file" class="file-icon-pulse" />
              <div class="file-info">
                <strong class="file-name" :title="poFile.name">{{ poFile.name }}</strong>
                <span class="file-size">{{ formatFileSize(poFile.size) }}</span>
              </div>
              <button 
                type="button" 
                class="dropzone-remove-btn" 
                title="清除文件"
                @click.stop.prevent="emit('clearPo')"
              >
                <AppIcon name="x" />
              </button>
            </div>
          </template>
          <template v-else>
            <span class="dropzone-icon"><AppIcon name="upload" /></span>
            <strong>选择或拖入 PO PDF</strong>
            <span>支持单个 .pdf 文件</span>
          </template>
        </label>

        <div class="toolbar justify-between">
          <button class="btn btn-soft" type="button" :disabled="isBusy('po-preview')" @click="emit('previewPo')">
            <AppIcon :name="isBusy('po-preview') ? 'loader' : 'file-search'" :class="{ 'jason-spin': isBusy('po-preview') }" />
            {{ isBusy('po-preview') ? '识别中...' : '识别 PO 页码' }}
          </button>
          <button class="btn btn-danger-soft" type="button" @click="emit('clearPo')">
            清空 PO 文件
          </button>
        </div>

        <div class="options-container">
          <h4 class="options-title">输出选项</h4>
          <div class="options-stack">
            <label class="jason-switch-label">
              <div class="jason-switch">
                <input
                  type="checkbox"
                  :checked="printCurrentOnly"
                  @change="emit('update:printCurrentOnly', ($event.target as HTMLInputElement).checked)"
                >
                <span class="jason-switch-slider" />
              </div>
              <span class="jason-switch-text">仅打印当前页</span>
            </label>
            <label class="jason-switch-label">
              <div class="jason-switch">
                <input
                  type="checkbox"
                  :checked="printNextPage"
                  @change="emit('update:printNextPage', ($event.target as HTMLInputElement).checked)"
                >
                <span class="jason-switch-slider" />
              </div>
              <span class="jason-switch-text">同时打印下一页</span>
            </label>
            <label class="jason-switch-label">
              <div class="jason-switch">
                <input
                  type="checkbox"
                  :checked="includeNotFound"
                  @change="emit('update:includeNotFound', ($event.target as HTMLInputElement).checked)"
                >
                <span class="jason-switch-slider" />
              </div>
              <span class="jason-switch-text">摘要包含未找到 PO</span>
            </label>
          </div>
        </div>

        <!-- Generation Bar (Accent highlighted) -->
        <div class="generate-bar">
          <div class="status-row">
            <span class="status-pulse-dot" :class="resultStatusTone" />
            <span :class="['status-text', resultStatusTone]">{{ resultStatusText }}</span>
          </div>
          <div class="generate-actions-horizontal">
            <button
              class="btn btn-primary btn-primary--shimmer"
              type="button"
              :disabled="!canGenerate || isBusy('generate')"
              @click="emit('generatePdf')"
            >
              <AppIcon :name="isBusy('generate') ? 'loader' : 'play-circle'" :class="{ 'jason-spin': isBusy('generate') }" />
              {{ isBusy('generate') ? '生成中...' : '生成重排 PDF' }}
            </button>
            <a
              v-if="downloadHref"
              class="btn btn-success"
              :href="downloadHref"
              :download="latestResult?.fileName"
            >
              <AppIcon name="download" />
              下载结果
            </a>
            <button
              v-if="downloadHref"
              class="btn"
              type="button"
              @click="emit('openResult')"
            >
              打开 PDF
            </button>
          </div>
        </div>

        <div class="toolbar justify-center">
          <button class="btn btn-soft" type="button" @click="emit('update:isLogSidebarOpen', true)">
            <AppIcon name="terminal" />
            查看运行日志
          </button>
        </div>
      </div>
    </article>

    <!-- Log Sidebar Drawer Overlay -->
    <transition name="drawer-fade">
      <div v-if="isLogSidebarOpen" class="drawer-overlay" @click="emit('update:isLogSidebarOpen', false)" />
    </transition>
    
    <!-- Log Sidebar Drawer Container -->
    <transition name="drawer-slide">
      <div v-if="isLogSidebarOpen" class="log-drawer">
        <header class="drawer-header">
          <div class="drawer-title">
            <AppIcon name="terminal" />
            <div>
              <h3>运行日志</h3>
              <p>操作和后端状态返回</p>
            </div>
          </div>
          <div class="drawer-actions">
            <button class="btn btn-soft btn-sm" type="button" @click="emit('clearLogs')">清空</button>
            <button class="close-btn" type="button" @click="emit('update:isLogSidebarOpen', false)">
              <AppIcon name="x" />
            </button>
          </div>
        </header>
        <div class="drawer-body">
          <div class="log-list">
            <div v-for="line in logs" :key="line.id" class="log-line">
              <span>{{ line.time }}</span>
              <strong>{{ line.text }}</strong>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'

interface LogLine {
  id: number
  time: string
  text: string
}

interface Props {
  poFile: File | null
  poPagesSize: number
  printCurrentOnly: boolean
  printNextPage: boolean
  includeNotFound: boolean
  resultStatusText: string
  resultStatusTone: 'idle' | 'success' | 'error'
  downloadHref: string
  latestResult: any
  canGenerate: boolean
  logs: LogLine[]
  isBusy: (action: string) => boolean
  poInputKey: number
  isLogSidebarOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:poFile', file: File | null): void
  (e: 'update:printCurrentOnly', val: boolean): void
  (e: 'update:printNextPage', val: boolean): void
  (e: 'update:includeNotFound', val: boolean): void
  (e: 'update:isLogSidebarOpen', val: boolean): void
  (e: 'previewPo'): void
  (e: 'clearPo'): void
  (e: 'generatePdf'): void
  (e: 'openResult'): void
  (e: 'clearLogs'): void
}>()

const localDraggingTarget = ref<'po' | null>(null)

function onPoFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  emit('update:poFile', file)
}

function onPoFileDrop(e: DragEvent) {
  localDraggingTarget.value = null
  const file = Array.from(e.dataTransfer?.files ?? []).find(isPdfFile) ?? null
  if (file) {
    emit('update:poFile', file)
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}
</script>

<style scoped>
.workbench-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card--focus {
  background: var(--white);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.02);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.card--focus:hover {
  transform: translateY(-2px);
  border-color: rgba(16, 185, 129, 0.35);
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.06);
}

.card-glow-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--green), #34d399);
}



.card-header {
  align-items: center;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 16px;
}

.card-heading {
  align-items: center;
  display: flex;
  gap: 12px;
}

.card-icon {
  align-items: center;
  background: var(--gray-50);
  border-radius: 8px;
  color: var(--gray-500);
  display: inline-flex;
  justify-content: center;
  font-size: 16px;
  height: 32px;
  width: 32px;
}

.card-icon--green {
  background: var(--green-light);
  color: var(--green);
}

.card-icon--slate {
  background: var(--gray-100);
  color: var(--gray-500);
}

.card--focus h2,
.log-card h2 {
  font-size: 14px;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0;
}

.card--focus p,
.log-card p {
  color: var(--gray-500);
  font-size: 11px;
  margin: 2px 0 0;
}

.card-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  overflow-y: auto;
}

.log-card .card-body {
  padding: 0;
}

.badge {
  background: var(--gray-100);
  border-radius: 999px;
  color: var(--gray-500);
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
}

.badge.success {
  background: var(--green-light);
  color: var(--green);
}

.field-label {
  align-items: center;
  color: var(--gray-600);
  display: flex;
  font-size: 12px;
  font-weight: 800;
  justify-content: space-between;
  margin-top: 4px;
}

.field-label small {
  color: var(--gray-400);
  font-weight: 700;
}

/* Dropzones */
.dropzone {
  align-items: center;
  background: var(--gray-50);
  border: 2px dashed var(--gray-200);
  border-radius: 10px;
  cursor: pointer;
  display: grid;
  gap: 6px;
  justify-items: center;
  min-height: 110px;
  height: 110px;
  padding: 16px;
  text-align: center;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  box-sizing: border-box;
}

.dropzone input {
  display: none;
}

.dropzone strong {
  color: var(--gray-700);
  font-size: 13px;
  font-weight: 700;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropzone span:last-child {
  color: var(--gray-400);
  font-size: 11px;
}

.dropzone-icon {
  background: var(--white);
  color: var(--blue);
  font-size: 16px;
  height: 36px;
  width: 36px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.dropzone.dragging,
.dropzone:hover {
  background: var(--blue-light);
  border-color: var(--blue);
}

.dropzone.dragging .dropzone-icon,
.dropzone:hover .dropzone-icon {
  transform: translateY(-2px) scale(1.05);
}

.dropzone.has-file {
  background: var(--white);
  border-style: solid;
  border-color: var(--green);
}
.dropzone.has-file .dropzone-icon {
  color: var(--green);
  background: var(--green-light);
}

.dropzone-file-capsule {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: var(--green-light);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  position: relative;
  text-align: left;
  box-sizing: border-box;
}

.file-icon-pulse {
  color: var(--green);
  font-size: 20px;
  animation: jason-pulse-icon 2s infinite;
}

@keyframes jason-pulse-icon {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--gray-900);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  display: block;
  font-size: 10px;
  color: var(--gray-500);
  margin-top: 2px;
}

.dropzone-remove-btn {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 50%;
  color: var(--gray-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  width: 24px;
  transition: all 0.2s;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  z-index: 5;
}

.dropzone-remove-btn:hover {
  background: var(--red-light);
  border-color: rgba(239, 68, 68, 0.2);
  color: var(--red);
  transform: scale(1.1);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.justify-between {
  justify-content: space-between;
}

.justify-end {
  justify-content: flex-end;
}

.btn {
  align-items: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  color: var(--gray-700);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
  justify-content: center;
  min-height: 32px;
  padding: 6px 12px;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  user-select: none;
}

.btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
  transform: translateY(-1.5px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.btn-soft {
  background: var(--blue-light);
  border-color: transparent;
  color: var(--blue);
}

.btn-soft:hover:not(:disabled) {
  background: #e0f2fe;
  color: var(--blue-dark);
}

.btn-danger-soft {
  background: var(--red-light);
  border-color: transparent;
  color: var(--red);
}

.btn-danger-soft:hover:not(:disabled) {
  background: #fee2e2;
}

.btn-warning-soft {
  background: var(--amber-light);
  border-color: transparent;
  color: var(--amber);
}

.btn-warning-soft:hover:not(:disabled) {
  background: #fde68a;
}

.btn-success {
  background: linear-gradient(135deg, var(--green), var(--green-dark));
  border: none;
  color: var(--white);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  text-decoration: none;
  box-sizing: border-box;
}

.btn-success:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
}

.btn-primary {
  background: linear-gradient(135deg, var(--blue), var(--blue-dark));
  border: none;
  color: var(--white);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow: 0 6px 16px rgba(14, 165, 233, 0.3);
}

.btn-primary--shimmer {
  position: relative;
  overflow: hidden;
}

.btn-primary--shimmer::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  transition: all 0.6s ease;
}

.btn-primary--shimmer:hover:not(:disabled)::after {
  left: 100%;
}

.btn-lg {
  font-size: 13px;
  min-height: 38px;
  padding: 8px 16px;
  border-radius: 10px;
}

.btn-block {
  width: 100%;
}

.options-container {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 10px 12px;
}

.options-title {
  font-size: 11px;
  font-weight: 800;
  color: var(--gray-500);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.options-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Premium Switch Slider Toggle */
.jason-switch-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  font-weight: 700;
  color: var(--gray-700);
  transition: color 0.2s;
}

.jason-switch-label:hover {
  color: var(--gray-900);
}

.jason-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
}

.jason-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.jason-switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--gray-200);
  transition: .25s cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 999px;
  border: 1px solid var(--gray-300);
}

.jason-switch-slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .25s cubic-bezier(0.22, 1, 0.36, 1);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.jason-switch input:checked + .jason-switch-slider {
  background-color: var(--blue);
  border-color: var(--blue-dark);
}

.jason-switch input:checked + .jason-switch-slider:before {
  transform: translateX(14px);
}

.generate-bar {
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.08);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  position: relative;
}

.status-row {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
}

.status-text {
  color: var(--gray-700);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  line-height: 1.45;
  min-width: 0;
  overflow-wrap: anywhere;
}

.status-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--gray-400);
  flex-shrink: 0;
}

.status-text.success { color: var(--green-dark); }
.status-text.error { color: var(--red); }

.status-pulse-dot.success {
  background-color: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: jason-pulse-green 2s infinite;
}
.status-pulse-dot.error {
  background-color: var(--red);
  box-shadow: 0 0 8px var(--red);
}

@keyframes jason-pulse-green {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.generate-actions-horizontal {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  width: 100%;
}

.generate-actions-horizontal .btn {
  min-width: 0;
  width: 100%;
}

.toolbar.justify-center {
  justify-content: stretch;
}

.toolbar.justify-center .btn {
  width: 100%;
}

/* Drawer Overlay & Content */
.drawer-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(3px);
  z-index: 1000;
}

.log-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(460px, calc(100vw - 28px));
  background: #ffffff;
  border-left: 1px solid var(--gray-200);
  box-shadow: -18px 0 40px rgba(15, 23, 42, 0.16);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  box-sizing: border-box;
}

.drawer-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #f8fafc, #eef6ff);
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--gray-900);
}

.drawer-title h3 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  color: var(--gray-900);
}

.drawer-title p {
  font-size: 10px;
  color: var(--gray-500);
  margin: 2px 0 0;
}

.drawer-title svg {
  color: var(--blue);
  font-size: 16px;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-btn {
  background: var(--gray-100);
  border: 1px solid var(--gray-200);
  color: var(--gray-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: all 0.2s;
  border-radius: 50%;
}

.close-btn:hover {
  background: var(--blue-light);
  color: var(--blue-dark);
}

.btn-sm {
  min-height: 24px;
  padding: 3px 8px;
  font-size: 10px;
}

.drawer-body {
  background: #f8fafc;
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Scrollable log list inside drawer */
.drawer-body .log-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px;
  background: #ffffff;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  max-height: none;
  display: grid;
  gap: 6px;
  overflow: auto;
}

.log-line {
  align-items: start;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  display: grid;
  gap: 10px;
  grid-template-columns: 74px minmax(0, 1fr);
  padding: 8px 10px;
}

.log-line span {
  color: var(--blue-dark);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.log-line strong {
  color: var(--gray-700);
  font-size: 11px;
  font-weight: 500;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.jason-spin {
  animation: jason-spin-kf 1s linear infinite;
}

@keyframes jason-spin-kf {
  to { transform: rotate(360deg); }
}

/* Drawer transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
