<template>
  <div class="s2">
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
      <!-- ═══ HERO HEADER ═══ -->
      <header class="s2-hd">
        <div class="s2-hd__left">
          <button class="s2-back-btn" @click="goBack"><AppIcon name="arrow-left" /></button>
          <div class="s2-hd__icon"><AppIcon name="package" /></div>
          <div class="s2-hd__text">
            <h1>{{ text(entry.title) }}</h1>
            <p>{{ text(entry.subtitle) }}</p>
          </div>
        </div>
        <div class="s2-hd__right">
          <div class="s2-pill" :class="executorHealth?.ok ? 's2-pill--on' : 's2-pill--off'">
            <span class="s2-pill__dot" :class="executorHealth?.ok ? 's2-pill__dot--on' : ''" />
            {{ executorHealth?.ok ? text('执行器就绪') : text('执行器未连接') }}
          </div>
          <span class="s2-tag"><AppIcon name="zap" /> InforNexus</span>
        </div>
      </header>

      <!-- ═══ HELPER BANNER ═══ -->
      <transition name="s2-alert-anim">
        <div v-if="showLocalHelperPrompt" class="s2-helper">
          <div class="s2-helper__icon"><AppIcon name="monitor-code" /></div>
          <div class="s2-helper__body">
            <strong>{{ text('未检测到本机自动化助手') }}</strong>
            <p>{{ text('请先启动 TOS 自动化助手，然后重新检测。') }}</p>
          </div>
          <div class="s2-helper__btns">
            <button class="s2-btn s2-btn--pri" @click="downloadAutomationHelper"><AppIcon name="download" />{{ text('下载助手') }}</button>
            <button class="s2-btn" @click="bootLocalHelper"><AppIcon name="play-circle" />{{ text('启动') }}</button>
            <button class="s2-btn" :disabled="refreshing" @click="refreshExecutorState(false)"><AppIcon name="refresh-cw" />{{ text('重新检测') }}</button>
          </div>
        </div>
      </transition>

      <!-- ═══ BODY ROW: Left Content + Right Dock ═══ -->
      <div class="s2-body">
        <!-- Left Column: Bulk Stage + Health Log -->
        <div class="s2-left">
          <!-- Bulk Cards -->
          <div class="s2-stage">
            <article v-for="(bulk, idx) in bulkAreas" :key="bulk.id" class="s2-bulk" :class="`s2-bulk--${bulk.id}`" :style="{ animationDelay: `${80 + idx * 80}ms` }">
              <div class="s2-bulk__hd">
                <div class="s2-bulk__hd-ico" :class="`s2-bulk__hd-ico--${bulk.id}`">
                  <AppIcon :name="bulk.id === 'unreleased' ? 'upload' : 'package'" />
                </div>
                <div class="s2-bulk__hd-text">
                  <strong>{{ text(bulk.label) }}</strong>
                  <small>{{ text('上传 PO No Excel 执行批量录入') }}</small>
                </div>
                <span v-if="bulk.result?.ok" class="s2-chip s2-chip--ok"><AppIcon name="check-circle" />{{ text('已完成') }}</span>
                <span v-else-if="bulk.running" class="s2-chip s2-chip--busy"><AppIcon name="loader" class="s2-spin" />{{ text('运行中') }}</span>
              </div>
              <div class="s2-bulk__body">
                <button class="s2-btn s2-btn--ghost" :disabled="templateLoading || !bulkTemplate(bulk.id)" @click="downloadBulkTemplate(bulk.id)">
                  <AppIcon name="download" />{{ bulkTemplate(bulk.id) ? text('下载模板') : text('暂无模板') }}
                </button>
                <div class="s2-drop" :class="{ 's2-drop--on': bulk.file, 's2-drop--over': bulk.dragging }"
                  @click="openBulkFilePicker(bulk.id)" @dragenter.prevent="handleBulkDragEnter(bulk.id, $event)" @dragover.prevent="handleBulkDragOver(bulk.id, $event)" @dragleave.prevent="handleBulkDragLeave(bulk.id, $event)" @drop.prevent="handleBulkDrop(bulk.id, $event)">
                  <input :ref="(el) => setBulkFileInputRef(bulk.id, el)" type="file" accept=".xlsx,.xls" @click.stop @change="handleBulkFileSelect(bulk.id, $event)" />
                  <template v-if="bulk.file">
                    <div class="s2-drop__ico s2-drop__ico--ok"><AppIcon name="check-circle" /></div>
                    <div class="s2-drop__info"><b>{{ bulk.file.name }}</b><small>{{ formatSize(bulk.file.size) }}</small></div>
                    <button class="s2-drop__x" @click.stop="clearBulkFile(bulk.id)"><AppIcon name="stop-circle" /></button>
                  </template>
                  <template v-else>
                    <div class="s2-drop__ico s2-drop__ico--float"><AppIcon name="upload" /></div>
                    <div class="s2-drop__info"><b>{{ text('拖拽或点击选择 Excel 文件') }}</b><small>.xlsx / .xls</small></div>
                  </template>
                  <div v-if="bulk.dragging" class="s2-drop__overlay">{{ text('释放以上传') }}</div>
                </div>
                <button class="s2-btn s2-btn--run" :class="`s2-btn--run-${bulk.id}`" :disabled="bulk.running || !bulk.file" @click="startBulkAutomation(bulk.id)">
                  <AppIcon :name="bulk.running ? 'loader' : 'play-circle'" :class="{ 's2-spin': bulk.running }" />
                  {{ bulk.running ? text('启动中...') : text('执行') }}
                </button>
                <div class="s2-bulk__status" :class="`s2-bulk__status--${bulk.tone}`">
                  <AppIcon :name="bulkStatusIcon(bulk)" />{{ text(bulk.statusText) }}
                </div>
                <div v-if="bulk.result" class="s2-bulk__result">
                  <span>Run ID</span>
                  <code>{{ bulk.result.runId }}</code>
                </div>
              </div>
            </article>
          </div>

          <!-- Health Log (full-width under stage) -->
          <details class="s2-log">
            <summary class="s2-log__hd">
              <AppIcon name="terminal" class="s2-log__hd-icon" />
              <span>{{ text('执行器健康日志') }}</span>
              <AppIcon name="chevron-down" class="s2-chev" />
            </summary>
            <pre class="s2-log__pre">{{ healthRaw }}</pre>
          </details>
        </div>

        <!-- ═══ RIGHT DOCK SIDEBAR ═══ -->
        <aside class="s2-dock">
          <!-- Executor Control -->
          <div class="s2-dock-card">
            <div class="s2-dock__hd">
              <AppIcon name="server" class="s2-dock__hd-icon" />
              <span>{{ text('执行器控制') }}</span>
              <span class="s2-dock__dot" :class="executorHealth?.ok ? 's2-dock__dot--on' : ''" />
            </div>
            <div class="s2-dock__bd">
              <button class="s2-btn s2-btn--pri s2-btn--full" :disabled="!canLaunchActiveApp" @click="startActiveApp(false)">
                <AppIcon name="play-circle" />{{ launching ? text('启动中...') : text('启动执行器') }}
              </button>
              <button class="s2-btn s2-btn--danger s2-btn--full" :disabled="!canStopActiveApp" @click="stopActiveApp">
                <AppIcon name="stop-circle" />{{ text('停止') }}
              </button>
              <button class="s2-btn s2-btn--full" :disabled="refreshing" @click="refreshExecutorState(false)">
                <AppIcon name="refresh-cw" :class="{ 's2-spin': refreshing }" />{{ text('刷新状态') }}
              </button>
            </div>
          </div>

          <!-- Credentials -->
          <div class="s2-dock-card s2-dock-card--flex">
            <div class="s2-dock__hd">
              <AppIcon name="shield-check" class="s2-dock__hd-icon" />
              <span>{{ text('登录凭据') }}</span>
              <span v-if="hasStoredCredentials" class="s2-chip s2-chip--ok">
                <AppIcon name="check-circle" />{{ text('已保存') }}
              </span>
            </div>
            <div class="s2-dock__bd">
              <div class="s2-dock__fields">
                <div class="s2-inp-wrap">
                  <AppIcon name="user" class="s2-inp-icon" />
                  <input v-model.trim="shippingUsername" class="s2-inp" type="text" placeholder="User ID" autocomplete="username" />
                </div>
                <div class="s2-inp-wrap">
                  <AppIcon name="shield-check" class="s2-inp-icon" />
                  <input v-model="shippingPassword" :type="showPassword ? 'text' : 'password'" class="s2-inp" placeholder="Password" autocomplete="current-password" />
                  <button class="s2-inp__btn" @click="showPassword = !showPassword"><AppIcon name="eye" /></button>
                </div>
              </div>
              <div class="s2-dock__row">
                <button class="s2-btn s2-btn--pri" :disabled="credentialSaving || !shippingUsername || !shippingPassword" @click="saveCurrentCredentials">
                  <AppIcon name="shield-check" />{{ credentialSaving ? text('保存中...') : text('保存') }}
                </button>
                <button class="s2-btn" :disabled="credentialClearing || !hasStoredCredentials" @click="clearCurrentCredentials">
                  {{ text('清除') }}
                </button>
              </div>
            </div>
          </div>
        </aside>
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
import { shippingAutomation2EntryId } from '../shippingAutomation2Model'

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
const shippingUsername = ref(''); const shippingPassword = ref(''); const showPassword = ref(false)
const message = ref(''); const messageTone = ref<WebAutomationNoticeTone>('info')
const bulkFileInputs = new Map<BulkId, HTMLInputElement>()
const bulkAreas = ref<BulkState[]>([
  { id: 'unreleased', label: 'Unreleased Bulk', file: null, dragging: false, dragDepth: 0, running: false, tone: 'idle', statusText: '等待选择 Excel 文件。', result: null },
  { id: 'released', label: 'Released Bulk', file: null, dragging: false, dragDepth: 0, running: false, tone: 'idle', statusText: '等待选择 Excel 文件。', result: null },
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
   Shipping 2 — v4 Right-Dock Sidebar Layout.
   Left: Bulk Stage (full-width) + Health Log.
   Right: 280px fixed sidebar (Executor + Credentials).
   Sky blue + Emerald. No purple. Framework icons only.
   ================================================================ */

.s2 {
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
.s2-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 14px 0 0; flex-shrink: 0;
  animation: s2-rise .45s cubic-bezier(.22,1,.36,1) both;
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
.s2-back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 11px;
  border: 1px solid var(--br); background: #fff; color: #64748b;
  cursor: pointer; transition: all .2s cubic-bezier(.22,1,.36,1);
  box-shadow: 0 1px 3px rgba(0,0,0,.04); flex-shrink: 0;
  :deep(.app-icon) { font-size: 14px; }
  &:hover { background: #f8fafc; color: var(--ink); transform: translateX(-2px); }
}

/* ─── Status Pill ─── */
.s2-pill {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; border-radius: 12px;
  font-size: 11px; font-weight: 700; transition: all .3s ease;
  &--on  { background: #ecfdf5; color: #047857; border: 1.5px solid #6ee7b7; box-shadow: 0 2px 8px rgba(5,150,105,.08); }
  &--off { background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca; }
  &__dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0;
    &--on { background: #10b981; box-shadow: 0 0 0 0 rgba(16,185,129,.35); animation: s2-pulse 2.5s ease infinite; }
  }
}
.s2-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px; border-radius: 9px;
  background: #f8fafc; border: 1px solid var(--br);
  font-size: 10px; font-weight: 600; color: #94a3b8;
  :deep(.app-icon) { font-size: 10px; color: #f59e0b; }
}

/* ═══ ALERT ═══ */
.s2-alert {
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
.s2-alert-anim-enter-active { transition: all .25s cubic-bezier(.22,1,.36,1); }
.s2-alert-anim-leave-active { transition: all .15s ease; }
.s2-alert-anim-enter-from, .s2-alert-anim-leave-to { opacity: 0; transform: translateY(-6px); }

/* ═══ HELPER BANNER ═══ */
.s2-helper {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px;
  padding: 14px 18px; border-radius: var(--r);
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fde68a; flex-shrink: 0;
  animation: s2-slideR .4s cubic-bezier(.22,1,.36,1) .08s both;
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

/* ═══ BODY ROW: LEFT + RIGHT DOCK ═══ */
.s2-body {
  display: grid; grid-template-columns: 1fr 260px; gap: 14px;
  flex: 1; min-height: 0;
}
.s2-left { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }

/* ═══ BULK STAGE ═══ */
.s2-stage {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  flex: 1; min-height: 0;
}

/* ─── Bulk Card ─── */
.s2-bulk {
  background: #fff; border: 1px solid var(--br); border-radius: var(--r);
  box-shadow: var(--sh); display: flex; flex-direction: column; overflow: hidden;
  animation: s2-rise .5s cubic-bezier(.22,1,.36,1) both;
  transition: all .25s cubic-bezier(.22,1,.36,1);
  &:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,.06); }
  &--unreleased { border-top: 4px solid var(--a); }
  &--released   { border-top: 4px solid var(--em); }
}
.s2-bulk__hd {
  display: flex; align-items: center; gap: 9px;
  padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
}
.s2-bulk__hd-ico {
  width: 38px; height: 38px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  :deep(.app-icon) { font-size: 16px; }
  &--unreleased { background: var(--a2); color: var(--a); }
  &--released   { background: var(--em2); color: var(--em); }
}
.s2-bulk__hd-text {
  display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;
  strong { font-size: 13px; font-weight: 700; }
  small { font-size: 10px; color: var(--mu); }
}
.s2-bulk__body {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px 18px; flex: 1; min-height: 0;
}

/* ─── Dropzone ─── */
.s2-drop {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 7px; flex: 1; min-height: 80px; padding: 20px 14px;
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
    &--float { animation: s2-float 3s ease-in-out infinite; }
  }
  &__info { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  &__x { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #fecaca; border-radius: 8px; background: #fff; color: #dc2626; cursor: pointer; flex-shrink: 0; transition: all .18s;
    :deep(.app-icon) { font-size: 12px; }
    &:hover { background: #fef2f2; border-color: #b91c1c; transform: translateY(-1px); }
  }
  &__overlay { position: absolute; inset: 4px; display: flex; align-items: center; justify-content: center; background: rgba(240,249,255,.92); border: 2px dashed var(--a); border-radius: 10px; font-size: 12px; font-weight: 700; color: var(--a); pointer-events: none; backdrop-filter: blur(4px); animation: s2-dashPulse .8s ease-in-out infinite alternate; }
}

/* ─── Status & Result ─── */
.s2-bulk__status {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 12px; border-radius: 10px;
  font-size: 11px; border: 1px solid; font-weight: 500;
  :deep(.app-icon) { font-size: 13px; flex-shrink: 0; }
  &--idle    { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
  &--info    { background: #f0f9ff; border-color: #7dd3fc; color: #0369a1; }
  &--success { background: #ecfdf5; border-color: #6ee7b7; color: #047857; }
  &--error   { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
}
.s2-bulk__result {
  padding: 10px 12px; border-radius: 10px;
  background: #f8fafc; border: 1px solid #f1f5f9;
  display: flex; flex-direction: column; gap: 3px;
  span { font-size: 9px; font-weight: 600; color: var(--mu); text-transform: uppercase; letter-spacing: .5px; }
  code { font-size: 10px; font-family: 'Cascadia Code','SF Mono',Consolas,monospace; color: var(--ink); word-break: break-word; }
}

/* ═══ HEALTH LOG (full-width under stage) ═══ */
.s2-log {
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

/* ═══ RIGHT DOCK SIDEBAR ═══ */
.s2-dock {
  display: flex; flex-direction: column; gap: 12px;
  min-height: 0; animation: s2-slideIn .45s cubic-bezier(.22,1,.36,1) .12s both;
}
.s2-dock-card {
  background: #fff; border: 1px solid var(--br); border-radius: var(--r);
  box-shadow: var(--sh); overflow: hidden;
  display: flex; flex-direction: column;
  transition: all .22s cubic-bezier(.22,1,.36,1);
  &:hover { box-shadow: 0 6px 20px rgba(0,0,0,.05); }
  &--flex { flex: 1; min-height: 0; }
}
.s2-dock__hd {
  display: flex; align-items: center; gap: 7px;
  padding: 12px 16px; font-size: 12px; font-weight: 700; color: var(--ink);
  border-bottom: 1px solid #f1f5f9;
  &-icon { font-size: 13px; color: var(--a); flex-shrink: 0; }
}
.s2-dock__dot {
  width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; margin-left: auto;
  &--on { background: #10b981; animation: s2-pulse 2.5s ease infinite; }
}
.s2-dock__bd { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.s2-dock__fields { display: flex; flex-direction: column; gap: 7px; margin-bottom: 6px; }
.s2-dock__row { display: flex; gap: 6px; }

/* ═══ INPUTS (with icon prefix) ═══ */
.s2-inp-wrap {
  position: relative; display: flex; align-items: center;
}
.s2-inp-icon {
  position: absolute; left: 10px; color: var(--mu); font-size: 14px; pointer-events: none; z-index: 1;
}
.s2-inp {
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

/* ═══ BUTTONS ═══ */
.s2-btn {
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
  &--ghost { align-self: flex-start; height: 30px; padding: 0 10px; font-size: 11px; border-radius: 8px; }
  &--full { width: 100%; }
  &--run {
    width: 100%; height: 40px; font-size: 13px; font-weight: 700; color: #fff;
    border-color: transparent; border-radius: 12px;
    :deep(.app-icon) { font-size: 14px; }
    &:hover:not(:disabled) { filter: brightness(1.06); }
  }
  &--run-unreleased { background: linear-gradient(135deg, var(--a), var(--ag)); box-shadow: 0 3px 12px rgba(14,165,233,.25); }
  &--run-released   { background: linear-gradient(135deg, var(--em), #047857); box-shadow: 0 3px 12px rgba(5,150,105,.25); }
}

/* ═══ CHIPS ═══ */
.s2-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px; font-size: 9px; font-weight: 700; flex-shrink: 0;
  :deep(.app-icon) { font-size: 9px; }
  &--ok   { background: #ecfdf5; color: #059669; }
  &--busy { background: #fffbeb; color: #d97706; }
}

/* ═══ EMPTY ═══ */
.s2-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 20px; text-align: center;
  &__icon { font-size: 36px; color: #d1d5db; }
  strong { font-size: 16px; }
  span { font-size: 13px; color: var(--mu); }
}
.s2-back { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; border: 1px solid var(--br); border-radius: 8px; background: #fff; color: #4b5563; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s;
  :deep(.app-icon) { font-size: 14px; }
  &:hover { background: #f8fafc; }
}

.s2-chev { transition: transform .25s; details[open] & { transform: rotate(180deg); } }
.s2-spin { animation: s2-spin .8s linear infinite; }

/* ═══ ANIMATIONS ═══ */
@keyframes s2-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes s2-slideR { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
@keyframes s2-slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
@keyframes s2-spin { to { transform: rotate(360deg); } }
@keyframes s2-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes s2-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.35); } 70% { box-shadow: 0 0 0 4px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
@keyframes s2-dashPulse { from { opacity: .7; } to { opacity: 1; border-color: #38bdf8; } }

/* ═══ RESPONSIVE ═══ */
@media (max-width: 1200px) { .s2-body { grid-template-columns: 1fr 220px; } }
@media (max-width: 960px) { .s2-body { grid-template-columns: 1fr; } .s2-stage { grid-template-columns: 1fr; } .s2-dock { flex-direction: row; } .s2-dock-card { flex: 1; &--flex { flex: 1; } } }
</style>

<!-- Override shell padding so this page fills edge-to-edge -->
<style>
.content-shell:has(.s2) {
  padding: 0 !important;
}
</style>
