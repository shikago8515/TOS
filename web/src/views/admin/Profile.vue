<template>
  <div class="profile-container">
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <span class="title-icon">
            <el-icon><User /></el-icon>
          </span>
          <h2 class="page-title">个人资料</h2>
        </div>
        <span class="subtitle">管理您的个人信息和账户安全</span>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="8">
        <el-card class="profile-card" shadow="hover">
          <div class="user-info-header">
            <div class="avatar-wrapper">
              <el-upload
                class="avatar-uploader"
                action="#"
                :show-file-list="false"
                :http-request="customUpload"
                accept=".jpg,.jpeg,.png"
              >
                <div class="avatar-box">
                  <el-avatar :size="100" :src="userInfo.avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'" />
                  <div class="upload-mask">
                    <el-icon><Camera /></el-icon>
                  </div>
                </div>
              </el-upload>
              <div class="role-badge">管理员</div>
            </div>
            <div class="username-row">
              <h3 class="username">{{ userInfo.username || '管理员' }}</h3>
              <el-button link type="primary" class="edit-name-btn" @click="openEditNicknameDialog">
                <el-icon><Edit /></el-icon>
              </el-button>
            </div>
            <p class="user-id">ID：{{ userInfo.id || 'ADMIN_001' }}</p>
          </div>
          
          <div class="info-list">
            <div class="info-item">
              <div class="item-icon">
                <el-icon><Monitor /></el-icon>
              </div>
              <span class="label">角色</span>
              <span class="value">系统管理员</span>
            </div>
            <div class="info-item">
              <div class="item-icon">
                <el-icon><Message /></el-icon>
              </div>
              <span class="label">邮箱</span>
              <span class="value">{{ userInfo.email || '未绑定' }}</span>
              <el-button link type="primary" size="small" @click="openBindEmailDialog">
                {{ userInfo.email ? '修改' : '绑定' }}
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card class="security-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="header-icon">
                <el-icon><Lock /></el-icon>
              </span>
              <span>账户安全</span>
            </div>
          </template>
          
          <div class="security-list">
            <div class="security-item">
              <div class="security-icon-wrapper warning">
                <el-icon><Lock /></el-icon>
              </div>
              <div class="security-content">
                <div class="security-title">登录密码</div>
                <div class="security-desc">建议定期修改密码以保护账户安全</div>
              </div>
              <el-button type="primary" plain round @click="$router.push('/admin/change-password')">修改密码</el-button>
            </div>

            <div class="security-item">
              <div class="security-icon-wrapper success">
                <el-icon><Message /></el-icon>
              </div>
              <div class="security-content">
                <div class="security-title">安全邮箱</div>
                <div class="security-desc">用于找回密码和接收重要通知</div>
              </div>
              <el-button type="primary" plain round @click="openBindEmailDialog">
                {{ userInfo.email ? '更换邮箱' : '绑定邮箱' }}
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 修改昵称弹窗 -->
    <el-dialog
      v-model="editNicknameDialogVisible"
      width="420px"
      :teleported="false"
      class="custom-dialog"
      :show-close="false"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <div class="header-icon">
            <el-icon><Edit /></el-icon>
          </div>
          <span class="header-title">修改昵称</span>
        </div>
      </template>
      
      <div class="dialog-body">
        <el-form :model="nicknameForm" :rules="nicknameRules" ref="nicknameFormRef" label-position="top" class="modern-form">
          <el-form-item prop="username" label="新昵称">
            <el-input v-model="nicknameForm.username" placeholder="请输入新昵称" size="large" maxlength="20" show-word-limit>
              <template #prefix>
                <el-icon class="input-icon"><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editNicknameDialogVisible = false" size="large" class="cancel-btn">取消</el-button>
          <el-button type="primary" @click="handleUpdateNickname" :loading="nicknameLoading" size="large" class="confirm-btn">
            确认修改
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 绑定邮箱弹窗 -->
    <el-dialog
      v-model="bindEmailDialogVisible"
      width="420px"
      :teleported="false"
      class="custom-dialog"
      :show-close="false"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <div class="header-icon">
            <el-icon><Message /></el-icon>
          </div>
          <span class="header-title">{{ userInfo.email ? '更换绑定邮箱' : '绑定安全邮箱' }}</span>
        </div>
      </template>
      
      <div class="dialog-body">
        <p class="dialog-desc">绑定邮箱可用于找回密码及接收重要通知</p>
        <el-form :model="emailForm" :rules="emailRules" ref="emailFormRef" label-position="top" class="modern-form">
          <el-form-item prop="email" label="邮箱地址">
            <el-input v-model="emailForm.email" placeholder="example@domain.com" size="large">
              <template #prefix>
                <el-icon class="input-icon"><Message /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="code" label="验证码">
            <div class="code-input-group">
              <el-input v-model="emailForm.code" placeholder="6位验证码" size="large">
                <template #prefix>
                  <el-icon class="input-icon"><Key /></el-icon>
                </template>
              </el-input>
              <el-button 
                type="primary" 
                class="send-code-btn"
                size="large"
                :disabled="countdown > 0" 
                @click="handleSendCode"
              >
                {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="bindEmailDialogVisible = false" size="large" class="cancel-btn">取消</el-button>
          <el-button type="primary" @click="handleBindEmail" :loading="emailLoading" size="large" class="confirm-btn">
            确认绑定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Monitor, Message, Lock, Key, Edit, User, Camera
} from '@element-plus/icons-vue'
import { getUserInfo, sendEmailCode, bindEmail, updateUserInfo, uploadAvatar } from '@/api/user.js'
import { setAuthSession } from '@/utils/authStorage'

