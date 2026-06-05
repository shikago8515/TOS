<template>
  <section class="ws-page">
    <!-- Top Bar -->
    <div class="ws-top">
      <button class="ws-back" type="button" @click="goBack">
        <AppIcon name="arrow-left" />
        <span>{{ text('返回') }}</span>
      </button>
      <span v-if="entry" class="ws-badge ws-badge--scene">
        <AppIcon name="bot" />
        {{ text('自动化场景') }}
      </span>
    </div>

    <!-- Hero -->
    <header class="ws-hero">
      <div class="ws-hero__icon">
        <AppIcon name="bot" />
      </div>
      <div class="ws-hero__text">
        <h1>{{ entry?.title || text('未找到入口') }}</h1>
        <p>{{ entry?.subtitle || text('当前入口不存在，请返回列表重新选择。') }}</p>
      </div>
    </header>

    <!-- Alert -->
    <transition name="ws-msg">
      <div v-if="message" class="ws-alert" :class="`ws-alert--${messageTone}`">
        <div class="ws-alert__icon">
          <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'info'" />
        </div>
        <span class="ws-alert__text">{{ message }}</span>
      </div>
    </transition>

    <!-- Empty State -->
    <div v-if="!entry" class="ws-empty">
      <div class="ws-empty__icon">
        <AppIcon name="alert-circle" />
      </div>
      <strong>{{ text('入口不存在') }}</strong>
      <span>{{ text('请返回网页自动化入口列表重新选择。') }}</span>
    </div>

    <template v-else>
      <!-- Status Strip -->
      <div class="ws-strip">
        <div class="ws-strip__item">
          <div class="ws-strip__icon ws-strip__icon--blue">
            <AppIcon name="monitor-code" />
          </div>
          <div class="ws-strip__body">
            <span class="ws-strip__label">{{ text('运行模式') }}</span>
            <strong>{{ electronSupported ? 'Electron' : text('浏览器') }}</strong>
          </div>
          <span class="ws-dot" :class="electronSupported ? 'is-green' : 'is-slate'" />
        </div>
        <div class="ws-strip__item">
          <div class="ws-strip__icon ws-strip__icon--teal">
            <AppIcon name="server" />
          </div>
          <div class="ws-strip__body">
            <span class="ws-strip__label">{{ text('执行器') }}</span>
            <strong>{{ executorStatusLabel }}</strong>
          </div>
          <span class="ws-dot" :class="executorHealth?.ok ? 'is-green' : 'is-slate'" />
        </div>
      </div>

      <!-- Main Layout -->
      <div class="ws-main">
        <!-- Left Sidebar -->
        <aside class="ws-side">
          <!-- Executor Control -->
          <div class="ws-panel">
            <div class="ws-panel__bar" />
            <div class="ws-panel__head">
              <AppIcon name="server" />
              <strong>{{ text('执行器控制') }}</strong>
            </div>
            <div class="ws-actions">
              <button
                class="ws-btn ws-btn--primary"
                :disabled="!canLaunchActiveApp"
                @click="startActiveApp(false)"
              >
                <AppIcon name="play-circle" />
                {{ launching ? text('启动中...') : text('启动执行器') }}
              </button>
              <button
                class="ws-btn ws-btn--danger"
                :disabled="!canStopActiveApp"
                @click="stopActiveApp"
              >
                <AppIcon name="stop-circle" />
                {{ text('停止') }}
              </button>
              <button
                class="ws-btn"
                :disabled="refreshing"
                @click="refreshExecutorState(false)"
              >
                <AppIcon name="refresh-cw" :class="{ 'ws-spin': refreshing }" />
                {{ refreshing ? text('刷新中') : text('刷新状态') }}
              </button>
            </div>
          </div>

          <!-- Steps -->
          <div class="ws-panel">
            <div class="ws-panel__bar" />
            <div class="ws-panel__head">
              <AppIcon name="workflow" />
              <strong>{{ text('操作流程') }}</strong>
            </div>
            <div class="ws-steps">
              <template v-if="isShippingScenario">
                <div v-for="(step, i) in shippingSteps" :key="i" class="ws-step">
                  <span class="ws-step__num">{{ i + 1 }}</span>
                  <div>
                    <strong>{{ text(step.title) }}</strong>
                    <p>{{ text(step.desc) }}</p>
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-for="(step, i) in defaultSteps" :key="i" class="ws-step">
                  <span class="ws-step__num">{{ i + 1 }}</span>
                  <div>
                    <strong>{{ text(step.title) }}</strong>
                    <p>{{ text(step.desc) }}</p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Health Info -->
          <details class="ws-health">
            <summary>
              <AppIcon name="terminal" />
              <span>{{ text('执行器健康信息') }}</span>
              <AppIcon name="chevron-down" class="ws-chevron" />
            </summary>
            <pre>{{ healthRaw }}</pre>
          </details>
        </aside>

        <!-- Right Stage -->
        <section class="ws-stage">
          <!-- Shipping Scenario -->
          <div v-if="isShippingScenario" class="ws-card">
            <div class="ws-card__bar" />
            <div class="ws-card__head">
              <div class="ws-card__head-icon ws-card__head-icon--teal">
                <AppIcon name="play-circle" />
              </div>
              <div class="ws-card__head-text">
                <strong>{{ text('登录并打开 Shipment Scan') }}</strong>
                <p>{{ text('本机执行器会登录 Infor Nexus，并自动进入 Shipment Scan 弹窗。') }}</p>
              </div>
              <span v-if="executorHealth?.ok" class="ws-badge ws-badge--ready">{{ text('执行器就绪') }}</span>
              <span v-else class="ws-badge ws-badge--wait">{{ text('等待执行器') }}</span>
            </div>

            <div class="ws-field ws-field-grid">
              <div>
                <label>{{ text('User ID') }}</label>
                <input
                  v-model.trim="shippingUsername"
                  type="text"
                  class="ws-input"
                  :placeholder="text('请输入 User ID')"
                  autocomplete="username"
                />
              </div>
              <div>
                <label>{{ text('Password') }}</label>
                <div class="ws-input-row">
                  <input
                    v-model="shippingPassword"
                    :type="showShippingPassword ? 'text' : 'password'"
                    class="ws-input"
                    placeholder="Enter password"
                    autocomplete="current-password"
                  />
                  <button class="ws-btn-sm" type="button" @click="showShippingPassword = !showShippingPassword">
                    <AppIcon :name="showShippingPassword ? 'eye' : 'eye'" />
                  </button>
                </div>
              </div>
            </div>

            <div class="ws-field">
              <div class="ws-note">
                <AppIcon name="info" />
                <span>{{ text('如果当前是网页端，点击执行时会先唤起本机 launcher，再启动 Shipping 执行器。') }}</span>
              </div>
            </div>

            <div class="ws-field">
              <label>{{ text('Excel 文件') }}</label>
              <div
                class="ws-dropzone"
                :class="{ 'ws-dropzone--active': selectedFile, 'ws-dropzone--drag': isDragging }"
                role="button"
                tabindex="0"
                @click="openFilePicker"
                @keydown.enter.prevent="openFilePicker"
                @keydown.space.prevent="openFilePicker"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept=".xlsx,.xls"
                  @click.stop
                  @change="handleFileSelect"
                />
                <template v-if="selectedFile">
                  <div class="ws-dropzone__icon ws-dropzone__icon--done">
                    <AppIcon name="check-circle" />
                  </div>
                  <strong>{{ selectedFile.name }}</strong>
                  <small>{{ formatSize(selectedFile.size) }}</small>
                  <button class="ws-dropzone__clear" type="button" @click.stop="clearFile">
                    <AppIcon name="stop-circle" />
                    {{ text('清除') }}
                  </button>
                </template>
                <template v-else>
                  <div class="ws-dropzone__icon">
                    <AppIcon name="upload" />
                  </div>
                  <strong>{{ text('点击或拖入 Excel 文件') }}</strong>
                  <small>{{ text('请包含 PO No 列') }}</small>
                </template>
                <div v-if="isDragging" class="ws-dropzone__overlay">
                  <AppIcon name="download" />
                  <span>{{ text('释放以上传文件') }}</span>
                </div>
              </div>
            </div>

            <div class="ws-card__actions">
              <button
                class="ws-btn-lg"
                :disabled="sending || !shippingUsername || !shippingPassword || !selectedFile"
                @click="runShippingWithExcel"
              >
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'ws-spin': sending }" />
                {{ sending ? text('执行中...') : text('上传 Excel 并执行 Shipping') }}
              </button>
            </div>
          </div>

          <!-- Microsoft / Default Scenario -->
          <div v-else class="ws-card">
            <div class="ws-card__bar" />
            <div class="ws-card__head">
              <div class="ws-card__head-icon ws-card__head-icon--blue">
                <AppIcon name="upload" />
              </div>
              <div class="ws-card__head-text">
                <strong>{{ text('上传文件并执行') }}</strong>
                <p>{{ text('支持本地直连执行器和 n8n 编排两条链路。') }}</p>
              </div>
              <span v-if="executorHealth?.ok" class="ws-badge ws-badge--ready">{{ text('执行器就绪') }}</span>
              <span v-else class="ws-badge ws-badge--wait">{{ text('等待执行器') }}</span>
            </div>

            <div v-if="isMicrosoftScenario" class="ws-field ws-field-grid">
              <div>
                <label>{{ text('Microsoft 账号') }}</label>
                <input
                  v-model.trim="microsoftUsername"
                  type="text"
                  class="ws-input"
                  :placeholder="text('请输入 Microsoft 账号')"
                  autocomplete="username"
                />
              </div>
              <div>
                <label>{{ text('Microsoft 密码') }}</label>
                <div class="ws-input-row">
                  <input
                    v-model="microsoftPassword"
                    :type="showMicrosoftPassword ? 'text' : 'password'"
                    class="ws-input"
                    placeholder="Enter password"
                    autocomplete="current-password"
                  />
                  <button class="ws-btn-sm" type="button" @click="showMicrosoftPassword = !showMicrosoftPassword">
                    <AppIcon name="eye" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isMicrosoftScenario" class="ws-field">
              <div class="ws-note">
                <AppIcon name="info" />
                <span>{{ text('请在本页输入当前任务使用的 Microsoft 账号和密码；本地代码不预置登录凭据。') }}</span>
              </div>
            </div>

            <div class="ws-field">
              <label>{{ text('Webhook 地址') }}</label>
              <div class="ws-input-row">
                <input
                  v-model="webhookUrl"
                  type="text"
                  class="ws-input"
                  :placeholder="text('请输入 n8n webhook 地址')"
                />
                <button class="ws-btn-sm" type="button" @click="resetWebhookUrl">
                  <AppIcon name="refresh-cw" />
                  {{ text('重置') }}
                </button>
              </div>
            </div>

            <div class="ws-field">
              <label>{{ text('Excel 文件') }}</label>
              <div
                class="ws-dropzone"
                :class="{ 'ws-dropzone--active': selectedFile, 'ws-dropzone--drag': isDragging }"
                role="button"
                tabindex="0"
                @click="openFilePicker"
                @keydown.enter.prevent="openFilePicker"
                @keydown.space.prevent="openFilePicker"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept=".xlsx,.xls"
                  @click.stop
                  @change="handleFileSelect"
                />
                <template v-if="selectedFile">
                  <div class="ws-dropzone__icon ws-dropzone__icon--done">
                    <AppIcon name="check-circle" />
                  </div>
                  <strong>{{ selectedFile.name }}</strong>
                  <small>{{ formatSize(selectedFile.size) }}</small>
                  <button class="ws-dropzone__clear" type="button" @click.stop="clearFile">
                    <AppIcon name="stop-circle" />
                    {{ text('清除') }}
                  </button>
                </template>
                <template v-else>
                  <div class="ws-dropzone__icon">
                    <AppIcon name="upload" />
                  </div>
                  <strong>{{ text('点击或拖入 Excel 文件') }}</strong>
                  <small>{{ text('支持 .xlsx / .xls 格式') }}</small>
                </template>
                <div v-if="isDragging" class="ws-dropzone__overlay">
                  <AppIcon name="download" />
                  <span>{{ text('释放以上传文件') }}</span>
                </div>
              </div>
            </div>

            <div class="ws-card__actions">
              <button
                class="ws-btn-lg"
                :disabled="!selectedFile || sending"
                @click="sendDirectToExecutor"
              >
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'ws-spin': sending }" />
                {{ sending ? text('执行中...') : text('本地直连执行（不经过 n8n）') }}
              </button>
              <button
                class="ws-btn-lg ws-btn-lg--secondary"
                :disabled="!selectedFile || sending || !webhookUrl"
                @click="sendToWebhook"
              >
                <AppIcon name="send" />
                {{ sending ? text('发送中...') : text('发送至 n8n 编排执行') }}
              </button>
            </div>
          </div>

          <!-- Execution Status -->
          <div class="ws-card ws-card--status">
            <div class="ws-card__bar" />
            <div class="ws-card__head">
              <div class="ws-card__head-icon" :class="statusIconClass">
                <AppIcon :name="statusIconName" />
              </div>
              <div class="ws-card__head-text">
                <strong>{{ text('执行状态') }}</strong>
              </div>
              <span class="ws-badge" :class="statusBadgeClass">{{ statusLabel }}</span>
            </div>
            <div class="ws-status-text" :class="{ 'ws-status-text--ok': lastResult?.ok, 'ws-status-text--err': lastResult && !lastResult.ok }">
              {{ statusText }}
            </div>
            <div v-if="isShippingScenario && shippingArtifactLinks?.resultExcelUrl" class="ws-result-downloads">
              <button
                class="ws-btn ws-btn--primary"
                type="button"
                @click="downloadShippingArtifact(shippingArtifactLinks.resultExcelUrl, 'shipping-last-result.xlsx')"
              >
                <AppIcon name="download" />
                {{ text('下载结果 Excel') }}
              </button>
              <button
                v-if="shippingArtifactLinks.failedPoExcelUrl && shippingArtifactLinks.failedRowCount > 0"
                class="ws-btn"
                type="button"
                @click="downloadShippingArtifact(shippingArtifactLinks.failedPoExcelUrl, 'shipping-last-failed-po-rows.xlsx')"
              >
                <AppIcon name="download" />
                {{ text('下载失败明细 Excel') }}
              </button>
            </div>
          </div>

          <!-- Raw Response -->
          <details v-if="lastRawResponse" class="ws-raw">
            <summary>
              <AppIcon name="code" />
              <span>{{ text('原始响应') }}</span>
              <AppIcon name="chevron-down" class="ws-chevron" />
            </summary>
            <pre>{{ lastRawResponse }}</pre>
          </details>
        </section>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '../../shared/ui/AppIcon.vue'
