/**
 * Lets a page hand the contextual header a specific title (a course name, a
 * lesson) without prop drilling. A tiny external store read with
 * `useSyncExternalStore`; server snapshots are always `null`.
 */
export interface HeaderOverride {
  title: string
}

let current: HeaderOverride | null = null
const listeners = new Set<() => void>()

export function setHeaderOverride(next: HeaderOverride | null) {
  current = next
  for (const l of listeners) l()
}

export function subscribeHeaderOverride(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getHeaderOverride = () => current
export const getServerHeaderOverride = () => null
