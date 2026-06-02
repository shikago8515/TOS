<template>
  <div class="checkpoint-panel animate__animated animate__fadeIn">
    <!-- 检查点提示横幅 -->
    <el-alert
      :title="checkpointTitle"
      :type="alertType"
      :closable="false"
      class="checkpoint-alert"
      effect="light"
    >
      <template #default>
        <div class="alert-content">
          <div class="checkpoint-info">
            <el-icon class="icon is-pulsing"><WarningFilled /></el-icon>
            <div class="text">
              <p class="main-text">{{ checkpointDescription }}</p>
              <p class="sub-text">请审核当前输出，决定是否继续工作流</p>
            </div>
          </div>
          <div class="timer" v-if="timeRemaining">
            <el-icon><Timer /></el-icon>
            <span>{{ timeRemaining }}</span>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- 当前输出预览 -->
    <el-card class="output-preview" shadow="hover">
      <template #header>
        <div class="section-header">
          <div class="header-left">
            <el-icon class="text-primary"><View /></el-icon>
            <span class="title">{{ agentName }} 输出结果</span>
          </div>
          <el-tag :type="scoreTagType" v-if="qualityScore !== null" effect="dark" round>
            质量评分: {{ qualityScore }}/100
          </el-tag>
        </div>
      </template>

      <div class="output-content custom-scrollbar">
        <!-- 根据Agent类型展示不同的预览 -->
        <div v-if="agentName === 'GenerationAgent'" class="generation-preview">
          <div class="preview-item">
            <span class="label">案例名称：</span>
            <span class="value">{{ editableOutput.name || '未命名' }}</span>
          </div>
          <div class="preview-item">
             <span class="label">背景摘要：</span>
             <p class="value-block">{{ editableOutput.background || '无背景描述' }}</p>
          </div>
        </div>

        <div v-else class="generic-preview">
          <div class="json-wrapper">
             <pre class="output-json">{{ JSON.stringify(editableOutput, null, 2) }}</pre>
             <el-button class="copy-btn" size="small" icon="CopyDocument" @click="copyOutput" text bg>复制</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 检测到的问题 -->
    <el-card v-if="detectedIssues && detectedIssues.length > 0" class="issues-card" shadow="hover">
      <template #header>
        <div class="section-header">
          <div class="header-left">
            <el-icon class="text-warning"><Warning /></el-icon>
            <span class="title">检测到 {{ detectedIssues.length }} 个问题</span>
          </div>
        </div>
      </template>
      
      <el-timeline class="issues-timeline">
        <el-timeline-item
          v-for="(issue, index) in detectedIssues"
          :key="index"
          :type="issue.severity === 'high' ? 'danger' : 'warning'"
          :icon="issue.severity === 'high' ? CircleCloseFilled : WarningFilled"
          size="large"
        >
          <div class="issue-item">
            <div class="issue-title">{{ issue.title }}</div>
            <div class="issue-description">{{ issue.description }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- AI建议 -->
    <el-card v-if="aiSuggestions" class="suggestions-card" shadow="hover">
      <template #header>
        <div class="section-header">
          <div class="header-left">
            <el-icon class="text-success"><MagicStick /></el-icon>
            <span class="title">AI 智能建议</span>
          </div>
        </div>
      </template>
      <div class="suggestions-content">
        <div class="suggestion-text">{{ aiSuggestions }}</div>
        <el-button type="primary" link icon="Auto" @click="$emit('applySuggestion')">应用建议</el-button>
      </div>
    </el-card>
    
    <!-- 操作区 -->
    <div class="actions-bar">
      <el-button @click="$emit('reject')" icon="Close">拒绝并停止</el-button>
      <el-button type="warning" @click="$emit('retry')" icon="RefreshRight">重试当前步骤</el-button>
      <el-button type="success" @click="$emit('approve')" icon="Check" :loading="submitting">批准并继续</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  WarningFilled, Timer, View, Warning, CircleCloseFilled, MagicStick, 
  CopyDocument, Auto, Close, RefreshRight, Check 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'animate.css'

interface Issue {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

interface Props {
  agentName: string
  outputData: any
  qualityScore?: number | null
  detectedIssues?: Issue[]
  aiSuggestions?: string
  timeRemaining?: string
}

const props = withDefaults(defineProps<Props>(), {
  detectedIssues: () => [],
  timeRemaining: ''
})

defineEmits(['approve', 'reject', 'retry', 'applySuggestion'])

const submitting = ref(false)
const editableOutput = computed(() => props.outputData)

const checkpointTitle = computed(() => {
  const titleMap: Record<string, string> = {
    'GenerationAgent': '案例生成完成 - 请审核',
    'StructuringAgent': '结构化完成 - 请检查',
    'ValidationAgent': '质量校验完成 - 请确认',
    'DataGenerationAgent': '数据生成完成 - 请检查',
    'ReviewAgent': '教学审核完成 - 最终确认'
  }
  return titleMap[props.agentName] || '工作流检查点'
})

const checkpointDescription = computed(() => {
  const descMap: Record<string, string> = {
    'GenerationAgent': 'AI已完成案例的初步生成，请审核案例名称、背景故事等内容是否符合预期',
    'StructuringAgent': '结构化规范完成，请检查字段完整性和格式是否正确',
    'ValidationAgent': '质量校验已完成，但评分较低，请决定是否继续或重新生成',
    'DataGenerationAgent': '模拟数据已生成，请检查数据的真实性和合理性',
    'ReviewAgent': '教学适配评估完成，请确认知识点覆盖和难度是否合适'
  }
  return descMap[props.agentName] || '请审核当前阶段的输出'
})

const alertType = computed(() => {
  if (props.qualityScore !== null && props.qualityScore < 70) {
    return 'warning'
  }
  return 'info'
})

const scoreTagType = computed(() => {
  if (!props.qualityScore) return 'info'
  if (props.qualityScore >= 90) return 'success'
  if (props.qualityScore >= 70) return 'primary'
  if (props.qualityScore >= 60) return 'warning'
  return 'danger'
})

const copyOutput = () => {
  navigator.clipboard.writeText(JSON.stringify(editableOutput.value, null, 2))
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped lang="scss">
.checkpoint-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px;
}

.checkpoint-alert {
  border-radius: 8px;
  
  .alert-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    
    .checkpoint-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      
      .icon {
        font-size: 20px;
        margin-top: 2px;
        
        &.is-pulsing {
          animation: pulse 2s infinite;
        }
      }
      
      .text {
        .main-text {
          font-weight: 600;
          font-size: 15px;
          margin: 0 0 4px 0;
          color: #303133;
        }
        .sub-text {
          font-size: 13px;
          color: #606266;
          margin: 0;
        }
      }
    }
    
    .timer {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.6);
      padding: 4px 10px;
      border-radius: 12px;
      font-family: monospace;
      font-weight: 600;
      color: #f56c6c;
    }
  }
}

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

