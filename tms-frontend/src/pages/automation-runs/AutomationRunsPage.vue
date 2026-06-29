<template>
  <main class="runs-page">
    <!-- Header -->
    <header class="runs-header">
      <div class="header-title">
        <h2>{{ text('自动化执行档案') }}</h2>
        <p class="header-sub">{{ text('统一查看各自动化页面的执行批次、上传文件、结果文件和失败说明。') }}</p>
      </div>
      <div class="header-actions">
        <el-button class="btn btn-primary" :disabled="loading" :loading="loading" @click="loadRuns">
          <AppIcon name="refresh-cw" :class="{ spin: loading }" />
          {{ text('刷新记录') }}
        </el-button>
      </div>
    </header>

    <!-- Compact Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-chip">
        <span class="metric-dot dot--total"></span>
        <span class="metric-label">{{ text('当前筛选') }}</span>
        <span class="metric-value">{{ pagination.total }}</span>
      </div>
      <div class="metric-chip">
        <span class="metric-dot dot--success"></span>
        <span class="metric-label">{{ text('成功') }}</span>
        <span class="metric-value">{{ visibleSuccessCount }}</span>
      </div>
      <div class="metric-chip">
        <span class="metric-dot dot--failed"></span>
        <span class="metric-label">{{ text('失败') }}</span>
        <span class="metric-value">{{ visibleFailedCount }}</span>
      </div>
      <div class="metric-chip">
        <span class="metric-dot dot--running"></span>
        <span class="metric-label">{{ text('执行中') }}</span>
        <span class="metric-value">{{ visibleRunningCount }}</span>
      </div>
    </div>

    <!-- Toolbar with Custom Dropdowns -->
    <div class="runs-toolbar">
      <div class="toolbar-filters">
        <!-- Custom Dropdown: 自动化页面 -->
        <div class="custom-select">
          <el-select
            v-model="filters.automationId"
            clearable
            filterable
            :placeholder="text('全部页面')"
            @change="selectModule"
          >
            <el-option :label="text('全部页面')" value="" />
            <el-option
              v-for="module in automationModules"
              :key="module.id"
              :label="module.navLabel"
              :value="module.id"
            />
          </el-select>
        </div>

        <!-- Custom Dropdown: 状态 -->
        <div class="custom-select">
          <el-select
            v-model="filters.status"
            clearable
            :placeholder="text('全部状态')"
            @change="selectStatus"
          >
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>

        <!-- Keyword Input -->
        <div class="keyword-input">
          <el-input
            v-model.trim="filters.keyword"
            :placeholder="text('Run ID / 文件 / 错误说明')"
            clearable
            @keyup.enter="reloadFirstPage"
          >
            <template #prefix>
              <AppIcon name="file-search" class="keyword-icon" />
            </template>
          </el-input>
        </div>
      </div>
      <el-button class="btn" :disabled="loading" @click="reloadFirstPage">
        <AppIcon name="file-search" />
        {{ text('查询') }}
      </el-button>
    </div>

    <!-- Error -->
    <Transition name="fade">
      <div v-if="errorMessage" class="runs-error">
        <AppIcon name="alert-circle" />
        <span>{{ errorMessage }}</span>
      </div>
    </Transition>

    <!-- Main Grid: List + Detail -->
    <div class="runs-grid">
      <!-- Left: Run List -->
      <section class="card list-card">
        <div class="card-head">
          <strong>{{ text('执行批次') }}</strong>
          <span class="badge">{{ runs.length }} / {{ pagination.total }}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ text('执行时间') }}</th>
                <th>{{ text('自动化页面') }}</th>
                <th>{{ text('状态') }}</th>
                <th>{{ text('说明') }}</th>
                <th>{{ text('耗时') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(run, index) in runs"
                :key="run.runId"
                :class="{ selected: selectedRun?.runId === run.runId }"
                class="row-enter"
                :style="{ animationDelay: `${index * 0.025}s` }"
                @click="selectRun(run)"
              >
                <td>
                  <span class="cell-date">{{ formatDate(run.startedAt || run.createdAt) }}</span>
                  <span class="cell-id">{{ run.runId }}</span>
                </td>
                <td><span class="tag">{{ moduleLabel(run.automationId) }}</span></td>
                <td>
                  <el-tag class="pill" :class="`pill--${run.status}`" disable-transitions>
                    {{ statusLabel(run.status) }}
                  </el-tag>
                </td>
                <td class="cell-msg"><span class="msg-trunc" :title="run.message ? text(run.message) : '-'">{{ run.message ? text(run.message) : '-' }}</span></td>
                <td><span class="cell-dur">{{ durationLabel(run) }}</span></td>
              </tr>
              <tr v-if="!runs.length && !loading">
                <td colspan="5" class="empty-cell">
                  <AppIcon name="inbox" class="empty-icon" />
                  <p>{{ text('暂无执行记录') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-foot">
          <el-button class="pager-btn" :disabled="loading || pagination.page <= 1" @click="goPage(pagination.page - 1)">
            <AppIcon name="chevron-left" />
          </el-button>
          <span class="pager-num">{{ text('第') }} <b>{{ pagination.page }}</b> {{ text('页') }}</span>
          <el-button class="pager-btn" :disabled="loading || pagination.page * pagination.pageSize >= pagination.total" @click="goPage(pagination.page + 1)">
            <AppIcon name="chevron-right" />
          </el-button>
        </div>
      </section>

      <!-- Right: Detail -->
      <section class="card detail-card">
        <div class="card-head">
          <strong>{{ text('执行详情') }}</strong>
          <span v-if="detailLoading" class="loading-hint"><AppIcon name="loader" class="spin" /> {{ text('读取中...') }}</span>
        </div>
        <div class="detail-body">
          <template v-if="selectedRun">
            <!-- Detail Grid -->
            <div class="detail-grid">
              <div class="ditem">
                <small>{{ text('自动化页面') }}</small>
                <b>{{ moduleLabel(selectedRun.automationId) }}</b>
              </div>
              <div class="ditem">
                <small>{{ text('状态') }}</small>
                <el-tag class="pill" :class="`pill--${selectedRun.status}`" disable-transitions>
                  {{ statusLabel(selectedRun.status) }}
                </el-tag>
              </div>
              <div class="ditem">
                <small>{{ text('开始时间') }}</small>
                <b class="mono">{{ formatDate(selectedRun.startedAt || selectedRun.createdAt) }}</b>
              </div>
              <div class="ditem">
                <small>{{ text('结束时间') }}</small>
                <b class="mono">{{ formatDate(selectedRun.finishedAt) || '-' }}</b>
              </div>
            </div>

            <!-- Message -->
            <div class="msg-box" :class="`msg--${selectedRun.status}`">
              <AppIcon :name="selectedRun.status === 'failed' ? 'alert-circle' : 'info'" class="msg-icon" />
              <span>{{ selectedRun.message ? text(selectedRun.message) : text('无执行说明。') }}</span>
            </div>

            <!-- Files -->
            <div class="files-block">
              <strong class="block-title">{{ text('归档文件') }}</strong>
              <div class="file-list">
                <el-button
                  v-for="file in selectedFiles"
                  :key="file.id"
                  class="file-item"
                  @click="downloadFile(file)"
                >
                  <span class="file-icon-wrap"><AppIcon name="file-text" /></span>
                  <span class="file-info">
                    <b :title="file.originalFilename || file.fileRole">{{ file.originalFilename || file.fileRole }}</b>
                    <small>{{ fileRoleLabel(file.fileRole) }} · {{ formatSize(file.fileSize) }}</small>
                  </span>
                  <AppIcon name="download" class="dl-icon" />
                </el-button>
                <div v-if="!selectedFiles.length" class="empty-inline">
                  <AppIcon name="file-minus" /> {{ text('暂无归档文件') }}
                </div>
              </div>
            </div>

            <!-- JSON -->
            <div class="json-block">
              <strong class="block-title">{{ text('执行 JSON') }}</strong>
              <div class="json-box">
                <pre><code>{{ prettyJson(selectedRun.result) }}</code></pre>
              </div>
            </div>
          </template>
          <div v-else class="empty-detail">
            <div class="empty-detail-inner">
              <AppIcon name="cpu" class="empty-big-icon" />
              <h3>{{ text('未选择执行记录') }}</h3>
              <p>{{ text('请在左侧列表中选择一条记录，以查看源文件、结果文件和错误详情。') }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import { showAppAlert } from '../../shared/ui/appAlert'
import { tosModules } from '../../domain/moduleCatalog'
import { webAutomationEntries } from '../web-automation/webAutomationModel'
import {
  downloadAutomationRunFile,
  fetchAutomationRunDetail,
  fetchAutomationRuns,
  type AutomationRunFileRecord,
  type AutomationRunRecord,
} from '../web-automation/webAutomationApi'

// ---- State ----
const loading = ref(false)
const detailLoading = ref(false)
const errorMessage = ref('')
const route = useRoute()
const { isEnglish, text } = useAppLanguage()
const runs = ref<AutomationRunRecord[]>([])
const selectedRun = ref<AutomationRunRecord | null>(null)
const selectedFiles = ref<AutomationRunFileRecord[]>([])
const pagination = reactive({ page: 1, pageSize: 30, total: 0 })
const filters = reactive({ automationId: readAutomationIdQuery(route.query.automationId), status: '', keyword: '' })

interface AutomationRunFilterOption {
  id: string
  navLabel: string
  order: number
}

const statusOptions = computed(() => [
  { value: '', label: text('全部状态') },
  { value: 'running', label: text('执行中') },
  { value: 'success', label: text('成功') },
  { value: 'failed', label: text('失败') },
  { value: 'canceled', label: text('已取消') },
])

const automationRunFilterIds = new Set<string>([
  'shipping-automation',
  'xinlongtai-shipping-automation',
  'tc-inv-automation',
  'po-auto-download',
  'packing-list-auto-download',
  'shipping-automation-2',
  'infornexus-auto-add',
  'microsoft-login-n8n',
  'ticket-owner-statistics',
])

function selectModule(id: string) {
  filters.automationId = id
  reloadFirstPage()
}
function selectStatus(value: string) {
  filters.status = value
  reloadFirstPage()
}

onMounted(() => {
  void loadRuns()
})

// ---- Computed ----
const automationModules = computed<AutomationRunFilterOption[]>(() => {
  const catalogOptions = tosModules
    .filter((module) => automationRunFilterIds.has(module.id))
    .map((module) => ({
      id: module.id,
      navLabel: isEnglish.value ? module.navLabelEn : module.navLabel,
      order: module.order,
    }))
  const catalogIds = new Set<string>(catalogOptions.map((module) => module.id))
  const scenarioOptions = webAutomationEntries
    .filter((entry) => automationRunFilterIds.has(entry.id) && !catalogIds.has(entry.id))
    .map((entry, index) => ({
      id: entry.id,
      navLabel: text(entry.title),
      order: 100 + index,
    }))
  return [...catalogOptions, ...scenarioOptions].sort((left, right) => left.order - right.order)
})
const visibleSuccessCount = computed(() => runs.value.filter((run) => run.status === 'success').length)
const visibleFailedCount = computed(() => runs.value.filter((run) => run.status === 'failed').length)
const visibleRunningCount = computed(() => runs.value.filter((run) => run.status === 'running').length)

watch(
  () => route.query.automationId,
  (value) => {
    const nextAutomationId = readAutomationIdQuery(value)
    if (nextAutomationId !== filters.automationId) {
      filters.automationId = nextAutomationId
      reloadFirstPage()
    }
  },
)

// ---- Data ----
async function loadRuns(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await fetchAutomationRuns({
      automationId: filters.automationId || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    runs.value = payload.runs
    Object.assign(pagination, payload.pagination)
    if (runs.value.length && !selectedRun.value) {
      await selectRun(runs.value[0])
    }
  } catch (error) {
    errorMessage.value = text(readErrorMessage(error, '无法读取自动化执行记录，请确认本地后端和远程 MySQL 数据库连接正常。'))
    runs.value = []
    selectedRun.value = null
    selectedFiles.value = []
    Object.assign(pagination, { ...pagination, total: 0 })
  } finally {
    loading.value = false
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function reloadFirstPage(): void {
  pagination.page = 1
  selectedRun.value = null
  selectedFiles.value = []
  void loadRuns()
}

function goPage(page: number): void {
  pagination.page = page
  selectedRun.value = null
  selectedFiles.value = []
  void loadRuns()
}

function readAutomationIdQuery(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return ''
}

async function selectRun(run: AutomationRunRecord): Promise<void> {
  selectedRun.value = run
  selectedFiles.value = []
  detailLoading.value = true
  try {
    const detail = await fetchAutomationRunDetail(run.runId)
    selectedRun.value = detail.run
    selectedFiles.value = detail.files
  } finally {
    detailLoading.value = false
  }
}

async function downloadFile(file: AutomationRunFileRecord): Promise<void> {
  try {
    await downloadAutomationRunFile(file)
  } catch (error) {
    void showAppAlert(text(readErrorMessage(error, '执行文件下载失败。')), { tone: 'warning' })
  }
}

// ---- Helpers ----
function moduleLabel(automationId: string): string {
  return (
    automationModules.value.find((module) => module.id === automationId)?.navLabel ||
    getCatalogModuleLabel(automationId) ||
    getScenarioLabel(automationId) ||
    automationId
  )
}

function getCatalogModuleLabel(automationId: string): string {
  const module = tosModules.find((item) => item.id === automationId)
  if (!module) return ''
  return isEnglish.value ? module.navLabelEn : module.navLabel
}

function getScenarioLabel(automationId: string): string {
  const entry = webAutomationEntries.find((item) => item.id === automationId)
  return entry ? text(entry.title) : ''
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    running: '执行中', success: '成功', failed: '失败', canceled: '已取消',
  }
  return map[status] ? text(map[status]) : status || ''
}
function fileRoleLabel(role: string): string {
  const map: Record<string, string> = {
    source_excel: '上传 Excel', result_excel: '结果 Excel', result_json: '结果 JSON',
    failed_rows_excel: '失败明细', screenshot: '截图', log: '日志',
  }
  return map[role] ? text(map[role]) : role
}
function formatDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(isEnglish.value ? 'en-US' : 'zh-CN', { hour12: false })
}
function durationLabel(run: AutomationRunRecord): string {
  if (!run.startedAt || !run.finishedAt) return '-'
  const started = new Date(run.startedAt).getTime()
  const finished = new Date(run.finishedAt).getTime()
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return '-'
  const seconds = Math.round((finished - started) / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
function formatSize(size: number): string {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
function prettyJson(value: unknown): string {
  if (value == null) return '{}'
  return JSON.stringify(value, null, 2)
}
</script>

<style scoped>
/* ==========================================================================
   Runs Page — Compact Professional Layout
   Palette: Teal (#0d9488) + Blue (#3b82f6) | White cards | Thin borders
   Zero purple. Zero glassmorphism.
   ========================================================================== */

.runs-page {
  --teal: #0d9488;
  --teal-600: #0f766e;
  --teal-400: #2dd4bf;
  --teal-50: #f0fdfa;
  --blue: #3b82f6;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-700: #334155;
  --slate-900: #0f172a;
  --white: #ffffff;
  --red-50: #fef2f2;
  --red-100: #fee2e2;
  --red-200: #fecaca;
  --red-600: #dc2626;
  --red-700: #b91c1c;
  --green-50: #f0fdf4;
  --green-100: #dcfce7;
  --green-200: #bbf7d0;
  --green-600: #059669;
  --green-700: #047857;
  --amber-50: #fffbeb;
  --amber-600: #d97706;
  --sky-50: #f0f9ff;
  --sky-100: #e0f2fe;
  --sky-600: #0284c7;
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --shadow-xs: 0 1px 2px rgba(0,0,0,.03);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.03);
  --shadow-md: 0 4px 12px rgba(0,0,0,.05), 0 1px 4px rgba(0,0,0,.04);
  --transition: 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);

  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 12px 16px;
  color: var(--slate-900);
  background: linear-gradient(180deg, #f5f8fb 0%, #eef7f6 100%);
  overflow: visible;
  box-sizing: border-box;
}

/* ---- Animations ---- */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes spin { 100% { transform: rotate(360deg); } }

.spin { animation: spin 1s linear infinite; }

/* ---- Transitions ---- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dropdown-enter-active { animation: scaleIn 0.18s cubic-bezier(0.22, 0.61, 0.36, 1); }
.dropdown-leave-active { animation: scaleIn 0.12s cubic-bezier(0.22, 0.61, 0.36, 1) reverse; }

/* ---- Scrollbar ---- */
.runs-page ::-webkit-scrollbar { width: 5px; height: 5px; }
.runs-page ::-webkit-scrollbar-track { background: transparent; }
.runs-page ::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 10px; }
.runs-page ::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

/* ==========================================================================
   Header
   ========================================================================== */
.runs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.header-title h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--slate-900);
  padding-left: 14px;
  position: relative;
  line-height: 1.25;
}
.header-title h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 24px;
  background: linear-gradient(180deg, var(--teal), var(--blue));
  border-radius: 4px;
}
.header-sub {
  margin: 3px 0 0 14px;
  font-size: 12px;
  color: var(--slate-500);
  font-weight: 500;
}
.header-actions { flex-shrink: 0; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--slate-700);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
}
.btn :deep(.el-button__content) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn:hover:not(:disabled) {
  background: var(--teal-50);
  border-color: #99f6e4;
  color: var(--teal);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(13,148,136,.1);
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--teal), var(--teal-600));
  border-color: var(--teal-600);
  box-shadow: 0 2px 8px rgba(13,148,136,.25);
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #14b8a6, var(--teal));
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(13,148,136,.35);
}

/* ==========================================================================
   Metrics Bar — Compact horizontal capsule row
   ========================================================================== */
.metrics-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.05s both;
}
.metric-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
  transition: all var(--transition);
  cursor: default;
}
.metric-chip:hover {
  border-color: var(--slate-300);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.metric-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--total   { background: var(--slate-400); }
.dot--success { background: var(--green-600); box-shadow: 0 0 0 3px rgba(5,150,105,.12); }
.dot--failed  { background: var(--red-600); box-shadow: 0 0 0 3px rgba(220,38,38,.12); }
.dot--running { background: var(--sky-600); box-shadow: 0 0 0 3px rgba(2,132,199,.12); animation: pulse-dot 2s infinite; }
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(2,132,199,.2); }
  50%      { box-shadow: 0 0 0 6px rgba(2,132,199,0); }
}
.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-400);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.metric-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--slate-900);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* ==========================================================================
   Toolbar
   ========================================================================== */
