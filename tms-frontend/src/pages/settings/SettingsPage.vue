<template>
  <section class="settings-page">
    <!-- Header Panel -->
    <div class="header-panel">
      <div class="header-left">
        <div class="header-icon-wrap">
          <AppIcon name="monitor-code" />
        </div>
        <div class="header-info">
          <h2 class="header-title">{{ t('app.settings.title') }}</h2>
          <p class="header-desc">{{ t('app.settings.description') }}</p>
        </div>
      </div>
      <div class="header-right">
        <span class="status-pill" :class="`status-pill--${statusTone}`">
          <span class="status-dot" />
          {{ statusLabel }}
        </span>
        <label class="lang-switch">
          <AppIcon name="globe-search" />
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
      </div>
    </div>

    <!-- Version Grid -->
    <div class="ver-grid">
      <div class="ver-card" v-for="item in versionItems" :key="item.key">
        <div class="ver-card__icon" :class="`ver-card__icon--${item.tone}`">
          <AppIcon :name="item.icon" />
        </div>
        <div class="ver-card__body">
          <span class="ver-card__label">{{ item.label }}</span>
          <span class="ver-card__value" :class="{ 'mono': item.mono }">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <!-- Alert -->
    <transition name="alert-fade">
      <div v-if="noticeText" class="alert-bar" :class="`alert-bar--${noticeTone}`">
        <AppIcon :name="noticeTone === 'success' ? 'check-circle' : noticeTone === 'error' ? 'alert-circle' : 'activity'" />
        <span>{{ text(noticeText) }}</span>
      </div>
    </transition>

    <!-- Download Progress -->
    <transition name="alert-fade">
      <section v-if="status?.downloading || status?.progress" class="download-section">
        <div class="download-header">
          <AppIcon name="download-cloud" />
          <span class="download-label">{{ text('下载进度') }}</span>
          <strong class="download-pct">{{ progressPercent }}%</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="download-detail">{{ downloadDetail }}</p>
      </section>
    </transition>

    <!-- Changelog -->
    <section class="changelog-section">
      <div class="section-head">
        <AppIcon name="refresh-cw" />
        <h3>{{ text('更新日志') }}</h3>
      </div>

      <div v-if="hasCategorizedChangelog" class="changelog-grid">
        <article
          v-for="group in changelogGroups"
          :key="group.key"
          class="changelog-card"
          :class="`changelog-card--${group.key}`"
        >
          <div class="changelog-card__head">
            <span class="changelog-card__dot" />
            <h4>{{ group.title }}</h4>
            <span class="changelog-card__count">{{ group.items.length }}</span>
          </div>
          <ul v-if="group.items.length">
            <li v-for="item in group.items" :key="item">{{ text(item) }}</li>
          </ul>
          <p v-else class="changelog-empty">{{ text('暂无记录') }}</p>
        </article>
      </div>

      <div v-else class="changelog-placeholder">
        <AppIcon name="clock" />
        <span>{{ text(emptyChangelogText) }}</span>
      </div>

      <div v-if="releaseNoteItems.length" class="release-notes">
        <div class="release-notes__head">
          <AppIcon name="file-search" />
          <strong>{{ text('发布说明') }}</strong>
        </div>
        <ul>
          <li v-for="item in releaseNoteItems" :key="item">{{ text(item) }}</li>
        </ul>
      </div>
    </section>

    <!-- Manual Download -->
    <transition name="alert-fade">
      <section v-if="manualDownload" class="manual-section">
        <div class="manual-info">
          <AppIcon name="package" />
          <div>
            <strong>{{ text('免安装版') }}</strong>
            <p>{{ manualDownloadDetail }}</p>
          </div>
        </div>
        <button
          class="btn btn--outline"
          type="button"
          :disabled="isActionLocked"
          @click="handleManualDownload"
        >
          <AppIcon name="download" />
          {{ activeAction === 'manual' ? text('打开中...') : text('下载') }}
        </button>
      </section>
    </transition>

    <!-- Actions -->
    <footer class="action-bar">
      <button
        class="btn btn--outline"
        type="button"
        :disabled="isActionLocked"
        @click="handleCheck"
      >
        <AppIcon name="refresh-cw" />
        {{ status?.checking || activeAction === 'check' ? text('检查中...') : text('检查更新') }}
      </button>
      <button
        v-if="canDownload"
        class="btn btn--primary"
        type="button"
        :disabled="isActionLocked"
        @click="handleDownload"
      >
        <AppIcon name="download-cloud" />
        {{ status?.downloading || activeAction === 'download' ? text('下载中...') : text('下载更新') }}
      </button>
      <button
        v-if="canInstall"
        class="btn btn--primary btn--glow"
        type="button"
        :disabled="activeAction === 'install'"
        @click="handleInstall"
      >
        <AppIcon name="rocket" />
        {{ activeAction === 'install' ? text('正在安装...') : text('安装并重启') }}
      </button>
    </footer>
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
import AppIcon from '../../shared/ui/AppIcon.vue'
import {
  checkForUpdates,
  downloadUpdate,
  getAppVersionInfo,
  getUpdateStatusSnapshot,
  hasUpdateBridge,
  installUpdate,
  openManualDownload,
  subscribeUpdateStatus,
} from './settingsApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UpdateAction = '' | 'init' | 'check' | 'download' | 'install' | 'manual'

