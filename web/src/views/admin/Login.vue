<template>
  <div class="login-wrapper">
    <!-- 背景装饰 -->
    <div class="bg-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="login-box">
      <!-- 左侧：品牌与视觉 -->
      <div class="visual-side">
        <div class="brand-content">
          <div class="logo-group">
            <div class="logo-icon">
              <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="logo" class="brand-logo" />
              <el-icon v-else :size="28"><Monitor /></el-icon>
            </div>
            <span class="app-name">{{ branding.systemName }}</span>
          </div>
          
          <div class="slogan-group">
            <h1 class="main-title">新一代<br>虚拟实训教学管理</h1>
            <p class="sub-title">高效 · 智能 · 易用的后台管理解决方案</p>
          </div>

          <div class="illustration">
            <!-- CSS 绘制的抽象科技图形 -->
            <div class="tech-circle">
              <div class="inner-ring"></div>
              <div class="dot"></div>
            </div>
            <div class="glass-card">
              <div class="card-line"></div>
              <div class="card-line short"></div>
              <div class="card-stat">
                <div class="stat-bar"></div>
                <div class="stat-bar"></div>
                <div class="stat-bar"></div>
              </div>
            </div>
          </div>
          
          <div class="copyright">{{ branding.icp || 'Copyright 2025 Intelligent Training System' }}</div>
        </div>
      </div>

      <!-- 右侧：表单交互 -->
      <div class="form-side">
        <div class="form-wrapper">
          <transition name="fade-scale" mode="out-in">
            
            <!-- 登录视图 -->
            <div v-if="currentView === 'login'" key="login" class="auth-view">
              <div class="view-header">
                <h2>欢迎回来</h2>
                <p>请登录您的管理员账号</p>
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
                    placeholder="请输入账号"
                    :prefix-icon="User"
                  />
                </el-form-item>
                
                <el-form-item prop="password">
                  <el-input 
                    v-model="form.password" 
                    type="password" 
                    placeholder="请输入密码"
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
                  <span class="forgot-link" @click="switchToForgotPassword">忘记密码？</span>
                </div>

                <el-button 
                  type="primary" 
                  class="submit-btn" 
                  :loading="loading"
                  @click="handleLogin"
                >
                  登录
                  <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>

                <div class="switch-mode">
                  还没有账号？ <span class="action-link" @click="switchToRegister">立即注册</span>
                </div>
              </el-form>
            </div>

            <!-- 注册视图 -->
            <div v-else-if="currentView === 'register'" key="register" class="auth-view">
              <div class="view-header">
                <h2>创建账号</h2>
                <p>注册成为新的管理员</p>
              </div>

              <!-- 步骤条 -->
              <div class="custom-steps">
                <div class="step-item" :class="{ active: registerStep >= 1, completed: registerStep > 1 }">
                  <div class="step-dot">1</div>
                  <span>信息</span>
                </div>
                <div class="step-line" :class="{ active: registerStep > 1 }"></div>
                <div class="step-item" :class="{ active: registerStep >= 2, completed: registerStep > 2 }">
                  <div class="step-dot">2</div>
                  <span>验证</span>
                </div>
                <div class="step-line" :class="{ active: registerStep > 2 }"></div>
                <div class="step-item" :class="{ active: registerStep >= 3 }">
                  <div class="step-dot">3</div>
                  <span>完成</span>
                </div>
              </div>

              <el-form 
                ref="registerFormRef"
                :model="registerForm"
                :rules="registerRules"
                class="custom-form"
                size="large"
              >
                <!-- 注册第一步 -->
                <div v-if="registerStep === 1" class="step-content animate__animated animate__fadeIn">
                  <el-form-item prop="username">
                    <el-input v-model="registerForm.username" placeholder="设置账号" :prefix-icon="User" />
                  </el-form-item>
                  <el-form-item prop="email">
                    <el-input v-model="registerForm.email" placeholder="邮箱地址（用于接收验证码）" :prefix-icon="Message" />
                  </el-form-item>
                  <el-form-item prop="password">
                    <el-input v-model="registerForm.password" type="password" placeholder="设置密码 (6位以上)" show-password :prefix-icon="Lock" />
                  </el-form-item>
                  <el-form-item prop="confirmPassword">
                    <el-input v-model="registerForm.confirmPassword" type="password" placeholder="确认密码" show-password :prefix-icon="Lock" />
                  </el-form-item>
                  
                  <el-button type="primary" class="submit-btn" :loading="registerLoading" @click="handleRegisterStep1">
                    下一步
                  </el-button>
                </div>

                <!-- 注册第二步 -->
                <div v-else-if="registerStep === 2" class="step-content animate__animated animate__fadeIn">
                  <div class="verify-tip">验证码已发送至您的账号关联邮箱/手机</div>
                  <el-form-item prop="verificationCode" ref="registerVerifyFormRef">
                    <div class="verify-input-group">
                      <el-input 
                        v-model="registerVerifyForm.verificationCode" 
                        placeholder="6位验证码" 
                        :prefix-icon="Message"
                        maxlength="6"
                      />
                      <el-button 
                        class="send-code-btn"
                        :disabled="registerVerificationCodeSent"
                        @click="handleSendRegisterVerificationCode"
                      >
                        {{ registerVerificationCodeSent ? `${registerVerificationCodeCountdown}s` : '获取验证码' }}
                      </el-button>
                    </div>
                  </el-form-item>
                  
                  <div class="btn-group">
                    <el-button class="back-btn" @click="registerStep = 1">返回</el-button>
                    <el-button type="primary" class="submit-btn" :loading="registerLoading" @click="handleRegisterStep2">
                      完成注册
                    </el-button>
                  </div>
                </div>

                <!-- 注册第三步 -->
                <div v-else-if="registerStep === 3" class="step-content success-view animate__animated animate__fadeIn">
                  <div class="success-icon-wrapper">
                    <el-icon><Check /></el-icon>
                  </div>
                  <h3>注册成功</h3>
                  <p>欢迎加入，您的管理员账号已就绪</p>
                  <el-button type="primary" class="submit-btn" @click="switchToLogin">立即登录</el-button>
                </div>
              </el-form>

              <div class="switch-mode" v-if="registerStep < 3">
                已有账号？ <span class="action-link" @click="switchToLogin">去登录</span>
              </div>
            </div>

            <!-- 忘记密码视图 -->
            <div v-else-if="currentView === 'forgot'" key="forgot" class="auth-view">
              <div class="view-header">
                <h2>重置密码</h2>
                <p>找回您的管理员账号密码</p>
              </div>

              <el-form 
                ref="forgotPasswordFormRef"
                :model="forgotPasswordForm"
                :rules="forgotPasswordRules"
                class="custom-form"
                size="large"
              >
                <!-- 找回第一步 -->
                <div v-if="forgotPasswordStep === 1" class="step-content animate__animated animate__fadeIn">
                  <el-form-item prop="username">
                    <el-input v-model="forgotPasswordForm.username" placeholder="请输入账号" :prefix-icon="User" />
                  </el-form-item>
                  <el-form-item prop="email">
                    <el-input v-model="forgotPasswordForm.email" placeholder="请输入绑定邮箱" :prefix-icon="Message" />
                  </el-form-item>
                  <el-button type="primary" class="submit-btn" :loading="forgotPasswordLoading" @click="handleSendVerificationCode">
                    发送验证码
                  </el-button>
                </div>

                <!-- 找回第二步 -->
                <div v-else-if="forgotPasswordStep === 2" class="step-content animate__animated animate__fadeIn">
                  <div class="verify-tip">请输入发送至 {{ forgotPasswordForm.email }} 的验证码</div>
                  <el-form-item prop="verificationCode">
                    <div class="verify-input-group">
                      <el-input 
                        v-model="forgotPasswordForm.verificationCode" 
                        placeholder="验证码" 
                        :prefix-icon="Key"
                        maxlength="6"
                      />
                      <el-button 
                        class="send-code-btn"
                        :disabled="verificationCodeSent"
                        @click="handleSendVerificationCode"
                      >
                        {{ verificationCodeSent ? `${verificationCodeCountdown}s` : '重发' }}
                      </el-button>
                    </div>
                  </el-form-item>
                  <div class="btn-group">
                    <el-button class="back-btn" @click="handlePreviousStep">上一步</el-button>
                    <el-button type="primary" class="submit-btn" :loading="forgotPasswordLoading" @click="handleVerifyCode">
                      验证并下一步
                    </el-button>
                  </div>
                </div>

                <!-- 找回第三步 -->
                <div v-else-if="forgotPasswordStep === 3" class="step-content animate__animated animate__fadeIn">
                  <el-form-item prop="newPassword">
                    <el-input v-model="forgotPasswordForm.newPassword" type="password" placeholder="新密码" show-password :prefix-icon="Lock" />
                  </el-form-item>
                  <el-form-item prop="confirmPassword">
                    <el-input v-model="forgotPasswordForm.confirmPassword" type="password" placeholder="确认新密码" show-password :prefix-icon="Lock" />
                  </el-form-item>
                  <el-button type="primary" class="submit-btn" :loading="forgotPasswordLoading" @click="handleResetPassword">
                    确认重置
                  </el-button>
                </div>
              </el-form>

              <div class="switch-mode">
                <span class="action-link" @click="switchToLogin">返回登录</span>
              </div>
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
import { User, Lock, Monitor, Message, Check, ArrowRight, Key, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getLoginCaptcha, login } from '@/api/common/auth'
import { setAuthSession } from '@/utils/authStorage'
import { applyDocumentTitle, getDefaultBranding, loadSystemBranding } from '@/utils/systemBranding'

