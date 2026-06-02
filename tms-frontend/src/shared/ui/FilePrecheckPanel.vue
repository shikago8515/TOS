<template>
  <section class="precheck-panel">
    <header class="precheck-header">
      <div class="precheck-header__icon">
        <AppIcon name="shield-check" />
      </div>
      <div class="precheck-header__text">
        <h3>{{ text('文件预检查') }}</h3>
        <p>{{ text(summary) }}</p>
      </div>
    </header>

    <div class="precheck-list">
      <article
        v-for="group in prechecks"
        :key="group.label"
        class="precheck-row"
        :class="`precheck-row--${group.status}`"
      >
        <div class="status-indicator">
          <span class="status-dot" :class="`status-dot--${group.status}`" />
          <span class="status-line" />
        </div>
        <span class="precheck-main">
          <strong>{{ text(group.label) }}</strong>
          <small>{{ text(group.message) }}</small>
          <span v-if="group.files.length > 0" class="file-chip-row">
            <em v-for="file in group.files.slice(0, 4)" :key="file.name" class="file-chip">
              <AppIcon name="file-search" />
              {{ file.name }}
            </em>
          </span>
          <ul v-if="group.issues.length > 0" class="issue-list">
            <li v-for="issue in group.issues" :key="issue">
              <AppIcon name="alert-circle" />
              {{ text(issue) }}
            </li>
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
import { useAppLanguage } from '../i18n/appLanguage'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  groups: readonly FileGroupState[]
}>()

const prechecks = computed(() => buildFilePrechecks(props.groups))
const { text } = useAppLanguage()

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
  gap: 16px;
  margin-bottom: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e8eef3;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 16px rgba(0, 0, 0, 0.02);
  animation: panelSlideIn 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) 0.15s both;
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

.precheck-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.precheck-header__icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0fdfa, #ecfdf5);
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  flex-shrink: 0;
}

.precheck-header__icon .app-icon {
  width: 20px;
  height: 20px;
  color: #0d9488;
}

.precheck-header__text {
  display: grid;
  gap: 4px;
}

.precheck-header h3,
.precheck-header p {
  margin: 0;
}

.precheck-header h3 {
  color: #1e293b;
  font-size: 17px;
  font-weight: 700;
}

.precheck-header p {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.precheck-list {
  display: grid;
  gap: 8px;
}

.precheck-row {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e8eef3;
  border-radius: 12px;
  border-left: 3px solid transparent;
  transition: all 0.25s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.precheck-row--ready {
  border-left-color: #10b981;
}

.precheck-row--warning {
  border-left-color: #f59e0b;
}

.precheck-row--error,
.precheck-row--empty {
  border-left-color: #ef4444;
}

.precheck-row:hover {
  background: #f0fdfa;
  border-color: #99f6e4;
  transform: translateX(4px);
}

.precheck-row--ready:hover {
  border-left-color: #10b981;
}

.status-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 4px;
}

.status-dot {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 999px;
}

.status-line {
  width: 2px;
  flex: 1;
  background: #e2e8f0;
  border-radius: 2px;
  min-height: 12px;
}

.status-dot--ready {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.status-dot--warning {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
}

.status-dot--error,
.status-dot--empty {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.precheck-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.precheck-main strong {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
}

.precheck-main small {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.file-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.file-chip {
  max-width: 240px;
  padding: 4px 12px;
  overflow: hidden;
  color: #0d9488;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f0fdfa;
  border: 1px solid #ccfbf1;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.file-chip .app-icon {
  width: 12px;
  height: 12px;
}

.issue-list {
  display: grid;
  gap: 4px;
  padding: 0;
  margin: 6px 0 0;
  color: #dc2626;
  font-size: 12px;
  font-weight: 500;
  list-style: none;
}

.issue-list li {
  display: flex;
  align-items: center;
  gap: 4px;
}

.issue-list li .app-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
