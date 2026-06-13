<template>
  <section class="st-page">
    <!-- ===== Header ===== -->
    <header class="st-hero">
      <div class="st-hero__left">
        <div class="st-hero__icon-wrap">
          <AppIcon name="sliders" />
        </div>
        <div class="st-hero__text">
          <h1 class="st-hero__title">{{ t('app.settings.title') }}</h1>
          <p class="st-hero__desc">{{ t('app.settings.description') }}</p>
        </div>
      </div>
      <div class="st-hero__right">
        <span v-if="hasDesktopUpdateSupport" class="st-status-pill" :class="`st-status-pill--${statusTone}`">
          <span class="st-status-dot" />
          {{ statusLabel }}
        </span>
        <button
          v-if="hasDesktopUpdateSupport"
          class="st-btn st-btn--outline st-btn--sm"
          type="button"
          :disabled="isActionLocked"
          @click="handleCheck"
        >
          <AppIcon name="refresh-cw" :class="{ 'st-spin': status?.checking || activeAction === 'check' }" />
          {{ status?.checking || activeAction === 'check' ? text('检查中...') : text('检查更新') }}
        </button>
        <div class="st-lang-switch" @click.stop="langOpen = !langOpen">
          <AppIcon name="globe-search" />
          <span class="st-lang-switch__label">{{ currentLangLabel }}</span>
          <AppIcon name="chevron-down" class="st-lang-switch__arrow" :class="{ 'st-lang-switch__arrow--open': langOpen }" />
          <transition name="st-dropdown">
            <div v-if="langOpen" class="st-lang-dropdown">
              <button
                v-for="option in languageOptions"
                :key="option.value"
                class="st-lang-option"
                :class="{ 'st-lang-option--active': currentLanguage === option.value }"
                type="button"
                @click.stop="selectLang(option.value)"
              >
                <span>{{ option.label }}</span>
                <AppIcon v-if="currentLanguage === option.value" name="check-circle" class="st-lang-option__check" />
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <!-- ===== Version Grid ===== -->
    <div class="st-ver-grid">
      <div
        v-for="item in versionItems"
        :key="item.key"
        class="st-ver-card"
      >
        <div class="st-ver-card__icon" :class="`st-ver-card__icon--${item.tone}`">
          <AppIcon :name="item.icon" />
        </div>
        <div class="st-ver-card__body">
          <span class="st-ver-card__label">{{ item.label }}</span>
          <strong class="st-ver-card__value" :class="{ 'st-mono': item.mono }">{{ item.value }}</strong>
        </div>
      </div>
    </div>

    <div v-if="hasDesktopUpdateSupport" class="st-feed-row">
      <div class="st-feed-row__icon">
        <AppIcon name="link" />
      </div>
      <div class="st-feed-row__content">
        <span class="st-feed-row__label">{{ t('app.settings.feedUrl') }}</span>
        <span class="st-feed-row__value">
          <span v-if="feedUrlSourceLabel" class="st-feed-row__source">{{ feedUrlSourceLabel }}</span>
          <span class="st-feed-row__url" :title="feedUrlText">{{ feedUrlText }}</span>
        </span>
      </div>
    </div>

    <section class="st-manual">
      <div class="st-manual__info">
        <div class="st-manual__icon">
          <AppIcon name="monitor-code" />
        </div>
        <div>
          <strong>{{ text('自动化助手安装包') }}</strong>
          <p>{{ text('新用户安装后即可在浏览器页面启动本机自动化助手。') }}</p>
        </div>
      </div>
      <button
        class="st-btn st-btn--primary"
        type="button"
        :disabled="helperDownloading"
        @click="handleHelperDownload"
      >
        <AppIcon name="download" />
        {{ helperDownloading ? text('打开中...') : text('下载安装包') }}
      </button>
    </section>

    <!-- ===== Alert ===== -->
    <transition name="st-alert">
      <div v-if="hasDesktopUpdateSupport && noticeText" class="st-alert" :class="`st-alert--${noticeTone}`">
        <div class="st-alert__icon">
          <AppIcon :name="noticeTone === 'success' ? 'check-circle' : noticeTone === 'error' ? 'alert-circle' : 'activity'" />
        </div>
        <span class="st-alert__text">{{ text(noticeText) }}</span>
        <button class="st-alert__close" type="button" @click="message = ''">×</button>
      </div>
    </transition>

    <!-- ===== Download Progress ===== -->
    <transition name="st-alert">
      <section v-if="hasDesktopUpdateSupport && (status?.downloading || status?.progress)" class="st-download">
        <div class="st-download__head">
          <AppIcon name="download-cloud" />
          <span class="st-download__label">{{ text('下载进度') }}</span>
          <strong class="st-download__pct">{{ progressPercent }}%</strong>
        </div>
        <div class="st-progress-track">
          <div class="st-progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="st-download__detail">{{ downloadDetail }}</p>
      </section>
    </transition>

    <!-- ===== Changelog ===== -->
    <section v-if="hasDesktopUpdateSupport" class="st-changelog">
      <div class="st-section-head">
        <AppIcon name="refresh-cw" />
        <h3>{{ text('更新日志') }}</h3>
      </div>

      <div v-if="hasCategorizedChangelog" class="st-changelog-grid">
        <article
          v-for="group in changelogGroups"
          :key="group.key"
          class="st-changelog-card"
          :class="`st-changelog-card--${group.key}`"
        >
          <div class="st-changelog-card__head">
            <span class="st-changelog-card__dot" />
            <h4>{{ group.title }}</h4>
            <span class="st-changelog-card__count">{{ group.items.length }}</span>
          </div>
          <ul v-if="group.items.length">
            <li v-for="item in group.items" :key="item">{{ text(item) }}</li>
          </ul>
          <p v-else class="st-changelog-empty">{{ text('暂无记录') }}</p>
        </article>
      </div>

      <div v-else class="st-changelog-placeholder">
        <AppIcon name="clock" />
        <span>{{ text(emptyChangelogText) }}</span>
      </div>

      <div v-if="releaseNoteItems.length" class="st-release-notes">
        <div class="st-release-notes__head">
          <AppIcon name="file-search" />
          <strong>{{ text('发布说明') }}</strong>
        </div>
        <ul>
          <li v-for="item in releaseNoteItems" :key="item">{{ text(item) }}</li>
        </ul>
      </div>
    </section>

    <!-- ===== Manual Download ===== -->
    <transition name="st-alert">
      <section v-if="hasDesktopUpdateSupport && manualDownload" class="st-manual">
        <div class="st-manual__info">
          <div class="st-manual__icon">
            <AppIcon name="package" />
          </div>
          <div>
            <strong>{{ text('免安装版') }}</strong>
            <p>{{ manualDownloadDetail }}</p>
          </div>
        </div>
        <button
          class="st-btn st-btn--outline"
          type="button"
          :disabled="isActionLocked"
          @click="handleManualDownload"
        >
          <AppIcon name="download" />
          {{ activeAction === 'manual' ? text('打开中...') : text('下载') }}
        </button>
      </section>
    </transition>

    <!-- ===== Actions ===== -->
    <footer v-if="hasDesktopUpdateSupport && (canDownload || canInstall)" class="st-actions">
      <button
        v-if="canDownload"
        class="st-btn st-btn--primary"
        type="button"
        :disabled="isActionLocked"
        @click="handleDownload"
      >
        <AppIcon name="download-cloud" />
        {{ status?.downloading || activeAction === 'download' ? text('下载中...') : text('下载更新') }}
      </button>
      <button
        v-if="canInstall"
        class="st-btn st-btn--primary"
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
import { fallbackAppVersion } from '../../shared/version/appVersion'
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
import { openAutomationHelperDownload } from '../web-automation/webAutomationApi'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UpdateAction = '' | 'init' | 'check' | 'download' | 'install' | 'manual'

