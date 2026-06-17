<template>
  <div class="browser-visibility-switch">
    <div class="browser-visibility-switch__label">
      <AppIcon name="browser" />
      <span>{{ label }}</span>
    </div>
    <div class="browser-visibility-switch__options" role="group" :aria-label="label">
      <button
        type="button"
        class="browser-visibility-switch__option"
        :class="{ 'browser-visibility-switch__option--active': !modelValue }"
        :aria-pressed="!modelValue"
        @click="emit('update:modelValue', false)"
      >
        <AppIcon name="server" />
        <span>{{ backgroundLabel }}</span>
      </button>
      <button
        type="button"
        class="browser-visibility-switch__option"
        :class="{ 'browser-visibility-switch__option--active': modelValue }"
        :aria-pressed="modelValue"
        @click="emit('update:modelValue', true)"
      >
        <AppIcon name="browser" />
        <span>{{ visibleLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  backgroundLabel?: string
  visibleLabel?: string
}>(), {
  label: '浏览器视图',
  backgroundLabel: '后台执行',
  visibleLabel: '打开视图',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped lang="scss">
.browser-visibility-switch {
  display: flex;
  align-items: stretch;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.browser-visibility-switch__label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;

  :deep(.app-icon) {
    color: #0f766e;
    font-size: 15px;
  }
}

.browser-visibility-switch__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  width: 100%;
  border: 1px solid #dbe7f3;
  border-radius: 10px;
  background: #f8fafc;
}

.browser-visibility-switch__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  transition: background .16s ease, box-shadow .16s ease, color .16s ease;

  :deep(.app-icon) {
    font-size: 13px;
  }

  &:hover {
    color: #0f172a;
  }
}

.browser-visibility-switch__option--active {
  background: #ffffff;
  color: #0f766e;
  box-shadow: 0 1px 4px rgba(15, 118, 110, .12);
}

@media (min-width: 980px) {
  .browser-visibility-switch--inline {
    align-items: center;
    flex-direction: row;
  }
}
</style>
