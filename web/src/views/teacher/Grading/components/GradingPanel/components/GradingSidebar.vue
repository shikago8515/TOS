<template>
  <div class="workspace-sidebar" :style="{ width: width + 'px' }">
    <div class="sidebar-header">
      <div class="header-top">
        <span class="header-title">评分面板</span>
        <div class="submission-meta">
          <el-tag size="small" :type="getTaskSource(task) === 2 ? 'warning' : 'info'" effect="plain" round>
            {{ getTaskSource(task) === 2 ? '自领' : '分配' }}
          </el-tag>
        </div>
      </div>
      <div class="total-score-card compact">
        <div class="score-main">
          <div class="score-label">总评分</div>
          <div class="score-value" :class="getScoreClass(currentTotalScore)">
            <span class="current">{{ currentTotalScore }}</span>
            <span class="max">/{{ maxTotalScore }}</span>
          </div>
        </div>
        <div class="score-progress-mini">
          <div class="progress-bar" :style="{ width: (currentTotalScore / maxTotalScore * 100) + '%', backgroundColor: getScoreColor(currentTotalScore) }"></div>
        </div>
      </div>
    </div>

    <div class="sidebar-scroll-area">
      <el-scrollbar>
        <div class="sidebar-inner">
          
          <div class="alert-box warning" v-if="task.status === 5">
            <el-icon><WarningFilled /></el-icon> 任务已打回
          </div>

          <!-- 快捷操作 -->
          <div class="ai-actions-card" v-if="aiResult && aiResult.gradingStatus === 'completed'">
            <div class="card-header">
              <el-icon><MagicStick /></el-icon> AI 辅助评分
            </div>
            <div class="action-buttons">
              <button 
                class="action-btn success"
                @click="$emit('adopt-ai-score')"
                :disabled="aiResult.isConfirmed || task.status === 5"
              >
                <el-icon><Check /></el-icon> 采用评分
              </button>
              <button 
                class="action-btn secondary"
                @click="resetToAiScore"
                :disabled="task.status === 5"
              >
                <el-icon><Refresh /></el-icon> 重置
              </button>
            </div>
          </div>

          <!-- 评分细则表单 -->
          <div class="rubric-list">
            <div class="section-label">{{ isFullPracticeMultiAgent ? '五维评分调整' : '细则打分' }}</div>

            <div v-if="isFullPracticeMultiAgent" class="multi-agent-hint">
              评分维度已与完整实训多 Agent 工作流统一，可直接按五个维度微调分数和评语。
            </div>
            
            <GradingCriterionPopover
              v-for="item in gradingDetails"
              :key="item.id"
              :item="item"
              :disabled="task.status === 5"
              :group-label="isFullPracticeMultiAgent ? getCriterionGroupLabel(item.criterionName) : ''"
            />
          </div>

          <!-- 最终评语 -->
          <div class="final-feedback-section">
            <div class="section-label">最终评语</div>
            
            <el-popover
              placement="left"
              :width="500"
              trigger="click"
              popper-class="rubric-popover rubric-popover--criterion"
              :hide-after="0"
            >
              <template #reference>
                <div class="rubric-card-trigger feedback-trigger" :class="{ 'has-content': !!localFinalFeedback }">
                  <div class="rubric-header-mini feedback-preview">
                    <div class="header-main">
                      <div class="rubric-name feedback-text" :class="{ 'placeholder': !localFinalFeedback }">
                        <div v-if="localFinalFeedback" class="markdown-body-mini" v-html="renderFinalFeedbackPreview(localFinalFeedback)"></div>
                        <span v-else>点击添加最终评语...</span>
                      </div>
                    </div>
                    <el-icon class="action-icon"><EditPen /></el-icon>
                  </div>
                </div>
              </template>

              <!-- 悬浮窗内容 -->
              <div class="rubric-popover-content">
                <div class="popover-header">
                  <span class="title">最终评语</span>
                </div>
                
                <div class="teacher-comment-box feedback-editor">
                  <div class="comment-label"><el-icon><ChatLineRound /></el-icon> 评语内容</div>
                  
                  <!-- 编辑模式 -->
                  <el-input
                    v-if="isEditingFeedback || !localFinalFeedback"
                    ref="feedbackInputRef"
                    v-model="localFinalFeedback"
                    type="textarea"
                    :autosize="{ minRows: 6, maxRows: 15 }"
                    placeholder="写下对学生的鼓励或建议..."
                    resize="none"
                    :disabled="task.status === 5"
                    class="custom-textarea markdown-editor"
                    @blur="disableFeedbackEdit"
                  />
                  
                  <!-- 分段展示模式 -->
                  <div 
                    v-else 
                    class="ai-insight-box feedback-view-mode" 
                    @click="enableFeedbackEdit"
                  >
                    <div class="insight-content">
                      <div v-for="(segment, sIdx) in formatTextSegments(localFinalFeedback)" :key="sIdx" class="text-segment">
                        {{ segment }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div class="sidebar-footer">
      <button 
        class="submit-button"
        @click="$emit('submit')" 
        :disabled="!task || task.status === 5"
      >
        <span v-if="submitting">提交中...</span>
        <span v-else>提交评分结果</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { 
  WarningFilled, MagicStick, Check, Refresh, EditPen, ChatLineRound
} from '@element-plus/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import GradingCriterionPopover from './GradingCriterionPopover.vue'

const props = defineProps({
  task: Object,
  aiResult: Object,
  gradingDetails: {
    type: Array,
    default: () => []
  },
  finalFeedback: String,
  submitting: Boolean,
  width: {
    type: Number,
    default: 320
  }
})

const emit = defineEmits(['update:finalFeedback', 'adopt-ai-score', 'submit'])

const fullPracticeDimensionLabels = {
  '题目理解与要求对齐': 'Agent 1-2',
  '实验报告与文档质量': 'Agent 5',
  '结构化成果与图示质量': 'Agent 3',
  '代码实现与数据库证据': 'Agent 4',
  '运行验证与结果分析': 'Agent 4-5'
}

const localFinalFeedback = computed({
  get: () => props.finalFeedback,
  set: (val) => emit('update:finalFeedback', val)
})

const isFullPracticeMultiAgent = computed(() => {
  return props.aiResult?.scoreSource === 'FULL_PRACTICE_MULTI_AGENT_WORKFLOW_CONTEXT'
    || props.gradingDetails.some(item => fullPracticeDimensionLabels[item?.criterionName])
})

const currentTotalScore = computed(() => {
  return props.gradingDetails.reduce((sum, item) => sum + (Number(item.finalScore) || 0), 0)
})

const maxTotalScore = computed(() => {
  return props.gradingDetails.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0)
})