.runs-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255,255,255,.85);
  border: 1px solid rgba(226,232,240,.7);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.02), 0 4px 12px rgba(0,0,0,.02);
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.1s both;
  position: relative;
  z-index: 10;
}
.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

/* ---- Custom Select ---- */
.custom-select {
  position: relative;
  flex-shrink: 0;
}
.custom-select :deep(.el-select) {
  min-width: 140px;
}
.custom-select :deep(.el-select__wrapper) {
  min-height: 34px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  box-shadow: none;
  transition: all var(--transition);
}
.custom-select :deep(.el-select__wrapper:hover) {
  background: var(--white);
  box-shadow: 0 0 0 1px #99f6e4 inset;
}
.custom-select :deep(.el-select__selected-item),
.custom-select :deep(.el-select__placeholder) {
  color: var(--slate-700);
  font-size: 12px;
  font-weight: 600;
}
.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 140px;
  height: 34px;
  padding: 0 10px 0 12px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-700);
  cursor: pointer;
  transition: all var(--transition);
}
.select-trigger:hover {
  border-color: #99f6e4;
  background: var(--white);
}
.select-trigger:focus-visible {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(13,148,136,.1);
}
.trigger-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trigger-chevron {
  width: 14px;
  height: 14px;
  color: var(--slate-400);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.trigger-chevron.open {
  transform: rotate(180deg);
}
.select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  min-width: 100%;
  max-height: 260px;
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.06);
  padding: 4px;
}
.select-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.select-option:hover {
  background: #f0fdfa;
  color: #0d9488;
}
.select-option.active {
  background: linear-gradient(135deg, rgba(13,148,136,.1), rgba(59,130,246,.06));
  color: #0d9488;
  font-weight: 700;
}

