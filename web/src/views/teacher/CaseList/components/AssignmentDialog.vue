<template>
  <el-dialog
    v-model="visible"
    :title="`学生完成情况 - ${currentCaseName}`"
    width="80%"
    :teleported="false"
    destroy-on-close
    class="assignments-dialog"
  >
    <div class="dialog-summary" v-if="assignments.length > 0">
      <div class="summary-item">
        <div class="label">总人数</div>
        <div class="value">{{ groupedAssignments.length }}</div>
      </div>
      <div class="summary-item">
        <div class="label">已完成</div>
        <div class="value">{{ groupedAssignments.filter(s => s.progress === 100).length }}</div>
      </div>
      <div class="summary-item">
        <div class="label">平均分</div>
        <div class="value">{{ calculateOverallAverageScore() }}</div>
      </div>
    </div>

    <el-table 
      :data="groupedAssignments" 
      v-loading="loading" 
      style="width: 100%"
      size="small"
      :header-cell-style="{ background: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '12px', borderBottom: '1px solid #e2e8f0' }"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div style="padding: 10px 20px; background: #f9fafc;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #606266;">子任务详情</h4>
            <el-table :data="row.tasks" border size="small">
              <el-table-column prop="taskDescription" label="任务名称" min-width="200" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="100" align="center">
                <template #default="{ row: task }">
                  <el-tag :type="getTaskStatusType(task.status)" size="small" effect="light" round>
                    {{ getTaskStatusText(task.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="startTime" label="开始时间" width="160" align="center">
                <template #default="{ row: task }">
                  <span class="time-text">{{ formatDateTime(task.startTime) || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="submitTime" label="提交时间" width="160" align="center">
                <template #default="{ row: task }">
                  <span class="time-text">{{ formatDateTime(task.submitTime) || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="得分" align="center">
                <template #default="{ row: task }">
                  <span v-if="task.score !== undefined && task.score !== null" class="score-text" :class="getScoreClass(task.score)">{{ task.score }}</span>
                  <span v-else class="text-gray">-</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="className" label="班级" width="120" align="center" sortable />
      <el-table-column prop="studentNumber" label="学号" width="120" align="center" sortable />
      <el-table-column prop="studentName" label="姓名" width="100" align="center" />
      
      <el-table-column label="来源" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="getSourceType(row.tasks)" size="small" effect="light">
            {{ getSourceText(row.tasks) }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="整体进度" min-width="150" align="center">
        <template #default="{ row }">
          <el-progress 
            :percentage="row.progress" 
            :status="row.progress === 100 ? 'success' : ''"
            :stroke-width="18"
            text-inside
          />
        </template>
      </el-table-column>

      <el-table-column label="平均得分" width="100" align="center" sortable prop="averageScore">
        <template #default="{ row }">
          <span v-if="row.averageScore !== '-'" class="score-text" :class="getScoreClass(Number(row.averageScore))">{{ row.averageScore }}</span>
          <span v-else class="text-gray">-</span>
        </template>
      </el-table-column>

      <el-table-column label="完成时间" width="160" align="center" sortable prop="lastSubmitTime">
        <template #default="{ row }">
          <span class="time-text">{{ formatDateTime(row.lastSubmitTime) || '-' }}</span>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getTasksByCaseId } from '@/api/teacher/task'
/** @typedef {import('@/api/types').TrainingTask} TrainingTask */

const visible = ref(false)
const loading = ref(false)
const currentCaseName = ref('')
const assignments = ref<any[]>([])

const open = async (caseItem: any) => {
  currentCaseName.value = caseItem.caseName
  visible.value = true
  loading.value = true
  assignments.value = []
  
  try {
    const res = await getTasksByCaseId(caseItem.id)
    assignments.value = res.data || []
  } catch (error: any) {
    ElMessage.error(error.message || '加载任务数据失败')
  } finally {
    loading.value = false
  }
}

defineExpose({ open })

// Grouped assignments by student
const groupedAssignments = computed(() => {
  const groups: Record<string, any> = {}
  
  assignments.value.forEach((task: any) => {
    // Use studentNumber or studentId as key
    const key = task.studentNumber || task.studentId || 'unknown'
    
    if (!groups[key]) {
      groups[key] = {
        studentNumber: task.studentNumber,
        studentName: task.studentName,
        className: (task as any).className || (task as any).studentClass || '未知班级',
        tasks: [],
        totalTasks: 0,
        completedTasks: 0,
        progress: 0,
        averageScore: '-',
        lastSubmitTime: null
      }
    }
    groups[key].tasks.push(task)
  })

  return Object.values(groups).map((student: any) => {
    student.totalTasks = student.tasks.length
    // status >= 3 means submitted/completed (3=Passed, 4=Failed)
    const completed = student.tasks.filter((t: any) => t.status >= 3)
    student.completedTasks = completed.length
    student.progress = student.totalTasks > 0 
      ? Math.round((student.completedTasks / student.totalTasks) * 100) 
      : 0
      
    const scoredTasks = student.tasks.filter((t: any) => t.score !== undefined && t.score !== null)
    if (scoredTasks.length > 0) {
      const totalScore = scoredTasks.reduce((sum: number, t: any) => sum + (t.score || 0), 0)
      student.averageScore = (totalScore / scoredTasks.length).toFixed(1)
    }

    if (completed.length > 0) {
      // Sort by submitTime desc to find the latest completion
      const sorted = [...completed].sort((a: any, b: any) => {
        const tA = a.submitTime ? new Date(a.submitTime).getTime() : 0
        const tB = b.submitTime ? new Date(b.submitTime).getTime() : 0
        return tB - tA
      })
      student.lastSubmitTime = sorted[0].submitTime
    }
    
    return student
  })
})

const calculateOverallAverageScore = () => {
  const studentsWithScore = groupedAssignments.value.filter((s: any) => s.averageScore !== '-')
  if (studentsWithScore.length === 0) return '-'
  const total = studentsWithScore.reduce((sum: number, s: any) => sum + Number(s.averageScore), 0)
  return (total / studentsWithScore.length).toFixed(1)
}

const formatDateTime = (val: any) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const getTaskStatusText = (status: number) => {
  const map: Record<number, string> = { 1: '未开始', 2: '进行中', 3: '已完成', 4: '未通过' }
  return map[status] || '未知'
}

const getTaskStatusType = (status: number) => {
  const map: Record<number, string> = { 1: 'info', 2: 'primary', 3: 'success', 4: 'danger' }
  return map[status] || 'info'
}

const getScoreClass = (score: number) => {
  if (score >= 90) return 'score-high'
  if (score >= 60) return 'score-pass'
  return 'score-fail'
}

const getSourceText = (tasks: any[]) => {
  const source = tasks?.[0]?.source
  return source === 2 ? '自领' : '分配'
}

const getSourceType = (tasks: any[]) => {
  const source = tasks?.[0]?.source
  return source === 2 ? 'success' : 'primary'
}
</script>

<style scoped lang="scss">
.time-text {
  color: #64748b;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.score-text {
  font-weight: 600;
  color: #0f172a;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.text-gray {
  color: #94a3b8;
}

.dialog-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: linear-gradient(to right, #f8fafc, #f1f5f9);
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  
  .summary-item {
    flex: 1;
    text-align: center;
    position: relative;
    
    &:not(:last-child)::after {
      content: '';
      position: absolute;
      right: 0;
      top: 10%;
      height: 80%;
      width: 1px;
      background-color: #e2e8f0;
    }
    
    .label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 2px;
      font-weight: 500;
    }
    
    .value {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
    }
  }
}

.score-high { color: #10b981; }
.score-pass { color: #3b82f6; }
.score-fail { color: #ef4444; }

:deep(.assignments-dialog) {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  .el-dialog__header {
    margin: 0;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: #fff;
    
    .el-dialog__title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
  }
  
  .el-dialog__body {
    padding: 12px;
    background: #fafafa;
  }
  
  .el-dialog__footer {
    padding: 10px 16px;
    border-top: 1px solid #f1f5f9;
    background: #fff;
  }
  
  .el-table {
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    
    .el-table__row {
      transition: all 0.2s ease;
      &:hover {
        background-color: #f0f7ff !important;
      }
    }
    
    .el-table__cell {
      padding: 6px 0;
    }
  }
}
</style>