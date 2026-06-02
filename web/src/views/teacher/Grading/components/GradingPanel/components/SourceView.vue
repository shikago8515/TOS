<template>
  <div class="tab-content code-content">
    <div v-if="isFilePreviewable" class="source-explorer-layout">
      <div class="source-tree-panel" :style="{ width: sidebarWidth + 'px' }">
        <div class="tree-toolbar">
          <el-radio-group v-model="activeSourceBucket" size="small">
            <el-radio-button label="backend">后端 ({{ backendSourceCount }})</el-radio-button>
            <el-radio-button label="frontend">前端 ({{ frontendSourceCount }})</el-radio-button>
          </el-radio-group>
        </div>
        <el-scrollbar class="tree-scrollbar">
          <el-tree
            :data="activeSourceTree"
            node-key="id"
            default-expand-all
            :expand-on-click-node="false"
            :highlight-current="true"
            @node-click="handleSourceNodeClick"
            :indent="16"
            class="custom-tree"
          >
            <template #default="{ data }">
              <div class="tree-node-row">
                <el-icon v-if="data.type === 'folder'" class="tree-node-icon folder"><Folder /></el-icon>
                <el-icon v-else class="tree-node-icon file"><Document /></el-icon>
                <span class="tree-node-label" :title="data.label">{{ data.label }}</span>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
      </div>

      <!-- Resizer Handle -->
      <div 
        class="resize-handle" 
        @mousedown="startResize"
        :class="{ 'is-resizing': isResizing }"
      ></div>

      <div class="source-preview-panel">
        <div class="source-preview-header">
          <span class="path-label">{{ selectedSourceFile?.displayPath || '请选择文件' }}</span>
        </div>
        <CodePreview
          :code="selectedSourceContent"
          :language="selectedSourceLanguage"
          :loading="fileLoading"
        />
      </div>
    </div>
    <el-empty v-else description="暂无预览文件" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Folder, Document } from '@element-plus/icons-vue'
import CodePreview from '../../CodePreview.vue'

const props = defineProps({
  fileContent: String,
  submission: Object,
  fileLoading: Boolean
})

