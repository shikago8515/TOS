<template>
  <section class="home-page">
    <header class="overview-band">
      <div>
        <p class="section-kicker">TOS - 功能概览</p>
        <h2>TOS 运营看板</h2>
      </div>

      <div class="backend-status" aria-label="后端在线">
        <span class="status-light" />
        <strong>后端在线</strong>
      </div>
    </header>

    <section class="metric-grid" aria-label="模块统计">
      <MetricTile
        v-for="metric in homeMetricTiles"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :detail="metric.detail"
        :tone="metric.tone"
      />
    </section>

    <section class="content-grid">
      <div class="shortcuts-area">
        <div class="section-heading">
          <p class="section-kicker">快捷入口</p>
          <h3>正式模块与测试模块</h3>
        </div>

        <div class="shortcut-grid">
          <ModuleShortcutCard
            v-for="module in homeShortcutModules"
            :key="module.id"
            :module="module"
          />
        </div>
      </div>

      <aside class="status-panel" aria-label="服务状态">
        <div class="section-heading">
          <p class="section-kicker">服务状态</p>
          <h3>运行概况</h3>
        </div>

        <ul>
          <ServiceStatusItem
            v-for="item in serviceStatusItems"
            :key="item.label"
            :label="item.label"
            :description="item.description"
            :status="item.status"
            :tone="item.tone"
          />
        </ul>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import MetricTile from '../../shared/ui/MetricTile.vue'
import ModuleShortcutCard from '../../shared/ui/ModuleShortcutCard.vue'
import ServiceStatusItem from '../../shared/ui/ServiceStatusItem.vue'
import {
  homeMetricTiles,
  homeShortcutModules,
  serviceStatusItems,
} from './homeModel'
</script>

<style scoped>
.home-page {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.overview-band {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
  padding: 26px 28px;
  color: #ffffff;
  background: #1c5c86;
  border: 1px solid #164d72;
  border-radius: 8px;
  box-shadow: 0 18px 42px rgba(23, 42, 63, 0.12);
}

.section-kicker,
h2,
h3,
.section-kicker {
  color: #5e7288;
  font-size: 13px;
  font-weight: 800;
}

.overview-band .section-kicker {
  color: #b9d7ec;
}

h2 {
  margin-top: 6px;
  color: #ffffff;
  font-size: 30px;
  line-height: 1.2;
}

.backend-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  color: #11344a;
  background: #ffffff;
  border-radius: 999px;
}

.status-light {
  width: 9px;
  height: 9px;
  background: #28a271;
  border-radius: 999px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 22px;
  align-items: start;
}

.shortcuts-area {
  min-width: 0;
}

.section-heading {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
}

h3 {
  color: #172033;
  font-size: 20px;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.status-panel {
  min-width: 0;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #dbe5ee;
  border-radius: 8px;
  box-shadow: 0 14px 32px rgba(23, 42, 63, 0.06);
}

ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

@media (max-width: 1180px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .status-panel {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .overview-band {
    flex-direction: column;
  }

  .metric-grid,
  .shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
