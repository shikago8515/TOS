<template>
  <div class="s2">
    <!-- === TOP BAR === -->
    <header class="s2-top">
      <button class="s2-back" @click="goBack">
        <AppIcon name="arrow-left" />
        <span>{{ text('返回') }}</span>
      </button>
      <div class="s2-top__right">
        <span class="s2-dot" :class="executorHealth?.ok ? 's2-dot--on' : 's2-dot--off'" />
        <span class="s2-top__status">{{ executorHealth?.ok ? text('执行器就绪') : text('执行器未连接') }}</span>
      </div>
    </header>

    <!-- === ALERT === -->
    <transition name="s2-alert-anim">
      <div v-if="message" class="s2-alert" :class="`s2-alert--${messageTone}`">
        <AppIcon :name="messageIconName" />
        <span>{{ text(message) }}</span>
        <button class="s2-alert__close" @click="message = ''"><AppIcon name="stop-circle" /></button>
      </div>
    </transition>

    <!-- === EMPTY === -->
    <div v-if="!entry" class="s2-empty">
      <AppIcon name="alert-circle" class="s2-empty__icon" />
      <strong>{{ text('入口不存在') }}</strong>
      <span>{{ text('请返回 Eric - Infornexus 页面重新选择场景。') }}</span>
      <button class="s2-back" @click="goBack"><AppIcon name="arrow-left" />{{ text('返回') }}</button>
    </div>

    <template v-else>
      <!-- === HERO === -->
      <div class="s2-hero">
        <div class="s2-hero__icon">
          <AppIcon name="package" />
        </div>
        <div class="s2-hero__text">
          <h1>{{ text(entry.title) }}</h1>
          <p>{{ text(entry.subtitle) }}</p>
        </div>
      </div>

      <!-- === MAIN === -->
      <div class="s2-main">
        <!-- LEFT SIDEBAR -->
        <aside class="s2-side">
          <!-- Executor Control -->
          <div class="s2-card">
            <div class="s2-card__hd">
              <AppIcon name="server" class="s2-card__hd-icon" />
              <span>{{ text('执行器控制') }}</span>
            </div>
            <div class="s2-card__bd s2-actions">
              <button class="s2-btn s2-btn--pri" :disabled="!canLaunchActiveApp" @click="startActiveApp(false)">
                <AppIcon name="play-circle" />{{ launching ? text('启动中...') : text('启动执行器') }}
              </button>
              <button class="s2-btn s2-btn--danger" :disabled="!canStopActiveApp" @click="stopActiveApp">
                <AppIcon name="stop-circle" />{{ text('停止') }}
              </button>
              <button class="s2-btn" :disabled="refreshing" @click="refreshExecutorState(false)">
                <AppIcon name="refresh-cw" :class="{ 's2-spin': refreshing }" />{{ text('刷新状态') }}
              </button>
            </div>
          </div>

          <!-- Credentials -->
          <div class="s2-card">
            <div class="s2-card__hd">
              <AppIcon name="shield-check" class="s2-card__hd-icon" />
              <span>Infor Nexus {{ text('登录账号密码') }}</span>
            </div>
            <div class="s2-card__bd">
              <div v-if="hasStoredCredentials" class="s2-note s2-note--ok">
                <AppIcon name="check-circle" />{{ credentialStatusText }}
              </div>
              <label class="s2-field">
                <span>User ID</span>
                <input v-model.trim="shippingUsername" class="s2-inp" type="text" autocomplete="username" />
              </label>
              <label class="s2-field">
                <span>Password</span>
                <span class="s2-inp-wrap">
                  <input v-model="shippingPassword" :type="showPassword ? 'text' : 'password'" class="s2-inp" autocomplete="current-password" />
                  <button class="s2-inp__btn" @click="showPassword = !showPassword"><AppIcon name="eye" /></button>
                </span>
              </label>
              <div class="s2-row">
                <button class="s2-btn s2-btn--pri" :disabled="credentialSaving || !shippingUsername || !shippingPassword" @click="saveCurrentCredentials">
                  <AppIcon name="shield-check" />{{ credentialSaving ? text('保存中...') : text('保存') }}
                </button>
                <button class="s2-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials">
                  <AppIcon name="stop-circle" />{{ text('清除') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Steps -->
          <div class="s2-card">
            <div class="s2-card__hd">
              <AppIcon name="workflow" class="s2-card__hd-icon" />
              <span>{{ text('操作流程') }}</span>
            </div>
            <div class="s2-card__bd s2-steps">
              <div v-for="(step, i) in shippingAutomation2Steps" :key="step.title" class="s2-step" :style="{ animationDelay: `${i * 60}ms` }">
                <b class="s2-step__n">{{ i + 1 }}</b>
                <div><em>{{ text(step.title) }}</em><small>{{ text(step.desc) }}</small></div>
              </div>
            </div>
          </div>

          <!-- Health -->
          <details class="s2-card s2-detail">
            <summary class="s2-detail__sum">
              <AppIcon name="terminal" /><span>{{ text('执行器健康信息') }}</span><AppIcon name="chevron-down" class="s2-chev" />
            </summary>
            <pre class="s2-detail__pre">{{ healthRaw }}</pre>
          </details>
        </aside>

        <!-- RIGHT STAGE -->
        <section class="s2-stage">
          <!-- Helper -->
          <transition name="s2-alert-anim">
            <div v-if="showLocalHelperPrompt" class="s2-banner">
              <AppIcon name="monitor-code" class="s2-banner__icon" />
              <div>
                <strong>{{ text('未检测到本机自动化助手') }}</strong>
                <p>{{ text('请先启动 TOS 自动化助手，然后重新检测。') }}</p>
              </div>
              <div class="s2-banner__btns">
                <button class="s2-btn s2-btn--pri" @click="downloadAutomationHelper"><AppIcon name="download" />{{ text('下载助手') }}</button>
                <button class="s2-btn" @click="bootLocalHelper"><AppIcon name="play-circle" />{{ text('启动助手') }}</button>
                <button class="s2-btn" :disabled="refreshing" @click="refreshExecutorState(false)"><AppIcon name="refresh-cw" />{{ text('重新检测') }}</button>
              </div>
            </div>
          </transition>

          <!-- Credentials -->
          <div class="s2-card s2-card--accent s2-credentials-main">
            <div class="s2-card__hd s2-card__hd--lg">
              <AppIcon name="shield-check" class="s2-card__hd-icon" />
              <span>Infor Nexus {{ text('登录账号密码') }}</span>
              <span v-if="hasStoredCredentials" class="s2-chip s2-chip--ok">
                <AppIcon name="check-circle" />{{ text('已保存') }}
              </span>
            </div>
            <div v-if="hasStoredCredentials" class="s2-note s2-note--ok">
              <AppIcon name="check-circle" />{{ credentialStatusText }}
            </div>
            <div class="s2-card__bd">
              <div class="s2-grid-2">
                <label class="s2-field">
                  <span>User ID</span>
                  <input v-model.trim="shippingUsername" class="s2-inp" type="text" autocomplete="username" />
                </label>
                <label class="s2-field">
                  <span>Password</span>
                  <span class="s2-inp-wrap">
                    <input v-model="shippingPassword" :type="showPassword ? 'text' : 'password'" class="s2-inp" autocomplete="current-password" />
                    <button class="s2-inp__btn" type="button" @click="showPassword = !showPassword"><AppIcon name="eye" /></button>
                  </span>
                </label>
              </div>
              <div class="s2-row">
                <button class="s2-btn s2-btn--pri" :disabled="credentialSaving || !shippingUsername || !shippingPassword" @click="saveCurrentCredentials">
                  <AppIcon name="shield-check" />{{ credentialSaving ? text('保存中...') : text('保存') }}
                </button>
                <button class="s2-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials">
                  <AppIcon name="stop-circle" />{{ text('清除') }}
                </button>
              </div>
            </div>
          </div>

          <!-- ===== DUAL BULK GRID ===== -->
          <div class="s2-bulk-grid">
            <article v-for="bulk in bulkAreas" :key="bulk.id" class="s2-bulk" :class="`s2-bulk--${bulk.id}`">
              <!-- Head -->
              <div class="s2-bulk__hd">
                <AppIcon :name="bulk.id === 'unreleased' ? 'upload' : 'package'" class="s2-bulk__hd-icon" />
                <strong>{{ text(bulk.label) }}</strong>
                <span v-if="bulk.result?.ok" class="s2-chip s2-chip--ok"><AppIcon name="check-circle" />{{ text('已完成') }}</span>
                <span v-else-if="bulk.running" class="s2-chip s2-chip--busy"><AppIcon name="loader" class="s2-spin" />{{ text('运行中') }}</span>
              </div>

              <!-- Template -->
              <div class="s2-bulk__section">
                <button class="s2-btn" :disabled="templateLoading || !bulkTemplate(bulk.id)" @click="downloadBulkTemplate(bulk.id)">
                  <AppIcon name="download" />{{ bulkTemplate(bulk.id) ? text('下载模板') : text('暂无模板') }}
                </button>
              </div>

              <!-- Upload -->
              <div class="s2-bulk__section">
                <div class="s2-drop" :class="{ 's2-drop--on': bulk.file, 's2-drop--over': bulk.dragging }"
                  @click="openBulkFilePicker(bulk.id)" @dragenter.prevent="handleBulkDragEnter(bulk.id, $event)" @dragover.prevent="handleBulkDragOver(bulk.id, $event)" @dragleave.prevent="handleBulkDragLeave(bulk.id, $event)" @drop.prevent="handleBulkDrop(bulk.id, $event)">
                  <input :ref="(el) => setBulkFileInputRef(bulk.id, el)" type="file" accept=".xlsx,.xls" @click.stop @change="handleBulkFileSelect(bulk.id, $event)" />
                  <template v-if="bulk.file">
                    <AppIcon name="check-circle" class="s2-drop__ok" />
                    <b>{{ bulk.file.name }}</b>
                    <small>{{ formatSize(bulk.file.size) }}</small>
                    <button class="s2-drop__x" @click.stop="clearBulkFile(bulk.id)"><AppIcon name="stop-circle" /></button>
                  </template>
                  <template v-else>
                    <AppIcon name="upload" class="s2-drop__ic" />
                    <b>{{ text('选择 Excel 文件') }}</b>
                    <small>.xlsx / .xls</small>
                  </template>
                  <div v-if="bulk.dragging" class="s2-drop__overlay">{{ text('释放以上传') }}</div>
                </div>
              </div>

              <!-- Execute -->
              <div class="s2-bulk__section">
                <button class="s2-btn s2-btn--pri s2-btn--xl" :disabled="bulk.running || !bulk.file" @click="startBulkAutomation(bulk.id)">
                  <AppIcon :name="bulk.running ? 'loader' : 'play-circle'" :class="{ 's2-spin': bulk.running }" />
                  {{ bulk.running ? text('启动中...') : text('启动') }}
                </button>
              </div>

              <!-- Status -->
              <div class="s2-bulk__status" :class="`s2-bulk__status--${bulk.tone}`">
                <AppIcon :name="bulkStatusIcon(bulk)" />{{ text(bulk.statusText) }}
              </div>

              <!-- Result -->
              <div v-if="bulk.result" class="s2-bulk__result">
                <span>Run ID</span>
                <code>{{ bulk.result.runId }}</code>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { AutomationAppInfo } from '../../../types/electronApi'
import type { AutomationRunRecord, AutomationTemplate, ExecutorCredentials, LocalExecutorHealth } from '../../web-automation/webAutomationApi'
import {
  buildAutomationTemplateDownloadUrl, clearExecutorCredentials, createAutomationRunRecord,
  fetchAutomationApps, fetchAutomationTemplates, fetchExecutorCredentials, finishAutomationRunRecord,
  hasElectronAutomationSupport, launchAutomationConsole, openAutomationHelperDownload,
  primeLocalAutomationLauncherBoot, probeLocalAutomationLauncherHealth, probeLocalExecutorHealth,
  recordWebAutomationEvent, resolveAutomationCredentials, saveExecutorCredentials, stopAutomationConsole,
} from '../../web-automation/webAutomationApi'
import { getAutomationAppStatusLabel, getWebAutomationEntry, type WebAutomationEntry, type WebAutomationNoticeTone } from '../../web-automation/webAutomationModel'
import { shippingAutomation2EntryId, shippingAutomation2Steps } from '../shippingAutomation2Model'

type BulkId = 'unreleased' | 'released'
type BulkTone = 'idle' | 'info' | 'success' | 'error'
interface BulkResult { ok: boolean; runId?: string; message?: string; finalUrl?: string; generatedAt?: string }
interface BulkState { id: BulkId; label: string; file: File | null; dragging: boolean; dragDepth: number; running: boolean; tone: BulkTone; statusText: string; result: BulkResult | null }

const router = useRouter(); const { text } = useAppLanguage()
const entry = getWebAutomationEntry(shippingAutomation2EntryId)
const electronSupported = hasElectronAutomationSupport()

const activeApp = ref<AutomationAppInfo | null>(null); const executorHealth = ref<LocalExecutorHealth | null>(null)
const executorCredentials = ref<ExecutorCredentials | null>(null); const automationTemplates = ref<AutomationTemplate[]>([])
const launcherReachable = ref(false); const launching = ref(false); const refreshing = ref(false)
const templateLoading = ref(false); const credentialSaving = ref(false); const credentialClearing = ref(false)
const shippingUsername = ref(''); const shippingPassword = ref(''); const showPassword = ref(true)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info')
const bulkFileInputs = new Map<BulkId, HTMLInputElement>()
const bulkAreas = ref<BulkState[]>([
  { id: 'unreleased', label: 'Unreleased Bulk', file: null, dragging: false, dragDepth: 0, running: false, tone: 'idle', statusText: '等待选择 Excel 文件。', result: null },
  { id: 'released', label: 'released Bulk', file: null, dragging: false, dragDepth: 0, running: false, tone: 'idle', statusText: '等待选择 Excel 文件。', result: null },
])

const healthRaw = computed(() => executorHealth.value ? JSON.stringify(executorHealth.value, null, 2) : '{}')
const executorStatusLabel = computed(() => {
  if (activeApp.value) { const l = text(getAutomationAppStatusLabel(activeApp.value)); if (executorHealth.value?.ok) { const c = Number(executorHealth.value.activeRunCount || 0); return c > 0 ? `${l} / ${text('运行')} ${c} ${text('个任务')}` : `${l} / ${text('就绪')}` }; if (activeApp.value.running) return `${l} / ${text('未连接')}`; return l }; return executorHealth.value?.ok ? text('就绪') : text('未启动')
})
const canLaunchActiveApp = computed(() => Boolean(entry?.appId) && !launching.value)
const canStopActiveApp = computed(() => Boolean(activeApp.value?.running || executorHealth.value?.ok) && !launching.value)
const showLocalHelperPrompt = computed(() => !electronSupported && !launcherReachable.value)
const hasStoredCredentials = computed(() => Boolean(executorCredentials.value?.hasStoredCredentials))
const savedCredentialUsername = computed(() => executorCredentials.value?.username || '')
const credentialStatusText = computed(() => { if (hasStoredCredentials.value) { return savedCredentialUsername.value ? `已保存：${savedCredentialUsername.value}` : '已保存 Infor Nexus 登录账号密码。' }; return '未保存 Infor Nexus 登录账号密码。' })
const messageIconName = computed(() => { if (messageTone.value === 'success') return 'check-circle'; if (messageTone.value === 'error') return 'alert-circle'; if (messageTone.value === 'warning') return 'info'; return 'activity' })

onMounted(() => { void initializeScenario() })

async function initializeScenario(): Promise<void> { await refreshAutomationTemplates(); await refreshExecutorCredentials(); await refreshExecutorState(true) }

async function refreshExecutorState(silent: boolean): Promise<void> {
  if (!entry || refreshing.value) return; refreshing.value = true; const fb = createFallbackAutomationApp(entry)
  try { launcherReachable.value = electronSupported ? true : await probeLocalAutomationLauncherHealth(); if (electronSupported) { try { const a = await fetchAutomationApps(); activeApp.value = a.find((x) => x.id === entry.appId) ?? fb } catch { activeApp.value = fb } } else { activeApp.value = fb }; if (!electronSupported && !launcherReachable.value) { executorHealth.value = null; activeApp.value = fb; if (!silent) { messageTone.value = 'warning'; message.value = text('未检测到本机自动化助手。') }; return }; executorHealth.value = await probeLocalExecutorHealth(entry.executorBaseUrl); if (activeApp.value) activeApp.value = { ...activeApp.value, running: true }; if (!silent) { messageTone.value = 'success'; message.value = text('状态已刷新。') } } catch { executorHealth.value = null; activeApp.value = activeApp.value || fb; if (!silent) { messageTone.value = 'warning'; message.value = launcherReachable.value ? text('本机自动化助手已连接，执行器尚未启动。') : text('执行器未就绪。') } } finally { refreshing.value = false }
}

async function refreshExecutorCredentials(): Promise<void> { if (!entry) return; try { executorCredentials.value = await fetchExecutorCredentials(entry.id); if (executorCredentials.value.username) shippingUsername.value = executorCredentials.value.username; if (executorCredentials.value.hasStoredCredentials) { const r = await resolveAutomationCredentials(entry.id); shippingUsername.value = r.username; shippingPassword.value = r.password } } catch { executorCredentials.value = null } }
async function refreshAutomationTemplates(): Promise<void> { if (!entry) return; templateLoading.value = true; try { automationTemplates.value = await fetchAutomationTemplates(entry.id) } catch { automationTemplates.value = [] } finally { templateLoading.value = false } }

async function saveCurrentCredentials(): Promise<void> { if (!entry || credentialSaving.value) return; const u = shippingUsername.value.trim(); const p = shippingPassword.value; if (!u || !p) { messageTone.value = 'warning'; message.value = '请先填写账号和密码。'; return }; credentialSaving.value = true; try { executorCredentials.value = await saveExecutorCredentials(entry.id, u, p); await refreshExecutorCredentials(); shippingPassword.value = p; messageTone.value = 'success'; message.value = 'Infor Nexus 登录账号密码已保存。' } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, '保存失败。') } finally { credentialSaving.value = false } }
async function clearCurrentCredentials(): Promise<void> { if (!entry || credentialClearing.value) return; credentialClearing.value = true; try { executorCredentials.value = await clearExecutorCredentials(entry.id); shippingPassword.value = ''; messageTone.value = 'info'; message.value = '已清除。' } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, '清除失败。') } finally { credentialClearing.value = false } }

