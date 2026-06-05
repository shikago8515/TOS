<template>
  <section class="home-page">
    <!-- Hero Banner -->
    <div class="hero">
      <div class="hero-main">
        <div class="hero-badge">
          <AppIcon name="radar" />
          <span>TOS Workstation</span>
        </div>
        <h1 class="hero-title">{{ t('app.home.title') }}</h1>
        <p class="hero-sub">{{ heroSubtitle }}</p>
      </div>
      <div class="hero-meta">
        <div class="hero-clock">
          <AppIcon name="calendar" />
          <span>{{ displayDate }}</span>
        </div>
        <div class="hero-status" :class="{ 'hero-status--online': true }">
          <span class="hero-status__dot" />
          <span>{{ t('app.home.backendOnline') }}</span>
        </div>
      </div>
    </div>

    <!-- Metric Tiles -->
    <div class="metrics">
      <article
        v-for="(m, i) in metricCards"
        :key="m.key"
        class="metric"
        :style="{ animationDelay: `${i * 80 + 100}ms` }"
      >
        <div class="metric__icon" :class="`metric__icon--${m.tone}`">
          <AppIcon :name="m.icon" />
        </div>
        <div class="metric__body">
          <span class="metric__value">{{ m.value }}</span>
          <span class="metric__label">{{ m.label }}</span>
        </div>
        <span class="metric__detail">{{ m.detail }}</span>
      </article>
    </div>

    <!-- Content Grid -->
    <div class="content-grid">
      <!-- Module Shortcuts -->
      <div class="modules-panel">
        <div class="panel-head">
          <AppIcon name="layers" />
          <h3>{{ t('app.home.modules') }}</h3>
          <span class="panel-count">{{ homeShortcutModules.length }}</span>
        </div>
        <div class="shortcut-grid">
          <ModuleShortcutCard
            v-for="(module, i) in homeShortcutModules"
            :key="module.id"
            :module="module"
            :index="i"
          />
        </div>
      </div>

      <!-- Service Status -->
      <div class="status-panel">
        <div class="panel-head">
          <AppIcon name="activity" />
          <h3>{{ t('app.home.runtime') }}</h3>
        </div>
        <ul class="status-list">
          <ServiceStatusItem
            v-for="item in serviceStatusItems"
            :key="item.labelKey"
            :label="t(item.labelKey)"
            :description="t(item.descriptionKey)"
            :status="t(item.statusKey)"
            :tone="item.tone"
          />
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import ModuleShortcutCard from '../../shared/ui/ModuleShortcutCard.vue'
import ServiceStatusItem from '../../shared/ui/ServiceStatusItem.vue'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import {
  homeMetricTiles,
  homeShortcutModules,
  serviceStatusItems,
} from './homeModel'

const { isEnglish, t } = useAppLanguage()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => { clearInterval(timer) })

const displayDate = computed(() => {
  const d = now.value
  const weekdays = isEnglish.value
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  const hh = `${d.getHours()}`.padStart(2, '0')
  const mi = `${d.getMinutes()}`.padStart(2, '0')
  return `${mm}/${dd} ${weekdays[d.getDay()]} ${hh}:${mi}`
})

const heroSubtitle = computed(() =>
  isEnglish.value
    ? 'Excel processing, browser automation, and web data collection in one place.'
    : 'Excel 数据处理、浏览器自动化和网页数据采集，一站式工作台。',
)

const iconMap: Record<string, string> = {
  blue: 'database',
  green: 'globe-search',
  amber: 'workflow',
}

const metricCards = computed(() =>
  homeMetricTiles.map((m) => ({
    key: m.labelKey,
    icon: iconMap[m.tone] || 'radar',
    value: m.value,
    label: t(m.labelKey),
    detail: m.detailKey ? t(m.detailKey) : homeShortcutModules
      .filter((mod) => mod.group === 'automation')
      .map((mod) => isEnglish.value ? mod.navLabelEn : mod.navLabel)
      .join(' / '),
    tone: m.tone === 'blue' ? 'teal' : m.tone === 'green' ? 'green' : 'orange',
  })),
)
</script>

<style scoped lang="scss">
.home-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  min-height: 100%;
  background: var(--soft-bg, #f0f4f8);
}

/* ===== Hero — Soft UI ===== */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 30px 34px;
  background: var(--soft-surface, #ffffff);
  border: none;
  border-radius: var(--soft-radius, 16px);
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  position: relative;
  overflow: hidden;
  animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  transition: box-shadow 0.4s ease;

  &:hover {
    box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  }

  &::before {
    content: '';
    position: absolute;
    top: -60%;
    right: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(13,148,136,0.06) 0%, transparent 65%);
    pointer-events: none;
    animation: floatOrb 8s ease-in-out infinite alternate;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -40%;
    left: -5%;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 65%);
    pointer-events: none;
    animation: floatOrb 10s ease-in-out 2s infinite alternate-reverse;
  }
}

