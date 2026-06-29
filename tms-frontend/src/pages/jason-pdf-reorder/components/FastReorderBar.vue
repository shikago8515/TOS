<template>
  <article class="fast-reorder-bar jason-entry-anim">
    <div class="bar-glow-line" />
    
    <!-- Title / Brand Section -->
    <div class="bar-section bar-title-section">
      <div class="lightning-icon">
        <AppIcon name="zap" />
      </div>
      <div>
        <h3>{{ text('闪电极速重排') }}</h3>
        <p>{{ text('免去手动核对，一键完成数据提取与 PDF 合并') }}</p>
      </div>
    </div>

    <!-- Upload Slots Section -->
    <div class="bar-section upload-slots-section">
      <!-- Invoice Upload Slot -->
      <label 
        class="mini-upload-slot"
        :class="{ 'has-file': Boolean(invoiceFile), dragging: draggingTarget === 'invoice' }"
        @dragenter.prevent="draggingTarget = 'invoice'"
        @dragover.prevent
        @dragleave.prevent="draggingTarget = null"
        @drop.prevent="onDrop($event, 'invoice')"
      >
        <input 
          type="file" 
          accept="application/pdf,.pdf" 
          @change="onChange($event, 'invoice')"
        />
        <AppIcon :name="invoiceFile ? 'file-check' : 'upload-cloud'" class="slot-icon" />
        <div class="slot-text">
          <strong v-if="invoiceFile" class="file-name" :title="invoiceFile.name">{{ invoiceFile.name }}</strong>
          <span v-else>{{ text('拖入或选择发票 PDF') }}</span>
        </div>
        <button 
          v-if="invoiceFile" 
          type="button" 
          class="slot-clear-btn" 
          :title="text('清除发票文件')"
          @click.stop.prevent="emit('clearInvoice')"
        >
          <AppIcon name="x" />
        </button>
      </label>

      <!-- Connection line -->
      <div class="connector-arrow">
        <AppIcon name="arrow-right" />
      </div>

      <!-- PO Upload Slot -->
      <label 
        class="mini-upload-slot"
        :class="{ 'has-file': Boolean(poFile), dragging: draggingTarget === 'po' }"
        @dragenter.prevent="draggingTarget = 'po'"
        @dragover.prevent
        @dragleave.prevent="draggingTarget = null"
        @drop.prevent="onDrop($event, 'po')"
      >
        <input 
          type="file" 
          accept="application/pdf,.pdf" 
          @change="onChange($event, 'po')"
        />
        <AppIcon :name="poFile ? 'file-check' : 'upload-cloud'" class="slot-icon" />
        <div class="slot-text">
          <strong v-if="poFile" class="file-name" :title="poFile.name">{{ poFile.name }}</strong>
          <span v-else>{{ text('拖入或选择 PO PDF') }}</span>
        </div>
        <button 
          v-if="poFile" 
          type="button" 
          class="slot-clear-btn" 
          :title="text('清除 PO 文件')"
          @click.stop.prevent="emit('clearPo')"
        >
          <AppIcon name="x" />
        </button>
      </label>
    </div>

    <!-- Actions Section -->
    <div class="bar-section actions-section">
      <!-- Fast Reorder Trigger Button -->
      <button
        class="btn btn-primary btn-primary--shimmer fast-trigger-btn"
        :class="{ 'btn-success': downloadHref, 'is-busy': isBusy('generate') }"
        type="button"
        :disabled="!canTrigger || isBusy('generate')"
        :aria-busy="isBusy('generate') ? 'true' : 'false'"
        @click="onActionClick"
      >
        <AppIcon
          :name="isBusy('generate') ? 'loader' : (downloadHref ? 'check-circle' : 'zap')"
          class="fast-trigger-icon"
          :class="{ 'jason-spin': isBusy('generate') }"
        />
        <span class="fast-trigger-label">
          {{ isBusy('generate') ? text('正在极速重排...') : (downloadHref ? text('极速生成成功') : text('一键极速重排')) }}
        </span>
      </button>

      <!-- Fast Action Row: Only when downloadHref is ready -->
      <div v-if="downloadHref" class="fast-result-actions">
        <a
          class="btn btn-success"
          :href="downloadHref"
          :download="latestResult?.fileName"
        >
          <AppIcon name="download" />
          {{ text('下载结果') }}
        </a>
        <button
          class="btn"
          type="button"
          @click="emit('openResult')"
        >
          {{ text('预览 PDF') }}
        </button>
      </div>

      <button
        v-if="invoiceFile || poFile"
        class="btn btn-danger-soft btn-sm"
        type="button"
        @click="emit('clearAll')"
      >
        {{ text('清空文件') }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

interface Props {
  invoiceFile: File | null
  poFile: File | null
  isBusy: (action: string) => boolean
  downloadHref: string
  latestResult: any
}

const props = defineProps<Props>()
const { text } = useAppLanguage()
const emit = defineEmits<{
  (e: 'update:invoiceFile', file: File | null): void
  (e: 'update:poFile', file: File | null): void
  (e: 'clearInvoice'): void
  (e: 'clearPo'): void
  (e: 'fastReorder'): void
  (e: 'openResult'): void
  (e: 'clearAll'): void
}>()

const draggingTarget = ref<'invoice' | 'po' | null>(null)

const canTrigger = computed(() => Boolean(props.invoiceFile && props.poFile))

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function onChange(event: Event, kind: 'invoice' | 'po'): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (file && isPdfFile(file)) {
    if (kind === 'invoice') {
      emit('update:invoiceFile', file)
    } else {
      emit('update:poFile', file)
    }
  }
}

