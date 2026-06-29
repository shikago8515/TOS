<template>
  <div class="pad">
    <transition name="pad-alert">
      <div v-if="message" class="pad-alert" :class="`pad-alert--${messageTone}`">
        <AppIcon :name="messageIconName" />
        <span>{{ text(message) }}</span>
        <button class="pad-alert__close" type="button" @click="message = ''">
          <AppIcon name="stop-circle" />
        </button>
      </div>
    </transition>

    <div v-if="!entry" class="pad-empty">
      <AppIcon name="alert-circle" class="pad-empty__icon" />
      <strong>{{ text('入口不存在') }}</strong>
      <p>{{ text('请从 Jessica 浏览器自动化菜单重新进入。') }}</p>
      <button class="pad-btn" type="button" @click="goBack">
        <AppIcon name="arrow-left" />{{ text('返回') }}
      </button>
    </div>

    <template v-else>
      <header class="pad-head">
        <div class="pad-head__left">
          <button class="pad-back" type="button" @click="goBack">
            <AppIcon name="arrow-left" />
          </button>
          <div class="pad-head__icon">
            <AppIcon name="download-cloud" />
          </div>
          <div class="pad-head__text">
            <h1>{{ text(entry.title) }}</h1>
            <p>{{ text(entry.subtitle) }}</p>
          </div>
        </div>
        <div class="pad-head__right">
          <span class="pad-pill" :class="executorHealth?.ok ? 'pad-pill--ok' : 'pad-pill--off'">
            <span class="pad-pill__dot" />
            {{ executorHealth?.ok ? text('执行器就绪') : text('执行器未连接') }}
          </span>
          <span class="pad-tag"><AppIcon name="zap" /> Request First</span>
        </div>
      </header>

      <transition name="pad-alert">
        <section v-if="showLocalHelperPrompt" class="pad-helper">
          <div class="pad-helper__icon"><AppIcon name="monitor-code" /></div>
          <div class="pad-helper__body">
            <strong>{{ text('未检测到本机自动化助手') }}</strong>
            <p>{{ text('请先启动 TOS 自动化助手，然后重新检测。') }}</p>
          </div>
          <div class="pad-helper__actions">
            <button class="pad-btn pad-btn--primary" type="button" @click="downloadAutomationHelper">
              <AppIcon name="download" />{{ text('下载助手') }}
            </button>
            <button class="pad-btn" type="button" @click="bootLocalHelper">
              <AppIcon name="play-circle" />{{ text('启动') }}
            </button>
            <button class="pad-btn" type="button" :disabled="refreshing" @click="refreshExecutorState(false)">
              <AppIcon name="refresh-cw" :class="{ 'pad-spin': refreshing }" />{{ text('重新检测') }}
            </button>
          </div>
        </section>
      </transition>

      <div class="pad-body">
        <main class="pad-main">
          <section class="pad-card pad-card--main">
            <div class="pad-card__head">
              <div class="pad-card__icon"><AppIcon name="download-cloud" /></div>
              <div>
                <strong>{{ text('请求下载箱单 PDF') }}</strong>
                <small>{{ text('上传 Excel 后按 PO 号查询箱单并发起下载到本机目录。') }}</small>
              </div>
              <span class="pad-chip" :class="executorHealth?.ok ? 'pad-chip--ok' : 'pad-chip--warn'">
                {{ executorHealth?.ok ? text('就绪') : text('等待执行器') }}
              </span>
            </div>

            <div class="pad-card__body">
              <AutomationAccountProfileManager
                ref="credentialProfileRef"
                v-model:selected-key="selectedCredentialKey"
                v-model:username="shippingUsername"
                v-model:password="shippingPassword"
                :automation-id="entry.id"
                :default-username="DEFAULT_INFOR_NEXUS_USERNAME"
                @state="handleCredentialState"
                @notice="handleCredentialNotice"
              />
            </div>

            <div class="pad-card__body">
              <div class="pad-field">
                <span class="pad-field-head">
                  <span>{{ text('Excel 文件') }}</span>
                  <button class="pad-btn pad-btn--template" type="button" :disabled="templateDownloading" @click.stop="downloadTemplate">
                    <AppIcon :name="templateDownloading ? 'loader' : 'download'" :class="{ 'pad-spin': templateDownloading }" />{{ text('下载模板') }}
                  </button>
                </span>
                <div
                  class="pad-drop"
                  :class="{ 'pad-drop--on': selectedFile, 'pad-drop--over': isDragging }"
                  role="button"
                  tabindex="0"
                  @click="openFilePicker"
                  @keydown.enter.prevent="openFilePicker"
                  @keydown.space.prevent="openFilePicker"
                  @dragenter.prevent="handleDragEnter"
                  @dragover.prevent="handleDragOver"
                  @dragleave.prevent="handleDragLeave"
                  @drop.prevent="handleDrop"
                >
                  <input ref="fileInput" type="file" accept=".xlsx,.xls" @click.stop @change="handleFileSelect" />
                  <template v-if="selectedFile">
                    <div class="pad-drop__icon pad-drop__icon--ok"><AppIcon name="check-circle" /></div>
                    <div class="pad-drop__text">
                      <strong>{{ selectedFile.name }}</strong>
                      <small>{{ formatSize(selectedFile.size) }}</small>
                    </div>
                    <button class="pad-drop__clear" type="button" @click.stop="clearFile">
                      <AppIcon name="stop-circle" />
                    </button>
                  </template>
                  <template v-else>
                    <div class="pad-drop__icon"><AppIcon name="upload" /></div>
                    <div class="pad-drop__text">
                      <strong>{{ text('点击或拖入 Excel 文件') }}</strong>
                      <small>{{ text('请包含 PO NUMBER 和 STATUS 列') }}</small>
                    </div>
                  </template>
                  <div v-if="isDragging" class="pad-drop__overlay">{{ text('释放以上传文件') }}</div>
                </div>
              </div>
            </div>

            <div class="pad-card__body">
              <label class="pad-field">
                <span>{{ text('下载保存目录') }}</span>
                <div class="pad-path">
                  <div class="pad-input-wrap pad-input-wrap--path">
                    <AppIcon name="folder" />
                    <input v-model.trim="saveDirectory" class="pad-input" type="text" :placeholder="text('例如：D:\\Downloads\\InforNexus\\PackingList')" @change="persistDownloadConfig" />
                  </div>
                  <button class="pad-btn" type="button" :disabled="directorySelecting" @click="selectSaveDirectory">
                    <AppIcon :name="directorySelecting ? 'loader' : 'folder'" :class="{ 'pad-spin': directorySelecting }" />
                    {{ directorySelecting ? text('打开中...') : canSelectDirectory ? text('选择目录') : text('手动填写') }}
                  </button>
                </div>
              </label>
            </div>

            <div class="pad-card__footer">
              <button class="pad-btn pad-btn--run" type="button" :disabled="!canRunPackingListDownload" @click="runPackingListAutoDownload">
                <AppIcon :name="sending ? 'loader' : 'download-cloud'" :class="{ 'pad-spin': sending }" />
                {{ sending ? text('执行中...') : text('上传 Excel 并下载箱单 PDF') }}
              </button>
            </div>

            <transition name="pad-alert">
              <div v-if="statusText || sending" class="pad-status" :class="inlineStatusClass">
                <AppIcon :name="statusIconName" :class="{ 'pad-spin': sending }" />
                <span>{{ text(statusLabel) }} · {{ statusText || text('等待上传 Excel 并填写箱单下载保存目录。') }}</span>
              </div>
            </transition>

            <div v-if="sending && runProgress" class="pad-progress">
              <div class="pad-progress__head">
                <span>{{ text(progressPhase) }}</span>
                <b>{{ progressCompleted }}/{{ progressTotal }}</b>
              </div>
              <div class="pad-progress__track">
                <span :style="{ width: `${progressPercentage}%` }" />
              </div>
              <div class="pad-progress__meta">
                <span>{{ text('已下载') }} {{ progressDownloaded }}</span>
                <span>{{ text('失败') }} {{ progressFailed }}</span>
                <span v-if="progressCurrent">{{ text('当前') }} {{ progressCurrent }}</span>
              </div>
            </div>
          </section>
        </main>

        <aside class="pad-dock">
          <section class="pad-dock-card">
            <div class="pad-dock-card__head">
              <AppIcon name="server" />
              <span>{{ text('执行器控制') }}</span>
              <span class="pad-dock-dot" :class="{ 'pad-dock-dot--ok': executorHealth?.ok }" />
            </div>
            <div class="pad-dock-card__body">
              <BrowserVisibilitySwitch v-model="showBrowserView" />
              <div class="sa-btn-grid">
                <button class="sa-btn sa-btn--pri" type="button" :disabled="!canLaunchActiveApp" @click="startActiveApp(false)">
                  <AppIcon name="play-circle" />{{ launching ? text('启动中...') : text('启动') }}
                </button>
                <button class="sa-btn sa-btn--danger-soft" type="button" :disabled="!canStopActiveApp" @click="stopActiveApp">
                  <AppIcon name="stop-circle" />{{ text('停止') }}
                </button>
              </div>
              <div class="sa-btn-grid">
                <button class="sa-btn sa-btn--soft" type="button" :disabled="refreshing" @click="refreshExecutorState(false)">
                  <AppIcon name="refresh-cw" :class="{ 'pad-spin': refreshing }" />{{ text('刷新') }}
                </button>
                <button class="sa-btn sa-btn--soft" type="button" @click="isHealthLogOpen = true">
                  <AppIcon name="terminal" />{{ text('日志') }}
                </button>
              </div>
            </div>
          </section>

          <AutomationRunHistoryPanel :automation-id="entry.id" :refresh-signal="lastRawResponse" />

          <section class="pad-dock-card pad-dock-card--grow">
            <div class="pad-dock-card__head">
              <AppIcon name="workflow" />
              <span>{{ text('操作流程') }}</span>
            </div>
            <div class="pad-steps">
              <div v-for="(step, index) in steps" :key="step.title" class="pad-step">
                <b>{{ index + 1 }}</b>
                <div>
                  <strong>{{ text(step.title) }}</strong>
                  <small>{{ text(step.desc) }}</small>
                </div>
              </div>
            </div>
          </section>

          <details v-if="lastRawResponse" class="pad-dock-card">
            <summary class="pad-dock-card__head pad-dock-card__head--summary">
              <AppIcon name="code" />
              <span>{{ text('原始响应') }}</span>
              <AppIcon name="chevron-down" class="pad-chev" />
            </summary>
            <pre class="pad-dock-pre">{{ lastRawResponse }}</pre>
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
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import BrowserVisibilitySwitch from '../../../shared/ui/BrowserVisibilitySwitch.vue'
import { showAppAlert } from '../../../shared/ui/appAlert'
import AutomationAccountProfileManager from '../../web-automation/components/AutomationAccountProfileManager.vue'
import AutomationRunHistoryPanel from '../../web-automation/components/AutomationRunHistoryPanel.vue'
import type { AutomationAppInfo } from '../../../types/electronApi'
import type { AutomationRunRecord, LocalExecutorHealth } from '../../web-automation/webAutomationApi'
import {
  createAutomationRunRecord,
  downloadAutomationTemplate,
  fetchAutomationApps,
  fetchAutomationTemplates,
  findLocalExecutorActiveRun,
  finishAutomationRunRecord,
  getAutomationHelperUpdateMessage,
  hasElectronAutomationSupport,
  isLocalExecutorBusy,
  launchAutomationConsole,
  openAutomationHelperDownload,
  primeLocalAutomationLauncherBoot,
  probeLocalAutomationLauncherHealth,
  probeLocalExecutorHealth,
  recordWebAutomationEvent,
  stopAutomationConsole,
} from '../../web-automation/webAutomationApi'
import { appendAutomationFailureExamples, formatAutomationExecutorMessage, shouldShowAutomationErrorDialog, showAutomationErrorDialog } from '../../web-automation/webAutomationErrors'
import {
  DEFAULT_INFOR_NEXUS_USERNAME,
  normalizeInforNexusUsername,
} from '../../web-automation/webAutomationCredentials'
import { getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from '../../web-automation/webAutomationModel'

const ENTRY_ID = 'packing-list-auto-download'
const DOWNLOAD_DIR_STORAGE_KEY = 'tos-packing-list-auto-download-directory'

type CredentialProfileRef = {
  refresh: (accountKey?: string) => Promise<void>
  resolveCredentials: () => Promise<{ username: string; password: string; accountKey: string }>
}
type CredentialProfileState = { hasStoredCredentials: boolean; username: string; accountKey: string }
type CredentialNotice = { tone: WebAutomationNoticeTone; message: string }

const router = useRouter()
const { text } = useAppLanguage()
const entry = getWebAutomationEntry(ENTRY_ID)
const electronSupported = hasElectronAutomationSupport()

const activeApp = ref<AutomationAppInfo | null>(null)
const executorHealth = ref<LocalExecutorHealth | null>(null)
const launcherReachable = ref(false)
const launching = ref(false)
const refreshing = ref(false)
const sending = ref(false)
const restoredActiveRun = ref(false)
const templateDownloading = ref(false)
const directorySelecting = ref(false)
const message = ref('')
const messageTone = ref<WebAutomationNoticeTone>('info')
const isHealthLogOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const dragDepth = ref(0)
const shippingUsername = ref(DEFAULT_INFOR_NEXUS_USERNAME)
const shippingPassword = ref('')
const selectedCredentialKey = ref('default')
const hasStoredCredentials = ref(false)
const credentialProfileRef = ref<CredentialProfileRef | null>(null)
const showBrowserView = ref(true)
const saveDirectory = ref('')
const statusLabel = ref('待命')
const statusText = ref('')
const lastResult = ref<{ ok: boolean; message?: string } | null>(null)
const lastRawResponse = ref('')
const runProgress = ref<Record<string, any> | null>(null)
let progressTimer: number | null = null

const steps = [
  { title: '上传 Excel 文件', desc: '读取 PO NUMBER 和 STATUS 列生成箱单下载清单。' },
  { title: '选择保存目录', desc: '文件会直接保存到用户电脑指定目录。' },
  { title: '请求下载优先', desc: '本机执行器优先使用登录态发起箱单下载请求。' },
  { title: '查看下载结果', desc: '完成数量、失败箱单和保存路径会返回页面。' },
]

const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorRunUrl = computed(() => {
  const base = String(entry?.executorBaseUrl || '').replace(/\/+$/, '')
  return base ? `${base}/api/run-packing-list-auto-download-file` : ''
})
const executorDirectorySelectUrl = computed(() => {
  const base = String(entry?.executorBaseUrl || '').replace(/\/+$/, '')
  return base ? `${base}/api/select-download-directory` : ''
})
const canSelectDirectory = computed(() => Boolean(window.electronAPI?.selectDirectory || executorDirectorySelectUrl.value))
const executorSupportsDirectoryPicker = computed(() => Boolean(
  window.electronAPI?.selectDirectory
    || executorHealth.value?.capabilities?.packingListAutoDownloadDirectoryPicker
    || executorHealth.value?.capabilities?.poAutoDownloadDirectoryPicker,
))
const showLocalHelperPrompt = computed(() => !electronSupported && !launcherReachable.value)
const canLaunchActiveApp = computed(() => Boolean(entry?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)
const canRunPackingListDownload = computed(() => !sending.value)
const inlineStatusClass = computed(() => {
  if (sending.value) return 'pad-status--info'
  if (lastResult.value?.ok) return 'pad-status--ok'
  if (lastResult.value && !lastResult.value.ok) return 'pad-status--error'
  return 'pad-status--info'
})
const statusIconName = computed(() => {
  if (sending.value) return 'loader'
  if (lastResult.value?.ok) return 'check-circle'
  if (lastResult.value && !lastResult.value.ok) return 'alert-circle'
  return 'activity'
})
const progressPhase = computed(() => String(runProgress.value?.phase || '执行中'))
const progressTotal = computed(() => {
  const total = Number(runProgress.value?.activeCount || runProgress.value?.totalCount || 0)
  return Number.isFinite(total) && total > 0 ? total : 0
})
const progressCompleted = computed(() => {
  const completed = Number(runProgress.value?.completedCount || 0)
  return Number.isFinite(completed) && completed > 0 ? completed : 0
})
const progressDownloaded = computed(() => {
  const downloaded = Number(runProgress.value?.downloadedCount || 0)
  return Number.isFinite(downloaded) && downloaded > 0 ? downloaded : 0
})
const progressFailed = computed(() => {
  const failed = Number(runProgress.value?.failedCount || 0)
  return Number.isFinite(failed) && failed > 0 ? failed : 0
})
const progressPercentage = computed(() => {
  if (progressTotal.value <= 0) return sending.value ? 6 : 0
  return Math.min(100, Math.max(4, Math.round((progressCompleted.value / progressTotal.value) * 100)))
})
const progressCurrent = computed(() => {
  const values = Array.isArray(runProgress.value?.currentPackingListNumbers)
    ? runProgress.value.currentPackingListNumbers
    : Array.isArray(runProgress.value?.currentInvoiceNumbers)
      ? runProgress.value.currentInvoiceNumbers
    : []
  return values.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 3).join('、')
})
const messageIconName = computed(() => {
  if (messageTone.value === 'success') return 'check-circle'
  if (messageTone.value === 'error') return 'alert-circle'
  if (messageTone.value === 'warning') return 'info'
  return 'activity'
})

onMounted(() => {
  restoreDownloadConfig()
  void initializeScenario()
})

onBeforeUnmount(() => {
  stopProgressPolling()
})

async function initializeScenario(): Promise<void> {
  statusLabel.value = '待命'
  statusText.value = text('等待上传 Excel 并填写箱单下载保存目录。')
  await refreshCredentialProfile()
  await refreshExecutorState(true)
  if (electronSupported && activeApp.value?.available && !isLocalExecutorBusy(executorHealth.value)) {
    await startActiveApp(true)
  }
}

function restoreDownloadConfig(): void {
  saveDirectory.value = window.localStorage.getItem(DOWNLOAD_DIR_STORAGE_KEY) || ''
}

function persistDownloadConfig(): void {
  window.localStorage.setItem(DOWNLOAD_DIR_STORAGE_KEY, saveDirectory.value.trim())
}

async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry || refreshing.value) return
  refreshing.value = true
  const fallback = createFallback(entry)

  try {
    launcherReachable.value = electronSupported ? true : await probeLocalAutomationLauncherHealth()
    if (electronSupported) {
      try {
        const apps = await fetchAutomationApps()
        activeApp.value = apps.find((app) => app.id === entry.appId) ?? fallback
      } catch {
        activeApp.value = fallback
      }
    } else {
      activeApp.value = fallback
    }

    if (!electronSupported && !launcherReachable.value) {
      executorHealth.value = null
      clearRestoredActiveRunState()
      if (!silent) {
        messageTone.value = 'warning'
        message.value = text('未检测到本机自动化助手')
      }
      return
    }

    executorHealth.value = await probeLocalExecutorHealth(entry.executorBaseUrl)
    await refreshCredentialProfile()
    if (activeApp.value) {
      activeApp.value = { ...activeApp.value, running: true }
    }
    syncActiveRunViewFromHealth()
    const updateMessage = getAutomationHelperUpdateMessage(executorHealth.value, activeApp.value)
    if (updateMessage) {
      messageTone.value = 'warning'
      message.value = text(updateMessage)
    } else if (!silent) {
      messageTone.value = 'success'
      message.value = text('状态已刷新。')
    }
  } catch {
    executorHealth.value = null
    activeApp.value = activeApp.value || fallback
    clearRestoredActiveRunState()
    if (!silent) {
      messageTone.value = 'warning'
      message.value = text('执行器未就绪。')
    }
  } finally {
    refreshing.value = false
  }
}

