<template>
  <section class="it-invoice-page">
    <header class="page-header">
      <div class="brand">
        <div class="brand-icon">
          <AppIcon name="file-search" />
        </div>
        <div>
          <h1>PO 发票顺序重排</h1>
          <p>智能文档工作台</p>
        </div>
      </div>

      <label class="api-box">
        <span>API</span>
        <input v-model="apiBase" type="text" readonly aria-label="后端 API 地址">
      </label>
    </header>

    <main class="workbench-grid">
      <section class="left-stack">
        <article class="card card-invoice">
          <header class="card-header">
            <div class="card-heading">
              <div class="card-icon">
                <AppIcon name="file-search" />
              </div>
              <div>
                <h2>发票 PO 提取</h2>
                <p>上传发票 PDF 后生成 PO 顺序和明细</p>
              </div>
            </div>
            <span class="badge" :class="{ active: invoiceEntries.length > 0 }">
              {{ invoiceEntries.length }} 个PO
            </span>
          </header>

          <div class="card-body">
            <label
              class="dropzone"
              :class="{ 'has-file': Boolean(invoiceFile), dragging: draggingTarget === 'invoice' }"
              @dragenter.prevent="draggingTarget = 'invoice'"
              @dragover.prevent
              @dragleave.prevent="draggingTarget = null"
              @drop.prevent="handleSingleDrop($event, 'invoice')"
            >
              <input
                :key="invoiceInputKey"
                type="file"
                accept="application/pdf,.pdf"
                @change="handleSingleFileChange($event, 'invoice')"
              >
              <span class="dropzone-icon"><AppIcon name="upload" /></span>
              <strong>{{ invoiceFile ? invoiceFile.name : '选择或拖入发票 PDF' }}</strong>
              <span>{{ invoiceFile ? formatFileSize(invoiceFile.size) : '支持单个 .pdf 文件' }}</span>
            </label>

            <div class="toolbar">
              <button class="btn btn-soft" type="button" :disabled="isBusy('invoice-preview')" @click="previewInvoiceFile">
                <AppIcon :name="isBusy('invoice-preview') ? 'loader' : 'file-search'" />
                {{ isBusy('invoice-preview') ? '提取中...' : '提取发票' }}
              </button>
              <button class="btn btn-soft" type="button" @click="syncInvoiceToPoList()">
                <AppIcon name="refresh-cw" />
                同步到 PO 列表
              </button>
              <button class="btn" type="button" @click="copyInvoicePoOrder">
                <AppIcon name="files" />
                复制 PO
              </button>
              <button class="btn" type="button" @click="downloadInvoicePoOrder">
                <AppIcon name="download" />
                下载 TXT
              </button>
              <button class="btn" type="button" @click="downloadInvoiceDetailsCsv">
                <AppIcon name="download-cloud" />
                下载 CSV
              </button>
              <button class="btn btn-danger-soft" type="button" @click="clearInvoice">
                清空
              </button>
            </div>

            <div class="metrics">
              <div class="metric">
                <span>PO 数量</span>
                <strong>{{ invoiceEntries.length }}</strong>
              </div>
              <div class="metric">
                <span>总数量</span>
                <strong>{{ valueOrDash(invoiceSummary?.totalQuantity) }}</strong>
              </div>
              <div class="metric">
                <span>货品金额</span>
                <strong>{{ valueOrDash(invoiceSummary?.totalAmount) }}</strong>
              </div>
              <div class="metric">
                <span>发票总额</span>
                <strong>{{ valueOrDash(invoiceSummary?.invoiceTotals?.invoice_total) }}</strong>
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>PO</th>
                    <th>发票页</th>
                    <th>Article</th>
                    <th>描述</th>
                    <th class="num">数量</th>
                    <th class="num">货品金额</th>
                    <th class="num">净额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="invoiceEntries.length === 0">
                    <td colspan="8">
                      <div class="empty-state">
                        <AppIcon name="file-search" />
                        <span>等待上传发票 PDF 并提取数据</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="entry in invoiceEntries" v-else :key="`${entry.po}-${entry.index}`">
                    <td>{{ entry.index }}</td>
                    <td><strong>{{ entry.po }}</strong></td>
                    <td>{{ formatPages(entry.invoicePages) }}</td>
                    <td>{{ valueOrDash(entry.articleNo) }}</td>
                    <td class="description-cell">{{ valueOrDash(entry.description) }}</td>
                    <td class="num">{{ valueOrDash(entry.quantity) }}</td>
                    <td class="num">{{ valueOrDash(entry.totalAmount) }}</td>
                    <td class="num">{{ valueOrDash(entry.netAmount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <NoticeMessage :message="invoiceMessage.message" :tone="invoiceMessage.tone" />
          </div>
        </article>

        <article class="card">
          <header class="card-header compact-header">
            <div class="card-heading">
              <div class="card-icon">
                <AppIcon name="target" />
              </div>
              <div>
                <h2>自定义号码提取</h2>
                <p>从 PDF、粘贴文本或当前页面提取号码</p>
              </div>
            </div>
            <span class="badge">{{ extractNumbers.length }} 个号码</span>
          </header>

          <div class="card-body">
            <div class="rule-row">
              <input
                v-model="extractPattern"
                class="text-input"
                type="text"
                placeholder="如 090|45 或 \\d{10}"
                @keydown.enter.prevent="applyExtractionRule"
              >
              <button class="btn btn-soft" type="button" @click="applyExtractionRule">应用规则</button>
            </div>

            <div class="radio-row">
              <label v-for="option in extractTypeOptions" :key="option.value" class="radio-pill">
                <input v-model="extractSearchType" type="radio" :value="option.value">
                {{ option.label }}
              </label>
            </div>

            <div class="preset-row">
              <button class="btn" type="button" @click="setExtractPreset('090|45', 'startsWith')">090/45 开头</button>
              <button class="btn" type="button" @click="setExtractPreset('\\d{10}', 'regex')">10 位数字</button>
              <button class="btn" type="button" @click="setExtractPreset('45', 'contains')">包含 45</button>
            </div>

            <label
              class="dropzone mini-drop"
              :class="{ 'has-file': extractFiles.length > 0, dragging: draggingTarget === 'extract' }"
              @dragenter.prevent="draggingTarget = 'extract'"
              @dragover.prevent
              @dragleave.prevent="draggingTarget = null"
              @drop.prevent="handleExtractDrop"
            >
              <input
                :key="extractInputKey"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                @change="handleExtractFilesChange"
              >
              <span class="dropzone-icon"><AppIcon name="files" /></span>
              <strong>{{ extractFiles.length ? `${extractFiles.length} 个 PDF` : '选择用于提取的 PDF' }}</strong>
              <span>{{ extractFiles.length ? extractFiles.map((file) => file.name).join('，') : '可多选' }}</span>
            </label>

            <textarea
              v-model="pasteText"
              class="textarea small"
              placeholder="粘贴文本，然后点击从粘贴提取"
            />

            <div class="toolbar">
              <button class="btn btn-soft" type="button" :disabled="isBusy('extract-pdf')" @click="extractFromPdfFiles">
                <AppIcon :name="isBusy('extract-pdf') ? 'loader' : 'file-search'" />
                {{ isBusy('extract-pdf') ? '提取中...' : '从 PDF 提取' }}
              </button>
              <button class="btn btn-soft" type="button" @click="extractFromPaste">从粘贴提取</button>
              <button class="btn btn-soft" type="button" @click="extractFromPageText">抓取页面文本</button>
              <button class="btn" type="button" @click="copyExtractedNumbers">复制全部</button>
              <button class="btn" type="button" @click="downloadExtractedNumbers">下载 TXT</button>
              <button class="btn btn-danger-soft" type="button" @click="clearExtraction">清空</button>
            </div>

            <div class="number-list">
              <div v-if="extractNumbers.length === 0" class="empty-state compact">
                <span>等待提取号码</span>
              </div>
              <template v-else>
                <section v-for="group in extractGroups" :key="group.fileName" class="number-group">
                  <h3>{{ group.fileName }}</h3>
                  <template v-for="page in group.pages" :key="`${group.fileName}-${page.pageNum}`">
                    <p>第 {{ page.pageNum }} 页 · {{ page.numbers.length }} 个</p>
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
              </template>
            </div>

            <NoticeMessage :message="extractMessage.message" :tone="extractMessage.tone" />
          </div>
        </article>
      </section>

      <section class="right-stack">
        <article class="card output-card">
          <header class="card-header">
            <div class="card-heading">
              <div class="card-icon">
                <AppIcon name="check-circle" />
              </div>
              <div>
                <h2>PO PDF 匹配与生成</h2>
                <p>按左侧 PO 顺序生成重排 PDF</p>
              </div>
            </div>
            <span class="badge success">{{ poPages.size }} 个PO</span>
          </header>

          <div class="card-body">
            <label
              class="dropzone"
              :class="{ 'has-file': Boolean(poFile), dragging: draggingTarget === 'po' }"
              @dragenter.prevent="draggingTarget = 'po'"
              @dragover.prevent
              @dragleave.prevent="draggingTarget = null"
              @drop.prevent="handleSingleDrop($event, 'po')"
            >
              <input
                :key="poInputKey"
                type="file"
                accept="application/pdf,.pdf"
                @change="handleSingleFileChange($event, 'po')"
              >
              <span class="dropzone-icon"><AppIcon name="upload" /></span>
              <strong>{{ poFile ? poFile.name : '选择或拖入 PO PDF' }}</strong>
              <span>{{ poFile ? formatFileSize(poFile.size) : '支持单个 .pdf 文件' }}</span>
            </label>

            <div class="toolbar">
              <button class="btn btn-soft" type="button" :disabled="isBusy('po-preview')" @click="previewPoFile">
                <AppIcon :name="isBusy('po-preview') ? 'loader' : 'file-search'" />
                {{ isBusy('po-preview') ? '识别中...' : '识别 PO 页码' }}
              </button>
              <button class="btn btn-soft" type="button" @click="refreshMatches">
                <AppIcon name="refresh" />
                应用列表
              </button>
              <button class="btn" type="button" @click="copyPoOrderText">复制列表</button>
              <button class="btn btn-danger-soft" type="button" @click="clearPo">清空</button>
            </div>

            <div class="options-row">
              <label><input v-model="printCurrentOnly" type="checkbox"> 打印当前页</label>
              <label><input v-model="printNextPage" type="checkbox"> 同时打印下一页</label>
              <label><input v-model="includeNotFound" type="checkbox"> 摘要包含未找到 PO</label>
            </div>

            <label class="field-label" for="po-order-text">
              <span>PO 顺序列表</span>
              <small>{{ parsedPoCount }} 个有效 PO</small>
            </label>
            <textarea
              id="po-order-text"
              v-model="poOrderText"
              class="textarea"
              placeholder="4501749160&#10;4501749225&#10;4501749152"
            />

            <div class="generate-bar">
              <span :class="['status-text', resultStatusTone]">{{ resultStatusText }}</span>
              <div class="generate-actions">
                <a
                  v-if="downloadHref"
                  class="btn btn-success btn-lg"
                  :href="downloadHref"
                  :download="latestResult?.fileName"
                >
                  <AppIcon name="download" />
                  下载结果
                </a>
                <button
                  v-if="downloadHref"
                  class="btn btn-lg"
                  type="button"
                  @click="openResultPdf"
                >
                  打开 PDF
                </button>
                <button
                  class="btn btn-primary btn-lg"
                  type="button"
                  :disabled="!canGenerate || isBusy('generate')"
                  @click="generatePdf"
                >
                  <AppIcon :name="isBusy('generate') ? 'loader' : 'play-circle'" />
                  {{ isBusy('generate') ? '生成中...' : '生成重排 PDF' }}
                </button>
              </div>
            </div>

            <div class="toolbar result-tools">
              <button class="btn btn-warning-soft" type="button" @click="printSummary">
                打印摘要
              </button>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>PO</th>
                    <th>PO页</th>
                    <th>Article</th>
                    <th class="num">数量</th>
                    <th class="num">货品金额</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="matchRows.length === 0">
                    <td colspan="8">
                      <div class="empty-state">
                        <AppIcon name="file-search" />
                        <span>等待同步或输入 PO 列表</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="(row, index) in matchRows" v-else :key="row.po">
                    <td>{{ index + 1 }}</td>
                    <td><strong>{{ row.po }}</strong></td>
                    <td>{{ formatPages(row.pages) }}</td>
                    <td>{{ valueOrDash(row.articleNo) }}</td>
                    <td class="num">{{ valueOrDash(row.quantity) }}</td>
                    <td class="num">{{ valueOrDash(row.totalAmount) }}</td>
                    <td>
                      <span :class="['tag', row.found ? 'tag-success' : 'tag-warn']">
                        {{ row.found ? '已匹配' : '未找到' }}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-soft" type="button" :disabled="isBusy(`single-${row.po}`)" @click="generateSinglePo(row.po)">
                        {{ isBusy(`single-${row.po}`) ? '生成中...' : '单独生成' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <NoticeMessage :message="poMessage.message" :tone="poMessage.tone" />

            <p v-if="extraPoNumbers.length" class="extra-note">
              PO PDF 中有但当前列表未包含：{{ extraPoNumbers.join(', ') }}
            </p>
          </div>
        </article>

        <article class="card log-card">
          <header class="card-header compact-header">
            <div class="card-heading">
              <div class="card-icon">
                <AppIcon name="terminal" />
              </div>
              <div>
                <h2>处理日志</h2>
                <p>前端动作和后端返回摘要</p>
              </div>
            </div>
            <button class="btn" type="button" @click="clearLogs">清空日志</button>
          </header>
          <div class="log-list">
            <div v-for="line in logs" :key="line.id" class="log-line">
              <span>{{ line.time }}</span>
              <strong>{{ line.text }}</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'

import {
  getBackendBaseUrl,
  readErrorMessage,
} from '../../shared/api/backendClient'
import AppIcon from '../../shared/ui/AppIcon.vue'
import {
  buildJasonPdfReorderDownloadUrl,
  extractJasonPdfReorderNumbers,
  previewJasonPdfReorderInvoice,
  previewJasonPdfReorderPo,
  processJasonPdfReorder,
  type JasonPdfReorderEntry,
  type JasonPdfReorderExtractFile,
  type JasonPdfReorderExtractSearchType,
  type JasonPdfReorderProcessResponse,
  type JasonPdfReorderSummary,
} from './jasonPdfReorderApi'
import {
  buildInvoiceCsv,
  buildLocalExtractionGroup,
  buildMatchRows,
  buildPrintSummaryHtml,
  formatValue,
  invoicePoText,
  parsePoList,
  buildExtractionRegex,
} from './jasonPdfReorderModel'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type BusyAction =
  | 'invoice-preview'
  | 'po-preview'
  | 'extract-pdf'
  | 'generate'
  | `single-${string}`

interface NoticeState {
  message: string
  tone: NoticeTone
}

interface LogLine {
  id: number
  time: string
  text: string
}

const NoticeMessage = defineComponent({
  name: 'NoticeMessage',
  props: {
    message: {
      type: String,
      default: '',
    },
    tone: {
      type: String,
      default: 'info',
    },
  },
  setup(props) {
    return () =>
      props.message
        ? h('div', { class: ['notice', `notice-${props.tone}`] }, props.message)
        : null
  },
})

const extractTypeOptions: Array<{ label: string; value: JasonPdfReorderExtractSearchType }> = [
  { label: '开头匹配', value: 'startsWith' },
  { label: '包含', value: 'contains' },
  { label: '精确', value: 'exact' },
  { label: '正则', value: 'regex' },
]

const apiBase = ref('http://127.0.0.1:8000')
const invoiceFile = ref<File | null>(null)
const poFile = ref<File | null>(null)
const extractFiles = ref<File[]>([])
const invoiceInputKey = ref(0)
const poInputKey = ref(0)
const extractInputKey = ref(0)
const draggingTarget = ref<'invoice' | 'po' | 'extract' | null>(null)
const invoiceEntries = ref<JasonPdfReorderEntry[]>([])
const invoiceSummary = ref<JasonPdfReorderSummary | null>(null)
const poPages = ref<Map<string, number[]>>(new Map())
const extractGroups = ref<JasonPdfReorderExtractFile[]>([])
const extractNumbers = ref<string[]>([])
const extractPattern = ref('090|45')
const extractSearchType = ref<JasonPdfReorderExtractSearchType>('startsWith')
const pasteText = ref('')
const poOrderText = ref('')
const printCurrentOnly = ref(true)
const printNextPage = ref(true)
const includeNotFound = ref(false)
const latestResult = ref<JasonPdfReorderProcessResponse | null>(null)
const downloadHref = ref('')
const resultStatusText = ref('准备好后点击下方按钮生成重排 PDF')
const resultStatusTone = ref<'idle' | 'success' | 'error'>('idle')
const busyAction = ref<BusyAction | null>(null)
const logId = ref(0)
const logs = ref<LogLine[]>([
  { id: 0, time: '--:--:--', text: '等待操作' },
])

const invoiceMessage = reactive<NoticeState>({ message: '', tone: 'info' })
const extractMessage = reactive<NoticeState>({ message: '', tone: 'info' })
const poMessage = reactive<NoticeState>({ message: '', tone: 'info' })

const parsedPoCount = computed(() => parsePoList(poOrderText.value).length)
const canGenerate = computed(() => Boolean(invoiceFile.value && poFile.value))
const matchRows = computed(() =>
  buildMatchRows({
    poOrderText: poOrderText.value,
    invoiceEntries: invoiceEntries.value,
    poPages: poPages.value,
  }),
)
const extraPoNumbers = computed(() => {
  const selectedPo = new Set(parsePoList(poOrderText.value))
  return [...poPages.value.keys()].filter((po) => !selectedPo.has(po))
})

onMounted(async () => {
  apiBase.value = await getBackendBaseUrl()
})

function handleSingleFileChange(
  event: Event,
  kind: 'invoice' | 'po',
): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  if (kind === 'invoice') {
    invoiceFile.value = file
    return
  }

  poFile.value = file
}

function handleSingleDrop(
  event: DragEvent,
  kind: 'invoice' | 'po',
): void {
  draggingTarget.value = null
  const file = Array.from(event.dataTransfer?.files ?? []).find(isPdfFile) ?? null

  if (kind === 'invoice') {
    invoiceFile.value = file
    return
  }

  poFile.value = file
}

function handleExtractFilesChange(event: Event): void {
  const input = event.target as HTMLInputElement
  extractFiles.value = Array.from(input.files ?? []).filter(isPdfFile)
}

function handleExtractDrop(event: DragEvent): void {
  draggingTarget.value = null
  extractFiles.value = Array.from(event.dataTransfer?.files ?? []).filter(isPdfFile)
}

async function previewInvoiceFile(): Promise<void> {
  if (!invoiceFile.value) {
    setNotice(invoiceMessage, '请先选择发票 PDF', 'error')
    return
  }

  busyAction.value = 'invoice-preview'
  setNotice(invoiceMessage, '正在提取发票数据...', 'info')
  addLog(`[前端] 开始提取发票：${invoiceFile.value.name}`)

  try {
    const response = await previewJasonPdfReorderInvoice(invoiceFile.value)
    addBackendLogs(response.logs)
    invoiceEntries.value = response.entries || []
    invoiceSummary.value = response.summary || null
    syncInvoiceToPoList(false)
    setNotice(invoiceMessage, `已提取 ${invoiceEntries.value.length} 个 PO`, 'success')
    addLog('[前端] 发票提取完成')
  } catch (error) {
    const message = readErrorMessage(error, '发票提取失败')
    setNotice(invoiceMessage, message, 'error')
    addLog(`[前端] 发票提取失败：${message}`)
  } finally {
    busyAction.value = null
  }
}

async function previewPoFile(): Promise<void> {
  if (!poFile.value) {
    setNotice(poMessage, '请先选择 PO PDF', 'error')
    return
  }

  busyAction.value = 'po-preview'
  setNotice(poMessage, '正在识别 PO 页码...', 'info')
  addLog(`[前端] 开始识别 PO PDF：${poFile.value.name}`)

  try {
    const response = await previewJasonPdfReorderPo(poFile.value)
    addBackendLogs(response.logs)
    poPages.value = new Map((response.poPages || []).map((item) => [item.po, item.pages || []]))
    setNotice(poMessage, `已识别 ${response.poCount || 0} 个 PO，共 ${response.pageCount || 0} 页`, 'success')
    addLog('[前端] PO 页码识别完成')
  } catch (error) {
    const message = readErrorMessage(error, 'PO 页码识别失败')
    setNotice(poMessage, message, 'error')
    addLog(`[前端] PO 页码识别失败：${message}`)
  } finally {
    busyAction.value = null
  }
}

async function extractFromPdfFiles(): Promise<void> {
  if (extractFiles.value.length === 0) {
    setNotice(extractMessage, '请先选择用于提取的 PDF', 'error')
    return
  }

  busyAction.value = 'extract-pdf'
  setNotice(extractMessage, '正在按规则提取 PDF 号码...', 'info')
  addLog(`[前端] 开始自定义数字提取，文件数：${extractFiles.value.length}`)

  try {
    const response = await extractJasonPdfReorderNumbers({
      files: extractFiles.value,
      pattern: extractPattern.value.trim(),
      searchType: extractSearchType.value,
    })
    addBackendLogs(response.logs)
    extractGroups.value = response.files || []
    extractNumbers.value = response.numbers || []
    syncExtractedTenDigitsToPoList()
    setNotice(extractMessage, `已提取 ${extractNumbers.value.length} 个号码`, 'success')
    addLog('[前端] 自定义数字提取完成')
  } catch (error) {
    const message = readErrorMessage(error, '号码提取失败')
    setNotice(extractMessage, message, 'error')
    addLog(`[前端] 号码提取失败：${message}`)
  } finally {
    busyAction.value = null
  }
}

function extractFromPaste(): void {
  if (!pasteText.value.trim()) {
    setNotice(extractMessage, '请先粘贴文本', 'error')
    return
  }

  addLocalExtraction('粘贴文本', pasteText.value)
}

function extractFromPageText(): void {
  addLocalExtraction('页面文本', document.body.innerText || '')
}

function addLocalExtraction(fileName: string, text: string): void {
  try {
    const { group, numbers } = buildLocalExtractionGroup(
      fileName,
      text,
      extractPattern.value,
      extractSearchType.value,
      extractNumbers.value,
    )

    if (numbers.length === 0) {
      setNotice(extractMessage, '未找到新的匹配号码', 'warning')
      return
    }

    extractGroups.value = [group, ...extractGroups.value]
    extractNumbers.value = [...extractNumbers.value, ...numbers]
    syncExtractedTenDigitsToPoList()
    setNotice(extractMessage, `新增 ${numbers.length} 个号码`, 'success')
    addLog(`[前端] ${fileName}新增 ${numbers.length} 个号码`)
  } catch (error) {
    setNotice(extractMessage, readErrorMessage(error, '号码提取失败'), 'error')
  }
}

function applyExtractionRule(): void {
  try {
    buildExtractionRegex(extractPattern.value, extractSearchType.value)
    setNotice(extractMessage, '规则已应用', 'success')
  } catch (error) {
    setNotice(extractMessage, readErrorMessage(error, '提取规则无效'), 'error')
  }
}

function setExtractPreset(pattern: string, type: JasonPdfReorderExtractSearchType): void {
  extractPattern.value = pattern
  extractSearchType.value = type
  applyExtractionRule()
}

async function generatePdf(): Promise<void> {
  if (!invoiceFile.value || !poFile.value) {
    setNotice(poMessage, '请先上传发票 PDF 和 PO PDF', 'error')
    return
  }

  busyAction.value = 'generate'
  downloadHref.value = ''
  resultStatusText.value = '正在生成重排 PDF，请稍候...'
  resultStatusTone.value = 'idle'
  setNotice(poMessage, '正在生成重排 PDF...', 'info')
  addLog('[前端] 开始生成重排 PDF')

  try {
    const response = await processJasonPdfReorder({
      invoiceFile: invoiceFile.value,
      poFile: poFile.value,
      poOrderText: poOrderText.value,
      printCurrentOnly: printCurrentOnly.value,
      printNextPage: printNextPage.value,
      includeNotFound: includeNotFound.value,
    })
    await applyProcessResult(response)
    setNotice(poMessage, `生成完成：${response.fileName}`, 'success')
    resultStatusText.value = '生成成功，可下载结果文件'
    resultStatusTone.value = 'success'
    addLog('[前端] 重排 PDF 生成完成')
  } catch (error) {
    const message = readErrorMessage(error, '生成失败，请检查输入后重试')
    setNotice(poMessage, message, 'error')
    resultStatusText.value = '生成失败，请检查输入后重试'
    resultStatusTone.value = 'error'
    addLog(`[前端] PDF 生成失败：${message}`)
  } finally {
    busyAction.value = null
  }
}

async function generateSinglePo(po: string): Promise<void> {
  if (!invoiceFile.value || !poFile.value) {
    setNotice(poMessage, '请先上传发票 PDF 和 PO PDF', 'error')
    return
  }

  busyAction.value = `single-${po}`
  setNotice(poMessage, `正在生成单个 PO：${po}`, 'info')

  try {
    const response = await processJasonPdfReorder({
      invoiceFile: invoiceFile.value,
      poFile: poFile.value,
      poOrderText: po,
      printCurrentOnly: printCurrentOnly.value,
      printNextPage: printNextPage.value,
      includeNotFound: includeNotFound.value,
    })
    await applyProcessResult(response)
    setNotice(poMessage, `单个 PO 生成完成：${po}`, 'success')
    openResultPdf()
  } catch (error) {
    setNotice(poMessage, readErrorMessage(error, '单个 PO 生成失败'), 'error')
  } finally {
    busyAction.value = null
  }
}

async function applyProcessResult(response: JasonPdfReorderProcessResponse): Promise<void> {
  addBackendLogs(response.logs)
  latestResult.value = response
  invoiceEntries.value = response.entries || invoiceEntries.value
  invoiceSummary.value = response.summary || invoiceSummary.value
  downloadHref.value = await buildJasonPdfReorderDownloadUrl(response.downloadUrl)
}

function openResultPdf(): void {
  if (!downloadHref.value) {
    setNotice(poMessage, '请先生成结果 PDF', 'warning')
    return
  }

  window.open(downloadHref.value, '_blank')
}

function printSummary(): void {
  const entries = latestResult.value?.entries?.length
    ? latestResult.value.entries
    : invoiceEntries.value

  if (entries.length === 0) {
    setNotice(poMessage, '没有可打印的摘要，请先提取发票或生成结果', 'warning')
    return
  }

  const html = buildPrintSummaryHtml(
    entries,
    latestResult.value?.summary || invoiceSummary.value || {},
    poPages.value,
    includeNotFound.value,
  )
  const popup = window.open('', '_blank')

  if (!popup) {
    window.print()
    return
  }

  popup.document.write(html)
  popup.document.close()
  popup.focus()
  popup.print()
}

function syncInvoiceToPoList(showMessage = true): void {
  poOrderText.value = invoicePoText(invoiceEntries.value)

  if (showMessage) {
    setNotice(
      poMessage,
      poOrderText.value ? '已同步发票 PO 顺序到右侧列表' : '没有可同步的 PO',
      poOrderText.value ? 'success' : 'warning',
    )
  }
}

function syncExtractedTenDigitsToPoList(): void {
  const numbers = extractNumbers.value.filter((number) => /^\d{10}$/.test(number))

  if (numbers.length > 0) {
    poOrderText.value = numbers.join('\n')
  }
}

function refreshMatches(): void {
  setNotice(
    poMessage,
    parsedPoCount.value ? `已应用 ${parsedPoCount.value} 个 PO` : '当前列表没有有效 PO',
    parsedPoCount.value ? 'success' : 'warning',
  )
}

async function copyInvoicePoOrder(): Promise<void> {
  await copyText(invoicePoText(invoiceEntries.value), invoiceMessage, '已复制发票 PO 顺序')
}

function downloadInvoicePoOrder(): void {
  downloadText('invoice_po_order.txt', invoicePoText(invoiceEntries.value), invoiceMessage)
}

function downloadInvoiceDetailsCsv(): void {
  if (invoiceEntries.value.length === 0) {
    setNotice(invoiceMessage, '没有可下载的发票明细', 'warning')
    return
  }

  downloadText('invoice_po_details.csv', `\ufeff${buildInvoiceCsv(invoiceEntries.value)}`, invoiceMessage, 'text/csv;charset=utf-8')
}

async function copyExtractedNumbers(): Promise<void> {
  await copyText(extractNumbers.value.join('\n'), extractMessage, '已复制全部提取号码')
}

function downloadExtractedNumbers(): void {
  downloadText('extracted_numbers.txt', extractNumbers.value.join('\n'), extractMessage)
}

async function copyPoOrderText(): Promise<void> {
  await copyText(poOrderText.value, poMessage, '已复制当前 PO 列表')
}

async function copyText(
  text: string,
  target: NoticeState,
  successMessage: string,
): Promise<void> {
  if (!text.trim()) {
    setNotice(target, '没有可复制的内容', 'warning')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    setNotice(target, successMessage, 'success')
  } catch {
    setNotice(target, '浏览器未允许复制，请手动选择文本复制', 'warning')
  }
}

function downloadText(
  filename: string,
  text: string,
  target: NoticeState,
  type = 'text/plain;charset=utf-8',
): void {
  if (!text.trim()) {
    setNotice(target, '没有可下载的内容', 'warning')
    return
  }

  const blob = new Blob([text], { type })
  const anchor = document.createElement('a')
  const url = URL.createObjectURL(blob)

  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function clearInvoice(): void {
  invoiceFile.value = null
  invoiceEntries.value = []
  invoiceSummary.value = null
  invoiceInputKey.value += 1
  syncInvoiceToPoList(false)
  setNotice(invoiceMessage, '已清空发票数据', 'info')
}

function clearPo(): void {
  poFile.value = null
  poPages.value = new Map()
  poOrderText.value = ''
  latestResult.value = null
  downloadHref.value = ''
  poInputKey.value += 1
  resultStatusText.value = '准备好后点击下方按钮生成重排 PDF'
  resultStatusTone.value = 'idle'
  setNotice(poMessage, '已清空 PO 数据', 'info')
}

function clearExtraction(): void {
  extractFiles.value = []
  extractGroups.value = []
  extractNumbers.value = []
  pasteText.value = ''
  extractInputKey.value += 1
  setNotice(extractMessage, '已清空提取结果', 'info')
}

function clearLogs(): void {
  logs.value = [{ id: 0, time: '--:--:--', text: '等待操作' }]
  logId.value = 0
}

function setNotice(target: NoticeState, message: string, tone: NoticeTone): void {
  target.message = message
  target.tone = tone
}

function addBackendLogs(lines: string[] | undefined): void {
  for (const line of lines || []) {
    addLog(`[后端] ${line}`)
  }
}

function addLog(text: string): void {
  const line: LogLine = {
    id: ++logId.value,
    time: new Date().toLocaleTimeString(),
    text,
  }

  if (logs.value.length === 1 && logs.value[0]?.id === 0) {
    logs.value = [line]
    return
  }

  logs.value = [...logs.value, line].slice(-80)
}

function isBusy(action: BusyAction): boolean {
  return busyAction.value === action
}

function numberIndex(number: string): string {
  const index = extractNumbers.value.indexOf(number)
  return String(index + 1).padStart(3, '0')
}

function valueOrDash(value: unknown): string {
  return formatValue(value)
}

function formatPages(pages: number[] | undefined): string {
  return pages && pages.length > 0 ? pages.join(', ') : '-'
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}
</script>

<style scoped>
.it-invoice-page {
  --white: #ffffff;
  --gray-50: #f8fafc;
  --gray-100: #eef2f7;
  --gray-200: #dde4ee;
  --gray-300: #c4cfdd;
  --gray-400: #8996a8;
  --gray-500: #647085;
  --gray-700: #2f3a4a;
  --gray-900: #111827;
  --blue: #2563eb;
  --blue-light: #e8f0fe;
  --blue-dark: #1d4ed8;
  --green: #138a46;
  --green-light: #e3f5e9;
  --amber: #b7791f;
  --amber-light: #fff3d4;
  --red: #cf2e2e;
  --red-light: #ffe5e5;
  color: var(--gray-700);
  display: grid;
  gap: 18px;
}

.page-header,
.card {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
}

.page-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px 20px;
}

.brand,
.card-heading {
  align-items: center;
  display: flex;
  gap: 12px;
}

.brand h1,
.card h2,
.number-group h3 {
  color: var(--gray-900);
  margin: 0;
}

.brand h1 {
  font-size: 20px;
  line-height: 1.2;
}

.brand p,
.card p {
  color: var(--gray-500);
  font-size: 12px;
  margin: 3px 0 0;
}

.brand-icon,
.card-icon,
.dropzone-icon {
  align-items: center;
  background: var(--gray-100);
  border-radius: 8px;
  color: var(--gray-500);
  display: inline-flex;
  justify-content: center;
}

.brand-icon {
  font-size: 22px;
  height: 42px;
  width: 42px;
}

.card-icon {
  font-size: 18px;
  height: 36px;
  width: 36px;
}

.api-box {
  align-items: center;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 999px;
  display: flex;
  gap: 8px;
  padding: 5px 5px 5px 14px;
}

.api-box span {
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 700;
}

.api-box input {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 999px;
  color: var(--gray-700);
  font-size: 13px;
  padding: 7px 12px;
  width: 220px;
}

.workbench-grid {
  align-items: start;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
}

.left-stack,
.right-stack {
  display: grid;
  gap: 18px;
}

.card {
  overflow: hidden;
}

.card-header {
  align-items: flex-start;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 16px 18px;
}

.compact-header {
  align-items: center;
}

.card-body {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.card-invoice .card-header {
  background: #f3f6fa;
}

.output-card .card-header {
  background: #f1f7f3;
}

.badge {
  background: var(--gray-100);
  border-radius: 999px;
  color: var(--gray-500);
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
}

.badge.active {
  background: var(--blue-light);
  color: var(--blue);
}

.badge.success {
  background: var(--green-light);
  color: var(--green);
}

.dropzone {
  align-items: center;
  background: var(--gray-50);
  border: 2px dashed var(--gray-300);
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  gap: 8px;
  justify-items: center;
  min-height: 118px;
  padding: 18px;
  text-align: center;
}

.dropzone input {
  display: none;
}

.dropzone strong {
  color: var(--gray-700);
  font-size: 14px;
}

.dropzone span:last-child {
  color: var(--gray-400);
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropzone-icon {
  background: var(--white);
  font-size: 20px;
  height: 42px;
  width: 42px;
}

.dropzone.dragging,
.dropzone:hover {
  background: var(--blue-light);
  border-color: var(--blue);
}

.dropzone.has-file {
  background: var(--white);
  border-style: solid;
}

.mini-drop {
  min-height: 88px;
}

.toolbar,
.radio-row,
.preset-row,
.options-row,
.generate-actions,
.rule-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rule-row {
  align-items: center;
}

.text-input,
.textarea {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  color: var(--gray-700);
  font: inherit;
  outline: none;
  padding: 10px 12px;
}

.text-input {
  flex: 1 1 220px;
  min-width: 0;
}

.textarea {
  font-family: "SF Mono", Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.6;
  min-height: 132px;
  resize: vertical;
  width: 100%;
}

.textarea.small {
  min-height: 82px;
}

.text-input:focus,
.textarea:focus {
  background: var(--white);
  border-color: var(--blue);
}

.btn {
  align-items: center;
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 6px;
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
  text-decoration: none;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn-soft {
  background: var(--blue-light);
  border-color: transparent;
  color: var(--blue);
}

.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: var(--white);
}

.btn-primary:hover:not(:disabled) {
  background: var(--blue-dark);
  border-color: var(--blue-dark);
}

.btn-success {
  background: var(--green);
  border-color: var(--green);
  color: var(--white);
}

.btn-danger-soft {
  background: var(--red-light);
  border-color: transparent;
  color: var(--red);
}

.btn-warning-soft {
  background: var(--amber-light);
  border-color: transparent;
  color: var(--amber);
}

.btn-lg {
  font-size: 13px;
  min-height: 42px;
  padding: 10px 16px;
}

.metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  display: grid;
  gap: 6px;
  padding: 12px;
}

.metric span {
  color: var(--gray-400);
  font-size: 11px;
  font-weight: 700;
}

.metric strong {
  color: var(--gray-900);
  font-size: 18px;
  overflow-wrap: anywhere;
}

.table-wrap {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  max-height: 360px;
  overflow: auto;
}

table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid var(--gray-100);
  padding: 9px 10px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  background: var(--gray-50);
  color: var(--gray-500);
  font-size: 11px;
  font-weight: 800;
  position: sticky;
  top: 0;
  z-index: 1;
}

.num {
  text-align: right;
}

.description-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  align-items: center;
  color: var(--gray-400);
  display: flex;
  font-size: 13px;
  gap: 8px;
  justify-content: center;
  min-height: 74px;
}

.empty-state.compact {
  min-height: 42px;
}

.notice {
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 12px;
}

.notice-info {
  background: var(--blue-light);
  color: var(--blue);
}

.notice-success {
  background: var(--green-light);
  color: var(--green);
}

.notice-warning {
  background: var(--amber-light);
  color: var(--amber);
}

.notice-error {
  background: var(--red-light);
  color: var(--red);
}

.radio-pill,
.options-row label {
  align-items: center;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  gap: 6px;
  padding: 7px 10px;
}

.number-list {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  max-height: 280px;
  overflow: auto;
  padding: 12px;
}

.number-group {
  display: grid;
  gap: 6px;
}

.number-group + .number-group {
  margin-top: 12px;
}

.number-group h3,
.number-group p {
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 800;
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
  padding: 7px 9px;
}

.number-row span {
  color: var(--gray-400);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.field-label {
  align-items: center;
  color: var(--gray-600);
  display: flex;
  font-size: 12px;
  font-weight: 800;
  justify-content: space-between;
}

.field-label small {
  color: var(--gray-400);
  font-weight: 700;
}

.generate-bar {
  align-items: center;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 14px;
}

.status-text {
  color: var(--gray-500);
  font-size: 13px;
  font-weight: 700;
}

.status-text.success {
  color: var(--green);
}

.status-text.error {
  color: var(--red);
}

.result-tools {
  justify-content: flex-end;
}

.tag {
  border-radius: 999px;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 9px;
}

.tag-success {
  background: var(--green-light);
  color: var(--green);
}

.tag-warn {
  background: var(--amber-light);
  color: var(--amber);
}

.extra-note {
  background: var(--amber-light);
  border-radius: 6px;
  color: var(--amber);
  font-size: 12px;
  font-weight: 700;
  margin: 0;
  padding: 9px 12px;
}

.log-card .card-header {
  padding-bottom: 12px;
  padding-top: 12px;
}

.log-list {
  display: grid;
  gap: 6px;
  max-height: 260px;
  overflow: auto;
  padding: 14px 18px 18px;
}

.log-line {
  align-items: baseline;
  display: grid;
  gap: 10px;
  grid-template-columns: 80px minmax(0, 1fr);
}

.log-line span {
  color: var(--gray-400);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.log-line strong {
  color: var(--gray-600);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .page-header,
  .generate-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .api-box {
    border-radius: 8px;
  }

  .api-box input {
    width: 100%;
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .btn,
  .generate-actions {
    width: 100%;
  }
}
</style>
