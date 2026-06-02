<template>
  <div class="dashboard-container">
    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="time-badge">
          <div class="time-content">
            <span class="time">{{ timeStr }}</span>
            <div class="date-group">
              <span class="date">{{ dateStr }}</span>
              <span class="week">{{ weekStr }}</span>
            </div>
          </div>
        </div>
        <h2 class="welcome-title">
          {{ timeGreeting }}，{{ username }}
        </h2>
        <p class="welcome-desc">
          {{ roleName === 'TEACHER' ? '准备好开始今天的教学工作了吗？' : '今天也要加油学习哦！' }}
        </p>
      </div>
      <div class="banner-img">
        <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Laptop.png" alt="welcome" />
      </div>
    </div>

    <!-- 教师仪表板 -->
    <div v-if="roleName === 'TEACHER'" class="dashboard-content">
      <!-- 统计卡片 -->
      <el-row :gutter="24">
        <el-col :span="6">
          <div class="stat-card" @click="$router.push('/teacher/cases')">
            <div class="stat-icon blue">
              <el-icon><Folder /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ teacherStats.totalCases }}</div>
              <div class="stat-label">我的案例</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card" @click="$router.push('/teacher/tasks')">
            <div class="stat-icon green">
              <el-icon><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ teacherStats.totalTasks }}</div>
              <div class="stat-label">已发布任务</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card" @click="$router.push('/teacher/grading')">
            <div class="stat-icon orange">
              <el-icon><EditPen /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ teacherStats.pendingGradings }}</div>
              <div class="stat-label">待批改作业</div>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card cursor-default">
            <div class="stat-icon purple">
              <el-icon><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ teacherStats.totalStudents }}</div>
              <div class="stat-label">我的学生</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 快捷入口 -->
      <div class="section-title">快捷入口</div>
      <el-row :gutter="24">
        <el-col :span="6">
          <el-card shadow="hover" class="action-card" @click="$router.push('/teacher/cases/create')">
            <div class="action-content">
              <div class="action-icon blue-bg">
                <el-icon><MagicStick /></el-icon>
              </div>
              <div class="action-text">
                <h4>AI 生成案例</h4>
                <p>快速生成实训案例</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="action-card" @click="$router.push('/teacher/tasks')">
            <div class="action-content">
              <div class="action-icon green-bg">
                <el-icon><Plus /></el-icon>
              </div>
              <div class="action-text">
                <h4>发布任务</h4>
                <p>给班级分配新任务</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="action-card" @click="$router.push('/teacher/ai/chat')">
            <div class="action-content">
              <div class="action-icon purple-bg">
                <el-icon><Service /></el-icon>
              </div>
              <div class="action-text">
                <h4>AI 助教</h4>
                <p>获取教学辅助建议</p>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 学生仪表板 -->
    <div v-if="roleName === 'STUDENT'" class="dashboard-content">
      <!-- 统计卡片 -->
      <el-row :gutter="24">
        <el-col :span="8">
          <div class="stat-card" @click="$router.push('/student/tasks')">
            <div class="stat-icon blue">
              <el-icon><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ studentStats.totalTasks }}</div>
              <div class="stat-label">我的任务</div>
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card" @click="$router.push('/student/tasks')">
            <div class="stat-icon orange">
              <el-icon><Timer /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ studentStats.inProgressTasks }}</div>
              <div class="stat-label">进行中</div>
            </div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card" @click="$router.push('/student/submissions')">
            <div class="stat-icon green">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ studentStats.completedTasks }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 快捷入口 -->
      <div class="section-title">快捷入口</div>
      <el-row :gutter="24">
        <el-col :span="8">
          <el-card shadow="hover" class="action-card" @click="$router.push('/student/tasks')">
            <div class="action-content">
              <div class="action-icon blue-bg">
                <el-icon><Reading /></el-icon>
              </div>
              <div class="action-text">
                <h4>开始学习</h4>
                <p>查看并完成待办任务</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover" class="action-card" @click="$router.push('/student/ai/chat')">
            <div class="action-content">
              <div class="action-icon purple-bg">
                <el-icon><Service /></el-icon>
              </div>
              <div class="action-text">
                <h4>AI 助教</h4>
                <p>有问题随时问我</p>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover" class="action-card" @click="$router.push('/student/cases')">
            <div class="action-content">
              <div class="action-icon orange-bg">
                <el-icon><Collection /></el-icon>
              </div>
              <div class="action-text">
                <h4>案例库</h4>
                <p>浏览更多实训案例</p>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Folder, List, EditPen, User, MagicStick, Plus, Service,
  Timer, CircleCheck, Reading, Collection
} from '@element-plus/icons-vue'
import { getTeacherDashboard } from '@/api/teacher/statistics'
import { getStudentDashboard } from '@/api/student/statistics'