const versionInfo = ref<AppVersionInfo>({
  version: fallbackAppVersion,
  isPackaged: false,
})
const status = ref<UpdateStatus | null>(null)
const activeAction = ref<UpdateAction>('')
const message = ref('')
const messageTone = ref<NoticeTone>('info')
const helperDownloading = ref(false)
let unsubscribeUpdateStatus: (() => void) | undefined
const { currentLanguage, languageOptions, t, text } = useAppLanguage()
const langOpen = ref(false)
const currentLangLabel = computed(() => languageOptions.value.find(o => o.value === currentLanguage.value)?.label ?? currentLanguage.value)
function selectLang(val: 'zh-CN' | 'en-US') { currentLanguage.value = val; langOpen.value = false }
function closeLang() { langOpen.value = false }

const hasDesktopUpdateSupport = computed(() => hasUpdateBridge())

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
  preview: '预览参考',
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
  return isPackaged ? text('安装版') : text('服务器 / 浏览器')
})
const feedUrl = computed(() => status.value?.feedUrl || '')
const feedUrlText = computed(() => feedUrl.value || '-')
const feedUrlSourceLabel = computed(() => {
  const rawSource = feedSourceLabels[status.value?.feedUrlSource || ''] || status.value?.feedUrlSource
  return rawSource ? text(rawSource) : ''
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

const versionItems = computed(() => {
  const items = [{
    key: 'current',
    icon: 'check-circle',
    label: t('app.settings.currentVersion'),
    value: formatDisplayVersion(currentVersion.value),
    tone: 'teal',
    mono: false,
  }]

  if (hasDesktopUpdateSupport.value) {
    items.push({
      key: 'latest',
      icon: 'sparkles',
      label: t('app.settings.latestVersion'),
      value: latestVersion.value,
      tone: 'blue',
      mono: false,
    })
  }

  items.push({
    key: 'mode',
    icon: 'monitor-code',
    label: t('app.settings.runMode'),
    value: runModeLabel.value,
    tone: 'slate',
    mono: false,
  })

  return items
})

onMounted(() => {
  unsubscribeUpdateStatus = subscribeUpdateStatus((nextStatus) => {
    status.value = nextStatus
  })
  void loadSettings()
  document.addEventListener('click', closeLang)
})

onBeforeUnmount(() => {
  unsubscribeUpdateStatus?.()
  document.removeEventListener('click', closeLang)
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

async function handleHelperDownload(): Promise<void> {
  helperDownloading.value = true
  message.value = ''

  try {
    await openAutomationHelperDownload()
    messageTone.value = 'info'
    message.value = '已打开自动化助手安装包下载。'
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '自动化助手安装包下载失败')
  } finally {
    helperDownloading.value = false
  }
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
/* ================================================================
   System Settings — Refined Redesign
   Palette: teal #0d9488, blue #2563eb, green #059669, slate #475569
   Clean, elegant, minimal animations.
   ================================================================ */

.st-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 55% 35% at 50% 0%, rgba(13, 148, 136, 0.04), transparent 55%),
    #f6f9fc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

/* ===== Hero ===== */
.st-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 26px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 18px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.03);
  animation: st-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  z-index: 10;
}

.st-hero__left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.st-hero__icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.25);
  transition: transform 0.3s ease;

  &:hover {
    transform: scale(1.05) rotate(-3deg);
  }
}

