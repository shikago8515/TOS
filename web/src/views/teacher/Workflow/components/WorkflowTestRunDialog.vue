<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="工作流测试运行"
    width="1180px"
    :teleported="false"
    align-center
    class="workflow-test-run-dialog"
    destroy-on-close
  >
    <div class="test-run-shell">
      <div class="hero-card" :class="statusClass">
        <div class="hero-main">
          <div class="hero-left">
            <div class="status-orb">
              <el-icon :class="{ spinning: executionState?.status === 'RUNNING' }">
                <component :is="statusIcon" />
              </el-icon>
            </div>
            <div class="hero-copy">
              <div class="hero-title">后端实时执行状态</div>
              <div class="hero-subtitle">
                {{ currentStatusText }}
                <span v-if="executionState?.currentNodeLabel">
                  · 当前节点：{{ executionState.currentNodeLabel }}
                </span>
              </div>
            </div>
          </div>
          <div class="hero-right">
            <el-tag :type="statusTagType" effect="dark" round size="large">
              {{ statusLabel }}
            </el-tag>
            <div v-if="executionState?.instanceId" class="metric-line">
              实例 ID：{{ executionState.instanceId }}
            </div>
            <div class="metric-line">进度：{{ progressPercentage }}%</div>
            <div v-if="executionState?.executionTimeMs" class="metric-line">
              耗时：{{ formatDuration(executionState.executionTimeMs) }}
            </div>
          </div>
        </div>

        <div class="progress-strip">
          <el-progress
            :percentage="progressPercentage"
            :status="executionState?.status === 'FAILED' ? 'exception' : executionState?.status === 'SUCCESS' ? 'success' : ''"
            :indeterminate="executionState?.status === 'RUNNING' && progressPercentage <= 0"
            :stroke-width="10"
          />
        </div>

        <div v-if="testInput" class="input-chip">
          <span class="chip-label">测试输入</span>
          <span class="chip-text">{{ testInput }}</span>
        </div>
      </div>

      <div class="content-grid">
        <div class="panel node-panel">
          <div class="panel-title">节点切换查看</div>
          <div class="node-list custom-scrollbar">
            <button
              v-for="(item, index) in nodeExecutionList"
              :key="item.node.id"
              type="button"
              class="node-card"
              :class="[statusClassName(item.status), { active: selectedNodeId === item.node.id }]"
              @click="selectNode(item.node.id)"
            >
              <div class="node-header">
                <div class="node-index">{{ index + 1 }}</div>
                <div class="node-meta">
                  <div class="node-name">{{ item.node.label || item.node.id }}</div>
                  <div class="node-subline">
                    <span v-if="item.result?.model">{{ item.result.model }}</span>
                    <span v-if="item.result?.tokens">Tokens {{ item.result.tokens }}</span>
                    <span v-if="item.result?.timeMs">{{ item.result.timeMs }}ms</span>
                  </div>
                </div>
                <el-tag :type="nodeStatusTagType(item.status)" effect="plain" round>
                  {{ nodeStatusLabel(item.status) }}
                </el-tag>
              </div>
              <div class="node-preview" :class="{ error: item.status === 'FAILED' }">
                {{ getNodePreview(item) }}
              </div>
            </button>
          </div>
        </div>

        <div class="panel result-panel">
          <div class="panel-title">执行内容展示</div>

          <div v-if="selectedExecutionItem" class="selected-node-card" :class="statusClassName(selectedExecutionItem.status)">
            <div class="selected-node-header">
              <div>
                <div class="selected-node-caption">当前查看节点</div>
                <div class="selected-node-title">
                  {{ selectedExecutionItem.node.label || selectedExecutionItem.node.id }}
                </div>
                <div class="selected-node-meta">
                  <span v-if="selectedExecutionItem.result?.model">{{ selectedExecutionItem.result.model }}</span>
                  <span v-if="selectedExecutionItem.result?.tokens">Tokens {{ selectedExecutionItem.result.tokens }}</span>
                  <span v-if="selectedExecutionItem.result?.timeMs">{{ selectedExecutionItem.result.timeMs }}ms</span>
                </div>
              </div>
              <el-tag :type="nodeStatusTagType(selectedExecutionItem.status)" effect="dark" round>
                {{ nodeStatusLabel(selectedExecutionItem.status) }}
              </el-tag>
            </div>

            <div v-if="selectedExecutionItem.result?.errorMessage" class="node-error">
              {{ selectedExecutionItem.result.errorMessage }}
            </div>

            <div v-else-if="selectedExecutionItem.result?.output" class="selected-node-output">
              <div class="output-label">节点输出</div>
              <pre>{{ prettyText(selectedExecutionItem.result.output) }}</pre>
            </div>

            <div v-else-if="selectedExecutionItem.status === 'RUNNING'" class="selected-node-placeholder">
              后端正在执行这个节点，右侧内容会随着轮询结果自动更新。
            </div>

            <div v-else class="selected-node-placeholder">
              这个节点暂时还没有输出内容，可以继续切换查看其他节点。
            </div>
          </div>

          <el-tabs class="result-tabs">
            <el-tab-pane label="最终输出">
              <div class="code-card custom-scrollbar">
                <pre>{{ formattedResult }}</pre>
              </div>
            </el-tab-pane>
            <el-tab-pane label="运行上下文">
              <div class="code-card custom-scrollbar">
                <pre>{{ formattedContext }}</pre>
              </div>
            </el-tab-pane>
            <el-tab-pane label="节点结果 JSON">
              <div class="code-card custom-scrollbar">
                <pre>{{ formattedNodeResults }}</pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <el-alert
        v-if="executionState?.errorMessage"
        :title="executionState.errorMessage"
        type="error"
        show-icon
        :closable="false"
        class="error-banner"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Loading, CircleCheck, CircleClose, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  executionState: {
    type: Object,
    default: () => ({})
  },
  nodes: {
    type: Array,
    default: () => []
  },
  connections: {
    type: Array,
    default: () => []
  },
  testInput: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue'])

