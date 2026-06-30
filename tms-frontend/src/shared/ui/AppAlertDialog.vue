<template>
  <Teleport to="body">
    <Transition name="app-alert">
      <div
        v-if="current"
        class="app-alert"
        role="presentation"
      >
        <div class="app-alert__backdrop" @click="cancelAppAlert" />
        <section
          ref="dialogRef"
          class="app-alert__dialog"
          :class="[
            `app-alert__dialog--${current.tone}`,
            {
              'app-alert__dialog--compact': current.compact,
              'app-alert__dialog--auto-close': current.autoCloseMs > 0,
            },
          ]"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          tabindex="-1"
        >
          <div class="app-alert__mark">
            <AppIcon :name="iconName" />
          </div>

          <div class="app-alert__content">
            <h2 :id="titleId" class="app-alert__title">{{ text(current.title) }}</h2>
            <p :id="messageId" class="app-alert__message">{{ text(current.message) }}</p>
          </div>

          <footer class="app-alert__actions">
            <button
              v-if="current.cancelText"
              class="app-alert__cancel"
              type="button"
              @click="cancelAppAlert"
            >
              {{ text(current.cancelText) }}
            </button>
            <button ref="confirmRef" class="app-alert__confirm" type="button" @click="confirmAppAlert">
              {{ text(current.confirmText) }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'

import AppIcon from './AppIcon.vue'
import { confirmAppAlert, cancelAppAlert, useAppAlertState } from './appAlert'
import { useAppLanguage } from '../i18n/appLanguage'

const state = useAppAlertState()
const { text } = useAppLanguage()
const current = computed(() => state.current)
const dialogRef = ref<HTMLElement | null>(null)
const confirmRef = ref<HTMLButtonElement | null>(null)
let autoCloseTimer: number | undefined

const titleId = computed(() => current.value ? `app-alert-title-${current.value.id}` : undefined)
const messageId = computed(() => current.value ? `app-alert-message-${current.value.id}` : undefined)
const iconName = computed(() => {
  if (current.value?.tone === 'success') return 'check-circle'
  if (current.value?.tone === 'error') return 'stop-circle'
  if (current.value?.tone === 'info') return 'info'
  return 'alert-circle'
})

const handleKeyDown = (e: KeyboardEvent) => {
  if (!current.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelAppAlert()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    confirmAppAlert()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true)
})

onUnmounted(() => {
  clearAutoCloseTimer()
  window.removeEventListener('keydown', handleKeyDown, true)
})

watch(current, async (value) => {
  clearAutoCloseTimer()
  if (!value) return
  await nextTick()
  confirmRef.value?.focus()

  if (value.autoCloseMs > 0) {
    autoCloseTimer = window.setTimeout(() => {
      if (state.current?.id === value.id) {
        confirmAppAlert()
      }
    }, value.autoCloseMs)
  }
})

function clearAutoCloseTimer(): void {
  if (autoCloseTimer === undefined) return
  window.clearTimeout(autoCloseTimer)
  autoCloseTimer = undefined
}
</script>

<style scoped>
.app-alert {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.app-alert__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(6px);
}

.app-alert__dialog {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 16px;
  width: min(500px, calc(100vw - 32px));
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  box-shadow:
    0 4px 24px -1px rgba(15, 23, 42, 0.06),
    0 25px 50px -12px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.8);
  color: #1e293b;
}

.app-alert__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: #f0f9ff;
  color: #0ea5e9;
}

