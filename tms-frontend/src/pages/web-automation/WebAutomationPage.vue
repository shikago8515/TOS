<template>
  <section class="wa-page">
    <!-- Compact Hero -->
    <div class="wa-hero">
      <div class="wa-hero__left">
        <div class="wa-hero__icon">
          <AppIcon name="bot" />
        </div>
        <div class="wa-hero__text">
          <h2>{{ text('网页自动化') }}</h2>
          <p>{{ text('选择自动化入口，上传 Excel 并启动本地浏览器执行') }}</p>
        </div>
      </div>
      <div class="wa-hero__right">
        <div class="wa-search">
          <AppIcon name="file-search" />
          <input
            v-model.trim="searchQuery"
            type="text"
            :placeholder="text('搜索入口名称或标签')"
          />
        </div>
        <span class="wa-hero__count">{{ filteredEntries.length }} / {{ entries.length }}</span>
      </div>
    </div>

    <!-- Compact Stats -->
    <div class="wa-stats">
      <div class="wa-stat-chip">
        <span class="wa-stat-chip__dot wa-stat-chip__dot--green" />
        <span class="wa-stat-chip__label">{{ text('可用') }}</span>
        <strong>{{ onlineCount }}</strong>
      </div>
      <div class="wa-stat-chip">
        <span class="wa-stat-chip__dot wa-stat-chip__dot--amber" />
        <span class="wa-stat-chip__label">{{ text('即将上线') }}</span>
        <strong>{{ soonCount }}</strong>
      </div>
      <div class="wa-stat-chip">
        <span class="wa-stat-chip__dot wa-stat-chip__dot--slate" />
        <span class="wa-stat-chip__label">{{ text('暂不可用') }}</span>
        <strong>{{ offlineCount }}</strong>
      </div>
    </div>

    <!-- Entry Card Grid -->
    <div v-if="filteredEntries.length" class="wa-grid">
      <article
        v-for="(entry, i) in filteredEntries"
        :key="entry.id"
        class="wa-card"
        :class="{ 'wa-card--soon': entry.status === 'soon', 'wa-card--offline': entry.status === 'offline' }"
        :style="{ animationDelay: `${i * 50}ms` }"
      >
        <div class="wa-card__head">
          <div class="wa-card__icon">
            <AppIcon :name="entry.status === 'online' ? 'window' : entry.status === 'soon' ? 'clock' : 'package'" />
          </div>
          <div class="wa-card__info">
            <strong>{{ text(entry.title) }}</strong>
            <span>{{ text(entry.subtitle) }}</span>
          </div>
          <span class="wa-card__status" :class="`wa-tag--${getEntryStatusTone(entry.status)}`">
            {{ text(getEntryStatusLabel(entry.status)) }}
          </span>
        </div>

        <p class="wa-card__desc">{{ text(entry.description) }}</p>

        <div class="wa-card__tags">
          <span v-for="tag in entry.tags" :key="tag" class="wa-chip">{{ text(tag) }}</span>
        </div>

        <div class="wa-card__actions">
          <button
            v-if="entry.status === 'online'"
            class="wa-btn wa-btn--primary"
            type="button"
            @click="openEntry(entry.routePath)"
          >
            <AppIcon name="play-circle" />
            {{ text('进入场景') }}
          </button>
          <button
            v-else-if="entry.status === 'soon'"
            class="wa-btn"
            type="button"
            disabled
          >
            <AppIcon name="clock" />
            {{ text('即将上线') }}
          </button>
          <button
            v-else
            class="wa-btn"
            type="button"
            disabled
          >
            <AppIcon name="package" />
            {{ text('暂不可用') }}
          </button>
          <button
            v-if="entry.status === 'online'"
            class="wa-btn"
            type="button"
            @click="openEntry(entry.routePath)"
          >
            <AppIcon name="arrow-right" />
            {{ text('详情') }}
          </button>
        </div>
      </article>
    </div>

    <!-- Empty -->
    <div v-else class="wa-empty">
      <div class="wa-empty__icon">
        <AppIcon name="bot" />
      </div>
      <strong>{{ text('没有匹配的自动化入口') }}</strong>
      <span>{{ text('请调整搜索条件，或联系管理员添加新的自动化场景。') }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '../../shared/ui/AppIcon.vue'
import {
  webAutomationEntries,
  getEntryStatusLabel,
  getEntryStatusTone,
} from './webAutomationModel'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const router = useRouter()
const { text } = useAppLanguage()

const entries = webAutomationEntries
const searchQuery = ref('')

const filteredEntries = computed(() => {
  const kw = searchQuery.value.toLowerCase().trim()
  if (!kw) return [...entries]
  return entries.filter(
    (e) =>
      e.title.toLowerCase().includes(kw) ||
      e.subtitle.toLowerCase().includes(kw) ||
      e.description.toLowerCase().includes(kw) ||
      e.tags.some((t) => t.toLowerCase().includes(kw)),
  )
})

const onlineCount = computed(() => entries.filter((e) => e.status === 'online').length)
const soonCount = computed(() => entries.filter((e) => e.status === 'soon').length)
const offlineCount = computed(() => entries.filter((e) => e.status === 'offline').length)

function openEntry(path: string): void {
  void router.push(path)
}
</script>

<style scoped lang="scss">
/* ===== Page ===== */
.wa-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 60% 40% at 50% 0%, rgba(20, 184, 166, 0.04), transparent 50%),
    #f8fafc;
}

