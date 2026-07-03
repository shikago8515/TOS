<template>
  <div class="cap">
    <transition name="cap-modal">
      <div v-if="pendingDeleteKey" class="cap-modal-mask" @click.self="cancelDelete">
        <div class="cap-confirm">
          <div class="cap-confirm__icon"><AppIcon name="trash" /></div>
          <div class="cap-confirm__body">
            <h3>{{ text('删除账号档案') }}</h3>
            <p>{{ text(`确认删除“${credentialDisplayName(pendingDeleteKey)}”？`) }}</p>
          </div>
          <div class="cap-confirm__actions">
            <button type="button" class="cap-btn" @click="cancelDelete">{{ text('取消') }}</button>
            <button type="button" class="cap-btn cap-btn--danger" :disabled="clearing" @click="confirmDelete">
              <AppIcon name="trash" />{{ clearing ? text('删除中...') : text('确认删除') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="cap-modal">
      <div v-if="editorOpen" class="cap-modal-mask" @click.self="cancelEditor">
        <form class="cap-dialog" @submit.prevent="saveEditor">
          <header class="cap-dialog__head">
            <div class="cap-dialog__icon"><AppIcon name="shield-check" /></div>
            <div>
              <h3>{{ text(editorTitle) }}</h3>
              <p>{{ text('保存到远程数据库后，可在账号档案中直接选择使用。') }}</p>
            </div>
          </header>
          <div class="cap-dialog__body">
            <label class="cap-field">
              <span>{{ text('保存名称') }}</span>
              <div class="cap-input-wrap">
                <AppIcon name="bookmark" />
                <input v-model.trim="draftName" type="text" class="cap-input" :placeholder="text('例如 user3 / 默认账号')" autocomplete="off" />
              </div>
            </label>
            <label class="cap-field">
              <span>{{ text('User ID') }}</span>
              <div class="cap-input-wrap">
                <AppIcon name="user" />
                <input v-model.trim="draftUsername" type="text" class="cap-input" :placeholder="text('请输入 User ID')" autocomplete="username" />
              </div>
            </label>
            <label class="cap-field">
              <span>{{ text('Password') }}</span>
              <div class="cap-input-wrap">
                <AppIcon name="shield-check" />
                <input v-model="draftPassword" :type="showDraftPassword ? 'text' : 'password'" class="cap-input cap-input--secret" :placeholder="text('请输入密码')" autocomplete="current-password" />
                <button type="button" class="cap-input-btn" @click="showDraftPassword = !showDraftPassword"><AppIcon name="eye" /></button>
              </div>
            </label>
          </div>
          <footer class="cap-dialog__actions">
            <button type="button" class="cap-btn" :disabled="saving" @click="cancelEditor">{{ text('取消') }}</button>
            <button type="submit" class="cap-btn cap-btn--primary" :disabled="saving || !draftUsername || !draftPassword">
              <AppIcon name="shield-check" />{{ saving ? text('保存中...') : text(editorSubmitLabel) }}
            </button>
          </footer>
        </form>
      </div>
    </transition>

    <div class="cap-panel">
      <div class="cap-field cap-panel__picker">
        <span>{{ text('账号档案') }}</span>
        <div class="cap-profile-row">
          <div ref="pickerRef" class="cap-profile" :class="{ 'cap-profile--open': menuOpen }">
            <button type="button" class="cap-profile-trigger" :disabled="credentialOptions.length === 0" @click="toggleMenu">
              <span class="cap-profile-trigger__icon"><AppIcon name="bookmark" /></span>
              <span class="cap-profile-trigger__text">
                <strong>{{ selectedCredentialLabel }}</strong>
                <small>{{ selectedUsernameLabel || text('暂无已保存账号') }}</small>
              </span>
              <AppIcon name="chevron-down" class="cap-profile-trigger__chev" />
            </button>

            <div v-if="menuOpen && credentialOptions.length > 0" class="cap-profile-menu">
              <div v-for="option in credentialOptions" :key="option.accountKey" class="cap-profile-option" :class="{ 'cap-profile-option--active': normalizeCredentialKey(option.accountKey) === selectedCredentialKey }">
                <button type="button" class="cap-profile-option__main" @click="selectCredentialOption(option.accountKey)">
                  <span>
                    <strong>{{ credentialDisplayName(option.accountKey) }}</strong>
                    <small>{{ formatUsername(option.username) }}</small>
                  </span>
                  <AppIcon v-if="normalizeCredentialKey(option.accountKey) === selectedCredentialKey" name="check-circle" />
                </button>
                <button type="button" class="cap-profile-option__delete" :disabled="clearing" :title="text('删除账号档案')" @click.stop="openDelete(option.accountKey)">
                  <AppIcon name="trash" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="cap-actions">
        <button class="cap-btn cap-btn--primary" type="button" @click="openAddProfile">
          <AppIcon name="plus" />{{ text('新增账号') }}
        </button>
        <button class="cap-btn" type="button" :disabled="!canEditCurrent" @click="openEditProfile">
          <AppIcon name="settings" />{{ text('编辑账号') }}
        </button>
        <button v-if="extraActionLabel" class="cap-btn" type="button" :disabled="extraActionDisabled" @click="$emit('extraAction')">
          <AppIcon :name="extraActionLoading ? 'loader' : extraActionIcon" :class="{ 'cap-spin': extraActionLoading }" />{{ text(extraActionLabel) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAppLanguage } from '../../../shared/i18n/appLanguage'
import AppIcon from '../../../shared/ui/AppIcon.vue'
import type { ExecutorCredentialOption, ExecutorCredentials, ResolvedAutomationCredentials } from '../webAutomationApi'
import {
  clearExecutorCredentials,
  fetchExecutorCredentialOptions,
  fetchExecutorCredentials,
  resolveAutomationCredentials,
  saveExecutorCredentials,
} from '../webAutomationApi'
import { normalizeInforNexusUsername } from '../webAutomationCredentials'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'
type UsernameMode = 'inforNexus' | 'plain'
type ProfileState = { hasStoredCredentials: boolean; username: string; accountKey: string }
type ResolvedProfile = { username: string; password: string; accountKey: string }
type ProfileCache = {
  options: ExecutorCredentialOption[] | null
  credentialsByKey: Map<string, ExecutorCredentials>
  resolvedByKey: Map<string, ResolvedAutomationCredentials>
}
type LocalCredentialRecord = {
  automationId: string
  accountKey: string
  username: string
  password: string
  updatedAt: string
}
type LocalCredentialStore = Record<string, Record<string, LocalCredentialRecord>>

const profileCaches = new Map<string, ProfileCache>()
const LOCAL_CREDENTIALS_STORAGE_KEY = 'tos.webAutomation.localCredentials.v1'

const props = withDefaults(defineProps<{
  automationId: string
  selectedKey?: string
  username?: string
  password?: string
  defaultUsername?: string
  usernameMode?: UsernameMode
  extraActionLabel?: string
  extraActionIcon?: string
  extraActionDisabled?: boolean
  extraActionLoading?: boolean
}>(), {
  selectedKey: 'default',
  username: '',
  password: '',
  defaultUsername: '',
  usernameMode: 'inforNexus',
  extraActionLabel: '',
  extraActionIcon: 'download',
  extraActionDisabled: false,
  extraActionLoading: false,
})

const emit = defineEmits<{
  'update:selectedKey': [value: string]
  'update:username': [value: string]
  'update:password': [value: string]
  state: [value: ProfileState]
  notice: [value: { tone: NoticeTone; message: string }]
  extraAction: []
}>()

const { text } = useAppLanguage()
const pickerRef = ref<HTMLElement | null>(null)
const credentialOptions = ref<ExecutorCredentialOption[]>([])
const selectedCredentialKey = ref(normalizeCredentialKey(props.selectedKey))
const currentCredentials = ref<ExecutorCredentials | null>(null)
const menuOpen = ref(false)
const editorOpen = ref(false)
const editorMode = ref<'add' | 'edit'>('add')
const draftName = ref('')
const draftUsername = ref('')
const draftPassword = ref('')
const showDraftPassword = ref(false)
const pendingDeleteKey = ref('')
const saving = ref(false)
const clearing = ref(false)

const selectedCredentialOption = computed(() => (
  credentialOptions.value.find((option) => normalizeCredentialKey(option.accountKey) === selectedCredentialKey.value) || null
))
const selectedCredentialLabel = computed(() => credentialDisplayName(selectedCredentialKey.value))
const selectedUsernameLabel = computed(() => (
  formatUsername(selectedCredentialOption.value?.username || currentCredentials.value?.username || props.username || '')
))
const hasStoredCredentials = computed(() => Boolean(
  currentCredentials.value?.hasStoredCredentials
    || selectedCredentialOption.value?.hasStoredCredentials
    || getCache().resolvedByKey.has(selectedCredentialKey.value),
))
const canEditCurrent = computed(() => Boolean(selectedCredentialOption.value || hasStoredCredentials.value))
const editorTitle = computed(() => editorMode.value === 'edit' ? '编辑账号档案' : '新增账号档案')
const editorSubmitLabel = computed(() => editorMode.value === 'edit' ? '保存修改' : '保存账号')

watch(() => props.automationId, () => {
  void refresh(props.selectedKey)
})

watch(() => props.selectedKey, (value) => {
  const key = normalizeCredentialKey(value)
  if (key !== selectedCredentialKey.value) {
    void selectCredentialOption(key)
  }
})

onMounted(() => {
  document.addEventListener('click', closeMenuOnOutsideClick)
  void refresh(props.selectedKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenuOnOutsideClick)
})

async function refresh(accountKey = selectedCredentialKey.value): Promise<void> {
  await refreshCredentialOptions()
  const key = normalizeCredentialKey(accountKey)
  await applyCredentialKey(key, true)
}

async function resolveCredentials(): Promise<ResolvedProfile> {
  const key = selectedCredentialKey.value
  const cache = getCache()
  const cached = cache.resolvedByKey.get(key)
  if (cached) {
    applyResolvedCredential(key, cached)
    return { username: formatUsername(cached.username), password: cached.password, accountKey: key }
  }

  const localResolved = readLocalCredential(props.automationId, key)
  if (localResolved?.username && localResolved.password) {
    const resolved = buildResolvedCredential(localResolved)
    cache.resolvedByKey.set(key, resolved)
    applyResolvedCredential(key, resolved)
    return { username: formatUsername(resolved.username), password: resolved.password, accountKey: key }
  }

  let publicCredentials = cache.credentialsByKey.get(key)
  if (!publicCredentials) {
    publicCredentials = await fetchExecutorCredentials(props.automationId, key)
    cache.credentialsByKey.set(key, publicCredentials)
  }
  if (!publicCredentials.hasStoredCredentials) {
    throw new Error(text('请先新增并保存 Infor Nexus 登录账号密码。'))
  }

  const resolved = await resolveAutomationCredentials(props.automationId, key)
  cache.resolvedByKey.set(key, resolved)
  saveLocalCredential(props.automationId, key, resolved.username, resolved.password)
  applyResolvedCredential(key, resolved)
  return { username: formatUsername(resolved.username), password: resolved.password, accountKey: key }
}

function toggleMenu(): void {
  if (credentialOptions.value.length === 0) return
  menuOpen.value = !menuOpen.value
}

function closeMenuOnOutsideClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Node && pickerRef.value?.contains(target)) return
  menuOpen.value = false
}

function selectCredentialOption(accountKey: string): void {
  const key = normalizeCredentialKey(accountKey)
  menuOpen.value = false
  selectedCredentialKey.value = key
  emit('update:selectedKey', key)

  const option = credentialOptions.value.find((item) => normalizeCredentialKey(item.accountKey) === key)
  if (option?.username) {
    emit('update:username', formatUsername(option.username))
  }
  const cached = getCache().resolvedByKey.get(key)
  emit('update:password', cached?.password || '')
  emitState(option?.username || '')
  void applyCredentialKey(key, false)
}

function openAddProfile(): void {
  editorMode.value = 'add'
  draftName.value = ''
  draftUsername.value = props.defaultUsername || props.username || ''
  draftPassword.value = ''
  showDraftPassword.value = false
  menuOpen.value = false
  editorOpen.value = true
}

function openEditProfile(): void {
  if (!canEditCurrent.value) return
  editorMode.value = 'edit'
  draftName.value = selectedCredentialKey.value
  draftUsername.value = selectedUsernameLabel.value || props.username || ''
  draftPassword.value = props.password || getCache().resolvedByKey.get(selectedCredentialKey.value)?.password || ''
  showDraftPassword.value = false
  menuOpen.value = false
  editorOpen.value = true
}

function cancelEditor(): void {
  if (saving.value) return
  editorOpen.value = false
}

async function saveEditor(): Promise<void> {
  if (saving.value) return
  const username = formatUsername(draftUsername.value)
  const password = draftPassword.value
  const fallbackKey = editorMode.value === 'edit'
    ? selectedCredentialKey.value
    : (credentialOptions.value.length === 0 ? 'default' : buildProfileAccountKey(username))
  const accountKey = normalizeCredentialKey(draftName.value || fallbackKey)
  if (!username || !password) {
    emit('notice', { tone: 'warning', message: text('请先填写账号和密码。') })
    return
  }

  saving.value = true
  try {
    const localSaved = saveLocalCredential(props.automationId, accountKey, username, password)
    let saved = localSaved
    let savedRemote = true
    try {
      saved = await saveExecutorCredentials(props.automationId, username, password, accountKey)
    } catch {
      savedRemote = false
    }
    const cache = getCache()
    cache.credentialsByKey.set(accountKey, saved)
    cache.resolvedByKey.set(accountKey, {
      ok: true,
      automationId: props.automationId,
      accountKey,
      username,
      password,
    })
    await refreshCredentialOptions(true)
    selectedCredentialKey.value = accountKey
    currentCredentials.value = saved
    emit('update:selectedKey', accountKey)
    emit('update:username', username)
    emit('update:password', password)
    emitState(username)
    editorOpen.value = false
    if (!savedRemote) {
      emit('notice', {
        tone: 'warning',
        message: text('Saved to this device. Backend sync is currently unavailable.'),
      })
      return
    }
    emit('notice', { tone: 'success', message: text('已保存账号档案。') })
  } catch (error) {
    emit('notice', { tone: 'error', message: readErrorMessage(error, text('保存账号档案失败。')) })
  } finally {
    saving.value = false
  }
}

function openDelete(accountKey: string): void {
  pendingDeleteKey.value = normalizeCredentialKey(accountKey)
  menuOpen.value = false
}

function cancelDelete(): void {
  if (clearing.value) return
  pendingDeleteKey.value = ''
}

function confirmDelete(): void {
  const key = pendingDeleteKey.value
  if (!key) return
  void deleteProfile(key)
}

async function deleteProfile(accountKey: string): Promise<void> {
  if (clearing.value) return
  const key = normalizeCredentialKey(accountKey)
  clearing.value = true
  try {
    removeLocalCredential(props.automationId, key)
    try {
      await clearExecutorCredentials(props.automationId, key)
    } catch {
      // Keep the UI usable when the backend is offline; the local profile is already removed.
    }
    const cache = getCache()
    cache.credentialsByKey.delete(key)
    cache.resolvedByKey.delete(key)
    await refreshCredentialOptions(true)
    pendingDeleteKey.value = ''
    if (selectedCredentialKey.value === key) {
      const nextKey = normalizeCredentialKey(credentialOptions.value[0]?.accountKey || 'default')
      await applyCredentialKey(nextKey, false)
    }
    emit('notice', { tone: 'info', message: text('已删除账号档案。') })
  } catch (error) {
    emit('notice', { tone: 'error', message: readErrorMessage(error, text('删除账号档案失败。')) })
  } finally {
    clearing.value = false
  }
}

async function applyCredentialKey(accountKey: string, allowFallback: boolean): Promise<void> {
  const key = normalizeCredentialKey(accountKey)
  selectedCredentialKey.value = key
  emit('update:selectedKey', key)

  const cache = getCache()
  const cachedResolved = cache.resolvedByKey.get(key)
  if (cachedResolved) {
    applyResolvedCredential(key, cachedResolved)
    return
  }

  const localResolved = readLocalCredential(props.automationId, key)
  if (localResolved?.username && localResolved.password) {
    const resolved = buildResolvedCredential(localResolved)
    cache.resolvedByKey.set(key, resolved)
    applyResolvedCredential(key, resolved)
    return
  }

  const option = credentialOptions.value.find((item) => normalizeCredentialKey(item.accountKey) === key)
  if (option?.username) {
    emit('update:username', formatUsername(option.username))
    emit('update:password', '')
    emitState(option.username)
  }

  try {
    let publicCredentials = cache.credentialsByKey.get(key)
    if (!publicCredentials) {
      publicCredentials = await fetchExecutorCredentials(props.automationId, key)
      cache.credentialsByKey.set(key, publicCredentials)
    }
    currentCredentials.value = publicCredentials

    if (publicCredentials.hasStoredCredentials) {
      const username = formatUsername(publicCredentials.username || option?.username || '')
      if (username) emit('update:username', username)
      emit('update:password', '')
      emitState(username)
      return
    }

    if (allowFallback && credentialOptions.value.length > 0) {
      const nextKey = normalizeCredentialKey(credentialOptions.value[0]?.accountKey)
      if (nextKey !== key) {
        await applyCredentialKey(nextKey, false)
        return
      }
    }

    emit('update:password', '')
    emitState('')
  } catch {
    if (allowFallback && credentialOptions.value.length > 0) {
      const nextKey = normalizeCredentialKey(credentialOptions.value[0]?.accountKey)
      if (nextKey !== key) {
        await applyCredentialKey(nextKey, false)
        return
      }
    }
    currentCredentials.value = null
    emit('update:password', '')
    emitState(option?.username || '')
  }
}

function applyResolvedCredential(accountKey: string, resolved: ResolvedAutomationCredentials): void {
  const username = formatUsername(resolved.username)
  selectedCredentialKey.value = normalizeCredentialKey(accountKey)
  saveLocalCredential(props.automationId, selectedCredentialKey.value, username, resolved.password)
  currentCredentials.value = {
    ok: true,
    hasStoredCredentials: true,
    username,
    automationId: resolved.automationId,
    accountKey,
  }
  emit('update:selectedKey', selectedCredentialKey.value)
  emit('update:username', username)
  emit('update:password', resolved.password)
  emitState(username)
}

function mergeLocalCredentialOptions(remoteOptions: ExecutorCredentialOption[]): ExecutorCredentialOption[] {
  const byKey = new Map<string, ExecutorCredentialOption>()
  for (const option of remoteOptions) {
    const key = normalizeCredentialKey(option.accountKey)
    byKey.set(key, { ...option, accountKey: key })
  }
  for (const local of listLocalCredentials(props.automationId)) {
    const key = normalizeCredentialKey(local.accountKey)
    const existing = byKey.get(key)
    byKey.set(key, {
      ...existing,
      automationId: existing?.automationId || props.automationId,
      accountKey: key,
      hasStoredCredentials: true,
      username: local.username || existing?.username || '',
      createdAt: existing?.createdAt,
      updatedAt: local.updatedAt || existing?.updatedAt,
    })
  }
  return Array.from(byKey.values())
}

async function refreshCredentialOptions(force = false): Promise<void> {
  const cache = getCache()
  if (!force && cache.options) {
    credentialOptions.value = mergeLocalCredentialOptions(cache.options)
    return
  }

  try {
    credentialOptions.value = mergeLocalCredentialOptions(await fetchExecutorCredentialOptions(props.automationId))
    cache.options = credentialOptions.value
  } catch {
    credentialOptions.value = mergeLocalCredentialOptions(cache.options || [])
    cache.options = credentialOptions.value
  }
}

function saveLocalCredential(
  automationId: string,
  accountKey: string,
  username: string,
  password: string,
): ExecutorCredentials {
  const normalizedAutomationId = String(automationId || 'default').trim() || 'default'
  const key = normalizeCredentialKey(accountKey)
  const record: LocalCredentialRecord = {
    automationId: normalizedAutomationId,
    accountKey: key,
    username: formatUsername(username),
    password,
    updatedAt: new Date().toISOString(),
  }
  const store = readLocalCredentialStore()
  store[normalizedAutomationId] = {
    ...(store[normalizedAutomationId] || {}),
    [key]: record,
  }
  writeLocalCredentialStore(store)
  return {
    ok: true,
    hasStoredCredentials: true,
    username: record.username,
    automationId: normalizedAutomationId,
    accountKey: key,
    updatedAt: record.updatedAt,
  }
}

function removeLocalCredential(automationId: string, accountKey: string): void {
  const normalizedAutomationId = String(automationId || 'default').trim() || 'default'
  const key = normalizeCredentialKey(accountKey)
  const store = readLocalCredentialStore()
  if (!store[normalizedAutomationId]?.[key]) return
  delete store[normalizedAutomationId][key]
  if (Object.keys(store[normalizedAutomationId]).length === 0) {
    delete store[normalizedAutomationId]
  }
  writeLocalCredentialStore(store)
}

function readLocalCredential(automationId: string, accountKey: string): LocalCredentialRecord | null {
  const normalizedAutomationId = String(automationId || 'default').trim() || 'default'
  const key = normalizeCredentialKey(accountKey)
  const record = readLocalCredentialStore()[normalizedAutomationId]?.[key]
  return record?.username && record.password ? record : null
}

function listLocalCredentials(automationId: string): LocalCredentialRecord[] {
  const normalizedAutomationId = String(automationId || 'default').trim() || 'default'
  return Object.values(readLocalCredentialStore()[normalizedAutomationId] || {})
    .filter((record) => Boolean(record?.username && record.password))
}

function buildResolvedCredential(record: LocalCredentialRecord): ResolvedAutomationCredentials {
  return {
    ok: true,
    automationId: record.automationId,
    accountKey: normalizeCredentialKey(record.accountKey),
    username: record.username,
    password: record.password,
  }
}

function readLocalCredentialStore(): LocalCredentialStore {
  try {
    const raw = window.localStorage.getItem(LOCAL_CREDENTIALS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as LocalCredentialStore : {}
  } catch {
    return {}
  }
}

function writeLocalCredentialStore(store: LocalCredentialStore): void {
  try {
    window.localStorage.setItem(LOCAL_CREDENTIALS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // localStorage may be unavailable in restricted browser shells.
  }
}

function emitState(username: string): void {
  emit('state', {
    hasStoredCredentials: hasStoredCredentials.value,
    username: formatUsername(username),
    accountKey: selectedCredentialKey.value,
  })
}

function getCache(): ProfileCache {
  const key = props.automationId || 'default'
  let cache = profileCaches.get(key)
  if (!cache) {
    cache = {
      options: null,
      credentialsByKey: new Map<string, ExecutorCredentials>(),
      resolvedByKey: new Map<string, ResolvedAutomationCredentials>(),
    }
    profileCaches.set(key, cache)
  }
  return cache
}

function normalizeCredentialKey(value: string | undefined): string {
  return String(value || '').trim() || 'default'
}

function formatUsername(value: string): string {
  const username = String(value || '').trim()
  return props.usernameMode === 'plain' ? username : normalizeInforNexusUsername(username)
}

function buildProfileAccountKey(value: string): string {
  return formatUsername(value) || 'default'
}

function credentialDisplayName(value: string): string {
  const key = normalizeCredentialKey(value)
  return key === 'default' ? text('默认账号') : key
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

defineExpose({
  refresh,
  resolveCredentials,
})
</script>

<style scoped lang="scss">
.cap {
  --cap-accent: var(--teal, var(--a, #0ea5e9));
  --cap-accent-dark: var(--teal-dark, var(--a, #0284c7));
  --cap-accent-soft: var(--teal-soft, var(--a2, #e0f2fe));
  --cap-ink: var(--ink, #172033);
  --cap-muted: var(--muted, var(--mu, #72829d));
  --cap-line: var(--line, var(--br, #e2e8f0));
  --cap-control-height: 40px;
}

.cap-btn,
.cap-input-btn,
.cap-profile-trigger,
.cap-profile-option__main,
.cap-profile-option__delete {
  border: 0;
  font: inherit;
}

.cap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--cap-control-height);
  padding: 0 12px;
  border: 1px solid var(--cap-line);
  border-radius: 10px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: #cbd5e1;
    background: #f8fafc;
    box-shadow: 0 8px 18px rgba(15, 23, 42, .07);
  }

  &:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  &--primary {
    border-color: transparent;
    color: #fff;
    background: linear-gradient(135deg, var(--cap-accent), var(--cap-accent-dark));
    box-shadow: 0 10px 20px rgba(14, 165, 233, .18);

    &:hover:not(:disabled) {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(135deg, var(--cap-accent), var(--cap-accent-dark));
      box-shadow: 0 12px 24px rgba(14, 165, 233, .24);
      filter: brightness(1.04);
    }
  }

  &--danger {
    color: #dc2626;
    border-color: #fecaca;

    &:hover:not(:disabled) {
      background: #fef2f2;
    }
  }
}

.cap-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  padding: 10px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fbff 0%, #f8fafc 100%);
}

.cap-panel__picker {
  flex: 1 1 200px;
  min-width: 0;
}

.cap-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
}

.cap-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;

  > span {
    color: var(--cap-ink);
    font-size: 11px;
    font-weight: 800;
  }
}

.cap-profile-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  min-width: 0;
}

.cap-profile {
  position: relative;
  z-index: 10;
  flex: 1;
  min-width: 0;

  &--open {
    z-index: 40;
  }
}

.cap-profile-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: var(--cap-control-height);
  padding: 0 10px;
  border: 1px solid var(--cap-line);
  border-radius: 10px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  color: var(--cap-ink);
  text-align: left;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;

  &:hover:not(:disabled) {
    border-color: #93c5fd;
    background: #fff;
    box-shadow: 0 4px 14px rgba(14, 165, 233, .08);
  }

  &:disabled {
    color: #94a3b8;
    background: #f8fafc;
    cursor: not-allowed;
  }

  &__icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: var(--cap-accent);
    background: var(--cap-accent-soft);
  }

  &__text {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 12px;
      font-weight: 850;
    }

    small {
      color: #6b7fa8;
      font-size: 10px;
    }
  }

  &__chev {
    flex-shrink: 0;
    color: #7182a8;
    transition: transform .18s ease;
  }
}

.cap-profile--open .cap-profile-trigger {
  border-color: var(--cap-accent);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, .12);

  .cap-profile-trigger__chev {
    transform: rotate(180deg);
  }
}

.cap-profile-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  max-height: 220px;
  overflow: auto;
  padding: 5px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, .14);
  animation: cap-menu-in .16s ease-out both;
}

.cap-profile-option {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 9px;

  & + & {
    margin-top: 4px;
  }

  &--active {
    background: color-mix(in srgb, var(--cap-accent-soft) 70%, #fff);
  }
}

.cap-profile-option__main {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 9px;
  background: transparent;
  color: var(--cap-ink);
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f8fafc;
  }

  span {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 12px;
    font-weight: 800;
  }

  small {
    color: var(--cap-muted);
    font-size: 10px;
  }
}

.cap-profile-option__delete {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-right: 3px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease;

  &:hover:not(:disabled) {
    border-color: #fecaca;
    background: #fef2f2;
  }

  &:disabled {
    opacity: .45;
    cursor: wait;
  }
}

.cap-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, .24);
  backdrop-filter: blur(3px);
}

