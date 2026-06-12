<template>
  <section class="s2-page">
    <div class="s2-top">
      <button class="s2-back" type="button" @click="goBack">
        <AppIcon name="arrow-left" />
        <span>{{ text('返回') }}</span>
      </button>
      <span class="s2-badge s2-badge--scene">
        <AppIcon name="bot" />
        {{ text('自动化场景') }}
      </span>
    </div>

    <header class="s2-hero">
      <div class="s2-hero__icon">
        <AppIcon name="bot" />
      </div>
      <div class="s2-hero__text">
        <h1>{{ entry ? text(entry.title) : text('未找到入口') }}</h1>
        <p>{{ entry ? text(entry.subtitle) : text('当前入口不存在，请返回列表重新选择。') }}</p>
      </div>
    </header>

    <transition name="s2-msg">
      <div v-if="message" class="s2-alert" :class="`s2-alert--${messageTone}`">
        <AppIcon :name="messageIconName" />
        <span>{{ text(message) }}</span>
      </div>
    </transition>

    <div v-if="!entry" class="s2-empty">
      <div class="s2-empty__icon">
        <AppIcon name="alert-circle" />
      </div>
      <strong>{{ text('入口不存在') }}</strong>
      <span>{{ text('请返回 Eric - Infornexus 页面重新选择场景。') }}</span>
    </div>

    <template v-else>
      <div class="s2-strip">
        <div class="s2-strip__item">
          <div class="s2-strip__icon s2-strip__icon--blue">
            <AppIcon name="monitor-code" />
          </div>
          <div class="s2-strip__body">
            <span class="s2-strip__label">{{ text('运行模式') }}</span>
            <strong>{{ electronSupported ? 'Electron' : text('浏览器') }}</strong>
          </div>
          <span class="s2-dot" :class="electronSupported ? 'is-green' : 'is-slate'" />
        </div>

        <div class="s2-strip__item">
          <div class="s2-strip__icon s2-strip__icon--teal">
            <AppIcon name="server" />
          </div>
          <div class="s2-strip__body">
            <span class="s2-strip__label">{{ text('执行器') }}</span>
            <strong>{{ executorStatusLabel }}</strong>
          </div>
          <span class="s2-dot" :class="executorHealth?.ok ? 'is-green' : 'is-slate'" />
        </div>
      </div>

      <div class="s2-main">
        <aside class="s2-side">
          <div class="s2-panel">
            <div class="s2-panel__bar" />
            <div class="s2-panel__head">
              <AppIcon name="server" />
              <strong>{{ text('执行器控制') }}</strong>
            </div>
            <div class="s2-actions-row">
              <button
                class="s2-btn s2-btn--primary"
                :disabled="!canLaunchActiveApp"
                @click="startActiveApp(false)"
              >
                <AppIcon name="play-circle" />
                {{ launching ? text('启动中...') : text('启动执行器') }}
              </button>
              <button
                class="s2-btn s2-btn--danger"
                :disabled="!canStopActiveApp"
                @click="stopActiveApp"
              >
                <AppIcon name="stop-circle" />
                {{ text('停止') }}
              </button>
              <button class="s2-btn" :disabled="refreshing" @click="refreshExecutorState(false)">
                <AppIcon name="refresh-cw" :class="{ 's2-spin': refreshing }" />
                {{ refreshing ? text('刷新中...') : text('刷新状态') }}
              </button>
            </div>
          </div>

          <div class="s2-panel">
            <div class="s2-panel__bar" />
            <div class="s2-panel__head">
              <AppIcon name="workflow" />
              <strong>{{ text('操作流程') }}</strong>
            </div>
            <div class="s2-steps">
              <div v-for="(step, index) in shippingAutomation2Steps" :key="step.title" class="s2-step">
                <span class="s2-step__num">{{ index + 1 }}</span>
                <div>
                  <strong>{{ text(step.title) }}</strong>
                  <p>{{ text(step.desc) }}</p>
                </div>
              </div>
            </div>
          </div>

          <details class="s2-details">
            <summary>
              <AppIcon name="terminal" />
              <span>{{ text('执行器健康信息') }}</span>
              <AppIcon name="chevron-down" class="s2-chevron" />
            </summary>
            <pre>{{ healthRaw }}</pre>
          </details>
        </aside>

        <section class="s2-stage">
          <div class="s2-bulk-grid">
            <article
              v-for="bulk in bulkAreas"
              :key="bulk.id"
              class="s2-bulk-card"
              :class="`s2-bulk-card--${bulk.id}`"
            >
              <div class="s2-bulk-card__head">
                <div class="s2-bulk-card__icon">
                  <AppIcon name="upload" />
                </div>
                <div>
                  <strong>{{ text(bulk.label) }}</strong>
                  <p>{{ text('Excel 输入与启动') }}</p>
                </div>
              </div>

              <div
                class="s2-bulk-dropzone"
                :class="{
                  's2-bulk-dropzone--active': bulk.file,
                  's2-bulk-dropzone--drag': bulk.dragging,
                }"
                role="button"
                tabindex="0"
                @click="openBulkFilePicker(bulk.id)"
                @keydown.enter.prevent="openBulkFilePicker(bulk.id)"
                @keydown.space.prevent="openBulkFilePicker(bulk.id)"
                @dragover.prevent="setBulkDragging(bulk.id, true)"
                @dragleave.prevent="setBulkDragging(bulk.id, false)"
                @drop.prevent="handleBulkDrop(bulk.id, $event)"
              >
                <input
                  :ref="(el) => setBulkFileInputRef(bulk.id, el)"
                  type="file"
                  accept=".xlsx,.xls"
                  @click.stop
                  @change="handleBulkFileSelect(bulk.id, $event)"
                />
                <template v-if="bulk.file">
                  <div class="s2-bulk-dropzone__icon s2-bulk-dropzone__icon--done">
                    <AppIcon name="check-circle" />
                  </div>
                  <strong>{{ bulk.file.name }}</strong>
                  <small>{{ formatSize(bulk.file.size) }}</small>
                  <button class="s2-bulk-clear" type="button" @click.stop="clearBulkFile(bulk.id)">
                    <AppIcon name="stop-circle" />
                    {{ text('清除') }}
                  </button>
                </template>
                <template v-else>
                  <div class="s2-bulk-dropzone__icon">
                    <AppIcon name="upload" />
                  </div>
                  <strong>{{ text('选择 Excel 文件') }}</strong>
                  <small>{{ text('支持 .xlsx / .xls') }}</small>
                </template>
              </div>

              <div class="s2-bulk-actions">
                <button
                  class="s2-btn-lg"
                  :disabled="bulk.running || !bulk.file"
                  @click="startBulkAutomation(bulk.id)"
                >
                  <AppIcon :name="bulk.running ? 'loader' : 'play-circle'" :class="{ 's2-spin': bulk.running }" />
                  {{ bulk.running ? text('启动中...') : text('启动') }}
                </button>
              </div>

              <div class="s2-bulk-status" :class="`s2-bulk-status--${bulk.tone}`">
                <AppIcon :name="bulkStatusIcon(bulk)" />
                <span>{{ text(bulk.statusText) }}</span>
              </div>

              <div v-if="bulk.result" class="s2-bulk-result">
                <span>{{ text('Run ID') }}</span>
                <strong>{{ bulk.result.runId }}</strong>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { AutomationAppInfo } from '../../../types/electronApi'
