import { request } from '@/utils/request'

export function login(data) {
  return request.post('/user/login', data)
}

export function getUserInfo() {
  return request.get('/user/info')
}

export function logout() {
  return request.post('/auth/logout')
}

export function updatePassword(data) {
  return request.put('/user/password', data)
}

export function sendEmailCode(params) {
  return request.get('/user/email/code', { params })
}

export function bindEmail(data) {
  return request.post('/user/email/bind', data)
}

export function updateUserInfo(data) {
  return request.put('/user/profile', data)
}

export function uploadAvatar(data) {
  return request.upload('/user/avatar', data)
}

export function getCreateCaseGuidePreference() {
  return request.get('/user/preferences/create-case-guide')
}

export function updateCreateCaseGuidePreference(data) {
  return request.put('/user/preferences/create-case-guide', data)
}
