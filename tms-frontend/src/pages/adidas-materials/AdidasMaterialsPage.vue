<template>
  <section class="am-page">
    <!-- ===== 1. Hero ===== -->
    <header class="am-hero">
      <div class="am-hero__left">
        <div class="am-hero__badge">
          <AppIcon name="globe-search" />
          <span>{{ text('网页数据爬取') }}</span>
        </div>
        <h1 class="am-hero__title">{{ text('adidas 材料数据收集器') }}</h1>
        <p class="am-hero__desc">
          {{ text('通过外部浏览器登录后自动监听 Materials 接口，批量采集并本地落盘。') }}
        </p>
      </div>
      <div class="am-hero__right">
        <button
          class="am-launch-btn"
          type="button"
          :disabled="launching"
          @click="openCollector"
        >
          <AppIcon :name="launching ? 'loader' : 'browser'" :class="{ 'am-spin': launching }" />
          <span>{{ launching ? text('启动中...') : text('打开外部浏览器') }}</span>
          <AppIcon v-if="!launching" name="arrow-right" class="am-launch-btn__arrow" />
        </button>
        <div class="am-hero__stats">
          <div
            v-for="(cap, i) in capabilities"
            :key="cap.label"
            class="am-hero__stat"
            :style="{ animationDelay: `${i * 60 + 100}ms` }"
          >
            <AppIcon :name="cap.icon" class="am-hero__stat-icon" />
            <span class="am-hero__stat-label">{{ cap.label }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ===== 2. Status Alert ===== -->
    <transition name="am-alert">
      <div v-if="message" class="am-alert" :class="`am-alert--${messageTone}`">
        <div class="am-alert__icon">
          <AppIcon :name="alertIcon" />
        </div>
        <span class="am-alert__text">{{ text(message) }}</span>
        <button class="am-alert__close" type="button" @click="message = ''">×</button>
      </div>
    </transition>

    <transition name="am-modal">
      <div v-if="updateDialogOpen" class="am-modal-overlay" @click.self="updateDialogOpen = false">
        <section class="am-update-modal" role="dialog" aria-modal="true" aria-labelledby="adidas-helper-update-title">
          <header class="am-update-modal__head">
            <div class="am-update-modal__icon">
              <AppIcon name="download-cloud" />
            </div>
            <div>
              <h2 id="adidas-helper-update-title">{{ text('需要更新本机自动化助手') }}</h2>
              <p>{{ text('当前助手缺少 adidas 网页端启动能力，请安装最新版后再打开采集器。') }}</p>
            </div>
            <button class="am-update-modal__close" type="button" @click="updateDialogOpen = false">
              <AppIcon name="x" />
            </button>
          </header>

          <div class="am-update-modal__body">
            <div class="am-version-grid">
              <div>
                <span>{{ text('当前版本') }}</span>
                <strong>{{ updateCurrentVersion || text('未知版本') }}</strong>
              </div>
              <div>
                <span>{{ text('系统要求') }}</span>
                <strong>{{ updateExpectedVersion }}</strong>
              </div>
            </div>
            <p>{{ text(updateMessage) }}</p>
            <p>{{ text('安装包文件名会带版本号；安装完成后请重启本机自动化助手，或重新打开此页面。') }}</p>
          </div>

          <footer class="am-update-modal__foot">
            <button class="am-secondary-btn" type="button" @click="updateDialogOpen = false">{{ text('稍后处理') }}</button>
            <button class="am-download-btn" type="button" @click="downloadLatestHelper">
              <AppIcon name="download" />
              {{ text('下载最新助手') }}
            </button>
          </footer>
        </section>
      </div>
    </transition>

    <!-- ===== 3. Capability Cards ===== -->
    <div class="am-caps">
      <article
        v-for="(cap, i) in capabilities"
        :key="cap.label"
        class="am-cap-card"
        :style="{ animationDelay: `${i * 80}ms` }"
      >
        <div class="am-cap-card__shimmer" />
        <div class="am-cap-card__icon" :class="`am-cap-card__icon--${cap.tone}`">
          <AppIcon :name="cap.icon" />
        </div>
        <div class="am-cap-card__body">
          <span class="am-cap-card__label">{{ cap.label }}</span>
          <strong class="am-cap-card__value">{{ cap.value }}</strong>
          <span class="am-cap-card__desc">{{ cap.desc }}</span>
        </div>
      </article>
    </div>

    <!-- ===== 4. Notes ===== -->
    <section class="am-notes">
      <div class="am-notes__head">
        <AppIcon name="info" />
        <h3>{{ text('操作提示') }}</h3>
      </div>
      <div class="am-notes__list">
        <div
          v-for="(note, i) in adidasMaterialsNotes"
          :key="i"
          class="am-note"
          :style="{ animationDelay: `${i * 60}ms` }"
        >
          <div class="am-note__dot" />
          <AppIcon :name="note.icon" class="am-note__icon" />
          <p class="am-note__text">{{ text(note.text) }}</p>
        </div>
      </div>
    </section>

    <!-- ===== 5. Workflow Timeline ===== -->
    <section class="am-timeline-section">
      <div class="am-section-head">
        <AppIcon name="workflow" />
        <h3>{{ text('运行流程') }}</h3>
      </div>
      <div class="am-timeline">
        <article
          v-for="(step, i) in adidasMaterialsWorkflowSteps"
          :key="step.index"
          class="am-step"
          :style="{ animationDelay: `${i * 120 + 200}ms` }"
        >
          <div class="am-step__dot">
            <span>{{ step.index }}</span>
            <div class="am-step__pulse" />
          </div>
          <div v-if="i < adidasMaterialsWorkflowSteps.length - 1" class="am-step__line" />
          <p class="am-step__text">{{ text(step.text) }}</p>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppIcon from '../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../shared/i18n/appLanguage'
import { openAutomationHelperDownload } from '../web-automation/webAutomationApi'
import {
  adidasMaterialsCapabilities,
  adidasMaterialsNotes,
  adidasMaterialsWorkflowSteps,
  readLaunchSuccessMessage,
  type AdidasMaterialsNoticeTone,
} from './adidasMaterialsModel'
import {
  AdidasMaterialsLauncherUpdateRequiredError,
  launchAdidasMaterialsCollector,
  readAdidasMaterialsLauncherUpdateStatus,
  recordAdidasMaterialsEvent,
  type AdidasMaterialsLauncherUpdateStatus,
} from './adidasMaterialsApi'

const launching = ref(false)
const message = ref('')
const messageTone = ref<AdidasMaterialsNoticeTone>('info')
const updateDialogOpen = ref(false)
const updateCurrentVersion = ref('')
const updateExpectedVersion = ref('')
const updateMessage = ref('')
const { text } = useAppLanguage()

const capabilities = computed(() =>
  adidasMaterialsCapabilities.map((cap, i) => ({
    ...cap,
    label: text(cap.label),
    value: text(cap.value),
    desc: text(cap.desc),
    icon: ['browser', 'database', 'shield-check'][i],
    tone: ['teal', 'blue', 'green'][i],
  })),
)

const alertIcon = computed(() => {
  const map: Record<AdidasMaterialsNoticeTone, string> = {
    info: 'activity',
    success: 'check-circle',
    warning: 'alert-circle',
    error: 'alert-circle',
  }
  return map[messageTone.value]
})

onMounted(() => {
  void checkLauncherVersionOnOpen()
})

async function openCollector(): Promise<void> {
  launching.value = true
  message.value = ''

  try {
    const result = await launchAdidasMaterialsCollector()

    if (result.success) {
      messageTone.value = 'success'
      message.value = text(readLaunchSuccessMessage(result.alreadyOpen))
    } else {
      messageTone.value = 'error'
      message.value = result.error ? text(result.error) : text('打开 adidas 外部浏览器失败')
    }
  } catch (error) {
    if (error instanceof AdidasMaterialsLauncherUpdateRequiredError) {
      showUpdateDialog({
        needsUpdate: true,
        currentVersion: error.currentVersion,
        expectedVersion: error.expectedVersion,
        message: error.message,
      })
      await recordAdidasMaterialsEvent('launcher-update-required', {
        currentVersion: error.currentVersion,
        expectedVersion: error.expectedVersion,
      })
      return
    }

    const errorMessage = readErrorMessage(error, text('打开 adidas 外部浏览器失败'))
    await recordAdidasMaterialsEvent('launch-exception', { error: errorMessage })
    messageTone.value = 'error'
    message.value = errorMessage
  } finally {
    launching.value = false
  }
}

async function checkLauncherVersionOnOpen(): Promise<void> {
  const status = await readAdidasMaterialsLauncherUpdateStatus().catch(() => null)
  if (status?.needsUpdate) {
    showUpdateDialog(status)
  }
}

function showUpdateDialog(status: AdidasMaterialsLauncherUpdateStatus): void {
  updateCurrentVersion.value = status.currentVersion
  updateExpectedVersion.value = status.expectedVersion
  updateMessage.value = status.message
  updateDialogOpen.value = true
  messageTone.value = 'warning'
  message.value = status.message
}

async function downloadLatestHelper(): Promise<void> {
  try {
    await openAutomationHelperDownload()
    messageTone.value = 'info'
    message.value = text('已打开自动化助手安装包下载。')
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, text('自动化助手安装包下载失败。'))
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return text(error.message)
  return fallback
}
</script>

<style scoped lang="scss">
/* ================================================================
   adidas Materials Collector — Premium Redesign
   Palette: teal #0d9488, green #059669, blue #3b82f6, orange #d97706
   No purple.
   ================================================================ */

.am-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  min-height: 100%;
  background:
    radial-gradient(ellipse 55% 35% at 50% 0%, rgba(13, 148, 136, 0.05), transparent 55%),
    radial-gradient(ellipse 40% 30% at 85% 85%, rgba(59, 130, 246, 0.04), transparent 50%),
    #f6f9fc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
}

