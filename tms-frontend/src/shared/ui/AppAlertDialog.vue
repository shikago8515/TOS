<template>
  <Teleport to="body">
    <Transition name="app-alert">
      <div
        v-if="current"
        class="app-alert"
        role="presentation"
        @keydown.esc.prevent="closeAppAlert"
      >
        <div class="app-alert__backdrop" @click="closeAppAlert" />
        <section
          ref="dialogRef"
          class="app-alert__dialog"
          :class="`app-alert__dialog--${current.tone}`"
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
            <h2 :id="titleId" class="app-alert__title">{{ current.title }}</h2>
            <p :id="messageId" class="app-alert__message">{{ current.message }}</p>
          </div>

          <footer class="app-alert__actions">
            <button ref="confirmRef" class="app-alert__confirm" type="button" @click="closeAppAlert">
              {{ current.confirmText }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import AppIcon from './AppIcon.vue'
import { closeAppAlert, useAppAlertState } from './appAlert'

const state = useAppAlertState()
const current = computed(() => state.current)
const dialogRef = ref<HTMLElement | null>(null)
const confirmRef = ref<HTMLButtonElement | null>(null)

const titleId = computed(() => current.value ? `app-alert-title-${current.value.id}` : undefined)
const messageId = computed(() => current.value ? `app-alert-message-${current.value.id}` : undefined)
const iconName = computed(() => {
  if (current.value?.tone === 'success') return 'check-circle'
  if (current.value?.tone === 'error') return 'stop-circle'
  if (current.value?.tone === 'info') return 'info'
  return 'alert-circle'
})

watch(current, async (value) => {
  if (!value) return
  await nextTick()
  confirmRef.value?.focus()
})
</script>

<style scoped>
.app-alert {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: grid;
  place-items: start center;
  padding: 86px 20px 20px;
}

.app-alert__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.68), rgba(241, 246, 252, 0.42)),
    rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(4px);
}

.app-alert__dialog {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  width: min(520px, calc(100vw - 32px));
  padding: 20px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 18px;
  background: #ffffff;
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.18),
    0 1px 2px rgba(15, 23, 42, 0.08);
  color: #1e293b;
}

.app-alert__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: #e0f2fe;
  color: #0284c7;
}

.app-alert__dialog--success .app-alert__mark {
  background: #dcfce7;
  color: #059669;
}

.app-alert__dialog--warning .app-alert__mark {
  background: #fff7ed;
  color: #ea580c;
}

.app-alert__dialog--error .app-alert__mark {
  background: #fee2e2;
  color: #dc2626;
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
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
  color: #0f172a;
}

.app-alert__message {
  margin: 8px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.app-alert__actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 2px;
}

.app-alert__confirm {
  min-width: 86px;
  height: 40px;
  padding: 0 18px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 12px;
  background: linear-gradient(135deg, #19b7f1, #0d92d1);
  color: #ffffff;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(14, 165, 233, 0.24);
}

.app-alert__confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px rgba(14, 165, 233, 0.28);
}

.app-alert__confirm:focus-visible {
  outline: 3px solid rgba(14, 165, 233, 0.2);
  outline-offset: 3px;
}

.app-alert-enter-active,
.app-alert-leave-active {
  transition: opacity 0.18s ease;
}

.app-alert-enter-active .app-alert__dialog,
.app-alert-leave-active .app-alert__dialog {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.app-alert-enter-from,
.app-alert-leave-to {
  opacity: 0;
}

.app-alert-enter-from .app-alert__dialog,
.app-alert-leave-to .app-alert__dialog {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 640px) {
  .app-alert {
    padding-top: 72px;
  }

  .app-alert__dialog {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
  }

  .app-alert__mark {
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }
}
</style>
