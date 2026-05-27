<template>
  <section v-if="items.length > 0" class="result-summary">
    <header>
      <h3>{{ text('结果摘要') }}</h3>
      <span>{{ status === 'success' ? text('处理完成') : text('处理失败') }}</span>
    </header>

    <div class="summary-grid">
      <article v-for="item in items" :key="item.label" class="summary-item">
        <span>{{ text(item.label) }}</span>
        <strong>{{ text(item.value) }}</strong>
        <small v-if="item.note">{{ text(item.note) }}</small>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProcessSummaryItem } from '../process/processHistory'
import { useAppLanguage } from '../i18n/appLanguage'

defineProps<{
  items: ProcessSummaryItem[]
  status: 'success' | 'error'
}>()

const { text } = useAppLanguage()
</script>

<style scoped>
.result-summary {
  display: grid;
  gap: 12px;
  margin-top: 18px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h3 {
  margin: 0;
  color: #172033;
  font-size: 16px;
}

header span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.summary-item {
  display: grid;
  gap: 4px;
  min-height: 82px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.summary-item span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.summary-item strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 1.2;
}

.summary-item small {
  color: #64748b;
  font-size: 12px;
}
</style>