import type { LocalExecutorHealth } from '../../web-automation/webAutomationApi'
import {
  fetchAutomationApps,
  hasElectronAutomationSupport,
  launchAutomationConsole,
  primeLocalAutomationLauncherBoot,
  probeLocalAutomationLauncherHealth,
  probeLocalExecutorHealth,
  recordWebAutomationEvent,
  stopAutomationConsole,
} from '../../web-automation/webAutomationApi'
import {
  getAutomationAppStatusLabel,
  getWebAutomationEntry,
  type WebAutomationEntry,
  type WebAutomationNoticeTone,
} from '../../web-automation/webAutomationModel'
import {
  defaultShippingAutomation2Password,
  defaultShippingAutomation2Username,
  shippingAutomation2EntryId,
  shippingAutomation2Steps,
} from '../shippingAutomation2Model'

type BulkAreaId = 'unreleased' | 'released'
type BulkAreaTone = 'idle' | 'info' | 'success' | 'error'

interface BulkRunResult {
  ok: boolean
  runId?: string
  message?: string
  finalUrl?: string
  generatedAt?: string
}

interface BulkAreaState {
  id: BulkAreaId
  label: string
  file: File | null
  dragging: boolean
  running: boolean
  tone: BulkAreaTone
  statusText: string
  result: BulkRunResult | null
}

