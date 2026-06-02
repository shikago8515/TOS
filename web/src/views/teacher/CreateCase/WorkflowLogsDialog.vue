<template>
  <el-dialog
    v-model="visible"
    title="工作流执行日志"
    width="1080px"
    top="4vh"
    :teleported="false"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="workflow-logs-container" v-loading="loading">
      <el-collapse v-model="expandedSections" class="workflow-collapse">
        <el-collapse-item name="overview">
          <template #title>
            <div class="section-title-row">
              <el-icon><Tickets /></el-icon>
              <span>工作流概览</span>
            </div>
          </template>

          <div class="workflow-info">
            <div class="info-item">
              <span class="label">工作流ID</span>
              <span class="value">{{ workflowInstanceId }}</span>
            </div>
            <div class="info-item">
              <span class="label">当前状态</span>
              <el-tag :type="getStatusType(workflowData?.status)">
                {{ getStatusText(workflowData?.status) }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="label">当前阶段</span>
              <span class="value">{{ getStateLabel(workflowData?.currentState) }}</span>
            </div>
            <div class="info-item progress-item">
              <span class="label">进度</span>
              <el-progress
                :percentage="workflowData?.progressPercentage || 0"
                :stroke-width="8"
              />
            </div>
          </div>
        </el-collapse-item>

        <el-collapse-item name="logs">
          <template #title>
            <div class="section-title-row">
              <el-icon><Tickets /></el-icon>
              <span>Agent 执行记录</span>
            </div>
          </template>

          <div class="logs-section">
            <el-timeline v-if="workflowData?.logs?.length">
              <el-timeline-item
                v-for="(log, index) in workflowData.logs"
                :key="index"
                :timestamp="formatTimestamp(log.startTime)"
                :type="getLogTimelineType(log.status)"
                :icon="getLogIcon(log.status)"
              >
                <div class="log-item">
                  <div class="log-header">
                    <div class="agent-info">
                      <span class="agent-name">{{ getDisplayAgentName(log.agentName) }}</span>
                      <span v-if="getDisplayAgentDescription(log.agentName)" class="agent-desc">
                        {{ getDisplayAgentDescription(log.agentName) }}
                      </span>
                    </div>
                    <el-tag :type="getLogStatusType(log.status)" size="small">
                      {{ getLogStatusText(log.status) }}
                    </el-tag>
                  </div>

                  <div v-if="log.durationMs || log.endTime" class="log-meta">
                    <el-icon><Timer /></el-icon>
                    <span v-if="log.durationMs">总耗时: {{ formatDuration(log.durationMs) }}</span>
                    <span v-if="log.endTime">完成时间: {{ formatTimestamp(log.endTime) }}</span>
                  </div>

                  <div v-if="hasTimingBreakdown(log)" class="log-metrics">
                    <span v-if="getMetricNumber(log.queueWaitMs) > 0">排队 {{ formatMetricDuration(log.queueWaitMs) }}</span>
                    <span v-if="getMetricNumber(log.stageQueueWaitMs) > 0">阶段排队 {{ formatMetricDuration(log.stageQueueWaitMs) }}</span>
                    <span v-if="getMetricNumber(log.llmQueueWaitMs) > 0">LLM排队 {{ formatMetricDuration(log.llmQueueWaitMs) }}</span>
                    <span v-if="getMetricNumber(log.llmModelTimeMs) > 0">模型耗时 {{ formatMetricDuration(log.llmModelTimeMs) }}</span>
                    <span v-if="getMetricNumber(log.llmCallCount) > 0">LLM调用 {{ getMetricNumber(log.llmCallCount) }}</span>
                  </div>

                  <div v-if="log.outputSummary" class="log-output">
                    <el-text type="info" size="small">{{ log.outputSummary }}</el-text>
                  </div>

                  <div class="log-expand-actions" v-if="log.outputDetail || log.errorMessage || hasTimingBreakdown(log)">
                    <el-button link type="primary" size="small" @click="toggleLogExpand(index)">
                      {{ expandedLogIndexes.includes(index) ? '收起详情' : '展开详情' }}
                    </el-button>
                  </div>

                  <transition name="el-fade-in-linear">
                    <div v-if="expandedLogIndexes.includes(index)" class="log-detail-panel">
                      <div v-if="hasTimingBreakdown(log) || formatModelBuckets(log.modelBuckets)" class="detail-block">
                        <div class="detail-title">执行耗时拆分</div>
                        <div class="detail-metrics">
                          <div v-if="getMetricNumber(log.queueWaitMs) > 0" class="metric-row">
                            <span class="metric-label">总排队</span>
                            <span class="metric-value">{{ formatMetricDuration(log.queueWaitMs) }}</span>
                          </div>
                          <div v-if="getMetricNumber(log.stageQueueWaitMs) > 0" class="metric-row">
                            <span class="metric-label">阶段排队</span>
                            <span class="metric-value">{{ formatMetricDuration(log.stageQueueWaitMs) }}</span>
                          </div>
                          <div v-if="getMetricNumber(log.llmQueueWaitMs) > 0" class="metric-row">
                            <span class="metric-label">LLM排队</span>
                            <span class="metric-value">{{ formatMetricDuration(log.llmQueueWaitMs) }}</span>
                          </div>
                          <div v-if="getMetricNumber(log.llmModelTimeMs) > 0" class="metric-row">
                            <span class="metric-label">模型耗时</span>
                            <span class="metric-value">{{ formatMetricDuration(log.llmModelTimeMs) }}</span>
                          </div>
                          <div v-if="getMetricNumber(log.llmCallCount) > 0" class="metric-row">
                            <span class="metric-label">LLM调用次数</span>
                            <span class="metric-value">{{ getMetricNumber(log.llmCallCount) }}</span>
                          </div>
                          <div v-if="log.stageLimitKey" class="metric-row">
                            <span class="metric-label">阶段限流</span>
                            <span class="metric-value">{{ log.stageLimitKey }} / {{ getMetricNumber(log.stagePermits) }}</span>
                          </div>
                          <div v-if="formatModelBuckets(log.modelBuckets)" class="metric-row">
                            <span class="metric-label">模型池分布</span>
                            <span class="metric-value">{{ formatModelBuckets(log.modelBuckets) }}</span>
                          </div>
                        </div>
                      </div>

                      <div v-if="log.outputDetail" class="detail-block">
                        <div class="detail-title">完整输出</div>
                        <pre class="detail-content">{{ log.outputDetail }}</pre>
                      </div>

                      <div v-if="log.errorMessage" class="detail-block">
                        <div class="detail-title error">错误信息</div>
                        <pre class="detail-content error">{{ log.errorMessage }}</pre>
                      </div>
                    </div>
                  </transition>
                </div>
              </el-timeline-item>
            </el-timeline>

            <el-empty v-else description="暂无日志数据" />
          </div>
        </el-collapse-item>

        <el-collapse-item v-if="displayStateHistory.length > 0" name="history">
          <template #title>
            <div class="section-title-row">
              <el-icon><Clock /></el-icon>
              <span>状态历史</span>
            </div>
          </template>

          <div class="state-history-section">
            <el-steps :active="displayStateHistory.length" align-center>
              <el-step
                v-for="(state, index) in displayStateHistory"
                :key="index"
                :title="getStateLabel(state.state)"
                :description="getStateStepDescription(state)"
              />
            </el-steps>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button type="primary" @click="refreshData">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Tickets, Clock, Refresh, CircleCheckFilled, CircleCloseFilled, Loading, Timer } from '@element-plus/icons-vue'
