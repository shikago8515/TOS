<template>
  <div class="sa">
    <!-- === ALERT === -->
    <transition name="sa-alert-anim">
      <div v-if="message" class="sa-alert" :class="`sa-alert--${messageTone}`">
        <AppIcon :name="messageIconName" />
        <span>{{ text(message) }}</span>
        <button class="sa-alert__close" @click="message = ''"><AppIcon name="stop-circle" /></button>
      </div>
    </transition>

    <!-- === EMPTY === -->
    <div v-if="!entry" class="sa-empty">
      <AppIcon name="alert-circle" class="sa-empty__icon" />
      <strong>{{ text('入口不存在') }}</strong>
      <button class="sa-back" @click="goBack"><AppIcon name="arrow-left" />{{ text('返回') }}</button>
    </div>

    <template v-else>
      <!-- ═══ HERO HEADER ═══ -->
      <header class="sa-hd">
        <div class="sa-hd__left">
          <button class="sa-back-btn" @click="goBack"><AppIcon name="arrow-left" /></button>
          <div class="sa-hd__icon"><AppIcon name="package" /></div>
          <div class="sa-hd__text">
            <h1>{{ text(entry.title) }}</h1>
            <p>{{ text(entry.subtitle) }}</p>
          </div>
        </div>
        <div class="sa-hd__right">
          <div class="sa-pill" :class="executorHealth?.ok ? 'sa-pill--on' : 'sa-pill--off'">
            <span class="sa-pill__dot" :class="executorHealth?.ok ? 'sa-pill__dot--on' : ''" />
            {{ executorHealth?.ok ? text('执行器就绪') : text('执行器未连接') }}
          </div>
          <span class="sa-tag"><AppIcon name="zap" /> InforNexus</span>
        </div>
      </header>

      <!-- ═══ HELPER BANNER ═══ -->
      <transition name="sa-alert-anim">
        <div v-if="showLocalHelperPrompt" class="sa-helper">
          <div class="sa-helper__icon"><AppIcon name="monitor-code" /></div>
          <div class="sa-helper__body">
            <strong>{{ text('未检测到本机自动化助手') }}</strong>
            <p>{{ text('请先启动 TOS 自动化助手，然后重新检测。') }}</p>
          </div>
          <div class="sa-helper__btns">
            <button class="sa-btn sa-btn--pri" @click="downloadAutomationHelper"><AppIcon name="download" />{{ text('下载助手') }}</button>
            <button class="sa-btn" @click="bootLocalHelper"><AppIcon name="play-circle" />{{ text('启动') }}</button>
            <button class="sa-btn" :disabled="refreshing" @click="refreshExecutorState(false)"><AppIcon name="refresh-cw" />{{ text('重新检测') }}</button>
          </div>
        </div>
      </transition>

      <!-- ═══ BODY: LEFT + RIGHT DOCK ═══ -->
      <div class="sa-body">
        <!-- LEFT COLUMN -->
        <div class="sa-left">
          <!-- Main Workflow Card -->
          <section class="sa-card sa-card--primary">
            <div class="sa-card__hd">
              <div class="sa-card__hd-ico"><AppIcon name="play-circle" /></div>
              <div class="sa-card__hd-info">
                <strong>{{ text('登录并打开 TC INV 流程') }}</strong>
                <small>{{ text('上传出货明细表并同步交期与费用') }}</small>
              </div>
              <span v-if="executorHealth?.ok" class="sa-chip sa-chip--ok">{{ text('就绪') }}</span>
              <span v-else class="sa-chip sa-chip--warn">{{ text('等待执行器') }}</span>
            </div>

            <!-- Credentials -->
            <div class="sa-card__bd">
              <AutomationAccountProfileManager
                ref="credentialProfileRef"
                v-model:selected-key="selectedCredentialKey"
                v-model:username="shippingUsername"
                v-model:password="shippingPassword"
                :automation-id="entry.id"
                :extra-action-label="templateButtonLabel"
                extra-action-icon="download"
                :extra-action-disabled="templateLoading"
                :extra-action-loading="templateLoading"
                @state="handleCredentialState"
                @notice="handleCredentialNotice"
                @extra-action="downloadPrimaryTemplate"
              />
            </div>

            <!-- File Dropzone -->
            <div class="sa-card__bd">
              <label class="sa-field"><span>{{ text('Excel 文件') }}</span></label>
              <div class="sa-drop" :class="{ 'sa-drop--on': selectedFile, 'sa-drop--over': isDragging }"
                @click="openFilePicker" @dragenter.prevent="handleDragEnter" @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop">
                <input ref="fileInput" type="file" accept=".xlsx,.xls" @click.stop @change="handleFileSelect" />
                <template v-if="selectedFile">
                  <div class="sa-drop__ico sa-drop__ico--ok"><AppIcon name="check-circle" /></div>
                  <div class="sa-drop__info">
                    <b>{{ selectedFile.name }}</b>
                    <small>{{ formatSize(selectedFile.size) }}</small>
                  </div>
                  <button class="sa-drop__x" @click.stop="clearFile"><AppIcon name="stop-circle" /></button>
                </template>
                <template v-else>
                  <div class="sa-drop__ico sa-drop__ico--float"><AppIcon name="upload" /></div>
                  <div class="sa-drop__info">
                    <b>{{ text('点击或拖入 Excel 文件') }}</b>
                    <small>{{ text('请包含工厂、交期、费用等字段') }}</small>
                  </div>
                </template>
                <div v-if="isDragging" class="sa-drop__overlay">{{ text('释放以上传文件') }}</div>
              </div>
            </div>

            <!-- Execute -->
            <div class="sa-card__ft">
              <button class="sa-btn sa-btn--execute" :disabled="!canRunTcInvAutomation" @click="runTcInv">
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'sa-spin': sending }" />
                {{ sending ? text('执行中...') : text('上传 Excel 并执行 TC INV') }}
              </button>
            </div>

            <!-- Inline Status -->
            <transition name="sa-alert-anim">
              <div v-if="lastResult || sending" class="sa-status" :class="inlineStatusClass">
                <AppIcon :name="statusIconName" />{{ text(statusText) }}
              </div>
            </transition>

            <!-- Artifact Downloads -->
            <div v-if="shippingArtifactLinks?.resultExcelUrl" class="sa-card__ft sa-artifacts">
              <button class="sa-btn sa-btn--pri" @click="downloadShippingArtifact(shippingArtifactLinks.resultExcelUrl, 'tc-inv-last-result.xlsx')">
                <AppIcon name="download" />{{ text('结果 Excel') }}
              </button>
              <button v-if="shippingArtifactLinks.failedPoExcelUrl && shippingArtifactLinks.failedRowCount > 0" class="sa-btn" @click="downloadShippingArtifact(shippingArtifactLinks.failedPoExcelUrl, 'tc-inv-last-failed-rows.xlsx')">
                <AppIcon name="download" />{{ text('失败明细') }}
              </button>
            </div>
          </section>

        </div>

        <!-- ═══ RIGHT DOCK ═══ -->
        <aside class="sa-dock">
          <!-- Executor Control -->
          <div class="sa-dock-card">
            <div class="sa-dock__hd">
              <AppIcon name="server" class="sa-dock__hd-icon" />
              <span>{{ text('执行器控制') }}</span>
              <span class="sa-dock__dot" :class="executorHealth?.ok ? 'sa-dock__dot--on' : ''" />
            </div>
            <div class="sa-dock__bd">
              <BrowserVisibilitySwitch v-model="showBrowserView" />
              <div class="sa-btn-grid">
                <button class="sa-btn sa-btn--pri" :disabled="!canLaunchActiveApp" @click="startActiveApp(false)">
                  <AppIcon name="play-circle" />{{ launching ? text('启动中...') : text('启动') }}
                </button>
                <button class="sa-btn sa-btn--danger-soft" :disabled="!canStopActiveApp" @click="stopActiveApp">
                  <AppIcon name="stop-circle" />{{ text('停止') }}
                </button>
              </div>
              <div class="sa-btn-grid">
                <button class="sa-btn sa-btn--soft" :disabled="refreshing" @click="refreshExecutorState(false)">
                  <AppIcon name="refresh-cw" :class="{ 'sa-spin': refreshing }" />{{ text('刷新') }}
                </button>
                <button class="sa-btn sa-btn--soft" type="button" @click="isHealthLogOpen = true">
                  <AppIcon name="terminal" />{{ text('日志') }}
                </button>
              </div>
            </div>
          </div>

          <AutomationRunHistoryPanel :automation-id="entry.id" :refresh-signal="lastRawResponse" />

          <!-- Steps -->
          <div class="sa-dock-card sa-dock-card--flex">
            <div class="sa-dock__hd">
              <AppIcon name="workflow" class="sa-dock__hd-icon" />
              <span>{{ text('操作流程') }}</span>
            </div>
            <div class="sa-dock__bd sa-steps">
              <div v-for="(s, i) in steps" :key="i" class="sa-step">
                <b class="sa-step__n">{{ i + 1 }}</b>
                <div class="sa-step__text">
                  <em>{{ text(s.title) }}</em>
                  <small>{{ text(s.desc) }}</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Response -->
          <details v-if="lastRawResponse" class="sa-dock-card">
            <summary class="sa-dock__hd sa-dock__hd--summary">
              <AppIcon name="code" class="sa-dock__hd-icon" />
              <span>{{ text('原始响应') }}</span>
              <AppIcon name="chevron-down" class="sa-chev" />
            </summary>
            <pre class="sa-log__pre">{{ lastRawResponse }}</pre>
          </details>
        </aside>
      </div>
    </template>

    <!-- Health Log Drawer Overlay -->
    <transition name="sa-drawer-fade">
      <div v-if="isHealthLogOpen" class="sa-drawer-overlay" @click="isHealthLogOpen = false" />
    </transition>

    <!-- Health Log Drawer -->
    <transition name="sa-drawer-slide">
      <div v-if="isHealthLogOpen" class="sa-drawer">
        <header class="sa-drawer__hd">
          <div class="sa-drawer__title">
            <AppIcon name="terminal" />
            <div>
              <h3>{{ text('执行器健康日志') }}</h3>
              <p>{{ text('运行状态与连通性控制台') }}</p>
            </div>
          </div>
          <button class="sa-drawer__close-btn" @click="isHealthLogOpen = false">
            <AppIcon name="stop-circle" />
          </button>
        </header>
        <div class="sa-drawer__bd">
          <pre class="sa-drawer__pre">{{ healthRaw }}</pre>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import BrowserVisibilitySwitch from '../../../shared/ui/BrowserVisibilitySwitch.vue'
