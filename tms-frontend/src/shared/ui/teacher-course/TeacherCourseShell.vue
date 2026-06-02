<template>
  <section class="teacher-course-page-shell page-container">
    <transition name="fade-slide" appear>
      <div class="content-wrapper">
        <div class="page-header">
          <div class="header-content">
            <h2 class="page-title">{{ title }}</h2>
            <p v-if="description" class="page-desc">{{ description }}</p>
          </div>
          <div v-if="slots.headerActions" class="header-actions">
            <slot name="headerActions" />
          </div>
        </div>

        <div class="stats-row">
          <TeacherCourseStatCard
            v-for="stat in stats"
            :key="stat.label"
            :icon-name="stat.iconName"
            :label="stat.label"
            :value="stat.value"
            :detail="stat.detail"
            :tone="stat.tone"
            :small-value="Boolean(stat.smallValue)"
          />
        </div>

        <div class="main-content">
          <div class="table-card">
            <div v-if="showToolbar" class="toolbar">
              <div class="left-tools">
                <slot name="toolbarLeft" />
              </div>
              <div class="right-tools">
                <slot name="toolbarRight" />
              </div>
            </div>
            <div v-else class="toolbar toolbar-spacer">
              <div class="left-tools" />
              <div class="right-tools" />
            </div>

            <div class="table-card-body">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

import TeacherCourseStatCard from './TeacherCourseStatCard.vue'

interface TeacherCourseStat {
  iconName: string
  label: string
  value: string
  detail?: string
  tone?: 'blue' | 'violet' | 'green' | 'orange' | 'slate'
  smallValue?: boolean
}

defineProps<{
  title: string
  description?: string
  stats: TeacherCourseStat[]
}>()

const slots = useSlots()
const showToolbar = computed(() => Boolean(slots.toolbarLeft || slots.toolbarRight))
</script>

<style lang="scss">
@use '../../styles/teacher-course-shell.scss';
</style>
