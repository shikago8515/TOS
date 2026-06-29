<template>
  <section class="ru-page">
    <header class="ru-head">
      <div class="ru-head__content">
        <div class="ru-head__mark">
          <AppIcon name="box" />
        </div>
        <div class="ru-head__text">
          <p>System Log</p>
          <h1>{{ text('版本更新记录') }}</h1>
          <span>{{ text('探索我们每一次的演进：功能迭代、页面优化与系统修复。') }}</span>
        </div>
      </div>
      <el-button class="ru-btn ru-btn--primary" :disabled="loading" :loading="loading" @click="loadRecords">
        <AppIcon name="refresh-cw" :class="{ 'ru-spin': loading }" />
        {{ loading ? text('同步中') : text('刷新记录') }}
      </el-button>
    </header>

    <div class="ru-stats">
      <article class="ru-stat ru-stat--blue">
        <div class="ru-stat__icon"><AppIcon name="database" /></div>
        <div class="ru-stat__info">
          <span>{{ text('总计记录数') }}</span>
          <strong>{{ totalRecords }}</strong>
        </div>
      </article>
      <article class="ru-stat ru-stat--teal">
        <div class="ru-stat__icon"><AppIcon name="layout" /></div>
        <div class="ru-stat__info">
          <span>{{ text('涉及页面') }}</span>
          <strong>{{ affectedPageCount }}</strong>
        </div>
      </article>
      <article class="ru-stat ru-stat--emerald">
        <div class="ru-stat__icon"><AppIcon name="flag" /></div>
        <div class="ru-stat__info">
          <span>{{ text('最新版本') }}</span>
          <strong>{{ latestVersionLabel }}</strong>
        </div>
      </article>
    </div>

    <div class="ru-toolbar">
      <el-button
        v-for="filter in filters"
        :key="filter.value"
        class="ru-filter"
        :class="{ 'is-active': activeFilter === filter.value }"
        @click="activeFilter = filter.value"
      >
        <AppIcon :name="filter.icon" />
        <span>{{ text(filter.label) }}</span>
        <em v-if="filterCount(filter.value) > 0">{{ filterCount(filter.value) }}</em>
      </el-button>
    </div>

    <div v-if="usingBundledFallback" class="ru-source-note">
      <AppIcon name="alert-triangle" />
      <span>{{ text('后端未连接，当前显示本地版本说明。') }}</span>
    </div>

    <transition name="fade-slide">
      <div v-if="errorMessage" class="ru-alert">
        <div class="ru-alert__content">
          <AppIcon name="alert-triangle" />
          <span>{{ text(errorMessage) }}</span>
        </div>
        <el-button class="ru-btn ru-btn--danger" @click="loadRecords">{{ text('重新尝试') }}</el-button>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="loading && records.length === 0" class="ru-loading">
        <div class="ru-loader-ring"></div>
        <span>{{ text('正在获取最新的版本动态...') }}</span>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="!loading && filteredRecords.length === 0 && !errorMessage" class="ru-empty">
        <div class="ru-empty__icon">
          <AppIcon name="inbox" />
        </div>
        <strong>{{ text('暂无相关记录') }}</strong>
        <span>{{ text('当前筛选条件下没有找到版本更新日志。') }}</span>
      </div>
    </transition>

    <div v-if="filteredRecords.length > 0" class="ru-timeline">
      <article
        v-for="record in filteredRecords"
        :key="record.id || record.recordKey"
        class="ru-record"
        :class="`ru-record--${normalizeCategory(record.category)}`"
      >
        <div class="ru-record__rail">
          <div class="ru-record__line"></div>
          <div class="ru-record__dot">
            <AppIcon :name="categoryIcon(record.category)" />
          </div>
        </div>

        <div class="ru-record__body">
          <div class="ru-record__header">
            <h2 class="ru-record__title">{{ text(record.title) }}</h2>
            <div class="ru-record__meta">
              <span class="ru-badge" :class="`ru-badge--${normalizeCategory(record.category)}`">
                {{ text(categoryLabel(record.category)) }}
              </span>
              <span class="ru-version">V{{ cleanVersion(record.version) }}</span>
              <span class="ru-date">{{ formatDate(record.releaseDate) }}</span>
            </div>
          </div>

          <p class="ru-record__desc">
            {{ record.description ? text(record.description) : text('本次更新带来了一些性能提升与细节优化。') }}
          </p>

          <footer class="ru-record__foot">
            <span class="ru-page-chip">
              <AppIcon name="monitor" />
              {{ record.pageName ? text(record.pageName) : text('全局通用') }}
            </span>
            <code v-if="record.pagePath" class="ru-path">{{ record.pagePath }}</code>
          </footer>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import { readErrorMessage } from '../../shared/api/backendClient'
