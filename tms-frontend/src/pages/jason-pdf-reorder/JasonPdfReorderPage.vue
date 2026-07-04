<template>
  <section class="it-invoice-page">
    <!-- === Workbench Top Header === -->
    <ReorderHeader />

    <!-- === Fast Reorder Shortcut Bar === -->
    <FastReorderBar
      v-model:invoiceFile="invoiceFile"
      v-model:poFile="poFile"
      :isBusy="isBusy"
      :downloadHref="downloadHref"
      :latestResult="latestResult"
      @clearInvoice="clearInvoice"
      @clearPo="clearPo"
      @fastReorder="handleFastReorder"
      @openResult="openResultPdf"
      @clearAll="clearAllFiles"
    />

    <!-- === Main Layout Grid === -->
    <main class="workbench-grid">
      <!-- ===== LEFT STACK: STEP 1 - EXTRACTION SOURCE CONTROL (左侧提取源) ===== -->
      <ExtractionSourcePanel
        v-model:activeTab="activeTab"
        v-model:invoiceFile="invoiceFile"
        v-model:extractFiles="extractFiles"
        v-model:extractPattern="extractPattern"
        v-model:extractSearchType="extractSearchType"
        v-model:pasteText="pasteText"
        :invoiceEntries="invoiceEntries"
        :invoiceSummary="invoiceSummary"
        :extractNumbers="extractNumbers"
        :extractGroups="extractGroups"
        :isBusy="isBusy"
        :invoiceInputKey="invoiceInputKey"
        :extractInputKey="extractInputKey"
        @previewInvoice="previewInvoiceFile"
        @syncInvoice="syncInvoiceToPoList"
        @copyInvoice="copyInvoicePoOrder"
        @downloadInvoiceTxt="downloadInvoicePoOrder"
        @downloadInvoiceCsv="downloadInvoiceDetailsCsv"
        @clearInvoice="clearInvoice"
        @applyExtractionRule="applyExtractionRule"
        @setExtractPreset="setExtractPreset"
        @extractFromPdf="extractFromPdfFiles"
        @extractFromPaste="extractFromPaste"
        @extractFromPageText="extractFromPageText"
        @copyExtracted="copyExtractedNumbers"
        @downloadExtracted="downloadExtractedNumbers"
        @clearExtraction="clearExtraction"
      >
        <template #invoice-message>
          <NoticeMessage :message="invoiceMessage.message" :tone="invoiceMessage.tone" />
        </template>
        <template #extract-message>
          <NoticeMessage :message="extractMessage.message" :tone="extractMessage.tone" />
        </template>
      </ExtractionSourcePanel>

      <!-- ===== MIDDLE STACK: STEP 2 - AUDIT & REORDER CENTER (中侧核对与排序) ===== -->
      <AuditReorderPanel
        v-model:poOrderText="poOrderText"
        :matchRows="matchRows"
        :extraPoNumbers="extraPoNumbers"
        :parsedPoCount="parsedPoCount"
        :isBusy="isBusy"
        @refreshMatches="refreshMatches"
        @copyPoOrder="copyPoOrderText"
        @clearPoOrderOnly="clearPoOrderOnly"
        @generateSinglePo="generateSinglePo"
        @printSummary="printSummary"
      >
        <template #po-message>
          <NoticeMessage :message="poMessage.message" :tone="poMessage.tone" />
        </template>
      </AuditReorderPanel>

      <!-- ===== RIGHT STACK: STEP 3 - FOCUS GENERATION & LOG (右侧核心匹配重排与日志) ===== -->
      <GenerationLogPanel
        v-model:poFile="poFile"
        v-model:printCurrentOnly="printCurrentOnly"
        v-model:printNextPage="printNextPage"
        v-model:includeNotFound="includeNotFound"
        v-model:isLogSidebarOpen="isLogSidebarOpen"
        :poPagesSize="poPages.size"
        :resultStatusText="resultStatusText"
        :resultStatusTone="resultStatusTone"
        :downloadHref="downloadHref"
        :latestResult="latestResult"
        :canGenerate="canGenerate"
        :logs="logs"
        :isBusy="isBusy"
        :poInputKey="poInputKey"
        @previewPo="previewPoFile"
        @clearPo="clearPo"
        @generatePdf="generatePdf"
        @openResult="openResultPdf"
        @clearLogs="clearLogs"
      />
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
import ReorderHeader from './components/ReorderHeader.vue'
import FastReorderBar from './components/FastReorderBar.vue'
import ExtractionSourcePanel from './components/ExtractionSourcePanel.vue'
import AuditReorderPanel from './components/AuditReorderPanel.vue'
import GenerationLogPanel from './components/GenerationLogPanel.vue'

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
const apiBase = ref('http://127.0.0.1:8000')
const activeTab = ref<'invoice' | 'extract'>('invoice')
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
const isLogSidebarOpen = ref(false)

