<template>
  <div class="json-validator animate__animated animate__fadeIn">
    <el-card shadow="hover" class="validator-card">
      <template #header>
        <div class="validator-header">
          <div class="header-left">
            <el-icon class="icon"><DocumentChecked /></el-icon>
            <span class="title">JSON 格式验证器</span>
          </div>
          <el-tag 
            :type="validationResult.isValid ? 'success' : 'danger'"
            size="small"
            effect="dark"
            round
          >
            <el-icon class="mr-1">
              <CircleCheck v-if="validationResult.isValid" />
              <CircleClose v-else />
            </el-icon>
            {{ validationResult.isValid ? '格式正确' : '格式错误' }}
          </el-tag>
        </div>
      </template>

      <div class="validator-body">
        <!-- 输入区域 -->
        <div class="input-section">
          <el-input
            v-model="jsonInput"
            type="textarea"
            :rows="12"
            placeholder="请在此粘贴 JSON 内容进行验证..."
            @input="validateJson"
            class="code-editor"
            spellcheck="false"
          />
        </div>

        <!-- 验证结果 -->
        <transition name="el-zoom-in-top">
          <div v-if="jsonInput" class="validation-result">
            <el-divider content-position="left">验证结果</el-divider>
            
            <!-- 错误信息 -->
            <div v-if="!validationResult.isValid" class="error-section">
              <el-alert
                title="解析失败"
                type="error"
                :closable="false"
                show-icon
                effect="light"
              >
                <template #default>
                  <div class="error-detail">
                    <p class="error-msg">{{ validationResult.error }}</p>
                    <!-- 自动修复建议 -->
                    <div v-if="validationResult.suggestions.length > 0" class="suggestions">
                      <div class="suggestion-title"><el-icon><MagicStick /></el-icon> 修复建议：</div>
                      <ul class="suggestion-list">
                        <li v-for="(suggestion, index) in validationResult.suggestions" :key="index">
                          {{ suggestion }}
                        </li>
                      </ul>
                      <el-button 
                        type="warning" 
                        size="small" 
                        @click="autoFix"
                        :disabled="!canAutoFix"
                        icon="FirstAidKit"
                        class="mt-2"
                      >
                        尝试自动修复
                      </el-button>
                    </div>
                  </div>
                </template>
              </el-alert>
            </div>

            <!-- 成功信息 -->
            <div v-else class="success-section">
              <div class="preview-section">
                <div class="preview-header">
                  <span><el-icon><View /></el-icon> 格式化预览</span>
                  <el-button 
                    type="primary" 
                    size="small" 
                    link
                    @click="copyFormatted"
                    icon="CopyDocument"
                  >
                    复制
                  </el-button>
                </div>
                <div class="code-preview custom-scrollbar">
                  <pre><code>{{ formattedJson }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  DocumentChecked, CircleCheck, CircleClose, MagicStick, 
  FirstAidKit, View, CopyDocument 
} from '@element-plus/icons-vue'
import 'animate.css'

interface ValidationResult {
  isValid: boolean
  error: string
  suggestions: string[]
  fixedJson?: string
}

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits(['update:modelValue'])

const jsonInput = ref(props.modelValue || '')
const validationResult = ref<ValidationResult>({
  isValid: true,
  error: '',
  suggestions: []
})

watch(() => props.modelValue, (val) => {
  if (val !== jsonInput.value) {
    jsonInput.value = val || ''
    validateJson()
  }
})

const canAutoFix = computed(() => !!validationResult.value.fixedJson)

const formattedJson = computed(() => {
  if (!validationResult.value.isValid) return ''
  try {
    return JSON.stringify(JSON.parse(jsonInput.value), null, 2)
  } catch {
    return ''
  }
})

const validateJson = () => {
  emit('update:modelValue', jsonInput.value)
  
  if (!jsonInput.value.trim()) {
    validationResult.value = { isValid: true, error: '', suggestions: [] }
    return
  }

  try {
    JSON.parse(jsonInput.value)
    validationResult.value = { isValid: true, error: '', suggestions: [] }
  } catch (e: any) {
    const errorMsg = e.message
    const suggestions = []
    let fixedJson = undefined

    // 简单错误分析与修复尝试
    if (errorMsg.includes("Expected property name or '}' in JSON at position")) {
       suggestions.push('可能存在多余的逗号 (Trailing Comma)')
       // 尝试移除尾部逗号
       const fixed = jsonInput.value.replace(/,\s*([\]}])/g, '$1')
       try {
         JSON.parse(fixed)
         fixedJson = fixed
       } catch {}
    } else if (errorMsg.includes("Unexpected token")) {
       if (jsonInput.value.includes("'")) {
         suggestions.push("JSON 标准使用双引号，检测到单引号")
         const fixed = jsonInput.value.replace(/'/g, '"')
         try {
           JSON.parse(fixed)
           fixedJson = fixed
         } catch {}
       }
    }

    validationResult.value = {
      isValid: false,
      error: errorMsg,
      suggestions,
      fixedJson
    }
  }
}

const autoFix = () => {
  if (validationResult.value.fixedJson) {
    jsonInput.value = validationResult.value.fixedJson
    validateJson()
    ElMessage.success('已应用自动修复')
  }
}

const copyFormatted = () => {
  navigator.clipboard.writeText(formattedJson.value)
  ElMessage.success('已复制格式化 JSON')
}
</script>

<style scoped lang="scss">
.json-validator {
  width: 100%;
}

.validator-card {
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  
  .validator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      
      .icon {
        color: #409eff;
      }
    }
    
    .mr-1 { margin-right: 4px; }
  }
}

.input-section {
  .code-editor {
    :deep(.el-textarea__inner) {
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      background-color: #f8fafc;
      color: #334155;
      border-radius: 8px;
      
      &:focus {
        background-color: #fff;
        box-shadow: 0 0 0 1px #409eff inset;
      }
    }
  }
}

.validation-result {
  margin-top: 16px;
}

.error-detail {
  .error-msg {
    font-family: monospace;
    font-weight: 600;
    margin: 0 0 8px 0;
  }
  
  .suggestions {
    margin-top: 12px;
    background: rgba(255,255,255,0.5);
    padding: 12px;
    border-radius: 6px;
    
    .suggestion-title {
      font-size: 13px;
      font-weight: 600;
      color: #e6a23c;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
    }
    
    .suggestion-list {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      color: #606266;
      
      li { margin-bottom: 4px; }
    }
  }
}

.preview-section {
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
  }
  
  .code-preview {
    padding: 12px;
    max-height: 300px;
    overflow: auto;
    
    pre {
      margin: 0;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      color: #334155;
    }
  }
}

.mt-2 { margin-top: 8px; }
</style>