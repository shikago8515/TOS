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
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(14, 165, 233, .18);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(240, 249, 255, .95), rgba(236, 253, 245, .85)),
    #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, .04);
  min-height: 0;

  // left icon area
  :deep(.app-icon) {
    width: 22px;
    height: 22px;
    padding: 4px;
    border-radius: 8px;
    color: #0284c7;
    background: rgba(14, 165, 233, .12);
    flex: 0 0 auto;
  }
}

.automation-startup-progress__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-width: 0;
}

.automation-startup-progress__title {
  display: flex;
  align-items: center;
  gap: 6px;

  strong {
    color: #0f172a;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  p {
    display: none; // moved to meta area
  }
}

.automation-startup-progress__percent {
  display: none; // percentage shown as a thin chip instead
}

// Compact progress bar
.automation-startup-progress__bar {
  flex: 1;
  height: 4px;
  min-width: 60px;
  max-width: 120px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(14, 165, 233, .12);

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #0ea5e9, #14b8a6);
    transition: width .4s ease;
  }
}

// Meta row: step label + elapsed time, in the middle
.automation-startup-progress__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  flex: 0 0 auto;

  // Show the detail text here (first child is current-step-label, second is elapsed)
  span:first-child {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// Steps: inline pil-style indicators
.automation-startup-progress__steps {
  display: flex;
  align-items: center;
  gap: 2px;
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 0 0 auto;

  li {
    display: inline-flex;
    align-items: center;
    font-size: 0; // hide text, only show dot
    position: relative;

    em {
      display: none;
    }

    span {
      display: block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #d1d5db;
      transition: all .3s ease;
    }

    // connector line between steps
    & + li::before {
      content: '';
      display: block;
      width: 8px;
      height: 2px;
      background: #e5e7eb;
      margin: 0 1px;
    }

    &.is-done {
      span {
        background: #059669;
      }
      & + li::before {
        background: #059669;
      }
    }

    &.is-active {
      span {
        width: 8px;
        height: 8px;
        background: #0284c7;
        box-shadow: 0 0 0 4px rgba(14, 165, 233, .15);
      }
      & + li::before {
        background: #0284c7;
      }
    }
  }
}

// dark mode
html.dark .automation-startup-progress {
  border-color: rgba(45, 212, 191, .2);
  background:
    linear-gradient(135deg, rgba(15, 23, 42, .92), rgba(17, 24, 39, .88)),
    #111827;
  box-shadow: 0 2px 8px rgba(0, 0, 0, .2);
}

html.dark .automation-startup-progress__title strong {
  color: #e5e7eb;
}

html.dark .automation-startup-progress__meta {
  color: #94a3b8;
}

html.dark .automation-startup-progress__steps li {
  span {
    background: #4b5563;
  }
  & + li::before {
    background: #374151;
  }
  &.is-done {
    span { background: #34d399; }
    & + li::before { background: #34d399; }
  }
  &.is-active {
    span { background: #38bdf8; }
    & + li::before { background: #38bdf8; }
  }
}
</style>
