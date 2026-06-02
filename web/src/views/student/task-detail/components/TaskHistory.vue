<template>
  <el-card shadow="never" class="history-card">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <div class="icon-box">
            <el-icon><Clock /></el-icon>
          </div>
          <span class="title">{{ historyTitle }}</span>
        </div>
        <el-tag size="small" effect="plain" round>{{ submissions.length }} 次提交</el-tag>
      </div>
    </template>

    <div class="history-list">
      <div v-if="submissions.length > 0" class="timeline-wrapper">
        <div 
          v-for="(sub, index) in submissions" 
          :key="sub.id"
          class="timeline-item animate__animated animate__fadeInUp"
          :style="{ animationDelay: `${index * 0.1}s` }"
        >
          <div class="time-column">
            <span class="date">{{ formatDate(sub.submissionTime) }}</span>
            <span class="time">{{ formatTime(sub.submissionTime) }}</span>
          </div>
          
          <div class="status-line">
            <div class="dot" :class="getDotClass(sub)"></div>
            <div class="line" v-if="index !== submissions.length - 1"></div>
          </div>
          
          <div class="content-card" :class="{ 'is-active': index === 0 }">
            <div class="card-top">
              <div class="file-info">
                <el-icon><Document /></el-icon>
                <span class="name" :title="sub.fileName">{{ sub.fileName }}</span>
              </div>
              <el-tag size="small" :type="getSubmissionStatusType(sub)" effect="light">
                {{ getSubmissionStatusText(sub) }}
              </el-tag>
            </div>
            
            <div class="card-actions">
              <el-button 
                type="primary" 
                link 
                size="small" 
                class="view-btn"
                @click="$emit('view-report', sub)"
              >
                {{ isGrading(sub) ? '查看进度' : viewActionText }} <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
              
              <el-popconfirm
                title="确定删除这条记录？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="$emit('delete-submission', sub)"
                :teleported="false"
              >
                <template #reference>
                  <el-button 
                    type="danger" 
                    link 
                    size="small"
                    class="del-btn"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>
      
      <el-empty v-else :description="emptyDescription" :image-size="80" />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Document, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const props = defineProps<{
  submissions: any[]
  gradingResult: any
  activeProgressSubmissionId?: number | null
  caseMode?: string
}>()

defineEmits(['view-report', 'delete-submission'])

const isFullPracticeMode = computed(() => props.caseMode === 'FULL_PRACTICE')

const historyTitle = computed(() => {
  return isFullPracticeMode.value ? '最终成果提交记录' : '提交历史'
})

const emptyDescription = computed(() => {
  return isFullPracticeMode.value ? '暂无最终成果提交记录' : '暂无提交记录'
})

const viewActionText = computed(() => {
  return isFullPracticeMode.value ? '查看评分结果' : '查看报告'
})

const formatDate = (time: string) => dayjs(time).format('MM-DD')
const formatTime = (time: string) => dayjs(time).format('HH:mm')

const isGrading = (sub: any) => {
  if (!sub) return false
  if (Number(sub.status) === 2 && (sub.score == null || sub.score === undefined)) return true
  if (props.activeProgressSubmissionId && Number(props.activeProgressSubmissionId) === Number(sub.id)) return true
  if (!props.gradingResult) return false
  if (props.submissions.length > 0 && sub.id !== props.submissions[0].id) return false
  const status = props.gradingResult.gradingStatus
  return status === 'pending' || status === 'processing'
}

const getDotClass = (sub: any) => {
  if (isGrading(sub)) return 'processing'
  if (sub.status === 5) return 'warning'
  if (sub.score != null && sub.score >= 60) return 'success'
  return 'default'
}

const getSubmissionStatusText = (sub: any) => {
  if (isGrading(sub)) return 'AI评分中'
  if (sub.status === 5) return '已打回'
  if (sub.score != null) return sub.score >= 60 ? '验收通过' : '未通过'
  const map: Record<number, string> = {
    2: '已提交',
    3: '验收通过',
    4: '未通过',
    5: '已打回'
  }
  return map[sub.status] || '未知'
}

const getSubmissionStatusType = (sub: any) => {
  if (isGrading(sub)) return 'warning'
  if (sub.status === 5) return 'warning'
  if (sub.score != null) return sub.score >= 60 ? 'success' : 'danger'
  return 'info'
}
</script>

<style scoped lang="scss">
$primary: #00b96b;
$success: #00b96b;
$warning: #ff9800;
$danger: #ff4d4f;
$text-main: #2c3e50;
$text-sub: #8c959f;

.history-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: none;
  background: #ffffff;
  
  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f2f5;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .icon-box {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 20px;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
  }
}

.history-list {
  padding: 10px 0;
}

.timeline-wrapper {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding-bottom: 20px;
  position: relative;

  &:last-child {
    padding-bottom: 0;
  }

  .time-column {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-width: 45px;
    padding-top: 2px;
    
    .date {
      font-size: 12px;
      color: #1a1a1a;
      font-weight: 500;
    }
    .time {
      font-size: 11px;
      color: #909399;
    }
  }

  .status-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    padding-top: 6px;
    
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #dcdfe6;
      z-index: 2;
      
      &.success { background: #67c23a; }
      &.processing { background: #e6a23c; }
      &.warning { background: #f56c6c; }
    }

    .line {
      flex: 1;
      width: 1px;
      background: #f0f2f5;
      margin-top: 4px;
      min-height: 40px;
    }
  }

  .content-card {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #ebeef5;
    transition: all 0.2s;
    
    &.is-active {
      border-color: #1a1a1a;
      background: #fafafa;
    }

    &:hover {
      border-color: #c0c4cc;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;

      .file-info {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #1a1a1a;
        font-size: 13px;
        font-weight: 500;
        
        .name {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      
      .view-btn {
        color: #1a1a1a;
        font-weight: 500;
        &:hover { text-decoration: underline; }
      }
      
      .del-btn {
        color: #909399;
        &:hover { color: #f56c6c; }
      }
    }
  }
}
</style>