/* ---- Keyword Input ---- */
.keyword-input {
  position: relative;
  flex: 1;
  min-width: 160px;
  max-width: 320px;
}
.keyword-input :deep(.el-input__wrapper) {
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  box-shadow: none;
  transition: all var(--transition);
  box-sizing: border-box;
}
.keyword-input :deep(.el-input__wrapper:hover) {
  background: var(--white);
  box-shadow: 0 0 0 1px #99f6e4 inset;
}
.keyword-input :deep(.el-input__wrapper.is-focus) {
  background: var(--white);
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(13,148,136,.08);
}
.keyword-input :deep(.el-input__inner) {
  color: var(--slate-900);
  font-size: 12px;
  font-weight: 500;
}
.keyword-input :deep(.el-input__inner::placeholder) {
  color: var(--slate-400);
  font-weight: 400;
}
.keyword-icon {
  width: 14px;
  height: 14px;
  color: var(--slate-400);
}
.keyword-input input {
  width: 100%;
  height: 34px;
  padding: 0 10px 0 30px;
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-sm);
  background: var(--slate-50);
  color: var(--slate-900);
  font-size: 12px;
  font-weight: 500;
  outline: none;
  transition: all var(--transition);
  box-sizing: border-box;
}
.keyword-input input::placeholder { color: var(--slate-400); font-weight: 400; }
.keyword-input input:hover { border-color: #99f6e4; background: var(--white); }
.keyword-input input:focus {
  border-color: var(--teal);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(13,148,136,.08);
}

/* ==========================================================================
   Error
   ========================================================================== */
.runs-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--red-50), var(--red-100));
  border: 1px solid var(--red-200);
  border-radius: 10px;
  color: var(--red-700);
  font-size: 13px;
  font-weight: 600;
  position: relative;
}
.runs-error::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #ef4444, var(--red-600));
  border-radius: 3px 0 0 3px;
}

