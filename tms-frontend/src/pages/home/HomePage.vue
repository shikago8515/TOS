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
  gap: 18px;
  padding: 18px;
  min-height: 100%;
  background: #f8fafc;
}

/* ===== Hero ===== */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  position: relative;
  overflow: hidden;
  animation: slideUp 0.45s ease-out both;

  &::before {
    content: '';
    position: absolute;
    top: -40%;
    right: -8%;
    width: 340px;
    height: 340px;
    background: radial-gradient(circle, rgba(13,148,136,0.05) 0%, transparent 70%);
    pointer-events: none;
  }
}

.hero-main { z-index: 1; }

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  margin-bottom: 10px;
  background: #f0fdfa;
  color: #0d9488;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid #ccfbf1;
  letter-spacing: 0.3px;
  :deep(.app-icon) { font-size: 12px; }
}

.hero-title {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.4px;
}

.hero-sub {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
  max-width: 500px;
}

.hero-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  z-index: 1;
  flex-shrink: 0;
}

.hero-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  :deep(.app-icon) { font-size: 15px; color: #94a3b8; }
}

.hero-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #d1fae5;

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16a34a;
    animation: pulse-dot 2s ease infinite;
  }
}

/* ===== Metrics ===== */
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  animation: slideUp 0.45s ease-out 0.08s both;
}

.metric {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
  animation: fadeScale 0.4s ease-out both;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.06);
    border-color: #99f6e4;
  }

  &__icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #fff;
    flex-shrink: 0;

    &--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
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
    font-size: 28px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }

  &__label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    margin-top: 2px;
  }

  &__detail {
    position: absolute;
    right: 16px;
    bottom: 10px;
    font-size: 11px;
    color: #cbd5e1;
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
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* ===== Panels ===== */
.modules-panel,
.status-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modules-panel { animation: slideUp 0.45s ease-out 0.16s both; }
.status-panel { animation: slideUp 0.45s ease-out 0.22s both; }

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;

  :deep(.app-icon) { font-size: 18px; color: #0d9488; }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    flex: 1;
  }
}

.panel-count {
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f0fdfa;
  color: #0d9488;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid #ccfbf1;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  padding: 16px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.status-list {
  list-style: none;
  margin: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
}

/* ===== Animations ===== */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeScale {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(22,163,74,0); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .content-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .metrics { grid-template-columns: 1fr; }
  .hero { flex-direction: column; align-items: flex-start; padding: 20px; }
  .hero-meta { flex-direction: row; align-items: center; }
  .metric__detail { display: none; }
  .shortcut-grid { grid-template-columns: 1fr; }
}
</style>
