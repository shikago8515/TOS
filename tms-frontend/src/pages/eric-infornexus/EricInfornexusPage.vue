<template>
  <AutomationPageShell
    variant="infornexus"
    page-title="Eric - Infornexus"
    page-subtitle="Infor Nexus 运输自动化流程"
    :allowed-entry-ids="['shipping-automation', 'xinlongtai-shipping-automation', 'shipping-automation-2', 'infornexus-auto-add', 'po-auto-download']"
  />
</template>

<script setup lang="ts">
import AutomationPageShell from '../web-automation/components/AutomationPageShell.vue'
</script>
