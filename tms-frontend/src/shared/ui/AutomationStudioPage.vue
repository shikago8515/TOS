<template>
  <section class="studio-page" :class="`studio-page--${theme}`">
    <header class="studio-hero">
      <div class="studio-hero__copy">
        <div class="studio-hero__eyebrow">
          <span class="eyebrow-pill">{{ text(eyebrow) }}</span>
          <span class="stage-pill">{{ text(stageLabel) }}</span>
        </div>

        <h2 class="studio-hero__title">{{ text(title) }}</h2>
        <p class="studio-hero__subtitle">{{ text(subtitle) }}</p>

        <div v-if="$slots.actions" class="studio-hero__actions">
          <slot name="actions" />
        </div>
      </div>

      <div class="studio-hero__aside">
        <slot name="hero-aside">
          <div class="hero-orbits" aria-hidden="true">
            <div class="hero-orbit hero-orbit--large" />
            <div class="hero-orbit hero-orbit--medium" />
            <div class="hero-orbit hero-orbit--small" />
          </div>
        </slot>
      </div>
    </header>

    <div class="studio-banner studio-banner--stage">
      <AppIcon name="radar" />
      <span>{{ text(stageMessage) }}</span>
    </div>

    <div
      v-if="statusMessage"
      class="studio-banner"
      :class="`studio-banner--${statusTone}`"
    >
      <AppIcon :name="resolveStatusIcon(statusTone)" />
      <span>{{ text(statusMessage) }}</span>
    </div>

    <div v-if="metrics.length" class="studio-metrics">
      <article
        v-for="metric in metrics"
        :key="`${metric.label}-${metric.value}`"
        class="metric-card"
        :class="`metric-card--${metric.tone || 'sky'}`"
      >
        <div class="metric-card__icon">
          <AppIcon :name="metric.icon" />
        </div>
        <div class="metric-card__body">
          <span class="metric-card__label">{{ text(metric.label) }}</span>
          <strong class="metric-card__value">{{ text(metric.value) }}</strong>
          <p class="metric-card__detail">{{ text(metric.detail) }}</p>
        </div>
      </article>
    </div>

    <div class="studio-content">
      <slot />
    </div>

    <section v-if="notes.length" class="studio-notes">
      <div class="studio-notes__header">
        <div>
          <span class="section-eyebrow">{{ text(notesEyebrow) }}</span>
          <h3>{{ text(notesTitle) }}</h3>
        </div>
        <p v-if="notesSummary">{{ text(notesSummary) }}</p>
      </div>

      <div class="studio-note-grid">
        <article v-for="note in notes" :key="note.title" class="studio-note-card">
          <div class="studio-note-card__icon">
            <AppIcon :name="note.icon" />
          </div>
          <div class="studio-note-card__copy">
            <strong>{{ text(note.title) }}</strong>
            <p>{{ text(note.description) }}</p>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { useAppLanguage } from '../i18n/appLanguage'

interface StudioMetric {
  label: string
  value: string
  detail: string
  icon: string
  tone?: 'sky' | 'teal' | 'amber' | 'green'
}

interface StudioNote {
  title: string
  description: string
  icon: string
}

const props = withDefaults(
  defineProps<{
    theme?: 'browser' | 'console' | 'external'
    eyebrow: string
    stageLabel: string
    title: string
    subtitle: string
    stageMessage: string
    statusMessage?: string
    statusTone?: 'info' | 'success' | 'warning' | 'error'
    metrics?: StudioMetric[]
    notes?: StudioNote[]
    notesEyebrow?: string
    notesTitle?: string
    notesSummary?: string
  }>(),
  {
    theme: 'browser',
    statusMessage: '',
    statusTone: 'info',
    metrics: () => [],
    notes: () => [],
    notesEyebrow: '实操建议',
    notesTitle: '验证说明',
    notesSummary: '',
  },
)

const { text } = useAppLanguage()

function resolveStatusIcon(tone: string): string {
  if (tone === 'success') return 'check-circle'
  if (tone === 'warning') return 'alert-circle'
  if (tone === 'error') return 'alert-circle'
  return 'activity'
}
</script>

<style scoped>
.studio-page {
  --accent: #0f766e;
  --accent-soft: rgba(15, 118, 110, 0.14);
  --accent-strong: #0d9488;
  --panel-border: rgba(148, 163, 184, 0.22);
  --panel-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
  --hero-wash-a: rgba(46, 170, 158, 0.18);
  --hero-wash-b: rgba(59, 130, 246, 0.14);
  --hero-wash-c: rgba(249, 115, 22, 0.12);
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  color: #0f172a;
  font-family: 'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.studio-page--browser {
  --accent: #0f766e;
  --accent-soft: rgba(15, 118, 110, 0.15);
  --accent-strong: #0d9488;
  --hero-wash-a: rgba(45, 212, 191, 0.18);
  --hero-wash-b: rgba(56, 189, 248, 0.16);
  --hero-wash-c: rgba(249, 115, 22, 0.12);
}