const invoiceMessage = reactive<NoticeState>({ message: '', tone: 'info' })
const extractMessage = reactive<NoticeState>({ message: '', tone: 'info' })
const poMessage = reactive<NoticeState>({ message: '', tone: 'info' })

const parsedPoList = computed(() => parsePoList(poOrderText.value))
const parsedPoCount = computed(() => parsedPoList.value.length)
const canGenerate = computed(() => Boolean(poFile.value && parsedPoCount.value > 0))
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
    poPages.value = new Map((response.poPages || []).map((item: any) => [item.po, item.pages || []]))
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
  if (!poFile.value) {
    setNotice(poMessage, '请先上传 PO 原始文件 PDF', 'error')
    return
  }

  if (parsedPoCount.value === 0) {
    setNotice(poMessage, '请先在排序与核对中心输入 PO 顺序，或上传发票 PDF 自动提取', 'error')
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
  if (!poFile.value) {
    setNotice(poMessage, '请先上传 PO 原始文件 PDF', 'error')
    return
  }

  if (!parsePoList(po).length) {
    setNotice(poMessage, '当前 PO 无效，无法单独生成', 'error')
    return
  }

  busyAction.value = `single-${po}`
  downloadHref.value = ''
  resultStatusText.value = `正在单独生成 PO ${po} 的重排 PDF，请稍候...`
  resultStatusTone.value = 'idle'
  setNotice(poMessage, `正在生成单个 PO：${po}`, 'info')
  addLog(`[前端] 开始单独生成 PO：${po}`)

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
    resultStatusText.value = `PO ${po} 生成成功，可下载结果文件`
    resultStatusTone.value = 'success'
    addLog(`[前端] 单独生成 PO 完成：${po}`)
  } catch (error) {
    const message = readErrorMessage(error, '单个 PO 生成失败')
    setNotice(poMessage, message, 'error')
    resultStatusText.value = `PO ${po} 生成失败，请检查输入后重试`
    resultStatusTone.value = 'error'
    addLog(`[前端] 单独生成 PO ${po} 失败：${message}`)
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
  setNotice(invoiceMessage, '已清空发票数据', 'info')
}

function clearPo(): void {
  poFile.value = null
  poPages.value = new Map()
  latestResult.value = null
  downloadHref.value = ''
  poInputKey.value += 1
  resultStatusText.value = '准备好后点击下方按钮生成重排 PDF'
  resultStatusTone.value = 'idle'
  setNotice(poMessage, '已清空 PO 数据', 'info')
}