function onDrop(event: DragEvent, kind: 'invoice' | 'po'): void {
  draggingTarget.value = null
  const file = Array.from(event.dataTransfer?.files ?? []).find(isPdfFile) ?? null
  if (file) {
    if (kind === 'invoice') {
      emit('update:invoiceFile', file)
    } else {
      emit('update:poFile', file)
    }
  }
}

function onActionClick(): void {
  if (props.downloadHref) {
    emit('openResult')
  } else {
    emit('fastReorder')
  }
}
</script>

<style scoped>
.fast-reorder-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.bar-glow-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #0ea5e9, #10b981);
}

.bar-section {
  display: flex;
  align-items: center;
}

/* Title section */
.bar-title-section {
  gap: 12px;
  flex-shrink: 0;
}

.lightning-icon {
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  color: #0ea5e9;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
}

.bar-title-section h3 {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  color: var(--gray-900);
}

.bar-title-section p {
  font-size: 11px;
  color: var(--gray-500);
  margin: 2px 0 0;
}

/* Upload Slots section */
.upload-slots-section {
  gap: 12px;
  flex: 1;
  max-width: 520px;
}

.mini-upload-slot {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--white);
  border: 1px dashed var(--gray-300);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  user-select: none;
  min-width: 0;
  height: 36px;
  box-sizing: border-box;
}

.mini-upload-slot input {
  display: none;
}

.mini-upload-slot:hover {
  border-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.02);
}

.mini-upload-slot.dragging {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.mini-upload-slot.has-file {
  border-style: solid;
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.03);
}

.slot-icon {
  font-size: 14px;
  color: var(--gray-400);
  flex-shrink: 0;
}

.mini-upload-slot.has-file .slot-icon {
  color: #10b981;
}

.slot-text {
  font-size: 11px;
  color: var(--gray-600);
  min-width: 0;
  flex: 1;
}

