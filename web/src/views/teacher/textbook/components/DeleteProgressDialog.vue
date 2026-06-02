<template>
  <el-dialog 
    :model-value="visible" 
    width="480px" 
    :teleported="false"
    align-center 
    :close-on-click-modal="false" 
    :show-close="!deleting"
    class="custom-delete-dialog"
    :show-header="false"
    @update:model-value="(val) => $emit('update:visible', val)"
    :append-to-body="false"
  >
    <div class="delete-progress-view">
      <div class="progress-header">
         <div class="icon-wrapper" :class="{ 'is-completed': !deleting }">
           <el-icon v-if="deleting" class="rotating"><Loading /></el-icon>
           <el-icon v-else><Delete /></el-icon>
         </div>
         <h3>{{ deleting ? '正在彻底删除教材' : '删除已完成' }}</h3>
         <p>{{ deleting ? '系统正在清理文件存储、向量数据库索引及相关记录，请保持网络连接...' : '所有相关资源已安全释放' }}</p>
      </div>
      
      <!-- 删除日志显示 -->
      <div class="delete-log-window">
        <div class="log-content" ref="deleteLogRef">
          <div v-for="(log, index) in logs" :key="index" class="terminal-line">
            <span class="prompt">&gt;</span>
            <span class="cmd">{{ log.message }}</span>
            <span class="timestamp">{{ log.time }}</span>
          </div>
          <div v-if="logs.length === 0 && deleting" class="terminal-line waiting">
            <span class="prompt">_</span>
            <span class="cmd">正在初始化清理进程...</span>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
       <div class="dialog-footer-center" v-if="!deleting">
          <el-button type="success" @click="$emit('update:visible', false)" size="large" style="width: 100%">确认并关闭</el-button>
       </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Loading, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Boolean,
    default: false
  },
  logs: {
    type: Array,
    default: () => []
  }
})

defineEmits(['update:visible'])

const deleteLogRef = ref(null)

watch(() => props.logs, () => {
  nextTick(() => {
    if (deleteLogRef.value) {
      deleteLogRef.value.scrollTop = deleteLogRef.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<style lang="scss">
.custom-delete-dialog {
  border-radius: 8px;
  overflow: hidden;
  
  .el-dialog__header {
    display: none;
  }
  
  .el-dialog__body {
    padding: 0;
  }
  
  .el-dialog__footer {
    padding: 16px 24px;
    border-top: 1px solid #ebeef5;
    background: #ffffff;
  }
}
</style>

<style lang="scss" scoped>
.delete-progress-view {
  background: #ffffff;
  overflow: hidden;

  .progress-header {
    background: #ffffff;
    padding: 32px 24px 20px;
    text-align: center;
    border-bottom: 1px solid #ebeef5;

    .icon-wrapper {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: #fef0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f56c6c;
      font-size: 32px;
      transition: all 0.3s ease;
      
      &.is-completed {
        background: #f0f9eb;
        color: #67c23a;
        transform: scale(1.05);
      }
      
      .rotating { animation: spin 2s linear infinite; }
    }

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 8px;
    }

    p {
      font-size: 14px;
      color: #909399;
      margin: 0;
      line-height: 1.5;
    }
  }

  .delete-log-window {
    background: #1e1e1e; 
    padding: 16px;
    height: 200px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    
    .log-content {
      height: 100%;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
      
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: #606266; border-radius: 3px; }

      .terminal-line {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
        line-height: 1.5;
        
        .prompt { color: #67c23a; font-weight: bold; }
        .cmd { color: #d4d4d4; flex: 1; }
        .timestamp { color: #909399; font-size: 12px; }
        
        &.waiting {
          color: #909399;
          .prompt { animation: blink 1s infinite; }
        }
      }
    }
  }
}

.dialog-footer-center {
  display: flex;
  justify-content: center;
}

@keyframes spin { 100% { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style>
