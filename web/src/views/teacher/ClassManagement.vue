<template>
  <div class="class-management-container">
    <transition name="fade-slide" appear>
      <div class="content-wrapper">
        <!-- 顶部 Header -->
        <div class="page-header">
          <div class="header-content">
            <h2 class="page-title">班级管理</h2>
            <p class="page-desc">高效管理您的教学班级，轻松处理学生名单与班级事务。</p>
          </div>
          <div class="header-actions">
            <el-button type="primary" size="large" icon="Plus" @click="handleAddClass" class="create-btn">
              创建新班级
            </el-button>
          </div>
        </div>

        <!-- 数据概览卡片 -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon blue-bg">
              <el-icon><School /></el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-label">班级总数</span>
              <span class="stat-value">{{ classes.length }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green-bg">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-label">学生总数</span>
              <span class="stat-value">{{ totalStudents }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue-bg">
              <el-icon><Timer /></el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-label">最近更新</span>
              <span class="stat-value text-sm">{{ lastUpdateTime }}</span>
            </div>
          </div>
        </div>

        <!-- 主体内容区 -->
        <div class="main-content">
          <el-card shadow="hover" class="table-card">
            <!-- 筛选工具栏 -->
            <div class="toolbar">
              <div class="left-tools">
                <el-input
                  v-model="searchQuery"
                  placeholder="搜索班级名称或描述..."
                  prefix-icon="Search"
                  clearable
                  class="search-input"
                />
              </div>
              <div class="right-tools">
                <el-button-group>
                  <el-button :icon="Refresh" circle @click="loadClasses" title="刷新列表" />
                </el-button-group>
              </div>
            </div>

            <!-- 表格区域 -->
            <el-table 
              :data="filteredClasses" 
              style="width: 100%" 
              v-loading="loading"
              :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600', height: '50px' }"
              :row-class-name="tableRowClassName"
              class="custom-table"
            >
              <el-table-column type="index" label="序号" width="80" align="center">
                <template #default="scope">
                  <span class="index-cell">{{ scope.$index + 1 }}</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="name" label="班级名称" min-width="200">
                <template #default="{ row }">
                  <div class="name-cell">
                    <div class="class-avatar">
                      <span>{{ row.name.charAt(0) }}</span>
                    </div>
                    <div class="name-info">
                      <span class="class-name">{{ row.name }}</span>
                      <span class="class-sub-desc" v-if="row.description">{{ row.description.substring(0, 20) }}{{ row.description.length > 20 ? '...' : '' }}</span>
                    </div>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column prop="studentCount" label="学生人数" width="150" align="center">
                <template #default="{ row }">
                  <div class="student-count-badge" :class="{ 'has-students': row.studentCount > 0 }">
                    <el-icon><User /></el-icon>
                    <span>{{ row.studentCount }} 人</span>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column prop="createdAt" label="创建时间" width="200">
                <template #default="{ row }">
                  <div class="time-cell">
                    <el-icon><Calendar /></el-icon>
                    <span>{{ formatDate(row.createdAt) }}</span>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column label="操作" width="360" fixed="right" align="center">
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-tooltip content="添加学生" placement="top" :show-after="500" :teleported="false">
                      <el-button class="add-student-btn" @click="handleQuickAddStudents(row)">
                        <el-icon><Plus /></el-icon>
                        添加学生
                      </el-button>
                    </el-tooltip>

                    <el-tooltip content="查看学生" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn view-btn" circle @click="handleViewStudents(row)">
                        <el-icon><View /></el-icon>
                      </el-button>
                    </el-tooltip>

                    <el-tooltip content="编辑班级" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn edit-btn" circle @click="handleEdit(row)">
                        <el-icon><EditPen /></el-icon>
                      </el-button>
                    </el-tooltip>
                    
                    <el-tooltip content="导入名单" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn import-btn" circle @click="handleImport(row)">
                        <el-icon><Upload /></el-icon>
                      </el-button>
                    </el-tooltip>
                    
                    <el-tooltip content="删除班级" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn delete-btn" circle @click="handleDelete(row)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
              
              <template #empty>
                <div class="empty-state">
                  <img src="https://cdn-icons-png.flaticon.com/512/7486/7486754.png" alt="No Data" class="empty-img" />
                  <p>暂无班级数据</p>
                  <el-button type="primary" link @click="handleAddClass">立即创建</el-button>
                </div>
              </template>
            </el-table>
          </el-card>
        </div>
      </div>
    </transition>

    <!-- 创建/编辑班级弹窗 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle" 
      width="500px" 
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      align-center
    >
      <el-form :model="form" label-width="80px" class="custom-form" label-position="top">
        <el-form-item label="班级名称" required>
          <el-input v-model="form.name" placeholder="例如：软件工程2101班" size="large" />
        </el-form-item>
        <el-form-item label="班级描述">
          <el-input 
            v-model="form.description" 
            type="textarea" 
            :rows="4" 
            placeholder="请输入班级描述信息..." 
            resize="none"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false" size="large">取消</el-button>
          <el-button type="primary" @click="handleSave" :loading="submitting" size="large">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 导入学生弹窗 -->
    <el-dialog 
      v-model="importDialogVisible" 
      :title="'导入学生 - ' + currentClass?.name" 
      width="640px" 
      :teleported="false"
      destroy-on-close
      class="import-dialog"
      align-center
    >
      <div class="import-wizard">
        <el-steps :active="activeStep" finish-status="success" align-center class="custom-steps">
          <el-step title="下载模板" icon="Download" />
          <el-step title="上传文件" icon="UploadFilled" />
          <el-step title="完成" icon="CircleCheck" />
        </el-steps>

        <!-- 步骤 1: 下载模板 -->
        <transition name="fade-mode" mode="out-in">
          <div v-if="activeStep === 0" class="step-content" key="step0">
            <div class="info-card">
              <div class="icon-box">
                <el-icon><Document /></el-icon>
              </div>
              <div class="text-content">
                <h4>准备数据文件</h4>
                <p>请先下载标准导入模板，按照格式填写学生信息（学号、姓名等）。</p>
                <p class="warning">注意：请勿修改表头格式，否则可能导致导入失败。</p>
              </div>
            </div>
            <div class="action-area">
              <el-button type="primary" size="large" @click="handleDownloadTemplate" icon="Download" class="download-btn">
                下载最新模板 (.xlsx)
              </el-button>
              <el-button text @click="activeStep = 1">已有模板，直接下一步</el-button>
            </div>
          </div>

          <!-- 步骤 2: 上传文件 -->
          <div v-else-if="activeStep === 1" class="step-content" key="step1">
            <el-upload
              class="upload-area"
              drag
              action="#"
              :show-file-list="false"
              :before-upload="beforeImportUpload"
              :http-request="handleImportUpload"
              accept=".xlsx"
            >
              <div class="upload-placeholder">
                <div class="upload-icon-wrapper">
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                </div>
                <div class="el-upload__text">
                  将文件拖到此处，或 <em>点击上传</em>
                </div>
                <div class="el-upload__tip">
                  只能上传 xlsx 文件，且不超过 5MB
                </div>
              </div>
            </el-upload>
            <div class="back-btn">
              <el-button link @click="activeStep = 0">返回上一步</el-button>
            </div>
          </div>

          <!-- 导入中/结果展示 -->
          <div v-else-if="activeStep === 2" class="step-content result-content" key="step2">
            <div v-if="importing" class="loading-state">
              <div class="spinner"></div>
              <p>正在处理数据，请稍候...</p>
            </div>
            
            <div v-else class="result-state">
              <div class="success-summary" v-if="importResult">
                <el-result
                  :icon="importResult.failedRows > 0 ? 'warning' : 'success'"
                  :title="importResult.failedRows > 0 ? '部分导入完成' : '导入成功'"
                  :sub-title="`成功: ${importResult.successRows} 条 | 失败: ${importResult.failedRows} 条`"
                >
                  <template #extra>
                    <el-button type="primary" @click="finishImport" size="large">完成</el-button>
                    <el-button v-if="importResult.failedRows > 0" @click="showErrorDetails">查看失败详情</el-button>
                  </template>
                </el-result>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </el-dialog>

    <!-- 查看学生弹窗 -->
    <el-dialog
      v-model="viewStudentsDialogVisible"
      :title="'学生名单 - ' + (currentViewClass?.name || '')"
      width="900px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog student-list-dialog"
      align-center
    >
      <!-- 工具栏 -->
      <div class="student-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="studentSearchQuery"
            placeholder="搜索学号、姓名、邮箱..."
            prefix-icon="Search"
            clearable
            class="search-input"
            style="width: 280px"
          />
          <el-select
            v-model="studentDepartmentFilter"
            placeholder="筛选学院"
            clearable
            class="filter-select"
            style="width: 180px"
            :teleported="false"
          >
            <el-option label="全部学院" value="" />
            <el-option
              v-for="dept in uniqueDepartments"
              :key="dept"
              :label="dept"
              :value="dept"
            />
          </el-select>
        </div>
        <div class="toolbar-right">
          <el-tag type="info" effect="plain" round>共 {{ filteredStudents.length }} 人</el-tag>
        </div>
      </div>

      <!-- 学生表格 -->
      <el-table
        :data="filteredStudents"
        v-loading="studentsLoading"
        stripe
        height="450"
        class="student-table"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
      >
        <el-table-column prop="studentId" label="学号" width="130" sortable fixed />
        <el-table-column prop="realName" label="姓名" width="110" sortable fixed>
          <template #default="{ row }">
            <div class="student-name">
              <el-avatar :size="28" :src="row.avatar" style="background: #3b82f6">{{ row.realName.charAt(0) }}</el-avatar>
              <span>{{ row.realName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" min-width="100">
          <template #default="{ row }">
            <span style="color: #909399; font-size: 13px">{{ row.nickname || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="160" :show-overflow-tooltip="{ teleported: false }" />
        <el-table-column prop="department" label="学院" min-width="110" :show-overflow-tooltip="{ teleported: false }">
          <template #default="{ row }">
            <el-tag size="small" effect="light" type="info">{{ getDepartmentText(row.department, '-') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <div class="student-actions">
              <el-button
                class="action-btn edit-btn"
                circle
                size="small"
                @click="handleEditStudent(row)"
                title="编辑学生"
              >
                <el-icon><EditPen /></el-icon>
              </el-button>
              <el-button
                class="action-btn delete-btn"
                circle
                size="small"
                @click="handleRemoveStudent(row)"
                title="移除学生"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>


    </el-dialog>

    <!-- 编辑学生弹窗 -->
    <el-dialog
      v-model="editStudentDialogVisible"
      :title="'编辑学生 - ' + (editingStudent?.realName || '')"
      width="500px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      align-center
    >
      <el-form :model="editStudentForm" label-width="80px" class="custom-form" label-position="top">
        <el-form-item label="学号">
          <el-input v-model="editStudentForm.studentId" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editStudentForm.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="editStudentForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editStudentForm.email" placeholder="请输入邮箱" type="email" />
        </el-form-item>
        <el-form-item label="学院">
          <el-input v-model="editStudentForm.department" placeholder="请输入学院" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editStudentDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSaveStudent" :loading="studentSubmitting">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加学生到班级弹窗 -->
    <el-dialog
      v-model="addStudentDialogVisible"
      :title="`添加学生到班级${currentViewClass?.name ? ' - ' + currentViewClass.name : ''}`"
      width="760px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      align-center
    >
      <el-input
        v-model="studentKeyword"
        placeholder="输入姓名/学号搜索未分班学生（支持输入1个字）"
        clearable
        class="search-input"
        @input="searchStudents"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-table
        :data="availableStudents"
        v-loading="studentSearchLoading"
        height="360"
        style="margin-top: 12px"
        @selection-change="handleStudentSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="studentId" label="学号" width="140" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column prop="department" label="学院" min-width="160" :show-overflow-tooltip="{ teleported: false }" />
        <el-table-column prop="email" label="邮箱" min-width="200" :show-overflow-tooltip="{ teleported: false }" />
      </el-table>

      <div style="margin-top: 10px; color: #606266; font-size: 13px;">
        已勾选 {{ selectedCandidateStudentIds.length }} 人
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addStudentDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleConfirmAddStudent" :loading="studentSubmitting">批量添加</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Search, Edit, Delete, Upload, Download, 
  User, Timer, School, UploadFilled, Loading, 
  CircleCheck, InfoFilled, Calendar, View, EditPen,
  Document, Refresh
} from '@element-plus/icons-vue'
import { getMyClasses, createClass, updateClass, deleteClass, importStudentsToClass, downloadStudentImportTemplate, getClassStudents, addStudentToClass, addStudentsToClassBatch, removeStudentFromClass, searchStudentList } from '@/api/teacher/class'
import { getDepartmentText } from '@/utils/orgClass'

// 状态定义
const loading = ref(false)
const submitting = ref(false)
const classes = ref([])
const searchQuery = ref('')

const dialogVisible = ref(false)
const dialogTitle = ref('创建班级')
const form = reactive({
  id: null,
  name: '',
  description: ''
})

// 导入相关状态
const importDialogVisible = ref(false)
const importing = ref(false)
const currentClass = ref(null)
const activeStep = ref(0)
const importResult = ref(null)

// 学生列表相关
const viewStudentsDialogVisible = ref(false)
const studentsLoading = ref(false)
const classStudents = ref([])
const currentViewClass = ref(null)
const studentSearchQuery = ref('')
const studentDepartmentFilter = ref('')
const selectedStudents = ref([])

// 编辑学生相关
const editStudentDialogVisible = ref(false)
const editingStudent = ref(null)
const studentSubmitting = ref(false)
const editStudentForm = reactive({
  id: null,
  studentId: '',
  realName: '',
  nickname: '',
  email: '',
  department: ''
})

// 添加学生相关
const addStudentDialogVisible = ref(false)
const studentKeyword = ref('')
const availableStudents = ref([])
const studentSearchLoading = ref(false)
const selectedCandidateStudentIds = ref([])

const normalizeStudentDepartment = (student) => ({
  ...student,
  department: getDepartmentText(student?.department, '')
})

const handleViewStudents = async (row) => {
  currentViewClass.value = row
  viewStudentsDialogVisible.value = true
  studentsLoading.value = true
  try {
    const res = await getClassStudents(row.id)
    classStudents.value = (res.data || []).map(normalizeStudentDepartment)
  } catch (error) {
    ElMessage.error('获取学生列表失败')
  } finally {
    studentsLoading.value = false
  }
}

const handleEditStudent = (row) => {
  editingStudent.value = row
  editStudentForm.id = row.id
  editStudentForm.studentId = row.studentId
  editStudentForm.realName = row.realName
  editStudentForm.nickname = row.nickname || ''
  editStudentForm.email = row.email || ''
  editStudentForm.department = getDepartmentText(row.department, '')
  editStudentDialogVisible.value = true
}

const handleSaveStudent = async () => {
  if (!editStudentForm.realName) {
    ElMessage.warning('请输入姓名')
    return
  }
  
  studentSubmitting.value = true
  try {
    // 调用后端更新用户信息 API
    // 这里需要后端提供更新用户信息的接口
    ElMessage.success('保存成功')
    editStudentDialogVisible.value = false
    // 刷新学生列表
    if (currentViewClass.value) {
      await handleViewStudents(currentViewClass.value)
    }
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    studentSubmitting.value = false
  }
}

const handleRemoveStudent = (row) => {
  ElMessageBox.confirm(
    `确定要从班级中移除学生 "${row.realName}" 吗?`,
    '移除确认',
    {
      confirmButtonText: '确定移除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await removeStudentFromClass(currentViewClass.value.id, row.id)
      ElMessage.success('移除成功')
      // 刷新学生列表
      if (currentViewClass.value) {
        await handleViewStudents(currentViewClass.value)
      }
    } catch (error) {
      ElMessage.error(error.message || '移除失败')
    }
  }).catch(() => {})
}

const handleAddStudentToClass = (classRow = null) => {
  if (classRow) {
    currentViewClass.value = classRow
  }
  if (!currentViewClass.value?.id) {
    ElMessage.warning('请先选择班级')
    return
  }
  studentKeyword.value = ''
  availableStudents.value = []
  selectedCandidateStudentIds.value = []
  addStudentDialogVisible.value = true
  searchStudents('')
}

const handleQuickAddStudents = (row) => {
  handleAddStudentToClass(row)
}

const searchStudents = async (query) => {
  if (!currentViewClass.value?.id) return

  studentSearchLoading.value = true
  try {
    const keyword = typeof query === 'string' ? query : studentKeyword.value
    const res = await searchStudentList(keyword || '', currentViewClass.value.id, 200)
    availableStudents.value = (res.data || []).map(normalizeStudentDepartment)
  } catch (error) {
    ElMessage.error('搜索失败')
  } finally {
    studentSearchLoading.value = false
  }
}

const handleStudentSelectionChange = (rows) => {
  selectedCandidateStudentIds.value = (rows || []).map(item => item.id)
}

const handleConfirmAddStudent = async () => {
  if (!currentViewClass.value?.id) {
    ElMessage.warning('班级信息无效')
    return
  }
  if (!selectedCandidateStudentIds.value.length) {
    ElMessage.warning('请先勾选学生')
    return
  }
  
  studentSubmitting.value = true
  try {
    if (selectedCandidateStudentIds.value.length === 1) {
      await addStudentToClass(currentViewClass.value.id, selectedCandidateStudentIds.value[0])
    } else {
      await addStudentsToClassBatch(currentViewClass.value.id, selectedCandidateStudentIds.value)
    }
    ElMessage.success('添加成功')
    addStudentDialogVisible.value = false
    await loadClasses()
    // 刷新学生列表
    if (currentViewClass.value) {
      await handleViewStudents(currentViewClass.value)
    }
  } catch (error) {
    ElMessage.error(error.message || '添加失败')
  } finally {
    studentSubmitting.value = false
  }
}

// 计算属性：过滤班级
const filteredClasses = computed(() => {
  if (!searchQuery.value) return classes.value
  const query = searchQuery.value.toLowerCase()
  return classes.value.filter(cls => 
    cls.name.toLowerCase().includes(query) || 
    (cls.description && cls.description.toLowerCase().includes(query))
  )
})

// 计算属性：获取唯一的学院列表
const uniqueDepartments = computed(() => {
  const depts = new Set(classStudents.value.map(s => s.department).filter(d => d))
  return Array.from(depts).sort()
})

// 计算属性：过滤学生
const filteredStudents = computed(() => {
  let result = classStudents.value
  
  // 按搜索关键词过滤
  if (studentSearchQuery.value) {
    const query = studentSearchQuery.value.toLowerCase()
    result = result.filter(student =>
      student.studentId.toLowerCase().includes(query) ||
      student.realName.toLowerCase().includes(query) ||
      (student.email && student.email.toLowerCase().includes(query)) ||
      (student.nickname && student.nickname.toLowerCase().includes(query))
    )
  }
  
  // 按学院过滤
  if (studentDepartmentFilter.value) {
    result = result.filter(student => student.department === studentDepartmentFilter.value)
  }
  
  return result
})

// 统计数据
const totalStudents = computed(() => {
  return classes.value.reduce((sum, cls) => sum + (cls.studentCount || 0), 0)
})

const lastUpdateTime = computed(() => {
  if (classes.value.length === 0) return '-'
  // 假设按创建时间排序，取最新的
  const dates = classes.value.map(c => new Date(c.createdAt).getTime())
  const maxDate = new Date(Math.max(...dates))
  return maxDate.toLocaleDateString()
})

// 格式化时间
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}

// 加载数据
const loadClasses = async () => {
  loading.value = true
  try {
    const res = await getMyClasses()
    classes.value = res.data || []
  } catch (error) {
    ElMessage.error(error.message || '加载班级列表失败')
  } finally {
    loading.value = false
  }
}

// CRUD 操作
const handleAddClass = () => {
  dialogTitle.value = '创建班级'
  form.id = null
  form.name = ''
  form.description = ''
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑班级'
  form.id = row.id
  form.name = row.name
  form.description = row.description
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(
    `确定要删除班级 "${row.name}" 吗? 删除后无法恢复。`, 
    '删除确认', 
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await deleteClass(row.id)
      ElMessage.success('删除成功')
      loadClasses()
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
    }
  }).catch(() => {})
}

const handleSave = async () => {
  if (!form.name) {
    ElMessage.warning('请输入班级名称')
    return
  }
  
  submitting.value = true
  try {
    if (form.id) {
      await updateClass(form.id, {
        name: form.name,
        description: form.description
      })
      ElMessage.success('更新成功')
    } else {
      await createClass({
        name: form.name,
        description: form.description
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadClasses()
  } catch (error) {
    ElMessage.error(error.message || (form.id ? '更新失败' : '创建失败'))
  } finally {
    submitting.value = false
  }
}

// 导入流程控制
const handleImport = (row) => {
  currentClass.value = row
  activeStep.value = 0
  importResult.value = null
  importDialogVisible.value = true
}

const handleDownloadTemplate = async () => {
  if (!currentClass.value) return
  try {
    const res = await downloadStudentImportTemplate(currentClass.value.id)
    const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `student-import-template-${currentClass.value.name}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    
    // 自动跳转到下一步
    setTimeout(() => {
      activeStep.value = 1
    }, 1000)
  } catch (e) {
    ElMessage.error('模板下载失败')
  }
}

const beforeImportUpload = (rawFile) => {
  const name = rawFile?.name || ''
  if (!name.toLowerCase().endsWith('.xlsx')) {
    ElMessage.warning('仅支持 .xlsx 文件')
    return false
  }
  return true
}

const handleImportUpload = async (options) => {
  if (!currentClass.value) return
  
  activeStep.value = 2
  importing.value = true
  
  try {
    const formData = new FormData()
    formData.append('file', options.file)
    const res = await importStudentsToClass(currentClass.value.id, formData)
    importResult.value = res.data
    
    // 刷新列表以更新人数
    loadClasses()
  } catch (error) {
    ElMessage.error(error.message || '导入失败')
    activeStep.value = 1 // 回到上传步
  } finally {
    importing.value = false
  }
}

const finishImport = () => {
  importDialogVisible.value = false
}

const showErrorDetails = () => {
  if (!importResult.value || !importResult.value.errors) return
  
  const errors = importResult.value.errors
  const preview = errors.slice(0, 20).map(e => `第${e.rowNumber}行：${e.username || ''} ${e.message}`).join('\n')
  
  ElMessageBox.alert(preview + (errors.length > 20 ? '\n...（仅展示前20条）' : ''), '导入失败详情', {
    type: 'warning',
    confirmButtonText: '关闭',
    customClass: 'error-detail-dialog'
  })
}

const tableRowClassName = ({ row, rowIndex }) => {
  return 'custom-row'
}

onMounted(() => {
  loadClasses()
})
</script>

<style scoped lang="scss">
// 变量定义
$primary-color: #4f46e5;
$primary-light: #e0e7ff;
$text-main: #1e293b;
$text-secondary: #64748b;
$bg-color: #f1f5f9;
$card-bg: #ffffff;
$border-color: #e2e8f0;

.class-management-container {
  padding: 16px; // 压缩内边距
  min-height: 100%;
  background-color: $bg-color;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

// 动画定义
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-mode-enter-active,
.fade-mode-leave-active {
  transition: opacity 0.3s ease;
}

.fade-mode-enter-from,
.fade-mode-leave-to {
  opacity: 0;
}

// 头部样式
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px; // 压缩间距
  
  .header-content {
    .page-title {
      font-size: 20px; // 缩小标题
      font-weight: 800;
      color: $text-main;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #4f46e5 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .page-desc {
      color: $text-secondary;
      font-size: 13px; // 缩小副标题
      margin: 0;
    }
  }
  
  .create-btn {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
    border: none;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    transition: all 0.3s ease;
    padding: 8px 16px; // 减小按钮尺寸
    height: 36px;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

// 统计卡片
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); // 减小最小宽度
  gap: 12px; // 压缩间距
  margin-bottom: 16px; // 压缩间距
  
  .stat-card {
    background: $card-bg;
    border-radius: 12px; // 减小圆角
    padding: 16px; // 压缩内边距
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px -3px rgba(0, 0, 0, 0.1);
    }
    
    .stat-icon {
      width: 40px; // 缩小图标容器
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px; // 缩小图标
      
      &.blue-bg { background: #eff6ff; color: #3b82f6; }
      &.green-bg { background: #f0fdf4; color: #22c55e; }
      &.purple-bg { background: #f5f3ff; color: #8b5cf6; }
    }
    
    .stat-info {
      display: flex;
      flex-direction: column;
      
      .stat-label {
        font-size: 12px; // 缩小字体
        color: $text-secondary;
        font-weight: 500;
      }
      
      .stat-value {
        font-size: 20px; // 缩小字体
        font-weight: 700;
        color: $text-main;
        line-height: 1.2;
        
        &.text-sm {
          font-size: 16px;
        }
      }
    }
  }
}

// 主内容区
.main-content {
  .table-card {
    border: none;
    border-radius: 12px; // 减小圆角
    overflow: hidden;
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);
    
    :deep(.el-card__body) {
      padding: 0;
    }
  }
}

.toolbar {
  padding: 12px 16px; // 压缩内边距
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  
  .search-input {
    width: 280px; // 减小宽度
    
    :deep(.el-input__wrapper) {
      border-radius: 6px;
      box-shadow: 0 0 0 1px $border-color inset;
      padding: 4px 8px; // 减小内边距
      height: 32px; // 减小高度
      transition: all 0.3s;
      
      &:hover {
        box-shadow: 0 0 0 1px #cbd5e1 inset;
      }
      
      &.is-focus {
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2) inset;
      }
    }
  }
}

// 表格样式
.custom-table {
  :deep(.el-table__row) {
    height: 60px; // 压缩行高
    transition: all 0.2s;
    
    &:hover {
      background-color: #f8fafc !important;
      transform: scale(1.001);
      z-index: 1;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    }
  }

  .index-cell {
    color: #94a3b8;
    font-size: 13px;
  }
  
  .name-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .class-avatar {
      width: 36px; // 缩小头像
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }
    
    .name-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      
      .class-name {
        font-weight: 600;
        color: $text-main;
        font-size: 14px; // 缩小字体
      }
      
      .class-sub-desc {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 0;
      }
    }
  }
  
  .student-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px; // 减小内边距
    border-radius: 16px;
    background: #f1f5f9;
    color: #64748b;
    font-size: 12px; // 缩小字体
    font-weight: 500;
    transition: all 0.3s;
    
    &.has-students {
      background: #ecfdf5;
      color: #059669;
    }
  }
  
  .time-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    font-size: 12px; // 缩小字体
  }
  
  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 6px;

    .add-student-btn {
      border-radius: 14px;
      border: 1px solid #22c55e;
      color: #16a34a;
      background: #f0fdf4;
      padding: 4px 10px;
      font-size: 12px;
      height: 28px;
      transition: all 0.2s;

      &:hover {
        background: #22c55e;
        color: #fff;
      }
    }
    
    .action-btn {
      border: none;
      background: transparent;
      transition: all 0.2s;
      width: 28px;
      height: 28px;
      
      &:hover {
        transform: scale(1.1);
      }
      
      &.view-btn { color: #64748b; &:hover { background: #f1f5f9; color: #4f46e5; } }
      &.edit-btn { color: #64748b; &:hover { background: #eff6ff; color: #3b82f6; } }
      &.import-btn { color: #64748b; &:hover { background: #f0fdf4; color: #22c55e; } }
      &.delete-btn { color: #64748b; &:hover { background: #fef2f2; color: #ef4444; } }
    }
  }
}

.empty-state {
  padding: 40px 0;
  text-align: center;
  
  .empty-img {
    width: 120px;
    margin-bottom: 16px;
    opacity: 0.8;
  }
  
  p {
    color: $text-secondary;
    margin-bottom: 16px;
  }
}

// 学生列表弹窗样式
.student-list-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

// 学生工具栏
.student-toolbar {
  padding: 16px 20px;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: #f8fafc;
  
  .toolbar-left {
    display: flex;
    gap: 12px;
    align-items: center;
    flex: 1;
    
    .search-input {
      :deep(.el-input__wrapper) {
        border-radius: 8px;
        box-shadow: 0 0 0 1px $border-color inset;
        transition: all 0.3s;
        
        &:hover {
          box-shadow: 0 0 0 1px #cbd5e1 inset;
        }
        
        &.is-focus {
          box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2) inset;
        }
      }
    }
    
    .filter-select {
      :deep(.el-input__wrapper) {
        border-radius: 8px;
        box-shadow: 0 0 0 1px $border-color inset;
        transition: all 0.3s;
        
        &:hover {
          box-shadow: 0 0 0 1px #cbd5e1 inset;
        }
      }
    }
  }
  
  .toolbar-right {
    display: flex;
    gap: 8px;
  }
}

// 学生列表样式
.student-table {
  :deep(.el-table__body-wrapper) {
    padding: 0 20px;
  }
  
  :deep(.el-table__row) {
    height: 68px;
    transition: all 0.2s;
    
    &:hover {
      background-color: #f8fafc !important;
    }
  }
  
  .student-name {
    display: flex;
    align-items: center;
    gap: 10px;
    
    span {
      font-weight: 500;
      color: $text-main;
    }
  }
}

.student-actions {
  display: flex;
  justify-content: center;
  gap: 6px;
  
  .action-btn {
    border: none;
    background: transparent;
    transition: all 0.2s;
    padding: 6px;
    
    &:hover {
      transform: scale(1.15);
    }
    
    &.edit-btn {
      color: #64748b;
      &:hover {
        background: #eff6ff;
        color: #3b82f6;
      }
    }
    
    &.delete-btn {
      color: #64748b;
      &:hover {
        background: #fef2f2;
        color: #ef4444;
      }
    }
  }
}



// 导入向导样式优化
.import-wizard {
  padding: 10px 20px;
  
  .custom-steps {
    margin-bottom: 32px;
  }
  
  .step-content {
    min-height: 240px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  .info-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    gap: 20px;
    margin-bottom: 24px;
    width: 100%;
    
    .icon-box {
      width: 48px;
      height: 48px;
      background: #e0f2fe;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0284c7;
      font-size: 24px;
    }
    
    .text-content {
      flex: 1;
      h4 { margin: 0 0 8px 0; color: $text-main; }
      p { margin: 0 0 4px 0; color: $text-secondary; font-size: 14px; }
      .warning { color: #ef4444; font-weight: 500; margin-top: 8px; }
    }
  }
  
  .upload-area {
    width: 100%;
    
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 220px;
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      background: #f8fafc;
      transition: all 0.3s;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      
      &:hover {
        border-color: $primary-color;
        background: #eff6ff;
        transform: translateY(-2px);
      }
      
      .upload-icon-wrapper {
        width: 64px;
        height: 64px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        
        .el-icon { font-size: 32px; color: $primary-color; }
      }
    }
  }
  
  .loading-state {
    text-align: center;
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e2e8f0;
      border-top-color: $primary-color;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// 响应式
@media (max-width: 768px) {
  .class-management-container {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    
    .header-actions { width: 100%; .create-btn { width: 100%; } }
  }
  
  .stats-row {
    grid-template-columns: 1fr;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 12px;
    
    .search-input { width: 100%; }
    .right-tools { width: 100%; display: flex; justify-content: flex-end; }
  }
}
</style>
