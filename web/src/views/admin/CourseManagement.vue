<template>
  <div class="course-management">
    <el-card shadow="never" class="table-card border-card">
      <template #header>
        <div class="card-header">
          <div class="left-panel">
            <div class="title-box">
              <span class="title">课程管理</span>
              <span class="subtitle">管理课程基础信息与授课教师分配</span>
            </div>
            <el-tag type="primary" effect="light" round class="count-tag">
              <el-icon><Reading /></el-icon>
              共 {{ total }} 门
            </el-tag>
          </div>
          <div class="right-panel">
            <el-input
              v-model="searchQuery"
              placeholder="搜索课程名称/编码/教师"
              :prefix-icon="Search"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button type="primary" :icon="Plus" class="add-btn" @click="handleAdd">添加课程</el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="courses"
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
        <el-table-column prop="courseName" label="课程名称" min-width="180">
          <template #default="{ row }">
            <div class="course-cell">
              <div class="course-icon">
                <el-icon><Reading /></el-icon>
              </div>
              <div class="course-info">
                <span class="course-name">{{ row.courseName }}</span>
                <span class="course-code">编号：{{ row.courseCode || '-' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="teacherName" label="授课教师" width="180">
          <template #default="{ row }">
            <div class="teacher-cell" v-if="row.teacherName || row.teacherUsername">
              <el-avatar :size="24" class="teacher-avatar">
                {{ (row.teacherName || row.teacherUsername || 'T').charAt(0) }}
              </el-avatar>
              <div class="teacher-info">
                <span>{{ row.teacherName || row.teacherUsername }}</span>
                <small v-if="row.teacherUsername && row.teacherName && row.teacherUsername !== row.teacherName">
                  @{{ row.teacherUsername }}
                </small>
              </div>
            </div>
            <el-tag v-else type="info" effect="light" size="small">未分配</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="课程描述" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="desc-text">{{ row.description || '暂无描述' }}</span>
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
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
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

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      center
    >
      <el-form :model="form" label-width="80px" label-position="top">
        <el-form-item label="课程名称" required>
          <el-input v-model="form.courseName" placeholder="请输入课程名称" :prefix-icon="Reading" />
        </el-form-item>
        <el-form-item label="课程编码" required>
          <el-input v-model="form.courseCode" placeholder="请输入课程编码" :prefix-icon="Tickets" />
        </el-form-item>
        <el-form-item label="授课教师">
          <el-select
            v-model="form.teacherId"
            placeholder="请选择授课教师"
            clearable
            style="width: 100%"
            :teleported="false"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <el-option
              v-for="teacher in teachers"
              :key="teacher.id"
              :label="teacherLabel(teacher)"
              :value="teacher.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="课程描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请输入课程简介或说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Reading, Search, Tickets, Timer, User } from '@element-plus/icons-vue'
import { createCourse, deleteCourse, getAllCourses, updateCourse } from '@/api/admin/course'
import { getAllTeachers } from '@/api/admin/teacher'

const loading = ref(false)
const courses = ref([])
const teachers = ref([])
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('添加课程')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const form = reactive({
  id: null,
  courseName: '',
  courseCode: '',
  teacherId: null,
  description: '',
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const teacherLabel = (teacher) => {
  const displayName = teacher?.realName || teacher?.username || '未命名教师'
  if (!teacher?.username || teacher.username === displayName) {
    return displayName
  }
  return `${displayName} (${teacher.username})`
}

const loadCourses = async () => {
  loading.value = true
  try {
    const res = await getAllCourses({
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchQuery.value || undefined,
    })
    courses.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    ElMessage.error(error.message || '加载课程列表失败')
  } finally {
    loading.value = false
  }
}

const loadTeachers = async () => {
  try {
    const res = await getAllTeachers({ page: 1, size: 1000 })
    teachers.value = res.data?.records || res.data || []
  } catch (error) {
    ElMessage.error(error.message || '加载教师列表失败')
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadCourses()
}

const handleSizeChange = (value) => {
  pageSize.value = value
  currentPage.value = 1
  loadCourses()
}

const handlePageChange = (value) => {
  currentPage.value = value
  loadCourses()
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    courseName: '',
    courseCode: '',
    teacherId: null,
    description: '',
  })
}

const handleAdd = () => {
  dialogTitle.value = '添加课程'
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑课程'
  Object.assign(form, {
    id: row.id,
    courseName: row.courseName || '',
    courseCode: row.courseCode || '',
    teacherId: row.teacherId ?? null,
    description: row.description || '',
  })
  dialogVisible.value = true
}

const handleSave = async () => {
  const courseName = form.courseName?.trim()
  const courseCode = form.courseCode?.trim()

  if (!courseName || !courseCode) {
    ElMessage.warning('请输入课程名称和课程编码')
    return
  }

  const payload = {
    courseName,
    courseCode,
    teacherId: form.teacherId,
    description: form.description?.trim() || '',
  }

  try {
    if (form.id) {
      await updateCourse(form.id, payload)
      ElMessage.success('课程更新成功')
    } else {
      await createCourse(payload)
      ElMessage.success('课程创建成功')
    }
    dialogVisible.value = false
    loadCourses()
  } catch (error) {
    ElMessage.error(error.message || '保存课程失败')
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除课程 "${row.courseName}" 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      await deleteCourse(row.id)
      ElMessage.success('删除成功')
      if (courses.value.length === 1 && currentPage.value > 1) {
        currentPage.value -= 1
      }
      loadCourses()
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
    }
  }).catch(() => {})
}

const tableRowClassName = () => 'custom-row'

onMounted(() => {
  loadCourses()
  loadTeachers()
})
</script>

<style scoped lang="scss">
.course-management {
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
      width: 260px;
    }

    .add-btn {
      padding: 9px 18px;
      border-radius: 10px;
    }
  }
}

.course-cell {
  display: flex;
  align-items: center;
  gap: 12px;

  .course-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ecf5ff;
    color: #409eff;
    font-size: 18px;
    flex-shrink: 0;
  }

  .course-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .course-name {
      font-weight: 600;
      color: #303133;
    }

    .course-code {
      font-size: 12px;
      color: #909399;
    }
  }
}

.teacher-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .teacher-avatar {
    background: #409eff;
    font-size: 12px;
    font-weight: 600;
  }

  .teacher-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #303133;

    small {
      color: #909399;
      font-size: 12px;
    }
  }
}

.desc-text {
  color: #606266;
  font-size: 13px;
}

.time-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 13px;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
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

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #f5f7fa;
}

:deep(.el-table) {
  &::before {
    display: none;
  }

  .el-table__inner-wrapper::before {
    display: none;
  }

  .custom-row {
    transition: all 0.2s;

    &:hover {
      background-color: #f9fafc !important;

      td {
        background-color: #f9fafc !important;
      }
    }
  }
}

@media (max-width: 992px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .right-panel {
      width: 100%;
      flex-wrap: wrap;

      .search-input {
        width: 100%;
      }
    }
  }
}
</style>