function syncActiveRunViewFromHealth(): void {
  const activeRun = findPackingListAutoDownloadActiveRun(executorHealth.value)
  if (activeRun) {
    restoredActiveRun.value = true
    sending.value = true
    lastResult.value = null
    statusLabel.value = '执行中'
    const progress = extractRunProgress(executorHealth.value)
    if (progress) {
      runProgress.value = progress
      statusText.value = formatRunProgress(progress)
    } else {
      const inputFileName = String(activeRun.inputFileName || '').trim()
      statusText.value = inputFileName ? `执行器仍在下载 ${inputFileName}，请勿重复启动。` : text('执行器仍在下载箱单 PDF，请勿重复启动。')
    }
    startProgressPolling()
    return
  }
  if (!restoredActiveRun.value) return
  clearRestoredActiveRunState()
  statusText.value = text('后台下载任务已结束，请查看执行记录或重新开始。')
}

function clearRestoredActiveRunState(): void {
  if (!restoredActiveRun.value) return
  restoredActiveRun.value = false
  sending.value = false
  stopProgressPolling()
  runProgress.value = null
  statusLabel.value = '待命'
}

function findPackingListAutoDownloadActiveRun(health: LocalExecutorHealth | null | undefined): Record<string, any> | null {
  return findLocalExecutorActiveRun(health, (run) => {
    const action = String(run.action || '').trim()
    const inputMode = String(run.inputMode || '').trim()
    return action === 'run-packing-list-auto-download-file' || inputMode === 'packing-list-auto-download'
  })
}

