<template>
  <div class="teacher-dashboard">
    <div class="dashboard-content">
      <!-- 欢迎横幅 -->
      <div class="welcome-section">
        <div class="welcome-content">
          <div class="date-badge">
            <el-icon><Calendar /></el-icon>
            <span>{{ dateStr }} {{ weekStr }}</span>
          </div>
          <h1 class="greeting">
            {{ timeGreeting }}，<span class="name">{{ username }}</span> 老师
          </h1>
          <p class="subtitle">
            <el-icon><Coffee /></el-icon>
            <span>今日教学概览：您有 <span class="highlight">{{ teacherStats.pendingGradingTasks }}</span> 份作业待批改，<span class="highlight">{{ teacherStats.totalTasks }}</span> 个任务进行中。</span>
          </p>
        </div>
        <div class="welcome-decoration">
          <div class="decoration-circle circle-1"></div>
          <div class="decoration-circle circle-2"></div>
          <div class="icon-composition">
            <el-icon class="main-icon"><Reading /></el-icon>
            <div class="sub-icon icon-1"><el-icon><DataLine /></el-icon></div>
            <div class="sub-icon icon-2"><el-icon><Notebook /></el-icon></div>
          </div>
        </div>
      </div>

      <!-- 核心数据卡片 -->
      <div class="stats-grid">
        <div class="stat-card teal" @click="$router.push('/teacher/cases')">
          <div class="card-content">
            <div class="card-info">
              <span class="label">教学案例库</span>
              <span class="value">{{ teacherStats.caseCount }}</span>
            </div>
            <div class="card-icon-wrapper">
              <el-icon><FolderOpened /></el-icon>
            </div>
          </div>
          <div class="card-action">
            <span>管理案例</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>

        <div class="stat-card blue" @click="$router.push('/teacher/tasks')">
          <div class="card-content">
            <div class="card-info">
              <span class="label">学生任务总数</span>
              <span class="value">{{ teacherStats.totalTasks }}</span>
            </div>
            <div class="card-icon-wrapper">
              <el-icon><List /></el-icon>
            </div>
          </div>
          <div class="card-action">
            <span>查看任务</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>

        <div class="stat-card orange" @click="$router.push('/teacher/grading')">
          <div class="card-content">
            <div class="card-info">
              <span class="label">待批改作业</span>
              <span class="value">{{ teacherStats.pendingGradingTasks }}</span>
            </div>
            <div class="card-icon-wrapper">
              <el-icon><EditPen /></el-icon>
            </div>
          </div>
          <div class="card-action">
            <span>去批改</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>

        <div class="stat-card green" @click="$router.push('/teacher/classes')">
          <div class="card-content">
            <div class="card-info">
              <span class="label">管理班级</span>
              <span class="value">{{ teacherStats.classCount }}</span>
            </div>
            <div class="card-icon-wrapper">
              <el-icon><UserFilled /></el-icon>
            </div>
          </div>
          <div class="card-action">
            <span>班级详情</span>
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <div class="main-content-grid">
      <!-- 快捷操作区 -->
      <div class="section-card quick-actions">
        <div class="section-header">
          <h3><el-icon><Operation /></el-icon> 快捷操作</h3>
        </div>
        <div class="actions-grid">
          <div class="action-item" @click="$router.push('/teacher/cases/create')">
            <div class="icon-box gradient-teal">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div class="action-text">
              <span class="title">AI生成案例</span>
              <span class="desc">智能辅助生成</span>
            </div>
            <el-icon class="hover-arrow"><Right /></el-icon>
          </div>
          <div class="action-item" @click="$router.push('/teacher/tasks')">
            <div class="icon-box gradient-blue">
              <el-icon><Plus /></el-icon>
            </div>
            <div class="action-text">
              <span class="title">发布新任务</span>
              <span class="desc">创建实训任务</span>
            </div>
            <el-icon class="hover-arrow"><Right /></el-icon>
          </div>
          <div class="action-item" @click="$router.push('/teacher/classes')">
            <div class="icon-box gradient-green">
              <el-icon><Management /></el-icon>
            </div>
            <div class="action-text">
              <span class="title">班级管理</span>
              <span class="desc">查看班级情况</span>
            </div>
            <el-icon class="hover-arrow"><Right /></el-icon>
          </div>
          <div class="action-item" @click="$router.push('/teacher/ai/chat')">
            <div class="icon-box gradient-orange">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="action-text">
              <span class="title">AI 助教</span>
              <span class="desc">智能问答助手</span>
            </div>
            <el-icon class="hover-arrow"><Right /></el-icon>
          </div>
          <div class="action-item" @click="$router.push('/teacher/classes/analytics')">
            <div class="icon-box gradient-teal">
              <el-icon><Histogram /></el-icon>
            </div>
            <div class="action-text">
              <span class="title">班级学情分析</span>
              <span class="desc">查看班级评分分布与常见错误</span>
            </div>
            <el-icon class="hover-arrow"><Right /></el-icon>
          </div>
        </div>
      </div>

      <!-- 教学日历/通知 -->
      <div class="section-card timeline-section">
        <div class="section-header">
          <h3><el-icon><Bell /></el-icon> 近期动态</h3>
          <el-button link type="primary" @click="$router.push('/teacher/cases')">
            查看全部 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </div>
        <div class="timeline-container custom-scrollbar">
          <div class="timeline-list" v-if="activities.length > 0">
            <div class="timeline-item" v-for="(item, index) in activities" :key="item.id" :style="{ animationDelay: `${index * 0.1}s` }">
              <div class="time-column">
                <span class="time">{{ item.time }}</span>
                <div class="line"></div>
              </div>
              <div class="content-card">
                <div class="tag-badge case">
                  <el-icon><FolderOpened /></el-icon>
                  案例
                </div>
                <span class="text">{{ item.content }}</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无近期动态" :image-size="80">
            <template #image>
              <el-icon :size="60" color="#e2e8f0"><Bell /></el-icon>
            </template>
          </el-empty>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Calendar, Coffee, DataLine, Notebook, Trophy, FolderOpened, List, EditPen, UserFilled,
  Operation, MagicStick, Plus, Management, ChatDotRound, Bell, Reading, ArrowRight, Right, Histogram
} from '@element-plus/icons-vue'
import { getTeacherDashboard } from '@/api/teacher/statistics'
import { getTeacherCaseList } from '@/api/teacher/case'

