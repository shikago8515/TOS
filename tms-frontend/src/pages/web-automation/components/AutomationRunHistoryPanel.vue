<template>
  <button ref="triggerRef" class="run-history-trigger" type="button" @click="openDrawer">
    <span class="run-history-trigger__icon">
      <AppIcon name="database" />
    </span>
    <span class="run-history-trigger__text">
      <b>{{ text('执行记录') }}</b>
      <small>{{ triggerSummary }}</small>
    </span>
    <AppIcon name="chevron-right" />
  </button>

  <Teleport to="body">
    <transition name="run-history-fade">
      <div v-if="drawerOpen" class="run-history-overlay" @click="closeDrawer" />
    </transition>

    <transition name="run-history-slide">
      <aside v-if="drawerOpen" class="run-history-drawer" :style="drawerThemeStyle" role="dialog" aria-modal="true" :aria-label="text('执行记录')">
        <header class="run-history-drawer__head">
          <div>
            <p>Automation Runs</p>
            <h2>{{ text('执行记录') }}</h2>
            <span>{{ text('查看本页面最近') }} {{ runs.length }} {{ text('次执行、源文件和结果归档。') }}</span>
          </div>
          <button class="run-history-icon-btn" type="button" @click="closeDrawer">
            <AppIcon name="x" />
          </button>
        </header>

        <div class="run-history-drawer__toolbar">
          <button class="run-history-action" type="button" :disabled="loading" @click="loadRuns">
            <AppIcon name="refresh-cw" :class="{ spin: loading }" />
            {{ text('刷新') }}
          </button>
          <button class="run-history-action run-history-action--primary" type="button" @click="openAllRuns">
            <AppIcon name="external-link" />
            {{ text('全部记录') }}
          </button>
        </div>

        <div v-if="runs.length" class="run-history-list">
          <button
            v-for="run in runs"
            :key="run.runId"
            class="run-history-row"
            :class="{ 'run-history-row--active': expandedRunId === run.runId }"
            type="button"
            @click="toggleRun(run)"
          >
            <span class="run-history-row__status" :class="`run-history-row__status--${run.status}`" />
            <span class="run-history-row__main">
              <b>{{ run.message ? text(run.message) : statusLabel(run.status) }}</b>
              <small>{{ formatDate(run.startedAt || run.createdAt) }} · {{ run.runId }}</small>
            </span>
            <em>{{ statusLabel(run.status) }}</em>
          </button>
        </div>
        <div v-else class="run-history-empty">
          {{ loading ? text('正在读取执行记录...') : text('暂无执行记录') }}
        </div>

        <section class="run-history-files">
          <div class="run-history-files__head">
            <strong>{{ text('归档文件') }}</strong>
            <span v-if="expandedRunId">{{ expandedRunId }}</span>
            <span v-else>{{ text('选择一条记录查看文件') }}</span>
          </div>
          <div v-if="detailLoading" class="run-history-empty">{{ text('正在读取归档文件...') }}</div>
          <template v-else-if="files.length">
            <button v-for="file in files" :key="file.id" class="run-history-file" type="button" @click="downloadFile(file)">
              <AppIcon name="download" />
              <span>
                <b>{{ fileRoleLabel(file.fileRole) }}</b>
                <small>{{ file.originalFilename || file.fileRole }}</small>
              </span>
            </button>
          </template>
          <div v-else class="run-history-empty">{{ text('该记录暂无归档文件') }}</div>
        </section>
      </aside>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import { showAppAlert } from '../../../shared/ui/appAlert'
import {
  downloadAutomationRunFile,
  fetchAutomationRunDetail,
  fetchAutomationRuns,
  type AutomationRunFileRecord,
  type AutomationRunRecord,
} from '../webAutomationApi'

const props = withDefaults(defineProps<{
  automationId: string
  pageSize?: number
  refreshSignal?: unknown
}>(), {
  pageSize: 8,
})

defineExpose({ refresh: loadRuns })

const router = useRouter()
const { isEnglish, text } = useAppLanguage()
const triggerRef = ref<HTMLElement | null>(null)
const drawerThemeStyle = ref<Record<string, string>>({})
const drawerOpen = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const runs = ref<AutomationRunRecord[]>([])
const files = ref<AutomationRunFileRecord[]>([])
const expandedRunId = ref('')

