<template>
  <section class="home-page">
    <!-- 1. 欢迎横幅 -->
    <div class="hero-banner">
      <div class="hero-left">
        <div class="hero-badge">
          <AppIcon name="radar" />
          <span>{{ text('TMS 工作站') }}</span>
        </div>
        <h1 class="hero-title">{{ text('TOS 运营看板') }}</h1>
        <p class="hero-desc">{{ text('数据核对、报表制作、浏览器自动化与通用工具，一站式工作台。') }}</p>
      </div>
      <div class="hero-illust" aria-hidden="true">
        <svg viewBox="0 0 480 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cF" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#a7f3d0"/><stop offset="60%" stop-color="#6ee7b7" stop-opacity="0.7"/><stop offset="100%" stop-color="#34d399" stop-opacity="0.35"/></linearGradient>
            <linearGradient id="cT" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ecfdf5"/><stop offset="50%" stop-color="#d1fae5"/><stop offset="100%" stop-color="#a7f3d0"/></linearGradient>
            <linearGradient id="cB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.15"/><stop offset="100%" stop-color="#6ee7b7" stop-opacity="0.04"/></linearGradient>
            <linearGradient id="sF" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f1f5f9"/></linearGradient>
            <linearGradient id="sB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient>
            <linearGradient id="sR" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8" stop-opacity="0.6"/></linearGradient>
            <linearGradient id="lf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6ee7b7" stop-opacity="0.35"/><stop offset="100%" stop-color="#34d399" stop-opacity="0.12"/></linearGradient>
            <linearGradient id="lf2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#99f6e4" stop-opacity="0.28"/><stop offset="100%" stop-color="#a7f3d0" stop-opacity="0.08"/></linearGradient>
            <linearGradient id="kb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient>
            <filter id="dS"><feDropShadow dx="3" dy="6" stdDeviation="8" flood-color="#0f766e" flood-opacity="0.07"/></filter>
            <filter id="bS"><feGaussianBlur stdDeviation="4"/></filter>
          </defs>
          <ellipse cx="120" cy="182" rx="44" ry="6" fill="#0f766e" opacity="0.04" filter="url(#bS)"/>
          <ellipse cx="300" cy="186" rx="115" ry="10" fill="#0f766e" opacity="0.035" filter="url(#bS)"/>
          <rect x="78" y="80" width="30" height="80" rx="15" fill="url(#cB)"/>
          <rect x="78" y="80" width="30" height="80" rx="15" fill="url(#cF)" opacity="0.5"/>
          <rect x="78" y="80" width="11" height="80" rx="5" fill="#d1fae5" opacity="0.25"/>
          <ellipse cx="93" cy="80" rx="15" ry="6.5" fill="url(#cT)" opacity="0.65"/>
          <ellipse cx="93" cy="80" rx="15" ry="6.5" fill="none" stroke="#86efac" stroke-width="0.8" opacity="0.45"/>
          <ellipse cx="88" cy="78" rx="6" ry="2" fill="#fff" opacity="0.25"/>
          <ellipse cx="93" cy="107" rx="15" ry="5" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.25"/>
          <ellipse cx="93" cy="134" rx="15" ry="5" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.25"/>
          <rect x="100" y="42" width="38" height="118" rx="19" fill="url(#cB)"/>
          <rect x="100" y="42" width="38" height="118" rx="19" fill="url(#cF)" opacity="0.55"/>
          <rect x="100" y="42" width="14" height="118" rx="7" fill="#d1fae5" opacity="0.22"/>
          <ellipse cx="119" cy="42" rx="19" ry="8" fill="url(#cT)" opacity="0.72"/>
          <ellipse cx="119" cy="42" rx="19" ry="8" fill="none" stroke="#86efac" stroke-width="0.8" opacity="0.45"/>
          <ellipse cx="113" cy="40" rx="7" ry="2.5" fill="#fff" opacity="0.28"/>
          <ellipse cx="119" cy="75" rx="19" ry="6" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.25"/>
          <ellipse cx="119" cy="108" rx="19" ry="6" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.25"/>
          <ellipse cx="119" cy="141" rx="19" ry="6" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.25"/>
          <rect x="134" y="64" width="28" height="96" rx="14" fill="url(#cB)"/>
          <rect x="134" y="64" width="28" height="96" rx="14" fill="url(#cF)" opacity="0.42"/>
          <rect x="134" y="64" width="10" height="96" rx="5" fill="#d1fae5" opacity="0.2"/>
          <ellipse cx="148" cy="64" rx="14" ry="5.5" fill="url(#cT)" opacity="0.58"/>
          <ellipse cx="148" cy="64" rx="14" ry="5.5" fill="none" stroke="#86efac" stroke-width="0.7" opacity="0.38"/>
          <ellipse cx="143" cy="62.5" rx="5" ry="1.8" fill="#fff" opacity="0.22"/>
          <ellipse cx="148" cy="92" rx="14" ry="4.5" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.2"/>
          <ellipse cx="148" cy="120" rx="14" ry="4.5" fill="none" stroke="#86efac" stroke-width="0.5" opacity="0.2"/>
          <g filter="url(#dS)">
            <g transform="translate(295,90) skewY(-1.5) translate(-295,-90)">
              <rect x="190" y="20" width="210" height="140" rx="8" fill="url(#sF)"/>
              <path d="M400 28 L404 26 L404 162 L400 160Z" fill="url(#sR)" opacity="0.35"/>
              <path d="M198 160 L400 160 L404 162 L202 162Z" fill="url(#sB)" opacity="0.4"/>
              <rect x="190" y="20" width="210" height="140" rx="8" fill="none" stroke="#d1d5db" stroke-width="1"/>
              <rect x="190" y="20" width="210" height="20" rx="8" fill="#f1f5f9"/>
              <path d="M190 40h210" stroke="#e2e8f0" stroke-width="0.5"/>
              <circle cx="200" cy="30" r="2.5" fill="#fca5a5" opacity="0.6"/>
              <circle cx="208" cy="30" r="2.5" fill="#fcd34d" opacity="0.6"/>
              <circle cx="216" cy="30" r="2.5" fill="#86efac" opacity="0.6"/>
              <rect x="340" y="26" width="22" height="8" rx="2" fill="#d1fae5" opacity="0.4"/>
              <rect x="366" y="26" width="22" height="8" rx="2" fill="#dbeafe" opacity="0.4"/>
              <rect x="202" y="48" width="82" height="5" rx="2.5" fill="#a7f3d0" opacity="0.55"/>
              <rect x="202" y="58" width="56" height="5" rx="2.5" fill="#6ee7b7" opacity="0.35"/>
              <rect x="202" y="68" width="70" height="5" rx="2.5" fill="#a7f3d0" opacity="0.45"/>
              <rect x="202" y="78" width="42" height="5" rx="2.5" fill="#6ee7b7" opacity="0.28"/>
              <circle cx="340" cy="72" r="26" fill="none" stroke="#e2e8f0" stroke-width="7" opacity="0.4"/>
              <path d="M340 46 A26 26 0 0 1 363 83" fill="none" stroke="#34d399" stroke-width="7" stroke-linecap="round" opacity="0.5"/>
              <circle cx="340" cy="72" r="13" fill="#f0fdfa" opacity="0.7"/>
              <rect x="202" y="96" width="85" height="54" rx="5" fill="#f0fdfa" stroke="#d1fae5" stroke-width="0.8"/>
              <rect x="210" y="104" width="38" height="4" rx="2" fill="#a7f3d0" opacity="0.5"/>
              <rect x="210" y="113" width="10" height="28" rx="2" fill="#6ee7b7" opacity="0.35"/>
              <rect x="224" y="120" width="10" height="21" rx="2" fill="#34d399" opacity="0.35"/>
              <rect x="238" y="116" width="10" height="25" rx="2" fill="#a7f3d0" opacity="0.35"/>
              <rect x="252" y="124" width="10" height="17" rx="2" fill="#6ee7b7" opacity="0.3"/>
              <rect x="296" y="96" width="94" height="54" rx="5" fill="#f0fdfa" stroke="#d1fae5" stroke-width="0.8"/>
              <rect x="304" y="104" width="48" height="4" rx="2" fill="#99f6e4" opacity="0.45"/>
              <polyline points="308,140 320,126 332,132 344,118 356,124 368,114 380,120" stroke="#34d399" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
              <path d="M308,140 320,126 332,132 344,118 356,124 368,114 380,120 380,144 308,144Z" fill="#34d399" opacity="0.05"/>
            </g>
          </g>
          <g transform="translate(295,165) skewX(-8)">
            <rect x="-52" y="0" width="112" height="9" rx="2" fill="url(#kb)" opacity="0.4"/>
            <rect x="-52" y="9" width="112" height="3" rx="1.5" fill="#94a3b8" opacity="0.15"/>
          </g>
          <path d="M418,58 C435,34 454,44 449,68 C444,86 426,82 418,58Z" fill="url(#lf)" opacity="0.7"/>
          <path d="M418,58 C436,52 449,68 449,68" stroke="#86efac" stroke-width="0.6" fill="none" opacity="0.4"/>
          <path d="M420,62 C437,38 456,48 451,72 C446,90 428,86 420,62Z" fill="#0f766e" opacity="0.02" filter="url(#bS)"/>
          <path d="M432,88 C448,66 464,78 459,100 C454,115 438,110 432,88Z" fill="url(#lf)" opacity="0.5"/>
          <path d="M434,92 C450,70 466,82 461,104 C456,119 440,114 434,92Z" fill="#0f766e" opacity="0.015" filter="url(#bS)"/>
          <path d="M424,115 C436,96 452,104 449,124 C446,137 432,133 424,115Z" fill="url(#lf2)" opacity="0.6"/>
          <path d="M408,36 C418,20 433,28 430,46 C427,57 415,53 408,36Z" fill="#99f6e4" opacity="0.2"/>
          <path d="M442,134 C454,118 464,128 461,146 C458,156 446,152 442,134Z" fill="#d1fae5" opacity="0.3"/>
          <circle cx="56" cy="32" r="5" fill="#d1fae5" opacity="0.35"/>
          <circle cx="168" cy="18" r="4" fill="#a7f3d0" opacity="0.28"/>
          <circle cx="456" cy="24" r="6" fill="#ecfdf5" opacity="0.35"/>
          <circle cx="28" cy="98" r="3.5" fill="#ccfbf1" opacity="0.35"/>
          <circle cx="466" cy="158" r="4" fill="#d1fae5" opacity="0.28"/>
          <circle cx="178" cy="168" r="3" fill="#a7f3d0" opacity="0.25"/>
          <rect x="40" y="62" width="7" height="7" rx="1" fill="#ccfbf1" opacity="0.25" transform="rotate(45 43.5 65.5)"/>
          <rect x="462" y="64" width="6" height="6" rx="1" fill="#d1fae5" opacity="0.25" transform="rotate(45 465 67)"/>
          <rect x="160" y="42" width="5" height="5" rx="1" fill="#a7f3d0" opacity="0.25" transform="rotate(45 162.5 44.5)"/>
          <circle cx="68" cy="138" r="10" fill="none" stroke="#d1fae5" stroke-width="1" opacity="0.25"/>
          <circle cx="448" cy="42" r="12" fill="none" stroke="#ccfbf1" stroke-width="1" opacity="0.2"/>
          <circle cx="182" cy="184" r="8" fill="none" stroke="#a7f3d0" stroke-width="0.8" opacity="0.25"/>
          <circle cx="50" cy="168" r="2" fill="#6ee7b7" opacity="0.18"/>
          <circle cx="470" cy="96" r="2.5" fill="#86efac" opacity="0.18"/>
          <circle cx="24" cy="52" r="2" fill="#a7f3d0" opacity="0.25"/>
        </svg>
      </div>
    </div>

    <!-- 2. 核心数据卡片 -->
    <div class="metrics-row">
      <div
        v-for="m in metricTiles"
        :key="m.key"
        class="metric-card"
      >
        <div class="metric-icon" :class="`metric-icon--${m.tone}`">
          <AppIcon :name="m.icon" />
        </div>
        <div class="metric-body">
          <span class="metric-value">{{ m.value }}</span>
          <span class="metric-label">{{ m.label }}</span>
          <span class="metric-detail">{{ m.detail }}</span>
        </div>
        <div v-if="m.delta" class="metric-delta">
          <span class="metric-delta__value">{{ m.delta }}</span>
          <span class="metric-delta__label">{{ m.deltaLabel }}</span>
        </div>
        <svg
          v-if="m.key === 'health'"
          class="metric-chart"
          viewBox="0 0 90 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline
            points="2,28 12,22 22,26 32,18 42,20 52,14 62,16 72,10 82,12 88,8"
            stroke="#3b82f6"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
          <polyline
            points="2,28 12,22 22,26 32,18 42,20 52,14 62,16 72,10 82,12 88,8 88,34 2,34"
            fill="url(#chartGrad)"
            opacity="0.15"
          />
          <defs>
            <linearGradient id="chartGrad" x1="45" y1="8" x2="45" y2="34" gradientUnits="userSpaceOnUse">
              <stop stop-color="#3b82f6" />
              <stop offset="1" stop-color="#3b82f6" stop-opacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>

    <!-- 3. 下方主体内容区 -->
    <div class="content-split">
      <!-- 3a. 左侧主模块面板 -->
      <div class="modules-panel">
        <div class="modules-head">
          <div class="modules-head-left">
            <AppIcon name="layers" class="modules-head-icon" />
            <h3 class="modules-title">{{ text('正式模块与测试模块') }}</h3>
          </div>
          <div class="modules-head-right">
            <span class="modules-count">{{ homeModuleCards.length }}</span>
            <button class="modules-grid-toggle" type="button" :title="text('切换视图')">
              <AppIcon name="grid" />
            </button>
          </div>
        </div>
        <div class="modules-tabs">
          <button
            v-for="tab in moduleTabs"
            :key="tab.key"
            class="modules-tab"
            :class="{ 'modules-tab--active': activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="module-grid">
          <RouterLink
            v-for="card in filteredModules"
            :key="card.module.id"
            :to="card.module.path"
            class="module-card"
          >
            <div class="module-card__icon" :class="`module-card__icon--${card.iconTone}`">
              <AppIcon :name="card.iconName" />
            </div>
            <div class="module-card__text">
              <span class="module-card__name">{{ getHomeModuleLabel(card) }}</span>
              <span class="module-card__stage">
                <span class="module-card__dot" :class="`module-card__dot--${card.stageDot}`" />
                {{ getHomeModuleStageLabel(card) }}
              </span>
            </div>
          </RouterLink>
        </div>
      </div>

      <!-- 3b. 右侧辅助面板 -->
      <div class="side-col">
        <!-- 运行概况 -->
        <div class="status-card">
          <div class="status-head">
            <div class="status-head-left">
              <AppIcon name="activity" class="status-head-icon" />
              <h3 class="status-title">{{ text('运行概况') }}</h3>
            </div>
            <RouterLink class="status-more" to="/settings">{{ text('查看更多') }} &gt;</RouterLink>
          </div>
          <div class="status-list">
            <div
              v-for="item in statusItems"
              :key="item.key"
              class="status-item"
            >
              <div class="status-item__icon" :class="`status-item__icon--${item.tone}`">
                <AppIcon :name="statusIconName(item.tone)" />
              </div>
              <div class="status-item__body">
                <strong>{{ item.title }}</strong>
                <span>{{ item.subtitle }}</span>
              </div>
              <em class="status-item__badge" :class="`status-item__badge--${item.tone}`">
                {{ item.status }}
              </em>
            </div>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from '../../shared/ui/AppIcon.vue'