const selectedNodeId = ref('')

const statusIcon = computed(() => {
  switch (props.executionState?.status) {
    case 'SUCCESS':
      return CircleCheck
    case 'FAILED':
      return CircleClose
    case 'RUNNING':
      return Loading
    default:
      return WarningFilled
  }
})

const statusLabel = computed(() => {
  const labelMap = {
    RUNNING: '执行中',
    SUCCESS: '执行完成',
    FAILED: '执行失败'
  }
  return labelMap[props.executionState?.status] || '等待开始'
})

const currentStatusText = computed(() => {
  if (props.executionState?.status === 'FAILED') {
    return '后端在执行过程中发生错误'
  }
  if (props.executionState?.status === 'SUCCESS') {
    return '后端已完成全部节点执行'
  }
  return '后端已接收请求，正在持续返回实时进度'
})

const statusTagType = computed(() => {
  switch (props.executionState?.status) {
    case 'SUCCESS':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'RUNNING':
      return 'primary'
    default:
      return 'info'
  }
})

const statusClass = computed(() => `status-${(props.executionState?.status || 'idle').toLowerCase()}`)

const progressPercentage = computed(() => {
  const raw = Number(props.executionState?.progressPercentage ?? 0)
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(100, Math.max(0, raw))
  }

  const total = Number(props.executionState?.totalSteps ?? 0)
  const completed = Number(props.executionState?.completedSteps ?? 0)
  if (total > 0) {
    return Math.min(100, Math.round((completed / total) * 100))
  }
  return props.executionState?.status === 'SUCCESS' ? 100 : 0
})