.file-name {
  display: block;
  font-weight: 600;
  color: var(--gray-800);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-clear-btn {
  background: none;
  border: none;
  color: var(--gray-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  flex-shrink: 0;
}

.slot-clear-btn:hover {
  background: var(--gray-100);
  color: var(--red);
}

.connector-arrow {
  color: var(--gray-400);
  display: flex;
  align-items: center;
  font-size: 12px;
}

/* Actions Section */
.actions-section {
  gap: 10px;
  flex-shrink: 0;
}

.actions-section .btn {
  align-items: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  box-sizing: border-box;
  color: var(--gray-700);
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 650;
  gap: 6px;
  justify-content: center;
  line-height: 1;
  min-height: 34px;
  padding: 0 12px;
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
  user-select: none;
  white-space: nowrap;
}

.actions-section .btn:hover:not(:disabled) {
  border-color: var(--gray-300);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.actions-section .btn:active:not(:disabled) {
  transform: translateY(0);
}

.actions-section .btn:focus-visible {
  outline: 2px solid rgba(14, 165, 233, 0.35);
  outline-offset: 2px;
}

.actions-section .btn:disabled {
  cursor: not-allowed;
}

.actions-section .btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: transparent;
  color: var(--white);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.18);
}

.actions-section .btn-danger-soft {
  background: var(--red-light);
  border-color: transparent;
  color: var(--red);
}

.actions-section .btn-danger-soft:hover:not(:disabled) {
  background: #fee2e2;
}

.actions-section .btn-sm {
  font-size: 11px;
  min-height: 28px;
  padding: 0 10px;
}

.fast-trigger-btn {
  isolation: isolate;
  min-height: 38px;
  min-width: 146px;
  padding: 0 16px;
  border: 1px solid transparent !important;
  border-radius: 8px;
  color: var(--white) !important;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
  position: relative;
  overflow: hidden;
  transition:
    background-position 0.4s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.fast-trigger-btn:not(:disabled):not(.btn-success) {
  background:
    linear-gradient(135deg, #0284c7 0%, #0ea5e9 48%, #10b981 100%) !important;
  background-size: 150% 150% !important;
  box-shadow:
    0 10px 22px rgba(14, 165, 233, 0.22),
    0 3px 8px rgba(16, 185, 129, 0.16);
}

.fast-trigger-btn.btn-success {
  background: linear-gradient(135deg, #047857, #16a34a) !important;
  box-shadow:
    0 10px 22px rgba(16, 185, 129, 0.2),
    0 3px 8px rgba(4, 120, 87, 0.16);
}

.fast-trigger-btn::before,
.fast-trigger-btn::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.fast-trigger-btn::before {
  inset: 1px;
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent 56%);
  opacity: 0.9;
  z-index: 0;
}

.fast-trigger-btn::after {
  top: 0;
  left: -56px;
  width: 42px;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.42),
    transparent
  );
  transform: skewX(-20deg);
  transition: transform 0.65s ease;
  z-index: 0;
}

.fast-trigger-btn:not(:disabled):hover::after {
  transform: translateX(230px) skewX(-20deg);
}

.fast-trigger-btn:not(:disabled):hover {
  background-position: 100% 50%;
  border-color: rgba(255, 255, 255, 0.18) !important;
  box-shadow:
    0 12px 26px rgba(14, 165, 233, 0.26),
    0 5px 12px rgba(16, 185, 129, 0.2);
  transform: translateY(-1px);
}

.fast-trigger-btn.btn-success:not(:disabled):hover {
  box-shadow:
    0 12px 26px rgba(16, 185, 129, 0.24),
    0 5px 12px rgba(4, 120, 87, 0.18);
}

.fast-trigger-btn:not(:disabled):active {
  box-shadow:
    0 5px 14px rgba(14, 165, 233, 0.2),
    0 2px 6px rgba(16, 185, 129, 0.14);
  transform: translateY(0);
}

.fast-trigger-btn:disabled {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  border-color: rgba(148, 163, 184, 0.42) !important;
  color: #8a9aad !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 1px 2px rgba(15, 23, 42, 0.04) !important;
  opacity: 1;
}

.fast-trigger-btn:disabled::after {
  display: none;
}

.fast-trigger-btn.is-busy:disabled {
  background:
    linear-gradient(135deg, #0284c7 0%, #0ea5e9 48%, #10b981 100%) !important;
  background-size: 150% 150% !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: var(--white) !important;
  box-shadow:
    0 8px 20px rgba(14, 165, 233, 0.18),
    0 3px 8px rgba(16, 185, 129, 0.12) !important;
}

.fast-trigger-btn.is-busy:disabled::after {
  display: block;
  opacity: 0.55;
  transform: translateX(230px) skewX(-20deg);
}

.fast-trigger-icon,
.fast-trigger-label {
  position: relative;
  z-index: 1;
}

.fast-trigger-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.fast-trigger-btn:not(:disabled) .fast-trigger-icon {
  animation: zap-glow 1.8s ease-in-out infinite;
}

@keyframes zap-glow {
  0%,
  100% {
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.6));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 7px rgba(255, 255, 255, 0.95));
    transform: scale(1.08);
  }
}

.jason-spin {
  animation: jason-spin-kf 1s linear infinite;
}

@keyframes jason-spin-kf {
  to {
    transform: rotate(360deg);
  }
}

.fast-result-actions {
  display: flex;
  gap: 8px;
}

.fast-result-actions .btn {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .actions-section .btn,
  .fast-trigger-btn,
  .fast-trigger-btn::after,
  .fast-trigger-icon,
  .jason-spin {
    animation: none !important;
    transition: none !important;
  }
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .fast-reorder-bar {
    flex-wrap: wrap;
    gap: 12px;
  }
  .upload-slots-section {
    max-width: none;
    order: 3;
    width: 100%;
  }
}

@media (max-width: 720px) {
  .actions-section {
    flex-wrap: wrap;
    width: 100%;
  }

  .fast-trigger-btn {
    flex: 1 1 190px;
  }

  .fast-result-actions {
    flex: 1 1 100%;
  }

  .fast-result-actions .btn {
    flex: 1;
  }
}
</style>