import type { AutomationAppInfo } from '../../types/electronApi'
import type { LocalExecutorHealth } from './webAutomationApi'
import {
  fetchAutomationApps,
  hasElectronAutomationSupport,
  launchAutomationConsole,
  primeLocalAutomationLauncherBoot,
  probeLocalAutomationLauncherHealth,
  probeLocalExecutorHealth,
  recordWebAutomationEvent,
  stopAutomationConsole,
} from './webAutomationApi'
import {
  getAutomationAppStatusLabel,
  getWebAutomationEntry,
  type WebAutomationEntry,
  type WebAutomationNoticeTone,
} from './webAutomationModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const route = useRoute()
const router = useRouter()
const { text } = useAppLanguage()

const defaultShippingUsername = 'user3@@tmsfashion'
const defaultShippingPassword = 'tmsbjLILY20260202'
const defaultMicrosoftUsername = ''
const defaultMicrosoftPassword = ''

const electronSupported = hasElectronAutomationSupport()
const activeApp = ref<AutomationAppInfo | null>(null)
const executorHealth = ref<LocalExecutorHealth | null>(null)
const launcherReachable = ref(false)
const launching = ref(false)
const refreshing = ref(false)
const sending = ref(false)
const message = ref('')
const messageTone = ref<WebAutomationNoticeTone>('info')
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const selectedFile = ref<File | null>(null)
const webhookUrl = ref('http://127.0.0.1:5678/webhook/microsoft-login-excel-demo')
const shippingUsername = ref(defaultShippingUsername)
const shippingPassword = ref(defaultShippingPassword)
const showShippingPassword = ref(false)
const microsoftUsername = ref(defaultMicrosoftUsername)
const microsoftPassword = ref(defaultMicrosoftPassword)
const showMicrosoftPassword = ref(false)
const statusText = ref('等待文件上传并发送。')
const statusLabel = ref('待命')
const lastResult = ref<{ ok: boolean; message?: string } | null>(null)
const lastRawResponse = ref('')
type ShippingArtifactLinks = {
  resultExcelUrl: string
  resultJsonUrl?: string
  failedPoExcelUrl?: string
  failedPoJsonUrl?: string
  failedRowCount: number
}
const shippingArtifactLinks = ref<ShippingArtifactLinks | null>(null)

