<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="(val) => $emit('update:visible', val)"
    title="上传教材资料" 
    width="520px" 
    :teleported="false"
    align-center 
    class="custom-upload-dialog" 
    :close-on-click-modal="false"
    destroy-on-close
    @close="handleClose"
    :append-to-body="false"
  >
    <div class="upload-container">
      <!-- 初始上传表单状态 -->
      <transition name="fade-scale" mode="out-in">
        <div v-if="!uploading" class="upload-form-view" key="form">
          <div class="form-section">
            <label class="input-label">资料名称</label>
            <el-input 
              v-model="uploadForm.name" 
              placeholder="请输入教材/资料名称，例如《计算机网络 第8版》" 
              size="large"
              class="custom-input"
            />
          </div>
          
          <div class="form-section">
            <label class="input-label">选择文件</label>
            <div 
              class="file-drop-zone"
              :class="{ 'has-file': !!uploadFile }"
            > 
             <el-upload
                ref="uploadRef"
                drag
                action="#"
                :auto-upload="false"
                :limit="1"
                :show-file-list="false"
               :accept="SUPPORTED_ACCEPT"
                :on-change="handleFileChange"
                class="uploader-wrapper"
              >
                <div class="drop-content" v-if="!uploadFile">
                  <div class="icon-circle">
                    <el-icon><UploadFilled /></el-icon>
                  </div>
                  <div class="text-group">
                    <p class="primary-text">点击或拖拽文件到这里</p>
                    <p class="sub-text">支持 {{ SUPPORTED_TYPES_TEXT }}，最大 {{ MAX_FILE_SIZE_MB }}MB</p>
                  </div>
                </div>
                
                <div class="file-preview" v-else @click.stop>
                   <div class="file-icon"><el-icon><Document /></el-icon></div>
                   <div class="file-info">
                     <span class="filename" :title="uploadFile.name">{{ uploadFile.name }}</span>
                     <span class="filesize">{{ (uploadFile.size / 1024 / 1024).toFixed(2) }} MB</span>
                   </div>
                   <el-button link type="danger" @click.stop="removeFile">
                     <el-icon><Close /></el-icon>
                   </el-button>
                </div>
              </el-upload>
            </div>
          </div>
        </div>
      
        <!-- 上传/解析进度状态 -->
        <div v-else class="upload-progress-view" key="progress">
          <div class="progress-header">
            <div class="status-icon-wrapper" :class="{ 'parsing': uploadProgress === 100 }">
              <el-icon v-if="uploadProgress < 100"><Upload /></el-icon>
              <el-icon v-else class="spin-icon"><Loading /></el-icon>
            </div>
            <h3>{{ uploadProgress < 100 ? '正在上传文件...' : '正在智能解析...' }}</h3>
            <p class="status-desc">{{ uploadProgress < 100 ? '请保持网络连接' : 'AI 正在构建知识图谱，这可能需要一点时间' }}</p>
          </div>
          
          <div class="progress-bar-container">
            <el-progress 
              :percentage="uploadProgress" 
              :stroke-width="8" 
              :show-text="false"
              status="success"
              class="custom-progress"
            />
          </div>

          <!-- 解析日志窗口 -->
          <div class="parse-log-window" v-if="uploadProgress === 100">
            <div class="log-header">
              <el-icon><Document /></el-icon>
              <span>解析日志</span>
            </div>
            <div class="log-body custom-scroll" ref="logContainerRef">
              <div v-if="parseLogs.length === 0" class="log-line waiting">
                <el-icon class="is-loading"><Loading /></el-icon> 等待服务器响应...
              </div>
              <div v-for="(log, index) in parseLogs" :key="index" class="log-line">
                <span class="timestamp">{{ log.time }}</span>
                <span :class="['message', log.type]">{{ log.message }}</span>
              </div>
            </div>
          </div>
           
           <div class="background-actions" v-if="uploadProgress === 100">
             <el-button type="default" plain size="small" @click="handleBackgroundClose">
               后台处理，稍后查看
             </el-button>
           </div>
        </div>
      </transition>
    </div>

    <template #footer>
      <div v-if="!uploading" class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" size="large" class="cancel-btn">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleUpload" 
          :disabled="!uploadFile || !uploadForm.name"
          size="large"
          class="submit-btn"
        >
          立即上传
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Close, Loading, Upload, Document } from '@element-plus/icons-vue'
import { uploadTextbook } from '@/api/teacher/textbook'
import { getAuthToken } from '@/utils/authStorage'

const props = defineProps({
  visible: { type: Boolean, default: false },
  courseId: { type: [String, Number], required: true }
})