const router = useRouter()
const { text } = useAppLanguage()

const entry = getWebAutomationEntry(shippingAutomation2EntryId)
const electronSupported = hasElectronAutomationSupport()

const activeApp = ref<AutomationAppInfo | null>(null)
const executorHealth = ref<LocalExecutorHealth | null>(null)
const launcherReachable = ref(false)
const launching = ref(false)
const refreshing = ref(false)
const message = ref('')
const messageTone = ref<WebAutomationNoticeTone>('info')
const bulkFileInputs = new Map<BulkAreaId, HTMLInputElement>()
const bulkAreas = ref<BulkAreaState[]>([
  {
    id: 'unreleased',
    label: 'Unreleased Bulk',
    file: null,
    dragging: false,
    running: false,
    tone: 'idle',
    statusText: '等待选择 Excel 文件。',
    result: null,
  },
  {
    id: 'released',
    label: 'released Bulk',
    file: null,
    dragging: false,
    running: false,
    tone: 'idle',
    statusText: '等待选择 Excel 文件。',
    result: null,
  },
])

const healthRaw = computed(() => (
  executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}'
))

const executorStatusLabel = computed(() => {
  if (activeApp.value) {
    const label = text(getAutomationAppStatusLabel(activeApp.value))
    if (executorHealth.value?.ok) {
      const activeRunCount = Number(executorHealth.value.activeRunCount || 0)
      return activeRunCount > 0 ? `${label} / ${text('运行')} ${activeRunCount} ${text('个任务')}` : `${label} / ${text('就绪')}`
    }
    if (activeApp.value.running) {
      return `${label} / ${text('未连接')}`
    }
    return label
  }
  return executorHealth.value?.ok ? text('就绪') : text('未启动')
})

const canLaunchActiveApp = computed(() => Boolean(entry?.appId) && !launching.value)
const canStopActiveApp = computed(
  () => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value,
)

const messageIconName = computed(() => {
  if (messageTone.value === 'success') return 'check-circle'
  if (messageTone.value === 'error') return 'alert-circle'
  if (messageTone.value === 'warning') return 'info'
  return 'activity'
})

onMounted(() => {
  void initializeScenario()
})

async function initializeScenario(): Promise<void> {
  await refreshExecutorState(true)
}

async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry || refreshing.value) return

  refreshing.value = true
  const fallbackApp = createFallbackAutomationApp(entry)

  try {
    launcherReachable.value = electronSupported
      ? true
      : await probeLocalAutomationLauncherHealth()

    if (electronSupported) {
      try {
        const apps = await fetchAutomationApps()
        activeApp.value = apps.find((app) => app.id === entry.appId) ?? fallbackApp
      } catch {
        activeApp.value = fallbackApp
      }
    } else {
      activeApp.value = fallbackApp
    }

    executorHealth.value = await probeLocalExecutorHealth(entry.executorBaseUrl)
    if (activeApp.value) {
      activeApp.value = { ...activeApp.value, running: true }
    }

    if (!silent) {
      messageTone.value = 'success'
      message.value = text('状态已刷新。')
    }
  } catch {
    executorHealth.value = null
    launcherReachable.value = false
    activeApp.value = activeApp.value || fallbackApp
    if (!silent) {
      messageTone.value = 'warning'
      message.value = text('执行器未就绪，请先启动。')
    }
  } finally {
    refreshing.value = false
  }
}

