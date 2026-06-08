<template>
  <section ref="hostRef" class="invoice-pdf-reorder-host"></section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { getBackendBaseUrl } from '../../shared/api/backendClient'
import originalIndexHtml from './original-index.html?raw'

const API_PREFIX = '/api/it-invoice-pdf-reorder'

const hostRef = ref<HTMLElement | null>(null)
let shadowRootRef: ShadowRoot | null = null

onMounted(async () => {
  await nextTick()
  const host = hostRef.value
  if (!host) return

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  shadowRootRef = shadowRoot

  const original = splitOriginalHtml(originalIndexHtml)
  shadowRoot.innerHTML = [
    `<style>${adaptOriginalStyle(original.style)}</style>`,
    `<div class="original-document">${original.body}</div>`,
  ].join('\n')

  const apiBaseInput = shadowRoot.getElementById('apiBase') as HTMLInputElement | null
  if (apiBaseInput) {
    apiBaseInput.value = await getBackendBaseUrl()
  }

  runOriginalScript(shadowRoot, adaptOriginalScript(original.script))
  installQuickModeToggle(shadowRoot)
})

onBeforeUnmount(() => {
  if (shadowRootRef) {
    shadowRootRef.innerHTML = ''
  }
  shadowRootRef = null
})

interface OriginalHtmlParts {
  style: string
  body: string
  script: string
}

interface DocumentShim {
  body: HTMLElement
  getElementById: (id: string) => HTMLElement | null
  querySelector: (selector: string) => Element | null
  querySelectorAll: (selector: string) => NodeListOf<Element>
  createElement: typeof document.createElement
  addEventListener: typeof document.addEventListener
  removeEventListener: typeof document.removeEventListener
}

function splitOriginalHtml(html: string): OriginalHtmlParts {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i)
  const bodyMatch = html.match(/<body>([\s\S]*?)<script>/i)
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i)

  return {
    style: styleMatch?.[1] ?? '',
    body: bodyMatch?.[1] ?? '',
    script: scriptMatch?.[1] ?? '',
  }
}

function adaptOriginalStyle(style: string): string {
  return [
    ':host { display: block; min-height: 100%; }',
    style
      .replace(/:root\s*\{/g, ':host {')
      .replace(/body\s*\{/g, '.original-document {'),
    '.original-document { border-radius: 10px; overflow: hidden; }',
    '.original-document .app { padding-bottom: 22px; }',
    '.original-document .quick-mode.is-collapsed .card { display: none; }',
    '.original-document .quick-mode.is-collapsed .quick-header { margin-bottom: 0; }',
    '.original-document .quick-mode-toggle { margin-left: auto; }',
  ].join('\n')
}

function adaptOriginalScript(script: string): string {
  const apiFunctionPattern = /function api\(path\)\s*\{[\s\S]*?return `\$\{base\}\$\{path\}`;\s*\}/
  const apiFunction = `
function api(path) {
      const base = document.getElementById('apiBase').value.replace(/\\/+$/, '');
      const rawPath = String(path || '');
      const normalizedPath = rawPath.startsWith('${API_PREFIX}')
        ? rawPath
        : rawPath.startsWith('/api/')
          ? '${API_PREFIX}' + rawPath.slice(4)
          : rawPath;
      return \`\${base}\${normalizedPath}\`;
    }`

  return script.replace(apiFunctionPattern, apiFunction)
}

function runOriginalScript(shadowRoot: ShadowRoot, script: string): void {
  const originalDocument = shadowRoot.querySelector('.original-document') as HTMLElement | null
  if (!originalDocument) return

  const documentShim: DocumentShim = {
    body: originalDocument,
    getElementById: (id: string) => shadowRoot.getElementById(id),
    querySelector: (selector: string) => shadowRoot.querySelector(selector),
    querySelectorAll: (selector: string) => shadowRoot.querySelectorAll(selector),
    createElement: document.createElement.bind(document),
    addEventListener: shadowRoot.addEventListener.bind(shadowRoot) as typeof document.addEventListener,
    removeEventListener: shadowRoot.removeEventListener.bind(shadowRoot) as typeof document.removeEventListener,
  }

  const windowShim = {
    ...window,
    open: window.open.bind(window),
    print: () => printShadowSummary(shadowRoot),
  }

  const execute = new Function(
    'document',
    'window',
    'navigator',
    'DataTransfer',
    'Blob',
    'URL',
    'setTimeout',
    script,
  )

  execute(
    documentShim,
    windowShim,
    navigator,
    DataTransfer,
    Blob,
    URL,
    window.setTimeout.bind(window),
  )
}

function installQuickModeToggle(shadowRoot: ShadowRoot): void {
  const quickMode = shadowRoot.querySelector('.quick-mode') as HTMLElement | null
  const quickHeader = quickMode?.querySelector('.quick-header') as HTMLElement | null
  if (!quickMode || !quickHeader || quickHeader.querySelector('.quick-mode-toggle')) {
    return
  }

  const toggleButton = document.createElement('button')
  toggleButton.className = 'btn quick-mode-toggle'
  toggleButton.type = 'button'

  const setExpanded = (expanded: boolean): void => {
    quickMode.classList.toggle('is-collapsed', !expanded)
    toggleButton.textContent = expanded ? '收起快捷模式' : '展开快捷模式'
    toggleButton.setAttribute('aria-expanded', String(expanded))
  }

  toggleButton.addEventListener('click', () => {
    setExpanded(quickMode.classList.contains('is-collapsed'))
  })

  quickHeader.appendChild(toggleButton)
  setExpanded(false)
}

function printShadowSummary(shadowRoot: ShadowRoot): void {
  const printArea = shadowRoot.getElementById('wbPrintArea')
  if (!printArea) {
    window.print()
    return
  }

  const popup = window.open('', '_blank')
  if (!popup) {
    window.print()
    return
  }

  popup.document.write(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PO 搜索结果摘要</title></head><body><div id="wbPrintArea">${printArea.innerHTML}</div></body></html>`,
  )
  popup.document.close()
  popup.focus()
  popup.print()
  popup.close()
}
</script>

<style scoped>
.invoice-pdf-reorder-host {
  display: block;
  min-height: calc(100vh - 150px);
}
</style>
