<template>
  <div class="login-wrapper">
    <!-- 背景装饰 -->
    <div class="bg-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <div class="login-box">
      <!-- 左侧：品牌与视觉 -->
      <div class="visual-side">
        <div class="brand-content">
          <div class="logo-group">
            <div class="logo-icon">
              <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="logo" class="brand-logo" />
              <el-icon v-else :size="28"><School /></el-icon>
            </div>
            <span class="app-name">{{ branding.systemName }}</span>
          </div>
          
          <div class="slogan-group">
            <h1 class="main-title">赋能<br>教育创新</h1>
            <p class="sub-title">专业的实训教学管理工作台</p>
          </div>

          <div class="illustration">
            <!-- 抽象书籍/图表图形 -->
            <div class="book-stack">
              <div class="book book-1"></div>
              <div class="book book-2"></div>
              <div class="book book-3"></div>
            </div>
            <div class="floating-chart">
              <div class="chart-bar bar-1"></div>
              <div class="chart-bar bar-2"></div>
              <div class="chart-bar bar-3"></div>
            </div>
          </div>
          
          <div class="copyright">{{ branding.icp || 'Copyright 2025 Intelligent Training System' }}</div>
        </div>
      </div>

      <!-- 右侧：表单交互 -->
      <div class="form-side">
        <div class="form-wrapper">
          <transition name="fade-slide" mode="out-in">
            <!-- 登录表单 -->
            <div v-if="isLogin" key="login" class="auth-view">
              <div class="view-header">
                <h2>教师登录</h2>
                <p>欢迎回到教学工作台</p>
              </div>

              <el-form 
                ref="formRef"
                :model="form"
                :rules="rules"
                class="custom-form"
                size="large"
                @keyup.enter="handleLogin"
              >
                <el-form-item prop="username">
                  <el-input 
                    v-model="form.username" 
                    placeholder="工号 / 邮箱"
                    :prefix-icon="User"
                  />
                </el-form-item>
                
                <el-form-item prop="password">
                  <el-input 
                    v-model="form.password" 
                    type="password" 
                    placeholder="密码"
                    show-password
                    :prefix-icon="Lock"
                  />

                </el-form-item>

                <el-form-item prop="captchaCode">
                  <div class="captcha-row">
                    <el-input 
                      v-model="form.captchaCode" 
                      placeholder="请输入验证码"
                      maxlength="4"
                      :prefix-icon="Key"
                    />
                    <button type="button" class="captcha-box" @click="loadCaptcha">
                      <img v-if="captchaImage" :src="captchaImage" alt="captcha" class="captcha-image" />
                      <span v-else class="captcha-placeholder">加载中</span>
                    </button>
                    <el-button class="refresh-btn" @click="loadCaptcha">
                      <el-icon><RefreshRight /></el-icon>
                    </el-button>
                  </div>
                </el-form-item>

                <div class="form-actions">
                  <el-checkbox v-model="rememberMe">记住我</el-checkbox>
                  <span class="forgot-link" @click="isLogin = false">忘记密码？</span>
                </div>

                <el-button 
                  type="primary" 
                  class="submit-btn" 
                  :loading="loading"
                  @click="handleLogin"
                >
                  登录工作台
                  <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>

                <div class="demo-account">
                  已有账号密码：teacher / 123456lcp
                </div>

                <div class="support-info">
                  <el-icon><Service /></el-icon>
                  <span>遇到问题？联系技术支持</span>
                </div>
              </el-form>
            </div>

            <!-- 重置密码表单 -->
            <div v-else key="reset" class="auth-view">
              <div class="view-header">
                <h2>重置密码</h2>
                <p>通过邮箱验证重置您的密码</p>
              </div>

              <el-form 
                ref="resetFormRef"
                :model="resetForm"
                :rules="resetRules"
                class="custom-form"
                size="large"
              >
                <el-form-item prop="username">
                  <el-input
                    v-model="resetForm.username"
                    placeholder="请输入账号"
                    :prefix-icon="User"
                  />
                </el-form-item>

                <el-form-item prop="email">
                  <el-input 
                    v-model="resetForm.email" 
                    placeholder="请输入注册邮箱"
                    :prefix-icon="Message"
                  />
                </el-form-item>
                
                <el-form-item prop="code">
                  <div class="code-input-group">
                    <el-input 
                      v-model="resetForm.code" 
                      placeholder="验证码"
                      :prefix-icon="Key"
                    />
                    <el-button 
                      class="code-btn" 
                      :disabled="!!countdown"
                      @click="handleSendCode"
                    >
                      {{ countdown ? `${countdown}s后重试` : '获取验证码' }}
                    </el-button>
                  </div>
                </el-form-item>

                <el-form-item prop="newPassword">
                  <el-input 
                    v-model="resetForm.newPassword" 
                    type="password" 
                    placeholder="新密码"
                    show-password
                    :prefix-icon="Lock"
                  />
                </el-form-item>

                <el-button 
                  type="primary" 
                  class="submit-btn" 
                  :loading="loading"
                  @click="handleReset"
                >
                  确认重置
                </el-button>

                <div class="form-actions center">
                  <span class="back-link" @click="isLogin = true">
                    <el-icon><Back /></el-icon> 返回登录
                  </span>
                </div>
              </el-form>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, School, Service, ArrowRight, Message, Key, Back, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getLoginCaptcha, login, sendResetCode, verifyResetCode, resetPassword } from '@/api/common/auth'
