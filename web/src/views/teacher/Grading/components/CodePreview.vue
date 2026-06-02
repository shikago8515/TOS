<template>
  <div class="code-preview-wrapper" :class="{ 'is-fullscreen': isFullscreen }" v-loading="loading">
    <div class="editor-container">
      <vue-monaco-editor
        v-model:value="localCode"
        :language="language"
        theme="vs"
        :options="editorOptions"
        class="monaco-editor-instance"
      />
    </div>
    
    <div class="floating-toolbar">
       <el-tag size="small" effect="dark" type="info" class="lang-tag">{{ language }}</el-tag>
       <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏查看'" placement="left" :teleported="false">
        <el-button 
          :icon="isFullscreen ? 'Close' : 'FullScreen'" 
          circle 
          size="small" 
          @click="toggleFullscreen"
          class="fullscreen-btn"
        />
       </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { FullScreen, Close } from '@element-plus/icons-vue'

const props = defineProps({
  code: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:code'])

const isFullscreen = ref(false)
const localCode = ref(props.code)

watch(() => props.code, (newVal) => {
  localCode.value = newVal
})

watch(localCode, (newVal) => {
  emit('update:code', newVal)
})

const editorOptions = computed(() => ({
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 14,
  fontFamily: "'Fira Code', 'Consolas', monospace",
  automaticLayout: true,
  wordWrap: 'on',
  lineNumbers: 'on',
  renderLineHighlight: 'all',
  padding: { top: 16, bottom: 16 }
}))

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}
</script>

<style scoped lang="scss">
.code-preview-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 125vw;
    height: 125vh;
    z-index: 2000;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }
  
  .floating-toolbar {
    position: absolute;
    top: 10px;
    right: 20px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0.8;
    transition: opacity 0.3s;
    
    &:hover {
      opacity: 1;
    }
    
    .lang-tag {
      text-transform: uppercase;
      opacity: 0.8;
    }
    
    .fullscreen-btn {
      background: rgba(255,255,255,0.9);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border: 1px solid #dcdfe6;
      
      &:hover {
        color: #409eff;
        border-color: #c6e2ff;
        background-color: #ecf5ff;
      }
    }
  }
}

.monaco-editor-instance {
  width: 100%;
  height: 100%;
}
</style>