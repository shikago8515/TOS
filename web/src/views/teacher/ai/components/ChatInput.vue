<template>
  <div class="chat-input-container">
    <!-- 附件列表 -->
    <transition-group name="list" tag="div" v-if="uploadedFiles && uploadedFiles.length > 0" class="file-list">
      <el-tag
        v-for="(file, index) in uploadedFiles"
        :key="index"
        closable
        class="file-item"
        @close="$emit('remove-file', index)"
        effect="light"
      >
        <el-icon class="mr-1"><Document /></el-icon>
        {{ file.name }}
      </el-tag>
    </transition-group>

    <div class="input-card shadow-lg compact-mode">
      <el-input
        v-model="inputValue"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 8 }"
        :placeholder="placeholder"
        :disabled="disabled"
        resize="none"
        class="custom-textarea"
        @keydown.enter.prevent="handleEnter"
      />
      
      <div class="input-actions-bottom">
        <div class="left-actions">
          <el-upload
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileChange"
            multiple
            class="upload-btn"
          >
            <el-tooltip
              content="上传附件"
              placement="top"
              :teleported="false"
            >
              <el-button circle plain size="small" class="icon-btn action-btn">
                <el-icon><Plus /></el-icon>
              </el-button>
            </el-tooltip>
          </el-upload>
          <div class="divider"></div>
          <el-select 
            v-model="localSelectedModel" 
            size="small" 
            class="inline-model-select" 
            placeholder="选择模型"
            :teleported="false"
          >
            <template #prefix>
              <el-icon><Cpu /></el-icon>
            </template>
            <el-option
              v-for="model in availableModels"
              :key="model"
              :label="model"
              :value="model"
            />
          </el-select>
        </div>
        
        <el-button
          v-if="isGenerating"
          type="danger"
          circle
          @click="$emit('stop')"
          class="stop-btn-circle"
        >
          <el-icon><VideoPause /></el-icon>
        </el-button>

        <el-button 
          v-else
          type="primary" 
          circle
          @click="handleSubmit" 
          :disabled="!inputValue.trim() || disabled"
          class="send-btn-circle"
        >
          <el-icon><Promotion /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Paperclip, Promotion, Document, VideoPause, Cpu, Plus } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  selectedModel: {
    type: String,
    default: 'deepseek-v4-flash'
  },
  availableModels: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '请输入您的问题 (按 Enter 发送, Shift + Enter 换行)'
  },
  uploadedFiles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'update:selectedModel', 'update:uploadedFiles', 'send', 'stop', 'remove-file', 'show-history', 'new-chat'])

const inputValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const localSelectedModel = computed({
  get: () => props.selectedModel,
  set: (val) => emit('update:selectedModel', val)
})

const handleEnter = (e) => {
  if (e.shiftKey) return
  handleSubmit()
}

const handleSubmit = () => {
  if (!inputValue.value.trim() || props.disabled) return
  emit('send', inputValue.value)
}

const handleFileChange = (file) => {
  const newFiles = [...props.uploadedFiles, file]
  emit('update:uploadedFiles', newFiles)
}
</script>

<style scoped lang="scss">
.chat-input-container {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
  padding: 8px 20px 20px;
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 4px;
  
  .file-item {
    border-radius: 8px;
    background: white;
    border: 1px solid #e4e7ed;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    display: flex;
    align-items: center;
    
    .mr-1 {
      margin-right: 4px;
    }
  }
}

.input-card {
  background: #fff;
  border-radius: 20px; 
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  &:focus-within {
    border-color: #409eff;
    box-shadow: 0 8px 24px rgba(64, 158, 255, 0.12);
  }
  
  .input-actions-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 4px;
    
    .left-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      
      .action-btn {
        width: 32px;
        height: 32px;
        font-size: 16px;
        color: #1e293b;
      }
      
      .divider {
        width: 1px;
        height: 16px;
        background-color: #e2e8f0;
        margin: 0 4px;
      }
      
      .inline-model-select {
        width: 165px;
        :deep(.el-input__wrapper) {
          box-shadow: none !important;
          background: #f1f5f9;
          border-radius: 16px;
          padding: 0 14px;
          height: 32px;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s;
          
          &:hover {
            background: #e2e8f0;
            color: #0f172a;
          }
        }
        :deep(.el-input__inner) {
          cursor: pointer;
          font-weight: 500;
          color: inherit;
        }
        :deep(.el-input__prefix) {
          color: #3b82f6;
        }
      }
      
      .icon-btn {
        border: none;
        background: transparent;
        transition: all 0.2s;
        border-radius: 8px;
        
        &:hover {
          background: #f1f5f9;
        }
      }
    }
    
    .send-btn-circle {
      width: 36px;
      height: 36px;
      font-size: 16px;
      background: #f1f5f9;
      border-color: transparent;
      color: #94a3b8;
      transition: all 0.3s;
      
      &:not(:disabled) {
        background: #1e293b;
        color: #fff;
        
        &:hover {
          background: #0f172a;
          transform: translateY(-1px);
        }
      }
    }
  }
}

.custom-textarea {
  flex: 1;
  display: flex;
  align-items: center;
  
  :deep(.el-textarea__inner) {
    border: none;
    box-shadow: none;
    padding: 4px 0;
    font-size: 14px;
    line-height: 22px;
    min-height: 30px !important;
    color: #1d1d1f;
    background: transparent;
    
    &::placeholder {
      color: #909399;
      line-height: 24px;
    }
    
    &::-webkit-scrollbar {
      width: 0; // 隐藏滚动条但保留功能
    }
  }
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .upload-btn {
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    :deep(.el-upload) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }

    :deep(.el-tooltip__trigger) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }
  }
  
  .left-actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding-right: 12px;
    border-right: 1px solid #eee;
    
    > * {
      flex: 0 0 auto;
    }
    
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-width: 32px;
      flex: 0 0 32px;
      line-height: 1;
      color: #909399;
      border: none;
      background: transparent;
      padding: 0;
      height: 32px;
      width: 32px;
      transition: background-color 0.2s ease, color 0.2s ease;

      :deep(.el-icon) {
        margin: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      
      &:hover {
        color: #409eff;
        background: rgba(64, 158, 255, 0.1);
      }

      &:hover,
      &:focus,
      &:active {
        transform: none;
      }
    }
  }
  
  .send-btn-circle {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #409eff 0%, #007AFF 100%);
    border: none;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
    transition: all 0.3s;
    
    &:not(:disabled):hover {
      transform: scale(1.05) rotate(-10deg);
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
    }
    
    .el-icon {
      font-size: 18px;
    }
  }

  .stop-btn-circle {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3);

    .el-icon {
      font-size: 18px;
    }
  }
}

// 列表动画
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