/* ===== Hero ===== */
.wa-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  animation: wa-slideUp 0.4s ease-out both;
}

.wa-hero__left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.wa-hero__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.2);
}

.wa-hero__text {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
  }
  p {
    margin: 2px 0 0;
    font-size: 13px;
    color: #64748b;
  }
}

.wa-hero__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wa-hero__count {
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  white-space: nowrap;
}

.wa-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.2s ease;
  min-width: 220px;

  :deep(.app-icon) {
    font-size: 16px;
    color: #94a3b8;
    flex-shrink: 0;
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    color: #1e293b;
    font-size: 13px;
    width: 100%;
    &::placeholder {
      color: #94a3b8;
    }
  }

  &:focus-within {
    border-color: #0d9488;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.08);
    background: #fff;
  }
}

/* ===== Stats Chips ===== */
.wa-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  animation: wa-slideUp 0.4s ease-out 0.06s both;
}

.wa-stat-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;

  :deep(.app-icon) {
    font-size: 14px;
    color: #94a3b8;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    &--green {
      background: #059669;
    }
    &--amber {
      background: #d97706;
    }
    &--slate {
      background: #94a3b8;
    }
  }

  &__label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
  }
  strong {
    font-size: 15px;
    color: #0f172a;
    font-weight: 700;
  }
}

/* ===== Card Grid ===== */
.wa-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.wa-card {
  padding: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.25s ease;
  animation: wa-fadeScale 0.4s ease-out both;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
    border-color: #99f6e4;
  }

  &--soon {
    opacity: 0.85;
  }

  &--offline {
    opacity: 0.6;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;

    .wa-card--soon & {
      background: linear-gradient(135deg, #fbbf24, #d97706);
    }
    .wa-card--offline & {
      background: linear-gradient(135deg, #94a3b8, #64748b);
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    strong {
      display: block;
      font-size: 15px;
      color: #0f172a;
      font-weight: 700;
    }
    span {
      font-size: 12px;
      color: #94a3b8;
    }
  }

  &__status {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__desc {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
  }
}

/* ===== Chips ===== */
.wa-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #e2e8f0;
}

/* ===== Tags ===== */
.wa-tag--success {
  background: #ecfdf5;
  color: #059669;
}
.wa-tag--warning {
  background: #fff7ed;
  color: #d97706;
}
.wa-tag--danger {
  background: #fef2f2;
  color: #dc2626;
}

/* ===== Buttons ===== */
.wa-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  :deep(.app-icon) {
    font-size: 14px;
  }

  &:hover:not(:disabled) {
    background: #f0fdfa;
    border-color: #99f6e4;
    color: #0d9488;
  }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--primary {
    background: linear-gradient(135deg, #0d9488, #0f766e);
    color: #fff;
    border-color: #0f766e;
    box-shadow: 0 1px 4px rgba(13, 148, 136, 0.2);
    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #0f766e, #0d9488);
      color: #fff;
    }
  }
}

/* ===== Empty ===== */
.wa-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  text-align: center;
  animation: wa-fadeScale 0.4s ease-out both;

  &__icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }

  strong {
    color: #0f172a;
    font-size: 15px;
  }
  span {
    color: #64748b;
    font-size: 13px;
    max-width: 400px;
    line-height: 1.6;
  }
}

/* ===== Keyframes ===== */
@keyframes wa-slideUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes wa-fadeScale {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .wa-hero {
    flex-direction: column;
    align-items: stretch;
  }
  .wa-hero__right {
    flex-direction: column;
    align-items: stretch;
  }
  .wa-search {
    min-width: auto;
    width: 100%;
  }
  .wa-hero__count {
    text-align: right;
  }
  .wa-grid {
    grid-template-columns: 1fr;
  }
}
</style>
