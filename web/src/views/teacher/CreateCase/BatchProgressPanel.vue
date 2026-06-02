<template>
  <div class="batch-progress-panel refined">
    <!-- 精致头部 -->
    <div class="refined-header">
      <div class="header-bg-decoration"></div>
      <div class="header-content">
        <div class="title-group">
          <div class="icon-wrapper">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="title-info">
            <h3>批量生成任务</h3>
            <div class="meta-row">
              <span class="status-dot running" v-if="progress.runningCount > 0">运行中</span>
              <span class="status-dot success" v-else-if="progress.generatedCount === progress.totalStudents">已完成</span>
              <span v-if="durationText" class="duration-chip">{{ durationLabel }} {{ durationText }}</span>
            </div>
          </div>
        </div>
        
        <div class="stats-bar">
          <div class="stat-pill total">
            <span class="label">总计</span>
            <span class="num">{{ progress.totalStudents || 0 }}</span>
          </div>
          <div class="stat-pill success">
            <span class="label">完成</span>
            <span class="num">{{ progress.generatedCount || 0 }}</span>
          </div>
          <div class="stat-pill running">
            <span class="label">进行中</span>
            <span class="num">{{ progress.runningCount || 0 }}</span>
          </div>
          <div class="stat-pill review" :class="{ 'has-review': (progress.reviewingCount || 0) > 0 }">
            <span class="label">待审核</span>
            <span class="num">{{ progress.reviewingCount || 0 }}</span>
          </div>
        </div>

        <div class="progress-circle-area">
           <el-progress 
            type="circle" 
            :percentage="progress.progressPercent || 0" 
            :width="42" 
            :stroke-width="4"
            :show-text="false"
            :color="customColors"
          />
          <span class="percent-val">{{ Math.floor(progress.progressPercent || 0) }}%</span>
        </div>
      </div>
    </div>
    
    <!-- 现代化列表视图 -->
    <div class="student-list-modern" v-if="progress.studentProgress && progress.studentProgress.length > 0">
      <div class="list-header">
        <span class="col-name">学生信息</span>
        <span class="col-status">执行状态</span>
        <span class="col-progress">进度</span>
        <span class="col-action">操作</span>
      </div>
      
      <div class="list-scroll-area custom-scrollbar">
        <transition-group name="staggered-fade" tag="div" class="list-wrapper">
          <div 
            v-for="student in progress.studentProgress" 
            :key="student.studentId"
            class="student-item"
            :class="[student.status.toLowerCase(), { 'needs-review': student.needsReview }]"
          >
            <!-- 左侧状态条 -->
            <div class="status-bar-indicator"></div>

            <!-- 学生信息 -->
            <div class="col-name">
              <div class="avatar-wrapper">
                <el-avatar :size="32" :src="student.avatar" class="user-avatar">
                  {{ student.studentName ? student.studentName.charAt(0) : student.studentId }}
                </el-avatar>
                <div class="status-ring" v-if="student.status === 'RUNNING'"></div>
              </div>
              <div class="info-text">
                <div class="name" :title="student.studentName">{{ student.studentName }}</div>
                <div class="sub-id">{{ student.studentNo || '#' + student.studentId }}</div>
              </div>
            </div>

            <!-- 状态与阶段 -->
            <div class="col-status">
              <div class="status-chip" :class="getStatusClass(student)">
                <el-icon class="status-icon">
                  <component :is="getStatusIcon(student)" />
                </el-icon>
                <span class="status-text">{{ getStateLabel(student.currentState) }}</span>
              </div>
              <div class="review-badge" v-if="student.needsReview">
                需审核
              </div>
            </div>

            <!-- 进度条 -->
            <div class="col-progress">
              <div class="progress-wrapper">
                <el-progress 
                  :percentage="student.progressPercentage || 0" 
                  :stroke-width="6"
                  :show-text="false"
                  :color="getProgressColor(student)"
                  :indeterminate="student.status === 'RUNNING' && !student.needsReview"
                  :duration="2"
                />
                <span class="progress-num">{{ student.progressPercentage || 0 }}%</span>
              </div>
              <div class="error-msg" v-if="student.errorMessage" :title="student.errorMessage">
                {{ student.errorMessage }}
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="col-action">
              <template v-if="student.needsReview && student.status === 'RUNNING'">
                <el-button-group class="action-group">
                  <el-button type="warning" size="small" plain @click="$emit('viewAgentOutput', student.workflowInstanceId, student.reviewingAgent)">审查</el-button>
                  <el-button type="success" size="small" @click="$emit('approveCheckpoint', student.workflowInstanceId, student.studentId)">批准</el-button>
                </el-button-group>
              </template>
              <template v-else>
                <div class="hover-actions">
                  <el-button class="op-btn" size="small" :disabled="!student.workflowInstanceId" @click="$emit('viewLogs', student.workflowInstanceId)">
                    <el-icon><Document /></el-icon>
                    <span>日志</span>
                  </el-button>
                  <el-button class="op-btn" size="small" type="primary" plain :disabled="!student.caseId" @click="$emit('previewCase', student.caseId)">
                    <el-icon><View /></el-icon>
                    <span>预览</span>
                  </el-button>
                </div>
              </template>
            </div>
          </div>
        </transition-group>
      </div>
    </div>
    
    <div v-else class="empty-placeholder">
      <el-empty description="暂无任务数据" :image-size="80" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  DataLine, CircleCheckFilled, CircleCloseFilled, Loading, 
  WarningFilled, Document, View
} from '@element-plus/icons-vue'

