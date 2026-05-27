<template>
  <RouterLink class="module-card" :to="module.path">
    <span class="module-stage" :class="`module-stage--${module.stage}`">
      {{ stageLabel }}
    </span>
    <strong>{{ moduleLabel }}</strong>
    <p>{{ moduleDescription }}</p>
    <span class="module-action">{{ t('app.module.open') }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import {
  tosModuleStageLabelsEn,
  tosModuleStageLabels,
  type TosModuleDefinition,
} from '../../domain/moduleCatalog'
import { useAppLanguage } from '../i18n/appLanguage'

const props = defineProps<{
  module: TosModuleDefinition
}>()

const { isEnglish, t } = useAppLanguage()

const stageLabel = computed(() =>
  isEnglish.value
    ? tosModuleStageLabelsEn[props.module.stage]
    : tosModuleStageLabels[props.module.stage],
)
const moduleLabel = computed(() =>
  isEnglish.value ? props.module.navLabelEn : props.module.navLabel,
)
const moduleDescription = computed(() =>
  isEnglish.value ? props.module.descriptionEn : props.module.description,
)
</script>

<style scoped>
.module-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 16px;
  min-width: 0;
  min-height: 126px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #dbe5ee;
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(23, 42, 63, 0.06);
}

.module-card:hover {
  border-color: #9dc7e8;
  box-shadow: 0 18px 38px rgba(23, 42, 63, 0.1);
}

.module-stage {
  width: fit-content;
  max-width: 100%;
  padding: 3px 8px;
  color: #5a6780;
  font-size: 12px;
  font-weight: 800;
  background: #eef3f8;
  border-radius: 6px;
}

.module-stage--production {
  color: #1f6d56;
  background: #e5f5ef;
}

.module-stage--validation {
  color: #8a6320;
  background: #fff2d4;
}

.module-stage--placeholder {
  color: #6d7480;
  background: #eef1f5;
}

strong {
  grid-column: 1 / 2;
  min-width: 0;
  color: #172033;
  font-size: 17px;
}

p {
  grid-column: 1 / -1;
  margin: 0;
  color: #657486;
  font-size: 13px;
}

.module-action {
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: center;
  justify-self: end;
  min-width: 52px;
  padding: 6px 12px;
  color: #17608f;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
  background: #eef8ff;
  border: 1px solid #c2dff1;
  border-radius: 7px;
}
</style>
