/** Pure geometry for the composition canvas. Everything is percent of the canvas (0..100). */
export type Rect = { x: number; y: number; width: number; height: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const SNAP_STEP = 2.5
export const MIN_SIZE = 2
export const PIECE_WIDTH_MIN = 3
export const PIECE_WIDTH_MAX = 60

/** Round to the grid step; with no step, round to a tenth of a percent. */
export function snap(v: number, step: number | null): number {
  return step ? Math.round(v / step) * step : Math.round(v * 10) / 10
}

export function clampRect(r: Rect): Rect {
  const width = Math.min(100, Math.max(MIN_SIZE, r.width))
  const height = Math.min(100, Math.max(MIN_SIZE, r.height))
  return { x: Math.min(100 - width, Math.max(0, r.x)), y: Math.min(100 - height, Math.max(0, r.y)), width, height }
}

export function moveRect(start: Rect, dx: number, dy: number, step: number | null): Rect {
  return clampRect({ ...start, x: snap(start.x + dx, step), y: snap(start.y + dy, step) })
}

/**
 * Resize from a handle. West/north handles keep the opposite edge fixed.
 * With keepRatio on a corner, height follows width at `boxRatio` (width/height in percent units) when given, else at the start ratio.
 */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, step: number | null, keepRatio: boolean, boxRatio?: number): Rect {
  let width = start.width
  let height = start.height
  if (handle.includes('e')) width = start.width + dx
  if (handle.includes('w')) width = start.width - dx
  if (handle.includes('s')) height = start.height + dy
  if (handle.includes('n')) height = start.height - dy
  width = Math.max(MIN_SIZE, snap(width, step))
  if (keepRatio && handle.length === 2) height = boxRatio && boxRatio > 0 ? width / boxRatio : (width * start.height) / start.width
  height = Math.max(MIN_SIZE, snap(height, step))
  const x = handle.includes('w') ? start.x + start.width - width : start.x
  const y = handle.includes('n') ? start.y + start.height - height : start.y
  return clampRect({ x: snap(x, step), y: snap(y, step), width, height })
}

export function clampPieceWidth(w: number): number {
  return Math.min(PIECE_WIDTH_MAX, Math.max(PIECE_WIDTH_MIN, Math.round(w * 10) / 10))
}