import {
  homeMetricTiles,
  homeModuleCards,
  serviceStatusItems,
  type HomeModuleCard,
} from './homeModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

/* ── Data refs ── */
const { isEnglish, text } = useAppLanguage()

const metricTiles = computed(() =>
  homeMetricTiles.map((item) => ({
    ...item,
    label: text(item.label),
    detail: text(item.detail),
    deltaLabel: item.deltaLabel ? text(item.deltaLabel) : item.deltaLabel,
  })),
)
const statusItems = computed(() =>
  serviceStatusItems.map((item) => ({
    ...item,
    title: text(item.title),
    subtitle: text(item.subtitle),
    status: text(item.status),
  })),
)

/* ── Module tabs ── */
const activeTab = ref('all')
const moduleTabs = computed(() => [
  { key: 'all', label: text('全部') },
  { key: 'production', label: text('正式模块') },
  { key: 'testing', label: text('测试模块') },
])

const filteredModules = computed(() => {
  if (activeTab.value === 'production') {
    return homeModuleCards.filter((c) => c.module.stage === 'production')
  }
  if (activeTab.value === 'testing') {
    return homeModuleCards.filter((c) => c.module.stage === 'validation')
  }
  return homeModuleCards
})

/* ── Helpers ── */
function getHomeModuleLabel(card: HomeModuleCard): string {
  return isEnglish.value ? card.module.navLabelEn : card.module.navLabel
}

