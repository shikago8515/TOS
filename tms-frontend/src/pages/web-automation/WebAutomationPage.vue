<template>
  <section class="web-automation-page">
    <div class="automation-panel">
      <header class="panel-header">
        <div>
          <p class="panel-kicker">自动化试验区</p>
          <h2 class="panel-title">
            网页自动化
            <span class="stage-badge">测试阶段</span>
          </h2>
          <p class="panel-description">
            这个模块用于验证 Playwright 流程控制台，当前还需要业务部按真实场景试用后反馈可落地流程。
          </p>
        </div>

        <div class="header-actions">
          <button class="toolbar-button" type="button" :disabled="loading" @click="refreshApps">
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
          <button
            class="toolbar-button toolbar-button--primary"
            type="button"
            :disabled="!activeApp || !activeApp.available || launching"
            @click="startActiveApp"
          >
            {{ launching ? '启动中...' : '启动测试控制台' }}
          </button>
        </div>
      </header>

      <div class="stage-alert">
        {{ webAutomationStageMessage }}
      </div>

      <div v-if="message" class="status-alert" :class="`status-alert--${messageTone}`">
        {{ message }}
      </div>

      <div v-if="apps.length" class="automation-grid">
        <aside class="app-list" aria-label="网页自动化应用">
          <button
            v-for="app in apps"
            :key="app.id"
            class="app-option"
            :class="{ 'app-option--active': app.id === selectedAppId }"
            type="button"
            @click="selectApp(app.id)"
          >
            <span class="option-icon" aria-hidden="true">A</span>
            <span class="option-copy">
              <strong>{{ app.name }}</strong>
              <small>{{ app.description }}</small>
            </span>
            <span class="status-tag" :class="`status-tag--${getAutomationAppStatusTone(app)}`">
              {{ getAutomationAppStatusLabel(app) }}
            </span>
          </button>
        </aside>

        <section class="workspace">
          <div v-if="activeApp" class="workspace-toolbar">
            <div class="workspace-title">
              <strong>{{ activeApp.name }}</strong>
              <span>{{ activeApp.url }}</span>
            </div>
            <div class="workspace-actions">
              <button
                class="action-button"
                type="button"
                :disabled="!activeApp.running"
                @click="openActiveAppExternal"
              >
                外部打开
              </button>
              <button
                class="action-button"
                type="button"
                :disabled="!activeApp.running"
                @click="stopActiveApp"
              >
                停止服务
              </button>
            </div>
          </div>

          <dl v-if="activeApp" class="app-meta">
            <div v-for="item in buildAutomationAppMeta(activeApp)" :key="item.label" class="meta-item">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>

          <div v-if="activeApp?.running && consoleUrl" class="console-frame-wrap">
            <iframe class="console-frame" :src="consoleUrl" title="网页自动化控制台" />
          </div>

          <div v-else class="empty-console">
            <strong>控制台未启动</strong>
            <span>启动后会在这里嵌入网页自动化控制台。</span>
          </div>
        </section>
      </div>

      <div v-else-if="!loading" class="empty-state">
        未发现已注册的网页自动化应用
      </div>

      <section class="integration-note" aria-label="试用说明">
        <div v-for="note in webAutomationNotes" :key="note" class="note-item">
          <span aria-hidden="true">i</span>
          <p>{{ note }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { AutomationAppInfo } from '../../types/electronApi'
import {
  buildAutomationAppMeta,
  getAutomationAppStatusLabel,
  getAutomationAppStatusTone,
  selectInitialAutomationApp,
  webAutomationNotes,
  webAutomationStageMessage,
  type WebAutomationNoticeTone,
} from './webAutomationModel'
import {
  fetchAutomationApps,
  launchAutomationConsole,
  openAutomationConsoleExternal,
  recordWebAutomationEvent,
  stopAutomationConsole,
} from './webAutomationApi'

const apps = ref<AutomationAppInfo[]>([])
const selectedAppId = ref('')
const consoleUrl = ref('')
const loading = ref(false)
const launching = ref(false)
const message = ref('')
const messageTone = ref<WebAutomationNoticeTone>('info')

const activeApp = computed(() =>
  apps.value.find((app) => app.id === selectedAppId.value) ?? null,
)

onMounted(() => {
  void refreshApps()
})

async function refreshApps(): Promise<void> {
  loading.value = true
  message.value = ''

  try {
    apps.value = await fetchAutomationApps()

    if (!selectedAppId.value || !apps.value.some((app) => app.id === selectedAppId.value)) {
      selectedAppId.value = selectInitialAutomationApp(apps.value)
    }

    const current = activeApp.value
    consoleUrl.value = current?.running ? current.url : ''

    if (!apps.value.length) {
      messageTone.value = 'warning'
      message.value = '未读取到网页自动化应用注册表'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '读取网页自动化应用失败')
  } finally {
    loading.value = false
  }
}

function selectApp(appId: string): void {
  selectedAppId.value = appId
  const app = activeApp.value
  consoleUrl.value = app?.running ? app.url : ''
}

async function startActiveApp(): Promise<void> {
  const app = activeApp.value

  if (!app || launching.value) {
    return
  }

  launching.value = true
  message.value = ''

  try {
    const result = await launchAutomationConsole(app.id)

    if (result.success) {
      messageTone.value = 'success'
      message.value = result.alreadyRunning ? '网页自动化控制台已在运行' : '网页自动化控制台已启动'
      consoleUrl.value = result.url || app.url
      await refreshApps()
      consoleUrl.value = result.url || app.url
    } else {
      messageTone.value = 'error'
      message.value = result.error || '启动网页自动化控制台失败'
    }
  } catch (error) {
    await recordWebAutomationEvent('launch-exception', {
      appId: app.id,
      error: readErrorMessage(error, '启动网页自动化控制台失败'),
    })
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '启动网页自动化控制台失败')
  } finally {
    launching.value = false
  }
}

