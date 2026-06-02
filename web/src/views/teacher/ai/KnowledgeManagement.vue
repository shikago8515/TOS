<template>
  <div class="knowledge-management">
    <el-card class="operation-card">
      <el-tabs v-model="activeTab" class="main-tabs">
        <!-- 上传文档 -->
        <el-tab-pane name="upload">
          <template #label>
            <span class="tab-label"><el-icon><Upload /></el-icon> 上传文档</span>
          </template>
          <div class="upload-section">
            <el-upload
              class="upload-demo"
              drag
              action="#"
              :http-request="handleUpload"
              :show-file-list="false"
              accept=".pdf,.txt,.md"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
              <template #tip>
                <div class="el-upload__tip">支持 PDF、TXT、Markdown 格式，文件大小不超过 10MB</div>
              </template>
            </el-upload>

            <div v-if="uploadProgress > 0" class="upload-progress-wrapper" style="margin-top: 20px">
              <el-progress
                :percentage="uploadProgress"
                :stroke-width="20"
                :status="uploadProgress >= 100 ? 'success' : undefined"
                text-inside
              ></el-progress>
              <div class="progress-text" style="margin-top: 8px; color: #606266; font-size: 14px">
                {{ uploadProgressText }}
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 手动添加 -->
        <el-tab-pane name="manual">
          <template #label>
            <span class="tab-label"><el-icon><Edit /></el-icon> 手动添加</span>
          </template>
          <div class="manual-section">
            <el-form :model="knowledgeForm" :rules="knowledgeRules" ref="knowledgeFormRef" label-width="90px">
              <el-form-item label="标题" prop="title">
                <el-input v-model="knowledgeForm.title" placeholder="请输入知识标题" clearable></el-input>
              </el-form-item>

              <el-form-item label="知识类型" prop="knowledgeType">
                <el-select v-model="knowledgeForm.knowledgeType" placeholder="请选择知识类型" style="width: 100%" :teleported="false">
                  <el-option label="教学大纲" value="syllabus"></el-option>
                  <el-option label="实训案例" value="case"></el-option>
                  <el-option label="常见问题" value="faq"></el-option>
                  <el-option label="通用知识" value="general"></el-option>
                  <el-option label="手动输入" value="manual"></el-option>
                </el-select>
              </el-form-item>

              <el-form-item label="内容" prop="content">
                <el-input
                  type="textarea"
                  v-model="knowledgeForm.content"
                  :rows="8"
                  placeholder="请输入知识内容"
                ></el-input>
              </el-form-item>

              <el-form-item label="元数据">
                <el-input
                  type="textarea"
                  v-model="metadataText"
                  :rows="3"
                  placeholder='可选：输入JSON格式元数据，如 {"chapter": "1", "source": "teacher"}'
                ></el-input>
              </el-form-item>

              <el-form-item>
                <el-button type="primary" @click="submitKnowledge" :loading="submitting">
                  提交
                </el-button>
                <el-button @click="resetKnowledgeForm">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- 数据同步 -->
        <el-tab-pane name="sync">
          <template #label>
            <span class="tab-label"><el-icon><Refresh /></el-icon> 数据同步</span>
          </template>
          <div class="sync-section">
            <el-alert title="从业务数据库同步真实数据到知识库" type="info" :closable="false" style="margin-bottom: 24px"></el-alert>
            <el-row :gutter="20">
              <el-col :span="8">
                <div class="sync-card" @click="syncData('case')">
                  <h3>同步案例数据</h3>
                  <p>从案例表同步案例标题、关键词、内容等</p>
                  <el-button type="primary" :loading="syncing === 'case'" plain>开始同步</el-button>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="sync-card" @click="syncData('task')">
                  <h3>同步任务数据</h3>
                  <p>从任务表同步任务描述、要求等</p>
                  <el-button type="success" :loading="syncing === 'task'" plain>开始同步</el-button>
                </div>
              </el-col>
              <el-col :span="8">
                <div class="sync-card" @click="syncData('faq')">
                  <h3>同步FAQ数据</h3>
                  <p>从历史数据提取常见问题</p>
                  <el-button type="warning" :loading="syncing === 'faq'" plain>开始同步</el-button>
                </div>
              </el-col>
            </el-row>

            <el-divider />

            <div style="display:flex; gap: 12px; flex-wrap: wrap;">
              <el-button type="primary" @click="handleIndexPending">批量索引待处理知识</el-button>
              <el-button type="danger" @click="handleRebuildIndex">重建索引（慎用）</el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- 知识列表 -->
        <el-tab-pane name="list">
          <template #label>
            <span class="tab-label"><el-icon><List /></el-icon> 知识列表</span>
          </template>
          <div class="list-section">
            <div class="filter-container">
              <el-form :inline="true" :model="filterForm" class="filter-form">
                <el-form-item label="关键词">
                  <el-input v-model="filterForm.keyword" placeholder="搜索标题/内容" clearable @keyup.enter="handleSearch" style="width: 200px">
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                </el-form-item>
                <el-form-item label="知识类型">
                  <el-select v-model="filterForm.knowledgeType" placeholder="全部类型" clearable style="width: 160px" @change="handleSearch" :teleported="false">
                    <el-option label="全部" value=""></el-option>
                    <el-option-group label="AI问答知识库">
                      <el-option label="教学大纲" value="syllabus"></el-option>
                      <el-option label="实训案例" value="case"></el-option>
                      <el-option label="常见问题" value="faq"></el-option>
                      <el-option label="文档" value="document"></el-option>
                      <el-option label="手动输入" value="manual"></el-option>
                      <el-option label="通用知识" value="general"></el-option>
                    </el-option-group>
                    <el-option-group label="教材知识库">
                      <el-option label="教材片段" value="textbook_chunk"></el-option>
                      <el-option label="教材章节" value="textbook_chapter"></el-option>
                    </el-option-group>
                  </el-select>
                </el-form-item>

                <el-form-item label="来源类型">
                  <el-select v-model="filterForm.sourceType" placeholder="全部来源" clearable style="width: 160px" @change="handleSearch" :teleported="false">
                    <el-option label="全部" value=""></el-option>
                    <el-option label="用户上传" value="user_upload"></el-option>
                    <el-option label="数据库同步" value="db_sync"></el-option>
                    <el-option label="系统内置" value="system"></el-option>
                    <el-option label="教材解析" value="textbook"></el-option>
                  </el-select>
                </el-form-item>

                <el-form-item>
                  <el-button type="primary" @click="handleSearch">
                    <el-icon><Search /></el-icon>
                    <span style="margin-left: 6px">查询</span>
                  </el-button>
                  <el-button @click="resetFilter">
                    <el-icon><RefreshLeft /></el-icon>
                    <span style="margin-left: 6px">重置</span>
                  </el-button>
                </el-form-item>
              </el-form>
            </div>

            <div class="action-bar">
              <div class="left-actions">
                <el-button type="danger" plain :disabled="selectedRows.length === 0" @click="handleBatchDelete">
                  <el-icon><Delete /></el-icon> 批量删除
                </el-button>
                <span v-if="selectedRows.length > 0" class="selection-info">
                  已选择 {{ selectedRows.length }} 项
                </span>
              </div>
              <div class="right-actions">
                <el-button type="info" plain :icon="Delete" @click="goRecycle">
                  回收站
                </el-button>
              </div>
            </div>

            <el-table 
              :data="knowledgeList" 
              v-loading="tableLoading" 
              class="knowledge-table"
              @selection-change="handleSelectionChange"
              border
              stripe
            >
              <el-table-column type="selection" width="55" align="center" />
              <el-table-column prop="id" label="ID" width="80" align="center"></el-table-column>
              <el-table-column prop="title" label="标题" min-width="200" :show-overflow-tooltip="{ teleported: false }"></el-table-column>
              <el-table-column prop="knowledgeType" label="类型" width="120" align="center">
                <template #default="{ row }">
                  <el-tag :type="getKnowledgeTypeTag(row.knowledgeType)" size="small">
                    {{ getKnowledgeTypeLabel(row.knowledgeType) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="sourceType" label="来源" width="120" align="center">
                <template #default="{ row }">
                  <span>{{ getSourceTypeLabel(row.sourceType) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="isIndexed" label="状态" width="100" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isIndexed ? 'success' : 'warning'" size="small" effect="dark">
                    {{ row.isIndexed ? '已索引' : '待索引' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="180" align="center"></el-table-column>
              <el-table-column label="操作" width="220" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button type="primary" link @click="viewKnowledge(row)">查看</el-button>
                  <el-button type="warning" link @click="editKnowledge(row)">编辑</el-button>
                  <el-popconfirm title="确定要删除这条知识吗?" @confirm="handleDelete(row.id)" :teleported="false">
                    <template #reference>
                      <el-button type="danger" link>删除</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>

            <div class="pagination-container">
              <el-pagination
                v-model:current-page="pagination.pageNum"
                v-model:page-size="pagination.pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :teleported="false"
                layout="total, sizes, prev, pager, next, jumper"
                :total="pagination.total"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- 数据统计 -->
        <el-tab-pane name="statistics">
          <template #label>
            <span class="tab-label"><el-icon><DataAnalysis /></el-icon> 数据统计</span>
          </template>
          <div class="statistics-section">
            <el-row :gutter="20">
              <el-col :span="6">
                <div class="stat-card">
                  <div class="stat-card-content">
                    <div class="stat-card-value">{{ statistics.totalKnowledge || 0 }}</div>
                    <div class="stat-card-label">总知识数</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stat-card">
                  <div class="stat-card-content">
                    <div class="stat-card-value">{{ statistics.indexedKnowledge || 0 }}</div>
                    <div class="stat-card-label">已索引</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stat-card">
                  <div class="stat-card-content">
                    <div class="stat-card-value">{{ statistics.pendingKnowledge || 0 }}</div>
                    <div class="stat-card-label">待索引</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stat-card">
                  <div class="stat-card-content">
                    <div class="stat-card-value">{{ statistics.totalDocuments || 0 }}</div>
                    <div class="stat-card-label">文档数</div>
                  </div>
                </div>
              </el-col>
            </el-row>

            <el-divider />

            <div class="documents-list">
              <h3 style="margin-bottom: 16px">文档列表</h3>
              <el-table :data="documentsList" border stripe style="width: 100%" v-loading="documentsLoading">
                <el-table-column prop="id" label="ID" width="80" align="center" />
                <el-table-column prop="fileName" label="文件名" min-width="200" :show-overflow-tooltip="{ teleported: false }" />
                <el-table-column prop="fileType" label="类型" width="100" align="center" />
                <el-table-column prop="parseStatus" label="解析状态" width="120" align="center" />
                <el-table-column prop="chunkCount" label="分段数" width="100" align="center" />
                <el-table-column prop="totalTokens" label="Tokens" width="100" align="center" />
                <el-table-column prop="createdAt" label="上传时间" width="180" align="center" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 查看知识对话框 -->
    <el-dialog v-model="viewDialogVisible" title="知识详情" width="60%" :close-on-click-modal="false" :teleported="false">
      <div v-if="currentKnowledge" class="knowledge-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="ID">{{ currentKnowledge.id }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ currentKnowledge.knowledgeType }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ currentKnowledge.sourceType }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ currentKnowledge.isIndexed ? '已索引' : '待索引' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentKnowledge.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ currentKnowledge.updatedAt }}</el-descriptions-item>
        </el-descriptions>

        <el-divider></el-divider>

        <h4>标题</h4>
        <p class="detail-text">{{ currentKnowledge.title }}</p>

        <h4>内容</h4>
        <div class="content-preview">{{ currentKnowledge.content }}</div>

        <div v-if="currentKnowledge.metadata">
          <h4>元数据</h4>
          <pre class="metadata-preview">{{ formatJSON(currentKnowledge.metadata) }}</pre>
        </div>
      </div>
    </el-dialog>

    <!-- 编辑知识对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑知识" width="60%" :close-on-click-modal="false" :teleported="false">
      <el-form ref="editFormRef" :model="editForm" :rules="knowledgeRules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="editForm.title" placeholder="请输入知识标题"></el-input>
        </el-form-item>
        <el-form-item label="知识类型" prop="knowledgeType">
          <el-select v-model="editForm.knowledgeType" placeholder="请选择知识类型" style="width: 100%" :teleported="false">
            <el-option label="教学大纲" value="syllabus"></el-option>
            <el-option label="实训案例" value="case"></el-option>
            <el-option label="常见问题" value="faq"></el-option>
            <el-option label="通用知识" value="general"></el-option>
            <el-option label="手动输入" value="manual"></el-option>
            <el-option label="文档" value="document"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="editForm.content" type="textarea" :rows="10" placeholder="请输入知识内容"></el-input>
        </el-form-item>
        <el-form-item label="元数据">
          <el-input v-model="editMetadataText" type="textarea" :rows="4" placeholder='输入JSON格式元数据'></el-input>
          <div class="el-form-item__tip">选填,必须是合法的JSON格式</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, UploadFilled, Edit, RefreshLeft, Refresh, List, Search, DataAnalysis, Delete } from '@element-plus/icons-vue'
import {
  uploadKnowledge,
  getDocumentProgress,
  addManualKnowledge,
  syncFromDatabase,
  indexPendingKnowledge,
  rebuildKnowledgeIndex,
  getKnowledgeList,
  getKnowledgePage,
  batchDeleteKnowledge,
  deleteKnowledge,
  getRagStatistics,
  getDocumentList,
  getKnowledgeDetail,
  updateKnowledge
} from '@/api/training/ai'

const router = useRouter()

const activeTab = ref('upload')

// 上传文档进度
const uploadProgress = ref(0)
const uploadProgressText = ref('')
const currentDocumentId = ref(null)
let progressTimer = null

// 手动添加知识
const knowledgeFormRef = ref(null)
const knowledgeForm = reactive({
  title: '',
  content: '',
  knowledgeType: 'manual'
})
const metadataText = ref('')
const knowledgeRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }],
  knowledgeType: [{ required: true, message: '请选择知识类型', trigger: 'change' }]
}

const submitting = ref(false)

// 数据同步
const syncing = ref('')

// 知识列表
const filterForm = reactive({
  knowledgeType: '',
  sourceType: '',  // 默认显示所有来源
  keyword: ''
})
const knowledgeList = ref([])
const tableLoading = ref(false)
const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0
})
const selectedRows = ref([])