const router = useRouter()
const branding = ref(getDefaultBranding())
const loading = ref(false)
const rememberMe = ref(false)
const formRef = ref(null)
const currentView = ref('login') // 'login', 'register', 'forgot'
const captchaImage = ref('')

onMounted(async () => {
  branding.value = await loadSystemBranding()
  applyDocumentTitle(branding.value, 'Admin Login')
  await loadCaptcha()
})

onMounted(() => {
  const username = localStorage.getItem('admin_remember_username')
  const password = localStorage.getItem('admin_remember_password')
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

// --- 登录逻辑 ---
const form = reactive({ username: '', password: '', captchaId: '', captchaCode: '' })
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
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

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const res = await login(form)
        if (res.data.roleName !== 'ADMIN') {
          await loadCaptcha()
          ElMessage.error('权限不足：非管理员账号')
          return
        }
        // 存储 Token 及用户信息
        setAuthSession({
          token: res.data.token,
          userId: res.data.userId,
          username: res.data.username,
          realName: res.data.realName,
          avatar: '',
          roleId: res.data.roleId,
          roleName: res.data.roleName,
          role: 'ADMIN'
        }, 'ADMIN')
        
        if (rememberMe.value) {
          localStorage.setItem('admin_remember_username', window.btoa(form.username))
          localStorage.setItem('admin_remember_password', window.btoa(form.password))
        } else {
          localStorage.removeItem('admin_remember_username')
          localStorage.removeItem('admin_remember_password')
        }

        ElMessage.success('登录成功')
        router.push('/admin/dashboard')
      } catch (error) {
        ElMessage.error(error.message || '登录失败')
      } finally {
        loading.value = false
      }
    }
  })
}

