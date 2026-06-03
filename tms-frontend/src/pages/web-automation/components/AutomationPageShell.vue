<template>
  <section class="auto-shell" :class="`auto-shell--${variant}`">
    <!-- ===== Hero ===== -->
    <header class="auto-hero">
      <div class="auto-hero__brand">
        <div class="auto-hero__icon-wrap">
          <AppIcon :name="heroIcon" />
        </div>
        <div class="auto-hero__text">
          <h1 class="auto-hero__title">{{ text(pageTitle) }}</h1>
          <p class="auto-hero__desc">{{ text(pageSubtitle) }}</p>
        </div>
      </div>
      <div class="auto-hero__tools">
        <div class="auto-search">
          <AppIcon name="search" class="auto-search__icon" />
          <input v-model.trim="searchQuery" type="text" :placeholder="text('搜索入口')" />
        </div>
        <span class="auto-badge">{{ filteredEntries.length }}/{{ entries.length }}</span>
      </div>
    </header>

    <!-- ===== Stats ===== -->
    <div class="auto-stats">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="auto-stat"
        :class="`auto-stat--${stat.tone}`"
        :style="{ animationDelay: `${stat.delay}ms` }"
      >
        <div class="auto-stat__icon">
          <AppIcon :name="stat.icon" />
        </div>
        <div class="auto-stat__body">
          <span class="auto-stat__label">{{ text(stat.label) }}</span>
          <strong class="auto-stat__num">{{ stat.value }}</strong>
        </div>
      </div>
    </div>

    <!-- ===== Cards ===== -->
    <div v-if="filteredEntries.length" class="auto-cards">
      <article
        v-for="(entry, i) in filteredEntries"
        :key="entry.id"
        class="auto-card"
        :class="getCardClasses(entry)"
        :style="{ animationDelay: `${i * 70}ms` }"
      >
        <div class="auto-card__top">
          <div class="auto-card__icon" :class="`auto-card__icon--${entry.status}`">
            <AppIcon :name="getCardIcon(entry)" />
          </div>
          <div class="auto-card__head">
            <div class="auto-card__title">{{ entry.title }}</div>
            <div class="auto-card__sub">{{ entry.subtitle }}</div>
          </div>
          <span class="auto-card__tag" :class="`auto-card__tag--${entry.status}`">
            {{ getEntryStatusLabel(entry.status) }}
          </span>
        </div>

        <p class="auto-card__desc">{{ entry.description }}</p>

        <div class="auto-card__tags">
          <span v-for="tag in entry.tags" :key="tag" class="auto-chip">
            {{ tag }}
          </span>
        </div>

        <div class="auto-card__bot">
          <button
            v-if="entry.status === 'online'"
            class="auto-btn auto-btn--primary"
            type="button"
            @click="openEntry(entry.routePath)"
          >
            <AppIcon name="play-circle" />
            <span>{{ text('进入场景') }}</span>
            <AppIcon name="arrow-right" class="auto-btn__arrow" />
          </button>
          <button
            v-else-if="entry.status === 'soon'"
            class="auto-btn auto-btn--soon"
            type="button"
            disabled
          >
            <AppIcon name="clock" />
            <span>{{ text('即将上线') }}</span>
          </button>
          <button
            v-else
            class="auto-btn auto-btn--offline"
            type="button"
            disabled
          >
            <AppIcon name="package" />
            <span>{{ text('暂不可用') }}</span>
          </button>
          <button
            v-if="entry.status === 'online'"
            class="auto-btn auto-btn--ghost"
            type="button"
            @click="openEntry(entry.routePath)"
          >
            <AppIcon name="info" />
            <span>{{ text('详情') }}</span>
          </button>
        </div>
      </article>
    </div>

    <!-- ===== Empty ===== -->
    <div v-else class="auto-empty">
      <div class="auto-empty__icon">
        <AppIcon name="search" />
      </div>
      <h3 class="auto-empty__title">{{ text('没有匹配的入口') }}</h3>
      <p class="auto-empty__desc">{{ text('请调整搜索条件') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '../../../shared/ui/AppIcon.vue'
import {
  webAutomationEntries,
  type WebAutomationEntry,
  getEntryStatusLabel,
  getEntryStatusTone,
} from '../webAutomationModel'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

const props = defineProps<{
  pageTitle: string
  pageSubtitle: string
  allowedEntryIds: string[]
  variant?: 'default' | 'sap' | 'infornexus'
}>()

const router = useRouter()
const { text } = useAppLanguage()
const searchQuery = ref('')

/* ---------- icons ---------- */
const heroIcon = computed(() => {
  if (props.variant === 'sap') return 'database'
  if (props.variant === 'infornexus') return 'globe-search'
  return 'bot'
})

function getCardIcon(entry: WebAutomationEntry): string {
  if (entry.status === 'online') return 'window'
  if (entry.status === 'soon') return 'clock'
  return 'package'
}

function getCardClasses(entry: WebAutomationEntry) {
  return {
    'auto-card--soon': entry.status === 'soon',
    'auto-card--offline': entry.status === 'offline',
    'auto-card--highlight': entry.status === 'online',
  }
}

/* ---------- data ---------- */
const entries = computed(() =>
  webAutomationEntries.filter((e) => props.allowedEntryIds.includes(e.id)),
)

const filteredEntries = computed(() => {
  const kw = searchQuery.value.toLowerCase().trim()
  if (!kw) return [...entries.value]
  return entries.value.filter(
    (e) =>
      e.title.toLowerCase().includes(kw) ||
      e.subtitle.toLowerCase().includes(kw) ||
      e.description.toLowerCase().includes(kw) ||
      e.tags.some((t) => t.toLowerCase().includes(kw)),
  )
})

const stats = computed(() => {
  const all = entries.value
  const online = all.filter((e) => e.status === 'online').length
  const soon = all.filter((e) => e.status === 'soon').length
  const offline = all.filter((e) => e.status === 'offline').length
  return [
    { key: 'online', icon: 'check-circle', label: '可用', value: online, tone: 'online', delay: 60 },
    { key: 'soon', icon: 'clock', label: '即将上线', value: soon, tone: 'soon', delay: 120 },
    { key: 'offline', icon: 'package', label: '暂不可用', value: offline, tone: 'offline', delay: 180 },
  ]
})

function openEntry(path: string): void {
  void router.push(path)
}
</script>

<style scoped>
/* ===================================================================
   AUTO SHELL — Premium Redesign
   Palette: teal (#0d9488), emerald (#059669), blue (#3b82f6)
   No purple tones.
   =================================================================== */
@keyframes auto-fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes auto-fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes auto-scaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes auto-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes auto-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
@keyframes auto-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.25); }
  50%      { box-shadow: 0 0 0 8px rgba(13, 148, 136, 0); }
}

