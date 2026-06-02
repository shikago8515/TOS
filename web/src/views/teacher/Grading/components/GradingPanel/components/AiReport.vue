<template>
  <div class="ai-report-wrapper">
    <div class="report-section" v-if="isFullPracticeMultiAgent">
      <div class="section-title">
        <el-icon class="icon-primary"><Connection /></el-icon> 完整实训多 Agent 评分
      </div>

      <div class="agent-stage-grid">
        <div
          v-for="agent in agentStages"
          :key="agent.key"
          class="agent-stage-card"
        >
          <div class="agent-stage-top">
            <div class="agent-stage-name">{{ agent.name }}</div>
            <el-tag size="small" type="success" effect="plain">已纳入评分</el-tag>
          </div>
          <div class="agent-stage-desc">{{ agent.description }}</div>
          <div class="agent-stage-focus">{{ agent.focus }}</div>
        </div>
      </div>
    </div>

    <div class="report-section" v-if="dimensionCards.length">
      <div class="section-title">
        <el-icon class="icon-success"><DataAnalysis /></el-icon> 五维评分概览
      </div>

      <div class="dimension-grid">
        <div
          v-for="item in dimensionCards"
          :key="item.criterionName"
          class="dimension-card"
        >
          <div class="dimension-header">
            <div class="dimension-title">{{ item.criterionName }}</div>
            <div class="dimension-score">{{ item.finalScore ?? item.aiScore ?? 0 }}/{{ item.maxScore ?? 0 }}</div>
          </div>
          <div class="dimension-desc">{{ item.criterionDescription || '系统按对应维度完成评分。' }}</div>
          <div class="dimension-reason" v-if="item.aiReason">{{ firstSegment(item.aiReason) }}</div>
        </div>
      </div>
    </div>

    <!-- 总体评价 -->
    <div class="report-section" v-if="aiResult?.overallFeedback">
      <div class="section-title">
        <el-icon class="icon-primary"><ChatLineSquare /></el-icon> 综合评价
      </div>
      <AiFeedback :content="formatMarkdownText(aiResult.overallFeedback)" />
    </div>

    <!-- 评分过程 -->
    <div class="report-section" v-if="aiProcess && processSteps.length">
      <div class="section-title">
        <el-icon class="icon-success"><Finished /></el-icon> 评分过程追踪
      </div>
      
      <div class="process-status-bar">
        <div class="status-item">
          <span class="label">当前状态</span>
          <el-tag :type="getProcessStatusTagType(aiProcess.snapshotStatus)" effect="dark">
            {{ processStatusText(aiProcess.snapshotStatus) }}
          </el-tag>
        </div>
        <div class="status-item">
          <span class="label">完成步骤</span>
          <span class="value">{{ aiProcess.completedSteps || 0 }} / {{ aiProcess.totalSteps || 7 }}</span>
        </div>
        <div class="status-item">
          <span class="label">AI 评分</span>
          <span class="value score">{{ aiProcess.overallScore || '-' }}</span>
        </div>
      </div>

      <el-timeline class="custom-timeline">
        <el-timeline-item
          v-for="step in processSteps"
          :key="`${step.stepNo}-${step.stepCode}`"
          :type="step.status === 'SUCCESS' ? 'success' : (step.status === 'FAILED' ? 'danger' : 'warning')"
          :hollow="step.status === 'PENDING'"
          :timestamp="step.endTime ? formatDate(step.endTime) : ''"
        >
          <div class="timeline-card">
            <div class="timeline-header">
              <span class="step-name">{{ step.stepNo }}. {{ step.stepName || step.stepCode }}</span>
              <span class="step-score-badge" v-if="step.stepScore != null">
                {{ step.stepScore }} 分
              </span>
            </div>
            <div class="timeline-agent" v-if="step.agentName">
              <el-tag size="small" type="info" effect="plain">{{ step.agentName }}</el-tag>
            </div>
            <div class="timeline-error" v-if="step.errorMessage">
              <div v-for="(seg, i) in formatTextSegments(step.errorMessage)" :key="i" class="error-segment">
                {{ seg }}
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>

      <!-- 失分项 -->
      <div class="deduction-panel" v-if="deductionItems.length">
        <div class="panel-header">失分明细</div>
        <div class="deduction-list">
          <div class="deduction-row" v-for="item in deductionItems" :key="item.stepCode">
            <span class="row-label">{{ item.stepName || item.stepCode }}</span>
            <span class="row-value text-danger">-{{ Number(item.deductedScore || 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChatLineSquare, Finished, Connection, DataAnalysis } from '@element-plus/icons-vue'
import AiFeedback from '../../AiFeedback.vue'
import dayjs from 'dayjs'

const props = defineProps({
  aiResult: Object,
  aiProcess: Object
})

const processSteps = computed(() => {
  if (!props.aiProcess || !props.aiProcess.stepsJson) return []
  try {
    return JSON.parse(props.aiProcess.stepsJson)
  } catch (e) {
    return []
  }
})

const deductionItems = computed(() => {
  if (!props.aiProcess || !props.aiProcess.deductionsJson) return []
  try {
    return JSON.parse(props.aiProcess.deductionsJson)
  } catch (e) {
    return []
  }
})

const FULL_PRACTICE_SOURCE = 'FULL_PRACTICE_MULTI_AGENT_WORKFLOW_CONTEXT'

const orderedDimensionNames = [
  '题目理解与要求对齐',
  '实验报告与文档质量',
  '结构化成果与图示质量',
  '代码实现与数据库证据',
  '运行验证与结果分析'
]

const isFullPracticeMultiAgent = computed(() => {
  const scoreSource = props.aiResult?.scoreSource
  const detailNames = Array.isArray(props.aiResult?.details)
    ? props.aiResult.details.map(item => item?.criterionName).filter(Boolean)
    : []
  return scoreSource === FULL_PRACTICE_SOURCE || orderedDimensionNames.some(name => detailNames.includes(name))
})

const agentStages = computed(() => [
  {
    key: 'task_briefing',
    name: 'Task Briefing Agent',
    description: '先读取题目描述、任务要求和校验规则，提炼评分重点与必须交付物。',
    focus: '关注：题目目标、关键技术点、失分风险'
  },
  {
    key: 'requirement_alignment',
    name: 'Requirement Alignment Agent',
    description: '判断学生提交是否真正覆盖题目要求和交付要求。',
    focus: '关注：要求覆盖、交付物完整性'
  },
  {
    key: 'structured_artifact',
    name: 'Structured Artifact Agent',
    description: '分析 ER 图、流程图、运行截图等结构化成果，并结合自动校验结果。',
    focus: '关注：图示质量、结构化证据'
  },
  {
    key: 'implementation_evidence',
    name: 'Implementation Evidence Agent',
    description: '综合报告正文、源码压缩包摘录、SQL 与运行说明评估实现质量。',
    focus: '关注：代码实现、数据库证据、运行可信度'
  },
  {
    key: 'report_quality',
    name: 'Report Quality / Final Judge',
    description: '评估报告表达与分析深度，并汇总前面各 Agent 结果给出最终成绩。',
    focus: '关注：文档质量、结果分析、综合判分'
  }
])

const dimensionCards = computed(() => {
  const details = Array.isArray(props.aiResult?.details) ? props.aiResult.details : []
  if (!details.length) return []
  const mapped = new Map(details.map(item => [item?.criterionName, item]))
  const ordered = orderedDimensionNames
    .map(name => mapped.get(name))
    .filter(Boolean)
  return ordered.length ? ordered : details
})

const formatDate = (time) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const getProcessStatusTagType = (status) => {
  const map = {
    'PENDING': 'info',
    'PROCESSING': 'primary',
    'COMPLETED': 'success',
    'FAILED': 'danger'
  }
  return map[status] || 'info'
}

const processStatusText = (status) => {
  const map = {
    'PENDING': '等待中',
    'PROCESSING': '评分中',
    'COMPLETED': '已完成',
    'FAILED': '失败'
  }
  return map[status] || status
}

const formatTextSegments = (text) => {
  if (!text) return []
  let content = text.toString()
  content = content.replace(/\\n/g, '\n')
  content = content.replace(/([^\n])\s*(\d+[\.\、])/g, '$1\n$2')
  content = content.replace(/([。！？])\s*/g, '$1\n')
  return content.split('\n').map(s => s.trim()).filter(s => s.length > 0)
}

const formatMarkdownText = (text) => {
  if (!text) return ''
  // Use the same segmentation logic but join with double newlines for Markdown paragraphs
  const segments = formatTextSegments(text)
  return segments.join('\n\n')
}

const firstSegment = (text) => {
  const segments = formatTextSegments(text)
  return segments[0] || ''
}
</script>

<style scoped lang="scss">
$primary-color: #10b981;
$text-main: #1f2937;
$text-secondary: #6b7280;

.ai-report-wrapper {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  font-size: 17px;

  :deep(.el-tag),
  :deep(.el-timeline-item__timestamp) {
    font-size: 15px;
  }
}

.report-section {
  margin-bottom: 24px;
  
  .section-title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: $text-main;
    
    .el-icon {
      font-size: 22px;
    }
    .icon-primary { color: $primary-color; }
    .icon-success { color: #67c23a; }
  }
}

.agent-stage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.agent-stage-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf9 100%);
  border: 1px solid #d9f3e7;
  border-radius: 10px;
  padding: 16px;
}