const versionInfo = ref<AppVersionInfo>({
  version: '0.9.7-beta.1.6',
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
const manualDownload = computed(() => status.value?.manualDownload ?? null)
const manualDownloadDetail = computed(() => {
  const file = manualDownload.value
  if (!file) return ''

  const version = file.version ? formatDisplayVersion(file.version) : '-'
  const size = file.size ? formatBytes(file.size) : '-'
  return `${file.label} · ${version} · ${size}`
})
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

const versionItems = computed(() => [
  {
    key: 'current',
    icon: 'check-circle',
    label: t('app.settings.currentVersion'),
    value: formatDisplayVersion(currentVersion.value),
    tone: 'teal',
    mono: false,
  },
  {
    key: 'latest',
    icon: 'sparkles',
    label: t('app.settings.latestVersion'),
    value: latestVersion.value,
    tone: 'blue',
    mono: false,
  },
  {
    key: 'mode',
    icon: 'monitor-code',
    label: t('app.settings.runMode'),
    value: runModeLabel.value,
    tone: 'slate',
    mono: false,
  },
  {
    key: 'feed',
    icon: 'link',
    label: t('app.settings.feedUrl'),
    value: feedUrlLabel.value,
    tone: 'green',
    mono: true,
  },
])

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

async function handleManualDownload(): Promise<void> {
  await runUpdateAction('manual', openManualDownload)
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

  if (action === 'manual') {
    return '已打开免安装版下载链接'
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

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  min-height: 100%;
  background: #f8fafc;
}

/* ===== Header ===== */
.header-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.45s ease-out both;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.header-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
}

.header-info {
  min-width: 0;
}

.header-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.header-desc {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 999px;
  white-space: nowrap;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-pill--info {
  background: #f0fdfa;
  color: #0f766e;
  border: 1px solid #ccfbf1;
  .status-dot { background: #0d9488; }
}

.status-pill--success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  .status-dot { background: #16a34a; animation: pulse-dot 2s ease infinite; }
}

.status-pill--warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
  .status-dot { background: #d97706; }
}

.status-pill--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  .status-dot { background: #dc2626; animation: pulse-dot 1.5s ease infinite; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;

  :deep(.app-icon) { font-size: 16px; color: #94a3b8; }

  select {
    height: 34px;
    min-width: 110px;
    padding: 0 28px 0 10px;
    color: #1e293b;
    font: inherit;
    font-weight: 600;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s ease;

    &:hover { border-color: #99f6e4; }
    &:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.1); }
  }
}

/* ===== Version Grid ===== */
.ver-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  animation: slideUp 0.45s ease-out 0.08s both;
}

.ver-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
    border-color: #99f6e4;
  }
}

.ver-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
  font-size: 17px;

  &--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
  &--blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
  &--green { background: linear-gradient(135deg, #34d399, #059669); }
  &--slate { background: linear-gradient(135deg, #94a3b8, #475569); }
}

.ver-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ver-card__label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ver-card__value {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.mono {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
  }
}

/* ===== Alert ===== */
.alert-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;

  :deep(.app-icon) { font-size: 18px; flex-shrink: 0; }
}

.alert-bar--info { background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; }
.alert-bar--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.alert-bar--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.alert-bar--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

.alert-fade-enter-active { transition: all 0.35s ease; }
.alert-fade-leave-active { transition: all 0.25s ease; }
.alert-fade-enter-from { opacity: 0; transform: translateY(-8px); }
.alert-fade-leave-to { opacity: 0; transform: translateY(-8px); }

/* ===== Download ===== */
.download-section {
  padding: 20px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.download-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  :deep(.app-icon) { font-size: 18px; color: #0d9488; }
}

.download-label {
  color: #1e293b;
  font-size: 14px;
  font-weight: 700;
  flex: 1;
}

.download-pct {
  color: #0d9488;
  font-size: 18px;
  font-weight: 800;
}

.progress-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0d9488, #2dd4bf);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.download-detail {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

/* ===== Changelog ===== */
.changelog-section {
  padding: 24px 28px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.45s ease-out 0.16s both;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;

  :deep(.app-icon) { font-size: 20px; color: #0d9488; }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
  }
}

.changelog-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.changelog-card {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.25s ease;

  &:hover {
    border-color: #99f6e4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
}

.changelog-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.changelog-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.changelog-card--added .changelog-card__dot { background: #0d9488; }
.changelog-card--improved .changelog-card__dot { background: #2563eb; }
.changelog-card--fixed .changelog-card__dot { background: #ea580c; }

.changelog-card__head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  flex: 1;
}

.changelog-card__count {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
}

.changelog-card ul {
  display: grid;
  gap: 6px;
  padding: 0 0 0 16px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.changelog-empty {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.changelog-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  justify-content: center;
  color: #94a3b8;
  font-size: 14px;

  :deep(.app-icon) { font-size: 18px; }
}

.release-notes {
  margin-top: 16px;
  padding: 16px;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  border-radius: 12px;
}

.release-notes__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  :deep(.app-icon) { font-size: 16px; color: #0d9488; }

  strong {
    color: #0f766e;
    font-size: 14px;
  }
}

.release-notes ul {
  display: grid;
  gap: 6px;
  padding: 0 0 0 16px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

/* ===== Manual Download ===== */
.manual-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.manual-info {
  display: flex;
  align-items: center;
  gap: 12px;

  :deep(.app-icon) { font-size: 24px; color: #0d9488; }

  strong {
    display: block;
    color: #0f172a;
    font-size: 15px;
    margin-bottom: 2px;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }
}

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;

  :deep(.app-icon) { font-size: 16px; }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.btn--outline {
  background: #ffffff;
  color: #475569;
  border: 1px solid #e2e8f0;

  &:hover:not(:disabled) {
    background: #f0fdfa;
    border-color: #99f6e4;
    color: #0d9488;
  }
}

.btn--primary {
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #ffffff;
  border: 1px solid #0f766e;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.25);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
  }
}

.btn--glow {
  animation: btn-glow 2.5s ease infinite;
}

@keyframes btn-glow {
  0%, 100% { box-shadow: 0 2px 8px rgba(13, 148, 136, 0.25); }
  50% { box-shadow: 0 4px 18px rgba(13, 148, 136, 0.45); }
}

/* ===== Action Bar ===== */
.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  padding: 16px 0 0;
  border-top: 1px solid #e2e8f0;
  animation: slideUp 0.45s ease-out 0.24s both;
}

/* ===== Animations ===== */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .ver-grid { grid-template-columns: repeat(2, 1fr); }
  .changelog-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .header-panel { flex-direction: column; align-items: flex-start; padding: 20px; }
  .header-right { width: 100%; justify-content: space-between; }
  .ver-grid { grid-template-columns: 1fr; }
  .manual-section { flex-direction: column; align-items: flex-start; }
  .action-bar { flex-direction: column; }
  .btn { width: 100%; justify-content: center; }
}
</style>
