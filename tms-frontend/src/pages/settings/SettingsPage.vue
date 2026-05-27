<template>
  <section class="settings-page">
    <div class="settings-panel">
      <header class="panel-header">
        <div class="header-copy">
          <p class="panel-kicker">{{ t('app.settings.kicker') }}</p>
          <div class="title-row">
            <h2 class="panel-title">{{ t('app.settings.title') }}</h2>
            <span class="copyright-badge">DG.Luenthai</span>
          </div>
          <p class="panel-description">
            {{ t('app.settings.description') }}
          </p>
        </div>

        <div class="header-actions">
          <label class="language-control">
            <span>{{ t('app.settings.language') }}</span>
            <select v-model="currentLanguage">
              <option
                v-for="option in languageOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <span class="status-badge" :class="`status-badge--${statusTone}`">
            {{ statusLabel }}
          </span>
        </div>
      </header>

      <dl class="version-grid">
        <div class="version-item">
          <dt>{{ t('app.settings.currentVersion') }}</dt>
          <dd>{{ formatDisplayVersion(currentVersion) }}</dd>
        </div>
        <div class="version-item">
          <dt>{{ t('app.settings.latestVersion') }}</dt>
          <dd>{{ latestVersion }}</dd>
        </div>
        <div class="version-item">
          <dt>{{ t('app.settings.runMode') }}</dt>
          <dd>{{ runModeLabel }}</dd>
        </div>
        <div class="version-item">
          <dt>{{ t('app.settings.feedUrl') }}</dt>
          <dd class="mono-value" :title="feedUrl">{{ feedUrlLabel }}</dd>
        </div>
      </dl>

      <div v-if="noticeText" class="status-alert" :class="`status-alert--${noticeTone}`">
        {{ text(noticeText) }}
      </div>

      <section v-if="status?.downloading || status?.progress" class="download-panel">
        <div class="download-row">
          <span>{{ text('下载进度') }}</span>
          <strong>{{ progressPercent }}%</strong>
        </div>
        <div class="progress-track" aria-hidden="true">
          <span class="progress-bar" :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="download-detail">{{ downloadDetail }}</p>
      </section>

      <section class="changelog-section">
        <div class="section-heading">
          <p class="panel-kicker">{{ text('更新日志') }}</p>
          <h3>{{ text('本次版本变化') }}</h3>
        </div>

        <div v-if="hasCategorizedChangelog" class="changelog-grid">
          <article v-for="group in changelogGroups" :key="group.key" class="changelog-card">
            <h4>{{ group.title }}</h4>
            <ul v-if="group.items.length">
              <li v-for="item in group.items" :key="item">{{ text(item) }}</li>
            </ul>
            <p v-else class="empty-copy">{{ text('暂无记录') }}</p>
          </article>
        </div>

        <div v-else class="empty-changelog">
          {{ text(emptyChangelogText) }}
        </div>

        <div v-if="releaseNoteItems.length" class="release-notes">
          <strong>{{ text('发布说明') }}</strong>
          <ul>
            <li v-for="item in releaseNoteItems" :key="item">{{ text(item) }}</li>
          </ul>
        </div>
      </section>

      <footer class="action-row">
        <button
          class="action-button"
          type="button"
          :disabled="isActionLocked"
          @click="handleCheck"
        >
          {{ status?.checking || activeAction === 'check' ? text('检查中...') : text('检查更新') }}
        </button>
        <button
          v-if="canDownload"
          class="action-button action-button--primary"
          type="button"
          :disabled="isActionLocked"
          @click="handleDownload"
        >
          {{ status?.downloading || activeAction === 'download' ? text('下载中...') : text('下载更新') }}
        </button>
        <button
          v-if="canInstall"
          class="action-button action-button--primary"
          type="button"
          :disabled="activeAction === 'install'"
          @click="handleInstall"
        >
          {{ activeAction === 'install' ? text('正在安装...') : text('立即安装并重启') }}
        </button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type {
  AppVersionInfo,
  UpdateActionResult,
  UpdateStatus,
  UpdateStatusCode,
} from '../../types/electronApi'
import {
  checkForUpdates,
  downloadUpdate,
  getAppVersionInfo,
  getUpdateStatusSnapshot,
  hasUpdateBridge,
  installUpdate,
  subscribeUpdateStatus,
} from './settingsApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UpdateAction = '' | 'init' | 'check' | 'download' | 'install'

