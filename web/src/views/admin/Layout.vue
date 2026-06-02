<template>
  <div class="admin-layout" :class="{ 'sidebar-hidden': !sidebarVisible }">
    <aside class="side-nav">
      <div class="brand">
        <div class="brand-mark">
          <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="logo" class="brand-logo" />
          <el-icon v-else><Monitor /></el-icon>
        </div>
        <div class="brand-text">
          <h1>{{ branding.systemName }}</h1>
          <p>{{ branding.icp || 'Admin Console' }}</p>
        </div>
      </div>

      <el-scrollbar class="nav-scroll">
        <el-menu :default-active="activeMenu" class="menu" router unique-opened>
          <el-menu-item index="/admin/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>控制台</span>
          </el-menu-item>

          <el-menu-item-group title="人员管理">
            <el-menu-item index="/admin/users">
              <el-icon><User /></el-icon>
              <span>学生管理</span>
            </el-menu-item>
            <el-menu-item index="/admin/teachers">
              <el-icon><Avatar /></el-icon>
              <span>教师管理</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="教学教务">
            <el-menu-item index="/admin/courses">
              <el-icon><Reading /></el-icon>
              <span>课程管理</span>
            </el-menu-item>
            <el-menu-item index="/admin/classes">
              <el-icon><School /></el-icon>
              <span>班级管理</span>
            </el-menu-item>
          </el-menu-item-group>

          <el-menu-item-group title="系统维护">
            <el-menu-item index="/admin/logs">
              <el-icon><Document /></el-icon>
              <span>操作日志</span>
            </el-menu-item>
            <el-menu-item index="/admin/monitor">
              <el-icon><DataLine /></el-icon>
              <span>系统监控</span>
            </el-menu-item>
            <el-menu-item index="/admin/token-usage">
              <el-icon><DataAnalysis /></el-icon>
              <span>DeepSeek 用量</span>
            </el-menu-item>
            <el-menu-item index="/admin/system">
              <el-icon><Setting /></el-icon>
              <span>系统配置</span>
            </el-menu-item>
          </el-menu-item-group>
        </el-menu>
      </el-scrollbar>
    </aside>

    <div class="sidebar-mask" v-if="isMobile && sidebarVisible" @click="sidebarVisible = false"></div>

    <section class="main-panel">
      <header class="topbar">
        <div class="topbar-left">
          <el-button class="menu-btn" circle @click="toggleSidebar">
            <el-icon><Operation /></el-icon>
          </el-button>

          <el-breadcrumb separator=">">
            <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="topbar-right">
          <NoticePopover />

          <el-dropdown trigger="click" @command="handleCommand" :teleported="false">
            <div class="user-card">
              <el-avatar
                :size="34"
                class="avatar"
                :src="avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'"
              />
              <div class="user-meta">
                <strong>{{ username }}</strong>
                <span>{{ roleName }}</span>
              </div>
              <el-icon class="arrow"><CaretBottom /></el-icon>
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
        <router-view v-slot="{ Component }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Monitor, Odometer, User, Setting,
  CaretBottom, Avatar, Reading, School, Document,
  DataLine, Operation, DataAnalysis
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getUserInfo } from '@/api/user.js'
import { logout as logoutRequest } from '@/api/common/auth.js'
import { clearAuthSession, getAuthSession, getAuthToken, setAuthSession } from '@/utils/authStorage'
import NoticePopover from './components/NoticePopover.vue'
import { applyDocumentTitle, getDefaultBranding, loadSystemBranding } from '@/utils/systemBranding'

const route = useRoute()
const router = useRouter()
const session = getAuthSession('ADMIN') || {}
const branding = ref(getDefaultBranding())
const avatar = ref(session.avatar || '')
const syncAdminSession = (data = {}) => {
  setAuthSession(data, 'ADMIN')
}
const username = ref(localStorage.getItem('username') || '管理员')
const roleName = ref('Admin')
const sidebarVisible = ref(true)
const isMobile = ref(window.innerWidth <= 992)

const activeMenu = computed(() => route.path)

const currentRouteName = computed(() => {
  const nameMap = {
    '/admin/dashboard': '控制台',
    '/admin/users': '学生管理',
    '/admin/teachers': '教师管理',
    '/admin/courses': '课程管理',
    '/admin/classes': '班级管理',
    '/admin/logs': '操作日志',
    '/admin/monitor': '系统监控',
    '/admin/token-usage': 'DeepSeek 用量',
    '/admin/system': '系统配置',
    '/admin/profile': '个人资料',
    '/admin/change-password': '修改密码',
  }
  return nameMap[route.path] || route.meta?.title || '当前页面'
})

