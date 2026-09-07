import type { PlacementArea, PlacementPiece } from './grading'
import type { Background } from './composition'

/** Pure geometry for piece placement. All numbers are percent of the stage unless noted. */
export const DEFAULT_TOLERANCE = 3

export type Centre = { x: number; y: number }
export type Box = { x: number; y: number; width: number; height: number }
export type StageRect = { left: number; top: number; width: number; height: number }
/** Pixel size of an image file. */
export type Natural = { width: number; height: number }

const r1 = (n: number) => Math.round(n * 1000) / 1000
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const inside = (area: PlacementArea, c: Centre) => c.x >= area.x && c.x <= area.x + area.width && c.y >= area.y && c.y <= area.y + area.height

/** On-stage height of a sprite: width scaled by the stage aspect over the sprite's natural ratio. */
export function pieceHeightPct(width: number, aspect: number, ratio: number | undefined): number {
  return (width * aspect) / (ratio && ratio > 0 ? ratio : 1)
}

export function areaFor(centre: Centre, width: number, height: number, tolerance: number): PlacementArea {
  const t = Math.max(0, tolerance)
  return { x: r1(centre.x - width / 2 - t), y: r1(centre.y - height / 2 - t), width: r1(width + 2 * t), height: r1(height + 2 * t) }
}

export function centreOf(area: PlacementArea): Centre {
  return { x: r1(area.x + area.width / 2), y: r1(area.y + area.height / 2) }
}

export function toleranceOf(area: PlacementArea, width: number, height: number): number {
  return Math.max(0, r1(Math.min((area.width - width) / 2, (area.height - height) / 2)))
}

/** Stored ratio, else the ratio implied by a legacy area (piece centred in its box), else 1. */
export function effectiveRatio(piece: PlacementPiece, aspect: number, tolerance: number): number {
  if (piece.ratio && piece.ratio > 0) return piece.ratio
  const t = piece.tolerance ?? tolerance
  const h = piece.area.height - 2 * Math.min(t, (piece.area.width - piece.width) / 2)
  return h > 0 && piece.width > 0 ? (piece.width * aspect) / h : 1
}

export function clampCentre(centre: Centre, width: number, height: number): Centre {
  const hw = Math.min(50, width / 2), hh = Math.min(50, height / 2)
  return { x: clamp(centre.x, hw, 100 - hw), y: clamp(centre.y, hh, 100 - hh) }
}

/** Pointer (viewport px) minus the grab offset → centre in percent, or null when the centre is off the stage. */
export function resolveDrop(pointer: Centre, grab: { dx: number; dy: number }, stage: StageRect): Centre | null {
  if (stage.width <= 0 || stage.height <= 0) return null
  const cx = pointer.x - grab.dx, cy = pointer.y - grab.dy
  if (cx < stage.left || cx > stage.left + stage.width || cy < stage.top || cy > stage.top + stage.height) return null
  return { x: ((cx - stage.left) / stage.width) * 100, y: ((cy - stage.top) / stage.height) * 100 }
}

/** An object's bounding box in percent of its file, mapped through the layer that file is aligned to. */
export function frameToStage(frame: Box, layer: Box): { centre: Centre; width: number } {
  return {
    centre: { x: r1(layer.x + (layer.width * (frame.x + frame.width / 2)) / 100), y: r1(layer.y + (layer.height * (frame.y + frame.height / 2)) / 100) },
    width: r1((layer.width * frame.width) / 100),
  }
}

/** Two files are the same export when both sides match within a pixel. */
export function sameSize(a: Natural | null | undefined, b: Natural | null | undefined): boolean {
  return !!a && !!b && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1
}

/**
 * The full-file rect a layer's original file occupies, given the stored
 * (possibly trimmed) rect and its frame box. Without a frame the rect is the
 * full file. Inverts the sub-rect mapping `frameToStage` walks forwards.
 */