const emit = defineEmits(['update:visible', 'success', 'background-processing-change'])

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt']
const SUPPORTED_ACCEPT = '.pdf,.docx,.doc,.txt'
const SUPPORTED_TYPES_TEXT = 'PDF(.pdf)、DOCX(.docx)、DOC(.doc)、TXT(.txt)'
const MAX_FILE_SIZE_MB = 200
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const uploading = ref(false)
const uploadProgress = ref(0)
const uploadForm = ref({ name: '' })
const uploadFile = ref(null)
const uploadRef = ref(null)
const parseLogs = ref([])
const logContainerRef = ref(null)
const backgroundProcessing = ref(false)

let logEventSource = null

const clearSelectedFile = () => {
  uploadFile.value = null
  uploadRef.value?.clearFiles?.()
}

const isFileTooLarge = (file) => {
  const fileSize = file?.size || file?.raw?.size || 0
  return fileSize > MAX_FILE_SIZE_BYTES
}

const handleFileChange = (file) => {
  const extension = (file?.name?.split('.').pop() || '').toLowerCase()
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    ElMessage.warning(`文件类型不支持，仅支持 ${SUPPORTED_TYPES_TEXT}`)
    clearSelectedFile()
    return
  }

  if (isFileTooLarge(file)) {
    ElMessage.warning(`文件过大，请选择不超过 ${MAX_FILE_SIZE_MB}MB 的文件`)
    clearSelectedFile()
    return
  }

  uploadFile.value = file.raw
  if (!uploadForm.value.name && file.name) {
    // 自动移除扩展名作为名称
    uploadForm.value.name = file.name.replace(/\.[^/.]+$/, "")
  }
}

