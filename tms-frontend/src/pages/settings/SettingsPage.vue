<template>
  <div class="stg">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Top Bar                                                    -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <header class="stg-bar">
      <div class="stg-bar__brand">
        <span class="stg-bar__mark">
          <AppIcon name="settings" />
        </span>
        <div>
          <h1 class="stg-bar__title">{{ t('app.settings.title') }}</h1>
          <p class="stg-bar__desc">{{ t('app.settings.description') }}</p>
        </div>
      </div>

      <div class="stg-bar__end">
        <span
          v-if="hasDesktopUpdateSupport"
          class="stg-chip"
          :class="`stg-chip--${statusTone}`"
        >
          <i class="stg-chip__dot" />
          {{ statusLabel }}
        </span>
        <button
          v-if="hasDesktopUpdateSupport"
          class="stg-bar__btn"
          type="button"
          :disabled="isActionLocked"
          @click="handleCheck"
          :title="text('检查更新')"
        >
          <AppIcon name="refresh-cw" :class="{ 'is-spin': status?.checking || activeAction === 'check' }" />
        </button>
        <SettingsLanguageSwitch />
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Notice                                                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <transition name="stg-slide">
      <aside
        v-if="hasDesktopUpdateSupport && noticeText"
        class="stg-toast"
        :class="`stg-toast--${noticeTone}`"
        role="status"
      >
        <span class="stg-toast__icon">
          <AppIcon :name="noticeTone === 'error' ? 'alert-circle' : noticeTone === 'success' ? 'check-circle' : 'info'" />
        </span>
        <span class="stg-toast__msg">{{ text(noticeText) }}</span>
        <button class="stg-toast__close" type="button" @click="message = ''">
          <AppIcon name="stop-circle" />
        </button>
      </aside>
    </transition>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!--  Main Deck: asymmetric 2-column                            -->
    <!--  Left  = Action Hub (wider, hero)                          -->
    <!--  Right = System Info (info-focused)                        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="stg-deck">
      <!-- ──── LEFT : Action Hub ──── -->
      <div class="stg-deck__main">
        <!-- Update Operations (hero card) -->
        <section v-if="hasDesktopUpdateSupport" class="stg-hero">
          <div class="stg-hero__banner">
            <div class="stg-hero__banner-left">
              <span class="stg-hero__banner-icon">
                <AppIcon name="refresh-cw" :class="{ 'is-spin': status?.checking || activeAction === 'check' }" />
              </span>
              <div>
                <strong class="stg-hero__banner-title">{{ text('更新管理中心') }}</strong>
                <span class="stg-hero__banner-sub">{{ text('检查、下载与安装桌面客户端更新') }}</span>
              </div>
            </div>
            <span class="stg-hero__banner-badge" :class="`stg-hero__banner-badge--${statusTone}`">
              {{ statusLabel }}
            </span>
          </div>

          <!-- Inline progress (inside hero card) -->
          <transition name="stg-expand">
            <div v-if="status?.downloading || status?.progress" class="stg-hero__prog">
              <div class="stg-hero__prog-head">
                <span><AppIcon name="download-cloud" /> {{ text('下载中') }}</span>
                <strong>{{ progressPercent }}%</strong>
              </div>
              <div class="stg-hero__prog-rail">
                <div class="stg-hero__prog-bar" :style="{ width: `${progressPercent}%` }" />
              </div>
              <span class="stg-hero__prog-foot">{{ downloadDetail }}</span>
            </div>
          </transition>

          <div class="stg-hero__actions">
            <button
              class="stg-btn stg-btn--primary"
              type="button"
              :disabled="isActionLocked"
              @click="handleCheck"
            >
              <AppIcon name="refresh-cw" :class="{ 'is-spin': status?.checking || activeAction === 'check' }" />
              <span>{{ status?.checking || activeAction === 'check' ? text('检查中...') : text('检查更新') }}</span>
            </button>

            <button
              v-if="canDownload"
              class="stg-btn stg-btn--accent"
              type="button"
              :disabled="isActionLocked"
              @click="handleDownload"
            >
              <AppIcon name="download-cloud" />
              <span>{{ status?.downloading || activeAction === 'download' ? text('下载中...') : text('下载更新') }}</span>
            </button>

            <button
              v-if="canInstall"
              class="stg-btn stg-btn--go"
              type="button"
              :disabled="activeAction === 'install'"
              @click="handleInstall"
            >
              <AppIcon name="rocket" />
              <span>{{ activeAction === 'install' ? text('安装中...') : text('安装并重启') }}</span>
            </button>
          </div>

          <div v-if="manualDownload" class="stg-hero__manual">
            <span class="stg-hero__manual-icon">
              <AppIcon name="package" />
            </span>
            <div class="stg-hero__manual-info">
              <strong>{{ text('免安装版') }}</strong>
              <span>{{ manualDownloadDetail }}</span>
            </div>
            <button
              class="stg-btn stg-btn--outline stg-btn--sm"
              type="button"
              :disabled="isActionLocked"
              @click="handleManualDownload"
            >
              <AppIcon name="download" />
              {{ activeAction === 'manual' ? text('打开中...') : text('下载') }}
            </button>
          </div>
        </section>

        <!-- Fallback: no desktop update support -->
        <section v-else class="stg-hero stg-hero--void">
          <div class="stg-hero__banner">
            <div class="stg-hero__banner-left">
              <span class="stg-hero__banner-icon stg-hero__banner-icon--muted">
                <AppIcon name="monitor-code" />
              </span>
              <div>
                <strong class="stg-hero__banner-title">{{ text('桌面客户端更新') }}</strong>
                <span class="stg-hero__banner-sub">{{ text('当前运行在服务器 / 浏览器环境，桌面客户端会显示自动更新能力。') }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Automation Helper (compact, below hero) -->
        <section class="stg-helper">
          <div class="stg-helper__head">
            <span class="stg-helper__badge">
              <AppIcon name="package" />
            </span>
            <div>
              <h3>{{ text('自动化助手安装包') }}</h3>
              <p>{{ text('新用户安装后即可在浏览器页面启动本机自动化助手。') }}</p>
            </div>
          </div>
          <button
            class="stg-btn stg-btn--emerald stg-btn--wide"
            type="button"
            :disabled="helperDownloading"
            @click="handleHelperDownload"
          >
            <AppIcon name="download" />
            <span>{{ helperDownloading ? text('打开中...') : text('下载安装包') }}</span>
          </button>
        </section>
      </div>

      <!-- ──── RIGHT : System Info ──── -->
      <aside class="stg-deck__side">
        <div class="stg-panel">
          <div class="stg-panel__head">
            <AppIcon name="info" />
            <span>{{ text('版本与环境') }}</span>
          </div>

          <div class="stg-panel__list">
            <article
              v-for="item in versionItems"
              :key="item.key"
              class="stg-stat"
              :class="`stg-stat--${item.tone}`"
            >
              <span class="stg-stat__icon">
                <AppIcon :name="item.icon" />
              </span>
              <div class="stg-stat__body">
                <span class="stg-stat__label">{{ item.label }}</span>
                <strong class="stg-stat__value" :class="{ 'is-mono': item.mono }">{{ item.value }}</strong>
              </div>
            </article>
          </div>

          <div v-if="hasDesktopUpdateSupport" class="stg-feed">
            <span class="stg-feed__icon">
              <AppIcon name="link" />
            </span>
            <div class="stg-feed__body">
              <span class="stg-feed__label">{{ t('app.settings.feedUrl') }}</span>
              <div class="stg-feed__row">
                <em v-if="feedUrlSourceLabel" class="stg-feed__tag">{{ feedUrlSourceLabel }}</em>
                <small :title="feedUrlText">{{ feedUrlText }}</small>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
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
  downloadDetail,
  feedUrlSourceLabel,
  feedUrlText,
  handleCheck,
  handleDownload,
  handleHelperDownload,
  handleInstall,
  handleManualDownload,
  hasDesktopUpdateSupport,
  helperDownloading,
  isActionLocked,
  manualDownload,
  manualDownloadDetail,
  message,
  noticeText,
  noticeTone,
  progressPercent,
  status,
  statusLabel,
  statusTone,
  t,
  text,
  versionItems,
} = useSettingsPageModel()
</script>

