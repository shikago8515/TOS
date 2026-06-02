<template>
  <article class="stat-card" :class="colorTone">
    <div class="card-content">
      <div class="card-info">
        <span class="label">{{ label }}</span>
        <span class="value">{{ value }}</span>
      </div>
      <div class="card-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      </div>
    </div>
    <div class="card-action">
      <span>{{ detail }}</span>
      <svg class="action-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | string
    detail: string
    tone?: 'blue' | 'green' | 'amber'
  }>(),
  {
    tone: 'blue',
  },
)

const colorTone = computed(() => {
  if (props.tone === 'blue') return 'teal'
  if (props.tone === 'green') return 'green'
  return 'orange'
})
</script>

<style scoped>
.stat-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: auto;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(37, 102, 139, 0.08);
  border-color: #99f6e4;
}

.stat-card:hover .card-icon-wrapper {
  transform: scale(1.05);
}

.stat-card:hover .card-action {
  color: #0f172a;
}
.stat-card:hover .action-icon {
  transform: translateX(4px);
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 2;
  margin-bottom: 12px;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 500;
}

.value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.card-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
  color: #ffffff;
}

.card-action {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  margin-top: auto;
  transition: color 0.3s;
  z-index: 2;
}

.action-icon {
  transition: transform 0.3s ease;
}

/* 颜色变体 */
.stat-card.teal .card-icon-wrapper { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.stat-card.orange .card-icon-wrapper { background: linear-gradient(135deg, #fb923c, #ea580c); }
.stat-card.green .card-icon-wrapper { background: linear-gradient(135deg, #34d399, #059669); }
</style>
