import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  clearAuthSession,
  getAuthRole,
  getAuthToken,
  getAuthUserId,
  setAuthSession
} from '@/utils/authStorage'

export const useUserStore = defineStore('user', () => {
  const token = ref(getAuthToken() || '')
  const role = ref(getAuthRole() || '')
  const userId = ref(getAuthUserId() || '')
  const userInfo = ref(null)

  function setToken(newToken) {
    token.value = newToken
    setAuthSession({ token: newToken })
  }

  function setRole(newRole) {
    role.value = newRole
    setAuthSession({ role: newRole }, newRole)
  }

  function setUserId(id) {
    userId.value = id
    setAuthSession({ userId: id })
  }

  function setUserInfo(info) {
    userInfo.value = info
  }

  function logout() {
    token.value = ''
    role.value = ''
    userId.value = ''
    userInfo.value = null
    clearAuthSession()
  }

  return {
    token,
    role,
    userId,
    userInfo,
    setToken,
    setRole,
    setUserId,
    setUserInfo,
    logout,
  }
})
