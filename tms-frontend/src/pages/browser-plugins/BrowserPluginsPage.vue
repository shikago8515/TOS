<template>
  <section class="plugins-page">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-left">
        <div class="hero-icon-wrap">
          <AppIcon name="plug" />
        </div>
        <div class="hero-text">
          <h2>{{ text('浏览器插件管理') }}</h2>
          <p>{{ bridgeModeLabel }}</p>
        </div>
      </div>
      <div class="hero-right">
        <div class="search-box">
          <AppIcon name="file-search" />
          <input
            v-model.trim="searchQuery"
            type="text"
            :placeholder="text('搜索插件或站点')"
          />
        </div>
        <button class="hero-btn" type="button" :disabled="loading" @click="refreshPlugins">
          <AppIcon name="refresh-cw" />
          {{ loading ? text('刷新中...') : text('刷新') }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-chip">
        <span class="stat-chip__dot stat-chip__dot--blue" />
        <span class="stat-chip__label">{{ text('插件总数') }}</span>
        <strong>{{ plugins.length }}</strong>
      </div>
      <div class="stat-chip">
        <span class="stat-chip__dot stat-chip__dot--green" />
        <span class="stat-chip__label">{{ text('可启动') }}</span>
        <strong>{{ launchReadyCount }}</strong>
      </div>
      <div class="stat-chip">
        <span class="stat-chip__dot stat-chip__dot--orange" />
        <span class="stat-chip__label">{{ text('预览模式') }}</span>
        <strong>{{ previewCount }}</strong>
      </div>
    </div>

    <!-- Alert -->
    <transition name="msg">
      <div v-if="message" class="alert" :class="`alert--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'activity'" />
        <span>{{ message }}</span>
      </div>
    </transition>

    <!-- Plugin Cards -->
    <div v-if="filteredPlugins.length" class="plugin-grid">
      <article
        v-for="(plugin, i) in filteredPlugins"
        :key="plugin.id"
        class="plugin-card"
        :style="{ animationDelay: `${i * 60}ms` }"
      >
        <div class="plugin-card__head">
          <div class="plugin-card__icon">
            <AppIcon name="browser" />
          </div>
          <div class="plugin-card__info">
            <strong>{{ plugin.name }}</strong>
            <span>{{ plugin.provider || text('业务网页') }} · {{ plugin.category || '-' }}</span>
          </div>
          <span class="plugin-card__status" :class="`tag--${getBrowserPluginStatusTone(plugin)}`">
            {{ getBrowserPluginStatusLabel(plugin) }}
          </span>
        </div>

        <p v-if="plugin.description" class="plugin-card__desc">{{ plugin.description }}</p>

        <div class="plugin-card__meta">
          <div class="meta-item">
            <AppIcon name="link" />
            <span>{{ getPrimaryPatternHost(plugin) }}</span>
          </div>
          <div class="meta-item">
            <AppIcon :name="plugin.previewOnly ? 'alert-circle' : 'shield-check'" />
            <span>{{ plugin.previewOnly ? text('预览配置') : text('真实执行') }}</span>
          </div>
        </div>

        <div class="plugin-card__actions">
          <button
            class="card-btn card-btn--primary"
            type="button"
            :disabled="plugin.previewOnly || !plugin.available || !plugin.browserAvailable || launchingId === plugin.id"
            @click="startPlugin(plugin.id)"
          >
            <AppIcon name="play-circle" />
            {{ launchingId === plugin.id ? text('启动中') : text('启动') }}
          </button>
          <button
            class="card-btn"
            type="button"
            :disabled="!plugin.targetUrl"
            @click="openTarget(plugin.targetUrl)"
          >
            <AppIcon name="external-link" />
            {{ text('站点') }}
          </button>
        </div>
      </article>
    </div>

    <!-- Empty -->
    <div v-else class="empty">
      <div class="empty__icon">
        <AppIcon name="plug" />
      </div>
      <strong>{{ text('暂无浏览器插件') }}</strong>
      <span>{{ text('请确认桌面端插件注册结果，或切换到具备浏览器桥接能力的环境。') }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import type { BrowserPluginInfo } from '../../types/electronApi'
import {
  getBrowserPluginStatusLabel,
  getBrowserPluginStatusTone,
  type BrowserPluginNoticeTone,
} from './browserPluginsModel'
import {
  fetchBrowserPlugins,
  hasBrowserPluginBridge,
  launchBrowserPlugin,
  openBrowserPluginTarget,
  recordBrowserPluginEvent,
} from './browserPluginsApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const plugins = ref<BrowserPluginInfo[]>([])
const loading = ref(false)
const launchingId = ref('')
const message = ref('')
const messageTone = ref<BrowserPluginNoticeTone>('info')
const searchQuery = ref('')
const { text } = useAppLanguage()

const bridgeAvailable = computed(() => hasBrowserPluginBridge())
const launchReadyCount = computed(
  () => plugins.value.filter((p) => p.available && p.browserAvailable && !p.previewOnly).length,
)
const previewCount = computed(() => plugins.value.filter((p) => p.previewOnly).length)
const filteredPlugins = computed(() => {
  const kw = searchQuery.value.toLowerCase()
  if (!kw) return plugins.value
  return plugins.value.filter((p) =>
    [p.name, p.provider, p.description, p.targetUrl, ...p.matchPatterns]
      .filter(Boolean).join(' ').toLowerCase().includes(kw),
  )
})
const bridgeModeLabel = computed(() =>
  bridgeAvailable.value ? text('桌面 Electron 环境') : text('浏览器预览模式'),
)

onMounted(() => { void refreshPlugins() })

async function refreshPlugins(): Promise<void> {
  loading.value = true
  message.value = ''
  try {
    plugins.value = await fetchBrowserPlugins()
    if (!bridgeAvailable.value) {
      messageTone.value = 'warning'
      message.value = text('当前为预览模式：可查看插件信息，启动需在桌面 Electron 环境中使用。')
    } else if (!plugins.value.length) {
      messageTone.value = 'warning'
      message.value = text('未读取到插件注册表，请检查桌面端插件清单。')
    }
  } catch (e) {
    messageTone.value = 'error'
    message.value = readErrorMessage(e, '读取浏览器插件失败')
  } finally { loading.value = false }
}

function getPrimaryPatternHost(plugin: BrowserPluginInfo): string {
  const c = plugin.targetUrl || plugin.matchPatterns[0]
  if (!c) return '-'
  try { return new URL(c.endsWith('/*') ? c.slice(0, -2) : c).host } catch { return c }
}

async function startPlugin(pluginId: string): Promise<void> {
  launchingId.value = pluginId
  message.value = ''
  try {
    const result = await launchBrowserPlugin(pluginId)
    if (result.success) {
      messageTone.value = 'success'
      message.value = `${result.browser || text('浏览器')} ${text('已启动，插件已加载到目标环境。')}`
    } else {
      messageTone.value = 'error'
      message.value = result.error || text('启动浏览器插件失败')
    }
  } catch (e) {
    const err = readErrorMessage(e, text('启动浏览器插件失败'))
    await recordBrowserPluginEvent('launch-exception', { pluginId, error: err })
    messageTone.value = 'error'
    message.value = err
  } finally {
    launchingId.value = ''
  }
}

async function openTarget(url?: string): Promise<void> {
  if (!url) return
  try {
    const result = await openBrowserPluginTarget(url)
    if (!result.success) {
      messageTone.value = 'error'
      message.value = result.error || text('打开目标站点失败')
    }
  } catch (e) {
    messageTone.value = 'error'
    message.value = readErrorMessage(e, text('打开目标站点失败'))
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
</script>

<style scoped lang="scss">
.plugins-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  min-height: 100%;
  background: #f8fafc;
}

/* Hero */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  animation: slideUp 0.4s ease-out both;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon-wrap {
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
  box-shadow: 0 4px 12px rgba(13,148,136,0.2);
}

.hero-text {
  h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
  p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
}

.hero-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-box {
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

  :deep(.app-icon) { font-size: 16px; color: #94a3b8; flex-shrink: 0; }

  input {
    border: none;
    background: transparent;
    outline: none;
    color: #1e293b;
    font-size: 13px;
    width: 100%;
    &::placeholder { color: #94a3b8; }
  }

  &:focus-within {
    border-color: #0d9488;
    box-shadow: 0 0 0 3px rgba(13,148,136,0.08);
    background: #fff;
  }
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #fff;
  border: 1px solid #0f766e;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(13,148,136,0.2);
  transition: all 0.2s ease;
  :deep(.app-icon) { font-size: 15px; }
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(13,148,136,0.3); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

/* Stats */
.stats-row {
  display: flex;
  gap: 10px;
  animation: slideUp 0.4s ease-out 0.06s both;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;

  &__dot {
    width: 8px; height: 8px; border-radius: 50%;
    &--blue { background: #3b82f6; }
    &--green { background: #059669; }
    &--orange { background: #ea580c; }
  }

  &__label { font-size: 13px; color: #64748b; font-weight: 500; }
  strong { font-size: 15px; color: #0f172a; font-weight: 700; }
}

/* Alert */
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  :deep(.app-icon) { font-size: 18px; flex-shrink: 0; }
  &--info { background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; }
  &--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  &--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  &--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
}

.msg-enter-active { transition: all 0.3s ease; }
.msg-leave-active { transition: all 0.2s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }

/* Plugin Grid */
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.plugin-card {
  padding: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.25s ease;
  animation: fadeScale 0.4s ease-out both;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.06);
    border-color: #99f6e4;
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
  }

  &__info {
    flex: 1;
    min-width: 0;
    strong { display: block; font-size: 15px; color: #0f172a; font-weight: 700; }
    span { font-size: 12px; color: #94a3b8; }
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
  }

  &__meta {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;

    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #64748b;
      :deep(.app-icon) { font-size: 13px; color: #94a3b8; }
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
  }
}

/* Tags */
.tag--success { background: #ecfdf5; color: #059669; }
.tag--warning { background: #fff7ed; color: #ea580c; }
.tag--danger { background: #fef2f2; color: #dc2626; }

/* Buttons */
.card-btn {
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
  :deep(.app-icon) { font-size: 14px; }

  &:hover:not(:disabled) {
    background: #f0fdfa;
    border-color: #99f6e4;
    color: #0d9488;
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }

  &--primary {
    background: linear-gradient(135deg, #0d9488, #0f766e);
    color: #fff;
    border-color: #0f766e;
    box-shadow: 0 1px 4px rgba(13,148,136,0.2);
    &:hover:not(:disabled) { background: linear-gradient(135deg, #0f766e, #0d9488); color: #fff; }
  }
}

/* Empty */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 20px;
  text-align: center;
  animation: fadeScale 0.4s ease-out both;

  &__icon {
    width: 56px; height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }

  strong { color: #0f172a; font-size: 15px; }
  span { color: #64748b; font-size: 13px; max-width: 400px; line-height: 1.6; }
}

/* Animations */
@keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

@media (max-width: 900px) {
  .hero { flex-direction: column; align-items: stretch; }
  .hero-right { flex-direction: column; }
  .search-box { min-width: auto; width: 100%; }
  .stats-row { flex-wrap: wrap; }
  .plugin-grid { grid-template-columns: 1fr; }
}
</style>
