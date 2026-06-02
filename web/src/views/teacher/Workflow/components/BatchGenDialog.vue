<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="handleDialogVisibleChange"
    width="1200px"
    :teleported="false"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="modern-dialog batch-gen-dialog"
  >
    <template #header="{ close }">
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <el-icon><Cpu /></el-icon>
          </div>
          <div class="header-texts">
            <span class="main-title">AI 一键生成提示词</span>
            <span class="sub-title">Workflow Prompt Generator</span>
          </div>
        </div>
        <div class="header-actions">
          <el-button circle text @click="close" :disabled="!batchGenState.isComplete">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </template>

    <div class="batch-gen-layout">
      <aside class="layout-sidebar">
        <div class="sidebar-header">
          <span class="title">生成任务队列</span>
          <el-tag
            effect="plain"
            round
            size="small"
            :type="batchGenState.isComplete ? 'success' : 'primary'"
          >
            {{ batchGenState.currentIndex }}/{{ batchGenState.total }}
          </el-tag>
        </div>

        <el-scrollbar height="100%" class="queue-list custom-scrollbar">
          <transition-group name="list">
            <div
              v-for="item in batchGenState.history"
              :key="item.id"
              class="queue-item"
              :class="{
                'is-active': activeResultId === item.id,
                'is-pending': item.status === 'pending',
                'is-generating': item.status === 'generating',
                'is-success': item.status === 'success',
                'is-fail': item.status === 'fail'
              }"
              @click="handleSelectResult(item)"
            >
              <div class="status-indicator">
                <el-icon v-if="item.status === 'generating'" class="is-loading"><Loading /></el-icon>
                <el-icon v-else-if="item.status === 'success'"><Check /></el-icon>
                <el-icon v-else-if="item.status === 'fail'"><Close /></el-icon>
                <el-icon v-else><MoreFilled /></el-icon>
              </div>

              <div class="item-content">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-status-text">{{ getStatusText(item.status) }}</span>
              </div>

              <div class="active-marker"></div>
            </div>
          </transition-group>
        </el-scrollbar>

        <div class="sidebar-footer">
          <div class="progress-box">
            <div class="progress-info">
              <span>总进度</span>
              <span class="percentage">{{ progressPercentage }}%</span>
            </div>
            <el-progress
              :percentage="progressPercentage"
              :status="batchGenState.isComplete ? 'success' : ''"
              :stroke-width="6"
              :show-text="false"
              color="#0ea5e9"
            />
            <div class="time-stat">
              <el-icon><Timer /></el-icon>
              <span>耗时：{{ batchGenState.timeElapsed }}</span>
            </div>
          </div>
        </div>
      </aside>

      <section class="layout-content">
        <transition name="fade-slide" mode="out-in">
          <div v-if="selectedResult" :key="selectedResult.id" class="result-container">
            <div class="content-header">
              <div class="node-identity">
                <div class="icon-wrapper">
                  <el-icon><Connection /></el-icon>
                </div>
                <div class="text-wrapper">
                  <h2 class="node-title">{{ selectedResult.name }}</h2>
                  <div class="node-tags">
                    <el-tag
                      :type="selectedResult.status === 'success' ? 'success' : (selectedResult.status === 'fail' ? 'danger' : 'info')"
                      size="small"
                      effect="light"
                      round
                    >
                      {{ getStatusText(selectedResult.status) }}
                    </el-tag>
                    <el-tag
                      v-if="selectedResult.result?.recommendedTemperature !== undefined"
                      type="info"
                      size="small"
                      effect="plain"
                      round
                    >
                      <el-icon class="mr-1"><Odometer /></el-icon>
                      温度：{{ selectedResult.result.recommendedTemperature }}
                    </el-tag>
                    <el-tag v-if="selectedPromptStats.lines" size="small" effect="plain" round>
                      {{ selectedPromptStats.lines }} 行
                    </el-tag>
                    <el-tag v-if="selectedPromptStats.characters" size="small" effect="plain" round>
                      {{ selectedPromptStats.characters }} 字符
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>

            <div class="content-body">
              <template v-if="selectedResult.status === 'success' && selectedResult.result">
                <div class="section-card prompt-section">
                  <div class="section-header">
                    <div class="header-title">
                      <el-icon class="section-icon"><MagicStick /></el-icon>
                      <span>Prompt 提示词</span>
                    </div>
                    <div class="header-actions">
                      <el-tooltip content="复制当前提示词" placement="top" :teleported="false">
                        <el-button class="action-btn" text bg circle @click="copyText(selectedPromptText)">
                          <el-icon><CopyDocument /></el-icon>
                        </el-button>
                      </el-tooltip>
                    </div>
                  </div>

                  <div class="section-body">
                    <div v-if="selectedPromptText" class="code-editor-shell">
                      <div class="code-scroll custom-scrollbar">
                        <div class="line-numbers">
                          <span v-for="n in selectedPromptLines" :key="n">{{ n }}</span>
                        </div>
                        <pre class="prompt-plain">{{ selectedPromptText }}</pre>
                      </div>
                    </div>
                    <div v-else class="prompt-empty">
                      <el-icon><DataLine /></el-icon>
                      <span>当前节点尚未返回可展示的提示词内容</span>
                    </div>
                  </div>
                </div>

                <div v-if="normalizedSuggestions.length" class="section-card insights-section">
                  <div class="section-header">
                    <div class="header-title">
                      <el-icon class="section-icon"><ChatDotRound /></el-icon>
                      <span>优化建议</span>
                    </div>
                  </div>
                  <div class="section-body">
                    <div class="insights-grid custom-scrollbar">
                      <div v-for="(suggestion, index) in normalizedSuggestions" :key="index" class="insight-card">
                        <div class="card-left-decoration"></div>
                        <div class="card-icon">
                          <el-icon><Opportunity /></el-icon>
                        </div>
                        <div class="card-text">{{ suggestion }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <div v-else-if="selectedResult.status === 'generating'" class="state-container generating">
                <div class="animation-box">
                  <div class="ripple"></div>
                  <div class="ripple delay"></div>
                  <el-icon class="center-icon is-loading"><Loading /></el-icon>
                </div>
                <h3>AI 正在分析当前节点</h3>
                <p>系统正在结合上下文自动整理提示词结构，请稍候查看生成结果。</p>
              </div>

              <div v-else-if="selectedResult.status === 'fail'" class="state-container error">
                <div class="icon-box error">
                  <el-icon><CloseBold /></el-icon>
                </div>
                <h3>当前节点生成失败</h3>
                <p>{{ selectedResult.error || '网络连接异常或服务暂时不可用，请稍后重试。' }}</p>
              </div>

              <div v-else class="state-container pending">
                <div class="icon-box pending">
                  <el-icon><Timer /></el-icon>
                </div>
                <h3>任务已加入队列</h3>
                <p>当前节点正在等待处理，生成完成后会自动展示结果。</p>
              </div>
            </div>
          </div>

          <div v-else class="empty-placeholder">
            <div class="placeholder-content">
              <div class="placeholder-icon">
                <el-icon><DataLine /></el-icon>
              </div>
              <h3>从左侧选择一个任务节点</h3>
              <p>选中节点后，可在这里查看生成的提示词全文与优化建议。</p>
            </div>
          </div>
        </transition>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer batch-footer">
        <div class="stats-group" v-if="batchGenState.isComplete">
          <div class="stat-item success">
            <span class="label">成功</span>
            <span class="value">{{ batchGenState.successCount }}</span>
          </div>
          <div class="divider"></div>
          <div class="stat-item fail">
            <span class="label">失败</span>
            <span class="value">{{ batchGenState.failCount }}</span>
          </div>
        </div>
        <div class="footer-btn-group">
          <el-button
            @click="$emit('update:visible', false)"
            :type="batchGenState.isComplete ? 'primary' : 'default'"
            class="footer-btn"
          >
            {{ batchGenState.isComplete ? '完成并关闭' : '停止生成' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  ChatDotRound,
  Check,
  Close,
  CloseBold,
  Connection,
  CopyDocument,
  Cpu,
  DataLine,
  Loading,
  MagicStick,
  MoreFilled,
  Odometer,
  Opportunity,
  Timer
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  batchGenState: {
    type: Object,
    default: () => ({
      total: 0,
      currentIndex: 0,
      history: [],
      isComplete: false,
      successCount: 0,
      failCount: 0,
      timeElapsed: '00:00',
      currentAgentId: null
    })
  }
})

const emit = defineEmits(['update:visible'])

const activeResultId = ref(null)

const selectedResult = computed(() => {
  if (!props.batchGenState?.history?.length) return null
  if (!activeResultId.value) return props.batchGenState.history[0]
  return props.batchGenState.history.find((item) => item.id === activeResultId.value) || props.batchGenState.history[0]
})

const selectedPromptText = computed(() => extractPromptText(selectedResult.value?.result?.finalPrompt))

const selectedPromptLines = computed(() => {
  const lineCount = selectedPromptText.value ? selectedPromptText.value.split('\n').length : 1
  return Array.from({ length: lineCount }, (_, index) => index + 1)
})

const selectedPromptStats = computed(() => ({
  lines: selectedPromptText.value ? selectedPromptText.value.split('\n').length : 0,
  characters: selectedPromptText.value ? selectedPromptText.value.length : 0
}))

const normalizedSuggestions = computed(() => {
  const suggestions = selectedResult.value?.result?.suggestions
  if (!Array.isArray(suggestions)) return []
  return suggestions
    .map((item) => normalizeSuggestion(item))
    .filter(Boolean)
})

const progressPercentage = computed(() => {
  if (!props.batchGenState?.total) return 0
  return Math.round((props.batchGenState.currentIndex / props.batchGenState.total) * 100)
})

watch(
  () => props.batchGenState?.currentAgentId,
  (newId) => {
    if (newId) {
      activeResultId.value = newId
    }
  }
)

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.batchGenState?.history?.length > 0) {
      activeResultId.value = props.batchGenState.history[0].id
    }
  }
)