function getHomeModuleStageLabel(card: HomeModuleCard): string {
  return text(card.stageLabel)
}

function statusIconName(tone: string): string {
  const map: Record<string, string> = {
    online: 'check-circle',
    ready: 'shield-check',
    working: 'activity',
  }
  return map[tone] || 'activity'
}
</script>

<style scoped lang="scss">
/* ── Tokens ── */
$color-primary: #0f766e;
$color-primary-strong: #0d9488;
$color-primary-soft: #f0fdfa;
$color-bg: #f5f8fb;
$color-surface: #ffffff;
$color-surface-muted: #f1f5f9;
$color-text: #1e293b;
$color-muted: #64748b;
$color-muted-light: #94a3b8;
$color-border: #e2e8f0;
$radius-lg: 14px;
$radius-md: 12px;
$radius-sm: 10px;
$radius-xs: 8px;
$shadow-card: 0 2px 8px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03);

/* ── Page ── */
.home-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
  padding: 14px 22px;
  background: $color-bg;
}

/* ═══════════════════════════════════════════
   1. HERO BANNER
   ═══════════════════════════════════════════ */
.hero-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 28px;
  background: $color-surface;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  min-height: 120px;
  position: relative;
  overflow: hidden;
}

.hero-left {
  flex: 0 1 48%;
  min-width: 0;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  margin-bottom: 8px;
  background: #dcfce7;
  color: #16a34a;
  font-size: 12px;
  font-weight: 700;
  border-radius: $radius-sm;

  :deep(.app-icon) {
    font-size: 12px;
  }
}

