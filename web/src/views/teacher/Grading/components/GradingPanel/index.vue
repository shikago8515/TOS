<template>
  <div class="grading-panel-wrapper" v-loading="loading">
    <div v-if="!task" class="empty-state">
      <div class="empty-icon-bg">
        <el-icon><EditPen /></el-icon>
      </div>
      <h3>开始批改</h3>
      <p>请从左侧列表选择一个任务开始批改</p>
    </div>

    <div v-else class="grading-workspace">
      <!-- 中间主区域：代码与AI分析 -->
      <div class="workspace-main">
        <div class="main-header">
          <div class="file-info" v-if="isFilePreviewable">
            <div class="file-icon">
              <el-icon><Document /></el-icon>
            </div>
            <span class="filename">{{ archiveDisplayName }}</span>
            <el-tag size="small" effect="plain" class="ml-2">{{ archiveTypeLabel }}</el-tag>
          </div>
          <div class="header-actions">
            <el-button v-if="isFilePreviewable" link type="primary" @click="$emit('download')">
              <el-icon><Download /></el-icon> 下载源码
            </el-button>
          </div>
        </div>

        <div class="main-tabs-container">
          <el-tabs v-model="activeTab" class="grading-tabs">
            <el-tab-pane name="source">
              <template #label>
                <span class="tab-label"><el-icon><Platform /></el-icon> {{ isNonCode ? '提交内容' : '源代码' }}</span>
              </template>
              <SourceView 
                :fileContent="fileContent"
                :submission="submission"
                :fileLoading="fileLoading"
              />
            </el-tab-pane>
            
            <el-tab-pane name="result" v-if="!isNonCode">
              <template #label>
                <span class="tab-label"><el-icon><VideoPlay /></el-icon> 运行结果</span>
              </template>
              <div class="tab-content code-content">
                <CodePreview
                  :code="runResultContent"
                  language="json"
                  :loading="fileLoading"
                />
              </div>
            </el-tab-pane>

            <el-tab-pane name="attachments" v-if="isNonCode && attachments && attachments.length > 0">
              <template #label>
                <span class="tab-label"><el-icon><Paperclip /></el-icon> 附件清单</span>
              </template>
              <div class="tab-content attachment-content">
                <div class="attachment-list">
                  <div
                    v-for="(att, idx) in attachments"
                    :key="idx"
                    class="attachment-item"
                  >
                    <el-icon class="att-icon"><Document /></el-icon>
                    <span class="att-name" :title="att.fileName">{{ att.fileName || '未命名' }}</span>
                    <el-tag size="small" effect="plain" class="att-type">{{ att.fileType || '-' }}</el-tag>
                    <span class="att-size">{{ formatSize(att.fileSize) }}</span>
                    <a
                      v-if="att.filePath"
                      :href="att.filePath"
                      target="_blank"
                      class="att-link"
                    >下载</a>
                  </div>
                </div>
                <el-empty v-if="!attachments || attachments.length === 0" description="暂无附件" />
              </div>
            </el-tab-pane>

            <el-tab-pane name="ai">
              <template #label>
                <span class="tab-label"><el-icon><MagicStick /></el-icon> AI 分析报告</span>
              </template>
              <div class="tab-content ai-content">
                <el-scrollbar>
                  <AiReport 
                    :aiResult="aiResult"
                    :aiProcess="aiProcess"
                  />
                </el-scrollbar>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- Resizer -->
      <div 
        class="workspace-resizer" 
        @mousedown="startRightResize"
        :class="{ 'is-resizing': isRightResizing }"
      ></div>

      <!-- 右侧侧边栏：评分表单 -->
      <GradingSidebar
        :width="rightSidebarWidth"
        :task="task"
        :aiResult="aiResult"
        :gradingDetails="gradingDetails"
        :finalFeedback="finalFeedback"
        :submitting="submitting"
        @update:finalFeedback="(val) => $emit('update:finalFeedback', val)"
        @adopt-ai-score="$emit('adopt-ai-score')"
        @submit="$emit('submit')"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  Document, Download, Platform, VideoPlay, MagicStick, EditPen, Paperclip
} from '@element-plus/icons-vue'
import SourceView from './components/SourceView.vue'
import AiReport from './components/AiReport.vue'
import GradingSidebar from './components/GradingSidebar.vue'
import CodePreview from '../CodePreview.vue'

