<template>
  <div class="review-panel">
    <div class="review-header">
      <h3><el-icon class="mr-1"><DocumentChecked /></el-icon> 案例审核</h3>
      <p>共 {{ pendingCases.length }} 个待审核案例，请逐一审核或批量操作</p>
      <div class="review-counts">
        <el-tag type="warning" effect="light" round>待审核总数：{{ totalPendingCount }}</el-tag>
        <el-tag type="info" effect="plain" round>已选：{{ selectedCount }}</el-tag>
        <el-tag type="success" effect="plain" round>{{ durationLabel }}：{{ durationDisplayText }}</el-tag>
      </div>
    </div>
    
    <div class="review-actions">
      <el-checkbox 
        :model-value="selectedCaseIds.length === pendingCases.length && pendingCases.length > 0"
        :indeterminate="selectedCaseIds.length > 0 && selectedCaseIds.length < pendingCases.length"
        @change="$emit('selectAll', $event)"
      >
        全选
      </el-checkbox>
      <div class="action-buttons">
        <el-button type="primary" size="small" @click="$emit('batchApprove', false)" :disabled="selectedCaseIds.length === 0">
          批量通过
        </el-button>
        <el-button type="success" size="small" @click="$emit('batchApprove', true)" :disabled="selectedCaseIds.length === 0">
          批量发布
        </el-button>
        <el-divider direction="vertical" />
        <el-button type="primary" plain size="small" @click="$emit('approveAll', false)">
          全部通过
        </el-button>
        <el-button type="success" plain size="small" @click="$emit('approveAll', true)">
          全部发布
        </el-button>
      </div>
    </div>
    
    <div class="review-list" v-loading="loadingPendingCases">
      <div 
        v-for="caseItem in pendingCases" 
        :key="caseItem.id" 
        class="review-card"
        :class="{ 
          selected: selectedCaseIds.includes(caseItem.id),
          regenerating: regeneratingCaseId === caseItem.id
        }"
      >
        <!-- 重新生成中的遮罩层 -->
        <div v-if="regeneratingCaseId === caseItem.id" class="regenerating-overlay">
          <div class="regenerating-content">
            <div class="animation-box">
              <div class="radar-ring"></div>
              <div class="radar-ring-inner"></div>
              <el-icon class="ai-icon"><Cpu /></el-icon>
            </div>
            
            <div class="progress-info">
              <div class="info-header">
                <span class="title">AI 正在重新生成案例</span>
                <span class="percent">{{ Math.floor(progressPercent) }}%</span>
              </div>
              
              <div class="steps-list">
                <div 
                  v-for="(step, idx) in generationSteps" 
                  :key="idx" 
                  class="step-item"
                  :class="{ 
                    'active': idx === currentStepIndex, 
                    'completed': idx < currentStepIndex,
                    'pending': idx > currentStepIndex 
                  }"
                >
                  <div class="step-indicator">
                    <el-icon v-if="idx < currentStepIndex" class="check-icon"><CircleCheckFilled /></el-icon>
                    <el-icon v-else-if="idx === currentStepIndex" class="active-icon is-loading"><Loading /></el-icon>
                    <el-icon v-else class="pending-icon"><CircleCheck /></el-icon>
                  </div>
                  <span class="step-text">{{ step }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card-checkbox">
          <el-checkbox 
            :model-value="selectedCaseIds.includes(caseItem.id)"
            @change="(v) => emit('selectCase', caseItem.id, Boolean(v))"
            :disabled="regeneratingCaseId === caseItem.id"
          />
        </div>
        
        <div class="card-content">
          <div class="card-header">
            <div class="student-info">
              <el-avatar :size="32" :icon="Avatar" :src="caseItem.studentInfo?.avatar || ''" />
              <div class="student-detail">
                <span class="student-name">{{ caseItem.studentInfo?.realName || caseItem.studentInfo?.studentName || '未知学生' }}</span>
                <span class="student-id">{{ caseItem.studentInfo?.studentId || caseItem.studentInfo?.studentNo || '-' }}</span>
              </div>
            </div>
            <div class="case-meta">
              <el-tag size="small" type="warning" effect="plain">待审核</el-tag>
            </div>
          </div>
          
          <div class="case-info">
            <h4 class="case-name">{{ caseItem.caseName }}</h4>
            <p class="case-desc">{{ caseItem.backgroundStory?.substring(0, 100) }}...</p>
            <div class="case-time">
              <el-icon><Clock /></el-icon>
              <span class="time-label">创建时间：</span>
              <span class="time-value">{{ formatDateTime(caseItem.createdAt) || '-' }}</span>
            </div>
          </div>
          
          <div class="card-actions">
            <el-button link type="primary" size="small" @click="$emit('preview', caseItem)" :disabled="regeneratingCaseId === caseItem.id">
              <el-icon><Monitor /></el-icon> 预览
            </el-button>
            <el-button link type="success" size="small" @click="$emit('approve', caseItem.id, false)" :disabled="regeneratingCaseId === caseItem.id">
              <el-icon><CircleCheck /></el-icon> 通过
            </el-button>
            <el-button link type="primary" size="small" @click="$emit('approve', caseItem.id, true)" :disabled="regeneratingCaseId === caseItem.id">
              <el-icon><Promotion /></el-icon> 发布
            </el-button>
            <el-button 
              link 
              type="warning" 
              size="small" 
              @click="$emit('regenerate', caseItem.id)"
              :disabled="regeneratingCaseId !== null"
            >
              <el-icon><RefreshRight /></el-icon> {{ regeneratingCaseId === caseItem.id ? '生成中...' : '重新生成' }}
            </el-button>
          </div>
        </div>
      </div>
      
      <el-empty v-if="pendingCases.length === 0 && !loadingPendingCases" description="暂无待审核案例" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { Monitor, CircleCheck, CircleCheckFilled, Promotion, RefreshRight, Avatar, DocumentChecked, Cpu, Loading, Clock } from '@element-plus/icons-vue'

const props = defineProps<{
  pendingCases: any[]
  loadingPendingCases: boolean
  selectedCaseIds: number[]
  regeneratingCaseId: number | null
  batchProgress?: any
}>()

const emit = defineEmits([
  'selectAll',
  'selectCase',
  'batchApprove',
  'approveAll',
  'preview',
  'approve',
  'regenerate'
])

// 进度和提示相关
const progressPercent = ref(0)
let progressTimer: any = null

const generationSteps = [
  '分析学生画像与能力模型',
  '构建个性化实训案例框架',
  '生成业务背景与需求文档',
  '设计数据库结构与模拟数据',
  '编写参考代码与评分标准',
  '最终质量校验与排版'
]

const currentStepIndex = computed(() => {
  // 将 0-100% 映射到步骤索引
  // 0-15%: 0
  // 15-30%: 1
  // 30-50%: 2
  // 50-70%: 3
  // 70-90%: 4
  // 90-100%: 5
  const p = progressPercent.value
  if (p < 15) return 0
  if (p < 30) return 1
  if (p < 50) return 2
  if (p < 70) return 3
  if (p < 90) return 4
  return 5
})

const totalPendingCount = computed(() => props.pendingCases.length)
const selectedCount = computed(() => props.selectedCaseIds.length)

const isBatchCompleted = computed(() => {
  const total = Number(props.batchProgress?.totalStudents || props.batchProgress?.totalCount || 0)
  const finished = Number(props.batchProgress?.generatedCount || props.batchProgress?.completedCount || 0) + Number(props.batchProgress?.failedCount || 0)
  return total > 0 && finished >= total
})

const formatDuration = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  const totalSeconds = Math.max(1, Math.round(value / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`
  }
  return `${seconds}秒`
}

const durationText = computed(() => {
  const duration = Number(props.batchProgress?.durationMs || props.batchProgress?.elapsedMs || 0)
  return formatDuration(duration)
})

const durationLabel = computed(() => (isBatchCompleted.value ? '总耗时' : '已耗时'))
const durationDisplayText = computed(() => durationText.value || '--')

const formatDateTime = (val: any) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const startProgress = () => {
  progressPercent.value = 0
  
  // 模拟非线性进度：开始快，中间匀速，最后慢
  const updateProgress = () => {
    if (progressPercent.value < 30) {
      progressPercent.value += 0.8 // 快速启动
    } else if (progressPercent.value < 70) {
      progressPercent.value += 0.4 // 中速生成
    } else if (progressPercent.value < 95) {
      progressPercent.value += 0.1 // 慢速收尾
    }
    // 95% 以上等待后端响应
  }
  
  progressTimer = setInterval(updateProgress, 100)
}

const stopProgress = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  progressPercent.value = 100
}

// 监听regeneratingCaseId变化
watch(() => props.regeneratingCaseId, (newVal, oldVal) => {
  if (newVal !== null && oldVal === null) {
    // 开始生成
    startProgress()
  } else if (newVal === null && oldVal !== null) {
    // 生成结束
    stopProgress()
  }
})

onUnmounted(() => {
  stopProgress()
})
</script>

<style scoped lang="scss">
.review-panel {
  width: 100%;
  max-width: 1000px;
  padding: 20px;
  margin: 0 auto;
  
  .review-header {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
    
    h3 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      
      .el-icon {
        color: #0ea5e9;
        font-size: 24px;
      }
    }
    
    p {
      color: #64748b;
      font-size: 14px;
      margin: 0;
      font-weight: 500;
    }

    .review-counts {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  }
  
  .review-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #f8fafc;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    
    :deep(.el-checkbox__label) {
      font-weight: 600;
      color: #334155;
    }
    
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .el-button {
        border-radius: 8px;
        font-weight: 600;
        padding: 8px 16px;
        transition: all 0.3s ease;
        
        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      }
    }
  }
  
  .review-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
  }
  
  .review-card {
    display: flex;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    
    &:hover {
      border-color: #cbd5e1;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06);
      transform: translateY(-2px);
    }
    
    &.selected {
      border-color: #0ea5e9;
      background: #f0f9ff;
      box-shadow: 0 8px 20px rgba(14, 165, 233, 0.1);
    }
    
    &.regenerating {
      border-color: #0ea5e9;
      
      .card-content {
        opacity: 0.05;
        pointer-events: none;
        filter: blur(2px);
      }
    }
    
    .regenerating-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 16px;
      
      .regenerating-content {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 20px;
        width: 100%;
        
        .animation-box {
          position: relative;
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          
          .ai-icon {
            font-size: 32px;
            color: #0ea5e9;
            z-index: 2;
            animation: pulse-icon 2s infinite;
          }
          
          .radar-ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 3px solid transparent;
            border-top-color: #0ea5e9;
            border-radius: 50%;
            animation: spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          
          .radar-ring-inner {
            position: absolute;
            width: 65%;
            height: 65%;
            border: 3px solid transparent;
            border-bottom-color: #38bdf8;
            border-radius: 50%;
            animation: spin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse;
          }
        }
        
        .progress-info {
          flex: 1;
          
          .info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            
            .title {
              font-weight: 700;
              color: #0f172a;
              font-size: 15px;
              letter-spacing: 0.5px;
            }
            
            .percent {
              font-family: 'Courier New', Courier, monospace;
              font-weight: 800;
              color: #0ea5e9;
              font-size: 16px;
            }
          }
          
          .steps-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            
            .step-item {
              display: flex;
              align-items: center;
              gap: 10px;
              font-size: 13px;
              color: #94a3b8;
              transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
              font-weight: 500;
              
              &.active {
                color: #0ea5e9;
                font-weight: 700;
                transform: translateX(6px);
                
                .step-indicator {
                  background: #e0f2fe;
                  border-radius: 50%;
                }
              }
              
              &.completed {
                color: #64748b;
              }
              
              .step-indicator {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                
                .check-icon {
                  font-size: 16px;
                  color: #10b981;
                }
                
                .active-icon {
                  font-size: 16px;
                  color: #0ea5e9;
                }
                
                .pending-icon {
                  font-size: 16px;
                  color: #cbd5e1;
                }
              }
            }
          }
        }
      }
    }
    
    .card-checkbox {
      padding-right: 12px;
      display: flex;
      align-items: flex-start;
      padding-top: 4px;
      
      :deep(.el-checkbox__inner) {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        
        &::after {
          height: 9px;
          left: 6px;
          top: 2px;
          width: 4px;
        }
      }
    }
    
    .card-content {
      flex: 1;
      transition: all 0.4s ease;
      display: flex;
      flex-direction: column;
      
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        
        .student-info {
          display: flex;
          align-items: center;
          gap: 12px;
          
          :deep(.el-avatar) {
            border: 2px solid #f1f5f9;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
          }
          
          .student-detail {
            display: flex;
            flex-direction: column;
            
            .student-name {
              font-weight: 700;
              color: #1e293b;
              font-size: 15px;
            }
            
            .student-id {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
              margin-top: 2px;
            }
          }
        }
        
        .case-meta {
          :deep(.el-tag) {
            border-radius: 6px;
            font-weight: 600;
            padding: 0 10px;
            border-color: #fcd34d;
            color: #d97706;
            background: #fffbeb;
          }
        }
      }
      
      .case-info {
        margin-bottom: 16px;
        flex: 1;
        
        .case-name {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }
        
        .case-desc {
          font-size: 13px;
          color: #475569;
          line-height: 1.6;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .case-time {
          margin-top: 12px;
          font-size: 12px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
          
          .el-icon {
            font-size: 14px;
          }

          .time-label {
            color: #94a3b8;
          }

          .time-value {
            color: #334155;
            font-weight: 600;
          }
        }
      }
      
      .card-actions {
        display: flex;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
        justify-content: flex-end;
        
        .el-button {
          border-radius: 6px;
          font-weight: 600;
          padding: 6px 12px;
          
          &:hover {
            background: #f1f5f9;
          }
          
          &.el-button--primary { color: #0ea5e9; }
          &.el-button--success { color: #10b981; }
          &.el-button--warning { color: #f59e0b; }
        }
      }
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse-icon {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes pulse-dot {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 8px rgba(14, 165, 233, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(14, 165, 233, 0);
  }
}
</style>
