<template>
  <section class="ap-shell" :class="`ap-shell--${variant}`">
    <!-- ===== Hero ===== -->
    <header class="ap-hero">
      <div class="ap-hero__brand">
        <div class="ap-hero__icon-wrap">
          <AppIcon :name="heroIcon" />
        </div>
        <div class="ap-hero__text">
          <h1 class="ap-hero__title">{{ text(pageTitle) }}</h1>
          <p class="ap-hero__desc">{{ text(pageSubtitle) }}</p>
        </div>
      </div>
      <div class="ap-hero__tools">
        <div class="ap-search">
          <AppIcon name="file-search" class="ap-search__icon" />
          <input v-model.trim="searchQuery" type="text" :placeholder="text('搜索入口')" />
        </div>
        <span class="ap-badge">{{ filteredEntries.length }}/{{ entries.length }}</span>
      </div>
    </header>

    <!-- ===== Stats ===== -->
    <div class="ap-stats">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="ap-stat"
        :class="`ap-stat--${stat.tone}`"
        :style="{ animationDelay: `${stat.delay}ms` }"
      >
        <div class="ap-stat__icon">
          <AppIcon :name="stat.icon" />
        </div>
        <div class="ap-stat__body">
          <span class="ap-stat__label">{{ text(stat.label) }}</span>
          <strong class="ap-stat__num">{{ stat.value }}</strong>
        </div>
      </div>
    </div>

    <!-- ===== Cards ===== -->
    <div v-if="filteredEntries.length" class="ap-cards">
      <article
        v-for="(entry, i) in filteredEntries"
        :key="entry.id"
        class="ap-card"
        :class="getCardClasses(entry)"
        :style="{ animationDelay: `${i * 70}ms` }"
      >
        <div class="ap-card__bar" />
        <div class="ap-card__top">
          <div class="ap-card__icon" :class="`ap-card__icon--${entry.status}`">
            <AppIcon :name="getCardIcon(entry)" />
          </div>
          <div class="ap-card__head">
            <div class="ap-card__title">{{ entry.title }}</div>
            <div class="ap-card__sub">{{ entry.subtitle }}</div>
          </div>
          <span class="ap-card__tag" :class="`ap-card__tag--${entry.status}`">
            {{ getEntryStatusLabel(entry.status) }}
          </span>
        </div>

        <p class="ap-card__desc">{{ entry.description }}</p>

        <div class="ap-card__tags">
          <span v-for="tag in entry.tags" :key="tag" class="ap-chip">
            {{ tag }}
          </span>
        </div>

        <div class="ap-card__bot">
          <button
            v-if="entry.status === 'online'"
            class="ap-btn ap-btn--primary"
            type="button"
            @click="openEntry(entry.routePath)"
          >
            <AppIcon name="play-circle" />
            <span>{{ text('进入场景') }}</span>
            <AppIcon name="arrow-right" class="ap-btn__arrow" />
          </button>
          <button
            v-else-if="entry.status === 'soon'"
            class="ap-btn ap-btn--soon"
            type="button"
            disabled
          >
            <AppIcon name="clock" />
            <span>{{ text('即将上线') }}</span>
          </button>
          <button
            v-else
            class="ap-btn ap-btn--offline"
            type="button"
            disabled
          >
            <AppIcon name="package" />
            <span>{{ text('暂不可用') }}</span>
          </button>
          <button
            v-if="entry.status === 'online'"
            class="ap-btn ap-btn--ghost"
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
    <div v-else class="ap-empty">
      <div class="ap-empty__icon">
        <AppIcon name="file-search" />
      </div>
      <h3 class="ap-empty__title">{{ text('没有匹配的入口') }}</h3>
      <p class="ap-empty__desc">{{ text('请调整搜索条件') }}</p>
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
    'ap-card--soon': entry.status === 'soon',
    'ap-card--offline': entry.status === 'offline',
    'ap-card--online': entry.status === 'online',
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
/* ================================================================
   Automation Page Shell — Refined Design
   Palette: teal #0d9488, green #059669, blue #2563eb
   No purple. Clean, elegant, subtle animations.
   ================================================================ */

@keyframes ap-slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ap-scaleIn {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes ap-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes ap-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

/* ----- Shell ----- */
.ap-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 22px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 55% 35% at 50% 0%, rgba(13, 148, 136, 0.04), transparent 55%),
    radial-gradient(ellipse 40% 30% at 80% 90%, rgba(59, 130, 246, 0.03), transparent 50%),
    #f6f9fc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

.ap-shell > * {
  animation: ap-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ap-shell > *:nth-child(1) { animation-delay: 0s; }
.ap-shell > *:nth-child(2) { animation-delay: 0.06s; }
.ap-shell > *:nth-child(3) { animation-delay: 0.12s; }

/* ----- Hero ----- */
.ap-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 18px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.03);
}

.ap-hero__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.ap-hero__icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.ap-hero__icon-wrap:hover {
  transform: scale(1.05) rotate(-3deg);
}

.ap-shell--sap .ap-hero__icon-wrap {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.25);
}

.ap-shell--infornexus .ap-hero__icon-wrap {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.25);
}

.ap-shell:not(.ap-shell--sap):not(.ap-shell--infornexus) .ap-hero__icon-wrap {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.25);
}

.ap-hero__text {
  min-width: 0;
}

.ap-hero__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  line-height: 1.3;
}

.ap-hero__desc {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-hero__tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ap-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.25s ease;
  min-width: 200px;
}

