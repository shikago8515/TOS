<template>
  <div class="sa">
    <!-- === ALERT === -->
    <transition name="sa-alert-anim">
      <div v-if="message" class="sa-alert" :class="`sa-alert--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'info'" />
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
          <div class="sa-hd__icon"><AppIcon :name="heroIcon" /></div>
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
          <span class="sa-tag"><AppIcon name="zap" /> {{ isMicrosoftScenario ? 'Microsoft / SAP' : 'InforNexus' }}</span>
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
              <div class="sa-card__hd-ico"><AppIcon :name="isMicrosoftScenario ? 'upload' : 'play-circle'" /></div>
              <div class="sa-card__hd-info">
                <strong>{{ text(isMicrosoftScenario ? '上传文件并执行' : directScenarioTitle) }}</strong>
                <small>{{ text(isMicrosoftScenario ? 'Excel 直发本机执行器' : directScenarioExcelHint) }}</small>
              </div>
              <span v-if="executorHealth?.ok" class="sa-chip sa-chip--ok">{{ text('就绪') }}</span>
              <span v-else class="sa-chip sa-chip--warn">{{ text('等待执行器') }}</span>
            </div>

            <!-- Credential Notice -->
            <div v-if="hasStoredCredentials" class="sa-cred-note">
              <AppIcon name="check-circle" />
              <span>{{ credentialStatusText }}</span>
            </div>

            <!-- Credentials -->
            <div v-if="isInfornexusDirectScenario || isMicrosoftScenario" class="sa-card__bd">
              <div class="sa-cred-grid">
                <template v-if="isInfornexusDirectScenario">
                  <label class="sa-field">
                    <span>{{ text('User ID') }}</span>
                    <div class="sa-inp-wrap">
                      <AppIcon name="user" class="sa-inp-icon" />
                      <input v-model.trim="shippingUsername" type="text" class="sa-inp" :placeholder="text('请输入 User ID')" autocomplete="username" />
                    </div>
                  </label>
                  <label class="sa-field">
                    <span>{{ text('Password') }}</span>
                    <div class="sa-inp-wrap">
                      <AppIcon name="shield-check" class="sa-inp-icon" />
                      <input v-model="shippingPassword" :type="showShippingPassword ? 'text' : 'password'" class="sa-inp" placeholder="Enter password" autocomplete="current-password" />
                      <button class="sa-inp__btn" type="button" @click="showShippingPassword = !showShippingPassword"><AppIcon name="eye" /></button>
                    </div>
                  </label>
                </template>
                <template v-else-if="isMicrosoftScenario">
                  <label class="sa-field">
                    <span>{{ text('Microsoft 账号') }}</span>
                    <div class="sa-inp-wrap">
                      <AppIcon name="user" class="sa-inp-icon" />
                      <input v-model.trim="microsoftUsername" type="text" class="sa-inp" :placeholder="text('请输入 Microsoft 账号')" autocomplete="username" />
                    </div>
                  </label>
                  <label class="sa-field">
                    <span>{{ text('Microsoft 密码') }}</span>
                    <div class="sa-inp-wrap">
                      <AppIcon name="shield-check" class="sa-inp-icon" />
                      <input v-model="microsoftPassword" :type="showMicrosoftPassword ? 'text' : 'password'" class="sa-inp" placeholder="Enter password" autocomplete="current-password" />
                      <button class="sa-inp__btn" type="button" @click="showMicrosoftPassword = !showMicrosoftPassword"><AppIcon name="eye" /></button>
                    </div>
                  </label>
                </template>
              </div>
              <div class="sa-cred-row">
                <button class="sa-btn sa-btn--pri" :disabled="credentialSaving || !activeUsername || !activePassword" @click="saveCurrentCredentials">
                  <AppIcon name="shield-check" />{{ credentialSaving ? text('保存中') : text('保存登录账号密码') }}
                </button>
                <button class="sa-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials">
                  <AppIcon name="stop-circle" />{{ text('清除') }}
                </button>
                <button class="sa-btn" :disabled="templateLoading || !primaryTemplate" @click="downloadPrimaryTemplate">
                  <AppIcon name="download" />{{ templateButtonLabel }}
                </button>
              </div>
            </div>

            <!-- File Dropzone -->
            <div class="sa-card__bd" style="border-top: 1px solid #f1f5f9;">
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
                  <button class="sa-drop__x" type="button" @click.stop="clearFile"><AppIcon name="stop-circle" /></button>
                </template>
                <template v-else>
                  <div class="sa-drop__ico sa-drop__ico--float"><AppIcon name="upload" /></div>
                  <div class="sa-drop__info">
                    <b>{{ text('点击或拖入 Excel 文件') }}</b>
                    <small>{{ text(isInfornexusDirectScenario ? directScenarioExcelHint : '支持 .xlsx / .xls 格式') }}</small>
                  </div>
                </template>
                <div v-if="isDragging" class="sa-drop__overlay">{{ text('释放以上传文件') }}</div>
              </div>
            </div>

            <!-- Execute -->
            <div class="sa-card__ft">
              <button v-if="isInfornexusDirectScenario" class="sa-btn sa-btn--execute" :disabled="!canRunShippingAutomation" @click="runInfornexusDirectWithExcel">
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'sa-spin': sending }" />
                <span>{{ sending ? text('执行中...') : text(directScenarioRunLabel) }}</span>
              </button>
              <button v-else class="sa-btn sa-btn--execute" :disabled="!canRunDirectExecutor" @click="sendDirectToExecutor">
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'sa-spin': sending }" />
                <span>{{ sending ? text('执行中...') : text('本地直连执行') }}</span>
              </button>
            </div>

            <!-- Inline Status -->
            <transition name="sa-alert-anim">
              <div v-if="lastResult || sending" class="sa-status" :class="inlineStatusClass">
                <AppIcon :name="statusIconName" />{{ text(statusText) }}
              </div>
            </transition>

            <!-- Artifact Downloads -->
            <div v-if="isShippingScenario && shippingArtifactLinks?.resultExcelUrl" class="sa-card__ft sa-artifacts" style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
              <button class="sa-btn sa-btn--pri" @click="downloadShippingArtifact(shippingArtifactLinks.resultExcelUrl, 'shipping-last-result.xlsx')">
                <AppIcon name="download" />{{ text('结果 Excel') }}
              </button>
              <button v-if="shippingArtifactLinks.failedPoExcelUrl && shippingArtifactLinks.failedRowCount > 0" class="sa-btn" @click="downloadShippingArtifact(shippingArtifactLinks.failedPoExcelUrl, 'shipping-last-failed-po-rows.xlsx')">
                <AppIcon name="download" />{{ text('失败明细') }}
              </button>
            </div>
          </section>

          <!-- Raw Response -->
          <details v-if="lastRawResponse" class="sa-log">
            <summary class="sa-log__hd">
              <AppIcon name="code" class="sa-log__hd-icon" />
              <span>{{ text('原始响应') }}</span>
              <AppIcon name="chevron-down" class="sa-chev" />
            </summary>
            <pre class="sa-log__pre">{{ lastRawResponse }}</pre>
          </details>

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

          <!-- Steps -->
          <div class="sa-dock-card sa-dock-card--flex">
            <div class="sa-dock__hd">
              <AppIcon name="workflow" class="sa-dock__hd-icon" />
              <span>{{ text('操作流程') }}</span>
            </div>
            <div class="sa-dock__bd sa-steps">
              <template v-if="isShippingScenario">
                <div v-for="(s, i) in shippingSteps" :key="i" class="sa-step">
                  <b class="sa-step__n">{{ i + 1 }}</b>
                  <div class="sa-step__text">
                    <em>{{ text(s.title) }}</em>
                    <small>{{ text(s.desc) }}</small>
                  </div>
                </div>
              </template>
              <template v-else-if="isInfornexusAutoAddScenario">
                <div v-for="(s, i) in infornexusAutoAddSteps" :key="i" class="sa-step">
                  <b class="sa-step__n">{{ i + 1 }}</b>
                  <div class="sa-step__text">
                    <em>{{ text(s.title) }}</em>
                    <small>{{ text(s.desc) }}</small>
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-for="(s, i) in defaultSteps" :key="i" class="sa-step">
                  <b class="sa-step__n">{{ i + 1 }}</b>
                  <div class="sa-step__text">
                    <em>{{ text(s.title) }}</em>
                    <small>{{ text(s.desc) }}</small>
                  </div>
                </div>
              </template>
            </div>
          </div>
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
import { computed, onMounted, ref } from 'vue'; import { useRoute, useRouter } from 'vue-router'; import AppIcon from '../../shared/ui/AppIcon.vue'
import BrowserVisibilitySwitch from '../../shared/ui/BrowserVisibilitySwitch.vue'
import type { AutomationAppInfo } from '../../types/electronApi'; import type { AutomationRunFileInput, AutomationRunRecord, AutomationTemplate, ExecutorCredentials, LocalExecutorHealth } from './webAutomationApi'
import { buildAutomationTemplateDownloadUrl, clearExecutorCredentials, createAutomationRunRecord, fetchAutomationTemplates, fetchExecutorCredentials, openAutomationHelperDownload, fetchAutomationApps, finishAutomationRunRecord, getAutomationHelperUpdateMessage, hasElectronAutomationSupport, launchAutomationConsole, primeLocalAutomationLauncherBoot, probeLocalAutomationLauncherHealth, probeLocalExecutorHealth, recordWebAutomationEvent, resolveAutomationCredentials, saveExecutorCredentials, stopAutomationConsole } from './webAutomationApi'
import { canRunWithCredentials } from './webAutomationCredentials'
import { formatAutomationExecutorMessage, shouldShowAutomationErrorDialog, showAutomationErrorDialog } from './webAutomationErrors'
import { getAutomationAppStatusLabel, getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from './webAutomationModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const route = useRoute(); const router = useRouter(); const { text } = useAppLanguage()
const DSU = ''; const DSP = ''; const DMU = ''; const DMP = ''
const electronSupported = hasElectronAutomationSupport()
const activeApp = ref<AutomationAppInfo | null>(null); const executorHealth = ref<LocalExecutorHealth | null>(null); const executorCredentials = ref<ExecutorCredentials | null>(null); const automationTemplates = ref<AutomationTemplate[]>([])
const launcherReachable = ref(false); const launching = ref(false); const refreshing = ref(false); const templateLoading = ref(false); const credentialSaving = ref(false); const credentialClearing = ref(false); const sending = ref(false)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info'); const isHealthLogOpen = ref(false); const isDragging = ref(false); const dragDepth = ref(0); const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null); const webhookUrl = ref('http://127.0.0.1:5678/webhook/microsoft-login-excel-demo')
const shippingUsername = ref(DSU); const shippingPassword = ref(DSP); const showShippingPassword = ref(true)
const microsoftUsername = ref(DMU); const microsoftPassword = ref(DMP); const showMicrosoftPassword = ref(true)
const showBrowserView = ref(true)
const statusText = ref(''); const statusLabel = ref('待命'); const lastResult = ref<{ ok: boolean; message?: string } | null>(null); const lastRawResponse = ref('')
type SAL = { resultExcelUrl: string; resultJsonUrl?: string; failedPoExcelUrl?: string; failedPoJsonUrl?: string; failedRowCount: number }
const shippingArtifactLinks = ref<SAL | null>(null)

const shippingSteps = [{ title: '输入账号密码', desc: '使用 Infor Nexus 登录账号密码。' },{ title: '启动本地执行器', desc: '网页端和 EXE 同套启动器。' },{ title: '打开 Shipment Scan', desc: '进入 Applications > Print-Scan-Ship > Shipment Scan。' },{ title: '上传 Excel 执行', desc: '上传 PO No Excel 执行批量录入。' }]
const infornexusAutoAddSteps = [{ title: '上传 Excel 文件', desc: '读取第二列 10 位 ID。' },{ title: '启动执行器', desc: '启动可见浏览器登录 Infor Nexus。' },{ title: '自动搜索添加', desc: '按 Excel 顺序逐个搜索、勾选并添加。' },{ title: '查看结果', desc: '完成数量和失败明细在下方返回。' }]
const defaultSteps = [{ title: '上传 Excel 文件', desc: '选择 .xlsx 或 .xls 文件。' },{ title: '本地直连执行', desc: 'Excel 直发本机执行器。' },{ title: '查看结果', desc: '在下方状态区查看执行结果。' }]

const entry = computed(() => getWebAutomationEntry(String(route.params.scenarioId || '')))
const isShippingScenario = computed(() => entry.value?.id === 'shipping-automation')
const isInfornexusAutoAddScenario = computed(() => entry.value?.id === 'infornexus-auto-add')
const isInfornexusDirectScenario = computed(() => isShippingScenario.value || isInfornexusAutoAddScenario.value)
const isMicrosoftScenario = computed(() => entry.value?.id === 'microsoft-login-n8n')
const pageScenarioClass = computed(() => { if (isMicrosoftScenario.value) return 'pg--ms'; if (isShippingScenario.value) return 'pg--ship'; if (isInfornexusAutoAddScenario.value) return 'pg--inf'; return 'pg--def' })
const heroIcon = computed(() => { if (isMicrosoftScenario.value) return 'zap'; if (isShippingScenario.value) return 'package'; if (isInfornexusAutoAddScenario.value) return 'globe-search'; return 'bot' })
const directExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-login-file` : '' })
const shippingExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-shipping-file` : '' })
const infornexusAutoAddExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-infornexus-auto-add-file` : '' })
const directScenarioTitle = computed(() => isInfornexusAutoAddScenario.value ? 'Infornexus 自动搜索添加' : '登录并打开 Shipment Scan')
const directScenarioExcelHint = computed(() => isInfornexusAutoAddScenario.value ? '请把 10 位 ID 放在第二列' : '请包含 PO No 列')
const directScenarioRunLabel = computed(() => isInfornexusAutoAddScenario.value ? '上传 Excel 并执行' : '上传 Excel 并执行 Shipping')
const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorStatusLabel = computed(() => { if (activeApp.value) { const l = text(getAutomationAppStatusLabel(activeApp.value)); if (executorHealth.value?.ok) { const c = Number(executorHealth.value.activeRunCount || 0); return c > 0 ? `${l} / ${c} ${text('个任务')}` : `${l} / ${text('就绪')}` }; if (activeApp.value.running) return `${l} / ${text('未连通')}`; return l }; return executorHealth.value?.ok ? text('就绪') : text('未启动') })
const inlineStatusClass = computed(() => { if (sending.value) return 'pg-status--info'; if (lastResult.value?.ok) return 'pg-status--ok'; if (lastResult.value && !lastResult.value.ok) return 'pg-status--err'; return '' })
const statusIconName = computed(() => { if (sending.value) return 'loader'; if (lastResult.value?.ok) return 'check-circle'; if (lastResult.value && !lastResult.value.ok) return 'alert-circle'; return 'activity' })
const canLaunchActiveApp = computed(() => Boolean(entry.value?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)
const showLocalHelperPrompt = computed(() => !electronSupported && !launcherReachable.value)
const hasStoredCredentials = computed(() => Boolean(executorCredentials.value?.hasStoredCredentials))
const savedCredentialUsername = computed(() => executorCredentials.value?.username || '')
const primaryTemplate = computed(() => automationTemplates.value[0] || null)
const templateButtonLabel = computed(() => { if (templateLoading.value) return text('模板加载中...'); return primaryTemplate.value ? text('下载 Excel 模板') : text('暂无模板') })
const activeUsername = computed(() => isInfornexusDirectScenario.value ? shippingUsername.value : microsoftUsername.value)
const activePassword = computed(() => isInfornexusDirectScenario.value ? shippingPassword.value : microsoftPassword.value)
const loginSiteName = computed(() => isMicrosoftScenario.value ? 'Microsoft / SAP BTP' : 'Infor Nexus')
const credentialStatusText = computed(() => { const sn = loginSiteName.value; return hasStoredCredentials.value ? `${text('已保存')} ${sn} ${text('登录账号')}: ${savedCredentialUsername.value}` : `${text('未保存')} ${sn} ${text('登录账号密码')}` })
const canRunShippingAutomation = computed(() => canRunWithCredentials({ username: shippingUsername.value, password: shippingPassword.value, hasStoredCredentials: hasStoredCredentials.value, hasSelectedFile: Boolean(selectedFile.value), sending: sending.value }))
const canRunDirectExecutor = computed(() => { if (!isMicrosoftScenario.value) return Boolean(selectedFile.value) && !sending.value; return canRunWithCredentials({ username: microsoftUsername.value, password: microsoftPassword.value, hasStoredCredentials: hasStoredCredentials.value, hasSelectedFile: Boolean(selectedFile.value), sending: sending.value }) })

onMounted(() => { void initializeScenario() })
async function initializeScenario(): Promise<void> {
  if (isShippingScenario.value) { shippingUsername.value = shippingUsername.value || DSU; shippingPassword.value = shippingPassword.value || DSP; statusLabel.value = '待命'; statusText.value = '等待上传 Excel 并执行 Shipping。' }
  else if (isInfornexusAutoAddScenario.value) { shippingUsername.value = shippingUsername.value || DSU; shippingPassword.value = shippingPassword.value || DSP; statusLabel.value = '待命'; statusText.value = '等待上传 Excel 并执行 Infornexus 自动搜索添加。' }
  else if (isMicrosoftScenario.value) { microsoftUsername.value = microsoftUsername.value || DMU; microsoftPassword.value = microsoftPassword.value || DMP; statusLabel.value = '待命'; statusText.value = '等待上传 Excel 并执行。' }
  await refreshAutomationTemplates(); await refreshExecutorCredentials(); await refreshExecutorState(true)
  if (electronSupported && activeApp.value?.available && !activeApp.value.running) await startActiveApp(true)
}
async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry.value || refreshing.value) return
  refreshing.value = true
  const fb = createFallback(entry.value)
  try {
    launcherReachable.value = electronSupported ? true : await probeLocalAutomationLauncherHealth()
    if (electronSupported) {
      try {
        const apps = await fetchAutomationApps()
        activeApp.value = apps.find((a) => a.id === entry.value?.appId) ?? fb
      } catch {
        activeApp.value = fb
      }
    } else {
      activeApp.value = fb
    }
    if (!electronSupported && !launcherReachable.value) {
      executorHealth.value = null
      activeApp.value = fb
      if (!silent) {
        messageTone.value = 'warning'
        message.value = text('未检测到本机自动化助手。')
      }
      return
    }
    executorHealth.value = await probeLocalExecutorHealth(entry.value.executorBaseUrl)
    await refreshExecutorCredentials()
    if (activeApp.value) activeApp.value = { ...activeApp.value, running: true }
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
    activeApp.value = activeApp.value || fb
    if (!silent) {
      messageTone.value = 'warning'
      message.value = launcherReachable.value ? text('本机自动化助手已连接，执行器尚未启动。') : text('执行器未就绪。')
    }
  } finally {
    refreshing.value = false
  }
}
async function refreshExecutorCredentials(): Promise<void> { if (!entry.value) return; try { executorCredentials.value = await fetchExecutorCredentials(entry.value.id); const u = executorCredentials.value.username || ''; if (u && isInfornexusDirectScenario.value) shippingUsername.value = u; if (u && isMicrosoftScenario.value) microsoftUsername.value = u; if (executorCredentials.value.hasStoredCredentials) await fillStored() } catch { executorCredentials.value = null } }
async function fillStored(): Promise<void> { if (!entry.value) return; const r = await resolveAutomationCredentials(entry.value.id); if (isInfornexusDirectScenario.value) { shippingUsername.value = r.username; shippingPassword.value = r.password } else if (isMicrosoftScenario.value) { microsoftUsername.value = r.username; microsoftPassword.value = r.password } }
async function refreshAutomationTemplates(): Promise<void> { if (!entry.value) return; templateLoading.value = true; try { automationTemplates.value = await fetchAutomationTemplates(entry.value.id) } catch { automationTemplates.value = [] } finally { templateLoading.value = false } }
async function downloadPrimaryTemplate(): Promise<void> { const t = primaryTemplate.value; if (!t) return; try { const u = await buildAutomationTemplateDownloadUrl(t); const a = document.createElement('a'); a.href = u; a.download = t.originalFilename || `${t.templateKey || 'template'}.xlsx`; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove() } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('下载失败。')) } }
function downloadAutomationHelper(): void { void openAutomationHelperDownload() }
function bootLocalHelper(): void { primeLocalAutomationLauncherBoot(); messageTone.value = 'info'; message.value = text('已尝试启动本机自动化助手。'); window.setTimeout(() => { void refreshExecutorState(true) }, 1200) }
async function saveCurrentCredentials(): Promise<void> { if (!entry.value || credentialSaving.value) return; const u = activeUsername.value.trim(); const p = activePassword.value; if (!u || !p) { messageTone.value = 'warning'; message.value = text('请先填写账号和密码。'); return }; credentialSaving.value = true; try { executorCredentials.value = await saveExecutorCredentials(entry.value.id, u, p); await refreshExecutorCredentials(); if (isInfornexusDirectScenario.value) { shippingUsername.value = executorCredentials.value.username || u; shippingPassword.value = p } else if (isMicrosoftScenario.value) { microsoftUsername.value = executorCredentials.value.username || u; microsoftPassword.value = p }; messageTone.value = 'success'; message.value = text('已保存。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('保存失败。')) } finally { credentialSaving.value = false } }
async function clearCurrentCredentials(): Promise<void> { if (!entry.value || credentialClearing.value) return; credentialClearing.value = true; try { executorCredentials.value = await clearExecutorCredentials(entry.value.id); messageTone.value = 'info'; message.value = text('已清除。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('清除失败。')) } finally { credentialClearing.value = false } }
async function startActiveApp(silent: boolean): Promise<void> { if (!entry.value || launching.value) return; if (!electronSupported && !launcherReachable.value) primeLocalAutomationLauncherBoot(); launching.value = true; try { const r = await launchAutomationConsole(entry.value.appId); if (!r.success) throw new Error(r.error || '启动失败'); await refreshExecutorState(true); if (!silent) { messageTone.value = 'success'; message.value = r.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。') } } catch (e) { const m = readErrorMessage(e, text('启动失败')); await recordWebAutomationEvent('launch-exception', { appId: entry.value.appId, entryId: entry.value.id, error: m }); if (!silent) { messageTone.value = 'error'; message.value = m } } finally { launching.value = false } }
async function stopActiveApp(): Promise<void> { if (!entry.value) return; try { const r = await stopAutomationConsole(entry.value.appId); if (!r.success) throw new Error(r.error || '停止失败'); executorHealth.value = null; if (activeApp.value) activeApp.value = { ...activeApp.value, running: false }; await refreshExecutorState(true).catch(() => {}); messageTone.value = 'info'; message.value = text('执行器已停止。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('停止失败')) } }
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
function resetWebhookUrl(): void { webhookUrl.value = entry.value?.webhookUrl || 'http://127.0.0.1:5678/webhook/microsoft-login-excel-demo' }
async function resolveRunCredentialsPayload(uv: string, pv: string): Promise<Record<string, string>> { if (!entry.value) return {}; const u = uv.trim(); const tp = pv; if (tp.trim()) { if (!u) throw new Error('请填写账号密码。'); executorCredentials.value = await saveExecutorCredentials(entry.value.id, u, tp); await refreshExecutorCredentials(); applyCredUser(executorCredentials.value.username || u); return { username: u, password: tp } }; const r = await resolveAutomationCredentials(entry.value.id); applyCredUser(r.username); if (isInfornexusDirectScenario.value) shippingPassword.value = r.password; else if (isMicrosoftScenario.value) microsoftPassword.value = r.password; return { username: r.username, password: r.password } }
function applyCredUser(u: string): void { if (!u) return; if (isInfornexusDirectScenario.value) shippingUsername.value = u; else if (isMicrosoftScenario.value) microsoftUsername.value = u }
async function createBackendRunRecord(f: File): Promise<AutomationRunRecord | null> { if (!entry.value) return null; return createAutomationRunRecord(entry.value.id, f, entry.value.title) }
async function finishBackendRunRecord(r: AutomationRunRecord | null, ok: boolean, msg: string, p: Record<string, any> | null): Promise<void> { if (!r?.runId) return; await finishAutomationRunRecord(r.runId, ok ? 'success' : 'failed', msg || (ok ? 'completed' : 'failed'), p, collectResultFiles(p)) }
function collectResultFiles(p: Record<string, any> | null): AutomationRunFileInput[] { const u = p?.artifacts?.downloadUrls; if (!u || typeof u !== 'object') return []; return [bfi(u.resultExcelUrl, 'result_excel', 'shipping-last-result.xlsx'), bfi(u.resultJsonUrl, 'result_json', 'shipping-last-result.json'), bfi(u.failedPoExcelUrl, 'failed_rows_excel', 'shipping-last-failed-po-rows.xlsx'), bfi(u.failedPoJsonUrl, 'failed_rows_json', 'shipping-last-failed-po-rows.json')].filter((x): x is AutomationRunFileInput => Boolean(x)) }
function bfi(rp: string, fr: string, fn: string): AutomationRunFileInput | null { const u = buildShippingArtifactUrl(rp); if (!u) return null; return { url: u, fileRole: fr, fileName: fn } }
async function runInfornexusDirectWithExcel(): Promise<void> { if (isInfornexusAutoAddScenario.value) { await runInfornexusAutoAdd(); return }; await runShipping() }
async function runShipping(): Promise<void> { if (!entry.value || sending.value || !isShippingScenario.value || !selectedFile.value) return; if (!(await ensureReady())) { setNotReady(); return }; const file = selectedFile.value; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; shippingArtifactLinks.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const res = await fetch(shippingExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: file.name, fileBase64: fb64, token: entry.value.localExecutorToken, headless: !showBrowserView.value, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); updateShippingArtifactLinks(j); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { const m = formatAutomationExecutorMessage(j?.message || `HTTP ${res.status}`); if (shouldShowAutomationErrorDialog(j?.message)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }; if (j?.ok && j?.shipmentScanOpened) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedPoCount ?? 0}/${j.totalPoCount ?? '?'} 个 PO。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function runInfornexusAutoAdd(): Promise<void> { if (!entry.value || sending.value || !isInfornexusAutoAddScenario.value || !selectedFile.value) return; if (!(await ensureReady())) { setNotReady(); return }; const file = selectedFile.value; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const res = await fetch(infornexusAutoAddExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: file.name, fileBase64: fb64, token: entry.value.localExecutorToken, headless: !showBrowserView.value, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { const m = formatAutomationExecutorMessage(j?.message || `HTTP ${res.status}`); if (shouldShowAutomationErrorDialog(j?.message)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }; if (j?.ok) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedIdCount ?? 0}/${j.totalIdCount ?? '?'} 个 ID。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function sendDirectToExecutor(): Promise<void> { if (!selectedFile.value || sending.value || !entry.value) return; if (!(await ensureReady())) { setNotReady(); return }; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在执行...'; lastResult.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(selectedFile.value); const fb64 = await fileToBase64(selectedFile.value); const cp = isMicrosoftScenario.value ? await resolveRunCredentialsPayload(microsoftUsername.value, microsoftPassword.value) : {}; const res = await fetch(directExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: selectedFile.value.name, fileBase64: fb64, token: entry.value.localExecutorToken, headless: !showBrowserView.value, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { const m = formatAutomationExecutorMessage(j?.message || `HTTP ${res.status}`); if (shouldShowAutomationErrorDialog(j?.message)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }; if (!j) throw new Error('无法解析响应。'); if (j.loginSuccess) { statusLabel.value = '成功'; statusText.value = `已处理 ${j.uploadedRowCount ?? '?'} 行。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。') } else { statusLabel.value = '未完成'; statusText.value = j.message || '未确认成功。'; lastResult.value = { ok: false, message: j.message }; messageTone.value = 'warning'; message.value = text('已触发，未确认。') } } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
function setNotReady(): void { statusLabel.value = '未就绪'; statusText.value = '本机执行器尚未就绪。'; lastResult.value = { ok: false, message: 'Executor is not ready.' }; messageTone.value = 'warning'; message.value = text('本机执行器未就绪。') }
async function ensureReady(): Promise<boolean> { if (executorHealth.value?.ok) return true; await startActiveApp(true); await refreshExecutorState(true).catch(() => {}); return Boolean(executorHealth.value?.ok) }
async function fileToBase64(f: File): Promise<string> { const b = await f.arrayBuffer(); return arrayBufferToBase64(b) }
function arrayBufferToBase64(b: ArrayBuffer): string { const bytes = new Uint8Array(b); const cs = 0x8000; let bin = ''; for (let i = 0; i < bytes.length; i += cs) { const chunk = bytes.subarray(i, i + cs); bin += String.fromCharCode(...chunk) }; return window.btoa(bin) }
function safeParseJson(r: string): Record<string, any> | null { try { return r ? JSON.parse(r) : null } catch { return null } }
function updateShippingArtifactLinks(p: Record<string, any> | null): void { if (!isShippingScenario.value) { shippingArtifactLinks.value = null; return }; const u = p?.artifacts?.downloadUrls; const re = buildShippingArtifactUrl(u?.resultExcelUrl); if (!re) { shippingArtifactLinks.value = null; return }; shippingArtifactLinks.value = { resultExcelUrl: re, resultJsonUrl: buildShippingArtifactUrl(u?.resultJsonUrl) || undefined, failedPoExcelUrl: buildShippingArtifactUrl(u?.failedPoExcelUrl) || undefined, failedPoJsonUrl: buildShippingArtifactUrl(u?.failedPoJsonUrl) || undefined, failedRowCount: Number(p?.artifacts?.failedRowCount ?? 0) } }
function buildShippingArtifactUrl(rp: string): string { const np = String(rp || '').trim(); if (!np) return ''; if (/^https?:\/\//i.test(np)) return np; const bu = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return bu ? `${bu}${np.startsWith('/') ? np : `/${np}`}` : '' }
function downloadShippingArtifact(u: string | undefined, fn: string): void { if (!u) return; const a = document.createElement('a'); a.href = u; a.download = fn; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove() }
function createFallback(e: WebAutomationEntry): AutomationAppInfo { return { id: e.appId, name: e.title, description: e.description, provider: 'Playwright', category: '网页自动化', version: '', available: true, running: false, port: Number(new URL(e.executorBaseUrl).port || 0), url: e.executorBaseUrl } }
function goBack(): void { if (window.history.length > 1) router.back(); else void router.push('/') }
function readErrorMessage(e: unknown, fb: string): string { return e instanceof Error && e.message ? e.message : fb }
</script>

<style scoped lang="scss">
/* ================================================================
   Shipping Automation — v4 Right-Dock Layout (1:1 aligned with components)
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

/* ─── Credential Notice ─── */
.sa-cred-note {
  display: flex; align-items: center; gap: 7px;
  margin: 12px 20px 0; padding: 9px 13px; border-radius: 10px;
  background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
  font-size: 12px; font-weight: 500;
  :deep(.app-icon) { font-size: 14px; flex-shrink: 0; }
}
.sa-cred-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sa-cred-row { display: flex; flex-wrap: wrap; gap: 7px; }

/* ─── Fields ─── */
.sa-field { display: flex; flex-direction: column; gap: 4px;
  > span { font-size: 11px; font-weight: 600; color: var(--ink); }
}
.sa-inp-wrap { position: relative; display: flex; align-items: center; flex: 1; }
.sa-inp-icon { position: absolute; left: 10px; color: var(--mu); font-size: 14px; pointer-events: none; z-index: 1; }
.sa-inp {
  flex: 1; min-width: 0; height: 34px; padding: 0 12px 0 32px;
  border: 1px solid var(--br); border-radius: 8px;
  background: #f8fafc; color: var(--ink); font-size: 12px;
  transition: all .2s ease;
  &::placeholder { color: #94a3b8; }
  &:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,.1); background: #fff; }
  &__btn { position: absolute; right: 8px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--mu); cursor: pointer; transition: all .15s;
    :deep(.app-icon) { font-size: 13px; }
    &:hover { color: var(--a); background: var(--a2); }
  }
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
@media (max-width: 960px) { .sa-body { grid-template-columns: 1fr; } .sa-dock { flex-direction: row; } .sa-dock-card { flex: 1; &--flex { flex: 1; } } .sa-cred-grid { grid-template-columns: 1fr; } }

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
