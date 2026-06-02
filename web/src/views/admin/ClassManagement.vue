<template>
  <div class="class-management">
    <el-card shadow="never" class="table-card border-card">
      <template #header>
        <div class="card-header">
          <div class="left-panel">
            <div class="title-box">
              <span class="title">班级管理</span>
              <span class="subtitle">管理系统所有班级信息</span>
            </div>
            <el-tag type="primary" effect="light" round class="count-tag">
              <el-icon><School /></el-icon>
              共 {{ total }} 个
            </el-tag>
          </div>
          <div class="right-panel">
            <el-input
              v-model="searchQuery"
              placeholder="搜索班级名称"
              prefix-icon="Search"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button type="primary" icon="Plus" class="add-btn" @click="handleAdd">添加班级</el-button>
          </div>
        </div>
      </template>

      <el-table 
        :data="classes" 
        style="width: 100%" 
        v-loading="loading"
        :header-cell-style="{ background: '#f8f9fb', color: '#606266', height: '50px' }"
        :row-class-name="tableRowClassName"
      >
        <el-table-column label="序号" width="80" align="center">
          <template #default="{ $index }">
            <span class="index-badge">{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="className" label="班级名称" min-width="150">
          <template #default="{ row }">
            <div class="class-cell">
              <div class="class-icon">
                <el-icon><School /></el-icon>
              </div>
              <span class="name">{{ row.className }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="teacherName" label="绑定教师" width="180">
          <template #default="{ row }">
            <div class="teacher-cell" v-if="row.teacherName">
              <el-avatar :size="24" class="teacher-avatar">
                {{ row.teacherName?.charAt(0) || 'T' }}
              </el-avatar>
              <span>{{ row.teacherName }}</span>
            </div>
            <el-tag v-else type="info" effect="light" size="small">未绑定</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="studentCount" label="学生人数" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="primary" effect="plain" round class="count-badge">
              {{ row.studentCount || 0 }} 人
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">
            <div class="time-cell">
              <el-icon><Timer /></el-icon>
              <span>{{ formatDate(row.createdAt) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button link type="success" size="small" @click="handleOpenAddStudents(row)">
                <el-icon><Plus /></el-icon> 添加学生
              </el-button>
              <el-button link type="primary" size="small" @click="handleBindTeacher(row)">
                <el-icon><User /></el-icon> 绑定教师
              </el-button>
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon> 删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle" 
      width="500px" 
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      center
    >
      <el-form :model="form" label-width="80px" label-position="top">
        <el-form-item label="班级名称" required>
          <el-input v-model="form.className" placeholder="请输入班级名称" prefix-icon="School" />
        </el-form-item>
        <el-form-item label="绑定教师">
          <el-select v-model="form.teacherId" placeholder="选择教师" clearable style="width: 100%" :teleported="false">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <el-option 
              v-for="t in teachers" 
              :key="t.id" 
              :label="`${t.realName} (${t.username})`" 
              :value="t.id" 
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 绑定教师对话框 -->
    <el-dialog 
      v-model="bindDialogVisible" 
      title="绑定教师" 
      width="400px" 
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      center
    >
      <el-form label-width="80px" label-position="top">
        <el-form-item label="当前班级">
          <el-input :value="currentClass?.className" disabled prefix-icon="School" />
        </el-form-item>
        <el-form-item label="选择教师">
          <el-select v-model="selectedTeacherId" placeholder="选择教师" clearable style="width: 100%" :teleported="false">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <el-option 
              v-for="t in teachers" 
              :key="t.id" 
              :label="`${t.realName} (${t.username})`" 
              :value="t.id" 
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="bindDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleConfirmBind">确定绑定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="addStudentsDialogVisible"
      :title="`添加学生 - ${targetClass?.className || ''}`"
      width="760px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      center
    >
      <el-input
        v-model="studentKeyword"
        placeholder="输入姓名/学号搜索未分班学生（支持输入1个字）"
        clearable
        @input="searchUnassignedStudentsList"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-table
        :data="candidateStudents"
        v-loading="searchStudentsLoading"
        height="360"
        style="margin-top: 12px"
        @selection-change="handleCandidateSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="studentId" label="学号" width="140" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column label="??" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ getDepartmentLabel(row.department) }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="200" show-overflow-tooltip />
      </el-table>

      <div style="margin-top: 10px; color: #606266; font-size: 13px;">
        已勾选 {{ selectedStudentIds.length }} 人
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addStudentsDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="addingStudents" @click="handleConfirmAddStudents">批量添加</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, Plus, School, Edit, Delete, 
  Timer, User 
} from '@element-plus/icons-vue'
import { getAllClasses, createClass, updateClass, deleteClass, bindClassToTeacher, addStudentToClass, addStudentsToClassBatch, searchUnassignedStudents } from '@/api/admin/class'
import { getAllTeachers } from '@/api/admin/teacher'
import { getDepartmentText } from '@/utils/orgClass'

const loading = ref(false)
const classes = ref([])
const teachers = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('添加班级')
const searchQuery = ref('')
const bindDialogVisible = ref(false)
const currentClass = ref(null)
const selectedTeacherId = ref(null)
const addStudentsDialogVisible = ref(false)
const targetClass = ref(null)
const studentKeyword = ref('')
const searchStudentsLoading = ref(false)
const addingStudents = ref(false)
const candidateStudents = ref([])
const selectedStudentIds = ref([])

const getDepartmentLabel = (department) => getDepartmentText(department)

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const form = reactive({
  id: null,
  className: '',
  teacherId: null
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadClasses = async () => {
  loading.value = true
  try {
    const res = await getAllClasses({
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchQuery.value || undefined
    })
    classes.value = res.data?.records || res.data || []
    total.value = res.data?.total || classes.value.length || 0
  } catch (e) {
    ElMessage.error('加载班级列表失败')
  } finally {
    loading.value = false
  }
}

const loadTeachers = async () => {
  try {
    const res = await getAllTeachers({ page: 1, size: 1000 })
    teachers.value = res.data?.records || res.data || []
  } catch (e) {
    console.error('加载教师列表失败', e)
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadClasses()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadClasses()
}

const handlePageChange = (val) => {
  currentPage.value = val
  loadClasses()
}

const handleAdd = () => {
  dialogTitle.value = '添加班级'
  form.id = null
  form.className = ''
  form.teacherId = null
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑班级'
  form.id = row.id
  form.className = row.className
  form.teacherId = row.teacherId
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除班级 "${row.className}" 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await deleteClass(row.id)
      ElMessage.success('删除成功')
      loadClasses()
    } catch (e) {
      ElMessage.error(e.message || '删除失败')
    }
  }).catch(() => {})
}

const handleBindTeacher = (row) => {
  currentClass.value = row
  selectedTeacherId.value = row.teacherId
  bindDialogVisible.value = true
}

const handleConfirmBind = async () => {
  if (!selectedTeacherId.value) {
    ElMessage.warning('请选择教师')
    return
  }
  try {
    await bindClassToTeacher(currentClass.value.id, selectedTeacherId.value)
    ElMessage.success('绑定成功')
    bindDialogVisible.value = false
    loadClasses()
  } catch (e) {
    ElMessage.error(e.message || '绑定失败')
  }
}

const handleSave = async () => {
  if (!form.className?.trim()) {
    ElMessage.warning('请输入班级名称')
    return
  }
  
  try {
    if (form.id) {
      await updateClass(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await createClass(form)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadClasses()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

const handleOpenAddStudents = async (row) => {
  targetClass.value = row
  studentKeyword.value = ''
  selectedStudentIds.value = []
  candidateStudents.value = []
  addStudentsDialogVisible.value = true
  await searchUnassignedStudentsList('')
}

const searchUnassignedStudentsList = async (query) => {
  if (!targetClass.value?.id) return
  searchStudentsLoading.value = true
  try {
    const keyword = typeof query === 'string' ? query : studentKeyword.value
    const res = await searchUnassignedStudents(keyword || '', targetClass.value.id, 200)
    candidateStudents.value = res.data || []
  } catch (e) {
    ElMessage.error(e.message || '搜索学生失败')
  } finally {
    searchStudentsLoading.value = false
  }
}

const handleCandidateSelectionChange = (rows) => {
  selectedStudentIds.value = (rows || []).map(item => item.id)
}

const handleConfirmAddStudents = async () => {
  if (!targetClass.value?.id) {
    ElMessage.warning('班级信息无效')
    return
  }
  if (!selectedStudentIds.value.length) {
    ElMessage.warning('请先勾选学生')
    return
  }

  addingStudents.value = true
  try {
    if (selectedStudentIds.value.length === 1) {
      await addStudentToClass(targetClass.value.id, selectedStudentIds.value[0])
    } else {
      await addStudentsToClassBatch(targetClass.value.id, selectedStudentIds.value)
    }
    ElMessage.success('添加成功')
    addStudentsDialogVisible.value = false
    loadClasses()
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    addingStudents.value = false
  }
}

const tableRowClassName = ({ row, rowIndex }) => {
  return 'custom-row'
}

onMounted(() => {
  loadClasses()
  loadTeachers()
})
</script>

<style scoped lang="scss">
.class-management {
  padding: 0;
  
  .border-card {
    border: 1px solid #f0f2f5;
    border-radius: 16px;
    
    :deep(.el-card__header) {
      padding: 20px 24px;
      border-bottom: 1px solid #f5f7fa;
    }
    
    :deep(.el-card__body) {
      padding: 0;
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .left-panel {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .title-box {
      display: flex;
      flex-direction: column;
      
      .title {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        line-height: 1.2;
      }
      
      .subtitle {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }
    
    .count-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      height: 28px;
    }
  }
  
  .right-panel {
    display: flex;
    gap: 12px;
    align-items: center;
    
    .search-input {
      width: 240px;
      
      :deep(.el-input__wrapper) {
        border-radius: 20px;
        box-shadow: 0 0 0 1px #dcdfe6 inset;
        
        &:hover, &.is-focus {
          box-shadow: 0 0 0 1px #409eff inset;
        }
      }
    }
    
    .add-btn {
      border-radius: 20px;
      padding: 8px 20px;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
      }
    }
  }
}

.class-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .class-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #ecf5ff;
    color: #409eff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  
  .name {
    font-weight: 600;
    color: #303133;
  }
}

.teacher-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .teacher-avatar {
    background: #67c23a;
    font-size: 12px;
  }
}

.time-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 13px;
}

.count-badge {
  min-width: 60px;
}

.index-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: #f5f7fa;
  color: #909399;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

.action-buttons {
  opacity: 0.8;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 1;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #f5f7fa;
}

:deep(.el-table) {
  &::before { display: none; }
  .el-table__inner-wrapper::before { display: none; }
  
  .custom-row {
    transition: all 0.2s;
    &:hover {
      background-color: #f9fafc !important;
      td { background-color: #f9fafc !important; }
    }
  }
}

.custom-dialog {
  :deep(.el-dialog__header) {
    margin-right: 0;
    border-bottom: 1px solid #f0f2f5;
    padding: 20px 24px;
  }
  
  :deep(.el-dialog__body) {
    padding: 30px 40px;
  }
  
  :deep(.el-dialog__footer) {
    border-top: 1px solid #f0f2f5;
    padding: 20px 24px;
  }
}
</style>
