<template>
  <div class="change-pwd-container">
    <div class="page-header">
      <el-button link class="back-btn" @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <div class="header-content">
        <div class="title-section">
          <span class="title-icon">
            <el-icon><Lock /></el-icon>
          </span>
          <h2 class="page-title">修改密码</h2>
        </div>
        <span class="subtitle">定期修改密码可以保护您的账户安全</span>
      </div>
    </div>

    <el-card class="pwd-card" shadow="hover">
      <div class="form-wrapper">
        <div class="security-tip">
          <div class="tip-icon">
            <el-icon><InfoFilled /></el-icon>
          </div>
          <div class="tip-content">
            <div class="tip-title">安全提示</div>
            <div class="tip-desc">为了您的账户安全，建议使用包含字母、数字和符号的强密码。</div>
          </div>
        </div>

        <el-form 
          ref="pwdFormRef" 
          :model="pwdForm" 
          :rules="pwdRules" 
          label-position="top"
          class="modern-form"
        >
          <el-form-item label="当前密码" prop="oldPassword">
            <el-input 
              v-model="pwdForm.oldPassword" 
              type="password" 
              show-password 
              placeholder="请输入当前使用的密码" 
              size="large"
            >
              <template #prefix><el-icon class="input-icon"><Key /></el-icon></template>
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
              <template #prefix><el-icon class="input-icon"><Lock /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input 
              v-model="pwdForm.confirmPassword" 
              type="password" 
              show-password 
              placeholder="请再次输入新密码" 
              size="large"
            >
              <template #prefix><el-icon class="input-icon"><Check /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary" 
              class="submit-btn" 
              size="large" 
              :loading="loading"
              @click="handleSubmit"
            >
              确认修改
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Lock, Key, Check, InfoFilled } from '@element-plus/icons-vue'
import { updatePassword } from '@/api/user'

const router = useRouter()
const pwdFormRef = ref(null)
const loading = ref(false)

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validatePass2 = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== pwdForm.newPassword) {
    callback(new Error('两次输入密码不一致!'))
  } else {
    callback()
  }
}

const pwdRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validatePass2, trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await updatePassword({
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword
        })
        ElMessage.success('密码修改成功，请重新登录')
        localStorage.clear()
        router.push('/admin/login')
      } catch (e: any) {
        ElMessage.error(e.message || '修改失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped lang="scss">
.change-pwd-container {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
  
  .back-btn {
    margin-bottom: 16px;
    font-size: 14px;
    color: #64748b;
    
    &:hover {
      color: #3b82f6;
    }
  }

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

.pwd-card {
  border-radius: 16px;
  border: 1px solid #f0f2f5;
  box-shadow: none;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(149, 157, 165, 0.1);
  }
  
  .form-wrapper {
    padding: 32px 20px;
    max-width: 480px;
    margin: 0 auto;
  }
}

.security-tip {
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  
  .tip-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #fff;
    color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  .tip-content {
    .tip-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .tip-desc {
      font-size: 13px;
      color: #3b82f6;
      line-height: 1.5;
    }
  }
}

.modern-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: #475569;
    padding-bottom: 8px;
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

  .submit-btn {
    width: 100%;
    margin-top: 20px;
    border-radius: 8px;
    height: 44px;
    font-size: 16px;
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
