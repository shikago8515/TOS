<template>
  <div class="sb-workbench">
    <!-- LEFT MAIN AREA -->
    <div class="sb-main">
      <!-- SECTION 1: Hero Version Banner -->
      <header class="sb-hero">
        <div class="sb-hero__icon">
          <el-icon :size="28"><Setting /></el-icon>
        </div>
        <div class="sb-hero__body">
          <span class="sb-hero__eyebrow">{{ text('当前版本') }}</span>
          <div class="sb-hero__line">
            <h1 class="sb-hero__version">{{ currentVersion }}</h1>
            <el-tag
              class="sb-hero__tag"
              :type="statusTone === 'error' ? 'danger' : 'success'"
              effect="light"
              round
            >
              <el-icon><CircleCheckFilled /></el-icon>
              {{ text(statusLabel || '最新版本') }}
            </el-tag>
          </div>
          <span class="sb-hero__mode">{{ runModeLabel }}</span>
        </div>
        <div class="sb-hero__decor" aria-hidden="true">
          <span class="sb-hero__ring sb-hero__ring--lg"></span>
          <span class="sb-hero__ring sb-hero__ring--md"></span>
          <span class="sb-hero__ring sb-hero__ring--sm"></span>
        </div>
      </header>

      <!-- SECTION 2: Download Center -->
      <section class="sb-downloads">
        <header class="sb-section-head">
          <div class="sb-section-head__title">
            <span class="sb-section-head__icon">
              <el-icon :size="20"><Download /></el-icon>
            </span>
            <div>
              <h2>{{ text('下载中心') }}</h2>
              <p>{{ text('根据您的使用场景，选择部署桌面完整端或安装网页轻量级扩展') }}</p>
            </div>
          </div>
          <div class="sb-section-head__pills">
            <span class="sb-pill">
              <el-icon><Monitor /></el-icon>
              {{ text('独立桌面客户端套件') }}
            </span>
            <span class="sb-pill sb-pill--accent">
              <el-icon><Connection /></el-icon>
              {{ text('网页自动化助手') }}
            </span>
          </div>
        </header>

        <div class="sb-downloads__grid">
          <!-- Card 1: Lightweight Installer (Recommended / Featured) -->
          <article class="sb-card sb-card--featured">
            <div class="sb-card__accent sb-card__accent--teal"></div>
            <div class="sb-card__body">
              <div class="sb-card__header">
                <el-tag type="success" effect="light" round class="sb-card__badge">
                  <el-icon><StarFilled /></el-icon>
                  {{ text('推荐下载') }}
                </el-tag>
                <span class="sb-card__icon-ring sb-card__icon-ring--teal">
                  <el-icon :size="22"><Monitor /></el-icon>
                </span>
              </div>
              <h3>{{ text('TOS 桌面端轻量安装器') }}</h3>
              <p>{{ text('体积轻巧，首选安装。在线从 MinIO 自动下载完整组件。') }}</p>
            </div>
            <img
              class="sb-card__image"
              :src="desktopLightInstallerImage"
              alt=""
            />
            <el-button
              class="sb-card__btn"
              type="primary"
              size="large"
              :loading="desktopInstallerDownloading"
              :disabled="desktopInstallerDownloading"
              @click="handleDesktopInstallerDownload"
            >
              <el-icon><Download /></el-icon>
              {{ desktopInstallerDownloading ? text('获取中...') : text('安全下载轻量安装器') }}
            </el-button>
          </article>

          <!-- Card 2: Full Offline Package -->
          <article class="sb-card">
            <div class="sb-card__accent sb-card__accent--emerald"></div>
            <div class="sb-card__body">
              <div class="sb-card__header">
                <el-tag type="primary" effect="light" round class="sb-card__badge">
                  <el-icon><Files /></el-icon>
                  {{ text('离线全量') }}
                </el-tag>
                <span class="sb-card__icon-ring sb-card__icon-ring--emerald">
                  <el-icon :size="22"><Files /></el-icon>
                </span>
              </div>
              <h3>{{ text('TOS 桌面端全量部署包') }}</h3>
              <p>{{ text('集成完整运行环境，完全离线一键部署，适合物理内网环境。') }}</p>
            </div>
            <img
              class="sb-card__image sb-card__image--wide"
              :src="desktopFullPackageImage"
              alt=""
            />
            <el-button
              class="sb-card__btn"
              type="primary"
              size="large"
              :loading="desktopFullInstallerDownloading"
              :disabled="desktopFullInstallerDownloading"
              @click="handleDesktopFullInstallerDownload"
            >
              <el-icon><Download /></el-icon>
              {{ desktopFullInstallerDownloading ? text('获取中...') : text('安全下载离线全量包') }}
            </el-button>
          </article>

          <!-- Card 3: Web Bridge Helper -->
          <article class="sb-card sb-card--helper">
            <div class="sb-card__accent sb-card__accent--amber"></div>
            <div class="sb-card__body">
              <div class="sb-card__header">
                <el-tag type="success" effect="light" round class="sb-card__badge">
                  <el-icon><Connection /></el-icon>
                  {{ text('完整安装包') }}
                </el-tag>
                <span class="sb-card__icon-ring sb-card__icon-ring--amber">
                  <el-icon :size="22"><Connection /></el-icon>
                </span>
              </div>
              <h3>{{ text('TOS 网页桥接小助手') }}</h3>
              <p>{{ text('下载一次即可完整安装，安装阶段不再联网获取组件。') }}</p>
              <ul class="sb-card__features">
                <li><el-icon><CircleCheck /></el-icon>{{ text('完整内置：包含小助手运行组件') }}</li>
                <li><el-icon><CircleCheck /></el-icon>{{ text('即开即用：网页与本机无缝桥接') }}</li>
                <li><el-icon><CircleCheck /></el-icon>{{ text('离线安装：安装过程不再依赖公网下载') }}</li>
              </ul>
            </div>
            <img
              class="sb-card__image sb-card__image--helper"
              :src="webHelperImage"
              alt=""
            />
            <div class="sb-card__actions">
              <el-button
                type="success"
                plain
                :loading="helperDownloading"
                :disabled="helperDownloading"
                @click="handleHelperDownload"
              >
                <el-icon><Download /></el-icon>
                {{ helperDownloading ? text('获取中...') : text('下载完整小助手安装包') }}
              </el-button>
              <el-button @click.stop.prevent="openHelperUpdateDialog">
                <el-icon><Monitor /></el-icon>
                {{ text('小助手更新') }}
              </el-button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- RIGHT SIDEBAR -->
    <aside class="sb-aside">
      <!-- SECTION 3: Update Management -->
      <section class="sb-side-card">
        <header class="sb-side-card__head">
          <div class="sb-side-card__head-start">
            <span class="sb-side-card__head-icon">
              <el-icon :size="18"><Refresh /></el-icon>
            </span>
            <h2>{{ text('更新管理') }}</h2>
          </div>
          <el-tooltip :content="text('检查更新')" placement="top">
            <el-button
              class="sb-side-card__refresh-btn"
              circle
              :disabled="isActionLocked"
              @click="handleCheck"
            >
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
        </header>

        <!-- Status Block -->
        <div class="sb-status">
          <span class="sb-status__dot">
            <el-icon :size="20"><CircleCheckFilled /></el-icon>
          </span>
          <div class="sb-status__text">
            <h3>{{ runModeLabel }}</h3>
            <p>{{ text(statusLabel) }}</p>
          </div>
          <el-tag
            :type="statusTone === 'error' ? 'danger' : statusTone"
            effect="light"
            round
          >
            {{ text(statusLabel) }}
          </el-tag>
        </div>

        <p class="sb-side-card__desc">
          {{ text('当前运行于 Web 服务器 / 浏览器沙盒中。当您登录桌面客户端时，本面板将自动启用增量更新检测。') }}
        </p>

        <!-- Connection Flow -->
        <div class="sb-flow">
          <div class="sb-flow__node">
            <el-icon :size="22"><Cloudy /></el-icon>
            <span>{{ text('云端服务') }}</span>
          </div>
          <div class="sb-flow__edge">
            <span class="sb-flow__dash"></span>
          </div>
          <div class="sb-flow__node sb-flow__node--active">
            <span class="sb-flow__pulse"></span>
            <el-icon :size="22"><CircleCheckFilled /></el-icon>
            <span>{{ text('连接正常') }}</span>
          </div>
          <div class="sb-flow__edge">
            <span class="sb-flow__dash"></span>
          </div>
          <div class="sb-flow__node">
            <el-icon :size="22"><Monitor /></el-icon>
            <span>{{ text('网页应用') }}</span>
          </div>
        </div>

        <!-- Download Progress -->
        <div v-if="status?.downloading && status?.progress" class="sb-progress">
          <div class="sb-progress__header">
            <span>{{ text('系统更新下载中') }}</span>
            <strong>{{ progressPercent }}%</strong>
          </div>
          <div class="sb-progress__track">
            <div
              class="sb-progress__fill"
              :style="{ width: progressPercent + '%' }"
            >
              <span class="sb-progress__shimmer"></span>
            </div>
          </div>
          <small>{{ downloadDetail }}</small>
        </div>

        <!-- Action Buttons -->
        <div class="sb-actions">
          <el-button
            v-if="hasDesktopUpdateSupport"
            type="primary"
            plain
            :loading="activeAction === 'check'"
            :disabled="isActionLocked"
            @click="handleCheck"
          >
            {{ text('立即检查') }}
          </el-button>
          <el-button
            v-if="canDownload"
            type="success"
            plain
            :loading="activeAction === 'download'"
            :disabled="isActionLocked"
            @click="handleDownload"
          >
            {{ text('下载更新') }}
          </el-button>
          <el-button
            v-if="canInstall"
            type="warning"
            plain
            :loading="activeAction === 'install'"
            :disabled="isActionLocked"
            @click="handleInstall"
          >
            {{ text('立即安装并重启') }}
          </el-button>
          <el-button
            v-if="hasDesktopUpdateSupport && manualDownload"
            plain
            :loading="activeAction === 'manual'"
            :disabled="isActionLocked"
            @click="handleManualDownload"
          >
            {{ text('获取免安装版') }}
          </el-button>
        </div>

        <!-- Alert / Notice -->
        <el-alert
          v-if="noticeText"
          class="sb-alert"
          :type="noticeTone === 'error' ? 'error' : noticeTone === 'warning' ? 'warning' : noticeTone === 'success' ? 'success' : 'info'"
          :title="text(noticeText)"
          show-icon
          closable
          @close="message = ''"
        />
      </section>

      <!-- SECTION 4: Runtime Parameters -->
      <section class="sb-side-card sb-side-card--params">
        <header class="sb-side-card__head">
          <div class="sb-side-card__head-start">
            <span class="sb-side-card__head-icon">
              <el-icon :size="18"><InfoFilled /></el-icon>
            </span>
            <h2>{{ text('运行参数') }}</h2>
          </div>
        </header>

        <div class="sb-params">
          <div class="sb-param__row">
            <span>{{ text('当前版本') }}</span>
            <strong>{{ currentVersion }}</strong>
          </div>
          <div
            v-for="packageRow in serverInstallerPackageRows"
            :key="packageRow.key"
            class="sb-param__row"
          >
            <span>{{ text(packageRow.label) }}</span>
            <strong :title="packageRow.filename || packageRow.versionLabel">
              {{ packageRow.versionLabel }}
            </strong>
          </div>
          <div v-if="hasDesktopUpdateSupport" class="sb-param__row">
            <span>{{ text('最新版本') }}</span>
            <strong>{{ latestVersion }}</strong>
          </div>
          <div class="sb-param__row">
            <span>{{ text('运行模式') }}</span>
            <strong class="sb-param__highlight">{{ runModeLabel }}</strong>
          </div>
          <div v-if="feedUrlText !== '-'" class="sb-param__row sb-param__row--stack">
            <span>{{ t('app.settings.feedUrl') }}</span>
            <strong :title="feedUrlText">{{ feedUrlText }}</strong>
            <em v-if="feedUrlSourceLabel">{{ feedUrlSourceLabel }}</em>
          </div>
        </div>

        <el-button class="sb-export-btn" text @click="handleExportRuntimeParams">
          <el-icon><Download /></el-icon>
          {{ text('导出运行参数') }}
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </section>
    </aside>

    <el-dialog
      v-model="helperUpdateDialogVisible"
      class="sb-helper-update-dialog"
      width="540px"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="sb-helper-dialog-head">
          <span class="sb-helper-dialog-head__icon">
            <el-icon><Connection /></el-icon>
          </span>
          <div>
            <h3>{{ text('TOS 自动化助手更新') }}</h3>
            <p>{{ text('优先检查并热更新本机小助手功能模块；如果提示壳子版本过旧，请到下载中心安装最新完整包。') }}</p>
          </div>
        </div>
      </template>

      <div class="sb-helper-dialog">
        <section class="sb-helper-dialog__status">
          <span
            class="sb-helper-dialog__status-icon"
            :class="`is-${helperUpdateView.tagType}`"
          >
            <el-icon><CircleCheckFilled /></el-icon>
          </span>
          <div class="sb-helper-dialog__status-text">
            <el-tag :type="helperUpdateView.tagType" effect="light" round>
              {{ text(helperUpdateView.label) }}
            </el-tag>
            <p>{{ text(helperUpdateView.message) }}</p>
          </div>
        </section>

        <section class="sb-helper-dialog__versions">
          <div class="sb-helper-dialog__version-row">
            <span>{{ text('当前版本') }}</span>
            <strong>{{ helperUpdateCurrentVersion }}</strong>
          </div>
          <div class="sb-helper-dialog__version-row">
            <span>{{ text('服务器最新版本') }}</span>
            <strong>{{ helperUpdateServerVersion }}</strong>
          </div>
          <div
            v-if="helperModuleSyncSummary.length"
            class="sb-helper-dialog__version-row sb-helper-dialog__version-row--stack"
          >
            <span>{{ text('功能模块热更新') }}</span>
            <div class="sb-helper-sync-grid">
              <span
                v-for="item in helperModuleSyncSummary"
                :key="item.key"
                class="sb-helper-sync-stat"
                :class="`is-${item.tone}`"
              >
                <strong>{{ item.value }}</strong>
                <em>{{ text(item.label) }}</em>
              </span>
            </div>
          </div>
        </section>

        <footer class="sb-helper-dialog__actions">
          <el-button
            class="sb-helper-dialog__hot-update-btn"
            type="primary"
            :loading="helperModuleSyncing"
            :disabled="helperModuleSyncing || helperUpdateChecking || helperDownloading"
            @click="handleHelperHotUpdate"
          >
            <el-icon><Refresh /></el-icon>
            {{ text(helperHotUpdateButtonText) }}
          </el-button>
        </footer>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowRight,
  CircleCheck,
  CircleCheckFilled,
  Cloudy,
  Connection,
  Download,
  Files,
  InfoFilled,
  Monitor,
  Refresh,
  Setting,
  StarFilled,
} from '@element-plus/icons-vue'
import { ref } from 'vue'