// --- 注册逻辑 ---
const registerStep = ref(1)
const registerLoading = ref(false)
const isFirstAdmin = ref(false)
const registerFormRef = ref(null)
const registerVerifyFormRef = ref(null)
const registerVerificationCodeSent = ref(false)
const registerVerificationCodeCountdown = ref(0)

const registerForm = reactive({ username: '', email: '', password: '', confirmPassword: '' })
const registerVerifyForm = reactive({ verificationCode: '' })

const registerRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 20, message: '长度3-20位', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '不少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: (rule, value, callback) => {
        if (value !== registerForm.password) callback(new Error('两次密码不一致'))
        else callback()
      }, trigger: 'blur' 
    }
  ]
}

const switchToRegister = () => {
  currentView.value = 'register'
  registerStep.value = 1
  resetRegisterForm()
}

const resetRegisterForm = () => {
  Object.assign(registerForm, { username: '', email: '', password: '', confirmPassword: '' })
  registerVerifyForm.verificationCode = ''
  registerVerificationCodeSent.value = false
}

const handleRegisterStep1 = async () => {
  if (!registerFormRef.value) return
  await registerFormRef.value.validate(async (valid) => {
    if (valid) {
      registerLoading.value = true
      try {
        const response = await fetch('/api/auth/admin/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: registerForm.username,
            email: registerForm.email,
            password: registerForm.password
          })
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || '注册失败')
        
        ElMessage.success('信息验证通过，请完成验证码验证')
        registerStep.value = 2
        await handleSendRegisterVerificationCode()
      } catch (error) {
        ElMessage.error(error.message)
      } finally {
        registerLoading.value = false
      }
    }
  })
}

