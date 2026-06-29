<template>
  <header class="page-header jason-entry-anim">
    <div class="brand">
      <div class="brand-icon">
        <AppIcon name="file-search" />
      </div>
      <div>
        <h1>{{ text('PO 发票顺序重排') }}</h1>
        <p>{{ text('智能文档工作台') }}</p>
      </div>
    </div>

    <!-- === 符合主题的 CSS 虚线粒子流光流水线图 === -->
    <div class="workflow-illustration">
      <div class="node node--source" :title="text('原始输入发票/列表')">
        <AppIcon name="file-text" />
        <span class="node-label">{{ text('原始数据') }}</span>
      </div>
      
      <div class="flow-line">
        <div class="pulse-line" />
        <span class="pulse-dot" />
      </div>

      <div class="node node--process" :title="text('智能重组与页码映射')">
        <AppIcon name="shuffle" />
        <span class="node-label">{{ text('排序重组') }}</span>
      </div>

      <div class="flow-line">
        <div class="pulse-line" />
        <span class="pulse-dot pulse-dot--delay" />
      </div>

      <div class="node node--target" :title="text('按指定顺序生成重排 PDF')">
        <AppIcon name="file-check" />
        <span class="node-label">{{ text('重排 PDF') }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppIcon from '../../../shared/ui/AppIcon.vue'
import { useAppLanguage } from '../../../shared/i18n/appLanguage'

const { text } = useAppLanguage()
</script>

<style scoped>
.page-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--white);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.01), 0 4px 16px rgba(15, 23, 42, 0.02);
}

.brand {
  align-items: center;
  display: flex;
  gap: 12px;
}

.brand h1 {
  font-size: 18px;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0;
}

.brand p {
  color: var(--gray-500);
  font-size: 11px;
  margin: 2px 0 0;
}

.brand-icon {
  align-items: center;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  color: #0ea5e9;
  font-size: 20px;
  height: 38px;
  width: 38px;
  border-radius: 8px;
  display: inline-flex;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1);
}

/* Workflow Illustration Styles */
.workflow-illustration {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-right: 8px;
  user-select: none;
}

.node {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--white);
  border: 1px solid var(--gray-200);
  color: var(--gray-500);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  cursor: help;
}

.node svg {
  font-size: 14px;
}

.node-label {
  position: absolute;
  bottom: -18px;
  font-size: 9px;
  font-weight: 800;
  color: var(--gray-400);
  white-space: nowrap;
  letter-spacing: 0.02em;
  opacity: 0.8;
  transition: all 0.25s;
}

.node:hover {
  transform: translateY(-2px) scale(1.05);
  color: var(--blue);
  border-color: rgba(14, 165, 233, 0.3);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.08);
}

.node:hover .node-label {
  color: var(--gray-700);
  opacity: 1;
}

/* Specific node themes */
.node--source {
  background: linear-gradient(135deg, var(--white), #f0f9ff);
  color: var(--blue);
  border-color: rgba(14, 165, 233, 0.15);
}

.node--process {
  background: linear-gradient(135deg, var(--white), #f8fafc);
  color: var(--gray-600);
}

.node--process:hover {
  color: var(--green);
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);
}

.node--process:hover :deep(svg) {
  animation: shuffle-rotate 0.8s ease-in-out;
}

@keyframes shuffle-rotate {
  0% { transform: rotate(0); }
  100% { transform: rotate(180deg); }
}

.node--target {
  background: linear-gradient(135deg, var(--white), #ecfdf5);
  color: var(--green);
  border-color: rgba(16, 185, 129, 0.15);
}

/* Flow lines and dots animation */
.flow-line {
  position: relative;
  width: 50px;
  height: 2px;
  display: flex;
  align-items: center;
}

.pulse-line {
  width: 100%;
  height: 100%;
  background-image: linear-gradient(to right, var(--gray-200) 40%, transparent 40%);
  background-size: 6px 2px;
  background-repeat: repeat-x;
}

.node--source:hover ~ .flow-line .pulse-line,
.node--process:hover ~ .flow-line .pulse-line {
  animation: dash-flow 0.4s linear infinite;
  background-image: linear-gradient(to right, var(--blue) 40%, transparent 40%);
}

@keyframes dash-flow {
  to { background-position: -6px 0; }
}

.pulse-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--blue);
  box-shadow: 0 0 8px var(--blue);
  animation: dot-travel 2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
  left: 0;
}

.pulse-dot--delay {
  background-color: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation-delay: 1s;
}

@keyframes dot-travel {
  0% {
    left: 0;
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 16px;
  }
  .workflow-illustration {
    padding-bottom: 12px;
  }
}
</style>
