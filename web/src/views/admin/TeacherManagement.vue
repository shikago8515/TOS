<template>
  <div class="teacher-management">
    <el-card shadow="never" class="table-card border-card">
      <template #header>
        <div class="card-header">
          <div class="left-panel">
            <div class="title-box">
              <span class="title">教师管理</span>
              <span class="subtitle">管理教师账号及班级分配</span>
            </div>
            <el-tag type="primary" effect="light" round class="count-tag">
              <el-icon><User /></el-icon>
              共 {{ total }} 人
            </el-tag>
          </div>
          <div class="right-panel">
            <el-input
              v-model="searchQuery"
              placeholder="搜索教师姓名/用户名"
              prefix-icon="Search"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button type="primary" icon="Plus" class="add-btn" @click="handleAdd">创建教师账号</el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="teachers"
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
        <el-table-column prop="username" label="用户名" min-width="160">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="36" class="user-avatar" :style="{ background: getAvatarColor(row.username) }">
                {{ row.realName?.charAt(0) || 'T' }}
              </el-avatar>
              <div class="user-info">
                <span class="username">{{ row.username }}</span>
                <span class="realname">{{ row.realName || '未设置姓名' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <div class="email-cell">
              <el-icon><Message /></el-icon>
              <span>{{ row.email || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="院系" min-width="150">
          <template #default="{ row }">
            <div class="dept-cell">
              <el-icon><School /></el-icon>
              <span>{{ getDepartmentLabel(row.department) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="classCount" label="绑定班级" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.classCount > 0 ? 'success' : 'info'" effect="light" round>
              {{ row.classCount || 0 }} 个班级
            </el-tag>
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
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleManageClasses(row)">
              <el-icon><Connection /></el-icon> 管理班级
            </el-button>
            <el-button link type="warning" size="small" @click="handleResetPassword(row)">
              <el-icon><Lock /></el-icon> 重置密码
            </el-button>
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
      title="创建教师账号"
      width="500px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
      center
    >
      <el-form :model="form" label-width="80px" label-position="top">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" placeholder="请输入用户名（登录账号）" prefix-icon="User" />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input v-model="form.password" type="password" show-password placeholder="请输入初始密码" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="form.realName" placeholder="请输入真实姓名" prefix-icon="Postcard" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" prefix-icon="Message" />
        </el-form-item>
        <el-form-item label="院系">
          <el-input v-model="form.department" placeholder="请输入所属院系" prefix-icon="School" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">创建</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="classDialogVisible"
      title="管理绑定班级"
      width="600px"
      :teleported="false"
      destroy-on-close
      class="custom-dialog"
    >
      <div class="class-dialog-content">
        <div class="teacher-card">
          <el-avatar :size="48" :style="{ background: getAvatarColor(currentTeacher?.username) }">
            {{ currentTeacher?.realName?.charAt(0) || 'T' }}
          </el-avatar>
          <div class="info">
            <div class="name">{{ currentTeacher?.realName }}</div>
            <div class="username">@{{ currentTeacher?.username }}</div>
          </div>
          <div class="dept-tag" v-if="currentTeacher?.department">
            {{ getDepartmentLabel(currentTeacher?.department) }}
          </div>
        </div>

        <div class="class-selection-area">
          <div class="area-header">
            <span class="label">选择要绑定的班级</span>
            <span class="tip">已选 {{ selectedClassIds.length }} 个班级</span>
          </div>
          <el-scrollbar height="300px">
            <el-checkbox-group v-model="selectedClassIds" class="class-grid">
              <div
                v-for="cls in allClasses"
                :key="cls.id"
                class="class-item"
                :class="{ 'is-disabled': cls.teacherId && cls.teacherId !== currentTeacher?.id }"
              >
                <el-checkbox
                  :label="cls.id"
                  :disabled="cls.teacherId && cls.teacherId !== currentTeacher?.id"
                >
                  <span class="class-name">{{ cls.className }}</span>
                </el-checkbox>
                <div class="class-status" v-if="cls.teacherId && cls.teacherId !== currentTeacher?.id">
                  <el-tag type="warning" size="small" effect="plain">已绑定其他教师</el-tag>
                </div>
              </div>
            </el-checkbox-group>
          </el-scrollbar>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="classDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSaveClasses">保存更改</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Plus, User, Message, School,
  Connection, Lock, Postcard
} from '@element-plus/icons-vue'
import { getAllTeachers, createTeacher, setTeacherClasses } from '@/api/admin/teacher'
import { getAllClasses } from '@/api/admin/class'
import { resetTeacherPassword } from '@/api/admin/config'
import { getDepartmentText } from '@/utils/orgClass'

const loading = ref(false)
const teachers = ref([])
const allClasses = ref([])
const dialogVisible = ref(false)
const classDialogVisible = ref(false)
const searchQuery = ref('')
const currentTeacher = ref(null)
const selectedClassIds = ref([])

const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const form = reactive({
  username: '',
  password: '',
  realName: '',
  email: '',
  department: ''
})

const getAvatarColor = (username) => {
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']
  if (!username) return colors[4]
  const index = username.charCodeAt(0) % colors.length
  return colors[index]
}

const getDepartmentLabel = (department) => getDepartmentText(department)

const loadTeachers = async () => {
  loading.value = true
  try {
    const res = await getAllTeachers({
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchQuery.value || undefined
    })
    teachers.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error(e.message || '加载教师列表失败')
  } finally {
    loading.value = false
  }
}

const loadClasses = async () => {
  try {
    const res = await getAllClasses({ page: 1, size: 1000 })
    allClasses.value = res.data?.records || []
  } catch (e) {
    ElMessage.error(e.message || '加载班级列表失败')
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadTeachers()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  loadTeachers()
}

const handlePageChange = (val) => {
  currentPage.value = val
  loadTeachers()
}

const handleAdd = () => {
  form.username = ''
  form.password = ''
  form.realName = ''
  form.email = ''
  form.department = ''
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.username?.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!form.password?.trim()) {
    ElMessage.warning('请输入初始密码')
    return
  }

  try {
    await createTeacher(form)
    ElMessage.success('教师账号创建成功')
    dialogVisible.value = false
    loadTeachers()
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  }
}

const handleManageClasses = (row) => {
  currentTeacher.value = row
  selectedClassIds.value = (row.classes || []).map(c => c.id)
  classDialogVisible.value = true
}

const handleSaveClasses = async () => {
  try {
    await setTeacherClasses(currentTeacher.value.id, selectedClassIds.value)
    ElMessage.success('班级绑定更新成功')
    classDialogVisible.value = false
    loadTeachers()
    loadClasses()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

const handleResetPassword = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt(
      `为教师 ${row.username} 设置新密码，留空则重置为 123456`,
      '重置密码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '留空使用默认密码 123456'
      }
    )
    await resetTeacherPassword(row.id, value || undefined)
    ElMessage.success('教师密码已重置')
  } catch (error) {
    if (error === 'cancel' || error === 'close' || error?.action === 'cancel' || error?.action === 'close') {
      return
    }
    ElMessage.error(error.message || '重置密码失败')
  }
}

const tableRowClassName = () => {
  return 'custom-row'
}

onMounted(() => {
  loadTeachers()
  loadClasses()
})
</script>

<style scoped lang="scss">
.teacher-management {
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
      font-weight: 600;
      color: #303133;
      font-size: 14px;
    }

    .realname {
      font-size: 12px;
      color: #909399;
    }
  }
}

.email-cell, .dept-cell {
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
    .dot { background: #67c23a; box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.2); }
  }

  &.inactive {
    color: #f56c6c;
    .dot { background: #f56c6c; box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2); }
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

.class-dialog-content {
  .teacher-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #f9fafc;
    border-radius: 12px;
    margin-bottom: 24px;

    .info {
      flex: 1;
      .name {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 4px;
      }
      .username {
        font-size: 13px;
        color: #909399;
      }
    }

    .dept-tag {
      background: #fff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      color: #606266;
      border: 1px solid #e4e7ed;
    }
  }

  .class-selection-area {
    .area-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .label {
        font-weight: 600;
        color: #303133;
      }

      .tip {
        font-size: 12px;
        color: #909399;
      }
    }

    .class-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding-right: 12px;

      .class-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        transition: all 0.2s;

        &:hover {
          border-color: #409eff;
          background: #ecf5ff;
        }

        &.is-disabled {
          background: #f5f7fa;
          border-color: #e4e7ed;
          opacity: 0.8;

          &:hover {
            border-color: #e4e7ed;
            background: #f5f7fa;
          }
        }

        .class-name {
          font-weight: 500;
        }
      }
    }
  }
}
</style>
