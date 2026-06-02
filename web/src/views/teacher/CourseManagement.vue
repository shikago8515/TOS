<template>
  <div class="course-management-container">
    <transition name="fade-slide" appear>
      <div class="content-wrapper">
        <!-- 顶部 Header -->
        <div class="page-header">
          <div class="header-content">
            <h2 class="page-title">课程管理</h2>
            <p class="page-desc">创建和维护您的课程体系，为学生提供优质的教学内容。</p>
          </div>
          <div class="header-actions">
            <el-button type="primary" size="large" icon="Plus" @click="openCreateDialog" class="create-btn">
              创建课程
            </el-button>
          </div>
        </div>

        <!-- 数据概览卡片 -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon blue-bg">
              <el-icon><Reading /></el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-label">课程总数</span>
              <span class="stat-value">{{ courseList.length }}</span>
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
                  placeholder="搜索课程名称或编码..."
                  prefix-icon="Search"
                  clearable
                  class="search-input"
                />
              </div>
              <div class="right-tools">
                <el-button-group>
                  <el-button :icon="Refresh" circle @click="loadCourses" title="刷新列表" />
                </el-button-group>
              </div>
            </div>

            <!-- 表格区域 -->
            <el-table 
              :data="filteredCourses" 
              style="width: 100%" 
              v-loading="loading"
              :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600', height: '50px' }"
              class="custom-table"
            >
              <el-table-column type="index" width="80" label="序号" align="center">
                 <template #default="scope">
                    <span class="index-cell">{{ scope.$index + 1 }}</span>
                 </template>
              </el-table-column>
              
              <el-table-column prop="courseName" label="课程信息" min-width="240">
                <template #default="{ row }">
                  <div class="course-info-cell">
                    <div class="course-icon">
                      <el-icon><Notebook /></el-icon>
                    </div>
                    <div class="info-text">
                      <span class="course-name">{{ row.courseName }}</span>
                      <el-tag size="small" effect="plain" class="code-tag">{{ row.courseCode }}</el-tag>
                    </div>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column prop="description" label="描述" min-width="300" :show-overflow-tooltip="{ teleported: false }">
                <template #default="{ row }">
                  <span class="desc-text">{{ row.description || '暂无描述' }}</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="createdAt" label="创建时间" width="180">
                <template #default="{ row }">
                  <div class="time-cell">
                    <el-icon><Calendar /></el-icon>
                    <span>{{ formatDate(row.createdAt) }}</span>
                  </div>
                </template>
              </el-table-column>
              
              <el-table-column label="操作" width="180" fixed="right" align="center">
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-tooltip content="编辑课程" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn edit-btn" circle @click="openEditDialog(row)">
                        <el-icon><EditPen /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="删除课程" placement="top" :show-after="500" :teleported="false">
                      <el-button class="action-btn delete-btn" circle @click="handleDelete(row.id)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>

              <template #empty>
                <div class="empty-state">
                   <el-icon class="empty-icon"><Collection /></el-icon>
                   <p>暂无课程数据</p>
                   <el-button type="primary" link @click="openCreateDialog">立即创建</el-button>
                </div>
              </template>
            </el-table>
          </el-card>
        </div>
      </div>
    </transition>

    <!-- 创建/编辑课程对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      width="520px"
      :teleported="false"
      destroy-on-close
      class="stylish-dialog"
      align-center
      :show-close="false"
    >
      <template #header="{ close, titleId, titleClass }">
        <div class="dialog-header">
          <div class="header-icon" :class="isEdit ? 'edit-mode' : 'create-mode'">
            <el-icon><component :is="isEdit ? 'EditPen' : 'Plus'" /></el-icon>
          </div>
          <div class="header-text">
            <h4 :id="titleId" :class="titleClass">{{ isEdit ? '编辑课程' : '创建新课程' }}</h4>
            <p class="header-sub">填写下方信息以{{ isEdit ? '更新' : '创建' }}课程</p>
          </div>
          <el-button circle text class="close-btn" @click="close">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>

      <el-form 
        :model="formData" 
        :rules="rules" 
        ref="formRef"
        label-position="top"
        class="stylish-form"
        hide-required-asterisk
      >
        <el-form-item label="课程名称" prop="courseName">
          <el-input v-model="formData.courseName" placeholder="例如：Java Web 程序设计" size="large" class="custom-input">
             <template #prefix><el-icon><Reading /></el-icon></template>
          </el-input>
        </el-form-item>

        <el-form-item label="课程编码" prop="courseCode">
          <el-input v-model="formData.courseCode" placeholder="例如：CS101" size="large" class="custom-input">
             <template #prefix><el-icon><Ticket /></el-icon></template>
          </el-input>
        </el-form-item>

        <el-form-item label="课程描述" prop="description">
          <el-input 
            v-model="formData.description" 
            type="textarea" 
            :rows="4"
            placeholder="请输入课程的详细描述..."
            resize="none"
            class="custom-textarea"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" size="large" class="cancel-btn">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting" size="large" class="submit-btn">
            {{ isEdit ? '保存修改' : '立即创建' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Search, Refresh, Reading, Timer, Notebook, 
  Calendar, EditPen, Delete, Collection, Ticket, Close
} from '@element-plus/icons-vue'
import { getMyCourses, createCourse, updateCourse, deleteCourse } from '@/api/teacher/course'

// 状态
const courseList = ref([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const searchQuery = ref('')

const formData = ref({
  id: null,
  courseName: '',
  courseCode: '',
  description: ''
})

// 表单验证规则
const rules = {
  courseName: [
    { required: true, message: '课程名称不能为空', trigger: 'blur' },
    { min: 2, max: 100, message: '课程名称长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  courseCode: [
    { required: true, message: '课程编码不能为空', trigger: 'blur' },
    { min: 2, max: 50, message: '课程编码长度在 2 到 50 个字符', trigger: 'blur' }
  ]
}

// 计算属性
const filteredCourses = computed(() => {
  if (!searchQuery.value) return courseList.value
  const query = searchQuery.value.toLowerCase()
  return courseList.value.filter(course => 
    course.courseName.toLowerCase().includes(query) || 
    course.courseCode.toLowerCase().includes(query)
  )
})

const lastUpdateTime = computed(() => {
  if (courseList.value.length === 0) return '-'
  // 假设按创建时间排序，取最新的
  const dates = courseList.value.map(c => new Date(c.createdAt).getTime())
  const maxDate = new Date(Math.max(...dates))
  return maxDate.toLocaleDateString()
})

// 方法
const loadCourses = async () => {
  loading.value = true
  try {
    const res = await getMyCourses()
    courseList.value = res.data || []
  } catch (e) {
    ElMessage.error('加载课程列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEdit.value = false
  formData.value = {
    id: null,
    courseName: '',
    courseCode: '',
    description: ''
  }
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  isEdit.value = true
  formData.value = {
    id: row.id,
    courseName: row.courseName,
    courseCode: row.courseCode,
    description: row.description
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (isEdit.value) {
        await updateCourse(formData.value.id, formData.value)
        ElMessage.success('课程更新成功')
      } else {
        await createCourse(formData.value)
        ElMessage.success('课程创建成功')
      }
      dialogVisible.value = false
      await loadCourses()
    } catch (e) {
      ElMessage.error(e?.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

const handleDelete = async (courseId) => {
  try {
    await ElMessageBox.confirm('确定删除此课程吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    })

    await deleteCourse(courseId)
    ElMessage.success('课程删除成功')
    await loadCourses()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}

onMounted(() => {
  loadCourses()
})
</script>

<style scoped lang="scss">
// 变量定义
$primary-color: #4f46e5;
$text-main: #1e293b;
$text-secondary: #64748b;
$bg-color: #f1f5f9;
$card-bg: #ffffff;
$border-color: #e2e8f0;

.course-management-container {
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
      &.blue-bg { background: #e0f2fe; color: #0ea5e9; }
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
    font-family: monospace;
    font-size: 13px;
  }
  
  .course-info-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .course-icon {
      width: 36px; // 缩小图标
      height: 36px;
      border-radius: 8px;
      background: #e0e7ff;
      color: #4f46e5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    
    .info-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      
      .course-name {
        font-weight: 600;
        color: $text-main;
        font-size: 14px; // 缩小字体
      }
      
      .code-tag {
        width: fit-content;
        font-family: monospace;
        font-size: 11px;
        height: 20px;
        line-height: 18px;
      }
    }
  }
  
  .desc-text {
    color: $text-secondary;
    font-size: 13px; // 缩小字体
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
    
    .action-btn {
      border: none;
      background: transparent;
      transition: all 0.2s;
      width: 28px;
      height: 28px;
      
      &:hover {
        transform: scale(1.1);
      }
      
      &.edit-btn { color: #64748b; &:hover { background: #eff6ff; color: #3b82f6; } }
      &.delete-btn { color: #64748b; &:hover { background: #fef2f2; color: #ef4444; } }
    }
  }
}

.empty-state {
  padding: 40px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .empty-icon {
    font-size: 48px;
    color: #cbd5e1;
    margin-bottom: 16px;
  }
  
  p {
    color: $text-secondary;
    margin-bottom: 16px;
  }
}

// 弹窗样式优化
:deep(.stylish-dialog) {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  
  .el-dialog__header {
    margin: 0;
    padding: 0;
  }
  
  .el-dialog__body {
    padding: 24px 32px;
  }
  
  .el-dialog__footer {
    padding: 16px 32px 24px;
    border-top: 1px solid #f1f5f9;
  }
}

.dialog-header {
  padding: 24px 32px;
  background: linear-gradient(to right, #f8fafc, #fff);
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  
  .header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    
    &.create-mode { background: #eff6ff; color: #4f46e5; }
    &.edit-mode { background: #f0fdf4; color: #16a34a; }
  }
  
  .header-text {
    h4 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 700;
      color: $text-main;
    }
    
    .header-sub {
      margin: 0;
      font-size: 13px;
      color: $text-secondary;
    }
  }
  
  .close-btn {
    position: absolute;
    right: 24px;
    top: 24px;
    color: #94a3b8;
    
    &:hover {
      color: #ef4444;
      background: #fef2f2;
    }
  }
}

.stylish-form {
  .custom-input {
    :deep(.el-input__wrapper) {
      box-shadow: 0 0 0 1px #e2e8f0 inset;
      padding: 8px 12px;
      background-color: #f8fafc;
      transition: all 0.3s;
      
      &:hover {
        background-color: #fff;
        box-shadow: 0 0 0 1px #cbd5e1 inset;
      }
      
      &.is-focus {
        background-color: #fff;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2) inset;
      }
    }
  }
  
  .custom-textarea {
    :deep(.el-textarea__inner) {
      box-shadow: 0 0 0 1px #e2e8f0 inset;
      padding: 12px;
      background-color: #f8fafc;
      transition: all 0.3s;
      
      &:hover {
        background-color: #fff;
        box-shadow: 0 0 0 1px #cbd5e1 inset;
      }
      
      &:focus {
        background-color: #fff;
        box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2) inset;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  
  .cancel-btn {
    border: 1px solid #e2e8f0;
    color: $text-secondary;
    
    &:hover {
      color: $text-main;
      border-color: #cbd5e1;
      background-color: #f8fafc;
    }
  }
  
  .submit-btn {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
    border: none;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .course-management-container {
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