import desktopFullPackageImage from '../../assets/settings/desktop-full-package.png'
import desktopLightInstallerImage from '../../assets/settings/desktop-light-installer.png'
import webHelperImage from '../../assets/settings/web-helper.svg'
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
  handleExportRuntimeParams,
  handleHelperDownload,
  handleHelperHotUpdate,
  handleHelperUpdateCheck,
  handleInstall,
  handleManualDownload,
  hasDesktopUpdateSupport,
  helperDownloading,
  helperHotUpdateButtonText,
  helperModuleSyncing,
  helperModuleSyncSummary,
  helperUpdateChecking,
  helperUpdateCurrentVersion,
  helperUpdateServerVersion,
  helperUpdateView,
  isActionLocked,
  latestVersion,
  manualDownload,
  message,
  noticeText,
  noticeTone,
  progressPercent,
  runModeLabel,
  serverInstallerPackageRows,
  status,
  statusLabel,
  statusTone,
  t,
  text,
} = useSettingsPageModel()

const helperUpdateDialogVisible = ref(false)

function openHelperUpdateDialog(): void {
  helperUpdateDialogVisible.value = true
  void handleHelperUpdateCheck()
}
</script>

<style scoped lang="scss">
/* =============================================
   CSS Custom Properties — Teal/Emerald/Amber
   NO purple or purple-adjacent colors
   ============================================= */
