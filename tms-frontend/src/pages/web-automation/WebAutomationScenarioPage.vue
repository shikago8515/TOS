<template>
  <div class="pg" :class="pageScenarioClass">
    <header class="pg-top">
      <button class="pg-back" @click="goBack"><AppIcon name="arrow-left" /><span>{{ text('返回') }}</span></button>
      <div class="pg-top__right">
        <span class="pg-dot" :class="executorHealth?.ok ? 'pg-dot--on' : 'pg-dot--off'" />
        <span class="pg-top__st">{{ executorHealth?.ok ? text('执行器就绪') : text('执行器未连接') }}</span>
      </div>
    </header>

    <transition name="pg-fade">
      <div v-if="message" class="pg-alert" :class="`pg-alert--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'info'" />
        <span>{{ text(message) }}</span>
        <button class="pg-alert__x" @click="message = ''"><AppIcon name="stop-circle" /></button>
      </div>
    </transition>

    <div v-if="!entry" class="pg-empty">
      <AppIcon name="alert-circle" class="pg-empty__icon" />
      <strong>{{ text('入口不存在') }}</strong>
      <button class="pg-back" @click="goBack"><AppIcon name="arrow-left" />{{ text('返回') }}</button>
    </div>

    <template v-else>
      <div class="pg-hero">
        <div class="pg-hero__icon"><AppIcon :name="heroIcon" /></div>
        <div class="pg-hero__text"><h1>{{ text(entry.title) }}</h1><p>{{ text(entry.subtitle) }}</p></div>
      </div>

      <div class="pg-main">
        <!-- ===== LEFT SIDEBAR ===== -->
        <aside class="pg-side">
          <div class="pg-card">
            <div class="pg-card__hd"><AppIcon name="server" class="pg-card__hd-ic" /><span>{{ text('执行器控制') }}</span></div>
            <div class="pg-card__bd pg-acts">
              <button class="pg-btn pg-btn--pri" :disabled="!canLaunchActiveApp" @click="startActiveApp(false)"><AppIcon name="play-circle" />{{ launching ? text('启动中...') : text('启动执行器') }}</button>
              <button class="pg-btn pg-btn--danger" :disabled="!canStopActiveApp" @click="stopActiveApp"><AppIcon name="stop-circle" />{{ text('停止') }}</button>
              <button class="pg-btn" :disabled="refreshing" @click="refreshExecutorState(false)"><AppIcon name="refresh-cw" :class="{ 'pg-spin': refreshing }" />{{ text('刷新状态') }}</button>
            </div>
          </div>

          <div class="pg-card">
            <div class="pg-card__hd"><AppIcon name="workflow" class="pg-card__hd-ic" /><span>{{ text('操作流程') }}</span></div>
            <div class="pg-card__bd pg-steps">
              <template v-if="isShippingScenario">
                <div v-for="(s,i) in shippingSteps" :key="i" class="pg-step"><b class="pg-step__n">{{ i+1 }}</b><div><em>{{ text(s.title) }}</em><small>{{ text(s.desc) }}</small></div></div>
              </template>
              <template v-else-if="isInfornexusAutoAddScenario">
                <div v-for="(s,i) in infornexusAutoAddSteps" :key="i" class="pg-step"><b class="pg-step__n">{{ i+1 }}</b><div><em>{{ text(s.title) }}</em><small>{{ text(s.desc) }}</small></div></div>
              </template>
              <template v-else>
                <div v-for="(s,i) in defaultSteps" :key="i" class="pg-step"><b class="pg-step__n">{{ i+1 }}</b><div><em>{{ text(s.title) }}</em><small>{{ text(s.desc) }}</small></div></div>
              </template>
            </div>
          </div>

          <details class="pg-card pg-detail">
            <summary class="pg-detail__sum"><AppIcon name="terminal" /><span>{{ text('执行器健康信息') }}</span><AppIcon name="chevron-down" class="pg-chev" /></summary>
            <pre class="pg-detail__pre">{{ healthRaw }}</pre>
          </details>
        </aside>

        <!-- ===== RIGHT STAGE ===== -->
        <section class="pg-stage">
          <transition name="pg-fade">
            <div v-if="showLocalHelperPrompt" class="pg-banner">
              <AppIcon name="monitor-code" class="pg-banner__ic" />
              <div class="pg-banner__bd"><strong>{{ text('未检测到本机自动化助手') }}</strong><p>{{ text('请先启动 TOS 自动化助手，然后重新检测。') }}</p></div>
              <div class="pg-banner__btns">
                <button class="pg-btn pg-btn--pri" @click="downloadAutomationHelper"><AppIcon name="download" />{{ text('下载助手') }}</button>
                <button class="pg-btn" @click="bootLocalHelper"><AppIcon name="play-circle" />{{ text('启动助手') }}</button>
                <button class="pg-btn" :disabled="refreshing" @click="refreshExecutorState(false)"><AppIcon name="refresh-cw" />{{ text('重新检测') }}</button>
              </div>
            </div>
          </transition>

          <!-- ===== INFORNEXUS DIRECT ===== -->
          <div v-if="isInfornexusDirectScenario" class="pg-card pg-card--accent">
            <div class="pg-card__hd pg-card__hd--lg">
              <AppIcon :name="isInfornexusAutoAddScenario ? 'globe-search' : 'play-circle'" class="pg-card__hd-ic" />
              <span>{{ text(directScenarioTitle) }}</span>
              <span v-if="executorHealth?.ok" class="pg-chip pg-chip--ok">{{ text('就绪') }}</span>
              <span v-else class="pg-chip pg-chip--warn">{{ text('等待执行器') }}</span>
            </div>

            <div v-if="hasStoredCredentials" class="pg-note pg-note--ok"><AppIcon name="check-circle" />{{ credentialStatusText }}</div>

            <div class="pg-card__bd">
              <div class="pg-grid-2">
                <label class="pg-field"><span>{{ text('User ID') }}</span><input v-model.trim="shippingUsername" type="text" class="pg-inp" :placeholder="text('请输入 User ID')" autocomplete="username" /></label>
                <label class="pg-field"><span>{{ text('Password') }}</span><span class="pg-inp-wrap"><input v-model="shippingPassword" :type="showShippingPassword ? 'text' : 'password'" class="pg-inp" placeholder="Enter password" autocomplete="current-password" /><button class="pg-inp__btn" @click="showShippingPassword = !showShippingPassword"><AppIcon name="eye" /></button></span></label>
              </div>
              <div class="pg-row">
                <button class="pg-btn pg-btn--pri" :disabled="credentialSaving || !shippingUsername || !shippingPassword" @click="saveCurrentCredentials"><AppIcon name="shield-check" />{{ credentialSaving ? text('保存中') : text('保存登录账号密码') }}</button>
                <button class="pg-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials"><AppIcon name="stop-circle" />{{ text('清除') }}</button>
                <button class="pg-btn" :disabled="templateLoading || !primaryTemplate" @click="downloadPrimaryTemplate"><AppIcon name="download" />{{ templateButtonLabel }}</button>
              </div>
            </div>

            <div class="pg-card__bd">
              <label class="pg-field"><span>{{ text('Excel 文件') }}</span></label>
              <div class="pg-drop" :class="{ 'pg-drop--on': selectedFile, 'pg-drop--over': isDragging }" @click="openFilePicker" @dragover.prevent="isDragging=true" @dragleave.prevent="isDragging=false" @drop.prevent="handleDrop">
                <input ref="fileInput" type="file" accept=".xlsx,.xls" @click.stop @change="handleFileSelect" />
                <template v-if="selectedFile">
                  <AppIcon name="check-circle" class="pg-drop__ok" /><b>{{ selectedFile.name }}</b><small>{{ formatSize(selectedFile.size) }}</small>
                  <button class="pg-drop__x" @click.stop="clearFile"><AppIcon name="stop-circle" /></button>
                </template>
                <template v-else>
                  <AppIcon name="upload" class="pg-drop__ic" /><b>{{ text('点击或拖入 Excel 文件') }}</b><small>{{ text(directScenarioExcelHint) }}</small>
                </template>
                <div v-if="isDragging" class="pg-drop__overlay">{{ text('释放以上传文件') }}</div>
              </div>
            </div>

            <div class="pg-card__ft">
              <button class="pg-btn pg-btn--pri pg-btn--xl" :disabled="!canRunShippingAutomation" @click="runInfornexusDirectWithExcel">
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'pg-spin': sending }" />{{ sending ? text('执行中...') : text(directScenarioRunLabel) }}
              </button>
            </div>

            <transition name="pg-fade">
              <div v-if="lastResult || sending" class="pg-status" :class="inlineStatusClass"><AppIcon :name="statusIconName" />{{ text(statusText) }}</div>
            </transition>

            <div v-if="isShippingScenario && shippingArtifactLinks?.resultExcelUrl" class="pg-card__ft pg-row">
              <button class="pg-btn pg-btn--pri" @click="downloadShippingArtifact(shippingArtifactLinks.resultExcelUrl, 'shipping-last-result.xlsx')"><AppIcon name="download" />{{ text('结果 Excel') }}</button>
              <button v-if="shippingArtifactLinks.failedPoExcelUrl && shippingArtifactLinks.failedRowCount > 0" class="pg-btn" @click="downloadShippingArtifact(shippingArtifactLinks.failedPoExcelUrl, 'shipping-last-failed-po-rows.xlsx')"><AppIcon name="download" />{{ text('失败明细') }}</button>
            </div>
          </div>

          <!-- ===== MICROSOFT / DEFAULT ===== -->
          <div v-else class="pg-card pg-card--accent">
            <div class="pg-card__hd pg-card__hd--lg">
              <AppIcon name="upload" class="pg-card__hd-ic" />
              <span>{{ text('上传文件并执行') }}</span>
              <span v-if="executorHealth?.ok" class="pg-chip pg-chip--ok">{{ text('就绪') }}</span>
              <span v-else class="pg-chip pg-chip--warn">{{ text('等待执行器') }}</span>
            </div>

            <div v-if="isMicrosoftScenario && hasStoredCredentials" class="pg-note pg-note--ok"><AppIcon name="check-circle" />{{ credentialStatusText }}</div>

            <div v-if="isMicrosoftScenario" class="pg-card__bd">
              <div class="pg-grid-2">
                <label class="pg-field"><span>{{ text('Microsoft 账号') }}</span><input v-model.trim="microsoftUsername" type="text" class="pg-inp" :placeholder="text('请输入 Microsoft 账号')" autocomplete="username" /></label>
                <label class="pg-field"><span>{{ text('Microsoft 密码') }}</span><span class="pg-inp-wrap"><input v-model="microsoftPassword" :type="showMicrosoftPassword ? 'text' : 'password'" class="pg-inp" placeholder="Enter password" autocomplete="current-password" /><button class="pg-inp__btn" @click="showMicrosoftPassword = !showMicrosoftPassword"><AppIcon name="eye" /></button></span></label>
              </div>
              <div class="pg-row">
                <button class="pg-btn pg-btn--pri" :disabled="credentialSaving || !microsoftUsername || !microsoftPassword" @click="saveCurrentCredentials"><AppIcon name="shield-check" />{{ credentialSaving ? text('保存中') : text('保存登录账号密码') }}</button>
                <button class="pg-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials"><AppIcon name="stop-circle" />{{ text('清除') }}</button>
                <button class="pg-btn" :disabled="templateLoading || !primaryTemplate" @click="downloadPrimaryTemplate"><AppIcon name="download" />{{ templateButtonLabel }}</button>
              </div>
            </div>

            <div class="pg-card__bd">
              <label class="pg-field"><span>{{ text('Excel 文件') }}</span></label>
              <div class="pg-drop" :class="{ 'pg-drop--on': selectedFile, 'pg-drop--over': isDragging }" @click="openFilePicker" @dragover.prevent="isDragging=true" @dragleave.prevent="isDragging=false" @drop.prevent="handleDrop">
                <input ref="fileInput" type="file" accept=".xlsx,.xls" @click.stop @change="handleFileSelect" />
                <template v-if="selectedFile">
                  <AppIcon name="check-circle" class="pg-drop__ok" /><b>{{ selectedFile.name }}</b><small>{{ formatSize(selectedFile.size) }}</small>
                  <button class="pg-drop__x" @click.stop="clearFile"><AppIcon name="stop-circle" /></button>
                </template>
                <template v-else>
                  <AppIcon name="upload" class="pg-drop__ic" /><b>{{ text('点击或拖入 Excel 文件') }}</b><small>{{ text('支持 .xlsx / .xls 格式') }}</small>
                </template>
                <div v-if="isDragging" class="pg-drop__overlay">{{ text('释放以上传文件') }}</div>
              </div>
            </div>

            <div class="pg-card__ft">
              <button class="pg-btn pg-btn--pri pg-btn--xl" :disabled="!canRunDirectExecutor" @click="sendDirectToExecutor">
                <AppIcon :name="sending ? 'loader' : 'play-circle'" :class="{ 'pg-spin': sending }" />{{ sending ? text('执行中...') : text('本地直连执行') }}
              </button>
            </div>

            <transition name="pg-fade">
              <div v-if="lastResult || sending" class="pg-status" :class="inlineStatusClass"><AppIcon :name="statusIconName" />{{ text(statusText) }}</div>
            </transition>
          </div>

          <details v-if="lastRawResponse" class="pg-card pg-detail">
            <summary class="pg-detail__sum"><AppIcon name="code" /><span>{{ text('原始响应') }}</span><AppIcon name="chevron-down" class="pg-chev" /></summary>
            <pre class="pg-detail__pre">{{ lastRawResponse }}</pre>
          </details>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'; import { useRoute, useRouter } from 'vue-router'; import AppIcon from '../../shared/ui/AppIcon.vue'