/* ==========================================================================
   Grid: List + Detail
   ========================================================================== */
.runs-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(340px, 1fr);
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  animation: fadeInUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.15s both;
}

/* ---- Card ---- */
.card {
  display: flex;
  flex-direction: column;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(0,0,0,.03), 0 4px 16px rgba(0,0,0,.02);
  overflow: hidden;
  transition: box-shadow 0.3s ease;
}
.card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,.04), 0 12px 32px rgba(37,102,139,.06);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--slate-100);
  background: rgba(248,250,252,.6);
}
.card-head strong {
  font-size: 13px;
  font-weight: 700;
  color: var(--slate-900);
}
.badge {
  padding: 3px 10px;
  background: linear-gradient(135deg, var(--teal-50), #ecfdf5);
  color: var(--teal);
  border: 1px solid #a7f3d0;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.loading-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--teal);
  font-weight: 600;
}

/* ---- Table ---- */
.table-wrap {
  flex: 1;
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
th {
  padding: 9px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-400);
  background: rgba(248,250,252,.9);
  position: sticky;
  top: 0;
  z-index: 10;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(226,232,240,.5);
  vertical-align: middle;
}
tbody tr {
  cursor: pointer;
  transition: background 0.18s ease, box-shadow 0.18s ease;
}
tbody tr:hover {
  background: rgba(240,253,250,.4);
}
tbody tr.selected {
  background: linear-gradient(135deg, rgba(13,148,136,.06), rgba(59,130,246,.04));
  box-shadow: inset 3px 0 0 var(--teal);
}

.row-enter {
  animation: slideIn 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.cell-date {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-900);
}
.cell-id {
  display: block;
  font-family: 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  color: var(--slate-400);
  margin-top: 1px;
}
.tag {
  display: inline-flex;
  padding: 3px 8px;
  background: var(--slate-100);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-500);
}
.pill {
  display: inline-flex;
  align-items: center;
  height: auto;
  padding: 3px 10px;
  border: 0;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.pill--success  { background: var(--green-100); color: var(--green-600); }
.pill--failed   { background: var(--red-100); color: var(--red-600); }
.pill--running  { background: var(--sky-100); color: var(--sky-600); }
.pill--canceled { background: var(--slate-100); color: var(--slate-500); }

.cell-msg { max-width: 240px; }
.msg-trunc {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--slate-500);
}
.cell-dur {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--slate-400);
}
.empty-cell {
  text-align: center;
  padding: 56px 20px;
  color: var(--slate-400);
}
.empty-icon { width: 40px; height: 40px; opacity: 0.15; margin-bottom: 8px; }

