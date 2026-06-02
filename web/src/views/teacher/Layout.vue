<template>
  <div class="teacher-layout" :class="{ 'sidebar-hidden': !sidebarVisible }">
    <aside class="side-nav" :class="{ 'is-open': sidebarVisible }">
      <div class="brand">
        <div class="brand-mark">
          <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="logo" class="brand-logo" />
          <el-icon v-else><School /></el-icon>
        </div>
        <div class="brand-text">
          <h1>{{ branding.systemName }}</h1>
          <p>{{ branding.icp || 'Teacher Workspace' }}</p>
        </div>
      </div>

      <el-scrollbar class="nav-scroll">
        <el-menu
          :default-active="activeMenu"
          class="menu"
          router
        >
          <el-menu-item index="/teacher/dashboard">
            <el-icon><DataBoard /></el-icon>
            <span>工作台</span>
          </el-menu-item>

          <el-menu-item-group title="教学管理">
            <el-menu-item index="/teacher/cases">
              <el-icon><Folder /></el-icon>
              <span>案例库管理</span>
            </el-menu-item>
            <el-menu-item index="/teacher/cases/create">
              <el-icon><MagicStick /></el-icon>
              <span>AI 生成案例</span>
            </el-menu-item>
            <el-menu-item index="/teacher/workflow/design">
              <el-icon><Connection /></el-icon>
              <span>工作流编排</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="课程与班级">
            <el-menu-item index="/teacher/courses">
              <el-icon><DocumentCopy /></el-icon>
              <span>课程管理</span>
            </el-menu-item>
            <el-menu-item index="/teacher/templates">
              <el-icon><Files /></el-icon>
              <span>案例模板库</span>
            </el-menu-item>
            <el-menu-item index="/teacher/textbooks">
              <el-icon><Reading /></el-icon>
              <span>教材管理</span>
            </el-menu-item>
            <el-menu-item index="/teacher/classes">
              <el-icon><UserFilled /></el-icon>
              <span>班级管理</span>
            </el-menu-item>
            <el-menu-item index="/teacher/classes/analytics">
              <el-icon><Histogram /></el-icon>
              <span>班级学情分析</span>
            </el-menu-item>
            <el-menu-item index="/teacher/tasks">
              <el-icon><List /></el-icon>
              <span>任务分配</span>
            </el-menu-item>
            <el-menu-item index="/teacher/grading">
              <el-icon><EditPen /></el-icon>
              <span>作业批改</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="智能助手">
            <el-menu-item index="/teacher/ai/chat">
              <el-icon><Service /></el-icon>
              <span>AI 助教</span>
            </el-menu-item>
            <el-menu-item index="/teacher/ai/knowledge">
              <el-icon><Collection /></el-icon>
              <span>知识库管理</span>
            </el-menu-item>
            <el-menu-item index="/teacher/ai/recycle">
              <el-icon><Delete /></el-icon>
              <span>回收站</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-menu>
      </el-scrollbar>
    </aside>

    <div
      class="sidebar-mask"
      v-if="isMobile && sidebarVisible"
      @click="sidebarVisible = false"
    ></div>

    <section class="main-panel">
      <header class="topbar">
        <div class="topbar-left">
          <el-button class="menu-btn" circle @click="toggleSidebar">
            <el-icon><Operation /></el-icon>
          </el-button>

          <el-breadcrumb separator=">">
            <el-breadcrumb-item :to="{ path: '/teacher/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="topbar-right">
          <el-tag effect="light" type="success" round class="mode-tag">
            <el-icon><Sunny /></el-icon>
            <span class="tag-text">当前模式：{{ currentModeLabel }}</span>
          </el-tag>

          <el-dropdown
            trigger="click"
            placement="bottom-end"
            :teleported="false"
            popper-class="teacher-user-dropdown-popper"
            :popper-options="{
              strategy: 'fixed',
              modifiers: [
                { name: 'offset', options: { offset: [0, 6] } },
                { name: 'preventOverflow', options: { padding: 8 } }
              ]
            }"
            @command="handleCommand"
          >
            <div class="user-card">
              <el-avatar
                :size="34"
                class="avatar"
                :src="avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'"
              />
              <div class="user-meta">
                <strong>{{ username }}</strong>
                <span>教师账号</span>
              </div>
              <el-icon class="arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人资料</el-dropdown-item>
                <el-dropdown-item command="changePassword">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout" style="color: #e84d4d">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content-shell">
        <router-view v-slot="{ Component, route }">
          <transition name="page-slide">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </main>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onErrorCaptured, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  School,
  DataBoard,
  Folder,
  MagicStick,
  List,
  EditPen,
  Service,
  Collection,
  Delete,
  UserFilled,
  DocumentCopy,
  Files,
  Histogram,
  Reading,
  Operation,
  Sunny,
  ArrowDown,
  Connection
} from '@element-plus/icons-vue'
import { getUserInfo } from '../../api/user'
import { clearAuthSession, getAuthSession, getAuthToken, setAuthSession } from '@/utils/authStorage'
import { applyDocumentTitle, getDefaultBranding, loadSystemBranding } from '@/utils/systemBranding'

