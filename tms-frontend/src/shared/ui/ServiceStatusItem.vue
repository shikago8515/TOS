<template>
  <li class="status-item">
    <span>
      <strong>{{ label }}</strong>
      <small>{{ description }}</small>
    </span>
    <em :class="`status-pill status-pill--${tone}`">{{ status }}</em>
  </li>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    description: string
    status: string
    tone?: 'online' | 'ready' | 'working'
  }>(),
  {
    tone: 'ready',
  },
)
</script>

<style scoped>
.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 58px;
  padding: 12px 0;
  border-bottom: 1px solid #e4ecf2;
}

.status-item:last-child {
  border-bottom: 0;
}

span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

strong {
  color: #172033;
  font-size: 14px;
}

small {
  color: #6f7f91;
  font-size: 12px;
}

.status-pill {
  flex: 0 0 auto;
  padding: 4px 9px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  border-radius: 999px;
}

.status-pill--online {
  color: #1d715c;
  background: #e5f5ef;
}

.status-pill--ready {
  color: #205e91;
  background: #e6f2fb;
}

.status-pill--working {
  color: #8a6320;
  background: #fff2d4;
}
</style>
