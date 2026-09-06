import type { PlacementPiece } from './grading'

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

function toLayer(v: unknown): BackgroundLayer | null {
  if (!isRecord(v)) return null
  const { id, imageUrl, x, y, width, height, ratio } = v
  if (typeof id !== 'string' || typeof imageUrl !== 'string') return null
  if (![x, y, width, height].every(isFiniteNumber)) return null
  const layer: BackgroundLayer = { id, imageUrl, x: x as number, y: y as number, width: width as number, height: height as number }
  if (isFiniteNumber(ratio) && ratio > 0) layer.ratio = ratio
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
  return Array.isArray(opts.pieces) ? (opts.pieces as PlacementPiece[]) : []
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
