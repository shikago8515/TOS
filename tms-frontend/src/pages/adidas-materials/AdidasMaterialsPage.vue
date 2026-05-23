<template>
  <section class="collector-page">
    <div class="collector-panel">
      <header class="collector-header">
        <div>
          <p class="collector-kicker">网页数据自动化</p>
          <h2 class="collector-title">adidas 材料数据收集器</h2>
          <p class="collector-description">
            打开采集专用外部 Edge/Chrome 后，先用右侧面板的地址栏进入你平时使用的登录入口。
            登录完成并进入 Materials 列表页后，再点击采集按钮。
          </p>
        </div>

        <button
          class="primary-button"
          type="button"
          :disabled="launching"
          @click="openCollector"
        >
          {{ launching ? '打开中...' : '打开外部浏览器' }}
        </button>
      </header>

      <div v-if="message" class="status-alert" :class="`status-alert--${messageTone}`">
        {{ message }}
      </div>

      <section class="capability-grid" aria-label="采集能力">
        <article
          v-for="capability in adidasMaterialsCapabilities"
          :key="capability.label"
          class="capability-item"
        >
          <span class="capability-label">{{ capability.label }}</span>
          <span class="capability-value">{{ capability.value }}</span>
        </article>
      </section>

      <section class="workflow">
        <h3 class="workflow-title">运行流程</h3>
        <div class="workflow-steps">
          <article
            v-for="step in adidasMaterialsWorkflowSteps"
            :key="step.index"
            class="workflow-step"
          >
            <span class="step-index">{{ step.index }}</span>
            <p>{{ step.text }}</p>
          </article>
        </div>
      </section>

      <section class="collector-note" aria-label="采集说明">
        <div v-for="note in adidasMaterialsNotes" :key="note" class="note-item">
          <span aria-hidden="true">i</span>
          <p>{{ note }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import {
  adidasMaterialsCapabilities,
  adidasMaterialsNotes,
  adidasMaterialsWorkflowSteps,
  readLaunchSuccessMessage,
  type AdidasMaterialsNoticeTone,
} from './adidasMaterialsModel'
import {
  launchAdidasMaterialsCollector,
  recordAdidasMaterialsEvent,
} from './adidasMaterialsApi'

const launching = ref(false)
const message = ref('')
const messageTone = ref<AdidasMaterialsNoticeTone>('info')

async function openCollector(): Promise<void> {
  launching.value = true
  message.value = ''

  try {
    const result = await launchAdidasMaterialsCollector()

    if (result.success) {
      messageTone.value = 'success'
      message.value = readLaunchSuccessMessage(result.alreadyOpen)
    } else {
      messageTone.value = 'error'
      message.value = result.error || '打开 adidas 外部浏览器失败'
    }
  } catch (error) {
    const errorMessage = readErrorMessage(error, '打开 adidas 外部浏览器失败')
    await recordAdidasMaterialsEvent('launch-exception', {
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
.collector-page {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
}

.collector-panel {
  display: grid;
  gap: 18px;
}

.collector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.collector-kicker,
.collector-title,
.collector-description {
  margin: 0;
}

.collector-kicker {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.collector-title {
  color: #0f172a;
  font-size: 28px;
  line-height: 1.25;
}

.collector-description {
  max-width: 840px;
  margin-top: 10px;
  color: #64748b;
  font-size: 15px;
  line-height: 1.65;
}

.primary-button {
  min-height: 42px;
  padding: 0 18px;
  color: #ffffff;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  background: #409eff;
  border: 1px solid #2563eb;
  border-radius: 6px;
}

.primary-button:hover {
  background: #1d4ed8;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.status-alert {
  padding: 13px 16px;
  font-size: 14px;
  border-radius: 8px;
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

.capability-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.capability-item {
  min-width: 0;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.04);
}

.capability-label,
.capability-value {
  display: block;
}

.capability-label {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.capability-value {
  margin-top: 8px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
}

.workflow {
  padding: 22px;
  background: #ffffff;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
}

.workflow-title {
  margin: 0 0 16px;
  color: #0f172a;
  font-size: 20px;
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.workflow-step {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  background: #1d4ed8;
  border-radius: 999px;
}

.workflow-step p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

.collector-note {
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
  .capability-grid,
  .collector-note,
  .workflow-steps {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .collector-header {
    display: grid;
    grid-template-columns: 1fr;
  }

  .primary-button {
    width: 100%;
  }
}
</style>
