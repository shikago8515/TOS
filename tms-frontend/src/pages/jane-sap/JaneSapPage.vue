<template>
  <AutomationPageShell
    variant="sap"
    page-title="Jane - SAP"
    page-subtitle="SAP BTP 自动化流程"
    :allowed-entry-ids="['microsoft-login-n8n', 'ticket-owner-statistics']"
  />
</template>

<script setup lang="ts">
import AutomationPageShell from '../web-automation/components/AutomationPageShell.vue'
</script>
