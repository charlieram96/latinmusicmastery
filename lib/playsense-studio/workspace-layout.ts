/** Geometry and persistence for the lesson workspace (video · staff · highway). Pure. */

export type WorkspaceLayout = 'side' | 'stack' | 'pip' | 'music'
export type PipCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface WorkspaceState {
  layout: WorkspaceLayout
  /** % of the stage given to the media (video) region in side and stack. */
  split: number
  /** % of the music region given to the staff when the highway sits below it. */
  musicSplit: number
  /** PiP corner. */
  corner: PipCorner
  /** PiP width as % of the stage width. */
  pipWidth: number
  /** Music first (left of / above the video); in PiP swap mirrors the corner. */
  swap: boolean
}

export interface Bounds { min: number; max: number }

export const WORKSPACE_LAYOUTS: readonly WorkspaceLayout[] = ['side', 'stack', 'pip', 'music']
export const PIP_CORNERS: readonly PipCorner[] = ['tl', 'tr', 'bl', 'br']
export const SPLIT_BOUNDS: Bounds = { min: 22, max: 78 }
export const MUSIC_SPLIT_BOUNDS: Bounds = { min: 25, max: 80 }
export const PIP_WIDTH_BOUNDS: Bounds = { min: 18, max: 50 }
export const SNAP_POINTS = [100 / 3, 50, 200 / 3] as const
export const SNAP_RANGE = 2.2
export const SPLIT_STEP = 2

export const WATCH_WORKSPACE: WorkspaceState = { layout: 'side', split: 44, musicSplit: 54, corner: 'br', pipWidth: 24, swap: false }
export const PLAY_WORKSPACE: WorkspaceState = { layout: 'pip', split: 46, musicSplit: 54, corner: 'br', pipWidth: 24, swap: false }

const round1 = (v: number) => Math.round(v * 10) / 10
export const clamp = (v: number, b: Bounds) => Math.min(b.max, Math.max(b.min, v))

export function snapSplit(value: number): number {
  for (const point of SNAP_POINTS) if (Math.abs(value - point) <= SNAP_RANGE + 1e-9) return point
  return value
}

/** Pointer position along the stage → leading-region share (clamped, snapped, 0.1 %). */
export function splitFromPointer(pointer: number, start: number, extent: number, bounds: Bounds = SPLIT_BOUNDS): number {
  if (!(extent > 0)) return clamp(50, bounds)
  return round1(snapSplit(clamp(((pointer - start) / extent) * 100, bounds)))
}

export function nudgeSplit(value: number, delta: number, bounds: Bounds = SPLIT_BOUNDS): number {
  return round1(clamp(value + delta, bounds))
}

/** Share of the leading (left / top) region for a media share. Its own inverse. */
export function leadingSplit(split: number, swap: boolean): number {
  return swap ? round1(100 - split) : split
}

export function nearestCorner(point: { x: number; y: number }, box: { left: number; top: number; width: number; height: number }): PipCorner {
  const v = point.y < box.top + box.height / 2 ? 't' : 'b'
  const h = point.x < box.left + box.width / 2 ? 'l' : 'r'
  return `${v}${h}` as PipCorner
}

/** The resize handle sits on the inner corner, so a right-hand PiP grows leftwards. */
export function resizePipWidth(startPct: number, dxPx: number, corner: PipCorner, boxWidth: number): number {
  if (!(boxWidth > 0)) return startPct
  const grow = corner.endsWith('r') ? -dxPx : dxPx
  return round1(clamp(startPct + (grow / boxWidth) * 100, PIP_WIDTH_BOUNDS))
}

export function effectiveLayout(layout: WorkspaceLayout, narrow: boolean): WorkspaceLayout {
  return narrow && layout === 'side' ? 'stack' : layout
}

const MIRROR: Record<PipCorner, PipCorner> = { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' }
export function swapWorkspace(state: WorkspaceState): WorkspaceState {
  if (state.layout === 'pip') return { ...state, corner: MIRROR[state.corner] }
  if (state.layout === 'music') return { ...state, layout: 'side', swap: !state.swap }
  return { ...state, swap: !state.swap }
}

export const workspaceStorageKey = (kind: string) => `lmm-workspace:${kind}`

export function parseWorkspaceState(raw: string | null | undefined, defaults: WorkspaceState,
  layouts: readonly WorkspaceLayout[] = WORKSPACE_LAYOUTS): WorkspaceState {
  let value: unknown = null
  try { value = raw ? JSON.parse(raw) : null } catch { value = null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults }
  const o = value as Record<string, unknown>
  const num = (x: unknown, b: Bounds, fallback: number) =>
    typeof x === 'number' && Number.isFinite(x) ? round1(clamp(x, b)) : fallback
  return {
    layout: layouts.includes(o.layout as WorkspaceLayout) ? o.layout as WorkspaceLayout : defaults.layout,
    split: num(o.split, SPLIT_BOUNDS, defaults.split),
    musicSplit: num(o.musicSplit, MUSIC_SPLIT_BOUNDS, defaults.musicSplit),
    corner: PIP_CORNERS.includes(o.corner as PipCorner) ? o.corner as PipCorner : defaults.corner,
    pipWidth: num(o.pipWidth, PIP_WIDTH_BOUNDS, defaults.pipWidth),
    swap: typeof o.swap === 'boolean' ? o.swap : defaults.swap,
  }
}

export function serializeWorkspaceState(s: WorkspaceState): string {
  return JSON.stringify({ v: 1, layout: s.layout, split: s.split, musicSplit: s.musicSplit, corner: s.corner, pipWidth: s.pipWidth, swap: s.swap })
}
