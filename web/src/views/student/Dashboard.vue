<template>
  <div class="student-dashboard">
    <!-- 游戏化欢迎横幅 -->
    <div class="gamified-banner animate__animated animate__fadeIn">
      <div class="banner-bg"></div>
      <div class="user-profile">
        <div class="avatar-ring">
          <div class="avatar-inner">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Student.png" alt="avatar" />
          </div>
          <div class="level-badge">Lv.{{ studentLevel }}</div>
        </div>
        <div class="user-info">
          <h1 class="greeting">Hi, {{ username }}</h1>
          <div class="xp-bar-container">
            <div class="xp-info">
              <span>当前经验值</span>
              <span>{{ currentXP }} / {{ nextLevelXP }} XP</span>
            </div>
            <div class="xp-track">
              <div class="xp-fill" :style="{ width: (currentXP / nextLevelXP) * 100 + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="daily-streak">
        <div class="streak-icon"><el-icon><Lightning /></el-icon></div>
        <div class="streak-info">
          <div class="count">{{ loginStreak }} 天</div>
          <div class="label">连续学习</div>
        </div>
      </div>
    </div>

    <!-- 任务控制台 -->
    <div class="mission-control">
      <div class="section-header animate__animated animate__fadeInLeft">
        <h2><el-icon><Compass /></el-icon> 任务控制台</h2>
        <span class="subtitle">您有 {{ studentStats.inProgressTasks }} 项任务正在进行中</span>
      </div>

      <div class="mission-cards animate__animated animate__fadeInUp animate__delay-0.5s">
        <!-- 待办任务卡片 -->
        <div class="mission-card primary" @click="$router.push('/student/tasks')">
          <div class="card-header">
            <span class="tag">进行中</span>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </div>
          <div class="card-content">
            <div class="big-icon"><el-icon><Cpu /></el-icon></div>
            <div class="text-content">
              <h3>我的任务</h3>
              <p>查看并完成分配的实训任务</p>
            </div>
          </div>
          <div class="progress-mini">
            <span class="label">完成度</span>
            <span class="value">{{ completionRate }}%</span>
          </div>
        </div>

        <!-- 成绩查询卡片 -->
        <div class="mission-card secondary" @click="$router.push('/student/submissions')">
          <div class="card-header">
            <span class="tag success">已完成</span>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </div>
          <div class="card-content">
            <div class="big-icon"><el-icon><Trophy /></el-icon></div>
            <div class="text-content">
              <h3>成绩单</h3>
              <p>查看历史提交与评测结果</p>
            </div>
          </div>
          <div class="stats-mini">
            <span>{{ studentStats.completedTasks }} 项已完成</span>
          </div>
        </div>

        <div class="mission-card secondary" @click="$router.push('/student/report')">
          <div class="card-header">
            <span class="tag success">综合分析</span>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </div>
          <div class="card-content">
            <div class="big-icon"><el-icon><Document /></el-icon></div>
            <div class="text-content">
              <h3>个人实训报告</h3>
              <p>查看优势分析与个性化学习建议</p>
            </div>
          </div>
          <div class="stats-mini">
            <span>自动汇总 AI + 教师评分</span>
          </div>
        </div>

        <!-- AI 助教卡片 -->
        <div class="mission-card accent" @click="$router.push('/student/ai/chat')">
          <div class="card-header">
            <span class="tag warning">AI 助手</span>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </div>
          <div class="card-content">
            <div class="big-icon"><el-icon><ChatLineRound /></el-icon></div>
            <div class="text-content">
              <h3>AI 导师</h3>
              <p>遇到难题？随时向我提问</p>
            </div>
          </div>
          <div class="online-status">
            <span class="dot"></span> 在线
          </div>
        </div>
      </div>
    </div>

    <!-- 学习概览 -->
    <div class="learning-overview animate__animated animate__fadeInUp animate__delay-1s">
      <div class="overview-card">
        <h3>学习能力雷达</h3>
        <div class="radar-container">
          <div ref="radarChartRef" class="radar-chart"></div>
        </div>
      </div>

      <div class="overview-card">
        <h3>推荐案例</h3>
        <div class="recommend-list" v-if="recommendedCases.length > 0">
          <div class="recommend-item" v-for="item in recommendedCases" :key="item.id" @click="$router.push('/student/task-pool')">
            <div class="item-icon">
              <el-icon><Collection /></el-icon>
            </div>
            <div class="item-info">
              <h4>{{ item.caseName }}</h4>
              <p class="meta-row">
                <span>难度: </span>
                <span class="stars">
                  <el-icon v-for="n in item.difficultyLevel" :key="n"><StarFilled /></el-icon>
                </span>
                <span> • 预计 {{ item.estimatedHours }} 小时</span>
              </p>
            </div>
            <el-button circle size="small" @click.stop="$router.push('/student/task-pool')"><el-icon><Plus /></el-icon></el-button>
          </div>
        </div>
        <el-empty v-else description="暂无推荐案例" :image-size="60" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { 
  Compass, ArrowRight, Cpu, Trophy, ChatLineRound, Collection, Plus, Lightning, StarFilled, Connection, Document
} from '@element-plus/icons-vue'
import { getStudentDashboard } from '@/api/student/statistics'

