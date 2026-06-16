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
            <!-- 2.1 左大栏：桌面独立运行客户端套件 (Native Professional - 清新极光青渐变) -->
            <div class="stg-downloads__panel-group stg-downloads__panel-group--desktop">
              <div class="stg-panel-glow"></div>
              
              <div class="stg-panel-header">
                <div class="stg-panel-header-icon-box">
                  <AppIcon name="monitor" />
                </div>
                <div class="stg-panel-title-group">
                  <h3>{{ text('独立桌面客户端套件') }}</h3>
                  <p>{{ text('本地原生执行，集成完整运行环境，具备最强系统级自动化操控权限') }}</p>
                </div>
              </div>

              <div class="stg-panel-cards">
                <!-- 卡片 1: TOS 桌面端轻量安装包 (在线下载) -->
                <div class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('TOS 桌面端轻量安装器') }}</h4>
                        <span class="stg-card-badge">{{ text('在线下载') }}</span>
                      </div>
                      <p class="stg-card-description">
                        {{ text('下载体积小巧的快速安装器。安装和初始化阶段需要连接远程服务器的 MinIO 存储服务，在线拉取并下载应用所需的完整内容和组件。') }}
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
                        <span>{{ desktopInstallerDownloading ? text('准备中...') : text('安全下载轻量安装器') }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 卡片 2: TOS 桌面端全量部署包 (离线完整) -->
                <div class="stg-download-card stg-download-card--light">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('TOS 桌面端全量部署包') }}</h4>
                        <span class="stg-card-badge-outline">{{ text('离线全量') }}</span>
                      </div>
                      <p class="stg-card-description">
                        {{ text('包含了全量运行组件与核心环境的单体完整部署包。下载后进行安装时，完全不需要连接远程服务器再去下载任何多余内容，适合离线或物理内网环境一键部署。') }}
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
                <div v-if="hasDesktopUpdateSupport && manualDownload" class="stg-download-card stg-download-card--light stg-download-card--fullwidth">
                  <div class="stg-card-content">
                    <div class="stg-card-body">
                      <div class="stg-card-header-row">
                        <h4 class="stg-card-title">{{ text('免安装绿色便携版') }}</h4>
                        <span class="stg-card-badge-outline">{{ text('绿色便携') }}</span>
                      </div>
                      <p class="stg-card-description">{{ manualDownloadDetail }}</p>
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

            <!-- 2.2 右小栏：网页端轻量级协作组件 (Web Extension Lite - 清爽极光绿渐变) -->
            <div class="stg-downloads__panel-group stg-downloads__panel-group--web">
              <div class="stg-panel-header">
                <div class="stg-panel-header-icon-box stg-panel-header-icon-box--teal">
                  <AppIcon name="monitor-code" />
                </div>
                <div class="stg-panel-title-group">
                  <h3>{{ text('网页自动化助手') }}</h3>
                  <p>{{ text('免装完整包，直接在现有浏览器中桥接调度本机自动化环境') }}</p>
                </div>
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
                        {{ text('为 Web 浏览器用户打造的轻量级连接组件。只需在您本机的普通浏览器中添加配置，即可通过网页直接调度底层脚本，免去安装大型客户端的繁琐步骤。') }}
                      </p>
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
            <div v-if="hasDesktopUpdateSupport" class="stg-timeline">
              <div class="stg-timeline-item" :class="{ 'is-active': true }">
                <div class="stg-timeline-item__badge"><AppIcon name="refresh-cw" /></div>
                <div class="stg-timeline-item__content">
                  <h4>{{ text('检查更新') }}</h4>
                  <p>{{ text('在更新服务器检索可用版本') }}</p>
                  <button
                    class="stg-timeline-action-btn"
                    type="button"
                    :disabled="isActionLocked"
                    @click="handleCheck"
                  >
                    {{ status?.checking || activeAction === 'check' ? text('检查中...') : text('立即检查') }}
                  </button>
                </div>
              </div>

              <div class="stg-timeline-item" :class="{ 'is-disabled': !canDownload }">
                <div class="stg-timeline-item__badge"><AppIcon name="download-cloud" /></div>
                <div class="stg-timeline-item__content">
                  <h4>{{ text('下载新版') }}</h4>
                  <p>{{ text('获取云端最新的升级补丁') }}</p>
                  <button
                    class="stg-timeline-action-btn stg-timeline-action-btn--primary"
                    type="button"
                    :disabled="!canDownload || isActionLocked"
                    @click="handleDownload"
                  >
                    {{ status?.downloading || activeAction === 'download' ? text('正在下载...') : text('开始下载') }}
                  </button>
                </div>
              </div>

              <div class="stg-timeline-item" :class="{ 'is-disabled': !canInstall }">
                <div class="stg-timeline-item__badge"><AppIcon name="rocket" /></div>
                <div class="stg-timeline-item__content">
                  <h4>{{ text('热更新并重启') }}</h4>
                  <p>{{ text('安装补丁并重新加载桌面客户端') }}</p>
                  <button
                    class="stg-timeline-action-btn stg-timeline-action-btn--success"
                    type="button"
                    :disabled="!canInstall"
                    @click="handleInstall"
                  >
                    {{ activeAction === 'install' ? text('正在应用...') : text('立即安装') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 非桌面端环境：服务器/浏览器模式提示 -->
            <div v-else class="stg-server-mode-card">
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
                {{ text('当前运行于 Web 服务器 / 浏览器沙盒中。当您使用 TOS 桌面客户端登录时，本面板将自动启用完整的“增量自动更新”与系统补丁管理功能。') }}
              </p>
              
              <!-- 交互设计：展示云端与本地交互的流程链路示意（升级为多层光效流动动画） -->
              <div class="stg-flow-chart">
                <div class="stg-flow-node">
                  <AppIcon name="database" />
                  <span>Cloud Server</span>
                </div>
                <div class="stg-flow-line">
                  <!-- 双重光点流动线，形成流畅的数据同步感 -->
                  <span class="stg-flow-stream stg-flow-stream--1"></span>
                  <span class="stg-flow-stream stg-flow-stream--2"></span>
                  <span class="stg-flow-stream stg-flow-stream--3"></span>
                </div>
                <div class="stg-flow-node">
                  <AppIcon name="browser" />
                  <span>Web App</span>
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
</script>

<style scoped lang="scss">
/* ================================================================= */
/* 现代高端极简设计令牌 (Teal / Cyan / Slate 配色体系，绝无紫色)         */
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
  --shadow-soft: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 8px -1px rgba(15, 23, 42, 0.02);
  --shadow-elevated: 0 12px 30px -4px rgba(13, 148, 136, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03);

  min-height: 100vh;
  padding: 16px 20px 24px;
  background-color: var(--slate-50);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: var(--slate-900);
  -webkit-font-smoothing: antialiased;
}

/* 动效关键帧 */
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

/* ================================================================= */
/* 结构排版布局 (Grid & Columns)                                     */
/* ================================================================= */
.stg-main {
  display: grid;
  grid-template-columns: 7fr 3fr;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  animation: stagger-in 0.6s var(--transition-bezier) both;
}

.stg-col-primary {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stg-col-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 通用卡片容器 */
.stg-section {
  position: relative;
  background-color: #ffffff;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-card);
  box-shadow: var(--shadow-soft);
  transition: var(--transition-bezier);

  &:hover {
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.04);
    border-color: var(--slate-300);
  }
}

.stg-section__header {
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--slate-100);

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-section__title-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stg-section__icon {
  font-size: 16px;
  color: var(--teal-600);
}

.stg-section__desc {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--slate-500);
}

