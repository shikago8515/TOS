import teacherRouter from './teacher'
import studentRouter from './student'
import adminRouter from './admin'
import { getAuthRole } from '@/utils/authStorage'

const VALID_ROLES = ['TEACHER', 'STUDENT', 'ADMIN']

function detectRoleFromPath(pathname) {
  if (pathname.startsWith('/student')) return 'STUDENT'
  if (pathname.startsWith('/admin')) return 'ADMIN'
  if (pathname.startsWith('/teacher')) return 'TEACHER'
  return null
}

function resolveRole() {
  const byPath = detectRoleFromPath(window.location.pathname)
  if (byPath) {
    return byPath
  }

  const byEnv = (import.meta.env.VITE_APP_ROLE || '').toUpperCase()
  if (VALID_ROLES.includes(byEnv)) {
    return byEnv
  }

  const byStorage = (getAuthRole() || '').toUpperCase()
  if (VALID_ROLES.includes(byStorage)) {
    return byStorage
  }

  return 'TEACHER'
}

const role = resolveRole()
const routerMap = {
  TEACHER: teacherRouter,
  STUDENT: studentRouter,
  ADMIN: adminRouter,
}

export const CURRENT_ROLE = role
export default routerMap[role] || teacherRouter