const shippingSteps = [
  { title: '输入账号密码', desc: '使用当前页面填写 Infor Nexus 登录凭据。' },
  { title: '启动本地执行器', desc: '网页端和 EXE 都会走同一套本机启动器。' },
  { title: '打开 Shipment Scan', desc: '依次进入 Applications、Print-Scan-Ship、Shipment Scan。' },
  { title: '后续接入 Excel', desc: '这一页后续继续承接 Shipping 的上传执行链路。' },
]

const defaultSteps = [
  { title: '上传 Excel 文件', desc: '选择包含数据的 .xlsx 或 .xls 文件。' },
  { title: '本地直连执行（推荐）', desc: '前端直接把 Excel 发给本机执行器，不经过 n8n。' },
  { title: '发送至 n8n（保留）', desc: '如需编排、通知、审批、数据库联动，可继续走 n8n 链路。' },
  { title: '查看结果', desc: '在下方状态区查看执行结果。' },
]

const entry = computed(() => getWebAutomationEntry(String(route.params.scenarioId || '')))
const isShippingScenario = computed(() => entry.value?.id === 'shipping-automation')
const isMicrosoftScenario = computed(() => entry.value?.id === 'microsoft-login-n8n')
const directExecutorRunUrl = computed(() => {
  const baseUrl = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}/api/run-login-file` : ''
})
const shippingExecutorRunUrl = computed(() => {
  const baseUrl = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}/api/run-shipping-file` : ''
})
const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorStatusLabel = computed(() => {
  if (activeApp.value) {
    const label = getAutomationAppStatusLabel(activeApp.value)
    if (executorHealth.value?.ok) {
      return executorHealth.value.busy ? `${label} / 忙碌` : `${label} / 就绪`
    }
    if (activeApp.value.running) {
      return `${label} / 未连通`
    }
    return label
  }
  return executorHealth.value?.ok ? '就绪' : '未启动'
})
const statusBadgeClass = computed(() => {
  if (sending.value) return 'ws-badge--wait'
  if (lastResult.value?.ok) return 'ws-badge--ready'
  if (lastResult.value && !lastResult.value.ok) return 'ws-badge--err'
  return ''
})
const statusIconClass = computed(() => {
  if (sending.value) return 'ws-card__head-icon--teal'
  if (lastResult.value?.ok) return 'ws-card__head-icon--green'
  if (lastResult.value && !lastResult.value.ok) return 'ws-card__head-icon--red'
  return 'ws-card__head-icon--slate'
})
const statusIconName = computed(() => {
  if (sending.value) return 'loader'
  if (lastResult.value?.ok) return 'check-circle'
  if (lastResult.value && !lastResult.value.ok) return 'alert-circle'
  return 'activity'
})
const canLaunchActiveApp = computed(() => Boolean(entry.value?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)

onMounted(() => {
  void initializeScenario()
})

async function initializeScenario(): Promise<void> {
  resetWebhookUrl()
  if (isShippingScenario.value) {
    shippingUsername.value = shippingUsername.value || defaultShippingUsername
    shippingPassword.value = shippingPassword.value || defaultShippingPassword
    statusLabel.value = '待命'
    statusText.value = '等待上传 Excel，并执行 Shipping 自动化。'
  } else if (isMicrosoftScenario.value) {
    microsoftUsername.value = microsoftUsername.value || defaultMicrosoftUsername
    microsoftPassword.value = microsoftPassword.value || defaultMicrosoftPassword
    statusLabel.value = '待命'
    statusText.value = '等待上传 Excel 并启动 Microsoft Login 自动化。'
  }

  await refreshExecutorState(true)
  if (electronSupported && activeApp.value?.available && !activeApp.value.running) {
    await startActiveApp(true)
  }
}

async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry.value || refreshing.value) return

  refreshing.value = true
  const fallbackApp = createFallbackAutomationApp(entry.value)

  try {
    launcherReachable.value = electronSupported
      ? true
      : await probeLocalAutomationLauncherHealth()

    if (electronSupported) {
      try {
        const apps = await fetchAutomationApps()
        activeApp.value = apps.find((app) => app.id === entry.value?.appId) ?? fallbackApp
      } catch {
        activeApp.value = fallbackApp
      }
    } else {
      activeApp.value = fallbackApp
    }

    executorHealth.value = await probeLocalExecutorHealth(entry.value.executorBaseUrl)
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
  if (!entry.value || launching.value) return

  if (!electronSupported && !launcherReachable.value) {
    primeLocalAutomationLauncherBoot()
  }

  launching.value = true
  try {
    const result = await launchAutomationConsole(entry.value.appId)
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
      appId: entry.value.appId,
      entryId: entry.value.id,
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
  if (!entry.value) return

  try {
    const result = await stopAutomationConsole(entry.value.appId)
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

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    selectedFile.value = files[0]
  }
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    selectedFile.value = files[0]
  }
}

