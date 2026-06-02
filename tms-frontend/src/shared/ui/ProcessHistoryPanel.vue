<template>
  <section class="history-panel">
    <header class="history-heading">
      <div class="history-heading__left">
        <div class="history-heading__icon">
          <AppIcon name="clock" />
        </div>
        <div>
          <h3>{{ text('处理记录') }}</h3>
          <p>{{ text('最近 20 次本机处理记录。') }}</p>
        </div>
      </div>
      <button type="button" :disabled="records.length === 0" @click="$emit('clear')">
        <AppIcon name="refresh-cw" />
        {{ text('清空') }}
      </button>
    </header>

    <div v-if="records.length > 0" class="history-list">
      <article v-for="(record, idx) in records" :key="record.id" class="history-row">
        <div class="history-timeline">
          <div class="timeline-dot" :class="`timeline-dot--${record.status}`" />
          <div v-if="idx < records.length - 1" class="timeline-line" />
        </div>
        <div class="history-content">
          <div class="history-title">
            <strong>{{ text(record.moduleName) }}</strong>
            <span :class="`history-status history-status--${record.status}`">
              <AppIcon :name="record.status === 'success' ? 'check-circle' : 'alert-circle'" />
              {{ record.status === 'success' ? text('成功') : text('失败') }}
            </span>
            <time>{{ formatTime(record.createdAt) }}</time>
          </div>
          <p>{{ text(record.message) }}</p>
          <div class="history-files">
            <span v-for="file in record.inputFiles.slice(0, 4)" :key="file">
              <AppIcon name="file-search" />
              {{ text(file) }}
            </span>
            <span v-if="record.inputFiles.length > 4" class="history-files__more">
              {{ text(`+${record.inputFiles.length - 4}`) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-history">
      <AppIcon name="folder" />
      <p>{{ text('暂无处理记录') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProcessHistoryRecord } from '../process/processHistory'
import { useAppLanguage } from '../i18n/appLanguage'
import AppIcon from './AppIcon.vue'

defineEmits<{
  clear: []
}>()

defineProps<{
  records: ProcessHistoryRecord[]
}>()

const { currentLanguage, text } = useAppLanguage()

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(currentLanguage.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<style scoped>
.history-panel {
  display: grid;
  gap: 16px;
  margin-top: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e8eef3;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 16px rgba(0, 0, 0, 0.02);
  animation: panelSlideIn 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.25s both;
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-heading__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-heading__icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f9ff, #eff6ff);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  flex-shrink: 0;
}

.history-heading__icon .app-icon {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

h3, p {
  margin: 0;
}

h3 {
  color: #1e293b;
  font-size: 17px;
  font-weight: 700;
}

.history-heading p,
.empty-history p {
  margin-top: 2px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

button {
  min-height: 34px;
  padding: 0 14px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

button .app-icon {
  width: 14px;
  height: 14px;
}

button:hover:not(:disabled) {
  background: #f0fdfa;
  border-color: #99f6e4;
  color: #0d9488;
  transform: translateY(-1px);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* --- Timeline --- */
.history-list {
  display: grid;
  gap: 0;
}

.history-row {
  display: flex;
  gap: 14px;
  transition: all 0.2s ease;
}

.history-row:hover {
  background: #f8fafc;
  border-radius: 10px;
}

.history-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: 6px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.timeline-dot--success {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
}

.timeline-dot--error {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: linear-gradient(180deg, #e2e8f0, transparent);
  margin: 4px 0;
}

.history-content {
  display: grid;
  gap: 6px;
  padding: 10px 12px 14px 0;
  min-width: 0;
  flex: 1;
  border-bottom: 1px solid #f1f5f9;
}

.history-row:last-child .history-content {
  border-bottom: none;
}

.history-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.history-title strong {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

time {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  margin-left: auto;
}

.history-status {
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.history-status .app-icon {
  width: 12px;
  height: 12px;
}

.history-status--success {
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #d1fae5;
}

.history-status--error {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.history-row p {
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.history-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-files span {
  max-width: 200px;
  padding: 3px 10px;
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f8fafc;
  border: 1px solid #e8eef3;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.history-files span .app-icon {
  width: 11px;
  height: 11px;
  color: #94a3b8;
}

.history-files__more {
  background: linear-gradient(135deg, #f0fdfa, #ecfdf5) !important;
  color: #0d9488 !important;
  border-color: #a7f3d0 !important;
  font-weight: 700 !important;
}

/* --- Empty State --- */
.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0;
  color: #94a3b8;
}

.empty-history .app-icon {
  width: 36px;
  height: 36px;
  opacity: 0.4;
}

.empty-history p {
  margin: 0;
}
</style>
