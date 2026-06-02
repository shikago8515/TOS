<template>
  <div class="system-config">
    <el-card shadow="never" class="config-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">系统配置</div>
            <div class="subtitle">配置系统品牌、案例生成/评分模型，以及 MinIO 存储</div>
          </div>
          <el-button type="primary" :loading="saving" @click="handleSave">
            <el-icon class="el-icon--left"><Check /></el-icon>
            保存配置
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane name="basic" label="基础设置">
          <el-form :model="form" label-position="top" class="config-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="系统名称">
                  <el-input v-model="form.systemName" placeholder="请输入系统名称" />
                  <div class="form-tip">会显示在登录页、导航品牌区和浏览器标题中。</div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备案号">
                  <el-input v-model="form.icp" placeholder="例如：京 ICP 备 12345678 号" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="系统 Logo">
              <div class="logo-section">
                <div class="logo-preview">
                  <img v-if="form.logoUrl" :src="form.logoUrl" alt="logo" />
                  <el-icon v-else><Picture /></el-icon>
                </div>
                <div class="logo-actions">
                  <el-upload
                    :show-file-list="false"
                    :before-upload="handleLogoUpload"
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                  >
                    <el-button :loading="uploadingLogo">上传 Logo</el-button>
                  </el-upload>
                  <div class="form-tip">建议使用透明背景图片，上传后立即生效。</div>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane name="llm" label="系统 AI">
          <el-alert
            title="这里的配置只影响 AI 案例生成、AI 评分，以及工作流节点未显式选模型时的默认值。学生端和教师端聊天页不受这里影响。"
            type="info"
            :closable="false"
            show-icon
            class="config-alert"
          />

          <el-form :model="form" label-position="top" class="config-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="模型提供商">
                  <el-select v-model="form.llmProvider" style="width: 100%">
                    <el-option label="DeepSeek" value="deepseek" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="默认模型">
                  <el-select v-model="form.modelName" style="width: 100%">
                    <el-option label="deepseek-v4-flash" value="deepseek-v4-flash" />
                    <el-option label="deepseek-v4-pro" value="deepseek-v4-pro" />
                  </el-select>
                  <div class="form-tip">工作流节点未选模型时，自动回退到这里。</div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="API Key">
              <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
            </el-form-item>

            <el-row :gutter="24">
              <el-col :span="16">
                <el-form-item label="Base URL">
                  <el-input v-model="form.baseUrl" placeholder="https://api.deepseek.com/v1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="温度">
                  <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-tab-pane>

        <el-tab-pane name="storage" label="MinIO 存储">
          <el-alert
            title="系统已固定使用 MinIO，对象存储配置保存后会作为运行时默认值。"
            type="success"
            :closable="false"
            show-icon
            class="config-alert"
          />

          <el-form :model="form" label-position="top" class="config-form">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="Endpoint">
                  <el-input v-model="form.minioEndpoint" placeholder="http://localhost:9000" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Bucket">
                  <el-input v-model="form.minioBucket" placeholder="training-files" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="Access Key">
                  <el-input v-model="form.minioAccessKey" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Secret Key">
                  <el-input v-model="form.minioSecretKey" type="password" show-password />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Picture } from '@element-plus/icons-vue'
import { getSystemConfig, saveSystemConfig, uploadSystemLogo } from '@/api/admin/config'

const activeTab = ref('basic')
const saving = ref(false)
const uploadingLogo = ref(false)

const form = reactive({
  systemName: '智能实训案例生成与考核系统',
  icp: '',
  logoUrl: '',
  llmProvider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  modelName: 'deepseek-v4-flash',
  temperature: 0.7,
  storageType: 'minio',
  minioEndpoint: 'http://localhost:9000',
  minioAccessKey: '',
  minioSecretKey: '',
  minioBucket: 'training-files'
})

const loadConfig = async () => {
  try {
    const res = await getSystemConfig()
    if (res.code === 200 && res.data) {
      Object.keys(form).forEach((key) => {
        if (res.data[key] !== undefined && res.data[key] !== null) {
          form[key] = res.data[key]
        }
      })
      form.storageType = 'minio'
    }
  } catch (error) {
    console.error('Failed to load system config', error)
  }
}

const handleLogoUpload = async (file) => {
  uploadingLogo.value = true
  try {
    const res = await uploadSystemLogo(file)
    if (res.code === 200 && res.data?.logoUrl) {
      form.logoUrl = res.data.logoUrl
      ElMessage.success('Logo 上传成功')
    } else {
      ElMessage.error(res.message || 'Logo 上传失败')
    }
  } catch (error) {
    ElMessage.error('Logo 上传失败')
  } finally {
    uploadingLogo.value = false
  }
  return false
}

const handleSave = async () => {
  saving.value = true
  try {
    const { logoUrl, ...restForm } = form
    const payload = {
      ...restForm,
      llmProvider: 'deepseek',
      storageType: 'minio'
    }
    const res = await saveSystemConfig(payload)
    if (res.code === 200) {
      ElMessage.success('配置已保存')
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (error) {
    ElMessage.error('保存系统配置失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.system-config {
  max-width: 1200px;
  margin: 0 auto;
}

.config-card {
  border-radius: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.config-form {
  max-width: 860px;
  padding-top: 12px;
}

.config-alert {
  margin-bottom: 20px;
}

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo-preview {
  width: 96px;
  height: 96px;
  border: 1px dashed #dcdfe6;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f8fafc;
  color: #c0c4cc;
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
