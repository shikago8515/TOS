<template>
  <section class="ifx-page">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-left">
        <div class="hero-icon-wrap">
          <AppIcon name="external-link" />
        </div>
        <div class="hero-text">
          <h2>Infornexus</h2>
          <p>{{ text('外部 Electron 子应用') }}</p>
        </div>
      </div>
      <div class="hero-right">
        <span class="status-pill" :class="`status-pill--${statusTone}`">
          <span class="status-dot" />
          {{ localizedStatusLabel }}
        </span>
        <button class="hero-btn" type="button" :disabled="loading" @click="refreshModule">
          <AppIcon name="refresh-cw" />
          {{ loading ? text('刷新中...') : text('刷新状态') }}
        </button>
        <button class="hero-btn hero-btn--primary" type="button" :disabled="!canLaunch || launching" @click="launchModule">
          <AppIcon name="rocket" />
          {{ launching ? text('启动中...') : text('启动应用') }}
        </button>
      </div>
    </div>

    <!-- Alert -->
    <transition name="msg">
      <div v-if="message" class="alert" :class="`alert--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'activity'" />
        <span>{{ message }}</span>
      </div>
    </transition>

    <!-- Info Grid -->
    <div class="info-grid">
      <div class="info-card" v-for="item in infoCards" :key="item.key">
        <div class="info-card__icon" :class="`info-card__icon--${item.tone}`">
          <AppIcon :name="item.icon" />
        </div>
        <div class="info-card__body">
          <span class="info-card__label">{{ item.label }}</span>
          <strong class="info-card__value">{{ item.value }}</strong>
        </div>
      </div>
    </div>

    <!-- Module Detail -->
    <div class="detail-section">
      <div class="detail-head">
        <AppIcon name="package" />
        <span>{{ text('模块详情') }}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-card__head">
            <AppIcon name="chip" />
            <strong>{{ text('基本信息') }}</strong>
          </div>
          <dl class="detail-list">
            <div class="detail-item">
              <dt>{{ text('模块 ID') }}</dt>
              <dd>{{ moduleInfo?.id || 'infornexus' }}</dd>
            </div>
            <div class="detail-item">
              <dt>{{ text('模块名称') }}</dt>
              <dd>{{ moduleInfo?.name || 'Infornexus' }}</dd>
            </div>
            <div class="detail-item">
              <dt>{{ text('接入方式') }}</dt>
              <dd>{{ text('外部 Electron 子应用') }}</dd>
            </div>
          </dl>
        </div>

        <div class="detail-card">
          <div class="detail-card__head">
            <AppIcon name="folder" />
            <strong>{{ text('部署信息') }}</strong>
          </div>
          <dl class="detail-list">
            <div class="detail-item">
              <dt>{{ text('入口文件') }}</dt>
              <dd class="mono">{{ entryPath }}</dd>
            </div>
            <div class="detail-item">
              <dt>{{ text('运行状态') }}</dt>
              <dd>
                <span class="inline-tag" :class="`inline-tag--${statusTone}`">{{ localizedStatusLabel }}</span>
              </dd>
            </div>
            <div class="detail-item">
              <dt>{{ text('备注') }}</dt>
              <dd>{{ text('部署时请保留完整运行时目录') }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import type { ExternalModuleInfo } from '../../types/electronApi'
import {
  expectedInfornexusEntry,
  getInfornexusStatusLabel,
  getInfornexusStatusTone,
  type InfornexusNoticeTone,
} from './infornexusModel'
import {
  fetchInfornexusExternalModule,
  launchInfornexusExternalModule,
  recordInfornexusEvent,
} from './infornexusApi'
import { useAppLanguage } from '../../shared/i18n/appLanguage'

const moduleInfo = ref<ExternalModuleInfo | null>(null)
const loading = ref(false)
const launching = ref(false)
const message = ref('')
const messageTone = ref<InfornexusNoticeTone>('info')
const { text } = useAppLanguage()

const statusLabel = computed(() => getInfornexusStatusLabel(moduleInfo.value))
const localizedStatusLabel = computed(() => text(statusLabel.value))
const statusTone = computed(() => getInfornexusStatusTone(moduleInfo.value))
const entryPath = computed(
  () => moduleInfo.value?.executablePath || moduleInfo.value?.path || expectedInfornexusEntry,
)
const canLaunch = computed(
  () => Boolean(moduleInfo.value?.available) && !loading.value && !launching.value,
)

const infoCards = computed(() => [
  {
    key: 'status',
    icon: 'activity',
    label: text('当前状态'),
    value: localizedStatusLabel.value,
    tone: moduleInfo.value?.available ? 'green' : 'orange',
  },
  {
    key: 'type',
    icon: 'external-link',
    label: text('接入方式'),
    value: text('Electron 子应用'),
    tone: 'blue',
  },
  {
    key: 'name',
    icon: 'package',
    label: text('模块名称'),
    value: moduleInfo.value?.name || 'Infornexus',
    tone: 'teal',
  },
])

onMounted(() => { void refreshModule() })

async function refreshModule(): Promise<void> {
  loading.value = true
  message.value = ''
  try {
    moduleInfo.value = await fetchInfornexusExternalModule()
    if (moduleInfo.value.available) {
      messageTone.value = 'success'
      message.value = text('已检测到 Infornexus 外部应用。')
    } else {
      messageTone.value = 'warning'
      message.value = text('未找到 Infornexus 整包，请确认 external-apps/infornexus 目录完整。')
    }
  } catch (e) {
    moduleInfo.value = null
    messageTone.value = 'error'
    message.value = readErrorMessage(e, text('读取状态失败'))
  } finally { loading.value = false }
}

async function launchModule(): Promise<void> {
  if (launching.value) return
  launching.value = true
  message.value = ''
  try {
    const result = await launchInfornexusExternalModule()
    if (result.success) {
      messageTone.value = 'success'
      message.value = text('Infornexus 已启动。')
    } else {
      messageTone.value = 'error'
      message.value = result.error ? text(result.error) : text('启动失败')
    }
  } catch (e) {
    const err = readErrorMessage(e, text('启动失败'))
    await recordInfornexusEvent('launch-exception', { error: err })
    messageTone.value = 'error'
    message.value = err
  } finally { launching.value = false }
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? text(error.message) : fallback
}
</script>

<style scoped lang="scss">
.ifx-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  padding: 22px 28px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  animation: slideUp 0.4s ease-out both;
}