async function resolveRunCredentialsPayload(): Promise<Record<string, string>> { if (!entry) return {}; const u = shippingUsername.value.trim(); const tp = shippingPassword.value; if (tp.trim()) { if (!u) throw new Error('请填写 Infor Nexus 登录账号密码。'); executorCredentials.value = await saveExecutorCredentials(entry.id, u, tp); await refreshExecutorCredentials(); return { username: u, password: tp } }; const r = await resolveAutomationCredentials(entry.id); shippingUsername.value = r.username; shippingPassword.value = r.password; return { username: r.username, password: r.password } }
function bulkTemplate(id: BulkId): AutomationTemplate | null { return automationTemplates.value.find((t) => t.templateKey === id) || automationTemplates.value.find((t) => t.templateKey === 'default') || automationTemplates.value[0] || null }
async function downloadBulkTemplate(id: BulkId): Promise<void> { const t = bulkTemplate(id); if (!t) return; try { const u = await buildAutomationTemplateDownloadUrl(t); const a = document.createElement('a'); a.href = u; a.download = t.originalFilename || `${t.templateKey || 'template'}.xlsx`; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove() } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, '下载模板失败。') } }
function downloadAutomationHelper(): void { void openAutomationHelperDownload() }
function bootLocalHelper(): void { primeLocalAutomationLauncherBoot(); messageTone.value = 'info'; message.value = text('已尝试启动本机自动化助手。'); window.setTimeout(() => { void refreshExecutorState(true) }, 1200) }

