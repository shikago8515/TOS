<template>
  <section class="workbench-col workbench-col--left">
    <article class="card card-source-selector">
      <div class="card-glow-bar card-glow-bar--blue" />
      
      <!-- 滑动 Tab 控制 -->
      <div class="tab-header-slider">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'invoice' }"
          type="button"
          @click="changeTab('invoice')"
        >
          <AppIcon name="file-text" />
          <span>{{ text('发票 PO 提取') }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'extract' }"
          type="button"
          @click="changeTab('extract')"
        >
          <AppIcon name="target" />
          <span>{{ text('自定义号码提取') }}</span>
        </button>
        <div class="tab-slider-bar" :style="{ left: activeTab === 'invoice' ? '4px' : 'calc(50% - 8px)' }" />
      </div>

      <div class="tab-content-container">
        <transition name="tab-fade" mode="out-in">
          <!-- Tab 1: 发票 PO 提取 -->
          <div v-if="activeTab === 'invoice'" key="invoice-tab" class="tab-pane">
            <header class="tab-pane-header">
              <div>
                <h3>{{ text('发票 PO 提取') }}</h3>
                <p>{{ text('上传发票 PDF 后提取 PO 顺序与明细') }}</p>
              </div>
              <span class="badge" :class="{ active: invoiceEntries.length > 0 }">
                {{ invoiceEntries.length }} {{ text('个PO') }}
              </span>
            </header>

            <div class="tab-pane-body">
              <div class="field-label">
                <span>{{ text('发票 PDF 数据源') }}</span>
                <small>{{ invoiceEntries.length }} {{ text('个已导入 PO') }}</small>
              </div>
              <label
                class="dropzone"
                :class="{ 'has-file': Boolean(invoiceFile), dragging: localDraggingTarget === 'invoice' }"
                @dragenter.prevent="localDraggingTarget = 'invoice'"
                @dragover.prevent
                @dragleave.prevent="localDraggingTarget = null"
                @drop.prevent="onInvoiceFileDrop"
              >
                <input
                  :key="invoiceInputKey"
                  type="file"
                  accept="application/pdf,.pdf"
                  @change="onInvoiceFileChange"
                >
                <template v-if="invoiceFile">
                  <div class="dropzone-file-capsule">
                    <AppIcon name="file" class="file-icon-pulse" />
                    <div class="file-info">
                      <strong class="file-name" :title="invoiceFile.name">{{ invoiceFile.name }}</strong>
                      <span class="file-size">{{ formatFileSize(invoiceFile.size) }}</span>
                    </div>
                    <button 
                      type="button" 
                      class="dropzone-remove-btn" 
                      :title="text('清除文件')"
                      @click.stop.prevent="emit('clearInvoice')"
                    >
                      <AppIcon name="x" />
                    </button>
                  </div>
                </template>
                <template v-else>
                  <span class="dropzone-icon"><AppIcon name="upload" /></span>
                  <strong>{{ text('选择或拖入发票 PDF') }}</strong>
                  <span>{{ text('支持单个 .pdf 文件') }}</span>
                </template>
              </label>

              <div class="toolbar flex-wrap">
                <button class="btn btn-soft" type="button" :disabled="isBusy('invoice-preview')" @click="emit('previewInvoice')">
                  <AppIcon :name="isBusy('invoice-preview') ? 'loader' : 'file-search'" :class="{ 'jason-spin': isBusy('invoice-preview') }" />
                  {{ isBusy('invoice-preview') ? text('提取中...') : text('提取发票') }}
                </button>
                <button class="btn btn-soft" type="button" @click="emit('syncInvoice')">
                  <AppIcon name="refresh-cw" />
                  {{ text('同步到 PO') }}
                </button>
                <button class="btn" type="button" @click="emit('copyInvoice')">
                  <AppIcon name="copy" />
                  {{ text('复制') }}
                </button>
                <button class="btn" type="button" @click="emit('downloadInvoiceTxt')">
                  <AppIcon name="download" />
                  TXT
                </button>
                <button class="btn" type="button" @click="emit('downloadInvoiceCsv')">
                  <AppIcon name="download-cloud" />
                  CSV
                </button>
                <button class="btn btn-danger-soft" type="button" @click="emit('clearInvoice')">
                  {{ text('清空') }}
                </button>
              </div>

              <div class="metrics">
                <div class="metric">
                  <span>{{ text('PO 数量') }}</span>
                  <strong>{{ invoiceEntries.length }}</strong>
                </div>
                <div class="metric">
                  <span>{{ text('总数量') }}</span>
                  <strong>{{ valueOrDash(invoiceSummary?.totalQuantity) }}</strong>
                </div>
                <div class="metric">
                  <span>{{ text('货品金额') }}</span>
                  <strong>{{ valueOrDash(invoiceSummary?.totalAmount) }}</strong>
                </div>
                <div class="metric">
                  <span>{{ text('发票总额') }}</span>
                  <strong>{{ valueOrDash(invoiceSummary?.invoiceTotals?.invoice_total) }}</strong>
                </div>
              </div>

              <div class="table-wrap mini-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>PO</th>
                      <th>{{ text('发票页') }}</th>
                      <th>Article</th>
                      <th>{{ text('描述') }}</th>
                      <th class="num">{{ text('数量') }}</th>
                      <th class="num">{{ text('货品金额') }}</th>
                      <th class="num">{{ text('净额') }}</th>
                    </tr>
                  </thead>
                  <transition-group name="jason-row-fade" tag="tbody">
                    <tr v-if="invoiceEntries.length === 0" key="empty">
                      <td colspan="8">
                        <div class="empty-state">
                          <AppIcon name="file-text" />
                          <span>{{ text('等待上传发票 PDF 并提取数据') }}</span>
                        </div>
                      </td>
                    </tr>
                    <tr v-for="entry in invoiceEntries" :key="`${entry.po}-${entry.index}`" v-else>
                      <td>{{ entry.index }}</td>
                      <td><strong>{{ entry.po }}</strong></td>
                      <td>{{ formatPages(entry.invoicePages) }}</td>
                      <td>{{ valueOrDash(entry.articleNo) }}</td>
                      <td class="description-cell">{{ valueOrDash(entry.description) }}</td>
                      <td class="num">{{ valueOrDash(entry.quantity) }}</td>
                      <td class="num">{{ valueOrDash(entry.totalAmount) }}</td>
                      <td class="num">{{ valueOrDash(entry.netAmount) }}</td>
                    </tr>
                  </transition-group>
                </table>
              </div>

              <slot name="invoice-message"></slot>
            </div>
          </div>

          <!-- Tab 2: 自定义号码提取 -->
          <div v-else key="extract-tab" class="tab-pane">
            <header class="tab-pane-header">
              <div>
                <h3>{{ text('自定义号码提取') }}</h3>
                <p>{{ text('按自定义规则抓取特定文本或 PDF 中的号码') }}</p>
              </div>
              <span class="badge">{{ extractNumbers.length }} {{ text('个号码') }}</span>
            </header>

            <div class="tab-pane-body">
              <div class="rule-row">
                <input
                  :value="extractPattern"
                  @input="emit('update:extractPattern', ($event.target as HTMLInputElement).value)"
                  class="text-input"
                  type="text"
                  :placeholder="text('如 090|45 或 \\d{10}')"
                  @keydown.prevent.enter="emit('applyExtractionRule')"
                >
                <button class="btn btn-soft" type="button" @click="emit('applyExtractionRule')">{{ text('应用规则') }}</button>
              </div>

              <div class="radio-row">
                <label v-for="option in extractTypeOptions" :key="option.value" class="radio-pill">
                  <input
                    type="radio"
                    :value="option.value"
                    :checked="extractSearchType === option.value"
                    @change="emit('update:extractSearchType', option.value)"
                  >
                  {{ text(option.label) }}
                </label>
              </div>

              <div class="preset-row">
                <button class="btn" type="button" @click="emit('setExtractPreset', '090|45', 'startsWith')">{{ text('090/45 开头') }}</button>
                <button class="btn" type="button" @click="emit('setExtractPreset', '\\\\d{10}', 'regex')">{{ text('10 位数字') }}</button>
                <button class="btn" type="button" @click="emit('setExtractPreset', '45', 'contains')">{{ text('包含 45') }}</button>
              </div>

              <div class="field-label">
                <span>{{ text('自定义提取 PDF') }}</span>
                <small>{{ extractFiles.length }} {{ text('个已选文件') }}</small>
              </div>
              <label
                class="dropzone mini-drop"
                :class="{ 'has-file': extractFiles.length > 0, dragging: localDraggingTarget === 'extract' }"
                @dragenter.prevent="localDraggingTarget = 'extract'"
                @dragover.prevent
                @dragleave.prevent="localDraggingTarget = null"
                @drop.prevent="onExtractDrop"
              >
                <input
                  :key="extractInputKey"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  @change="onExtractFilesChange"
                >
                <span class="dropzone-icon"><AppIcon name="files" /></span>
                <strong>{{ extractFiles.length ? `${extractFiles.length} ${text('个 PDF')}` : text('选择用于提取的 PDF') }}</strong>
                <span>{{ extractFiles.length ? extractFiles.map((file) => file.name).join('，') : text('可多选') }}</span>
              </label>

              <textarea
                :value="pasteText"
                @input="emit('update:pasteText', ($event.target as HTMLTextAreaElement).value)"
                class="textarea small"
                :placeholder="text('粘贴文本，然后点击从粘贴提取')"
              />

              <div class="toolbar flex-wrap">
                <button class="btn btn-soft" type="button" :disabled="isBusy('extract-pdf')" @click="emit('extractFromPdf')">
                  <AppIcon :name="isBusy('extract-pdf') ? 'loader' : 'file-search'" :class="{ 'jason-spin': isBusy('extract-pdf') }" />
                  {{ text('从 PDF 提取') }}
                </button>
                <button class="btn btn-soft" type="button" @click="emit('extractFromPaste')">{{ text('从粘贴提取') }}</button>
                <button class="btn btn-soft" type="button" @click="emit('extractFromPageText')">{{ text('抓取页面文本') }}</button>
                <button class="btn" type="button" @click="emit('copyExtracted')">{{ text('复制') }}</button>
                <button class="btn" type="button" @click="emit('downloadExtracted')">{{ text('下载') }}</button>
                <button class="btn btn-danger-soft" type="button" @click="emit('clearExtraction')">{{ text('清空') }}</button>
              </div>

              <div class="number-list-container">
                <div v-if="extractNumbers.length === 0" class="empty-state compact">
                  <span>{{ text('等待提取号码') }}</span>
                </div>
                <transition-group v-else name="jason-row-fade" tag="div" class="number-list">
                  <section v-for="group in extractGroups" :key="group.fileName" class="number-group">
                    <h3>{{ group.fileName }}</h3>
                    <template v-for="page in group.pages" :key="`${group.fileName}-${page.pageNum}`">
                      <p>{{ text('第') }} {{ page.pageNum }} {{ text('页') }} · {{ page.numbers.length }} {{ text('个') }}</p>
                      <div
                        v-for="number in page.numbers"
                        :key="`${group.fileName}-${page.pageNum}-${number}`"
                        class="number-row"
                      >
                        <span>{{ numberIndex(number) }}</span>
                        <strong>{{ number }}</strong>
                      </div>
                    </template>
                  </section>
                </transition-group>
              </div>

              <slot name="extract-message"></slot>
            </div>
          </div>
        </transition>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { 
  JasonPdfReorderEntry, 
  JasonPdfReorderSummary, 
  JasonPdfReorderExtractFile, 
  JasonPdfReorderExtractSearchType 
} from '../jasonPdfReorderApi'

