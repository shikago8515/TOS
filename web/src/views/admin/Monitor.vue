<template>
  <div class="monitor-dashboard">
    <!-- 顶部头部区域 -->
    <div class="dashboard-header animate__animated animate__fadeInDown">
      <div class="header-left">
        <h1 class="page-title">工作流上下文缓存监控中心</h1>
        <p class="page-desc">实时追踪工作流上下文缓存性能与健康状态</p>
      </div>
      <div class="header-right">
        <div class="last-update">
          <span class="label">最后更新:</span>
          <span class="time">{{ lastUpdateTime || '--:--:--' }}</span>
        </div>
        <el-divider direction="vertical" />
        <div class="auto-refresh">
          <span class="label">自动刷新</span>
          <el-switch
            v-model="isAutoRefresh"
            active-color="#13ce66"
            inactive-color="#ff4949"
            @change="handleAutoRefresh"
          />
        </div>
        <el-button 
          type="primary" 
          :loading="loading" 
          @click="manualRefresh" 
          circle 
          class="refresh-btn"
        >
          <el-icon :class="{ 'is-spinning': loading }"><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 核心指标卡片区域 -->
    <div class="metrics-grid">
      <!-- 命中率卡片 -->
      <div class="metric-card hit-rate-card animate__animated animate__fadeInUp" style="animation-delay: 0.1s">
        <div class="card-icon">
          <el-icon><Aim /></el-icon>
        </div>
        <div class="card-content">
          <div class="label">缓存命中率</div>
          <div class="value">
            <span class="number">{{ formatNumber(stats.hitRate * 100, 1) }}</span>
            <span class="unit">%</span>
          </div>
          <div class="progress-bar">
            <div class="progress" :style="{ width: (stats.hitRate * 100) + '%', backgroundColor: getHitRateColor(stats.hitRate) }"></div>
          </div>
        </div>
        <div class="card-status" :style="{ color: getHitRateColor(stats.hitRate) }">
          {{ getHitRateStatus(stats.hitRate) }}
        </div>
      </div>

      <!-- 缓存大小卡片 -->
      <div class="metric-card size-card animate__animated animate__fadeInUp" style="animation-delay: 0.2s">
        <div class="card-icon">
          <el-icon><Files /></el-icon>
        </div>
        <div class="card-content">
          <div class="label">当前缓存条目</div>
          <div class="value">
            <span class="number">{{ formatNumber(stats.size, 0) }}</span>
          </div>
          <div class="sub-label">最大容量: {{ stats.maxSize || '无限制' }}</div>
        </div>
      </div>

      <!-- 总请求卡片 -->
      <div class="metric-card request-card animate__animated animate__fadeInUp" style="animation-delay: 0.3s">
        <div class="card-icon">
          <el-icon><DataAnalysis /></el-icon>
        </div>
        <div class="card-content">
          <div class="label">总请求次数</div>
          <div class="value">
            <span class="number">{{ formatNumber(stats.requestCount, 0) }}</span>
          </div>
          <div class="sub-label">命中: {{ stats.hitCount }} / 未命中: {{ stats.missCount }}</div>
        </div>
      </div>

      <!-- 平均耗时卡片 -->
      <div class="metric-card time-card animate__animated animate__fadeInUp" style="animation-delay: 0.4s">
        <div class="card-icon">
          <el-icon><Timer /></el-icon>
        </div>
        <div class="card-content">
          <div class="label">平均加载耗时</div>
          <div class="value">
            <span class="number">{{ formatDurationNum(stats.averageLoadPenalty) }}</span>
            <span class="unit">ms</span>
          </div>
          <div class="sub-label">总耗时: {{ formatDuration(stats.totalLoadTime) }}</div>
        </div>
      </div>
    </div>

    <!-- 图表与详情区域 -->
    <div class="dashboard-main">
      <el-row :gutter="24">
        <!-- 左侧：图表分析 -->
        <el-col :span="16" class="animate__animated animate__fadeInLeft" style="animation-delay: 0.5s">
          <el-card shadow="hover" class="chart-card">
            <template #header>
              <div class="card-header">
                <span class="title">缓存性能分析</span>
                <el-tag size="small" effect="plain">实时分布</el-tag>
              </div>
            </template>
            <div class="charts-container">
              <div ref="pieChartRef" class="chart-box"></div>
              <div ref="gaugeChartRef" class="chart-box"></div>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="chart-card mt-4">
            <template #header>
              <div class="card-header">
                <span class="title">智能诊断建议</span>
                <el-icon class="text-primary"><MagicStick /></el-icon>
              </div>
            </template>
            <div class="diagnostics-list">
              <div v-for="(advice, index) in diagnostics" :key="index" class="advice-item" :class="advice.type">
                <el-icon class="advice-icon">
                  <component :is="advice.icon" />
                </el-icon>
                <div class="advice-content">
                  <div class="advice-title">{{ advice.title }}</div>
                  <div class="advice-desc">{{ advice.desc }}</div>
                </div>
              </div>
              <div v-if="diagnostics.length === 0" class="advice-item success">
                <el-icon class="advice-icon"><CircleCheckFilled /></el-icon>
                <div class="advice-content">
                  <div class="advice-title">系统运行良好</div>
                  <div class="advice-desc">各项指标均在正常范围内，无需干预。</div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 右侧：详细数据 -->
        <el-col :span="8" class="animate__animated animate__fadeInRight" style="animation-delay: 0.6s">
          <el-card shadow="hover" class="detail-card">
            <template #header>
              <div class="card-header">
                <span class="title">详细指标监控</span>
              </div>
            </template>
            <div class="detail-list">
              <div class="detail-item">
                <span class="label">驱逐数量 (Eviction)</span>
                <span class="value text-warning">{{ stats.evictionCount }}</span>
              </div>
              <el-divider />
              <div class="detail-item">
                <span class="label">加载成功 (Success)</span>
                <span class="value text-success">{{ stats.loadSuccessCount }}</span>
              </div>
              <el-divider />
              <div class="detail-item">
                <span class="label">加载失败 (Failure)</span>
                <span class="value text-danger">{{ stats.loadExceptionCount }}</span>
              </div>
              <el-divider />
              <div class="detail-item">
                <span class="label">未命中数 (Miss)</span>
                <span class="value">{{ stats.missCount }}</span>
              </div>
            </div>
          </el-card>

          <el-card shadow="hover" class="raw-data-card mt-4">
            <template #header>
              <div class="card-header">
                <span class="title">原始数据快照</span>
                <el-button type="text" @click="copyRawData">复制</el-button>
              </div>
            </template>
            <div class="raw-data-box">
              <pre>{{ rawStats }}</pre>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { getWorkflowRuntimeCacheStats } from '@/api/admin/monitor'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { 
  Refresh, Aim, Files, DataAnalysis, Timer, 
  MagicStick, Warning, CircleCheckFilled, CircleCloseFilled, Delete, InfoFilled
} from '@element-plus/icons-vue'
import 'animate.css'

