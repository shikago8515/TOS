<template>
  <div class="infornexus-panel">
    <div class="table-content">
      <div class="table-head">
        <div class="head-cell head-cell--index">序号</div>
        <div class="head-cell head-cell--module">模块信息</div>
        <div class="head-cell">运行方式</div>
        <div class="head-cell">入口文件</div>
        <div class="head-cell">状态</div>
        <div class="head-cell head-cell--action">操作</div>
      </div>

      <article class="table-row">
        <div class="row-cell row-cell--index">
          <span class="index-cell">1</span>
        </div>
        <div class="row-cell row-cell--module">
          <div class="module-info-cell">
            <div class="module-icon">IF</div>
            <div class="module-text">
              <span class="module-name">{{ moduleInfo?.name || 'Infornexus' }}</span>
              <span class="module-meta">模块 ID：{{ moduleInfo?.id || 'infornexus' }}</span>
              <small class="module-desc">当前按外部 Electron 子应用方式接入。</small>
            </div>
          </div>
        </div>
        <div class="row-cell">
          <span class="cell-text">外部 Electron 子应用</span>
        </div>
        <div class="row-cell">
          <div class="text-stack">
            <strong>{{ entryPath }}</strong>
            <small>部署时请保留完整运行时目录</small>
          </div>
        </div>
        <div class="row-cell">
          <span class="status-tag" :class="statusClass(statusTone)">
            {{ statusLabel }}
          </span>
        </div>
        <div class="row-cell row-cell--action">
          <div class="action-buttons">
            <button class="action-btn launch-btn" type="button" :disabled="!canLaunch" @click="$emit('launch')">
              启动
            </button>
          </div>
        </div>
      </article>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { ExternalModuleInfo } from '../../../types/electronApi'
import type { InfornexusNoticeTone } from '../infornexusModel'

defineEmits<{
  (e: 'launch'): void
}>()

defineProps<{
  moduleInfo: ExternalModuleInfo | null
  entryPath: string
  statusLabel: string
  statusTone: InfornexusNoticeTone
  canLaunch: boolean
}>()

function statusClass(tone: InfornexusNoticeTone): string {
  if (tone === 'success') return 'status-tag--success'
  if (tone === 'warning') return 'status-tag--warning'
  if (tone === 'error') return 'status-tag--danger'
  return 'status-tag--info'
}
</script>

<style scoped lang="scss">
.table-head,
.table-row {
  display: grid;
  grid-template-columns: 80px minmax(240px, 1.7fr) 160px minmax(280px, 1.8fr) 120px 120px;
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
  min-height: 92px;
  border-bottom: 1px solid #eef2f7;
}

.index-cell {
  color: #94a3b8;
  font-family: monospace;
  font-size: 13px;
}

.module-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.module-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.module-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.module-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.module-meta,
.module-desc,
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

.status-tag--warning {
  background: #fff7ed;
  color: #ea580c;
}

.status-tag--danger {
  background: #fef2f2;
  color: #dc2626;
}

.status-tag--info {
  background: #eff6ff;
  color: #2563eb;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.action-btn {
  min-width: 60px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #d4dbe7;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
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

@media (max-width: 1100px) {
  .table-head,
  .table-row {
    grid-template-columns: 60px minmax(220px, 1.7fr) 140px minmax(220px, 1.4fr) 110px 100px;
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
}
</style>
