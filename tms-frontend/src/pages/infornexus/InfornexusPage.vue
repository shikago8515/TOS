<template>
  <section class="infornexus-page">
    <div class="infornexus-panel">
      <header class="panel-header">
        <div>
          <p class="panel-kicker">外部子应用</p>
          <h2 class="panel-title">
            Infornexus
            <span class="stage-badge">外部接入</span>
          </h2>
          <p class="panel-description">
            通过 Electron 预留的外部模块入口启动 Infornexus 整包，保留原应用运行环境，
            避免把不可维护的 bytecode 和压缩 bundle 合进 TOS 源码。
          </p>
        </div>

        <div class="header-actions">
          <button class="toolbar-button" type="button" :disabled="loading" @click="refreshModule">
            {{ loading ? '刷新中...' : '刷新状态' }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="!canLaunch"
            @click="launchModule"
          >
            {{ launching ? '启动中...' : '启动 Infornexus' }}
          </button>
        </div>
      </header>

      <div class="stage-alert">
        {{ infornexusStageMessage }}
      </div>

      <div v-if="message" class="status-alert" :class="`status-alert--${messageTone}`">
        {{ message }}
      </div>

      <section class="status-grid" aria-label="Infornexus 状态">
        <article class="status-summary">
          <span class="status-dot" :class="`status-dot--${statusTone}`" />
          <div>
            <span class="status-label">当前状态</span>
            <strong>{{ statusLabel }}</strong>
          </div>
        </article>

        <article
          v-for="item in metaItems"
          :key="item.label"
          class="meta-item"
          :class="{ 'meta-item--wide': item.wide }"
        >
          <span class="meta-label">{{ item.label }}</span>
          <span class="meta-value">{{ item.value }}</span>
        </article>
      </section>

      <section class="integration-note" aria-label="接入说明">
        <div v-for="note in infornexusNotes" :key="note" class="note-item">
          <span aria-hidden="true">i</span>
          <p>{{ note }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { ExternalModuleInfo } from '../../types/electronApi'
import {
  buildInfornexusMeta,
  getInfornexusStatusLabel,
  getInfornexusStatusTone,
  infornexusNotes,
  infornexusStageMessage,
  type InfornexusNoticeTone,
} from './infornexusModel'
import {
  fetchInfornexusExternalModule,
  launchInfornexusExternalModule,
  recordInfornexusEvent,
} from './infornexusApi'

const moduleInfo = ref<ExternalModuleInfo | null>(null)
const loading = ref(false)
const launching = ref(false)
const message = ref('')
const messageTone = ref<InfornexusNoticeTone>('info')

const statusLabel = computed(() => getInfornexusStatusLabel(moduleInfo.value))
const statusTone = computed(() => getInfornexusStatusTone(moduleInfo.value))
const metaItems = computed(() => buildInfornexusMeta(moduleInfo.value))
const canLaunch = computed(() => Boolean(moduleInfo.value?.available) && !launching.value)

onMounted(() => {
  void refreshModule()
})

async function refreshModule(): Promise<void> {
  loading.value = true
  message.value = ''

  try {
    moduleInfo.value = await fetchInfornexusExternalModule()

    if (moduleInfo.value.available) {
      messageTone.value = 'success'
      message.value = '已检测到 Infornexus 外部子应用'
    } else {
      messageTone.value = 'warning'
      message.value = '未找到 Infornexus 整包，请确认 external-apps/infornexus 下存在 electron-app.exe 和运行时文件'
    }
  } catch (error) {
    moduleInfo.value = null
    messageTone.value = 'error'
    message.value = readErrorMessage(error, '读取 Infornexus 状态失败')
  } finally {
    loading.value = false
  }
}

async function launchModule(): Promise<void> {
  launching.value = true
  message.value = ''

  try {
    const result = await launchInfornexusExternalModule()

    if (result.success) {
      messageTone.value = 'success'
      message.value = 'Infornexus 已启动'
    } else {
      messageTone.value = 'error'
      message.value = result.error || '启动 Infornexus 失败'
    }
  } catch (error) {
    const errorMessage = readErrorMessage(error, '启动 Infornexus 失败')
    await recordInfornexusEvent('launch-exception', {
      error: errorMessage,
    })
    messageTone.value = 'error'
    message.value = errorMessage
  } finally {
    launching.value = false
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
.infornexus-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.infornexus-panel {
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
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
  background: #ecfdf5;
  border: 1px solid #99f6e4;
  border-radius: 999px;
}

.panel-description {
  max-width: 780px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-button,
.primary-button {
  min-height: 38px;
  padding: 0 16px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 6px;
}

.toolbar-button {
  color: #334155;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}

.toolbar-button:hover {
  background: #f8fafc;
}

.primary-button {
  color: #ffffff;
  background: #2563eb;
  border: 1px solid #1d4ed8;
}

.primary-button:hover {
  background: #1d4ed8;
}

.toolbar-button:disabled,
.primary-button:disabled {
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
  color: #0f766e;
  background: #f0fdfa;
  border: 1px solid #99f6e4;
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

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.status-summary,
.meta-item {
  min-width: 0;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
}

.status-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background: #94a3b8;
  border-radius: 999px;
}

.status-dot--success {
  background: #16a34a;
}

.status-dot--warning {
  background: #d97706;
}

.status-dot--error {
  background: #dc2626;
}

.status-label,
.meta-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.status-summary strong {
  display: block;
  margin-top: 5px;
  color: #0f172a;
  font-size: 18px;
}

.meta-item {
  display: grid;
  gap: 6px;
}

.meta-item--wide {
  grid-column: span 2;
}

.meta-value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.5;
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
  color: #0f766e;
  font-size: 13px;
  font-weight: 900;
  background: #ccfbf1;
  border-radius: 999px;
}

.note-item p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .status-grid,
  .integration-note {
    grid-template-columns: 1fr;
  }

  .meta-item--wide {
    grid-column: auto;
  }
}

@media (max-width: 760px) {
  .panel-header,
  .header-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