const handleSendRegisterVerificationCode = async () => {
  registerLoading.value = true
  try {
    const response = await fetch('/api/auth/admin/send-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: registerForm.username })
    })
    if (!response.ok) throw new Error('发送失败')
    
    ElMessage.success('验证码已发送')
    registerVerificationCodeSent.value = true
    registerVerificationCodeCountdown.value = 60
    const timer = setInterval(() => {
      registerVerificationCodeCountdown.value--
      if (registerVerificationCodeCountdown.value <= 0) {
        clearInterval(timer)
        registerVerificationCodeSent.value = false
      }
    }, 1000)
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    registerLoading.value = false
  }
}

const handleRegisterStep2 = async () => {
  // 注意：这里需要手动校验 verificationCode，因为它是单独的 form-item
  if (!registerVerifyForm.verificationCode || registerVerifyForm.verificationCode.length !== 6) {
    ElMessage.warning('请输入6位验证码')
    return
  }
  
  registerLoading.value = true
  try {
    const response = await fetch('/api/auth/admin/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: registerForm.username,
        verificationCode: registerVerifyForm.verificationCode
      })
    })
    if (!response.ok) throw new Error('验证失败')
    
    ElMessage.success('注册完成')
    registerStep.value = 3
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    registerLoading.value = false
  }
}

// --- 忘记密码逻辑 ---
const forgotPasswordStep = ref(1)
const forgotPasswordLoading = ref(false)
const forgotPasswordForm = reactive({ username: '', email: '', verificationCode: '', newPassword: '', confirmPassword: '' })
const forgotPasswordFormRef = ref(null)
const verificationCodeSent = ref(false)
const verificationCodeCountdown = ref(0)

const forgotPasswordRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '格式不正确', trigger: 'blur' }],
  verificationCode: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '不少于6位', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请确认', trigger: 'blur' }, { validator: (r, v, c) => v !== forgotPasswordForm.newPassword ? c(new Error('不一致')) : c(), trigger: 'blur' }]
}

const switchToForgotPassword = () => {
  currentView.value = 'forgot'
  forgotPasswordStep.value = 1
  Object.assign(forgotPasswordForm, { username: '', email: '', verificationCode: '', newPassword: '', confirmPassword: '' })
  verificationCodeSent.value = false
}

const switchToLogin = () => {
  currentView.value = 'login'
}

const handleSendVerificationCode = async () => {
  if (!forgotPasswordFormRef.value) return
  // 校验前两个字段
  await forgotPasswordFormRef.value.validateField(['username', 'email'], async (valid) => {
    if (valid) {
      forgotPasswordLoading.value = true
      try {
        const response = await fetch('/api/auth/forgot-password/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: forgotPasswordForm.username, email: forgotPasswordForm.email })
        })
        if (!response.ok) throw new Error('发送失败')
        
        ElMessage.success('验证码已发送')
        verificationCodeSent.value = true
        verificationCodeCountdown.value = 60
        const timer = setInterval(() => {
          verificationCodeCountdown.value--
          if (verificationCodeCountdown.value <= 0) {
            clearInterval(timer)
            verificationCodeSent.value = false
          }
        }, 1000)
        
        if (currentView.value === 'forgot') forgotPasswordStep.value = 2
      } catch (error) {
        ElMessage.error(error.message)
      } finally {
        forgotPasswordLoading.value = false
      }
    }
  })
}

