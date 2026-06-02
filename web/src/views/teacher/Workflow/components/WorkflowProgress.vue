<template>
  <div class="workflow-progress-container animate__animated animate__fadeIn">
    <!-- 头部状态栏 -->
    <div class="workflow-header" :class="statusClass">
      <div class="header-content">
        <div class="header-left">
          <div class="icon-wrapper">
            <el-icon class="status-icon" :class="{ 'is-spinning': status === 'processing' }">
              <component :is="statusIcon" />
            </el-icon>
          </div>
          <div class="status-info">
            <h3 class="title">Agent 工作流执行中</h3>
            <p class="subtitle">{{ currentStageLabel }}</p>
          </div>
        </div>
        <div class="header-right">
          <div v-if="qualityScore != null && status === 'completed'" class="overall-score" :class="getScoreLevel(qualityScore)">
            {{ getScoreIcon(qualityScore) }} {{ qualityScore }}分 · {{ getScoreLabel(qualityScore) }}
          </div>
          <el-tag :type="statusType" effect="dark" round size="large">
            {{ statusLabel }}
          </el-tag>
        </div>
      </div>
      
      <!-- 进度条 -->
      <div class="progress-bar-wrapper">
        <el-progress 
          :percentage="progressPercentage" 
          :status="status === 'failed' ? 'exception' : 'success'"
          :stroke-width="4"
          :show-text="false"
          :indeterminate="status === 'processing'"
          :duration="2"
        />
      </div>
    </div>

    <!-- 步骤时间轴 -->
    <el-card shadow="never" class="steps-card custom-scrollbar">
      <el-timeline>
        <el-timeline-item
          v-for="(step, index) in steps"
          :key="index"
          :type="getStepType(step.status)"
          :color="getStepColor(step.status)"
          :hollow="step.status === 'pending'"
          :timestamp="step.time"
          placement="top"
          size="large"
        >
          <div class="step-content">
            <div class="step-header">
              <span class="step-title">{{ step.name }}</span>
              <el-tag size="small" :type="getStepType(step.status)" effect="plain">
                {{ getStepStatusLabel(step.status) }}
              </el-tag>
            </div>
            <div class="step-desc" v-if="step.description">{{ step.description }}</div>
            
            <!-- 质量评分标签 -->
            <div v-if="step.qualityScore != null && step.status === 'completed'" class="quality-score-badge" :class="getScoreLevel(step.qualityScore)">
              <span class="score-icon">{{ getScoreIcon(step.qualityScore) }}</span>
              <span class="score-value">{{ step.qualityScore }}分</span>
              <span class="score-label">{{ getScoreLabel(step.qualityScore) }}</span>
            </div>
            
            <!-- 步骤日志/详情 -->
            <div v-if="step.logs && step.logs.length > 0" class="step-logs">
              <div v-for="(log, idx) in step.logs" :key="idx" class="log-item">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-msg">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- 错误信息 -->
    <transition name="el-zoom-in-top">
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="error-alert mt-4"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  Loading, CircleCheckFilled, CircleCloseFilled, WarningFilled, 
  VideoPlay, Operation, EditPen, Monitor 
} from '@element-plus/icons-vue'
import 'animate.css'

interface Log {
  time: string
  message: string
}

interface Step {
  name: string
  description?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  time?: string
  logs?: Log[]
  qualityScore?: number
}

interface Props {
  currentPhase: string
  steps: Step[]
  logs: Log[]
  error?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reviewing'
  qualityScore?: number
}

const props = withDefaults(defineProps<Props>(), {
  steps: () => [],
  logs: () => [],
  status: 'pending'
})

// 计算属性
const statusIcon = computed(() => {
  switch (props.status) {
    case 'processing': return Loading
    case 'completed': return CircleCheckFilled
    case 'failed': return CircleCloseFilled
    case 'reviewing': return WarningFilled
    default: return VideoPlay
  }
})

const statusType = computed(() => {
  switch (props.status) {
    case 'processing': return 'primary'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'reviewing': return 'warning'
    default: return 'info'
  }
})