function startProgressPolling(): void {
  stopProgressPolling()
  void pollRunProgress()
  progressTimer = window.setInterval(() => {
    void pollRunProgress()
  }, 1000)
}

function stopProgressPolling(): void {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
}

async function pollRunProgress(): Promise<void> {
  if (!entry || !sending.value) return
  try {
    const health = await probeLocalExecutorHealth(entry.executorBaseUrl)
    executorHealth.value = health
    if (restoredActiveRun.value && !findPackingListAutoDownloadActiveRun(health)) {
      clearRestoredActiveRunState()
      statusText.value = text('后台下载任务已结束，请查看执行记录或重新开始。')
      return
    }
    const progress = extractRunProgress(health)
    if (progress) {
      runProgress.value = progress
      statusText.value = formatRunProgress(progress)
    }
  } catch {
    // Polling is best-effort; the final POST response still decides the result.
  }
}

function extractRunProgress(payload: Record<string, any> | LocalExecutorHealth | null | undefined): Record<string, any> | null {
  const activeRun = payload?.activeRun as Record<string, any> | null | undefined
  if (activeRun?.progress && typeof activeRun.progress === 'object') return activeRun.progress
  const activeRuns = Array.isArray(payload?.activeRuns) ? payload.activeRuns as Record<string, any>[] : []
  const firstProgress = activeRuns.find((item) => item?.progress)?.progress
  if (firstProgress && typeof firstProgress === 'object') return firstProgress
  const lastRun = payload?.lastRun as Record<string, any> | null | undefined
  if (lastRun?.progress && typeof lastRun.progress === 'object') return lastRun.progress
  const directProgress = (payload as Record<string, any> | null | undefined)?.progress
  return directProgress && typeof directProgress === 'object' ? directProgress : null
}