import { setAuthSession } from '@/utils/authStorage'
import { applyDocumentTitle, getDefaultBranding, loadSystemBranding } from '@/utils/systemBranding'

const router = useRouter()
const branding = ref(getDefaultBranding())
const loading = ref(false)
const rememberMe = ref(false)
const isLogin = ref(true)
const countdown = ref(0)
const captchaImage = ref('')

// 登录相关
const formRef = ref(null)
const form = reactive({
  username: '',
  password: '',
  captchaId: '',
  captchaCode: ''
})
const rules = {
  username: [{ required: true, message: '请输入工号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaCode: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

const loadCaptcha = async () => {
  try {
    const res = await getLoginCaptcha()
    form.captchaId = res.data.captchaId
    form.captchaCode = ''
    captchaImage.value = res.data.imageBase64
  } catch (error) {
    captchaImage.value = ''
    ElMessage.error(error.message || '验证码加载失败')
  }
}

onMounted(async () => {
  branding.value = await loadSystemBranding()
  applyDocumentTitle(branding.value, 'Teacher Login')
  await loadCaptcha()
})

onMounted(() => {
  const username = localStorage.getItem('teacher_remember_username')
  const password = localStorage.getItem('teacher_remember_password')
  if (username && password) {
    try {
      form.username = window.atob(username)
      form.password = window.atob(password)
      rememberMe.value = true
    } catch (e) {
      console.error('Failed to decode remembered credentials', e)
    }
  }
})

// 重置密码相关
const resetFormRef = ref(null)
const resetForm = reactive({
  username: '',
  email: '',
  code: '',
  newPassword: ''
})
const resetRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const res = await login(form)
        
        if (res.data.roleName !== 'TEACHER') {
          await loadCaptcha()
          ElMessage.error('权限不足：非教师账号')
          return
        }
        
        setAuthSession({
          token: res.data.token,
          userId: res.data.userId,
          username: res.data.username,
          realName: res.data.realName,
          avatar: '',
          roleId: res.data.roleId,
          roleName: res.data.roleName,
          role: 'TEACHER'
        }, 'TEACHER')
        
        if (rememberMe.value) {
          localStorage.setItem('teacher_remember_username', window.btoa(form.username))
          localStorage.setItem('teacher_remember_password', window.btoa(form.password))
        } else {
          localStorage.removeItem('teacher_remember_username')
          localStorage.removeItem('teacher_remember_password')
        }

        ElMessage.success('登录成功')
        router.push('/teacher/dashboard')
      } catch (error) {
        ElMessage.error(error.message || '登录失败')
      } finally {
        loading.value = false
      }
    }
  })
}