function handleDialogVisibleChange(value) {
  emit('update:visible', value)
}

function handleSelectResult(item) {
  activeResultId.value = item.id
}

function getStatusText(status) {
  const map = {
    pending: '等待中',
    generating: '生成中',
    success: '生成成功',
    fail: '生成失败'
  }
  return map[status] || status
}

async function copyText(text) {
  if (!text) {
    ElMessage.warning('当前没有可复制的提示词内容')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('提示词已复制到剪贴板')
  } catch (error) {
    ElMessage.warning('复制失败，请手动复制')
  }
}

function extractPromptText(source) {
  if (!source) return ''

  if (typeof source === 'object') {
    return toReadableText(source.prompt || source.finalPrompt || JSON.stringify(source, null, 2))
  }

  const rawText = String(source).trim()
  if (!rawText) return ''

  const unfencedText = stripCodeFence(rawText)
  const parsedObject = tryParseJson(unfencedText) || tryExtractEmbeddedJson(unfencedText)

  if (parsedObject && typeof parsedObject === 'object') {
    const prompt = parsedObject.prompt || parsedObject.finalPrompt || parsedObject.data?.prompt
    if (prompt) {
      return toReadableText(prompt)
    }
    return toReadableText(JSON.stringify(parsedObject, null, 2))
  }

  return toReadableText(unfencedText)
}

