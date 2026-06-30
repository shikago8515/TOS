<template>
  <div class="home-metrics">
    <el-card
      v-for="(metric, index) in metrics"
      :key="metric.key"
      class="hd-metric-card"
      shadow="never"
      :data-tone="metric.tone"
      :style="{ animationDelay: `${index * 0.06}s` }"
    >
      <div class="hd-metric-card__body">
        <div class="hd-metric-card__text">
          <span class="hd-metric-label">{{ metric.label }}</span>
          <strong class="hd-metric-value">{{ metric.value }}</strong>
          <span class="hd-metric-detail">{{ metric.detail }}</span>
        </div>
        <div class="hd-metric-card__icon flex-center" :data-tone="metric.tone">
          <el-icon>
            <component :is="metric.icon" />
          </el-icon>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import type { HomeMetricTile } from '../composables/useHomeDashboard'

defineProps<{
  metrics: HomeMetricTile[]
}>()
</script>