/* ===== 1. Hero ===== */
.am-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 28px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 18px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.03);
  animation: am-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  overflow: hidden;
}

.am-hero::before {
  content: '';
  position: absolute;
  top: -40%;
  right: -5%;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(13, 148, 136, 0.06) 0%, transparent 70%);
  pointer-events: none;
}

.am-hero__left {
  flex: 1;
  min-width: 0;
  z-index: 1;
}

.am-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  margin-bottom: 10px;
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

.am-hero__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  line-height: 1.3;
}

.am-hero__desc {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
  max-width: 480px;
}

.am-hero__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
  flex-shrink: 0;
  z-index: 1;
}

/* Launch Button */
.am-launch-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 22px;
  height: 42px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(13, 148, 136, 0.3);
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);

  :deep(.app-icon) {
    font-size: 17px;
  }

  &__arrow {
    font-size: 14px;
    transition: transform 0.25s ease;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(13, 148, 136, 0.35);

    .am-launch-btn__arrow {
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

.am-spin {
  animation: am-spin 1s linear infinite;
}

/* Hero Stats */
.am-hero__stats {
  display: flex;
  gap: 8px;
}

.am-hero__stat {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  animation: am-scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }
}

.am-hero__stat-icon {
  font-size: 14px;
  color: #0d9488;
}

.am-hero__stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

/* ===== 2. Alert ===== */
.am-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid;
}

