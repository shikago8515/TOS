<template>
  <el-card class="home-panel hd-activity-panel" shadow="never">
    <template #header>
      <div class="hd-panel-head">
        <div class="hd-panel-head__left">
          <div class="hd-panel-head__icon hd-panel-head__icon--blue flex-center">
            <el-icon><List /></el-icon>
          </div>
          <div class="hd-panel-head__text">
            <h2>{{ text('最近处理') }}</h2>
            <p>{{ text('展示自动化记录和本地 Excel 处理历史。') }}</p>
          </div>
        </div>
        <RouterLink class="hd-panel-link" to="/automation-runs">
          {{ text('查看更多') }}
          <el-icon style="font-size:12px"><ArrowRight /></el-icon>
        </RouterLink>
      </div>
    </template>

    <div v-if="activities.length" class="hd-activity-timeline">
      <RouterLink
        v-for="(activity, index) in activities"
        :key="activity.id"
        :to="activity.path"
        class="hd-activity-row"
        :style="{ animationDelay: `${index * 0.04}s` }"
      >
        <div class="hd-activity-row__dot-wrap">
          <span
            class="hd-activity-row__dot"
            :class="`hd-activity-row__dot--${activity.source}`"
          >
            <el-icon>
              <component :is="activity.source === 'automation' ? Monitor : Document" />
            </el-icon>
          </span>
        </div>
        <span class="hd-activity-row__main">
          <strong>{{ activity.personLabel }} / {{ activity.moduleLabel }}</strong>
          <small>{{ activity.message || activity.sourceLabel }}</small>
        </span>
        <span class="hd-activity-row__meta">
          <el-tag size="small" :type="statusTagType(activity.status)" effect="plain" round>
            {{ activity.statusLabel }}
          </el-tag>
          <time>{{ formatTime(activity.createdAt) }}</time>
        </span>
      </RouterLink>
    </div>
    <div v-else class="hd-empty">
      <el-empty
        :image-size="60"
        :description="text('暂无处理记录')"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, Document, List, Monitor } from '@element-plus/icons-vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { ActivityStatus, DashboardActivity } from '../composables/useHomeDashboard'

defineProps<{
  activities: DashboardActivity[]
  formatTime: (value?: string) => string
  statusTagType: (status: ActivityStatus) => 'success' | 'danger' | 'warning' | 'info'
}>()

const { text } = useAppLanguage()
</script>
