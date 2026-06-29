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
              <div class="sa-card__hd-ico"><AppIcon :name="isMicrosoftScenario ? microsoftWorkflowIcon : 'play-circle'" /></div>
              <div class="sa-card__hd-info">
                <strong>{{ text(isMicrosoftScenario ? microsoftWorkflowTitle : directScenarioTitle) }}</strong>
                <small>{{ text(isMicrosoftScenario ? microsoftWorkflowHint : directScenarioExcelHint) }}</small>
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
                <button v-if="requiresExcel" class="sa-btn" :disabled="templateLoading" @click="downloadPrimaryTemplate">
                  <AppIcon name="download" />{{ templateButtonLabel }}
                </button>
              </div>
            </div>

            <!-- File Dropzone -->
            <div v-if="requiresExcel" class="sa-card__bd" style="border-top: 1px solid #f1f5f9;">
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

            <!-- Optional lookup workbooks -->
            <div v-if="isTicketOwnerStatisticsScenario" class="sa-card__bd sa-lookup-files" style="border-top: 1px solid #f1f5f9;">
              <label class="sa-field">
                <span>{{ text('辅助 Excel（可选）') }}</span>
              </label>
              <div class="sa-lookup-file">
                <input ref="ticketReleaseFileInput" class="sa-lookup-file__input" type="file" accept=".xlsx,.xls" @change="handleTicketReleaseFileSelect" />
                <AppIcon name="files" class="sa-lookup-file__icon" />
                <div class="sa-lookup-file__body">
                  <b>{{ text('Release / Unrelease 表') }}</b>
                  <small>{{ ticketReleaseFile ? ticketReleaseFile.name : text('按 PO Number 匹配 Factory，不上传则留空') }}</small>
                </div>
                <button v-if="ticketReleaseFile" class="sa-btn" type="button" @click="clearTicketReleaseFile">
                  <AppIcon name="stop-circle" />{{ text('清除') }}
                </button>
                <button v-else class="sa-btn" type="button" @click="openTicketReleaseFilePicker">
                  <AppIcon name="upload" />{{ text('选择') }}
                </button>
              </div>
              <div class="sa-lookup-file">
                <input ref="ticketFactoryPriceFileInput" class="sa-lookup-file__input" type="file" accept=".xlsx,.xls" @change="handleTicketFactoryPriceFileSelect" />
                <AppIcon name="files" class="sa-lookup-file__icon" />
                <div class="sa-lookup-file__body">
                  <b>{{ text('Factory Price 表') }}</b>
                  <small>{{ ticketFactoryPriceFile ? ticketFactoryPriceFile.name : text('按 Factory + Working Number 匹配 Merch，不上传则留空') }}</small>
                </div>
                <button v-if="ticketFactoryPriceFile" class="sa-btn" type="button" @click="clearTicketFactoryPriceFile">
                  <AppIcon name="stop-circle" />{{ text('清除') }}
                </button>
                <button v-else class="sa-btn" type="button" @click="openTicketFactoryPriceFilePicker">
                  <AppIcon name="upload" />{{ text('选择') }}
                </button>
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
                <span>{{ sending ? text('执行中...') : text(directRunButtonLabel) }}</span>
              </button>
            </div>

            <!-- Inline Status -->
            <transition name="sa-alert-anim">
              <div v-if="lastResult || sending" class="sa-status" :class="inlineStatusClass">
                <AppIcon :name="statusIconName" />{{ text(statusText) }}
              </div>
            </transition>
            <div v-if="showTicketOwnerRunProgress" class="sa-progress">
              <div class="sa-progress__head">
                <span>{{ text(ticketOwnerProgressText) }}</span>
                <b>{{ ticketOwnerProgressPercent }}%</b>
              </div>
              <div class="sa-progress__track">
                <span :style="{ width: `${ticketOwnerProgressPercent}%` }" />
              </div>
            </div>

            <!-- Artifact Downloads -->
            <div v-if="(isShippingScenario || isTicketOwnerStatisticsScenario) && shippingArtifactLinks?.resultExcelUrl" class="sa-card__ft sa-artifacts" style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
              <button class="sa-btn sa-btn--pri" @click="downloadShippingArtifact(shippingArtifactLinks.resultExcelUrl, artifactResultExcelDownloadName)">
                <AppIcon name="download" />{{ text(artifactResultExcelLabel) }}
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

          <AutomationRunHistoryPanel :automation-id="entry.id" :refresh-signal="lastRawResponse" />

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
              <template v-else-if="isTicketOwnerStatisticsScenario">
                <div v-for="(s, i) in ticketOwnerStatisticsSteps" :key="i" class="sa-step">
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'; import { useRoute, useRouter } from 'vue-router'; import AppIcon from '../../shared/ui/AppIcon.vue'
import BrowserVisibilitySwitch from '../../shared/ui/BrowserVisibilitySwitch.vue'
import AutomationRunHistoryPanel from './components/AutomationRunHistoryPanel.vue'
import { downloadUrlAsFile } from '../../shared/api/backendClient'
import { showAppAlert } from '../../shared/ui/appAlert'
import type { AutomationAppInfo } from '../../types/electronApi'; import type { AutomationRunFileInput, AutomationRunFileRecord, AutomationRunRecord, AutomationTemplate, ExecutorCredentials, LocalExecutorHealth } from './webAutomationApi'
import { buildAutomationRunFileDownloadUrl, clearExecutorCredentials, createAutomationRunRecord, downloadAutomationTemplate, fetchAutomationTemplates, fetchExecutorCredentials, openAutomationHelperDownload, fetchAutomationApps, finishAutomationRunRecord, getAutomationHelperUpdateMessage, hasElectronAutomationSupport, launchAutomationConsole, primeLocalAutomationLauncherBoot, probeLocalAutomationLauncherHealthPayload, probeLocalExecutorHealth, recordWebAutomationEvent, resolveAutomationCredentials, saveExecutorCredentials, stopAutomationConsole } from './webAutomationApi'
import { formatAutomationExecutorMessage, shouldShowAutomationErrorDialog, showAutomationErrorDialog } from './webAutomationErrors'
import { getAutomationAppStatusLabel, getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from './webAutomationModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const route = useRoute(); const router = useRouter(); const { text } = useAppLanguage()
const DSU = ''; const DSP = ''; const DMU = ''; const DMP = ''
const electronSupported = hasElectronAutomationSupport()
const activeApp = ref<AutomationAppInfo | null>(null); const executorHealth = ref<LocalExecutorHealth | null>(null); const executorCredentials = ref<ExecutorCredentials | null>(null); const automationTemplates = ref<AutomationTemplate[]>([])
const launcherReachable = ref(false); const launching = ref(false); const refreshing = ref(false); const templateLoading = ref(false); const credentialSaving = ref(false); const credentialClearing = ref(false); const sending = ref(false); const restoredActiveRun = ref(false); const credentialsHydrated = ref(false)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info'); const isHealthLogOpen = ref(false); const isDragging = ref(false); const dragDepth = ref(0); const fileInput = ref<HTMLInputElement | null>(null)
const ticketReleaseFileInput = ref<HTMLInputElement | null>(null); const ticketFactoryPriceFileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null); const ticketReleaseFile = ref<File | null>(null); const ticketFactoryPriceFile = ref<File | null>(null); const webhookUrl = ref('http://127.0.0.1:5678/webhook/microsoft-login-excel-demo')
const shippingUsername = ref(DSU); const shippingPassword = ref(DSP); const showShippingPassword = ref(true)
const microsoftUsername = ref(DMU); const microsoftPassword = ref(DMP); const showMicrosoftPassword = ref(true)
const showBrowserView = ref(true)
const statusText = ref(''); const statusLabel = ref('待命'); const lastResult = ref<{ ok: boolean; message?: string } | null>(null); const lastRawResponse = ref('')
const ticketOwnerProgressPercent = ref(0); const ticketOwnerProgressText = ref('')
let ticketOwnerProgressTimer: number | null = null
let activeRunStateTimer: number | null = null
type SAL = { resultExcelUrl: string; resultJsonUrl?: string; failedPoExcelUrl?: string; failedPoJsonUrl?: string; failedRowCount: number }
const shippingArtifactLinks = ref<SAL | null>(null)
const autoDownloadedArtifactKey = ref('')