.sb-workbench {
  --sb-teal-50: #f0fdfa;
  --sb-teal-100: #ccfbf1;
  --sb-teal-200: #99f6e4;
  --sb-teal-400: #2dd4bf;
  --sb-teal-500: #14b8a6;
  --sb-teal-600: #0d9488;
  --sb-teal-700: #0f766e;
  --sb-emerald-400: #34d399;
  --sb-emerald-500: #10b981;
  --sb-emerald-600: #059669;
  --sb-amber-400: #fbbf24;
  --sb-amber-500: #f59e0b;
  --sb-amber-600: #d97706;
  --sb-sky-400: #38bdf8;
  --sb-sky-500: #0ea5e9;

  --sb-bg: #f5f8fb;
  --sb-surface: rgba(255, 255, 255, 0.94);
  --sb-surface-hover: #ffffff;
  --sb-border: #dfe7ef;
  --sb-border-soft: #edf2f7;
  --sb-text: #17233f;
  --sb-text-heading: #0f172a;
  --sb-muted: #67748e;

  --sb-radius-sm: 10px;
  --sb-radius: 14px;
  --sb-radius-lg: 20px;
  --sb-radius-xl: 28px;

  --sb-shadow-sm: 0 2px 8px rgba(15, 35, 58, 0.05);
  --sb-shadow: 0 10px 28px rgba(15, 35, 58, 0.07);
  --sb-shadow-lg: 0 18px 40px rgba(15, 35, 58, 0.10);
  --sb-shadow-glow-teal: 0 0 0 3px rgba(13, 148, 136, 0.10);
  --sb-shadow-glow-emerald: 0 0 0 3px rgba(5, 150, 105, 0.10);
  --sb-shadow-glow-amber: 0 0 0 3px rgba(217, 119, 6, 0.10);

  --sb-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --sb-ease-spring: cubic-bezier(0.16, 1, 0.3, 1);

  display: grid;
  grid-template-columns: minmax(0, 2.15fr) minmax(390px, 0.95fr);
  gap: 22px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 16px 18px 18px;
  box-sizing: border-box;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 10%, rgba(13, 148, 136, 0.07), transparent 28%),
    radial-gradient(circle at 85% 75%, rgba(14, 165, 233, 0.05), transparent 30%),
    var(--sb-bg);
  color: var(--sb-text);
  font-size: 13px;
}

