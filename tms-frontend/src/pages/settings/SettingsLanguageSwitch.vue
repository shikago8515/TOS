<template>
  <div ref="rootRef" class="st-lang-switch" @click.stop="toggleOpen">
    <AppIcon name="globe-search" />
    <span class="st-lang-switch__label">{{ currentLangLabel }}</span>
    <AppIcon
      name="chevron-down"
      class="st-lang-switch__arrow"
      :class="{ 'st-lang-switch__arrow--open': open }"
    />
    <transition name="st-dropdown">
      <div v-if="open" class="st-lang-dropdown">
        <button
          v-for="option in languageOptions"
          :key="option.value"
          class="st-lang-option"
          :class="{ 'st-lang-option--active': currentLanguage === option.value }"
          type="button"
          @click.stop="selectLanguage(option.value)"
        >
          <span>{{ option.label }}</span>
          <AppIcon v-if="currentLanguage === option.value" name="check-circle" class="st-lang-option__check" />
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useAppLanguage } from '../../shared/i18n/appLanguage'
import AppIcon from '../../shared/ui/AppIcon.vue'

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const { currentLanguage, languageOptions } = useAppLanguage()

const currentLangLabel = computed(() => {
  return languageOptions.value.find((option) => option.value === currentLanguage.value)?.label ?? currentLanguage.value
})

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
})

function toggleOpen(): void {
  open.value = !open.value
}

function selectLanguage(value: 'zh-CN' | 'en-US'): void {
  currentLanguage.value = value
  open.value = false
}

function closeOnOutsideClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Node && rootRef.value?.contains(target)) {
    return
  }
  open.value = false
}
</script>

<style scoped lang="scss">
.st-lang-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  color: #1e293b;
  font-size: 13px;
  font-weight: 700;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, color 0.22s ease;
  user-select: none;

  > :deep(.app-icon) {
    font-size: 15px;
    color: #0d9488;
    flex-shrink: 0;
  }

  &:hover {
    border-color: #99f6e4;
    background: #f0fdfa;
    color: #0f766e;
    box-shadow: 0 4px 12px rgba(15, 118, 110, 0.1);
  }
}

.st-lang-switch__label {
  min-width: 48px;
}

.st-lang-switch__arrow {
  font-size: 14px;
  color: #94a3b8;
  transition: transform 0.25s ease;
  flex-shrink: 0;

  &--open {
    transform: rotate(180deg);
  }
}

.st-lang-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 140px;
  padding: 6px;
  z-index: 30;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.13),
    0 3px 10px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.st-lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;

  &:hover,
  &--active {
    background: #f0fdfa;
    color: #0f766e;
  }
}

.st-lang-option__check {
  font-size: 15px;
  color: #0d9488;
  flex-shrink: 0;
}

.st-dropdown-enter-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.st-dropdown-leave-active {
  transition: opacity 0.15s ease-in, transform 0.18s ease-in;
}

.st-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.st-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