export function fullFrameRect(layer: Box, frame?: Box): Box {
  if (!frame || !(frame.width > 0) || !(frame.height > 0)) return layer
  return {
    x: layer.x - (layer.width * frame.x) / frame.width,
    y: layer.y - (layer.height * frame.y) / frame.height,
    width: (layer.width * 100) / frame.width,
    height: (layer.height * 100) / frame.height,
  }
}

/** Where an imported piece belongs: aligned when its file has the base's original pixel size (±1 px), else null. */
export function alignedPlacement(
  piece: { natural: Natural; frame: Box },
  base: { rect: Box; natural: Natural; frame?: Box } | null,
): { centre: Centre; width: number } | null {
  if (!base || !sameSize(piece.natural, base.natural)) return null
  return frameToStage(piece.frame, fullFrameRect(base.rect, base.frame))
}

export function placePiece(piece: PlacementPiece, centre: Centre, width: number, aspect: number, tolerance: number): PlacementPiece {
  const ratio = effectiveRatio(piece, aspect, tolerance)
  const h = pieceHeightPct(width, aspect, ratio)
  return { ...piece, width: r1(width), area: areaFor(centre, width, h, piece.tolerance ?? tolerance) }
}

/** Change the stage aspect without distorting anything: layers keep height + natural ratio, pieces follow the first layer. */
export function refitForAspect(background: Background, pieces: PlacementPiece[], newAspect: number, tolerance: number): { background: Background; pieces: PlacementPiece[] } {
  const oldAspect = background.aspect ?? newAspect
  const layers = background.layers.map((l) => {
    if (!l.ratio) return l
    const width = r1((l.height * l.ratio) / newAspect)
    const cx = l.x + l.width / 2
    return { ...l, width, x: r1(clamp(cx - width / 2, 0, Math.max(0, 100 - width))) }
  })
  const base = background.layers[0], baseNew = layers[0]
  const kx = base && baseNew && base.ratio && base.width > 0 ? baseNew.width / base.width : 1
  const next = pieces.map((p) => {
    const ratio = effectiveRatio(p, oldAspect, tolerance)
    const c = centreOf(p.area)
    const centre = base && baseNew && base.ratio ? { x: baseNew.x + (c.x - base.x) * kx, y: baseNew.y + (c.y - base.y) } : c
    const width = p.width * kx
    return placePiece({ ...p, ratio }, centre, width, newAspect, tolerance)
  })
  return { background: { ...background, aspect: newAspect, layers }, pieces: next }
}

export function swappable(a: { centre: Centre; area: PlacementArea }, b: { centre: Centre; area: PlacementArea }): boolean {
  return inside(a.area, b.centre) && inside(b.area, a.centre)
}

export type PieceWarning = { code: 'noName' } | { code: 'swappable'; with: number[] } | { code: 'offCanvas' } | { code: 'fullFrame' }

export function pieceWarnings(pieces: PlacementPiece[], aspect: number, tolerance: number, fullFrameIds: ReadonlySet<string> = new Set()): Record<string, PieceWarning[]> {
  const geo = pieces.map((p) => ({ centre: centreOf(p.area), area: p.area, h: pieceHeightPct(p.width, aspect, effectiveRatio(p, aspect, tolerance)) }))
  const out: Record<string, PieceWarning[]> = {}
  pieces.forEach((p, i) => {
    const w: PieceWarning[] = []
    if (!(p.label ?? '').trim()) w.push({ code: 'noName' })
    const swaps = geo.map((g, j) => (j !== i && swappable(geo[i], g) ? j + 1 : 0)).filter(Boolean)
    if (swaps.length) w.push({ code: 'swappable', with: swaps })
    const g = geo[i]
    if (g.centre.x - p.width / 2 < 0 || g.centre.x + p.width / 2 > 100 || g.centre.y - g.h / 2 < 0 || g.centre.y + g.h / 2 > 100) w.push({ code: 'offCanvas' })
    if (fullFrameIds.has(p.id)) w.push({ code: 'fullFrame' })
    out[p.id] = w
  })
  return out
}
