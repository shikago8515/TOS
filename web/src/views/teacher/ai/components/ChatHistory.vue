<template>
  <el-drawer
    :model-value="modelValue"
    :with-header="false"
    size="320px"
    direction="ltr"
    :before-close="handleClose"
    class="innovative-history-drawer"
    :append-to-body="false"
  >
    <div class="drawer-container">
      <!-- Header Section -->
      <div class="drawer-header">
        <div class="brand-area">
          <el-icon class="brand-icon"><ChatDotRound /></el-icon>
          <span class="brand-text">对话历史</span>
        </div>
        <button class="btn-new-chat" @click="handleNewChat">
          <el-icon><Plus /></el-icon>
          <span>开启新对话</span>
        </button>
        <div class="search-container">
          <el-input
            v-model="searchQuery"
            placeholder="搜索历史记录..."
            prefix-icon="Search"
            clearable
            class="innovative-search"
          />
        </div>
      </div>

      <!-- List Section -->
      <div class="drawer-body custom-scrollbar" v-loading="loading">
        <el-empty 
          v-if="!hasHistory" 
          description="暂无历史记录" 
          :image-size="100"
        />
        
        <template v-else>
          <div v-for="(group, groupName) in groupedSessions" :key="groupName" class="history-group">
            <div v-if="group.length > 0" class="group-label">
              {{ getGroupName(groupName) }}
            </div>
            <transition-group name="staggered-fade" tag="div" class="group-items">
              <div
                v-for="session in group"
                :key="session.id"
                class="session-card"
                :class="{ 'is-active': currentId === session.id }"
                @click="handleSelect(session)"
              >
                <div class="card-indicator"></div>
                <div class="card-content">
                  <div class="card-title" :title="session.sessionTitle || session.title || '新对话'">
                    {{ session.sessionTitle || session.title || '新对话' }}
                  </div>
                  <div class="card-meta">
                    <el-icon><Clock /></el-icon>
                    <span>{{ formatTime(session.updatedAt || session.updateTime || session.createTime) }}</span>
                  </div>
                </div>
                <div class="card-actions">
                  <el-popconfirm
                    title="确定删除此对话？"
                    @confirm.stop="handleDelete(session.id)"
                    :teleported="false"
                    width="180"
                    confirm-button-text="删除"
                    cancel-button-text="取消"
                    confirm-button-type="danger"
                  >
                    <template #reference>
                      <button class="btn-icon-delete" @click.stop>
                        <el-icon><Delete /></el-icon>
                      </button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
            </transition-group>
          </div>
        </template>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search, Delete, Plus, ChatDotRound, Clock } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  historyList: { type: Array, default: () => [] },
  currentId: { type: [String, Number], default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'select', 'delete', 'clear-all', 'new-chat'])

const searchQuery = ref('')

const handleClose = () => emit('update:modelValue', false)

const handleSelect = (session) => {
  emit('select', session)
  handleClose()
}

const handleDelete = (id) => emit('delete', id)

const handleNewChat = () => {
  emit('new-chat')
  handleClose()
}

const filteredSessions = computed(() => {
  if (!searchQuery.value) return props.historyList
  return props.historyList.filter(session => {
    const title = session.sessionTitle || session.title || ''
    return title.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

const hasHistory = computed(() => filteredSessions.value.length > 0)

const groupedSessions = computed(() => {
  const groups = { today: [], yesterday: [], sevenDays: [], earlier: [] }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const sevenDaysAgo = today - 86400000 * 7
  
  filteredSessions.value.forEach(session => {
    const timeStr = session.updatedAt || session.updateTime || session.createTime
    const itemTime = timeStr ? new Date(timeStr).getTime() : Date.now()
    
    if (itemTime >= today) groups.today.push(session)
    else if (itemTime >= yesterday) groups.yesterday.push(session)
    else if (itemTime >= sevenDaysAgo) groups.sevenDays.push(session)
    else groups.earlier.push(session)
  })
  return groups
})

const getGroupName = (key) => {
  const map = { today: '今天', yesterday: '昨天', sevenDays: '过去7天', earlier: '更早' }
  return map[key]
}

const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit' })
  }
  return date.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<style lang="scss">
.innovative-history-drawer {
  .el-drawer__body {
    padding: 0;
    overflow: hidden;
    background-color: #ffffff;
  }
}
</style>

<style scoped lang="scss">
.drawer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
}

.drawer-header {
  padding: 24px 20px 16px;
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
  z-index: 10;

  .brand-area {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    
    .brand-icon {
      font-size: 22px;
      color: #303133;
    }
    
    .brand-text {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .btn-new-chat {
    width: 100%;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #ffffff;
    color: #303133;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 20px;

    &:hover {
      color: #409eff;
      border-color: #c6e2ff;
      background-color: #ecf5ff;
    }
    
    &:active {
      background-color: #e6f1fc;
    }

    .el-icon {
      font-size: 16px;
    }
  }

  .search-container {
    .innovative-search {
      :deep(.el-input__wrapper) {
        border-radius: 8px;
        background-color: #f5f7fa;
        box-shadow: none;
        border: 1px solid transparent;
        transition: all 0.2s ease;
        padding: 4px 12px;

        &:hover {
          background-color: #f0f2f5;
        }

        &.is-focus {
          background-color: #ffffff;
          border-color: #409eff;
          box-shadow: 0 0 0 1px #409eff inset;
        }
      }
    }
  }
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  .history-group {
    margin-bottom: 24px;

    .group-label {
      font-size: 12px;
      font-weight: 500;
      color: #909399;
      margin: 0 4px 12px;
    }

    .group-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  }
}

.session-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  .card-indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 0;
    width: 3px;
    background: #409eff;
    border-radius: 0 4px 4px 0;
    transition: height 0.2s ease;
  }

  &:hover {
    background: #f5f7fa;

    .card-actions {
      opacity: 1;
    }
  }

  &.is-active {
    background: #ecf5ff;
    border-color: #c6e2ff;

    .card-indicator {
      height: 60%;
    }

    .card-title {
      color: #409eff !important;
      font-weight: 500;
    }
  }

  .card-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .card-title {
      font-size: 14px;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 0.2s ease;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #909399;

      .el-icon {
        font-size: 12px;
      }
    }
  }

  .card-actions {
    opacity: 0;
    transition: opacity 0.2s ease;
    margin-left: 12px;

    .btn-icon-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #909399;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #fef0f0;
        color: #f56c6c;
      }
    }
  }
}

/* 动画效果 */
.staggered-fade-enter-active,
.staggered-fade-leave-active {
  transition: all 0.3s ease;
}
.staggered-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.staggered-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.staggered-fade-leave-active {
  position: absolute;
}

/* 自定义滚动条 */
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #dcdfe6;
    border-radius: 3px;
    
    &:hover {
      background-color: #c0c4cc;
    }
  }
  &::-webkit-scrollbar-track {
    background-color: transparent;
  }
}
</style>