const handleVerifyCode = async () => {
  if (!forgotPasswordForm.verificationCode) return ElMessage.warning('请输入验证码')
  forgotPasswordLoading.value = true
  try {
    const response = await fetch('/api/auth/forgot-password/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: forgotPasswordForm.username,
        email: forgotPasswordForm.email,
        verificationCode: forgotPasswordForm.verificationCode
      })
    })
    if (!response.ok) throw new Error('验证失败')
    forgotPasswordStep.value = 3
  } catch (error) {
    ElMessage.error(error.message)
  } finally {
    forgotPasswordLoading.value = false
  }
}

const handleResetPassword = async () => {
  if (!forgotPasswordFormRef.value) return
  await forgotPasswordFormRef.value.validateField(['newPassword', 'confirmPassword'], async (valid) => {
    if (valid) {
      forgotPasswordLoading.value = true
      try {
        const response = await fetch('/api/auth/forgot-password/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: forgotPasswordForm.username,
            email: forgotPasswordForm.email,
            verificationCode: forgotPasswordForm.verificationCode,
            newPassword: forgotPasswordForm.newPassword
          })
        })
        if (!response.ok) throw new Error('重置失败')
        ElMessage.success('密码重置成功')
        switchToLogin()
      } catch (error) {
        ElMessage.error(error.message)
      } finally {
        forgotPasswordLoading.value = false
      }
    }
  })
}

const handlePreviousStep = () => {
  if (forgotPasswordStep.value > 1) forgotPasswordStep.value--
}
</script>

<style scoped lang="scss">
/* 变量定义 */
$primary-color: #3b82f6;
$primary-hover: #2563eb;
$bg-gradient: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
$text-main: #1e293b;
$text-sub: #64748b;
$border-color: #e2e8f0;

.login-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #f8fafc;
  position: relative;
  overflow: hidden;
}