async function stopActiveApp(): Promise<void> {
  const app = activeApp.value

  if (!app?.running) {
    return
  }

  try {
    const result = await stopAutomationConsole(app.id)

    if (result.success) {
      messageTone.value = 'info'
      message.value = '网页自动化服务已停止'
      consoleUrl.value = ''
      await refreshApps()
    } else {
      messageTone.value = 'error'
      message.value = result.error || '停止网页自动化服务失败'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '停止网页自动化服务失败')
  }
}

async function openActiveAppExternal(): Promise<void> {
  const app = activeApp.value

  if (!app?.running) {
    return
  }

  try {
    const result = await openAutomationConsoleExternal(app.url)

    if (!result.success) {
      messageTone.value = 'error'
      message.value = result.error || '打开网页自动化控制台失败'
    }
  } catch (error) {
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '打开网页自动化控制台失败')
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
.web-automation-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.automation-panel {
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

.header-actions,
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.toolbar-button--primary {
  color: #ffffff;
  background: #409eff;
  border-color: #2563eb;
}

.toolbar-button--primary:hover {
  background: #1d4ed8;
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

.automation-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.app-list {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.app-option {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
}

.app-option:hover,
.app-option--active {
  border-color: #93c5fd;
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.1);
}

.option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #1d4ed8;
  font-weight: 900;
  background: #eff6ff;
  border-radius: 8px;
}

.option-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.option-copy strong,
.option-copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-copy strong {
  color: #0f172a;
  font-size: 15px;
}

.option-copy small {
  color: #64748b;
  font-size: 12px;
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

.status-tag--info {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.status-tag--danger {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.workspace {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
}

.workspace-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.workspace-title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.workspace-title strong {
  color: #0f172a;
  font-size: 18px;
}

.workspace-title span {
  overflow: hidden;
  color: #64748b;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.console-frame-wrap {
  height: min(62vh, 720px);
  min-height: 420px;
  overflow: hidden;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
}

.console-frame {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border: 0;
}

.empty-console,
.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 320px;
  padding: 28px;
  color: #64748b;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}

.empty-console strong {
  color: #0f172a;
  font-size: 18px;
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
  .automation-grid,
  .integration-note {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .panel-header,
  .workspace-toolbar,
  .header-actions,
  .workspace-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .app-option {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .status-tag {
    grid-column: 2;
    justify-self: start;
  }

  .app-meta {
    grid-template-columns: 1fr;
  }
}
</style>
