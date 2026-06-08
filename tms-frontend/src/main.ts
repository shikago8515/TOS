import { createApp } from 'vue'

import App from './App.vue'
import { router } from './app/router'
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

createApp(App).use(router).mount('#app')
