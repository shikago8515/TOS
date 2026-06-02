<template>
  <el-dialog
    :model-value="visible"
    title="添加学生"
    width="1240px"
    top="6vh"
    :teleported="true"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    class="student-selector-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="selector-container">
      <div class="class-sidebar">
        <div class="sidebar-header">
          <span class="title">班级列表</span>
        </div>
        <el-scrollbar class="sidebar-scroll">
          <ul class="class-list">
            <li
              class="class-item"
              :class="{ active: currentClassId === '' }"
              @click="handleClassSelect('')"
            >
              <el-icon><Menu /></el-icon>
              <span class="label">全部班级</span>
              <el-tag size="small" type="info" effect="plain" round class="count-tag">
                {{ allStudents.length }}
              </el-tag>
            </li>
            <li
              v-for="cls in classList"
              :key="cls.id"
              class="class-item"
              :class="{ active: currentClassId === normalizeId(cls.id) }"
              @click="handleClassSelect(cls.id)"
            >
              <el-icon><Collection /></el-icon>
              <span class="label">{{ getDisplayClassName(cls) }}</span>
              <el-tag size="small" type="info" effect="plain" round class="count-tag">
                {{ getClassStudentCount(cls.id) }}
              </el-tag>
            </li>
          </ul>
        </el-scrollbar>
      </div>

      <div class="student-main">
        <div class="main-header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索姓名或学号"
            :prefix-icon="Search"
            clearable
            class="search-input"
          />
          <div class="header-note">仅支持从现有班级学生中选择</div>
        </div>

        <div class="selection-bar">
          <el-checkbox
            v-model="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="handleSelectAll"
          >
            全选当前列表 ({{ filteredStudents.length }})
          </el-checkbox>
        </div>

        <div class="student-grid-wrapper" v-loading="loading">
          <el-scrollbar class="main-scroll">
            <div v-if="filteredStudents.length > 0" class="student-grid">
              <div
                v-for="student in filteredStudents"
                :key="student.studentId"
                class="student-card"
                :class="{ selected: isSelected(student.studentId) }"
                @click="toggleSelection(student)"
              >
                <div class="card-check">
                  <el-checkbox
                    :model-value="isSelected(student.studentId)"
                    @click.stop="toggleSelection(student)"
                  />
                </div>
                <div class="card-avatar">
                  <el-avatar
                    :size="42"
                    :src="student.avatar"
                    :style="{ background: getRandomColor(getStudentName(student)) }"
                  >
                    {{ getStudentName(student).charAt(0) || '?' }}
                  </el-avatar>
                </div>
                <div class="card-info">
                  <div class="name">{{ getStudentName(student) }}</div>
                  <div class="id">{{ student.studentId }}</div>
                  <div class="class-name">{{ student.className || getClassName(student.classId) }}</div>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无学生数据" :image-size="100" />
          </el-scrollbar>
        </div>
      </div>

      <div class="selected-sidebar">
        <div class="sidebar-header">
          <span class="title">已选学生 ({{ selectedStudents.length }})</span>
          <el-button
            link
            type="danger"
            size="small"
            @click="clearSelection"
            :disabled="selectedStudents.length === 0"
          >
            清空
          </el-button>
        </div>
        <el-scrollbar class="selected-scroll">
          <transition-group name="list" tag="ul" class="selected-list">
            <li
              v-for="student in selectedStudents"
              :key="student.studentId"
              class="selected-item"
            >
              <div class="item-info">
                <span class="name">{{ student.studentName }}</span>
                <span class="id">{{ student.studentId }}</span>
                <span class="class">{{ student.className || getClassName(student.classId) }}</span>
              </div>
              <el-button
                link
                type="danger"
                :icon="Close"
                circle
                @click="removeSelection(student.studentId)"
              />
            </li>
          </transition-group>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <span class="tip">提示：支持跨班级多选，不支持 Excel 导入学生</span>
        </div>
        <div class="footer-right">
          <el-button @click="$emit('update:visible', false)">取消</el-button>
          <el-button type="primary" @click="handleConfirm" size="large">
            确认添加 ({{ selectedStudents.length }}人)
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Close, Collection, Menu, Search } from '@element-plus/icons-vue'

