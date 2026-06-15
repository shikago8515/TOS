<template>
  <div class="stg">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Status Banner                                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <header class="stg-banner">
      <div class="stg-banner__row">
        <div class="stg-banner__left">
          <span class="stg-banner__mark">
            <AppIcon name="settings" />
          </span>
          <div>
            <div class="stg-banner__version-row">
              <h1 class="stg-banner__version">{{ currentVersion }}</h1>
              <span class="stg-badge" :class="`stg-badge--${statusTone}`">
                <i class="stg-badge__dot" />
                {{ statusLabel }}
              </span>
            </div>
            <div class="stg-banner__meta">
              <AppIcon name="monitor" class="stg-banner__meta-icon" />
              <span>{{ runModeLabel }}</span>
              <template v-if="hasDesktopUpdateSupport">
                <span class="stg-banner__dot-sep">&middot;</span>
                <span>{{ text('最新版本') }}</span>
                <strong class="stg-banner__meta-strong">{{ latestVersion }}</strong>
              </template>
            </div>
          </div>
        </div>

        <div class="stg-banner__right">
          <button
            v-if="hasDesktopUpdateSupport"
            class="stg-ghost"
            type="button"
            :disabled="isActionLocked"
            @click="handleCheck"
          >
            <AppIcon
              name="refresh-cw"
              :class="{ 'is-spin': status?.checking || activeAction === 'check' }"
            />
            <span>{{ text('检查更新') }}</span>
          </button>
          <SettingsLanguageSwitch />
        </div>
      </div>

      <!-- Download progress bar -->
      <transition name="stg-slide">
        <div
          v-if="status?.downloading && status?.progress"
          class="stg-banner__progress"
        >
          <div class="stg-progress__head">
            <span class="stg-progress__label">
              <AppIcon name="download-cloud" />
              {{ text('下载中') }}
            </span>
            <div class="stg-progress__right">
              <span class="stg-progress__detail">{{ downloadDetail }}</span>
              <strong class="stg-progress__pct">{{ progressPercent }}%</strong>
            </div>
          </div>
          <div class="stg-progress__rail">
            <div
              class="stg-progress__bar"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>
      </transition>
    </header>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Notice Toast                                               -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <transition name="stg-slide">
      <aside
        v-if="noticeText"
        class="stg-toast"
        :class="`stg-toast--${noticeTone}`"
        role="status"
      >
        <span class="stg-toast__icon">
          <AppIcon
            :name="noticeTone === 'error' ? 'alert-circle' : noticeTone === 'success' ? 'check-circle' : 'info'"
          />
        </span>
        <span class="stg-toast__msg">{{ text(noticeText) }}</span>
        <button class="stg-toast__close" type="button" @click="message = ''">
          <AppIcon name="stop-circle" />
        </button>
      </aside>
    </transition>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Group: Update Management (desktop only)                    -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <section v-if="hasDesktopUpdateSupport" class="stg-group">
      <div class="stg-group__head">
        <AppIcon name="refresh-cw" class="stg-group__icon" />
        <span class="stg-group__title">{{ text('更新管理') }}</span>
      </div>
      <div class="stg-group__body">
        <!-- Check for updates -->
        <div class="stg-row">
          <span class="stg-row__icon">
            <AppIcon name="refresh-cw" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('检查更新') }}</p>
            <p class="stg-row__desc">{{ text('从更新源检查是否有新版本') }}</p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="isActionLocked"
            @click="handleCheck"
          >
            <span>{{
              status?.checking || activeAction === 'check'
                ? text('检查中...')
                : text('检查')
            }}</span>
            <AppIcon name="chevron-right" />
          </button>
        </div>

        <!-- Download update -->
        <div class="stg-row" :class="{ 'stg-row--disabled': !canDownload }">
          <span class="stg-row__icon">
            <AppIcon name="download-cloud" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('下载更新') }}</p>
            <p class="stg-row__desc">{{ text('下载已发现的新版本安装包') }}</p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="!canDownload || isActionLocked"
            @click="handleDownload"
          >
            <span>{{
              status?.downloading || activeAction === 'download'
                ? text('下载中...')
                : text('下载')
            }}</span>
            <AppIcon name="chevron-right" />
          </button>
        </div>

        <!-- Install and restart -->
        <div class="stg-row" :class="{ 'stg-row--disabled': !canInstall }">
          <span class="stg-row__icon">
            <AppIcon name="rocket" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('安装并重启') }}</p>
            <p class="stg-row__desc">{{ text('安装已下载的更新并重启应用') }}</p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="!canInstall"
            @click="handleInstall"
          >
            <span>{{
              activeAction === 'install' ? text('安装中...') : text('安装')
            }}</span>
            <AppIcon name="chevron-right" />
          </button>
        </div>
      </div>
    </section>

    <!-- Fallback: no desktop update support -->
    <section v-else class="stg-group">
      <div class="stg-group__head">
        <AppIcon name="monitor" class="stg-group__icon" />
        <span class="stg-group__title">{{ text('桌面客户端更新') }}</span>
      </div>
      <div class="stg-group__body">
        <div class="stg-group__empty">
          <p>{{ text('当前运行在服务器 / 浏览器环境，桌面客户端会显示自动更新能力。') }}</p>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Group: Download Center                                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <section class="stg-group">
      <div class="stg-group__head">
        <AppIcon name="download" class="stg-group__icon" />
        <span class="stg-group__title">{{ text('下载中心') }}</span>
      </div>
      <div class="stg-group__body">
        <!-- TOS desktop installer -->
        <div class="stg-row">
          <span class="stg-row__icon">
            <AppIcon name="monitor-code" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('TOS 应用安装包') }}</p>
            <p class="stg-row__desc">
              {{ text('下载完整桌面版，安装后可直接使用本机后端和自动化能力。') }}
            </p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="desktopInstallerDownloading"
            @click="handleDesktopInstallerDownload"
          >
            <AppIcon name="download" />
            <span>{{
              desktopInstallerDownloading ? text('打开中...') : text('下载')
            }}</span>
          </button>
        </div>

        <!-- Portable / manual download (desktop only) -->
        <div v-if="hasDesktopUpdateSupport && manualDownload" class="stg-row">
          <span class="stg-row__icon">
            <AppIcon name="package" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('免安装版') }}</p>
            <p class="stg-row__desc">{{ manualDownloadDetail }}</p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="isActionLocked"
            @click="handleManualDownload"
          >
            <AppIcon name="download" />
            <span>{{
              activeAction === 'manual' ? text('打开中...') : text('下载')
            }}</span>
          </button>
        </div>

        <!-- Automation helper -->
        <div class="stg-row">
          <span class="stg-row__icon">
            <AppIcon name="package" />
          </span>
          <div class="stg-row__text">
            <p class="stg-row__label">{{ text('自动化助手安装包') }}</p>
            <p class="stg-row__desc">
              {{ text('新用户安装后即可在浏览器页面启动本机自动化助手。') }}
            </p>
          </div>
          <button
            class="stg-row__action"
            type="button"
            :disabled="helperDownloading"
            @click="handleHelperDownload"
          >
            <AppIcon name="download" />
            <span>{{
              helperDownloading ? text('打开中...') : text('下载')
            }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Group: Version Info                                        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <section class="stg-group">
      <div class="stg-group__head">
        <AppIcon name="sparkles" class="stg-group__icon" />
        <span class="stg-group__title">{{ text('版本信息') }}</span>
      </div>
      <div class="stg-group__body">
        <div class="stg-info">
          <span class="stg-info__label">{{ t('app.settings.currentVersion') }}</span>
          <strong class="stg-info__value stg-info__value--mono">{{ currentVersion }}</strong>
        </div>

        <div class="stg-divider" />

        <template v-if="hasDesktopUpdateSupport">
          <div class="stg-info">
            <span class="stg-info__label">{{ t('app.settings.latestVersion') }}</span>
            <strong class="stg-info__value stg-info__value--mono">{{ latestVersion }}</strong>
          </div>
          <div class="stg-divider" />
        </template>

        <div class="stg-info">
          <span class="stg-info__label">{{ t('app.settings.runMode') }}</span>
          <strong class="stg-info__value">{{ runModeLabel }}</strong>
        </div>

        <template v-if="hasDesktopUpdateSupport">
          <div class="stg-divider" />
          <div class="stg-info">
            <span class="stg-info__label">{{ t('app.settings.feedUrl') }}</span>
            <div class="stg-info__right">
              <em v-if="feedUrlSourceLabel" class="stg-info__tag">{{ feedUrlSourceLabel }}</em>
              <span class="stg-info__value stg-info__value--truncate" :title="feedUrlText">
                {{ feedUrlText }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../shared/ui/AppIcon.vue'
import SettingsLanguageSwitch from './SettingsLanguageSwitch.vue'
import { useSettingsPageModel } from './useSettingsPageModel'

const {
  activeAction,
  canDownload,
  canInstall,
  currentVersion,
  desktopInstallerDownloading,
  downloadDetail,
  feedUrlSourceLabel,
  feedUrlText,
  handleCheck,
  handleDesktopInstallerDownload,
  handleDownload,
  handleHelperDownload,
  handleInstall,
  handleManualDownload,
  hasDesktopUpdateSupport,
  helperDownloading,
  isActionLocked,
  latestVersion,
  manualDownload,
  manualDownloadDetail,
  message,
  noticeText,
  noticeTone,
  progressPercent,
  runModeLabel,
  status,
  statusLabel,
  statusTone,
  t,
  text,
} = useSettingsPageModel()
</script>

<style scoped lang="scss">
/* ================================================================= */
/*  Design Tokens — aligned with AppShell CSS custom properties      */
/* ================================================================= */
.stg {
  --c-primary: #0f766e;
  --c-primary-strong: #0d9488;
  --c-primary-soft: #f0fdfa;
  --c-surface: #ffffff;
  --c-muted-surface: #f1f5f9;
  --c-text: #1e293b;
  --c-muted: #64748b;
  --c-border: #e2e8f0;

  --c-ok: #059669;
  --c-ok-bg: #ecfdf5;
  --c-ok-dot: #10b981;
  --c-wa: #d97706;
  --c-wa-bg: #fffbeb;
  --c-wa-dot: #f59e0b;
  --c-er: #dc2626;
  --c-er-bg: #fef2f2;
  --c-er-dot: #ef4444;
  --c-inf: #0284c7;
  --c-inf-bg: #f0f9ff;
  --c-inf-dot: #0ea5e9;

  --r: 10px;
  --r-lg: 14px;
  --r-full: 999px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  padding: 6px 4px 20px;
  color: var(--c-text);
}

/* ================================================================= */
/*  Keyframes                                                        */
/* ================================================================= */
@keyframes stg-spin {
  to { transform: rotate(360deg); }
}
@keyframes stg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@keyframes stg-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.is-spin {
  animation: stg-spin 0.85s linear infinite;
}

/* ================================================================= */
/*  Status Banner                                                    */
/* ================================================================= */
.stg-banner {
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  padding: 18px 22px;
}

.stg-banner__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.stg-banner__left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.stg-banner__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--c-primary);
  color: #fff;
  font-size: 19px;
  flex-shrink: 0;
}