const getTaskSource = (task) => {
  return (task.source === 2 || task.taskSource === 2) ? 2 : 1
}

const getScoreClass = (score) => {
  if (score >= 90) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-danger'
}

const getScoreColor = (score) => {
  if (score >= 90) return '#10b981'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

const getCriterionGroupLabel = (criterionName) => {
  return fullPracticeDimensionLabels[criterionName] || ''
}

const renderMarkdown = (text) => {
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html)
}

const escapeHtml = (text) => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const isLikelyMarkdown = (text) => {
  if (!text) return false
  return /(#{1,6}\s)|(```)|(`[^`]+`)|(\*\*[^*]+\*\*)|(^\s*[-*+]\s+)|(^\s*\d+\.\s+)|(\[[^\]]+\]\([^\)]+\))/m.test(text)
}

const renderFinalFeedbackPreview = (text) => {
  if (!text) return ''
  if (isLikelyMarkdown(text)) {
    return renderMarkdown(text)
  }
  return `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`
}

const resetToAiScore = () => {
  ElMessageBox.confirm('确定要重置为AI的原始评分吗？这将覆盖您当前的修改。', '提示', {
    type: 'warning'
  }).then(() => {
    emit('adopt-ai-score')
  })
}

const isEditingFeedback = ref(false)
const feedbackInputRef = ref(null)

const enableFeedbackEdit = () => {
  if (props.task.status === 5) return
  isEditingFeedback.value = true
  // Wait for DOM update
  setTimeout(() => {
    feedbackInputRef.value?.focus()
  }, 50)
}

const disableFeedbackEdit = () => {
  isEditingFeedback.value = false
}

const formatTextSegments = (text) => {
  if (!text) return []
  let content = text.toString()
  content = content.replace(/\\n/g, '\n')
  content = content.replace(/([^\n])\s*(\d+[\.\、])/g, '$1\n$2')
  content = content.replace(/([。！？])\s*/g, '$1\n')
  return content.split('\n').map(s => s.trim()).filter(s => s.length > 0)
}
</script>

<style scoped lang="scss">
$primary-color: #00b96b;
$text-main: #2c3e50;
$text-secondary: #606266;
$border-color: #f0f2f5;

.workspace-sidebar {
  background: #fff;
  display: flex;
  flex-direction: column;
  border-left: none;
  flex-shrink: 0;
  height: 100%;
  font-size: 17px;

  :deep(.el-tag),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner),
  :deep(.el-button) {
    font-size: 16px;
  }
  
  .sidebar-header {
    padding: 16px;
    background: #fff;
    border-bottom: 1px solid $border-color;
    box-shadow: none;
    z-index: 2;
    flex-shrink: 0;
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      .header-title {
        font-size: 18px;
        font-weight: 600;
        color: $text-main;
      }
    }
    
    .total-score-card {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 12px;
      border: 1px solid $border-color;
      
      &.text-warning { background: #fdf6ec; border-color: #faecd8; }
      &.text-danger { background: #fef0f0; border-color: #fde2e2; }
      
      .score-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        
        .score-label {
          color: $text-secondary;
          font-size: 16px;
          font-weight: 500;
        }
        
        .score-value {
          display: flex;
          align-items: baseline;
          
          .current { font-size: 32px; font-weight: 600; line-height: 1; margin-right: 2px; }
          .max { font-size: 15px; opacity: 0.6; }
          
          &.text-success .current { color: #67c23a; }
          &.text-warning .current { color: #e6a23c; }
          &.text-danger .current { color: #f56c6c; }
        }
      }
      
      .score-progress-mini {
        height: 4px;
        background: #ebeef5;
        border-radius: 2px;
        overflow: hidden;
        
        .progress-bar {
          height: 100%;
          border-radius: 2px;
          transition: width 0.4s ease;
        }
      }
    }
  }

  .sidebar-scroll-area {
    flex: 1;
    overflow: visible; /* 改为 visible 允许悬浮窗溢出 */
    position: relative;
  }

  .sidebar-inner {
    padding: 16px;
    padding-bottom: 24px;
  }

  .alert-box {
    margin-bottom: 16px;
    padding: 8px 12px;
    background: #fdf6ec;
    border: 1px solid #faecd8;
    border-radius: 4px;
    color: #e6a23c;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ai-actions-card {
    background: #fff;
    border: 1px solid $border-color;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
    
    .card-header {
      font-size: 16px;
      font-weight: 600;
      color: $text-secondary;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .action-buttons {
      display: flex;
      gap: 8px;
      
      .action-btn {
        flex: 1;
        height: 32px;
        border: 1px solid #dcdfe6;
        background: #fff;
        border-radius: 4px;
        font-size: 15px;
        color: $text-secondary;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s;
        
        &:hover:not(:disabled) {
          color: $primary-color;
          border-color: $primary-color;
          background-color: #ecf8f0;
        }
        
        &.success {
          color: #67c23a;
          border-color: #e1f3d8;
          background-color: #f0f9eb;
          &:hover:not(:disabled) {
            background-color: #67c23a;
            color: #fff;
            border-color: #67c23a;
          }
        }
        
        &:disabled {
          color: #c0c4cc;
          background-color: #fff;
          border-color: #ebeef5;
          cursor: not-allowed;
        }
      }
    }
  }

  .rubric-list {
    margin-bottom: 20px;
    
    .section-label {
      font-size: 16px;
      font-weight: 600;
      color: $text-secondary;
      margin-bottom: 12px;
      padding-left: 4px;
      border-left: 3px solid $primary-color;
      line-height: 1;
    }
  }
  
  .final-feedback-section {
    margin-bottom: 20px;
    
    .section-label {
      font-size: 16px;
      font-weight: 600;
      color: $text-secondary;
      margin-bottom: 12px;
      padding-left: 4px;
      border-left: 3px solid $primary-color;
      line-height: 1;
    }
    
    .feedback-trigger {
      background: #fff;
      border: 1px solid #ebeef5; // unified border color
      border-radius: 4px; // unified radius
      min-height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        background-color: #f5f7fa;
        border-color: #dcdfe6;
        .action-icon { color: $primary-color; }
      }
      
      &.has-content {
        .rubric-name {
          color: $text-main;
        }
      }

      .feedback-preview {
        padding: 12px; // unified padding
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        
        .header-main {
          flex: 1;
          margin-right: 8px;
          min-width: 0;
        }
        
        .rubric-name {
          font-size: 16px;
          line-height: 1.5;
          color: $text-main;
          white-space: pre-wrap;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          
          &.placeholder {
            color: #909399;
          }
        }
        
        .action-icon {
          margin-top: 2px;
          color: #c0c4cc;
          font-size: 17px;
          flex-shrink: 0;
        }
      }
    }
  }

  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid $border-color;
    background: #fff;
    z-index: 2;
    
    .submit-button {
      width: 100%;
      height: 36px;
      background: $primary-color;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover:not(:disabled) {
        opacity: 0.9;
      }
      
      &:active:not(:disabled) {
        opacity: 1;
      }
      
      &:disabled {
        background: #a0cfff; // Adjust based on primary color or use element-plus disabled color
        background: #b3e19d; // Green-ish disabled
        cursor: not-allowed;
      }
    }
  }
}

.multi-agent-hint {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f6fbf8;
  border: 1px solid #d9f3e7;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.7;
}

</style>

<style lang="scss">
@import './GradingSidebar.popover.scss';
</style>