import { showAppAlert } from '../../../shared/ui/appAlert'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import AutomationAccountProfileManager from '../../web-automation/components/AutomationAccountProfileManager.vue'
import AutomationRunHistoryPanel from '../../web-automation/components/AutomationRunHistoryPanel.vue'
import type { AutomationAppInfo } from '../../../types/electronApi'
import type { AutomationRunFileInput, AutomationRunRecord, AutomationTemplate, LocalExecutorHealth } from '../../web-automation/webAutomationApi'
import {
  createAutomationRunRecord, downloadAutomationTemplate,
  fetchAutomationApps, fetchAutomationTemplates, finishAutomationRunRecord,
  findLocalExecutorActiveRun,
  getAutomationHelperUpdateMessage,
  hasElectronAutomationSupport, isLocalExecutorBusy, launchAutomationConsole, openAutomationHelperDownload,
  primeLocalAutomationLauncherBoot, probeLocalAutomationLauncherHealth, probeLocalExecutorHealth,
  recordWebAutomationEvent, stopAutomationConsole,
} from '../../web-automation/webAutomationApi'
import { formatAutomationExecutorMessage, shouldShowAutomationErrorDialog, showAutomationErrorDialog } from '../../web-automation/webAutomationErrors'
import { getAutomationAppStatusLabel, getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from '../../web-automation/webAutomationModel'

const TC_INV_ENTRY_ID = 'tc-inv-automation'

type CredentialProfileRef = {
  refresh: (accountKey?: string) => Promise<void>
  resolveCredentials: () => Promise<{ username: string; password: string; accountKey: string }>
}
type CredentialProfileState = { hasStoredCredentials: boolean; username: string; accountKey: string }
type CredentialNotice = { tone: WebAutomationNoticeTone; message: string }

const router = useRouter(); const { text } = useAppLanguage()
const entry = getWebAutomationEntry(TC_INV_ENTRY_ID)
const electronSupported = hasElectronAutomationSupport()

const activeApp = ref<AutomationAppInfo | null>(null)
const executorHealth = ref<LocalExecutorHealth | null>(null)
const automationTemplates = ref<AutomationTemplate[]>([])
const launcherReachable = ref(false); const launching = ref(false); const refreshing = ref(false)
const templateLoading = ref(false); const sending = ref(false); const restoredActiveRun = ref(false)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info')
const isHealthLogOpen = ref(false)
const isDragging = ref(false); const dragDepth = ref(0); const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const shippingUsername = ref(''); const shippingPassword = ref('')
const selectedCredentialKey = ref('default')
const hasStoredCredentials = ref(false)
const credentialProfileRef = ref<CredentialProfileRef | null>(null)
const showBrowserView = ref(true)
const statusText = ref(''); const statusLabel = ref('待命')
const lastResult = ref<{ ok: boolean; message?: string } | null>(null); const lastRawResponse = ref('')
let activeRunStateTimer: number | null = null
type SAL = { resultExcelUrl: string; resultJsonUrl?: string; failedPoExcelUrl?: string; failedPoJsonUrl?: string; failedRowCount: number }
const shippingArtifactLinks = ref<SAL | null>(null)

const steps = [
  { title: '输入账号密码', desc: '使用 Infor Nexus 登录账号密码。' },
  { title: '启动本地执行器', desc: '网页端和 EXE 同套启动器。' },
  { title: '打开 TC INV 板块', desc: '进入 SLT、VENT、XO 工厂对应网页流程。' },
  { title: '上传 Excel 执行', desc: '上传出货明细表，同步交期与各项费用。' },
]

const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorStatusLabel = computed(() => {
  if (activeApp.value) { const l = text(getAutomationAppStatusLabel(activeApp.value)); if (executorHealth.value?.ok) { const c = Number(executorHealth.value.activeRunCount || 0); return c > 0 ? `${l} / ${c} ${text('个任务')}` : `${l} / ${text('就绪')}` }; if (activeApp.value.running) return `${l} / ${text('未连通')}`; return l }; return executorHealth.value?.ok ? text('就绪') : text('未启动')
})
const inlineStatusClass = computed(() => { if (sending.value) return 'sa-status--info'; if (lastResult.value?.ok) return 'sa-status--ok'; if (lastResult.value && !lastResult.value.ok) return 'sa-status--err'; return '' })
const statusIconName = computed(() => { if (sending.value) return 'loader'; if (lastResult.value?.ok) return 'check-circle'; if (lastResult.value && !lastResult.value.ok) return 'alert-circle'; return 'activity' })
const canLaunchActiveApp = computed(() => Boolean(entry?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)
const showLocalHelperPrompt = computed(() => !electronSupported && !launcherReachable.value)
const primaryTemplate = computed(() => automationTemplates.value[0] || null)
const templateButtonLabel = computed(() => { if (templateLoading.value) return text('模板加载中...'); return primaryTemplate.value ? text('下载 Excel 模板') : text('暂无模板') })
const shippingExecutorRunUrl = computed(() => { const b = String(entry?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-tc-inv-file` : '' })
const canRunTcInvAutomation = computed(() => !sending.value && hasStoredCredentials.value)
const messageIconName = computed(() => { if (messageTone.value === 'success') return 'check-circle'; if (messageTone.value === 'error') return 'alert-circle'; if (messageTone.value === 'warning') return 'info'; return 'activity' })

onMounted(() => { void initializeScenario() })
onBeforeUnmount(() => { stopActiveRunStatePolling() })

async function initializeScenario(): Promise<void> {
  statusLabel.value = '待命'; statusText.value = '等待上传出货明细表并执行 TC INV 自动化。'
  await refreshAutomationTemplates(); await refreshCredentialProfile(); await refreshExecutorState(true)
  if (electronSupported && activeApp.value?.available && !isLocalExecutorBusy(executorHealth.value)) await startActiveApp(true)
}

async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry || refreshing.value) return; refreshing.value = true; const fb = createFallback(entry)
  try {
    launcherReachable.value = electronSupported ? true : await probeLocalAutomationLauncherHealth()
    if (electronSupported) { try { const apps = await fetchAutomationApps(); activeApp.value = apps.find((a) => a.id === entry?.appId) ?? fb } catch { activeApp.value = fb } } else { activeApp.value = fb }
    if (!electronSupported && !launcherReachable.value) { executorHealth.value = null; activeApp.value = fb; clearRestoredActiveRunState(); if (!silent) { messageTone.value = 'warning'; message.value = text('未检测到本机自动化助手。') }; return }
    executorHealth.value = await probeLocalExecutorHealth(entry.executorBaseUrl); await refreshCredentialProfile()
    if (activeApp.value) activeApp.value = { ...activeApp.value, running: true }
    syncActiveRunViewFromHealth()
    const updateMessage = getAutomationHelperUpdateMessage(executorHealth.value, activeApp.value)
    if (updateMessage) { messageTone.value = 'warning'; message.value = text(updateMessage) }
    else if (!silent) { messageTone.value = 'success'; message.value = text('状态已刷新。') }
  } catch {
    executorHealth.value = null; activeApp.value = activeApp.value || fb; clearRestoredActiveRunState()
    if (!silent) { messageTone.value = 'warning'; message.value = launcherReachable.value ? text('本机自动化助手已连接，执行器尚未启动。') : text('执行器未就绪。') }
  } finally { refreshing.value = false }
}

function syncActiveRunViewFromHealth(): void {
  const activeRun = findTcInvActiveRun(executorHealth.value)
  if (activeRun) {
    restoredActiveRun.value = true
    sending.value = true
    lastResult.value = null
    statusLabel.value = '执行中'
    const inputFileName = String(activeRun.inputFileName || '').trim()
    statusText.value = inputFileName ? `执行器仍在处理 ${inputFileName}，请勿重复启动。` : text('TC INV 自动化仍在后台运行，请勿重复启动。')
    startActiveRunStatePolling()
    return
  }
  if (!restoredActiveRun.value) return
  clearRestoredActiveRunState()
  statusText.value = text('后台执行器任务已结束，请查看执行记录或重新开始。')
}

function findTcInvActiveRun(health: LocalExecutorHealth | null | undefined): Record<string, any> | null {
  return findLocalExecutorActiveRun(health, (run) => {
    const action = String(run.action || '').trim()
    const inputMode = String(run.inputMode || '').trim()
    return action === 'run-tc-inv-file' || inputMode === 'tc-inv-invoice-search'
  })
}

function startActiveRunStatePolling(): void {
  if (activeRunStateTimer !== null) return
  activeRunStateTimer = window.setInterval(() => { void refreshExecutorState(true) }, 3500)
}

function stopActiveRunStatePolling(): void {
  if (activeRunStateTimer === null) return
  window.clearInterval(activeRunStateTimer)
  activeRunStateTimer = null
}

function clearRestoredActiveRunState(): void {
  if (!restoredActiveRun.value) return
  restoredActiveRun.value = false
  sending.value = false
  stopActiveRunStatePolling()
  statusLabel.value = '待命'
}

async function refreshCredentialProfile(): Promise<void> {
  await credentialProfileRef.value?.refresh(selectedCredentialKey.value)
}

function handleCredentialState(state: CredentialProfileState): void {
  hasStoredCredentials.value = state.hasStoredCredentials
  selectedCredentialKey.value = state.accountKey
  if (state.username) shippingUsername.value = state.username
}

function handleCredentialNotice(notice: CredentialNotice): void {
  messageTone.value = notice.tone
  message.value = notice.message
}

async function refreshAutomationTemplates(): Promise<void> {
  if (!entry) return; templateLoading.value = true
  try { automationTemplates.value = await fetchAutomationTemplates(entry.id) } catch { automationTemplates.value = [] }
  finally { templateLoading.value = false }
}

async function downloadPrimaryTemplate(): Promise<void> {
  try { await downloadAutomationTemplate(primaryTemplate.value); messageTone.value = 'success'; message.value = text('模板下载已开始。') }
  catch (e) { const m = readErrorMessage(e, text('模板下载失败。')); messageTone.value = 'warning'; message.value = m; void showAppAlert(m, { tone: 'warning' }) }
}

function downloadAutomationHelper(): void { void openAutomationHelperDownload() }
function bootLocalHelper(): void { primeLocalAutomationLauncherBoot(); messageTone.value = 'info'; message.value = text('已尝试启动本机自动化助手。'); window.setTimeout(() => { void refreshExecutorState(true) }, 1200) }

async function startActiveApp(silent: boolean): Promise<void> {
  if (!entry || launching.value) return
  if (!electronSupported && !launcherReachable.value) primeLocalAutomationLauncherBoot()
  launching.value = true
  try {
    const r = await launchAutomationConsole(entry.appId); if (!r.success) throw new Error(r.error || '启动失败')
    await refreshExecutorState(true)
    if (!silent) { messageTone.value = 'success'; message.value = r.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。') }
  } catch (e) {
    const m = readErrorMessage(e, text('启动失败')); await recordWebAutomationEvent('launch-exception', { appId: entry.appId, entryId: entry.id, error: m })
    if (!silent) { messageTone.value = 'error'; message.value = m }
  } finally { launching.value = false }
}

async function stopActiveApp(): Promise<void> {
  if (!entry) return
  try {
    const r = await stopAutomationConsole(entry.appId); if (!r.success) throw new Error(r.error || '停止失败')
    executorHealth.value = null; clearRestoredActiveRunState(); if (activeApp.value) activeApp.value = { ...activeApp.value, running: false }
    await refreshExecutorState(true).catch(() => {}); messageTone.value = 'info'; message.value = text('执行器已停止。')
  } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('停止失败')) }
}

function handleFileSelect(e: Event): void { const f = getExcelFile((e.target as HTMLInputElement).files); if (f) setSelectedFile(f) }
function handleDragEnter(e: DragEvent): void { if (!hasDraggedFiles(e) || isInternalDragMove(e)) return; dragDepth.value += 1; isDragging.value = true }
function handleDragOver(e: DragEvent): void { if (!hasDraggedFiles(e)) return; if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; isDragging.value = true }
function handleDragLeave(e: DragEvent): void { if (isInternalDragMove(e)) return; dragDepth.value = Math.max(0, dragDepth.value - 1); if (dragDepth.value === 0) isDragging.value = false }
function handleDrop(e: DragEvent): void { resetDragging(); const f = getExcelFile(e.dataTransfer?.files); if (f) setSelectedFile(f) }
function openFilePicker(): void { fileInput.value?.click() }
function clearFile(): void { selectedFile.value = null; resetDragging(); if (fileInput.value) fileInput.value.value = '' }
function setSelectedFile(file: File): void { if (!isExcelFile(file)) { messageTone.value = 'warning'; message.value = text('请上传 .xlsx 或 .xls 文件。'); return }; selectedFile.value = file; message.value = '' }
function getExcelFile(files: FileList | null | undefined): File | null { const list = files ? Array.from(files) : []; const f = list.find(isExcelFile) || null; if (!f && list.length > 0) { messageTone.value = 'warning'; message.value = text('请上传 .xlsx 或 .xls 文件。') }; return f }
function isExcelFile(file: File): boolean { return /\.(xlsx|xls)$/i.test(file.name) }
function hasDraggedFiles(e: DragEvent): boolean { return Array.from(e.dataTransfer?.types || []).includes('Files') }
function isInternalDragMove(e: DragEvent): boolean { const current = e.currentTarget; const related = e.relatedTarget; return current instanceof Node && related instanceof Node && current.contains(related) }
function resetDragging(): void { dragDepth.value = 0; isDragging.value = false }
function formatSize(b: number): string { if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB` }

async function resolveRunCredentialsPayload(): Promise<Record<string, string>> {
  if (!entry) return {}
  if (shippingPassword.value.trim() && shippingUsername.value.trim()) {
    return { username: shippingUsername.value.trim(), password: shippingPassword.value }
  }
  const resolved = await credentialProfileRef.value?.resolveCredentials()
  if (!resolved) throw new Error('请先填写并保存 Infor Nexus 登录账号密码。')
  selectedCredentialKey.value = resolved.accountKey
  shippingUsername.value = resolved.username
  shippingPassword.value = resolved.password
  return { username: resolved.username, password: resolved.password }
}

function readErrorMessage(e: unknown, fb: string): string { return e instanceof Error && e.message ? e.message : fb }
async function createBackendRunRecord(f: File): Promise<AutomationRunRecord | null> {
  if (!entry) return null
  try {
    return await createAutomationRunRecord(entry.id, f, entry.title)
  } catch (error) {
    console.warn('[tc-inv-automation] backend run record create failed', error)
    return null
  }
}
async function finishBackendRunRecord(r: AutomationRunRecord | null, ok: boolean, msg: string, p: Record<string, any> | null): Promise<void> {
  if (!r?.runId) return
  try {
    await finishAutomationRunRecord(r.runId, ok ? 'success' : 'failed', msg || (ok ? 'completed' : 'failed'), p, collectResultFiles(p))
  } catch (error) {
    console.warn('[tc-inv-automation] backend run record finish failed', error)
  }
}
function collectResultFiles(p: Record<string, any> | null): AutomationRunFileInput[] {
  const u = p?.artifacts?.downloadUrls; if (!u || typeof u !== 'object') return []
  return [bfi(u.resultExcelUrl, 'result_excel', 'tc-inv-last-result.xlsx'), bfi(u.resultJsonUrl, 'result_json', 'tc-inv-last-result.json'), bfi(u.failedPoExcelUrl, 'failed_rows_excel', 'tc-inv-last-failed-rows.xlsx'), bfi(u.failedPoJsonUrl, 'failed_rows_json', 'tc-inv-last-failed-rows.json')].filter((x): x is AutomationRunFileInput => Boolean(x))
}
function bfi(rp: string, fr: string, fn: string): AutomationRunFileInput | null { const u = buildShippingArtifactUrl(rp); if (!u) return null; return { url: u, fileRole: fr, fileName: fn } }

function showRunRequirementDialog(rawMessage: string): false {
  const localized = text(rawMessage)
  messageTone.value = 'warning'
  message.value = localized
  statusLabel.value = '待命'
  statusText.value = localized
  lastResult.value = { ok: false, message: localized }
  void showAppAlert(localized, { tone: 'warning' })
  return false
}

function validateShippingInputs(): boolean {
  if (!entry) return showRunRequirementDialog('当前入口不存在，请从 Jessica 浏览器自动化菜单重新进入。')
  if (!selectedFile.value) return showRunRequirementDialog('请先上传 TC INV Excel 文件，文件需包含工厂、交期、费用等字段。')
  const username = shippingUsername.value.trim()
  const password = shippingPassword.value.trim()
  if (password && !username) return showRunRequirementDialog('请先填写 User ID。')
  if (!password && !hasStoredCredentials.value) return showRunRequirementDialog('请先填写并保存 Infor Nexus 登录账号密码。')
  return true
}

async function runTcInv(): Promise<void> {
  if (sending.value) return
  if (!validateShippingInputs()) return
  if (!(await ensureReady())) { setNotReady(); void showAppAlert(statusText.value, { tone: 'warning' }); return }
  const currentEntry = entry
  if (!currentEntry) { showRunRequirementDialog('当前入口不存在，请从 Jessica 浏览器自动化菜单重新进入。'); return }
  const file = selectedFile.value as File; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; shippingArtifactLinks.value = null; lastRawResponse.value = ''; message.value = ''
  try {
    const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload()
    const res = await fetch(shippingExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': currentEntry.localExecutorToken }, body: JSON.stringify({ fileName: file.name, fileBase64: fb64, token: currentEntry.localExecutorToken, headless: !showBrowserView.value, ...cp, automationId: currentEntry.id }) })
    const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); updateShippingArtifactLinks(j)
    await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j)
    if (!res.ok) { const m = buildExecutorResponseMessage(res, raw, j); if (shouldShowAutomationErrorDialog(j?.message || m)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }
    if (!j) throw new Error('无法解析响应。')
    if (j?.ok) { statusLabel.value = '成功'; statusText.value = j.message || 'TC INV 自动化执行完成。'; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }
    statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。')
  } catch (e) { const m = formatAutomationExecutorMessage(readErrorMessage(e, '网络错误'), '自动化执行异常。'); statusLabel.value = '异常'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m }
  finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) }
}

function setNotReady(): void { statusLabel.value = '未就绪'; statusText.value = '本机执行器尚未就绪。'; lastResult.value = { ok: false, message: 'Executor is not ready.' }; messageTone.value = 'warning'; message.value = text('本机执行器未就绪。') }
async function ensureReady(): Promise<boolean> { if (entry && activeApp.value?.available && !isLocalExecutorBusy(executorHealth.value)) await startActiveApp(true); else if (!executorHealth.value?.ok) await startActiveApp(true); await refreshExecutorState(true).catch(() => {}); return Boolean(executorHealth.value?.ok) }
async function fileToBase64(f: File): Promise<string> { const b = await f.arrayBuffer(); return arrayBufferToBase64(b) }
function arrayBufferToBase64(b: ArrayBuffer): string { const bytes = new Uint8Array(b); const cs = 0x8000; let bin = ''; for (let i = 0; i < bytes.length; i += cs) { const chunk = bytes.subarray(i, i + cs); bin += String.fromCharCode(...chunk) }; return window.btoa(bin) }
function safeParseJson(r: string): Record<string, any> | null { try { return r ? JSON.parse(r) : null } catch { return null } }
function buildExecutorResponseMessage(res: Response, raw: string, payload: Record<string, any> | null, fallback = '自动化执行失败。'): string { const rawMessage = typeof payload?.message === 'string' ? payload.message : ''; if (res.status === 404 && /not\s*found/i.test(rawMessage || raw || '')) return '本机执行器缺少当前自动化接口，系统已同步最新自动化逻辑但接口仍不可用。请确认服务器 automation-modules 模块包已发布，或重启本机自动化执行器后再试。'; if (rawMessage) return formatAutomationExecutorMessage(rawMessage, fallback); if (!payload) return formatAutomationExecutorMessage('JSON.parse: unexpected character at line 1 column 1 of the JSON data', fallback); return formatAutomationExecutorMessage(`HTTP ${res.status}`, fallback) }
function updateShippingArtifactLinks(p: Record<string, any> | null): void {
  const u = p?.artifacts?.downloadUrls; const re = buildShippingArtifactUrl(u?.resultExcelUrl)
  if (!re) { shippingArtifactLinks.value = null; return }
  shippingArtifactLinks.value = { resultExcelUrl: re, resultJsonUrl: buildShippingArtifactUrl(u?.resultJsonUrl) || undefined, failedPoExcelUrl: buildShippingArtifactUrl(u?.failedPoExcelUrl) || undefined, failedPoJsonUrl: buildShippingArtifactUrl(u?.failedPoJsonUrl) || undefined, failedRowCount: Number(p?.artifacts?.failedRowCount ?? 0) }
}
function buildShippingArtifactUrl(rp: string): string { const np = String(rp || '').trim(); if (!np) return ''; if (/^https?:\/\//i.test(np)) return np; const bu = String(entry?.executorBaseUrl || '').replace(/\/+$/, ''); return bu ? `${bu}${np.startsWith('/') ? np : `/${np}`}` : '' }
function downloadShippingArtifact(u: string | undefined, fn: string): void { if (!u) return; const a = document.createElement('a'); a.href = u; a.download = fn; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove() }
function createFallback(e: WebAutomationEntry): AutomationAppInfo { return { id: e.appId, name: e.title, description: e.description, provider: 'Playwright', category: '网页自动化', version: '', available: true, running: false, port: Number(new URL(e.executorBaseUrl).port || 0), url: e.executorBaseUrl } }
function goBack(): void { if (window.history.length > 1) router.back(); else void router.push('/') }
</script>

<style scoped lang="scss">
/* ================================================================
   Shipping Automation — v4 Right-Dock Layout
   Left: Main workflow card (credentials + file + execute + artifacts) + Health log
   Right: 260px dock (executor controls + steps + raw response)
   Sky blue + Emerald. No purple. Framework icons only.
   ================================================================ */

.sa {
  --a: #0ea5e9; --a2: #e0f2fe; --ag: #0284c7;
  --em: #059669; --em2: #d1fae5;
  --red: #dc2626; --br: #e2e8f0; --mu: #7c8db5; --ink: #1e293b;
  --r: 14px; --sh: 0 2px 12px rgba(0,0,0,.04);
  display: flex; flex-direction: column; gap: 14px;
  height: 100%; padding: 0 20px 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  color: var(--ink);
}

/* ═══ HERO HEADER ═══ */
.sa-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 14px 0 0; flex-shrink: 0;
  animation: sa-rise .45s cubic-bezier(.22,1,.36,1) both;
  &__left { display: flex; align-items: center; gap: 12px; }
  &__icon {
    width: 40px; height: 40px; border-radius: 13px; flex-shrink: 0;
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    display: flex; align-items: center; justify-content: center;
    color: #fff; box-shadow: 0 5px 16px rgba(14,165,233,.25);
    :deep(.app-icon) { font-size: 18px; }
  }
  &__text {
    h1 { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: -.02em; }
    p { margin: 2px 0 0; font-size: 11px; color: var(--mu); }
  }
  &__right { display: flex; align-items: center; gap: 8px; }
}
.sa-back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 11px;
  border: 1px solid var(--br); background: #fff; color: #64748b;
  cursor: pointer; transition: all .2s cubic-bezier(.22,1,.36,1);
  box-shadow: 0 1px 3px rgba(0,0,0,.04); flex-shrink: 0;
  :deep(.app-icon) { font-size: 14px; }
  &:hover { background: #f8fafc; color: var(--ink); transform: translateX(-2px); }
}

/* ─── Status Pill ─── */
.sa-pill {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 12px;
  font-size: 11px; font-weight: 700; transition: all .3s ease;
  &--on  { background: #ecfdf5; color: #047857; border: 1.5px solid #6ee7b7; box-shadow: 0 2px 8px rgba(5,150,105,.08); }
  &--off { background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca; }
  &__dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0;
    &--on { background: #10b981; box-shadow: 0 0 0 0 rgba(16,185,129,.35); animation: sa-pulse 2.5s ease infinite; }
  }
}
.sa-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 9px;
  background: #f8fafc; border: 1px solid var(--br);
  font-size: 10px; font-weight: 600; color: #94a3b8;
  :deep(.app-icon) { font-size: 10px; color: #f59e0b; }
}

/* ═══ ALERT ═══ */
.sa-alert {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px;
  border-radius: 12px; font-size: 12px; border: 1px solid; font-weight: 500;
  :deep(.app-icon) { font-size: 15px; flex-shrink: 0; }
  &--info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  &--success { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  &--warning { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  &--error   { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  &__close { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-left: auto; border: none; border-radius: 6px; background: rgba(0,0,0,.05); color: var(--mu); cursor: pointer; transition: all .15s;
    :deep(.app-icon) { font-size: 12px; }
    &:hover { background: rgba(0,0,0,.1); }
  }
}
.sa-alert-anim-enter-active { transition: all .25s cubic-bezier(.22,1,.36,1); }
.sa-alert-anim-leave-active { transition: all .15s ease; }
.sa-alert-anim-enter-from, .sa-alert-anim-leave-to { opacity: 0; transform: translateY(-6px); }

/* ═══ HELPER BANNER ═══ */
.sa-helper {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px;
  padding: 14px 18px; border-radius: var(--r);
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fde68a; flex-shrink: 0;
  animation: sa-slideR .4s cubic-bezier(.22,1,.36,1) .08s both;
  &__icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: #fef3c7; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    :deep(.app-icon) { font-size: 18px; color: #d97706; }
  }
  &__body {
    strong { display: block; font-size: 12px; font-weight: 700; }
    p { margin: 2px 0 0; font-size: 11px; color: #92400e; }
  }
  &__btns { display: flex; gap: 6px; flex-shrink: 0; }
}

/* ═══ BODY: LEFT + RIGHT DOCK ═══ */
.sa-body {
  display: grid; grid-template-columns: 1fr 260px; gap: 14px;
  flex: 1; min-height: 0;
}
.sa-left { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }

/* ═══ MAIN CARD ═══ */
.sa-card {
  background: #fff; border: 1px solid var(--br); border-radius: var(--r);
  box-shadow: var(--sh); overflow: hidden;
  animation: sa-rise .5s cubic-bezier(.22,1,.36,1) both;
  &--primary { border-top: 4px solid var(--a); }
  &__hd {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 20px; border-bottom: 1px solid #f1f5f9;
  }
  &__hd-ico {
    width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
    background: var(--a2); display: flex; align-items: center; justify-content: center;
    :deep(.app-icon) { font-size: 16px; color: var(--a); }
  }
  &__hd-info {
    display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;
    strong { font-size: 13px; font-weight: 700; }
    small { font-size: 10px; color: var(--mu); }
  }
  &__bd { padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; }
  &__ft { padding: 0 20px 16px; display: flex; flex-direction: column; gap: 8px; }
}

/* ─── Fields ─── */
.sa-field { display: flex; flex-direction: column; gap: 4px;
  > span { font-size: 11px; font-weight: 600; color: var(--ink); }
}

/* ─── Dropzone ─── */
.sa-drop {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; min-height: 90px; padding: 20px 14px;
  border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;
  cursor: pointer; transition: all .2s ease-in-out; user-select: none;
  input { display: none; }
  &:hover { border-color: #94a3b8; background: #f1f5f9; }
  &--on { border-color: #6ee7b7; border-style: solid; background: #f0fdfa; }
  &--over { border-color: var(--a); border-style: dashed; background: rgba(14,165,233,.04); transform: scale(0.99); }
  b { font-size: 12px; color: #374151; text-align: center; font-weight: 600; }
  small { font-size: 10px; color: #94a3b8; }
  &__ico {
    width: 44px; height: 44px; border-radius: 12px;
    background: #f1f5f9; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    :deep(.app-icon) { font-size: 20px; color: #94a3b8; }
    &--ok { background: #d1fae5;
      :deep(.app-icon) { font-size: 20px; color: #059669; }
    }
    &--float { animation: sa-float 3s ease-in-out infinite; }
  }
  &__info { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  &__x { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #fecaca; border-radius: 8px; background: #fff; color: #dc2626; cursor: pointer; flex-shrink: 0; transition: all .18s;
    :deep(.app-icon) { font-size: 12px; }
    &:hover { background: #fef2f2; border-color: #b91c1c; transform: translateY(-1px); }
  }
  &__overlay { position: absolute; inset: 4px; display: flex; align-items: center; justify-content: center; background: rgba(240,249,255,.92); border: 2px dashed var(--a); border-radius: 10px; font-size: 12px; font-weight: 700; color: var(--a); pointer-events: none; backdrop-filter: blur(4px); animation: sa-dashPulse .8s ease-in-out infinite alternate; }
}

/* ─── Status Bar ─── */
.sa-status {
  display: flex; align-items: center; gap: 7px;
  margin: 0 20px 12px; padding: 9px 13px; border-radius: 10px;
  font-size: 12px; border: 1px solid; font-weight: 500;
  :deep(.app-icon) { font-size: 14px; flex-shrink: 0; }
  &--info { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  &--ok   { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  &--err  { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
}

/* ─── Artifacts Row ─── */
.sa-artifacts { display: flex; flex-wrap: wrap; gap: 7px; padding-top: 0; }

/* ═══ HEALTH LOG ═══ */
.sa-log {
  background: #fff; border: 1px solid var(--br); border-radius: var(--r);
  box-shadow: var(--sh); overflow: hidden; flex-shrink: 0;
  &__hd {
    display: flex; align-items: center; gap: 7px;
    padding: 10px 16px; font-size: 12px; font-weight: 700; color: var(--ink);
    cursor: pointer; list-style: none; transition: color .15s;
    &::-webkit-details-marker { display: none; }
    &:hover { color: #0f172a; }
    &-icon { font-size: 13px; color: var(--a); flex-shrink: 0; }
    span { flex: 1; }
  }
  &__pre {
    margin: 0 12px 12px; max-height: 110px; overflow-y: auto;
    padding: 12px 14px; background: #0f172a; color: #38bdf8;
    font-size: 10px; font-family: 'Cascadia Code','SF Mono',Consolas,monospace;
    white-space: pre-wrap; word-break: break-word;
    border-radius: 8px; line-height: 1.5;
    border: 1px solid rgba(255,255,255,.05);
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
  }
}

/* ═══ RIGHT DOCK ═══ */
.sa-dock {
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0; animation: sa-slideIn .45s cubic-bezier(.22,1,.36,1) .12s both;
}
.sa-dock-card {
  background: #fff; border: 1px solid var(--br); border-radius: var(--r);
  box-shadow: var(--sh); overflow: hidden;
  display: flex; flex-direction: column;
  transition: all .22s cubic-bezier(.22,1,.36,1);
  &:hover { box-shadow: 0 6px 20px rgba(0,0,0,.05); }
  &--flex { flex: 1; min-height: 0; }
}
.sa-dock__hd {
  display: flex; align-items: center; gap: 7px;
  padding: 12px 16px; font-size: 12px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid #f1f5f9;
  &-icon { font-size: 13px; color: var(--a); flex-shrink: 0; }
  &--summary { cursor: pointer; list-style: none; &::-webkit-details-marker { display: none; } }
}
.sa-dock__dot {
  width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; margin-left: auto;
  &--on { background: #10b981; animation: sa-pulse 2.5s ease infinite; }
}
.sa-dock__bd { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }

/* ─── Steps ─── */
.sa-steps { display: flex; flex-direction: column; gap: 4px; }
.sa-step {
  display: flex; gap: 10px; padding: 10px 10px; border-radius: 8px;
  transition: background .15s;
  &:hover { background: #f8fafc; }
  &__n {
    display: flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 7px; flex-shrink: 0;
    background: var(--a2); color: var(--a);
    font-size: 10px; font-weight: 800;
  }
  &__text {
    min-width: 0; flex: 1;
    em { display: block; font-size: 11px; font-style: normal; font-weight: 600; color: var(--ink); }
    small { display: block; font-size: 10px; color: var(--mu); line-height: 1.4; margin-top: 2px; }
  }
}

/* ═══ BUTTONS ═══ */
.sa-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 34px; padding: 0 14px; border: 1px solid var(--br); border-radius: 10px;
  background: #fff; color: #4b5563; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .2s cubic-bezier(.22,1,.36,1); white-space: nowrap;
  :deep(.app-icon) { font-size: 13px; flex-shrink: 0; }
  &:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: .35; cursor: not-allowed; }
  &--pri {
    background: linear-gradient(135deg, var(--a), var(--ag));
    color: #fff; border-color: transparent;
    box-shadow: 0 2px 10px rgba(14,165,233,.2);
    &:hover:not(:disabled) { background: linear-gradient(135deg, var(--a), var(--ag)); box-shadow: 0 4px 16px rgba(14,165,233,.3); filter: brightness(1.05); }
  }
  &--danger { color: var(--red); border-color: #fecaca;
    &:hover:not(:disabled) { background: #fef2f2; }
  }
  &--full { width: 100%; }
  &--execute {
    width: 100%; height: 42px; font-size: 13px; font-weight: 700; color: #fff;
    border-color: transparent; border-radius: 12px;
    background: linear-gradient(135deg, var(--a), var(--ag));
    box-shadow: 0 3px 14px rgba(14,165,233,.25);
    :deep(.app-icon) { font-size: 14px; }
    &:hover:not(:disabled) { background: linear-gradient(135deg, var(--a), var(--ag)); filter: brightness(1.06); box-shadow: 0 5px 20px rgba(14,165,233,.35); }
  }
}

/* ═══ CHIPS ═══ */
.sa-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 99px;
  font-size: 9px; font-weight: 700; flex-shrink: 0; margin-left: auto;
  :deep(.app-icon) { font-size: 9px; }
  &--ok   { background: #ecfdf5; color: #059669; }
  &--warn { background: #fffbeb; color: #d97706; }
}

/* ═══ EMPTY ═══ */
.sa-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 80px 20px; text-align: center;
  &__icon { font-size: 36px; color: #d1d5db; }
  strong { font-size: 16px; }
}
.sa-back {
  display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px;
  border: 1px solid var(--br); border-radius: 8px; background: #fff; color: #4b5563;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s;
  :deep(.app-icon) { font-size: 14px; }
  &:hover { background: #f8fafc; }
}

.sa-chev { transition: transform .25s; details[open] & { transform: rotate(180deg); } }
.sa-spin { animation: sa-spin .8s linear infinite; }

/* ═══ ANIMATIONS ═══ */
@keyframes sa-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sa-slideR { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sa-slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sa-spin { to { transform: rotate(360deg); } }
@keyframes sa-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes sa-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.35); } 70% { box-shadow: 0 0 0 4px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
@keyframes sa-dashPulse { from { opacity: .7; } to { opacity: 1; border-color: #38bdf8; } }

/* ═══ RESPONSIVE ═══ */
@media (max-width: 1200px) { .sa-body { grid-template-columns: 1fr 220px; } }
@media (max-width: 960px) { .sa-body { grid-template-columns: 1fr; } .sa-dock { flex-direction: row; } .sa-dock-card { flex: 1; &--flex { flex: 1; } } }

/* 执行器控制双列格栅 */
.sa-btn-grid {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.sa-btn-grid:last-child {
  margin-bottom: 0;
}
.sa-btn-grid .sa-btn {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
  height: 32px;
  font-size: 11px;
}

/* 按钮微调优化 */
.sa-btn--danger-soft {
  background: #fef2f2 !important;
  border-color: transparent !important;
  color: #ef4444 !important;
}
.sa-btn--danger-soft:hover:not(:disabled) {
  background: #fee2e2 !important;
}
.sa-btn--soft {
  background: #f0f9ff !important;
  border-color: transparent !important;
  color: #0ea5e9 !important;
}
.sa-btn--soft:hover:not(:disabled) {
  background: #e0f2fe !important;
}

/* 侧边栏健康日志 Drawer & Overlay */
.sa-drawer-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
}
.sa-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  background: #0f172a;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  box-sizing: border-box;
  color: #f8fafc;
}
.sa-drawer__hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.sa-drawer__title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sa-drawer__title h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}
.sa-drawer__title p {
  font-size: 10px;
  color: #94a3b8;
  margin: 2px 0 0;
}
.sa-drawer__close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}
.sa-drawer__close-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f8fafc;
}
.sa-drawer__bd {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
}
.sa-drawer__pre {
  margin: 0;
  font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 侧栏过渡动画 */
.sa-drawer-fade-enter-active,
.sa-drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.sa-drawer-fade-enter-from,
.sa-drawer-fade-leave-to {
  opacity: 0;
}
.sa-drawer-slide-enter-active,
.sa-drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.sa-drawer-slide-enter-from,
.sa-drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>

<!-- Override shell padding so this page fills edge-to-edge -->
<style>
.content-shell:has(.sa) {
  padding: 0 !important;
}
</style>