// 状态定义
const loading = ref(false)
const isAutoRefresh = ref(false)
const lastUpdateTime = ref('')
const timer = ref(null)
const rawStats = ref('')
const pieChartRef = ref(null)
const gaugeChartRef = ref(null)
let pieChart = null
let gaugeChart = null

// 核心数据模型
const stats = ref({
  hitCount: 0,
  missCount: 0,
  loadSuccessCount: 0,
  loadExceptionCount: 0,
  totalLoadTime: 0,
  evictionCount: 0,
  requestCount: 0,
  hitRate: 0,
  averageLoadPenalty: 0,
  size: 0,
  maxSize: 'Unknown'
})

// 诊断建议列表
const diagnostics = computed(() => {
  const list = []
  
  if (stats.value.hitRate < 0.5 && stats.value.requestCount > 100) {
    list.push({
      type: 'danger',
      icon: Warning,
      title: '缓存命中率过低',
      desc: '当前命中率低于 50%，建议检查缓存键设计或增加缓存容量。'
    })
  } else if (stats.value.hitRate < 0.8 && stats.value.requestCount > 100) {
    list.push({
      type: 'warning',
      icon: InfoFilled,
      title: '缓存命中率有待提升',
      desc: '当前命中率在 50%-80% 之间，可尝试优化热点数据缓存策略。'
    })
  }

  if (stats.value.evictionCount > 1000) {
    list.push({
      type: 'warning',
      icon: Delete,
      title: '缓存驱逐频繁',
      desc: '检测到大量缓存驱逐，说明缓存容量可能不足，建议调大最大缓存限制。'
    })
  }

  if (stats.value.loadExceptionCount > 0) {
    list.push({
      type: 'danger',
      icon: CircleCloseFilled,
      title: '缓存加载异常',
      desc: `检测到 ${stats.value.loadExceptionCount} 次加载失败，请检查后端数据源服务状态。`
    })
  }

  return list
})

