import { fallbackAppVersion } from './appVersion'
import bundledReleaseNotes from './releaseNotes.json'

export interface ReleaseNotes {
  version: string
  date?: string
  noticeId?: string
  showPopup?: boolean
  added: string[]
  improved: string[]
  fixed: string[]
  modules?: ReleaseNoteModule[]
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
