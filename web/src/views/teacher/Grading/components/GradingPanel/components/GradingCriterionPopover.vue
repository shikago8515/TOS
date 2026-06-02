<template>
  <el-popover
    placement="left"
    :width="500"
    trigger="click"
    popper-class="rubric-popover rubric-popover--criterion"
    :hide-after="0"
  >
    <template #reference>
      <div 
        class="rubric-card-trigger" 
        :class="getScoreColorClass(item.finalScore, item.maxScore)"
      >
        <div class="rubric-header-mini">
          <div class="header-main">
            <div class="title-stack">
              <div v-if="groupLabel" class="group-label">{{ groupLabel }}</div>
              <div class="rubric-name text-truncate">{{ item.criterionName }}</div>
            </div>
            <div class="rubric-score-preview">
              <span class="score-val">{{ item.finalScore }}</span>
              <span class="score-max">/ {{ item.maxScore }}</span>
            </div>
          </div>
          <el-icon class="action-icon"><EditPen /></el-icon>
        </div>
      </div>
    </template>

    <!-- 悬浮窗内容 -->
    <div class="rubric-popover-content">
      <div class="popover-header">
        <span class="title">{{ item.criterionName }}</span>
        <span class="score-badge">{{ item.finalScore }} / {{ item.maxScore }}</span>
      </div>
      
      <div class="slider-container">
        <div class="label">分数调整</div>
        <el-slider 
          v-model="item.finalScore" 
          :max="item.maxScore" 
          :step="0.5" 
          :show-tooltip="true"
          :disabled="disabled"
          class="custom-slider"
        />
      </div>

      <div class="ai-insight-box" v-if="item.aiReason">
        <div class="insight-title"><el-icon><Cpu /></el-icon> AI 分析依据</div>
        <div class="insight-content">
          <div v-for="(segment, sIdx) in formatTextSegments(item.aiReason)" :key="sIdx" class="text-segment">
            {{ segment }}
          </div>
        </div>
      </div>

      <div class="teacher-comment-box">
        <div class="comment-label"><el-icon><ChatLineRound /></el-icon> 评语</div>
        <el-input 
          v-model="item.teacherComment" 
          type="textarea"
          :rows="3"
          placeholder="请输入评语..." 
          resize="none"
          :disabled="disabled"
          class="custom-textarea"
        />
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { EditPen, Cpu, ChatLineRound } from '@element-plus/icons-vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  groupLabel: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const getScoreColorClass = (score, max) => {
  const ratio = score / max
  if (ratio >= 0.9) return 'text-success'
  if (ratio >= 0.6) return 'text-warning'
  return 'text-danger'
}

const formatTextSegments = (text) => {
  if (!text) return []
  let content = text.toString()
  
  // Normalize newlines
  content = content.replace(/\\n/g, '\n')
  
  // Add newline before numbered lists (1. 2. or 1、 2、) if not present
  content = content.replace(/([^\n])\s*(\d+[\.\、])/g, '$1\n$2')
  
  // Split by Chinese sentence endings if the segment is long
  content = content.replace(/([。！？])\s*/g, '$1\n')
  
  return content.split('\n').map(s => s.trim()).filter(s => s.length > 0)
}
</script>

<style scoped lang="scss">
$primary-color: #00b96b;
$text-main: #2c3e50;
$text-secondary: #606266;
$border-color: #f0f2f5;

.rubric-card-trigger {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-left: none;
  font-size: 17px;

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 16px;
  }
  
  &:hover {
    background-color: #f5f7fa;
    border-color: #dcdfe6;

    .action-icon {
      color: $primary-color;
    }
  }

  &.text-success { 
    .rubric-score-preview .score-val { color: #67c23a !important; }
  }
  &.text-warning { 
    .rubric-score-preview .score-val { color: #e6a23c !important; }
  }
  &.text-danger { 
    .rubric-score-preview .score-val { color: #f56c6c !important; }
  }
  
  .rubric-header-mini {
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    transition: background-color 0.2s;
    
    .header-main {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-width: 0;
      margin-right: 8px;
      
      .title-stack {
        min-width: 0;
        margin-right: 8px;
      }

      .group-label {
        font-size: 14px;
        font-weight: 700;
        color: #10b981;
        letter-spacing: 0.04em;
        margin-bottom: 2px;
      }

      .rubric-name {
        font-weight: 500;
        color: #303133;
        font-size: 16px;
      }
      
      .rubric-score-preview {
        font-size: 16px;
        flex-shrink: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        
        .score-val { 
          font-weight: 600; 
          margin-right: 2px; 
          color: #2c3e50; 
          letter-spacing: 0;
        }
        .score-max { color: #909399; font-size: 15px; font-weight: 400; }
      }
    }
    
    .action-icon {
      color: #c0c4cc;
      font-size: 17px;
      transition: color 0.2s;
    }
  }

  &:hover .rubric-header-mini {
    background: transparent;
    
    .rubric-name {
      color: $primary-color; // Match active state in task list
    }
    
    .action-icon {
      color: $primary-color;
    }
  }
}
</style>