// 数据获取与处理
const toNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const normalizeStats = (payload = {}) => ({
  hitCount: toNumber(payload.hitCount),
  missCount: toNumber(payload.missCount),
  loadSuccessCount: toNumber(payload.loadSuccessCount),
  loadExceptionCount: toNumber(payload.loadExceptionCount ?? payload.loadFailureCount),
  totalLoadTime: toNumber(payload.totalLoadTime),
  evictionCount: toNumber(payload.evictionCount),
  requestCount: toNumber(payload.requestCount),
  hitRate: toNumber(payload.hitRate),
  averageLoadPenalty: toNumber(payload.averageLoadPenalty),
  size: toNumber(payload.size),
  maxSize: payload.maxSize ?? 'Unknown'
})

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await getWorkflowRuntimeCacheStats()
    if (res.code === 200 && res.data) {
      rawStats.value = res.data.rawStats || JSON.stringify(res.data, null, 2)
      stats.value = normalizeStats(res.data)
      lastUpdateTime.value = new Date().toLocaleTimeString()
      updateCharts()
    }
  } catch (error) {
    console.error('获取监控数据失败:', error)
    if (!isAutoRefresh.value) {
      ElMessage.error('获取监控数据失败')
    }
  } finally {
    loading.value = false
  }
}

// 图表初始化与更新
const initCharts = () => {
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
  }
  if (gaugeChartRef.value) {
    gaugeChart = echarts.init(gaugeChartRef.value)
  }
}

const updateCharts = () => {
  if (!pieChart || !gaugeChart) return

  // 饼图：命中 vs 未命中
  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '0%', left: 'center' },
    series: [
      {
        name: '请求分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 20, fontWeight: 'bold' }
        },
        data: [
          { value: stats.value.hitCount, name: '命中', itemStyle: { color: '#67C23A' } },
          { value: stats.value.missCount, name: '未命中', itemStyle: { color: '#F56C6C' } }
        ]
      }
    ]
  }
  pieChart.setOption(pieOption)

  // 仪表盘：命中率
  const rateVal = (stats.value.hitRate * 100).toFixed(1)
  const gaugeOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 5,
        itemStyle: { color: '#409EFF' },
        progress: { show: true, roundCap: true, width: 10 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 10 } },
        axisTick: { distance: -15, splitNumber: 5, lineStyle: { width: 2, color: '#999' } },
        splitLine: { distance: -20, length: 10, lineStyle: { width: 3, color: '#999' } },
        axisLabel: { distance: -10, color: '#999', fontSize: 10 },
        title: {
          show: true,
          offsetCenter: [0, '40%'], // 向下移动标题，避免与数值重叠
          fontSize: 16,
          color: '#909399'
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '0%'], // 数值居中显示
          fontSize: 30,
          fontWeight: 'bold',
          formatter: '{value}%',
          color: '#303133'
        },
        data: [{ value: rateVal, name: '命中率' }]
      }
    ]
  }
  gaugeChart.setOption(gaugeOption)
}

// 辅助函数
const manualRefresh = async () => {
  await fetchStats()
  ElMessage.success('数据已刷新')
}

const handleAutoRefresh = (val) => {
  if (val) {
    fetchStats()
    timer.value = setInterval(fetchStats, 5000)
    ElMessage.success('已开启自动刷新 (5s)')
  } else {
    clearInterval(timer.value)
    timer.value = null
    ElMessage.info('已关闭自动刷新')
  }
}

const copyRawData = () => {
  navigator.clipboard.writeText(rawStats.value)
  ElMessage.success('原始数据已复制到剪贴板')
}

const formatNumber = (num, decimals = 0) => {
  return num ? Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '0'
}

const formatDuration = (ns) => {
  if (!ns) return '0 ms'
  return (ns / 1_000_000).toFixed(2) + ' ms'
}

const formatDurationNum = (ns) => {
  if (!ns) return '0.00'
  return (ns / 1_000_000).toFixed(2)
}

const getHitRateColor = (rate) => {
  if (rate >= 0.8) return '#67C23A'
  if (rate >= 0.5) return '#E6A23C'
  return '#F56C6C'
}

const getHitRateStatus = (rate) => {
  if (rate >= 0.8) return 'Excellent'
  if (rate >= 0.5) return 'Good'
  return 'Poor'
}

