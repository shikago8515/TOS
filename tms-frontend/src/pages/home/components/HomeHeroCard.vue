<template>
  <el-card class="home-hero" shadow="never">
    <div class="home-hero__inner">
      <div class="home-hero__icon flex-center">
        <el-icon><Monitor /></el-icon>
      </div>
      <div class="home-hero__text">
        <span class="home-hero__eyebrow">{{ text('TOS 工作台') }}</span>
        <h1>{{ text('今日人员处理看板') }}</h1>
        <p>{{ text('按左侧人员分组汇总今天的处理记录、失败事项和最近产物。') }}</p>
      </div>
      <div class="home-hero__meta">
        <span class="hd-date-badge">
          <el-icon><Calendar /></el-icon>
          {{ todayLabel }}
        </span>
        <span class="hd-refresh-badge">
          <el-icon style="font-size:10px"><Clock /></el-icon>
          {{ text('最后刷新') }}：{{ lastUpdatedLabel }}
        </span>
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="$emit('refresh')"
        >
          {{ text('刷新') }}
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Calendar, Clock, Monitor, Refresh } from '@element-plus/icons-vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'

defineProps<{
  loading: boolean
  todayLabel: string
  lastUpdatedLabel: string
}>()

defineEmits<{
  refresh: []
}>()

const { text } = useAppLanguage()
</script>
