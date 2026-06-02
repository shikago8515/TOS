<template>
  <article class="stat-card">
    <div class="stat-icon" :class="`${toneClass}-bg`">
      <AppIcon :name="iconName" />
    </div>
    <div class="stat-info">
      <span class="stat-label">{{ label }}</span>
      <span class="stat-value" :class="{ 'text-sm': smallValue }">{{ value }}</span>
      <small v-if="detail" class="stat-detail">{{ detail }}</small>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '../AppIcon.vue'

const props = withDefaults(
  defineProps<{
    iconName?: string
    label: string
    value: string
    detail?: string
    tone?: 'blue' | 'violet' | 'green' | 'orange' | 'slate'
    smallValue?: boolean
  }>(),
  {
    iconName: 'activity',
    detail: '',
    tone: 'blue',
    smallValue: false,
  },
)

const toneClass = computed(() => props.tone)
</script>

<style scoped lang="scss">
.stat-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(37, 102, 139, 0.08);
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #ffffff;
  flex-shrink: 0;
}

.blue-bg {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
}

.violet-bg {
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
}

.green-bg {
  background: linear-gradient(135deg, #34d399, #059669);
}

.orange-bg {
  background: linear-gradient(135deg, #fb923c, #ea580c);
}

.slate-bg {
  background: linear-gradient(135deg, #94a3b8, #475569);
}

.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
  word-break: break-word;
}

.text-sm {
  font-size: 18px;
}

.stat-detail {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}
</style>
