<template>
  <div class="user-management">
    <el-card shadow="never" class="table-card border-card">
      <template #header>
        <div class="card-header">
          <div class="left-panel">
            <div class="title-box">
              <span class="title">学生管理</span>
              <span class="subtitle">统一维护学生账号信息，并将院系与班级分开展示</span>
            </div>
            <el-tag type="primary" effect="light" round class="count-tag">
              <el-icon><User /></el-icon>
              共 {{ total }} 人
            </el-tag>
          </div>
          <div class="right-panel">
            <el-input
              v-model="searchQuery"
              placeholder="搜索学号 / 姓名"
              prefix-icon="Search"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button-group class="action-group">
              <el-button icon="Download" @click="handleDownloadStudentImportTemplate">模板</el-button>
              <el-upload
                :show-file-list="false"
                :before-upload="beforeStudentImportUpload"
                :http-request="handleStudentImportUpload"
                accept=".xlsx"
                class="upload-btn"
              >
                <el-button :loading="importing" icon="Upload">导入</el-button>
              </el-upload>
            </el-button-group>
            <el-button type="primary" icon="Plus" class="add-btn" @click="handleAddUser">添加学生</el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="users"
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

        <el-table-column prop="username" label="学号 / 用户名" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar
                :size="36"
                class="user-avatar"
                :src="row.avatar || undefined"
                :style="row.avatar ? undefined : { background: getAvatarColor(row.username) }"
              >
                {{ getAvatarText(row) }}
              </el-avatar>
              <div class="user-info">
                <span class="username">{{ row.username }}</span>
                <span class="realname">{{ row.realName || '未设置姓名' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="department" label="院系" min-width="180">
          <template #default="{ row }">
            <div class="meta-cell">
              <el-icon><School /></el-icon>
              <span>{{ getDepartmentTextByRow(row) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="className" label="班级" min-width="180">
          <template #default="{ row }">
            <div class="meta-cell">
              <el-icon><CollectionTag /></el-icon>
              <span>{{ getClassTextByRow(row) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <div class="status-indicator" :class="row.status === 1 ? 'active' : 'inactive'">
              <span class="dot"></span>
              <span>{{ row.status === 1 ? '正常' : '禁用' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button link type="primary" size="small" @click.stop="handleEdit(row)">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-button link type="warning" size="small" @click.stop="handleResetPassword(row)">
                <el-icon><Lock /></el-icon> 重置密码
              </el-button>
              <el-button link type="danger" size="small" @click.stop="handleDelete(row)">
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
      <el-form :model="form" label-width="80px" class="user-form" label-position="top">
        <el-form-item label="学号 / 用户名">
          <el-input v-model="form.username" :disabled="!!form.id" placeholder="请输入学号或用户名" prefix-icon="User" />
        </el-form-item>

        <el-form-item label="初始密码" v-if="!form.id">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入初始密码" prefix-icon="Lock" />
        </el-form-item>

        <el-form-item label="学生姓名">
          <el-input v-model="form.realName" placeholder="请输入学生姓名" prefix-icon="Postcard" />
        </el-form-item>

        <el-form-item label="所属院系">
          <el-input v-model="form.department" placeholder="例如：计算机学院" prefix-icon="School" />
        </el-form-item>

        <el-form-item label="当前班级">
          <el-input :model-value="currentClassPreview" disabled placeholder="未分配班级">
            <template #prefix>
              <el-icon><CollectionTag /></el-icon>
            </template>
          </el-input>
          <div class="form-tip">班级由“班级管理”页面统一分配，这里仅展示当前绑定结果。</div>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CollectionTag,
  Delete,
  Download,
  Edit,
  Lock,
  Plus,
  Postcard,
  School,
  Search,
  Upload,
  User
} from '@element-plus/icons-vue'
import {
  createUser,
  deleteUser,
  downloadStudentImportTemplate,
  getUserList,
  importStudents,
  updateUser
} from '@/api/admin/user'
import { resetUserPassword } from '@/api/admin/config'
import { getClassText, getDepartmentText } from '@/utils/orgClass'

const STUDENT_ROLE_ID = 3

const loading = ref(false)
const users = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('添加学生')
const searchQuery = ref('')
const importing = ref(false)

const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const form = reactive({
  id: null,
  username: '',
  password: '',
  realName: '',
  department: '',
  className: ''
})

const currentClassPreview = computed(() => form.className || '未分配班级')

const getDepartmentTextByRow = (row) => getDepartmentText(row?.department)
const getClassTextByRow = (row) => getClassText(row)

const getAvatarColor = (username) => {
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
  if (!username) {
    return colors[4]
  }
  const index = username.charCodeAt(0) % colors.length
  return colors[index]
}

const getAvatarText = (row) => {
  const source = row?.realName || row?.username || 'S'
  return source.charAt(0).toUpperCase()
}

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await getUserList({
      roleId: STUDENT_ROLE_ID,
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchQuery.value || undefined
    })
    users.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    ElMessage.error(error.message || '加载学生列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadUsers()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadUsers()
}

const handlePageChange = (val) => {
  currentPage.value = val
  loadUsers()
}

const beforeStudentImportUpload = (rawFile) => {
  const name = rawFile?.name || ''
  if (!name.toLowerCase().endsWith('.xlsx')) {
    ElMessage.warning('仅支持 .xlsx 文件')
    return false
  }
  return true
}

const handleDownloadStudentImportTemplate = async () => {
  try {
    const res = await downloadStudentImportTemplate()
    const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'student-import-template.xlsx'
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('模板下载失败')
  }
}

const handleStudentImportUpload = async (options) => {
  importing.value = true
  try {
    const formData = new FormData()
    formData.append('file', options.file)
    const res = await importStudents(formData)
    const data = res.data || {}
    ElMessage.success(`导入完成：成功 ${data.successRows || 0} 条，失败 ${data.failedRows || 0} 条`)
    loadUsers()
  } catch (error) {
    ElMessage.error(error.message || '导入失败')
  } finally {
    importing.value = false
  }
}

const resetForm = () => {
  form.id = null
  form.username = ''
  form.password = ''
  form.realName = ''
  form.department = ''
  form.className = ''
}

const handleAddUser = () => {
  dialogTitle.value = '添加学生'
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑学生'
  Object.assign(form, {
    id: row.id,
    username: row.username,
    password: '',
    realName: row.realName || '',
    department: getDepartmentTextByRow(row) === '-' ? '' : getDepartmentTextByRow(row),
    className: getClassTextByRow(row) === '-' ? '' : getClassTextByRow(row)
  })
  dialogVisible.value = true
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除学生“${row.username}”吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      await deleteUser(row.id)
      ElMessage.success('删除成功')
      loadUsers()
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
    }
  }).catch(() => {})
}

const handleResetPassword = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt(
      `为账号 ${row.username} 设置新密码，留空则重置为 123456`,
      '重置密码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '留空使用默认密码 123456'
      }
    )
    await resetUserPassword(row.id, value || undefined)
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error === 'cancel' || error === 'close' || error?.action === 'cancel' || error?.action === 'close') {
      return
    }
    ElMessage.error(error.message || '重置密码失败')
  }
}