/* 背景装饰 */
.bg-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  
  .shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.4;
    animation: float 20s infinite ease-in-out;
  }
  .shape-1 { width: 500px; height: 500px; background: #60a5fa; top: -100px; right: -100px; animation-delay: 0s; }
  .shape-2 { width: 400px; height: 400px; background: #818cf8; bottom: -50px; left: -50px; animation-delay: -5s; }
  .shape-3 { width: 300px; height: 300px; background: #34d399; top: 40%; left: 40%; opacity: 0.2; animation-delay: -10s; }
}

.login-box {
  position: relative;
  z-index: 1;
  display: flex;
  width: 1200px;
  height: 720px;
  margin: auto;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  @media (max-width: 1280px) {
    width: 90%;
    height: 80vh;
  }
}

/* 左侧视觉区 */
.visual-side {
  flex: 0 0 45%;
  background: $bg-gradient;
  position: relative;
  padding: 60px;
  display: flex;
  flex-direction: column;
  color: #fff;
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
    gap: 12px;
    margin-bottom: 40px;
    
    .logo-icon {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .app-name {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 1px;
    }
  }

  .slogan-group {
    .main-title {
      font-size: 42px;
      line-height: 1.2;
      font-weight: 700;
      margin-bottom: 16px;
      background: linear-gradient(to right, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sub-title {
      font-size: 16px;
      color: #94a3b8;
      font-weight: 300;
    }
  }

  .illustration {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    .tech-circle {
      width: 260px;
      height: 260px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      position: absolute;
      animation: spin 20s linear infinite;
      
      .inner-ring {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 180px; height: 180px;
        border: 1px dashed rgba(255, 255, 255, 0.2);
        border-radius: 50%;
      }
      .dot {
        position: absolute;
        top: -4px; left: 50%;
        width: 8px; height: 8px;
        background: #3b82f6;
        border-radius: 50%;
        box-shadow: 0 0 10px #3b82f6;
      }
    }

    .glass-card {
      width: 220px;
      height: 140px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 20px;
      transform: rotate(-10deg);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      animation: float-card 6s ease-in-out infinite;

      .card-line {
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        margin-bottom: 10px;
        &.short { width: 60%; }
      }
      .card-stat {
        display: flex;
        gap: 8px;
        margin-top: 20px;
        align-items: flex-end;
        height: 40px;
        .stat-bar {
          flex: 1;
          background: #3b82f6;
          border-radius: 2px;
          opacity: 0.8;
          &:nth-child(1) { height: 40%; }
          &:nth-child(2) { height: 70%; }
          &:nth-child(3) { height: 50%; }
        }
      }
    }
  }

  .copyright {
    font-size: 12px;
    color: #64748b;
  }
}

/* 右侧表单区 */
.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
}

.form-wrapper {
  width: 100%;
  max-width: 400px;
}

.auth-view {
  width: 100%;
}

.view-header {
  margin-bottom: 32px;
  text-align: left;
  
  h2 {
    font-size: 28px;
    color: $text-main;
    margin: 0 0 8px;
    font-weight: 700;
  }
  p {
    color: $text-sub;
    font-size: 15px;
  }
}

/* 自定义表单样式 */
.custom-form {
  :deep(.el-input__wrapper) {
    box-shadow: none;
    background: #f1f5f9;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 12px;
    transition: all 0.3s;
    
    &:hover {
      background: #e2e8f0;
    }
    &.is-focus {
      background: #fff;
      border-color: $primary-color;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  }
  
  :deep(.el-input__inner) {
    height: 32px;
    color: $text-main;
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    font-size: 14px;
    
    .forgot-link {
      color: $primary-color;
      cursor: pointer;
      &:hover { text-decoration: underline; }
    }
  }

  .submit-btn {
    width: 100%;
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 8px;
    background: $primary-color;
    border: none;
    transition: all 0.3s;
    
    &:hover {
      background: $primary-hover;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
  }
}

.switch-mode {
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: $text-sub;
  
  .action-link {
    color: $primary-color;
    font-weight: 600;
    cursor: pointer;
    margin-left: 4px;
    &:hover { text-decoration: underline; }
  }
}

/* 步骤条样式 */
.custom-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  padding: 0 10px;

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    position: relative;
    z-index: 2;
    
    .step-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s;
    }
    span {
      font-size: 12px;
      color: #94a3b8;
    }

    &.active {
      .step-dot { background: $primary-color; color: #fff; }
      span { color: $text-main; font-weight: 500; }
    }
    &.completed {
      .step-dot { background: #10b981; }
    }
  }

  .step-line {
    flex: 1;
    height: 2px;
    background: #f1f5f9;
    margin: 0 10px;
    margin-bottom: 20px; /* 对齐圆点 */
    transition: all 0.3s;
    
    &.active { background: $primary-color; }
  }
}

/* 验证码输入组 */
.verify-input-group {
  display: flex;
  gap: 12px;
  
  .send-code-btn {
    width: 100px;
    height: 100%;
    border-radius: 8px;
    background: #f1f5f9;
    border: none;
    color: $text-main;
    &:hover:not(:disabled) { background: #e2e8f0; }
  }
}

.verify-tip {
  font-size: 13px;
  color: $text-sub;
  margin-bottom: 16px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
}

.btn-group {
  display: flex;
  gap: 12px;
  .back-btn { flex: 1; height: 48px; border-radius: 8px; }
  .submit-btn { flex: 2; }
}

/* 成功状态 */
.success-view {
  text-align: center;
  padding: 20px 0;
  
  .success-icon-wrapper {
    width: 80px;
    height: 80px;
    background: #d1fae5;
    color: #10b981;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    margin: 0 auto 24px;
    animation: bounceIn 0.6s;
  }
  
  h3 { font-size: 24px; color: $text-main; margin-bottom: 8px; }
  p { color: $text-sub; margin-bottom: 32px; }
}

/* 动画 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s ease;
}
.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.95) translateX(20px);
}
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateX(-20px);
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -20px); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float-card {
  0%, 100% { transform: rotate(-10deg) translateY(0); }
  50% { transform: rotate(-10deg) translateY(-10px); }
}

@keyframes bounceIn {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); }
}

.mb-4 { margin-bottom: 16px; }
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
