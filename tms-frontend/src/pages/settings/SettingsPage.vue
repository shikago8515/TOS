<template>
  <div class="stg-layout">
    <!-- 主工作区：非对称双栏布局 -->
    <main class="stg-main">
      <!-- 左栏：主核心区域 (Hero Showcase & Downloads Grouped) -->
      <div class="stg-col-primary">
        <!-- 1. 顶部 Hero 看板：显示当前版本和状态 -->
        <header class="stg-hero" :class="{ 'has-update': canDownload }">
          <!-- 背景流光 -->
          <div class="stg-hero__background">
            <div class="stg-hero__glow"></div>
          </div>

          <div class="stg-hero__content">
            <div class="stg-hero__info">
              <div class="stg-hero__icon-box">
                <AppIcon name="settings" class="icon-pulse" />
              </div>
              <div class="stg-hero__title-group">
                <div class="stg-hero__subtitle">{{ text('当前版本') }}</div>
                <h1 class="stg-hero__title">{{ currentVersion }}</h1>
              </div>
            </div>

            <div class="stg-hero__actions">
              <!-- 语言切换器 -->
              <div class="stg-hero__lang">
                <SettingsLanguageSwitch />
              </div>
              <!-- 快捷检查更新 -->
              <button
                v-if="hasDesktopUpdateSupport"
                class="stg-btn-interactive"
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
            </div>
          </div>

          <!-- 展开的进度面板 -->
          <transition name="stg-slide-fade">
            <div
              v-if="status?.downloading && status?.progress"
              class="stg-hero__progress-panel"
            >
              <div class="stg-progress__meta">
                <span class="stg-progress__status">
                  <AppIcon name="download-cloud" class="icon-bounce" />
                  {{ text('系统更新下载中') }}
                </span>
                <span class="stg-progress__details">{{ downloadDetail }}</span>
              </div>
              <div class="stg-progress__track">
                <div
                  class="stg-progress__fill"
                  :style="{ width: `${progressPercent}%` }"
                >
                  <div class="stg-progress__shimmer"></div>
                </div>
                <span class="stg-progress__percent">{{ progressPercent }}%</span>
              </div>
            </div>
          </transition>
        </header>

        <!-- 状态通知 Toast -->
        <transition name="stg-toast-slide">
          <div
            v-if="noticeText"
            class="stg-toast"
            :class="`stg-toast--${noticeTone}`"
            role="status"
          >
            <AppIcon
              :name="noticeTone === 'error' ? 'alert-circle' : noticeTone === 'success' ? 'check-circle' : 'info'"
              class="stg-toast__lead-icon"
            />
            <span class="stg-toast__message">{{ text(noticeText) }}</span>
            <button class="stg-toast__close-btn" type="button" @click="message = ''">
              <AppIcon name="stop-circle" />
            </button>
          </div>
        </transition>

        <!-- 2. 下载中心：全新非对称双主轴分栏布局 (清新双淡色版，无任何深色大黑框) -->
        <section class="stg-section stg-downloads">
          <div class="stg-section__header">
            <div class="stg-section__title-bar">
              <AppIcon name="download" class="stg-section__icon" />
              <h2>{{ text('下载中心') }}</h2>
            </div>
            <p class="stg-section__desc">{{ text('根据您的使用场景，选择部署桌面完整端或安装网页轻量级扩展') }}</p>
          </div>

          <div class="stg-downloads__split-container">
            <!-- 2.1 左大栏：桌面独立运行客户端套件 (无多余背景边框包裹) -->
            <div class="stg-downloads__group stg-downloads__group--desktop">
              <div class="stg-group-header">
                <AppIcon name="monitor" class="stg-group-icon" />
                <span>{{ text('独立桌面客户端套件') }}</span>
              </div>

              <div class="stg-panel-cards" :class="{ 'has-manual': hasDesktopUpdateSupport && manualDownload }">
                <!-- 卡片 1: TOS 桌面端轻量安装包 (在线下载) -->
                <div class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('TOS 桌面端轻量安装器') }}</h4>
                        <span class="stg-card-badge">{{ text('在线下载') }}</span>
                      </div>
                      <p class="stg-card-description">
                        {{ text('体积轻巧，首选安装。在线从 MinIO 自动下载完整组件。') }}
                      </p>
                    </div>
                    <div class="stg-card-footer">
                      <button
                        class="stg-btn-primary"
                        type="button"
                        :disabled="desktopInstallerDownloading"
                        @click="handleDesktopInstallerDownload"
                      >
                        <AppIcon name="download" />
                        <span>{{ desktopInstallerDownloading ? text('获取中...') : text('安全下载轻量安装器') }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 卡片 2: TOS 桌面端全量部署包 (离线全量) -->
                <div class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('TOS 桌面端全量部署包') }}</h4>
                        <span class="stg-card-badge-outline">{{ text('离线全量') }}</span>
                      </div>
                      <p class="stg-card-description">
                        {{ text('集成完整运行环境，完全离线一键部署，适合物理内网环境。') }}
                      </p>
                    </div>
                    <div class="stg-card-footer">
                      <button
                        class="stg-btn-secondary stg-btn-secondary--cyan"
                        type="button"
                        :disabled="desktopFullInstallerDownloading"
                        @click="handleDesktopFullInstallerDownload"
                      >
                        <AppIcon name="download" />
                        <span>{{ desktopFullInstallerDownloading ? text('获取中...') : text('安全下载离线全量包') }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 免安装绿色版 (仅在支持时显示) -->
                <div v-if="hasDesktopUpdateSupport && manualDownload" class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('免安装绿色便携版') }}</h4>
                        <span class="stg-card-badge-outline">{{ text('绿色便携') }}</span>
                      </div>
                      <p class="stg-card-description">{{ text('解压即用，无缝集成运行组件。') }}</p>
                    </div>
                    <div class="stg-card-footer">
                      <button
                        class="stg-btn-secondary"
                        type="button"
                        :disabled="isActionLocked"
                        @click="handleManualDownload"
                      >
                        <AppIcon name="download" />
                        <span>{{ activeAction === 'manual' ? text('准备中...') : text('获取免安装版') }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2.2 右小栏：网页端轻量级协作组件 -->
            <div class="stg-downloads__group stg-downloads__group--web">
              <div class="stg-group-header">
                <AppIcon name="monitor-code" class="stg-group-icon" />
                <span>{{ text('网页自动化助手') }}</span>
              </div>

              <div class="stg-panel-cards">
                <!-- 自动化小助手安装包 -->
                <div class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('TOS 网页桥接小助手') }}</h4>
                        <span class="stg-card-badge-helper">{{ text('浏览器专属') }}</span>
                      </div>
                      <p class="stg-card-description">
                        {{ text('专为 Web 浏览器打造的轻量级桥接组件，网页端直连调度。') }}
                      </p>

                      <!-- 网页助手优势特性对照列表 -->
                      <ul class="stg-feature-list">
                        <li class="stg-feature-item">
                          <AppIcon name="check" class="stg-feature-icon" />
                          <span>{{ text('极速轻量：免去客户端安装') }}</span>
                        </li>
                        <li class="stg-feature-item">
                          <AppIcon name="check" class="stg-feature-icon" />
                          <span>{{ text('即开即用：网页与本机无缝桥接') }}</span>
                        </li>
                        <li class="stg-feature-item">
                          <AppIcon name="check" class="stg-feature-icon" />
                          <span>{{ text('安全隔离：严格鉴权防越权') }}</span>
                        </li>
                      </ul>
                    </div>
                    <div class="stg-card-footer">
                      <button
                        class="stg-btn-secondary stg-btn-secondary--teal"
                        type="button"
                        :disabled="helperDownloading"
                        @click="handleHelperDownload"
                      >
                        <AppIcon name="download" />
                        <span>{{ helperDownloading ? text('获取中...') : text('极速下载助手扩展') }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 右栏：侧边辅助与信息检测 -->
      <div class="stg-col-sidebar">
        <!-- 3. 更新管理看板 -->
        <section class="stg-section stg-updates">
          <div class="stg-section__header-compact">
            <AppIcon name="refresh-cw" class="stg-section__icon-mini" />
            <h3>{{ text('更新管理') }}</h3>
          </div>

          <div class="stg-updates__panel">
            <!-- 桌面更新流程 -->
            <!-- 非桌面端环境：服务器/浏览器模式提示 -->
            <div class="stg-server-mode-card">
              <div class="stg-server-mode__header">
                <div class="stg-server-mode__avatar">
                  <AppIcon name="wifi" class="icon-pulse" />
                </div>
                <div class="stg-server-mode__title">
                  <h4>{{ runModeLabel }}</h4>
                  <span class="stg-status-badge stg-status-badge--live">{{ text('线上连接中') }}</span>
                </div>
              </div>
              <p class="stg-server-mode__desc">
                {{ text('当前运行于 Web 服务器 / 浏览器沙盒中。当您登录桌面客户端时，本面板将自动启用增量更新检测。') }}
              </p>

              <!-- 交互设计：展示云端与本地交互的流程链路示意（升级为多层光效流动动画） -->
              <div class="stg-flow-chart">
                <div class="stg-flow-node">
                  <AppIcon name="database" />
                  <span>{{ text('云端服务') }}</span>
                </div>
                <div class="stg-flow-line">
                  <!-- 双重光点流动线，形成流畅的数据同步感 -->
                  <span class="stg-flow-stream stg-flow-stream--1"></span>
                  <span class="stg-flow-stream stg-flow-stream--2"></span>
                  <span class="stg-flow-stream stg-flow-stream--3"></span>
                </div>
                <div class="stg-flow-node">
                  <AppIcon name="browser" />
                  <span>{{ text('网页应用') }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. 版本元数据参数面板 -->
        <section class="stg-section stg-metadata">
          <div class="stg-section__header-compact">
            <AppIcon name="sparkles" class="stg-section__icon-mini" />
            <h3>{{ text('运行参数') }}</h3>
          </div>

          <div class="stg-metadata-list">
            <!-- 当前版本 -->
            <div class="stg-metadata-item">
              <span class="stg-metadata-key">{{ t('app.settings.currentVersion') }}</span>
              <span class="stg-metadata-val mono-font">{{ currentVersion }}</span>
            </div>

            <!-- 最新版本 (仅限桌面端) -->
            <div v-if="hasDesktopUpdateSupport" class="stg-metadata-item">
              <span class="stg-metadata-key">{{ t('app.settings.latestVersion') }}</span>
              <span class="stg-metadata-val mono-font highlight-cyan">{{ latestVersion }}</span>
            </div>

            <!-- 运行模式 -->
            <div class="stg-metadata-item">
              <span class="stg-metadata-key">{{ t('app.settings.runMode') }}</span>
              <span class="stg-metadata-val"><span class="stg-pill-mode">{{ runModeLabel }}</span></span>
            </div>

            <!-- 更新服务源 (仅限桌面端) -->
            <div v-if="hasDesktopUpdateSupport" class="stg-metadata-item stg-metadata-item--vertical">
              <div class="stg-metadata-header-row">
                <span class="stg-metadata-key">{{ t('app.settings.feedUrl') }}</span>
                <span v-if="feedUrlSourceLabel" class="stg-pill-source">{{ feedUrlSourceLabel }}</span>
              </div>
              <span class="stg-metadata-val mono-font link-val" :title="feedUrlText">
                {{ feedUrlText }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppIcon from '../../shared/ui/AppIcon.vue'
import SettingsLanguageSwitch from './SettingsLanguageSwitch.vue'
import { useSettingsPageModel } from './useSettingsPageModel'

const {
  activeAction,
  canDownload,
  canInstall,
  currentVersion,
  desktopFullInstallerDownloading,
  desktopInstallerDownloading,
  downloadDetail,
  feedUrlSourceLabel,
  feedUrlText,
  handleCheck,
  handleDesktopFullInstallerDownload,
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

onMounted(() => {
  const shell = document.querySelector('.content-shell')
  if (shell) {
    shell.classList.add('no-scroll')
  }
})

onUnmounted(() => {
  const shell = document.querySelector('.content-shell')
  if (shell) {
    shell.classList.remove('no-scroll')
  }
})
</script>

<style scoped lang="scss">
/* ================================================================= */
/* Modern Settings Layout Tokens (Teal / Cyan / Slate, No Purple)     */
/* ================================================================= */
.stg-layout {
  --teal-50: #f0fdfa;
  --teal-100: #ccfbf1;
  --teal-200: #99f6e4;
  --teal-500: #14b8a6;
  --teal-600: #0d9488;
  --teal-700: #0f766e;
  --teal-900: #115e59;

  --cyan-50: #ecfeff;
  --cyan-100: #cffafe;
  --cyan-500: #06b6d4;
  --cyan-600: #0891b2;
  --cyan-700: #0369a1;

  --emerald-50: #ecfdf5;
  --emerald-500: #10b981;
  --emerald-600: #059669;

  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;

  --border-radius-card: 16px;
  --border-radius-inner: 10px;
  --border-radius-pill: 9999px;

  --transition-bezier: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  --transition-bounce: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  --shadow-soft: 0 4px 20px -2px rgba(15, 23, 42, 0.03), 0 2px 8px -1px rgba(15, 23, 42, 0.01);
  --shadow-elevated: 0 12px 30px -4px rgba(13, 148, 136, 0.06), 0 4px 12px -2px rgba(15, 23, 42, 0.02);

  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  padding: 16px 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.04) 0%, transparent 40%),
              radial-gradient(circle at 90% 80%, rgba(20, 184, 166, 0.04) 0%, transparent 40%),
              #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: var(--slate-900);
  -webkit-font-smoothing: antialiased;
}

/* 动态挂载到父外壳，强力禁滚且自适应 */
:global(.content-shell.no-scroll) {
  overflow: hidden !important;
  height: 100% !important;
  max-height: 100% !important;
}

/* Eliminate browser default focus borders */
button, input, select, textarea {
  outline: none !important;
  &:focus {
    outline: none !important;
  }
  &:focus-visible {
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.25) !important;
  }
}

/* Keyframe animations */
@keyframes pulse-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.95); opacity: 0.8; }
}
@keyframes spin-cw {
  to { transform: rotate(360deg); }
}
@keyframes shine-slide {
  0% { transform: translateX(-150%) skewX(-25deg); }
  100% { transform: translateX(150%) skewX(-25deg); }
}
@keyframes stagger-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes stream-flow {
  0% { left: 0%; opacity: 0; }
  15% { opacity: 0.85; }
  85% { opacity: 0.85; }
  100% { left: 100%; opacity: 0; }
}

