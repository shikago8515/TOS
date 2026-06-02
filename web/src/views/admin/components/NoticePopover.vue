<template>
  <el-popover placement="bottom-end" :width="360" trigger="click" :teleported="false">
    <template #reference>
      <div class="trigger-box">
        <el-tooltip content="消息通知" placement="bottom" :teleported="false">
          <el-badge :is-dot="unreadCount > 0" :value="unreadCount > 99 ? '99+' : unreadCount" :hidden="unreadCount === 0">
            <el-button class="notice-btn" circle>
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
        </el-tooltip>
      </div>
    </template>

    <div class="notice-panel">
      <div class="notice-header">
        <strong>系统通知</strong>
        <el-button link type="primary" @click="markAllAsRead" :disabled="unreadCount === 0">全部已读</el-button>
      </div>

      <el-scrollbar max-height="320px" class="notice-list-scroll">
        <div v-if="notices.length === 0" class="notice-empty">暂无通知</div>
        <div
          v-for="notice in notices"
          :key="notice.id"
          class="notice-item"
          :class="{ unread: !notice.read }"
          @click="handleNoticeClick(notice)"
        >
          <span class="priority-dot" :class="`priority-${notice.priority}`"></span>
          <div class="notice-content">
            <div class="notice-title-row">
              <span class="notice-title">{{ notice.title }}</span>
              <span class="notice-time">{{ notice.time }}</span>
            </div>
            <p class="notice-desc">{{ notice.content }}</p>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell } from '@element-plus/icons-vue'
import { getAdminNotices, markAdminNoticeRead, markAllAdminNoticesRead } from '@/api/admin'

const router = useRouter()
const route = useRoute()

const notices = ref([])

const unreadCount = computed(() => notices.value.filter((item) => !item.read).length)

const formatRelativeTime = (value) => {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  return `${Math.floor(diffMs / day)} 天前`
}

const loadNotices = async () => {
  try {
    const res = await getAdminNotices({ limit: 20 })
    const list = Array.isArray(res?.data) ? res.data : []
    notices.value = list.map((item) => ({
      id: item.id,
      title: item.title || '系统通知',
      content: item.content || '系统有新的通知，请及时查看。',
      time: formatRelativeTime(item.time),
      priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'low',
      read: Boolean(item.read),
      action: item.action || '/admin/logs'
    }))
  } catch (e) {
    notices.value = []
  }
}

const markAllAsRead = async () => {
  try {
    await markAllAdminNoticesRead()
    notices.value = notices.value.map((item) => ({ ...item, read: true }))
  } catch (e) {
    ElMessage.error('标记失败，请稍后重试')
  }
}

const handleNoticeClick = async (notice) => {
  if (!notice.read) {
    try {
      await markAdminNoticeRead(notice.id)
      notice.read = true
    } catch (e) {
      ElMessage.error('更新通知状态失败')
    }
  }

  if (notice.action && route.path !== notice.action) {
    router.push(notice.action)
  }
}

onMounted(() => {
  loadNotices()
})
</script>

<style scoped lang="scss">
.trigger-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
}

.notice-btn {
  border: 0;
  background: rgba(74, 164, 230, 0.14);
  color: #2d8fca;

  &:hover {
    background: rgba(74, 164, 230, 0.22);
    transform: translateY(-1px);
  }
}

.notice-panel {
  .notice-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    strong {
      font-size: 14px;
      color: #1c4d6a;
    }
  }

  .notice-list-scroll {
    padding-right: 4px;
  }

  .notice-empty {
    text-align: center;
    color: #7f9fb5;
    font-size: 13px;
    padding: 26px 0;
  }

  .notice-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #edf7fd;
    }

    &.unread {
      background: #f3faff;
      border: 1px solid #dbeef9;
    }

    .priority-dot {
      width: 8px;
      height: 8px;
      margin-top: 7px;
      border-radius: 50%;
      flex-shrink: 0;

      &.priority-high {
        background: #f56c6c;
      }

      &.priority-medium {
        background: #e6a23c;
      }

      &.priority-low {
        background: #67c23a;
      }
    }

    .notice-content {
      flex: 1;
      min-width: 0;
    }

    .notice-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }

    .notice-title {
      font-size: 13px;
      font-weight: 600;
      color: #1f5474;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notice-time {
      color: #7f9fb5;
      font-size: 12px;
      flex-shrink: 0;
    }

    .notice-desc {
      margin: 0;
      color: #5f8199;
      font-size: 12px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}
</style>
