import { createRouter, createWebHistory } from 'vue-router'
import { getAuthRole, getAuthToken } from '@/utils/authStorage'

const routes = [
  {
    path: '/',
    redirect: '/teacher/login',
  },
  {
    path: '/teacher/login',
    name: 'TeacherLogin',
    component: () => import('../views/teacher/Login.vue'),
  },
  {
    path: '/teacher',
    name: 'TeacherLayout',
    redirect: '/teacher/dashboard',
    component: () => import('../views/teacher/Layout.vue'),
    meta: { requiresAuth: true, role: 'TEACHER' },
    children: [
      {
        path: 'dashboard',
        name: 'TeacherDashboard',
        component: () => import('../views/teacher/Dashboard.vue'),
      },
      {
        path: 'cases',
        name: 'CaseList',
        component: () => import('../views/teacher/CaseList/index.vue'),
      },
      {
        path: 'cases/create',
        name: 'CreateCase',
        component: () => import('../views/teacher/CreateCase/index.vue'),
      },
      {
        path: 'cases/:id',
        name: 'CaseDetail',
        component: () => import('../views/teacher/CaseDetail.vue'),
      },
      {
        path: 'cases/:id/edit',
        name: 'CaseEdit',
        component: () => import('../views/teacher/CaseEdit.vue'),
        meta: { title: '编辑案例' }
      },
      {
        path: 'workflow/design',
        name: 'WorkflowDesigner',
        component: () => import('../views/teacher/Workflow/index.vue'),
        meta: { title: '工作流编排' }
      },
      {
        path: 'courses',
        name: 'CourseManagement',
        component: () => import('../views/teacher/CourseManagement.vue'),
        meta: { title: '课程管理' }
      },
      {
        path: 'classes',
        name: 'ClassManagement',
        component: () => import('../views/teacher/ClassManagement.vue'),
        meta: { title: '班级管理' }
      },
      {
        path: 'classes/analytics',
        name: 'ClassAnalytics',
        component: () => import('../views/teacher/ClassAnalytics.vue'),
        meta: { title: '班级学情分析' }
      },
      {
        path: 'textbooks',
        name: 'TextbookManagement',
        component: () => import('../views/teacher/textbook/index.vue'),
        meta: { title: '教材管理' }
      },
      {
        path: 'templates',
        name: 'CaseTemplateLibrary',
        component: () => import('../views/teacher/TemplateLibrary/index.vue'),
        meta: { title: '案例模板库' }
      },
      {
        path: 'tasks',
        name: 'TaskManagement',
        component: () => import('../views/teacher/TaskManagement/index.vue'),
      },
      {
        path: 'grading',
        name: 'Grading',
        component: () => import('../views/teacher/Grading/index.vue'),
      },
      {
        path: 'ai/chat',
        name: 'TeacherAIChat',
        component: () => import('../views/teacher/ai/index.vue'),
        meta: { title: 'AI 助教' }
      },
      {
        path: 'ai/knowledge',
        name: 'TeacherAIKnowledge',
        component: () => import('../views/teacher/ai/KnowledgeManagement.vue'),
        meta: { title: '知识库管理' }
      },
      {
        path: 'ai/recycle',
        name: 'TeacherAIRecycle',
        component: () => import('../views/teacher/ai/RecycleBin.vue'),
        meta: { title: '回收站' }
      },
      {
        path: 'profile',
        name: 'TeacherProfile',
        component: () => import('../views/teacher/Profile.vue'),
        meta: { title: '个人资料' },
      },
      {
        path: 'change-password',
        name: 'TeacherChangePassword',
        component: () => import('../views/teacher/ChangePassword.vue'),
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
  const token = getAuthToken('TEACHER')
  const userRole = getAuthRole('TEACHER')

  if (to.meta.requiresAuth && !token) {
    next('/teacher/login')
  } else if (to.meta.role && userRole !== to.meta.role) {
    next('/teacher/login')
  } else {
    next()
  }
})

export default router