.is-spin { animation: spin-cw 0.8s linear infinite; }
.icon-pulse { animation: pulse-pulse 2.2s ease-in-out infinite; }

/* Grid main container */
.stg-main {
  display: grid;
  grid-template-columns: 6.8fr 3.2fr;
  gap: 16px;
  width: 100%;
  max-width: 1080px;
  height: 100%;
  max-height: 580px;
  min-height: 0;
  overflow: hidden;
  animation: stagger-in 0.6s var(--transition-bezier) both;
}

.stg-col-primary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.stg-col-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

/* Card wrappers */
.stg-section {
  position: relative;
  background-color: #ffffff;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-card);
  box-shadow: var(--shadow-soft);
  transition: var(--transition-bezier);
  overflow: hidden;

  &:hover {
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03);
    border-color: rgba(20, 184, 166, 0.2);
  }
}

.stg-section__header {
  padding: 14px 18px 8px;
  border-bottom: 1px solid var(--slate-100);
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-section__title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stg-section__icon {
  font-size: 14px;
  color: var(--teal-600);
}

.stg-section__desc {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--slate-500);
}

/* Compact headers */
.stg-section__header-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 6px;
  border-bottom: 1px solid var(--slate-100);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-section__icon-mini {
  font-size: 11px;
  color: var(--teal-600);
}

