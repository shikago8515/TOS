<template>
  <div class="page-container token-usage-page">
    <div class="page-header">
      <div>
        <h2>DeepSeek Token 用量中心</h2>
        <p>区分学生端、教师端与全量消耗，并支持实时查询账户余额。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="overviewLoading" @click="loadOverview">
          <el-icon><Refresh /></el-icon>
          刷新用量
        </el-button>
        <el-button type="primary" :loading="balanceLoading" @click="loadBalance">
          <el-icon><Refresh /></el-icon>
          查询余额
        </el-button>
      </div>
    </div>

    <div class="summary-grid">
      <el-card shadow="never" class="summary-card total-card">
        <div class="card-head">
          <el-icon><DataAnalysis /></el-icon>
          <span>总消耗</span>
        </div>
        <div class="card-value">{{ formatInteger(overview.total.totalTokens) }}</div>
        <div class="card-meta">
          <span>调用 {{ formatInteger(overview.total.callCount) }} 次</span>
          <span>用户 {{ formatInteger(overview.total.userCount) }} 人</span>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card teacher-card">
        <div class="card-head">
          <el-icon><School /></el-icon>
          <span>教师端</span>
        </div>
        <div class="card-value">{{ formatInteger(overview.teacher.totalTokens) }}</div>
        <div class="card-meta">
          <span>调用 {{ formatInteger(overview.teacher.callCount) }} 次</span>
          <span>教师 {{ formatInteger(overview.teacher.userCount) }} 人</span>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card student-card">
        <div class="card-head">
          <el-icon><User /></el-icon>
          <span>学生端</span>
        </div>
        <div class="card-value">{{ formatInteger(overview.student.totalTokens) }}</div>
        <div class="card-meta">
          <span>调用 {{ formatInteger(overview.student.callCount) }} 次</span>
          <span>学生 {{ formatInteger(overview.student.userCount) }} 人</span>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card balance-card">
        <div class="card-head">
          <el-icon><Document /></el-icon>
          <span>账户状态</span>
        </div>
        <div class="card-value">{{ balance.isAvailable ? '可用' : '待查询' }}</div>
        <div class="card-meta">
          <span>{{ balance.balanceInfos?.length || 0 }} 条余额记录</span>
          <span>{{ balance.queriedAt ? formatTime(balance.queriedAt) : '尚未查询' }}</span>
        </div>
      </el-card>
    </div>

    <el-card shadow="never" class="balance-panel">
      <template #header>
        <div class="panel-header">
          <span>DeepSeek 余额</span>
          <el-tag :type="balance.isAvailable ? 'success' : 'info'" effect="light">
            {{ balance.isAvailable ? '账户可用' : '等待查询' }}
          </el-tag>
        </div>
      </template>

      <div v-if="balance.balanceInfos?.length" class="balance-grid">
        <div v-for="(item, index) in balance.balanceInfos" :key="index" class="balance-item">
          <div class="balance-title">{{ item.currency || `账户 ${index + 1}` }}</div>
          <div class="balance-number">{{ formatBalance(item.total_balance ?? item.totalBalance) }}</div>
          <div class="balance-detail">
            <span>充值: {{ formatBalance(item.topped_up_balance ?? item.toppedUpBalance) }}</span>
            <span>赠送: {{ formatBalance(item.granted_balance ?? item.grantedBalance) }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无余额数据，点击上方按钮发起查询。" />
    </el-card>

    <el-card shadow="never" class="usage-panel">
      <template #header>
        <div class="panel-header">
          <span>用量明细</span>
          <div v-if="activeTab !== 'total'" class="table-actions">
            <el-input
              v-model="searchQuery"
              placeholder="搜索用户名 / 姓名 / 院系 / 班级"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="总消耗" name="total">
          <div class="detail-cards">
            <div class="detail-card">
              <span>输入 Tokens</span>
              <strong>{{ formatInteger(overview.total.promptTokens) }}</strong>
            </div>
            <div class="detail-card">
              <span>输出 Tokens</span>
              <strong>{{ formatInteger(overview.total.completionTokens) }}</strong>
            </div>
            <div class="detail-card">
              <span>成功调用</span>
              <strong>{{ formatInteger(overview.total.successCallCount) }}</strong>
            </div>
            <div class="detail-card">
              <span>累计成本</span>
              <strong>{{ formatBalance(overview.total.cost) }}</strong>
            </div>
          </div>

          <el-table :data="overview.topConsumers || []" style="width: 100%" empty-text="暂无总消耗数据">
            <el-table-column label="排名" width="80" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column prop="username" label="用户名" min-width="140" />
            <el-table-column prop="realName" label="姓名" min-width="120" />
            <el-table-column prop="roleName" label="角色" width="100" />
            <el-table-column label="院系" min-width="160">
              <template #default="{ row }">{{ getDepartmentLabel(row) }}</template>
            </el-table-column>
            <el-table-column label="班级" min-width="160">
              <template #default="{ row }">{{ getClassLabel(row) }}</template>
            </el-table-column>
            <el-table-column prop="callCount" label="调用次数" width="120" align="right" />
            <el-table-column prop="totalTokens" label="总 Tokens" width="150" align="right" />
            <el-table-column prop="cost" label="成本" width="120" align="right">
              <template #default="{ row }">{{ formatBalance(row.cost) }}</template>
            </el-table-column>
            <el-table-column prop="lastCallAt" label="最近调用" min-width="170">
              <template #default="{ row }">{{ formatTime(row.lastCallAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="教师端" name="teacher">
          <div class="detail-cards">
            <div class="detail-card">
              <span>教师总 Tokens</span>
              <strong>{{ formatInteger(overview.teacher.totalTokens) }}</strong>
            </div>
            <div class="detail-card">
              <span>教师调用次数</span>
              <strong>{{ formatInteger(overview.teacher.callCount) }}</strong>
            </div>
            <div class="detail-card">
              <span>教师人数</span>
              <strong>{{ formatInteger(overview.teacher.userCount) }}</strong>
            </div>
            <div class="detail-card">
              <span>累计成本</span>
              <strong>{{ formatBalance(overview.teacher.cost) }}</strong>
            </div>
          </div>
          <el-table :data="records" v-loading="tableLoading" style="width: 100%" empty-text="暂无教师端用量">
            <el-table-column prop="username" label="用户名" min-width="140" />
            <el-table-column prop="realName" label="姓名" min-width="120" />
            <el-table-column label="院系" min-width="180">
              <template #default="{ row }">{{ getDepartmentLabel(row) }}</template>
            </el-table-column>
            <el-table-column prop="callCount" label="调用次数" width="120" align="right" />
            <el-table-column prop="promptTokens" label="输入" width="120" align="right" />
            <el-table-column prop="completionTokens" label="输出" width="120" align="right" />
            <el-table-column prop="totalTokens" label="总 Tokens" width="140" align="right" />
            <el-table-column prop="cost" label="成本" width="120" align="right">
              <template #default="{ row }">{{ formatBalance(row.cost) }}</template>
            </el-table-column>
            <el-table-column prop="lastCallAt" label="最近调用" min-width="170">
              <template #default="{ row }">{{ formatTime(row.lastCallAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="学生端" name="student">
          <div class="detail-cards">
            <div class="detail-card">
              <span>学生总 Tokens</span>
              <strong>{{ formatInteger(overview.student.totalTokens) }}</strong>
            </div>
            <div class="detail-card">
              <span>学生调用次数</span>
              <strong>{{ formatInteger(overview.student.callCount) }}</strong>
            </div>
            <div class="detail-card">
              <span>学生人数</span>
              <strong>{{ formatInteger(overview.student.userCount) }}</strong>
            </div>
            <div class="detail-card">
              <span>累计成本</span>
              <strong>{{ formatBalance(overview.student.cost) }}</strong>
            </div>
          </div>
          <el-table :data="records" v-loading="tableLoading" style="width: 100%" empty-text="暂无学生端用量">
            <el-table-column prop="username" label="学号 / 用户名" min-width="140" />
            <el-table-column prop="realName" label="姓名" min-width="120" />
            <el-table-column label="院系" min-width="160">
              <template #default="{ row }">{{ getDepartmentLabel(row) }}</template>
            </el-table-column>
            <el-table-column label="班级" min-width="160">
              <template #default="{ row }">{{ getClassLabel(row) }}</template>
            </el-table-column>
            <el-table-column prop="callCount" label="调用次数" width="120" align="right" />
            <el-table-column prop="promptTokens" label="输入" width="120" align="right" />
            <el-table-column prop="completionTokens" label="输出" width="120" align="right" />
            <el-table-column prop="totalTokens" label="总 Tokens" width="140" align="right" />
            <el-table-column prop="cost" label="成本" width="120" align="right">
              <template #default="{ row }">{{ formatBalance(row.cost) }}</template>
            </el-table-column>
            <el-table-column prop="lastCallAt" label="最近调用" min-width="170">
              <template #default="{ row }">{{ formatTime(row.lastCallAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <div v-if="activeTab !== 'total'" class="pagination-wrapper">
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
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Document, Refresh, School, User } from '@element-plus/icons-vue'
import {
  getDeepSeekBalance,
  getLlmUsageOverview,
  getStudentLlmUsage,
  getTeacherLlmUsage,
} from '@/api/admin/llm'
import { getClassText, getDepartmentText } from '@/utils/orgClass'

