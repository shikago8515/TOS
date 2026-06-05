<template>
  <li class="svc">
    <div class="svc__dot" :class="`svc__dot--${tone}`">
      <AppIcon :name="statusIcon" />
    </div>
    <div class="svc__body">
      <strong class="svc__label">{{ label }}</strong>
      <span class="svc__desc">{{ description }}</span>
    </div>
    <em class="svc__badge" :class="`svc__badge--${tone}`">{{ status }}</em>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    label: string
    description: string
    status: string
    tone?: 'online' | 'ready' | 'working'
  }>(),
  { tone: 'ready' },
)

const iconMap: Record<string, string> = {
  online: 'check-circle',
  ready: 'shield-check',
  working: 'activity',
}

const statusIcon = computed(() => iconMap[props.tone] || 'activity')
</script>

<style scoped>
.svc {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--soft-bg, #f0f4f8);
  border: none;
  border-radius: var(--soft-radius-sm, 12px);
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.svc:hover {
  background: var(--soft-surface, #ffffff);
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  transform: translateY(-2px);
}

.svc:active {
  box-shadow: var(--soft-shadow-pressed, inset 3px 3px 6px rgba(166,180,200,0.35), inset -3px -3px 6px rgba(255,255,255,0.85));
  transform: translateY(0);
}

.svc__dot {
  width: 36px;
  height: 36px;
  border-radius: var(--soft-radius-xs, 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #ffffff;
  flex-shrink: 0;
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.08),
    -1px -1px 4px rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.svc:hover .svc__dot {
  transform: scale(1.06) rotate(-2deg);
}

.svc__dot--online  { background: linear-gradient(135deg, #34d399, #059669); }
.svc__dot--ready   { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.svc__dot--working { background: linear-gradient(135deg, #fb923c, #ea580c); }

.svc__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.svc__label {
  color: var(--soft-text, #1e293b);
  font-size: 13px;
  font-weight: 600;
}

.svc__desc {
  color: var(--soft-text-muted, #94a3b8);
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svc__badge {
  padding: 4px 12px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
  border: none;
  box-shadow:
    inset 1px 1px 2px rgba(0, 0, 0, 0.04),
    inset -1px -1px 2px rgba(255, 255, 255, 0.9);
}

.svc__badge--online {
  color: #059669;
  background: #ecfdf5;
}

.svc__badge--ready {
  color: #0d9488;
  background: #f0fdfa;
}

.svc__badge--working {
  color: #ea580c;
  background: #fff7ed;
}
</style>