const versionInfo = ref<AppVersionInfo>({
  version: '0.9.7-beta.1.1',
  isPackaged: false,
})
const status = ref<UpdateStatus | null>(null)
const activeAction = ref<UpdateAction>('')
const message = ref('')
const messageTone = ref<NoticeTone>('info')
let unsubscribeUpdateStatus: (() => void) | undefined
const { currentLanguage, languageOptions, t, text } = useAppLanguage()

const statusLabels: Record<UpdateStatusCode, string> = {
  idle: '待检查',
  checking: '检查中',
  'not-available': '已是最新',
  available: '发现新版本',
  downloading: '下载中',
  downloaded: '可安装',
  installing: '安装中',
  error: '更新异常',
  unsupported: '开发环境',
  'not-configured': '未配置',
}

const statusTones: Record<UpdateStatusCode, NoticeTone> = {
  idle: 'info',
  checking: 'info',
  'not-available': 'success',
  available: 'success',
  downloading: 'info',
  downloaded: 'success',
  installing: 'info',
  error: 'error',
  unsupported: 'warning',
  'not-configured': 'warning',
}

const feedSourceLabels: Record<string, string> = {
  env: '环境变量',
  'user-config': '本地配置',
  package: '打包配置',
  none: '未读取',
}

const currentVersion = computed(() => status.value?.currentVersion || versionInfo.value.version)
const latestVersion = computed(() => {
  const current = currentVersion.value
  const remote = status.value?.updateInfo?.version

  if (!current && !remote) return '-'
  if (!remote) return current ? formatDisplayVersion(current) : '-'
  if (!current) return formatDisplayVersion(remote)

  return compareVersionStrings(remote, current) >= 0
    ? formatDisplayVersion(remote)
    : formatDisplayVersion(current)
})
const statusLabel = computed(() => text(statusLabels[status.value?.status || 'idle']))
const statusTone = computed(() => statusTones[status.value?.status || 'idle'])
const runModeLabel = computed(() => {
  const isPackaged = status.value?.isPackaged ?? versionInfo.value.isPackaged
  return isPackaged ? text('安装版') : text('开发/预览')
})
const feedUrl = computed(() => status.value?.feedUrl || '')
const feedUrlLabel = computed(() => {
  if (!feedUrl.value) return '-'
  const rawSource = feedSourceLabels[status.value?.feedUrlSource || ''] || status.value?.feedUrlSource
  const source = rawSource ? text(rawSource) : ''
  return source ? `${source}: ${feedUrl.value}` : feedUrl.value
})
const noticeText = computed(() => message.value || status.value?.error || '')
const noticeTone = computed(() => {
  if (message.value) return messageTone.value
  return statusTone.value
})
const progressPercent = computed(() => {
  const percent = status.value?.progress?.percent ?? 0
  return Math.max(0, Math.min(100, Math.round(percent)))
})
const downloadDetail = computed(() => {
  const progress = status.value?.progress
  if (!progress?.total) return text('正在准备下载信息')
  return `${formatBytes(progress.transferred || 0)} / ${formatBytes(progress.total)}`
})
const changelogGroups = computed(() => {
  const changelog = status.value?.changelog
  return [
    { key: 'added', title: text('新增'), items: changelog?.added ?? [] },
    { key: 'improved', title: text('优化'), items: changelog?.improved ?? [] },
    { key: 'fixed', title: text('修复'), items: changelog?.fixed ?? [] },
  ]
})
const hasCategorizedChangelog = computed(() =>
  changelogGroups.value.some((group) => group.items.length > 0),
)
const releaseNoteItems = computed(() => readReleaseNoteItems(status.value?.updateInfo?.releaseNotes))
const emptyChangelogText = computed(() => {
  if (status.value?.status === 'available' || status.value?.status === 'downloaded') {
    return '更新源暂未提供 changelog.json'
  }
  return '检查到新版本后会显示新增、优化和修复内容'
})
const canDownload = computed(() =>
  Boolean(status.value?.updateAvailable && !status.value.downloading && !status.value.downloaded),
)
const canInstall = computed(() => Boolean(status.value?.downloaded))
const isActionLocked = computed(() =>
  Boolean(activeAction.value || status.value?.checking || status.value?.downloading),
)