interface Props {
  activeTab: 'invoice' | 'extract'
  invoiceFile: File | null
  extractFiles: File[]
  invoiceEntries: JasonPdfReorderEntry[]
  invoiceSummary: JasonPdfReorderSummary | null
  extractNumbers: string[]
  extractGroups: JasonPdfReorderExtractFile[]
  extractPattern: string
  extractSearchType: JasonPdfReorderExtractSearchType
  pasteText: string
  isBusy: (action: string) => boolean
  invoiceInputKey: number
  extractInputKey: number
}

const props = defineProps<Props>()
const { text } = useAppLanguage()
const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'invoice' | 'extract'): void
  (e: 'update:invoiceFile', file: File | null): void
  (e: 'update:extractFiles', files: File[]): void
  (e: 'update:extractPattern', pattern: string): void
  (e: 'update:extractSearchType', type: JasonPdfReorderExtractSearchType): void
  (e: 'update:pasteText', text: string): void
  (e: 'previewInvoice'): void
  (e: 'syncInvoice'): void
  (e: 'copyInvoice'): void
  (e: 'downloadInvoiceTxt'): void
  (e: 'downloadInvoiceCsv'): void
  (e: 'clearInvoice'): void
  (e: 'applyExtractionRule'): void
  (e: 'setExtractPreset', pattern: string, type: JasonPdfReorderExtractSearchType): void
  (e: 'extractFromPdf'): void
  (e: 'extractFromPaste'): void
  (e: 'extractFromPageText'): void
  (e: 'copyExtracted'): void
  (e: 'downloadExtracted'): void
  (e: 'clearExtraction'): void
}>()