function formatRunProgress(progress: Record<string, any>): string {
  const phase = String(progress.phase || '执行中')
  const total = Number(progress.activeCount || progress.totalCount || 0)
  const completed = Number(progress.completedCount || 0)
  const downloaded = Number(progress.downloadedCount || 0)
  const failed = Number(progress.failedCount || 0)
  const currentValues = Array.isArray(progress.currentPackingListNumbers)
    ? progress.currentPackingListNumbers
    : Array.isArray(progress.currentInvoiceNumbers)
      ? progress.currentInvoiceNumbers
      : []
  const current = currentValues.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 3).join('、')
  const countText = total > 0
    ? `已处理 ${Math.max(0, completed)}/${total}，已下载 ${Math.max(0, downloaded)}，失败 ${Math.max(0, failed)}`
    : String(progress.message || '正在处理')
  return current ? `${phase} · ${countText}，当前 ${current}` : `${phase} · ${countText}`
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

async function startActiveApp(silent: boolean): Promise<void> {
  if (!entry || launching.value) return
  launching.value = true
  try {
    const result = await launchAutomationConsole(entry.appId)
    if (!result.success) {
      throw new Error(result.error || 'Launch failed.')
    }
    if (!silent) {
      messageTone.value = 'success'
      message.value = result.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。')
    }
  } catch (error) {
    if (!silent) {
      messageTone.value = 'error'
      message.value = readErrorMessage(error, text('启动执行器失败。'))
    }
  } finally {
    launching.value = false
    await refreshExecutorState(true).catch(() => {})
  }
}