.hero-left { display: flex; align-items: center; gap: 14px; }

.hero-icon-wrap {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(37,99,235,0.2);
}

.hero-text {
  h2 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
  p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
}

.hero-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  font-size: 13px; font-weight: 700;
  border-radius: 999px; white-space: nowrap;

  .status-dot { width: 7px; height: 7px; border-radius: 50%; }

  &--info { background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; .status-dot { background: #0d9488; } }
  &--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; .status-dot { background: #16a34a; animation: pulse 2s ease infinite; } }
  &--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; .status-dot { background: #d97706; } }
  &--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; .status-dot { background: #dc2626; animation: pulse 1.5s ease infinite; } }
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

.hero-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 38px; padding: 0 16px;
  background: #fff; color: #475569;
  border: 1px solid #e2e8f0; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  transition: all 0.2s ease;
  :deep(.app-icon) { font-size: 15px; }
  &:hover:not(:disabled) { background: #f0fdfa; border-color: #99f6e4; color: #0d9488; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }

  &--primary {
    background: linear-gradient(135deg, #0d9488, #0f766e);
    color: #fff; border-color: #0f766e;
    box-shadow: 0 2px 8px rgba(13,148,136,0.2);
    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(13,148,136,0.3); }
  }
}

/* Alert */
.alert {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 12px; font-size: 14px; font-weight: 500;
  :deep(.app-icon) { font-size: 18px; flex-shrink: 0; }
  &--info { background: #f0fdfa; color: #0f766e; border: 1px solid #ccfbf1; }
  &--success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  &--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  &--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
}
.msg-enter-active { transition: all 0.3s ease; }
.msg-leave-active { transition: all 0.2s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  animation: slideUp 0.4s ease-out 0.08s both;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.06);
    border-color: #99f6e4;
  }

  &__icon {
    width: 42px; height: 42px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #fff; flex-shrink: 0;

    &--green { background: linear-gradient(135deg, #34d399, #059669); }
    &--blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
    &--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
    &--orange { background: linear-gradient(135deg, #fb923c, #ea580c); }
  }

  &__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  &__value { font-size: 16px; color: #0f172a; font-weight: 700; line-height: 1.3; }
}

/* Detail Section */
.detail-section {
  animation: slideUp 0.4s ease-out 0.16s both;
}

.detail-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px;
  font-size: 15px; font-weight: 700; color: #0f172a;
  :deep(.app-icon) { font-size: 18px; color: #0d9488; }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.detail-card {
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: box-shadow 0.2s ease;

  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

  &__head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 16px; padding-bottom: 12px;
    border-bottom: 1px solid #eef2f7;
    :deep(.app-icon) { font-size: 17px; color: #0d9488; }
    strong { font-size: 15px; color: #0f172a; }
  }
}

.detail-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  dt { font-size: 13px; color: #94a3b8; font-weight: 600; flex-shrink: 0; }
  dd { margin: 0; font-size: 13px; color: #1e293b; font-weight: 600; text-align: right; word-break: break-all; }
  dd.mono { font-family: Consolas, 'Courier New', monospace; font-size: 12px; }
}

.inline-tag {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px; font-weight: 700;

  &--info { background: #f0fdfa; color: #0f766e; }
  &--success { background: #ecfdf5; color: #059669; }
  &--warning { background: #fffbeb; color: #b45309; }
  &--error { background: #fef2f2; color: #dc2626; }
}

/* Animations */
@keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1000px) {
  .hero { flex-direction: column; align-items: stretch; }
  .hero-right { flex-wrap: wrap; justify-content: flex-start; }
  .info-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