import { getWorkflowProgress } from '@/api/teacher/case'

const props = defineProps<{
  modelValue: boolean
  workflowInstanceId: number | null
  deliverableMode?: string
}>()

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const loading = ref(false)
const workflowData = ref<any>(null)
const expandedSections = ref(['overview', 'logs', 'history'])
const expandedLogIndexes = ref<number[]>([])

const FULL_PRACTICE_STATE_LABELS: Record<string, string> = {
  GENERATION: '教学需求解析Agent',
  STRUCTURING: '案例骨架生成Agent',
  VALIDATION: '结构化验证设计Agent',
  DATA_GENERATION: '模拟数据与模板库Agent',
  REVIEW: '考核方案设计Agent',
  COMPLETED: '已完成'
}

const FULL_PRACTICE_STATE_DESCRIPTIONS: Record<string, string> = {
  GENERATION: '解析教学目标、业务边界、交付物类型与评分重点',
  STRUCTURING: '生成背景故事、任务链路、参数配置和案例骨架',
  VALIDATION: '设计 ER 图、UML、ECharts、SQL 等结构化验证规则',
  DATA_GENERATION: '补全模拟数据集，并说明模板复用方式',
  REVIEW: '生成自动评分、教师评分、学生报告和班级分析方案'
}

const PURE_CODING_STATE_LABELS: Record<string, string> = {
  INPUT_PARSE: '输入解析',
  GENERATION: '案例生成Agent',
  STRUCTURING: '结构化规范Agent',
  VALIDATION: '质量校验Agent',
  DATA_GENERATION: '数据生成Agent',
  REVIEW: '教学审核Agent',
  COMPLETED: '已完成'
}