async function stopActiveApp(): Promise<void> {
  if (!entry || launching.value) return
  launching.value = true
  try {
    const result = await stopAutomationConsole(entry.appId)
    if (!result.success) {
      throw new Error(result.error || 'Stop failed.')
    }
    executorHealth.value = null
    clearRestoredActiveRunState()
    if (activeApp.value) activeApp.value = { ...activeApp.value, running: false }
    messageTone.value = 'success'
    message.value = text('执行器已停止。')
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, text('停止执行器失败。'))
  } finally {
    launching.value = false
  }
}

function downloadAutomationHelper(): void {
  void openAutomationHelperDownload()
}

function bootLocalHelper(): void {
  primeLocalAutomationLauncherBoot()
  messageTone.value = 'info'
  message.value = text('已尝试启动本机自动化助手。')
  window.setTimeout(() => { void refreshExecutorState(true) }, 1200)
}

async function selectSaveDirectory(): Promise<void> {
  if (directorySelecting.value) return
  directorySelecting.value = true
  if (window.electronAPI?.selectDirectory) {
    try {
      const result = await window.electronAPI.selectDirectory({
        title: text('选择箱单下载保存目录'),
        defaultPath: saveDirectory.value.trim() || undefined,
      })
      if (!result.success) {
        messageTone.value = 'error'
        message.value = result.error || text('选择目录失败。')
        return
      }
      if (!result.canceled && result.path) {
        saveDirectory.value = result.path
        persistDownloadConfig()
      }
    } finally {
      directorySelecting.value = false
    }
    return
  }

  if (!executorDirectorySelectUrl.value) {
    messageTone.value = 'warning'
    message.value = text('当前浏览器环境无法打开系统目录选择器，请手动填写完整本机路径。')
    directorySelecting.value = false
    return
  }

  if (!await ensureReady()) {
    setNotReady()
    directorySelecting.value = false
    return
  }

  if (!executorSupportsDirectoryPicker.value) {
    messageTone.value = 'warning'
    message.value = text('本机自动化助手版本落后，请下载并安装最新版后重试。')
    directorySelecting.value = false
    return
  }

  try {
    messageTone.value = 'info'
    message.value = text('正在打开本机目录选择器，请留意系统弹窗。')
    const response = await fetch(executorDirectorySelectUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Executor-Token': entry?.localExecutorToken || '',
      },
      body: JSON.stringify({
        token: entry?.localExecutorToken,
        initialDirectory: saveDirectory.value.trim(),
      }),
    })
    const raw = await response.text()
    const result = safeParseJson(raw)
    if (response.status === 404) {
      messageTone.value = 'warning'
      message.value = text('本机自动化助手版本落后，请下载并安装最新版后重试。')
      return
    }
    if (result?.canceled) {
      messageTone.value = 'info'
      message.value = text('已取消选择目录。')
      return
    }
    if (!response.ok || !result?.ok || !result.path) {
      messageTone.value = 'error'
      message.value = result?.message || text('选择目录失败。')
      return
    }
    saveDirectory.value = String(result.path)
    persistDownloadConfig()
    messageTone.value = 'success'
    message.value = text('已选择下载保存目录。')
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, text('选择目录失败。'))
  } finally {
    directorySelecting.value = false
  }
}

async function downloadTemplate(): Promise<void> {
  if (templateDownloading.value) return
  templateDownloading.value = true
  try {
    const templates = entry ? await fetchAutomationTemplates(entry.id) : []
    const template = templates[0] || null
    if (!template) {
      const errorMessage = text('自动下载箱单模板未上传，请先在 Excel 模板中心上传。')
      messageTone.value = 'warning'
      message.value = errorMessage
      void showAppAlert(errorMessage, { tone: 'warning' })
      return
    }

    await downloadAutomationTemplate(template)
    messageTone.value = 'success'
    message.value = text('模板下载已开始。')
  } catch (error) {
    const errorMessage = readErrorMessage(error, text('模板下载失败。'))
    messageTone.value = 'error'
    message.value = errorMessage
    void showAppAlert(errorMessage, { tone: 'error' })
  } finally {
    templateDownloading.value = false
  }
}

function openFilePicker(): void {
  fileInput.value?.click()
}

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (file) setSelectedFile(file)
}

function handleDragEnter(): void {
  dragDepth.value += 1
  isDragging.value = true
}

function handleDragOver(): void {
  isDragging.value = true
}

function handleDragLeave(): void {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) isDragging.value = false
}

function handleDrop(event: DragEvent): void {
  dragDepth.value = 0
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0] || null
  if (file) setSelectedFile(file)
}

function setSelectedFile(file: File): void {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    messageTone.value = 'warning'
    message.value = text('请选择 .xlsx 或 .xls 文件。')
    return
  }
  selectedFile.value = file
  statusLabel.value = '待命'
  statusText.value = text('Excel 已选择，等待下载。')
  lastResult.value = null
  lastRawResponse.value = ''
  runProgress.value = null
}

