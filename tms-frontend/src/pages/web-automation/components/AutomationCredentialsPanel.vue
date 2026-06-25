<template>
  <div class="acp">
    <div v-if="hasStoredCredentials" class="acp-note">
      <AppIcon name="check-circle" />
      <span>{{ text('已保存') }} Infor Nexus {{ text('登录账号') }}: {{ savedUsername || username }}</span>
    </div>

    <div class="acp-grid">
      <div ref="pickerRef" class="acp-field acp-field--combo">
        <span>{{ text('User ID') }}</span>
        <div class="acp-combo" :class="{ 'acp-combo--open': menuOpen }">
          <div class="acp-input-wrap acp-input-wrap--combo">
            <AppIcon name="user" />
            <input
              :value="username"
              class="acp-input"
              type="text"
              :placeholder="text('请输入 User ID')"
              autocomplete="username"
              role="combobox"
              :aria-expanded="menuOpen"
              aria-autocomplete="list"
              aria-controls="automation-credential-options"
              @focus="openCredentialMenu"
              @click="openCredentialMenu"
              @input="handleUsernameInput"
            />
            <button class="acp-input-btn acp-input-btn--combo" type="button" :title="text('选择账号')" @click="toggleCredentialMenu">
              <AppIcon name="chevron-down" />
            </button>
          </div>

          <div v-if="menuOpen" id="automation-credential-options" class="acp-combo-menu" role="listbox">
            <button
              v-for="option in filteredCredentialOptions"
              :key="credentialOptionKey(option)"
              class="acp-combo-option"
              :class="{ 'acp-combo-option--active': option.accountKey === selectedCredentialKey }"
              type="button"
              role="option"
              :aria-selected="option.accountKey === selectedCredentialKey"
              @click="selectCredentialOption(option.accountKey)"
            >
              <span>
                <strong>{{ credentialOptionTitle(option) }}</strong>
                <small>{{ normalizeCredentialUsername(option.username) }}</small>
              </span>
              <AppIcon v-if="option.accountKey === selectedCredentialKey" name="check-circle" />
            </button>
            <div v-if="credentialOptions.length === 0" class="acp-combo-empty">
              {{ text('暂无已保存账号') }}
            </div>
            <div v-else-if="filteredCredentialOptions.length === 0" class="acp-combo-empty">
              {{ text('没有匹配账号') }}
            </div>
          </div>
        </div>
      </div>

      <label class="acp-field">
        <span>{{ text('Password') }}</span>
        <div class="acp-input-wrap">
          <AppIcon name="shield-check" />
          <input
            :value="password"
            class="acp-input acp-input--secret"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="text('请输入密码')"
            autocomplete="current-password"
            @input="handlePasswordInput"
          />
          <button class="acp-input-btn" type="button" @click="$emit('update:showPassword', !showPassword)">
            <AppIcon name="eye" />
          </button>
        </div>
      </label>
    </div>

    <div class="acp-actions">
      <button class="acp-btn acp-btn--primary" type="button" :disabled="saving || !username || !password" @click="$emit('save')">
        <AppIcon name="shield-check" />{{ saving ? text('保存中...') : text('保存登录账号密码') }}
      </button>
      <button class="acp-btn" type="button" :disabled="clearing || !hasStoredCredentials" @click="$emit('clear')">
        <AppIcon name="stop-circle" />{{ text('清除') }}
      </button>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import type { ExecutorCredentialOption } from '../webAutomationApi'
import {
  buildCredentialAccountKey,
  filterCredentialOptions,
  normalizeInforNexusUsername,
} from '../webAutomationCredentials'

const props = withDefaults(defineProps<{
  username: string
  password: string
  showPassword: boolean
  hasStoredCredentials: boolean
  savedUsername?: string
  saving: boolean
  clearing: boolean
  credentialOptions?: ExecutorCredentialOption[]
  selectedCredentialKey?: string
}>(), {
  savedUsername: '',
  credentialOptions: () => [],
  selectedCredentialKey: '',
})

const emit = defineEmits<{
  'update:username': [value: string]
  'update:password': [value: string]
  'update:showPassword': [value: boolean]
  selectCredential: [accountKey: string]
  save: []
  clear: []
}>()