/* =============================================
   Dark Mode
   ============================================= */
:global(html.dark) .sb-workbench {
  --sb-bg: #000000;
  --sb-surface: rgba(20, 20, 20, 0.94);
  --sb-surface-hover: #1c1c1c;
  --sb-border: #303133;
  --sb-border-soft: #25262a;
  --sb-text: #e5eaf3;
  --sb-text-heading: #e5eaf3;
  --sb-muted: #a7adba;
  --sb-shadow-sm: none;
  --sb-shadow: none;
  --sb-shadow-lg: none;
  --sb-shadow-glow-teal: 0 0 0 1px rgba(13, 148, 136, 0.30);
  --sb-shadow-glow-emerald: 0 0 0 1px rgba(5, 150, 105, 0.30);
  --sb-shadow-glow-amber: 0 0 0 1px rgba(217, 119, 6, 0.30);

  background:
    radial-gradient(circle at 12% 10%, rgba(13, 148, 136, 0.11), transparent 28%),
    radial-gradient(circle at 85% 75%, rgba(14, 165, 233, 0.08), transparent 30%),
    var(--sb-bg);
}

:global(html.dark) {
  .sb-hero {
    background:
      linear-gradient(120deg, rgba(20, 20, 20, 0.96), rgba(9, 39, 38, 0.86)),
      repeating-linear-gradient(135deg, rgba(13, 148, 136, 0.13) 0 1px, transparent 1px 12px);
  }

  .sb-card {
    background: #18181a;
    border-color: var(--sb-border);
  }

  .sb-card--featured {
    background:
      linear-gradient(180deg, rgba(13, 148, 136, 0.06), #18181a 40%);
  }

  .sb-flow,
  .sb-status {
    background: #18181a;
  }

  .sb-progress {
    background: rgba(13, 148, 136, 0.13);
  }

  .sb-side-card {
    background: rgba(20, 20, 20, 0.94);
    border-color: var(--sb-border);
  }

  .sb-hero__line h1,
  .sb-section-head__title h2,
  .sb-card h3,
  .sb-side-card__head h2,
  .sb-status h3,
  .sb-param__row strong {
    color: var(--sb-text-heading);
  }
}

/* =============================================
   Layout Grid
   ============================================= */
.sb-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  min-width: 0;
  min-height: 0;
}