const DEFAULT_STATE_LABELS: Record<string, string> = {
  INPUT_PARSE: '输入解析',
  GENERATION: '案例生成',
  STRUCTURING: '结构化规范',
  VALIDATION: '质量校验',
  DATA_GENERATION: '数据生成',
  REVIEW: '教学审核',
  PUBLISH: '发布',
  COMPLETED: '已完成'
}

const FULL_PRACTICE_AGENT_DISPLAY: Record<string, { name: string; desc: string }> = {
  教学需求解析Agent: {
    name: '教学需求解析Agent',
    desc: '解析教学目标、业务边界、交付物类型与评分重点'
  },
  案例生成Agent: {
    name: '教学需求解析Agent',
    desc: '解析教学目标、业务边界、交付物类型与评分重点'
  },
  案例骨架生成Agent: {
    name: '案例骨架生成Agent',
    desc: '生成背景故事、任务链路、参数配置和案例骨架'
  },
  结构化规范Agent: {
    name: '案例骨架生成Agent',
    desc: '生成背景故事、任务链路、参数配置和案例骨架'
  },
  结构化验证设计Agent: {
    name: '结构化验证设计Agent',
    desc: '设计 ER 图、UML、ECharts、SQL 等结构化验证规则'
  },
  校验Agent: {
    name: '结构化验证设计Agent',
    desc: '设计 ER 图、UML、ECharts、SQL 等结构化验证规则'
  },
  模拟数据与模板库Agent: {
    name: '模拟数据与模板库Agent',
    desc: '补全模拟数据集，并说明模板复用方式'
  },
  数据生成Agent: {
    name: '模拟数据与模板库Agent',
    desc: '补全模拟数据集，并说明模板复用方式'
  },
  考核方案设计Agent: {
    name: '考核方案设计Agent',
    desc: '生成自动评分、教师评分、学生报告和班级分析方案'
  },
  审核Agent: {
    name: '考核方案设计Agent',
    desc: '生成自动评分、教师评分、学生报告和班级分析方案'
  }
}

const PURE_CODING_AGENT_DISPLAY: Record<string, { name: string; desc: string }> = {
  案例生成Agent: {
    name: '案例生成Agent',
    desc: '生成案例草稿、背景故事、任务链路和数据库设计'
  },
  结构化规范Agent: {
    name: '结构化规范Agent',
    desc: '将案例草稿规范到固定 Schema'
  },
  质量校验Agent: {
    name: '质量校验Agent',
    desc: '做质量校验和逻辑一致性检查'
  },
  接口校验设计Agent: {
    name: '质量校验Agent',
    desc: '做质量校验和逻辑一致性检查'
  },
  校验Agent: {
    name: '质量校验Agent',
    desc: '做质量校验和逻辑一致性检查'
  },
  数据生成Agent: {
    name: '数据生成Agent',
    desc: '生成结构化的数据库模拟数据'
  },
  样例数据补全Agent: {
    name: '数据生成Agent',
    desc: '生成结构化的数据库模拟数据'
  },
  教学审核Agent: {
    name: '教学审核Agent',
    desc: '做教学匹配度评估和知识点覆盖分析'
  },
  编码考核设计Agent: {
    name: '教学审核Agent',
    desc: '做教学匹配度评估和知识点覆盖分析'
  },
  审核Agent: {
    name: '教学审核Agent',
    desc: '做教学匹配度评估和知识点覆盖分析'
  }
}

const isFullPracticeWorkflow = computed(() => {
  const mode = String(props.deliverableMode || '').toUpperCase()
  if (mode === 'NON_CODE') return true
  if (mode === 'CODE') return false
  const logs = Array.isArray(workflowData.value?.logs) ? workflowData.value.logs : []
  return logs.some((log: any) => normalizeAgentName(log?.agentName) === '教学需求解析Agent')
})

