<template>
  <div class="app-shell">
    <aside class="app-sidebar" aria-label="TOS 主导航">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">T</span>
        <span>
          <span class="brand-name">TOS</span>
        </span>
      </RouterLink>

      <nav class="nav-groups">
        <section
          v-for="group in sidebarGroups"
          :key="group.id"
          class="nav-group"
          :class="{ 'nav-group--single': group.modules.length === 1 }"
        >
          <p v-if="group.showLabel" class="nav-group-title">
            {{ group.label }}
          </p>

          <RouterLink
            v-for="module in group.modules"
            :key="module.id"
            class="nav-link"
            :to="module.path"
            :class="{ 'nav-link--active': route.name === module.routeName }"
          >
            <span class="nav-dot" aria-hidden="true" />
            <span>{{ module.navLabel }}</span>
          </RouterLink>
        </section>
      </nav>

      <footer class="sidebar-footer">
        <span class="sidebar-footer-label">应用</span>
        <span class="sidebar-version">
          <strong>v0.9.6-beta.1</strong>
          <small>DG运营部</small>
        </span>
      </footer>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <div>
          <h1>{{ pageTitle }}</h1>
        </div>

        <div class="topbar-actions">
          <span class="current-date">{{ displayDate }}</span>
          <button class="diagnostics-button" type="button" @click="exportDiagnostics">
            导出诊断包
          </button>
        </div>
      </header>

      <main class="content-frame">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import {
  getModulesByGroup,
  tosNavGroups,
  type TosModuleDefinition,
} from '../domain/moduleCatalog'

const route = useRoute()

const sidebarGroups = computed(() =>
  tosNavGroups
    .map((group) => {
      const modules = getModulesByGroup(group.id).filter(shouldShowInSidebar)

      return {
        ...group,
        modules,
        showLabel: group.id === 'collector' || modules.length > 1,
      }
    })
    .filter((group) => group.modules.length > 0),
)

const pageTitle = computed(() => {
  const title = route.meta.title
  return typeof title === 'string' ? title : '首页'
})

const displayDate = computed(() => {
  const today = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = `${today.getMonth() + 1}`.padStart(2, '0')
  const day = `${today.getDate()}`.padStart(2, '0')

  return `${month}/${day}${weekdays[today.getDay()]}`
})

function shouldShowInSidebar(module: TosModuleDefinition): boolean {
  return module.stage !== 'placeholder' || module.group === 'settings'
}

async function exportDiagnostics(): Promise<void> {
  await window.electronAPI?.exportDiagnosticsPackage()
}
</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
  background: #edf3f8;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 22px 18px;
  color: #dbe7f3;
  background: #17283a;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  margin-bottom: 28px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #153352;
  font-weight: 800;
  background: #f5fbff;
  border-radius: 8px;
}

.brand-name {
  display: block;
}

.brand-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
}

.nav-groups {
  display: grid;
  gap: 18px;
}

.nav-group {
  display: grid;
  gap: 6px;
}

.nav-group-title {
  margin: 0 0 2px;
  color: #7f94a8;
  font-size: 12px;
  font-weight: 700;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
  color: #c9d6e3;
  font-size: 14px;
  border-radius: 8px;
}

.nav-link:hover,
.nav-link--active {
  color: #ffffff;
  background: rgba(76, 132, 194, 0.28);
}

.nav-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  background: currentColor;
  border-radius: 999px;
  opacity: 0.72;
}

.sidebar-footer {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 14px;
  margin-top: auto;
  padding-top: 18px;
  color: #93a6b8;
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-footer-label {
  padding-bottom: 2px;
}

.sidebar-version {
  display: grid;
  gap: 3px;
  justify-items: end;
  min-width: 0;
  text-align: right;
}

.sidebar-version strong {
  color: #d7e3ef;
  font-weight: 700;
}

.sidebar-version small {
  color: #7f94a8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.app-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 86px;
  padding: 18px 30px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid #dbe5ee;
}

.topbar h1 {
  margin: 0;
  color: #172033;
  font-size: 24px;
  font-weight: 760;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.current-date {
  color: #546579;
  font-size: 13px;
  font-weight: 700;
}

.diagnostics-button {
  min-height: 34px;
  padding: 0 14px;
  color: #185782;
  font-weight: 700;
  background: #eff8ff;
  border: 1px solid #b9d8ee;
  border-radius: 7px;
  cursor: pointer;
}

.diagnostics-button:hover {
  background: #e1f2ff;
}

.content-frame {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 28px 30px 34px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    display: none;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