.st-hero__text {
  min-width: 0;
}

.st-hero__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  line-height: 1.3;
}

.st-hero__desc {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.st-hero__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Status Pill */
.st-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 999px;
  white-space: nowrap;
}

.st-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.st-status-pill--info {
  background: #f0fdfa;
  color: #0f766e;
  border: 1px solid #ccfbf1;
  .st-status-dot { background: #0d9488; }
}

.st-status-pill--success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  .st-status-dot { background: #16a34a; }
}

.st-status-pill--warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
  .st-status-dot { background: #d97706; }
}

.st-status-pill--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  .st-status-dot { background: #dc2626; }
}

/* Language Switch */
.st-lang-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;

  > :deep(.app-icon) {
    font-size: 15px;
    color: #0d9488;
    flex-shrink: 0;
  }

  &:hover {
    border-color: #99f6e4;
    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.08);
  }
}

.st-lang-switch__label {
  min-width: 48px;
}

.st-lang-switch__arrow {
  font-size: 14px;
  color: #94a3b8;
  transition: transform 0.25s ease;
  flex-shrink: 0;

  &--open {
    transform: rotate(180deg);
  }
}

/* Dropdown */
.st-lang-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 4px;
  z-index: 9999;
  overflow: hidden;
}

.st-lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f0fdfa;
    color: #0d9488;
  }

  &--active {
    background: #f0fdfa;
    color: #0d9488;
  }
}

.st-lang-option__check {
  font-size: 15px;
  color: #0d9488;
  flex-shrink: 0;
}

/* Dropdown animation */
.st-dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-dropdown-leave-active {
  transition: all 0.15s ease-in;
}
.st-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.st-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

/* ===== Version Grid ===== */
.st-ver-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  animation: st-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.06s both;
}

.st-ver-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.05);
    border-color: #99f6e4;
  }
}

.st-ver-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 18px;
  transition: transform 0.3s ease;

  .st-ver-card:hover & {
    transform: scale(1.06);
  }

  &--teal {
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    box-shadow: 0 3px 10px rgba(13, 148, 136, 0.2);
  }

  &--blue {
    background: linear-gradient(135deg, #60a5fa, #2563eb);
    box-shadow: 0 3px 10px rgba(37, 99, 235, 0.18);
  }

  &--green {
    background: linear-gradient(135deg, #34d399, #059669);
    box-shadow: 0 3px 10px rgba(5, 150, 105, 0.18);
  }

  &--slate {
    background: linear-gradient(135deg, #94a3b8, #475569);
    box-shadow: 0 3px 10px rgba(71, 85, 105, 0.15);
  }
}

.st-ver-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.st-ver-card__label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.st-ver-card__value {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-mono {
  font-family: 'Cascadia Code', Consolas, 'Courier New', monospace;
  font-size: 12px !important;
}

/* ===== Feed Row ===== */
.st-feed-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 15px 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: st-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.09s both;
}

.st-feed-row__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 18px;
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 3px 10px rgba(5, 150, 105, 0.18);
}

.st-feed-row__content {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.st-feed-row__label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.st-feed-row__value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}

.st-feed-row__source {
  flex-shrink: 0;
  color: #0f766e;
}

.st-feed-row__url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Cascadia Code', Consolas, 'Courier New', monospace;
}