const triggerSummary = computed(() => {
  if (loading.value) return text('同步中')
  if (!runs.value.length) return text('暂无记录')
  const latest = runs.value[0]
  return `${statusLabel(latest.status)} · ${formatDate(latest.startedAt || latest.createdAt)}`
})

onMounted(() => {
  void loadRuns()
})

watch(() => props.automationId, () => {
  expandedRunId.value = ''
  files.value = []
  void loadRuns()
})

watch(() => props.refreshSignal, () => {
  void loadRuns()
})

async function loadRuns(): Promise<void> {
  if (!props.automationId) return
  loading.value = true
  try {
    const payload = await fetchAutomationRuns({
      automationId: props.automationId,
      page: 1,
      pageSize: props.pageSize,
    })
    runs.value = payload.runs
  } finally {
    loading.value = false
  }
}

function openDrawer(): void {
  syncDrawerTheme()
  drawerOpen.value = true
  void loadRuns()
}

function closeDrawer(): void {
  drawerOpen.value = false
}

async function toggleRun(run: AutomationRunRecord): Promise<void> {
  if (expandedRunId.value === run.runId) {
    expandedRunId.value = ''
    files.value = []
    return
  }
  expandedRunId.value = run.runId
  detailLoading.value = true
  try {
    const detail = await fetchAutomationRunDetail(run.runId)
    files.value = detail.files
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

function openAllRuns(): void {
  closeDrawer()
  void router.push({ path: '/automation-runs', query: { automationId: props.automationId } })
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    running: '执行中',
    success: '成功',
    failed: '失败',
    canceled: '已取消',
  }
  return labels[status] ? text(labels[status]) : status || '-'
}

function fileRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    source_excel: '上传 Excel',
    result_excel: '结果 Excel',
    result_json: '结果 JSON',
    failed_rows_excel: '失败明细',
    failed_rows_json: '失败 JSON',
    screenshot: '截图',
    log: '日志',
  }
  return labels[role] ? text(labels[role]) : role
}

function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(isEnglish.value ? 'en-US' : 'zh-CN', { hour12: false })
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function syncDrawerTheme(): void {
  const element = triggerRef.value
  if (!element) return
  const style = window.getComputedStyle(element)
  const themeVars = ['--a', '--a2', '--ag', '--br', '--mu', '--ink', '--em', '--red', '--sh', '--r']
  drawerThemeStyle.value = themeVars.reduce<Record<string, string>>((theme, key) => {
    const value = style.getPropertyValue(key).trim()
    if (value) theme[key] = value
    return theme
  }, {})
}
</script>