const removeFile = () => {
  clearSelectedFile()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

const handleUpload = async () => {
  if (!props.courseId) return ElMessage.warning('课程ID缺失')
  if (!uploadFile.value) return ElMessage.warning('请选择文件')
  if (isFileTooLarge(uploadFile.value)) {
    clearSelectedFile()
    return ElMessage.warning(`文件过大，请选择不超过 ${MAX_FILE_SIZE_MB}MB 的文件`)
  }
  
  backgroundProcessing.value = false
  emit('background-processing-change', false)
  uploading.value = true
  uploadProgress.value = 0
  parseLogs.value = []

  try {
    const res = await uploadTextbook(
      props.courseId, 
      uploadForm.value.name, 
      uploadFile.value,
      (e) => {
        if (e.total) {
          uploadProgress.value = Math.round((e.loaded * 100) / e.total)
        }
      }
    )
    
    uploadProgress.value = 100
    
    // 连接 SSE 监听解析进度
    if (res.data && res.data.id) {
       startLogListener(res.data.id)
    } else {
       setTimeout(() => {
         emit('success')
         finishAndReset('上传成功')
       }, 1000)
    }
  } catch (e) {
    uploading.value = false
    const rawMessage =
      e?.rawResponse?.message ||
      e?.response?.data?.message ||
      e?.message ||
      ''
    const normalizedMessage = String(rawMessage).toLowerCase()
    const isTooLarge =
      e?.response?.status === 413 ||
      normalizedMessage.includes('maximum upload size') ||
      normalizedMessage.includes('maxuploadsizeexceeded') ||
      normalizedMessage.includes('size limit') ||
      normalizedMessage.includes('file too large') ||
      normalizedMessage.includes('request entity too large')

    if (isTooLarge) {
      clearSelectedFile()
      ElMessage.error(`文件过大，请选择不超过 ${MAX_FILE_SIZE_MB}MB 的文件`)
    } else {
      ElMessage.error(rawMessage || '上传失败，请稍后重试')
    }
  }
}

const startLogListener = (textbookId) => {
    const backendURL = 'http://localhost:8080/training-system'
  const token = getAuthToken('TEACHER')
    logEventSource = new EventSource(`${backendURL}/api/teacher/textbooks/${textbookId}/logs?token=${token}`)
    
    logEventSource.addEventListener('connected', (event) => {
      console.log('SSE连接已建立:', event.data)
    })
    
    logEventSource.addEventListener('log', (event) => {
      try {
        const log = JSON.parse(event.data)
        const newLog = {
          time: new Date().toLocaleTimeString('en-GB'),
          message: log.message || event.data,
          type: 'info'
        }
        parseLogs.value.push(newLog)
        scrollToBottom()
      } catch (e) {
        parseLogs.value.push({ 
          time: new Date().toLocaleTimeString('en-GB'), 
          message: event.data, 
          type: 'raw' 
        })
        scrollToBottom()
      }
    })
    
    logEventSource.addEventListener('complete', (event) => {
      setTimeout(() => {
        emit('success')
        finishAndReset('解析成功完成')
      }, 1000)
    })
    
    logEventSource.addEventListener('error', (event) => {
      // SSE错误或连接关闭
      logEventSource?.close()
    })
    
    logEventSource.onerror = () => {
      logEventSource?.close()
    }
}

const resetUploadState = () => {
  uploading.value = false
  uploadProgress.value = 0
  uploadForm.value.name = ''
  clearSelectedFile()
  parseLogs.value = []
  backgroundProcessing.value = false
  emit('background-processing-change', false)
  if (logEventSource) {
    logEventSource.close()
    logEventSource = null
  }
}

const finishAndReset = (message) => {
  emit('update:visible', false)
  resetUploadState()
  if (message) {
    ElMessage.success(message)
  }
}

const handleBackgroundClose = () => {
  backgroundProcessing.value = true
  emit('background-processing-change', true)
  emit('update:visible', false)
  ElMessage.info('解析已转为后台处理，可随时重新打开查看进度')
}

const handleClose = () => {
  emit('update:visible', false)
  if (uploading.value) {
    backgroundProcessing.value = true
    emit('background-processing-change', true)
    return
  }
  setTimeout(() => {
    resetUploadState()
  }, 300)
}
</script>

<style lang="scss">
.custom-upload-dialog {
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
  
  .el-dialog__header {
    margin: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #ebeef5;
    background: #ffffff;
    
    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  .el-dialog__body {
    padding: 0;
    background: #ffffff;
  }
  
  .el-dialog__footer {
    padding: 16px 24px;
    border-top: 1px solid #ebeef5;
    background: #ffffff;
  }
}
</style>

<style lang="scss" scoped>
.upload-container {
  padding: 24px;
  min-height: 320px;
}

.form-section {
  margin-bottom: 24px;
  
  .input-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #606266;
    margin-bottom: 8px;
  }
}

.custom-input {
  :deep(.el-input__wrapper) {
    background-color: #ffffff;
    border-radius: 4px;
    box-shadow: 0 0 0 1px #dcdfe6 inset !important;
    padding: 8px 12px;
    transition: all 0.3s ease;
    
    &:hover {
      box-shadow: 0 0 0 1px #c0c4cc inset !important;
    }
    &.is-focus {
      box-shadow: 0 0 0 1px #409EFF inset !important;
    }
  }
}

.file-drop-zone {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  transition: all 0.3s ease;
  background: #fafafa;
  
  &:hover {
    border-color: #409EFF;
    background: #f5f7fa;
  }
  
  &.has-file {
    border-style: solid;
    border-color: #ebeef5;
    background: #ffffff;
    &:hover {
      border-color: #ebeef5;
      background: #ffffff;
    }
  }
  
  :deep(.el-upload-dragger) {
    border: none;
    background: transparent;
    padding: 40px 20px;
    width: 100%;
    height: auto;
    
    &.is-dragover {
      background: rgba(64, 158, 255, 0.05);
    }
  }
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .icon-circle {
    width: 64px;
    height: 64px;
    background: #ecf5ff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #409EFF;
    font-size: 32px;
    margin-bottom: 16px;
    transition: transform 0.3s ease;
  }
  
  &:hover .icon-circle {
    transform: scale(1.05);
  }
  
  .primary-text {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
    margin: 0 0 8px;
  }
  
  .sub-text {
    font-size: 13px;
    color: #909399;
    margin: 0;
  }
}

.file-preview {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
  
  .file-icon {
    width: 48px;
    height: 48px;
    background: #f4f4f5;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #909399;
  }
  
  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    
    .filename {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .filesize {
      font-size: 12px;
      color: #909399;
    }
  }
}

/* Progress View State */
.upload-progress-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0;
}

.progress-header {
  margin-bottom: 24px;
  
  .status-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #ecf5ff;
    color: #409EFF;
    font-size: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    
    &.parsing {
      background: #f0f9eb;
      color: #67C23A;
    }
  }
  
  h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
  
  .status-desc {
    margin: 0;
    color: #909399;
    font-size: 14px;
  }
}

.progress-bar-container {
  width: 100%;
  max-width: 360px;
  margin-bottom: 24px;
}

.parse-log-window {
  width: 100%;
  background: #f8f9fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
  text-align: left;

  .log-header {
    background: #f5f7fa;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid #ebeef5;
    font-size: 13px;
    color: #606266;
    font-weight: 500;
  }
  
  .log-body {
    height: 160px;
    padding: 12px;
    font-size: 13px;
    color: #606266;
    overflow-y: auto;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: #dcdfe6;
      border-radius: 3px;
    }
    
    .log-line {
      margin-bottom: 6px;
      line-height: 1.5;
      display: flex;
      gap: 8px;
      
      .timestamp {
        color: #909399;
        font-size: 12px;
        flex-shrink: 0;
      }
      
      .message {
        word-break: break-all;
      }
      
      &.waiting { 
        color: #909399; 
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
  }
}

.spin-icon {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* Transitions */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.submit-btn {
  padding: 8px 24px;
  border-radius: 4px;
}

.cancel-btn {
  border-radius: 4px;
}
</style>