const handleSave = async () => {
  if (!form.username) {
    ElMessage.warning('请输入学号或用户名')
    return
  }

  if (!form.id && !form.password) {
    ElMessage.warning('请输入初始密码')
    return
  }

  try {
    if (form.id) {
      await updateUser(form.id, {
        realName: form.realName,
        roleId: STUDENT_ROLE_ID,
        department: form.department
      })
      ElMessage.success('更新成功')
    } else {
      await createUser({
        username: form.username,
        password: form.password,
        realName: form.realName,
        roleId: STUDENT_ROLE_ID,
        department: form.department
      })
      ElMessage.success('添加成功')
    }

    dialogVisible.value = false
    loadUsers()
  } catch (error) {
    ElMessage.error(error.message || (form.id ? '更新失败' : '添加失败'))
  }
}

const tableRowClassName = () => 'custom-row'

onMounted(() => {
  loadUsers()
})
</script>

<style scoped lang="scss">
.user-management {
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
  gap: 16px;

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
        margin-top: 4px;
        font-size: 12px;
        color: #909399;
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
    align-items: center;
    gap: 12px;

    .search-input {
      width: 240px;

      :deep(.el-input__wrapper) {
        border-radius: 20px;
        box-shadow: 0 0 0 1px #dcdfe6 inset;

        &:hover,
        &.is-focus {
          box-shadow: 0 0 0 1px #409eff inset;
        }
      }
    }

    .action-group {
      .el-button {
        border-radius: 0;

        &:first-child {
          border-top-left-radius: 20px;
          border-bottom-left-radius: 20px;
        }

        &:last-child {
          border-top-right-radius: 20px;
          border-bottom-right-radius: 20px;
        }
      }

      .upload-btn {
        display: inline-block;
        margin: 0;

        .el-button {
          border-radius: 0;
          border-left: none;
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

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;

  .user-avatar {
    font-size: 14px;
    font-weight: 600;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .user-info {
    display: flex;
    flex-direction: column;

    .username {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    .realname {
      font-size: 12px;
      color: #909399;
    }
  }
}

.meta-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;

  .el-icon {
    color: #909399;
  }
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.active {
    color: #67c23a;

    .dot {
      background: #67c23a;
      box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.2);
    }
  }

  &.inactive {
    color: #f56c6c;

    .dot {
      background: #f56c6c;
      box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2);
    }
  }
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
  opacity: 0.86;
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

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

:deep(.el-table) {
  &::before {
    display: none;
  }

  .el-table__inner-wrapper::before {
    display: none;
  }

  .custom-row {
    transition: background-color 0.2s;

    &:hover {
      background-color: #f9fafc !important;

      td {
        background-color: #f9fafc !important;
      }
    }
  }
}

.custom-dialog {
  :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #f0f2f5;
  }

  :deep(.el-dialog__body) {
    padding: 30px 40px;
  }

  :deep(.el-dialog__footer) {
    padding: 20px 24px;
    border-top: 1px solid #f0f2f5;
  }
}
</style>