const orderedAgentNodes = computed(() => {
  const allNodes = Array.isArray(props.nodes) ? props.nodes : []
  const nodeMap = new Map(allNodes.map(node => [node.id, node]))
  const nextMap = new Map((props.connections || []).map(conn => [conn.source, conn.target]))
  const ordered = []
  const visited = new Set()
  let cursor = allNodes.find(node => node.type === 'start-node')?.id

  while (cursor && nextMap.has(cursor)) {
    const nextId = nextMap.get(cursor)
    if (!nextId || visited.has(nextId)) {
      break
    }
    visited.add(nextId)
    const nextNode = nodeMap.get(nextId)
    if (nextNode) {
      ordered.push(nextNode)
    }
    cursor = nextId
  }

  const agentNodes = ordered.filter(node => node.type === 'agent-node')
  if (agentNodes.length > 0) {
    return agentNodes
  }

  return allNodes
    .filter(node => node.type === 'agent-node')
    .slice()
    .sort((a, b) => Number(a.x || 0) - Number(b.x || 0) || Number(a.y || 0) - Number(b.y || 0))
})

const nodeExecutionList = computed(() => {
  const resultMap = props.executionState?.nodeResults || {}
  return orderedAgentNodes.value.map((node) => {
    const result = resultMap[node.id] || resultMap[node.label] || null
    const isCurrentNode =
      props.executionState?.currentNodeId === node.id ||
      props.executionState?.currentNodeLabel === node.label

    let status = 'PENDING'
    if (result?.status) {
      status = result.status
    } else if (isCurrentNode && props.executionState?.status === 'RUNNING') {
      status = 'RUNNING'
    }

    return { node, result, status }
  })
})

watch(
  nodeExecutionList,
  (list) => {
    if (!list.length) {
      selectedNodeId.value = ''
      return
    }

    const stillExists = list.some(item => item.node.id === selectedNodeId.value)
    if (stillExists) {
      return
    }

    const currentNode = list.find(item => item.node.id === props.executionState?.currentNodeId)
    selectedNodeId.value = currentNode?.node.id || list[0].node.id
  },
  { immediate: true }
)

const selectedExecutionItem = computed(() => {
  if (!nodeExecutionList.value.length) {
    return null
  }
  return (
    nodeExecutionList.value.find(item => item.node.id === selectedNodeId.value) ||
    nodeExecutionList.value[0]
  )
})

const formattedResult = computed(() => prettyText(props.executionState?.finalOutput?.result || '暂无输出'))
const formattedContext = computed(() => prettyText(props.executionState?.finalOutput?.context || {}))
const formattedNodeResults = computed(() => prettyText(props.executionState?.nodeResults || {}))

const selectNode = (nodeId) => {
  selectedNodeId.value = nodeId
}

const prettyText = (value) => {
  if (value == null || value === '') {
    return '暂无内容'
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2)
      } catch (e) {
        return value
      }
    }
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch (e) {
    return String(value)
  }
}

const previewText = (value) => {
  const flatText = prettyText(value).replace(/\s+/g, ' ').trim()
  if (!flatText) {
    return '暂无内容'
  }
  return flatText.length > 90 ? `${flatText.slice(0, 90)}...` : flatText
}

const getNodePreview = (item) => {
  if (item.result?.errorMessage) {
    return item.result.errorMessage
  }
  if (item.result?.output) {
    return previewText(item.result.output)
  }
  if (item.status === 'RUNNING') {
    return '后端正在执行这个节点，点击后可在右侧持续查看实时内容。'
  }
  return '还没有生成输出内容，点击后可查看当前状态。'
}

const nodeStatusTagType = (status) => {
  switch (status) {
    case 'SUCCESS':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'RUNNING':
      return 'primary'
    default:
      return 'info'
  }
}

const nodeStatusLabel = (status) => {
  const map = {
    RUNNING: '执行中',
    SUCCESS: '已完成',
    FAILED: '失败',
    PENDING: '等待中'
  }
  return map[status] || status
}

const statusClassName = (status) => `node-${String(status || 'pending').toLowerCase()}`

const formatDuration = (ms) => {
  const safeMs = Number(ms || 0)
  if (safeMs < 1000) {
    return `${safeMs}ms`
  }
  return `${(safeMs / 1000).toFixed(1)}s`
}
</script>

