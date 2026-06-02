<template>
  <div class="browser-plugins-panel">
    <div v-if="plugins.length" class="table-content">
      <div class="table-head">
        <div class="head-cell head-cell--index">序号</div>
        <div class="head-cell head-cell--plugin">插件信息</div>
        <div class="head-cell">目标站点</div>
        <div class="head-cell">执行模式</div>
        <div class="head-cell">状态</div>
        <div class="head-cell head-cell--action">操作</div>
      </div>

      <article v-for="(plugin, index) in plugins" :key="plugin.id" class="table-row">
        <div class="row-cell row-cell--index">
          <span class="index-cell">{{ index + 1 }}</span>
        </div>
        <div class="row-cell row-cell--plugin">
          <div class="plugin-info-cell">
            <div class="plugin-icon">BP</div>
            <div class="plugin-text">
              <span class="plugin-name">{{ plugin.name }}</span>
              <span class="plugin-meta">
                {{ plugin.provider || '业务网页' }} · {{ plugin.category || '-' }}
              </span>
              <small class="plugin-desc">{{ plugin.description }}</small>
            </div>
          </div>
        </div>
        <div class="row-cell">
          <div class="text-stack">
            <strong>{{ getPrimaryPatternHost(plugin) }}</strong>
            <small>{{ plugin.targetUrl || plugin.matchPatterns[0] || '-' }}</small>
          </div>
        </div>
        <div class="row-cell">
          <span class="mode-tag" :class="{ 'mode-tag--preview': plugin.previewOnly }">
            {{ plugin.previewOnly ? '预览配置' : '真实执行' }}
          </span>
        </div>
        <div class="row-cell">
          <span class="status-tag" :class="statusClass(getBrowserPluginStatusTone(plugin))">
            {{ getBrowserPluginStatusLabel(plugin) }}
          </span>
        </div>
        <div class="row-cell row-cell--action">
          <div class="action-buttons">
            <button
              class="action-btn launch-btn"
              type="button"
              :disabled="
                plugin.previewOnly ||
                !plugin.available ||
                !plugin.browserAvailable ||
                launchingId === plugin.id
              "
              @click="$emit('launch', plugin.id)"
            >
              {{ launchingId === plugin.id ? '启动中' : '启动' }}
            </button>
            <button
              class="action-btn"
              type="button"
              :disabled="!plugin.targetUrl"
              @click="$emit('open-target', plugin.targetUrl)"
            >
              站点
            </button>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">PL</div>
      <p>暂无可展示的浏览器插件</p>
      <span>请先确认桌面端插件注册结果，或切换到具备浏览器桥接能力的运行环境。</span>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { BrowserPluginInfo } from '../../../types/electronApi'
import {
  getBrowserPluginStatusLabel,
  getBrowserPluginStatusTone,
  type BrowserPluginStatusTone,
} from '../browserPluginsModel'

defineEmits<{
  (e: 'launch', pluginId: string): void
  (e: 'open-target', url?: string): void
}>()

defineProps<{
  plugins: BrowserPluginInfo[]
  launchingId: string
}>()

function statusClass(tone: BrowserPluginStatusTone): string {
  if (tone === 'success') return 'status-tag--success'
  if (tone === 'warning') return 'status-tag--warning'
  return 'status-tag--danger'
}

function getPrimaryPatternHost(plugin: BrowserPluginInfo): string {
  const candidate = plugin.targetUrl || plugin.matchPatterns[0]

  if (!candidate) {
    return '-'
  }

  try {
    const normalized = candidate.endsWith('/*') ? candidate.slice(0, -2) : candidate
    return new URL(normalized).host
  } catch {
    return candidate
  }
}
</script>

<style scoped lang="scss">
.table-content {
  width: 100%;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 80px minmax(240px, 2fr) minmax(180px, 1.2fr) 120px 120px 160px;
  gap: 0;
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

.index-cell {
  color: #94a3b8;
  font-family: monospace;
  font-size: 13px;
}

.plugin-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.plugin-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.plugin-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.plugin-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.plugin-meta,
.plugin-desc,
.text-stack small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.plugin-desc,
.text-stack,
.text-stack strong {
  word-break: break-word;
}

.text-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.text-stack strong {
  color: #0f172a;
  font-size: 13px;
}

.mode-tag,
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

.mode-tag {
  background: #ecfeff;
  color: #0f766e;
}

.mode-tag--preview {
  background: #fffbeb;
  color: #b45309;
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

.action-buttons {
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

.empty-state {
  padding: 40px 16px;
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
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
}

.empty-state p {
  margin: 0;
  color: #0f172a;
  font-weight: 600;
}

.empty-state span {
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .table-head,
  .table-row {
    grid-template-columns: 60px minmax(220px, 2fr) minmax(150px, 1.1fr) 110px 110px 140px;
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