const props = defineProps({
  task: Object,
  submission: Object,
  aiResult: Object,
  aiProcess: Object,
  gradingDetails: {
    type: Array,
    default: () => []
  },
  finalFeedback: String,
  loading: Boolean,
  fileContent: String,
  fileLoading: Boolean,
  submitting: Boolean,
  isNonCode: {
    type: Boolean,
    default: false
  },
  attachments: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:finalFeedback', 'download', 'adopt-ai-score', 'submit'])

const activeTab = ref('source')

const rightSidebarWidth = ref(320)
const isRightResizing = ref(false)

const startRightResize = (e) => {
  isRightResizing.value = true
  const startX = e.clientX
  const startWidth = rightSidebarWidth.value
  
  const handleMouseMove = (e) => {
    const delta = startX - e.clientX 
    const newWidth = startWidth + delta
    if (newWidth >= 250 && newWidth <= 600) {
      rightSidebarWidth.value = newWidth
    }
  }
  
  const handleMouseUp = () => {
    isRightResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

const isFilePreviewable = computed(() => {
  return Boolean(
    (props.fileContent && props.fileContent.trim()) ||
    props.submission?.filePath ||
    props.submission?.fileName
  )
})

const archiveDisplayName = computed(() => {
  const name = String(props.submission?.fileName || '').trim()
  if (!name) {
    return `submission-${props.submission?.id || 'latest'}-source.zip`
  }
  if (name.toLowerCase() === 'mcp-source.json' || name.toLowerCase().endsWith('.json')) {
    return `submission-${props.submission?.id || 'latest'}-source.zip`
  }
  return name
})

const archiveTypeLabel = computed(() => {
  const fileType = String(props.submission?.fileType || '').trim()
  if (fileType) {
    return fileType.toUpperCase()
  }
  const name = String(props.submission?.fileName || '').toLowerCase()
  if (name.includes('.')) {
    return name.split('.').pop().toUpperCase()
  }
  return 'ZIP'
})

const extractSection = (text, startMarker, endMarker) => {
  if (!text) return ''
  const start = text.indexOf(startMarker)
  if (start < 0) return ''
  const from = start + startMarker.length
  const to = endMarker ? text.indexOf(endMarker, from) : -1
  const section = to >= 0 ? text.substring(from, to) : text.substring(from)
  return section.trim()
}

const runResultContent = computed(() => {
  if (props.aiResult?.runResult !== undefined && props.aiResult?.runResult !== null) {
    if (typeof props.aiResult.runResult === 'object') {
      return JSON.stringify(props.aiResult.runResult, null, 2)
    }
    try {
      return JSON.stringify(JSON.parse(props.aiResult.runResult), null, 2)
    } catch (e) {
      return String(props.aiResult.runResult)
    }
  }

  const runSection = extractSection(props.fileContent || '', '## RUN_RESULT', '## FOCUSED_SOURCE_FILES')
  if (!runSection) {
    return '{\n  "message": "暂无运行结果快照"\n}'
  }

  try {
    return JSON.stringify(JSON.parse(runSection), null, 2)
  } catch (e) {
    return runSection
  }
})

const formatSize = (bytes) => {
  const n = Number(bytes || 0)
  if (n <= 0) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped lang="scss">
$primary-color: #10b981;
$primary-light: #ecfdf5;
$text-main: #1f2937;
$text-secondary: #6b7280;
$border-color: #e5e7eb;

.grading-panel-wrapper {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  font-size: 17px;

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-textarea__inner),
  :deep(.el-tabs__item),
  :deep(.el-tag) {
    font-size: 16px;
  }
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-secondary;
  
  .empty-icon-bg {
    width: 80px;
    height: 80px;
    background: $primary-light;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    
    .el-icon {
      font-size: 40px;
      color: $primary-color;
    }
  }
  
  h3 {
    font-weight: 500;
    margin-bottom: 10px;
    color: $text-main;
  }
}

.grading-workspace {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.workspace-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid $border-color;
  background: #fff;
  overflow: hidden;
  
  .main-header {
    height: 40px;
    padding: 0 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid $border-color;
    background: #fff;
    
    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .file-icon {
        color: $primary-color;
        font-size: 18px;
      }
      
      .filename {
        font-weight: 500;
        color: $text-main;
        font-size: 17px;
      }
    }
  }
  
  .main-tabs-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    
    :deep(.el-tabs__header) {
      margin: 0;
      padding: 0 20px;
      background: #fafafa;
      border-bottom: 1px solid $border-color;
    }
    
    :deep(.el-tabs__content) {
      flex: 1;
      overflow: hidden;
      padding: 0;
      height: 100%;
    }
    
    :deep(.el-tab-pane) {
      height: 100%;
    }
  }
}

.workspace-resizer {
  width: 4px;
  background: #e5e7eb;
  cursor: col-resize;
  position: relative;
  z-index: 10;
  transition: background 0.2s;
  flex-shrink: 0;
  
  &:hover, &.is-resizing {
    background: $primary-color;
  }
}

.tab-content {
  height: 100%;
  overflow: hidden;
  
  &.code-content {
    background: #fff;
  }
  
  &.ai-content {
    background: #fdfdfd;
  }
}

.grading-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .tab-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.attachment-content {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid $border-color;
  border-radius: 8px;
  
  .att-icon {
    color: $text-secondary;
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .att-name {
    flex: 1;
    font-size: 17px;
    color: $text-main;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .att-type {
    font-size: 14px;
    color: $text-secondary;
    text-transform: uppercase;
    background: #e5e7eb;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  
  .att-size {
    font-size: 15px;
    color: #9ca3af;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .att-link {
    font-size: 15px;
    color: $primary-color;
    text-decoration: none;
    flex-shrink: 0;
    &:hover { text-decoration: underline; }
  }
}
</style>