/* ----- Shell ----- */
.auto-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 55% 35% at 50% 0%, rgba(13, 148, 136, 0.05), transparent 55%),
    radial-gradient(ellipse 40% 30% at 80% 90%, rgba(59, 130, 246, 0.04), transparent 50%),
    #f6f9fc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

.auto-shell > * {
  animation: auto-fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.auto-shell > *:nth-child(1) { animation-delay: 0s; }
.auto-shell > *:nth-child(2) { animation-delay: 0.06s; }
.auto-shell > *:nth-child(3) { animation-delay: 0.12s; }

/* ----- Hero ----- */
.auto-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 18px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.03);
}

.auto-hero__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.auto-hero__icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.25);
  transition: transform 0.3s ease;
}
.auto-shell--sap .auto-hero__icon-wrap {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
}
.auto-shell--infornexus .auto-hero__icon-wrap {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.25);
}
.auto-shell:not(.auto-shell--sap):not(.auto-shell--infornexus) .auto-hero__icon-wrap {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
}
.auto-hero__icon-wrap:hover {
  transform: scale(1.05) rotate(-3deg);
}

.auto-hero__text { min-width: 0; }
.auto-hero__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  line-height: 1.3;
}
.auto-hero__desc {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auto-hero__tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.auto-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.25s ease;
  min-width: 200px;
}
.auto-search__icon {
  font-size: 15px;
  color: #94a3b8;
  flex-shrink: 0;
  transition: color 0.2s;
}
.auto-search input {
  border: none;
  background: transparent;
  outline: none;
  color: #1e293b;
  font-size: 13px;
  width: 100%;
  min-width: 0;
}
.auto-search input::placeholder { color: #94a3b8; }
.auto-search:focus-within {
  border-color: #0d9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.08);
  background: #fff;
}
.auto-search:focus-within .auto-search__icon { color: #0d9488; }

.auto-badge {
  padding: 4px 12px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
}

/* ----- Stats ----- */
.auto-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.auto-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px 10px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  animation: auto-scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  cursor: default;
}
.auto-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

.auto-stat__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}
.auto-stat--online .auto-stat__icon {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 3px 8px rgba(5, 150, 105, 0.2);
}
.auto-stat--soon .auto-stat__icon {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  box-shadow: 0 3px 8px rgba(217, 119, 6, 0.2);
}
.auto-stat--offline .auto-stat__icon {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 3px 8px rgba(100, 116, 139, 0.15);
}