watch(() => route.path, () => {
  applyDocumentTitle(branding.value, currentRouteName.value)
}, { immediate: true })

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 992
  sidebarVisible.value = !isMobile.value
}

onMounted(async () => {
  branding.value = await loadSystemBranding()
  applyDocumentTitle(branding.value, currentRouteName.value)
  if (!getAuthToken('ADMIN')) {
    router.replace('/admin/login')
    return
  }

  try {
    const res = await getUserInfo()
    if (res.data) {
      if (res.data.avatar) {
        avatar.value = res.data.avatar
        syncAdminSession({ avatar: res.data.avatar })
      }
      if (res.data.username) {
        username.value = res.data.username
        syncAdminSession({ username: res.data.username })
      }
      const roleRaw = res.data.roleName || res.data.role
      if (roleRaw) {
        const roleMap = {
          ADMIN: '管理员',
          TEACHER: '教师',
          STUDENT: '学生',
        }
        roleName.value = roleMap[roleRaw] || roleRaw
      }
    }
  } catch (e) {
    console.error('failed to load user info', e)
  }

  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const handleCommand = (command) => {
  if (command === 'profile') {
    router.push('/admin/profile')
    return
  }

  if (command === 'changePassword') {
    router.push('/admin/change-password')
    return
  }

  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(async () => {
      try {
        await logoutRequest()
      } catch (e) {
        console.warn('logout request failed', e)
      }
      clearAuthSession('ADMIN')
      ElMessage.success('已安全退出')
      router.push('/admin/login')
    }).catch(() => {})
  }
}
</script>

<style scoped lang="scss">
.admin-layout {
  --sidebar-width: 268px;
  --topbar-height: 68px;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 8% 12%, rgba(74, 170, 230, 0.12), transparent 35%),
    radial-gradient(circle at 90% 16%, rgba(100, 200, 190, 0.1), transparent 34%),
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
  transition: transform 0.34s ease;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
  border-right: 1px solid #f0f2f5;
  z-index: 10;

  .brand {
    height: 78px;
    display: flex;
    align-items: center;
    padding: 0 18px;
    gap: 12px;
    border-bottom: 1px solid #f0f2f5;

    .brand-mark {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #409eff, #2d8cf0);
      border-radius: 8px;
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
        color: #303133;
        letter-spacing: 0.3px;
        font-weight: 600;
      }

      p {
        margin: 2px 0 0;
        font-size: 12px;
        color: #909399;
        text-transform: uppercase;
      }
    }
  }

  .nav-scroll {
    flex: 1;
  }

  :deep(.menu) {
    border-right: none;
    padding: 10px;
    background: transparent;

    .el-menu-item-group__title {
      padding: 12px 14px 6px;
      font-size: 12px;
      color: #909399;
      font-weight: 600;
    }

    .el-menu-item {
      height: 42px;
      line-height: 42px;
      margin: 4px 0;
      border-radius: 8px;
      color: #606266;
      transition: all 0.24s ease;

      &:hover {
        background-color: #f5f7fa;
        color: #303133;
      }

      &.is-active {
        background: #ecf5ff;
        color: #409eff;
        font-weight: 500;

        .el-icon {
          color: #409eff;
        }
      }

      .el-icon {
        font-size: 18px;
        color: #909399;
        transition: color 0.2s;
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
  background: rgba(13, 45, 67, 0.33);
  z-index: 8;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 10px;
  box-shadow: 0 8px 24px rgba(34, 98, 132, 0.08);

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .menu-btn {
      border: 0;
      background: rgba(74, 164, 230, 0.16);
      color: #1e88d0;
    }
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .user-card {
      min-width: 178px;
      display: flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 12px;
      background: #f8fcff;
      border: 1px solid rgba(183, 217, 230, 0.65);

      .avatar {
        border: 1px solid #d8ecf8;
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;

        strong {
          font-size: 13px;
          color: #214f6d;
          font-weight: 600;
        }

        span {
          font-size: 11px;
          color: #6d97b1;
        }
      }

      .arrow {
        margin-left: auto;
        color: #7ea6be;
      }
    }
  }
}

.content-shell {
  flex: 1;
  margin: 12px 16px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(183, 217, 230, 0.58);
  box-shadow: 0 12px 28px rgba(33, 93, 127, 0.08);
  overflow-y: auto;
}

:deep(.page-container) {
  padding: 18px;
  min-height: 100%;
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

@media (max-width: 992px) {
  .side-nav {
    width: min(82vw, 300px);
  }

  .main-panel {
    margin-left: 0;
  }

  .topbar {
    margin: 10px 10px 0;
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
</style>


<style scoped>
.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
