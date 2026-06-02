import { createRouter, createWebHistory } from 'vue-router'
import { getAuthRole, getAuthToken } from '@/utils/authStorage'

const routes = [
  {
    path: '/',
    redirect: '/admin/login',
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../views/admin/Login.vue'),
  },
  {
    path: '/admin',
    name: 'AdminLayout',
    redirect: '/admin/dashboard',
    component: () => import('../views/admin/Layout.vue'),
    meta: { requiresAuth: true, role: 'ADMIN' },
    children: [
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: () => import('../views/admin/Dashboard.vue'),
        meta: { title: '控制台' },
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/UserManagement.vue'),
        meta: { title: '学生管理' },
      },
      {
        path: 'teachers',
        name: 'AdminTeachers',
        component: () => import('../views/admin/TeacherManagement.vue'),
        meta: { title: '教师管理' },
      },
      {
        path: 'courses',
        name: 'AdminCourses',
        component: () => import('../views/admin/CourseManagement.vue'),
        meta: { title: '课程管理' },
      },
      {
        path: 'classes',
        name: 'AdminClasses',
        component: () => import('../views/admin/ClassManagement.vue'),
        meta: { title: '班级管理' },
      },
      {
        path: 'logs',
        name: 'AdminLogs',
        component: () => import('../views/admin/OperationLog.vue'),
        meta: { title: '操作日志' },
      },
      {
        path: 'monitor',
        name: 'AdminMonitor',
        component: () => import('../views/admin/Monitor.vue'),
        meta: { title: '系统监控' },
      },
      {
        path: 'token-usage',
        name: 'AdminTokenUsage',
        component: () => import('../views/admin/TokenUsage.vue'),
        meta: { title: 'DeepSeek 用量' },
      },
      {
        path: 'system',
        name: 'AdminSystemConfig',
        component: () => import('../views/admin/SystemConfig.vue'),
        meta: { title: '系统配置' },
      },
      {
        path: 'profile',
        name: 'AdminProfile',
        component: () => import('../views/admin/Profile.vue'),
        meta: { title: '个人资料' },
      },
      {
        path: 'change-password',
        name: 'AdminChangePassword',
        component: () => import('../views/admin/ChangePassword.vue'),
        meta: { title: '修改密码' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory('/'),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = getAuthToken('ADMIN')
  const userRole = getAuthRole('ADMIN')

  if (to.meta.requiresAuth && !token) {
    next('/admin/login')
  } else if (to.meta.role && userRole !== to.meta.role) {
    next('/admin/login')
  } else {
    next()
  }
})

export default router
