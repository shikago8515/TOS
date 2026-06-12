<template>
  <div class="web-automation-panel">
    <div v-if="apps.length" class="table-content">
      <div class="table-head">
        <div class="head-cell head-cell--index">{{ text('序号') }}</div>
        <div class="head-cell head-cell--app">{{ text('控制台信息') }}</div>
        <div class="head-cell">{{ text('供应方') }}</div>
        <div class="head-cell">{{ text('地址') }}</div>
        <div class="head-cell">{{ text('状态') }}</div>
        <div class="head-cell head-cell--action">{{ text('操作') }}</div>
      </div>

      <article
        v-for="(app, index) in apps"
        :key="app.id"
        class="table-row"
        :class="{ 'table-row--active': activeAppId === app.id }"
      >
        <div class="row-cell row-cell--index">
          <span class="index-cell">{{ index + 1 }}</span>
        </div>
        <div class="row-cell row-cell--app">
          <div class="app-info-cell">
            <div class="app-icon">WA</div>
            <div class="app-text">
              <span class="app-name">{{ text(app.name) }}</span>
              <span class="app-meta">{{ text(app.category || '网页自动化') }} · {{ app.version || '-' }}</span>
              <small class="app-desc">{{ text(app.description || '') }}</small>
            </div>
          </div>
        </div>
        <div class="row-cell">
          <span class="cell-text">{{ app.provider || 'Playwright' }}</span>
        </div>
        <div class="row-cell">
          <div class="text-stack">
            <strong>{{ app.url }}</strong>
            <small>{{ text('端口') }} {{ app.port || '-' }}</small>
          </div>
        </div>
        <div class="row-cell">
          <span class="status-tag" :class="statusClass(getAutomationAppStatusTone(app))">
            {{ text(getAutomationAppStatusLabel(app)) }}
          </span>
        </div>
        <div class="row-cell row-cell--action">
          <div class="action-buttons">
            <button class="action-btn" type="button" @click="$emit('select', app.id)">{{ text('查看') }}</button>
            <button
              class="action-btn launch-btn"
              type="button"
              :disabled="!app.available || launching || activeAppId !== app.id"
              @click="$emit('start')"
            >
              {{ text('启动') }}
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">WA</div>
      <p>{{ text('暂无已注册的网页自动化应用') }}</p>
      <span>{{ text('请先确认桌面端控制台模块已正常注册并暴露给当前前端。') }}</span>
    </div>

    <div class="workspace-panel">
      <div class="workspace-header">
        <div>
          <h4>{{ activeApp ? text(activeApp.name) : text('当前未选择控制台') }}</h4>
          <p>
            {{ activeApp ? text(activeApp.description || '') : text('从上方列表选择一个控制台后，这里会显示地址、状态和嵌入预览。') }}
          </p>
        </div>
        <div v-if="activeApp" class="workspace-actions">
          <button class="action-btn" type="button" :disabled="!activeApp.running" @click="$emit('open')">
            {{ text('外部打开') }}
          </button>
          <button class="action-btn" type="button" :disabled="!activeApp.running" @click="$emit('stop')">
            {{ text('停止') }}
          </button>
        </div>
      </div>

      <div v-if="activeApp" class="workspace-meta">
        <article class="meta-card">
          <span>{{ text('当前地址') }}</span>
          <strong>{{ activeApp.url }}</strong>
        </article>
        <article class="meta-card">
          <span>{{ text('当前状态') }}</span>
          <strong>{{ text(getAutomationAppStatusLabel(activeApp)) }}</strong>
        </article>
        <article class="meta-card">
          <span>{{ text('供应方') }}</span>
          <strong>{{ activeApp.provider || 'Playwright' }}</strong>
        </article>
        <article class="meta-card">
          <span>{{ text('版本 / 端口') }}</span>
          <strong>{{ activeApp.version || '-' }} / {{ activeApp.port || '-' }}</strong>
        </article>
      </div>

      <div v-if="activeApp?.running && consoleUrl" class="console-frame-wrap">
        <iframe class="console-frame" :src="consoleUrl" :title="text('网页自动化控制台')" />
      </div>

      <div v-else class="preview-empty">
        <strong>{{ text('控制台尚未启动') }}</strong>
        <span>{{ text('启动后会在这里嵌入控制台页面，便于你直接验证真实流程。') }}</span>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { AutomationAppInfo } from '../../../types/electronApi'
