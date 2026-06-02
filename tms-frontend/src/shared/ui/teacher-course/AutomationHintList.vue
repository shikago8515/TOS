<template>
  <section class="hint-section">
    <div class="hint-header">
      <h4>{{ title }}</h4>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="hint-list">
      <article v-for="(item, index) in items" :key="`${index}-${item}`" class="hint-item">
        <span class="hint-index">{{ index + 1 }}</span>
        <p>{{ item }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    items: readonly string[] | string[]
  }>(),
  {
    description: '',
  },
)
</script>

<style scoped lang="scss">
.hint-section {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #fbfcfe;
}

.hint-header {
  margin-bottom: 12px;
}

.hint-header h4 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.hint-header p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.hint-list {
  display: grid;
  gap: 10px;
}

.hint-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.hint-index {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
}

.hint-item p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}
</style>