.studio-page--console {
  --accent: #0369a1;
  --accent-soft: rgba(14, 116, 144, 0.15);
  --accent-strong: #0891b2;
  --hero-wash-a: rgba(14, 165, 233, 0.17);
  --hero-wash-b: rgba(20, 184, 166, 0.15);
  --hero-wash-c: rgba(245, 158, 11, 0.12);
}

.studio-page--external {
  --accent: #0f766e;
  --accent-soft: rgba(16, 185, 129, 0.16);
  --accent-strong: #059669;
  --hero-wash-a: rgba(52, 211, 153, 0.16);
  --hero-wash-b: rgba(96, 165, 250, 0.14);
  --hero-wash-c: rgba(234, 179, 8, 0.12);
}

.studio-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.9fr);
  gap: 24px;
  overflow: hidden;
  padding: 28px 30px;
  border: 1px solid var(--panel-border);
  border-radius: 26px;
  background:
    radial-gradient(circle at 0% 0%, var(--hero-wash-a), transparent 38%),
    radial-gradient(circle at 100% 0%, var(--hero-wash-b), transparent 34%),
    radial-gradient(circle at 80% 100%, var(--hero-wash-c), transparent 28%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(250, 252, 255, 0.92));
  box-shadow: var(--panel-shadow);
  animation: hero-rise 0.55s ease-out;
}

.studio-hero::after {
  content: '';
  position: absolute;
  inset: auto -12% -60% 46%;
  height: 220px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.7));
  transform: rotate(-10deg);
  pointer-events: none;
}

.studio-hero__copy,
.studio-hero__aside {
  position: relative;
  z-index: 1;
}

.studio-hero__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
}

.studio-hero__eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.eyebrow-pill,
.stage-pill {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.eyebrow-pill {
  color: var(--accent);
  background: var(--accent-soft);
}

.stage-pill {
  color: #9a3412;
  background: rgba(255, 237, 213, 0.96);
}

.studio-hero__title {
  margin: 0;
  font-size: clamp(30px, 4vw, 40px);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.studio-hero__subtitle {
  max-width: 760px;
  margin: 0;
  color: #475569;
  font-size: 15px;
  line-height: 1.8;
}

.studio-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.studio-hero__aside {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 220px;
}

.hero-orbits {
  position: relative;
  width: 100%;
  min-height: 220px;
}

.hero-orbit {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.18));
  box-shadow: 0 22px 34px rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(10px);
  animation: float-y 6.5s ease-in-out infinite;
}

.hero-orbit--large {
  inset: 16px 18px auto auto;
  width: 184px;
  height: 184px;
}

.hero-orbit--medium {
  inset: auto 120px 24px auto;
  width: 112px;
  height: 112px;
  animation-delay: -1.4s;
}

.hero-orbit--small {
  inset: 44px 180px auto auto;
  width: 64px;
  height: 64px;
  animation-delay: -2.1s;
}

.studio-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 18px;
  border-radius: 18px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 1.7;
}

.studio-banner .app-icon {
  font-size: 18px;
}

.studio-banner--stage {
  color: #9a3412;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(255, 251, 235, 0.98));
  border-color: rgba(251, 191, 36, 0.28);
}

.studio-banner--info {
  color: #0f766e;
  background: linear-gradient(135deg, rgba(240, 253, 250, 0.98), rgba(236, 253, 245, 0.98));
  border-color: rgba(45, 212, 191, 0.28);
}

.studio-banner--success {
  color: #166534;
  background: linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(236, 253, 245, 0.98));
  border-color: rgba(34, 197, 94, 0.22);
}

.studio-banner--warning {
  color: #a16207;
  background: linear-gradient(135deg, rgba(254, 252, 232, 0.98), rgba(255, 251, 235, 0.98));
  border-color: rgba(250, 204, 21, 0.28);
}

.studio-banner--error {
  color: #b91c1c;
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.98), rgba(255, 241, 242, 0.98));
  border-color: rgba(248, 113, 113, 0.24);
}

.studio-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease,
    border-color 0.24s ease;
}

.metric-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 28px rgba(15, 23, 42, 0.1);
}

.metric-card--sky:hover {
  border-color: rgba(59, 130, 246, 0.28);
}

.metric-card--teal:hover {
  border-color: rgba(13, 148, 136, 0.28);
}

.metric-card--amber:hover {
  border-color: rgba(245, 158, 11, 0.28);
}

.metric-card--green:hover {
  border-color: rgba(16, 185, 129, 0.28);
}

