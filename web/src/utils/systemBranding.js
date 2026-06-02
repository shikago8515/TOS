import { getPublicSystemBranding } from '@/api/common/system'

let brandingCache = null
let brandingPromise = null

const defaultBranding = {
  systemName: '智能实训案例生成与考核系统',
  icp: '',
  logoUrl: ''
}

function normalizeBranding(raw) {
  const data = raw || {}
  return {
    systemName: data.systemName || defaultBranding.systemName,
    icp: data.icp || '',
    logoUrl: data.logoUrl || ''
  }
}

export async function loadSystemBranding(force = false) {
  if (!force && brandingCache) {
    return brandingCache
  }
  if (!force && brandingPromise) {
    return brandingPromise
  }

  brandingPromise = getPublicSystemBranding()
    .then((res) => {
      const payload = normalizeBranding(res?.data)
      brandingCache = payload
      return payload
    })
    .catch(() => {
      brandingCache = { ...defaultBranding }
      return brandingCache
    })
    .finally(() => {
      brandingPromise = null
    })

  return brandingPromise
}

export function applyDocumentTitle(branding, suffix = '') {
  const systemName = branding?.systemName || defaultBranding.systemName
  document.title = suffix ? `${suffix} - ${systemName}` : systemName
}

export function getDefaultBranding() {
  return { ...defaultBranding }
}