function openFilePicker(): void {
  fileInput.value?.click()
}

function clearFile(): void {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function resetWebhookUrl(): void {
  webhookUrl.value = entry.value?.webhookUrl || 'http://127.0.0.1:5678/webhook/microsoft-login-excel-demo'
}

async function runShippingWithExcel(): Promise<void> {
  if (!entry.value || sending.value || !isShippingScenario.value || !selectedFile.value) return

  const executorReady = await ensureExecutorReady()
  if (!executorReady) {
    statusLabel.value = '未就绪'
    statusText.value = '本机执行器尚未就绪，请先启动执行器后再试。'
    lastResult.value = { ok: false, message: 'Executor is not ready.' }
    messageTone.value = 'warning'
    message.value = text('本机执行器未就绪，请先启动。')
    return
  }

  const file = selectedFile.value
  sending.value = true
  statusLabel.value = '执行中'
  statusText.value = '正在上传 Excel，并登录 Infor Nexus 输入 PO No...'
  lastResult.value = null
  shippingArtifactLinks.value = null
  lastRawResponse.value = ''
  message.value = ''

  try {
    const fileBase64 = await fileToBase64(file)
    const response = await fetch(shippingExecutorRunUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Executor-Token': entry.value.localExecutorToken,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileBase64,
        token: entry.value.localExecutorToken,
        username: shippingUsername.value,
        password: shippingPassword.value,
      }),
    })

    const rawText = await response.text()
    lastRawResponse.value = rawText
    const json = safeParseJson(rawText)
    updateShippingArtifactLinks(json)

    if (!response.ok) {
      statusLabel.value = '失败'
      statusText.value = json?.message || `本地执行失败，HTTP ${response.status}。`
      lastResult.value = { ok: false, message: json?.message || `HTTP ${response.status}` }
      messageTone.value = 'error'
      message.value = text('Shipment Scan 自动化执行失败，请查看原始响应。')
      return
    }

    if (json?.ok && json?.shipmentScanOpened) {
      statusLabel.value = '成功'
      statusText.value = `Shipping 自动化完成。已输入 ${json.completedPoCount ?? 0}/${json.totalPoCount ?? '?'} 个 PO No。`
      lastResult.value = { ok: true, message: json.message }
      messageTone.value = 'success'
      message.value = text('Shipping 自动化执行完成。')
      return
    }

    statusLabel.value = '未完成'
    statusText.value = json?.message || 'Shipping 自动化已触发，但未确认全部 PO No 输入完成。'
    lastResult.value = { ok: false, message: json?.message }
    messageTone.value = 'warning'
    message.value = text('自动化已触发，但结果未确认成功。')
  } catch (error) {
    statusLabel.value = '异常'
    statusText.value = `本地执行异常：${readErrorMessage(error, '网络错误')}`
    lastResult.value = { ok: false }
    messageTone.value = 'error'
    message.value = text('本地执行异常，请确认执行器已启动且端口可访问。')
  } finally {
    sending.value = false
    await refreshExecutorState(true).catch(() => {})
  }
}

