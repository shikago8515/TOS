<template>
  <section class="home-page">
    <HomeHeroCard
      :loading="loading"
      :today-label="todayLabel"
      :last-updated-label="lastUpdatedLabel"
      @refresh="loadDashboardData"
    />

    <el-alert
      v-if="loadError"
      class="home-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="loadError"
    />

    <HomeMetricGrid :metrics="metricTiles" />

    <div class="home-main-grid">
      <HomePeoplePanel
        :people="personRows"
        :active-count="activePeopleCount"
        :format-time="formatTime"
      />
    </div>

    <div class="home-bottom-grid">
      <HomeRecentActivityPanel
        :activities="recentActivities"
        :format-time="formatTime"
        :status-tag-type="statusTagType"
      />
      <HomeRuntimePanel
        :statuses="serviceStatusRows"
        :artifacts="recentArtifacts"
        :format-time="formatTime"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAppLanguage } from '../../shared/i18n/appLanguage'
import HomeHeroCard from './components/HomeHeroCard.vue'
import HomeMetricGrid from './components/HomeMetricGrid.vue'
import HomePeoplePanel from './components/HomePeoplePanel.vue'
import HomeRecentActivityPanel from './components/HomeRecentActivityPanel.vue'
import HomeRuntimePanel from './components/HomeRuntimePanel.vue'
import { useHomeDashboard } from './composables/useHomeDashboard'

import './homeDashboard.scss'

const { isEnglish, text } = useAppLanguage()
const {
  loading,
  loadError,
  todayLabel,
  lastUpdatedLabel,
  metricTiles,
  personRows,
  activePeopleCount,
  recentActivities,
  recentArtifacts,
  serviceStatusRows,
  loadDashboardData,
  formatActivityTime,
  statusTagType,
} = useHomeDashboard()

const formatTime = computed(() => (value?: string) =>
  formatActivityTime(value, isEnglish.value, text('未知时间')),
)
</script>
