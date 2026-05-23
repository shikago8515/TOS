<template>
  <section class="placeholder-page">
    <div class="placeholder-card">
      <div class="placeholder-icon" aria-hidden="true">
        !
      </div>
      <h2>功能开发中</h2>
      <p>此功能模块正在紧张开发中，敬请期待！</p>
      <RouterLink class="return-link" to="/">
        返回首页
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.placeholder-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(620px, calc(100vh - 180px));
}

.placeholder-card {
  width: min(100%, 520px);
  padding: 46px 38px;
  text-align: center;
  background: #ffffff;
  border: 1px solid #d9e3ec;
  border-radius: 8px;
  box-shadow: 0 16px 38px rgba(23, 42, 63, 0.06);
}

.placeholder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  margin-bottom: 22px;
  color: #409eff;
  font-size: 42px;
  font-weight: 800;
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  border-radius: 50%;
}

h2 {
  margin: 0;
  color: #172033;
  font-size: 26px;
  line-height: 1.25;
}

p {
  margin: 12px 0 26px;
  color: #5d6b7a;
  font-size: 15px;
  line-height: 1.7;
}

.return-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  background: #409eff;
  border: 1px solid #337ecc;
  border-radius: 6px;
}

.return-link:hover {
  background: #337ecc;
}

@media (max-width: 640px) {
  .placeholder-page {
    min-height: 420px;
  }

  .placeholder-card {
    padding: 34px 24px;
  }
}
</style>
