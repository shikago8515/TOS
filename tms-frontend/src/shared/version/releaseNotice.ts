import { fallbackAppVersion } from './appVersion'
import bundledReleaseNotes from './releaseNotes.json'

export interface ReleaseNotes {
  version: string
  date?: string
  added: string[]
  improved: string[]
  fixed: string[]
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
export const currentReleaseNotes = bundledReleaseNotes as ReleaseNotes

export function buildReleaseNoticeState({
  currentVersion = fallbackAppVersion,
  releaseNotes = currentReleaseNotes,
  seenVersion,
}: {
  currentVersion?: string
  releaseNotes?: ReleaseNotes
  seenVersion: string | null
}): ReleaseNoticeState {
  const normalizedCurrentVersion = normalizeVersion(currentVersion)
  const isCurrentRelease =
    normalizeVersion(releaseNotes.version) === normalizedCurrentVersion
  const hasContent = hasReleaseNotesContent(releaseNotes)
  const hasSeenCurrentVersion = normalizeVersion(seenVersion) === normalizedCurrentVersion
  const visible = Boolean(isCurrentRelease && hasContent && !hasSeenCurrentVersion)

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
    seenVersion: readReleaseNoticeSeenVersion(storage),
  })
}

export function markReleaseNoticeSeen(
  storage: StorageLike | null,
  currentVersion = fallbackAppVersion,
): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(releaseNoticeStorageKey, normalizeVersion(currentVersion))
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

function hasReleaseNotesContent(releaseNotes: ReleaseNotes): boolean {
  return [releaseNotes.added, releaseNotes.improved, releaseNotes.fixed]
    .some((items) => items.some((item) => item.trim()))
}

function normalizeVersion(version: string | null | undefined): string {
  return (version ?? '').trim().replace(/^v/i, '')
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}
