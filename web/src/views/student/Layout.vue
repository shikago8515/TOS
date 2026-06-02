<template>
  <div class="student-layout" :class="{ 'sidebar-hidden': !sidebarVisible }">
    <aside class="side-nav">
      <div class="brand">
        <div class="brand-mark">
          <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="logo" class="brand-logo" />
          <el-icon v-else><Reading /></el-icon>
        </div>
        <div class="brand-text">
          <h1>{{ branding.systemName }}</h1>
          <p>{{ branding.icp || 'Student Portal' }}</p>
        </div>
      </div>

      <el-scrollbar class="nav-scroll">
        <el-menu :default-active="activeMenu" class="menu" router>
          <el-menu-item index="/student/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>学习概览</span>
          </el-menu-item>
          <el-menu-item index="/student/tasks">
            <el-icon><List /></el-icon>
            <span>我的任务</span>
          </el-menu-item>
          <el-menu-item index="/student/task-pool">
            <el-icon><Grid /></el-icon>
            <span>任务广场</span>
          </el-menu-item>
          <el-menu-item index="/student/submissions">
            <el-icon><Files /></el-icon>
            <span>提交记录</span>
          </el-menu-item>
          <el-menu-item index="/student/report">
            <el-icon><Document /></el-icon>
            <span>个人实训报告</span>
          </el-menu-item>
          <el-menu-item index="/student/ai/chat">
            <el-icon><Service /></el-icon>
            <span>AI 助教</span>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>

      <div class="nav-footer">
        <div class="progress-card">
          <div class="progress-label">
            <span>本周学习进度</span>
            <span>{{ progressStats.completed }}/{{ progressStats.total }}</span>
          </div>
          <el-progress :percentage="progress" :stroke-width="8" :color="customColor" />
        </div>
      </div>
    </aside>

    <div class="sidebar-mask" v-if="isMobile && sidebarVisible" @click="sidebarVisible = false"></div>

    <section class="main-panel">
      <header class="topbar">
        <div class="topbar-left">
          <el-button class="menu-btn" circle @click="toggleSidebar">
            <el-icon><Operation /></el-icon>
          </el-button>

          <el-breadcrumb separator=">">
            <el-breadcrumb-item :to="{ path: '/student/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="topbar-right">
          <el-tag effect="light" :type="pageStatus.type" round class="status-tag">
            <el-icon><component :is="pageStatus.icon" /></el-icon>
            <span class="tag-text">{{ pageStatus.text }}</span>
          </el-tag>

          <el-dropdown trigger="click" @command="handleCommand" :teleported="false">
            <div class="user-card">
              <el-avatar :size="34" class="avatar" :src="avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'" />
              <div class="user-meta">
                <strong>{{ username }}</strong>
                <span>学生账号</span>
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
        <router-view v-slot="{ Component }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </section>

    <!-- 强制修改密码弹窗 (美化版) -->
    <el-dialog
      v-model="forceChangePwdVisible"
      width="460px"
      :teleported="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="modern-dialog force-pwd-dialog"
      align-center
    >
      <template #header>
        <div class="dialog-header warning">
          <div class="header-icon">
            <el-icon><Lock /></el-icon>
          </div>
          <span class="header-title">安全提示</span>
        </div>
      </template>

      <div class="dialog-body">
        <div class="security-alert">
          <el-icon class="alert-icon"><Warning /></el-icon>
          <div class="alert-content">
            <div class="alert-title">首次登录需修改密码</div>
            <div class="alert-desc">为了保障您的账号安全，请修改初始密码后继续使用。</div>
          </div>
        </div>

        <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-position="top" class="modern-form">
          <el-form-item label="当前密码" prop="oldPassword">
            <el-input 
              v-model="pwdForm.oldPassword" 
              type="password" 
              show-password 
              placeholder="请输入当前密码" 
              size="large"
            >
              <template #prefix><el-icon><Key /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input 
              v-model="pwdForm.newPassword" 
              type="password" 
              show-password 
              placeholder="设置新密码（至少6位）" 
              size="large"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input 
              v-model="pwdForm.confirmPassword" 
              type="password" 
              show-password 
              placeholder="再次输入新密码" 
              size="large"
            >
              <template #prefix><el-icon><CircleCheck /></el-icon></template>
            </el-input>
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <div class="dialog-footer full-width">
          <el-button 
            type="primary" 
            @click="handleForceUpdatePwd" 
            :loading="pwdLoading" 
            size="large" 
            class="confirm-btn block"
          >
            确认修改并登录
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Reading, Odometer, List, Grid,
  Files, Service, Key, Document,
  Lock, Warning, CircleCheck,
  Operation, ArrowDown, Promotion
} from '@element-plus/icons-vue'
import { getUserInfo, updatePassword } from '@/api/user'
import { getMyTaskStats } from '@/api/student/task'
import { clearAuthSession, getAuthSession, getAuthToken, setAuthSession } from '@/utils/authStorage'
import { applyDocumentTitle, getDefaultBranding, loadSystemBranding } from '@/utils/systemBranding'