import {
  getAutomationAppStatusLabel,
  getAutomationAppStatusTone,
  type AutomationAppStatusTone,
} from '../webAutomationModel'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

const { text } = useAppLanguage()

defineEmits<{
  (e: 'select', appId: string): void
  (e: 'start'): void
  (e: 'stop'): void
  (e: 'open'): void
}>()

defineProps<{
  apps: AutomationAppInfo[]
  activeAppId: string
  activeApp: AutomationAppInfo | null
  consoleUrl: string
  launching: boolean
}>()

function statusClass(tone: AutomationAppStatusTone): string {
  if (tone === 'success') return 'status-tag--success'
  if (tone === 'info') return 'status-tag--info'
  return 'status-tag--danger'
}
</script>

<style scoped lang="scss">
.table-head,
.table-row {
  display: grid;
  grid-template-columns: 80px minmax(240px, 2fr) 140px minmax(220px, 1.4fr) 120px 150px;
  align-items: stretch;
}

.table-head {
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  min-height: 50px;
  border-bottom: 1px solid #e2e8f0;
}

.head-cell,
.row-cell {
  padding: 14px 16px;
  display: flex;
  align-items: center;
}

.table-row {
  min-height: 88px;
  border-bottom: 1px solid #eef2f7;
  transition: all 0.2s ease;
}

.table-row:hover {
  background: #f8fafc;
}

.table-row--active {
  background: #f0fdfa;
  box-shadow: inset 3px 0 0 #0d9488;
}

.index-cell {
  color: #94a3b8;
  font-family: monospace;
  font-size: 13px;
}

.app-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.app-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #34d399, #059669);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.app-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.app-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.app-meta,
.app-desc,
.cell-text,
.text-stack small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.text-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  word-break: break-word;
}

.text-stack strong {
  color: #0f172a;
  font-size: 13px;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-tag--success {
  background: #ecfdf5;
  color: #059669;
}

.status-tag--info {
  background: #eff6ff;
  color: #2563eb;
}

.status-tag--danger {
  background: #fef2f2;
  color: #dc2626;
}

.action-buttons,
.workspace-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  min-width: 52px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #d4dbe7;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn:hover:not(:disabled) {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.launch-btn {
  border-color: #99f6e4;
  color: #0d9488;
}

.launch-btn:hover:not(:disabled) {
  background: #f0fdfa;
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.workspace-panel {
  border-top: 1px solid #e2e8f0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workspace-header h4 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.workspace-header p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.7;
}

.workspace-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.meta-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.meta-card span {
  color: #64748b;
  font-size: 12px;
}

.meta-card strong {
  color: #0f172a;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.console-frame-wrap {
  min-height: 520px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #dbeafe;
  background: #ffffff;
}

.console-frame {
  width: 100%;
  min-height: 520px;
  border: none;
  display: block;
}

.preview-empty,
.empty-state {
  padding: 32px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #34d399, #059669);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
}

.preview-empty strong,
.empty-state p {
  margin: 0;
  color: #0f172a;
  font-weight: 600;
}

.preview-empty span,
.empty-state span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 1100px) {
  .table-head,
  .table-row {
    grid-template-columns: 60px minmax(220px, 2fr) 120px minmax(180px, 1.2fr) 110px 140px;
  }
}

@media (max-width: 960px) {
  .table-head {
    display: none;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 14px 16px;
  }

  .row-cell {
    padding: 0;
  }

  .workspace-header {
    flex-direction: column;
  }

  .workspace-meta {
    grid-template-columns: 1fr;
  }
}
</style>