const { text } = useAppLanguage()
const pickerRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

const filteredCredentialOptions = computed(() => filterCredentialOptions(props.credentialOptions, props.username))

onMounted(() => {
  document.addEventListener('click', closeCredentialMenuOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeCredentialMenuOnOutsideClick)
})

function handleUsernameInput(event: Event): void {
  const target = event.target
  const value = target instanceof HTMLInputElement ? target.value.trim() : props.username
  menuOpen.value = true
  emit('update:username', value)
}

function handlePasswordInput(event: Event): void {
  const target = event.target
  emit('update:password', target instanceof HTMLInputElement ? target.value : props.password)
}

function openCredentialMenu(): void {
  menuOpen.value = true
}

function toggleCredentialMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeCredentialMenuOnOutsideClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Node && pickerRef.value?.contains(target)) {
    return
  }
  menuOpen.value = false
}

function selectCredentialOption(accountKey: string): void {
  menuOpen.value = false
  emit('selectCredential', accountKey)
}

function normalizeCredentialUsername(value: string): string {
  return normalizeInforNexusUsername(value)
}

function credentialOptionTitle(option: ExecutorCredentialOption): string {
  const key = buildCredentialAccountKey(option.accountKey)
  const username = normalizeCredentialUsername(option.username)
  if (key === 'default') {
    return text('默认账号')
  }
  return key === username ? text('已保存账号') : key
}

function credentialOptionKey(option: ExecutorCredentialOption): string {
  return `${option.sourceAutomationId || option.automationId || 'automation'}:${option.accountKey}`
}
</script>

<style scoped>
.acp {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.acp-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  background: #f0fdf4;
  color: #15803d;
  font-size: 13px;
  font-weight: 600;
}

.acp-note :deep(.app-icon) {
  flex-shrink: 0;
  font-size: 15px;
}

.acp-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.acp-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.acp-field > span {
  color: #1f2937;
  font-size: 12px;
  font-weight: 700;
}

.acp-field--combo {
  position: relative;
  z-index: 2;
}

.acp-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.acp-input-wrap > :deep(.app-icon) {
  position: absolute;
  left: 14px;
  z-index: 1;
  color: #64748b;
  font-size: 15px;
  pointer-events: none;
}

.acp-input {
  width: 100%;
  min-width: 0;
  height: 46px;
  box-sizing: border-box;
  padding: 0 46px 0 42px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 14px;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.acp-input:focus {
  border-color: #14b8a6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, .12);
  outline: none;
}

.acp-input--secret {
  letter-spacing: 0;
}

.acp-input-btn {
  position: absolute;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.acp-input-btn:hover {
  background: #eaf7f5;
  color: #0f766e;
}

.acp-input-btn :deep(.app-icon) {
  font-size: 15px;
}

.acp-combo {
  position: relative;
}

.acp-combo-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 20;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, .14);
}

.acp-combo-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  color: #1f2937;
  text-align: left;
  cursor: pointer;
}

.acp-combo-option:hover,
.acp-combo-option--active {
  background: #ecfdf5;
}

.acp-combo-option span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.acp-combo-option strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acp-combo-option small {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acp-combo-option :deep(.app-icon) {
  flex-shrink: 0;
  color: #0f9f8f;
  font-size: 14px;
}

.acp-combo-empty {
  padding: 12px;
  color: #64748b;
  font-size: 12px;
}

.acp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.acp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 94px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  color: #4b5563;
  font-size: 14px;
  font-weight: 700;
  gap: 7px;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
  white-space: nowrap;
}

.acp-btn:hover:not(:disabled) {
  background: #f8fafc;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .08);
  transform: translateY(-1px);
}

.acp-btn:disabled {
  cursor: not-allowed;
  opacity: .42;
}

.acp-btn--primary {
  border-color: transparent;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #fff;
  box-shadow: 0 8px 20px rgba(14, 165, 233, .22);
}

.acp-btn--primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  box-shadow: 0 10px 24px rgba(14, 165, 233, .3);
}

.acp-btn :deep(.app-icon) {
  flex-shrink: 0;
  font-size: 14px;
}

@media (max-width: 760px) {
  .acp-grid {
    grid-template-columns: 1fr;
  }
}
</style>