const localDraggingTarget = ref<'invoice' | 'extract' | null>(null)

const extractTypeOptions: Array<{ label: string; value: JasonPdfReorderExtractSearchType }> = [
  { label: '开头匹配', value: 'startsWith' },
  { label: '包含', value: 'contains' },
  { label: '精确', value: 'exact' },
  { label: '正则', value: 'regex' },
]

function changeTab(tab: 'invoice' | 'extract') {
  emit('update:activeTab', tab)
}

function onInvoiceFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  emit('update:invoiceFile', file)
}

function onInvoiceFileDrop(e: DragEvent) {
  localDraggingTarget.value = null
  const file = Array.from(e.dataTransfer?.files ?? []).find(isPdfFile) ?? null
  if (file) {
    emit('update:invoiceFile', file)
  }
}

function onExtractFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter(isPdfFile)
  emit('update:extractFiles', files)
}

function onExtractDrop(e: DragEvent) {
  localDraggingTarget.value = null
  const files = Array.from(e.dataTransfer?.files ?? []).filter(isPdfFile)
  emit('update:extractFiles', files)
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

function valueOrDash(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

function formatPages(pages: number[] | undefined): string {
  return pages && pages.length > 0 ? pages.join(', ') : '-'
}

function numberIndex(number: string): string {
  const index = props.extractNumbers.indexOf(number)
  return String(index + 1).padStart(3, '0')
}
</script>

<style scoped>
/* Scoped styles inherit left stack properties */
.workbench-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-source-selector {
  background: var(--white);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.01), 0 4px 16px rgba(15, 23, 42, 0.02);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-source-selector:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.card-glow-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--blue), #38bdf8);
}