async function sendDirectToExecutor(): Promise<void> {
  if (!selectedFile.value || sending.value || !entry.value) return

  const executorReady = await ensureExecutorReady()
  if (!executorReady) {
    statusLabel.value = '未就绪'
    statusText.value = '本机执行器尚未就绪，请先启动执行器后再试。'
    lastResult.value = { ok: false, message: 'Executor is not ready.' }
    messageTone.value = 'warning'
    message.value = text('本机执行器未就绪，请先启动。')
    return
  }

  sending.value = true
  statusLabel.value = '执行中'
  statusText.value = '正在将 Excel 直接发送给本机执行器并启动浏览器自动化...'
  lastResult.value = null
  lastRawResponse.value = ''
  message.value = ''

  try {
    const fileBase64 = await fileToBase64(selectedFile.value)
    const response = await fetch(directExecutorRunUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Executor-Token': entry.value.localExecutorToken,
      },
      body: JSON.stringify({
        fileName: selectedFile.value.name,
        fileBase64,
        token: entry.value.localExecutorToken,
        username: isMicrosoftScenario.value ? microsoftUsername.value : undefined,
        password: isMicrosoftScenario.value ? microsoftPassword.value : undefined,
      }),
    })

    const rawText = await response.text()
    lastRawResponse.value = rawText
    const json = safeParseJson(rawText)

    if (!response.ok) {
      statusLabel.value = '失败'
      statusText.value = json?.message || `本地执行失败，HTTP ${response.status}。`
      lastResult.value = { ok: false, message: json?.message || `HTTP ${response.status}` }
      messageTone.value = 'error'
      message.value = text('本地执行器返回失败，请查看原始响应。')
      return
    }

    if (!json) {
      throw new Error('执行器返回了无法解析的响应。')
    }

    if (json.loginSuccess) {
      statusLabel.value = '成功'
      statusText.value = `本地直连执行成功。已处理 ${json.uploadedRowCount ?? '?'} 行数据。`
      lastResult.value = { ok: true, message: json.message }
      messageTone.value = 'success'
      message.value = text('本地直连执行完成。')
    } else {
      statusLabel.value = '未完成'
      statusText.value = json.message || '本地执行已触发，但未确认成功。'
      lastResult.value = { ok: false, message: json.message }
      messageTone.value = 'warning'
      message.value = text('本地执行已触发，但结果未确认成功。')
    }
  } catch (error) {
    statusLabel.value = '异常'
    statusText.value = `本地执行异常：${readErrorMessage(error, '网络错误')}`
    lastResult.value = { ok: false }
    messageTone.value = 'error'
    message.value = text('本地执行异常，请确认执行器已启动且端口可访问。')
  } finally {
    sending.value = false
    await refreshExecutorState(true).catch(() => {})
  }
}

