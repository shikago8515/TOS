import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const role = (env.VITE_APP_ROLE || 'teacher').toLowerCase()

  const roleBase = {
    teacher: '/teacher/',
    student: '/student/',
    admin: '/admin/',
  }

  const rolePort = {
    teacher: 5173,
    student: 5174,
    admin: 5175,
  }

  // 确保 HTML 中的 %VITE_APP_ROLE% 有默认值
  process.env.VITE_APP_ROLE = role

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: roleBase[role] || '/teacher/',
    server: {
      port: rolePort[role] || 5173,
      open: `/index.html`,
      proxy: {
        '/api': {
          target: 'http://localhost:8080/training-system',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, '/api'),
        },
        '/profile': {
          target: 'http://localhost:8080/training-system',
          changeOrigin: true,
        },
        '/common': {
          target: 'http://localhost:8080/training-system',
          changeOrigin: true,
        },
        '/ai': {
          target: 'http://localhost:8080/training-system',
          changeOrigin: true,
        },
      },
    },
    define: {
      __APP_ROLE__: JSON.stringify(role.toUpperCase()),
    },
  }
})