/* 侧栏紧凑型卡片头部 */
.stg-section__header-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 10px;
  border-bottom: 1px solid var(--slate-100);

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-section__icon-mini {
  font-size: 13px;
  color: var(--teal-600);
}

/* ================================================================= */
/* 1. Status Hero Banner                                            */
/* ================================================================= */
.stg-hero {
  position: relative;
  z-index: 20; 
  background: linear-gradient(135deg, #ffffff 0%, var(--teal-50) 100%);
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-card);
  box-shadow: var(--shadow-soft);
  padding: 24px;
  overflow: visible;
  transition: var(--transition-bezier);

  &.has-update {
    background: linear-gradient(135deg, #ffffff 0%, var(--cyan-50) 100%);
    border-color: rgba(6, 182, 212, 0.3);
    box-shadow: var(--shadow-elevated);
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
  background: radial-gradient(circle, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0) 70%);
}

.stg-hero__content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.stg-hero__info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stg-hero__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%);
  color: #ffffff;
  border-radius: 12px;
  font-size: 20px;
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.25);
}

.stg-hero__title-group {
  display: flex;
  flex-direction: column;
}

.stg-hero__subtitle {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
  color: var(--slate-400);
}

.stg-hero__title {
  margin: 2px 0 0;
  font-size: 26px;
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
  gap: 12px;
}