const router = useRouter()
const loading = ref(false)
const roleName = ref(localStorage.getItem('roleName'))
const username = ref(localStorage.getItem('username') || '同学')
const timeStr = ref('')
const dateStr = ref('')
const weekStr = ref('')
let timer = null

const updateTime = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  
  timeStr.value = `${hours}:${minutes}:${seconds}`
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

const teacherStats = ref({
  totalCases: 0,
  totalTasks: 0,
  pendingGradings: 0,
  totalStudents: 0
})

const studentStats = ref({
  totalTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0
})

// 加载教师统计数据
const loadTeacherStats = async () => {
  loading.value = true
  try {
    const res = await getTeacherDashboard()
    teacherStats.value = res.data
  } catch (error) {
    ElMessage.error(error.message || '加载统计数据失败')
  } finally {
    loading.value = false
  }
}

// 加载学生统计数据
const loadStudentStats = async () => {
  loading.value = true
  try {
    const res = await getStudentDashboard()
    studentStats.value = res.data
  } catch (error) {
    ElMessage.error(error.message || '加载统计数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  timer = setInterval(updateTime, 1000)
  if (roleName.value === 'TEACHER') {
    loadTeacherStats()
  } else if (roleName.value === 'STUDENT') {
    loadStudentStats()
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped lang="scss">
.dashboard-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.welcome-banner {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 16px;
  padding: 32px 40px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
  position: relative;
  overflow: hidden;

  .banner-content {
    z-index: 1;
    
    .time-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      animation: fadeInDown 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      }

      .time-content {
        display: flex;
        align-items: baseline;
        gap: 12px;
        
        .time {
          font-family: 'DIN Alternate', 'Oswald', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .date-group {
          display: flex;
          gap: 8px;
          font-size: 13px;
          opacity: 0.9;
          font-weight: 500;
          border-left: 1px solid rgba(255,255,255,0.3);
          padding-left: 12px;
        }
      }
    }

    .welcome-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
      animation: fadeInUp 0.8s ease-out 0.2s both;
    }
    .welcome-desc {
      font-size: 16px;
      opacity: 0.9;
      margin: 0;
      animation: fadeInUp 0.8s ease-out 0.4s both;
    }
  }

  .banner-img {
    height: 120px;
    margin-right: 20px;
    animation: float 6s ease-in-out infinite;
    
    img {
      height: 100%;
      filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));
    }
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 32px 0 16px 0;
  padding-left: 12px;
  border-left: 4px solid #3b82f6;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #f1f5f9;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.05);
    border-color: transparent;
  }

  &.cursor-default {
    cursor: default;
    &:hover {
      transform: none;
      box-shadow: none;
      border-color: #f1f5f9;
    }
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;

    &.blue { background: #eff6ff; color: #3b82f6; }
    &.green { background: #f0fdf4; color: #22c55e; }
    &.orange { background: #fff7ed; color: #f97316; }
    &.purple { background: #f5f3ff; color: #8b5cf6; }
  }

  .stat-info {
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
  }
}

.action-card {
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8fafc;

  &:hover {
    transform: translateY(-3px);
    background: white;
  }

  .action-content {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px;

    .action-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;

      &.blue-bg { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
      &.green-bg { background: linear-gradient(135deg, #4ade80, #22c55e); }
      &.purple-bg { background: linear-gradient(135deg, #a78bfa, #8b5cf6); }
      &.orange-bg { background: linear-gradient(135deg, #fb923c, #f97316); }
    }

    .action-text {
      h4 {
        margin: 0 0 4px 0;
        font-size: 16px;
        color: #1e293b;
      }
      p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
      }
    }
  }
}
</style>