const router = useRouter()
const route = useRoute()
const session = getAuthSession('STUDENT') || {}
const branding = ref(getDefaultBranding())
const username = ref(session.username || localStorage.getItem('username') || '同学')
const avatar = ref(session.avatar || '')
const syncAvatarToSession = (nextAvatar) => {
  setAuthSession({ avatar: nextAvatar || '' }, 'STUDENT')
}
const handleAvatarUpdate = (e) => {
  const newAvatar = e.detail?.avatar || ''
  avatar.value = newAvatar
  syncAvatarToSession(newAvatar ? newAvatar.split('?')[0] : '')
}
const activeMenu = computed(() => route.path)
const customColor = '#10b981'
const progress = ref(0)
const progressStats = ref({ total: 0, completed: 0 })
const sidebarVisible = ref(true)
const isMobile = ref(window.innerWidth <= 992)

const currentRouteName = computed(() => {
  const map = {
    '/student/dashboard': '学习概览',
    '/student/tasks': '我的任务',
    '/student/task-pool': '任务广场',
    '/student/submissions': '提交记录',
    '/student/report': '个人实训报告',
    '/student/ai/chat': 'AI 助教',
    '/student/profile': '个人资料',
    '/student/change-password': '修改密码'
  }
  return map[route.path] || route.meta?.title || '当前页面'
})

watch(() => route.path, () => {
  applyDocumentTitle(branding.value, currentRouteName.value)
}, { immediate: true })

const pageStatus = computed(() => {
  const path = route.path
  if (path.includes('/ai/chat')) {
    return { text: 'AI 协作', type: 'warning', icon: Service }
  }
  if (path.includes('/task-pool')) {
    return { text: '探索任务', type: 'primary', icon: Grid }
  }
  if (path.includes('/tasks')) {
    return { text: '任务挑战', type: 'primary', icon: List }
  }
  if (path.includes('/submissions')) {
    return { text: '回顾记录', type: 'info', icon: Files }
  }
  if (path.includes('/profile') || path.includes('/password')) {
    return { text: '账户设置', type: 'info', icon: Key }
  }
  return { text: '学习中', type: 'success', icon: Promotion }
})

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 992
  sidebarVisible.value = !isMobile.value
}

// 强制修改密码相关
const forceChangePwdVisible = ref(false)
const pwdLoading = ref(false)
const pwdFormRef = ref(null)
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validatePass2 = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== pwdForm.newPassword) {
    callback(new Error('两次输入密码不一致!'))
  } else {
    callback()
  }
}

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validatePass2, trigger: 'blur' }]
}

const checkFirstLogin = async () => {
  try {
    const res = await getUserInfo()
    if (res.data) {
      if (res.data.avatar) {
        avatar.value = res.data.avatar
        syncAvatarToSession(res.data.avatar)
      }
      // 假设后端返回 firstLogin 字段，如果为 true 则强制修改密码
      if (res.data.firstLogin) {
        forceChangePwdVisible.value = true
      }
    }
  } catch (e) {
    console.error('获取用户信息失败', e)
  }
}

const loadProgress = async () => {
  try {
    const res = await getMyTaskStats()
    if (res.code === 200) {
      progress.value = res.data.progress || 0
      progressStats.value = {
        total: res.data.total || 0,
        completed: res.data.completed || 0
      }
    }
  } catch (e) {
    console.error('获取学习进度失败', e)
  }
}

const handleForceUpdatePwd = async () => {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (valid) => {
    if (valid) {
      pwdLoading.value = true
      try {
        await updatePassword({
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword
        })
        ElMessage.success('密码修改成功，请继续使用')
        forceChangePwdVisible.value = false
      } catch (e) {
        ElMessage.error(e.message || '修改失败')
      } finally {
        pwdLoading.value = false
      }
    }
  })
}

onMounted(async () => {
  branding.value = await loadSystemBranding()
  applyDocumentTitle(branding.value, currentRouteName.value)

  if (!getAuthToken('STUDENT')) {
    router.replace('/student/login')
    return
  }

  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('avatar-updated', handleAvatarUpdate)
  checkFirstLogin()
  loadProgress()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('avatar-updated', handleAvatarUpdate)
})

const handleCommand = (command) => {
  if (command === 'profile') {
    router.push('/student/profile')
  } else if (command === 'changePassword') {
    router.push('/student/change-password')
  } else if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      clearAuthSession('STUDENT')
      router.push('/student/login')
      ElMessage.success('已退出登录')
    })
  }
}
</script>

