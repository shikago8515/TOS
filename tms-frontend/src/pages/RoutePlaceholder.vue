<template>
  <section class="placeholder-page">
    <p class="placeholder-kicker">原 UI 等价重建</p>
    <h2>{{ routeTitle }}</h2>
    <p>
      该模块会在后续按原始界面逐页拆成源码组件。当前正式运行仍使用
      recovered-frontend 中恢复出的原始前端包。
    </p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  routeTitle: string
}>()
</script>

<style scoped>
.placeholder-page {
  max-width: 720px;
  padding: 28px;
  background: #ffffff;
  border: 1px solid #d9e3ec;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(23, 42, 63, 0.06);
}

.placeholder-kicker {
  margin: 0 0 8px;
  color: #5f7490;
  font-size: 13px;
  font-weight: 800;
}

h2 {
  margin: 0 0 12px;
  color: #172033;
  font-size: 24px;
}

p {
  margin: 0;
  color: #5d6b7a;
}
</style>