/* Hero card banner */
.stg-hero {
  position: relative;
  z-index: 20;
  background: linear-gradient(135deg, #ffffff 0%, var(--teal-50) 100%);
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-card);
  box-shadow: var(--shadow-soft);
  padding: 14px 18px;
  flex-shrink: 0;
  overflow: visible;
  transition: var(--transition-bezier);

  &.has-update {
    background: linear-gradient(135deg, #ffffff 0%, var(--cyan-50) 100%);
    border-color: rgba(6, 182, 212, 0.25);
    box-shadow: var(--shadow-elevated);
  }

  &:hover {
    border-color: rgba(20, 184, 166, 0.3);
  }
}

.stg-hero__background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.stg-hero__glow {
  position: absolute;
  top: -150px;
  right: -150px;
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, rgba(20, 184, 166, 0) 70%);
}

.stg-hero__content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.stg-hero__info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stg-hero__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%);
  color: #ffffff;
  border-radius: 8px;
  font-size: 16px;
  box-shadow: 0 4px 10px rgba(13, 148, 136, 0.15);
}

.stg-hero__title-group {
  display: flex;
  flex-direction: column;
}

.stg-hero__subtitle {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
  color: var(--slate-400);
}

.stg-hero__title {
  margin: 1px 0 0;
  font-size: 20px;
  font-weight: 900;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: var(--slate-900);
  letter-spacing: -0.5px;
}

