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
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.22s ease;
}

.svc:hover {
  background: #ffffff;
  border-color: #99f6e4;
  box-shadow: 0 3px 10px rgba(0,0,0,0.04);
  transform: translateY(-1px);
}

.svc__dot {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #ffffff;
  flex-shrink: 0;
}

.svc__dot--online { background: linear-gradient(135deg, #34d399, #059669); }
.svc__dot--ready { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.svc__dot--working { background: linear-gradient(135deg, #fb923c, #ea580c); }

.svc__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.svc__label {
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
}

.svc__desc {
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svc__badge {
  padding: 3px 10px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}

.svc__badge--online {
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.svc__badge--ready {
  color: #0d9488;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
}

.svc__badge--working {
  color: #ea580c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}
</style>