const shippingSteps = [{ title: '输入账号密码', desc: '使用 Infor Nexus 登录账号密码。' },{ title: '启动本地执行器', desc: '网页端和 EXE 同套启动器。' },{ title: '打开 Shipment Scan', desc: '进入 Applications > Print-Scan-Ship > Shipment Scan。' },{ title: '上传 Excel 执行', desc: '上传万代 PO No Excel 执行批量录入。' }]
const infornexusAutoAddSteps = [{ title: '上传 Excel 文件', desc: '读取第二列 10 位 ID。' },{ title: '启动执行器', desc: '启动可见浏览器登录 Infor Nexus。' },{ title: '自动搜索添加', desc: '按 Excel 顺序逐个搜索、勾选并添加。' },{ title: '查看结果', desc: '完成数量和失败明细在下方返回。' }]
const ticketOwnerStatisticsSteps = [{ title: '启动执行器', desc: '使用可见浏览器登录 Microsoft / SAP BTP。' },{ title: '打开 Task Center', desc: '筛选除 Initiate Cancellation Request 外的 Task Type。' },{ title: '采集 A/B/C', desc: 'Claim 后 Open in App，按三类规则提取字段。' },{ title: '下载 Excel', desc: '生成 Ticket ownership.xlsx。' }]
const defaultSteps = [{ title: '上传 Excel 文件', desc: '选择 .xlsx 或 .xls 文件。' },{ title: '本地直连执行', desc: 'Excel 直发本机执行器。' },{ title: '查看结果', desc: '在下方状态区查看执行结果。' }]