onMounted(() => {
  unsubscribeUpdateStatus = subscribeUpdateStatus((nextStatus) => {
    status.value = nextStatus
  })
  void loadSettings()
})

onBeforeUnmount(() => {
  unsubscribeUpdateStatus?.()
})

async function loadSettings(): Promise<void> {
  activeAction.value = 'init'
  message.value = ''

  try {
    const [nextVersionInfo, nextStatus] = await Promise.all([
      getAppVersionInfo(),
      getUpdateStatusSnapshot(),
    ])
    versionInfo.value = nextVersionInfo
    status.value = nextStatus

    if (!hasUpdateBridge()) {
      messageTone.value = 'warning'
      message.value = '当前浏览器预览环境不支持应用更新'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '读取应用更新状态失败')
  } finally {
    activeAction.value = ''
  }
}

async function handleCheck(): Promise<void> {
  await runUpdateAction('check', checkForUpdates)
}

async function handleDownload(): Promise<void> {
  await runUpdateAction('download', downloadUpdate)
}

async function handleInstall(): Promise<void> {
  await runUpdateAction('install', installUpdate)
}

async function runUpdateAction(
  action: Exclude<UpdateAction, '' | 'init'>,
  actionHandler: () => Promise<UpdateActionResult>,
): Promise<void> {
  activeAction.value = action
  message.value = ''

  try {
    const result = await actionHandler()
    status.value = result.status

    if (!result.success) {
      messageTone.value = statusTones[result.status.status] === 'warning' ? 'warning' : 'error'
      message.value = result.error || '更新操作失败'
      return
    }

    messageTone.value = readSuccessTone(result.status.status)
    message.value = readSuccessMessage(action, result.status)
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '更新操作失败')
  } finally {
    activeAction.value = ''
  }
}

function readSuccessTone(nextStatus: UpdateStatusCode): NoticeTone {
  return nextStatus === 'not-available' ? 'success' : 'info'
}

function readSuccessMessage(action: Exclude<UpdateAction, '' | 'init'>, nextStatus: UpdateStatus): string {
  if (action === 'check') {
    if (nextStatus.status === 'not-available') return '当前已经是最新版本'
    if (nextStatus.status === 'available') return '发现可用新版本'
    return '检查更新完成'
  }

  if (action === 'download') {
    return nextStatus.downloaded ? '更新包已下载完成' : '更新包开始下载'
  }

  return '正在退出并安装更新'
}

function readReleaseNoteItems(notes: unknown): string[] {
  if (typeof notes === 'string') {
    return notes.trim() ? [notes.trim()] : []
  }

  if (!Array.isArray(notes)) {
    return []
  }

  return notes
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'note' in item) {
        const note = (item as { note?: unknown }).note
        return typeof note === 'string' ? note : ''
      }
      return ''
    })
    .filter((item) => item.trim())
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 MB'
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDisplayVersion(version: string): string {
  const normalized = version.trim().replace(/^v/i, '')
  return normalized ? `V${normalized}` : '-'
}

function compareVersionStrings(left: string, right: string): number {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)

  for (let index = 0; index < 3; index += 1) {
    const diff = leftVersion.main[index] - rightVersion.main[index]
    if (diff !== 0) return diff
  }

  if (!leftVersion.pre.length && rightVersion.pre.length) return 1
  if (leftVersion.pre.length && !rightVersion.pre.length) return -1

  const maxLength = Math.max(leftVersion.pre.length, rightVersion.pre.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftVersion.pre[index]
    const rightPart = rightVersion.pre[index]

    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue

    if (typeof leftPart === 'number' && typeof rightPart === 'number') return leftPart - rightPart
    if (typeof leftPart === 'number') return -1
    if (typeof rightPart === 'number') return 1
    return String(leftPart).localeCompare(String(rightPart), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  }

  return 0
}