<style scoped lang="scss">
.workflow-test-run-dialog {
  :deep(.el-dialog__body) {
    padding-top: 12px;
  }
}

.test-run-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-card {
  border-radius: 22px;
  padding: 22px 24px;
  background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
  border: 1px solid #d9e7ff;

  &.status-success {
    background: linear-gradient(135deg, #f2fff6 0%, #e8fff1 100%);
    border-color: #c8f2d5;
  }

  &.status-failed {
    background: linear-gradient(135deg, #fff7f7 0%, #ffefef 100%);
    border-color: #ffd5d5;
  }

  .hero-main {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  .hero-left {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .status-orb {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);

    .el-icon {
      font-size: 28px;
      color: #2563eb;

      &.spinning {
        animation: rotate 2s linear infinite;
      }
    }
  }

  .hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }

  .hero-subtitle {
    margin-top: 6px;
    font-size: 14px;
    color: #475569;
  }

  .hero-right {
    text-align: right;
    min-width: 180px;
  }

  .metric-line {
    margin-top: 8px;
    color: #475569;
    font-size: 13px;
  }

  .progress-strip {
    margin-top: 18px;
  }

  .input-chip {
    margin-top: 16px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 14px;

    .chip-label {
      font-size: 12px;
      color: #1d4ed8;
      font-weight: 700;
      flex-shrink: 0;
    }

    .chip-text {
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
    }
  }
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  gap: 18px;
  min-height: 520px;
}

.panel {
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: #fff;
  overflow: hidden;
}

.panel-title {
  padding: 18px 20px 14px;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  border-bottom: 1px solid #eef2f7;
}

.node-list {
  max-height: 620px;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-card {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  background: #fafafa;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  &.node-running {
    border-color: #93c5fd;
    background: #f8fbff;
  }

  &.node-success {
    border-color: #86efac;
    background: #f4fff7;
  }

  &.node-failed {
    border-color: #fca5a5;
    background: #fff7f7;
  }
}

.node-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.node-index {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  background: #e2e8f0;
  color: #0f172a;
}

.node-card.active .node-index {
  background: #2563eb;
  color: #fff;
}

.node-meta {
  min-width: 0;
  flex: 1;
}

.node-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.node-subline,
.selected-node-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #64748b;
}

.node-preview {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #475569;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  &.error {
    color: #b91c1c;
  }
}

.result-panel {
  display: flex;
  flex-direction: column;
}

.selected-node-card {
  margin: 16px 18px 0;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);

  &.node-running {
    border-color: #93c5fd;
    background: #f8fbff;
  }

  &.node-success {
    border-color: #86efac;
    background: #f4fff7;
  }

  &.node-failed {
    border-color: #fca5a5;
    background: #fff7f7;
  }
}

.selected-node-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.selected-node-caption {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #2563eb;
}

.selected-node-title {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.selected-node-output,
.selected-node-placeholder,
.node-error {
  margin-top: 14px;
}

.output-label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 6px;
}

.selected-node-output pre,
.code-card pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.65;
  color: #0f172a;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

.selected-node-output pre {
  max-height: 240px;
  overflow: auto;
  padding: 12px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
}

.selected-node-placeholder {
  font-size: 12px;
  color: #64748b;
  line-height: 1.7;
}

.node-error {
  font-size: 12px;
  color: #b91c1c;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 12px;
  padding: 10px 12px;
  line-height: 1.6;
}

.result-tabs {
  padding: 0 18px 18px;
  flex: 1;
}

.code-card {
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
  border: 1px solid #e5edf6;
  padding: 14px;
  min-height: 360px;
  max-height: 500px;
  overflow: auto;
}

.error-banner {
  margin-top: 4px;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero-card .hero-main,
  .selected-node-header {
    flex-direction: column;
  }

  .hero-card .hero-right {
    text-align: left;
  }
}
</style>
