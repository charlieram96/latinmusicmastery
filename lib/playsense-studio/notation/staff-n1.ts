/** Pure maths for the N1 staff: layout, follow, helpers. Coordinates are rendered px unless named otherwise. */
export type RowState = 'past' | 'now' | 'next'
export type NoteNameStyle = 'letters' | 'solfege'
export type StaffLayoutChoice = 'stacked' | 'horizontal'
export interface CountMark { qn: number; label: string; beat: boolean }
export interface PageTurn { kind: 'instant' | 'slide' | 'fade'; durationMs: number; direction: 1 | -1; offsetPercent: number }

export const STAFF_LAYOUT_KEY = 'lmm-staff-layout'

export function barsPerRow(widthPx: number, scale: number): number {
  if (!(widthPx > 0) || !(scale > 0)) return 2
  return Math.max(2, Math.min(4, Math.floor(widthPx / (250 * scale))))
}

export function rowStates(count: number, current: number): RowState[] {
  return Array.from({ length: count }, (_, k) => k < current ? 'past' : k === current ? 'now' : 'next')
}

export function stackedFollowTarget(rowTopPx: number, viewportPx: number, contentPx: number): number {
  return Math.max(0, Math.min(rowTopPx - 6, Math.max(0, contentPx - viewportPx)))
}

export function glide(current: number, target: number, dtSeconds: number, rate = 7): number {
  if (Math.abs(target - current) < .5) return target
  return current + (target - current) * Math.min(1, Math.max(0, dtSeconds) * rate)
}

export function barCounts(startQn: number, [beats, unit]: [number, number], and: string): CountMark[] {
  const beatQn = 4 / unit
  const marks: CountMark[] = []
  for (let b = 0; b < beats; b++) {
    marks.push({ qn: startQn + b * beatQn, label: String(b + 1), beat: true })
    if (unit <= 4) marks.push({ qn: startQn + (b + .5) * beatQn, label: and, beat: false })
  }
  return marks
}

/** Notes are voice-1 events in time order and never overlap, so ends are sorted too. */
export function noteStateAt(ms: number, notes: ReadonlyArray<{ ms: number; endMs: number }>): { active: number; played: number } {
  let lo = 0, hi = notes.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (notes[mid].endMs <= ms) lo = mid + 1; else hi = mid }
  const active = lo < notes.length && notes[lo].ms <= ms ? lo : -1
  return { active, played: lo }
}

export function pageTurn(from: number, to: number, reducedMotion: boolean): PageTurn {
  const direction = to < from ? -1 : 1
  if (from < 0 || from === to) return { kind: 'instant', durationMs: 0, direction, offsetPercent: 0 }
  return reducedMotion
    ? { kind: 'fade', durationMs: 220, direction, offsetPercent: 0 }
    : { kind: 'slide', durationMs: 420, direction, offsetPercent: 12 }
}

const SOLFEGE: Record<string, string> = { c: 'Do', d: 'Re', e: 'Mi', f: 'Fa', g: 'Sol', a: 'La', b: 'Si' }
const ACCIDENTAL: Record<string, string> = { '': '', '#': '♯', '##': '𝄪', b: '♭', bb: '𝄫', n: '' }

export function noteLabel(key: string, style: NoteNameStyle): string {
  const match = /^([a-g])(##|bb|#|b|n)?\//.exec(key)
  if (!match) return ''
  const base = style === 'solfege' ? SOLFEGE[match[1]] : match[1].toUpperCase()
  return base + ACCIDENTAL[match[2] ?? '']
}

export function isAttack(previous: { tieToNext: boolean } | undefined, current: { isRest: boolean }): boolean {
  return !current.isRest && !previous?.tieToNext
}

export function parseStaffLayout(raw: string | null): StaffLayoutChoice {
  return raw === 'horizontal' ? 'horizontal' : 'stacked'
}
