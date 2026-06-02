<template>
  <div class="class-analytics-page page-container" v-loading="loading">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">班级学情分析</h2>
        <p class="page-subtitle">聚焦班级完成度、得分分布与常见问题，帮助您快速调整教学节奏。</p>
      </div>
      <div class="header-right">
        <el-select
          v-model="selectedClassId"
          placeholder="选择班级"
          class="class-select"
          @change="loadAnalytics"
          :teleported="false"
        >
          <el-option
            v-for="cls in classOptions"
            :key="cls.id"
            :label="cls.name || cls.className"
            :value="cls.id"
          />
        </el-select>
        <el-button type="primary" size="small" @click="loadAnalytics" :disabled="!selectedClassId">
          刷新分析
        </el-button>
      </div>
    </div>

    <div class="resource-overview-grid">
      <div class="overview-card">
        <span class="overview-label">当前班级</span>
        <strong>{{ selectedClassLabel }}</strong>
        <small>当前查看的班级分析对象</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">学生数</span>
        <strong>{{ analytics.studentCount || 0 }}</strong>
        <small>参与本班级学习分析的学生总数</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">总任务</span>
        <strong>{{ analytics.totalTasks || 0 }}</strong>
        <small>纳入统计的任务数量</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">完成率</span>
        <strong>{{ analytics.completionRate || 0 }}%</strong>
        <small>班级整体任务完成情况</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">平均分</span>
        <strong>{{ analytics.averageScore || 0 }}</strong>
        <small>班级平均得分表现</small>
      </div>
      <div class="overview-card">
        <span class="overview-label">优秀率</span>
        <strong>{{ analytics.excellentRate || 0 }}%</strong>
        <small>达到优秀区间的学生比例</small>
      </div>
    </div>

    <div class="panel-grid top-grid">
      <el-card shadow="hover" class="panel-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">分数段分布</div>
              <div class="card-subtitle">快速查看班级成绩集中在哪些区间。</div>
            </div>
          </div>
        </template>
        <div ref="scoreDistChartRef" class="chart-box"></div>
      </el-card>

      <el-card shadow="hover" class="panel-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">评分项得分率分布</div>
              <div class="card-subtitle">定位学生在哪些评分维度上更容易失分。</div>
            </div>
          </div>
        </template>
        <div ref="criterionChartRef" class="chart-box"></div>
      </el-card>
    </div>

    <div class="panel-grid bottom-grid">
      <el-card shadow="hover" class="panel-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">常见错误类型</div>
              <div class="card-subtitle">汇总高频问题，辅助教师快速制定讲评策略。</div>
            </div>
          </div>
        </template>
        <el-empty v-if="!(analytics.commonErrors || []).length" description="暂无数据" :image-size="60" />
        <div v-else class="error-list">
          <div v-for="item in analytics.commonErrors || []" :key="item.errorType" class="error-item">
            <div class="error-top">
              <strong>{{ item.errorType }}</strong>
              <span>{{ item.count }} 次</span>
            </div>
            <div class="error-desc">{{ item.description }}</div>
            <div class="error-suggestion">建议：{{ item.suggestion }}</div>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="panel-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">学生排名（前 10）</div>
              <div class="card-subtitle">基于平均分与完成度的班级表现排序。</div>
            </div>
          </div>
        </template>
        <el-table
          :data="analytics.studentRankings || []"
          stripe
          class="ranking-table"
          :header-cell-style="{
            background: '#f8fafc',
            color: '#475569',
            fontWeight: '600',
            fontSize: '12px',
            borderBottom: '1px solid #e2e8f0'
          }"
        >
          <el-table-column prop="rank" label="排名" width="70" />
          <el-table-column prop="studentName" label="姓名" width="130" />
          <el-table-column prop="studentNumber" label="学号" width="140" />
          <el-table-column prop="averageScore" label="平均分" width="110" />
          <el-table-column prop="completedTasks" label="完成" width="90" />
          <el-table-column prop="totalTasks" label="总任务" width="90" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getMyClasses } from '@/api/teacher/class'
import { getClassAnalytics } from '@/api/teacher/statistics'

const loading = ref(false)
const classOptions = ref([])
const selectedClassId = ref()
const analytics = ref({})
const scoreDistChartRef = ref()
const criterionChartRef = ref()
let scoreDistChart = null
let criterionChart = null

const selectedClassLabel = computed(() => {
  const current = classOptions.value.find(item => item.id === selectedClassId.value)
  return current?.name || current?.className || '未选择班级'
})

const loadClasses = async () => {
  const res = await getMyClasses()
  if (res.code === 200) {
    classOptions.value = res.data || []
    if (!selectedClassId.value && classOptions.value.length > 0) {
      selectedClassId.value = classOptions.value[0].id
    }
  }
}