const router = useRouter()
const loading = ref(false)
const username = ref(localStorage.getItem('realName') || localStorage.getItem('username') || '老师')
const dateStr = ref('')
const weekStr = ref('')
let timer = null

const teacherStats = ref({
  caseCount: 0,
  totalTasks: 0,
  pendingGradingTasks: 0,
  classCount: 0
})

const activities = ref([])

const updateTime = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  dateStr.value = `${year}/${month}/${day}`
  weekStr.value = weekDays[date.getDay()]
}

const timeGreeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 17) return '下午好'
  if (hour < 19) return '傍晚好'
  return '晚上好'
})

const loadStats = async () => {
  loading.value = true
  try {
    const [statsRes, casesRes] = await Promise.all([
      getTeacherDashboard(),
      getTeacherCaseList({ page: 1, size: 5 })
    ])

    if (statsRes.code === 200) {
      teacherStats.value = statsRes.data
    }

    if (casesRes.code === 200) {
      // 将最近创建的案例转换为动态
      const records = Array.isArray(casesRes.data) ? casesRes.data : (casesRes.data?.records || [])
      const recentCases = records
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
      
      activities.value = recentCases.map(c => ({
        id: c.id,
        time: formatTime(c.createdAt),
        type: 'case',
        tag: '案例',
        content: `创建了新案例：${c.caseName}`
      }))
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 60000)
  loadStats()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped lang="scss">
// 变量系统
$primary-blue: #3b82f6;
$primary-teal: #0d9488;
$primary-orange: #ea580c;
$primary-green: #059669; // 替代紫色
$bg-color: #f8fafc;
$card-bg: #ffffff;
$text-main: #0f172a;
$text-sub: #64748b;
$shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
$shadow-md: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
$shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02);
$radius-lg: 16px;
$radius-xl: 24px;

.teacher-dashboard {
  height: 100%;
  width: 100%;
  overflow: hidden; // 禁止外层滚动，确保单屏显示
  background-color: $bg-color;
  display: flex;
  flex-direction: column;
}

.dashboard-content {
  flex: 1;
  padding: 10px 12px; // 进一步压缩内边距
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

/* 欢迎横幅 - 清新蓝绿渐变 */
.welcome-section {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 24px;
  color: #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  animation: slideDown 0.6s ease-out;
  flex-shrink: 0;

  .welcome-content {
    z-index: 2;
    max-width: 100%;

    .date-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 11px;
      margin-bottom: 4px;
      color: #64748b;
      border: 1px solid transparent;
    }

    .greeting {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
      color: #1e293b;
      
      .name { 
        color: #0f766e; 
        position: relative;
        display: inline-block;
        
        &::after {
          display: none;
        }
      }
    }

    .subtitle {
      font-size: 12px;
      opacity: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      line-height: 1.4;
      color: #64748b;
      
      .highlight {
        font-weight: 600;
        color: #0f766e;
        font-size: 13px;
        margin: 0 4px;
      }
    }
  }

  .welcome-decoration {
    display: none;
  }
}

/* 统计卡片 - 现代风格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;

  .stat-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: auto;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border-color: #cbd5e1;

      .card-icon-wrapper {
        transform: scale(1.05);
      }
      
      .card-action {
        color: #0f172a;
        
        .el-icon {
          transform: translateX(4px);
        }
      }
    }

    .card-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 2;
      margin-bottom: 12px;

      .card-info {
        display: flex;
        flex-direction: column;
        
        .label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 500;
        }
        
        .value {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1;
        }
      }

      .card-icon-wrapper {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: transform 0.3s ease;
      }
    }

    .card-action {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      color: #94a3b8;
      margin-top: auto;
      transition: color 0.3s;
      z-index: 2;
    }

    /* 颜色变体 */
    &.teal {
      .card-icon-wrapper { background: #f0fdfa; color: #0d9488; }
      &::before { display: none; }
    }
    &.blue {
      .card-icon-wrapper { background: #eff6ff; color: #3b82f6; }
      &::before { display: none; }
    }
    &.orange {
      .card-icon-wrapper { background: #fff7ed; color: #ea580c; }
      &::before { display: none; }
    }
    &.green {
      .card-icon-wrapper { background: #f0fdf4; color: #16a34a; }
      &::before { display: none; }
    }
  }
}

/* 主内容网格 */
.main-content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px; // 压缩
  flex: 1;
  min-height: 0;

  .section-card {
    background: $card-bg;
    border-radius: $radius-lg;
    padding: 16px; // 压缩
    box-shadow: $shadow-sm;
    border: 1px solid #f1f5f9;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    animation: fadeInUp 0.6s ease-out;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px; // 压缩
      flex-shrink: 0;

      h3 {
        font-size: 15px; // 压缩
        font-weight: 700;
        color: $text-main;
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        
        .el-icon { color: $primary-blue; }
      }
    }
  }
}

/* 快捷操作 - 列表式卡片 */
.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px; // 压缩
  overflow-y: auto;
  padding-right: 4px;

  .action-item {
    background: #f8fafc;
    border-radius: 12px;
    padding: 10px 12px; // 压缩
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid transparent;

    &:hover {
      background: white;
      border-color: #e2e8f0;
      box-shadow: $shadow-md;
      transform: translateY(-2px);

      .hover-arrow {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .icon-box {
      width: 36px; // 压缩
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px; // 压缩
      color: white;
      flex-shrink: 0;
      
      &.gradient-teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
      &.gradient-blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
      &.gradient-green { background: linear-gradient(135deg, #34d399, #059669); }
      &.gradient-orange { background: linear-gradient(135deg, #fb923c, #ea580c); }
    }

    .action-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;

      .title {
        font-size: 13px; // 压缩
        font-weight: 600;
        color: $text-main;
      }
      
      .desc {
        font-size: 12px;
        color: $text-sub;
      }
    }

    .hover-arrow {
      color: $text-sub;
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s ease;
      font-size: 14px;
    }
  }
}

/* 时间轴动态 */
.timeline-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .timeline-item {
    display: flex;
    gap: 12px; // 压缩
    animation: fadeIn 0.5s ease-out backwards;
    
    &:not(:last-child) {
      .time-column .line {
        background: #e2e8f0;
      }
    }

    .time-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 36px; // 压缩
      flex-shrink: 0;

      .time {
        font-size: 12px;
        font-weight: 600;
        color: $text-sub;
        margin-bottom: 2px;
      }

      .line {
        flex: 1;
        width: 2px;
        background: transparent;
        min-height: 16px; // 压缩
        border-radius: 1px;
      }
    }

    .content-card {
      flex: 1;
      background: #f8fafc;
      padding: 10px 14px; // 压缩
      border-radius: 12px;
      margin-bottom: 12px; // 压缩
      transition: all 0.2s;
      border: 1px solid transparent;

      &:hover {
        background: white;
        border-color: #e2e8f0;
        box-shadow: $shadow-sm;
      }

      .tag-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 6px;
        margin-bottom: 4px;
        
        &.case { background: #eff6ff; color: $primary-blue; }
      }

      .text {
        display: block;
        font-size: 13px; // 压缩
        color: $text-main;
        line-height: 1.4;
      }
    }
  }
}

/* 动画定义 */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes floatElement {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(0, -10px); }
}

/* 自定义滚动条 */
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
    &:hover { background: #94a3b8; }
  }
}
</style>
