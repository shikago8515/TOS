<template>
  <el-card shadow="hover" class="main-card">
    <template #header>
      <div class="filter-bar">
        <div class="filter-group">
          <el-select v-model="difficultyFilter" placeholder="难度筛选" clearable class="filter-select" size="small" :teleported="false">
            <el-option label="初级" :value="1" />
            <el-option label="中级" :value="2" />
            <el-option label="高级" :value="3" />
          </el-select>
          <el-select v-model="statusFilter" placeholder="状态筛选" clearable class="filter-select" size="small" :teleported="false">
            <el-option label="草稿" :value="1" />
            <el-option label="已发布" :value="2" />
            <el-option label="已归档" :value="3" />
          </el-select>
          <el-date-picker
            v-model="caseDateRange"
            type="daterange"
            unlink-panels
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="filter-date"
            clearable
            size="small"
            :teleported="false"
          />
        </div>
        
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索案例名称/关键词"
            :prefix-icon="Search"
            clearable
            class="search-input"
            size="small"
          />
        </div>
      </div>
    </template>

    <div v-if="$slots.insights" class="card-insights-section">
      <slot name="insights" />
    </div>

    <el-table 
      ref="tableRef"
      :data="filteredCases" 
      v-loading="loading"
      style="width: 100%; flex: 1; min-height: 0;"
      height="100%"
      size="small"
      :header-cell-style="{ background: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '16px', borderBottom: '1px solid #e2e8f0' }"
      class="custom-table"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="40" align="center" />
      <el-table-column label="序号" width="50" align="center">
        <template #default="{ $index }">
          {{ (currentPage - 1) * pageSize + $index + 1 }}
        </template>
      </el-table-column>
      <el-table-column prop="caseName" label="案例名称" min-width="160">
        <template #default="{ row }">
          <div class="case-name-cell">
            <span class="name">{{ row.caseName }}</span>
            <el-tag v-if="row.type === 1" size="small" type="info" effect="plain" class="ml-2">公共</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="生成时间" width="140" align="center">
        <template #default="{ row }">
          <span class="time-text">{{ formatDateTime(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="keywords" label="关键词" min-width="140">
        <template #default="{ row }">
          <div class="keywords-cell">
            <el-tag 
              v-for="tag in (row.keywords ? row.keywords.split(',') : [])" 
              :key="tag" 
              size="small" 
              effect="plain"
              class="keyword-tag"
            >
              {{ tag }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="difficultyLevel" label="难度" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="getDifficultyType(row.difficultyLevel)" effect="plain" round size="small">
            {{ getDifficultyText(row.difficultyLevel) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80" align="center">
        <template #default="{ row }">
          <div class="status-cell">
            <span class="status-dot" :class="getStatusClass(row.status)"></span>
            <span class="status-text">{{ getStatusText(row.status) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="332" fixed="right" align="center">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button link type="primary" size="small" @click="$emit('view-assignments', row)">
              <el-icon><DataLine /></el-icon> 统计
            </el-button>
            <el-divider direction="vertical" />
            <el-button link type="primary" size="small" @click="$emit('edit', row)">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-divider direction="vertical" />
            <el-button link type="success" size="small" @click="$emit('copy', row)">
              <el-icon><CopyDocument /></el-icon> 复制
            </el-button>
            <el-divider direction="vertical" />
            <el-button link type="info" size="small" @click="$emit('set-visibility', row)">
              <el-icon><View /></el-icon> 可见
            </el-button>
            <el-divider direction="vertical" />
            <el-button link type="warning" size="small" @click="$emit('rate', row)">
              <el-icon><Star /></el-icon> 评分
            </el-button>
            <el-divider direction="vertical" />
            <el-button 
              v-if="row.status === 2" 
              link 
              type="warning" 
              size="small" 
              @click="$emit('withdraw', row)"
            >
              <el-icon><Download /></el-icon> 撤回
            </el-button>
            <el-divider v-if="row.status === 2" direction="vertical" />
            <el-button link type="danger" size="small" @click="$emit('delete', row)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    
    <div class="pagination-wrapper">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[15, 30, 50, 100]"
        :teleported="false"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="serverTotal"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, DataLine, Edit, Delete, Download, CopyDocument, View, Star } from '@element-plus/icons-vue'
/** @typedef {import('@/api/types').TrainingCase} TrainingCase */

const props = defineProps<{
  cases: any[]
  loading: boolean
  serverTotal: number
  currentPage: number
  pageSize: number
}>()

const loading = computed(() => props.loading)
const serverTotal = computed(() => props.serverTotal)
const currentPage = computed(() => props.currentPage)
const pageSize = computed(() => props.pageSize)

const emit = defineEmits(['selection-change', 'view-assignments', 'edit', 'delete', 'withdraw', 'copy', 'set-visibility', 'rate', 'page-change', 'size-change'])

const difficultyFilter = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const caseDateRange = ref([])
const tableRef = ref()

const filteredCases = computed(() => {
  let res = [...props.cases]
  
  if (difficultyFilter.value) {
    res = res.filter(c => c.difficultyLevel === Number(difficultyFilter.value))
  }
  
  if (statusFilter.value) {
    res = res.filter(c => c.status === Number(statusFilter.value))
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    res = res.filter(c => 
      String(c.caseName || '').toLowerCase().includes(q) || 
      String(c.keywords || '').toLowerCase().includes(q)
    )
  }

  if (caseDateRange.value && caseDateRange.value.length === 2) {
    const [startDate, endDate] = caseDateRange.value
    const startTime = new Date(`${startDate} 00:00:00`).getTime()
    const endTime = new Date(`${endDate} 23:59:59`).getTime()
    res = res.filter(c => {
      if (!c.createdAt) return false
      const createdAtTime = new Date(c.createdAt).getTime()
      if (Number.isNaN(createdAtTime)) return false
      return createdAtTime >= startTime && createdAtTime <= endTime
    })
  }
  
  // Sort by status (Published=2 first) then by createdAt descending
  res.sort((a, b) => {
    // Priority: Published (2) > Others
    if (a.status === 2 && b.status !== 2) return -1
    if (a.status !== 2 && b.status === 2) return 1
    
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeB - timeA
  })
  
  return res
})

const handleSelectionChange = (val: any[]) => {
  emit('selection-change', val)
}

const handleSizeChange = (val: number) => {
  emit('size-change', val)
}

const handleCurrentChange = (val: number) => {
  emit('page-change', val)
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
}

const selectAll = () => {
  filteredCases.value.forEach(row => {
    tableRef.value?.toggleRowSelection(row, true)
  })
}

defineExpose({ clearSelection, selectAll })

watch([difficultyFilter, statusFilter, searchQuery, caseDateRange], () => {
  clearSelection()
})

// Helpers
const formatDateTime = (val: any) => {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const getDifficultyText = (level: number) => {
  const map: Record<number, string> = { 1: '初级', 2: '中级', 3: '高级' }
  return map[level] || '未知'
}

const getDifficultyType = (level: number) => {
  const map: Record<number, string> = { 1: 'success', 2: 'warning', 3: 'danger' }
  return map[level] || 'info'
}

const getStatusText = (status: number) => {
  const map: Record<number, string> = { 1: '草稿', 2: '已发布', 3: '已归档' }
  return map[status] || '未知'
}

const getStatusClass = (status: number) => {
  const map: Record<number, string> = { 1: 'draft', 2: 'published', 3: 'archived' }
  return map[status] || ''
}
</script>

<style scoped lang="scss">
.main-card {
  border: none;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: #ffffff;
  margin-top: 0;
  animation: slideUp 0.4s ease-out;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  
  &:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
    transform: translateY(-2px);
  }
  
  :deep(.el-card__header) {
    padding: 10px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(to right, #ffffff, #f8fafc);
  }
  
  :deep(.el-card__body) {
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: visible;
  }

  :deep(.el-button),
  :deep(.el-input__inner),
  :deep(.el-select__placeholder),
  :deep(.el-pagination),
  :deep(.el-table),
  :deep(.el-tag) {
    font-size: 16px;
  }
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  
  .filter-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .filter-select, .filter-input, .filter-date {
      width: 120px;
      
      :deep(.el-input__wrapper) {
        box-shadow: 0 0 0 1px #e2e8f0 inset;
        border-radius: 6px;
        transition: all 0.2s ease;
        background-color: #f8fafc;
        
        &:hover {
          box-shadow: 0 0 0 1px #cbd5e1 inset;
          background-color: #fff;
        }
        &.is-focus {
          box-shadow: 0 0 0 1px #3b82f6 inset !important;
          background-color: #fff;
        }
      }
    }
  }
  
  .search-box {
    width: 220px;
    
    .search-input {
      :deep(.el-input__wrapper) {
        border-radius: 20px;
        padding-left: 12px;
        background-color: #f8fafc;
        box-shadow: 0 0 0 1px #e2e8f0 inset;
        transition: all 0.3s ease;
        
        &:hover, &.is-focus {
          background-color: #fff;
          box-shadow: 0 0 0 1px #3b82f6 inset !important;
        }
      }
    }
  }
}

.card-insights-section {
  padding: 12px 16px 0;
}

.custom-table {
  :deep(.el-table__fixed-right) {
    inset-inline-end: 0;
  }

  :deep(.el-table__fixed-right-patch) {
    width: 12px;
  }

  :deep(.el-table__fixed-right .el-table__cell:last-child .cell) {
    padding-right: 18px;
  }

  :deep(.el-table__row) {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    
    &:hover {
      background-color: #f0f7ff !important;
      transform: scale(1.001);
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);
      z-index: 1;
      position: relative;
      
      .case-name-cell .name {
        color: #2563eb;
      }
    }
  }
  
  :deep(.el-table__cell) {
    padding: 6px 0;
    border-bottom: 1px solid #f1f5f9;
  }
}

.case-name-cell {
  font-weight: 600;
  color: #334155;
  font-size: 16px;
  display: flex;
  align-items: center;
  
  .name {
    transition: color 0.2s ease;
    cursor: pointer;
  }
}

.time-text {
  color: #64748b;
  font-size: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.keywords-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  
  .keyword-tag {
    border-color: #e2e8f0;
    color: #64748b;
    background-color: #f8fafc;
    font-size: 14px;
    padding: 0 4px;
    height: 18px;
    line-height: 16px;
  }
}

.status-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    
    &.draft { background-color: #94a3b8; box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.2); }
    &.published { background-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
    &.archived { background-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
  }
  
  .status-text {
    font-size: 14px;
    color: #475569;
    font-weight: 500;
  }
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 6px 0;
  padding: 4px 6px;
  min-width: 0;
  
  .el-button {
    flex: 0 0 auto;
    font-weight: 500;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1.2;
    transition: all 0.2s ease;
    
    &:hover {
      background-color: #f1f5f9;
      transform: translateY(-1px);
    }
    
    &.el-button--danger:hover {
      background-color: #fef2f2;
    }
    
    &.el-button--warning:hover {
      background-color: #fffbeb;
    }
  }
  
  .el-divider {
    flex: 0 0 auto;
    margin: 0 2px;
    border-color: #e2e8f0;
  }
}

@media (max-width: 1600px) {
  .action-buttons {
    gap: 6px 8px;

    .el-divider {
      display: none;
    }
  }
}

.pagination-wrapper {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
  border-radius: 0 0 10px 10px;

  :deep(.btn-prev),
  :deep(.btn-next),
  :deep(.el-pager li) {
    min-width: 34px;
    height: 34px;
    line-height: 34px;
  }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