.stg-banner__version-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stg-banner__version {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  color: var(--c-text);
  line-height: 1.2;
}

.stg-banner__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--c-muted);
}

.stg-banner__meta-icon {
  font-size: 14px;
}

.stg-banner__meta-strong {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--c-text);
}

.stg-banner__dot-sep {
  color: var(--c-border);
}

.stg-banner__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Progress (inside banner) ── */
.stg-banner__progress {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--c-border);
}

.stg-progress__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stg-progress__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text);
}

.stg-progress__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stg-progress__detail {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--c-muted);
}

.stg-progress__pct {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--c-primary);
}

.stg-progress__rail {
  height: 5px;
  border-radius: var(--r-full);
  overflow: hidden;
  background: var(--c-muted-surface);
}

.stg-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #14b8a6, var(--c-primary-strong), #14b8a6);
  background-size: 200% 100%;
  animation: stg-shimmer 2s linear infinite;
  transition: width 0.35s var(--ease);
}

/* ================================================================= */
/*  Status Badge                                                     */
/* ================================================================= */
.stg-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  background: var(--c-muted-surface);
  color: var(--c-muted);
}

.stg-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  font-style: normal;
}

.stg-badge--success {
  background: var(--c-ok-bg);
  color: var(--c-ok);

  .stg-badge__dot {
    background: var(--c-ok-dot);
    animation: stg-pulse 2s infinite;
  }
}

