import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { router } from './app/router'
import { i18n } from './languages'
import { installAppAlertBridge } from './shared/ui/appAlert'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/nprogress.scss'
import './styles/base.css'

function isFileDragEvent(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

function guardWindowFileDrop(event: DragEvent): void {
  if (!isFileDragEvent(event)) return
  event.preventDefault()

  if (event.type === 'dragover' && event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

window.addEventListener('dragenter', guardWindowFileDrop, true)
window.addEventListener('dragover', guardWindowFileDrop, true)
window.addEventListener('drop', guardWindowFileDrop, true)

installAppAlertBridge()

const app = createApp(App)

for (const [iconName, iconComponent] of Object.entries(ElementPlusIconsVue)) {
  app.component(iconName, iconComponent)
}

app.use(createPinia()).use(i18n).use(router).use(ElementPlus).mount('#app')