.cap-confirm {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 12px;
  width: min(420px, 100%);
  padding: 18px;
  border: 1px solid #fee2e2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
  animation: cap-modal-in .18s ease-out both;

  &__icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: #ef4444;
    background: #fef2f2;
  }

  &__body {
    min-width: 0;

    h3 {
      margin: 0;
      color: var(--cap-ink);
      font-size: 15px;
      line-height: 1.4;
    }

    p {
      margin: 5px 0 0;
      color: var(--cap-muted);
      font-size: 12px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
  }

  &__actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 6px;
  }
}

.cap-dialog {
  width: min(520px, 100%);
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
  animation: cap-modal-in .18s ease-out both;

  &__head {
    display: grid;
    grid-template-columns: 46px 1fr;
    gap: 12px;
    padding: 18px 20px;
    border-bottom: 1px solid #e0f2fe;
    background: linear-gradient(135deg, #f8fbff, #eff6ff);

    h3 {
      margin: 0;
      color: var(--cap-ink);
      font-size: 16px;
      line-height: 1.4;
    }

    p {
      margin: 4px 0 0;
      color: var(--cap-muted);
      font-size: 12px;
      line-height: 1.5;
    }
  }

  &__icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 13px;
    color: var(--cap-accent);
    background: var(--cap-accent-soft);
  }

  &__body {
    display: grid;
    gap: 12px;
    padding: 18px 20px 8px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px 20px;
  }
}

.cap-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;

  > :deep(.app-icon) {
    position: absolute;
    left: 12px;
    color: var(--cap-muted);
    pointer-events: none;
  }
}

.cap-input {
  width: 100%;
  min-width: 0;
  height: 38px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--cap-line);
  border-radius: 10px;
  background: #f8fafc;
  color: var(--cap-ink);
  font-size: 13px;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;

  &:focus {
    outline: none;
    border-color: var(--cap-accent);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, .12);
  }

  &--secret {
    padding-right: 42px;
  }
}

.cap-input-btn {
  position: absolute;
  right: 6px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;

  &:hover {
    color: var(--cap-accent);
    background: var(--cap-accent-soft);
  }
}

.cap-modal-enter-active,
.cap-modal-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}

.cap-modal-enter-from,
.cap-modal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.cap-spin {
  animation: cap-spin .85s linear infinite;
}

@keyframes cap-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes cap-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes cap-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .cap-panel,
  .cap-dialog__head,
  .cap-confirm {
    grid-template-columns: 1fr;
  }

  .cap-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .cap-btn {
    width: 100%;
  }
}
</style>