.stg-hero__actions {
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stg-btn-interactive {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.01);
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    border-color: var(--teal-500);
    color: var(--teal-600);
    background-color: var(--teal-50);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(13, 148, 136, 0.06);
  }

  &:active:not(:disabled) {
    transform: scale(0.97) !important;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.stg-hero__lang {
  display: flex;
  align-items: center;
  position: relative;
  z-index: 40;
}

.stg-hero__progress-panel {
  position: relative;
  z-index: 2;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--slate-200);
}

.stg-progress__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.stg-progress__status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--teal-700);
}

.stg-progress__details {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--slate-500);
}

.stg-progress__track {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stg-progress__fill {
  position: relative;
  height: 4px;
  border-radius: var(--border-radius-pill);
  background: linear-gradient(90deg, var(--teal-500), var(--cyan-500));
  transition: width 0.4s cubic-bezier(0.1, 0.8, 0.25, 1);
  overflow: hidden;
  flex: 1;
}

.stg-progress__shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%);
  animation: shine-slide 1.6s infinite;
}

.stg-progress__percent {
  font-size: 11px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  color: var(--teal-600);
  min-width: 28px;
  text-align: right;
}

/* Toast component styles */
.stg-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: var(--border-radius-inner);
  border: 1px solid var(--slate-200);
  background-color: #ffffff;
  box-shadow: 0 6px 16px -5px rgba(15, 23, 42, 0.06);
}