const router = useRouter()
const route = useRoute()
const recoveringFromRouteError = ref(false)
const session = getAuthSession('TEACHER') || {}
const branding = ref(getDefaultBranding())
const username = ref(session.username || localStorage.getItem('username') || '教师')
const avatar = ref(session.avatar || '')
const syncAvatarToSession = (nextAvatar) => {
  setAuthSession({ avatar: nextAvatar || '' }, 'TEACHER')
}
const handleAvatarUpdate = (e) => {
  const newAvatar = e.detail?.avatar || ''
  avatar.value = newAvatar
  syncAvatarToSession(newAvatar ? newAvatar.split('?')[0] : '')
}

onErrorCaptured((error) => {
  console.error('[TeacherLayout] Route render error:', error)

  if (recoveringFromRouteError.value) {
    return false
  }

  recoveringFromRouteError.value = true
  ElMessage.error('页面渲染异常，已自动恢复到工作台')

  const fallbackPath = '/teacher/dashboard'
  if (route.path !== fallbackPath) {
    router.replace(fallbackPath).catch(() => {})
  }

  window.setTimeout(() => {
    recoveringFromRouteError.value = false
  }, 300)

  return false
})
const activeMenu = computed(() => route.path)
const sidebarVisible = ref(true)
const isMobile = ref(window.innerWidth <= 992)

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const currentRouteName = computed(() => {
  const map = {
    '/teacher/dashboard': '工作台',
    '/teacher/cases': '案例库管理',
    '/teacher/cases/create': '生成案例',
    '/teacher/workflow/design': '工作流编排',
    '/teacher/courses': '课程管理',
    '/teacher/templates': '案例模板库',
    '/teacher/textbooks': '教材管理',
    '/teacher/classes': '班级管理',
    '/teacher/classes/analytics': '班级学情分析',
    '/teacher/tasks': '任务发布',
    '/teacher/grading': '作业批改',
    '/teacher/ai/chat': 'AI 助教',
    '/teacher/ai/knowledge': '知识库管理',
    '/teacher/ai/recycle': '回收站',
    '/teacher/profile': '个人资料',
    '/teacher/change-password': '修改密码'
  }
  return map[route.path] || route.meta?.title || '当前页面'
})

watch(() => route.path, () => {
  applyDocumentTitle(branding.value, currentRouteName.value)
}, { immediate: true })

const currentModeLabel = computed(() => {
  if (route.path.startsWith('/teacher/grading')) {
    return '批改模式'
  }
  if (route.path.startsWith('/teacher/workflow/design')) {
    return '工作流设计模式'
  }
  return '教学模式'
})

const handleResize = () => {
  isMobile.value = window.innerWidth <= 992
  sidebarVisible.value = !isMobile.value
}

onMounted(async () => {
  branding.value = await loadSystemBranding()
  applyDocumentTitle(branding.value, currentRouteName.value)
  if (!getAuthToken('TEACHER')) {
    router.replace('/teacher/login')
    return
  }

  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('avatar-updated', handleAvatarUpdate)

  try {
    const res = await getUserInfo()
    if (res.data && res.data.avatar) {
      avatar.value = res.data.avatar
      syncAvatarToSession(res.data.avatar)
    }
  } catch (e) {
    console.error('获取用户信息失败', e)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('avatar-updated', handleAvatarUpdate)
})

const handleCommand = (command) => {
  if (command === 'profile') {
    router.push('/teacher/profile')
  } else if (command === 'changePassword') {
    router.push('/teacher/change-password')
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      clearAuthSession('TEACHER')
      router.push('/teacher/login')
      ElMessage.success('已退出登录')
    })
  }
}
</script>

<style scoped lang="scss">
.teacher-layout {
  --sidebar-width: 268px;
  --topbar-height: 68px;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 12% 10%, rgba(82, 196, 196, 0.12), transparent 38%),
    radial-gradient(circle at 88% 12%, rgba(64, 158, 255, 0.1), transparent 35%),
    #f3f8fb;
}