const router = useRouter()
const radarChartRef = ref(null)
let radarChart = null

const username = ref(localStorage.getItem('realName') || localStorage.getItem('username') || '同学')
const studentLevel = computed(() => Math.floor(studentStats.value.completedTasks / 5) + 1)
const currentXP = computed(() => studentStats.value.completedTasks * 100)
const nextLevelXP = computed(() => studentLevel.value * 500)

// 学习毅力转换为连续学习天数显示（近似值）
const loginStreak = computed(() => {
  const persistence = studentStats.value.radarData?.learningPersistence || 0
  return Math.round(persistence / 14) || 1
})

const studentStats = ref({
  totalTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0,
  notStartedTasks: 0,
  averageScore: 0,
  gradedTaskCount: 0,
  radarData: {
    knowledgeMastery: 0,
    taskProgress: 0,
    experienceAccumulation: 0,
    learningPersistence: 0,
    aiCollaboration: 0
  }
})

const recommendedCases = ref([])

const completionRate = computed(() => {
  if (studentStats.value.totalTasks === 0) return 0
  return Math.round((studentStats.value.completedTasks / studentStats.value.totalTasks) * 100)
})

const loadStats = async () => {
  try {
    const statsRes = await getStudentDashboard()
    
    if (statsRes.code === 200) {
      studentStats.value = {
        ...studentStats.value,
        ...statsRes.data
      }
      
      // 使用后端返回的推荐案例
      if (statsRes.data.recommendedCases) {
        recommendedCases.value = statsRes.data.recommendedCases
      }
      
      initRadarChart()
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
}

const getDifficultyLabel = (level) => {
  const map = { 1: '入门', 2: '进阶', 3: '挑战' }
  return map[level] || '未知'
}

const initRadarChart = () => {
  if (!radarChartRef.value) return
  
  // 如果实例已存在，先销毁
  if (radarChart) {
    radarChart.dispose()
  }

  radarChart = echarts.init(radarChartRef.value)
  
  // 使用后端返回的真实雷达图数据
  const radarData = studentStats.value.radarData || {}
  const scores = [
    radarData.knowledgeMastery || 0,      // 知识掌握
    radarData.taskProgress || 0,           // 任务进度
    radarData.experienceAccumulation || 0, // 经验积累
    radarData.learningPersistence || 0,    // 学习毅力
    radarData.aiCollaboration || 0         // AI协作力
  ]

  const option = {
    color: ['#6366f1'],
    tooltip: {
      trigger: 'item'
    },
    radar: {
      alignTicks: false,
      indicator: [
        { name: '知识掌握', max: 100 },
        { name: '任务进度', max: 100 },
        { name: '经验积累', max: 100 },
        { name: '学习毅力', max: 100 },
        { name: 'AI协作力', max: 100 }
      ],
      radius: '65%',
      center: ['50%', '50%'],
      splitNumber: 5,
      axisName: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: 600
      },
      splitArea: {
        areaStyle: {
          color: ['#f1f5f9', '#f8fafc', '#f1f5f9', '#f8fafc'],
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowBlur: 10
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(99, 102, 241, 0.2)'
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(99, 102, 241, 0.2)'
        }
      }
    },
    series: [
      {
        name: '能力分析',
        type: 'radar',
        data: [
          {
            value: scores,
            name: '当前能力值',
            symbol: 'circle',
            symbolSize: 6,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(99, 102, 241, 0.5)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.1)' }
              ])
            },
            lineStyle: {
              width: 2,
              color: '#6366f1'
            },
            itemStyle: {
              color: '#6366f1',
              borderColor: '#fff',
              borderWidth: 2
            }
          }
        ]
      }
    ]
  }

  radarChart.setOption(option)
}

// 监听窗口大小变化
const handleResize = () => {
  radarChart && radarChart.resize()
}

onMounted(() => {
  loadStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (radarChart) {
    radarChart.dispose()
  }
})
</script>

<style scoped lang="scss">
.student-dashboard {
  padding: 24px;
  width: 100%;
  max-width: 100%;
  color: #312e81;
  box-sizing: border-box;
}

