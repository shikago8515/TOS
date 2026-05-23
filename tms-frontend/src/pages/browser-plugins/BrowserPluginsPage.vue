<template>
  <section class="browser-plugins-page">
    <div class="page-panel">
      <header class="panel-header">
        <div>
          <p class="panel-kicker">自动化试验区</p>
          <h2 class="panel-title">
            浏览器插件
            <span class="stage-badge">测试阶段</span>
          </h2>
          <p class="panel-description">
            这个模块用于验证业务网页插件方案，当前还需要业务部在真实流程中试用后反馈问题。
          </p>
        </div>

        <button class="toolbar-button" type="button" :disabled="loading" @click="refreshPlugins">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </header>

      <div class="stage-alert">
        {{ browserPluginStageMessage }}
      </div>

      <div v-if="message" class="status-alert" :class="`status-alert--${messageTone}`">
        {{ message }}
      </div>

      <div v-if="plugins.length" class="plugin-grid">
        <article v-for="plugin in plugins" :key="plugin.id" class="plugin-card">
          <div class="plugin-main">
            <div class="plugin-icon" aria-hidden="true">P</div>
            <div class="plugin-copy">
              <div class="plugin-title-row">
                <h3 class="plugin-title">{{ plugin.name }}</h3>
                <span class="status-tag" :class="`status-tag--${getBrowserPluginStatusTone(plugin)}`">
                  {{ getBrowserPluginStatusLabel(plugin) }}
                </span>
              </div>
              <p class="plugin-description">{{ plugin.description }}</p>
            </div>
          </div>

          <dl class="plugin-meta">
            <div v-for="item in buildBrowserPluginMeta(plugin)" :key="item.label" class="meta-item">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <div class="match-block">
            <span class="match-label">匹配地址</span>
            <div class="match-list">
              <span v-for="pattern in plugin.matchPatterns" :key="pattern" class="match-chip">
                {{ pattern }}
              </span>
            </div>
          </div>

          <div class="plugin-actions">
            <button
              class="action-button action-button--primary"
              type="button"
              :disabled="!plugin.available || !plugin.browserAvailable || launchingId === plugin.id"
              @click="startPlugin(plugin.id)"
            >
              {{ launchingId === plugin.id ? '启动中...' : '启动测试浏览器' }}
            </button>
            <button
              class="action-button"
              type="button"
              :disabled="!plugin.targetUrl"
              @click="openTarget(plugin.targetUrl)"
            >
              打开目标网页
            </button>
          </div>
        </article>
      </div>

      <div v-else-if="!loading" class="empty-state">
        未发现已注册的浏览器插件
      </div>

      <section class="integration-note" aria-label="试用说明">
        <div v-for="note in browserPluginNotes" :key="note" class="note-item">
          <span aria-hidden="true">i</span>
          <p>{{ note }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { BrowserPluginInfo } from '../../types/electronApi'
import {
  browserPluginNotes,
  browserPluginStageMessage,
  buildBrowserPluginMeta,
  getBrowserPluginStatusLabel,
  getBrowserPluginStatusTone,
  type BrowserPluginNoticeTone,
} from './browserPluginsModel'
import {
  fetchBrowserPlugins,
  launchBrowserPlugin,
  openBrowserPluginTarget,
  recordBrowserPluginEvent,
} from './browserPluginsApi'

const plugins = ref<BrowserPluginInfo[]>([])
const loading = ref(false)
const launchingId = ref('')
const message = ref('')
const messageTone = ref<BrowserPluginNoticeTone>('info')

onMounted(() => {
  void refreshPlugins()
})

async function refreshPlugins(): Promise<void> {
  loading.value = true
  message.value = ''

  try {
    plugins.value = await fetchBrowserPlugins()

    if (!plugins.value.length) {
      messageTone.value = 'warning'
      message.value = '未读取到浏览器插件注册表'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '读取浏览器插件失败')
  } finally {
    loading.value = false
  }
}

async function startPlugin(pluginId: string): Promise<void> {
  launchingId.value = pluginId
  message.value = ''

  try {
    const result = await launchBrowserPlugin(pluginId)

    if (result.success) {
      messageTone.value = 'success'
      message.value = `${result.browser || '浏览器'} 已启动，插件已加载`
    } else {
      messageTone.value = 'error'
      message.value = result.error || '启动浏览器插件失败'
    }
  } catch (error) {
    await recordBrowserPluginEvent('launch-exception', {
      pluginId,
      error: readErrorMessage(error, '启动浏览器插件失败'),
    })
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '启动浏览器插件失败')
  } finally {
    launchingId.value = ''
  }
}

async function openTarget(url?: string): Promise<void> {
  if (!url) {
    return
  }

  try {
    const result = await openBrowserPluginTarget(url)

    if (!result.success) {
      messageTone.value = 'error'
      message.value = result.error || '打开网页失败'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '打开网页失败')
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}
</script>

<style scoped>
.browser-plugins-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.page-panel {
  display: grid;
  gap: 18px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.panel-kicker,
.panel-title,
.panel-description {
  margin: 0;
}

.panel-kicker {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-size: 28px;
  line-height: 1.25;
}

.stage-badge {
  flex: 0 0 auto;
  padding: 5px 10px;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 999px;
}

.panel-description {
  max-width: 760px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.toolbar-button,
.action-button {
  min-height: 38px;
  padding: 0 16px;
  color: #334155;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.toolbar-button:hover,
.action-button:hover {
  background: #f8fafc;
}

.toolbar-button:disabled,
.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.stage-alert,
.status-alert {
  padding: 13px 16px;
  font-size: 14px;
  border-radius: 8px;
}

.stage-alert {
  color: #c2410c;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.status-alert--info {
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.status-alert--success {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.status-alert--warning {
  color: #a16207;
  background: #fefce8;
  border: 1px solid #fde68a;
}

.status-alert--error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.plugin-card {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
}

.plugin-main {
  display: flex;
  gap: 14px;
  min-width: 0;
}

.plugin-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  color: #1d4ed8;
  font-weight: 900;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.plugin-copy {
  min-width: 0;
}

.plugin-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.plugin-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  flex: 0 0 auto;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 800;
  border-radius: 999px;
}

.status-tag--success {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.status-tag--danger {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.plugin-description {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
}

.plugin-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.meta-item {
  min-width: 0;
  padding: 11px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.meta-item dt {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.meta-item dd {
  margin: 5px 0 0;
  overflow: hidden;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-block {
  display: grid;
  gap: 8px;
}

.match-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.match-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.match-chip {
  max-width: 100%;
  padding: 5px 8px;
  overflow: hidden;
  color: #1e40af;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
}

.plugin-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.action-button--primary {
  color: #ffffff;
  background: #409eff;
  border-color: #2563eb;
}

.action-button--primary:hover {
  background: #1d4ed8;
}

.empty-state {
  padding: 28px;
  color: #64748b;
  text-align: center;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}

.integration-note {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.note-item {
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
}

.note-item span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 900;
  background: #eff6ff;
  border-radius: 999px;
}

.note-item p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .plugin-grid,
  .integration-note {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .panel-header,
  .plugin-main,
  .plugin-title-row,
  .plugin-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .plugin-meta {
    grid-template-columns: 1fr;
  }
}
</style>