const props = defineProps<{
  batchTaskId: string
  progress: any
  deliverableMode?: string
}>()

defineEmits(['viewLogs', 'previewCase', 'viewAgentOutput', 'approveCheckpoint'])

const isFullPracticeMode = computed(() => String(props.deliverableMode || '').toUpperCase() === 'NON_CODE')

const customColors = [
  { color: '#f56c6c', percentage: 20 },
  { color: '#e6a23c', percentage: 40 },
  { color: '#5cb87a', percentage: 60 },
  { color: '#1989fa', percentage: 80 },
  { color: '#0ea5e9', percentage: 100 },
]

const isCompleted = computed(() => {
  const total = Number(props.progress?.totalStudents || props.progress?.totalCount || 0)
  const finished = Number(props.progress?.generatedCount || props.progress?.completedCount || 0) + Number(props.progress?.failedCount || 0)
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
  const duration = Number(props.progress?.durationMs || props.progress?.elapsedMs || 0)
  return formatDuration(duration)
})

const durationLabel = computed(() => (isCompleted.value ? '总耗时' : '已耗时'))

const getStatusClass = (student: any) => {
  if (student.status === 'FAILED') return 'failed'
  if (student.status === 'SUCCESS') return 'success'
  if (student.needsReview) return 'review'
  return 'running'
}

const getStatusIcon = (student: any) => {
  if (student.status === 'FAILED') return CircleCloseFilled
  if (student.status === 'SUCCESS') return CircleCheckFilled
  if (student.needsReview) return WarningFilled
  return Loading
}

const getProgressColor = (student: any) => {
  if (student.status === 'FAILED') return '#ff6b6b'
  if (student.status === 'SUCCESS') return '#51cf66'
  if (student.needsReview) return '#fcc419'
  return '#339af0'
}

const getStateLabel = (state: string) => {
  const normalizedState = String(state || '').toUpperCase()
  const fullPracticeStateMap: Record<string, string> = {
    'INPUT_PARSE': '教学需求解析Agent',
    'GENERATION': '教学需求解析Agent',
    'STRUCTURING': '案例骨架生成Agent',
    'VALIDATION': '结构化验证设计Agent',
    'DATA_GENERATION': '模拟数据与模板库Agent',
    'REVIEW': '考核方案设计Agent',
    'PUBLISH': '发布',
    'COMPLETED': '已完成'
  }
  const pureCodingStateMap: Record<string, string> = {
    'INPUT_PARSE': '输入解析',
    'GENERATION': '案例生成 Agent',
    'STRUCTURING': '结构化规范 Agent',
    'VALIDATION': '质量校验 Agent',
    'DATA_GENERATION': '数据生成 Agent',
    'REVIEW': '教学审核 Agent',
    'PUBLISH': '发布',
    'COMPLETED': '已完成'
  }
  const stateMap = isFullPracticeMode.value ? fullPracticeStateMap : pureCodingStateMap
  return stateMap[normalizedState] || normalizedState || '准备中'
}
</script>

<style scoped lang="scss">
.batch-progress-panel.refined {
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  transition: all 0.3s ease;
}

/* 头部设计 */
.refined-header {
  position: relative;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-bottom: 1px solid #bae6fd;
  overflow: hidden;
  
  .header-bg-decoration {
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%);
    pointer-events: none;
    border-radius: 50%;
  }

  .header-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    z-index: 1;
    
    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .icon-wrapper {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: #ffffff;
        color: #0ea5e9;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
        transition: transform 0.3s ease;
        
        &:hover {
          transform: scale(1.05) rotate(5deg);
        }
      }
      
      .title-info {
        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        
        .meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          
          .status-dot {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            
            &::before {
              content: '';
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: currentColor;
              box-shadow: 0 0 8px currentColor;
            }
            
            &.running { color: #0ea5e9; animation: pulse-dot 2s infinite; }
            &.success { color: #10b981; }
          }

          .duration-chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid rgba(14, 165, 233, 0.18);
            color: #0f766e;
            font-weight: 700;
            letter-spacing: 0.2px;
            box-shadow: 0 2px 10px rgba(15, 118, 110, 0.08);
          }
        }
      }
    }

    .stats-bar {
      display: flex;
      gap: 10px;
      
      .stat-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.9);
        padding: 6px 14px;
        border-radius: 12px;
        min-width: 64px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05);
        }
        
        .label {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 2px;
        }
        
        .num {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
          line-height: 1.2;
        }
        
        &.success .num { color: #10b981; }
        &.running .num { color: #0ea5e9; }
        &.review {
          &.has-review {
            background: #fffbeb;
            border-color: #fef08a;
            .num { color: #f59e0b; }
            animation: pulse-border 2s infinite;
          }
        }
      }
    }

    .progress-circle-area {
      position: relative;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      
      .percent-val {
        position: absolute;
        font-size: 12px;
        font-weight: 800;
        color: #334155;
      }
    }
  }
}