import { fetchReleaseUpdates, readCachedReleaseUpdates, type ReleaseUpdateRecord } from './releaseUpdatesApi'

type FilterValue = 'all' | 'added' | 'improved' | 'fixed'

const { text } = useAppLanguage()
const initialReleaseUpdates = readCachedReleaseUpdates(160)
const records = ref<ReleaseUpdateRecord[]>(initialReleaseUpdates.records)
const totalRecords = ref(initialReleaseUpdates.total)
const runtimeVersion = ref(initialReleaseUpdates.version)
const loading = ref(false)
const errorMessage = ref('')
const usingBundledFallback = ref(false)
const activeFilter = ref<FilterValue>('all')

const filters: Array<{ value: FilterValue; label: string; icon: string }> = [
  { value: 'all', label: '全部', icon: 'layers' },
  { value: 'added', label: '新增', icon: 'sparkles' },
  { value: 'improved', label: '优化', icon: 'activity' },
  { value: 'fixed', label: '修复', icon: 'tool' }, // 修改为 tool，更符合修复语义
]

const filteredRecords = computed(() => {
  if (activeFilter.value === 'all') {
    return records.value
  }
  return records.value.filter((record) => normalizeCategory(record.category) === activeFilter.value)
})

const affectedPageCount = computed(() => {
  const pages = new Set(records.value.map((record) => record.pagePath || record.pageName).filter(Boolean))
  return pages.size
})

const latestVersionLabel = computed(() => {
  const version = records.value[0]?.version || runtimeVersion.value
  return version ? `V${cleanVersion(version)}` : '-'
})

onMounted(() => {
  void loadRecords()
})

async function loadRecords(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await fetchReleaseUpdates(160)
    runtimeVersion.value = payload.version
    records.value = payload.records
    totalRecords.value = payload.total
    usingBundledFallback.value = payload.source === 'bundled'
  } catch (error) {
    usingBundledFallback.value = false
    errorMessage.value = readErrorMessage(error, text('获取版本记录失败，请检查网络后重试。'))
  } finally {
    loading.value = false
  }
}

function filterCount(value: FilterValue): number {
  if (value === 'all') return records.value.length
  return records.value.filter((record) => normalizeCategory(record.category) === value).length
}

function normalizeCategory(category: string): FilterValue {
  const cat = category?.toLowerCase()
  if (cat === 'added' || cat === 'fixed' || cat === 'improved') return cat
  return 'improved'
}

function categoryLabel(category: string): string {
  const normalized = normalizeCategory(category)
  if (normalized === 'added') return '新功能'
  if (normalized === 'fixed') return '问题修复'
  return '体验优化'
}

function categoryIcon(category: string): string {
  const normalized = normalizeCategory(category)
  if (normalized === 'added') return 'sparkles'
  if (normalized === 'fixed') return 'tool'
  return 'activity'
}

function cleanVersion(version: string): string {
  return String(version || '').trim().replace(/^v/i, '')
}

function formatDate(value: string): string {
  if (!value) return '-'
  // 可按需加入日期格式化逻辑，目前保持原样
  return value
}
</script>

<style scoped>
/* * 核心设计变量 (Design Tokens)
 * 彻底移除紫色。采用青色/翠绿/天蓝的极简清新配色
 */