const userInfo = ref({
  username: '',
  id: '',
  email: '',
  avatar: ''
})

const customUpload = async (options) => {
  const { file } = options
  
  // 验证文件类型和大小
  const isJPGOrPNG = file.type === 'image/jpeg' || file.type === 'image/png'
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isJPGOrPNG) {
    ElMessage.error('头像只能是 JPG 或 PNG 格式!')
    return
  }
  if (!isLt2M) {
    ElMessage.error('头像大小不能超过 2MB!')
    return
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await uploadAvatar(formData)
    if (res.code === 200) {
      const avatarUrl = res.data?.avatar || res.data || ''
      userInfo.value.avatar = avatarUrl
      // 更新本地存储的用户信息
      const userStore = JSON.parse(localStorage.getItem('user') || '{}')
      userStore.avatar = avatarUrl
      localStorage.setItem('user', JSON.stringify(userStore))
      setAuthSession({ avatar: avatarUrl }, 'ADMIN')
      ElMessage.success('头像上传成功')
    }
  } catch (error) {
    ElMessage.error('头像上传失败')
  }
}

// 修改昵称相关
const editNicknameDialogVisible = ref(false)
const nicknameLoading = ref(false)
const nicknameFormRef = ref(null)
const nicknameForm = reactive({
  username: ''
})

const nicknameRules = {
  username: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ]
}

const openEditNicknameDialog = () => {
  nicknameForm.username = userInfo.value.username
  editNicknameDialogVisible.value = true
}

const handleUpdateNickname = async () => {
  if (!nicknameFormRef.value) return
  await nicknameFormRef.value.validate(async (valid) => {
    if (valid) {
      nicknameLoading.value = true
      try {
        await updateUserInfo({ nickname: nicknameForm.username })
        ElMessage.success('昵称修改成功')
        userInfo.value.username = nicknameForm.username
        localStorage.setItem('username', nicknameForm.username)
        editNicknameDialogVisible.value = false
      } catch (e) {
        ElMessage.error(e.message || '修改失败')
      } finally {
        nicknameLoading.value = false
      }
    }
  })
}

// 邮箱绑定相关
const bindEmailDialogVisible = ref(false)
const emailLoading = ref(false)
const countdown = ref(0)
let timer = null
const emailFormRef = ref(null)
const emailForm = reactive({
  email: '',
  code: ''
})

const emailRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码长度为6位', trigger: 'blur' }
  ]
}

const fetchUserInfo = async () => {
  try {
    const res = await getUserInfo()
    if (res.data) {
      userInfo.value = {
        ...userInfo.value,
        ...res.data,
        username: localStorage.getItem('username') || res.data.username
      }
    }
  } catch (e) {
    console.error('获取用户信息失败', e)
  }
}

const openBindEmailDialog = () => {
  emailForm.email = ''
  emailForm.code = ''
  bindEmailDialogVisible.value = true
}

const handleSendCode = async () => {
  if (!emailForm.email) {
    ElMessage.warning('请先输入邮箱地址')
    return
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(emailForm.email)) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }

  try {
    await sendEmailCode({ email: emailForm.email })
    ElMessage.success('验证码已发送，请注意查收')
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (e) {
    ElMessage.error(e.message || '发送失败')
  }
}

const handleBindEmail = async () => {
  if (!emailFormRef.value) return
  await emailFormRef.value.validate(async (valid) => {
    if (valid) {
      emailLoading.value = true
      try {
        await bindEmail(emailForm)
        ElMessage.success('邮箱绑定成功')
        userInfo.value.email = emailForm.email
        bindEmailDialogVisible.value = false
      } catch (e) {
        ElMessage.error(e.message || '绑定失败')
      } finally {
        emailLoading.value = false
      }
    }
  })
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<style scoped lang="scss">
.profile-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
  
  .header-content {
    .title-section {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .title-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
      }

      .page-title {
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
      }
    }

    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin-left: 44px;
    }
  }
}

