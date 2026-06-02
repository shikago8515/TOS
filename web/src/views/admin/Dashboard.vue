<template>
  <div class="dashboard-container">
    <!-- 统计卡片行 -->
    <el-row :gutter="24" class="mb-24">
      <el-col :span="6" v-for="(item, index) in statCards" :key="index">
        <div class="stat-card animate__animated animate__fadeInUp" :style="{ animationDelay: `${index * 0.1}s` }">
          <div class="stat-icon-wrapper" :class="item.type">
            <el-icon><component :is="item.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-title">{{ item.title }}</div>
            <div class="stat-value">
              <span class="number">{{ item.value }}</span>
              <span class="unit" v-if="item.unit">{{ item.unit }}</span>
            </div>
            <div class="stat-trend" :class="item.trend >= 0 ? 'up' : 'down'">
              <span class="trend-value">{{ Math.abs(item.trend) }}%</span>
              <el-icon>
                <Top v-if="item.trend >= 0" />
                <Bottom v-else />
              </el-icon>
              <span class="label">较上周</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 主要内容区 -->
    <el-row :gutter="24">
      <!-- 左侧：系统概览与动态 -->
      <el-col :span="16">
        <el-card shadow="never" class="chart-card border-card">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <span class="header-title">系统访问趋势</span>
                <span class="header-subtitle">近7日系统活跃度分析</span>
              </div>
              <el-radio-group v-model="timeRange" size="small" class="custom-radio">
                <el-radio-button label="week">本周</el-radio-button>
                <el-radio-button label="month">本月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container" ref="chartRef"></div>
        </el-card>

        <el-card shadow="never" class="mt-24 border-card">
          <template #header>
            <div class="card-header">
              <span class="header-title">最近操作日志</span>
              <el-button text type="primary" @click="viewAllLogs">查看全部</el-button>
            </div>
          </template>
          <div class="log-list">
            <div class="log-item" v-for="(log, idx) in recentLogs" :key="idx">
              <div class="log-icon">
                <div class="dot"></div>
                <div class="line" v-if="idx !== recentLogs.length - 1"></div>
              </div>
              <div class="log-content">
                <div class="log-header">
                  <span class="log-user">{{ log.user }}</span>
                  <span class="log-time">{{ log.time }}</span>
                </div>
                <div class="log-action">{{ log.action }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：系统状态与快捷入口 -->
      <el-col :span="8">
        <el-card shadow="never" class="status-card border-card">
          <template #header>
            <div class="card-header">
              <span class="header-title">服务器状态</span>
              <div class="status-badge" :class="serverStats.status === 'running' ? 'running' : 'stopped'">
                <span class="dot"></span>
                {{ serverStats.status === 'running' ? '运行中' : '异常' }}
              </div>
            </div>
          </template>
          <div class="status-list">
            <div class="status-item">
              <div class="status-info">
                <span class="label">CPU 使用率</span>
                <span class="value">{{ serverStats.cpuUsage }}%</span>
              </div>
              <el-progress :percentage="serverStats.cpuUsage" :stroke-width="10" :color="customColors" />
            </div>
            <div class="status-item">
              <div class="status-info">
                <span class="label">内存使用率</span>
                <span class="value">{{ serverStats.memoryUsage }}%</span>
              </div>
              <el-progress :percentage="serverStats.memoryUsage" :stroke-width="10" :color="customColors" />
            </div>
            <div class="status-item">
              <div class="status-info">
                <span class="label">磁盘空间</span>
                <span class="value">{{ serverStats.diskUsage }}%</span>
              </div>
              <el-progress :percentage="serverStats.diskUsage" :stroke-width="10" :color="customColors" />
            </div>
          </div>
        </el-card>

        <el-card shadow="never" class="mt-24 quick-nav border-card">
          <template #header>
            <span class="header-title">快捷入口</span>
          </template>
          <div class="nav-grid">
            <div class="nav-item" v-for="(nav, idx) in quickNavs" :key="idx" @click="handleQuickNav(nav)">
              <div class="nav-icon" :style="{ background: nav.bg, color: nav.color }">
                <el-icon><component :is="nav.icon" /></el-icon>
              </div>
              <span>{{ nav.name }}</span>
            </div>
          </div>
        </el-card>
        
        <div class="mt-24 announcement-card">
          <div class="announcement-content">
            <div class="icon-box">
              <el-icon><Notification /></el-icon>
            </div>
            <div class="text-box">
              <h3>{{ latestNotice?.title || '系统通知' }}</h3>
              <p>{{ latestNotice?.content || '当前暂无新的管理员通知。' }}</p>
              <span v-if="latestNotice?.timeText" class="announcement-time">{{ latestNotice.timeText }}</span>
            </div>
            <el-button type="primary" size="small" round @click="handleAnnouncementDetail">了解详情</el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { 
  User, School, Document, Cpu, 
  Top, Bottom, Notification,
  Setting, Connection, DataLine, Monitor
} from '@element-plus/icons-vue'
import { getAdminDashboard } from '@/api/admin/statistics'
import { getAdminNotices, markAdminNoticeRead } from '@/api/admin/notice'
import { getServerRuntimeStatus } from '@/api/admin/monitor'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'

const router = useRouter()
const timeRange = ref('week')
const loading = ref(false)
const chartRef = ref(null)
const latestNotice = ref(null)
let myChart = null
let resizeObserver = null

const statCards = shallowRef([
  { title: '总用户数', value: '0', trend: 0, icon: User, type: 'blue' },
  { title: '活跃教师', value: '0', trend: 0, icon: School, type: 'green' },
  { title: '实训案例', value: '0', trend: 0, icon: Document, type: 'orange' },
  { title: 'CPU 负载', value: '0', unit: '%', trend: 0, icon: Cpu, type: 'red' }
])

const recentLogs = ref([])
const serverStats = ref({
  status: 'running',
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0
})

const formatRelativeTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return '刚刚'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} 分钟前`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时前`
  return `${Math.floor(diffMs / day)} 天前`
}