.stg-btn-interactive {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.02);
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    border-color: var(--teal-500);
    color: var(--teal-600);
    background-color: var(--teal-50);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(13, 148, 136, 0.08);
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
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--slate-200);
}

.stg-progress__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.stg-progress__status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--teal-700);
}

.stg-progress__details {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--slate-500);
}

.stg-progress__track {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stg-progress__fill {
  position: relative;
  height: 6px;
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
  font-size: 13px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  color: var(--teal-600);
  min-width: 36px;
  text-align: right;
}

/* ================================================================= */
/* 2. Toast 通知栏                                                   */
/* ================================================================= */
.stg-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: var(--border-radius-inner);
  border: 1px solid var(--slate-200);
  background-color: #ffffff;
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
}

.stg-toast__lead-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.stg-toast__message {
  flex: 1;
  font-size: 12.5px;
  font-weight: 600;
}

.stg-toast__close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
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
  border-color: rgba(16, 185, 129, 0.2);
  background-color: var(--emerald-50);
  color: var(--emerald-600);
}
.stg-toast--warning {
  border-color: rgba(245, 158, 11, 0.2);
  background-color: #fffbeb;
  color: #d97706;
}
.stg-toast--error {
  border-color: rgba(239, 68, 68, 0.2);
  background-color: #fef2f2;
  color: #dc2626;
}

/* ================================================================= */
/* 3. 下载中心：全新非对称双主轴分栏布局 (清新双淡色版，无任何深色大黑框) */
/* ================================================================= */
.stg-downloads {
  z-index: 10;
  padding-bottom: 24px;
}

.stg-downloads__split-container {
  display: grid;
  grid-template-columns: 2.05fr 0.95fr; /* 68% vs 32% */
  gap: 20px;
  padding: 0 20px;
}

/* 分组大基座面板 */
.stg-downloads__panel-group {
  position: relative;
  border-radius: var(--border-radius-card);
  padding: 24px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: var(--transition-bezier);
  border: 1px solid var(--slate-200);
}

/* 左面板：专业桌面端 (极光青/水鸭青高级渐变背景 - 代替原先黑框) */
.stg-downloads__panel-group--desktop {
  background: linear-gradient(135deg, #ffffff 0%, var(--teal-50) 100%);
  border-color: var(--teal-100);
  box-shadow: 0 12px 28px -4px rgba(13, 148, 136, 0.04);

  &:hover {
    border-color: var(--teal-200);
    box-shadow: 0 16px 36px -4px rgba(13, 148, 136, 0.08);
  }

  .stg-panel-glow {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: radial-gradient(circle at 5% 5%, rgba(20, 184, 166, 0.08) 0%, rgba(20, 184, 166, 0) 50%);
    pointer-events: none;
    border-radius: inherit;
  }

  .stg-panel-header-icon-box {
    background-color: var(--teal-50);
    color: var(--teal-600);
    border: 1px solid var(--teal-100);
  }

  h3 {
    color: var(--slate-800);
  }

  p {
    color: var(--slate-500);
  }

  .stg-panel-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    align-items: stretch;
  }
}

