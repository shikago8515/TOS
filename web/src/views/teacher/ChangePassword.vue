<template>
  <div class="change-pwd-container">
    <div class="page-header">
      <el-button link @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <h2>修改密码</h2>
    </div>

    <el-card class="pwd-card" shadow="hover">
      <div class="form-wrapper">
        <div class="security-tip">
          <el-icon><Lock /></el-icon>
          <span>为了您的账户安全，建议使用包含字母、数字和符号的强密码。</span>
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
import { ArrowLeft, Lock, Key, Check } from '@element-plus/icons-vue'
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
        router.push('/teacher/login')
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
  padding: 20px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
  
  h2 {
    margin: 0;
    font-size: 24px;
    color: #1e293b;
  }
}

.pwd-card {
  border-radius: 16px;
  border: none;
  
  .form-wrapper {
    padding: 20px;
    max-width: 480px;
    margin: 0 auto;
  }
}

.security-tip {
  background: #eef2ff;
  border: 1px solid #e0e7ff;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
  color: #4338ca;
  font-size: 14px;
  
  .el-icon {
    font-size: 18px;
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

    &:hover {
      box-shadow: 0 0 0 1px #cbd5e1 inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 2px #6366f1 inset !important;
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
    background: #6366f1;
    border-color: #6366f1;
    
    &:hover {
      background: #4f46e5;
      border-color: #4f46e5;
    }
  }
}
</style>