.sb-aside {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 18px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* =============================================
   SECTION 1: Hero Version Banner
   ============================================= */
.sb-hero {
  position: relative;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  min-height: 96px;
  padding: 16px 22px;
  overflow: hidden;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.96), rgba(240, 253, 250, 0.86)),
    repeating-linear-gradient(135deg, rgba(13, 148, 136, 0.07) 0 1px, transparent 1px 12px);
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius-lg);
  box-shadow: var(--sb-shadow);
  animation: sb-fadeUp 0.55s var(--sb-ease) 0s both;
}

.sb-hero__icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  color: #ffffff;
  background: linear-gradient(145deg, var(--sb-teal-500), var(--sb-teal-600));
  box-shadow: 0 12px 28px rgba(13, 148, 136, 0.22);
}

.sb-hero__body {
  min-width: 0;
}

.sb-hero__eyebrow {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--sb-muted);
}

.sb-hero__line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.sb-hero__version {
  margin: 0;
  font-size: clamp(23px, 2.2vw, 30px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--sb-text-heading);
}

.sb-hero__tag {
  height: 26px;
  padding-inline: 10px;
  font-weight: 800;
  font-size: 11px;
}

.sb-hero__mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--sb-teal-600);
  background: var(--sb-teal-50);
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--sb-teal-100);
}

/* Decorative rings */
.sb-hero__decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}

.sb-hero__ring {
  position: absolute;
  border-radius: 50%;
  border: 1.5px solid rgba(13, 148, 136, 0.10);

  &--lg {
    width: 180px;
    height: 180px;
    top: -70px;
    right: -50px;
    animation: sb-float 8s ease-in-out infinite;
  }

  &--md {
    width: 110px;
    height: 110px;
    top: 16px;
    right: 55px;
    animation: sb-float 10s ease-in-out infinite 1.2s;
  }

  &--sm {
    width: 65px;
    height: 65px;
    bottom: -20px;
    right: 110px;
    animation: sb-float 6s ease-in-out infinite 2.4s;
  }
}

/* =============================================
   SECTION 2: Download Center
   ============================================= */
.sb-downloads {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
  padding: 24px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius-lg);
  background: var(--sb-surface);
  box-shadow: var(--sb-shadow);
  overflow: hidden;
  animation: sb-fadeUp 0.55s var(--sb-ease) 0.07s both;
}

.sb-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.sb-section-head__title {
  display: flex;
  align-items: flex-start;
  gap: 14px;

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
    color: var(--sb-text-heading);
  }

  p {
    margin: 5px 0 0;
    color: var(--sb-muted);
    font-size: 12px;
    line-height: 1.5;
  }
}

.sb-section-head__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  color: #ffffff;
  background: linear-gradient(135deg, var(--sb-emerald-500), var(--sb-teal-600));
  flex-shrink: 0;
}

.sb-section-head__pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 8px;
}

.sb-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sb-sky-500);
  font-size: 12px;
  font-weight: 800;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(14, 165, 233, 0.06);
  border: 1px solid rgba(14, 165, 233, 0.15);
  transition: background 0.25s ease;

  &--accent {
    color: var(--sb-teal-600);
    background: var(--sb-teal-50);
    border-color: var(--sb-teal-100);
  }
}

/* Download Cards Grid */
.sb-downloads__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  min-height: 0;
  overflow: auto;
  padding: 3px;
}

/* =============================================
   Download Card Component
   ============================================= */
.sb-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  min-height: 450px;
  padding: 22px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 252, 255, 0.94));
  overflow: hidden;
  transition:
    transform 0.28s var(--sb-ease),
    box-shadow 0.28s var(--sb-ease),
    border-color 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--sb-shadow-lg);
    border-color: transparent;
  }

  h3 {
    margin: 10px 0 8px;
    color: var(--sb-text-heading);
    font-size: 17px;
    font-weight: 900;
    line-height: 1.3;
  }

  p {
    margin: 0;
    color: var(--sb-muted);
    font-size: 13px;
    line-height: 1.7;
  }
}

/* Featured card (Recommended) */
.sb-card--featured {
  background:
    linear-gradient(180deg, rgba(240, 253, 250, 0.70), rgba(255, 255, 255, 0.98) 45%);

  &:hover {
    box-shadow: var(--sb-shadow-lg), var(--sb-shadow-glow-teal);
  }
}

/* Helper card */
.sb-card--helper {
  h3 {
    margin-bottom: 7px;
  }

  p {
    line-height: 1.5;
  }
}