.ru-page {
  --ru-primary: #0d9488;       /* TOS 系统青绿色 */
  --ru-primary-dark: #0f766e;
  --ru-primary-light: #ecfeff;
  
  --ru-added: #10b981;         /* 翠绿 - 新增 */
  --ru-added-light: #d1fae5;
  --ru-improved: #0ea5e9;      /* 天蓝 - 优化 */
  --ru-improved-light: #e0f2fe;
  --ru-fixed: #f59e0b;         /* 琥珀 - 修复 */
  --ru-fixed-light: #fef3c7;
  
  --ru-text-main: #0f172a;     /* 深蓝灰 - 主文本 */
  --ru-text-muted: #64748b;    /* 蓝灰 - 弱文本 */
  --ru-border: #e2e8f0;        /* 柔和边框 */
  --ru-surface: #ffffff;
  --ru-bg: #f8fafc;
  --ru-danger: #ef4444;

  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 4px;
  color: var(--ru-text-main);
  font-family: "Inter", "Helvetica Neue", "PingFang SC", sans-serif;
  background: var(--ru-bg);
}

/* 头部设计 - 弥散阴影与微弱渐变 */
.ru-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  background: linear-gradient(145deg, #ffffff 0%, #f0f9ff 100%);
  border: 1px solid var(--ru-border);
  border-radius: 12px;
  box-shadow: 0 3px 14px rgba(14, 165, 233, 0.04);
}

.ru-head__content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ru-head__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: var(--ru-primary);
  color: #fff;
  border-radius: 11px;
  font-size: 20px;
  box-shadow: 0 5px 12px rgba(14, 165, 233, 0.16);
}

.ru-head__text p {
  margin: 0 0 2px;
  color: var(--ru-primary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
}

.ru-head__text h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--ru-text-main);
  letter-spacing: 0;
}

.ru-head__text span {
  display: block;
  margin-top: 3px;
  color: var(--ru-text-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

/* 按钮通用系统 */
.ru-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.ru-btn :deep(.el-button__content) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ru-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.ru-btn--primary {
  background: var(--ru-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
}

.ru-btn--primary:hover:not(:disabled) {
  background: var(--ru-primary-dark);
  transform: none;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
}

.ru-btn--danger {
  background: #fee2e2;
  color: var(--ru-danger);
}

.ru-btn--danger:hover {
  background: #fecaca;
}

/* 统计卡片：高质感悬浮 */
.ru-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}

.ru-stat {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 62px;
  padding: 11px 13px;
  background: var(--ru-surface);
  border: 1px solid var(--ru-border);
  border-radius: 12px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.ru-stat:hover {
  border-color: #99f6e4;
  box-shadow: 0 4px 12px rgba(13, 148, 136, 0.06);
}

.ru-stat__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  font-size: 17px;
}

.ru-stat--blue .ru-stat__icon { background: #dbeafe; color: #2563eb; }
.ru-stat--teal .ru-stat__icon { background: var(--ru-primary-light); color: var(--ru-primary); }
.ru-stat--emerald .ru-stat__icon { background: var(--ru-added-light); color: var(--ru-added); }

.ru-stat__info span {
  display: block;
  color: var(--ru-text-muted);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 2px;
}

.ru-stat__info strong {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: var(--ru-text-main);
  line-height: 1;
}

/* 过滤器：现代化胶囊样式 */
.ru-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
  background: var(--ru-surface);
  border: 1px solid var(--ru-border);
  border-radius: 12px;
}

.ru-filter {
  flex: 0 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 82px;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ru-text-muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ru-filter :deep(.el-button__content) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ru-filter:hover {
  color: var(--ru-primary);
  background: var(--ru-bg);
}

.ru-filter.is-active {
  background: var(--ru-primary);
  color: #fff;
  box-shadow: none;
}

.ru-filter em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  background: rgba(0,0,0,0.06);
  border-radius: 10px;
  font-size: 11px;
  font-style: normal;
}

.ru-filter.is-active em {
  background: rgba(255,255,255,0.2);
}

.ru-source-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  min-height: 34px;
  padding: 0 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 10px;
  color: #9a3412;
  font-size: 12.5px;
  font-weight: 600;
}

/* 反馈状态区：骨架与加载 */
.ru-alert, .ru-loading, .ru-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(320px, calc(100vh - 360px), 560px);
  background: var(--ru-surface);
  border: 1px dashed var(--ru-border);
  border-radius: 16px;
  color: var(--ru-text-muted);
}

.ru-alert {
  flex-direction: column;
  gap: 16px;
  border: 1px solid #fca5a5;
  background: #fef2f2;
}

.ru-alert__content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ru-danger);
  font-size: 15px;
  font-weight: 600;
}