function clearFile(): void {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function showRunRequirementDialog(rawMessage: string): false {
  const localized = text(rawMessage)
  messageTone.value = 'warning'
  message.value = localized
  statusLabel.value = '待命'
  statusText.value = localized
  void showAppAlert(localized, { tone: 'warning' })
  return false
}

function validatePackingListDownloadInputs(): boolean {
  if (!entry) {
    return showRunRequirementDialog('当前入口不存在，请从 Jessica 浏览器自动化菜单重新进入。')
  }
  if (!selectedFile.value) {
    return showRunRequirementDialog('请先上传 Excel 文件，文件需包含 PO NUMBER 和 STATUS 列。')
  }
  if (!saveDirectory.value.trim()) {
    return showRunRequirementDialog('请先选择或填写下载保存目录。')
  }

  const username = shippingUsername.value.trim()
  const password = shippingPassword.value.trim()
  if (password && !username) {
    return showRunRequirementDialog('请先填写 User ID。')
  }
  if (!password && !hasStoredCredentials.value) {
    return showRunRequirementDialog('请先填写并保存 Infor Nexus 登录账号密码。')
  }

  return true
}

async function runPackingListAutoDownload(): Promise<void> {
  if (sending.value) return
  if (!validatePackingListDownloadInputs()) return
  if (!await ensureReady()) {
    setNotReady()
    void showAppAlert(statusText.value, { tone: 'warning' })
    return
  }
  const currentEntry = entry
  if (!currentEntry) {
    showRunRequirementDialog('当前入口不存在，请从 Jessica 浏览器自动化菜单重新进入。')
    return
  }

  const file = selectedFile.value as File
  persistDownloadConfig()
  sending.value = true
  statusLabel.value = '执行中'
  statusText.value = text('正在上传 Excel 并发起箱单 PDF 请求下载...')
  lastResult.value = null
  runProgress.value = null
  startProgressPolling()

  const runRecord = await createBackendRunRecord(file)

  try {
    const fileBase64 = await fileToBase64(file)
    const credentialPayload = await buildCredentialPayload()
    const payload: Record<string, unknown> = {
      fileName: file.name,
      fileBase64,
      token: currentEntry.localExecutorToken,
      headless: !showBrowserView.value,
      downloadDirectory: saveDirectory.value.trim(),
      downloadMode: 'request-first',
      ...credentialPayload,
    }

    const response = await fetch(executorRunUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Executor-Token': currentEntry.localExecutorToken,
      },
      body: JSON.stringify(payload),
    })
    const raw = await response.text()
    lastRawResponse.value = raw
    const json = safeParseJson(raw)
    const finalProgress = extractRunProgress(json)
    if (finalProgress) runProgress.value = finalProgress
    await finishBackendRunRecord(runRecord, response.ok && Boolean(json?.ok), json?.message || '', json)

    if (!response.ok) {
      const friendlyMessage = buildExecutorResponseMessage(response, raw, json)
      if (shouldShowAutomationErrorDialog(json?.message || friendlyMessage)) showAutomationErrorDialog(friendlyMessage)
      statusLabel.value = '未完成'
      statusText.value = appendFailureExamples(friendlyMessage, json)
      lastResult.value = { ok: false, message: statusText.value }
      messageTone.value = 'error'
      message.value = statusText.value
      return
    }

    if (!json) {
      throw new Error('无法解析响应。')
    }

    if (json?.ok) {
      const completed = Number(json.downloadedInvoiceCount ?? json.downloadedPoCount ?? json.completedPoCount ?? 0)
      const total = Number(json.totalInvoiceCount ?? json.totalPoCount ?? 0)
      statusLabel.value = '成功'
      statusText.value = total > 0
        ? `箱单 PDF 下载完成。已下载 ${completed}/${total} 份箱单。`
        : text('箱单 PDF 下载完成。')
      lastResult.value = { ok: true, message: json.message }
      messageTone.value = 'success'
      message.value = text('执行完成。')
      return
    }

    statusLabel.value = '未完成'
    statusText.value = appendFailureExamples(json?.message || text('已触发，结果未确认。'), json)
    lastResult.value = { ok: false, message: statusText.value }
    messageTone.value = 'warning'
    message.value = text('已触发，结果未确认。')
  } catch (error) {
    const friendlyMessage = formatAutomationExecutorMessage(readErrorMessage(error, text('网络错误')), '自动化执行异常。')
    statusLabel.value = '异常'
    statusText.value = friendlyMessage
    lastResult.value = { ok: false, message: statusText.value }
    messageTone.value = 'error'
    message.value = friendlyMessage
    await finishBackendRunRecord(runRecord, false, statusText.value, { ok: false, message: statusText.value }).catch(() => {})
  } finally {
    stopProgressPolling()
    sending.value = false
    await refreshExecutorState(true).catch(() => {})
  }
}

async function buildCredentialPayload(): Promise<{ username: string; password: string }> {
  if (!entry) {
    throw new Error('Entry is missing.')
  }
  if (shippingPassword.value.trim()) {
    const username = normalizePackingListAutoDownloadUsername(shippingUsername.value)
    shippingUsername.value = username
    return {
      username,
      password: shippingPassword.value,
    }
  }
  const resolved = await credentialProfileRef.value?.resolveCredentials()
  if (!resolved) {
    throw new Error(text('请先新增并保存 Infor Nexus 登录账号密码。'))
  }
  selectedCredentialKey.value = resolved.accountKey
  shippingUsername.value = normalizePackingListAutoDownloadUsername(resolved.username)
  shippingPassword.value = resolved.password
  return {
    username: shippingUsername.value,
    password: resolved.password,
  }
}

function normalizePackingListAutoDownloadUsername(value: string): string {
  return normalizeInforNexusUsername(value)
}

async function ensureReady(): Promise<boolean> {
  if (entry && activeApp.value?.available && !isLocalExecutorBusy(executorHealth.value)) {
    await startActiveApp(true)
  } else if (!executorHealth.value?.ok) {
    await startActiveApp(true)
  }
  await refreshExecutorState(true).catch(() => {})
  return Boolean(executorHealth.value?.ok)
}

function setNotReady(): void {
  statusLabel.value = '未就绪'
  statusText.value = text('本机执行器尚未就绪，请先启动执行器后再试。')
  lastResult.value = { ok: false, message: statusText.value }
  messageTone.value = 'warning'
  message.value = text('执行器未就绪。')
}

async function createBackendRunRecord(file: File): Promise<AutomationRunRecord | null> {
  if (!entry) return null
  try {
    return await createAutomationRunRecord(entry.id, file, entry.title)
  } catch (error) {
    await recordWebAutomationEvent('packing-list-auto-download-run-record-create-failure', {
      error: readErrorMessage(error, 'create run failed'),
    })
    return null
  }
}

async function finishBackendRunRecord(
  record: AutomationRunRecord | null,
  ok: boolean,
  messageText: string,
  payload: Record<string, any> | null,
): Promise<void> {
  if (!record?.runId) return
  await finishAutomationRunRecord(
    record.runId,
    ok ? 'success' : 'failed',
    messageText || (ok ? 'completed' : 'failed'),
    payload,
  )
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  return arrayBufferToBase64(buffer)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return window.btoa(binary)
}

