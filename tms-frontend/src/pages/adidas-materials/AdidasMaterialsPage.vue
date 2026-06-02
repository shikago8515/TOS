<template>
  <section class="adidas-page">
    <!-- Hero Banner -->
    <div class="hero-banner">
      <div class="hero-content">
        <div class="hero-badge">
          <AppIcon name="globe-search" />
          <span>{{ text('网页数据爬取') }}</span>
        </div>
        <h2 class="hero-title">{{ text('adidas 材料数据收集器') }}</h2>
        <p class="hero-desc">
          {{ text('通过外部浏览器登录后自动监听 Materials 接口，批量采集并本地落盘。') }}
        </p>
        <button
          class="hero-action"
          type="button"
          :disabled="launching"
          @click="openCollector"
        >
          <AppIcon name="browser" />
          {{ launching ? text('启动中...') : text('打开外部浏览器') }}
          <svg v-if="!launching" class="arrow-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      <div class="hero-visual">
        <div class="hero-icon-ring">
          <AppIcon name="globe-search" />
        </div>
      </div>
    </div>

    <!-- Status Alert -->
    <transition name="alert-slide">
      <div v-if="message" class="alert-bar" :class="`alert-bar--${messageTone}`">
        <AppIcon :name="messageTone === 'success' ? 'check-circle' : messageTone === 'error' ? 'alert-circle' : 'activity'" />
        <span>{{ message }}</span>
      </div>
    </transition>

    <!-- Capability Cards -->
    <div class="cap-row">
      <article
        v-for="(cap, i) in capabilities"
        :key="cap.label"
        class="cap-card"
        :style="{ animationDelay: `${i * 80}ms` }"
      >
        <div class="cap-icon" :class="`cap-icon--${cap.tone}`">
          <AppIcon :name="cap.icon" />
        </div>
        <div class="cap-body">
          <span class="cap-label">{{ cap.label }}</span>
          <span class="cap-value">{{ cap.value }}</span>
        </div>
      </article>
    </div>

    <!-- Workflow Timeline -->
    <section class="timeline-section">
      <div class="section-head">
        <AppIcon name="workflow" />
        <h3>{{ text('运行流程') }}</h3>
      </div>
      <div class="timeline">
        <article
          v-for="(step, i) in adidasMaterialsWorkflowSteps"
          :key="step.index"
          class="timeline-node"
          :style="{ animationDelay: `${i * 100 + 200}ms` }"
        >
          <div class="node-dot">
            <span>{{ step.index }}</span>
          </div>
          <div v-if="i < adidasMaterialsWorkflowSteps.length - 1" class="node-line" />
          <p class="node-text">{{ step.text }}</p>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import {
  adidasMaterialsWorkflowSteps,
  readLaunchSuccessMessage,
  type AdidasMaterialsNoticeTone,
} from './adidasMaterialsModel'
import {
  launchAdidasMaterialsCollector,
  recordAdidasMaterialsEvent,
} from './adidasMaterialsApi'

const launching = ref(false)
const message = ref('')
const messageTone = ref<AdidasMaterialsNoticeTone>('info')
const { text } = useAppLanguage()

const capabilities = [
  {
    icon: 'browser',
    label: '采集方式',
    value: '外部浏览器登录后监听接口响应',
    tone: 'teal',
  },
  {
    icon: 'database',
    label: '保存策略',
    value: '每 2000 条自动保存 JSON + CSV',
    tone: 'blue',
  },
  {
    icon: 'shield-check',
    label: '恢复能力',
    value: '本地去重 ID + 待保存批次缓存',
    tone: 'green',
  },
]

