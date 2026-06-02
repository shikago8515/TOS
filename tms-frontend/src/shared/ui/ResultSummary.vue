<template>
  <section v-if="items.length > 0" class="result-summary">
    <header>
      <div class="result-summary__title">
        <div class="result-summary__icon" :class="`result-summary__icon--${status}`">
          <AppIcon :name="status === 'success' ? 'check-circle' : 'alert-circle'" />
        </div>
        <h3>{{ text('结果摘要') }}</h3>
      </div>
      <span class="status-badge" :class="`status-badge--${status}`">
        <AppIcon :name="status === 'success' ? 'sparkles' : 'alert-circle'" />
        {{ status === 'success' ? text('处理完成') : text('处理失败') }}
      </span>
    </header>

    <div class="summary-grid">
      <article
        v-for="(item, index) in items"
        :key="item.label"
        class="summary-item"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <span class="summary-item__label">{{ text(item.label) }}</span>
        <strong class="summary-item__value">{{ text(item.value) }}</strong>
        <small v-if="item.note" class="summary-item__note">{{ text(item.note) }}</small>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProcessSummaryItem } from '../process/processHistory'
import { useAppLanguage } from '../i18n/appLanguage'
import AppIcon from './AppIcon.vue'

defineProps<{
  items: ProcessSummaryItem[]
  status: 'success' | 'error'
}>()

const { text } = useAppLanguage()
</script>

<style scoped>
.result-summary {
  display: grid;
  gap: 16px;
  margin-top: 20px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e8eef3;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  animation: fadeSlideUp 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-summary__title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-summary__icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.result-summary__icon .app-icon {
  width: 20px;
  height: 20px;
  color: #ffffff;
}

.result-summary__icon--success {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 4px 10px rgba(5, 150, 105, 0.25);
}

.result-summary__icon--error {
  background: linear-gradient(135deg, #f87171, #dc2626);
  box-shadow: 0 4px 10px rgba(220, 38, 38, 0.25);
}

h3 {
  margin: 0;
  color: #1e293b;
  font-size: 17px;
  font-weight: 700;
}

.status-badge {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.status-badge .app-icon {
  width: 14px;
  height: 14px;
}

.status-badge--success {
  color: #059669;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border: 1px solid #a7f3d0;
}

.status-badge--error {
  color: #dc2626;
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border: 1px solid #fecaca;
}

/* --- Grid --- */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.summary-item {
  display: grid;
  gap: 6px;
  min-height: 96px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fafc, #fafcff);
  border: 1px solid #e8eef3;
  border-radius: 14px;
  transition: all 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
  animation: itemFadeIn 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  position: relative;
  overflow: hidden;
}

@keyframes itemFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.summary-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #0d9488, #3b82f6);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.summary-item:hover {
  background: linear-gradient(135deg, #f0fdfa, #f0f9ff);
  border-color: #99f6e4;
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(13, 148, 136, 0.08);
}

.summary-item:hover::before {
  opacity: 1;
}

.summary-item__label {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-item__value {
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, #0f172a, #334155);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.summary-item__note {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}
</style>