/* 右面板：轻量小助手 (薄荷绿/极光绿高级渐变背景) */
.stg-downloads__panel-group--web {
  background: linear-gradient(135deg, #ffffff 0%, var(--cyan-50) 100%);
  border-color: var(--cyan-100);
  box-shadow: 0 12px 28px -4px rgba(6, 182, 212, 0.03);

  &:hover {
    border-color: var(--cyan-200);
    box-shadow: 0 16px 36px -4px rgba(6, 182, 212, 0.07);
  }

  .stg-panel-header-icon-box {
    background-color: var(--cyan-50);
    color: var(--cyan-600);
    border: 1px solid var(--cyan-100);
  }

  h3 {
    color: var(--slate-800);
  }

  p {
    color: var(--slate-500);
  }

  .stg-panel-cards {
    display: flex;
    flex-direction: column;
    height: 100%;
    align-items: stretch;
  }
}

/* 面板头部 */
.stg-panel-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 1px solid var(--teal-100);
  padding-bottom: 14px;

  .stg-downloads__panel-group--web & {
    border-bottom: 1px solid var(--cyan-100);
  }
}

.stg-panel-header-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 18px;
  flex-shrink: 0;
}

.stg-panel-title-group {
  display: flex;
  flex-direction: column;
  gap: 3px;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 850;
    letter-spacing: 0.3px;
  }

  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
  }
}

/* 卡片全部统一为高贵白色玻璃态，去除黑框样式 */
.stg-download-card {
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: var(--border-radius-inner);
  overflow: hidden;
  transition: var(--transition-bounce);
}

.stg-card-content {
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
}

.stg-card-body {
  margin-bottom: 16px;
  flex: 1;
}

.stg-card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 6px;
}

/* 统一卡片背景，仅通过 Hover 发光来呈现对应产品的调性 */
.stg-download-card--light {
  background-color: #ffffff;
  border: 1px solid var(--slate-200);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.01);
  height: 100%;

  &:hover {
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  }

  /* 桌面端的卡片 Hover 时发出青色微光 */
  .stg-downloads__panel-group--desktop &:hover {
    border-color: var(--teal-400);
    box-shadow: 0 10px 24px rgba(13, 148, 136, 0.08);
  }

  /* 网页小助手的卡片 Hover 时发出绿色微光 */
  .stg-downloads__panel-group--web &:hover {
    border-color: var(--cyan-400);
    box-shadow: 0 10px 24px rgba(6, 182, 212, 0.08);
  }

  .stg-card-title {
    color: var(--slate-800);
  }

  .stg-card-description {
    color: var(--slate-500);
  }
}

/* 绿色免安装版自适应整行 */
.stg-download-card--fullwidth {
  grid-column: span 2;
}

.stg-card-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
}

.stg-card-description {
  margin: 8px 0 0 0;
  font-size: 11.5px;
  line-height: 1.55;
}

.stg-card-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--border-radius-pill);
  background-color: var(--teal-500);
  color: #ffffff;
  letter-spacing: 0.2px;
}

.stg-card-badge-outline {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--border-radius-pill);
  background-color: transparent;
  color: var(--cyan-500);
  border: 1px solid rgba(6, 182, 212, 0.35);
  letter-spacing: 0.2px;
}

.stg-card-badge-helper {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: var(--border-radius-pill);
  background-color: var(--teal-100);
  color: var(--teal-700);
  border: 1px solid rgba(20, 184, 166, 0.15);
  letter-spacing: 0.2px;
}

/* 按钮重构 */
.stg-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 34px;
  border: 0;
  border-radius: var(--border-radius-inner);
  background: linear-gradient(135deg, var(--teal-500) 0%, var(--teal-600) 100%);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(13, 148, 136, 0.3);
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
  gap: 6px;
  width: 100%;
  height: 34px;
  border: 1px solid var(--slate-200);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-bezier);

  &:hover:not(:disabled) {
    border-color: var(--slate-800);
    color: var(--slate-900);
    background-color: var(--slate-100);
  }

  &:active {
    transform: scale(0.97) !important;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 桌面端全量部署包使用的次要按钮 */
  &--cyan {
    border-color: rgba(6, 182, 212, 0.25);
    background-color: var(--cyan-50);
    color: var(--cyan-700);

    &:hover:not(:disabled) {
      border-color: var(--cyan-500);
      background-color: var(--cyan-500);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(6, 182, 212, 0.15);
    }
  }

  /* 右侧浅色小助手按钮 */
  &--teal {
    border-color: rgba(20, 184, 166, 0.25);
    background-color: var(--teal-50);
    color: var(--teal-700);

    &:hover:not(:disabled) {
      border-color: var(--teal-500);
      background-color: var(--teal-500);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.15);
    }
  }
}