/* 列表部分 */
.student-list-modern {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
  min-height: 0;

  .list-header {
    display: flex;
    padding: 12px 20px;
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
    background: #f1f5f9;
    
    .col-name { flex: 0 0 220px; }
    .col-status { flex: 0 0 160px; }
    .col-progress { flex: 1; }
    .col-action { flex: 0 0 120px; text-align: right; }
  }

  .list-scroll-area {
    padding: 12px;
    overflow-y: auto;
    flex: 1;
    
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
  
  .list-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

/* 列表项卡片 */
.student-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  /* 悬停效果 */
  &:hover {
    transform: translateY(-2px) scale(1.005);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
    border-color: #cbd5e1;
    z-index: 1;
  }

  /* 状态边框指示器 */
  .status-bar-indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #e2e8f0;
    transition: background 0.3s ease;
  }
  
  &.running {
    .status-bar-indicator { background: #0ea5e9; }
    background: linear-gradient(90deg, #ffffff 0%, #f0f9ff 100%);
  }
  &.success .status-bar-indicator { background: #10b981; }
  &.failed .status-bar-indicator { background: #ef4444; }
  &.needs-review {
    .status-bar-indicator { background: #f59e0b; }
    background: #fffbeb;
  }

  /* 列布局 */
  .col-name {
    flex: 0 0 204px; /* 减去padding */
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 8px;
    
    .avatar-wrapper {
      position: relative;
      
      .user-avatar {
        background: #f1f5f9;
        color: #475569;
        font-size: 14px;
        font-weight: 700;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      
      .status-ring {
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 2px solid #0ea5e9;
        border-top-color: transparent;
        animation: spin 1s linear infinite;
      }
    }
    
    .info-text {
      overflow: hidden;
      .name {
        font-size: 14px;
        font-weight: 700;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub-id {
        font-size: 12px;
        color: #64748b;
        margin-top: 2px;
      }
    }
  }

  .col-status {
    flex: 0 0 160px;
    display: flex;
    align-items: center;
    gap: 10px;
    
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #f1f5f9;
      color: #64748b;
      transition: all 0.3s ease;
      
      .status-icon { font-size: 14px; }
      
      &.running { background: #e0f2fe; color: #0ea5e9; .status-icon { animation: spin 2s linear infinite; } }
      &.success { background: #d1fae5; color: #10b981; }
      &.failed { background: #fee2e2; color: #ef4444; }
      &.review { background: #fef3c7; color: #f59e0b; }
    }
    
    .review-badge {
      font-size: 11px;
      font-weight: 700;
      background: #f59e0b;
      color: white;
      padding: 2px 6px;
      border-radius: 6px;
      animation: pulse 2s infinite;
      box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
    }
  }

  .col-progress {
    flex: 1;
    padding-right: 20px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    
    .progress-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      .el-progress { flex: 1; }
      .progress-num {
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        width: 36px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }
    
    .error-msg {
      font-size: 12px;
      color: #ef4444;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }
  }

  .col-action {
    flex: 0 0 170px;
    text-align: right;
    padding-right: 8px;
    
    .hover-actions {
      opacity: 1;
      transform: translateX(0);
      transition: all 0.25s ease;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      
      .op-btn {
        margin: 0;
        padding: 6px 10px;
        min-width: 62px;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        
        &:hover {
          background: #e0f2fe;
          color: #0ea5e9;
          border-color: #bae6fd;
        }

        &.is-disabled {
          color: #94a3b8;
          background: #f8fafc;
          border-color: #e2e8f0;
          opacity: 0.9;
        }
      }
    }
    
    .action-group {
      display: flex;
      gap: 6px;
      
      .el-button {
        border-radius: 6px;
        font-weight: 600;
      }
    }
  }
}

.empty-placeholder {
  padding: 40px 20px;
  text-align: center;
  background: #f8fafc;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes pulse-dot {
  0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(14, 165, 233, 0); }
  100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
}

@keyframes pulse-border {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}

/* 列表进入动画 */
.staggered-fade-enter-active,
.staggered-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.staggered-fade-enter-from,
.staggered-fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

/* 响应式 */
@media (max-width: 768px) {
  .refined-header {
    flex-direction: column;
    padding: 16px;
    
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;
      width: 100%;
      
      .stats-bar {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 8px;
        
        &::-webkit-scrollbar {
          height: 4px;
        }
      }
      
      .progress-circle-area {
        position: absolute;
        top: 0;
        right: 0;
      }
    }
  }
  
  .list-header { display: none; }
  
  .student-item {
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
    
    .col-name { flex: 1 1 100%; padding: 0; }
    .col-status { flex: 1 1 auto; }
    .col-progress { display: none; }
    .col-action { flex: 0 0 auto; }
  }
}
</style>