async function sendToWebhook(): Promise<void> {
  if (!selectedFile.value || !webhookUrl.value || sending.value) return

  const executorReady = await ensureExecutorReady()
  if (!executorReady) {
    statusLabel.value = '未就绪'
    statusText.value = '本机执行器尚未就绪，请先启动执行器后再试。'
    lastResult.value = { ok: false, message: 'Executor is not ready.' }
    messageTone.value = 'warning'
    message.value = text('本机执行器未就绪，请先启动。')
    return
  }

  sending.value = true
  statusLabel.value = '发送中'
  statusText.value = '正在上传文件到 n8n 并启动 Microsoft Login 自动化...'
  lastResult.value = null
  lastRawResponse.value = ''
  message.value = ''

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  if (isMicrosoftScenario.value) {
    formData.append('username', microsoftUsername.value)
    formData.append('password', microsoftPassword.value)
  }

  try {
    const response = await fetch(webhookUrl.value, {
      method: 'POST',
      body: formData,
    })

    const rawText = await response.text()
    lastRawResponse.value = rawText
    const json = safeParseJson(rawText)

    if (!response.ok) {
      statusLabel.value = '失败'
      statusText.value = `请求失败，HTTP ${response.status}。`
      lastResult.value = { ok: false, message: `HTTP ${response.status}` }
      messageTone.value = 'error'
      message.value = text('发送失败，请检查 webhook 地址是否可访问。')
      return
    }

    if (json?.loginSuccess) {
      statusLabel.value = '成功'
      statusText.value = `登录成功。已处理 ${json.uploadedRowCount ?? '?'} 行数据。`
      lastResult.value = { ok: true, message: json.message }
      messageTone.value = 'success'
      message.value = text('自动化执行完成，登录成功。')
    } else {
      statusLabel.value = '未完成'
      statusText.value = json?.message || '登录未完成，请查看原始响应了解详情。'
      lastResult.value = { ok: false, message: json?.message }
      messageTone.value = 'warning'
      message.value = text('自动化已执行但登录未确认成功。')
    }
  } catch (error) {
    statusLabel.value = '异常'
    statusText.value = `发送异常：${readErrorMessage(error, '网络错误')}`
    lastResult.value = { ok: false }
    messageTone.value = 'error'
    message.value = text('发送异常，请确认 n8n 和执行器均已启动。')
  } finally {
    sending.value = false
    await refreshExecutorState(true).catch(() => {})
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

function safeParseJson(rawText: string): Record<string, any> | null {
  try {
    return rawText ? JSON.parse(rawText) : null
  } catch {
    return null
  }
}

function updateShippingArtifactLinks(payload: Record<string, any> | null): void {
  if (!isShippingScenario.value) {
    shippingArtifactLinks.value = null
    return
  }

  const downloadUrls = payload?.artifacts?.downloadUrls
  const resultExcelUrl = buildShippingArtifactUrl(downloadUrls?.resultExcelUrl)
  if (!resultExcelUrl) {
    shippingArtifactLinks.value = null
    return
  }

  shippingArtifactLinks.value = {
    resultExcelUrl,
    resultJsonUrl: buildShippingArtifactUrl(downloadUrls?.resultJsonUrl) || undefined,
    failedPoExcelUrl: buildShippingArtifactUrl(downloadUrls?.failedPoExcelUrl) || undefined,
    failedPoJsonUrl: buildShippingArtifactUrl(downloadUrls?.failedPoJsonUrl) || undefined,
    failedRowCount: Number(payload?.artifacts?.failedRowCount ?? 0),
  }
}

function buildShippingArtifactUrl(relativePath: string): string {
  const normalizedPath = String(relativePath || '').trim()
  if (!normalizedPath) {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath
  }

  const baseUrl = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}` : ''
}

function downloadShippingArtifact(url: string | undefined, fallbackName: string): void {
  if (!url) return

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fallbackName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

function createFallbackAutomationApp(currentEntry: WebAutomationEntry): AutomationAppInfo {
  return {
    id: currentEntry.appId,
    name: currentEntry.title,
    description: currentEntry.description,
    provider: 'Playwright',
    category: '网页自动化',
    version: '',
    available: true,
    running: false,
    port: Number(new URL(currentEntry.executorBaseUrl).port || 0),
    url: currentEntry.executorBaseUrl,
  }
}

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
  } else {
    void router.push('/')
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
</script>

<style scoped lang="scss">
/* ================================================================
   Web Automation Scenario Page — Refined Design
   Palette: teal #0d9488, green #059669, blue #2563eb, amber #d97706
   No purple. Clean, elegant, minimal animations.
   ================================================================ */

.ws-page {
  --teal: #0d9488;
  --teal-soft: #f0fdfa;
  --teal-border: #99f6e4;
  --green: #059669;
  --amber: #d97706;
  --red: #dc2626;
  --blue: #2563eb;
  --border: #e2e8f0;
  --muted: #64748b;
  --ink: #0f172a;
  --radius: 16px;

  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 55% 35% at 50% 0%, rgba(13, 148, 136, 0.04), transparent 55%),
    #f6f9fc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

/* ===== Top Bar ===== */
.ws-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ws-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.app-icon) { font-size: 15px; }

  &:hover {
    border-color: var(--teal-border);
    color: var(--teal);
    background: var(--teal-soft);
  }
}

.ws-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;

  :deep(.app-icon) { font-size: 13px; }

  &--scene,
  &--ready {
    background: #ecfdf5;
    color: var(--green);
    border: 1px solid #a7f3d0;
  }

  &--wait {
    background: #fff7ed;
    color: var(--amber);
    border: 1px solid #fed7aa;
  }

  &--err {
    background: #fef2f2;
    color: var(--red);
    border: 1px solid #fecaca;
  }
}

/* ===== Hero ===== */
.ws-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 18px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.03);
  animation: ws-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ws-hero__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2dd4bf, var(--teal));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.25);
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.05) rotate(-3deg);
  }
}

.ws-hero__text {
  min-width: 0;

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--ink);
    letter-spacing: -0.3px;
    line-height: 1.3;
  }

  p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;
  }
}

/* ===== Alert ===== */
.ws-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid;
}

.ws-alert__icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}

.ws-alert__text {
  flex: 1;
  min-width: 0;
}

.ws-alert--info {
  background: var(--teal-soft);
  color: #0f766e;
  border-color: #ccfbf1;
  .ws-alert__icon { background: linear-gradient(135deg, #2dd4bf, var(--teal)); }
}

.ws-alert--success {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
  .ws-alert__icon { background: linear-gradient(135deg, #34d399, var(--green)); }
}

.ws-alert--warning {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
  .ws-alert__icon { background: linear-gradient(135deg, #fbbf24, var(--amber)); }
}

.ws-alert--error {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
  .ws-alert__icon { background: linear-gradient(135deg, #f87171, var(--red)); }
}

.ws-msg-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.ws-msg-leave-active { transition: all 0.25s ease-in; }
.ws-msg-enter-from { opacity: 0; transform: translateY(-10px); }
.ws-msg-leave-to { opacity: 0; transform: translateY(-8px); }

/* ===== Empty ===== */
.ws-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  text-align: center;
  animation: ws-slideUp 0.5s ease both;
}

.ws-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #94a3b8, #64748b);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.ws-empty strong {
  font-size: 16px;
  color: var(--ink);
}

.ws-empty span {
  font-size: 13px;
  color: var(--muted);
  max-width: 320px;
}

/* ===== Status Strip ===== */
.ws-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  animation: ws-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
}

.ws-strip__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
}

.ws-strip__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;

  &--teal {
    background: linear-gradient(135deg, #2dd4bf, var(--teal));
    box-shadow: 0 3px 8px rgba(13, 148, 136, 0.2);
  }

  &--blue {
    background: linear-gradient(135deg, #60a5fa, var(--blue));
    box-shadow: 0 3px 8px rgba(37, 99, 235, 0.18);
  }
}

.ws-strip__body {
  flex: 1;
  min-width: 0;
}

.ws-strip__label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.ws-strip__body strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.is-green { background: #10b981; }
  &.is-blue { background: #0ea5e9; }
  &.is-slate { background: #94a3b8; }
}

/* ===== Main Layout ===== */
.ws-main {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  gap: 14px;
  animation: ws-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}

.ws-side,
.ws-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== Panels (Left Sidebar) ===== */
.ws-panel {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
}

.ws-panel__bar {
  height: 3px;
  background: linear-gradient(90deg, var(--teal), #2dd4bf);
  opacity: 0.6;
}

.ws-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 0;

  :deep(.app-icon) {
    font-size: 16px;
    color: var(--teal);
  }

  strong {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
}

.ws-actions,
.ws-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 16px;
}

/* Buttons */
.ws-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  :deep(.app-icon) { font-size: 15px; }

  &:hover:not(:disabled) {
    border-color: var(--teal-border);
    color: var(--teal);
    background: var(--teal-soft);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.ws-btn--primary {
  background: linear-gradient(135deg, var(--teal), #0f766e);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #14b8a6, var(--teal));
    box-shadow: 0 4px 14px rgba(13, 148, 136, 0.3);
    transform: translateY(-2px);
    color: #fff;
  }
}

.ws-btn--danger {
  color: var(--red);
  border-color: #fecaca;

  &:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #f87171;
  }
}

.ws-btn-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.25s ease;

  :deep(.app-icon) { font-size: 14px; }

  &:hover {
    border-color: var(--teal-border);
    color: var(--teal);
    background: var(--teal-soft);
  }
}

/* Steps */
.ws-step {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    border-color: #e2e8f0;
  }
}

.ws-step__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2dd4bf, var(--teal));
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.ws-step strong {
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
  color: var(--ink);
}

.ws-step p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

/* Health */
.ws-health {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow: hidden;

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    transition: color 0.2s;

    &:hover { color: var(--ink); }

    :deep(.app-icon) { font-size: 15px; color: var(--teal); }

    span { flex: 1; }
  }

  pre {
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 14px 16px;
    border-top: 1px solid #f1f5f9;
    background: #0f172a;
    color: #a5f3fc;
    font-size: 12px;
    font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.ws-chevron {
  transition: transform 0.25s ease;
  font-size: 14px !important;

  details[open] & {
    transform: rotate(180deg);
  }
}

.ws-spin {
  animation: ws-spin 1s linear infinite;
}

/* ===== Cards (Right Stage) ===== */
.ws-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  position: relative;
  overflow: hidden;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
}

.ws-card__bar {
  height: 3px;
  background: linear-gradient(90deg, var(--teal), #2dd4bf, #99f6e4);
  background-size: 200% 100%;
  animation: ws-shimmer 4s linear infinite;
  opacity: 0.7;
}

.ws-card--status .ws-card__bar {
  background: linear-gradient(90deg, var(--teal), #2dd4bf);
  animation: none;
  opacity: 0.5;
}

.ws-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 0;
}

.ws-card__head-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.3s ease;

  .ws-card:hover & {
    transform: scale(1.06);
  }

  &--teal {
    background: linear-gradient(135deg, #2dd4bf, var(--teal));
    box-shadow: 0 3px 10px rgba(13, 148, 136, 0.2);
  }

  &--blue {
    background: linear-gradient(135deg, #60a5fa, var(--blue));
    box-shadow: 0 3px 10px rgba(37, 99, 235, 0.18);
  }

  &--green {
    background: linear-gradient(135deg, #34d399, var(--green));
    box-shadow: 0 3px 10px rgba(5, 150, 105, 0.18);
  }

  &--red {
    background: linear-gradient(135deg, #f87171, var(--red));
    box-shadow: 0 3px 10px rgba(220, 38, 38, 0.18);
  }

  &--slate {
    background: linear-gradient(135deg, #94a3b8, #64748b);
    box-shadow: 0 3px 10px rgba(100, 116, 139, 0.15);
  }
}

.ws-card__head-text {
  flex: 1;
  min-width: 0;

  strong {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
}

.ws-card__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 20px;
}

/* Large Buttons */
.ws-btn-lg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 48px;
  padding: 0 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--teal), #0f766e);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(13, 148, 136, 0.25);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);

  :deep(.app-icon) { font-size: 18px; }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(13, 148, 136, 0.35);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.ws-btn-lg--secondary {
  background: linear-gradient(135deg, #e0f2fe, #bae6fd);
  color: var(--ink);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);

  &:hover:not(:disabled) {
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.18);
  }
}

/* ===== Fields ===== */
.ws-field {
  padding: 16px 20px 0;
}

.ws-field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.ws-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ws-input-row {
  display: flex;
  gap: 8px;
}

.ws-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f8fafc;
  color: var(--ink);
  font-size: 13px;
  transition: all 0.25s ease;

  &::placeholder {
    color: #94a3b8;
  }

  &:hover {
    border-color: #cbd5e1;
  }

  &:focus {
    outline: none;
    border-color: var(--teal);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
    background: #fff;
  }
}

.ws-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #ccfbf1;
  border-radius: 12px;
  background: var(--teal-soft);
  color: #0f766e;
  font-size: 13px;
  line-height: 1.6;

  :deep(.app-icon) {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--teal);
  }
}

/* ===== Dropzone ===== */
.ws-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  padding: 24px;
  border: 2px dashed #cbd5e1;
  border-radius: 14px;
  background: linear-gradient(135deg, #fafcff, #f8fafc);
  cursor: pointer;
  transition: all 0.3s ease;

  input {
    display: none;
  }

  &:hover {
    border-color: #94a3b8;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  }

  &--active {
    border-color: #86efac;
    border-style: solid;
    background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  }

  &--drag {
    border-color: var(--teal);
    border-style: solid;
    background: var(--teal-soft);
    transform: scale(1.01);
    box-shadow: 0 4px 16px rgba(13, 148, 136, 0.15);
  }
}

.ws-dropzone strong {
  margin-top: 12px;
  font-size: 14px;
  color: #334155;
}

.ws-dropzone small {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.ws-dropzone__icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #2dd4bf, var(--teal));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: transform 0.3s ease;

  .ws-dropzone:hover & {
    transform: scale(1.08);
  }

  .ws-dropzone--drag & {
    transform: scale(1.12);
  }
}

.ws-dropzone__icon--done {
  background: linear-gradient(135deg, #34d399, var(--green));
  border-radius: 50%;
}

.ws-dropzone__clear {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--red);
    color: var(--red);
    background: #fef2f2;
  }
}

.ws-dropzone__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(240, 253, 250, 0.92);
  border-radius: 14px;
  backdrop-filter: blur(4px);
  z-index: 2;

  :deep(.app-icon) {
    font-size: 32px;
    color: var(--teal);
    animation: ws-float 1.5s ease-in-out infinite;
  }

  span {
    font-size: 14px;
    font-weight: 600;
    color: var(--teal);
  }
}

/* ===== Status ===== */
.ws-status-text {
  padding: 4px 20px 20px;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.7;
  white-space: pre-wrap;
}

.ws-status-text--ok {
  color: var(--green);
}

.ws-status-text--err {
  color: var(--red);
}

.ws-result-downloads {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 20px 20px;
}

/* ===== Raw Response ===== */
.ws-raw {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  overflow: hidden;

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    transition: color 0.2s;

    &:hover { color: var(--ink); }

    :deep(.app-icon) { font-size: 15px; color: var(--teal); }

    span { flex: 1; }
  }

  pre {
    margin: 0;
    max-height: 220px;
    overflow: auto;
    padding: 14px 16px;
    border-top: 1px solid #f1f5f9;
    background: #0f172a;
    color: #a5f3fc;
    font-size: 12px;
    font-family: 'Cascadia Code', 'SF Mono', Consolas, monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

/* ===== Animations ===== */
@keyframes ws-slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ws-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes ws-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes ws-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .ws-main {
    grid-template-columns: 1fr;
  }

  .ws-field-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .ws-page { padding: 14px; }

  .ws-strip {
    grid-template-columns: 1fr;
  }

  .ws-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