// 生命周期
onMounted(() => {
  nextTick(async () => {
    initCharts()
    await fetchStats()
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value)
  window.removeEventListener('resize', handleResize)
  if (pieChart) pieChart.dispose()
  if (gaugeChart) gaugeChart.dispose()
})

const handleResize = () => {
  pieChart && pieChart.resize()
  gaugeChart && gaugeChart.resize()
}
</script>

<style scoped lang="scss">
.monitor-dashboard {
  padding: 24px;
  background-color: #f6f8f9;
  min-height: 100%;
  
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    
    .header-left {
      .page-title {
        font-size: 24px;
        font-weight: 700;
        color: #1f2d3d;
        margin: 0 0 8px 0;
      }
      .page-desc {
        color: #8492a6;
        font-size: 14px;
        margin: 0;
      }
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
      background: white;
      padding: 8px 16px;
      border-radius: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.04);
      
      .last-update {
        font-size: 13px;
        color: #8492a6;
        .time {
          color: #1f2d3d;
          font-weight: 600;
          margin-left: 4px;
        }
      }
      
      .auto-refresh {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #5e6d82;
      }
      
      .refresh-btn {
        transition: transform 0.3s;
        &:hover { transform: rotate(180deg); }
      }
    }
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    margin-bottom: 24px;
    
    .metric-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 20px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      border: 1px solid #ebeef5;
      
      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.08);
        border-color: transparent;
      }
      
      .card-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }
      
      .card-content {
        flex: 1;
        .label { font-size: 14px; color: #8492a6; margin-bottom: 8px; }
        .value {
          display: flex;
          align-items: baseline;
          margin-bottom: 8px;
          .number { font-size: 28px; font-weight: 700; color: #1f2d3d; font-family: 'Roboto', sans-serif; }
          .unit { font-size: 14px; color: #8492a6; margin-left: 4px; }
        }
        .sub-label { font-size: 12px; color: #99a9bf; }
      }
      
      // Card Specific Styles
      &.hit-rate-card {
        .card-icon { background: rgba(103, 194, 58, 0.1); color: #67C23A; }
        .progress-bar {
          height: 4px;
          background: #f0f2f5;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
          .progress { height: 100%; transition: width 0.6s ease; }
        }
        .card-status {
          position: absolute;
          top: 24px;
          right: 24px;
          font-weight: 600;
          font-size: 14px;
          opacity: 0.8;
        }
      }
      
      &.size-card .card-icon { background: rgba(64, 158, 255, 0.1); color: #409EFF; }
      &.request-card .card-icon { background: rgba(230, 162, 60, 0.1); color: #E6A23C; }
      &.time-card .card-icon { background: rgba(245, 108, 108, 0.1); color: #F56C6C; }
    }
  }

  .dashboard-main {
    .chart-card, .detail-card, .raw-data-card {
      border-radius: 16px;
      border: 1px solid #ebeef5;
      margin-bottom: 0;
      height: 100%;
      
      :deep(.el-card__header) {
        border-bottom: 1px solid #f5f7fa;
        padding: 16px 24px;
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          .title { font-weight: 600; color: #1f2d3d; font-size: 16px; }
        }
      }
    }
    
    .charts-container {
      display: flex;
      height: 250px;
      .chart-box { flex: 1; height: 100%; }
    }
    
    .diagnostics-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
      .advice-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        background: #f8f9fa;
        
        .advice-icon { font-size: 20px; margin-top: 2px; }
        .advice-content {
          .advice-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
          .advice-desc { font-size: 13px; color: #606266; line-height: 1.4; }
        }
        
        &.danger { background: rgba(245, 108, 108, 0.08); .advice-icon { color: #F56C6C; } .advice-title { color: #F56C6C; } }
        &.warning { background: rgba(230, 162, 60, 0.08); .advice-icon { color: #E6A23C; } .advice-title { color: #E6A23C; } }
        &.success { background: rgba(103, 194, 58, 0.08); .advice-icon { color: #67C23A; } .advice-title { color: #67C23A; } }
      }
    }
    
    .detail-list {
      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        
        .label { color: #606266; font-size: 14px; }
        .value { font-weight: 600; font-size: 15px; color: #303133; font-family: monospace; }
        
        .text-success { color: #67C23A; }
        .text-warning { color: #E6A23C; }
        .text-danger { color: #F56C6C; }
      }
    }
    
    .raw-data-box {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      max-height: 200px;
      overflow-y: auto;
      
      pre {
        margin: 0;
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        font-size: 12px;
        color: #606266;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
    
    .mt-4 { margin-top: 16px; }
  }
}

// 动画类
.is-spinning {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// 响应式
@media (max-width: 1200px) {
  .monitor-dashboard .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .monitor-dashboard .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