function stripCodeFence(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim()
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    return null
  }
}

function tryExtractEmbeddedJson(text) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }
  return tryParseJson(text.slice(firstBrace, lastBrace + 1))
}

function toReadableText(value) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  return text
    .replace(/^(markdown|md)\s*\n/i, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\t/g, '  ')
}

function normalizeSuggestion(value) {
  if (!value) return ''
  return String(value)
    .replace(/^[\s\u2600-\u27BF\u{1F300}-\u{1FAFF}\uFE0F\u200D]+/gu, '')
    .replace(/^[•·\-]\s*/, '')
    .trim()
}
</script>

<style scoped lang="scss">
$primary: #0ea5e9;
$primary-deep: #0369a1;
$primary-soft: #f0f9ff;
$success: #10b981;
$warning: #f59e0b;
$danger: #ef4444;
$text-main: #0f172a;
$text-secondary: #475569;
$text-light: #94a3b8;
$bg-body: #f8fafc;
$bg-card: #ffffff;
$border: #e2e8f0;
$radius-lg: 16px;
$radius-md: 12px;
$radius-sm: 8px;
$shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
$shadow-md: 0 10px 28px rgba(14, 165, 233, 0.08);
$shadow-lg: 0 18px 40px rgba(15, 23, 42, 0.12);

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;

    &:hover {
      background: #94a3b8;
    }
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.mr-1 {
  margin-right: 4px;
}

