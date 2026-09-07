import type { PlacementPiece } from './grading'
import type { Box } from './placement'

/**
 * A piece-placement background is a composition: a color plus positioned
 * image layers. All geometry is in percent of the composition; `aspect` is
 * width / height. `aspect: null` means "derive from the first layer's natural
 * size at runtime" (rows migrated from the single image_url era).
 */
export type BackgroundLayer = {
  id: string
  imageUrl: string
  x: number
  y: number
  width: number
  height: number
  /** natural width / height of the image, when known (locks corner resizing) */
  ratio?: number
  name?: string
  /**
   * Pixel size of the ORIGINAL uploaded file, before trimming. Aligned import
   * compares a piece's file size against this, so it keeps working once the
   * stored image is a trimmed, downscaled copy.
   */
  natural?: { width: number; height: number }
  /**
   * The stored (trimmed) image's opaque box in percent of that original file.
   * With `natural` it recovers the full-file rect the layer would occupy.
   */
  frame?: Box
}

export type Background = {
  color: string
  aspect: number | null
  layers: BackgroundLayer[]
}

export const DEFAULT_BACKGROUND_COLOR = '#0A0A0A'
export const FALLBACK_ASPECT = 1.6

export function legacyLayer(imageUrl: string): BackgroundLayer {
  return { id: 'legacy', imageUrl, x: 0, y: 0, width: 100, height: 100 }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function toBox(v: unknown): Box | null {
  if (!isRecord(v)) return null
  const { x, y, width, height } = v
  if (![x, y, width, height].every(isFiniteNumber)) return null
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}

function toNatural(v: unknown): { width: number; height: number } | null {
  if (!isRecord(v)) return null
  const { width, height } = v
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function toLayer(v: unknown): BackgroundLayer | null {
  if (!isRecord(v)) return null
  const { id, imageUrl, x, y, width, height, ratio, name, natural, frame } = v
  if (typeof id !== 'string' || typeof imageUrl !== 'string') return null
  if (![x, y, width, height].every(isFiniteNumber)) return null
  const layer: BackgroundLayer = { id, imageUrl, x: x as number, y: y as number, width: width as number, height: height as number }
  if (isFiniteNumber(ratio) && ratio > 0) layer.ratio = ratio
  if (typeof name === 'string' && name.trim()) layer.name = name.trim()
  const nat = toNatural(natural)
  if (nat) layer.natural = nat
  const box = toBox(frame)
  if (box) layer.frame = box
  return layer
}

/** Normalize any stored `options` (new shape, legacy image_url, or nothing) into a Background. */
export function readComposition(options: unknown, imageUrl?: string | null): Background {
  const opts = isRecord(options) ? options : {}
  const bg = opts.background
  if (isRecord(bg)) {
    const layers = Array.isArray(bg.layers) ? bg.layers.map(toLayer).filter((l): l is BackgroundLayer => l !== null) : []
    const aspect = isFiniteNumber(bg.aspect) && bg.aspect > 0 ? bg.aspect : null
    const color = typeof bg.color === 'string' && bg.color.trim() ? bg.color : DEFAULT_BACKGROUND_COLOR
    return { color, aspect, layers }
  }
  return { color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: imageUrl ? [legacyLayer(imageUrl)] : [] }
}

export function readPieces(options: unknown): PlacementPiece[] {
  const opts = isRecord(options) ? options : {}
  if (!Array.isArray(opts.pieces)) return []
  const out: PlacementPiece[] = []
  for (const v of opts.pieces) {
    if (!isRecord(v)) continue
    const { ratio, tolerance, ...rest } = v
    const piece = { ...rest } as PlacementPiece
    if (isFiniteNumber(ratio) && ratio > 0) piece.ratio = ratio
    if (isFiniteNumber(tolerance) && tolerance >= 0) piece.tolerance = tolerance
    out.push(piece)
  }
  return out
}

/** Question-level default tolerance (percent of stage width) for the builder's halo; `area` is what the grader reads. */
export function readTolerance(options: unknown): number {
  const opts = isRecord(options) ? options : {}
  return isFiniteNumber(opts.tolerance) && opts.tolerance >= 0 ? opts.tolerance : 3
}

/**
 * Whether the builder should persist the aspect it currently has on screen.
 * True only once, for a migrated row (`storedAspect == null`) that has at
 * least one layer, while the dialog is open, and only after the first
 * layer's natural size has actually been measured — never for the fallback
 * aspect a not-yet-loaded (or broken) image falls back to.
 */
export function shouldPersistAspect(input: { open: boolean; storedAspect: number | null; layerCount: number; measured: boolean }): boolean {
  return input.open && input.storedAspect == null && input.layerCount > 0 && input.measured
}