const handleSendCode = async () => {
  if (!resetForm.username || !resetForm.email) {
    ElMessage.warning('请先输入账号和邮箱')
    return
  }
  try {
    await sendResetCode({
      username: resetForm.username,
      email: resetForm.email
    })
    ElMessage.success('验证码已发送')
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (error) {
    ElMessage.error(error.message || '发送失败')
  }
}

const handleReset = async () => {
  if (!resetFormRef.value) return
  await resetFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await verifyResetCode({
          username: resetForm.username,
          email: resetForm.email,
          verificationCode: resetForm.code
        })

        await resetPassword({
          username: resetForm.username,
          email: resetForm.email,
          newPassword: resetForm.newPassword
        })
        ElMessage.success('密码重置成功，请登录')
        isLogin.value = true
      } catch (error) {
        ElMessage.error(error.message || '重置失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped lang="scss">
/* 教师端主题色：青色/蓝绿色 */
$primary-color: #0d9488; /* Teal-600 */
$primary-hover: #0f766e; /* Teal-700 */
$bg-gradient: linear-gradient(135deg, #115e59 0%, #042f2e 100%);
$text-main: #134e4a;
$text-sub: #64748b;

.login-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #f0fdfa; /* Teal-50 */
  position: relative;
  overflow: hidden;
}

.bg-shapes {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  
  .shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.5;
  }
  .shape-1 { width: 400px; height: 400px; background: #5eead4; top: -100px; left: -100px; animation: float 15s infinite; }
  .shape-2 { width: 300px; height: 300px; background: #99f6e4; bottom: -50px; right: -50px; animation: float 20s infinite reverse; }
}

.login-box {
  position: relative;
  z-index: 1;
  display: flex;
  width: 1000px;
  height: 600px;
  margin: auto;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 40px -12px rgba(13, 148, 136, 0.15);
  overflow: hidden;
}

.visual-side {
  flex: 0 0 45%;
  background: $bg-gradient;
  padding: 50px;
  color: #fff;
  position: relative;
  overflow: hidden;

  .brand-content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .logo-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 40px;
    .logo-icon {
      width: 36px; height: 36px;
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .app-name { font-size: 18px; font-weight: 600; }
  }

  .slogan-group {
    .main-title {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 12px;
      line-height: 1.2;
    }
    .sub-title { opacity: 0.8; font-size: 14px; }
  }

  .illustration {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .book-stack {
      position: relative;
      .book {
        width: 120px; height: 160px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px 12px 12px 4px;
        position: absolute;
        left: 50%; top: 50%;
        transform-origin: left center;
        backdrop-filter: blur(5px);
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
      }
      .book-1 { transform: translate(-60px, -80px) rotate(-10deg); background: rgba(255,255,255,0.15); }
      .book-2 { transform: translate(-60px, -80px) rotate(0deg); background: rgba(255,255,255,0.1); }
      .book-3 { transform: translate(-60px, -80px) rotate(10deg); background: rgba(255,255,255,0.05); }
    }

    .floating-chart {
      position: absolute;
      right: 20px; bottom: 60px;
      display: flex; gap: 8px; align-items: flex-end;
      
      .chart-bar {
        width: 12px; background: #2dd4bf;
        border-radius: 4px;
        animation: grow 3s infinite ease-in-out;
        opacity: 0.8;
      }
      .bar-1 { height: 40px; animation-delay: 0s; }
      .bar-2 { height: 70px; animation-delay: 0.2s; }
      .bar-3 { height: 50px; animation-delay: 0.4s; }
    }
  }

  .copyright { font-size: 12px; opacity: 0.5; }
}

.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.form-wrapper { width: 100%; max-width: 360px; }

.view-header {
  margin-bottom: 30px;
  h2 { font-size: 26px; color: $text-main; margin: 0 0 8px; }
  p { color: $text-sub; font-size: 14px; }
}

.custom-form {
  :deep(.el-input__wrapper) {
    box-shadow: none;
    background: #f0fdfa;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 12px;
    transition: all 0.3s;
    &:hover { background: #ccfbf1; }
    &.is-focus {
      background: #fff;
      border-color: $primary-color;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
    }
  }
  
  .form-actions {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px; font-size: 13px;
    .forgot-link { color: $primary-color; cursor: pointer; }
    &.center { justify-content: center; margin-top: 16px; }
    .back-link { 
      color: $text-sub; cursor: pointer; display: flex; align-items: center; gap: 4px;
      &:hover { color: $primary-color; }
    }
  }

  .submit-btn {
    width: 100%; height: 44px;
    font-size: 16px; border-radius: 8px;
    background: $primary-color; border: none;
    &:hover { background: $primary-hover; transform: translateY(-1px); }
  }

  .demo-account {
    margin-top: 16px;
    text-align: center;
    color: $text-sub;
    font-size: 13px;
  }

  .support-info {
    margin-top: 24px; text-align: center;
    color: $text-sub; font-size: 13px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }

  .code-input-group {
    display: flex; gap: 12px;
    .code-btn {
      width: 110px;
      background: #fff;
      border-color: $primary-color;
      color: $primary-color;
      &:hover { background: #f0fdfa; }
      &.is-disabled { background: #f3f4f6; border-color: #e5e7eb; color: #9ca3af; }
    }
  }
}

/* 动画效果 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -20px); }
}

@keyframes grow {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.2); }
}
</style>


<style scoped>
.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.captcha-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px 44px;
  gap: 12px;
  align-items: center;
}

.captcha-box {
  height: 44px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  padding: 0;
}

.captcha-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.captcha-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 12px;
}

.refresh-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 8px;
}
</style>
