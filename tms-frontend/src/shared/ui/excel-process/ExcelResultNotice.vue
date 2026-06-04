<template>
  <section v-if="visible && message" class="jane-alert" :class="`jane-alert--${tone}`">
    <p>
      <AppIcon v-if="showIcon" :name="noticeIcon" />
      {{ text(message) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAppLanguage } from '../../i18n/appLanguage'
import AppIcon from '../AppIcon.vue'
import type { ExcelNoticeTone } from './types'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    tone: ExcelNoticeTone
    message: string
    showIcon?: boolean
  }>(),
  {
    visible: true,
    showIcon: true,
  },
)

const { text } = useAppLanguage()

const noticeIcon = computed(() => {
  if (props.tone === 'success') return 'check-circle'
  if (props.tone === 'error') return 'alert-circle'
  return 'activity'
})
</script>