const loadAnalytics = async () => {
  if (!selectedClassId.value) return
  loading.value = true
  try {
    const res = await getClassAnalytics(selectedClassId.value)
    if (res.code === 200) {
      analytics.value = res.data || {}
      await nextTick()
      renderCharts()
    }
  } catch (e) {
    ElMessage.error(e?.message || '加载班级学情分析失败')
  } finally {
    loading.value = false
  }
}

const getScoreDistRows = () => {
  const dist = analytics.value?.scoreDistribution || {}
  const labels = ['0-59', '60-69', '70-79', '80-89', '90-100']
  return labels.map(label => ({ label, value: Number(dist[label] || 0) }))
}

const renderScoreDistChart = () => {
  if (!scoreDistChartRef.value) return
  if (!scoreDistChart) {
    scoreDistChart = echarts.init(scoreDistChartRef.value)
  }
  const rows = getScoreDistRows()
  scoreDistChart.setOption({
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderWidth: 0,
      textStyle: {
        color: '#fff',
        fontSize: 12
      }
    },
    xAxis: {
      type: 'category',
      data: rows.map(r => r.label),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b' }
    },
    series: [
      {
        name: '人数',
        type: 'bar',
        data: rows.map(r => r.value),
        itemStyle: { color: '#3b82f6', borderRadius: [8, 8, 0, 0] },
        barMaxWidth: 42
      }
    ],
    grid: { left: 16, right: 16, top: 24, bottom: 16, containLabel: true }
  })
}

const renderCriterionChart = () => {
  if (!criterionChartRef.value) return
  if (!criterionChart) {
    criterionChart = echarts.init(criterionChartRef.value)
  }
  const rows = (analytics.value?.criterionAnalytics || []).slice(0, 8)
  criterionChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      renderMode: 'richText',
      confine: true,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderWidth: 0,
      textStyle: {
        color: '#fff',
        fontSize: 12
      }
    },
    legend: { top: 0, textStyle: { color: '#64748b' } },
    xAxis: {
      type: 'category',
      data: rows.map(r => r.criterionName || '未命名'),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b', interval: 0, rotate: rows.length > 5 ? 15 : 0 }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: {
        color: '#64748b',
        formatter: '{value}%'
      }
    },
    series: [
      {
        name: '平均得分率 (%)',
        type: 'bar',
        data: rows.map(r => Number(r.averageScoreRate || 0)),
        itemStyle: { color: '#10b981', borderRadius: [8, 8, 0, 0] },
        barMaxWidth: 42
      }
    ],
    grid: { left: 16, right: 16, top: 32, bottom: 20, containLabel: true }
  })
}

const renderCharts = () => {
  renderScoreDistChart()
  renderCriterionChart()
}

const handleResize = () => {
  scoreDistChart?.resize()
  criterionChart?.resize()
}

watch(
  analytics,
  async () => {
    await nextTick()
    renderCharts()
  },
  { deep: true }
)

onMounted(async () => {
  try {
    await loadClasses()
    await loadAnalytics()
    window.addEventListener('resize', handleResize)
  } catch (e) {
    ElMessage.error('初始化班级学情分析失败')
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  scoreDistChart?.dispose()
  criterionChart?.dispose()
  scoreDistChart = null
  criterionChart = null
})
</script>

<style scoped lang="scss">
.class-analytics-page {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  background: #f8fafc;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: #fff;
  padding: 8px 16px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.header-left {
  .page-title {
    margin: 0 0 2px;
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    letter-spacing: -0.4px;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '';
      width: 3px;
      height: 14px;
      background: #3b82f6;
      border-radius: 2px;
    }
  }

  .page-subtitle {
    margin: 0;
    padding-left: 10px;
    font-size: 11px;
    color: #64748b;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.class-select {
  width: 240px;

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #e2e8f0 inset;
    border-radius: 6px;
    background: #f8fafc;
  }
}

.resource-overview-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 2px;
}

.overview-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 6px;

  strong {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }

  small {
    font-size: 12px;
    color: #64748b;
    line-height: 1.5;
  }
}

.overview-label {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
}

.panel-grid {
  display: grid;
  gap: 10px;
}

.top-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.bottom-grid {
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
}

.panel-card {
  border: none;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: linear-gradient(to right, #ffffff, #f8fafc);
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.chart-box {
  width: 100%;
  height: 300px;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-item {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #edf2f7;
  background: #fff;
}

.error-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;

  strong {
    color: #0f172a;
    font-size: 13px;
  }

  span {
    font-size: 12px;
    font-weight: 600;
    color: #ef4444;
  }
}

.error-desc {
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 4px;
}

.error-suggestion {
  color: #0f766e;
  font-size: 12px;
  line-height: 1.6;
}

.ranking-table {
  :deep(.el-table__row:hover > td) {
    background: #f8fbff !important;
  }
}

@media (max-width: 1400px) {
  .resource-overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 992px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-right {
    flex-direction: column;
    align-items: stretch;
  }

  .class-select {
    width: 100%;
  }

  .top-grid,
  .bottom-grid,
  .resource-overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