.hero-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 800;
  color: $color-text;
  line-height: 1.15;
}

.hero-desc {
  margin: 0;
  font-size: 13px;
  color: $color-muted;
  line-height: 1.5;
  max-width: 420px;
}

.hero-illust {
  flex: 1 1 52%;
  min-width: 0;
  max-width: 320px;
  height: 110px;
  margin-left: auto;
  opacity: 0.75;
  z-index: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

/* ═══════════════════════════════════════════
   2. METRIC CARDS
   ═══════════════════════════════════════════ */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.metric-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  background: $color-surface;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.07);
  }
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #ffffff;
  flex-shrink: 0;

  &--green {
    background: linear-gradient(135deg, #34d399, #059669);
  }
  &--orange {
    background: linear-gradient(135deg, #fb923c, #ea580c);
  }
  &--blue {
    background: linear-gradient(135deg, #60a5fa, #2563eb);
  }
}

.metric-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.metric-value {
  font-size: 26px;
  font-weight: 800;
  color: $color-text;
  line-height: 1.1;
}

.metric-label {
  font-size: 13px;
  color: $color-muted;
  font-weight: 500;
  margin-top: 2px;
}

.metric-detail {
  font-size: 11px;
  color: $color-muted-light;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}

.metric-delta {
  position: absolute;
  right: 12px;
  top: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 8px;
  background: $color-primary-soft;
  border-radius: 8px;

  &__value {
    font-size: 12px;
    font-weight: 700;
    color: $color-primary;
  }
  &__label {
    font-size: 10px;
    color: $color-muted;
  }
}

.metric-chart {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 80px;
  height: 28px;
}

/* ═══════════════════════════════════════════
   3. CONTENT SPLIT
   ═══════════════════════════════════════════ */
.content-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* ── 3a. Modules Panel ── */
.modules-panel {
  display: flex;
  flex-direction: column;
  background: $color-surface;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.modules-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 0;
}

.modules-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modules-head-icon {
  font-size: 18px;
  color: $color-primary-strong;
}

.modules-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $color-text;
}

.modules-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modules-count {
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: $color-primary-soft;
  color: $color-primary;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
}

.modules-grid-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid $color-border;
  border-radius: 6px;
  background: $color-surface;
  color: $color-muted;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;

  &:hover {
    border-color: $color-primary-strong;
    color: $color-primary;
  }
}

