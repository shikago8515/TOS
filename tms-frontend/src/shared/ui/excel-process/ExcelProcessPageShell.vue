<template>
  <section class="jane-page-container">
    <div class="jane-header">
      <div class="jane-header__title">
        <h2>{{ text(title) }}</h2>
        <p v-if="subtitle" class="jane-header__subtitle">{{ text(subtitle) }}</p>
      </div>

      <div v-if="stats.length > 0" class="jane-header__stats">
        <div v-for="stat in stats" :key="stat.id" class="jane-stat">
          <div class="jane-stat__icon" :class="`jane-stat__icon--${stat.tone ?? 'slate'}`">
            <AppIcon v-if="stat.icon" :name="stat.icon" />
            <span v-else>{{ stat.iconText ?? '' }}</span>
          </div>
          <div class="jane-stat__info">
            <span class="jane-stat__label">{{ text(stat.label) }}</span>
            <span class="jane-stat__value">{{ text(String(stat.value)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="jane-toolbar">
      <span class="jane-toolbar__status">{{ text(toolbarStatus) }}</span>
      <div class="jane-toolbar__actions">
        <button
          v-for="action in visibleActions"
          :key="action.id"
          class="jane-toolbar__btn"
          :class="{ 'jane-toolbar__btn--primary': action.primary }"
          type="button"
          :title="action.title ? text(action.title) : undefined"
          :disabled="action.disabled"
          @click="runAction(action)"
        >
          <AppIcon v-if="action.icon" :name="action.icon" />
          {{ text(action.label) }}
        </button>
      </div>
    </div>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAppLanguage } from '../../i18n/appLanguage'
import AppIcon from '../AppIcon.vue'
import type { ExcelPageStat, ExcelToolbarAction } from './types'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    stats?: ExcelPageStat[]
    toolbarStatus: string
    actions?: ExcelToolbarAction[]
  }>(),
  {
    subtitle: '',
    stats: () => [],
    actions: () => [],
  },
)

const { text } = useAppLanguage()

const visibleActions = computed(() =>
  props.actions.filter((action) => action.visible !== false),
)

function runAction(action: ExcelToolbarAction): void {
  void action.onClick()
}
</script>
