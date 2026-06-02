<template>
  <div class="profile-container">
    <div class="page-header">
      <h2>个人资料</h2>
      <span class="subtitle">管理您的个人信息和账户安全</span>
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
                :before-upload="beforeAvatarUpload"
              >
                <div class="avatar-box">
                  <el-avatar :size="100" :src="userInfo.avatar || 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png'" />
                  <div class="upload-mask">
                    <el-icon><Camera /></el-icon>
                  </div>
                </div>
              </el-upload>
              <div class="role-badge">学生</div>
            </div>
            <div class="username-row">
              <div class="name-group">
                <h3 class="real-name">{{ userInfo.realName || '同学' }}</h3>
                <el-tag size="small" type="info" effect="plain" class="role-tag">学生</el-tag>
              </div>
              <div class="nickname-wrapper">
                <span class="nickname-label">昵称：</span>
                <span class="nickname-value">{{ userInfo.nickname || '未设置' }}</span>
                <el-button link type="primary" class="edit-name-btn" @click="openEditNicknameDialog">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </div>
            </div>
            <p class="user-id">学号：{{ userInfo.studentId || '2021001001' }}</p>
          </div>
          
          <div class="info-list">
            <div class="info-item">
              <el-icon><School /></el-icon>
              <span class="label">班级</span>
              <span class="value">{{ userInfo.className || '暂无班级' }}</span>
            </div>
            <div class="info-item">
              <el-icon><Message /></el-icon>
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
              <span>账户安全</span>
            </div>
          </template>
          
          <div class="security-item">
            <div class="security-icon">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="security-content">
              <div class="security-title">登录密码</div>
              <div class="security-desc">建议定期修改密码以保护账户安全</div>
            </div>
            <el-button type="primary" plain @click="$router.push('/student/change-password')">修改密码</el-button>
          </div>

          <div class="security-item">
            <div class="security-icon">
              <el-icon><Message /></el-icon>
            </div>
            <div class="security-content">
              <div class="security-title">安全邮箱</div>
              <div class="security-desc">用于找回密码和接收重要通知</div>
            </div>
            <el-button type="primary" plain @click="openBindEmailDialog">
              {{ userInfo.email ? '更换邮箱' : '绑定邮箱' }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 修改昵称弹窗 -->
    <el-dialog
      v-model="editNicknameDialogVisible"
      width="420px"
      :teleported="false"
      class="modern-dialog"
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
          <el-form-item prop="nickname" label="新昵称">
            <el-input v-model="nicknameForm.nickname" placeholder="请输入新昵称" size="large" maxlength="20" show-word-limit>
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
      class="modern-dialog"
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

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { 
  School, Message, Lock, Key, Edit, User, Camera
} from '@element-plus/icons-vue'
// @ts-ignore
import { getUserInfo, sendEmailCode, bindEmail, updateUserInfo, uploadAvatar } from '@/api/user.js'
import { setAuthSession } from '@/utils/authStorage'

const userInfo = ref({
  username: '',
  realName: '',
  nickname: '',
  studentId: '',
  className: '',
  points: 0,
  email: '',
  avatar: ''
})

// 头像上传相关
const beforeAvatarUpload = (rawFile: any) => {
  if (rawFile.type !== 'image/jpeg' && rawFile.type !== 'image/png') {
    ElMessage.error('头像必须是 JPG 或 PNG 格式!')
    return false
  } else if (rawFile.size / 1024 / 1024 > 2) {
    ElMessage.error('头像大小不能超过 2MB!')
    return false
  }
  return true
}

const customUpload = async (options: any) => {
  try {
    const formData = new FormData()
    formData.append('file', options.file)
    const res = await uploadAvatar(formData)
    const avatarRaw = res.data?.avatar || res.data || ''
    // 在 URL 后添加时间戳，防止浏览器缓存
    const avatarUrl = avatarRaw ? `${avatarRaw}?t=${Date.now()}` : ''
    userInfo.value.avatar = avatarUrl
    setAuthSession({ avatar: avatarRaw }, 'STUDENT')
    ElMessage.success('头像上传成功')
    if (options.onSuccess) {
      options.onSuccess(res)
    }
    // 上传成功后重新加载用户信息，确保头像立即更新
    await fetchUserInfo()
    // fetchUserInfo 会覆盖 avatar，重新加时间戳破除浏览器缓存
    if (userInfo.value.avatar) {
      const base = userInfo.value.avatar.split('?')[0]
      userInfo.value.avatar = `${base}?t=${Date.now()}`
    }
    // 通知 Layout 组件更新右上角头像
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar: userInfo.value.avatar } }))
  } catch (e: any) {
    if (options.onError) {
      options.onError(e)
    }
    ElMessage.error(e.message || '头像上传失败')
  }
}

// 修改昵称相关
const editNicknameDialogVisible = ref(false)
const nicknameLoading = ref(false)
const nicknameFormRef = ref<FormInstance>()
const nicknameForm = reactive({
  nickname: ''
})

const nicknameRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ]
}

const openEditNicknameDialog = () => {
  nicknameForm.nickname = userInfo.value.nickname || ''
  editNicknameDialogVisible.value = true
}