/* Accent bar — slides in on hover */
.sb-card__accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.40s var(--sb-ease);
  z-index: 1;

  &--teal {
    background: linear-gradient(90deg, var(--sb-teal-500), var(--sb-teal-600));
  }

  &--emerald {
    background: linear-gradient(90deg, var(--sb-emerald-400), var(--sb-emerald-600));
  }

  &--amber {
    background: linear-gradient(90deg, var(--sb-amber-400), var(--sb-amber-600));
  }
}

.sb-card:hover .sb-card__accent {
  transform: scaleX(1);
}

.sb-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sb-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sb-card__badge {
  height: 26px;
  padding-inline: 10px;
  font-weight: 800;
  font-size: 11px;
}

.sb-card__icon-ring {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  flex-shrink: 0;

  &--teal {
    color: var(--sb-teal-600);
    background: rgba(13, 148, 136, 0.08);
  }

  &--emerald {
    color: var(--sb-emerald-600);
    background: rgba(5, 150, 105, 0.08);
  }

  &--amber {
    color: var(--sb-amber-600);
    background: rgba(217, 119, 6, 0.08);
  }
}

/* Card Feature List (helper card) */
.sb-card__features {
  display: grid;
  gap: 5px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  color: #273755;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;

  li {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    min-width: 0;
    line-height: 1.35;
    overflow-wrap: anywhere;

    .el-icon {
      flex-shrink: 0;
      color: var(--sb-teal-600);
      font-size: 13px;
      margin-top: 1px;
    }
  }
}

/* Card Images */
.sb-card__image {
  align-self: center;
  justify-self: center;
  width: min(86%, 235px);
  max-height: 170px;
  object-fit: contain;
  filter: drop-shadow(0 16px 18px rgba(13, 148, 136, 0.10));
  transition: transform 0.35s var(--sb-ease);
}

.sb-card:hover .sb-card__image {
  transform: translateY(-3px);
}

.sb-card__image--wide {
  width: min(92%, 270px);
  max-height: 150px;
}

.sb-card__image--helper {
  width: min(88%, 248px);
  max-height: 162px;
}

/* Card Buttons */
.sb-card__btn {
  width: 100%;
  min-height: 44px;
  height: auto;
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.2;
  white-space: normal;
  transition: transform 0.15s ease;

  &:active:not(:disabled) {
    transform: scale(0.97);
  }
}

.sb-card__actions {
  display: grid;
  grid-template-rows: repeat(2, minmax(42px, auto));
  gap: 8px;
  align-content: end;

  .el-button {
    width: 100%;
    min-height: 42px;
    height: auto;
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    font-weight: 800;
    line-height: 1.2;
    white-space: normal;
    transition: transform 0.15s ease;

    &:active:not(:disabled) {
      transform: scale(0.97);
    }
  }

  .el-button + .el-button {
    margin-left: 0;
  }
}

/* =============================================
   SECTION 3 & 4: Sidebar Cards
   ============================================= */
.sb-side-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 22px;
  border: 1px solid var(--sb-border);
  border-radius: var(--sb-radius);
  background: var(--sb-surface);
  box-shadow: var(--sb-shadow-sm);
  overflow: hidden;

  &:first-child {
    animation: sb-fadeUp 0.55s var(--sb-ease) 0.14s both;
  }

  &:last-child {
    animation: sb-fadeUp 0.55s var(--sb-ease) 0.20s both;
  }
}

.sb-side-card--params {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.sb-side-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--sb-border-soft);
  flex-shrink: 0;
}

.sb-side-card__head-start {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sb-side-card__head-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--sb-teal-600);
  background: var(--sb-teal-50);
}

.sb-side-card__head h2 {
  margin: 0;
  color: var(--sb-text-heading);
  font-size: 18px;
  font-weight: 900;
}

.sb-side-card__refresh-btn {
  transition: transform 0.3s var(--sb-ease);
  color: var(--sb-teal-600);

  &:hover:not(:disabled) {
    transform: rotate(90deg);
  }
}

/* Status Block */
.sb-status {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--sb-border-soft);
  border-radius: 10px;
  background: #fbfdff;
  flex-shrink: 0;
}

.sb-status__dot {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #0f9f6e;
  background: #dff8ee;
}

.sb-status__text {
  min-width: 0;

  h3 {
    margin: 0;
    color: var(--sb-text-heading);
    font-size: 15px;
    font-weight: 900;
  }

  p {
    margin: 4px 0 0;
    color: var(--sb-teal-600);
    font-size: 12px;
    font-weight: 800;
  }
}

.sb-side-card__desc {
  margin: 14px 0;
  color: var(--sb-muted);
  font-size: 12px;
  line-height: 1.75;
  flex-shrink: 0;
}

