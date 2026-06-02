import { request } from '@/utils/request'

/**
 * 管理员端 - 通知 API
 */

// 获取通知列表
export function getAdminNotices(params) {
  return request.get('/admin/notices', { params })
}

// 标记单条通知已读
export function markAdminNoticeRead(noticeId) {
  return request.put(`/admin/notices/${noticeId}/read`)
}

// 全部标记已读
export function markAllAdminNoticesRead() {
  return request.put('/admin/notices/read/all')
}