.stg-toast__lead-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.stg-toast__message {
  flex: 1;
  font-size: 11.5px;
  font-weight: 600;
}

.stg-toast__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  background: transparent;
  color: var(--slate-400);
  border-radius: 4px;
  cursor: pointer;
  transition: var(--transition-bezier);

  &:hover {
    color: var(--slate-700);
    background-color: var(--slate-100);
  }
}

.stg-toast--success {
  border-color: rgba(16, 185, 129, 0.15);
  background-color: var(--emerald-50);
  color: var(--emerald-600);
}
.stg-toast--warning {
  border-color: rgba(245, 158, 11, 0.15);
  background-color: #fffbeb;
  color: #d97706;
}
.stg-toast--error {
  border-color: rgba(239, 68, 68, 0.15);
  background-color: #fef2f2;
  color: #dc2626;
}

/* Downloads section layout */
.stg-downloads {
  z-index: 10;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stg-downloads__split-container {
  display: grid;
  grid-template-columns: 1.95fr 1.05fr; /* 65% vs 35% */
  gap: 16px;
  padding: 0 16px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.stg-downloads__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.stg-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 800;
  color: var(--slate-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;

  .stg-group-icon {
    font-size: 12px;
    color: var(--teal-500);

    .stg-downloads__group--web & {
      color: var(--cyan-500);
    }
  }
}

.stg-panel-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(20, 184, 166, 0.15);
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(20, 184, 166, 0.35);
  }

  &.has-manual {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stg-downloads__group--web .stg-panel-cards {
  display: flex;
  flex-direction: column;
  height: 100%;
  align-items: stretch;
}

/* Cards glassmorphism styles */
.stg-download-card {
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: var(--border-radius-inner);
  overflow: hidden;
  height: 100%;
  transition: var(--transition-bounce);
}

.stg-card-content {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  box-sizing: border-box;
  flex: 1;
}

.stg-card-body {
  margin-bottom: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.stg-card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
  gap: 4px;
}

.stg-download-card--light {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.01);

  &:hover {
    transform: translateY(-2px);
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03);
  }

  .stg-downloads__group--desktop &:hover {
    border-color: rgba(20, 184, 166, 0.25);
    box-shadow: 0 8px 20px rgba(13, 148, 136, 0.06);
  }

  .stg-downloads__group--web &:hover {
    border-color: rgba(6, 182, 212, 0.25);
    box-shadow: 0 8px 20px rgba(6, 182, 212, 0.06);
  }

  .stg-card-title {
    color: var(--slate-800);
  }

  .stg-card-description {
    color: var(--slate-500);
  }
}

