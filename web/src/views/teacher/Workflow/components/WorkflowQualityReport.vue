<template>
  <el-dialog
    v-model="visible"
    title="工作流质量报告"
    width="960px"
    :teleported="false"
    destroy-on-close
    align-center
    class="workflow-report-dialog"
  >
    <div v-loading="loading" class="report-content">
      <el-row :gutter="16" class="overview-cards">
        <el-col :span="6">
          <el-card shadow="hover" class="metric-card quality">
            <div class="metric-icon quality">
              <el-icon><StarFilled /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ qualityScore || '-' }}</div>
              <div class="metric-label">质量评分</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric-card time">
            <div class="metric-icon time">
              <el-icon><Timer /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ totalDuration }}s</div>
              <div class="metric-label">总耗时</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric-card queue">
            <div class="metric-icon queue">
              <el-icon><Histogram /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ totalQueueDuration }}s</div>
              <div class="metric-label">总排队</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="metric-card status" :class="statusClass">
            <div class="metric-icon" :class="workflowStatus === 'SUCCESS' ? 'status-success' : 'status-error'">
              <el-icon><component :is="workflowStatus === 'SUCCESS' ? CircleCheckFilled : CircleCloseFilled" /></el-icon>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ statusText }}</div>
              <div class="metric-label">最终状态</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="section-card mt-4">
        <template #header>
          <div class="section-header">
            <div class="header-left">
              <el-icon class="text-primary"><Clock /></el-icon>
              <span class="title">Agent 执行时间线</span>
            </div>
            <el-tag size="small" effect="plain">全程追踪</el-tag>
          </div>
        </template>

        <div class="timeline-container custom-scrollbar">
          <el-timeline class="agent-timeline">
            <el-timeline-item
              v-for="(agent, index) in agentLogs"
              :key="index"
              :timestamp="formatTime(agent.startTime)"
              :type="getAgentTimelineType(agent.status)"
              :hollow="agent.status === 'RUNNING'"
              :icon="Connection"
              size="large"
            >
              <el-card shadow="hover" class="timeline-card">
                <div class="timeline-header">
                  <div class="agent-info">
                    <span class="agent-name">{{ agent.agentName }}</span>
                    <el-tag :type="getStatusTagType(agent.status)" size="small" effect="dark" class="ml-2">
                      {{ agent.status }}
                    </el-tag>
                  </div>
                  <div class="timeline-meta">
                    <el-tag v-if="agent.durationMs" size="small" type="info" effect="plain">
                      总耗时 {{ formatMetricDuration(agent.durationMs) }}
                    </el-tag>
                  </div>
                </div>

                <div v-if="hasTimingBreakdown(agent)" class="timeline-metrics">
                  <span v-if="getMetricNumber(agent.queueWaitMs) > 0">排队 {{ formatMetricDuration(agent.queueWaitMs) }}</span>
                  <span v-if="getMetricNumber(agent.stageQueueWaitMs) > 0">阶段排队 {{ formatMetricDuration(agent.stageQueueWaitMs) }}</span>
                  <span v-if="getMetricNumber(agent.llmQueueWaitMs) > 0">LLM排队 {{ formatMetricDuration(agent.llmQueueWaitMs) }}</span>
                  <span v-if="getMetricNumber(agent.llmModelTimeMs) > 0">模型耗时 {{ formatMetricDuration(agent.llmModelTimeMs) }}</span>
                  <span v-if="getMetricNumber(agent.llmCallCount) > 0">LLM调用 {{ getMetricNumber(agent.llmCallCount) }}</span>
                </div>

                <div v-if="formatModelBuckets(agent.modelBuckets)" class="timeline-buckets">
                  模型池分布：{{ formatModelBuckets(agent.modelBuckets) }}
                </div>

                <div v-if="agent.outputSummary" class="timeline-output">
                  <div class="output-label">输出摘要</div>
                  <div class="output-text">{{ agent.outputSummary }}</div>
                </div>

                <div v-if="agent.errorMessage" class="timeline-error">
                  <el-alert :title="agent.errorMessage" type="error" :closable="false" show-icon />
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </el-card>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  StarFilled,
  Timer,
  CircleCheckFilled,
  CircleCloseFilled,
  Clock,
  Connection,
  Histogram
} from '@element-plus/icons-vue'
import { getWorkflowProgress } from '@/api/teacher/case'