/* ---- Card Foot (Pager) ---- */
.card-foot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--slate-100);
  gap: 10px;
  background: rgba(248,250,252,.6);
}
.pager-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--slate-200);
  border-radius: 7px;
  background: var(--white);
  cursor: pointer;
  transition: all var(--transition);
  color: var(--slate-700);
  padding: 0;
}
.pager-btn:hover:not(:disabled) {
  background: var(--teal-50);
  color: var(--teal);
  border-color: #99f6e4;
}
.pager-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pager-num { font-size: 12px; color: var(--slate-400); }
.pager-num b { color: var(--slate-700); font-weight: 700; }

/* ==========================================================================
   Detail Card
   ========================================================================== */
.detail-card {
  position: sticky;
  top: 0;
  height: 100%;
}
.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Detail Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: 10px;
}
.ditem {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ditem small {
  font-size: 10px;
  color: var(--slate-400);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}
.ditem b {
  font-size: 12px;
  color: var(--slate-900);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

/* Message Box */
.msg-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.55;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
}
.msg--failed {
  background: linear-gradient(135deg, var(--red-50), var(--red-100));
  border-color: var(--red-200);
  color: var(--red-700);
}
.msg--success {
  background: linear-gradient(135deg, var(--green-50), var(--green-100));
  border-color: var(--green-200);
  color: var(--green-700);
}
.msg-icon { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

/* Block Titles */
.block-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--slate-900);
  margin-bottom: 8px;
}

