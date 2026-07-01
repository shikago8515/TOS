<template>
  <svg
    class="app-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="iconName === 'puzzle'">
      <path d="M9 3h2a2 2 0 0 1 2 2v1.2a1.8 1.8 0 1 0 3.6 0V5a2 2 0 0 1 2-2h2v5.5a1.5 1.5 0 0 1-1.5 1.5h-1.2a1.8 1.8 0 1 0 0 3.6h1.2a1.5 1.5 0 0 1 1.5 1.5V21h-5a2 2 0 0 1-2-2v-1.2a1.8 1.8 0 1 0-3.6 0V19a2 2 0 0 1-2 2H3v-5a2 2 0 0 1 2-2h1.2a1.8 1.8 0 1 0 0-3.6H5a2 2 0 0 1-2-2V3z" />
    </template>

    <template v-else-if="iconName === 'globe-search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M4.6 8h11.8" />
      <path d="M4.6 13h11.8" />
      <path d="M10.5 4a11.6 11.6 0 0 1 0 13" />
      <path d="M10.5 4a11.6 11.6 0 0 0 0 13" />
      <path d="m16.5 16.5 4 4" />
    </template>

    <template v-else-if="iconName === 'play-circle'">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4z" />
    </template>

    <template v-else-if="iconName === 'shield-check'">
      <path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6z" />
      <path d="m9.5 12.2 1.8 1.8 3.7-4.1" />
    </template>

    <template v-else-if="iconName === 'workflow'">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.5 6h7" />
      <path d="M7.8 8 10.7 15" />
      <path d="M16.2 8 13.3 15" />
    </template>

    <template v-else-if="iconName === 'plug'">
      <path d="M9 7V3" />
      <path d="M15 7V3" />
      <path d="M8 7h8v3a4 4 0 0 1-4 4h0a4 4 0 0 1-4-4z" />
      <path d="M12 14v7" />
      <path d="M9 21h6" />
    </template>

    <template v-else-if="iconName === 'sparkles'">
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" />
      <path d="M5 17.5 6 20l2.5 1-2.5 1L5 24l-1-2.5L1.5 20 4 19z" />
      <path d="m19 14 1 2.4 2.5 1-2.5 1L19 21l-1-2.6-2.5-1 2.5-1z" />
    </template>

    <template v-else-if="iconName === 'monitor-code'">
      <rect x="3" y="4" width="18" height="12" rx="2.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="m10 9-2 1.8L10 13" />
      <path d="m14 9 2 1.8-2 2.2" />
    </template>

    <template v-else-if="iconName === 'external-link'">
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </template>

    <template v-else-if="iconName === 'stop-circle'">
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </template>

    <template v-else-if="iconName === 'trash'">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </template>

    <template v-else-if="iconName === 'bookmark'">
      <path d="M6 4h12v17l-6-3.5L6 21z" />
    </template>

    <template v-else-if="iconName === 'target'">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </template>

    <template v-else-if="iconName === 'rocket'">
      <path d="M12 4c3.5 0 6 1.8 7 5.2L14.2 14C10.8 13 9 10.5 9 7c0-1.1.2-2.1.6-3.1A9.8 9.8 0 0 1 12 4z" />
      <path d="m14.2 14 3.8 3.8" />
      <path d="M9 15 6 18l-.8-4.2L9 15z" />
      <path d="M13.5 7.5h.01" />
    </template>

    <template v-else-if="iconName === 'window'">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M7 7h.01" />
      <path d="M10 7h.01" />
      <path d="M13 7h.01" />
    </template>

    <template v-else-if="iconName === 'package'">
      <path d="m12 3 8 4.5v9L12 21 4 16.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </template>

    <template v-else-if="iconName === 'refresh'">
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18.5 11A7 7 0 0 0 6.8 6.5L5 8" />
      <path d="A7 7 0 0 0 17.2 17.5L19 16" />
    </template>

    <template v-else-if="iconName === 'activity'">
      <path d="M3 12h4l2.2-5 4.2 10 2.2-5H21" />
    </template>

    <template v-else-if="iconName === 'layers'">
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </template>

    <template v-else-if="iconName === 'chip'">
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 1v4" />
      <path d="M15 1v4" />
      <path d="M9 19v4" />
      <path d="M15 19v4" />
      <path d="M1 9h4" />
      <path d="M1 15h4" />
      <path d="M19 9h4" />
      <path d="M19 15h4" />
    </template>

    <template v-else-if="iconName === 'folder'">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </template>

    <template v-else-if="iconName === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v4.6l3 1.8" />
    </template>

    <template v-else-if="iconName === 'link'">
      <path d="M10.5 13.5 13.5 10.5" />
      <path d="M8 15a4 4 0 0 1 0-5.7l2-2a4 4 0 0 1 5.7 5.7l-.9.9" />
      <path d="M16 9a4 4 0 0 1 0 5.7l-2 2a4 4 0 0 1-5.7-5.7l.9-.9" />
    </template>

    <template v-else-if="iconName === 'browser'">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M7 6.8h.01" />
      <path d="M10 6.8h.01" />
      <path d="M13 6.8h.01" />
      <path d="M8 13h8" />
      <path d="M8 16h5" />
    </template>

    <template v-else-if="iconName === 'database'">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </template>

    <template v-else-if="iconName === 'check-circle'">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.3 2.2 2.2 4.8-5" />
    </template>

    <template v-else-if="iconName === 'alert-circle'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </template>

    <template v-else-if="iconName === 'radar'">
      <path d="M12 12 19.5 4.5" />
      <path d="M12 12a7 7 0 1 0 7 7" />
      <path d="M12 12a3.5 3.5 0 1 0 3.5 3.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="iconName === 'menu'">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </template>

    <template v-else-if="iconName === 'chevron-down'">
      <polyline points="6 9 12 15 18 9" />
    </template>

    <template v-else-if="iconName === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" />
    </template>

    <template v-else-if="iconName === 'chevron-left'">
      <polyline points="15 18 9 12 15 6" />
    </template>

    <template v-else-if="iconName === 'calendar'">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </template>

    <template v-else-if="iconName === 'panel-left-close'">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <path d="m16 15-3-3 3-3" />
    </template>

    <template v-else-if="iconName === 'panel-left-open'">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <path d="m14 9 3 3-3 3" />
    </template>

    <template v-else-if="iconName === 'download-cloud'">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m8 17 4 4 4-4" />
    </template>

    <template v-else-if="iconName === 'command'">
      <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
    </template>

    <template v-else-if="iconName === 'refresh-cw'">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </template>

    <template v-else-if="iconName === 'download'">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </template>

    <template v-else-if="iconName === 'x' || iconName === 'close'">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </template>

    <template v-else-if="iconName === 'file-search'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="10" cy="13" r="2" />
      <line x1="11.5" y1="14.5" x2="14" y2="17" />
    </template>

    <template v-else-if="iconName === 'loader'">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </template>

    <template v-else-if="iconName === 'files'">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
      <path d="M10.5 15H17M10.5 11H17M6.5 11H7.5M6.5 15H7.5" />
    </template>

    <template v-else-if="iconName === 'plus'">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </template>

    <template v-else-if="iconName === 'arrow-left'">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </template>

    <template v-else-if="iconName === 'arrow-right'">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </template>

    <template v-else-if="iconName === 'bot'">
      <rect x="3" y="3" width="18" height="14" rx="3" />
      <path d="M8 20h8" />
      <path d="M12 17v3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="iconName === 'zap'">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </template>

    <template v-else-if="iconName === 'terminal'">
      <rect x="2" y="3" width="20" height="18" rx="2.5" />
      <polyline points="6 8 10 12 6 16" />
      <line x1="13" y1="16" x2="17" y2="16" />
    </template>

    <template v-else-if="iconName === 'upload'">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </template>

    <template v-else-if="iconName === 'server'">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </template>

    <template v-else-if="iconName === 'info'">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </template>

    <template v-else-if="iconName === 'eye'">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </template>

    <template v-else-if="iconName === 'trending-up'">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </template>

    <template v-else-if="iconName === 'wifi'">
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </template>

    <template v-else-if="iconName === 'send'">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </template>

    <template v-else-if="iconName === 'bar-chart'">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="6" y1="20" x2="6" y2="4" />
      <line x1="18" y1="20" x2="18" y2="14" />
    </template>

    <template v-else-if="iconName === 'sliders'">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="10" r="2" />
      <circle cx="20" cy="14" r="2" />
    </template>

    <template v-else-if="iconName === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 0 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1z" />
    </template>

    <template v-else-if="iconName === 'globe'">
      <circle cx="12" cy="12" r="9" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </template>

    <template v-else-if="iconName === 'translate'">
      <path d="M5 5h8" />
      <path d="M9 3v2" />
      <path d="M11 5c-.8 4-3 6.8-6 8.5" />
      <path d="M6.5 8.5c1.2 2.1 3 3.8 5.5 5" />
      <path d="M14 20l4-9 4 9" />
      <path d="M15.3 17h5.4" />
    </template>

    <template v-else-if="iconName === 'code'">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </template>

    <template v-else-if="iconName === 'grid'">
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </template>

    <template v-else-if="iconName === 'bell'">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </template>

    <template v-else-if="iconName === 'user'">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </template>

    <template v-else>
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
}>()

const iconName = computed(() => props.name || 'sparkles')
</script>

<style scoped>
.app-icon {
  width: 1em;
  height: 1em;
  display: block;
  flex: 0 0 auto;
}
</style>