/* 游戏化横幅 */
.gamified-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px 24px;
  color: #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  .banner-bg {
    display: none;
  }

  .user-profile {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 16px;

    .avatar-ring {
      position: relative;
      width: 56px; height: 56px;
      
      .avatar-inner {
        width: 100%; height: 100%;
        background: #f1f5f9;
        border-radius: 50%;
        border: 2px solid #fff;
        overflow: hidden;
        img { width: 100%; height: 100%; object-fit: cover; }
      }
      
      .level-badge {
        position: absolute;
        bottom: -4px; right: -6px;
        background: #f59e0b;
        color: white;
        font-size: 10px; font-weight: 700;
        padding: 1px 6px;
        border-radius: 8px;
        border: 2px solid #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
    }

    .user-info {
      .greeting { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; color: #1e293b; }
      
      .xp-bar-container {
        width: 200px;
        .xp-info {
          display: flex; justify-content: space-between;
          font-size: 11px; color: #64748b; margin-bottom: 3px;
        }
        .xp-track {
          height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;
          .xp-fill {
            height: 100%; background: #6366f1;
            border-radius: 3px;
            transition: width 1s ease-out;
          }
        }
      }
    }
  }

  .daily-streak {
    position: relative; z-index: 1;
    background: #f8fafc;
    padding: 8px 16px;
    border-radius: 12px;
    display: flex; align-items: center; gap: 10px;
    border: 1px solid #f1f5f9;

    .streak-icon { font-size: 18px; color: #f59e0b; }
    .streak-info {
      .count { font-size: 16px; font-weight: 700; line-height: 1; color: #1e293b; }
      .label { font-size: 11px; color: #64748b; margin-top: 2px; }
    }
  }
}

/* 任务控制台 */
.mission-control {
  margin-bottom: 24px;

  .section-header {
    display: flex; align-items: baseline; gap: 10px;
    margin-bottom: 16px;
    h2 { font-size: 18px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 6px; color: #1e293b; }
    .subtitle { color: #64748b; font-size: 13px; }
  }

  .mission-cards {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;

    .mission-card {
      background: white;
      border-radius: 16px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid #e2e8f0;
      position: relative;
      overflow: hidden;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        border-color: #cbd5e1;
      }

      .card-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 12px;
        .tag {
          font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px;
          background: #f1f5f9; color: #475569;
          &.success { background: #f0fdf4; color: #16a34a; }
          &.warning { background: #fff7ed; color: #ea580c; }
        }
        .arrow { color: #cbd5e1; font-size: 14px; transition: transform 0.2s; }
      }

      &:hover .arrow { transform: translateX(2px); }

      .card-content {
        margin-bottom: 12px;
        display: flex;
        align-items: flex-start;
        gap: 12px;

        .big-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
        }
        
        .text-content {
          h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px 0; color: #1e293b; }
          p { font-size: 12px; color: #64748b; margin: 0; line-height: 1.4; }
        }
      }

      &.primary {
        .big-icon { background: #eff6ff; color: #3b82f6; }
      }
      &.secondary {
        .big-icon { background: #f0fdf4; color: #10b981; }
      }
      &.accent {
        .big-icon { background: #fff7ed; color: #f59e0b; }
      }

      .progress-mini {
        display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; color: #3b82f6;
      }
      .stats-mini { font-size: 12px; color: #10b981; font-weight: 500; }
      .online-status { 
        font-size: 12px; color: #f59e0b; font-weight: 500; display: flex; align-items: center; gap: 4px;
        .dot { width: 6px; height: 6px; background: #f59e0b; border-radius: 50%; }
      }
    }
  }
}

/* 学习概览 */
.learning-overview {
  display: grid; grid-template-columns: 1fr 2fr; gap: 16px;

  .overview-card {
    background: white;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;

    h3 { font-size: 15px; font-weight: 600; margin: 0 0 16px 0; color: #1e293b; }
  }

  .radar-container {
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .radar-chart {
      width: 100%;
      height: 100%;
    }
  }

  .recommend-list {
    display: flex; flex-direction: column; gap: 12px;
    
    .recommend-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px; border-radius: 8px;
      transition: background 0.2s;
      cursor: pointer;
      border: 1px solid transparent;

      &:hover { 
        background: #f8fafc; 
        border-color: #f1f5f9;
      }

      .item-icon {
        width: 32px; height: 32px; background: #f1f5f9; color: #64748b;
        border-radius: 8px; display: flex; align-items: center; justify-content: center;
        font-size: 16px;
      }
      
      .item-info {
        flex: 1;
        h4 { margin: 0 0 2px 0; font-size: 13px; color: #334155; font-weight: 500; }
        .meta-row { 
          margin: 0; font-size: 11px; color: #94a3b8; display: flex; align-items: center;
          .stars { color: #fbbf24; display: flex; align-items: center; margin: 0 4px; font-size: 10px; }
        }
      }
    }
  }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