<style scoped lang="scss">
.student-layout {
  --sidebar-width: 262px;
  --topbar-height: 68px;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 12% 10%, rgba(79, 203, 161, 0.12), transparent 36%),
    radial-gradient(circle at 84% 16%, rgba(79, 164, 235, 0.1), transparent 32%),
    #f1f9f6;
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
    gap: 12px;
    padding: 0 16px;
    border-bottom: 1px solid #f0f2f5;

    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
      font-size: 18px;
    }

    .brand-text {
      h1 {
        margin: 0;
        font-size: 16px;
        color: #303133;
        letter-spacing: 0.3px;
        font-weight: 600;
      }

      p {
        margin: 2px 0 0;
        font-size: 11px;
        color: #909399;
        text-transform: uppercase;
      }
    }
  }

  .nav-scroll {
    flex: 1;
  }

  :deep(.menu) {
    border-right: 0;
    background: transparent;
    padding: 10px;

    .el-menu-item {
      margin: 4px 0;
      height: 42px;
      line-height: 42px;
      border-radius: 8px;
      color: #606266;
      transition: all 0.24s ease;

      .el-icon {
        font-size: 18px;
        color: #909399;
        transition: color 0.2s;
      }

      &:hover {
        background: #f5f7fa;
        color: #303133;
      }

      &.is-active {
        background: #ecfdf5;
        color: #10b981;
        font-weight: 500;
        
        .el-icon {
          color: #10b981;
        }
      }
    }
  }

  .nav-footer {
    padding: 16px;

    .progress-card {
      background: #f8fafc;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #f1f5f9;

      .progress-label {
        font-size: 12px;
        color: #606266;
        margin-bottom: 10px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
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
  background: rgba(15, 63, 78, 0.3);
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
  border: 1px solid rgba(180, 225, 219, 0.7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 10px;
  box-shadow: 0 8px 24px rgba(30, 108, 102, 0.08);

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .menu-btn {
      border: 0;
      background: rgba(76, 182, 153, 0.16);
      color: #129f8a;
    }
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .status-tag {
      :deep(.el-tag__content) {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    .tag-text {
      margin-left: 0;
      /* 稍微调整文字位置以实现视觉完美对齐 */
      position: relative;
      top: 0.5px; 
    }

    .user-card {
      min-width: 170px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 6px 10px;
      border-radius: 12px;
      border: 1px solid rgba(175, 220, 214, 0.75);
      background: #f7fffc;
      cursor: pointer;

      .avatar {
        border: 1px solid #d2ebe4;
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;

        strong {
          color: #1d5f5e;
          font-size: 13px;
        }

        span {
          color: #5a8d92;
          font-size: 11px;
        }
      }

      .arrow {
        margin-left: auto;
        color: #79a9ac;
      }
    }
  }
}

.content-shell {
  flex: 1;
  min-height: 0;
  margin: 12px 16px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(180, 225, 219, 0.62);
  box-shadow: 0 12px 28px rgba(28, 104, 104, 0.08);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.page-container) {
  padding: 18px;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
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

/* 现代化弹窗通用样式 */
.modern-dialog {
  border-radius: 16px;
  overflow: hidden;
  
  :deep(.el-dialog__header) {
    margin: 0;
    padding: 0;
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
  }
  
  :deep(.el-dialog__footer) {
    padding: 20px 24px;
    border-top: 1px solid #f1f5f9;
  }
}

.dialog-header {
  padding: 20px 24px;
  background: linear-gradient(to right, #f8fafc, #fff);
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 12px;

  &.warning {
    background: #fff7ed;
    .header-icon {
      background: #ffedd5;
      color: #f97316;
    }
    .header-title {
      color: #9a3412;
    }
  }

  .header-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #ecfdf5;
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }
}

.dialog-body {
  padding: 24px;

  .dialog-desc {
    margin: 0 0 20px 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  }
}

.modern-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: #475569;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #e2e8f0 inset;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #cbd5e1 inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 2px #10b981 inset !important;
    }
  }

  .input-icon {
    color: #94a3b8;
    font-size: 16px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  &.full-width {
    width: 100%;
    .block {
      width: 100%;
    }
  }

  .confirm-btn {
    border-radius: 8px;
    padding: 10px 24px;
    background: #10b981;
    border-color: #10b981;
    font-weight: 500;
    
    &:hover {
      background: #059669;
      border-color: #059669;
    }
  }
}

/* 安全警告样式 */
.security-alert {
  background: #fff7ed;
  border: 1px solid #ffedd5;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 24px;

  .alert-icon {
    font-size: 20px;
    color: #f97316;
    margin-top: 2px;
  }

  .alert-content {
    .alert-title {
      font-weight: 600;
      color: #9a3412;
      margin-bottom: 4px;
    }
    .alert-desc {
      font-size: 13px;
      color: #c2410c;
      line-height: 1.4;
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
