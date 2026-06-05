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
  background: var(--soft-surface, #ffffff);
  border-radius: var(--soft-radius-sm, 12px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: auto;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  box-shadow: var(--soft-shadow, 6px 6px 14px rgba(166,180,200,0.35), -6px -6px 14px rgba(255,255,255,0.85));
  border: none;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
}

.stat-card:active {
  box-shadow: var(--soft-shadow-pressed, inset 3px 3px 6px rgba(166,180,200,0.35), inset -3px -3px 6px rgba(255,255,255,0.85));
  transform: translateY(0);
}

.stat-card:hover .card-icon-wrapper {
  transform: scale(1.08) rotate(-3deg);
}

.stat-card:hover .card-action {
  color: var(--soft-text, #0f172a);
}
.stat-card:hover .action-icon {
  transform: translateX(4px);
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 2;
  margin-bottom: 14px;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 12px;
  color: var(--soft-text-secondary, #64748b);
  margin-bottom: 4px;
  font-weight: 500;
}

.value {
  font-size: 26px;
  font-weight: 800;
  color: var(--soft-text, #1e293b);
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.card-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: var(--soft-radius-xs, 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  color: #ffffff;
  box-shadow:
    3px 3px 8px rgba(0, 0, 0, 0.1),
    -2px -2px 5px rgba(255, 255, 255, 0.4);
}

.card-action {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--soft-text-muted, #94a3b8);
  margin-top: auto;
  transition: color 0.3s;
  z-index: 2;
}

.action-icon {
  transition: transform 0.3s ease;
}

/* 颜色变体 */
.stat-card.teal .card-icon-wrapper  { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.stat-card.orange .card-icon-wrapper { background: linear-gradient(135deg, #fb923c, #ea580c); }
.stat-card.green .card-icon-wrapper  { background: linear-gradient(135deg, #34d399, #059669); }
</style>
