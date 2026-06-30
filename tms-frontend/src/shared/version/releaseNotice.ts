import { fallbackAppVersion } from './appVersion'
import bundledReleaseNotes from './releaseNotes.json'
import { requestBackendJson } from '../api/backendClient'

export interface ReleaseNotes {
  version: string
  date?: string
  noticeId?: string
  showPopup?: boolean
  added: string[]
  improved: string[]
  fixed: string[]
  modules?: ReleaseNoteModule[]
  groups?: ReleaseNoticeContentGroup[]
}

export interface ReleaseNoteModule {
  name: string
  added?: string[]
  improved?: string[]
  fixed?: string[]
}

export interface ReleaseNoticeGroup {
  key: string
  title: string
  icon: string
  items: string[]
}

export interface ReleaseNoticeContentGroup {
  title: string
  icon?: string
  items: string[]
}

export interface ReleaseAnnouncementPayload {
  noticeId: string
  version: string
  releaseDate?: string
  showPopup: boolean
  level?: string
  title?: string
  groups: ReleaseNoticeContentGroup[]
}

export interface LatestReleaseAnnouncementResponse {
  ok: boolean
  version?: string
  announcement: ReleaseAnnouncementPayload | null
}

export type ReleaseAnnouncementFetcher = () => Promise<LatestReleaseAnnouncementResponse>

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ReleaseNoticeState {
  visible: boolean
  releaseNotes: ReleaseNotes | null
}

export const releaseNoticeStorageKey = 'tos-release-notice-seen-version'
export const releaseNoticeSeenKeyStorageKey = 'tos-release-notice-seen-key'
export const currentReleaseNotes = bundledReleaseNotes as ReleaseNotes

export function buildReleaseNoticeState({
  currentVersion = fallbackAppVersion,
  releaseNotes = currentReleaseNotes,
  seenNoticeKey = null,
  seenVersion,
}: {
  currentVersion?: string
  releaseNotes?: ReleaseNotes
  seenNoticeKey?: string | null
  seenVersion: string | null
}): ReleaseNoticeState {
  const normalizedCurrentVersion = normalizeVersion(currentVersion)
  const isCurrentRelease =
    normalizeVersion(releaseNotes.version) === normalizedCurrentVersion
  const hasContent = hasReleaseNotesContent(releaseNotes)
  const noticeKey = buildReleaseNoticeKey(releaseNotes, normalizedCurrentVersion)
  const hasSeenNotice = releaseNotes.noticeId
    ? normalizeNoticeKey(seenNoticeKey) === noticeKey
    : normalizeNoticeKey(seenNoticeKey) === noticeKey || normalizeVersion(seenVersion) === normalizedCurrentVersion
  const visible = Boolean(
    isCurrentRelease
    && releaseNotes.showPopup !== false
    && hasContent
    && !hasSeenNotice,
  )

  return {
    visible,
    releaseNotes: visible ? releaseNotes : null,
  }
}

export function buildReleaseNoticeStateFromStorage(
  storage: StorageLike | null = getBrowserStorage(),
  currentVersion = fallbackAppVersion,
  releaseNotes = currentReleaseNotes,
): ReleaseNoticeState {
  return buildReleaseNoticeState({
    currentVersion,
    releaseNotes,
    seenNoticeKey: readReleaseNoticeSeenKey(storage),
    seenVersion: readReleaseNoticeSeenVersion(storage),
  })
}

export async function buildReleaseNoticeStateFromServerOrStorage({
  storage = getBrowserStorage(),
  currentVersion = fallbackAppVersion,
  fallbackReleaseNotes = currentReleaseNotes,
  fetchLatestAnnouncement = fetchLatestReleaseAnnouncement,
}: {
  storage?: StorageLike | null
  currentVersion?: string
  fallbackReleaseNotes?: ReleaseNotes
  fetchLatestAnnouncement?: ReleaseAnnouncementFetcher
} = {}): Promise<ReleaseNoticeState> {
  try {
    const response = await fetchLatestAnnouncement()
    if (response.ok && response.announcement === null) {
      return { visible: false, releaseNotes: null }
    }
    if (response.ok && response.announcement) {
      const releaseNotes = releaseNotesFromAnnouncement(response.announcement)
      return buildReleaseNoticeState({
        currentVersion: response.version || releaseNotes.version || currentVersion,
        releaseNotes,
        seenNoticeKey: readReleaseNoticeSeenKey(storage),
        seenVersion: readReleaseNoticeSeenVersion(storage),
      })
    }
  } catch (_error) {
    return buildReleaseNoticeStateFromStorage(storage, currentVersion, fallbackReleaseNotes)
  }

  return buildReleaseNoticeStateFromStorage(storage, currentVersion, fallbackReleaseNotes)
}

export async function fetchLatestReleaseAnnouncement(): Promise<LatestReleaseAnnouncementResponse> {
  return requestBackendJson<LatestReleaseAnnouncementResponse>({
    path: '/api/release-announcements/latest',
    timeoutMs: 5000,
  })
}