.app-alert__dialog--info {
  --confirm-bg: linear-gradient(135deg, #38bdf8, #0284c7);
  --confirm-border: rgba(14, 165, 233, 0.15);
  --confirm-shadow: 0 8px 20px rgba(14, 165, 233, 0.22);
  --confirm-hover-shadow: 0 12px 24px rgba(14, 165, 233, 0.28);
}

.app-alert__dialog--success {
  --confirm-bg: linear-gradient(135deg, #34d399, #059669);
  --confirm-border: rgba(16, 185, 129, 0.15);
  --confirm-shadow: 0 8px 20px rgba(16, 185, 129, 0.22);
  --confirm-hover-shadow: 0 12px 24px rgba(16, 185, 129, 0.28);
}

.app-alert__dialog--warning {
  --confirm-bg: linear-gradient(135deg, #ff822d, #e05e00);
  --confirm-border: rgba(249, 115, 22, 0.15);
  --confirm-shadow: 0 8px 20px rgba(249, 115, 22, 0.22);
  --confirm-hover-shadow: 0 12px 24px rgba(249, 115, 22, 0.28);
}

.app-alert__dialog--error {
  --confirm-bg: linear-gradient(135deg, #f43f5e, #dc2626);
  --confirm-border: rgba(239, 68, 68, 0.15);
  --confirm-shadow: 0 8px 20px rgba(239, 68, 68, 0.22);
  --confirm-hover-shadow: 0 12px 24px rgba(239, 68, 68, 0.28);
}

.app-alert__dialog--success .app-alert__mark {
  background: #ecfdf5;
  color: #10b981;
}

.app-alert__dialog--warning .app-alert__mark {
  background: #fff7ed;
  color: #f97316;
}

.app-alert__dialog--error .app-alert__mark {
  background: #fff5f5;
  color: #ef4444;
}

.app-alert__mark :deep(.app-icon) {
  width: 22px;
  height: 22px;
}

.app-alert__content {
  min-width: 0;
}

.app-alert__title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.app-alert__message {
  margin: 8px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.app-alert__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.app-alert__cancel {
  min-width: 80px;
  height: 38px;
  padding: 0 18px;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: #ffffff;
  color: #475569;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.app-alert__cancel:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.app-alert__confirm {
  min-width: 90px;
  height: 38px;
  padding: 0 20px;
  border: 1px solid var(--confirm-border);
  border-radius: 11px;
  background: var(--confirm-bg);
  color: #ffffff;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  box-shadow: var(--confirm-shadow);
  transition: all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.app-alert__confirm:hover {
  transform: translateY(-1.5px);
  box-shadow: var(--confirm-hover-shadow);
}

.app-alert__confirm:active,
.app-alert__cancel:active {
  transform: translateY(0);
}

.app-alert__confirm:focus-visible {
  outline: 3px solid var(--confirm-border);
  outline-offset: 3px;
}

.app-alert__dialog--compact {
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 12px;
  width: min(420px, calc(100vw - 32px));
  padding: 18px 18px 16px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 8px;
  background: var(--el-bg-color-overlay, #ffffff);
  backdrop-filter: none;
  box-shadow: var(--el-box-shadow-light, 0 0 12px rgba(0, 0, 0, 0.12));
  color: var(--el-text-color-primary, #303133);
}

.app-alert__dialog--compact .app-alert__mark {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: transparent;
  color: var(--el-color-success, #67c23a);
}

.app-alert__dialog--compact .app-alert__mark :deep(.app-icon) {
  width: 24px;
  height: 24px;
}

.app-alert__dialog--compact .app-alert__title {
  color: var(--el-text-color-primary, #303133);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0;
}

.app-alert__dialog--compact .app-alert__message {
  margin-top: 8px;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  line-height: 1.55;
}

.app-alert__dialog--compact .app-alert__actions {
  margin-top: 14px;
}

.app-alert__dialog--compact .app-alert__confirm {
  min-width: 72px;
  height: 32px;
  padding: 0 15px;
  border-color: var(--el-color-primary, #409eff);
  border-radius: 4px;
  background: var(--el-color-primary, #409eff);
  box-shadow: none;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
}

.app-alert__dialog--compact .app-alert__confirm:hover {
  transform: none;
  background: var(--el-color-primary-light-3, #79bbff);
  border-color: var(--el-color-primary-light-3, #79bbff);
  box-shadow: none;
}

.app-alert__dialog--compact .app-alert__confirm:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5, #a0cfff);
  outline-offset: 2px;
}

.app-alert__dialog--compact.app-alert__dialog--auto-close .app-alert__actions {
  margin-top: 12px;
}

.app-alert-enter-active,
.app-alert-leave-active {
  transition: opacity 0.2s ease;
}

.app-alert-enter-active .app-alert__dialog,
.app-alert-leave-active .app-alert__dialog {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.app-alert-enter-from,
.app-alert-leave-to {
  opacity: 0;
}

.app-alert-enter-from .app-alert__dialog {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.app-alert-leave-to .app-alert__dialog {
  opacity: 0;
  transform: scale(0.97) translateY(-8px);
}

@media (max-width: 640px) {
  .app-alert {
    padding: 16px;
  }

  .app-alert__dialog {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 12px;
    padding: 18px;
    border-radius: 16px;
  }

  .app-alert__mark {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }
}
</style>