@keyframes floatOrb {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(12px, -8px) scale(1.05); }
}

.hero-main { z-index: 1; }

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 14px;
  margin-bottom: 12px;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--soft-accent, #0d9488);
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  border: none;
  letter-spacing: 0.4px;
  box-shadow:
    inset 1px 1px 3px rgba(13, 148, 136, 0.08),
    inset -1px -1px 3px rgba(255, 255, 255, 0.9);
  :deep(.app-icon) { font-size: 13px; }
}

.hero-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
  color: var(--soft-text, #1e293b);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.hero-sub {
  margin: 0;
  color: var(--soft-text-secondary, #64748b);
  font-size: 14px;
  line-height: 1.7;
  max-width: 520px;
}

.hero-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 1;
  flex-shrink: 0;
}

.hero-clock {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  background: var(--soft-bg, #f0f4f8);
  border: none;
  border-radius: var(--soft-radius-xs, 10px);
  color: var(--soft-text-secondary, #64748b);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
  transition: all 0.3s ease;

  &:hover {
    box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  }

  :deep(.app-icon) { font-size: 15px; color: var(--soft-accent, #0d9488); opacity: 0.7; }
}

.hero-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  background: var(--soft-accent-light, #f0fdfa);
  color: #059669;
  border: none;
  box-shadow:
    inset 1px 1px 3px rgba(5, 150, 105, 0.06),
    inset -1px -1px 3px rgba(255, 255, 255, 0.9);

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #16a34a;
    animation: pulse-dot 2s ease infinite;
  }
}

/* ===== Metrics — Soft UI ===== */
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
}

.metric {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  background: var(--soft-surface, #fff);
  border: none;
  border-radius: var(--soft-radius, 16px);
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: relative;
  overflow: hidden;
  animation: fadeScale 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  cursor: default;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  }

  &__icon {
    width: 52px;
    height: 52px;
    border-radius: var(--soft-radius-sm, 12px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23px;
    color: #fff;
    flex-shrink: 0;
    box-shadow:
      3px 3px 8px rgba(0, 0, 0, 0.1),
      -2px -2px 5px rgba(255, 255, 255, 0.4);
    transition: transform 0.35s ease;

    .metric:hover & {
      transform: scale(1.06) rotate(-2deg);
    }

    &--teal  { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
    &--green { background: linear-gradient(135deg, #34d399, #059669); }
    &--orange { background: linear-gradient(135deg, #fb923c, #ea580c); }
  }

  &__body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  &__value {
    font-size: 30px;
    font-weight: 800;
    color: var(--soft-text, #1e293b);
    line-height: 1.1;
    letter-spacing: -0.5px;
  }

  &__label {
    font-size: 13px;
    color: var(--soft-text-secondary, #64748b);
    font-weight: 500;
    margin-top: 3px;
  }

  &__detail {
    position: absolute;
    right: 18px;
    bottom: 12px;
    font-size: 11px;
    color: var(--soft-text-muted, #cbd5e1);
    font-weight: 500;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ===== Content Grid ===== */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
  flex: 1;
  min-height: 0;
}

/* ===== Panels — Soft UI ===== */
.modules-panel,
.status-panel {
  background: var(--soft-surface, #fff);
  border: none;
  border-radius: var(--soft-radius, 16px);
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.35s ease;

  &:hover {
    box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  }
}

.modules-panel { animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both; }
.status-panel  { animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both; }

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);

  :deep(.app-icon) { font-size: 18px; color: var(--soft-accent, #0d9488); }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--soft-text, #1e293b);
    flex: 1;
    letter-spacing: -0.2px;
  }
}

.panel-count {
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--soft-accent-light, #f0fdfa);
  color: var(--soft-accent, #0d9488);
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  border: none;
  box-shadow:
    inset 1px 1px 2px rgba(13, 148, 136, 0.06),
    inset -1px -1px 2px rgba(255, 255, 255, 0.9);
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 18px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.status-list {
  list-style: none;
  margin: 0;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
}

/* ===== Animations ===== */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeScale {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(22,163,74,0); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .content-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .metrics { grid-template-columns: 1fr; }
  .hero { flex-direction: column; align-items: flex-start; padding: 22px; }
  .hero-meta { flex-direction: row; align-items: center; }
  .metric__detail { display: none; }
  .shortcut-grid { grid-template-columns: 1fr; }
}
</style>
