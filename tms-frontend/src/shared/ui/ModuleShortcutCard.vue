<template>
  <RouterLink
    class="shortcut"
    :to="module.path"
    :style="{ animationDelay: `${index * 50 + 250}ms` }"
  >
    <div class="shortcut__icon" :class="`shortcut__icon--${toneClass}`">
      <AppIcon :name="iconName" />
    </div>
    <div class="shortcut__body">
      <span class="shortcut__name">{{ moduleLabel }}</span>
      <span class="shortcut__stage">{{ stageLabel }}</span>
    </div>
    <AppIcon name="chevron-right" class="shortcut__arrow" />
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from './AppIcon.vue'
import {
  tosModuleStageLabels,
  tosModuleStageLabelsEn,
  type TosModuleDefinition,
} from '../../domain/moduleCatalog'
import { useAppLanguage } from '../i18n/appLanguage'

const props = withDefaults(
  defineProps<{
    module: TosModuleDefinition
    index?: number
  }>(),
  { index: 0 },
)

const { isEnglish } = useAppLanguage()

const moduleLabel = computed(() =>
  isEnglish.value ? props.module.navLabelEn : props.module.navLabel,
)

const stageLabel = computed(() =>
  isEnglish.value
    ? tosModuleStageLabelsEn[props.module.stage] || props.module.stage
    : tosModuleStageLabels[props.module.stage] || props.module.stage,
)

const iconMap: Record<string, string> = {
  jessca: 'file-search',
  'sophia-tina': 'files',
  jane: 'package',
  'jane-bom-summary': 'layers',
  'jane-bom-compare': 'shield-check',
  'jane-outbound-compare': 'check-circle',
  eric: 'database',
  'web-automation': 'workflow',
  infornexus: 'external-link',
  'adidas-materials': 'globe-search',
}

const iconName = computed(() => iconMap[props.module.id] || 'puzzle')

const toneCycle = ['teal', 'blue', 'green', 'orange'] as const
const toneClass = computed(() => toneCycle[props.index % toneCycle.length])
</script>

<style scoped>
.shortcut {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  min-height: 74px;
  background: var(--soft-bg, #f0f4f8);
  border: none;
  border-radius: var(--soft-radius-sm, 12px);
  text-decoration: none;
  cursor: pointer;
  box-shadow: var(--soft-shadow-sm, 3px 3px 8px rgba(166,180,200,0.3), -3px -3px 8px rgba(255,255,255,0.8));
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  animation: shortcutIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.shortcut:hover {
  background: var(--soft-surface, #ffffff);
  box-shadow: var(--soft-shadow-hover, 8px 8px 20px rgba(166,180,200,0.4), -8px -8px 20px rgba(255,255,255,0.9));
  transform: translateY(-3px);
}

.shortcut:active {
  box-shadow: var(--soft-shadow-pressed, inset 3px 3px 6px rgba(166,180,200,0.35), inset -3px -3px 6px rgba(255,255,255,0.85));
  transform: translateY(0);
}

.shortcut:hover .shortcut__arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--soft-accent, #0d9488);
}

.shortcut__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--soft-radius-xs, 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow:
    2px 2px 6px rgba(0, 0, 0, 0.08),
    -1px -1px 4px rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.shortcut:hover .shortcut__icon {
  transform: scale(1.1) rotate(-3deg);
}

.shortcut__icon--teal  { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.shortcut__icon--blue  { background: linear-gradient(135deg, #60a5fa, #2563eb); }
.shortcut__icon--green { background: linear-gradient(135deg, #34d399, #059669); }
.shortcut__icon--orange { background: linear-gradient(135deg, #fb923c, #ea580c); }

.shortcut__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.shortcut__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--soft-text, #1e293b);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shortcut__stage {
  font-size: 11px;
  color: var(--soft-text-muted, #94a3b8);
  margin-top: 2px;
  white-space: nowrap;
}

.shortcut__arrow {
  font-size: 14px;
  color: var(--soft-text-muted, #cbd5e1);
  opacity: 0;
  transform: translateX(-5px);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  flex-shrink: 0;
}

@keyframes shortcutIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
