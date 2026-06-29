<template>
  <ElConfigProvider :locale="elementPlusLocale" :size="globalStore.dimension">
    <AppShell />
    <AppAlertDialog />
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { ElConfigProvider } from 'element-plus'
import elementEn from 'element-plus/es/locale/lang/en'
import elementZhCn from 'element-plus/es/locale/lang/zh-cn'

import { useGlobalStore } from './app/stores/globalStore'
import { applyTheme } from './app/theme'
import AppShell from './layout/AppShell.vue'
import { setI18nLanguage } from './languages'
import { koiLanguageToAppLanguage } from './languages/language'
import { syncAppLanguageFromKoi } from './shared/i18n/appLanguage'
import AppAlertDialog from './shared/ui/AppAlertDialog.vue'

const globalStore = useGlobalStore()
const elementPlusLocale = computed(() => (globalStore.language === 'zh' ? elementZhCn : elementEn))

watch(
  () => globalStore.language,
  (language) => {
    setI18nLanguage(language)
    syncAppLanguageFromKoi(language)
    document.documentElement.lang = koiLanguageToAppLanguage(language)
  },
  { immediate: true },
)

watch(
  () => globalStore.isDark,
  (isDark) => applyTheme(isDark),
  { immediate: true },
)
</script>
