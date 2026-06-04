<template>
  <section class="ws-page">
    <div class="ws-top">
      <button class="ws-back" type="button" @click="goBack">
        <AppIcon name="arrow-left" />
        <span>{{ text('返回') }}</span>
      </button>
      <span v-if="entry" class="ws-badge ws-badge--scene">{{ text('自动化场景') }}</span>
    </div>

    <div class="ws-hero">
      <div class="ws-hero__icon">
        <AppIcon name="bot" />
      </div>
      <div class="ws-hero__text">
        <h2>{{ entry?.title || text('未找到入口') }}</h2>
        <p>{{ entry?.subtitle || text('当前入口不存在，请返回列表重新选择。') }}</p>
      </div>
    </div>

    <transition name="ws-msg">
      <div v-if="message" class="ws-alert" :class="`ws-alert--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'info'" />
        <span>{{ message }}</span>
      </div>
    </transition>

    <div v-if="!entry" class="ws-empty">
      <AppIcon name="alert-circle" />
      <strong>{{ text('入口不存在') }}</strong>
      <span>{{ text('请返回网页自动化入口列表重新选择。') }}</span>
    </div>

    <template v-else>
      <div class="ws-strip">
        <div class="ws-strip__item">
          <span class="ws-dot" :class="electronSupported ? 'is-blue' : 'is-slate'" />
          <span class="ws-strip__label">{{ text('运行模式') }}</span>
          <strong>{{ electronSupported ? 'Electron' : text('浏览器') }}</strong>
        </div>
        <div class="ws-strip__item">
          <span class="ws-dot" :class="executorHealth?.ok ? 'is-green' : 'is-slate'" />
          <span class="ws-strip__label">{{ text('执行器') }}</span>
          <strong>{{ executorStatusLabel }}</strong>
        </div>
      </div>

      <div class="ws-main">
        <aside class="ws-side">
          <div class="ws-panel">
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
                <AppIcon name="refresh-cw" />
                {{ refreshing ? text('刷新中') : text('刷新状态') }}
              </button>
            </div>
          </div>

          <div class="ws-panel">
            <div class="ws-panel__head">
              <AppIcon name="info" />
              <strong>{{ text('操作流程') }}</strong>
            </div>
            <div class="ws-steps">
              <template v-if="isShippingScenario">
                <div class="ws-step">
                  <span>1</span>
                  <div>
                    <strong>{{ text('输入账号密码') }}</strong>
                    <p>{{ text('使用当前页面填写 Infor Nexus 登录凭据。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>2</span>
                  <div>
                    <strong>{{ text('启动本地执行器') }}</strong>
                    <p>{{ text('网页端和 EXE 都会走同一套本机启动器。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>3</span>
                  <div>
                    <strong>{{ text('打开 Shipment Scan') }}</strong>
                    <p>{{ text('依次进入 Applications、Print-Scan-Ship、Shipment Scan。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>4</span>
                  <div>
                    <strong>{{ text('后续接入 Excel') }}</strong>
                    <p>{{ text('这一页后续继续承接 Shipping 的上传执行链路。') }}</p>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="ws-step">
                  <span>1</span>
                  <div>
                    <strong>{{ text('上传 Excel 文件') }}</strong>
                    <p>{{ text('选择包含数据的 .xlsx 或 .xls 文件。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>2</span>
                  <div>
                    <strong>{{ text('本地直连执行（推荐）') }}</strong>
                    <p>{{ text('前端直接把 Excel 发给本机执行器，不经过 n8n。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>3</span>
                  <div>
                    <strong>{{ text('发送至 n8n（保留）') }}</strong>
                    <p>{{ text('如需编排、通知、审批、数据库联动，可继续走 n8n 链路。') }}</p>
                  </div>
                </div>
                <div class="ws-step">
                  <span>4</span>
                  <div>
                    <strong>{{ text('查看结果') }}</strong>
                    <p>{{ text('在下方状态区查看执行结果。') }}</p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <details class="ws-health">
            <summary>
              <AppIcon name="terminal" />
              <span>{{ text('执行器健康信息') }}</span>
              <AppIcon name="chevron-down" class="ws-health__chevron" />
            </summary>
            <pre>{{ healthRaw }}</pre>
          </details>
        </aside>

        <section class="ws-stage">
          <div v-if="isShippingScenario" class="ws-card">
            <div class="ws-card__head">
              <AppIcon name="play-circle" />
              <div>
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
                    {{ showShippingPassword ? text('隐藏密码') : text('查看密码') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="ws-field">
              <div class="ws-note">
                {{ text('如果当前是网页端，点击执行时会先唤起本机 launcher，再启动 Shipping 执行器。') }}
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
                class="ws-btn-lg ws-btn-lg--primary"
                :disabled="sending || !shippingUsername || !shippingPassword || !selectedFile"
                @click="runShippingWithExcel"
              >
                <AppIcon name="play-circle" />
                {{ sending ? text('执行中...') : text('上传 Excel 并执行 Shipping') }}
              </button>
            </div>
          </div>

          <div v-else class="ws-card">
            <div class="ws-card__head">
              <AppIcon name="upload" />
              <div>
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
                    {{ showMicrosoftPassword ? text('隐藏密码') : text('查看密码') }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isMicrosoftScenario" class="ws-field">
              <div class="ws-note">
                {{ text('请在本页输入当前任务使用的 Microsoft 账号和密码；本地代码不预置登录凭据。') }}
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
                class="ws-btn-lg ws-btn-lg--primary"
                :disabled="!selectedFile || sending"
                @click="sendDirectToExecutor"
              >
                <AppIcon name="play-circle" />
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

          <div class="ws-card">
            <div class="ws-card__head">
              <AppIcon name="activity" />
              <div>
                <strong>{{ text('执行状态') }}</strong>
              </div>
              <span class="ws-badge" :class="statusBadgeClass">{{ statusLabel }}</span>
            </div>
            <div class="ws-status-text" :class="{ 'ws-status-text--ok': lastResult?.ok, 'ws-status-text--err': lastResult && !lastResult.ok }">
              {{ statusText }}
            </div>
          </div>

          <details v-if="lastRawResponse" class="ws-raw">
            <summary>
              <AppIcon name="code" />
              <span>{{ text('原始响应') }}</span>
              <AppIcon name="chevron-down" class="ws-health__chevron" />
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
  void router.push('/web-automation')
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
</script>

<style scoped lang="scss">
.ws-page {
  --teal: #0d9488;
  --teal-soft: #f0fdfa;
  --teal-border: #99f6e4;
  --sky: #0284c7;
  --green: #059669;
  --amber: #d97706;
  --rose: #dc2626;
  --border: #e2e8f0;
  --muted: #64748b;
  --ink: #0f172a;
  --radius: 14px;

  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  min-height: 100%;
  background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(2, 132, 199, 0.03), transparent 50%), #f8fafc;
}

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
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ws-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;

  &--scene,
  &--ready {
    background: #ecfdf5;
    color: var(--green);
  }

  &--wait {
    background: #fff7ed;
    color: var(--amber);
  }

  &--err {
    background: #fef2f2;
    color: var(--rose);
  }
}

.ws-hero,
.ws-strip__item,
.ws-panel,
.ws-card,
.ws-health,
.ws-raw {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.ws-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
}

.ws-hero__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #38bdf8, var(--sky));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ws-hero__text h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--ink);
}

.ws-hero__text p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.ws-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;

  &--info {
    background: var(--teal-soft);
    color: var(--teal);
    border: 1px solid var(--teal-border);
  }

  &--success {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  &--warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  &--error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }
}

.ws-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
}

.ws-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ws-strip__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.ws-strip__label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.ws-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.is-green { background: #10b981; }
  &.is-blue { background: #0ea5e9; }
  &.is-slate { background: #94a3b8; }
}

.ws-main {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
}

.ws-side,
.ws-stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ws-panel__head,
.ws-card__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 16px 0;
}

.ws-panel__head strong,
.ws-card__head strong {
  font-size: 14px;
  color: var(--ink);
}

.ws-card__head p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.ws-actions,
.ws-steps,
.ws-card__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
}

.ws-step {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
}

.ws-step > span {
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

.ws-btn,
.ws-btn-sm,
.ws-btn-lg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.ws-btn {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.ws-btn--primary {
  background: linear-gradient(135deg, var(--teal), #0f766e);
  color: #fff;
  border-color: transparent;
}

.ws-btn--danger {
  color: var(--rose);
  border-color: #fecaca;
}

.ws-btn-sm {
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.ws-btn-lg {
  width: 100%;
  height: 48px;
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--teal), #0f766e);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.ws-btn-lg--secondary {
  background: linear-gradient(135deg, #e0f2fe, #bae6fd);
  color: #0f172a;
}

.ws-btn:disabled,
.ws-btn-sm:disabled,
.ws-btn-lg:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

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
  gap: 12px;
}

.ws-input-row {
  display: flex;
  gap: 8px;
}

.ws-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f8fafc;
  color: var(--ink);
  font-size: 13px;
}

.ws-note {
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

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

  input {
    display: none;
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
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg, #2dd4bf, var(--teal));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
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
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
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
  border-radius: 12px;
}

.ws-health summary,
.ws-raw summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.ws-health summary span,
.ws-raw summary span {
  flex: 1;
}

.ws-health pre,
.ws-raw pre {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: 14px 16px;
  border-top: 1px solid #f1f5f9;
  background: #0f172a;
  color: #a5f3fc;
  font-size: 12px;
  font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.ws-status-text {
  padding: 0 20px 20px;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.7;
  white-space: pre-wrap;
}

.ws-status-text--ok {
  color: var(--green);
}

.ws-status-text--err {
  color: var(--rose);
}

.ws-msg-enter-active,
.ws-msg-leave-active {
  transition: all 0.2s;
}

.ws-msg-enter-from,
.ws-msg-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 1100px) {
  .ws-main {
    grid-template-columns: 1fr;
  }

  .ws-field-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .ws-strip {
    grid-template-columns: 1fr;
  }

  .ws-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