.am-alert__icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  flex-shrink: 0;
}

.am-alert__text {
  flex: 1;
  min-width: 0;
}

.am-alert__close {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  opacity: 0.6;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
}

.am-alert--info {
  background: #f0fdfa;
  color: #0f766e;
  border-color: #ccfbf1;

  .am-alert__icon { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
}

.am-alert--success {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;

  .am-alert__icon { background: linear-gradient(135deg, #34d399, #059669); }
}

.am-alert--warning {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;

  .am-alert__icon { background: linear-gradient(135deg, #fbbf24, #d97706); }
}

.am-alert--error {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;

  .am-alert__icon { background: linear-gradient(135deg, #f87171, #dc2626); }
}

.am-alert-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.am-alert-leave-active { transition: all 0.3s ease-in; }
.am-alert-enter-from { opacity: 0; transform: translateX(30px); }
.am-alert-leave-to { opacity: 0; transform: translateX(20px); }

.am-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(3px);
}

.am-update-modal {
  width: min(560px, 100%);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.am-update-modal__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: flex-start;
  padding: 20px 22px;
  background: linear-gradient(135deg, #f8fafc, #ecfeff);
  border-bottom: 1px solid #e2e8f0;

  h2 {
    margin: 0;
    color: #0f172a;
    font-size: 18px;
    font-weight: 800;
  }

  p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
  }
}

.am-update-modal__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f766e;
  background: #ccfbf1;
  font-size: 20px;
}

.am-update-modal__close {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #0f172a;
    background: #f8fafc;
  }
}

.am-update-modal__body {
  display: grid;
  gap: 14px;
  padding: 20px 22px;

  p {
    margin: 0;
    color: #475569;
    font-size: 13px;
    line-height: 1.65;
  }
}

.am-version-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  div {
    padding: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  span {
    display: block;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  strong {
    color: #0f172a;
    font-size: 15px;
    overflow-wrap: anywhere;
  }
}

.am-update-modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px 20px;
  border-top: 1px solid #f1f5f9;
}

.am-secondary-btn,
.am-download-btn {
  min-height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.am-secondary-btn {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;

  &:hover {
    background: #f8fafc;
  }
}

.am-download-btn {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  box-shadow: 0 4px 14px rgba(13, 148, 136, 0.22);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(13, 148, 136, 0.28);
  }
}

.am-modal-enter-active,
.am-modal-leave-active {
  transition: opacity 0.2s ease;
}

.am-modal-enter-from,
.am-modal-leave-to {
  opacity: 0;
}

/* ===== 3. Capability Cards ===== */
.am-caps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.am-cap-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  animation: am-fadeScale 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.04),
      0 12px 32px rgba(0, 0, 0, 0.03);
    border-color: #99f6e4;

    .am-cap-card__icon {
      transform: scale(1.08) rotate(-3deg);
    }

    .am-cap-card__shimmer {
      opacity: 1;
    }
  }
}

.am-cap-card__shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf, #0d9488);
  background-size: 200% 100%;
  animation: am-shimmer 3s linear infinite;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.am-cap-card__icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 22px;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &--teal {
    background: linear-gradient(135deg, #2dd4bf, #0d9488);
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.25);
  }

  &--blue {
    background: linear-gradient(135deg, #60a5fa, #2563eb);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  }

  &--green {
    background: linear-gradient(135deg, #34d399, #059669);
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);
  }
}

.am-cap-card__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.am-cap-card__label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.am-cap-card__value {
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.3;
}

.am-cap-card__desc {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 2px;
}

/* ===== 4. Notes ===== */
.am-notes {
  padding: 20px 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: am-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}

.am-notes__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: #0f172a;

  :deep(.app-icon) {
    font-size: 18px;
    color: #0d9488;
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }
}

.am-notes__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.am-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  transition: all 0.25s ease;
  animation: am-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;

  &:hover {
    background: #f1f5f9;
    border-color: #e2e8f0;
    transform: translateX(4px);
  }
}