.metric-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  font-size: 24px;
}

.metric-card--sky .metric-card__icon {
  color: #2563eb;
  background: rgba(219, 234, 254, 0.9);
}

.metric-card--teal .metric-card__icon {
  color: #0f766e;
  background: rgba(204, 251, 241, 0.92);
}

.metric-card--amber .metric-card__icon {
  color: #b45309;
  background: rgba(254, 243, 199, 0.95);
}

.metric-card--green .metric-card__icon {
  color: #15803d;
  background: rgba(220, 252, 231, 0.95);
}

.metric-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.metric-card__label {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.metric-card__value {
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
}

.metric-card__detail {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}

.studio-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.studio-notes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.studio-notes__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
}

.studio-notes__header h3 {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.studio-notes__header p {
  max-width: 520px;
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  text-align: right;
}

.section-eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.studio-note-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.studio-note-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease;
}

.studio-note-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.08);
}

.studio-note-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 22px;
}

.studio-note-card__copy {
  min-width: 0;
}

.studio-note-card__copy strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.studio-note-card__copy p {
  margin: 7px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
}

:deep(.studio-stack) {
  display: grid;
  gap: 18px;
}

:deep(.studio-split) {
  display: grid;
  gap: 18px;
  min-height: 0;
}

:deep(.studio-panel) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  padding: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
}

:deep(.studio-panel__header) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

:deep(.studio-panel__header h3) {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

:deep(.studio-panel__copy) {
  color: #475569;
  font-size: 14px;
  line-height: 1.7;
}

:deep(.studio-panel__copy p) {
  margin: 0;
}

:deep(.studio-panel__eyebrow) {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

:deep(.studio-pill-row) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

:deep(.studio-chip) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  color: #1e293b;
  font-size: 13px;
  font-weight: 600;
  background: rgba(241, 245, 249, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

:deep(.studio-chip .app-icon) {
  font-size: 16px;
}

:deep(.studio-chip--success) {
  color: #166534;
  background: rgba(240, 253, 244, 0.96);
  border-color: rgba(34, 197, 94, 0.2);
}

:deep(.studio-chip--info) {
  color: #0f766e;
  background: rgba(240, 253, 250, 0.96);
  border-color: rgba(45, 212, 191, 0.2);
}

:deep(.studio-chip--warning) {
  color: #a16207;
  background: rgba(254, 252, 232, 0.96);
  border-color: rgba(250, 204, 21, 0.24);
}

:deep(.studio-chip--danger) {
  color: #b91c1c;
  background: rgba(254, 242, 242, 0.96);
  border-color: rgba(248, 113, 113, 0.22);
}

:deep(.studio-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    background-color 0.22s ease;
}

:deep(.studio-button .app-icon) {
  font-size: 18px;
}

:deep(.studio-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(15, 23, 42, 0.08);
}

:deep(.studio-button:disabled) {
  cursor: not-allowed;
  opacity: 0.56;
  transform: none;
  box-shadow: none;
}

:deep(.studio-button--ghost) {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.82);
}

:deep(.studio-button--ghost:hover) {
  border-color: rgba(15, 118, 110, 0.22);
  background: rgba(255, 255, 255, 0.96);
}

:deep(.studio-button--primary) {
  color: #ffffff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  box-shadow: 0 14px 22px color-mix(in srgb, var(--accent) 22%, transparent);
}

:deep(.studio-button--primary:hover) {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  box-shadow: 0 18px 28px color-mix(in srgb, var(--accent) 28%, transparent);
}

:deep(.studio-empty) {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 240px;
  padding: 28px;
  text-align: center;
  border-radius: 20px;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.96));
}

:deep(.studio-empty .app-icon) {
  font-size: 40px;
  color: var(--accent);
}

:deep(.studio-empty strong) {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

:deep(.studio-empty span) {
  max-width: 420px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
}

@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float-y {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 1180px) {
  .studio-hero,
  .studio-note-grid,
  .studio-metrics {
    grid-template-columns: 1fr;
  }

  .studio-hero__aside {
    justify-content: flex-start;
    min-height: 180px;
  }

  .studio-notes__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .studio-notes__header p {
    text-align: left;
  }
}

@media (max-width: 760px) {
  .studio-page {
    gap: 14px;
  }

  .studio-hero,
  :deep(.studio-panel) {
    padding: 20px;
    border-radius: 22px;
  }

  .studio-hero__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .hero-orbit--large {
    width: 136px;
    height: 136px;
  }

  .hero-orbit--medium {
    inset: auto 62px 18px auto;
    width: 88px;
    height: 88px;
  }

  .hero-orbit--small {
    inset: 28px 124px auto auto;
    width: 48px;
    height: 48px;
  }
}
</style>
