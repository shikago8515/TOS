<template>
  <section class="precheck-panel">
    <header class="precheck-header">
      <div>
        <h3>文件预检查</h3>
        <p>{{ summary }}</p>
      </div>
    </header>

    <div class="precheck-list">
      <article v-for="group in prechecks" :key="group.label" class="precheck-row">
        <span class="status-dot" :class="`status-dot--${group.status}`" />
        <span class="precheck-main">
          <strong>{{ group.label }}</strong>
          <small>{{ group.message }}</small>
          <span v-if="group.files.length > 0" class="file-chip-row">
            <em v-for="file in group.files.slice(0, 4)" :key="file.name" class="file-chip">
              {{ file.name }}
            </em>
          </span>
          <ul v-if="group.issues.length > 0" class="issue-list">
            <li v-for="issue in group.issues" :key="issue">{{ issue }}</li>
          </ul>
        </span>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import {
  buildFilePrechecks,
  type FileGroupState,
} from '../files/fileGroups'

const props = defineProps<{
  groups: readonly FileGroupState[]
}>()

const prechecks = computed(() => buildFilePrechecks(props.groups))

const summary = computed(() => {
  const hasErrors = prechecks.value.some((group) =>
    group.status === 'error' || group.status === 'empty',
  )

  if (hasErrors) {
    return '请先补齐必传文件，再开始处理。'
  }

  return '必传文件已就绪，可以开始处理。'
})
</script>

<style scoped>
.precheck-panel {
  display: grid;
  gap: 14px;
  margin-bottom: 20px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #e0e8f0;
  border-radius: 8px;
}

.precheck-header h3,
.precheck-header p {
  margin: 0;
}

.precheck-header h3 {
  color: #172033;
  font-size: 16px;
}

.precheck-header p {
  margin-top: 4px;
  color: #687789;
  font-size: 13px;
}

.precheck-list {
  display: grid;
  gap: 10px;
}

.precheck-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  margin-top: 6px;
  border-radius: 999px;
}

.status-dot--ready {
  background: #16a34a;
}

.status-dot--warning {
  background: #d97706;
}

.status-dot--error,
.status-dot--empty {
  background: #dc2626;
}

.precheck-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.precheck-main strong {
  color: #172033;
  font-size: 14px;
}

.precheck-main small {
  color: #667789;
  font-size: 13px;
}

.file-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.file-chip {
  max-width: 240px;
  padding: 4px 8px;
  overflow: hidden;
  color: #475569;
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #ffffff;
  border: 1px solid #dbe4ef;
  border-radius: 999px;
}

.issue-list {
  display: grid;
  gap: 2px;
  padding: 0;
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 12px;
  list-style: none;
}
</style>