.stg-badge--warning {
  background: var(--c-wa-bg);
  color: var(--c-wa);

  .stg-badge__dot { background: var(--c-wa-dot); }
}

.stg-badge--error {
  background: var(--c-er-bg);
  color: var(--c-er);

  .stg-badge__dot { background: var(--c-er-dot); }
}

.stg-badge--info {
  background: var(--c-inf-bg);
  color: var(--c-inf);

  .stg-badge__dot { background: var(--c-inf-dot); }
}

/* ================================================================= */
/*  Ghost Button                                                     */
/* ================================================================= */
.stg-ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--r);
  background: transparent;
  color: var(--c-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--c-muted-surface);
    color: var(--c-text);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ================================================================= */
/*  Toast (notice banner)                                            */
/* ================================================================= */
.stg-toast {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: center;
  gap: 9px;
  padding: 9px 14px;
  border-radius: var(--r);
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-muted);
}

.stg-toast__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.stg-toast--success { border-color: #a7f3d0; background: var(--c-ok-bg); color: var(--c-ok); }
.stg-toast--warning { border-color: #fcd34d; background: var(--c-wa-bg); color: var(--c-wa); }
.stg-toast--error   { border-color: #fecaca; background: var(--c-er-bg); color: var(--c-er); }
.stg-toast--info    { border-color: #bae6fd; background: var(--c-inf-bg); color: var(--c-inf); }

.stg-toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.5;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
}

.stg-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.3s var(--ease);
}

.stg-slide-leave-active {
  transition: opacity 0.16s ease, transform 0.18s ease-in;
}

.stg-slide-enter-from,
.stg-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ================================================================= */
/*  Settings Group Card                                              */
/* ================================================================= */
.stg-group {
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  overflow: hidden;
}

.stg-group__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 6px;
}

.stg-group__icon {
  font-size: 15px;
  color: var(--c-primary-strong);
}

.stg-group__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text);
}