async function startActiveApp(silent: boolean): Promise<void> {
  if (!entry || launching.value) return

  if (!electronSupported && !launcherReachable.value) {
    primeLocalAutomationLauncherBoot()
  }

  launching.value = true
  try {
    const result = await launchAutomationConsole(entry.appId)
    if (!result.success) {
      throw new Error(result.error || '启动失败')
    }

    await refreshExecutorState(true)
    if (!silent) {
      messageTone.value = 'success'
      message.value = result.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。')
    }
  } catch (error) {
    const errMsg = readErrorMessage(error, text('启动失败'))
    await recordWebAutomationEvent('launch-exception', {
      appId: entry.appId,
      entryId: entry.id,
      error: errMsg,
    })
    if (!silent) {
      messageTone.value = 'error'
      message.value = errMsg
    }
  } finally {
    launching.value = false
  }
}

async function stopActiveApp(): Promise<void> {
  if (!entry) return

  try {
    const result = await stopAutomationConsole(entry.appId)
    if (!result.success) {
      throw new Error(result.error || '停止失败')
    }

    executorHealth.value = null
    if (activeApp.value) {
      activeApp.value = { ...activeApp.value, running: false }
    }
    await refreshExecutorState(true).catch(() => {})
    messageTone.value = 'info'
    message.value = text('执行器已停止。')
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, text('停止失败'))
  }
}

async function ensureExecutorReady(): Promise<boolean> {
  if (executorHealth.value?.ok) {
    return true
  }

  await startActiveApp(true)
  await refreshExecutorState(true).catch(() => {})
  return Boolean(executorHealth.value?.ok)
}

function setBulkFileInputRef(id: BulkAreaId, el: unknown): void {
  if (el instanceof HTMLInputElement) {
    bulkFileInputs.set(id, el)
  }
}

function getBulkArea(id: BulkAreaId): BulkAreaState | undefined {
  return bulkAreas.value.find((bulk) => bulk.id === id)
}

function openBulkFilePicker(id: BulkAreaId): void {
  bulkFileInputs.get(id)?.click()
}

function handleBulkFileSelect(id: BulkAreaId, event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  setBulkFile(id, file)
}

function handleBulkDrop(id: BulkAreaId, event: DragEvent): void {
  setBulkDragging(id, false)
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  setBulkFile(id, file)
}

function setBulkFile(id: BulkAreaId, file: File): void {
  const bulk = getBulkArea(id)
  if (!bulk) return
  bulk.file = file
  bulk.result = null
  bulk.tone = 'info'
  bulk.statusText = `${file.name} 已选择，等待启动。`
}

function setBulkDragging(id: BulkAreaId, dragging: boolean): void {
  const bulk = getBulkArea(id)
  if (!bulk) return
  bulk.dragging = dragging
}

function clearBulkFile(id: BulkAreaId): void {
  const bulk = getBulkArea(id)
  if (!bulk) return
  bulk.file = null
  bulk.dragging = false
  bulk.running = false
  bulk.result = null
  bulk.tone = 'idle'
  bulk.statusText = '等待选择 Excel 文件。'
  const input = bulkFileInputs.get(id)
  if (input) {
    input.value = ''
  }
}