.modules-tabs {
  display: flex;
  gap: 0;
  padding: 10px 18px 0;
  border-bottom: 1px solid $color-border;
}

.modules-tab {
  padding: 6px 12px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: $color-muted;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%) scaleX(0);
    width: 20px;
    height: 2px;
    border-radius: 999px;
    background: $color-primary-strong;
    transition: transform 0.2s ease;
  }

  &--active {
    color: $color-primary;

    &::after {
      transform: translateX(-50%) scaleX(1);
    }
  }

  &:hover:not(.modules-tab--active) {
    color: $color-text;
  }
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px 12px;
  padding: 12px 18px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  min-height: 62px;
  background: $color-surface-muted;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;

  &:hover {
    background: $color-surface;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
    transform: translateY(-1px);
  }

  &__icon {
    width: 38px;
    height: 38px;
    border-radius: $radius-xs;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #ffffff;
    flex-shrink: 0;

    &--green {
      background: linear-gradient(135deg, #34d399, #059669);
    }
    &--blue {
      background: linear-gradient(135deg, #60a5fa, #2563eb);
    }
    &--orange {
      background: linear-gradient(135deg, #fb923c, #ea580c);
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  &__name {
    font-size: 13px;
    font-weight: 700;
    color: $color-text;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__stage {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: $color-muted;
    margin-top: 2px;
  }

  &__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;

    &--green { background: #16a34a; }
    &--blue { background: #3b82f6; }
  }
}

/* ── 3b. Right Side Column ── */
.side-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Status Card (运行概况) ── */
.status-card {
  background: $color-surface;
  border-radius: $radius-lg;
  box-shadow: $shadow-card;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.status-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid $color-border;
}

.status-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-head-icon {
  font-size: 16px;
  color: $color-primary-strong;
}

.status-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $color-text;
}

.status-more {
  font-size: 13px;
  color: $color-primary;
  text-decoration: none;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: $color-surface-muted;
  border-radius: $radius-xs;
  transition: background 0.2s ease;

  &:hover {
    background: #eef2f7;
  }

  &__icon {
    width: 36px;
    height: 36px;
    border-radius: $radius-xs;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #ffffff;
    flex-shrink: 0;

    &--online {
      background: linear-gradient(135deg, #34d399, #059669);
    }
    &--ready {
      background: linear-gradient(135deg, #60a5fa, #2563eb);
    }
    &--working {
      background: linear-gradient(135deg, #fb923c, #ea580c);
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;

    strong {
      font-size: 13px;
      font-weight: 700;
      color: $color-text;
      line-height: 1.3;
    }
    span {
      font-size: 11px;
      color: $color-muted;
      margin-top: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__badge {
    padding: 3px 8px;
    font-size: 11px;
    font-style: normal;
    font-weight: 600;
    border-radius: 999px;
    flex-shrink: 0;
    white-space: nowrap;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;

    &--online {
      background: #dcfce7;
      color: #16a34a;
    }
    &--ready {
      background: #dbeafe;
      color: #2563eb;
    }
    &--working {
      background: #ffedd5;
      color: #ea580c;
    }
  }
}

/* ═══════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════ */
@media (max-width: 1400px) {
  .hero-banner {
    padding: 16px 22px;
    min-height: 100px;
    gap: 16px;
  }

  .hero-title {
    font-size: 22px;
  }

  .hero-illust {
    max-width: 260px;
    height: 90px;
  }
}

@media (max-width: 1280px) {
  .content-split {
    grid-template-columns: 1fr;
  }

  .side-col {
    flex-direction: row;
    gap: 14px;

    > * {
      flex: 1;
      min-width: 0;
    }
  }
}

@media (max-width: 960px) {
  .home-page {
    padding: 12px 16px;
    gap: 12px;
  }

  .hero-banner {
    flex-direction: column;
    align-items: flex-start;
    padding: 14px 18px;
    min-height: auto;
    gap: 10px;
  }

  .hero-illust {
    display: none;
  }

  .hero-left {
    flex: none;
    width: 100%;
  }

  .hero-title {
    font-size: 20px;
  }

  .hero-desc {
    font-size: 12px;
  }

  .side-col {
    flex-direction: column;
  }

  .module-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

@media (max-width: 640px) {
  .metrics-row {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .module-grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
    padding: 10px 14px;
  }

  .module-card {
    min-height: 54px;
    padding: 8px 10px;
    gap: 8px;

    &__icon {
      width: 32px;
      height: 32px;
      font-size: 14px;
    }
    &__name {
      font-size: 12px;
    }
    &__stage {
      font-size: 10px;
    }
  }

  .status-item {
    flex-wrap: wrap;

    &__badge {
      margin-left: auto;
    }
  }
}
</style>