const props = defineProps({
  visible: Boolean,
  classList: {
    type: Array,
    default: () => []
  },
  allStudents: {
    type: Array,
    default: () => []
  },
  initialSelected: {
    type: Array,
    default: () => []
  },
  loading: Boolean
})

const emit = defineEmits(['update:visible', 'confirm'])

const currentClassId = ref('')
const searchQuery = ref('')
const selectedStudents = ref([])

const normalizeId = (value) => {
  if (value === '' || value === null || value === undefined) {
    return ''
  }
  return String(value)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      currentClassId.value = ''
      searchQuery.value = ''
    }
  }
)

watch(
  () => props.initialSelected,
  (newVal) => {
    selectedStudents.value = (newVal || []).map((student) => ({
      studentId: student.studentId,
      userId: student.userId,
      studentName: student.studentName,
      classId: student.classId,
      className: student.className || getClassName(student.classId),
      avatar: student.avatar
    }))
  },
  { immediate: true, deep: true }
)

const getDisplayClassName = (classItem) => {
  if (!classItem) {
    return '未命名班级'
  }
  return classItem.className || classItem.name || '未命名班级'
}

const getStudentName = (student) => {
  return student?.name || student?.realName || student?.studentName || student?.username || '未命名学生'
}

const getClassName = (id) => {
  const match = props.classList.find((item) => normalizeId(item.id) === normalizeId(id))
  return getDisplayClassName(match)
}

const getClassStudentCount = (classId) => {
  const targetId = normalizeId(classId)
  return props.allStudents.filter((student) => normalizeId(student.classId) === targetId).length
}

const filteredStudents = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  const targetClassId = normalizeId(currentClassId.value)

  return props.allStudents.filter((student) => {
    const studentClassId = normalizeId(student.classId)
    const studentName = String(getStudentName(student) || '').toLowerCase()
    const studentId = String(student.studentId || '').toLowerCase()
    const matchClass = !targetClassId || studentClassId === targetClassId
    const matchSearch = !keyword || studentName.includes(keyword) || studentId.includes(keyword)

    return matchClass && matchSearch
  })
})

const isSelected = (studentId) => {
  return selectedStudents.value.some((student) => student.studentId === studentId)
}

const isAllSelected = computed({
  get: () => {
    if (filteredStudents.value.length === 0) {
      return false
    }
    return filteredStudents.value.every((student) => isSelected(student.studentId))
  },
  set: () => {}
})

const isIndeterminate = computed(() => {
  if (filteredStudents.value.length === 0) {
    return false
  }
  const selectedCount = filteredStudents.value.filter((student) => isSelected(student.studentId)).length
  return selectedCount > 0 && selectedCount < filteredStudents.value.length
})

const handleClassSelect = (id) => {
  currentClassId.value = normalizeId(id)
}

const toggleSelection = (student) => {
  const index = selectedStudents.value.findIndex((item) => item.studentId === student.studentId)

  if (index > -1) {
    selectedStudents.value.splice(index, 1)
    return
  }

  selectedStudents.value.push({
    studentId: student.studentId,
    userId: student.userId || student.id,
    studentName: getStudentName(student),
    classId: student.classId,
    className: student.className || getClassName(student.classId),
    avatar: student.avatar
  })
}

const handleSelectAll = (checked) => {
  if (checked) {
    filteredStudents.value.forEach((student) => {
      if (!isSelected(student.studentId)) {
        selectedStudents.value.push({
          studentId: student.studentId,
          userId: student.userId || student.id,
          studentName: getStudentName(student),
          classId: student.classId,
          className: student.className || getClassName(student.classId),
          avatar: student.avatar
        })
      }
    })
    return
  }

  const currentIds = new Set(filteredStudents.value.map((student) => student.studentId))
  selectedStudents.value = selectedStudents.value.filter((student) => !currentIds.has(student.studentId))
}

