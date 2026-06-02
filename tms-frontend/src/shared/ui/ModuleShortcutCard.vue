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
  'browser-plugins': 'plug',
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
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid transparent;
  border-radius: 12px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.22s ease;
  animation: shortcutIn 0.35s ease-out both;
}

.shortcut:hover {
  background: #ffffff;
  border-color: #99f6e4;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transform: translateY(-2px);
}

.shortcut:hover .shortcut__arrow {
  opacity: 1;
  transform: translateX(0);
  color: #0d9488;
}

.shortcut__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 17px;
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

.shortcut:hover .shortcut__icon {
  transform: scale(1.08);
}

.shortcut__icon--teal { background: linear-gradient(135deg, #2dd4bf, #0d9488); }
.shortcut__icon--blue { background: linear-gradient(135deg, #60a5fa, #2563eb); }
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
  color: #1e293b;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut__stage {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 1px;
}

.shortcut__arrow {
  font-size: 14px;
  color: #cbd5e1;
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.22s ease;
  flex-shrink: 0;
}

@keyframes shortcutIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