const normalizeAgentName = (rawAgentName: string) => {
  const compact = String(rawAgentName || '').replace(/\s+/g, '').trim()
  if (!compact) return ''

  const aliasMap: Record<string, string> = {
    教学需求解析Agent: '教学需求解析Agent',
    案例生成Agent: '案例生成Agent',
    编码需求解析Agent: '案例生成Agent',
    案例骨架生成Agent: '案例骨架生成Agent',
    编码骨架生成Agent: '结构化规范Agent',
    结构化规范Agent: '结构化规范Agent',
    结构化验证设计Agent: '结构化验证设计Agent',
    接口校验设计Agent: '质量校验Agent',
    质量校验Agent: '质量校验Agent',
    校验Agent: '质量校验Agent',
    模拟数据与模板库Agent: '模拟数据与模板库Agent',
    样例数据补全Agent: '数据生成Agent',
    数据生成Agent: '数据生成Agent',
    考核方案设计Agent: '考核方案设计Agent',
    编码考核设计Agent: '教学审核Agent',
    教学审核Agent: '教学审核Agent',
    审核Agent: '教学审核Agent'
  }

  return aliasMap[compact] || compact
}

const displayStateHistory = computed(() => {
  const history = Array.isArray(workflowData.value?.stateHistory) ? workflowData.value.stateHistory : []
  if (!isFullPracticeWorkflow.value) return history
  return history.filter((item: any) => String(item?.state || '').toUpperCase() !== 'INPUT_PARSE')
})

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val && props.workflowInstanceId) {
      loadWorkflowData()
    }
  }
)

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const loadWorkflowData = async () => {
  if (!props.workflowInstanceId) return

  loading.value = true
  try {
    const res = await getWorkflowProgress(props.workflowInstanceId)
    workflowData.value = res.data
    expandedLogIndexes.value = []
  } catch (error: any) {
    ElMessage.error(error.message || '加载日志失败')
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  loadWorkflowData()
}

const handleClose = () => {
  visible.value = false
}

const getStatusType = (status: string) => {
  switch (String(status || '').toUpperCase()) {
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

const getStatusText = (status: string) => {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return '执行成功'
    case 'FAILED':
      return '执行失败'
    case 'RUNNING':
      return '执行中'
    case 'PENDING':
      return '等待中'
    default:
      return '未知状态'
  }
}

const getStateLabel = (state: string) => {
  const normalizedState = String(state || '').toUpperCase()
  if (isFullPracticeWorkflow.value) {
    return FULL_PRACTICE_STATE_LABELS[normalizedState] || DEFAULT_STATE_LABELS[normalizedState] || state
  }
  return PURE_CODING_STATE_LABELS[normalizedState] || DEFAULT_STATE_LABELS[normalizedState] || state
}

const getStateDescription = (state: string) => {
  const normalizedState = String(state || '').toUpperCase()
  if (!isFullPracticeWorkflow.value) return ''
  return FULL_PRACTICE_STATE_DESCRIPTIONS[normalizedState] || ''
}

const getStateStepDescription = (stateItem: any) => {
  const desc = getStateDescription(stateItem?.state)
  const time = formatTimestamp(stateItem?.timestamp)
  return desc ? `${desc}\n${time}` : time
}

const getLogTimelineType = (status: string) => getStatusType(status)

const getLogIcon = (status: string) => {
  switch (String(status || '').toUpperCase()) {
    case 'SUCCESS':
      return CircleCheckFilled
    case 'FAILED':
      return CircleCloseFilled
    case 'RUNNING':
      return Loading
    default:
      return undefined
  }
}

const getLogStatusType = (status: string) => getStatusType(status)
const getLogStatusText = (status: string) => getStatusText(status)

const getDisplayAgentMeta = (rawAgentName: string) => {
  const normalizedName = normalizeAgentName(rawAgentName)
  const mapping = isFullPracticeWorkflow.value ? FULL_PRACTICE_AGENT_DISPLAY : PURE_CODING_AGENT_DISPLAY
  return mapping[normalizedName] || { name: normalizedName || '未命名Agent', desc: '' }
}

const getDisplayAgentName = (rawAgentName: string) => getDisplayAgentMeta(rawAgentName).name
const getDisplayAgentDescription = (rawAgentName: string) => getDisplayAgentMeta(rawAgentName).desc

const toggleLogExpand = (index: number) => {
  const exists = expandedLogIndexes.value.includes(index)
  expandedLogIndexes.value = exists
    ? expandedLogIndexes.value.filter((item) => item !== index)
    : [...expandedLogIndexes.value, index]
}

const formatTimestamp = (timestamp: string) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

const getMetricNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? Math.max(0, num) : 0
}

const formatMetricDuration = (value: unknown) => formatDuration(getMetricNumber(value))

const formatModelBuckets = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, count]) => [key, getMetricNumber(count)] as const)
    .filter(([, count]) => count > 0)
  return entries.map(([key, count]) => `${key}:${count}`).join(' / ')
}