async function openCollector(): Promise<void> {
  launching.value = true
  message.value = ''

  try {
    const result = await launchAdidasMaterialsCollector()

    if (result.success) {
      messageTone.value = 'success'
      message.value = readLaunchSuccessMessage(result.alreadyOpen)
    } else {
      messageTone.value = 'error'
      message.value = result.error || '打开 adidas 外部浏览器失败'
    }
  } catch (error) {
    const errorMessage = readErrorMessage(error, '打开 adidas 外部浏览器失败')
    await recordAdidasMaterialsEvent('launch-exception', { error: errorMessage })
    messageTone.value = 'error'
    message.value = errorMessage
  } finally {
    launching.value = false
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
</script>

<style scoped lang="scss">
.adidas-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 18px;
  min-height: 100%;
  background: #f8fafc;
}

/* ===== Hero ===== */
.hero-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 32px;
  padding: 32px 36px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.5s ease-out both;
  overflow: hidden;
  position: relative;
}

.hero-banner::before {
  content: '';
  position: absolute;
  top: -60%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(13, 148, 136, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  flex: 1;
  min-width: 0;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  margin-bottom: 12px;
  background: #f0fdfa;
  color: #0d9488;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid #ccfbf1;
  letter-spacing: 0.3px;

  :deep(.app-icon) {
    font-size: 13px;
  }
}

.hero-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
}

.hero-desc {
  margin: 0 0 20px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  max-width: 540px;
}

.hero-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px;
  height: 44px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  border: 1px solid #0f766e;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(13, 148, 136, 0.3);
  transition: all 0.25s ease;

  :deep(.app-icon) {
    font-size: 18px;
  }

  .arrow-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.25s ease;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(13, 148, 136, 0.35);

    .arrow-icon {
      transform: translateX(3px);
    }
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.hero-visual {
  flex-shrink: 0;
  z-index: 1;
}

.hero-icon-ring {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 36px;
  box-shadow: 0 8px 24px rgba(13, 148, 136, 0.25);
  animation: float 4s ease-in-out infinite;
}

/* ===== Alert ===== */
.alert-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  animation: slideUp 0.35s ease-out both;

  :deep(.app-icon) {
    font-size: 18px;
    flex-shrink: 0;
  }
}

.alert-bar--info {
  background: #f0fdfa;
  color: #0f766e;
  border: 1px solid #ccfbf1;
}

.alert-bar--success {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.alert-bar--warning {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.alert-bar--error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.alert-slide-enter-active { transition: all 0.35s ease; }
.alert-slide-leave-active { transition: all 0.25s ease; }
.alert-slide-enter-from { opacity: 0; transform: translateY(-8px); }
.alert-slide-leave-to { opacity: 0; transform: translateY(-8px); }

/* ===== Capability Cards ===== */
.cap-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.cap-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;
  animation: fadeScale 0.45s ease-out both;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
    border-color: #99f6e4;
  }
}

.cap-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
  font-size: 20px;

  &--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
  &--blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
  &--green { background: linear-gradient(135deg, #34d399, #059669); }
}

.cap-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cap-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cap-value {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

/* ===== Timeline ===== */
.timeline-section {
  padding: 24px 28px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.5s ease-out 0.15s both;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  color: #0f172a;

  :deep(.app-icon) {
    font-size: 20px;
    color: #0d9488;
  }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
  }
}

.timeline {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  position: relative;
}

.timeline-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  padding: 0 8px;
  animation: fadeScale 0.4s ease-out both;
}

.node-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.2);
  transition: all 0.25s ease;

  .timeline-node:hover & {
    transform: scale(1.15);
    box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
  }
}

.node-line {
  position: absolute;
  top: 18px;
  left: calc(50% + 22px);
  right: calc(-50% + 22px);
  height: 2px;
  background: linear-gradient(90deg, #0d9488, #99f6e4);
  z-index: 1;
  opacity: 0.4;
}

.node-text {
  margin: 12px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  max-width: 200px;
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

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .cap-row { grid-template-columns: repeat(2, 1fr); }
  .timeline { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .node-line { display: none; }
}

@media (max-width: 760px) {
  .hero-banner { flex-direction: column; text-align: center; padding: 24px 20px; }
  .hero-desc { max-width: 100%; }
  .hero-visual { display: none; }
  .cap-row { grid-template-columns: 1fr; }
  .timeline { grid-template-columns: 1fr; gap: 16px; }
  .timeline-node { flex-direction: row; text-align: left; gap: 12px; }
  .node-text { margin: 0; max-width: none; }
}
</style>