async function startBulkAutomation(id: BulkAreaId): Promise<void> {
  const bulk = getBulkArea(id)
  if (!entry || !bulk || !bulk.file || bulk.running) return

  bulk.running = true
  bulk.tone = 'info'
  bulk.result = null
  bulk.statusText = `${bulk.label} 正在启动...`

  try {
    const executorReady = await ensureExecutorReady()
    if (!executorReady) {
      bulk.tone = 'error'
      bulk.statusText = '执行器未就绪，请先启动执行器。'
      return
    }

    const fileBase64 = await fileToBase64(bulk.file)
    const response = await fetch(getBulkExecutorUrl(id), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Executor-Token': entry.localExecutorToken,
      },
      body: JSON.stringify({
        token: entry.localExecutorToken,
        username: defaultShippingAutomation2Username,
        password: defaultShippingAutomation2Password,
        bulkType: id,
        fileName: bulk.file.name,
        fileBase64,
      }),
    })
    const rawText = await response.text()
    const json = safeParseJson<BulkRunResult>(rawText)

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || `HTTP ${response.status}`)
    }

    bulk.result = json
    bulk.tone = 'success'
    bulk.statusText = json.message || `${bulk.label} 已启动。`
    messageTone.value = 'success'
    message.value = bulk.statusText
  } catch (error) {
    bulk.tone = 'error'
    bulk.statusText = readErrorMessage(error, '启动失败')
    messageTone.value = 'error'
    message.value = bulk.statusText
  } finally {
    bulk.running = false
    await refreshExecutorState(true).catch(() => {})
  }
}

