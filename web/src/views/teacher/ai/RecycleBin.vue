<template>
  <div class="recycle-bin">
    <el-card class="header-card">
      <div class="header-content">
        <div class="title-section">
          <el-icon :size="24" color="#909399"><Delete /></el-icon>
          <h2>回收站</h2>
          <el-tag type="info">{{ filteredList.length }} / {{ deletedList.length }} 条已删除知识</el-tag>
        </div>
        
        <div class="action-section">
          <el-button type="primary" @click="handleRestoreAll" :disabled="deletedList.length === 0">
            一键恢复全部
          </el-button>
          <el-button type="success" @click="handleRestoreSelected" :disabled="selectedIds.length === 0">
            恢复选中 ({{ selectedIds.length }})
          </el-button>
          <el-button @click="goKnowledge">返回知识管理</el-button>
          <el-button :icon="Refresh" @click="loadList">刷新</el-button>
        </div>
      </div>

      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索标题/内容" clearable style="width: 260px" />
        <el-select v-model="typeFilter" placeholder="知识类型" clearable style="width: 160px" :teleported="false">
          <el-option label="手动输入" value="manual" />
          <el-option label="文档" value="document" />
        </el-select>
        <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <el-card class="list-card" v-loading="loading">
      <el-empty v-if="deletedList.length === 0 && !loading" description="回收站是空的">
        <el-button type="primary" @click="goKnowledge">返回知识管理</el-button>
      </el-empty>

      <el-table
        v-else
        :data="pagedList"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" :show-overflow-tooltip="{ teleported: false }" />
        <el-table-column prop="knowledgeType" label="类型" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.knowledgeType === 'manual'" type="primary">手动输入</el-tag>
            <el-tag v-else-if="row.knowledgeType === 'document'" type="success">文档</el-tag>
            <el-tag v-else type="info">{{ row.knowledgeType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容预览" min-width="300" :show-overflow-tooltip="{ teleported: false }" />
        <el-table-column prop="isIndexed" label="索引状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isIndexed" type="success" size="small">已索引</el-tag>
            <el-tag v-else type="info" size="small">未索引</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="删除时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" :icon="RefreshLeft" size="small" @click="handleRestore(row)">恢复</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredList.length > pageSize" class="pager-row">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="filteredList.length"
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :teleported="false"
          @size-change="handlePageSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Refresh, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecycleList, restoreKnowledge, restoreAllKnowledge } from '@/api/training/ai'

const router = useRouter()

const loading = ref(false)
const deletedList = ref([])
const selectedIds = ref([])

const keyword = ref('')
const typeFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const filteredList = computed(() => {
  const kw = (keyword.value || '').trim().toLowerCase()
  const t = typeFilter.value
  return (deletedList.value || []).filter((item) => {
    if (t && item?.knowledgeType !== t) return false
    if (!kw) return true
    const title = (item?.title || '').toLowerCase()
    const content = (item?.content || '').toLowerCase()
    return title.includes(kw) || content.includes(kw)
  })
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

watch([keyword, typeFilter], () => {
  currentPage.value = 1
})

const handlePageSizeChange = () => {
  currentPage.value = 1
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getRecycleList()
    deletedList.value = res.data || []
    selectedIds.value = []
    currentPage.value = 1
  } catch (error) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const handleRestore = async (row) => {
  try {
    const res = await restoreKnowledge(row.id)
    ElMessage.success(res.message || `成功恢复 ${res.data || 1} 条知识`)
    loadList()
  } catch (error) {
    ElMessage.error('恢复失败')
  }
}

const handleRestoreAll = async () => {
  ElMessageBox.confirm(
    `确定要恢复回收站中的全部 ${deletedList.value.length} 条知识吗?`,
    '确认恢复全部',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      const res = await restoreAllKnowledge()
      ElMessage.success(res.message || `成功恢复 ${res.data || deletedList.value.length} 条知识`)
      loadList()
    } catch (error) {
      ElMessage.error('恢复失败')
    }
  }).catch(() => null)
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const handleRestoreSelected = () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要恢复的知识')
    return
  }

  ElMessageBox.confirm(
    `确定要恢复选中的 ${selectedIds.value.length} 条知识吗?`,
    '确认恢复',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      const res = await restoreKnowledge(selectedIds.value)
      ElMessage.success(res.message || `成功恢复 ${res.data || selectedIds.value.length} 条知识`)
      selectedIds.value = []
      loadList()
    } catch (error) {
      ElMessage.error('恢复失败')
    }
  }).catch(() => null)
}

const resetFilters = () => {
  keyword.value = ''
  typeFilter.value = ''
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const normalized = String(dateStr).replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const goKnowledge = () => {
  router.push('/teacher/ai/knowledge')
}

onMounted(() => {
  loadList()
})
</script>

<style scoped lang="scss">
.recycle-bin {
  padding: 20px;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  
  .header-card {
    margin-bottom: 20px;
    flex-shrink: 0;
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .title-section {
        display: flex;
        align-items: center;
        gap: 12px;
        
        h2 {
          margin: 0;
          font-size: 18px;
          color: #303133;
        }
      }
    }

    .filter-row {
      margin-top: 14px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
  }

  .list-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    
    :deep(.el-card__body) {
      flex: 1;
      display: flex;
      flex-direction: column;
      
      .el-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    }
  }

  .pager-row {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>