import { createRouter, createWebHistory } from 'vue-router'
import { getAuthRole, getAuthToken } from '@/utils/authStorage'

const routes = [
  {
    path: '/',
    redirect: '/student/login',
  },
  {
    path: '/student/login',
    name: 'StudentLogin',
    component: () => import('../views/student/Login.vue'),
  },
  {
    path: '/student',
    name: 'StudentLayout',
    redirect: '/student/dashboard',
    component: () => import('../views/student/Layout.vue'),
    meta: { requiresAuth: true, role: 'STUDENT' },
    children: [
      {
        path: 'dashboard',
        name: 'StudentDashboard',
        component: () => import('../views/student/Dashboard.vue'),
      },
      {
        path: 'tasks',
        name: 'StudentTasks',
        component: () => import('../views/student/TaskList.vue'),
      },
      {
        path: 'task-pool',
        name: 'TaskPool',
        component: () => import('../views/student/TaskPool.vue'),
        meta: { title: '任务广场' }
      },
      {
        path: 'tasks/:id',
        name: 'TaskDetail',
        component: () => import('../views/student/task-detail/index.vue'),
      },
      {
        path: 'submissions',
        name: 'SubmissionList',
        component: () => import('../views/student/SubmissionList.vue'),
      },
      {
        path: 'report',
        name: 'StudentReport',
        component: () => import('../views/student/StudentReport.vue'),
        meta: { title: '个人实训报告' }
      },
      {
        path: 'ai/chat',
        name: 'StudentAIChat',
        component: () => import('../views/student/ai-chat/index.vue'),
        meta: { title: 'AI 助教' }
      },
      {
        path: 'profile',
        name: 'StudentProfile',
        component: () => import('../views/student/Profile.vue'),
        meta: { title: '个人资料' }
      },
      {
        path: 'change-password',
        name: 'StudentChangePassword',
        component: () => import('../views/student/ChangePassword.vue'),
        meta: { title: '修改密码' }
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/'),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = getAuthToken('STUDENT')
  const userRole = getAuthRole('STUDENT')

  if (to.meta.requiresAuth && !token) {
    next('/student/login')
  } else if (to.meta.role && userRole !== to.meta.role) {
    next('/student/login')
  } else {
    next()
  }
})

export default router