.stg-group__body {
  padding: 2px 0 6px;
}

.stg-group__empty {
  padding: 6px 16px 12px;

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--c-muted);
  }
}

/* ================================================================= */
/*  Settings Row                                                     */
/* ================================================================= */
.stg-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  margin: 1px 8px;
  padding: 4px 12px;
  border-radius: var(--r);
  transition: background 0.18s ease;

  &:hover {
    background: var(--c-muted-surface);
  }
}

.stg-row--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.stg-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-size: 17px;
  flex-shrink: 0;
}

.stg-row__text {
  flex: 1;
  min-width: 0;
}

.stg-row__label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text);
}

.stg-row__desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--c-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stg-row__action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--c-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.18s ease;

  &:hover:not(:disabled) {
    background: var(--c-primary-soft);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ================================================================= */
/*  Info Row                                                         */
/* ================================================================= */
.stg-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 16px;
}

.stg-info__label {
  font-size: 13px;
  color: var(--c-muted);
}

.stg-info__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}

.stg-info__value--mono {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.stg-info__value--truncate {
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.stg-info__right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stg-info__tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
}

/* ================================================================= */
/*  Divider                                                          */
/* ================================================================= */
.stg-divider {
  height: 1px;
  margin: 0 16px;
  background: var(--c-border);
}

/* ================================================================= */
/*  Responsive                                                       */
/* ================================================================= */
@media (max-width: 680px) {
  .stg {
    padding: 12px;
    gap: 10px;
  }

  .stg-banner {
    padding: 14px 16px;
  }

  .stg-banner__row {
    flex-direction: column;
    gap: 12px;
  }

  .stg-banner__right {
    width: 100%;
    justify-content: flex-end;
  }

  .stg-banner__version {
    font-size: 18px;
  }

  .stg-info__value--truncate {
    max-width: 180px;
  }
}
</style>