/* ================================================================= */
/* 4. 更新管理区 (时间线/流程设计)                                   */
/* ================================================================= */
.stg-updates {
  z-index: 10;
}

.stg-updates__panel {
  padding: 10px 16px 16px;
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
  margin-bottom: 20px;

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
    font-size: 13px;
    font-weight: 700;
    color: var(--slate-800);
  }

  p {
    margin: 2px 0 8px 0;
    font-size: 11.5px;
    color: var(--slate-500);
    line-height: 1.4;
  }
}

.stg-timeline-action-btn {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--slate-300);
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  color: var(--slate-700);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-bezier);

  &:hover {
    border-color: var(--slate-900);
    color: var(--slate-900);
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
  padding: 16px;
  transition: var(--transition-bezier);

  &:hover {
    border-color: var(--teal-100);
    box-shadow: 0 6px 16px rgba(13, 148, 136, 0.03);
  }
}

.stg-server-mode__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.stg-server-mode__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--teal-100);
  color: var(--teal-600);
  font-size: 15px;
}

.stg-server-mode__title {
  display: flex;
  flex-direction: column;

  h4 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--slate-800);
  }
}

.stg-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 800;
  color: var(--teal-600);
  
  &::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--teal-500);
    margin-right: 4px;
    animation: pulse-pulse 1.4s infinite;
  }
}

.stg-server-mode__desc {
  margin: 0 0 16px 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--slate-500);
}

/* 云端同步流动示意图 (发光流星流) */
.stg-flow-chart {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--border-radius-inner);
  background-color: #ffffff;
  border: 1px solid var(--slate-200);
  box-shadow: inset 0 2px 6px rgba(15, 23, 42, 0.01);
}

.stg-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: var(--slate-700);

  span {
    font-size: 9.5px;
    font-weight: 800;
    color: var(--slate-400);
    text-transform: uppercase;
    letter-spacing: 0.2px;
  }
}

.stg-flow-line {
  position: relative;
  flex: 1;
  height: 4px;
  background-color: var(--slate-100);
  border-radius: var(--border-radius-pill);
  margin: 0 16px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.stg-flow-stream {
  position: absolute;
  top: 0;
  height: 100%;
  width: 14px;
  background: linear-gradient(90deg, rgba(20, 184, 166, 0) 0%, var(--teal-500) 50%, rgba(20, 184, 166, 0) 100%);
  border-radius: inherit;
  animation: stream-flow 2.4s infinite linear;
  
  &--1 { animation-delay: 0s; }
  &--2 { animation-delay: 0.8s; }
  &--3 { animation-delay: 1.6s; }
}

/* ================================================================= */
/* 5. 详细参数面板                                                   */
/* ================================================================= */
.stg-metadata {
  z-index: 10;
}

.stg-metadata-list {
  padding: 6px 16px 16px;
  display: flex;
  flex-direction: column;
}

.stg-metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
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
    gap: 6px;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-500);
}

.stg-metadata-val {
  font-size: 12px;
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
  font-size: 10.5px;
  background-color: var(--slate-50);
  padding: 6px 8px;
  border-radius: 6px;
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
  padding: 2px 8px;
  background-color: var(--teal-50);
  color: var(--teal-700);
  font-size: 10.5px;
  font-weight: 800;
  border-radius: var(--border-radius-pill);
}

.stg-pill-source {
  padding: 1px 6px;
  background-color: var(--slate-100);
  color: var(--slate-500);
  font-size: 9.5px;
  font-weight: 800;
  border-radius: 4px;
}

/* ================================================================= */
/* Transition 动效库                                                 */
/* ================================================================= */
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

/* 响应式媒体查询 */
@media (max-width: 1280px) {
  .stg-downloads__split-container {
    grid-template-columns: 1.85fr 1.15fr;
    gap: 16px;
  }
  .stg-downloads__panel-group--desktop .stg-panel-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .stg-main {
    grid-template-columns: 1fr;
    gap: 16px;
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