<style scoped lang="scss">
/* ================================================================= */
/*  Design Tokens  (zero purple — teal + emerald + sky + amber)      */
/* ================================================================= */
.stg {
  --p: #0d9488;
  --p-deep: #0f766e;
  --p-dim: #f0fdfa;
  --p-glow: rgba(13, 148, 136, 0.18);

  --em: #059669;
  --em-dim: #ecfdf5;
  --em-glow: rgba(5, 150, 105, 0.18);

  --sk: #0284c7;
  --sk-dim: #f0f9ff;

  --am: #d97706;
  --am-dim: #fffbeb;

  --ok: #10b981;
  --ok-dim: #ecfdf5;
  --wa: #f59e0b;
  --wa-dim: #fffbeb;
  --er: #ef4444;
  --er-dim: #fef2f2;
  --inf: #0ea5e9;
  --inf-dim: #f0f9ff;

  --ink: #0f172a;
  --mu: #64748b;
  --fa: #94a3b8;
  --li: #e2e8f0;
  --li2: #f1f5f9;
  --sf: #ffffff;
  --bg: #f8fafc;

  --r: 10px;
  --r-lg: 14px;
  --r-xl: 18px;
  --r-full: 999px;

  --ease: cubic-bezier(.16, 1, .3, 1);
  --spring: cubic-bezier(.34, 1.56, .64, 1);

  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 12px 16px;
  color: var(--ink);
  background: var(--bg);
}