const activeTab = ref('total')
const overviewLoading = ref(false)
const balanceLoading = ref(false)
const tableLoading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const records = ref([])

const createSummary = () => ({
  callCount: 0,
  successCallCount: 0,
  failedCallCount: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cost: 0,
  userCount: 0,
  lastCallAt: null,
})

const overview = reactive({
  total: createSummary(),
  teacher: createSummary(),
  student: createSummary(),
  topConsumers: [],
  topTeachers: [],
  topStudents: [],
})

const balance = reactive({
  isAvailable: false,
  queriedAt: null,
  balanceInfos: [],
})

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const res = await getLlmUsageOverview()
    Object.assign(overview, {
      total: { ...createSummary(), ...(res.data?.total || {}) },
      teacher: { ...createSummary(), ...(res.data?.teacher || {}) },
      student: { ...createSummary(), ...(res.data?.student || {}) },
      topConsumers: res.data?.topConsumers || [],
      topTeachers: res.data?.topTeachers || [],
      topStudents: res.data?.topStudents || [],
    })
  } catch (error) {
    ElMessage.error(error.message || '加载 Token 总览失败')
  } finally {
    overviewLoading.value = false
  }
}

const loadBalance = async () => {
  balanceLoading.value = true
  try {
    const res = await getDeepSeekBalance()
    Object.assign(balance, {
      isAvailable: !!res.data?.isAvailable,
      queriedAt: res.data?.queriedAt || null,
      balanceInfos: res.data?.balanceInfos || [],
    })
    ElMessage.success('余额查询完成')
  } catch (error) {
    ElMessage.error(error.message || '余额查询失败')
  } finally {
    balanceLoading.value = false
  }
}