.modern-dialog {
  :deep(.el-dialog) {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: $shadow-lg;
    background: $bg-card;
  }

  :deep(.el-dialog__header) {
    padding: 0;
    margin: 0;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 0;
    margin: 0;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  background:
    linear-gradient(180deg, rgba(240, 249, 255, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%),
    $bg-card;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon-box {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
    color: $primary-deep;
    box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.12);
    font-size: 20px;
  }

  .header-texts {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .main-title {
    font-size: 17px;
    font-weight: 700;
    color: $text-main;
    line-height: 1.2;
  }

  .sub-title {
    font-size: 11px;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.85) 0%, #ffffff 100%);
  border-top: 1px solid rgba(226, 232, 240, 0.88);

  &.batch-footer {
    align-items: center;
    justify-content: space-between;
  }

  .stats-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;

    &.success {
      color: $success;
    }

    &.fail {
      color: $danger;
    }
  }

  .divider {
    width: 1px;
    height: 14px;
    background: $border;
  }
}

.batch-gen-layout {
  display: flex;
  height: 75vh;
  min-height: 640px;
  max-height: 860px;
  background:
    radial-gradient(circle at top right, rgba(224, 242, 254, 0.7) 0%, rgba(248, 250, 252, 0) 34%),
    $bg-body;
  overflow: hidden;
}

.layout-sidebar {
  width: 296px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border-right: 1px solid rgba(226, 232, 240, 0.95);
  backdrop-filter: blur(10px);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.88);

  .title {
    font-size: 13px;
    font-weight: 700;
    color: $text-secondary;
    letter-spacing: 0.02em;
  }
}

.queue-list {
  flex: 1;
  padding: 10px;
}

.queue-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  transition:
    transform 0.24s ease,
    background-color 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease;

  &:hover {
    background: rgba(240, 249, 255, 0.92);
    border-color: rgba(186, 230, 253, 0.95);
    transform: translateY(-1px);
  }

  &.is-active {
    background: linear-gradient(180deg, rgba(240, 249, 255, 1) 0%, rgba(224, 242, 254, 0.78) 100%);
    border-color: rgba(125, 211, 252, 0.85);
    box-shadow: 0 8px 24px rgba(14, 165, 233, 0.12);

    .item-name {
      color: $primary-deep;
    }

    .active-marker {
      opacity: 1;
      transform: scaleY(1);
    }
  }
}

.status-indicator {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f1f5f9;
  color: #94a3b8;
  font-size: 14px;
}

.queue-item.is-generating .status-indicator {
  background: rgba(14, 165, 233, 0.14);
  color: $primary;
}

.queue-item.is-success .status-indicator {
  background: rgba(16, 185, 129, 0.14);
  color: $success;
}

.queue-item.is-fail .status-indicator {
  background: rgba(239, 68, 68, 0.12);
  color: $danger;
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: $text-main;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-status-text {
  font-size: 11px;
  color: $text-light;
}

.active-marker {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 4px;
  height: calc(100% - 20px);
  border-radius: 999px;
  background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
  opacity: 0;
  transform: scaleY(0.3);
  transform-origin: center;
  transition: all 0.24s ease;
}

.sidebar-footer {
  padding: 16px 18px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.88);
  background: rgba(255, 255, 255, 0.95);
}

.progress-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: $text-secondary;
}

.time-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: $text-light;
}

.layout-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.content-header {
  flex-shrink: 0;
  padding: 22px 28px 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.84);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.88) 100%);
}

.node-identity {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-wrapper {
  width: 50px;
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: #ffffff;
  font-size: 24px;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
}

.text-wrapper {
  min-width: 0;
}

.node-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: $text-main;
  line-height: 1.2;
}