.side-nav {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: #ffffff;
  color: #303133;
  display: flex;
  flex-direction: column;
  transform: translateX(0);
  transition: transform 0.34s ease;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
  border-right: 1px solid #f0f2f5;
  z-index: 10;

  .brand {
    height: 78px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    border-bottom: 1px solid #f0f2f5;

    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, #0d9488, #0f766e);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;

      h1 {
        margin: 0;
        font-size: 16px;
        letter-spacing: 0.3px;
        color: #303133;
        font-weight: 600;
      }

      p {
        margin: 2px 0 0;
        font-size: 11px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: #909399;
      }
    }
  }

  .nav-scroll {
    flex: 1;
  }

  :deep(.menu) {
    border-right: 0;
    background: transparent;
    padding: 8px 10px 16px;

    .el-menu-item-group__title {
      color: #909399;
      font-size: 12px;
      padding: 12px 14px 6px;
      font-weight: 600;
      letter-spacing: 0.4px;
    }

    .el-menu-item {
      margin: 4px 0;
      border-radius: 8px;
      height: 42px;
      line-height: 42px;
      color: #606266;
      transition: all 0.25s ease;
      font-size: 13px;

      .el-icon {
        font-size: 17px;
        color: #909399;
        transition: color 0.2s;
      }

      &:hover {
        background: #f5f7fa;
        color: #303133;
      }

      &.is-active {
        color: #0d9488;
        background: #f0fdfa;
        font-weight: 500;
        
        .el-icon {
          color: #0d9488;
        }
      }
    }
  }
}

.sidebar-hidden .side-nav {
  transform: translateX(-105%);
}

.sidebar-mask {
  position: fixed;
  inset: 0;
  background: rgba(13, 38, 58, 0.36);
  backdrop-filter: blur(1px);
  z-index: 8;
  animation: mask-in 0.22s ease;
}

.main-panel {
  margin-left: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.34s ease;
}

.sidebar-hidden .main-panel {
  margin-left: 0;
}

.topbar {
  height: var(--topbar-height);
  margin: 14px 16px 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(183, 217, 230, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 10px;
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(40, 92, 124, 0.08);
  position: relative;
  z-index: 100;

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .menu-btn {
      border: 0;
      background: rgba(74, 164, 230, 0.16);
      color: #1e88d0;
      transition: all 0.24s ease;

      &:hover {
        transform: translateY(-1px);
        background: rgba(74, 164, 230, 0.24);
      }
    }

    :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
      color: #24658d;
      font-weight: 600;
    }
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .mode-tag {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      padding: 0 10px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid #a8d9ef;
      background: #edf8ff;
      color: #2a6f95;
      line-height: 1;

      :deep(.el-tag__content) {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
      }

      .el-icon {
        margin-right: 4px;
      }
    }

    .tag-text {
      margin-left: 4px;
      white-space: nowrap;
    }

    .user-card {
      min-width: 170px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 6px 10px;
      border-radius: 12px;
      cursor: pointer;
      border: 1px solid rgba(183, 217, 230, 0.6);
      background: #f8fcff;
      transition: all 0.26s ease;

      &:hover {
        border-color: #7fc2ea;
        box-shadow: 0 8px 20px rgba(35, 132, 189, 0.12);
      }

      .avatar {
        border: 1px solid #d4ebf8;
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;

        strong {
          color: #204c68;
          font-size: 13px;
          font-weight: 600;
        }

        span {
          color: #5f8ea9;
          font-size: 11px;
        }
      }

      .arrow {
        margin-left: auto;
        color: #6f9db8;
      }
    }
  }
}

.content-shell {
  flex: 1;
  min-height: 0;
  margin: 12px 16px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(183, 217, 230, 0.58);
  box-shadow: 0 12px 28px rgba(37, 102, 139, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.page-container) {
  padding: 18px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}

.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.28s ease;
}

.page-slide-enter-from {
  opacity: 0;
  transform: translate3d(18px, 0, 0);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translate3d(-12px, 0, 0);
}

@keyframes mask-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 992px) {
  .side-nav {
    width: min(82vw, 300px);
  }

  .main-panel {
    margin-left: 0;
  }

  .topbar {
    margin: 10px 10px 0;
    padding-right: 8px;
  }

  .content-shell {
    margin: 10px;
  }

  .topbar-right .user-card {
    min-width: unset;

    .user-meta,
    .arrow {
      display: none;
    }
  }
}

:global(.teacher-user-dropdown-popper) {
  margin-top: 2px !important;
  z-index: 9999 !important;
}
</style>


<style scoped>
.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