export function releaseNotesFromAnnouncement(announcement: ReleaseAnnouncementPayload): ReleaseNotes {
  return {
    version: announcement.version,
    date: announcement.releaseDate,
    noticeId: announcement.noticeId,
    showPopup: announcement.showPopup,
    added: [],
    improved: [],
    fixed: [],
    modules: [],
    groups: normalizeReleaseNoticeContentGroups(announcement.groups),
  }
}

export function markReleaseNoticeSeen(
  storage: StorageLike | null,
  currentVersion = fallbackAppVersion,
  releaseNotes = currentReleaseNotes,
): void {
  if (!storage) {
    return
  }

  try {
    const normalizedCurrentVersion = normalizeVersion(currentVersion)
    storage.setItem(releaseNoticeSeenKeyStorageKey, buildReleaseNoticeKey(releaseNotes, normalizedCurrentVersion))
    storage.setItem(releaseNoticeStorageKey, normalizedCurrentVersion)
  } catch (_error) {
    // localStorage may be blocked in restricted browser contexts.
  }
}

export function readReleaseNoticeSeenVersion(storage: StorageLike | null): string | null {
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(releaseNoticeStorageKey)
  } catch (_error) {
    return null
  }
}

export function readReleaseNoticeSeenKey(storage: StorageLike | null): string | null {
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(releaseNoticeSeenKeyStorageKey)
  } catch (_error) {
    return null
  }
}

export function buildReleaseNoticeGroups(
  releaseNotes: ReleaseNotes,
  translate: (value: string) => string = (value) => value,
): ReleaseNoticeGroup[] {
  const directGroups = normalizeReleaseNoticeContentGroups(releaseNotes.groups)
    .map((group, index) => ({
      key: `announcement-${index}`,
      title: translate(group.title),
      icon: group.icon || 'sparkles',
      items: translateItems(group.items, translate),
    }))
    .filter((group) => group.items.length > 0)

  if (directGroups.length > 0) {
    return directGroups
  }

  const moduleGroups = (releaseNotes.modules ?? [])
    .map((module, index) => {
      const items = buildModuleItems(module, translate)

      return {
        key: `module-${index}`,
        title: translate(module.name.trim() || '未命名模块'),
        icon: 'sparkles',
        items,
      }
    })
    .filter((group) => group.items.length > 0)

  if (moduleGroups.length > 0) {
    return moduleGroups
  }

  return [
    { key: 'added', title: translate('新增'), icon: 'sparkles', items: translateItems(releaseNotes.added, translate) },
    { key: 'improved', title: translate('优化'), icon: 'activity', items: translateItems(releaseNotes.improved, translate) },
    { key: 'fixed', title: translate('修复'), icon: 'check-circle', items: translateItems(releaseNotes.fixed, translate) },
  ].filter((group) => group.items.length > 0)
}

function hasReleaseNotesContent(releaseNotes: ReleaseNotes): boolean {
  return [
    ...(releaseNotes.groups ?? []).map((group) => group.items ?? []),
    releaseNotes.added,
    releaseNotes.improved,
    releaseNotes.fixed,
    ...(releaseNotes.modules ?? []).flatMap((module) => [
      module.added ?? [],
      module.improved ?? [],
      module.fixed ?? [],
    ]),
  ].some((items) => items.some((item) => item.trim()))
}

function normalizeReleaseNoticeContentGroups(
  groups: ReleaseNoticeContentGroup[] | undefined,
): ReleaseNoticeContentGroup[] {
  if (!Array.isArray(groups)) {
    return []
  }

  return groups
    .map((group) => ({
      title: String(group?.title || '').trim(),
      icon: String(group?.icon || 'sparkles').trim() || 'sparkles',
      items: Array.isArray(group?.items)
        ? group.items.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
    }))
    .filter((group) => group.title && group.items.length > 0)
}

function normalizeVersion(version: string | null | undefined): string {
  return (version ?? '').trim().replace(/^v/i, '')
}

function normalizeNoticeKey(key: string | null | undefined): string {
  return (key ?? '').trim()
}

function buildReleaseNoticeKey(releaseNotes: ReleaseNotes, normalizedCurrentVersion: string): string {
  return normalizeNoticeKey(releaseNotes.noticeId) || normalizedCurrentVersion
}

function buildModuleItems(
  module: ReleaseNoteModule,
  translate: (value: string) => string,
): string[] {
  return [
    ...withCategoryPrefix(module.added, translate('新增'), translate),
    ...withCategoryPrefix(module.improved, translate('优化'), translate),
    ...withCategoryPrefix(module.fixed, translate('修复'), translate),
  ]
}

function withCategoryPrefix(
  items: string[] | undefined,
  label: string,
  translate: (value: string) => string,
): string[] {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `${label}：${translate(item)}`)
}

function translateItems(
  items: string[],
  translate: (value: string) => string,
): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => translate(item))
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}