function safeParseJson(raw: string): Record<string, any> | null {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function buildExecutorResponseMessage(
  response: Response,
  raw: string,
  payload: { message?: unknown } | null,
  fallback = '自动化执行失败。',
): string {
  const rawMessage = typeof payload?.message === 'string' ? payload.message : ''
  if (response.status === 404 && /not\s*found/i.test(rawMessage || raw || '')) {
    return '本机执行器缺少当前自动化接口，系统已同步最新自动化逻辑但接口仍不可用。请确认服务器 automation-modules 模块包已发布，或重启本机自动化执行器后再试。'
  }
  if (rawMessage) return formatAutomationExecutorMessage(rawMessage, fallback)
  if (!payload) {
    return formatAutomationExecutorMessage('JSON.parse: unexpected character at line 1 column 1 of the JSON data', fallback)
  }
  return formatAutomationExecutorMessage(`HTTP ${response.status}`, fallback)
}

function appendFailureExamples(baseMessage: string, payload: Record<string, any> | null): string {
  return appendAutomationFailureExamples(baseMessage, payload)
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function createFallback(sourceEntry: WebAutomationEntry): AutomationAppInfo {
  return {
    id: sourceEntry.appId,
    name: sourceEntry.title,
    description: sourceEntry.description,
    provider: 'Playwright',
    category: '网页自动化',
    version: '',
    available: true,
    running: false,
    port: Number(new URL(sourceEntry.executorBaseUrl).port || 0),
    url: sourceEntry.executorBaseUrl,
  }
}

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}
</script>

<style scoped lang="scss">
.pad {
  --ink: #172033;
  --muted: #72829d;
  --line: #e2e8f0;
  --teal: #0d9488;
  --teal-dark: #0f766e;
  --teal-soft: #ccfbf1;
  --blue: #0ea5e9;
  --red: #dc2626;
  --amber: #d97706;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 0 20px 16px;
  color: var(--ink);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

.pad-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-top: 14px;
  animation: pad-rise .35s cubic-bezier(.22,1,.36,1) both;

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    color: #fff;
    background: linear-gradient(135deg, var(--teal), #14b8a6);
    box-shadow: 0 10px 24px rgba(13, 148, 136, .22);
  }

  h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
  }

  p {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
}

.pad-back,
.pad-btn,
.pad-alert__close,
.pad-drop__clear,
.pad-input-btn {
  border: 0;
  font: inherit;
}

.pad-back,
.pad-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: #cbd5e1;
    background: #f8fafc;
    box-shadow: 0 6px 16px rgba(15, 23, 42, .06);
  }

  &:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  &--primary {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, var(--blue), #0284c7);
    box-shadow: 0 8px 18px rgba(14, 165, 233, .18);
  }

  &--danger {
    color: var(--red);
    border-color: #fecaca;

    &:hover:not(:disabled) {
      background: #fef2f2;
    }
  }

  &--run {
    width: 100%;
    min-height: 44px;
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, var(--teal), var(--teal-dark));
    box-shadow: 0 12px 26px rgba(13, 148, 136, .24);
    font-size: 13px;

    &:hover:not(:disabled) {
      color: #fff;
      border-color: transparent;
      background: linear-gradient(135deg, var(--teal), var(--teal-dark));
      box-shadow: 0 14px 30px rgba(13, 148, 136, .3);
      filter: brightness(1.04);
    }

    &:disabled {
      opacity: .78;
      color: #fff;
      background: linear-gradient(135deg, var(--teal), var(--teal-dark));
    }
  }

  &--full {
    width: 100%;
  }

  &--template {
    min-height: 30px;
    padding: 0 10px;
    color: var(--teal-dark);
    border-color: #99f6e4;
    background: #f0fdfa;
    text-decoration: none;
  }
}

.pad-back {
  width: 34px;
  padding: 0;
}

.pad-pill,
.pad-tag,
.pad-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.pad-pill {
  padding: 7px 13px;
  border: 1px solid #fecaca;
  color: #b91c1c;
  background: #fef2f2;

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  &--ok {
    border-color: #99f6e4;
    color: var(--teal-dark);
    background: #f0fdfa;

    .pad-pill__dot {
      animation: pad-pulse 2.2s ease infinite;
    }
  }
}

.pad-tag {
  padding: 7px 11px;
  border: 1px solid var(--line);
  color: #64748b;
  background: #fff;
}

.pad-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 14px;
  min-height: 0;
}

.pad-main,
.pad-dock {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.pad-card,
.pad-dock-card,
.pad-log {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 2px 14px rgba(15, 23, 42, .04);
  overflow: hidden;
}

.pad-card {
  animation: pad-rise .4s cubic-bezier(.22,1,.36,1) both;

  &--main {
    border-top: 4px solid var(--teal);
  }

  &__head,
  &__body,
  &__footer {
    padding: 15px 20px;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 11px;
    border-bottom: 1px solid #f1f5f9;

    strong,
    small {
      display: block;
    }

    strong {
      font-size: 13px;
    }

    small {
      margin-top: 3px;
      font-size: 11px;
      color: var(--muted);
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-bottom: 1px solid #f8fafc;
  }
}

.pad-card__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: var(--teal);
  background: var(--teal-soft);
}

.pad-chip {
  margin-left: auto;
  padding: 4px 9px;

  &--ok {
    color: var(--teal-dark);
    background: #ecfdf5;
  }

  &--warn {
    color: var(--amber);
    background: #fffbeb;
  }
}

.pad-path {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pad-path {
  align-items: stretch;

  .pad-input-wrap {
    flex: 1;
    min-width: 260px;
  }
}

.pad-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;

  > span {
    font-size: 11px;
    font-weight: 800;
    color: #334155;
  }
}

.pad-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.pad-input-wrap {
  position: relative;
  display: flex;
  align-items: center;

  > .app-icon {
    position: absolute;
    left: 11px;
    color: #94a3b8;
    font-size: 14px;
  }

  &--path {
    min-width: 0;
  }
}

.pad-input {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #f8fafc;
  color: var(--ink);
  font-size: 12px;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;

  &:focus {
    outline: none;
    border-color: #2dd4bf;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(45, 212, 191, .14);
  }

  &--secret {
    padding-right: 42px;
  }

  &--plain {
    padding-left: 12px;
  }
}

.pad-input-btn {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;

  &:hover {
    color: var(--teal);
    background: #ccfbf1;
  }
}

.pad-drop {
  position: relative;
  display: grid;
  place-items: center;
  gap: 9px;
  min-height: 104px;
  padding: 18px 16px;
  border: 2px dashed #cbd5e1;
  border-radius: 13px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color .18s ease, background .18s ease, transform .18s ease;

  input {
    display: none;
  }

  &:hover,
  &--over {
    border-color: var(--teal);
    background: #f0fdfa;
  }

  &--over {
    transform: scale(.99);
  }

  &--on {
    border-style: solid;
    border-color: #5eead4;
    background: #f0fdfa;
  }
}

.pad-drop__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  color: var(--teal);
  background: #ccfbf1;

  &--ok {
    color: #15803d;
    background: #dcfce7;
  }
}