.auto-stat__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.auto-stat__label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.auto-stat__num {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

/* ----- Card Grid ----- */
.auto-cards {
  display: grid;
  gap: 14px;
}
/* Variant: default / sap — 3 columns */
.auto-shell--sap .auto-cards,
.auto-shell:not(.auto-shell--sap):not(.auto-shell--infornexus) .auto-cards {
  grid-template-columns: repeat(3, 1fr);
}
/* Variant: infornexus — 2 columns (wider cards) */
.auto-shell--infornexus .auto-cards {
  grid-template-columns: repeat(2, 1fr);
}

/* ----- Card ----- */
.auto-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e8eef3;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  animation: auto-scaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  overflow: hidden;
}
.auto-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.auto-card--highlight::before {
  background: linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf);
  background-size: 200% 100%;
  animation: auto-shimmer 3s linear infinite;
  opacity: 1;
}
.auto-card--soon::before {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  opacity: 0.6;
}
.auto-card--offline::before {
  background: linear-gradient(90deg, #94a3b8, #cbd5e1);
  opacity: 0.3;
}

.auto-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 6px 16px rgba(0,0,0,0.04),
    0 12px 32px rgba(0,0,0,0.03);
  border-color: #b8e6dc;
}
.auto-card--soon:hover { border-color: #fde68a; }
.auto-card--offline:hover { border-color: #e2e8f0; }

/* Variant accent on card hover */
.auto-shell--sap .auto-card--highlight:hover {
  border-color: #99f6e4;
  box-shadow: 0 6px 20px rgba(13, 148, 136, 0.08);
}
.auto-shell--infornexus .auto-card--highlight:hover {
  border-color: #93c5fd;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.08);
}

/* Card top row */
.auto-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.auto-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}
.auto-card:hover .auto-card__icon {
  transform: scale(1.06);
}
.auto-card__icon--online {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  box-shadow: 0 3px 10px rgba(13, 148, 136, 0.2);
}
.auto-card__icon--soon {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.15);
}
.auto-card__icon--offline {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 3px 10px rgba(100, 116, 139, 0.1);
}

.auto-card__head {
  flex: 1;
  min-width: 0;
}
.auto-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}
.auto-card__sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auto-card__tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.2px;
}
.auto-card__tag--online {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}
.auto-card__tag--soon {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.auto-card__tag--offline {
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

/* Description */
.auto-card__desc {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Tags */
.auto-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.auto-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}
.auto-chip:hover {
  background: #e2e8f0;
  transform: translateY(-1px);
}

/* Card bottom actions */
.auto-card__bot {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.auto-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}
.auto-btn .app-icon {
  font-size: 14px;
}

/* Primary button */
.auto-btn--primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.25);
}
.auto-btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(13, 148, 136, 0.35);
}
.auto-btn--primary .auto-btn__arrow {
  transition: transform 0.25s ease;
  font-size: 13px;
}
.auto-btn--primary:hover .auto-btn__arrow {
  transform: translateX(3px);
}

/* Soon / offline buttons */
.auto-btn--soon, .auto-btn--offline {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Ghost button */
.auto-btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
}
.auto-btn--ghost:hover:not(:disabled) {
  background: #f0fdfa;
  border-color: #99f6e4;
  color: #0d9488;
}

/* Variant: infornexus ghost button accent */
.auto-shell--infornexus .auto-btn--ghost:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #3b82f6;
}

/* ===== Empty ===== */
.auto-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 20px;
  text-align: center;
  animation: auto-scaleIn 0.4s ease both;
}
.auto-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  animation: auto-float 2.6s ease-in-out infinite;
  box-shadow: 0 6px 20px rgba(13, 148, 136, 0.2);
}
.auto-empty__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.auto-empty__desc {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  max-width: 320px;
  line-height: 1.6;
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .auto-shell--sap .auto-cards,
  .auto-shell:not(.auto-shell--sap):not(.auto-shell--infornexus) .auto-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 860px) {
  .auto-shell { padding: 14px; }
  .auto-hero {
    flex-direction: column;
    align-items: stretch;
  }
  .auto-hero__tools { width: 100%; }
  .auto-search { min-width: 0; flex: 1; }
  .auto-shell--sap .auto-cards,
  .auto-shell--infornexus .auto-cards,
  .auto-shell:not(.auto-shell--sap):not(.auto-shell--infornexus) .auto-cards {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .auto-hero__brand { flex-wrap: wrap; }
  .auto-stats { flex-direction: column; }
  .auto-stat { width: 100%; }
}
</style>