const activeSourceBucket = ref('backend')
const selectedSourceFilePath = ref('')
const sidebarWidth = ref(260)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const isFilePreviewable = computed(() => {
  return Boolean(
    (props.fileContent && props.fileContent.trim()) ||
    props.submission?.filePath ||
    props.submission?.fileName
  )
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

const normalizeSourcePath = (path) => String(path || '').replace(/\\/g, '/').replace(/^\.\//, '')

const classifySourceBucket = (filePath, content = '') => {
  const p = normalizeSourcePath(filePath).toLowerCase()
  const c = (content || '').toLowerCase()

  const backendSignals = [
    '/training-system/', 'training-system/', 'src/main/java', 'src/main/resources',
    'pom.xml', '.java', '.properties', 'application.yml', 'application.yaml', '.sql', '.xml'
  ]
  const frontendSignals = [
    '/web/', 'web/', 'src/views', 'src/components', 'src/router', 'src/store', 'src/styles', 'src/api',
    'package.json', 'vite.config', '.vue', '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.less', '.html'
  ]

  if (backendSignals.some(signal => p.includes(signal))) return 'backend'
  if (frontendSignals.some(signal => p.includes(signal))) return 'frontend'
  if (c.includes('@restcontroller') || c.includes('@service') || c.includes('springbootapplication')) return 'backend'
  if (c.includes('export default') || c.includes('<template>') || c.includes('createapp(')) return 'frontend'

  return 'backend'
}

const parseSourceFiles = (raw) => {
  if (!raw) return []
  const focused = extractSection(raw, '## FOCUSED_SOURCE_FILES', null)
  const target = focused || raw
  const regex = /(?:^|\n)\s*### FILE:\s*(.+)$/gm
  const matches = [...target.matchAll(regex)]

  if (!matches.length) {
    if (target.trim().length > 0) {
      const fallbackName = normalizeSourcePath(
        props.submission?.fileName ||
        props.submission?.filePath ||
        'submission-source.txt'
      )
      const bucket = classifySourceBucket(fallbackName, target)
      return [{
        path: fallbackName,
        content: target,
        bucket: bucket
      }]
    }
    return []
  }

  return matches.map((match, index) => {
    const filePath = normalizeSourcePath(match[1]?.trim())
    const contentStart = match.index + match[0].length
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : target.length
    const content = target.substring(contentStart, contentEnd).trim()
    return {
      path: filePath,
      content,
      bucket: classifySourceBucket(filePath, content)
    }
  })
}

const sourceFiles = computed(() => parseSourceFiles(props.fileContent || ''))

const frontendSourceCount = computed(() => sourceFiles.value.filter(f => f.bucket === 'frontend').length)
const backendSourceCount = computed(() => sourceFiles.value.filter(f => f.bucket === 'backend').length)

const trimBucketPrefix = (path, bucket) => {
  const normalized = normalizeSourcePath(path)
  if (bucket === 'frontend') {
    const markerIndex = normalized.toLowerCase().indexOf('web/')
    if (markerIndex >= 0) return normalized.substring(markerIndex + 4)
  }
  if (bucket === 'backend') {
    const markerIndex = normalized.toLowerCase().indexOf('training-system/')
    if (markerIndex >= 0) return normalized.substring(markerIndex + 16)
  }
  return normalized
}

const buildSourceTree = (bucket) => {
  const root = []
  const nodeMap = new Map()

  const files = sourceFiles.value
    .filter(item => item.bucket === bucket)
    .sort((a, b) => a.path.localeCompare(b.path))

  files.forEach(file => {
    const displayPath = trimBucketPrefix(file.path, bucket)
    const segments = displayPath.split('/').filter(Boolean)
    let currentChildren = root
    let currentPath = ''

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const isFile = index === segments.length - 1
      const key = `${bucket}:${currentPath}`

      if (!nodeMap.has(key)) {
        const node = {
          id: key,
          label: segment,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          fullPath: file.path,
          displayPath,
          content: file.content
        }
        nodeMap.set(key, node)
        currentChildren.push(node)
      }

      const currentNode = nodeMap.get(key)
      if (!isFile) {
        currentChildren = currentNode.children
      }
    })
  })

  return root
}

const activeSourceTree = computed(() => activeSourceBucket.value === 'frontend' ? buildSourceTree('frontend') : buildSourceTree('backend'))

const flatSourceFiles = computed(() => sourceFiles.value.map(item => ({
  ...item,
  displayPath: trimBucketPrefix(item.path, item.bucket)
})))

const selectedSourceFile = computed(() => {
  if (!selectedSourceFilePath.value) return null
  return flatSourceFiles.value.find(item => item.path === selectedSourceFilePath.value) || null
})

const selectedSourceContent = computed(() => {
  return selectedSourceFile.value?.content || '// 请从左侧目录树选择文件'
})

const detectLanguageByPath = (path) => {
  const p = normalizeSourcePath(path).toLowerCase()
  if (p.endsWith('.vue')) return 'html'
  if (p.endsWith('.java')) return 'java'
  if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.cjs')) return 'javascript'
  if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript'
  if (p.endsWith('.json')) return 'json'
  if (p.endsWith('.xml')) return 'xml'
  if (p.endsWith('.yml') || p.endsWith('.yaml')) return 'yaml'
  if (p.endsWith('.sql')) return 'sql'
  if (p.endsWith('.py')) return 'python'
  if (p.endsWith('.md')) return 'markdown'
  if (p.endsWith('.css') || p.endsWith('.scss') || p.endsWith('.less')) return 'css'
  if (p.endsWith('.html')) return 'html'
  return 'plaintext'
}

const sourcePreviewLanguage = computed(() => {
  if (!props.submission) return 'plaintext'
  const lang = props.submission.language
  if (lang === 'JAVA') return 'java'
  if (lang === 'PYTHON') return 'python'
  if (lang === 'CPP') return 'cpp'
  return 'plaintext'
})

const selectedSourceLanguage = computed(() => {
  if (!selectedSourceFile.value?.path) return sourcePreviewLanguage.value
  return detectLanguageByPath(selectedSourceFile.value.path)
})

const handleSourceNodeClick = (node) => {
  if (!node || node.type !== 'file') return
  selectedSourceFilePath.value = node.fullPath
}

const selectFirstAvailableSourceFile = () => {
  const frontendFirst = flatSourceFiles.value.find(item => item.bucket === 'frontend')
  const backendFirst = flatSourceFiles.value.find(item => item.bucket === 'backend')

  if (activeSourceBucket.value === 'frontend') {
    const chosen = frontendFirst || backendFirst
    if (chosen) {
      activeSourceBucket.value = chosen.bucket
      selectedSourceFilePath.value = chosen.path
    }
    return
  }

  const chosen = backendFirst || frontendFirst
  if (chosen) {
    activeSourceBucket.value = chosen.bucket
    selectedSourceFilePath.value = chosen.path
  }
}

watch([sourceFiles, activeSourceBucket], () => {
  const current = selectedSourceFile.value
  if (current && current.bucket === activeSourceBucket.value) return
  const firstInBucket = flatSourceFiles.value.find(item => item.bucket === activeSourceBucket.value)
  if (firstInBucket) {
    selectedSourceFilePath.value = firstInBucket.path
    return
  }
  selectFirstAvailableSourceFile()
}, { immediate: true })

// Resizer logic
const startResize = (e) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = sidebarWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

const handleResize = (e) => {
  if (!isResizing.value) return
  const delta = e.clientX - resizeStartX.value
  const newWidth = resizeStartWidth.value + delta
  if (newWidth >= 200 && newWidth <= 600) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}
</script>

<style scoped lang="scss">
$primary-color: #10b981;

.tab-content {
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.source-explorer-layout {
  height: 100%;
  display: flex;
  overflow: hidden;
}

.source-tree-panel {
  border-right: none;
  background: #fbfdff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.05s linear;

  .tree-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid #eef1f5;
    background: #f8f9fb;
  }

  .tree-scrollbar {
    flex: 1;
    padding: 8px 0;
  }

  :deep(.el-tree) {
    background: transparent;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
  }

  :deep(.el-tree-node__content) {
    height: 28px;
    margin: 1px 0;
    border-radius: 0;
    padding-right: 8px;
  }

  :deep(.el-tree-node__content:hover) {
    background: #edf5ff;
  }

  :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
    background: #d6e8ff;
    color: #1f6fb2;
  }
}

.resize-handle {
  width: 4px;
  background: #eef1f5;
  cursor: col-resize;
  transition: background 0.2s;
  flex-shrink: 0;
  z-index: 10;
  position: relative;
  
  &:hover, &.is-resizing {
    background: $primary-color;
  }
  
  &::after {
    content: '';
    position: absolute;
    left: -2px;
    right: -2px;
    top: 0;
    bottom: 0;
    z-index: 1;
  }
}

.tree-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;

  .tree-node-icon {
    font-size: 16px;
    flex-shrink: 0;
    
    &.folder { color: #8f9bb3; }
    &.file { color: #aeb9c9; }
  }
  
  :deep(.is-current) & .tree-node-icon {
    color: #409eff;
  }

  .tree-node-label {
    font-size: 13px;
    color: #2c3e50;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
}

.source-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;

  .source-preview-header {
    height: 38px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    border-bottom: 1px solid #eef1f5;
    background: #fff;

    .path-label {
      font-size: 12px;
      color: #5c6b7a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
