<template>
  <div class="textbook-manager-container">
    <div class="page-wrapper">
      <!-- 头部区域 -->
      <TextbookHeader 
        :course-list="courseList"
        v-model:selected-course-id="selectedCourseId"
        v-model:search-query="searchQuery"
        @upload="showUploadDialog = true"
        @course-change="loadTextbooks"
      />

      <div v-if="hasBackgroundParsing" class="parse-status-bar" @click="showUploadDialog = true">
        <div class="status-left">
          <span class="status-dot"></span>
          <span class="status-text">解析中 {{ parsingTaskCount }} 个任务</span>
        </div>
        <el-button type="primary" link>继续查看</el-button>
      </div>

      <!-- 内容区域 -->
      <div class="content-wrapper">
        <TextbookGrid 
          :textbooks="filteredTextbooks"
          :loading="loading"
          @view-chapters="openChapters"
          @download="handleDownloadSource"
          @reparse="handleReparse"
          @delete="handleDelete"
        />
      </div>
    </div>

    <!-- 弹窗组件 -->
    <UploadDialog 
      v-model:visible="showUploadDialog"
      :course-id="selectedCourseId"
      @success="loadTextbooks"
      @background-processing-change="handleBackgroundProcessingChange"
    />

    <ChapterListDialog 
      v-model:visible="showChaptersDrawer"
      :textbook="currentTextbook"
      :chapters="chapters"
      :loading="loadingChapters"
      @add="editChapter(null)"
      @edit="editChapter"
      @delete="handleDeleteChapter"
    />

    <ChapterEditDialog 
      v-model:visible="showEditChapterDialog"
      :chapter="editingChapter"
      :saving="savingChapter"
      @save="handleSaveChapter"
    />

    <DeleteProgressDialog 
      v-model:visible="showDeleteDialog"
      :deleting="deleting"
      :logs="deleteLogs"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// API Import
import { getMyCourses } from '@/api/teacher/course'
import { 
  getTextbooksByCourse, getTextbookChapters,
  downloadTextbookSource,
  parseTextbook, saveChapter, deleteChapter, deleteTextbook 
} from '@/api/teacher/textbook'

// Components Import
import TextbookHeader from './components/TextbookHeader.vue'
import TextbookGrid from './components/TextbookGrid.vue'
import UploadDialog from './components/UploadDialog.vue'
import ChapterListDialog from './components/ChapterListDialog.vue'
import ChapterEditDialog from './components/ChapterEditDialog.vue'
import DeleteProgressDialog from './components/DeleteProgressDialog.vue'

// State
const loading = ref(false)
const courseList = ref([])
const selectedCourseId = ref(null)
const textbooks = ref([])
const searchQuery = ref('')

// Component State
const showUploadDialog = ref(false)
const hasBackgroundParsing = ref(false)

const showDeleteDialog = ref(false)
const deleting = ref(false)
const deleteLogs = ref([])
const deletingTextbookId = ref(null)
let deleteLogEventSource = null

const showChaptersDrawer = ref(false)
const currentTextbook = ref(null)
const chapters = ref([])
const loadingChapters = ref(false)

const showEditChapterDialog = ref(false)
const editingChapter = ref({})
const savingChapter = ref(false)

// Computed
const filteredTextbooks = computed(() => {
  if (!searchQuery.value) return textbooks.value
  const query = searchQuery.value.toLowerCase()
  return textbooks.value.filter(t => t.name.toLowerCase().includes(query))
})

const parsingTaskCount = computed(() => hasBackgroundParsing.value ? 1 : 0)

// Methods
const loadCourses = async () => {
  try {
    const res = await getMyCourses()
    courseList.value = res.data || []
    if (courseList.value.length > 0) {
      selectedCourseId.value = courseList.value[0].id
      loadTextbooks()
    }
  } catch (e) {
    ElMessage.error('加载课程失败')
  }
}

const loadTextbooks = async () => {
  if (!selectedCourseId.value) return
  loading.value = true
  try {
    const res = await getTextbooksByCourse(selectedCourseId.value)
    textbooks.value = res.data || []
  } catch (e) {
    ElMessage.error('加载教材失败')
  } finally {
    loading.value = false
  }
}