.ru-loading {
  flex-direction: column;
  gap: 16px;
}

.ru-loader-ring {
  width: 36px;
  height: 36px;
  border: 3px solid var(--ru-primary-light);
  border-top-color: var(--ru-primary);
  border-radius: 50%;
  animation: ru-spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.ru-empty {
  flex-direction: column;
  gap: 8px;
}

.ru-empty__icon {
  font-size: 48px;
  color: #cbd5e1;
  margin-bottom: 8px;
  animation: none;
}

.ru-empty strong {
  font-size: 16px;
  color: var(--ru-text-main);
}

/* 时间轴列表 (核心优化区) */
.ru-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  height: clamp(320px, calc(100vh - 360px), 560px);
  background: var(--ru-surface);
  border: 1px solid var(--ru-border);
  border-radius: 12px;
  padding: 8px 18px;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: none;
  scrollbar-gutter: stable;
}

.ru-record {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 20px;
  position: relative;
  opacity: 1;
  animation: none;
}

/* 轨道线系统 */
.ru-record__rail {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 18px;
}

.ru-record__line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: #e2e8f0;
  transform: translateX(-50%);
}

/* 隐藏第一项的上半根线和最后一项的下半根线 */
.ru-record:first-child .ru-record__line { top: 18px; }
.ru-record:last-child .ru-record__line { bottom: auto; height: 100%; }

.ru-record__dot {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ru-surface);
  border: 2px solid transparent;
  font-size: 14px;
}

/* 根据类型染色轨道节点 */
.ru-record--added .ru-record__dot {
  border-color: var(--ru-added);
  color: var(--ru-added);
  box-shadow: 0 0 0 4px var(--ru-added-light);
}
.ru-record--improved .ru-record__dot {
  border-color: var(--ru-improved);
  color: var(--ru-improved);
  box-shadow: 0 0 0 4px var(--ru-improved-light);
}
.ru-record--fixed .ru-record__dot {
  border-color: var(--ru-fixed);
  color: var(--ru-fixed);
  box-shadow: 0 0 0 4px var(--ru-fixed-light);
}

.ru-record__body {
  padding: 13px 0;
  border-bottom: 1px dashed var(--ru-border);
}
.ru-record:last-child .ru-record__body {
  border-bottom: none;
}

.ru-record__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.ru-record__title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ru-text-main);
}

.ru-record__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ru-badge {
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}
.ru-badge--added { background: var(--ru-added-light); color: #065f46; }
.ru-badge--improved { background: var(--ru-improved-light); color: #075985; }
.ru-badge--fixed { background: var(--ru-fixed-light); color: #92400e; }

.ru-version, .ru-date {
  color: var(--ru-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.ru-record__desc {
  margin: 0 0 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.ru-record__foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.ru-page-chip, .ru-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background: var(--ru-bg);
  border: 1px solid var(--ru-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ru-text-muted);
}

.ru-page-chip {
  font-weight: 600;
  color: var(--ru-text-main);
  flex: 0 0 auto;
}
.ru-page-chip .app-icon {
  color: var(--ru-primary);
}

.ru-path {
  font-family: monospace;
  flex: 1 1 220px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Vue 动画辅助类 (Transitions & Keyframes) */
.ru-spin {
  animation: ru-spin 1s linear infinite;
}

@keyframes ru-spin {
  to { transform: rotate(360deg); }
}

/* 显隐过渡 */
.fade-enter-active, .fade-leave-active,
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-slide-enter-from, .fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 响应式适配 */
@media (max-width: 768px) {
  .ru-head {
    flex-direction: column;
    align-items: stretch;
    padding: 14px;
  }
  .ru-head__content {
    flex-direction: column;
    align-items: flex-start;
  }
  .ru-toolbar {
    flex-direction: column;
  }
  .ru-filter {
    justify-content: flex-start;
    padding-left: 20px;
  }
  .ru-record {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .ru-record__rail {
    display: none; /* 移动端隐藏左侧时间轴线，仅保留卡片形态 */
  }
  .ru-record__body {
    padding: 16px 0;
  }
  .ru-timeline {
    height: clamp(300px, calc(100vh - 320px), 560px);
    padding: 8px 12px;
  }
}
</style>
