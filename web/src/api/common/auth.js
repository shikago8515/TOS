import { request } from '@/utils/request'

export function login(data) {
  return request.post('/auth/login', data)
}

export function getLoginCaptcha() {
  return request.get('/auth/login-captcha')
}

export function logout() {
  return request.post('/auth/logout')
}

export function getCurrentUser() {
  return request.get('/auth/current-user')
}

export function sendResetCode(data) {
  return request.post('/auth/forgot-password/send-code', data)
}

export function verifyResetCode(data) {
  return request.post('/auth/forgot-password/verify-code', data)
}

export function resetPassword(data) {
  return request.post('/auth/forgot-password/reset', data)
}