function parseVersion(version: string): { main: number[]; pre: Array<string | number> } {
  const normalized = version.replace(/^v/i, '')
  const [mainText, preText = ''] = normalized.split('-', 2)
  const main = mainText
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10))

  while (main.length < 3) {
    main.push(0)
  }

  return {
    main: main.map((part) => (Number.isFinite(part) ? part : 0)),
    pre: preText
      .split(/[.-]/)
      .filter(Boolean)
      .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase())),
  }
}
</script>

<style scoped>
.settings-page {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.settings-panel {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.header-copy {
  min-width: 0;
}

.header-actions {
  display: grid;
  gap: 10px;
  justify-items: end;
  flex: 0 0 auto;
}

.language-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}

.language-control select {
  height: 32px;
  min-width: 116px;
  padding: 0 28px 0 10px;
  color: #0f172a;
  font: inherit;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.panel-kicker,
.panel-title,
.panel-description,
.section-heading h3 {
  margin: 0;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}

.panel-kicker {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.panel-title {
  color: #0f172a;
  font-size: 28px;
  line-height: 1.25;
}

.copyright-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  color: #185782;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  white-space: nowrap;
  background: #eff8ff;
  border: 1px solid #b9d8ee;
  border-radius: 999px;
}

.panel-description {
  max-width: 720px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.status-badge {
  flex: 0 0 auto;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 999px;
}

.status-badge--info {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.status-badge--success {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.status-badge--warning {
  color: #a16207;
  background: #fefce8;
  border: 1px solid #fde68a;
}

.status-badge--error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.version-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.version-item {
  min-width: 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
}

.version-item dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.version-item dd {
  min-width: 0;
  margin: 7px 0 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono-value {
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
}

.status-alert {
  padding: 13px 16px;
  font-size: 14px;
  border-radius: 8px;
}

.status-alert--info {
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.status-alert--success {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.status-alert--warning {
  color: #a16207;
  background: #fefce8;
  border: 1px solid #fde68a;
}

.status-alert--error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.download-panel,
.changelog-section {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
}

.download-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #0f172a;
  font-weight: 800;
}

.progress-track {
  height: 10px;
  overflow: hidden;
  background: #e2e8f0;
  border-radius: 999px;
}

.progress-bar {
  display: block;
  height: 100%;
  background: #2563eb;
}

.download-detail {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.section-heading {
  display: grid;
  gap: 4px;
}

.section-heading h3 {
  color: #0f172a;
  font-size: 20px;
}

.changelog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.changelog-card {
  min-width: 0;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.changelog-card h4 {
  margin: 0 0 10px;
  color: #0f172a;
  font-size: 15px;
}

.changelog-card ul,
.release-notes ul {
  display: grid;
  gap: 8px;
  padding-left: 18px;
  margin: 0;
  color: #334155;
  font-size: 14px;
  line-height: 1.55;
}

.empty-copy,
.empty-changelog {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
}

.empty-changelog {
  padding: 18px;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}

.release-notes {
  display: grid;
  gap: 10px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.release-notes strong {
  color: #0f172a;
}

.action-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.action-button {
  min-height: 38px;
  padding: 0 16px;
  color: #334155;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.action-button:hover {
  background: #f8fafc;
}

.action-button--primary {
  color: #ffffff;
  background: #409eff;
  border-color: #2563eb;
}

.action-button--primary:hover {
  background: #1d4ed8;
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 1080px) {
  .version-grid,
  .changelog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .panel-header,
  .action-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .header-actions {
    justify-items: start;
  }

  .status-badge {
    justify-self: start;
  }

  .version-grid,
  .changelog-grid {
    grid-template-columns: 1fr;
  }

  .action-button {
    width: 100%;
  }
}
</style>