// 统计/文档列表
const statistics = reactive({
  totalKnowledge: 0,
  indexedKnowledge: 0,
  pendingKnowledge: 0,
  totalDocuments: 0
})
const documentsList = ref([])
const documentsLoading = ref(false)

// 查看/编辑知识
const viewDialogVisible = ref(false)
const currentKnowledge = ref(null)

const editDialogVisible = ref(false)
const editFormRef = ref(null)
const editForm = reactive({
  id: null,
  title: '',
  content: '',
  knowledgeType: 'manual'
})
const editMetadataText = ref('')

const formatJSON = (jsonStr) => {
  if (!jsonStr) return ''
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(jsonStr)
  }
}

const getKnowledgeTypeLabel = (type) => {
  const map = {
    'syllabus': '教学大纲',
    'case': '实训案例',
    'faq': '常见问题',
    'document': '文档',
    'manual': '手动输入',
    'general': '通用知识',
    'textbook_chunk': '教材片段',
    'textbook_chapter': '教材章节'
  }
  return map[type] || type
}

const getKnowledgeTypeTag = (type) => {
  if (type === 'textbook_chunk' || type === 'textbook_chapter') {
    return 'warning'
  }
  return ''
}

const getSourceTypeLabel = (type) => {
  const map = {
    'user_upload': '用户上传',
    'db_sync': '数据库同步',
    'system': '系统内置',
    'textbook': '教材解析'
  }
  return map[type] || type
}

