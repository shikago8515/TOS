<template>
  <el-card class="home-panel hd-runtime-panel" shadow="never">
    <template #header>
      <div class="hd-panel-head">
        <div class="hd-panel-head__left">
          <div class="hd-panel-head__icon hd-panel-head__icon--slate flex-center">
            <el-icon><Monitor /></el-icon>
          </div>
          <div class="hd-panel-head__text">
            <h2>{{ text('运行与产物') }}</h2>
            <p>{{ text('关注记录读取、本地缓存和最近输出文件。') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div class="status-list">
      <div
        v-for="(item, index) in statuses"
        :key="item.key"
        class="hd-status-row"
        :style="{ animationDelay: `${index * 0.045}s` }"
      >
        <div class="hd-status-row__dot-wrap">
          <span
            class="hd-status-row__icon flex-center"
            :class="`hd-status-row__icon--${item.tone}`"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
          </span>
          <span
            v-if="item.tone === 'success' || item.tone === 'primary'"
            class="hd-status-row__live-dot hd-status-row__live-dot--active"
          />
        </div>
        <span class="hd-status-row__main">
          <strong>{{ item.title }}</strong>
          <small>{{ item.detail }}</small>
        </span>
        <span class="hd-status-row__tag">
          <el-tag size="small" :type="item.tagType" effect="light" round>
            {{ item.status }}
          </el-tag>
        </span>
      </div>
    </div>

    <div class="hd-artifacts-section">
      <div class="hd-artifacts-head">
        <strong>
          <el-icon><FolderOpened /></el-icon>
          {{ text('最近结果文件') }}
        </strong>
        <small>{{ artifacts.length }} {{ text('个') }}</small>
      </div>
      <div v-if="artifacts.length" class="hd-artifact-list">
        <RouterLink
          v-for="(artifact, idx) in artifacts"
          :key="artifact.id"
          :to="artifact.path"
          class="hd-artifact-row"
          :style="{ animationDelay: `${idx * 0.04}s` }"
        >
          <el-icon><Document /></el-icon>
          <span>
            <strong>{{ artifact.fileName }}</strong>
            <small>{{ artifact.moduleLabel }} · {{ formatTime(artifact.createdAt) }}</small>
          </span>
        </RouterLink>
      </div>
      <div v-else class="hd-empty">
        <el-empty
          :image-size="44"
          :description="text('暂无输出文件')"
        />
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Document, FolderOpened, Monitor } from '@element-plus/icons-vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { HomeServiceStatusRow, RecentArtifact } from '../composables/useHomeDashboard'

defineProps<{
  statuses: HomeServiceStatusRow[]
  artifacts: RecentArtifact[]
  formatTime: (value?: string) => string
}>()

const { text } = useAppLanguage()
</script>