const hasTimingBreakdown = (log: any) => {
  return getMetricNumber(log?.queueWaitMs) > 0
    || getMetricNumber(log?.stageQueueWaitMs) > 0
    || getMetricNumber(log?.llmQueueWaitMs) > 0
    || getMetricNumber(log?.llmModelTimeMs) > 0
    || getMetricNumber(log?.llmCallCount) > 0
}
</script>

<style scoped lang="scss">
.workflow-logs-container {
  max-height: 78vh;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.workflow-collapse {
  :deep(.el-collapse-item__header) {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 1px solid #e2e8f0;
  }

  :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 8px;
  }
}

.section-title-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;

  .el-icon {
    color: #0ea5e9;
    font-size: 18px;
  }
}

.workflow-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  margin-bottom: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);

  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;

    .label {
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
      min-width: 72px;
    }

    .value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 700;
    }
  }

  .progress-item {
    align-items: center;

    :deep(.el-progress) {
      flex: 1;
    }
  }
}

.logs-section,
.state-history-section {
  margin-bottom: 16px;
}

.log-item {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
    border-color: #cbd5e1;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .agent-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .agent-name {
        font-size: 15px;
        font-weight: 700;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 8px;

        &::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 14px;
          background: #0ea5e9;
          border-radius: 2px;
        }
      }

      .agent-desc {
        font-size: 12px;
        line-height: 1.6;
        color: #64748b;
      }
    }
  }

  .log-meta {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;

    .el-icon {
      font-size: 14px;
    }
  }

  .log-metrics {
    margin-bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
      padding: 4px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      line-height: 1.4;
      border: 1px solid #bfdbfe;
    }
  }

  .log-output {
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #334155;
    line-height: 1.7;
    border-left: 3px solid #cbd5e1;
    white-space: pre-wrap;
  }

  .log-expand-actions {
    margin-bottom: 6px;
  }

  .log-detail-panel {
    margin-top: 12px;
    display: grid;
    gap: 12px;
  }

  .detail-block {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
    overflow: hidden;
  }

  .detail-title {
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    background: #eef2ff;

    &.error {
      color: #b42318;
      background: #fef3f2;
    }
  }

  .detail-content {
    margin: 0;
    padding: 12px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.7;
    font-size: 13px;
    color: #334155;

    &.error {
      color: #b42318;
    }
  }

  .detail-metrics {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: #ffffff;
  }

  .metric-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .metric-label {
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
  }

  .metric-value {
    color: #0f172a;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
    word-break: break-word;
  }
}

.state-history-section {
  :deep(.el-step__title) {
    font-size: 13px;
    font-weight: 600;
  }

  :deep(.el-step__description) {
    font-size: 11px;
    white-space: pre-line;
    line-height: 1.6;
  }

  :deep(.el-step__head.is-finish) {
    color: #10b981;
    border-color: #10b981;
  }

  :deep(.el-step__title.is-finish) {
    color: #10b981;
  }

  :deep(.el-step__head.is-process) {
    color: #0ea5e9;
    border-color: #0ea5e9;
  }

  :deep(.el-step__title.is-process) {
    color: #0ea5e9;
  }
}

:deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);

  .el-dialog__header {
    padding: 20px 24px;
    margin: 0;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;

    .el-dialog__title {
      font-weight: 700;
      color: #0f172a;
      font-size: 18px;
    }
  }

  .el-dialog__body {
    padding: 24px;
  }

  .el-dialog__footer {
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
}
</style>
