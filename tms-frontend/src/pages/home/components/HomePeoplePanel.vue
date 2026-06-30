<template>
  <el-card class="home-panel hd-people-panel" shadow="never">
    <template #header>
      <div class="hd-panel-head">
        <div class="hd-panel-head__left">
          <div class="hd-panel-head__icon hd-panel-head__icon--teal flex-center">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="hd-panel-head__text">
            <h2>{{ text('人员今日动态') }}</h2>
            <p>{{ text('谁今天使用了系统、处理了哪些内容。') }}</p>
          </div>
        </div>
        <el-tag class="hd-panel-badge" type="primary" effect="plain">
          <template #default>
            <strong>{{ activeCount }}</strong>/{{ people.length }} {{ text('人') }}
          </template>
        </el-tag>
      </div>
    </template>

    <div class="people-list">
      <RouterLink
        v-for="(person, index) in people"
        :key="person.id"
        :to="person.path"
        class="hd-person-row"
        :class="{ 'hd-person-row--idle': person.total === 0 }"
        :style="{ animationDelay: `${index * 0.045}s` }"
      >
        <div class="hd-person-row__avatar-wrap">
          <span
            class="hd-person-row__avatar"
            :style="person.total > 0 ? getAvatarStyle(person.name) : undefined"
          >
            {{ person.initial }}
          </span>
          <span
            class="hd-person-row__dot"
            :class="person.total > 0 ? 'hd-person-row__dot--active' : 'hd-person-row__dot--idle'"
          />
        </div>
        <span class="hd-person-row__main">
          <strong>{{ person.name }}</strong>
          <template v-if="person.latest">
            <span class="hd-person-row__latest">
              <el-icon><Clock /></el-icon>
              <small>{{ person.latest.moduleLabel }} · {{ formatTime(person.latest.createdAt) }}</small>
            </span>
          </template>
          <small v-else>
            {{ text('今日暂无处理') }} · {{ text('可用模块') }} {{ person.availableModules }}
          </small>
        </span>
        <span class="hd-person-row__modules">
          <el-tag
            v-for="moduleLabel in person.modulesTouched"
            :key="moduleLabel"
            size="small"
            effect="plain"
          >
            {{ moduleLabel }}
          </el-tag>
          <el-tag v-if="!person.modulesTouched.length" size="small" type="info" effect="plain">
            {{ text('未开始') }}
          </el-tag>
        </span>
        <span class="hd-person-row__stats">
          <span class="hd-person-row__count">{{ person.total }}</span>
          <span class="hd-person-row__label">{{ text('次') }}</span>
          <span v-if="person.failed > 0" class="hd-person-row__status is-fail">
            <el-icon style="font-size:10px"><WarningFilled /></el-icon>
            {{ person.failed }} {{ text('失败') }}
          </span>
          <span v-else-if="person.total > 0" class="hd-person-row__status is-ok">
            <el-icon style="font-size:10px"><CircleCheckFilled /></el-icon>
            {{ text('正常') }}
          </span>
        </span>
      </RouterLink>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CircleCheckFilled, Clock, UserFilled, WarningFilled } from '@element-plus/icons-vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import type { PersonDashboardRow } from '../composables/useHomeDashboard'

defineProps<{
  people: PersonDashboardRow[]
  activeCount: number
  formatTime: (value?: string) => string
}>()

const { text } = useAppLanguage()

function getAvatarStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue1 = Math.abs(hash % 40) + 170
  const hue2 = Math.abs((hash >> 4) % 40) + 200
  return {
    background: `linear-gradient(135deg, hsl(${hue1}, 80%, 45%) 0%, hsl(${hue2}, 85%, 50%) 100%)`,
  }
}
</script>