.pad-drop__text {
  display: grid;
  justify-items: center;
  gap: 3px;

  strong {
    font-size: 12px;
  }

  small {
    color: var(--muted);
    font-size: 11px;
  }
}

.pad-drop__clear {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: var(--red);
  background: #fff;
  cursor: pointer;
}

.pad-drop__overlay {
  position: absolute;
  inset: 5px;
  display: grid;
  place-items: center;
  border: 2px dashed var(--teal);
  border-radius: 11px;
  background: rgba(240, 253, 250, .94);
  color: var(--teal-dark);
  font-size: 12px;
  font-weight: 800;
}

.pad-status,
.pad-alert,
.pad-helper {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pad-status {
  margin: 0 20px 14px;
  padding: 10px 13px;
  border: 1px solid;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 700;

  &--info {
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  &--ok {
    color: #15803d;
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  &--error {
    color: #b91c1c;
    background: #fef2f2;
    border-color: #fecaca;
  }
}

.pad-progress {
  margin: -4px 20px 16px;
  padding: 12px 13px;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  color: #1e3a8a;
}

.pad-progress__head,
.pad-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  font-weight: 800;
}

.pad-progress__meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 8px;
  color: #64748b;
}

.pad-progress__track {
  height: 7px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #dbeafe;

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--blue), var(--teal));
    transition: width .25s ease;
  }
}

.pad-alert {
  padding: 10px 14px;
  border: 1px solid;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;

  &--info {
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  &--success {
    color: #15803d;
    background: #f0fdf4;
    border-color: #bbf7d0;
  }

  &--warning {
    color: #b45309;
    background: #fffbeb;
    border-color: #fde68a;
  }

  &--error {
    color: #b91c1c;
    background: #fef2f2;
    border-color: #fecaca;
  }
}

.pad-alert__close {
  display: grid;
  place-items: center;
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: rgba(15, 23, 42, .06);
  color: currentColor;
  cursor: pointer;
}

.pad-helper {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 14px 16px;
  border: 1px solid #fde68a;
  border-radius: 14px;
  background: #fffbeb;

  &__icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    color: var(--amber);
    background: #fef3c7;
  }

  strong {
    font-size: 13px;
  }

  p {
    margin: 2px 0 0;
    color: #92400e;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: 7px;
  }
}

.pad-log {
  summary,
  pre {
    margin: 0;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 11px 15px;
    list-style: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;

    &::-webkit-details-marker {
      display: none;
    }
  }

  pre {
    margin: 0 12px 12px;
    max-height: 130px;
    overflow: auto;
    padding: 12px;
    border-radius: 9px;
    background: #0f172a;
    color: #67e8f9;
    font-size: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.pad-dock {
  animation: pad-slide .4s cubic-bezier(.22,1,.36,1) .08s both;
}

.pad-dock-card {
  &--grow {
    flex: 1;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 15px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
    font-weight: 800;

    &--summary {
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }
    }
  }

  &__body {
    display: grid;
    gap: 8px;
    padding: 12px 15px;
  }
}

.pad-dock-dot {
  margin-left: auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbd5e1;

  &--ok {
    background: #10b981;
    animation: pad-pulse 2.2s ease infinite;
  }
}

.pad-steps {
  display: grid;
  gap: 5px;
  padding: 12px 15px;
}

.pad-step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 9px;
  border-radius: 10px;

  &:hover {
    background: #f8fafc;
  }

  b {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    color: var(--teal-dark);
    background: #ccfbf1;
    font-size: 10px;
  }

  strong,
  small {
    display: block;
  }

  strong {
    font-size: 11px;
  }

  small {
    margin-top: 2px;
    color: var(--muted);
    font-size: 10px;
    line-height: 1.45;
  }
}

.pad-dock-pre {
  margin: 12px;
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  border-radius: 9px;
  background: #0f172a;
  color: #67e8f9;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.pad-empty {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 80px 20px;
  text-align: center;

  &__icon {
    color: #cbd5e1;
    font-size: 38px;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
}

.pad-chev {
  margin-left: auto;
  transition: transform .2s ease;

  details[open] & {
    transform: rotate(180deg);
  }
}

.pad-spin {
  animation: pad-spin .85s linear infinite;
}

.pad-alert-enter-active,
.pad-alert-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}

.pad-alert-enter-from,
.pad-alert-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes pad-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pad-slide {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pad-spin {
  to { transform: rotate(360deg); }
}

@keyframes pad-pulse {
  0% { box-shadow: 0 0 0 0 rgba(13, 148, 136, .35); }
  70% { box-shadow: 0 0 0 5px rgba(13, 148, 136, 0); }
  100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0); }
}

@media (max-width: 1100px) {
  .pad-body {
    grid-template-columns: 1fr;
  }

  .pad-dock {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pad {
    padding: 0 12px 12px;
  }

  .pad-head,
  .pad-head__left,
  .pad-head__right,
  .pad-helper {
    align-items: flex-start;
  }

  .pad-head,
  .pad-helper,
  .pad-dock {
    grid-template-columns: 1fr;
  }

  .pad-head,
  .pad-head__right,
  .pad-helper__actions,
  .pad-path {
    flex-direction: column;
  }

  .pad-path .pad-input-wrap,
  .pad-btn,
  .pad-dock {
    width: 100%;
  }
}

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
  border: 1px solid var(--br);
  border-radius: 10px;
  background: #fff;
  color: #4b5563;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  :deep(.app-icon) { font-size: 13px; flex-shrink: 0; }
  &:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
  &:disabled { opacity: .35; cursor: not-allowed; }
}

/* 按钮微调优化 */
.sa-btn--pri {
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 2px 10px rgba(14,165,233,.2);
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
    box-shadow: 0 4px 16px rgba(14,165,233,.3);
    filter: brightness(1.05);
  }
}
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

<style>
.content-shell:has(.pad) {
  padding: 0 !important;
}
</style>