.output-preview {
  border-radius: 12px;
  
  .output-content {
    max-height: 400px;
    overflow-y: auto;
    
    .generation-preview {
      .preview-item {
        margin-bottom: 12px;
        .label {
          font-weight: 600;
          color: #606266;
          display: block;
          margin-bottom: 4px;
        }
        .value {
          color: #303133;
        }
        .value-block {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 6px;
          line-height: 1.6;
          color: #303133;
          margin: 0;
        }
      }
    }
    
    .generic-preview {
      .json-wrapper {
        position: relative;
        
        .output-json {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Fira Code', monospace;
          font-size: 13px;
          color: #333;
          white-space: pre-wrap;
          margin: 0;
        }
        
        .copy-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        
        &:hover .copy-btn {
          opacity: 1;
        }
      }
    }
  }
}

.issues-card {
  border-radius: 12px;
  border-left: 4px solid #e6a23c;
  
  .issues-timeline {
    padding-left: 4px;
    
    .issue-item {
      .issue-title {
        font-weight: 600;
        color: #303133;
        margin-bottom: 4px;
      }
      .issue-description {
        color: #606266;
        font-size: 13px;
        line-height: 1.4;
      }
    }
  }
}

.suggestions-card {
  border-radius: 12px;
  background: linear-gradient(to right, #f0f9eb, #ffffff);
  border: 1px solid #e1f3d8;
  
  .suggestions-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    
    .suggestion-text {
      flex: 1;
      font-size: 14px;
      color: #529b2e;
      line-height: 1.6;
    }
  }
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
}

// Utils
.text-primary { color: #409eff; }
.text-success { color: #67c23a; }
.text-warning { color: #e6a23c; }
.text-danger { color: #f56c6c; }

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}
</style>