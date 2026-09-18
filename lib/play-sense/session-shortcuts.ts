import type { SessionState } from './types'

export type SessionShortcut = 'pause' | 'resume' | 'restart'

/**
 * Keyboard control of a running attempt. Space pauses/resumes, R restarts.
 * Keys aimed at a form control, a button, or an open dialog are left alone so
 * the shortcut never doubles a click or types into a field.
 */
export function sessionShortcut(event: KeyboardEvent, state: SessionState): SessionShortcut | null {
  const target = event.target as Element | null
  if (target?.closest?.('input, textarea, select, button, [contenteditable=true], [role="dialog"], [role="menu"]')) return null
  if (event.key === ' ') {
    if (state === 'playing') return 'pause'
    if (state === 'paused') return 'resume'
    return null
  }
  if (event.key === 'r' || event.key === 'R') {
    return state === 'countdown' || state === 'playing' || state === 'paused' ? 'restart' : null
  }
  return null
}