import type { AutomationAppInfo } from '../../types/electronApi'; import type { AutomationRunFileInput, AutomationRunRecord, AutomationTemplate, ExecutorCredentials, LocalExecutorHealth } from './webAutomationApi'
import { buildAutomationTemplateDownloadUrl, clearExecutorCredentials, createAutomationRunRecord, fetchAutomationTemplates, fetchExecutorCredentials, openAutomationHelperDownload, fetchAutomationApps, finishAutomationRunRecord, hasElectronAutomationSupport, launchAutomationConsole, primeLocalAutomationLauncherBoot, probeLocalAutomationLauncherHealth, probeLocalExecutorHealth, recordWebAutomationEvent, resolveAutomationCredentials, saveExecutorCredentials, stopAutomationConsole } from './webAutomationApi'
import { canRunWithCredentials } from './webAutomationCredentials'
import { getAutomationAppStatusLabel, getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from './webAutomationModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const route = useRoute(); const router = useRouter(); const { text } = useAppLanguage()
const DSU = ''; const DSP = ''; const DMU = ''; const DMP = ''
const electronSupported = hasElectronAutomationSupport()
const activeApp = ref<AutomationAppInfo | null>(null); const executorHealth = ref<LocalExecutorHealth | null>(null); const executorCredentials = ref<ExecutorCredentials | null>(null); const automationTemplates = ref<AutomationTemplate[]>([])
const launcherReachable = ref(false); const launching = ref(false); const refreshing = ref(false); const templateLoading = ref(false); const credentialSaving = ref(false); const credentialClearing = ref(false); const sending = ref(false)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info'); const isDragging = ref(false); const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null); const webhookUrl = ref('http://127.0.0.1:5678/webhook/microsoft-login-excel-demo')
const shippingUsername = ref(DSU); const shippingPassword = ref(DSP); const showShippingPassword = ref(true)
const microsoftUsername = ref(DMU); const microsoftPassword = ref(DMP); const showMicrosoftPassword = ref(true)
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
async function refreshExecutorState(silent: boolean): Promise<void> { if (!entry.value || refreshing.value) return; refreshing.value = true; const fb = createFallback(entry.value); try { launcherReachable.value = electronSupported ? true : await probeLocalAutomationLauncherHealth(); if (electronSupported) { try { const apps = await fetchAutomationApps(); activeApp.value = apps.find((a) => a.id === entry.value?.appId) ?? fb } catch { activeApp.value = fb } } else { activeApp.value = fb }; if (!electronSupported && !launcherReachable.value) { executorHealth.value = null; activeApp.value = fb; if (!silent) { messageTone.value = 'warning'; message.value = text('未检测到本机自动化助手。') }; return }; executorHealth.value = await probeLocalExecutorHealth(entry.value.executorBaseUrl); await refreshExecutorCredentials(); if (activeApp.value) activeApp.value = { ...activeApp.value, running: true }; if (!silent) { messageTone.value = 'success'; message.value = text('状态已刷新。') } } catch { executorHealth.value = null; activeApp.value = activeApp.value || fb; if (!silent) { messageTone.value = 'warning'; message.value = launcherReachable.value ? text('本机自动化助手已连接，执行器尚未启动。') : text('执行器未就绪。') } } finally { refreshing.value = false } }
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
function handleFileSelect(e: Event): void { const f = (e.target as HTMLInputElement).files; if (f && f.length > 0) selectedFile.value = f[0] }
function handleDrop(e: DragEvent): void { isDragging.value = false; const f = e.dataTransfer?.files; if (f && f.length > 0) selectedFile.value = f[0] }
function openFilePicker(): void { fileInput.value?.click() }
function clearFile(): void { selectedFile.value = null; if (fileInput.value) fileInput.value.value = '' }
function formatSize(b: number): string { if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB` }
function resetWebhookUrl(): void { webhookUrl.value = entry.value?.webhookUrl || 'http://127.0.0.1:5678/webhook/microsoft-login-excel-demo' }
async function resolveRunCredentialsPayload(uv: string, pv: string): Promise<Record<string, string>> { if (!entry.value) return {}; const u = uv.trim(); const tp = pv; if (tp.trim()) { if (!u) throw new Error('请填写账号密码。'); executorCredentials.value = await saveExecutorCredentials(entry.value.id, u, tp); await refreshExecutorCredentials(); applyCredUser(executorCredentials.value.username || u); return { username: u, password: tp } }; const r = await resolveAutomationCredentials(entry.value.id); applyCredUser(r.username); if (isInfornexusDirectScenario.value) shippingPassword.value = r.password; else if (isMicrosoftScenario.value) microsoftPassword.value = r.password; return { username: r.username, password: r.password } }
function applyCredUser(u: string): void { if (!u) return; if (isInfornexusDirectScenario.value) shippingUsername.value = u; else if (isMicrosoftScenario.value) microsoftUsername.value = u }
async function createBackendRunRecord(f: File): Promise<AutomationRunRecord | null> { if (!entry.value) return null; return createAutomationRunRecord(entry.value.id, f, entry.value.title) }
async function finishBackendRunRecord(r: AutomationRunRecord | null, ok: boolean, msg: string, p: Record<string, any> | null): Promise<void> { if (!r?.runId) return; await finishAutomationRunRecord(r.runId, ok ? 'success' : 'failed', msg || (ok ? 'completed' : 'failed'), p, collectResultFiles(p)) }
function collectResultFiles(p: Record<string, any> | null): AutomationRunFileInput[] { const u = p?.artifacts?.downloadUrls; if (!u || typeof u !== 'object') return []; return [bfi(u.resultExcelUrl, 'result_excel', 'shipping-last-result.xlsx'), bfi(u.resultJsonUrl, 'result_json', 'shipping-last-result.json'), bfi(u.failedPoExcelUrl, 'failed_rows_excel', 'shipping-last-failed-po-rows.xlsx'), bfi(u.failedPoJsonUrl, 'failed_rows_json', 'shipping-last-failed-po-rows.json')].filter((x): x is AutomationRunFileInput => Boolean(x)) }
function bfi(rp: string, fr: string, fn: string): AutomationRunFileInput | null { const u = buildShippingArtifactUrl(rp); if (!u) return null; return { url: u, fileRole: fr, fileName: fn } }
async function runInfornexusDirectWithExcel(): Promise<void> { if (isInfornexusAutoAddScenario.value) { await runInfornexusAutoAdd(); return }; await runShipping() }
async function runShipping(): Promise<void> { if (!entry.value || sending.value || !isShippingScenario.value || !selectedFile.value) return; if (!(await ensureReady())) { setNotReady(); return }; const file = selectedFile.value; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; shippingArtifactLinks.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const res = await fetch(shippingExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: file.name, fileBase64: fb64, token: entry.value.localExecutorToken, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); updateShippingArtifactLinks(j); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { statusLabel.value = '失败'; statusText.value = j?.message || `HTTP ${res.status}`; lastResult.value = { ok: false, message: j?.message || `HTTP ${res.status}` }; messageTone.value = 'error'; message.value = text('执行失败。'); return }; if (j?.ok && j?.shipmentScanOpened) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedPoCount ?? 0}/${j.totalPoCount ?? '?'} 个 PO。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function runInfornexusAutoAdd(): Promise<void> { if (!entry.value || sending.value || !isInfornexusAutoAddScenario.value || !selectedFile.value) return; if (!(await ensureReady())) { setNotReady(); return }; const file = selectedFile.value; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在上传 Excel 并执行...'; lastResult.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(file); const fb64 = await fileToBase64(file); const cp = await resolveRunCredentialsPayload(shippingUsername.value, shippingPassword.value); const res = await fetch(infornexusAutoAddExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: file.name, fileBase64: fb64, token: entry.value.localExecutorToken, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { statusLabel.value = '失败'; statusText.value = j?.message || `HTTP ${res.status}`; lastResult.value = { ok: false, message: j?.message || `HTTP ${res.status}` }; messageTone.value = 'error'; message.value = text('执行失败。'); return }; if (j?.ok) { statusLabel.value = '成功'; statusText.value = `已完成 ${j.completedIdCount ?? 0}/${j.totalIdCount ?? '?'} 个 ID。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。'); return }; statusLabel.value = '未完成'; statusText.value = j?.message || '未确认完成。'; lastResult.value = { ok: false, message: j?.message }; messageTone.value = 'warning'; message.value = text('已触发，结果未确认。') } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
async function sendDirectToExecutor(): Promise<void> { if (!selectedFile.value || sending.value || !entry.value) return; if (!(await ensureReady())) { setNotReady(); return }; sending.value = true; statusLabel.value = '执行中'; statusText.value = '正在执行...'; lastResult.value = null; lastRawResponse.value = ''; message.value = ''; try { const rr = await createBackendRunRecord(selectedFile.value); const fb64 = await fileToBase64(selectedFile.value); const cp = isMicrosoftScenario.value ? await resolveRunCredentialsPayload(microsoftUsername.value, microsoftPassword.value) : {}; const res = await fetch(directExecutorRunUrl.value, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.value.localExecutorToken }, body: JSON.stringify({ fileName: selectedFile.value.name, fileBase64: fb64, token: entry.value.localExecutorToken, ...cp }) }); const raw = await res.text(); lastRawResponse.value = raw; const j = safeParseJson(raw); await finishBackendRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok) { statusLabel.value = '失败'; statusText.value = j?.message || `HTTP ${res.status}`; lastResult.value = { ok: false, message: j?.message || `HTTP ${res.status}` }; messageTone.value = 'error'; message.value = text('执行失败。'); return }; if (!j) throw new Error('无法解析响应。'); if (j.loginSuccess) { statusLabel.value = '成功'; statusText.value = `已处理 ${j.uploadedRowCount ?? '?'} 行。`; lastResult.value = { ok: true, message: j.message }; messageTone.value = 'success'; message.value = text('执行完成。') } else { statusLabel.value = '未完成'; statusText.value = j.message || '未确认成功。'; lastResult.value = { ok: false, message: j.message }; messageTone.value = 'warning'; message.value = text('已触发，未确认。') } } catch (e) { statusLabel.value = '异常'; statusText.value = readErrorMessage(e, '网络错误'); lastResult.value = { ok: false }; messageTone.value = 'error'; message.value = text('执行异常。') } finally { sending.value = false; await refreshExecutorState(true).catch(() => {}) } }
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
.pg { --a: #2563eb; --a2: #eff6ff; --red: #dc2626; --br: #e5e7eb; --mu: #64748b; --ink: #111827; --r: 8px; display: flex; flex-direction: column; gap: 14px; padding: 18px 22px; min-height: 100%; background: #f6f7f9; color: var(--ink); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; }
.pg--ms { --a: #0d9488; --a2: #f0fdfa; } .pg--ship { --a: #0ea5e9; --a2: #f0f9ff; } .pg--inf { --a: #059669; --a2: #ecfdf5; }
.pg-main { display: grid; grid-template-columns: 250px minmax(0,1fr); gap: 14px; align-items: start; }
.pg-side, .pg-stage { display: flex; flex-direction: column; gap: 10px; min-width: 0; }

/* Card */
.pg-card { background: #fff; border: 1px solid var(--br); border-radius: var(--r); box-shadow: 0 1px 2px rgba(0,0,0,.04);
  &--accent { border-left: 3px solid var(--a); }
  &__hd { display: flex; align-items: center; gap: 8px; padding: 12px 15px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #f3f4f6; &--lg { padding: 14px 16px; font-size: 14px; } }
  &__hd-ic { font-size: 15px; color: var(--a); flex-shrink: 0; }
  &__bd { padding: 12px 15px; display: flex; flex-direction: column; gap: 10px; & + & { padding-top: 0; } }
  &__ft { padding: 0 15px 14px; display: flex; flex-direction: column; gap: 8px; }
}

/* Top */
.pg-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; &__right { display: flex; align-items: center; gap: 6px; } &__st { font-size: 12px; color: var(--mu); font-weight: 500; } }
.pg-back { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: #4b5563; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .15s; :deep(.app-icon) { font-size: 14px; } &:hover { background: #f9fafb; } }
.pg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; &--on { background: #10b981; } &--off { background: #d1d5db; } }

/* Hero */
.pg-hero { display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: #fff; border: 1px solid var(--br); border-radius: var(--r); box-shadow: 0 1px 2px rgba(0,0,0,.04); animation: pg-in .4s ease both;
  &__icon { width: 40px; height: 40px; border-radius: 8px; background: var(--a2); color: var(--a); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  &__text { min-width: 0; h1 { margin: 0; font-size: 16px; font-weight: 700; } p { margin: 2px 0 0; font-size: 12.5px; color: var(--mu); } }
}

/* Alert */
.pg-alert { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; font-size: 13px; border: 1px solid; font-weight: 500; :deep(.app-icon) { font-size: 15px; flex-shrink: 0; }
  &--info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; } &--success { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; } &--warning { background: #fffbeb; color: #b45309; border-color: #fde68a; } &--error { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  &__x { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: auto; border: none; border-radius: 4px; background: rgba(0,0,0,.05); color: var(--mu); cursor: pointer; :deep(.app-icon) { font-size: 12px; } &:hover { background: rgba(0,0,0,.1); } }
}
.pg-fade-enter-active { transition: all .25s ease; } .pg-fade-leave-active { transition: all .15s ease; } .pg-fade-enter-from, .pg-fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* Empty */
.pg-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 20px; text-align: center; animation: pg-in .4s ease both; &__icon { font-size: 36px; color: #d1d5db; } strong { font-size: 16px; } }

/* Buttons */
.pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 32px; padding: 0 11px; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: #4b5563; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s ease; white-space: nowrap; :deep(.app-icon) { font-size: 13px; flex-shrink: 0; } &:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; } &:disabled { opacity: .45; cursor: not-allowed; }
  &--pri { background: var(--a); color: #fff; border-color: var(--a); &:hover:not(:disabled) { filter: brightness(1.08); } }
  &--danger { color: var(--red); border-color: #fecaca; &:hover:not(:disabled) { background: #fef2f2; } }
  &--xl { height: 38px; padding: 0 18px; font-size: 13px; :deep(.app-icon) { font-size: 14px; } }
}
.pg-acts { display: flex; flex-direction: column; gap: 5px; }
.pg-row { display: flex; flex-wrap: wrap; gap: 7px; }
.pg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

/* Steps */
.pg-steps { display: flex; flex-direction: column; gap: 2px; }
.pg-step { display: flex; gap: 10px; padding: 9px 10px; border-radius: 6px; transition: background .15s; &:hover { background: #f9fafb; }
  b { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: var(--a2); color: var(--a); font-size: 10px; font-weight: 800; flex-shrink: 0; }
  div { min-width: 0; } em { display: block; font-size: 12px; font-style: normal; font-weight: 600; color: var(--ink); } small { display: block; font-size: 11px; color: var(--mu); line-height: 1.4; margin-top: 1px; }
}

/* Detail / Health */
.pg-detail { overflow: hidden; &__sum { display: flex; align-items: center; gap: 7px; padding: 10px 14px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--mu); list-style: none; transition: color .15s; &::-webkit-details-marker { display: none; } &:hover { color: var(--ink); } :deep(.app-icon) { font-size: 14px; } span { flex: 1; } }
  &__pre { margin: 0; max-height: 200px; overflow: auto; padding: 12px 14px; border-top: 1px solid #f3f4f6; background: #1e293b; color: #67e8f9; font-size: 11.5px; font-family: 'Cascadia Code','SF Mono',Consolas,monospace; white-space: pre-wrap; word-break: break-word; }
}
.pg-chev { transition: transform .2s; details[open] & { transform: rotate(180deg); } }
.pg-spin { animation: pg-spin .8s linear infinite; }

/* Banner */
.pg-banner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--r);
  &__ic { font-size: 22px; color: #d97706; flex-shrink: 0; } &__bd strong { display: block; font-size: 13px; color: var(--ink); } &__bd p { margin: 2px 0 0; font-size: 12px; color: #92400e; } &__btns { display: flex; flex-wrap: wrap; gap: 6px; }
}

/* Chip / Note */
.pg-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-left: auto; :deep(.app-icon) { font-size: 11px; }
  &--ok { background: #ecfdf5; color: #059669; } &--warn { background: #fffbeb; color: #d97706; }
}
.pg-note { display: flex; align-items: flex-start; gap: 7px; margin: 0 15px; padding: 9px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; border: 1px solid; :deep(.app-icon) { font-size: 14px; flex-shrink: 0; margin-top: 1px; } &--ok { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; } }

/* Fields */
.pg-field { display: flex; flex-direction: column; gap: 4px; > span { font-size: 12px; font-weight: 600; color: var(--ink); } }
.pg-inp-wrap { display: flex; gap: 5px; }
.pg-inp { flex: 1; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid var(--br); border-radius: 6px; background: #f9fafb; color: var(--ink); font-size: 12.5px; transition: border-color .15s, box-shadow .15s; &::placeholder { color: #9ca3af; } &:focus { outline: none; border-color: var(--a); box-shadow: 0 0 0 2px rgba(37,99,235,.08); background: #fff; }
  &__btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; flex-shrink: 0; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: var(--mu); cursor: pointer; transition: all .15s; :deep(.app-icon) { font-size: 13px; } &:hover { border-color: var(--a); color: var(--a); background: var(--a2); } }
}

/* Dropzone */
.pg-drop { position: relative; display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 12px 14px; border: 2px dashed #d1d5db; border-radius: 7px; background: #fafbfc; cursor: pointer; transition: all .2s ease; user-select: none; input { display: none; } &:hover { border-color: #9ca3af; }
  &--on { border-color: #86efac; border-style: solid; background: #f0fdf4; } &--over { border-color: var(--a); background: var(--a2); transform: scale(1.01); }
  b { font-size: 12.5px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { font-size: 11px; color: #9ca3af; }
  &__ic { font-size: 20px; color: #9ca3af; flex-shrink: 0; } &__ok { font-size: 17px; color: #10b981; flex-shrink: 0; }
  &__x { margin-left: auto; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid var(--br); border-radius: 4px; background: #fff; color: var(--mu); cursor: pointer; flex-shrink: 0; transition: all .15s; :deep(.app-icon) { font-size: 13px; } &:hover { border-color: var(--red); color: var(--red); background: #fef2f2; } }
  &__overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.88); border-radius: 7px; font-size: 13px; font-weight: 700; color: var(--a); }
}

/* Status */
.pg-status { display: flex; align-items: center; gap: 7px; margin: 0 15px 12px; padding: 9px 13px; border-radius: 6px; font-size: 12.5px; border: 1px solid; font-weight: 500; :deep(.app-icon) { font-size: 14px; flex-shrink: 0; }
  &--info { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; } &--ok { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; } &--err { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
}

@keyframes pg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pg-spin { to { transform: rotate(360deg); } }
@media (max-width: 1100px) { .pg-main { grid-template-columns: 1fr; } .pg-grid-2 { grid-template-columns: 1fr; } .pg-banner { grid-template-columns: 1fr; &__btns .pg-btn { width: 100%; } } }
@media (max-width: 680px) { .pg { padding: 12px; } }
</style>