/* ================================================================= */
/*  Keyframes                                                        */
/* ================================================================= */
@keyframes stg-fade-up   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes stg-fade-down { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
@keyframes stg-shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes stg-spin      { to{transform:rotate(360deg)} }
@keyframes stg-blink     { 0%,100%{opacity:1;box-shadow:0 0 0 0 var(--ok)} 50%{opacity:.55;box-shadow:0 0 0 6px transparent} }
@keyframes stg-expand-in { from{opacity:0;max-height:0;transform:translateY(-6px)} to{opacity:1;max-height:120px;transform:translateY(0)} }
.is-spin { animation: stg-spin .85s linear infinite; }

/* ================================================================= */
/*  Top Bar                                                          */
/* ================================================================= */
.stg-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  position: relative;
  z-index: 100;
  overflow: visible;
  animation: stg-fade-down .45s var(--ease) both;
}
.stg-bar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.stg-bar__mark {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border-radius: var(--r);
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  color: #fff;
  font-size: 17px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px var(--p-glow);
}
.stg-bar__title { margin:0; font-size:20px; font-weight:800; line-height:1.15; letter-spacing:-.2px; }
.stg-bar__desc  { margin:1px 0 0; font-size:12.5px; color:var(--mu); }
.stg-bar__end {
  display: flex; align-items: center; gap: 9px; flex-shrink: 0;
  position: relative;
  z-index: 101;
  overflow: visible;
}
.stg-bar__btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border: 1px solid var(--li); border-radius: var(--r);
  background: var(--sf); color: var(--mu); cursor: pointer;
  font-size: 15px;
  transition: all .22s ease;
  &:hover:not(:disabled) { border-color:#99f6e4; color:var(--p); background:var(--p-dim); }
  &:disabled { opacity:.4; cursor:not-allowed; }
}