.stg-card-title {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
}

.stg-card-description {
  margin: 3px 0 0 0;
  font-size: 10.5px;
  line-height: 1.45;
}

/* Web Helper Feature Checklist styles */
.stg-feature-list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stg-feature-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--slate-600);
}

.stg-feature-icon {
  font-size: 10px;
  color: var(--teal-500);
  flex-shrink: 0;
}

.stg-card-badge {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: var(--border-radius-pill);
  background-color: var(--teal-500);
  color: #ffffff;
  letter-spacing: 0.1px;
}

.stg-card-badge-outline {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: var(--border-radius-pill);
  background-color: transparent;
  color: var(--cyan-500);
  border: 1px solid rgba(6, 182, 212, 0.35);
  letter-spacing: 0.1px;
}

.stg-card-badge-helper {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: var(--border-radius-pill);
  background-color: var(--teal-100);
  color: var(--teal-700);
  border: 1px solid rgba(20, 184, 166, 0.15);
  letter-spacing: 0.1px;
}

/* Button UI elements */
.stg-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 28px;
  border: 0;
  border-radius: var(--border-radius-inner);
  background: linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(13, 148, 136, 0.15);
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 12px rgba(13, 148, 136, 0.25);
  }

  &:active {
    transform: scale(0.97) !important;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.stg-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 28px;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    border-color: var(--teal-500);
    color: var(--teal-600);
    background-color: var(--teal-50);
    box-shadow: 0 4px 10px rgba(20, 184, 166, 0.08);
  }

  &:active {
    transform: scale(0.97) !important;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--cyan {
    border-color: rgba(6, 182, 212, 0.25);
    background-color: var(--cyan-50);
    color: var(--cyan-700);

    &:hover:not(:disabled) {
      border-color: var(--cyan-500);
      background-color: var(--cyan-500);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(6, 182, 212, 0.15);
    }
  }

  &--teal {
    border-color: rgba(20, 184, 166, 0.25);
    background-color: var(--teal-50);
    color: var(--teal-700);

    &:hover:not(:disabled) {
      border-color: var(--teal-500);
      background-color: var(--teal-500);
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(20, 184, 166, 0.15);
    }
  }
}

/* Timeline/updates config */
.stg-updates {
  z-index: 10;
  flex: 1.35;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stg-updates__panel {
  padding: 8px 14px 14px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(20, 184, 166, 0.15);
    border-radius: 2px;
  }
}

.stg-timeline {
  position: relative;
  padding-left: 14px;

  &::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 10px;
    bottom: 10px;
    width: 2px;
    background-color: var(--slate-200);
  }
}

.stg-timeline-item {
  position: relative;
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 0;
  }

  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
    filter: grayscale(0.8);
  }
}

.stg-timeline-item__badge {
  position: absolute;
  left: -22px;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #ffffff;
  border: 2px solid var(--teal-500);
  color: var(--teal-600);
  font-size: 9px;
  z-index: 2;
}

.stg-timeline-item__content {
  padding-left: 12px;

  h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--slate-800);
  }

  p {
    margin: 2px 0 6px 0;
    font-size: 10.5px;
    color: var(--slate-500);
    line-height: 1.4;
  }
}

.stg-timeline-action-btn {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--slate-300);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-bezier);

  &:hover {
    border-color: var(--teal-500);
    color: var(--teal-600);
    background-color: var(--teal-50);
  }

  &:active {
    transform: scale(0.95) !important;
  }

  &--primary {
    color: var(--teal-600);
    border-color: var(--teal-200);
    &:hover { background-color: var(--teal-50); border-color: var(--teal-500); }
  }

  &--success {
    color: var(--emerald-600);
    border-color: var(--emerald-200);
    &:hover { background-color: var(--emerald-50); border-color: var(--emerald-500); }
  }
}

.stg-server-mode-card {
  background-color: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-inner);
  padding: 12px;
  transition: var(--transition-bezier);

  &:hover {
    border-color: var(--teal-200);
    box-shadow: 0 6px 16px rgba(13, 148, 136, 0.03);
  }
}

.stg-server-mode__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.stg-server-mode__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--teal-100);
  color: var(--teal-600);
  font-size: 14px;
}