const beforeUpload = (file) => {
  const isValidType = ['application/pdf', 'text/plain', 'text/markdown'].includes(file.type) ||
    file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.pdf')
  if (!isValidType) {
    ElMessage.error('仅支持 PDF、TXT、Markdown 格式')
    return false
  }
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }
  uploadProgress.value = 0
  uploadProgressText.value = '准备上传...'
  return true
}

const startProgressPolling = (documentId) => {
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(async () => {
    try {
      const res = await getDocumentProgress(documentId)
      if (res.code === 200) {
        const progress = res.data || {}
        uploadProgress.value = progress.progress || 0
        uploadProgressText.value = progress.message || ''
        if (progress.status === 'success' || progress.status === 'failed') {
          clearInterval(progressTimer)
          progressTimer = null
          setTimeout(() => {
            uploadProgress.value = 0
            uploadProgressText.value = ''
            currentDocumentId.value = null
            loadStatistics()
          }, 1500)
        }
      }
    } catch {
      // ignore
    }
  }, 2000)
}

const handleUpload = async (options) => {
  if (!beforeUpload(options.file)) {
    options.onError && options.onError(new Error('invalid file'))
    return
  }

  const formData = new FormData()
  formData.append('file', options.file)
  try {
    const res = await uploadKnowledge(formData, {
      onUploadProgress: (e) => {
        if (!e.total) return
        const percent = Math.round((e.loaded * 100) / e.total)
        uploadProgress.value = percent
        uploadProgressText.value = `上传中... ${percent}%`
        options.onProgress && options.onProgress({ percent }, options.file)
      }
    })
    options.onSuccess && options.onSuccess(res, options.file)
    if (res.code === 200) {
      const documentId = res.data
      currentDocumentId.value = documentId
      uploadProgressText.value = '上传完成，正在解析文档...'
      startProgressPolling(documentId)
      ElMessage.success('文档上传成功，正在解析...')
    } else {
      ElMessage.error(res.message || '上传失败')
      uploadProgress.value = 0
      uploadProgressText.value = ''
    }
  } catch (error) {
    options.onError && options.onError(error)
    uploadProgress.value = 0
    uploadProgressText.value = ''
    ElMessage.error('上传失败')
  }
}