const entry = computed(() => getWebAutomationEntry(String(route.params.scenarioId || '')))
const isShippingScenario = computed(() => entry.value?.id === 'shipping-automation')
const isInfornexusAutoAddScenario = computed(() => entry.value?.id === 'infornexus-auto-add')
const isTicketOwnerStatisticsScenario = computed(() => entry.value?.id === 'ticket-owner-statistics')
const isInfornexusDirectScenario = computed(() => isShippingScenario.value || isInfornexusAutoAddScenario.value)
const isMicrosoftScenario = computed(() => entry.value?.appId === 'microsoft-login-n8n-demo')
const requiresExcel = computed(() => entry.value?.requiresExcel !== false)
const microsoftWorkflowIcon = computed(() => requiresExcel.value ? 'upload' : 'file-search')
const microsoftWorkflowTitle = computed(() => requiresExcel.value ? '上传文件并执行' : '浏览器采集并生成 Excel')
const microsoftWorkflowHint = computed(() => requiresExcel.value ? 'Excel 直发本机执行器' : '从 SAP BTP Task Center 获取 ticket 信息')
const directRunButtonLabel = computed(() => requiresExcel.value ? '本地直连执行' : '开始统计 ticket 归属')
const pageScenarioClass = computed(() => { if (isMicrosoftScenario.value) return 'pg--ms'; if (isShippingScenario.value) return 'pg--ship'; if (isInfornexusAutoAddScenario.value) return 'pg--inf'; return 'pg--def' })
const heroIcon = computed(() => { if (isMicrosoftScenario.value) return 'zap'; if (isShippingScenario.value) return 'package'; if (isInfornexusAutoAddScenario.value) return 'globe-search'; return 'bot' })
const directExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); const p = String(entry.value?.directRunPath || '/api/run-login-file'); return b ? `${b}${p.startsWith('/') ? p : `/${p}`}` : '' })
const shippingExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-shipping-file` : '' })
const infornexusAutoAddExecutorRunUrl = computed(() => { const b = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-infornexus-auto-add-file` : '' })
const directScenarioTitle = computed(() => isInfornexusAutoAddScenario.value ? 'Infornexus 自动搜索添加' : '登录并打开 Shipment Scan')
const directScenarioExcelHint = computed(() => isInfornexusAutoAddScenario.value ? '请把 10 位 ID 放在第二列' : '请包含 PO No 列')
const directScenarioRunLabel = computed(() => isInfornexusAutoAddScenario.value ? '上传 Excel 并执行' : '上传万代 Excel 并执行 Shipping')
const artifactResultExcelLabel = computed(() => isTicketOwnerStatisticsScenario.value ? '下载 Ticket ownership Excel' : '下载结果 Excel')
const artifactResultExcelDownloadName = computed(() => isTicketOwnerStatisticsScenario.value ? 'Ticket ownership.xlsx' : 'shipping-last-result.xlsx')
const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorStatusLabel = computed(() => { if (activeApp.value) { const l = text(getAutomationAppStatusLabel(activeApp.value)); if (executorHealth.value?.ok) { const c = Number(executorHealth.value.activeRunCount || 0); return c > 0 ? `${l} / ${c} ${text('个任务')}` : `${l} / ${text('就绪')}` }; if (activeApp.value.running) return `${l} / ${text('未连通')}`; return l }; return executorHealth.value?.ok ? text('就绪') : text('未启动') })
const inlineStatusClass = computed(() => { if (sending.value) return 'pg-status--info'; if (lastResult.value?.ok) return 'pg-status--ok'; if (lastResult.value && !lastResult.value.ok) return 'pg-status--err'; return '' })
const statusIconName = computed(() => { if (sending.value) return 'loader'; if (lastResult.value?.ok) return 'check-circle'; if (lastResult.value && !lastResult.value.ok) return 'alert-circle'; return 'activity' })
const canLaunchActiveApp = computed(() => Boolean(entry.value?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)
const showLocalHelperPrompt = computed(() => !electronSupported && !launcherReachable.value)
const showTicketOwnerRunProgress = computed(() => isTicketOwnerStatisticsScenario.value && sending.value)
const hasStoredCredentials = computed(() => Boolean(executorCredentials.value?.hasStoredCredentials))
const savedCredentialUsername = computed(() => executorCredentials.value?.username || '')
const primaryTemplate = computed(() => automationTemplates.value[0] || null)
const templateButtonLabel = computed(() => { if (templateLoading.value) return text('模板加载中...'); return primaryTemplate.value ? text('下载 Excel 模板') : text('暂无模板') })
const activeUsername = computed(() => isInfornexusDirectScenario.value ? shippingUsername.value : microsoftUsername.value)
const activePassword = computed(() => isInfornexusDirectScenario.value ? shippingPassword.value : microsoftPassword.value)
const loginSiteName = computed(() => isMicrosoftScenario.value ? 'Microsoft / SAP BTP' : 'Infor Nexus')
const credentialStatusText = computed(() => { const sn = loginSiteName.value; return hasStoredCredentials.value ? `${text('已保存')} ${sn} ${text('登录账号')}: ${savedCredentialUsername.value}` : `${text('未保存')} ${sn} ${text('登录账号密码')}` })
const canRunShippingAutomation = computed(() => !sending.value)
const canRunDirectExecutor = computed(() => !sending.value)

onMounted(() => { void initializeScenario() })
onBeforeUnmount(() => { stopTicketOwnerProgress(); stopActiveRunStatePolling() })
async function initializeScenario(): Promise<void> {
  if (isShippingScenario.value) { shippingUsername.value = shippingUsername.value || DSU; shippingPassword.value = shippingPassword.value || DSP; statusLabel.value = '待命'; statusText.value = '等待上传万代 Excel 并执行 Shipping。' }
  else if (isInfornexusAutoAddScenario.value) { shippingUsername.value = shippingUsername.value || DSU; shippingPassword.value = shippingPassword.value || DSP; statusLabel.value = '待命'; statusText.value = '等待上传 Excel 并执行 Infornexus 自动搜索添加。' }
  else if (isMicrosoftScenario.value) { microsoftUsername.value = microsoftUsername.value || DMU; microsoftPassword.value = microsoftPassword.value || DMP; statusLabel.value = '待命'; statusText.value = isTicketOwnerStatisticsScenario.value ? '等待启动浏览器采集并生成 Ticket ownership Excel。' : '等待上传 Excel 并执行。' }
  await refreshAutomationTemplates(); await refreshExecutorCredentials(); await refreshExecutorState(true)
  if (electronSupported && shouldSyncActiveAppRuntime()) await startActiveApp(true, { forceUpdate: true })
}
async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry.value || refreshing.value) return
  refreshing.value = true
  const fb = createFallback(entry.value)
  try {
    const launcherHealth = electronSupported ? null : await probeLocalAutomationLauncherHealthPayload()
    launcherReachable.value = electronSupported ? true : Boolean(launcherHealth)
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
      clearRestoredActiveRunState()
      if (!silent) {
        messageTone.value = 'warning'
        message.value = text('未检测到本机自动化助手。')
      }
      return
    }
    executorHealth.value = await probeLocalExecutorHealth(entry.value.executorBaseUrl)
    if (!silent || !isExecutorBusy()) await refreshExecutorCredentials()
    if (activeApp.value) activeApp.value = { ...activeApp.value, running: true }
    syncActiveRunViewFromHealth()
    const launcherHelperVersion = String(launcherHealth?.helperVersion || launcherHealth?.version || '').trim()
    const updateMessage = getAutomationHelperUpdateMessage(executorHealth.value, activeApp.value, undefined, launcherHelperVersion)
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
    clearRestoredActiveRunState()
    if (!silent) {
      messageTone.value = 'warning'
      message.value = launcherReachable.value ? text('本机自动化助手已连接，执行器尚未启动。') : text('执行器未就绪。')
    }
  } finally {
    refreshing.value = false
  }
}
function syncActiveRunViewFromHealth(): void {
  const activeRun = findCurrentScenarioActiveRun()
  if (activeRun) {
    restoredActiveRun.value = true
    sending.value = true
    lastResult.value = null
    statusLabel.value = '执行中'
    statusText.value = buildActiveRunStatusText(activeRun)
    if (isTicketOwnerStatisticsScenario.value) {
      const hasRealProgress = applyTicketOwnerProgressFromRun(activeRun)
      if (!hasRealProgress && ticketOwnerProgressTimer === null) startTicketOwnerProgress()
    }
    if (!message.value) {
      messageTone.value = 'info'
      message.value = text('检测到当前自动化仍在后台运行，已恢复页面状态。')
    }
    startActiveRunStatePolling()
    return
  }
  if (!restoredActiveRun.value) {
    if (isTicketOwnerStatisticsScenario.value) applyCompletedRunFromHealth(false)
    return
  }
  if (applyCompletedRunFromHealth(true)) return
  clearRestoredActiveRunState()
  statusText.value = text('后台执行器任务已结束，请查看执行记录或重新开始。')
}
function applyCompletedRunFromHealth(autoDownload = true): boolean {
  const run = normalizeRunRecord(executorHealth.value?.lastRun)
  if (!run || !doesActiveRunBelongToCurrentScenario(run)) return false
  const resultUrl = readCompletedRunResultExcelUrl(run)
  const generatedRowCount = Number(run.generatedRowCount ?? run.ticketOwnerStatistics?.rowCount ?? 0)
  const failedTicketCount = Number(run.failedTicketCount ?? run.ticketOwnerStatistics?.failedTicketCount ?? 0)
  if (resultUrl) {
    shippingArtifactLinks.value = {
      resultExcelUrl: resultUrl,
      resultJsonUrl: readCompletedRunArtifactUrl(run, 'resultJsonUrl') || undefined,
      failedPoExcelUrl: readCompletedRunArtifactUrl(run, 'failedPoExcelUrl') || undefined,
      failedPoJsonUrl: readCompletedRunArtifactUrl(run, 'failedPoJsonUrl') || undefined,
      failedRowCount: failedTicketCount,
    }
  }
  restoredActiveRun.value = false
  sending.value = false
  stopTicketOwnerProgress(true)
  stopActiveRunStatePolling()
  statusLabel.value = generatedRowCount > 0 || resultUrl ? '成功' : '已结束'
  statusText.value = isTicketOwnerStatisticsScenario.value
    ? `已生成 ${generatedRowCount} 条 Ticket ownership 记录${failedTicketCount > 0 ? `，未获取 ${failedTicketCount} 条` : ''}。`
    : text('后台执行器任务已结束。')
  lastResult.value = { ok: Boolean(generatedRowCount > 0 || resultUrl), message: statusText.value }
  messageTone.value = generatedRowCount > 0 || resultUrl ? 'success' : 'info'
  message.value = resultUrl ? text('执行完成，Excel 已生成。') : text('后台执行器任务已结束。')
  if (autoDownload && isTicketOwnerStatisticsScenario.value && resultUrl) {
    autoDownloadTicketOwnerResult(resultUrl, buildCompletedRunDownloadKey(run, resultUrl))
  }
  return true
}
function clearRestoredActiveRunState(): void {
  if (!restoredActiveRun.value) return
  restoredActiveRun.value = false
  sending.value = false
  stopTicketOwnerProgress()
  stopActiveRunStatePolling()
  statusLabel.value = '待命'
}
function startActiveRunStatePolling(): void {
  if (activeRunStateTimer !== null) return
  activeRunStateTimer = window.setInterval(() => {
    void refreshExecutorState(true)
  }, 1500)
}
function stopActiveRunStatePolling(): void {
  if (activeRunStateTimer === null) return
  window.clearInterval(activeRunStateTimer)
  activeRunStateTimer = null
}
function findCurrentScenarioActiveRun(): Record<string, any> | null {
  const runs = collectActiveRuns(executorHealth.value)
  return runs.find(doesActiveRunBelongToCurrentScenario) || null
}
function collectActiveRuns(health: LocalExecutorHealth | null | undefined): Record<string, any>[] {
  const runs: Record<string, any>[] = []
  const activeRun = normalizeRunRecord(health?.activeRun)
  if (activeRun) runs.push(activeRun)
  if (Array.isArray(health?.activeRuns)) {
    for (const item of health.activeRuns) {
      const run = normalizeRunRecord(item)
      if (run) runs.push(run)
    }
  }
  return runs
}
function normalizeRunRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null
}
function doesActiveRunBelongToCurrentScenario(run: Record<string, any>): boolean {
  const scenarioId = String(entry.value?.id || '')
  const moduleId = String(run.moduleId || '').trim()
  const action = String(run.action || '').trim()
  const inputMode = String(run.inputMode || '').trim()
  if (moduleId && moduleId === scenarioId) return true
  if (scenarioId === 'ticket-owner-statistics') return moduleId === 'ticket-owner-statistics' || action === 'run-ticket-owner-statistics'
  if (scenarioId === 'microsoft-login-n8n') return moduleId === 'sap-btp-login'
  if (scenarioId === 'shipping-automation') return action === 'run-shipping-file' || action === 'open-shipment-scan'
  if (scenarioId === 'xinlongtai-shipping-automation') return action === 'run-xinlongtai-shipping-file'
  if (scenarioId === 'infornexus-auto-add') return action === 'run-infornexus-auto-add-file' || inputMode === 'infornexus-auto-add'
  if (scenarioId === 'shipping-automation-2') return inputMode === 'shipping2-bulk'
  return false
}
function buildActiveRunStatusText(run: Record<string, any>): string {
  const inputFileName = String(run.inputFileName || '').trim()
  const startedAt = String(run.startedAt || '').trim()
  if (isTicketOwnerStatisticsScenario.value) return formatTicketOwnerProgressText(getRunProgress(run)) || '正在统计 ticket 归属，请保持浏览器窗口打开；切换页面不会中断采集。'
  if (inputFileName) return `执行器仍在处理 ${inputFileName}，请勿重复启动。`
  if (startedAt) return `执行器任务仍在运行，开始时间 ${formatRunTime(startedAt)}。`
  return '执行器任务仍在运行，请勿重复启动。'
}
function getRunProgress(run: Record<string, any> | null | undefined): Record<string, any> | null {
  const progress = run?.progress
  return progress && typeof progress === 'object' ? progress as Record<string, any> : null
}
function applyTicketOwnerProgressFromRun(run: Record<string, any> | null | undefined): boolean {
  const progress = getRunProgress(run)
  if (!progress) return false
  if (ticketOwnerProgressTimer) {
    window.clearInterval(ticketOwnerProgressTimer)
    ticketOwnerProgressTimer = null
  }
  const percent = Number(progress.percent || 0)
  ticketOwnerProgressPercent.value = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0
  ticketOwnerProgressText.value = formatTicketOwnerProgressText(progress) || String(progress.message || '正在统计 ticket 归属')
  return true
}
function formatTicketOwnerProgressText(progress: Record<string, any> | null): string {
  if (!progress) return ''
  const message = String(progress.message || '正在统计 ticket 归属')
  const total = Number(progress.totalCount || 0)
  const completed = Number(progress.completedCount || 0)
  const failed = Number(progress.failedCount || 0)
  const attempted = Number(progress.attemptedCount || 0)
  const active = Number(progress.activeCount || 0)
  const pending = Number(progress.pendingCount || 0)
  const currentTickets = Array.isArray(progress.currentTickets)
    ? progress.currentTickets.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 3)
    : []
  const parts = [message]
  if (total > 0) parts.push(`已生成 ${completed}/${total}`)
  if (attempted > 0) parts.push(`已尝试 ${attempted}`)
  if (failed > 0) parts.push(`最终未获取 ${failed}`)
  if (active > 0) parts.push(`正在处理 ${active} 个${currentTickets.length ? `：${currentTickets.join('、')}` : ''}`)
  if (pending > 0) parts.push(`待处理 ${pending}`)
  return parts.join(' · ')
}
function formatRunTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
async function refreshExecutorCredentials(): Promise<void> {
  if (!entry.value) return
  try {
    executorCredentials.value = await fetchExecutorCredentials(entry.value.id)
    const u = executorCredentials.value.username || ''
    if (u && isInfornexusDirectScenario.value) shippingUsername.value = u
    if (u && isMicrosoftScenario.value) microsoftUsername.value = u
    if (executorCredentials.value.hasStoredCredentials && !credentialsHydrated.value) await fillStored()
    if (!executorCredentials.value.hasStoredCredentials) credentialsHydrated.value = false
  } catch {
    executorCredentials.value = null
    credentialsHydrated.value = false
  }
}
async function fillStored(): Promise<void> {
  if (!entry.value) return
  const r = await resolveAutomationCredentials(entry.value.id)
  if (isInfornexusDirectScenario.value) {
    shippingUsername.value = r.username
    shippingPassword.value = r.password
  } else if (isMicrosoftScenario.value) {
    microsoftUsername.value = r.username
    microsoftPassword.value = r.password
  }
  credentialsHydrated.value = true
}
async function refreshAutomationTemplates(): Promise<void> { if (!entry.value) return; templateLoading.value = true; try { automationTemplates.value = await fetchAutomationTemplates(entry.value.id) } catch { automationTemplates.value = [] } finally { templateLoading.value = false } }
async function downloadPrimaryTemplate(): Promise<void> { try { await downloadAutomationTemplate(primaryTemplate.value); messageTone.value = 'success'; message.value = text('模板下载已开始。') } catch (e) { const m = readErrorMessage(e, text('模板下载失败。')); messageTone.value = 'warning'; message.value = m; void showAppAlert(m, { tone: 'warning' }) } }
function downloadAutomationHelper(): void { void openAutomationHelperDownload() }
function bootLocalHelper(): void { primeLocalAutomationLauncherBoot(); messageTone.value = 'info'; message.value = text('已尝试启动本机自动化助手。'); window.setTimeout(() => { void refreshExecutorState(true) }, 1200) }
async function saveCurrentCredentials(): Promise<void> { if (!entry.value || credentialSaving.value) return; const u = activeUsername.value.trim(); const p = activePassword.value; if (!u || !p) { messageTone.value = 'warning'; message.value = text('请先填写账号和密码。'); return }; credentialSaving.value = true; try { executorCredentials.value = await saveExecutorCredentials(entry.value.id, u, p); credentialsHydrated.value = true; await refreshExecutorCredentials(); if (isInfornexusDirectScenario.value) { shippingUsername.value = executorCredentials.value.username || u; shippingPassword.value = p } else if (isMicrosoftScenario.value) { microsoftUsername.value = executorCredentials.value.username || u; microsoftPassword.value = p }; messageTone.value = 'success'; message.value = text('已保存。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('保存失败。')) } finally { credentialSaving.value = false } }
async function clearCurrentCredentials(): Promise<void> { if (!entry.value || credentialClearing.value) return; credentialClearing.value = true; try { executorCredentials.value = await clearExecutorCredentials(entry.value.id); credentialsHydrated.value = false; messageTone.value = 'info'; message.value = text('已清除。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('清除失败。')) } finally { credentialClearing.value = false } }
async function startActiveApp(silent: boolean, options: { forceUpdate?: boolean } = {}): Promise<void> { if (!entry.value || launching.value) return; if (!electronSupported && !launcherReachable.value) primeLocalAutomationLauncherBoot(); launching.value = true; try { const forceUpdate = options.forceUpdate !== false; const r = await launchAutomationConsole(entry.value.appId, { forceUpdate }); if (!r.success) throw new Error(r.error || '启动失败'); await refreshExecutorState(true); if (!silent) { messageTone.value = 'success'; message.value = forceUpdate ? text('已同步最新自动化逻辑。') : r.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。') } } catch (e) { const m = readErrorMessage(e, text('启动失败')); await recordWebAutomationEvent('launch-exception', { appId: entry.value.appId, entryId: entry.value.id, forceUpdate: options.forceUpdate !== false, error: m }); if (!silent) { messageTone.value = 'error'; message.value = m } } finally { launching.value = false } }
async function stopActiveApp(): Promise<void> { if (!entry.value) return; try { const r = await stopAutomationConsole(entry.value.appId); if (!r.success) throw new Error(r.error || '停止失败'); executorHealth.value = null; clearRestoredActiveRunState(); if (activeApp.value) activeApp.value = { ...activeApp.value, running: false }; await refreshExecutorState(true).catch(() => {}); messageTone.value = 'info'; message.value = text('执行器已停止。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('停止失败')) } }
function handleFileSelect(e: Event): void { const f = getExcelFile((e.target as HTMLInputElement).files); if (f) setSelectedFile(f) }
function handleDragEnter(e: DragEvent): void { if (!hasDraggedFiles(e) || isInternalDragMove(e)) return; dragDepth.value += 1; isDragging.value = true }
function handleDragOver(e: DragEvent): void { if (!hasDraggedFiles(e)) return; if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; isDragging.value = true }
function handleDragLeave(e: DragEvent): void { if (isInternalDragMove(e)) return; dragDepth.value = Math.max(0, dragDepth.value - 1); if (dragDepth.value === 0) isDragging.value = false }
function handleDrop(e: DragEvent): void { resetDragging(); const f = getExcelFile(e.dataTransfer?.files); if (f) setSelectedFile(f) }
function openFilePicker(): void { fileInput.value?.click() }
function clearFile(): void { selectedFile.value = null; resetDragging(); if (fileInput.value) fileInput.value.value = '' }
function openTicketReleaseFilePicker(): void { ticketReleaseFileInput.value?.click() }
function openTicketFactoryPriceFilePicker(): void { ticketFactoryPriceFileInput.value?.click() }
function handleTicketReleaseFileSelect(e: Event): void { const f = getExcelFile((e.target as HTMLInputElement).files); if (f) ticketReleaseFile.value = f; if (ticketReleaseFileInput.value) ticketReleaseFileInput.value.value = '' }
function handleTicketFactoryPriceFileSelect(e: Event): void { const f = getExcelFile((e.target as HTMLInputElement).files); if (f) ticketFactoryPriceFile.value = f; if (ticketFactoryPriceFileInput.value) ticketFactoryPriceFileInput.value.value = '' }
function clearTicketReleaseFile(): void { ticketReleaseFile.value = null; if (ticketReleaseFileInput.value) ticketReleaseFileInput.value.value = '' }
function clearTicketFactoryPriceFile(): void { ticketFactoryPriceFile.value = null; if (ticketFactoryPriceFileInput.value) ticketFactoryPriceFileInput.value.value = '' }
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
async function createBackendRunRecord(f: File | null = null): Promise<AutomationRunRecord | null> { if (!entry.value) return null; return createAutomationRunRecord(entry.value.id, f, entry.value.title) }
async function finishBackendRunRecord(r: AutomationRunRecord | null, ok: boolean, msg: string, p: Record<string, any> | null): Promise<AutomationRunFileRecord[]> {
  if (!r?.runId) return []
  const payload = await finishAutomationRunRecord(r.runId, ok ? 'success' : 'failed', msg || (ok ? 'completed' : 'failed'), p, collectResultFiles(p))
  await applyPersistedArtifactLinks(payload.files)
  return payload.files
}
function collectResultFiles(p: Record<string, any> | null): AutomationRunFileInput[] {
  const u = p?.artifacts?.downloadUrls
  if (!u || typeof u !== 'object') return []
  const resultExcelName = isTicketOwnerStatisticsScenario.value ? 'Ticket ownership.xlsx' : 'shipping-last-result.xlsx'
  const resultJsonName = isTicketOwnerStatisticsScenario.value ? 'ticket-ownership-result.json' : 'shipping-last-result.json'
  return [
    bfi(u.resultExcelUrl, 'result_excel', resultExcelName),
    bfi(u.resultJsonUrl, 'result_json', resultJsonName),
    bfi(u.failedPoExcelUrl, 'failed_rows_excel', 'shipping-last-failed-po-rows.xlsx'),
    bfi(u.failedPoJsonUrl, 'failed_rows_json', 'shipping-last-failed-po-rows.json'),
  ].filter((x): x is AutomationRunFileInput => Boolean(x))
}
function bfi(rp: string, fr: string, fn: string): AutomationRunFileInput | null {
  const u = buildShippingArtifactUrl(rp)
  if (!u) return null
  return {
    url: u,
    fileRole: fr,
    fileName: fn,
    contentType: fn.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/json; charset=utf-8',
  }
}
async function applyPersistedArtifactLinks(files: AutomationRunFileRecord[]): Promise<void> {
  if (!shippingArtifactLinks.value || files.length === 0) return
  const byRole = new Map(files.map((file) => [file.fileRole, file]))
  const resultExcel = byRole.get('result_excel')
  const resultJson = byRole.get('result_json')
  const failedExcel = byRole.get('failed_rows_excel')
  const failedJson = byRole.get('failed_rows_json')
  shippingArtifactLinks.value = {
    ...shippingArtifactLinks.value,
    resultExcelUrl: resultExcel ? await buildAutomationRunFileDownloadUrl(resultExcel) : shippingArtifactLinks.value.resultExcelUrl,
    resultJsonUrl: resultJson ? await buildAutomationRunFileDownloadUrl(resultJson) : shippingArtifactLinks.value.resultJsonUrl,
    failedPoExcelUrl: failedExcel ? await buildAutomationRunFileDownloadUrl(failedExcel) : shippingArtifactLinks.value.failedPoExcelUrl,
    failedPoJsonUrl: failedJson ? await buildAutomationRunFileDownloadUrl(failedJson) : shippingArtifactLinks.value.failedPoJsonUrl,
  }
}
function showRunRequirementDialog(rawMessage: string): false { const localized = text(rawMessage); messageTone.value = 'warning'; message.value = localized; statusLabel.value = '待命'; statusText.value = localized; lastResult.value = { ok: false, message: localized }; void showAppAlert(localized, { tone: 'warning' }); return false }
function validateStoredOrTypedCredentials(username: string, password: string, siteName: string): boolean { const u = username.trim(); const p = password.trim(); if (p && !u) return showRunRequirementDialog(`请先填写 ${siteName} 登录账号。`); if (!p && !hasStoredCredentials.value) return showRunRequirementDialog(`请先填写并保存 ${siteName} 登录账号密码。`); return true }
function validateShippingInputs(): boolean { if (!entry.value || !isShippingScenario.value) return showRunRequirementDialog('当前入口不存在，请返回自动化入口页重新进入。'); if (!selectedFile.value) return showRunRequirementDialog('请先上传 Excel 文件，文件需包含 PO No 列。'); return validateStoredOrTypedCredentials(shippingUsername.value, shippingPassword.value, 'Infor Nexus') }
function validateAutoAddInputs(): boolean { if (!entry.value || !isInfornexusAutoAddScenario.value) return showRunRequirementDialog('当前入口不存在，请返回自动化入口页重新进入。'); if (!selectedFile.value) return showRunRequirementDialog('请先上传 Excel 文件，请把 10 位 ID 放在第二列。'); return validateStoredOrTypedCredentials(shippingUsername.value, shippingPassword.value, 'Infor Nexus') }
function validateDirectExecutorInputs(): boolean { if (!entry.value) return showRunRequirementDialog('当前入口不存在，请返回自动化入口页重新进入。'); if (requiresExcel.value && !selectedFile.value) return showRunRequirementDialog('请先上传 Excel 文件。'); if (isMicrosoftScenario.value) return validateStoredOrTypedCredentials(microsoftUsername.value, microsoftPassword.value, 'Microsoft'); return true }
function startTicketOwnerProgress(): void {
  if (!isTicketOwnerStatisticsScenario.value) return
  stopTicketOwnerProgress()
  const stages = [
    { at: 8, text: '正在启动浏览器并检查登录状态...' },
    { at: 18, text: '正在打开 SAP Task Center 并设置筛选条件...' },
    { at: 34, text: '正在读取 ticket 列表，准备逐条打开详情...' },
    { at: 56, text: '正在循环处理 ticket，Claim 后打开详情页采集字段...' },
    { at: 78, text: '正在按 A/B/C 规则补全字段和可选辅助 Excel...' },
    { at: 92, text: '正在整理结果并生成 Ticket ownership Excel...' },
  ]
  ticketOwnerProgressPercent.value = stages[0].at
  ticketOwnerProgressText.value = stages[0].text
  ticketOwnerProgressTimer = window.setInterval(() => {
    const nextPercent = Math.min(94, ticketOwnerProgressPercent.value + (ticketOwnerProgressPercent.value < 60 ? 2 : 1))
    ticketOwnerProgressPercent.value = nextPercent
    const currentStage = [...stages].reverse().find((stage) => nextPercent >= stage.at) || stages[0]
    ticketOwnerProgressText.value = currentStage.text
  }, 1800)
}
function stopTicketOwnerProgress(done = false): void {
  if (ticketOwnerProgressTimer) {
    window.clearInterval(ticketOwnerProgressTimer)
    ticketOwnerProgressTimer = null
  }
  if (done) {
    ticketOwnerProgressPercent.value = 100
    ticketOwnerProgressText.value = 'Ticket ownership Excel 已生成。'
    return
  }
  ticketOwnerProgressPercent.value = 0
  ticketOwnerProgressText.value = ''
}
async function runInfornexusDirectWithExcel(): Promise<void> { if (isInfornexusAutoAddScenario.value) { await runInfornexusAutoAdd(); return }; await runShipping() }
async function runShipping(): Promise<void> { if (sending.value) return; if (!validateShippingInputs()) return; if (!(await ensureReady())) { setNotReady(); void showAppAlert(statusText.value, { tone: 'warning' }); return }; const file = selectedFile.value as File; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; shippingArtifactLinks.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const { res, raw, j } = await postExecutorWithModuleRetry(shippingExecutorRunUrl.value, { fileName: file.name, fileBase64: fb64, token: entry.value?.localExecutorToken || '', headless: !showBrowserView.value, ...cp }); lastRawResponse.value = raw; updateShippingArtifactLinks(j); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { const m = buildExecutorResponseMessage(res, raw, j); if (shouldShowAutomationErrorDialog(j?.message || m)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }; if (!j) throw new Error('无法解析响应。'); if (j?.ok && j?.shipmentScanOpened) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedPoCount ?? 0}/${j.totalPoCount ?? '?'} 个 PO。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { const m = formatAutomationExecutorMessage(readErrorMessage(e, '网络错误'), '自动化执行异常。'); statusLabel.value = '异常'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function runInfornexusAutoAdd(): Promise<void> { if (sending.value) return; if (!validateAutoAddInputs()) return; if (!(await ensureReady())) { setNotReady(); void showAppAlert(statusText.value, { tone: 'warning' }); return }; const file = selectedFile.value as File; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const { res, raw, j } = await postExecutorWithModuleRetry(infornexusAutoAddExecutorRunUrl.value, { fileName: file.name, fileBase64: fb64, token: entry.value?.localExecutorToken || '', headless: !showBrowserView.value, ...cp }); lastRawResponse.value = raw; await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { const m = buildExecutorResponseMessage(res, raw, j); if (shouldShowAutomationErrorDialog(j?.message || m)) showAutomationErrorDialog(m); statusLabel.value = '失败'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m; return }; if (!j) throw new Error('无法解析响应。'); if (j?.ok) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedIdCount ?? 0}/${j.totalIdCount ?? '?'} 个 ID。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { const m = formatAutomationExecutorMessage(readErrorMessage(e, '网络错误'), '自动化执行异常。'); statusLabel.value = '异常'; statusText.value = m; lastResult.value = { ok: false, message: m }; messageTone.value = 'error'; message.value = m } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function sendDirectToExecutor(): Promise<void> {
  if (sending.value) return
  if (!validateDirectExecutorInputs()) return
  if (!(await ensureReady())) {
    setNotReady()
    void showAppAlert(statusText.value, { tone: 'warning' })
    return
  }
  const file = selectedFile.value
  sending.value = true
  statusLabel.value = '执行中'
  statusText.value = isTicketOwnerStatisticsScenario.value ? '正在打开 SAP BTP 并采集 ticket 信息...' : '正在执行...'
  lastResult.value = null
  shippingArtifactLinks.value = null
  autoDownloadedArtifactKey.value = ''
  lastRawResponse.value = ''
  message.value = ''
  startTicketOwnerProgress()
  try {
    const rr = await createBackendRunRecord(file ?? null)
    const cp = isMicrosoftScenario.value ? await resolveRunCredentialsPayload(microsoftUsername.value, microsoftPassword.value) : {}
    const requestBody: Record<string, unknown> = { token: entry.value?.localExecutorToken || '', headless: !showBrowserView.value, ...cp }
    if (file) {
      requestBody.fileName = file.name
      requestBody.fileBase64 = await fileToBase64(file)
    }
    if (isTicketOwnerStatisticsScenario.value) await appendTicketOwnerLookupFiles(requestBody)
    const { res, raw, j } = await postExecutorWithModuleRetry(directExecutorRunUrl.value, requestBody)
    lastRawResponse.value = raw
    updateShippingArtifactLinks(j)
    await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j)
    if (!res.ok) {
      const m = buildExecutorResponseMessage(res, raw, j)
      if (shouldShowAutomationErrorDialog(j?.message || m)) showAutomationErrorDialog(m)
      statusLabel.value = '失败'
      statusText.value = m
      lastResult.value = { ok: false, message: m }
      messageTone.value = 'error'
      message.value = m
      return
    }
    if (!j) throw new Error('无法解析响应。')
    if (j.loginSuccess && j.ok !== false) {
      const rowCount = Number(j.ticketOwnerStatistics?.rowCount ?? 0)
      statusLabel.value = '成功'
      statusText.value = isTicketOwnerStatisticsScenario.value ? `已生成 ${rowCount} 条 Ticket ownership 记录。` : `已处理 ${j.uploadedRowCount ?? '?'} 行。`
      lastResult.value = { ok: true, message: j.message }
      messageTone.value = 'success'
      message.value = text('执行完成。')
      const currentArtifacts = shippingArtifactLinks.value as SAL | null
      const resultExcelUrl = currentArtifacts?.resultExcelUrl || ''
      if (isTicketOwnerStatisticsScenario.value && resultExcelUrl) {
        stopTicketOwnerProgress(true)
        autoDownloadTicketOwnerResult(resultExcelUrl, buildResponseDownloadKey(j, resultExcelUrl))
      }
    } else {
      statusLabel.value = '未完成'
      statusText.value = j.message || '未确认成功。'
      lastResult.value = { ok: false, message: j.message }
      messageTone.value = 'warning'
      message.value = text('已触发，未确认。')
    }
  } catch (e) {
    const m = formatAutomationExecutorMessage(readErrorMessage(e, '网络错误'), '自动化执行异常。')
    statusLabel.value = '异常'
    statusText.value = m
    lastResult.value = { ok: false, message: m }
    messageTone.value = 'error'
    message.value = m
  } finally {
    if (!lastResult.value?.ok) stopTicketOwnerProgress()
    sending.value = false
    await refreshExecutorState(true).catch(() => {})
  }
}
function setNotReady(): void { statusLabel.value = '未就绪'; statusText.value = '本机执行器尚未就绪。'; lastResult.value = { ok: false, message: 'Executor is not ready.' }; messageTone.value = 'warning'; message.value = text('本机执行器未就绪。') }
function isExecutorBusy(): boolean {
  return Boolean(executorHealth.value?.busy || executorHealth.value?.activeRun || (Array.isArray(executorHealth.value?.activeRuns) && executorHealth.value.activeRuns.length > 0) || Number(executorHealth.value?.activeRunCount || 0) > 0)
}
function shouldSyncActiveAppRuntime(): boolean {
  return Boolean(entry.value && activeApp.value?.available && !isExecutorBusy())
}
async function ensureReady(): Promise<boolean> {
  if (shouldSyncActiveAppRuntime()) {
    statusText.value = '正在检查并同步最新自动化逻辑...'
    await startActiveApp(true, { forceUpdate: true })
  } else if (!executorHealth.value?.ok) {
    await startActiveApp(true)
  }
  await refreshExecutorState(true).catch(() => {})
  return Boolean(executorHealth.value?.ok)
}
async function postExecutorWithModuleRetry(url: string, requestBody: Record<string, unknown>): Promise<{ res: Response; raw: string; j: Record<string, any> | null }> {
  let result = await postExecutorJson(url, requestBody)
  if (shouldRetryAfterMissingExecutorRoute(result.res, result.raw, result.j)) {
    statusText.value = '执行器缺少当前自动化逻辑，正在同步最新模块后重试...'
    await startActiveApp(true, { forceUpdate: true })
    await refreshExecutorState(true).catch(() => {})
    result = await postExecutorJson(url, requestBody)
  }
  return result
}
async function postExecutorJson(url: string, requestBody: Record<string, unknown>): Promise<{ res: Response; raw: string; j: Record<string, any> | null }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value?.localExecutorToken || '' }, body: JSON.stringify(requestBody) })
  const raw = await res.text()
  return { res, raw, j: safeParseJson(raw) }
}
async function appendTicketOwnerLookupFiles(requestBody: Record<string, unknown>): Promise<void> {
  if (ticketReleaseFile.value) {
    requestBody.releaseLookupFileName = ticketReleaseFile.value.name
    requestBody.releaseLookupFileBase64 = await fileToBase64(ticketReleaseFile.value)
  }
  if (ticketFactoryPriceFile.value) {
    requestBody.factoryPriceFileName = ticketFactoryPriceFile.value.name
    requestBody.factoryPriceFileBase64 = await fileToBase64(ticketFactoryPriceFile.value)
  }
}
function shouldRetryAfterMissingExecutorRoute(res: Response, raw: string, payload: Record<string, any> | null): boolean {
  const message = String(payload?.message || raw || '').trim()
  return res.status === 404 && /not\s*found/i.test(message)
}
async function fileToBase64(f: File): Promise<string> { const b = await f.arrayBuffer(); return arrayBufferToBase64(b) }
function arrayBufferToBase64(b: ArrayBuffer): string { const bytes = new Uint8Array(b); const cs = 0x8000; let bin = ''; for (let i = 0; i < bytes.length; i += cs) { const chunk = bytes.subarray(i, i + cs); bin += String.fromCharCode(...chunk) }; return window.btoa(bin) }
function safeParseJson(r: string): Record<string, any> | null { try { return r ? JSON.parse(r) : null } catch { return null } }
function buildExecutorResponseMessage(res: Response, raw: string, payload: Record<string, any> | null, fallback = '自动化执行失败。'): string { const rawMessage = typeof payload?.message === 'string' ? payload.message : ''; if (res.status === 404 && /not\s*found/i.test(rawMessage || raw || '')) return '本机执行器缺少当前自动化接口，系统已尝试同步最新自动化逻辑但接口仍不可用。请确认小助手支持自动化模块热更新，并检查服务器 automation-modules 模块包是否已发布。'; if (rawMessage) return formatAutomationExecutorMessage(rawMessage, fallback); if (!payload) return formatAutomationExecutorMessage('JSON.parse: unexpected character at line 1 column 1 of the JSON data', fallback); return formatAutomationExecutorMessage(`HTTP ${res.status}`, fallback) }
function updateShippingArtifactLinks(p: Record<string, any> | null): void {
  if (!isShippingScenario.value && !isTicketOwnerStatisticsScenario.value) {
    shippingArtifactLinks.value = null
    return
  }
  const u = p?.artifacts?.downloadUrls
  const re = buildShippingArtifactUrl(u?.resultExcelUrl) || buildTicketOwnerArtifactUrlFromPath(p?.artifacts?.resultExcelPath || p?.resultExcelPath)
  if (!re) {
    shippingArtifactLinks.value = null
    return
  }
  shippingArtifactLinks.value = {
    resultExcelUrl: re,
    resultJsonUrl: buildShippingArtifactUrl(u?.resultJsonUrl) || undefined,
    failedPoExcelUrl: buildShippingArtifactUrl(u?.failedPoExcelUrl) || undefined,
    failedPoJsonUrl: buildShippingArtifactUrl(u?.failedPoJsonUrl) || undefined,
    failedRowCount: Number(p?.artifacts?.failedRowCount ?? p?.ticketOwnerStatistics?.failedTicketCount ?? 0),
  }
}
function readCompletedRunResultExcelUrl(run: Record<string, any>): string {
  return readCompletedRunArtifactUrl(run, 'resultExcelUrl')
    || buildTicketOwnerArtifactUrlFromPath(run.resultExcelPath || run.artifacts?.resultExcelPath)
}
function readCompletedRunArtifactUrl(run: Record<string, any>, key: string): string {
  return buildShippingArtifactUrl(run.artifacts?.downloadUrls?.[key])
}
function buildTicketOwnerArtifactUrlFromPath(filePath: unknown): string {
  const name = String(filePath || '').trim().split(/[\\/]/).filter(Boolean).pop() || ''
  return name ? buildShippingArtifactUrl(`/artifacts/${name}`) : ''
}
function buildCompletedRunDownloadKey(run: Record<string, any>, url: string): string {
  return String(run.finishedAt || run.startedAt || run.resultExcelPath || url)
}
function buildResponseDownloadKey(payload: Record<string, any>, url: string): string {
  return String(payload.artifacts?.runId || payload.generatedAt || payload.artifacts?.resultExcelPath || url)
}
function autoDownloadTicketOwnerResult(url: string | undefined, key: string): void {
  if (!url || autoDownloadedArtifactKey.value === key) return
  autoDownloadedArtifactKey.value = key
  window.setTimeout(() => { void downloadShippingArtifact(url, artifactResultExcelDownloadName.value) }, 120)
}
function buildShippingArtifactUrl(rp: unknown): string {
  const np = String(rp || '').trim()
  if (!np) return ''
  if (/^https?:\/\//i.test(np)) return np
  const bu = String(entry.value?.executorBaseUrl || '').replace(/\/+$/, '')
  return bu ? `${bu}${np.startsWith('/') ? np : `/${np}`}` : ''
}
async function downloadShippingArtifact(u: string | undefined, fn: string): Promise<void> {
  if (!u) return
  if (isPersistedRunFileDownloadUrl(u)) {
    try {
      await downloadUrlAsFile(u, fn)
    } catch (e) {
      const m = readErrorMessage(e, '文件下载失败。')
      messageTone.value = 'warning'
      message.value = m
      void showAppAlert(m, { tone: 'warning' })
    }
    return
  }
  const a = document.createElement('a')
  a.href = u
  a.download = fn
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
}
function isPersistedRunFileDownloadUrl(url: string): boolean {
  return /\/api\/automation\/run-files\/\d+\/download(?:[?#].*)?$/i.test(url)
}
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
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, 260px); gap: 14px;
  align-items: start;
  flex: 1; min-height: 0; min-width: 0;
}
.sa-left { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }

/* ═══ MAIN CARD ═══ */
.sa-card {
  min-width: 0;
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

.sa-lookup-files { display: flex; flex-direction: column; gap: 10px; }
.sa-lookup-file {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--br); border-radius: 10px;
  background: #f8fafc;
  &__input { display: none; }
  &__icon { color: var(--a); flex-shrink: 0; }
  &__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  b { font-size: 12px; color: var(--ink); }
  small { font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

.sa-progress {
  margin: 0 20px 12px; padding: 10px 12px;
  border: 1px solid #bae6fd; border-radius: 10px; background: #f0f9ff;
  &__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; font-size: 11px; color: #075985; }
  &__head span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__head b { flex-shrink: 0; font-size: 11px; color: #0369a1; }
  &__track { height: 7px; border-radius: 999px; overflow: hidden; background: #dbeafe; }
  &__track span { display: block; height: 100%; border-radius: inherit; background: #0ea5e9; transition: width .35s ease; }
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
  min-width: 0; min-height: 0; align-self: start;
  animation: sa-slideIn .45s cubic-bezier(.22,1,.36,1) .12s both;
}
.sa-dock > * { min-width: 0; }
.sa-dock :deep(.run-history-trigger) { width: 100%; min-height: 54px; }
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
@media (max-width: 1200px) {
  .sa { padding-inline: 16px; }
  .sa-body { grid-template-columns: minmax(0, 1fr) minmax(210px, 230px); }
  .sa-dock__bd { padding: 10px 12px; }
}

@media (max-width: 960px) {
  .sa { height: auto; min-height: 100%; padding-inline: 14px; }
  .sa-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: start;
    flex: 0 0 auto;
  }
  .sa-dock {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
  }
  .sa-dock-card { min-height: 0; }
  .sa-dock-card--flex { flex: initial; }
  .sa-dock :deep(.run-history-trigger) { height: 100%; min-height: 72px; }
  .sa-cred-grid { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .sa-hd { align-items: flex-start; flex-wrap: wrap; }
  .sa-hd__left { min-width: 0; flex: 1 1 100%; }
  .sa-hd__right { width: 100%; justify-content: flex-start; flex-wrap: wrap; }
  .sa-card__hd { align-items: flex-start; padding: 14px 16px; }
  .sa-card__bd { padding: 12px 16px; }
  .sa-card__ft { padding: 0 16px 14px; }
  .sa-cred-note { margin: 10px 16px 0; align-items: flex-start; line-height: 1.45; }
  .sa-lookup-file { flex-wrap: wrap; align-items: flex-start; }
  .sa-lookup-file .sa-btn { margin-left: auto; }
  .sa-dock { grid-template-columns: 1fr; }
  .sa-dock :deep(.run-history-trigger) { height: auto; min-height: 56px; }
}

@media (max-width: 520px) {
  .sa { gap: 10px; padding: 0 10px 12px; }
  .sa-hd__icon { width: 36px; height: 36px; border-radius: 12px; }
  .sa-hd__text h1 { font-size: 14px; }
  .sa-pill,
  .sa-tag { max-width: 100%; }
  .sa-card__hd { padding: 12px; }
  .sa-card__bd { padding: 12px; }
  .sa-card__ft { padding: 0 12px 12px; }
  .sa-cred-note,
  .sa-status,
  .sa-progress { margin-inline: 12px; }
  .sa-cred-row .sa-btn { flex: 1 1 130px; }
  .sa-btn { min-width: 0; white-space: normal; line-height: 1.2; }
  .sa-btn-grid { flex-direction: column; }
  .sa-btn-grid .sa-btn { width: 100%; }
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
