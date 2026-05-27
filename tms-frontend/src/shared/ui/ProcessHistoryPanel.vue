<template>
  <section class="history-panel">
    <header class="history-heading">
      <div>
        <h3>{{ text('处理记录') }}</h3>
        <p>{{ text('最近 20 次本机处理记录。') }}</p>
      </div>
      <button type="button" :disabled="records.length === 0" @click="$emit('clear')">
        {{ text('清空') }}
      </button>
    </header>

    <div v-if="records.length > 0" class="history-list">
      <article v-for="record in records" :key="record.id" class="history-row">
        <div class="history-title">
          <strong>{{ text(record.moduleName) }}</strong>
          <span :class="`history-status history-status--${record.status}`">
            {{ record.status === 'success' ? text('成功') : text('失败') }}
          </span>
          <time>{{ formatTime(record.createdAt) }}</time>
        </div>
        <p>{{ text(record.message) }}</p>
        <div class="history-files">
          <span v-for="file in record.inputFiles.slice(0, 4)" :key="file">{{ text(file) }}</span>
          <span v-if="record.inputFiles.length > 4">{{ text(`+${record.inputFiles.length - 4} 个文件`) }}</span>
        </div>
      </article>
    </div>

    <p v-else class="empty-history">{{ text('暂无处理记录') }}</p>
  </section>
</template>

<script setup lang="ts">
import type { ProcessHistoryRecord } from '../process/processHistory'
import { useAppLanguage } from '../i18n/appLanguage'

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
  gap: 14px;
  margin-top: 24px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #e0e8f0;
  border-radius: 8px;
}

.history-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h3,
p {
  margin: 0;
}

h3 {
  color: #172033;
  font-size: 16px;
}

.history-heading p,
.empty-history {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

button {
  min-height: 30px;
  padding: 0 12px;
  color: #475569;
  font-weight: 800;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  border-radius: 7px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-row {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 8px;
}

.history-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.history-title strong {
  color: #172033;
  font-size: 13px;
}

time {
  color: #64748b;
  font-size: 12px;
}

.history-status {
  padding: 3px 7px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 999px;
}

.history-status--success {
  color: #1f7a5d;
  background: #e5f5ef;
}

.history-status--error {
  color: #b91c1c;
  background: #fee2e2;
}

.history-row p {
  color: #475569;
  font-size: 13px;
}

.history-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-files span {
  max-width: 220px;
  padding: 4px 8px;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  border-radius: 999px;
}
</style>