const initChart = () => {
  if (!chartRef.value) return
  
  myChart = echarts.init(chartRef.value)
  const option = {
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      axisPointer: {
        type: 'shadow'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisTick: {
          alignWithLabel: true
        },
        axisLine: {
          lineStyle: {
            color: '#E4E7ED'
          }
        },
        axisLabel: {
          color: '#606266'
        }
      }
    ],
    yAxis: [
      {
        type: 'value',
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#E4E7ED'
          }
        }
      }
    ],
    series: [
      {
        name: '访问量',
        type: 'bar',
        barWidth: '40%',
        data: [120, 200, 150, 80, 70, 110, 130],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#a0cfff' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(180, 180, 180, 0.1)',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  }
  myChart.setOption(option)
}

// 加载仪表板数据
const loadDashboardData = async () => {
  loading.value = true
  try {
    const res = await getAdminDashboard()
    if (res.code === 200 && res.data) {
      statCards.value = [
        { 
          title: '总用户数', 
          value: String(res.data.totalUsers || 0), 
          trend: Number(res.data.userTrend || 0),
          icon: User, 
          type: 'blue' 
        },
        { 
          title: '活跃教师', 
          value: String(res.data.activeTeachers ?? res.data.totalTeachers ?? 0),
          trend: Number(res.data.teacherTrend || 0),
          icon: School, 
          type: 'green' 
        },
        { 
          title: '实训案例', 
          value: String(res.data.totalCases || 0), 
          trend: Number(res.data.caseTrend || 0),
          icon: Document, 
          type: 'orange' 
        },
        { 
          title: 'CPU 负载', 
          value: '0',
          unit: '%', 
          trend: Number(res.data.loadTrend || 0),
          icon: Cpu, 
          type: 'red' 
        }
      ]

      if (res.data.recentLogs && res.data.recentLogs.length > 0) {
        recentLogs.value = res.data.recentLogs.map(log => ({
          user: log.operatorName || '未知用户',
          action: log.content || '未知操作',
          time: log.createTime ? new Date(log.createTime).toLocaleString() : '未知时间'
        }))
      } else {
        recentLogs.value = []
      }

      if (myChart && res.data.visitTrend) {
        const dates = res.data.visitTrend.map(item => item.date)
        const counts = res.data.visitTrend.map(item => item.count)

        myChart.setOption({
          xAxis: { data: dates },
          series: [{ data: counts }]
        })
      }
    }

    const statusRes = await getServerRuntimeStatus()
    if (statusRes.code === 200 && statusRes.data) {
      serverStats.value = {
        status: statusRes.data.status || 'running',
        cpuUsage: Number(statusRes.data.cpuUsage || 0),
        memoryUsage: Number(statusRes.data.memoryUsage || 0),
        diskUsage: Number(statusRes.data.diskUsage || 0)
      }
      statCards.value = statCards.value.map((item, index) => index === 3
        ? { ...item, value: String(serverStats.value.cpuUsage || 0) }
        : item)
    }
  } catch (error) {
    console.error('Failed to load dashboard data', error)
    ElMessage.error('加载仪表盘数据失败')
  } finally {
    loading.value = false
  }
}

const loadLatestNotice = async () => {
  try {
    const res = await getAdminNotices({ limit: 1 })
    const list = Array.isArray(res?.data) ? res.data : []
    const [notice] = list
    latestNotice.value = notice ? {
      id: notice.id,
      title: notice.title || '系统通知',
      content: notice.content || '系统有新的更新，请及时查看。',
      action: notice.action || '/admin/logs',
      read: Boolean(notice.read),
      timeText: formatRelativeTime(notice.time)
    } : null
  } catch (error) {
    console.error('Failed to load latest notice', error)
    latestNotice.value = null
  }
}

const viewAllLogs = () => {
  router.push('/admin/logs')
}

const handleQuickNav = (nav) => {
  if (!nav?.path) return
  router.push(nav.path)
}

const handleAnnouncementDetail = async () => {
  const targetPath = latestNotice.value?.action || '/admin/logs'

  if (latestNotice.value?.id && !latestNotice.value.read) {
    try {
      await markAdminNoticeRead(latestNotice.value.id)
      latestNotice.value = {
        ...latestNotice.value,
        read: true
      }
    } catch (error) {
      console.error('Failed to mark notice as read', error)
    }
  }

  router.push(targetPath)
}

onMounted(() => {
  nextTick(async () => {
    initChart()
    await Promise.all([loadDashboardData(), loadLatestNotice()])
    window.addEventListener('resize', handleResize)

    if (chartRef.value) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(chartRef.value)
    }
  })
})