<style scoped>
.run-history-trigger,
.run-history-drawer {
  --history-accent: var(--a, #0ea5e9);
  --history-accent-strong: var(--ag, #0284c7);
  --history-soft: var(--a2, #e0f2fe);
  --history-border: var(--br, #e2e8f0);
  --history-muted: var(--mu, #7c8db5);
  --history-ink: var(--ink, #1e293b);
  --history-success: var(--em, #059669);
  --history-danger: var(--red, #dc2626);
  --history-radius: min(var(--r, 12px), 12px);
  --history-shadow: var(--sh, 0 2px 12px rgba(0,0,0,.04));
}
.run-history-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  min-height: 38px;
  padding: 6px 11px 6px 7px;
  border: 1px solid var(--history-border);
  border-radius: var(--history-radius);
  background: #fff;
  color: var(--history-ink);
  box-shadow: var(--history-shadow);
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.run-history-trigger:hover {
  transform: translateY(-1px);
  border-color: var(--history-accent);
  background: color-mix(in srgb, var(--history-soft) 60%, #fff);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--history-accent) 16%, transparent);
}
.run-history-trigger__icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: calc(var(--history-radius) - 2px);
  background: var(--history-soft);
  color: var(--history-accent-strong);
}
.run-history-trigger__text {
  display: grid;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.run-history-trigger__text b {
  font-size: 12px;
  line-height: 1.2;
}
.run-history-trigger__text small {
  max-width: 260px;
  overflow: hidden;
  color: var(--history-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.run-history-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15, 23, 42, .28);
  backdrop-filter: blur(2px);
}
.run-history-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2001;
  display: flex;
  flex-direction: column;
  width: min(460px, calc(100vw - 18px));
  height: 100vh;
  background: #fff;
  border-left: 1px solid var(--history-border);
  box-shadow: -18px 0 46px rgba(15, 23, 42, .18);
}
.run-history-drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 16px;
  border-bottom: 1px solid var(--history-border);
}
.run-history-drawer__head p {
  margin: 0 0 4px;
  color: var(--history-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.run-history-drawer__head h2 {
  margin: 0;
  color: var(--history-ink);
  font-size: 18px;
  font-weight: 800;
}
.run-history-drawer__head span,
.run-history-row small,
.run-history-file small,
.run-history-files__head span {
  color: var(--history-muted);
  font-size: 11px;
}
.run-history-icon-btn,
.run-history-action,
.run-history-file {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--history-border);
  border-radius: calc(var(--history-radius) - 1px);
  background: #fff;
  color: var(--history-ink);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.run-history-icon-btn:hover,
.run-history-action:hover,
.run-history-file:hover {
  transform: translateY(-1px);
  border-color: var(--history-accent);
  background: color-mix(in srgb, var(--history-soft) 62%, #fff);
}
.run-history-icon-btn {
  width: 34px;
  height: 34px;
}
.run-history-drawer__toolbar {
  display: flex;
  gap: 8px;
  padding: 14px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--history-border) 70%, #fff);
}
.run-history-action {
  min-height: 34px;
  padding: 0 12px;
}
.run-history-action--primary {
  background: linear-gradient(135deg, var(--history-accent), var(--history-accent-strong));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--history-accent) 22%, transparent);
}
.run-history-action--primary:hover {
  background: linear-gradient(135deg, var(--history-accent), var(--history-accent-strong));
  color: #fff;
}
.run-history-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px;
}
.run-history-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 10px;
  border: 1px solid transparent;
  border-radius: var(--history-radius);
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.run-history-row:hover,
.run-history-row--active {
  background: color-mix(in srgb, var(--history-soft) 42%, #fff);
  border-color: color-mix(in srgb, var(--history-accent) 34%, #fff);
}
.run-history-row__status {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: #94a3b8;
}
.run-history-row__status--success { background: var(--history-success); }
.run-history-row__status--failed { background: var(--history-danger); }
.run-history-row__status--running { background: var(--history-accent); animation: pulse 1.4s ease-in-out infinite; }
.run-history-row__main {
  min-width: 0;
}
.run-history-row__main b,
.run-history-row__main small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.run-history-row__main b {
  color: var(--history-ink);
  font-size: 12px;
}
.run-history-row em {
  color: var(--history-muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}
.run-history-files {
  flex-shrink: 0;
  max-height: 34vh;
  overflow: auto;
  padding: 14px 22px 18px;
  border-top: 1px solid var(--history-border);
  background: color-mix(in srgb, var(--history-soft) 30%, #fff);
}
.run-history-files__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}
.run-history-files__head strong {
  color: var(--history-ink);
  font-size: 13px;
}
.run-history-file {
  justify-content: flex-start;
  width: 100%;
  min-height: 40px;
  margin-top: 7px;
  padding: 7px 10px;
  text-align: left;
}
.run-history-file span {
  display: grid;
  min-width: 0;
}
.run-history-file b,
.run-history-file small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.run-history-empty {
  padding: 18px;
  color: var(--history-muted);
  font-size: 12px;
  text-align: center;
}
.spin {
  animation: spin .8s linear infinite;
}
.run-history-fade-enter-active,
.run-history-fade-leave-active {
  transition: opacity .18s ease;
}
.run-history-fade-enter-from,
.run-history-fade-leave-to {
  opacity: 0;
}
.run-history-slide-enter-active,
.run-history-slide-leave-active {
  transition: transform .22s cubic-bezier(.22,1,.36,1);
}
.run-history-slide-enter-from,
.run-history-slide-leave-to {
  transform: translateX(100%);
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse {
  0%, 100% { opacity: .5; transform: scale(.9); }
  50% { opacity: 1; transform: scale(1.15); }
}
@media (max-width: 640px) {
  .run-history-trigger {
    width: 100%;
  }
  .run-history-drawer {
    width: 100vw;
  }
}
</style>