/* status chip */
.stg-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  border-radius: var(--r-full);
  font-size: 12.5px; font-weight: 700; white-space: nowrap;
  border: 1px solid var(--li); background: var(--sf); color: var(--mu);
}
.stg-chip__dot { width:7px; height:7px; border-radius:50%; background:currentColor; flex-shrink:0; }
.stg-chip--success { border-color:#a7f3d0; background:var(--ok-dim); color:var(--ok); .stg-chip__dot{animation:stg-blink 2s infinite;} }
.stg-chip--warning { border-color:#fcd34d; background:var(--wa-dim); color:var(--wa); }
.stg-chip--error   { border-color:#fecaca; background:var(--er-dim); color:var(--er); }
.stg-chip--info    { border-color:#bae6fd; background:var(--inf-dim);color:var(--inf); }

/* ================================================================= */
/*  Toast (notice banner)                                            */
/* ================================================================= */
.stg-toast {
  display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 9px;
  padding: 9px 14px;
  border-radius: var(--r);
  font-size: 13px; font-weight: 600;
  border: 1px solid var(--li); background: var(--sf); color: var(--mu);
}
.stg-toast__icon { font-size: 18px; flex-shrink: 0; }
.stg-toast--success { border-color:#a7f3d0; background:var(--ok-dim); color:var(--ok); }
.stg-toast--warning { border-color:#fcd34d; background:var(--wa-dim); color:var(--wa); }
.stg-toast--error   { border-color:#fecaca; background:var(--er-dim); color:var(--er); }
.stg-toast--info    { border-color:#bae6fd; background:var(--inf-dim);color:var(--inf); }
.stg-toast__close {
  display:flex; align-items:center; justify-content:center;
  width:26px; height:26px; border:0; border-radius:6px;
  background:transparent; color:currentColor; cursor:pointer; opacity:.5;
  &:hover{opacity:1;background:rgba(0,0,0,.05)}
}

.stg-slide-enter-active { transition:opacity .25s ease, transform .3s var(--ease); }
.stg-slide-leave-active { transition:opacity .16s ease, transform .18s ease-in; }
.stg-slide-enter-from,
.stg-slide-leave-to      { opacity:0; transform:translateY(-8px); }

/* ================================================================= */
/*  Buttons                                                          */
/* ================================================================= */
.stg-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 40px; padding: 0 18px;
  border: 1px solid transparent; border-radius: var(--r);
  font: inherit; font-size: 13.5px; font-weight: 700; line-height: 1;
  cursor: pointer; white-space: nowrap;
  transition: background .2s ease, border-color .2s ease, color .2s ease, box-shadow .25s ease, transform .18s var(--spring);
  &:active:not(:disabled) { transform: scale(.96); }
  &:disabled { cursor: not-allowed; opacity: .5; }
}
.stg-btn--sm   { min-height: 33px; padding: 0 13px; font-size: 12.5px; border-radius: var(--r); }
.stg-btn--wide { width: 100%; }

.stg-btn--primary {
  border-color: var(--p); background: linear-gradient(135deg, #14b8a6, #0d9488); color: #fff;
  box-shadow: 0 5px 16px var(--p-glow);
  &:hover:not(:disabled) { box-shadow: 0 7px 24px rgba(13,148,136,.3); border-color: var(--p-deep); }
}
.stg-btn--accent {
  border-color: var(--sk); background: linear-gradient(135deg, #38bdf8, #0284c7); color: #fff;
  box-shadow: 0 5px 16px rgba(2,132,199,.18);
  &:hover:not(:disabled) { box-shadow: 0 7px 24px rgba(2,132,199,.28); }
}
.stg-btn--go {
  border-color: var(--am); background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff;
  box-shadow: 0 5px 16px rgba(245,158,11,.18);
  &:hover:not(:disabled) { box-shadow: 0 7px 24px rgba(245,158,11,.3); }
}
.stg-btn--emerald {
  border-color: var(--em); background: linear-gradient(135deg, #34d399, #059669); color: #fff;
  box-shadow: 0 5px 16px var(--em-glow);
  &:hover:not(:disabled) { box-shadow: 0 7px 24px rgba(5,150,105,.3); }
}
.stg-btn--outline {
  border-color: var(--li); background: var(--sf); color: var(--ink);
  &:hover:not(:disabled) { border-color:#99f6e4; background:var(--p-dim); color:var(--p); }
}

/* ================================================================= */
/*  Main Deck                                                        */
/* ================================================================= */
.stg-deck {
  display: grid;
  grid-template-columns: 1.15fr 0.9fr;
  gap: 12px;
  align-items: start;
  flex: 1;
}

/* ---- left column ---- */
.stg-deck__main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: stg-fade-up .5s var(--ease) .06s both;
}

/* ---- right column ---- */
.stg-deck__side {
  animation: stg-fade-up .5s var(--ease) .12s both;
}

/* ================================================================= */
/*  Hero Card  (Update Operations — the star of the page)            */
/* ================================================================= */
.stg-hero {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  border: 1px solid var(--li);
  border-radius: var(--r-xl);
  background: linear-gradient(155deg, #ffffff 0%, #f0fdfa 40%, #f8fafc 100%);
  box-shadow:
    0 2px 8px rgba(0,0,0,.03),
    0 8px 28px rgba(13,148,136,.06);
  transition: box-shadow .35s ease, border-color .35s ease;
  &:hover { box-shadow: 0 4px 14px rgba(0,0,0,.04), 0 10px 36px rgba(13,148,136,.09); }
}
.stg-hero--void {
  background: var(--sf);
  box-shadow: 0 1px 4px rgba(0,0,0,.03);
}

.stg-hero__banner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.stg-hero__banner-left {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}
.stg-hero__banner-icon {
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border-radius: var(--r);
  background: var(--p); color: #fff;
  font-size: 18px; flex-shrink: 0;
  box-shadow: 0 4px 14px var(--p-glow);
}
.stg-hero__banner-icon--muted {
  background: var(--li2); color: var(--fa); box-shadow: none;
}
.stg-hero__banner-title {
  display: block;
  font-size: 15px; font-weight: 800; color: var(--ink);
}
.stg-hero__banner-sub {
  display: block; margin-top: 2px;
  font-size: 12.5px; color: var(--mu); line-height: 1.45;
}
.stg-hero__banner-badge {
  flex-shrink: 0;
  padding: 3px 11px;
  border-radius: var(--r-full);
  font-size: 11.5px; font-weight: 700;
  border: 1px solid var(--li); background: var(--sf); color: var(--mu);
}
.stg-hero__banner-badge--success { border-color:#a7f3d0; background:var(--ok-dim); color:var(--ok); }
.stg-hero__banner-badge--warning { border-color:#fcd34d; background:var(--wa-dim); color:var(--wa); }
.stg-hero__banner-badge--error   { border-color:#fecaca; background:var(--er-dim); color:var(--er); }

/* inline progress */
.stg-hero__prog {
  overflow: hidden;
}
.stg-hero__prog-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-bottom: 8px;
  span { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:var(--ink); }
  strong { font-size: 18px; font-weight: 800; color: var(--p); }
}
.stg-hero__prog-rail {
  height: 6px; border-radius: var(--r-full); overflow: hidden; background: var(--li2);
}
.stg-hero__prog-bar {
  height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, #14b8a6, #0d9488, #14b8a6);
  background-size: 200% 100%;
  animation: stg-shimmer 2s linear infinite;
  transition: width .35s var(--ease);
  box-shadow: 0 0 8px var(--p-glow);
}
.stg-hero__prog-foot {
  display: block; margin-top: 5px; font-size: 11.5px; color: var(--mu);
}

.stg-expand-enter-active { animation: stg-expand-in .35s var(--ease); }
.stg-expand-leave-active { transition: opacity .2s ease, max-height .25s ease; }
.stg-expand-leave-to     { opacity: 0; max-height: 0; }

/* actions */
.stg-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  .stg-btn { flex: 1 1 auto; }
}

/* manual download row */
.stg-hero__manual {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 11px;
  padding: 11px 14px;
  border: 1px solid var(--li2);
  border-radius: var(--r);
  background: var(--bg);
  transition: border-color .22s ease, background .22s ease;
  &:hover { border-color: #cbd5e1; background: var(--sf); }
}
.stg-hero__manual-icon {
  display: flex; align-items: center;
  font-size: 18px; color: var(--p);
}
.stg-hero__manual-info {
  min-width: 0;
  strong { display:block; font-size:13px; color:var(--ink); }
  span   { display:block; font-size:11.5px; color:var(--mu); }
}

/* ================================================================= */
/*  Helper Card  (compact CTA)                                       */
/* ================================================================= */
.stg-helper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--li);
  border-radius: var(--r-lg);
  background: var(--sf);
  box-shadow: 0 1px 4px rgba(0,0,0,.02);
  transition: box-shadow .3s ease, border-color .3s ease;
  &:hover { border-color:#cbd5e1; box-shadow:0 4px 16px rgba(0,0,0,.04); }
}
.stg-helper__head {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  h3 { margin:0; font-size:14px; font-weight:700; color:var(--ink); }
  p  { margin:3px 0 0; font-size:12.5px; color:var(--mu); line-height:1.5; }
}
.stg-helper__badge {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: var(--r);
  background: linear-gradient(135deg, #34d399, #059669);
  color: #fff;
  font-size: 17px; flex-shrink: 0;
  box-shadow: 0 4px 12px var(--em-glow);
}

/* ================================================================= */
/*  Side Panel  (System Info — clean, elegant)                       */
/* ================================================================= */
.stg-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--li);
  border-radius: var(--r-xl);
  background: var(--sf);
  box-shadow: 0 1px 4px rgba(0,0,0,.02);
}
.stg-panel__head {
  display: flex; align-items: center; gap: 7px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--li2);
  font-size: 11.5px; font-weight: 700; color: var(--mu);
  text-transform: uppercase; letter-spacing: .5px;
  :deep(.app-icon) { font-size: 14px; color: var(--p); }
}
.stg-panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* stat rows */
.stg-stat {
  display: grid;
  grid-template-columns: 38px 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--r);
  background: var(--bg);
  transition: all .22s ease;
  &:hover {
    border-color: #cbd5e1;
    background: var(--sf);
    box-shadow: 0 2px 8px rgba(0,0,0,.025);
    transform: translateX(2px);
  }
}
.stg-stat__icon {
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  border-radius: var(--r);
  font-size: 17px; flex-shrink: 0;
}
.stg-stat--teal  .stg-stat__icon { background: var(--p-dim);  color: var(--p); }
.stg-stat--blue  .stg-stat__icon { background: var(--sk-dim); color: var(--sk); }
.stg-stat--slate .stg-stat__icon { background: var(--li2);    color: #475569; }

.stg-stat__label { display:block; font-size:11px; font-weight:700; color:var(--mu); text-transform:uppercase; letter-spacing:.3px; }
.stg-stat__value { display:block; margin-top:2px; font-size:18px; font-weight:800; color:var(--ink); }
.is-mono { font-family:'JetBrains Mono','Cascadia Code',Consolas,monospace; font-variant-numeric:tabular-nums; }

/* feed url */
.stg-feed {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  padding: 10px 12px;
  margin-top: 2px;
  border: 1px solid var(--li2);
  border-radius: var(--r);
  background: var(--bg);
}
.stg-feed__icon {
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: var(--p);
}
.stg-feed__label { display:block; font-size:11px; font-weight:700; color:var(--mu); text-transform:uppercase; letter-spacing:.3px; }
.stg-feed__row {
  display: flex; align-items: center; gap: 6px; min-width:0; margin-top:3px;
}
.stg-feed__tag {
  flex-shrink:0; padding:1px 7px;
  border-radius: var(--r-full);
  background: var(--p-dim); color: var(--p);
  font-style: normal; font-size: 10.5px; font-weight: 700;
}
.stg-feed__row small {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; font-weight: 600; color: var(--ink);
}

/* ================================================================= */
/*  Responsive                                                       */
/* ================================================================= */
@media (max-width: 1000px) {
  .stg-deck {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 680px) {
  .stg { padding: 8px; gap: 8px; }
  .stg-bar { flex-direction: column; align-items: stretch; gap: 10px; }
  .stg-bar__end { flex-wrap: wrap; }
  .stg-hero { padding: 14px 16px; }
  .stg-hero__actions { flex-direction: column; .stg-btn { width:100%; } }
  .stg-hero__manual { grid-template-columns: 1fr; .stg-btn { grid-column:1; } }
  .stg-hero__banner { flex-direction: column; gap: 8px; }
  .stg-panel { padding: 14px; }
}
</style>