async function startActiveApp(silent: boolean): Promise<void> { if (!entry || launching.value) return; if (!electronSupported && !launcherReachable.value) primeLocalAutomationLauncherBoot(); launching.value = true; try { const r = await launchAutomationConsole(entry.appId); if (!r.success) throw new Error(r.error || '启动失败'); await refreshExecutorState(true); if (!silent) { messageTone.value = 'success'; message.value = r.alreadyRunning ? text('执行器已在运行。') : text('执行器已启动。') } } catch (e) { const m = readErrorMessage(e, text('启动失败')); await recordWebAutomationEvent('launch-exception', { appId: entry.appId, entryId: entry.id, error: m }); if (!silent) { messageTone.value = 'error'; message.value = m } } finally { launching.value = false } }
async function stopActiveApp(): Promise<void> { if (!entry) return; try { const r = await stopAutomationConsole(entry.appId); if (!r.success) throw new Error(r.error || '停止失败'); executorHealth.value = null; if (activeApp.value) activeApp.value = { ...activeApp.value, running: false }; await refreshExecutorState(true).catch(() => {}); messageTone.value = 'info'; message.value = text('执行器已停止。') } catch (e) { messageTone.value = 'error'; message.value = readErrorMessage(e, text('停止失败')) } }
async function ensureExecutorReady(): Promise<boolean> { if (executorHealth.value?.ok) return true; await startActiveApp(true); await refreshExecutorState(true).catch(() => {}); return Boolean(executorHealth.value?.ok) }

