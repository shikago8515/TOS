import { request } from '@/utils/request'

export function getPublicSystemBranding() {
  return request.get('/public/system/branding')
}