/* Files */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: var(--white);
  border: 1px solid var(--slate-200);
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition);
}
.file-item :deep(.el-button__content) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.file-item:hover {
  border-color: #99f6e4;
  background: var(--teal-50);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(13,148,136,.06);
}
.file-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--teal-50);
  color: var(--teal);
  border-radius: 7px;
  font-size: 15px;
  flex-shrink: 0;
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-info b {
  display: block;
  font-size: 12px;
  color: var(--slate-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-info small {
  font-size: 10px;
  color: var(--slate-400);
}
.dl-icon {
  width: 15px;
  height: 15px;
  color: var(--slate-300);
  transition: all 0.2s;
  flex-shrink: 0;
}
.file-item:hover .dl-icon { color: var(--teal); }
.empty-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--slate-400);
  font-size: 12px;
  padding: 10px 14px;
  background: var(--slate-50);
  border-radius: 8px;
  border: 1px dashed var(--slate-200);
}

/* JSON Block */
.json-box {
  background: #0f172a;
  border-radius: 10px;
  padding: 12px;
  overflow: auto;
  max-height: 260px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,.15);
}
.json-box pre {
  margin: 0;
  font-family: 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  color: #38bdf8;
}

/* Empty Detail */
.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 320px;
}
.empty-detail-inner {
  text-align: center;
  color: var(--slate-400);
  max-width: 220px;
}
.empty-big-icon {
  width: 52px;
  height: 52px;
  opacity: 0.08;
  margin-bottom: 12px;
}
.empty-detail-inner h3 {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--slate-900);
}
.empty-detail-inner p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

/* ==========================================================================
   Responsive
   ========================================================================== */
@media (max-width: 1200px) {
  .runs-grid {
    grid-template-columns: 1fr;
  }
  .detail-card {
    position: static;
  }
}
@media (max-width: 900px) {
  .runs-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-filters {
    flex-wrap: wrap;
  }
  .custom-select { flex: 1; min-width: 130px; }
  .select-trigger { min-width: 0; width: 100%; }
  .keyword-input { max-width: none; flex: 2; min-width: 140px; }
}
@media (max-width: 768px) {
  .runs-page { padding: 8px 10px; gap: 8px; }
  .runs-header { flex-direction: column; align-items: flex-start; }
  .header-title h2 { font-size: 20px; }
  .metrics-bar { gap: 6px; }
  .metric-chip { padding: 6px 10px; }
  .metric-value { font-size: 16px; }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