function setBulkFileInputRef(id: BulkId, el: unknown): void { if (el instanceof HTMLInputElement) bulkFileInputs.set(id, el) }
function getBulk(id: BulkId): BulkState | undefined { return bulkAreas.value.find((b) => b.id === id) }
function openBulkFilePicker(id: BulkId): void { bulkFileInputs.get(id)?.click() }
function handleBulkFileSelect(id: BulkId, e: Event): void { const f = getBulkExcelFile((e.target as HTMLInputElement).files); if (f) setBulkFile(id, f) }
function handleBulkDragEnter(id: BulkId, e: DragEvent): void { if (!hasDraggedFiles(e) || isInternalDragMove(e)) return; const b = getBulk(id); if (!b) return; b.dragDepth += 1; b.dragging = true }
function handleBulkDragOver(id: BulkId, e: DragEvent): void { if (!hasDraggedFiles(e)) return; if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; setBulkDragging(id, true) }
function handleBulkDragLeave(id: BulkId, e: DragEvent): void { if (isInternalDragMove(e)) return; const b = getBulk(id); if (!b) return; b.dragDepth = Math.max(0, b.dragDepth - 1); if (b.dragDepth === 0) b.dragging = false }
function handleBulkDrop(id: BulkId, e: DragEvent): void { resetBulkDragging(id); const f = getBulkExcelFile(e.dataTransfer?.files); if (f) setBulkFile(id, f) }
function setBulkFile(id: BulkId, file: File): void { if (!isExcelFile(file)) { messageTone.value = 'warning'; message.value = text('请上传 .xlsx 或 .xls 文件。'); return }; const b = getBulk(id); if (!b) return; b.file = file; b.result = null; b.tone = 'info'; b.statusText = `${file.name} 已选择，等待启动。`; message.value = '' }
function setBulkDragging(id: BulkId, v: boolean): void { const b = getBulk(id); if (b) b.dragging = v }
function resetBulkDragging(id: BulkId): void { const b = getBulk(id); if (!b) return; b.dragDepth = 0; b.dragging = false }
function clearBulkFile(id: BulkId): void { const b = getBulk(id); if (!b) return; b.file = null; resetBulkDragging(id); b.running = false; b.result = null; b.tone = 'idle'; b.statusText = '等待选择 Excel 文件。'; const inp = bulkFileInputs.get(id); if (inp) inp.value = '' }
function getBulkExcelFile(files: FileList | null | undefined): File | null { const list = files ? Array.from(files) : []; const f = list.find(isExcelFile) || null; if (!f && list.length > 0) { messageTone.value = 'warning'; message.value = text('请上传 .xlsx 或 .xls 文件。') }; return f }
function isExcelFile(file: File): boolean { return /\.(xlsx|xls)$/i.test(file.name) }
function hasDraggedFiles(e: DragEvent): boolean { return Array.from(e.dataTransfer?.types || []).includes('Files') }
function isInternalDragMove(e: DragEvent): boolean { const current = e.currentTarget; const related = e.relatedTarget; return current instanceof Node && related instanceof Node && current.contains(related) }
async function createBulkRunRecord(b: BulkState): Promise<AutomationRunRecord | null> { if (!entry || !b.file) return null; return createAutomationRunRecord(entry.id, b.file, `${entry.title} ${b.label}`) }
async function finishBulkRunRecord(rr: AutomationRunRecord | null, ok: boolean, msg: string, p: BulkResult | null): Promise<void> { if (!rr?.runId) return; await finishAutomationRunRecord(rr.runId, ok ? 'success' : 'failed', msg || (ok ? 'completed' : 'failed'), p) }

