<template>
  <div class="student-task-list">
    <!-- Tab 切换 -->
    <div class="tab-switcher">
      <div 
        class="tab-item" 
        :class="{ active: currentTab === 'pending' }"
        @click="currentTab = 'pending'"
      >
        待批改
        <span class="tab-count" v-if="pendingTotal > 0">{{ pendingTotal }}</span>
      </div>
      <div 
        class="tab-item" 
        :class="{ active: currentTab === 'history' }"
        @click="currentTab = 'history'"
      >
        已完成
        <span class="tab-count done" v-if="historyTotal > 0">{{ historyTotal }}</span>
      </div>
    </div>

    <div class="list-header">
      <span class="title">{{ currentTab === 'pending' ? '待批改' : '已完成' }}</span>
      <div class="header-actions">
        <el-tag type="info" size="small" effect="plain" round>{{ totalTasks }} 个任务</el-tag>
        <el-tooltip :content="sortOrder === 'asc' ? '升序（最早提交在上）' : '降序（最新提交在上）'" placement="top" :teleported="false">
          <el-button
            class="sort-btn"
            size="small"
            text
            :icon="sortOrder === 'asc' ? CaretTop : CaretBottom"
            @click="toggleSort"
          />
        </el-tooltip>
      </div>
    </div>
    
    <div class="list-content">
      <el-scrollbar>
        <div v-if="totalTasks === 0" class="empty-tasks">
          <el-empty 
            :description="currentTab === 'pending' ? '暂无待批改任务' : '暂无已完成任务'" 
            :image-size="60" 
          />
        </div>
        
        <el-collapse v-else v-model="localActiveCaseNames" class="custom-collapse">
          <el-collapse-item 
            v-for="(group) in tasks" 
            :key="group.key || group.name" 
            :name="group.key || group.name"
            v-show="getVisibleTasks(group.tasks).length > 0"
          >
            <template #title>
              <div class="group-title">
                <el-icon class="folder-icon"><Folder /></el-icon>
                <span class="name text-truncate" :title="group.name">{{ group.name }}</span>
                <span class="badge" v-if="currentTab === 'pending' && group.pendingCount > 0">{{ group.pendingCount }}</span>
              </div>
            </template>
            
            <div class="task-group-content">
              <div 
                v-for="task in getVisibleTasks(group.tasks)" 
                :key="task.id" 
                class="task-item"
                :class="{ 'is-active': currentTaskId === task.id, 'is-confirmed': task.isConfirmed === 1 }"
                @click="handleSelectTask(task)"
              >
                <div class="task-status-icon">
                  <el-icon :class="task.isConfirmed === 1 ? 'text-confirmed' : getStatusClass(task.status)">
                    <component :is="task.isConfirmed === 1 ? 'CircleCheckFilled' : getStatusIcon(task.status)" />
                  </el-icon>
                </div>
                <div class="task-info">
                  <div class="task-name text-truncate" :title="task.taskDescription">
                    {{ task.taskDescription }}
                  </div>
                  <div class="task-meta">
                    <span class="status-text" :class="task.isConfirmed === 1 ? 'text-confirmed' : getStatusClass(task.status)">
                      {{ task.isConfirmed === 1 ? '教师已确认' : getStatusLabel(task.status) }}
                    </span>
                    <span class="score" v-if="task.score !== null">{{ task.score }}分</span>
                  </div>
                  <div class="task-submit-time" v-if="task.submitTime">
                    <el-icon><Clock /></el-icon>
                    {{ formatTime(task.submitTime) }}
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  Folder, CircleCheckFilled, CircleCloseFilled, 
  WarningFilled, Clock, Timer, CaretTop, CaretBottom
} from '@element-plus/icons-vue'

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  activeCaseNames: {
    type: [String, Array],
    default: ''
  },
  currentTaskId: {
    type: [Number, String],
    default: null
  }
})

const emit = defineEmits(['update:activeCaseNames', 'select'])

const localActiveCaseNames = computed({
  get: () => props.activeCaseNames,
  set: (val) => emit('update:activeCaseNames', val)
})

const currentTab = ref('pending') // 'pending' 待批改 | 'history' 已完成
const sortOrder = ref('asc') // 'asc' 升序(最早在上) | 'desc' 降序(最新在上)

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

/** 待批改：AI通过且分数合格且教师未确认 */
const filterPending = (taskList) => {
  if (!taskList) return []
  return taskList.filter(t => t.status === 3 && t.score >= 60 && !t.isConfirmed)
}

/** 已完成：教师已确认 */
const filterHistory = (taskList) => {
  if (!taskList) return []
  return taskList.filter(t => t.isConfirmed === 1)
}