interface Props {
  workflowInstanceId?: number | null
  caseId?: number | null
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const loading = ref(false)
const workflowData = ref<any>(null)

const loadWorkflowData = async () => {
  if (!props.workflowInstanceId) return
  loading.value = true
  try {
    const res = await getWorkflowProgress(props.workflowInstanceId)
    workflowData.value = res.data
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.workflowInstanceId,
  async (newId) => {
    if (newId && visible.value) {
      await loadWorkflowData()
    }
  }
)

watch(visible, async (val) => {
  if (val && props.workflowInstanceId) {
    await loadWorkflowData()
  }
})

const qualityScore = computed(() => {
  const score = workflowData.value?.qualityScore
  return score ? Number(score).toFixed(1) : null
})

const totalDuration = computed(() => {
  const duration = workflowData.value?.durationMs
  return duration ? (duration / 1000).toFixed(2) : '0'
})

const totalQueueDuration = computed(() => {
  const total = agentLogs.value.reduce((sum: number, agent: any) => {
    return sum + getMetricNumber(agent?.queueWaitMs)
  }, 0)
  return (total / 1000).toFixed(2)
})

const workflowStatus = computed(() => workflowData.value?.status || 'UNKNOWN')

const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    SUCCESS: '成功',
    FAILED: '失败',
    RUNNING: '运行中',
    PENDING: '待执行'
  }
  return statusMap[workflowStatus.value] || workflowStatus.value
})

const statusClass = computed(() => {
  return workflowStatus.value === 'SUCCESS' ? 'status-success' : 'status-error'
})

const agentLogs = computed(() => workflowData.value?.logs || [])

const formatTime = (time: string) => (time ? new Date(time).toLocaleTimeString() : '')

const getAgentTimelineType = (status: string) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'primary'
  return 'info'
}

const getStatusTagType = (status: string) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'primary'
  return 'info'
}

const getMetricNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? Math.max(0, num) : 0
}

const formatMetricDuration = (value: unknown) => {
  const ms = getMetricNumber(value)
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

const formatModelBuckets = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, count]) => [key, getMetricNumber(count)] as const)
    .filter(([, count]) => count > 0)
  return entries.map(([key, count]) => `${key}:${count}`).join(' / ')
}

const hasTimingBreakdown = (agent: any) => {
  return getMetricNumber(agent?.queueWaitMs) > 0
    || getMetricNumber(agent?.stageQueueWaitMs) > 0
    || getMetricNumber(agent?.llmQueueWaitMs) > 0
    || getMetricNumber(agent?.llmModelTimeMs) > 0
    || getMetricNumber(agent?.llmCallCount) > 0
}
</script>

<style scoped lang="scss">
.report-content {
  padding: 8px;
}

.overview-cards {
  .metric-card {
    border-radius: 12px;
    border: none;
    transition: transform 0.3s ease;

    &:hover {
      transform: translateY(-4px);
    }

    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;

      &.quality {
        background: #fff7e6;
        color: #faad14;
      }

      &.time {
        background: #e0f2fe;
        color: #0284c7;
      }

      &.queue {
        background: #ecfeff;
        color: #0891b2;
      }

      &.status-success {
        background: #f0fdf4;
        color: #16a34a;
      }

      &.status-error {
        background: #fef2f2;
        color: #dc2626;
      }
    }

    .metric-info {
      .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: #1f2d3d;
        line-height: 1.2;
      }

      .metric-label {
        font-size: 13px;
        color: #8492a6;
        margin-top: 4px;
      }
    }
  }
}

.section-card {
  border-radius: 12px;
  border: 1px solid #ebeef5;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }
}

.timeline-container {
  max-height: 480px;
  overflow-y: auto;
  padding: 0 10px;
}

.timeline-card {
  border-radius: 8px;

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .agent-info {
      display: flex;
      align-items: center;

      .agent-name {
        font-weight: 600;
        font-size: 15px;
        color: #303133;
      }
    }
  }

  .timeline-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;

    span {
      padding: 4px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      border: 1px solid #bfdbfe;
    }
  }

  .timeline-buckets {
    margin-bottom: 10px;
    font-size: 12px;
    color: #475569;
  }

  .timeline-output {
    background: #f8fafc;
    padding: 10px;
    border-radius: 6px;
    margin-top: 8px;
    font-size: 13px;

    .output-label {
      color: #8492a6;
      margin-bottom: 4px;
      font-size: 12px;
    }

    .output-text {
      color: #606266;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  .timeline-error {
    margin-top: 8px;
  }
}

.ml-2 {
  margin-left: 8px;
}

.mt-4 {
  margin-top: 16px;
}

.text-primary {
  color: #409eff;
}
</style>