.agent-stage-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.agent-stage-name {
  font-size: 17px;
  font-weight: 700;
  color: $text-main;
}

.agent-stage-desc {
  font-size: 16px;
  line-height: 1.7;
  color: $text-main;
  margin-bottom: 10px;
}

.agent-stage-focus {
  font-size: 15px;
  color: $text-secondary;
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.dimension-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 10px;
}

.dimension-title {
  font-size: 17px;
  font-weight: 700;
  color: $text-main;
}

.dimension-score {
  font-size: 22px;
  font-weight: 700;
  color: $primary-color;
  white-space: nowrap;
}

.dimension-desc {
  font-size: 16px;
  line-height: 1.7;
  color: $text-secondary;
  margin-bottom: 8px;
}

.dimension-reason {
  font-size: 15px;
  line-height: 1.7;
  color: $text-main;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.process-status-bar {
  display: flex;
  gap: 40px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 20px;
  
  .status-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .label {
      font-size: 15px;
      color: $text-secondary;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .value {
      font-weight: 600;
      font-size: 19px;
      color: $text-main;
      
      &.score {
        color: $primary-color;
        font-size: 30px;
      }
    }
  }
}

.timeline-card {
  background: #fff;
  border: 1px solid #f3f4f6;
  padding: 12px 16px;
  border-radius: 6px;
  
  .timeline-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 500;
    color: $text-main;
    font-size: 16px;
  }
  
  .step-score-badge {
    color: $primary-color;
    font-weight: bold;
    font-family: monospace;
  }
  
  .timeline-error {
    color: #ef4444;
    font-size: 15px;
    margin-top: 8px;
    background: #fef2f2;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid #fee2e2;
    
    .error-segment {
      margin-bottom: 4px;
      &:last-child { margin-bottom: 0; }
    }
  }
}

.deduction-panel {
  background: #fff;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  
  .panel-header {
    color: #ef4444;
    font-weight: 600;
    font-size: 17px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    &::before {
      content: '';
      display: block;
      width: 4px;
      height: 16px;
      background: #ef4444;
      border-radius: 2px;
    }
  }
  
  .deduction-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 16px;
    
    &:last-child { border-bottom: none; }
    
    .row-value { 
      font-weight: bold; 
      color: #ef4444;
      font-family: monospace;
    }
  }
}
</style>
