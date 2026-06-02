import axios from 'axios'
import { ElMessage } from 'element-plus'
import {
  clearAuthSession,
  getAuthRole,
  getAuthToken,
  getAuthUserId,
  resolveCurrentRole
} from '@/utils/authStorage'

const LOGIN_PATH_BY_ROLE = {
  TEACHER: '/teacher/login',
  STUDENT: '/student/login',
  ADMIN: '/admin/login'
}

function clearAuthCache() {
  clearAuthSession(resolveCurrentRole())
}

function getLoginPath() {
  return LOGIN_PATH_BY_ROLE[resolveCurrentRole()] || '/teacher/login'
}

function isOnLoginPage(pathname) {
  return ['/login', '/teacher/login', '/student/login', '/admin/login'].includes(pathname)
}

function handleUnauthorized(message) {
  clearAuthCache()

  const loginPath = getLoginPath()
  const currentPath = window.location.pathname

  ElMessage.error(message || '未授权，请重新登录')
  if (!isOnLoginPage(currentPath)) {
    window.location.href = loginPath
  }
}

const service = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers['Content-Type']
        delete config.headers['content-type']
      }
    }

    const role = resolveCurrentRole()
    const token = getAuthToken(role)
    const userId = getAuthUserId(role)
    const userRole = getAuthRole(role)
    
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    if (userRole) {
      config.headers['userType'] = userRole
    }
    
    if (userId) {
      // 后端使用 user-id (带连字符)
      config.headers['user-id'] = userId
      // 也保留 userId (驼峰) 以兼容旧接口
      config.headers['userId'] = userId
    }
    
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    const res = response.data
    const skipErrorMessage = response.config?.skipErrorMessage
    
    // 如果是二进制数据则直接返回
    if (response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer') {
      return response
    }
    
    // 如果返回的状态码不是 200，则判断为错误
    if (res.code && res.code !== 200) {
      // 401: 未授权，需要登录（但不在登录页面上自动跳转）
      if (res.code === 401) {
        handleUnauthorized(res.message || '未授权，请重新登录')
      } else if (!skipErrorMessage) {
        ElMessage.error(res.message || '请求失败')
      }
      
      const error = new Error(res.message || '请求失败')
      error.rawResponse = res
      return Promise.reject(error)
    }
    
    return res
  },
  (error) => {
    console.error('Response error:', error)
    const skipErrorMessage = error.config?.skipErrorMessage
    
    if (error.response) {
      const status = error.response.status
      
      switch (status) {
        case 401:
          handleUnauthorized('未授权，请重新登录')
          break
        case 403:
          handleUnauthorized('没有权限访问，请重新登录')
          break
        case 404:
          if (!skipErrorMessage) ElMessage.error('请求的资源不存在')
          break
        case 413:
          if (!skipErrorMessage) ElMessage.error('上传文件过大，请检查文件大小限制')
          break
        case 500:
          if (!skipErrorMessage) ElMessage.error('服务器错误')
          break
        default:
          if (!skipErrorMessage) ElMessage.error(error.response.data?.message || '请求失败')
      }
    } else if (error.code === 'ECONNABORTED') {
      // 超时错误不弹全局提示，由调用方自行处理
      console.warn('请求超时:', error.config?.url)
    } else {
      if (!skipErrorMessage) ElMessage.error('网络错误，请检查网络连接')
    }
    
    return Promise.reject(error)
  }
)

export default service

// 导出请求方法
export const request = {
  get(url, config) {
    return service.get(url, config)
  },
  
  post(url, data, config) {
    return service.post(url, data, config)
  },
  
  put(url, data, config) {
    return service.put(url, data, config)
  },
  
  delete(url, config) {
    return service.delete(url, config)
  },
  
  upload(url, formData, config) {
    return service.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(config && config.headers ? config.headers : {})
      }
    })
  }
}