.am-note__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  flex-shrink: 0;
  margin-top: 7px;
}

.am-note__icon {
  font-size: 16px;
  color: #0d9488;
  flex-shrink: 0;
  margin-top: 1px;
}

.am-note__text {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

/* ===== 5. Timeline ===== */
.am-timeline-section {
  padding: 24px 28px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: am-slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

.am-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
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

.am-timeline {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  position: relative;
}

.am-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  padding: 0 8px;
  animation: am-scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.am-step__dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d9488, #0f766e);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
  z-index: 2;
  box-shadow: 0 3px 10px rgba(13, 148, 136, 0.25);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;

  .am-step:hover & {
    transform: scale(1.15);
    box-shadow: 0 6px 18px rgba(13, 148, 136, 0.35);
  }
}

.am-step__pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(13, 148, 136, 0.3);
  animation: am-pulse 2.5s ease-out infinite;
  pointer-events: none;
}

.am-step__line {
  position: absolute;
  top: 20px;
  left: calc(50% + 24px);
  right: calc(-50% + 24px);
  height: 3px;
  background: linear-gradient(90deg, #0d9488, #99f6e4);
  z-index: 1;
  border-radius: 2px;
  opacity: 0.5;
}

.am-step__text {
  margin: 14px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  max-width: 180px;
}

/* ===== Animations ===== */
@keyframes am-slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes am-fadeScale {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes am-scaleIn {
  from { opacity: 0; transform: scale(0); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes am-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes am-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

@keyframes am-pulse {
  0%   { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}

@keyframes am-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ===== Responsive ===== */
@media (max-width: 1100px) {
  .am-caps { grid-template-columns: repeat(2, 1fr); }
  .am-timeline { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .am-step__line { display: none; }
}

@media (max-width: 760px) {
  .am-page { padding: 14px; }

  .am-hero {
    flex-direction: column;
    align-items: stretch;
    padding: 20px;
  }

  .am-hero__right {
    align-items: stretch;
  }

  .am-hero__stats {
    justify-content: center;
  }

  .am-launch-btn {
    width: 100%;
    justify-content: center;
  }

  .am-caps { grid-template-columns: 1fr; }

  .am-modal-overlay { padding: 14px; }
  .am-update-modal__head { grid-template-columns: auto minmax(0, 1fr); }
  .am-update-modal__close { grid-column: 2; justify-self: end; }
  .am-version-grid { grid-template-columns: 1fr; }
  .am-update-modal__foot { flex-direction: column-reverse; }
  .am-secondary-btn,
  .am-download-btn { width: 100%; }

  .am-timeline { grid-template-columns: 1fr; gap: 14px; }
  .am-step {
    flex-direction: row;
    text-align: left;
    gap: 14px;
  }
  .am-step__text { margin: 0; max-width: none; }
}
</style>