.node-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.content-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
}

.section-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  box-shadow: $shadow-sm;
  overflow: hidden;
  transition:
    transform 0.26s ease,
    box-shadow 0.26s ease,
    border-color 0.26s ease;

  &:hover {
    border-color: rgba(125, 211, 252, 0.75);
    box-shadow: $shadow-md;
    transform: translateY(-1px);
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.94) 0%, rgba(255, 255, 255, 0.96) 100%);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: $text-main;

  .section-icon {
    color: $primary-deep;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  color: $primary-deep;
  transition:
    transform 0.24s ease,
    background-color 0.24s ease;

  &:hover {
    transform: translateY(-1px);
  }
}

.prompt-section {
  flex: 1;
  min-height: 0;
  height: 100%;

  .section-body {
    flex: 1;
    display: flex;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
}

.code-editor-shell {
  flex: 1;
  display: flex;
  height: 100%;
  min-height: 0;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
  overflow: hidden;
}

.code-scroll {
  flex: 1;
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: auto;
  align-items: start;
}

.line-numbers {
  padding: 18px 10px 18px 14px;
  border-right: 1px solid rgba(226, 232, 240, 0.92);
  background: #f8fafc;
  color: #94a3b8;
  text-align: right;
  user-select: none;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;

  span {
    display: block;
  }
}

.prompt-plain {
  margin: 0;
  padding: 18px 22px 22px;
  min-width: 0;
  min-height: 100%;
  color: $text-secondary;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.prompt-empty {
  height: 100%;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: $text-light;
  font-size: 13px;

  .el-icon {
    font-size: 28px;
    color: #cbd5e1;
  }
}

.insights-section {
  max-height: 220px;

  .section-body {
    min-height: 0;
    padding: 14px 18px 18px;
  }
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  max-height: 168px;
  overflow: auto;
  padding-right: 2px;
}

.insight-card {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 14px 14px 16px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92) 0%, rgba(255, 255, 255, 1) 100%);
  transition:
    transform 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(125, 211, 252, 0.78);
    box-shadow: 0 8px 22px rgba(14, 165, 233, 0.08);

    .card-left-decoration {
      opacity: 1;
    }

    .card-icon {
      background: rgba(14, 165, 233, 0.12);
      color: $primary-deep;
    }
  }
}

.card-left-decoration {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.card-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #e2e8f0;
  color: $text-secondary;
  transition: all 0.24s ease;
}

.card-text {
  font-size: 13px;
  line-height: 1.6;
  color: $text-secondary;
}

.state-container,
.empty-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.state-container {
  flex-direction: column;
  gap: 12px;
  padding: 40px 56px;

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: $text-main;
  }

  p {
    margin: 0;
    max-width: 420px;
    color: $text-secondary;
    line-height: 1.6;
  }
}

.icon-box {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 32px;

  &.pending {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
  }

  &.error {
    background: rgba(239, 68, 68, 0.12);
    color: $danger;
  }
}

.animation-box {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  .center-icon {
    position: relative;
    z-index: 2;
    font-size: 34px;
    color: $primary;
  }
}

.ripple {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 2px solid rgba(14, 165, 233, 0.35);
  animation: ripple 2.2s ease-out infinite;

  &.delay {
    animation-delay: 1.1s;
  }
}

.placeholder-content {
  max-width: 360px;
  color: $text-light;

  h3 {
    margin: 0 0 8px;
    font-size: 20px;
    color: $text-main;
  }

  p {
    margin: 0;
    line-height: 1.6;
    color: $text-secondary;
  }
}

.placeholder-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.95) 0%, rgba(224, 242, 254, 0.8) 100%);
  color: $primary;
  font-size: 38px;
}

@keyframes ripple {
  0% {
    transform: scale(0.65);
    opacity: 0.72;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.28s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-active {
  position: absolute;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 1280px) {
  .batch-gen-layout {
    min-height: 600px;
  }

  .layout-sidebar {
    width: 272px;
  }

  .content-body {
    padding: 20px 22px 22px;
  }
}
</style>