const handleUpdateNickname = async () => {
  if (!nicknameFormRef.value) return
  try {
    await nicknameFormRef.value.validate()
    nicknameLoading.value = true
    await updateUserInfo({ nickname: nicknameForm.nickname })
    ElMessage.success('昵称修改成功')
    userInfo.value.nickname = nicknameForm.nickname
    // 更新本地存储
    localStorage.setItem('nickname', nicknameForm.nickname)
    editNicknameDialogVisible.value = false
  } catch (e: any) {
    if (e?.message) {
      ElMessage.error(e.message)
    }
  } finally {
    nicknameLoading.value = false
  }
}

// 邮箱绑定相关
const bindEmailDialogVisible = ref(false)
const emailLoading = ref(false)
const countdown = ref(0)
let timer: any = null
const emailFormRef = ref<FormInstance>()
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
        realName: localStorage.getItem('realName') || res.data.realName,
        nickname: localStorage.getItem('nickname') || res.data.nickname
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
  } catch (e: any) {
    ElMessage.error(e.message || '发送失败')
  }
}

const handleBindEmail = async () => {
  if (!emailFormRef.value) return
  try {
    await emailFormRef.value.validate()
    emailLoading.value = true
    await bindEmail(emailForm)
    ElMessage.success('邮箱绑定成功')
    userInfo.value.email = emailForm.email
    bindEmailDialogVisible.value = false
  } catch (e: any) {
    if (e?.message) {
      ElMessage.error(e.message)
    }
  } finally {
    emailLoading.value = false
  }
}

onMounted(() => {
  fetchUserInfo()
})
</script>

<style scoped lang="scss">
.profile-container {
  padding: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
  h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    color: #1e293b;
  }
  .subtitle {
    color: #64748b;
    font-size: 14px;
  }
}

.profile-card {
  text-align: center;
  border-radius: 16px;
  border: none;
  
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
        background: #10b981;
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        border: 2px solid white;
        display: none; // Hide original badge as we moved it
      }
    }

    .username-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;

      .name-group {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .real-name {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        
        .role-tag {
          border-radius: 12px;
          height: 20px;
          padding: 0 8px;
        }
      }

      .nickname-wrapper {
        display: flex;
        align-items: center;
        gap: 4px;
        max-width: 100%;
        font-size: 13px;
        color: #64748b;
        background: #f8fafc;
        padding: 4px 12px;
        border-radius: 12px;
        
        .nickname-value {
          font-weight: 500;
          color: #475569;
        }

        .edit-name-btn {
          padding: 2px;
          height: auto;
          font-size: 14px;
          color: #94a3b8;
          margin-left: 4px;
          
          &:hover {
            color: #10b981;
          }
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
      padding: 12px 0;
      color: #334155;
      
      .el-icon {
        font-size: 18px;
        color: #94a3b8;
        margin-right: 12px;
      }

      .label {
        width: 70px;
        text-align: left;
        color: #64748b;
      }

      .value {
        flex: 1;
        min-width: 0;
        text-align: right;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        &.highlight {
          color: #10b981;
          font-weight: 600;
        }
      }
    }
  }
}

.security-card {
  border-radius: 16px;
  border: none;
  height: 100%;

  .card-header {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }

  .security-item {
    display: flex;
    align-items: center;
    padding: 24px 0;
    border-bottom: 1px solid #f1f5f9;

    &:last-child {
      border-bottom: none;
    }

    .security-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #f0fdf4;
      color: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-right: 20px;
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

/* 复用之前的弹窗样式 */
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

.code-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .el-input {
    flex: 1;
  }

  /* 强制统一高度 */
  .el-input :deep(.el-input__wrapper) {
    height: 42px;
    padding: 0 12px; /* 去除垂直padding，避免撑高 */
  }
  
  .send-code-btn {
    width: 110px;
    height: 42px; /* 与输入框高度一致 */
    border-radius: 8px;
    font-weight: 500;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .cancel-btn {
    border-radius: 8px;
    padding: 10px 24px;
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

@media (max-width: 992px) {
  .profile-container {
    padding: 14px;
  }

  .profile-grid {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .page-header {
    margin-bottom: 18px;

    h2 {
      font-size: 20px;
    }
  }

  .profile-grid {
    row-gap: 12px;
  }

  .profile-card {
    .user-info-header {
      .username-row {
        .name-group,
        .nickname-wrapper {
          flex-wrap: wrap;
          justify-content: center;
        }
      }

      .user-id {
        overflow-wrap: anywhere;
        word-break: break-word;
      }
    }

    .info-list {
      .info-item {
        flex-wrap: wrap;
        row-gap: 6px;

        .label {
          width: auto;
          min-width: 44px;
        }

        .value {
          width: 100%;
          text-align: left;
        }
      }
    }
  }

  .security-card {
    .security-item {
      align-items: flex-start;
      flex-direction: column;
      gap: 10px;

      .security-icon {
        margin-right: 0;
      }

      .security-content {
        width: 100%;
      }
    }
  }

  .code-input-group {
    flex-direction: column;
    align-items: stretch;

    .send-code-btn {
      width: 100%;
    }
  }

  .dialog-footer {
    justify-content: stretch;

    .cancel-btn,
    .confirm-btn {
      flex: 1;
      padding: 10px 0;
    }
  }
}
</style>
