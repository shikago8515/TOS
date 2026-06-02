<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="$emit('update:visible', $event)"
    title="实训验收报告" 
    width="1100px"
    :teleported="false"
    top="5%"
    destroy-on-close
    class="custom-result-dialog"
    :close-on-click-modal="false"
    append-to-body
  >
    <div v-loading="loading" class="result-body">
      <!-- 错误状态 -->
      <div v-if="error" class="error-state">
        <el-empty description="获取结果失败" :image-size="120">
          <template #description>
            <p class="error-text">{{ error }}</p>
          </template>
        </el-empty>
      </div>

      <!-- 评分中状态 -->
      <div v-else-if="isGrading" class="grading-wrapper">
        <div class="grading-header">
          <div class="radar-scan">
            <div class="radar-beam"></div>
          </div>
          <h3>AI 智能评分正在进行中</h3>
          <p>{{ gradingProgressMessage || '系统正在对您的作业进行深度分析，请稍候...' }}</p>
        </div>
        
        <div class="grading-progress-box">
          <el-progress 
            :percentage="gradingProgressPercent || 0" 
            :status="gradingProgressStatus || ''" 
            :stroke-width="16"
            striped
            striped-flow
            :duration="10"
          />
        </div>

        <div class="agent-steps-container" v-if="(gradingProgressSteps || []).length">
          <div class="steps-label">评测流程追踪</div>
          <div class="steps-grid">
            <div 
              v-for="step in gradingProgressSteps" 
              :key="`${step.stepNo}-${step.agentName}`"
              class="step-card"
              :class="step.status"
            >
              <div class="step-icon">
                <el-icon v-if="step.status === 'success'"><Check /></el-icon>
                <el-icon v-else-if="step.status === 'failed'"><CloseBold /></el-icon>
                <el-icon v-else class="is-loading"><Loading /></el-icon>
              </div>
              <div class="step-info">
                <div class="step-name">{{ step.stepName || step.agentName }}</div>
                <div class="step-status">{{ getStepStatusText(step.status) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果展示状态 (Two Column Layout) -->
      <div v-else-if="validation || dialogGradingResult" class="report-layout">
        <!-- Left Panel: Summary & Feedback -->
        <div class="left-panel">
          <!-- Score Card -->
          <div class="score-card">
            <div class="score-ring-wrapper">
              <svg viewBox="0 0 100 100" class="score-ring">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f0f2f5" stroke-width="6" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" 
                  :stroke="isPass ? '#00b96b' : '#ff4d4f'" 
                  stroke-width="6" 
                  stroke-dasharray="283" 
                  :stroke-dashoffset="283 - (283 * (Number(displayScore) || 0) / 100)"
                  stroke-linecap="round"
                  class="score-progress"
                />
              </svg>
              <div class="score-text">
                <span class="val">{{ displayScore ?? '--' }}</span>
                <span class="label">总分</span>
              </div>
            </div>
            
            <div class="result-status" :class="isPass ? 'success' : 'fail'">
              <el-icon><CircleCheckFilled v-if="isPass" /><CircleCloseFilled v-else /></el-icon>
              {{ isPass ? '验收通过' : '未通过' }}
            </div>

            <div class="meta-list">
              <div class="meta-row">
                <span class="label">任务：</span>
                <span class="val" :title="taskName">{{ taskName }}</span>
              </div>
              <div class="meta-row">
                <span class="label">文件：</span>
                <span class="val" :title="fileName">{{ fileName || '-' }}</span>
              </div>
              <div class="meta-row">
                <span class="label">耗时：</span>
                <span class="val">{{ formatDuration(dialogGradingResult?.gradingDurationMs) }}</span>
              </div>
              <div class="meta-row" v-if="dialogGradingResult?.scoreSource">
                <span class="label">评分链路：</span>
                <span class="val">{{ getScoreSourceText(dialogGradingResult?.scoreSource) }}</span>
              </div>
            </div>
          </div>

          <!-- Overall Feedback -->
          <div class="feedback-panel" v-if="hasFeedback">
            <div class="panel-title"><el-icon><ChatLineSquare /></el-icon> 综合评价</div>
            <div class="feedback-content-scroll">
              <div v-if="dialogGradingResult?.overallFeedback" class="feedback-item ai">
                <div class="tag">AI 点评</div>
                <div class="text">{{ dialogGradingResult.overallFeedback }}</div>
              </div>
              <div v-if="dialogGradingResult?.teacherFeedback" class="feedback-item teacher">
                <div class="tag">教师评语</div>
                <div class="text">{{ dialogGradingResult.teacherFeedback }}</div>
              </div>
              <div v-if="!dialogGradingResult && validation.feedback" class="feedback-item auto">
                <div class="text">{{ validation.feedback }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Panel: Details & Improvements -->
        <div class="right-panel">
          <!-- Improvement Suggestions (Top) -->
          <div class="improvement-section" v-if="lowScoreItems.length > 0">
            <div class="section-title"><el-icon><TrendCharts /></el-icon> 改进建议</div>
            <div class="suggestion-list">
              <div v-for="item in lowScoreItems" :key="item.criterionName" class="suggestion-card">
                <div class="sug-header">
                  <span class="sug-name">{{ item.criterionName }}</span>
                  <span class="sug-loss">失分: {{ (item.maxScore - item.finalScore).toFixed(1) }}</span>
                </div>
                <div class="sug-desc">{{ item.aiReason || '该项未达到预期要求' }}</div>
              </div>
            </div>
          </div>

          <!-- Rubric Details (Bottom, flex-grow) -->
          <div class="details-section">
            <div class="section-header">
              <span class="title">评分细则</span>
              <div class="header-divider"></div>
            </div>
            
            <div class="details-scroll-area">
              <div class="rubric-list" v-if="dialogGradingResult && dialogGradingResult.details">
                <div v-for="item in dialogGradingResult.details" :key="item.id" class="rubric-item">
                  <div class="rubric-main">
                    <div class="rubric-left">
                      <div class="rubric-name">{{ item.criterionName }}</div>
                      <div class="rubric-desc">{{ item.criterionDescription }}</div>
                    </div>
                    <div class="rubric-right">
                      <span class="score-val">{{ item.finalScore }}</span>
                      <span class="score-max">/{{ item.maxScore }}</span>
                    </div>
                  </div>
                  <div class="rubric-sub" v-if="item.aiReason || item.teacherComment">
                    <div v-if="item.aiReason" class="reason-row ai">
                      <el-icon><MagicStick /></el-icon> {{ item.aiReason }}
                    </div>
                    <div v-if="item.teacherComment" class="reason-row teacher">
                      <el-icon><User /></el-icon> {{ item.teacherComment }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fallback Simple Table -->
              <el-table
                v-else-if="(validation.validationItems || []).length"
                :data="validation.validationItems"
                style="width: 100%"
                size="small"
                border
              >
                <el-table-column prop="validationType" label="检查项" width="100">
                  <template #default="{ row }">
                    {{ getValidationTypeText(row.validationType) }}
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" />
                <el-table-column prop="isPassed" label="状态" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.isPassed ? 'success' : 'danger'" size="small">
                      {{ row.isPassed ? '通过' : '失败' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="得分" width="80" align="right">
                  <template #default="{ row }">
                    <span>{{ row.score }}/{{ row.maxScore }}</span>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无细则数据" :image-size="60" />
            </div>
          </div>
        </div>
      </div>

      <el-empty v-else description="暂无验收数据" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  Loading, Check, CloseBold, CircleCheckFilled, CircleCloseFilled,
  ChatLineSquare, TrendCharts, MagicStick, User
} from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
  loading?: boolean
  error?: string
  isGrading?: boolean
  gradingProgressPercent?: number
  gradingProgressStatus?: '' | 'success' | 'exception' | 'warning'
  gradingProgressMessage?: string
  gradingProgressSteps?: any[]
  validation?: any
  dialogGradingResult?: any
  taskName?: string
  fileName?: string
  displayScore?: number | null
}>()

defineEmits(['update:visible'])

const isPass = computed(() => Number(props.displayScore || 0) >= 60)

const hasFeedback = computed(() => {
  const r = props.dialogGradingResult
  return r?.overallFeedback || r?.teacherFeedback || props.validation?.feedback
})

const lowScoreItems = computed(() => {
  if (!props.dialogGradingResult?.details) return []
  return props.dialogGradingResult.details
    .filter((item: any) => {
      // Show items where score lost is > 0
      return item.maxScore > item.finalScore
    })
    .sort((a: any, b: any) => {
      // Sort by score lost desc
      return (b.maxScore - b.finalScore) - (a.maxScore - a.finalScore)
    })
    .slice(0, 3) // Top 3 issues
})

const formatDuration = (ms: number) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  const seconds = (ms / 1000).toFixed(1)
  return `${seconds}s`
}

const getValidationTypeText = (type: string) => {
  const map: Record<string, string> = {
    'FILE_EXISTENCE': '文件检查',
    'COMPILE': '编译检查',
    'UNIT_TEST': '单元测试',
    'CHECKSTYLE': '代码规范',
    'KEYWORD': '关键词检查'
  }
  return map[type] || type
}

const getScoreSourceText = (source: string) => {
  if (!source) return '-'
  if (source === 'NON_CODE_DIAGRAM_AGENT_MCP') return 'Diagram Agent + MCP 上下文'
  if (source === 'multi_agent') return '多Agent'
  if (source === 'ai') return 'AI评分'
  return source
}

const getStepStatusText = (status: string) => {
  const map: Record<string, string> = {
    'success': '完成',
    'running': '进行中',
    'failed': '异常',
    'pending': '等待'
  }
  return map[status] || status
}
</script>

<style scoped lang="scss">
$primary: #00b96b;
$danger: #ff4d4f;
$bg-color: #f8fafc;
$text-main: #2c3e50;
$text-sub: #64748b;
$border-color: #ebeef5;

.custom-result-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 0 !important;
    display: flex;
    flex-direction: column;
    max-height: 90%;
  }
  :deep(.el-dialog__header) {
    padding: 16px 20px;
    margin: 0;
    border-bottom: 1px solid $border-color;
  }
  :deep(.el-dialog__body) {
    padding: 0;
    flex: 1;
    overflow: hidden;
    height: 100%;
  }
}

.result-body {
  height: 75%;
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* Report Layout */
.report-layout {
  display: flex;
  height: 100%;
  overflow: hidden;

  .left-panel {
    width: 320px;
    background: #fcfcfc;
    border-right: 1px solid $border-color;
    display: flex;
    flex-direction: column;
    padding: 24px;
    gap: 24px;
    overflow-y: auto;
  }

  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 24px;
    overflow: hidden;
    background: #fff;
  }
}

/* Score Card (Left) */
.score-card {
  text-align: center;
  
  .score-ring-wrapper {
    width: 140px;
    height: 140px;
    margin: 0 auto 16px;
    position: relative;
    
    .score-ring {
      transform: rotate(-90deg);
      width: 100%;
      height: 100%;
    }
    
    .score-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      
      .val {
        display: block;
        font-size: 36px;
        font-weight: 700;
        color: $text-main;
        line-height: 1;
      }
      .label {
        font-size: 13px;
        color: $text-sub;
      }
    }
  }

  .result-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 24px;
    
    &.success { background: rgba($primary, 0.1); color: $primary; }
    &.fail { background: rgba($danger, 0.1); color: $danger; }
  }

  .meta-list {
    text-align: left;
    background: #fff;
    border: 1px solid $border-color;
    border-radius: 8px;
    padding: 16px;

    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      
      &:last-child { margin-bottom: 0; }
      
      .label { color: $text-sub; }
      .val { 
        color: $text-main; 
        font-weight: 500; 
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

/* Feedback Panel (Left) */
.feedback-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flex scrolling */

  .panel-title {
    font-size: 15px;
    font-weight: 600;
    color: $text-main;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .feedback-content-scroll {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .feedback-item {
      background: #fff;
      border: 1px solid $border-color;
      border-radius: 8px;
      padding: 12px;
      
      .tag {
        display: inline-block;
        font-size: 12px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 6px;
        font-weight: 600;
      }

      .text {
        font-size: 13px;
        line-height: 1.5;
        color: #4b5563;
        white-space: pre-wrap;
      }

      &.ai {
        border-left: 3px solid $primary;
        .tag { background: rgba($primary, 0.1); color: $primary; }
      }
      &.teacher {
        border-left: 3px solid #f59e0b;
        .tag { background: rgba(#f59e0b, 0.1); color: #f59e0b; }
      }
      &.auto {
        border-left: 3px solid #6366f1;
      }
    }
  }
}

/* Improvement Section (Right Top) */
.improvement-section {
  margin-bottom: 20px;
  flex-shrink: 0;

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: $text-main;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .suggestion-list {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 4px;

    .suggestion-card {
      flex: 1;
      min-width: 200px;
      background: #fff0f0;
      border: 1px solid #fee2e2;
      border-radius: 8px;
      padding: 12px;

      .sug-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
        
        .sug-name { font-weight: 600; color: $text-main; }
        .sug-loss { color: $danger; font-weight: 700; }
      }
      
      .sug-desc {
        font-size: 12px;
        color: #666;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }
}

/* Details Section (Right Bottom) */
.details-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    
    .title {
      font-size: 15px;
      font-weight: 600;
      color: $text-main;
    }
    .header-divider {
      flex: 1;
      height: 1px;
      background: $border-color;
    }
  }

  .details-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;

    .rubric-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .rubric-item {
      border: 1px solid $border-color;
      border-radius: 8px;
      padding: 12px 16px;
      background: #fff;
      
      &:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
      }

      .rubric-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .rubric-left {
          flex: 1;
          .rubric-name { font-size: 14px; font-weight: 600; color: $text-main; margin-bottom: 2px; }
          .rubric-desc { font-size: 12px; color: $text-sub; }
        }
        
        .rubric-right {
          margin-left: 16px;
          text-align: right;
          .score-val { font-size: 16px; font-weight: 700; color: $text-main; }
          .score-max { font-size: 12px; color: $text-sub; }
        }
      }

      .rubric-sub {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed $border-color;
        
        .reason-row {
          font-size: 12px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
          
          .el-icon { color: $primary; }
          &.teacher .el-icon { color: #f59e0b; }
        }
      }
    }
  }
}

/* Grading Process Styles (Centered in the full height) */
.grading-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px;
  overflow-y: auto;

  .grading-header {
    margin-bottom: 32px;
    text-align: center;
    
    .radar-scan {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: rgba($primary, 0.1);
      position: relative;
      overflow: hidden;

      .radar-beam {
        position: absolute;
        width: 100%;
        height: 100%;
        background: conic-gradient(from 0deg, transparent 0deg, rgba($primary, 0.4) 360deg);
        animation: radar-spin 2s linear infinite;
        border-radius: 50%;
      }
    }
  }

  .grading-progress-box {
    width: 100%;
    max-width: 400px;
    margin-bottom: 32px;
  }

  .agent-steps-container {
    width: 100%;
    max-width: 600px;
    
    .steps-label {
      text-align: center;
      margin-bottom: 12px;
      color: $text-sub;
      font-size: 12px;
    }

    .steps-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;

      .step-card {
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        border: 1px solid transparent;

        &.running {
          border-color: $primary;
          background: #fff;
          color: $primary;
        }
      }
    }
  }
}

.error-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  .error-text { color: $danger; }
}

@keyframes radar-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 3px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
</style>