const openChapters = async (textbook) => {
  currentTextbook.value = textbook
  showChaptersDrawer.value = true
  loadingChapters.value = true
  try {
    const res = await getTextbookChapters(textbook.id)
    chapters.value = res.data || []
  } catch (e) {
    ElMessage.error('加载章节失败')
  } finally {
    loadingChapters.value = false
  }
}

const resolveDownloadFileName = (book, headers = {}) => {
  const disposition = headers['content-disposition'] || headers['Content-Disposition'] || ''
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1])
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  const extension = book?.fileType ? `.${String(book.fileType).toLowerCase()}` : ''
  return `${book?.name || '教材源文件'}${extension}`
}

const handleDownloadSource = async (book) => {
  try {
    const response = await downloadTextbookSource(book.id)
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream'
    })
    const fileName = resolveDownloadFileName(book, response.headers)
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(objectUrl)
    ElMessage.success('教材源文件下载已开始')
  } catch (e) {
    ElMessage.error('下载教材源文件失败')
  }
}

const editChapter = (chapter) => {
  editingChapter.value = chapter ? { ...chapter } : { 
    textbookId: currentTextbook.value.id,
    title: '',
    content: ''
  }
  showEditChapterDialog.value = true
}

const handleSaveChapter = async (chapterData) => {
  savingChapter.value = true
  try {
    const textbookId = currentTextbook.value?.id || chapterData.textbookId
    await saveChapter(textbookId, chapterData)
    ElMessage.success('保存成功')
    showEditChapterDialog.value = false
    if (currentTextbook.value) {
      const res = await getTextbookChapters(currentTextbook.value.id)
      chapters.value = res.data || []
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    savingChapter.value = false
  }
}

const handleDeleteChapter = async (chapterId) => {
  try {
    await ElMessageBox.confirm('确定删除该章节？', '提示', { type: 'warning' })
    await deleteChapter(chapterId)
    ElMessage.success('删除成功')
    if (currentTextbook.value) {
      const res = await getTextbookChapters(currentTextbook.value.id)
      chapters.value = res.data || []
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleReparse = async (textbookId) => {
  try {
    await parseTextbook(textbookId)
    ElMessage.success('已开始重新解析')
    loadTextbooks()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

const handleDelete = async (textbookId) => {
  try {
    await ElMessageBox.confirm('确定删除该教材？删除后无法恢复！', '提示', { 
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
    
    deletingTextbookId.value = textbookId
    showDeleteDialog.value = true
    deleting.value = true
    deleteLogs.value = []
    
    const backendURL = 'http://localhost:8080/training-system' 
    deleteLogEventSource = new EventSource(`${backendURL}/api/teacher/textbooks/${textbookId}/logs`)
    
    deleteLogEventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data)
        deleteLogs.value.push({
          time: new Date().toLocaleTimeString(),
          message: log.message,
          type: 'info'
        })
      } catch (e) {
        deleteLogs.value.push({ time: new Date().toLocaleTimeString(), message: event.data })
      }
    }
    deleteLogEventSource.onerror = () => {
      deleteLogEventSource?.close()
    }
    
    await deleteTextbook(textbookId)
    
    setTimeout(() => {
      deleting.value = false
      deleteLogEventSource?.close()
      deleteLogEventSource = null
      
      setTimeout(() => {
        showDeleteDialog.value = false
        ElMessage.success('删除成功')
        loadTextbooks()
      }, 1000)
    }, 1500)
    
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
      deleting.value = false
      deleteLogEventSource?.close()
    }
  }
}

const handleBackgroundProcessingChange = (isProcessing) => {
  hasBackgroundParsing.value = !!isProcessing
}

onMounted(() => {
  loadCourses()
})
</script>

<style lang="scss" scoped>
.textbook-manager-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-wrapper {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  gap: 20px;
}

.content-wrapper {
  flex: 1;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.parse-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid #d9ecff;
  background: #ecf5ff;
  border-radius: 8px;
  cursor: pointer;

  .status-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #409eff;
    animation: pulse 1.2s infinite;
  }

  .status-text {
    color: #409eff;
    font-size: 14px;
    font-weight: 500;
  }
}

@keyframes pulse {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}
</style>