function clearPoOrderOnly(): void {
  poOrderText.value = ''
  setNotice(poMessage, '已清空 PO 列表', 'info')
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

async function handleFastReorder(): Promise<void> {
  if (!invoiceFile.value || !poFile.value) {
    setNotice(poMessage, '请先上传发票 PDF 和 PO PDF', 'error')
    return
  }

  busyAction.value = 'generate'
  downloadHref.value = ''
  resultStatusText.value = '正在执行极速重排，请稍候...'
  resultStatusTone.value = 'idle'
  addLog('[极速重排] 启动闪电极速重排流程')

  try {
    // 步骤一：提取发票
    addLog('[极速重排] 步骤 1/3: 正在提取发票数据...')
    const invoiceResp = await previewJasonPdfReorderInvoice(invoiceFile.value)
    addBackendLogs(invoiceResp.logs)
    invoiceEntries.value = invoiceResp.entries || []
    invoiceSummary.value = invoiceResp.summary || null
    // 自动同步发票的 PO 顺序到列表
    poOrderText.value = invoicePoText(invoiceEntries.value)
    addLog(`[极速重排] 发票数据提取完成，共获取 ${invoiceEntries.value.length} 个 PO`)

    // 步骤二：识别 PO 页码
    addLog('[极速重排] 步骤 2/3: 正在识别 PO 页码...')
    const poResp = await previewJasonPdfReorderPo(poFile.value)
    addBackendLogs(poResp.logs)
    poPages.value = new Map((poResp.poPages || []).map((item: any) => [item.po, item.pages || []]))
    addLog(`[极速重排] PO 页码识别完成，共 ${poResp.poCount || 0} 个 PO`)

    // 步骤三：重排生成 PDF
    addLog('[极速重排] 步骤 3/3: 正在生成重排后 PDF...')
    const processResp = await processJasonPdfReorder({
      invoiceFile: invoiceFile.value,
      poFile: poFile.value,
      poOrderText: poOrderText.value,
      printCurrentOnly: printCurrentOnly.value,
      printNextPage: printNextPage.value,
      includeNotFound: includeNotFound.value,
    })
    await applyProcessResult(processResp)
    
    setNotice(poMessage, `极速生成完成：${processResp.fileName}`, 'success')
    resultStatusText.value = '生成成功，可下载结果文件'
    resultStatusTone.value = 'success'
    addLog('[极速重排] 闪电极速重排完成！')
  } catch (error) {
    const message = readErrorMessage(error, '极速重排失败，请检查输入后重试')
    setNotice(poMessage, message, 'error')
    resultStatusText.value = '生成失败，请检查输入后重试'
    resultStatusTone.value = 'error'
    addLog(`[极速重排] 极速重排失败：${message}`)
  } finally {
    busyAction.value = null
  }
}

function clearAllFiles(): void {
  clearInvoice()
  clearPo()
  clearPoOrderOnly()
  addLog('[前端] 已清空全部文件')
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

function isBusy(action: string): boolean {
  return busyAction.value === (action as BusyAction)
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
/* ==========================================================================
   Jason PO/Invoice PDF Reordering — Layout and Themes
   Colors: Sky Blue (#0ea5e9) + Emerald Green (#10b981). No Purple.
   ========================================================================== */

/* Layout & Entrance */
.it-invoice-page {
  --white: #ffffff;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
  --gray-200: #e2e8f0;
  --gray-300: #cbd5e1;
  --gray-400: #94a3b8;
  --gray-500: #64748b;
  --gray-700: #334155;
  --gray-900: #0f172a;
  
  --blue: #0ea5e9;
  --blue-light: #f0f9ff;
  --blue-dark: #0284c7;
  
  --green: #10b981;
  --green-light: #ecfdf5;
  --green-dark: #059669;
  
  --amber: #f59e0b;
  --amber-light: #fef3c7;
  --red: #ef4444;
  --red-light: #fef2f2;
  
  color: var(--gray-700);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 40px);
  padding: 4px 16px 16px;
  box-sizing: border-box;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Staggered entry animation */
.jason-entry-anim {
  animation: jason-slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes jason-slideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.workbench-grid {
  flex: 1;
  min-height: 0;
  align-items: stretch;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr);
}

.workbench-col {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Local Notice Message styling */
.notice {
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;
  border: 1px solid;
}

.notice-info {
  background: var(--blue-light);
  border-color: #bee3f8;
  color: var(--blue-dark);
}

.notice-success {
  background: var(--green-light);
  border-color: #c6f6d5;
  color: var(--green-dark);
}

.notice-warning {
  background: var(--amber-light);
  border-color: #fef3c7;
  color: var(--amber);
}

.notice-error {
  background: var(--red-light);
  border-color: #fed7d7;
  color: var(--red);
}

/* Responsive constraints */
@media (max-width: 1380px) {
  .workbench-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }
  .workbench-col--right {
    grid-column: span 2;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 16px;
    align-items: start;
  }
}

@media (max-width: 960px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
  .workbench-col--right {
    grid-column: span 1;
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
}

</style>