onUnmounted(() => {
  if (myChart) {
    myChart.dispose()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  myChart && myChart.resize()
}

const customColors = [
  { color: '#67c23a', percentage: 40 },
  { color: '#e6a23c', percentage: 70 },
  { color: '#f56c6c', percentage: 90 },
]

const quickNavs = [
  { name: '用户管理', icon: User, bg: '#ecf5ff', color: '#409eff', path: '/admin/users' },
  { name: '系统设置', icon: Setting, bg: '#f0f9eb', color: '#67c23a', path: '/admin/system' },
  { name: '接口监控', icon: Monitor, bg: '#fdf6ec', color: '#e6a23c', path: '/admin/monitor' },
  { name: '数据报表', icon: DataLine, bg: '#fef0f0', color: '#f56c6c', path: '/admin/token-usage' },
]
</script>

<style scoped lang="scss">
.dashboard-container {
  padding: 0;
  
  .mb-24 {
    margin-bottom: 16px;
  }
  
  .mt-24 {
    margin-top: 16px;
  }

  .stat-card {
    background: #fff;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    transition: all 0.3s ease;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border-color: #409eff;
    }
    
    .stat-icon-wrapper {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
      
      &.blue { background: #ecf5ff; color: #409eff; }
      &.green { background: #f0f9eb; color: #67c23a; }
      &.orange { background: #fdf6ec; color: #e6a23c; }
      &.red { background: #fef0f0; color: #f56c6c; }
    }
    
    .stat-info {
      flex: 1;
      
      .stat-title {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 4px;
        font-weight: 500;
      }
      
      .stat-value {
        display: flex;
        align-items: baseline;
        margin-bottom: 4px;
        
        .number {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
          letter-spacing: -0.5px;
        }
        
        .unit {
          font-size: 12px;
          color: #94a3b8;
          margin-left: 4px;
          font-weight: 500;
        }
      }
      
      .stat-trend {
        display: flex;
        align-items: center;
        font-size: 12px;
        
        .trend-value {
          font-weight: 600;
          margin-right: 2px;
        }
        
        .label {
          color: #94a3b8;
          margin-left: 4px;
          font-size: 12px;
        }
        
        &.up { color: #f56c6c; }
        &.down { color: #67c23a; }
      }
    }
  }

  .border-card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    transition: all 0.3s;
    background: #fff;
    
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    }
    
    :deep(.el-card__header) {
      border-bottom: 1px solid #f1f5f9;
      padding: 12px 16px;
    }
    
    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .header-left {
      display: flex;
      flex-direction: column;
      
      .header-title {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 2px;
      }
      
      .header-subtitle {
        font-size: 12px;
        color: #94a3b8;
      }
    }
    
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 500;
      
      &.running {
        color: #67c23a;
        background: #f0f9eb;
        border: 1px solid #e1f3d8;
        
        .dot {
          width: 6px;
          height: 6px;
          background: #67c23a;
          border-radius: 50%;
        }
      }

      &.stopped {
        color: #f56c6c;
        background: #fef0f0;
        border: 1px solid #fde2e2;

        .dot {
          width: 6px;
          height: 6px;
          background: #f56c6c;
          border-radius: 50%;
        }
      }
    }
  }

  .chart-container {
    height: 300px;
    width: 100%;
  }

  .log-list {
    .log-item {
      display: flex;
      gap: 12px;
      padding-bottom: 16px;
      position: relative;
      
      &:last-child {
        padding-bottom: 0;
        
        .log-icon .line {
          display: none;
        }
      }
      
      .log-icon {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 16px;
        padding-top: 4px;
        
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #409eff;
          border: 2px solid #ecf5ff;
          box-sizing: content-box;
        }
        
        .line {
          flex: 1;
          width: 1px;
          background: #e2e8f0;
          margin-top: 4px;
          min-height: 20px;
        }
      }
      
      .log-content {
        flex: 1;
        
        .log-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          
          .log-user {
            font-weight: 600;
            color: #1e293b;
            font-size: 13px;
          }
          
          .log-time {
            color: #94a3b8;
            font-size: 12px;
          }
        }
        
        .log-action {
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }
      }
    }
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .status-item {
      .status-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
        
        .label { color: #64748b; }
        .value { font-weight: 600; color: #1e293b; }
      }
    }
  }
  
  .nav-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      
      &:hover {
        background: #fff;
        border-color: #e2e8f0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transform: translateY(-1px);
      }
      
      .nav-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        margin-bottom: 8px;
        transition: all 0.2s;
      }
      
      span {
        font-size: 13px;
        color: #475569;
        font-weight: 500;
      }
    }
  }
  
  .announcement-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    color: #1e293b;
    position: relative;
    overflow: hidden;
    
    .announcement-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      
      .icon-box {
        width: 36px;
        height: 36px;
        background: #f1f5f9;
        color: #409eff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      
      .text-box {
        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        
        p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
          line-height: 1.5;
        }

        .announcement-time {
          display: inline-block;
          margin-top: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
      }
      
      .el-button {
        background: #409eff;
        color: #fff;
        border: none;
        font-weight: 500;
        
        &:hover {
          background: #66b1ff;
        }
      }
    }
  }
}
</style>