const statusClass = computed(() => `status-${props.status}`)

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '等待开始',
    processing: '执行中',
    completed: '执行完成',
    failed: '执行失败',
    reviewing: '等待审核'
  }
  return map[props.status] || props.status
})

const currentStageLabel = computed(() => {
  const stageMap: Record<string, string> = {
    'INIT': '初始化环境',
    'REQUIREMENT_ANALYSIS': 'Agent 需求分析',
    'CASE_DESIGN': 'Agent 案例设计',
    'KNOWLEDGE_EXTRACTION': 'Agent 知识点提取',
    'QUESTION_GENERATION': 'Agent 题目生成',
    'QUALITY_REVIEW': 'Agent 质量审核',
    'DATA_GENERATION': '模拟数据生成',
    'COMPLETED': '全部完成'
  }
  return stageMap[props.currentPhase] || props.currentPhase
})

const progressPercentage = computed(() => {
  if (props.steps.length === 0) return 0
  const completed = props.steps.filter(s => s.status === 'completed').length
  return Math.floor((completed / props.steps.length) * 100)
})

// 辅助函数
const getStepType = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'processing': return 'primary'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

const getStepColor = (status: string) => {
  switch (status) {
    case 'completed': return '#67c23a'
    case 'processing': return '#409eff'
    case 'failed': return '#f56c6c'
    default: return '#e4e7ed'
  }
}

const getStepStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '等待中',
    processing: '进行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

// 质量评分可视化辅助函数
const getScoreLevel = (score: number) => {
  if (score >= 85) return 'level-excellent'
  if (score >= 70) return 'level-good'
  return 'level-poor'
}

const getScoreIcon = (score: number) => {
  if (score >= 85) return '🟢'
  if (score >= 70) return '🟡'
  return '🔴'
}

const getScoreLabel = (score: number) => {
  if (score >= 85) return '优秀 - 可直接发布'
  if (score >= 70) return '良好 - 建议检查'
  return '需改进 - 建议重新生成'
}
</script>

<style scoped lang="scss">
.workflow-progress-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.workflow-header {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #e4e7ed;
  transition: all 0.3s ease;
  
  &.status-processing { border-left: 4px solid #409eff; }
  &.status-completed { border-left: 4px solid #67c23a; }
  &.status-failed { border-left: 4px solid #f56c6c; }
  &.status-reviewing { border-left: 4px solid #e6a23c; }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .overall-score {
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        
        &.level-excellent { background: #ecfdf5; color: #065f46; }
        &.level-good { background: #fffbeb; color: #92400e; }
        &.level-poor { background: #fef2f2; color: #991b1b; }
      }
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #f2f6fc;
        display: flex;
        align-items: center;
        justify-content: center;
        
        .status-icon {
          font-size: 24px;
          color: #606266;
          
          &.is-spinning {
            animation: rotate 2s linear infinite;
            color: #409eff;
          }
        }
      }
      
      .status-info {
        .title {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
          color: #303133;
        }
        .subtitle {
          margin: 0;
          font-size: 14px;
          color: #909399;
        }
      }
    }
  }
}

.steps-card {
  border-radius: 12px;
  max-height: 400px;
  overflow-y: auto;
  
  .step-content {
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    margin-top: 4px;
    
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      
      .step-title {
        font-weight: 600;
        color: #303133;
      }
    }
    
    .step-desc {
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
    }
    
    .quality-score-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 8px;
      
      .score-icon { font-size: 14px; }
      .score-value { font-weight: 700; }
      .score-label { opacity: 0.85; }
      
      &.level-excellent {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      &.level-good {
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
      }
      &.level-poor {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }
    }
    
    .step-logs {
      border-top: 1px solid #ebeef5;
      padding-top: 8px;
      margin-top: 8px;
      
      .log-item {
        display: flex;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 2px;
        font-family: monospace;
        
        .log-time {
          color: #909399;
          white-space: nowrap;
        }
        .log-msg {
          color: #606266;
        }
      }
    }
  }
}

.error-alert {
  border-radius: 8px;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mt-4 { margin-top: 16px; }
</style>