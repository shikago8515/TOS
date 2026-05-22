<template>
  <article class="metric-tile" :class="`metric-tile--${tone}`">
    <p>{{ label }}</p>
    <strong>{{ value }}</strong>
    <span>{{ detail }}</span>
  </article>
</template>

<script setup lang="ts">
withDefaults(
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
</script>

<style scoped>
.metric-tile {
  display: grid;
  gap: 8px;
  min-width: 0;
  min-height: 132px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #dbe5ee;
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(23, 42, 63, 0.06);
}

p,
span {
  margin: 0;
}

p {
  color: #5f7184;
  font-size: 13px;
  font-weight: 800;
}

strong {
  color: var(--metric-color);
  font-size: 34px;
  line-height: 1;
}

span {
  color: #667789;
  font-size: 13px;
}

.metric-tile--blue {
  --metric-color: #1d6fa7;
}

.metric-tile--green {
  --metric-color: #22866d;
}

.metric-tile--amber {
  --metric-color: #9b6720;
}
</style>