const submitKnowledge = async () => {
  await knowledgeFormRef.value.validate()
  try {
    submitting.value = true
    let metadata = {}
    if (metadataText.value) {
      try {
        metadata = JSON.parse(metadataText.value)
      } catch {
        ElMessage.error('元数据格式错误，请输入有效的JSON')
        return
      }
    }
    const res = await addManualKnowledge({
      ...knowledgeForm,
      metadata
    })
    if (res.code === 200) {
      ElMessage.success('知识添加成功')
      resetKnowledgeForm()
      loadStatistics()
      loadKnowledgeList()
    } else {
      ElMessage.error(res.message || '添加失败')
    }
  } finally {
    submitting.value = false
  }
}

const resetKnowledgeForm = () => {
  knowledgeFormRef.value?.resetFields()
  metadataText.value = ''
}

const syncData = async (syncType) => {
  try {
    syncing.value = syncType
    const res = await syncFromDatabase(syncType)
    if (res.code === 200) {
      ElMessage.success(res.message || '同步完成')
      loadStatistics()
      loadKnowledgeList()
    } else {
      ElMessage.error(res.message || '同步失败')
    }
  } catch (error) {
    if (error?.code === 'ECONNABORTED') {
      ElMessage.warning('同步请求超时，任务可能仍在后台执行，请稍后刷新列表查看结果')
    } else {
      ElMessage.error(error?.message || '同步失败')
    }
  } finally {
    syncing.value = ''
  }
}