async function startBulkAutomation(id: BulkId): Promise<void> {
  const b = getBulk(id); if (!entry || !b || !b.file || b.running) return
  b.running = true; b.tone = 'info'; b.result = null; b.statusText = `${b.label} 正在启动...`
  try { if (!(await ensureExecutorReady())) { b.tone = 'error'; b.statusText = '执行器未就绪。'; return }; const rr = await createBulkRunRecord(b); const fb64 = await fileToBase64(b.file); const cp = await resolveRunCredentialsPayload(); const res = await fetch(getBulkUrl(id), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Executor-Token': entry.localExecutorToken }, body: JSON.stringify({ token: entry.localExecutorToken, ...cp, bulkType: id, fileName: b.file.name, fileBase64: fb64 }) }); const raw = await res.text(); const j = safeParseJson<BulkResult>(raw); await finishBulkRunRecord(rr, res.ok && Boolean(j?.ok), j?.message || '', j); if (!res.ok || !j?.ok) throw new Error(j?.message || `HTTP ${res.status}`); b.result = j; b.tone = 'success'; b.statusText = j.message || `${b.label} 已启动。`; messageTone.value = 'success'; message.value = b.statusText } catch (e) { b.tone = 'error'; b.statusText = readErrorMessage(e, '启动失败'); messageTone.value = 'error'; message.value = b.statusText } finally { b.running = false; await refreshExecutorState(true).catch(() => {}) }
}

function getBulkUrl(id: BulkId): string { const b = String(entry?.executorBaseUrl || '').replace(/\/+$/, ''); return b ? `${b}/api/run-shipping2-${id}-bulk` : '' }
async function fileToBase64(f: File): Promise<string> { const bytes = new Uint8Array(await f.arrayBuffer()); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return window.btoa(bin) }
function bulkStatusIcon(b: BulkState): string { if (b.running) return 'loader'; if (b.tone === 'success') return 'check-circle'; if (b.tone === 'error') return 'alert-circle'; return 'activity' }
function formatSize(b: number): string { if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB` }
function createFallbackAutomationApp(t: WebAutomationEntry): AutomationAppInfo { return { id: t.appId, name: t.title, description: t.description, provider: 'Playwright', category: 'Web Automation', version: 'local', available: true, running: false, url: t.executorBaseUrl } }
function safeParseJson<T>(raw: string): T | null { try { return raw ? JSON.parse(raw) as T : null } catch { return null } }
function readErrorMessage(e: unknown, fb: string): string { return e instanceof Error && e.message ? e.message : fb }
function goBack(): void { void router.push('/eric-infornexus') }
</script>

<style scoped lang="scss">
/* ================================================================
   Shipping 2 — Same design system as scenario page.
   Ocean blue accent. Core feature: dual bulk cards.
   ================================================================ */

.s2 {
  --a: #0ea5e9; --a2: #f0f9ff; --red: #dc2626; --br: #e5e7eb; --mu: #64748b; --ink: #111827;
  --r: 8px; --sh: 0 1px 2px rgba(0,0,0,.04);
  display: flex; flex-direction: column; gap: 14px; padding: 18px 22px; min-height: 100%;
  background: #f6f7f9; color: var(--ink);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

/* ---- Layout ---- */
.s2-main { display: grid; grid-template-columns: 250px minmax(0,1fr); gap: 14px; align-items: start; }
.s2-side, .s2-stage { display: flex; flex-direction: column; gap: 10px; min-width: 0; }

/* ---- Card ---- */
.s2-card { background: #fff; border: 1px solid var(--br); border-radius: var(--r); box-shadow: var(--sh); }
.s2-card--accent { border-left: 3px solid var(--a); }
.s2-card__hd { display: flex; align-items: center; gap: 8px; padding: 12px 15px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #f3f4f6; }
.s2-card__hd--lg { padding: 14px 16px; font-size: 14px; }
.s2-card__hd-icon { font-size: 15px; color: var(--a); flex-shrink: 0; }
.s2-card__bd { padding: 12px 15px; display: flex; flex-direction: column; gap: 10px; }
.s2-side > .s2-card:nth-of-type(2) { display: none; }

/* ---- Top Bar ---- */
.s2-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.s2-top__right { display: flex; align-items: center; gap: 6px; }
.s2-top__status { font-size: 12px; color: var(--mu); font-weight: 500; }
.s2-back { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: #4b5563; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .15s;
  :deep(.app-icon) { font-size: 14px; }
  &:hover { background: #f9fafb; }
}
.s2-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  &--on  { background: #10b981; }
  &--off { background: #d1d5db; }
}

/* ---- Hero ---- */
.s2-hero { display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: #fff; border: 1px solid var(--br); border-radius: var(--r); box-shadow: var(--sh); animation: s2-in .4s ease both; }
.s2-hero__icon { width: 40px; height: 40px; border-radius: 8px; background: var(--a2); color: var(--a); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.s2-hero__text { min-width: 0; h1 { margin: 0; font-size: 16px; font-weight: 700; } p { margin: 2px 0 0; font-size: 12.5px; color: var(--mu); } }

/* ---- Alert ---- */
.s2-alert { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; font-size: 13px; border: 1px solid; font-weight: 500;
  :deep(.app-icon) { font-size: 15px; flex-shrink: 0; }
  &--info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  &--success { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  &--warning { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  &--error   { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  &__close { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; margin-left: auto; border: none; border-radius: 4px; background: rgba(0,0,0,.05); color: var(--mu); cursor: pointer;
    :deep(.app-icon) { font-size: 12px; }
    &:hover { background: rgba(0,0,0,.1); }
  }
}
.s2-alert-anim-enter-active { transition: all .25s ease; }
.s2-alert-anim-leave-active { transition: all .15s ease; }
.s2-alert-anim-enter-from, .s2-alert-anim-leave-to { opacity: 0; transform: translateY(-6px); }

/* ---- Empty ---- */
.s2-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 20px; text-align: center; animation: s2-in .4s ease both;
  &__icon { font-size: 36px; color: #d1d5db; }
  strong { font-size: 16px; }
  span { font-size: 13px; color: var(--mu); }
}

/* ---- Buttons ---- */
.s2-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 32px; padding: 0 11px; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: #4b5563; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s ease; white-space: nowrap;
  :deep(.app-icon) { font-size: 13px; flex-shrink: 0; }
  &:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
  &:disabled { opacity: .45; cursor: not-allowed; }
  &--pri { background: var(--a); color: #fff; border-color: var(--a);
    &:hover:not(:disabled) { filter: brightness(1.08); }
  }
  &--danger { color: var(--red); border-color: #fecaca;
    &:hover:not(:disabled) { background: #fef2f2; }
  }
  &--xl { height: 38px; padding: 0 18px; width: 100%; font-size: 13px; :deep(.app-icon) { font-size: 14px; } }
}

.s2-actions { display: flex; flex-direction: column; gap: 5px; }
.s2-row { display: flex; flex-wrap: wrap; gap: 7px; }
.s2-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.s2-credentials-main .s2-note { margin: 0 15px; }

/* ---- Steps ---- */
.s2-steps { display: flex; flex-direction: column; gap: 2px; }
.s2-step { display: flex; gap: 10px; padding: 9px 10px; border-radius: 6px; transition: background .15s; animation: s2-in .35s ease both;
  &:hover { background: #f9fafb; }
  b { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 5px; background: var(--a2); color: var(--a); font-size: 10px; font-weight: 800; flex-shrink: 0; }
  div { min-width: 0; }
  em { display: block; font-size: 12px; font-style: normal; font-weight: 600; color: var(--ink); }
  small { display: block; font-size: 11px; color: var(--mu); line-height: 1.4; margin-top: 1px; }
}

/* ---- Detail ---- */
.s2-detail { overflow: hidden; }
.s2-detail__sum { display: flex; align-items: center; gap: 7px; padding: 10px 14px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--mu); list-style: none; transition: color .15s;
  &::-webkit-details-marker { display: none; }
  &:hover { color: var(--ink); }
  :deep(.app-icon) { font-size: 14px; }
  span { flex: 1; }
}
.s2-detail__pre { margin: 0; max-height: 200px; overflow: auto; padding: 12px 14px; border-top: 1px solid #f3f4f6; background: #1e293b; color: #67e8f9; font-size: 11.5px; font-family: 'Cascadia Code','SF Mono',Consolas,monospace; white-space: pre-wrap; word-break: break-word; }
.s2-chev { transition: transform .2s; details[open] & { transform: rotate(180deg); } }
.s2-spin { animation: s2-spin .8s linear infinite; }

/* ---- Banner ---- */
.s2-banner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--r);
  &__icon { font-size: 22px; color: #d97706; flex-shrink: 0; }
  strong { display: block; font-size: 13px; color: var(--ink); }
  p { margin: 2px 0 0; font-size: 12px; color: #92400e; }
  &__btns { display: flex; flex-wrap: wrap; gap: 6px; }
}

/* ---- Note / Chip ---- */
.s2-note { display: flex; align-items: flex-start; gap: 7px; padding: 9px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; border: 1px solid;
  :deep(.app-icon) { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  &--ok { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
}
.s2-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; flex-shrink: 0; margin-left: auto;
  :deep(.app-icon) { font-size: 11px; }
  &--ok   { background: #ecfdf5; color: #059669; }
  &--busy { background: #fffbeb; color: #d97706; }
}

/* ---- Fields ---- */
.s2-field { display: flex; flex-direction: column; gap: 4px;
  > span { font-size: 12px; font-weight: 600; color: var(--ink); }
}
.s2-inp-wrap { display: flex; gap: 5px; }
.s2-inp { flex: 1; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid var(--br); border-radius: 6px; background: #f9fafb; color: var(--ink); font-size: 12.5px; transition: border-color .15s, box-shadow .15s;
  &::placeholder { color: #9ca3af; }
  &:focus { outline: none; border-color: var(--a); box-shadow: 0 0 0 2px rgba(14,165,233,.08); background: #fff; }
  &__btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; flex-shrink: 0; border: 1px solid var(--br); border-radius: 6px; background: #fff; color: var(--mu); cursor: pointer; transition: all .15s;
    :deep(.app-icon) { font-size: 13px; }
    &:hover { border-color: var(--a); color: var(--a); background: var(--a2); }
  }
}

/* ---- Dropzone ---- */
.s2-drop { position: relative; display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 12px 14px; border: 2px dashed #d1d5db; border-radius: 7px; background: #fafbfc; cursor: pointer; transition: all .2s ease; user-select: none;
  input { display: none; }
  &:hover { border-color: #9ca3af; }
  &--on { border-color: #86efac; border-style: solid; background: #f0fdf4; }
  &--over { border-color: var(--a); background: var(--a2); transform: scale(1.01); }
  b { font-size: 12.5px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { font-size: 11px; color: #9ca3af; }
  &__ic { font-size: 20px; color: #9ca3af; flex-shrink: 0; }
  &__ok { font-size: 17px; color: #10b981; flex-shrink: 0; }
  &__x { margin-left: auto; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid var(--br); border-radius: 4px; background: #fff; color: var(--mu); cursor: pointer; flex-shrink: 0; transition: all .15s;
    :deep(.app-icon) { font-size: 13px; }
    &:hover { border-color: var(--red); color: var(--red); background: #fef2f2; }
  }
  &__overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.88); border-radius: 7px; font-size: 13px; font-weight: 700; color: var(--a); pointer-events: none; }
}

/* ===== BULK CARDS ===== */
.s2-bulk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.s2-bulk { background: #fff; border: 1px solid var(--br); border-radius: var(--r); box-shadow: var(--sh); display: flex; flex-direction: column;
  &--unreleased { border-left: 3px solid var(--a); }
  &--released   { border-left: 3px solid #059669; }
}
.s2-bulk__hd { display: flex; align-items: center; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #f3f4f6; }
.s2-bulk__hd-icon { font-size: 16px; flex-shrink: 0;
  .s2-bulk--unreleased & { color: var(--a); }
  .s2-bulk--released   & { color: #059669; }
}
.s2-bulk__hd strong { font-size: 14px; font-weight: 700; }
.s2-bulk__section { padding: 12px 15px 0; }

.s2-bulk__status { display: flex; align-items: center; gap: 7px; margin: 10px 15px 0; padding: 9px 13px; border-radius: 6px; font-size: 12.5px; border: 1px solid; font-weight: 500;
  :deep(.app-icon) { font-size: 14px; flex-shrink: 0; }
  &--idle    { background: #f9fafb; border-color: #e5e7eb; color: #6b7280; }
  &--info    { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
  &--success { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  &--error   { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
}

.s2-bulk__result { margin: 8px 15px 14px; padding: 11px 13px; border-radius: 6px; background: #f9fafb; border: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 3px;
  span { font-size: 10.5px; font-weight: 600; color: var(--mu); text-transform: uppercase; letter-spacing: .4px; }
  code { font-size: 11.5px; font-family: 'Cascadia Code','SF Mono',Consolas,monospace; color: var(--ink); word-break: break-word; }
}

/* ---- Animations ---- */
@keyframes s2-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes s2-spin { to { transform: rotate(360deg); } }

/* ---- Responsive ---- */
@media (max-width: 1120px) { .s2-main, .s2-bulk-grid, .s2-grid-2 { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .s2 { padding: 12px; } .s2-banner { grid-template-columns: 1fr; &__btns { .s2-btn { width: 100%; } } } }
</style>