/* ===== Alert ===== */
.st-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid;
}

.st-alert__icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}

.st-alert__text {
  flex: 1;
  min-width: 0;
}

.st-alert__close {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  opacity: 0.5;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
}

.st-alert--info {
  background: #f0fdfa;
  color: #0f766e;
  border-color: #ccfbf1;
  .st-alert__icon { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
}

.st-alert--success {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
  .st-alert__icon { background: linear-gradient(135deg, #34d399, #059669); }
}

.st-alert--warning {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
  .st-alert__icon { background: linear-gradient(135deg, #fbbf24, #d97706); }
}

.st-alert--error {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
  .st-alert__icon { background: linear-gradient(135deg, #f87171, #dc2626); }
}

.st-alert-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.st-alert-leave-active { transition: all 0.25s ease-in; }
.st-alert-enter-from { opacity: 0; transform: translateY(-10px); }
.st-alert-leave-to { opacity: 0; transform: translateY(-8px); }

/* ===== Download ===== */
.st-download {
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.st-download__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  :deep(.app-icon) {
    font-size: 18px;
    color: #0d9488;
  }
}

.st-download__label {
  color: #1e293b;
  font-size: 14px;
  font-weight: 700;
  flex: 1;
}

.st-download__pct {
  color: #0d9488;
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.st-progress-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.st-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0d9488, #2dd4bf);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.st-download__detail {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 13px;
}

/* ===== Changelog ===== */
.st-changelog {
  padding: 22px 26px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: st-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}

.st-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;

  :deep(.app-icon) {
    font-size: 18px;
    color: #0d9488;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
}

.st-changelog-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.st-changelog-card {
  padding: 16px 18px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.25s ease;

  &:hover {
    border-color: #99f6e4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
}

.st-changelog-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.st-changelog-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.st-changelog-card--added .st-changelog-card__dot { background: #0d9488; }
.st-changelog-card--improved .st-changelog-card__dot { background: #2563eb; }
.st-changelog-card--fixed .st-changelog-card__dot { background: #ea580c; }

.st-changelog-card__head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  flex: 1;
}

.st-changelog-card__count {
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

.st-changelog-card ul {
  display: grid;
  gap: 6px;
  padding: 0 0 0 16px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.st-changelog-empty {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
}

.st-changelog-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  justify-content: center;
  color: #94a3b8;
  font-size: 14px;

  :deep(.app-icon) { font-size: 18px; }
}

.st-release-notes {
  margin-top: 16px;
  padding: 16px 18px;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  border-radius: 12px;
}

.st-release-notes__head {
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

.st-release-notes ul {
  display: grid;
  gap: 6px;
  padding: 0 0 0 16px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

/* ===== Manual Download ===== */
.st-manual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.st-manual__info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.st-manual__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(13, 148, 136, 0.2);
}

.st-manual__info strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
  margin-bottom: 2px;
}

.st-manual__info p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

/* ===== Buttons ===== */
.st-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;

  :deep(.app-icon) { font-size: 16px; }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.st-btn--outline {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;

  &:hover:not(:disabled) {
    background: #f0fdfa;
    border-color: #99f6e4;
    color: #0d9488;
  }
}

.st-btn--sm {
  height: 34px;
  padding: 0 14px;
  font-size: 12px;
  border-radius: 9px;
}

.st-btn--primary {
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #fff;
  border: 1px solid #0f766e;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.25);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(13, 148, 136, 0.35);
  }
}

.st-spin {
  animation: st-spin 1s linear infinite;
}

/* ===== Actions ===== */
.st-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  padding: 16px 0 0;
  border-top: 1px solid #e2e8f0;
  animation: st-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

/* ===== Animations ===== */
@keyframes st-slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes st-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .st-ver-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-changelog-grid { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .st-page { padding: 14px; }

  .st-hero {
    flex-direction: column;
    align-items: stretch;
    padding: 18px 20px;
  }

  .st-hero__right {
    justify-content: space-between;
  }

  .st-ver-grid { grid-template-columns: 1fr; }

  .st-feed-row {
    align-items: flex-start;
    padding: 14px;
  }

  .st-feed-row__value {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .st-feed-row__url {
    max-width: 100%;
  }

  .st-manual {
    flex-direction: column;
    align-items: flex-start;
  }

  .st-actions {
    flex-direction: column;
  }

  .st-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
