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
              <el-icon v-else :size="28"><Reading /></el-icon>
            </div>
            <span class="app-name">{{ branding.systemName }}</span>
          </div>
          
          <div class="slogan-group">
            <h1 class="main-title">开启<br>学习之旅</h1>
            <p class="sub-title">沉浸式实训学习体验</p>
          </div>

          <div class="illustration">
            <!-- 抽象火箭/目标图形 -->
            <div class="rocket-group">
              <div class="rocket-body"></div>
              <div class="rocket-fin"></div>
              <div class="rocket-window"></div>
              <div class="rocket-flame"></div>
            </div>
            <div class="stars">
              <div class="star star-1"></div>
              <div class="star star-2"></div>
              <div class="star star-3"></div>
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
                <h2>学生登录</h2>
                <p>准备好开始今天的学习了吗？</p>
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
                    placeholder="学号 / 邮箱"
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
                  开始学习
                  <el-icon class="el-icon--right"><Right /></el-icon>
                </el-button>

                <div class="demo-account">
                  已有账号密码：student / 123456lcp
                </div>

                <div class="register-hint">
                  还没有账号？ <span class="link">联系管理员</span>
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
import { User, Lock, Reading, Right, Message, Key, Back, RefreshRight } from '@element-plus/icons-vue'
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
  username: [{ required: true, message: '请输入学号', trigger: 'blur' }],
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
  applyDocumentTitle(branding.value, 'Student Login')
  await loadCaptcha()
})

onMounted(() => {
  const username = localStorage.getItem('student_remember_username')
  const password = localStorage.getItem('student_remember_password')
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
        
        if (res.data.roleName !== 'STUDENT') {
          await loadCaptcha()
          ElMessage.error('权限不足：非学生账号')
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
          role: 'STUDENT'
        }, 'STUDENT')
        
        if (rememberMe.value) {
          localStorage.setItem('student_remember_username', window.btoa(form.username))
          localStorage.setItem('student_remember_password', window.btoa(form.password))
        } else {
          localStorage.removeItem('student_remember_username')
          localStorage.removeItem('student_remember_password')
        }

        ElMessage.success('登录成功')
        router.push('/student/dashboard')
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
/* 学生端主题色：清新蓝青 (Fresh Blue-Teal) */
$primary-color: #2ea6d8;
$primary-hover: #1f8fc0;
$bg-gradient: linear-gradient(135deg, #2ea6d8 0%, #19b08f 100%);
$text-main: #1e4e69;
$text-sub: #6b7280; /* Gray-500 */

.login-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #eef8fc;
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
  .shape-1 { width: 400px; height: 400px; background: #9cd8f0; top: -100px; right: -100px; animation: float 15s infinite; }
  .shape-2 { width: 300px; height: 300px; background: #a7ead9; bottom: -50px; left: -50px; animation: float 20s infinite reverse; }
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
  box-shadow: 0 20px 40px -12px rgba(46, 166, 216, 0.16);
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

    .rocket-group {
      position: relative;
      width: 100px; height: 100px;
      transform: rotate(45deg);
      animation: float 4s ease-in-out infinite;

      .rocket-body {
        width: 40px; height: 100px;
        background: #fff;
        border-radius: 50% 50% 10px 10px;
        position: absolute; left: 30px;
      }
      .rocket-window {
        width: 16px; height: 16px;
        background: #2ea6d8;
        border-radius: 50%;
        position: absolute; top: 25px; left: 42px;
        border: 2px solid #bfe6f4;
      }
      .rocket-fin {
        width: 100px; height: 30px;
        background: #55c3e9;
        position: absolute; bottom: 0;
        border-radius: 50%;
        z-index: -1;
      }
      .rocket-flame {
        width: 20px; height: 40px;
        background: #fcd34d;
        position: absolute; bottom: -30px; left: 40px;
        border-radius: 0 0 50% 50%;
        animation: flame 0.5s infinite alternate;
      }
    }

    .stars {
      .star {
        position: absolute; width: 4px; height: 4px; background: #fff; border-radius: 50%;
        animation: twinkle 2s infinite;
      }
      .star-1 { top: 20%; left: 20%; }
      .star-2 { top: 60%; right: 20%; animation-delay: 1s; }
      .star-3 { bottom: 30%; left: 30%; animation-delay: 0.5s; }
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
    background: #edf8fd;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 12px;
    transition: all 0.3s;
    &:hover { background: #e0f3fb; }
    &.is-focus {
      background: #fff;
      border-color: $primary-color;
      box-shadow: 0 0 0 3px rgba(46, 166, 216, 0.12);
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

  .register-hint {
    margin-top: 24px; text-align: center;
    color: $text-sub; font-size: 13px;
    .link { color: $primary-color; font-weight: 600; cursor: pointer; }
  }

  .code-input-group {
    display: flex; gap: 12px;
    .code-btn {
      width: 110px;
      background: #fff;
      border-color: $primary-color;
      color: $primary-color;
      &:hover { background: #edf8fd; }
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
  0%, 100% { transform: translate(0, 0) rotate(45deg); }
  50% { transform: translate(10px, -10px) rotate(45deg); }
}

@keyframes flame {
  from { height: 40px; opacity: 1; }
  to { height: 30px; opacity: 0.8; }
}

@keyframes twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
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
