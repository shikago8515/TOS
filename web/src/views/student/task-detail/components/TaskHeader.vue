<template>
  <div class="task-header-card">
    <div class="header-inner">
      <!-- Left: Back & Title -->
      <div class="left-section">
        <div class="back-btn" @click="$emit('back')">
          <el-icon><ArrowLeft /></el-icon>
        </div>
        <div class="title-area">
          <h1 class="task-title" :title="task?.taskDescription">{{ task?.taskDescription || '任务详情' }}</h1>
          <el-tag
            v-if="task"
            size="small"
            effect="light"
            round
            :type="getCaseModeType(task)"
            class="mode-tag"
          >
            {{ getCaseModeText(task) }}
          </el-tag>
          <el-tag 
            v-if="task" 
            size="small" 
            effect="plain" 
            round
            :type="getStatusType(task.status)"
            class="status-tag"
          >
            {{ getStatusText(task.status) }}
          </el-tag>
        </div>
      </div>

      <!-- Right: Meta (Deadline) -->
      <div class="right-section" v-if="task">
        <div class="meta-item">
          <el-icon class="meta-icon"><Timer /></el-icon>
          <span class="label">截止:</span>
          <span class="value">{{ formatDateTime(task.deadline) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Timer } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { getStudentTaskCaseModeLabel, getStudentTaskCaseModeTagType } from '@/utils/studentTaskMode'

defineProps<{
  task: any
}>()

defineEmits(['back'])
const router = useRouter()

const getCaseModeText = (task: any) => getStudentTaskCaseModeLabel(task)
const getCaseModeType = (task: any) => getStudentTaskCaseModeTagType(task)

const getStatusText = (status: number) => {
  const map: Record<number, string> = { 
    1: '待开始', 
    2: '评分中', 
    3: '已通过', 
    4: '未通过',
    5: '已打回' 
  }
  return map[status] || '未知'
}

const getStatusType = (status: number) => {
  // Simplify colors: only show success as green, others as neutral gray
  if (status === 3) return 'success'
  return 'info'
}

const formatDateTime = (timeStr: string) => {
  if (!timeStr) return '无限制'
  return timeStr.replace('T', ' ').substring(0, 16)
}
</script>

<style scoped lang="scss">
.task-header-card {
  background: #ffffff;
  border-bottom: 1px solid #f0f2f5;
  padding: 8px 12px; /* Align with the widened task detail container */
  margin-bottom: 0; /* Removed margin */
  background: rgba(255, 255, 255, 0.9); /* Increased opacity slightly */
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 100; /* Increased z-index */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.header-inner {
  max-width: 1760px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px; // Reduced height
}

.left-section {
  display: flex;
  align-items: center;
  gap: 12px; /* Reduced gap */
  min-width: 0;

  .back-btn {
    width: 28px; /* Smaller back button */
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #606266;
    transition: all 0.2s;
    background: #f5f7fa;
    font-size: 14px;

    &:hover {
      background: #e6e8eb;
      color: #303133;
    }
  }

  .title-area {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    .task-title {
      font-size: 15px; /* Slightly smaller font */
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: min(860px, 56vw);
    }
  }
}

.right-section {
  display: flex;
  align-items: center;
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #606266;
    background: #f9fafc;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #ebeef5;

    .meta-icon { color: #909399; }
    .label { color: #909399; }
    .value { 
      font-family: 'JetBrains Mono', monospace; 
      font-weight: 500;
      color: #2c3e50;
    }
  }
}

@media (max-width: 768px) {
  .header-inner {
    height: auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 0;
  }
}
</style>
