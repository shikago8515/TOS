<template>
  <section class="automation-startup-progress">
    <div class="automation-startup-progress__head">
      <div class="automation-startup-progress__title">
        <AppIcon name="activity" />
        <div>
          <strong>{{ text(title) }}</strong>
          <p>{{ text(detail) }}</p>
        </div>
      </div>
      <span class="automation-startup-progress__percent">{{ normalizedPercent }}%</span>
    </div>

    <div
      class="automation-startup-progress__bar"
      role="progressbar"
      :aria-valuenow="normalizedPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span :style="{ width: `${normalizedPercent}%` }" />
    </div>

    <div class="automation-startup-progress__meta">
      <span>{{ text(currentStepLabel) }}</span>
      <span>{{ text('已等待') }} {{ elapsedSeconds }}s</span>
    </div>

    <ol class="automation-startup-progress__steps">
      <li
        v-for="step in steps"
        :key="step.key"
        :class="stepClass(step.key)"
      >
        <span />
        <em>{{ text(step.label) }}</em>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

type AutomationStartupProgressStep = {
  key: string
  label: string
}

const props = defineProps<{
  title: string
  detail: string
  percent: number
  elapsedSeconds: number
  currentStepLabel: string
  activeStepKey: string
  completedStepKeys: string[]
  steps: AutomationStartupProgressStep[]
}>()

const { text } = useAppLanguage()

const normalizedPercent = computed(() => Math.min(Math.max(Math.round(Number(props.percent || 0)), 0), 100))

function stepClass(stepKey: string): string {
  if (props.completedStepKeys.includes(stepKey)) return 'is-done'
  if (props.activeStepKey === stepKey) return 'is-active'
  return ''
}
</script>

<style scoped lang="scss">
.automation-startup-progress {
  padding: 12px 14px;
  border: 1px solid rgba(14, 165, 233, .2);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(240, 249, 255, .96), rgba(236, 253, 245, .9)),
    #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
}

.automation-startup-progress__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.automation-startup-progress__title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;

  :deep(.app-icon) {
    width: 28px;
    height: 28px;
    padding: 6px;
    border-radius: 10px;
    color: #0284c7;
    background: rgba(14, 165, 233, .12);
    flex: 0 0 auto;
  }

  strong {
    display: block;
    margin: 1px 0 3px;
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
  }
}

.automation-startup-progress__percent {
  color: #0284c7;
  font-size: 16px;
  font-weight: 900;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.automation-startup-progress__bar {
  height: 7px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(14, 165, 233, .13);

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #0ea5e9, #14b8a6);
    transition: width .35s ease;
  }
}

.automation-startup-progress__meta,
.automation-startup-progress__steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  color: #64748b;
  font-size: 11px;
}

.automation-startup-progress__meta {
  justify-content: space-between;
}

.automation-startup-progress__steps {
  flex-wrap: wrap;
  list-style: none;
  padding: 0;
}

.automation-startup-progress__steps li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #94a3b8;

  span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
  }

  em {
    font-style: normal;
  }

  &.is-active {
    color: #0284c7;

    span {
      box-shadow: 0 0 0 5px rgba(14, 165, 233, .14);
    }
  }

  &.is-done {
    color: #059669;
  }
}

html.dark .automation-startup-progress {
  border-color: rgba(45, 212, 191, .24);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, .94), rgba(17, 24, 39, .9)),
    #111827;
}

html.dark .automation-startup-progress__title strong {
  color: #e5e7eb;
}

html.dark .automation-startup-progress__title p,
html.dark .automation-startup-progress__meta,
html.dark .automation-startup-progress__steps {
  color: #94a3b8;
}
</style>