/** 根据当前 Tab 返回过滤并排序後的任务列表 */
const getVisibleTasks = (taskList) => {
  const filtered = currentTab.value === 'pending'
    ? filterPending(taskList)
    : filterHistory(taskList)
  return filtered.sort((a, b) => {
    const ta = a.submitTime ? new Date(a.submitTime).getTime() : null
    const tb = b.submitTime ? new Date(b.submitTime).getTime() : null
    if (ta === null && tb === null) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    return sortOrder.value === 'asc' ? ta - tb : tb - ta
  })
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return timeStr
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const pendingTotal = computed(() =>
  props.tasks.reduce((sum, group) => sum + filterPending(group.tasks || []).length, 0)
)

const historyTotal = computed(() =>
  props.tasks.reduce((sum, group) => sum + filterHistory(group.tasks || []).length, 0)
)

const totalTasks = computed(() =>
  currentTab.value === 'pending' ? pendingTotal.value : historyTotal.value
)

const handleSelectTask = (task) => {
  emit('select', task)
}

const getStatusIcon = (status) => {
  // 1=待开始, 2=评分中, 3=已通过, 4=未通过, 5=已打回
  const map = {
    1: 'Clock',
    2: 'Timer',
    3: 'CircleCheckFilled',
    4: 'CircleCloseFilled',
    5: 'WarningFilled'
  }
  return map[status] || 'Clock'
}

const getStatusClass = (status) => {
  const map = {
    1: 'text-info',
    2: 'text-warning',
    3: 'text-success',
    4: 'text-danger',
    5: 'text-warning-dark'
  }
  return map[status] || 'text-info'
}

const getStatusLabel = (status) => {
  const map = { 
    1: '未开始', 
    2: '评分中', 
    3: '已完成', 
    4: '未通过',
    5: '已打回'
  }
  return map[status] || '未知'
}
</script>

<style scoped lang="scss">
$primary-color: #00b96b;
$hover-bg: #f5f7fa;
$active-bg: #e6f8f0;
$border-color: #f0f2f5;

.student-task-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-tag),
  :deep(.el-checkbox) {
    font-size: 16px;
  }
}

/* Tab 切换 */
.tab-switcher {
  display: flex;
  border-bottom: 2px solid $border-color;
  flex-shrink: 0;
  
  .tab-item {
    flex: 1;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 17px;
    color: #909399;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    
    &:hover { color: $primary-color; }
    
    &.active {
      color: $primary-color;
      font-weight: 600;
      border-bottom-color: $primary-color;
    }
    
    .tab-count {
      background: #f56c6c;
      color: #fff;
      font-size: 14px;
      padding: 0 5px;
      height: 15px;
      line-height: 15px;
      border-radius: 8px;
      
      &.done {
        background: #67c23a;
      }
    }
  }
}

.list-header {
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid $border-color;
  
  .title {
    font-weight: 600;
    color: #2c3e50;
    font-size: 17px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;

    .sort-btn {
      color: #909399;
      padding: 0 4px;
      font-size: 17px;
      &:hover { color: $primary-color; }
    }
  }
}

.list-content {
  flex: 1;
  overflow: hidden;
}

/* 自定义 Collapse 样式 */
.custom-collapse {
  border: none;
  
  :deep(.el-collapse-item__header) {
    height: 40px;
    line-height: 40px;
    padding-left: 16px;
    background: #fff;
    border-bottom: 1px solid $border-color;
    font-size: 17px;
    color: #606266;
    
    &.is-active {
      color: $primary-color;
    }
  }
  
  :deep(.el-collapse-item__content) {
    padding-bottom: 0;
  }
  
  :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }
}

.group-title {
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  padding-right: 10px;
  
  .folder-icon {
    margin-right: 6px;
    font-size: 20px;
  }
  
  .name {
    flex: 1;
  }
  
  .badge {
    background: #f56c6c;
    color: #fff;
    font-size: 14px;
    padding: 0 6px;
    height: 16px;
    line-height: 16px;
    border-radius: 8px;
    margin-left: 8px;
  }
}

.task-item {
  display: flex;
  padding: 12px 16px 12px 32px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid #f9f9f9;
  
  &:hover {
    background-color: $hover-bg;
  }
  
  &.is-active {
    background-color: $active-bg;
    border-right: 3px solid $primary-color;
    
    .task-name {
      color: $primary-color;
      font-weight: 500;
    }
  }
  
  .task-status-icon {
    margin-right: 10px;
    margin-top: 2px;
    font-size: 18px;
  }
  
  .task-info {
    flex: 1;
    overflow: hidden;
    
    .task-name {
      font-size: 17px;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .task-meta {
      display: flex;
      justify-content: space-between;
      font-size: 15px;
      
      .status-text {
        opacity: 0.8;
      }
      
      .score {
        font-weight: 600;
        color: #2c3e50;
      }
    }

    .task-submit-time {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 14px;
      color: #b0b8c1;
      margin-top: 3px;

      .el-icon { font-size: 13px; }
    }
  }
}

.text-success { color: #67c23a; }
.text-warning { color: #e6a23c; }
.text-danger { color: #f56c6c; }
.text-info { color: #909399; }
.text-warning-dark { color: #e6a23c; }
.text-confirmed { color: #00b96b; }

.task-item.is-confirmed {
  opacity: 0.75;
  background: #f9fefb;
  &:hover { background: #f0fbf6; opacity: 1; }
  &.is-active { background-color: $active-bg; opacity: 1; }
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