/* Connection Flow */
.sb-flow {
  display: grid;
  grid-template-columns: auto minmax(28px, 1fr) auto minmax(28px, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  border: 1px solid var(--sb-border-soft);
  border-radius: 10px;
  background: #ffffff;
  flex-shrink: 0;
}

.sb-flow__node {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  color: #1c2b4a;
  font-size: 11px;
  font-weight: 800;
  min-width: 0;
  text-align: center;
  line-height: 1.2;
  overflow-wrap: anywhere;

  .el-icon {
    color: #203253;
  }
}

.sb-flow__node--active {
  color: var(--sb-teal-600);

  .el-icon {
    color: var(--sb-teal-600);
  }
}

.sb-flow__pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: transparent;
  animation: sb-pulse-ring 2.4s ease-out infinite;
  pointer-events: none;
}

.sb-flow__edge {
  height: 2px;
}

.sb-flow__dash {
  display: block;
  height: 2px;
  width: 100%;
  background: repeating-linear-gradient(
    90deg,
    var(--sb-teal-400) 0px,
    var(--sb-teal-400) 5px,
    transparent 5px,
    transparent 9px
  );
  animation: sb-dash-flow 1.6s linear infinite;
}

/* Progress Bar */
.sb-progress {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(13, 148, 136, 0.18);
  border-radius: 10px;
  background: var(--sb-teal-50);
  flex-shrink: 0;
}

.sb-progress__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--sb-teal-700);
  font-size: 12px;
  font-weight: 800;
}

.sb-progress__track {
  height: 6px;
  border-radius: 3px;
  background: var(--sb-teal-100);
  overflow: hidden;
}

.sb-progress__fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--sb-teal-600), var(--sb-teal-400));
  transition: width 0.6s var(--sb-ease);
  position: relative;
  overflow: hidden;
}

.sb-progress__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: sb-shimmer 1.8s linear infinite;
}

.sb-progress small {
  display: block;
  margin-top: 6px;
  color: var(--sb-muted);
  font-size: 12px;
}

/* Action Buttons */
.sb-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  flex-shrink: 0;

  .el-button {
    border-radius: 8px;
    font-weight: 800;
    font-size: 12px;
    transition: transform 0.15s ease;

    &:active:not(:disabled) {
      transform: scale(0.97);
    }
  }
}

/* Alert */
.sb-alert {
  margin-top: 14px;
  flex-shrink: 0;
  animation: sb-slideDown 0.35s var(--sb-ease) both;
}

/* =============================================
   Runtime Parameters
   ============================================= */
.sb-params {
  min-height: 0;
  overflow: auto;
  margin-top: 4px;
}

.sb-param__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 42px;
  border-bottom: 1px solid var(--sb-border-soft);
  color: var(--sb-muted);
  font-size: 13px;
  padding: 4px 0;

  strong {
    min-width: 0;
    color: var(--sb-text-heading);
    font-weight: 800;
    font-size: 13px;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    letter-spacing: -0.01em;
  }
}

.sb-param__highlight {
  color: var(--sb-teal-600) !important;
  font-family: inherit !important;
}

.sb-param__row--stack {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 0;

  strong {
    width: 100%;
    text-align: left;
    font-size: 12px;
  }

  em {
    color: var(--sb-teal-600);
    font-size: 11px;
    font-style: normal;
    font-weight: 800;
    background: var(--sb-teal-50);
    padding: 1px 8px;
    border-radius: 4px;
  }
}

/* Export Button */
.sb-export-btn {
  justify-content: space-between;
  width: 100%;
  height: 42px;
  margin-top: 10px;
  color: var(--sb-muted);
  font-size: 12px;
  font-weight: 700;
  border-radius: 10px;
  flex-shrink: 0;

  :deep(.el-icon) {
    font-size: 15px;
  }
}

/* =============================================
   Helper Update Dialog
   ============================================= */
:global(.sb-helper-update-dialog) {
  --helper-dialog-surface: #ffffff;
  --helper-dialog-soft: #f4fbfa;
  --helper-dialog-border: #dfe7ef;
  --helper-dialog-border-soft: #edf2f7;
  --helper-dialog-text: #17233f;
  --helper-dialog-heading: #0f172a;
  --helper-dialog-muted: #66748c;
  --helper-dialog-teal: #0d9488;

  border-radius: 18px;
  overflow: hidden;
  background: var(--helper-dialog-surface);
  box-shadow: 0 22px 70px rgba(15, 35, 58, 0.18);
}

:global(.sb-helper-update-dialog .el-dialog__header) {
  margin: 0;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--helper-dialog-border-soft);
}

:global(.sb-helper-update-dialog .el-dialog__body) {
  padding: 0;
}

:global(.sb-helper-dialog-head) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 36px;
}

:global(.sb-helper-dialog-head__icon) {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  color: #0d9488;
  background: rgba(45, 212, 191, 0.16);
  border: 1px solid rgba(13, 148, 136, 0.18);
}

:global(.sb-helper-dialog-head h3) {
  margin: 0;
  color: var(--helper-dialog-heading);
  font-size: 18px;
  font-weight: 900;
  line-height: 1.25;
}

:global(.sb-helper-dialog-head p) {
  margin: 6px 0 0;
  color: var(--helper-dialog-muted);
  font-size: 12px;
  line-height: 1.6;
}

:global(.sb-helper-dialog) {
  padding: 18px 22px 22px;
  color: var(--helper-dialog-text);
  background:
    radial-gradient(circle at 10% 0%, rgba(13, 148, 136, 0.08), transparent 28%),
    var(--helper-dialog-surface);
}