const handleIndexPending = async () => {
  try {
    const res = await indexPendingKnowledge()
    if (res.code === 200) {
      ElMessage.success(res.message || '索引完成')
      loadStatistics()
      loadKnowledgeList()
    } else {
      ElMessage.error(res.message || '索引失败')
    }
  } catch {
    ElMessage.error('索引失败')
  }
}

const handleRebuildIndex = async () => {
  ElMessageBox.confirm('确定要重建索引吗？此操作可能耗时较长。', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await rebuildKnowledgeIndex()
      if (res.code === 200) {
        ElMessage.success(res.message || '重建完成')
        loadStatistics()
        loadKnowledgeList()
      } else {
        ElMessage.error(res.message || '重建失败')
      }
    } catch {
      ElMessage.error('重建失败')
    }
  }).catch(() => null)
}

const loadKnowledgeList = async () => {
  try {
    tableLoading.value = true
    const params = {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      knowledgeType: filterForm.knowledgeType,
      sourceType: filterForm.sourceType,
      keyword: filterForm.keyword
    }
    const res = await getKnowledgePage(params)
    if (res.code === 200) {
      knowledgeList.value = res.data.list || []
      pagination.total = res.data.total || 0
    } else {
      ElMessage.error(res.message || '加载失败')
    }
  } catch (error) {
    ElMessage.error(error?.message || '加载失败')
  } finally {
    tableLoading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  loadKnowledgeList()
}

const resetFilter = () => {
  filterForm.knowledgeType = ''
  filterForm.sourceType = ''
  filterForm.keyword = ''
  handleSearch()
}

const handleSizeChange = (val) => {
  pagination.pageSize = val
  loadKnowledgeList()
}

const handleCurrentChange = (val) => {
  pagination.pageNum = val
  loadKnowledgeList()
}

const handleSelectionChange = (val) => {
  selectedRows.value = val
}

const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  
  ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 条知识吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const ids = selectedRows.value.map(row => row.id)
      const res = await batchDeleteKnowledge(ids)
      if (res.code === 200) {
        ElMessage.success('批量删除成功')
        loadKnowledgeList()
        loadStatistics()
        selectedRows.value = []
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

const handleDelete = async (id) => {
  try {
    const res = await deleteKnowledge(id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      loadKnowledgeList()
      loadStatistics()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch {
    ElMessage.error('删除失败')
  }
}

const viewKnowledge = (row) => {
  currentKnowledge.value = row
  viewDialogVisible.value = true
}

const editKnowledge = async (row) => {
  try {
    const res = await getKnowledgeDetail(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '获取知识详情失败')
      return
    }
    const knowledge = res.data
    editForm.id = knowledge.id
    editForm.title = knowledge.title
    editForm.content = knowledge.content
    editForm.knowledgeType = knowledge.knowledgeType
    editMetadataText.value = formatJSON(knowledge.metadata || '{}')
    editDialogVisible.value = true
  } catch {
    ElMessage.error('获取知识详情失败')
  }
}

const submitEdit = async () => {
  await editFormRef.value.validate()
  try {
    submitting.value = true
    let metadata = {}
    if (editMetadataText.value) {
      try {
        metadata = JSON.parse(editMetadataText.value)
      } catch {
        ElMessage.error('元数据格式错误，请输入有效的JSON')
        return
      }
    }
    const res = await updateKnowledge(editForm.id, {
      title: editForm.title,
      content: editForm.content,
      knowledgeType: editForm.knowledgeType,
      metadata
    })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      editDialogVisible.value = false
      loadKnowledgeList()
      loadStatistics()
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } finally {
    submitting.value = false
  }
}

const loadStatistics = async () => {
  try {
    const res = await getRagStatistics()
    if (res.code === 200) {
      const s = res.data || {}
      statistics.totalKnowledge = s.totalKnowledge || 0
      statistics.indexedKnowledge = s.indexedKnowledge || 0
      statistics.pendingKnowledge = s.pendingKnowledge || 0
      statistics.totalDocuments = s.totalDocuments || 0
    }
  } catch {
    // ignore
  }
}

const loadDocuments = async () => {
  documentsLoading.value = true
  try {
    const res = await getDocumentList({})
    documentsList.value = res.data || []
  } finally {
    documentsLoading.value = false
  }
}

const goRecycle = () => {
  router.push('/teacher/ai/recycle')
}

onMounted(() => {
  loadKnowledgeList()
  loadStatistics()
  loadDocuments()
})

onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
})
</script>

<style scoped lang="scss">
.knowledge-management {
  padding: 20px;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  
  .operation-card {
    margin-bottom: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    
    :deep(.el-card__body) {
      flex: 1;
      display: flex;
      flex-direction: column;
      
      .main-tabs {
        flex: 1;
        display: flex;
        flex-direction: column;
        
        .el-tabs__content {
          flex: 1;
          display: flex;
          flex-direction: column;
          
          .el-tab-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
        }
      }
    }
  }
  
  .upload-section {
    padding: 20px;
    text-align: center;
  }
  
  .manual-section {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .sync-card {
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fff;
  }

  .sync-card:hover {
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .stat-card {
    padding: 16px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    background: #fff;
  }

  .stat-card-value {
    font-size: 22px;
    font-weight: 700;
    color: #303133;
  }

  .stat-card-label {
    font-size: 13px;
    color: #909399;
    margin-top: 6px;
  }

  .content-preview {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .metadata-preview {
    background: #0f172a;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
  }

  .filter-container {
    background-color: #f8f9fa;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    border: 1px solid #ebeef5;
    
    .filter-form {
      margin-bottom: 0;
      
      .el-form-item {
        margin-bottom: 0;
        margin-right: 16px;
      }
    }
  }

  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .left-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .selection-info {
        font-size: 13px;
        color: #909399;
      }
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>