const loadTable = async () => {
  if (activeTab.value === 'total') {
    records.value = []
    total.value = 0
    return
  }

  tableLoading.value = true
  try {
    const api = activeTab.value === 'teacher' ? getTeacherLlmUsage : getStudentLlmUsage
    const res = await api({
      page: currentPage.value,
      size: pageSize.value,
      keyword: searchQuery.value || undefined,
    })
    records.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    ElMessage.error(error.message || '加载用量明细失败')
  } finally {
    tableLoading.value = false
  }
}

const handleTabChange = () => {
  searchQuery.value = ''
  currentPage.value = 1
  loadTable()
}

const handleSearch = () => {
  currentPage.value = 1
  loadTable()
}

const handleSizeChange = (value) => {
  pageSize.value = value
  currentPage.value = 1
  loadTable()
}

const handlePageChange = (value) => {
  currentPage.value = value
  loadTable()
}

const formatInteger = (value) => {
  return Number(value || 0).toLocaleString('zh-CN')
}

const formatBalance = (value) => {
  const amount = Number(value || 0)
  return Number.isNaN(amount) ? '-' : amount.toFixed(4)
}

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getDepartmentLabel = (row) => getDepartmentText(row?.department)
const getClassLabel = (row) => getClassText(row)

onMounted(async () => {
  await Promise.all([loadOverview(), loadBalance()])
})
</script>

<style scoped lang="scss">
.token-usage-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  h2 {
    margin: 0 0 8px;
    font-size: 24px;
    color: #1f2f3d;
  }

  p {
    margin: 0;
    color: #7a8794;
    font-size: 13px;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  border-radius: 16px;
  border: 1px solid #edf1f6;

  .card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6d7c8c;
    font-size: 13px;
  }

  .card-value {
    margin: 14px 0 10px;
    font-size: 30px;
    font-weight: 700;
    color: #1d2d3c;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #8a97a5;
  }
}

.total-card {
  background: linear-gradient(135deg, #f8fbff, #eef6ff);
}

.teacher-card {
  background: linear-gradient(135deg, #f8fff7, #eef9ec);
}

.student-card {
  background: linear-gradient(135deg, #fffaf5, #fef3e7);
}

.balance-card {
  background: linear-gradient(135deg, #fcfbff, #f4f0ff);
}

.balance-panel,
.usage-panel {
  border-radius: 16px;
  border: 1px solid #edf1f6;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.balance-item {
  padding: 18px;
  border-radius: 14px;
  background: #f7fbff;
  border: 1px solid #e7eef6;
}

.balance-title {
  color: #718096;
  font-size: 13px;
}

.balance-number {
  margin: 10px 0;
  font-size: 26px;
  font-weight: 700;
  color: #243547;
}

.balance-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #7d8b99;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 260px;
}

.detail-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.detail-card {
  padding: 14px 16px;
  border-radius: 14px;
  background: #f9fbfd;
  border: 1px solid #edf2f7;
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    font-size: 12px;
    color: #7b8794;
  }

  strong {
    font-size: 22px;
    color: #1f2f3d;
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .summary-grid,
  .detail-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
  }

  .summary-grid,
  .detail-cards {
    grid-template-columns: 1fr;
  }

  .search-input {
    width: 100%;
  }
}
</style>