:global(.sb-helper-dialog__status) {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(13, 148, 136, 0.16);
  border-radius: 14px;
  background: var(--helper-dialog-soft);
}

:global(.sb-helper-dialog__status-icon) {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #0d9488;
  background: rgba(45, 212, 191, 0.18);
}

:global(.sb-helper-dialog__status-icon.is-warning) {
  color: #d97706;
  background: rgba(251, 191, 36, 0.18);
}

:global(.sb-helper-dialog__status-icon.is-danger) {
  color: #dc2626;
  background: rgba(248, 113, 113, 0.16);
}

:global(.sb-helper-dialog__status-text) {
  min-width: 0;
}

:global(.sb-helper-dialog__status-text p) {
  margin: 8px 0 0;
  color: var(--helper-dialog-muted);
  font-size: 13px;
  line-height: 1.65;
}

:global(.sb-helper-dialog__versions) {
  margin-top: 14px;
  border: 1px solid var(--helper-dialog-border);
  border-radius: 14px;
  overflow: hidden;
}

:global(.sb-helper-dialog__version-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 48px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.68);
  border-bottom: 1px solid var(--helper-dialog-border-soft);
}

:global(.sb-helper-dialog__version-row--stack) {
  align-items: flex-start;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  padding: 12px 16px;
}

:global(.sb-helper-dialog__version-row:last-child) {
  border-bottom: 0;
}

:global(.sb-helper-dialog__version-row span) {
  color: var(--helper-dialog-muted);
  font-size: 13px;
}

:global(.sb-helper-dialog__version-row strong) {
  min-width: 0;
  color: var(--helper-dialog-heading);
  font-size: 15px;
  font-weight: 900;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.sb-helper-dialog__version-row--stack strong) {
  text-align: left;
  white-space: normal;
}

:global(.sb-helper-sync-grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

:global(.sb-helper-sync-stat) {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--helper-dialog-border-soft);
  border-radius: 10px;
  background: var(--helper-dialog-soft);
}

:global(.sb-helper-sync-stat strong) {
  color: var(--helper-dialog-heading);
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  text-align: left;
  white-space: nowrap;
}

:global(.sb-helper-sync-stat em) {
  min-width: 0;
  color: var(--helper-dialog-muted);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

:global(.sb-helper-sync-stat.is-success strong) {
  color: #10b981;
}

:global(.sb-helper-sync-stat.is-warning strong) {
  color: #d97706;
}

:global(.sb-helper-sync-stat.is-danger strong) {
  color: #ef4444;
}

:global(.sb-helper-dialog__actions) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

:global(.sb-helper-dialog__actions .el-button) {
  min-width: 126px;
  min-height: 38px;
  height: auto;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 800;
  line-height: 1.2;
  white-space: normal;
}

:global(html.dark .sb-helper-update-dialog) {
  --helper-dialog-surface: #141414;
  --helper-dialog-soft: #18181a;
  --helper-dialog-border: #303133;
  --helper-dialog-border-soft: #25262a;
  --helper-dialog-text: #e5eaf3;
  --helper-dialog-heading: #f2f6fc;
  --helper-dialog-muted: #a7adba;

  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.48);
}

:global(html.dark .sb-helper-dialog__version-row) {
  background: rgba(24, 24, 26, 0.86);
}

:global(html.dark .sb-helper-dialog__status) {
  background: rgba(24, 24, 26, 0.92);
}

/* =============================================
   KEYFRAME ANIMATIONS
   ============================================= */
@keyframes sb-fadeUp {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes sb-float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  33% {
    transform: translateY(-7px) rotate(1deg);
  }
  66% {
    transform: translateY(3px) rotate(-1deg);
  }
}

@keyframes sb-pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.30);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(13, 148, 136, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(13, 148, 136, 0);
  }
}

@keyframes sb-dash-flow {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 14px 0;
  }
}

@keyframes sb-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes sb-slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
    max-height: 0;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 200px;
  }
}

/* =============================================
   RESPONSIVE
   ============================================= */
@media (max-width: 1380px) {
  .sb-downloads__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .sb-card {
    padding: 16px;
    min-height: 420px;
  }
}

@media (max-width: 1280px) {
  .sb-workbench {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .sb-main {
    gap: 16px;
  }

  .sb-aside {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;
    overflow: visible;
  }

  .sb-side-card--params {
    grid-template-rows: auto auto auto;
  }
}

@media (max-width: 920px) {
  .sb-downloads__grid {
    grid-template-columns: 1fr;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }

  .sb-aside {
    grid-template-columns: 1fr;
  }

  .sb-hero {
    grid-template-columns: auto minmax(0, 1fr);
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .sb-workbench {
    padding: 10px;
    gap: 14px;
  }

  .sb-hero {
    padding: 16px;
    gap: 14px;
  }

  .sb-hero__icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }

  .sb-downloads {
    padding: 16px;
  }

  .sb-section-head {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .sb-side-card {
    padding: 16px;
  }
}
</style>

<style>
.content-shell:has(.sb-workbench) {
  padding: 0 !important;
  overflow: hidden;
}
</style>