.stg-server-mode__title {
  display: flex;
  flex-direction: column;

  h4 {
    margin: 0;
    font-size: 11.5px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 8.5px;
  font-weight: 800;
  color: var(--teal-600);

  &::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--teal-500);
    margin-right: 4px;
    animation: pulse-pulse 1.4s infinite;
  }
}

.stg-server-mode__desc {
  margin: 0 0 12px 0;
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--slate-500);
}

.stg-flow-chart {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  border: 1px solid var(--slate-200);
  box-shadow: inset 0 2px 6px rgba(15, 23, 42, 0.01);
}

.stg-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 13px;
  color: var(--slate-700);

  span {
    font-size: 9px;
    font-weight: 800;
    color: var(--slate-400);
    text-transform: uppercase;
    letter-spacing: 0.2px;
  }
}

.stg-flow-line {
  position: relative;
  flex: 1;
  height: 3px;
  background-color: var(--slate-100);
  border-radius: var(--border-radius-pill);
  margin: 0 12px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.stg-flow-stream {
  position: absolute;
  top: 0;
  height: 100%;
  width: 12px;
  background: linear-gradient(90deg, rgba(20, 184, 166, 0) 0%, var(--teal-500) 50%, rgba(20, 184, 166, 0) 100%);
  border-radius: inherit;
  animation: stream-flow 2.4s infinite linear;

  &--1 { animation-delay: 0s; }
  &--2 { animation-delay: 0.8s; }
  &--3 { animation-delay: 1.6s; }
}

/* Parameters Panel */
.stg-metadata {
  z-index: 10;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stg-metadata-list {
  padding: 4px 14px 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(20, 184, 166, 0.15);
    border-radius: 2px;
  }
}

.stg-metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--slate-100);
  transition: var(--transition-bezier);

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  &:hover {
    padding-left: 4px;
    background-color: rgba(20, 184, 166, 0.02);
  }

  &--vertical {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    &:hover {
      padding-left: 0;
      background-color: transparent;
    }
  }
}

.stg-metadata-header-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
}

.stg-metadata-key {
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-500);
}

.stg-metadata-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--slate-800);
}

.highlight-cyan {
  color: var(--cyan-600);
}

.mono-font {
  font-family: 'JetBrains Mono', monospace;
}

.link-val {
  word-break: break-all;
  color: var(--slate-500);
  font-weight: 500;
  font-size: 10px;
  background-color: var(--slate-50);
  padding: 4px 6px;
  border-radius: 4px;
  width: 100%;
  border: 1px solid transparent;
  transition: var(--transition-bezier);

  &:hover {
    border-color: var(--slate-200);
    background-color: #ffffff;
    color: var(--slate-800);
  }
}

.stg-pill-mode {
  padding: 1px 6px;
  background-color: var(--teal-50);
  color: var(--teal-700);
  font-size: 9.5px;
  font-weight: 800;
  border-radius: var(--border-radius-pill);
}

.stg-pill-source {
  padding: 1px 5px;
  background-color: var(--slate-100);
  color: var(--slate-500);
  font-size: 9px;
  font-weight: 800;
  border-radius: 4px;
}

/* Transition library */
.stg-slide-fade-enter-active, .stg-slide-fade-leave-active {
  transition: all 0.4s var(--transition-bezier);
  max-height: 120px;
  opacity: 1;
  overflow: hidden;
}
.stg-slide-fade-enter-from, .stg-slide-fade-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-8px);
}

.stg-toast-slide-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.stg-toast-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.stg-toast-slide-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-14px);
}
.stg-toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Responsive media queries */
@media (max-width: 1280px) {
  .stg-downloads__split-container {
    grid-template-columns: 1.85fr 1.15fr;
    gap: 16px;
  }
  .stg-panel-cards {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 1024px) {
  .stg-main {
    grid-template-columns: 1fr;
    gap: 16px;
    height: auto;
    max-height: none;
    overflow: auto;
  }
  .stg-layout {
    height: auto;
    max-height: none;
    overflow: auto;
  }
}

@media (max-width: 768px) {
  .stg-downloads__split-container {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stg-layout {
    padding: 10px;
  }

  .stg-hero__content {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .stg-hero__actions {
    width: 100%;
    justify-content: space-between;
  }

  .stg-downloads__split-container {
    padding: 0 10px;
  }
}
</style>