.tab-content-container,
.tab-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tab-pane-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 16px 16px;
  overflow-y: auto;
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

.badge.active {
  background: var(--blue-light);
  color: var(--blue);
}

/* Slider Tab Component */
.tab-header-slider {
  display: flex;
  background: var(--gray-100);
  padding: 4px;
  border-radius: 10px;
  position: relative;
  margin: 16px 16px 4px;
  border: 1px solid var(--gray-200);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  z-index: 2;
  transition: color 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.15s ease;
}

.tab-btn:hover {
  color: var(--gray-900);
}

.tab-btn:active {
  transform: scale(0.97);
}

.tab-btn.active {
  color: var(--blue-dark);
}

.tab-slider-bar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: calc(50% - 4px);
  background: var(--white);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 1;
}

.tab-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px dashed var(--gray-200);
  margin-bottom: 14px;
  background: linear-gradient(180deg, var(--gray-50), var(--white));
}

.tab-pane-header h3 {
  font-size: 13px;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0;
}

.tab-pane-header p {
  font-size: 10px;
  color: var(--gray-400);
  margin: 2px 0 0;
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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

/* Dropzone Styles */
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

.mini-drop {
  min-height: 84px;
}

/* Dropzone capsule */
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

/* Toolbars & Buttons */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.jason-spin {
  animation: jason-spin-kf 1s linear infinite;
}

@keyframes jason-spin-kf {
  to { transform: rotate(360deg); }
}

/* Metrics styles */
.metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}