.ap-search__icon {
  font-size: 15px;
  color: #94a3b8;
  flex-shrink: 0;
  transition: color 0.2s;
}

.ap-search input {
  border: none;
  background: transparent;
  outline: none;
  color: #1e293b;
  font-size: 13px;
  width: 100%;
  min-width: 0;
}

.ap-search input::placeholder {
  color: #94a3b8;
}

.ap-search:focus-within {
  border-color: #0d9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.08);
  background: #fff;
}

.ap-search:focus-within .ap-search__icon {
  color: #0d9488;
}

.ap-badge {
  padding: 5px 12px;
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
.ap-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ap-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 12px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  animation: ap-scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  cursor: default;
}

.ap-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.ap-stat__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}

.ap-stat--online .ap-stat__icon {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 3px 8px rgba(5, 150, 105, 0.2);
}

.ap-stat--soon .ap-stat__icon {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  box-shadow: 0 3px 8px rgba(217, 119, 6, 0.2);
}

.ap-stat--offline .ap-stat__icon {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 3px 8px rgba(100, 116, 139, 0.15);
}

.ap-stat__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ap-stat__label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.ap-stat__num {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

/* ----- Card Grid ----- */
.ap-cards {
  display: grid;
  gap: 14px;
}

.ap-shell--sap .ap-cards,
.ap-shell:not(.ap-shell--sap):not(.ap-shell--infornexus) .ap-cards {
  grid-template-columns: repeat(3, 1fr);
}

.ap-shell--infornexus .ap-cards {
  grid-template-columns: repeat(2, 1fr);
}

/* ----- Card ----- */
.ap-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 20px 20px;
  background: #fff;
  border: 1px solid #e8eef3;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  animation: ap-scaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  overflow: hidden;
}

.ap-card__bar {
  height: 3px;
  background: #e2e8f0;
  margin: 0 -20px;
  opacity: 0.5;
}

.ap-card--online .ap-card__bar {
  background: linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf);
  background-size: 200% 100%;
  animation: ap-shimmer 4s linear infinite;
  opacity: 1;
}

.ap-card--soon .ap-card__bar {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  opacity: 0.7;
}

.ap-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.04),
    0 12px 32px rgba(0, 0, 0, 0.03);
  border-color: #b8e6dc;
}

.ap-card--soon:hover {
  border-color: #fde68a;
}

.ap-card--offline:hover {
  border-color: #e2e8f0;
  transform: translateY(-2px);
}

.ap-shell--sap .ap-card--online:hover {
  border-color: #99f6e4;
  box-shadow: 0 6px 20px rgba(13, 148, 136, 0.08);
}

.ap-shell--infornexus .ap-card--online:hover {
  border-color: #93c5fd;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.08);
}

/* Card top row */
.ap-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
}

.ap-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.ap-card:hover .ap-card__icon {
  transform: scale(1.06);
}

.ap-card__icon--online {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  box-shadow: 0 3px 10px rgba(13, 148, 136, 0.2);
}

.ap-card__icon--soon {
  background: linear-gradient(135deg, #fbbf24, #d97706);
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.15);
}

.ap-card__icon--offline {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 3px 10px rgba(100, 116, 139, 0.1);
}

.ap-card__head {
  flex: 1;
  min-width: 0;
}

.ap-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.ap-card__sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-card__tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.2px;
}

.ap-card__tag--online {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.ap-card__tag--soon {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.ap-card__tag--offline {
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

/* Description */
.ap-card__desc {
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
.ap-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ap-chip {
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

.ap-chip:hover {
  background: #e2e8f0;
  transform: translateY(-1px);
}

/* Card bottom actions */
.ap-card__bot {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.ap-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.ap-btn .app-icon {
  font-size: 14px;
}

/* Primary button */
.ap-btn--primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);
}

.ap-btn--primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(13, 148, 136, 0.3);
}

.ap-btn--primary .ap-btn__arrow {
  transition: transform 0.25s ease;
  font-size: 13px;
}

.ap-btn--primary:hover .ap-btn__arrow {
  transform: translateX(3px);
}

/* Soon / offline buttons */
.ap-btn--soon, .ap-btn--offline {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Ghost button */
.ap-btn--ghost {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
}

.ap-btn--ghost:hover:not(:disabled) {
  background: #f0fdfa;
  border-color: #99f6e4;
  color: #0d9488;
}

.ap-shell--infornexus .ap-btn--ghost:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #3b82f6;
}

/* ===== Empty ===== */
.ap-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 20px;
  text-align: center;
  animation: ap-scaleIn 0.4s ease both;
}

.ap-empty__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #94a3b8, #64748b);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  animation: ap-float 2.6s ease-in-out infinite;
  box-shadow: 0 6px 20px rgba(100, 116, 139, 0.2);
}

.ap-empty__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.ap-empty__desc {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
  max-width: 320px;
  line-height: 1.6;
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .ap-shell--sap .ap-cards,
  .ap-shell:not(.ap-shell--sap):not(.ap-shell--infornexus) .ap-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 860px) {
  .ap-shell { padding: 14px; }

  .ap-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .ap-hero__tools { width: 100%; }
  .ap-search { min-width: 0; flex: 1; }

  .ap-shell--sap .ap-cards,
  .ap-shell--infornexus .ap-cards,
  .ap-shell:not(.ap-shell--sap):not(.ap-shell--infornexus) .ap-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .ap-hero__brand { flex-wrap: wrap; }
  .ap-stats { flex-direction: column; }
  .ap-stat { width: 100%; }
}
</style>
