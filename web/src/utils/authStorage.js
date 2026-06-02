const ROLE_BY_PATH = {
  '/teacher': 'TEACHER',
  '/student': 'STUDENT',
  '/admin': 'ADMIN'
}

function detectRoleByPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/student')) return 'STUDENT'
  if (pathname.startsWith('/admin')) return 'ADMIN'
  if (pathname.startsWith('/teacher')) return 'TEACHER'
  return null
}

export function resolveCurrentRole() {
  const byPath = detectRoleByPath()
  if (byPath) return byPath

  const byEnv = (import.meta.env.VITE_APP_ROLE || '').toUpperCase()
  if (['TEACHER', 'STUDENT', 'ADMIN'].includes(byEnv)) return byEnv

  return 'TEACHER'
}

export function getAuthStorageKey(role = resolveCurrentRole()) {
  return `auth:${role}`
}

export function getAuthSession(role = resolveCurrentRole()) {
  const raw = localStorage.getItem(getAuthStorageKey(role))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function setAuthSession(data, role = resolveCurrentRole()) {
  const current = getAuthSession(role) || {}
  const next = { ...current, ...data, role }
  localStorage.setItem(getAuthStorageKey(role), JSON.stringify(next))

  if (next.token) localStorage.setItem('token', next.token)
  if (next.userId !== undefined && next.userId !== null) localStorage.setItem('userId', String(next.userId))
  if (next.role) localStorage.setItem('userRole', next.role)
  if (next.realName) localStorage.setItem('realName', next.realName)
  if (next.roleName) localStorage.setItem('roleName', next.roleName)

  return next
}

export function clearAuthSession(role = resolveCurrentRole()) {
  const session = getAuthSession(role)
  localStorage.removeItem(getAuthStorageKey(role))

  const currentToken = localStorage.getItem('token')
  const currentUserId = localStorage.getItem('userId')
  const currentRole = localStorage.getItem('userRole')

  if (!session || session.token === currentToken) {
    localStorage.removeItem('token')
  }
  if (!session || String(session.userId || '') === String(currentUserId || '')) {
    localStorage.removeItem('userId')
  }
  if (!session || session.role === currentRole) {
    localStorage.removeItem('userRole')
  }
}

export function getAuthToken(role = resolveCurrentRole()) {
  const session = getAuthSession(role)
  return session?.token || ''
}

export function getAuthUserId(role = resolveCurrentRole()) {
  const session = getAuthSession(role)
  if (!session?.userId && session?.userId !== 0) return ''
  return String(session.userId)
}

export function getAuthRole(role = resolveCurrentRole()) {
  const session = getAuthSession(role)
  return session?.role || role
}

export function setCurrentUserRole(role) {
  localStorage.setItem('userRole', role)
}

export function getLegacyRoleByPath(pathname = window.location.pathname) {
  const key = Object.keys(ROLE_BY_PATH).find((prefix) => pathname.startsWith(prefix))
  return key ? ROLE_BY_PATH[key] : null
}