const removeSelection = (studentId) => {
  const index = selectedStudents.value.findIndex((student) => student.studentId === studentId)
  if (index > -1) {
    selectedStudents.value.splice(index, 1)
  }
}

const clearSelection = () => {
  selectedStudents.value = []
}

const handleConfirm = () => {
  emit('confirm', selectedStudents.value)
  emit('update:visible', false)
}

const getRandomColor = (name) => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']
  let hash = 0

  for (let i = 0; i < (name || '').length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}
</script>

<style scoped lang="scss">
:deep(.student-selector-dialog .el-dialog) {
  max-width: calc(100vw - 48px);
  border-radius: 16px;
  overflow: hidden;
  font-size: 17px;
}

:deep(.student-selector-dialog .el-dialog__body) {
  padding: 0 20px 16px;
}

:deep(.student-selector-dialog .el-button),
:deep(.student-selector-dialog .el-checkbox),
:deep(.student-selector-dialog .el-input__inner),
:deep(.student-selector-dialog .el-select__placeholder),
:deep(.student-selector-dialog .el-dialog__title) {
  font-size: 17px;
}

.selector-container {
  display: flex;
  height: 620px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}

.class-sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;

  .sidebar-header {
    padding: 16px 18px;
    border-bottom: 1px solid #e2e8f0;
    background: #fff;

    .title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
  }

  .sidebar-scroll {
    flex: 1;
    min-height: 0;
  }

  .class-list {
    list-style: none;
    padding: 10px;
    margin: 0;
  }

  .class-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 12px;
    margin-bottom: 6px;
    border-radius: 10px;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #eff6ff;
      color: #2563eb;
    }

    &.active {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1d4ed8;
      font-weight: 600;
    }

    .label {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .count-tag {
      flex-shrink: 0;
    }
  }
}

.student-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;

  .main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    border-bottom: 1px solid #e2e8f0;

    .search-input {
      width: 320px;
      max-width: 100%;
    }

    .header-note {
      font-size: 15px;
      color: #64748b;
      white-space: nowrap;
    }
  }

  .selection-bar {
    padding: 10px 18px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .student-grid-wrapper {
    flex: 1;
    min-height: 0;
    padding: 16px 18px;
  }

  .main-scroll {
    height: 100%;
  }

  .student-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .student-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: #bfdbfe;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
    }

    &.selected {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .card-check {
      pointer-events: none;
    }

    .card-info {
      min-width: 0;

      .name,
      .id,
      .class-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .name {
        font-size: 17px;
        font-weight: 600;
        color: #0f172a;
        margin-bottom: 4px;
      }

      .id,
      .class-name {
        font-size: 15px;
        color: #64748b;
      }
    }
  }
}

.selected-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e2e8f0;

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid #e2e8f0;

    .title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
  }

  .selected-scroll {
    flex: 1;
    min-height: 0;
  }

  .selected-list {
    list-style: none;
    margin: 0;
    padding: 10px;
  }

  .selected-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px;
    margin-bottom: 8px;
    border: 1px solid #eef2f7;
    border-radius: 10px;
    background: #f8fafc;
    transition: all 0.2s ease;

    &:hover {
      border-color: #fecaca;
      background: #fff5f5;
    }

    .item-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;

      .name {
        font-size: 17px;
        font-weight: 600;
        color: #0f172a;
      }

      .id,
      .class {
        font-size: 15px;
        color: #64748b;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .tip {
    font-size: 16px;
    color: #64748b;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.list-enter-active,
.list-leave-active {
  transition: all 0.25s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@media (max-width: 1280px) {
  .selector-container {
    height: 560px;
  }

  .class-sidebar {
    width: 220px;
  }

  .selected-sidebar {
    width: 260px;
  }
}
</style>