function getBulkExecutorUrl(id: BulkAreaId): string {
  const baseUrl = String(entry?.executorBaseUrl || '').replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}/api/run-shipping2-${id}-bulk` : ''
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window.btoa(binary)
}

function bulkStatusIcon(bulk: BulkAreaState): string {
  if (bulk.running) return 'loader'
  if (bulk.tone === 'success') return 'check-circle'
  if (bulk.tone === 'error') return 'alert-circle'
  return 'activity'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function createFallbackAutomationApp(targetEntry: WebAutomationEntry): AutomationAppInfo {
  return {
    id: targetEntry.appId,
    name: targetEntry.title,
    description: targetEntry.description,
    provider: 'Playwright',
    category: 'Web Automation',
    version: 'local',
    available: true,
    running: false,
    url: targetEntry.executorBaseUrl,
  }
}

function safeParseJson<T>(rawText: string): T | null {
  try {
    return rawText ? JSON.parse(rawText) as T : null
  } catch {
    return null
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function goBack(): void {
  void router.push('/eric-infornexus')
}
</script>

<style scoped>
@keyframes s2-spin {
  to { transform: rotate(360deg); }
}

.s2-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 16px 18px 20px;
  background: #f8fafc;
}

.s2-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.s2-back,
.s2-btn,
.s2-btn-lg,
.s2-bulk-clear {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s ease;
}

.s2-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.s2-back:hover,
.s2-btn:hover:not(:disabled),
.s2-btn-lg:hover:not(:disabled),
.s2-bulk-clear:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.s2-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.s2-badge--scene {
  background: #eff6ff;
  color: #2563eb;
}

.s2-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.s2-hero__icon,
.s2-strip__icon,
.s2-bulk-card__icon,
.s2-bulk-dropzone__icon,
.s2-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.s2-hero__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #ffffff;
  font-size: 20px;
}

.s2-hero__text {
  min-width: 0;
}

.s2-hero__text h1 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
}

.s2-hero__text p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.s2-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.s2-alert--info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.s2-alert--success {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #047857;
}

.s2-alert--warning {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #c2410c;
}

.s2-alert--error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.s2-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.s2-strip__item,
.s2-panel,
.s2-bulk-card,
.s2-details,
.s2-empty {
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.s2-strip__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.s2-strip__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: #ffffff;
  font-size: 18px;
}

.s2-strip__icon--blue {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
}

.s2-strip__icon--teal {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
}

.s2-strip__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.s2-strip__label {
  color: #64748b;
  font-size: 12px;
}

.s2-strip__body strong {
  color: #0f172a;
  font-size: 14px;
  word-break: break-word;
}

.s2-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-left: auto;
  flex-shrink: 0;
}

.s2-dot.is-green {
  background: #10b981;
}

.s2-dot.is-slate {
  background: #94a3b8;
}

.s2-main {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.s2-side,
.s2-stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.s2-panel,
.s2-bulk-card {
  position: relative;
  overflow: hidden;
}

.s2-panel__bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #2563eb, #14b8a6);
}

.s2-panel__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 0 22px;
}

.s2-panel__head strong {
  color: #0f172a;
  font-size: 15px;
}

.s2-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 18px 18px 22px;
}

.s2-btn,
.s2-btn-lg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 10px;
  font-weight: 700;
}

.s2-btn {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
}

.s2-btn-lg {
  min-height: 44px;
  width: 100%;
  padding: 0 16px;
  border-color: #bfdbfe;
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 800;
}

.s2-btn--primary {
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.s2-btn--danger {
  border-color: #fecaca;
  color: #dc2626;
}

.s2-btn:disabled,
.s2-btn-lg:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.s2-spin {
  animation: s2-spin 0.9s linear infinite;
}

.s2-steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 18px 22px;
}

.s2-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.s2-step__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.s2-step strong {
  display: block;
  color: #0f172a;
  font-size: 13px;
}

.s2-step p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.7;
}

.s2-bulk-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.s2-bulk-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 12px;
}

.s2-bulk-card__head strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
}

.s2-bulk-card__head p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.s2-bulk-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 17px;
}

.s2-bulk-card--released .s2-bulk-card__icon {
  background: #ccfbf1;
  color: #0f766e;
}

.s2-bulk-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 150px;
  margin: 0 18px;
  padding: 18px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  color: #475569;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.s2-bulk-dropzone input {
  display: none;
}

.s2-bulk-dropzone:hover,
.s2-bulk-dropzone--drag {
  border-color: #60a5fa;
  background: #eff6ff;
}

.s2-bulk-dropzone--active {
  border-color: #86efac;
  background: #f0fdf4;
}

.s2-bulk-dropzone__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #e0f2fe;
  color: #0284c7;
  font-size: 18px;
}

.s2-bulk-dropzone__icon--done {
  background: #dcfce7;
  color: #16a34a;
}

.s2-bulk-dropzone strong {
  max-width: 100%;
  color: #0f172a;
  font-size: 13px;
  word-break: break-word;
}

.s2-bulk-dropzone small {
  color: #64748b;
  font-size: 12px;
}

.s2-bulk-clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  margin-top: 4px;
  padding: 0 10px;
  border-color: #bbf7d0;
  border-radius: 10px;
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
}

.s2-bulk-actions {
  padding: 14px 18px 12px;
}

.s2-bulk-status,
.s2-bulk-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 18px 18px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.6;
}

.s2-bulk-status--idle {
  background: #f8fafc;
  color: #475569;
}

.s2-bulk-status--info {
  background: #eff6ff;
  color: #1d4ed8;
}

.s2-bulk-status--success {
  background: #ecfdf5;
  color: #047857;
}

.s2-bulk-status--error {
  background: #fef2f2;
  color: #b91c1c;
}

.s2-bulk-result {
  flex-direction: column;
  align-items: flex-start;
  margin-top: -6px;
  background: #f8fafc;
  color: #475569;
}

.s2-bulk-result strong {
  max-width: 100%;
  color: #0f172a;
  word-break: break-word;
}

.s2-details summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  list-style: none;
  cursor: pointer;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.s2-details summary::-webkit-details-marker {
  display: none;
}

.s2-chevron {
  margin-left: auto;
}

.s2-details pre {
  margin: 0;
  padding: 0 16px 16px;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.s2-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
}

.s2-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #ffffff;
  font-size: 20px;
}

.s2-empty strong {
  color: #0f172a;
  font-size: 16px;
}

.s2-empty span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.s2-msg-enter-active,
.s2-msg-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.s2-msg-enter-from,
.s2-msg-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 1120px) {
  .s2-main,
  .s2-bulk-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .s2-page {
    padding: 12px;
  }

  .s2-top {
    flex-direction: column;
    align-items: stretch;
  }

  .s2-strip {
    grid-template-columns: 1fr;
  }

  .s2-panel__head {
    flex-wrap: wrap;
  }
}
</style>