.profile-card {
  text-align: center;
  border-radius: 16px;
  border: 1px solid #f0f2f5;
  box-shadow: none;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(149, 157, 165, 0.1);
  }
  
  .user-info-header {
    padding: 20px 0;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 20px;

    .avatar-wrapper {
      position: relative;
      display: inline-block;
      margin-bottom: 16px;

      .avatar-uploader {
        cursor: pointer;
        position: relative;
        display: inline-block;
        
        .avatar-box {
          position: relative;
          border-radius: 50%;
          overflow: hidden;
          border: 4px solid #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          
          &:hover .upload-mask {
            opacity: 1;
          }
        }

        .upload-mask {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s;
          color: white;
          font-size: 24px;
        }
      }

      .role-badge {
        position: absolute;
        bottom: 0;
        right: 0;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }

    .username-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0 0 8px 0;

      .username {
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
      }

      .edit-name-btn {
        padding: 4px;
        height: auto;
        font-size: 16px;
        color: #94a3b8;
        
        &:hover {
          color: #3b82f6;
          background: #eff6ff;
          border-radius: 4px;
        }
      }
    }

    .user-id {
      margin: 0;
      color: #64748b;
      font-size: 14px;
    }
  }

  .info-list {
    .info-item {
      display: flex;
      align-items: center;
      padding: 16px 0;
      color: #334155;
      
      .item-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        margin-right: 12px;
        font-size: 18px;
      }

      .label {
        width: 70px;
        text-align: left;
        color: #64748b;
        font-size: 14px;
      }

      .value {
        flex: 1;
        text-align: right;
        font-weight: 500;
        color: #1e293b;
      }
    }
  }
}

.security-card {
  border-radius: 16px;
  border: 1px solid #f0f2f5;
  box-shadow: none;
  height: 100%;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(149, 157, 165, 0.1);
  }

  :deep(.el-card__header) {
    padding: 20px 24px;
    border-bottom: 1px solid #f1f5f9;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;

    .header-icon {
      color: #3b82f6;
      font-size: 18px;
      display: flex;
      align-items: center;
    }
  }

  .security-list {
    padding: 0 10px;
  }

  .security-item {
    display: flex;
    align-items: center;
    padding: 24px 0;
    border-bottom: 1px solid #f1f5f9;

    &:last-child {
      border-bottom: none;
    }

    .security-icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-right: 20px;

      &.warning {
        background: #fff7ed;
        color: #f97316;
      }

      &.success {
        background: #f0fdf4;
        color: #22c55e;
      }
    }

    .security-content {
      flex: 1;
      
      .security-title {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 4px;
      }

      .security-desc {
        font-size: 14px;
        color: #64748b;
      }
    }
  }
}

/* 通用弹窗样式 */
.custom-dialog {
  :deep(.el-dialog) {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

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
    background: #f8fafc;
  }
}

.dialog-header {
  padding: 20px 24px;
  background: linear-gradient(to right, #f8fafc, #fff);
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 12px;

  .header-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #eff6ff;
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
  }
}

.dialog-body {
  padding: 32px 24px;

  .dialog-desc {
    margin: 0 0 24px 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
    background: #f8fafc;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #f1f5f9;
  }
}

.modern-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: #475569;
    margin-bottom: 8px;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #e2e8f0 inset;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s;
    background: #f8fafc;

    &:hover {
      box-shadow: 0 0 0 1px #cbd5e1 inset;
      background: #fff;
    }

    &.is-focus {
      box-shadow: 0 0 0 2px #3b82f6 inset !important;
      background: #fff;
    }
  }

  .input-icon {
    color: #94a3b8;
    font-size: 16px;
  }
}

.code-input-group {
  display: flex;
  gap: 12px;
  width: 100%;
  
  .send-code-btn {
    width: 120px;
    border-radius: 8px;
    font-weight: 500;
    height: 40px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .cancel-btn {
    border-radius: 8px;
    padding: 10px 24px;
    height: 40px;
    border: 1px solid #e2e8f0;
    
    &:hover {
      color: #3b82f6;
      border-color: #3b82f6;
      background: #eff6ff;
    }
  }

  .confirm-btn {
    border-radius: 8px;
    padding: 10px 24px;
    height: 40px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: none;
    font-weight: 500;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
    
    &:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.3);
    }
  }
}
</style>