.metric span {
  color: var(--gray-500);
  font-size: 10px;
  font-weight: 700;
}

.metric strong {
  color: var(--gray-900);
  font-size: 16px;
  overflow-wrap: anywhere;
}

/* Tables */
.table-wrap {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  overflow: auto;
}

.mini-table {
  flex: 1;
  min-height: 120px;
  max-height: none;
}

table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

th, td {
  border-bottom: 1px solid var(--gray-100);
  padding: 8px 10px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  background: var(--gray-50);
  color: var(--gray-500);
  font-size: 10px;
  font-weight: 800;
  position: sticky;
  top: 0;
  z-index: 1;
}

.num {
  text-align: right;
}

.description-cell {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  align-items: center;
  color: var(--gray-400);
  display: flex;
  font-size: 12px;
  gap: 8px;
  justify-content: center;
  min-height: 64px;
}

.empty-state.compact {
  min-height: 36px;
}

/* Number extraction */
.rule-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.text-input,
.textarea {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  color: var(--gray-900);
  font: inherit;
  outline: none;
  padding: 8px 12px;
  font-size: 12px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.text-input {
  flex: 1 1 200px;
  min-width: 0;
  height: 34px;
}

.textarea {
  font-family: "SF Mono", Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  min-height: 120px;
  resize: vertical;
  width: 100%;
}

.textarea.small {
  min-height: 74px;
}

.text-input:focus,
.textarea:focus {
  background: var(--white);
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.radio-row,
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.radio-pill {
  align-items: center;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 999px;
  display: inline-flex;
  font-size: 11px;
  font-weight: 700;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.radio-pill:hover {
  border-color: var(--blue);
  background: var(--blue-light);
}

.radio-pill input[type="radio"] {
  accent-color: var(--blue);
}

.number-list-container {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  max-height: 240px;
  overflow: auto;
  padding: 8px;
}

.number-list,
.number-group {
  display: grid;
  gap: 6px;
}

.number-group + .number-group {
  margin-top: 12px;
  border-top: 1px solid var(--gray-200);
  padding-top: 12px;
}

.number-group h3 {
  color: var(--gray-900);
  font-size: 11px;
  font-weight: 800;
  margin: 0;
}

.number-group p {
  color: var(--gray-400);
  font-size: 10px;
  margin: 0;
}

.number-row {
  align-items: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 6px;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 6px 10px;
  transition: all 0.2s;
}
.number-row:hover {
  border-color: var(--blue);
  box-shadow: 0 2px 8px rgba(14,165,233,0.06);
}

.number-row span {
  color: var(--gray-400);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.number-row strong {
  font-family: monospace;
  font-size: 12px;
  color: var(--gray-900);
}

.jason-row-fade-enter-active,
.jason-row-fade-leave-active {
  transition: all 0.3s ease;
}

.jason-row-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.jason-row-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
