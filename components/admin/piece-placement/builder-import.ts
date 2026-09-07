'use client'

import { createClient } from '@/lib/supabase/client'
import type { Background, BackgroundLayer } from '@/lib/quiz/composition'
import type { PlacementPiece } from '@/lib/quiz/grading'
import { alphaBounds, boxToPercent, scaleToFit } from '@/lib/quiz/image-trim'
import { alignedPlacement, centreOf, placePiece, sameSize, type Box, type Centre, type Natural } from '@/lib/quiz/placement'

export { sameSize }
export type { Natural }
export type Trimmed = { blob: Blob; ext: 'webp' | 'png'; ratio: number; frame: Box; natural: Natural; trimmed: boolean }
export type ImportedPiece = { id: string; label: string; imageUrl: string; ratio: number; aligned: { centre: Centre; width: number } | null }

const BUCKET = 'quiz-media'

/** "timbal_bell-2.png" → "Timbal bell 2" */
export function fileNameToLabel(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base ? base[0].toUpperCase() + base.slice(1) : ''
}

/** Name the file that failed: one bad export among thirty is otherwise unfindable. */
async function inContext<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    throw new Error(`${label}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const basename = (url: string) => url.split('/').pop()?.split('?')[0] || url

export function measureNatural(url: string): Promise<Natural | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`)
  return res.blob()
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.type === type ? b : null), type, quality))
}

/** Crop to the opaque bounds, downscale to MAX_SIDE, encode WebP (PNG when the browser cannot). */
export async function trimImage(source: Blob): Promise<Trimmed> {
  const bmp = await createImageBitmap(source)
  const W = bmp.width, H = bmp.height
  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const sctx = src.getContext('2d', { willReadFrequently: true })
  if (!sctx) throw new Error('Canvas is not available')
  sctx.drawImage(bmp, 0, 0)
  const box = alphaBounds(sctx.getImageData(0, 0, W, H).data, W, H) ?? { x: 0, y: 0, width: W, height: H }
  const fit = scaleToFit(box.width, box.height)
  const out = document.createElement('canvas')
  out.width = fit.width
  out.height = fit.height
  out.getContext('2d')!.drawImage(bmp, box.x, box.y, box.width, box.height, 0, 0, fit.width, fit.height)
  bmp.close()
  const webp = await toBlob(out, 'image/webp', 0.85)
  const blob = webp ?? (await toBlob(out, 'image/png', 1))
  if (!blob) throw new Error('Could not encode the image')
  return { blob, ext: webp ? 'webp' : 'png', ratio: box.width / box.height, frame: boxToPercent(box, W, H), natural: { width: W, height: H }, trimmed: box.width < W || box.height < H }
}

export async function uploadImageBlob(name: string, blob: Blob): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: blob.type, cacheControl: '3600', upsert: true })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
}

/** Trim + upload each file; files with the base image's pixel size are placed from their frame position. */
export async function importPieceFiles(
  files: File[],
  ctx: { questionId: string; base: { rect: Box; natural: Natural; frame?: Box } | null; onProgress?: (done: number, total: number) => void },
): Promise<ImportedPiece[]> {
  const out: ImportedPiece[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const id = crypto.randomUUID()
    const piece = await inContext(file.name, async () => {
      const t = await trimImage(file)
      const imageUrl = await uploadImageBlob(`${ctx.questionId}-piece-${id}-${Date.now()}.${t.ext}`, t.blob)
      return { id, label: fileNameToLabel(file.name), imageUrl, ratio: t.ratio, aligned: alignedPlacement(t, ctx.base) }
    })
    out.push(piece)
    ctx.onProgress?.(i + 1, files.length)
  }
  return out
}

/** New layers land centred at 30% width with their natural ratio. */
export async function importLayerFiles(files: File[], ctx: { questionId: string; aspect: number; onProgress?: (done: number, total: number) => void }): Promise<BackgroundLayer[]> {
  const out: BackgroundLayer[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const id = crypto.randomUUID()
    const layer = await inContext(file.name, async () => {
      const t = await trimImage(file)
      const imageUrl = await uploadImageBlob(`${ctx.questionId}-layer-${id}-${Date.now()}.${t.ext}`, t.blob)
      const width = 30
      const height = Math.min(100, (width * ctx.aspect) / t.ratio)
      return { id, imageUrl, name: fileNameToLabel(file.name), ratio: t.ratio, natural: t.natural, frame: t.frame, x: 50 - width / 2, y: Math.max(0, 50 - height / 2), width, height }
    })
    out.push(layer)
    ctx.onProgress?.(i + 1, files.length)
  }
  return out
}

/**
 * Re-process every stored image: trim, downscale, upload, and rewrite geometry.
 * The first layer is the base frame. Its corrected full-file rect (height refit
 * from the full file's ratio, centre kept) is what aligned pieces are mapped
 * through; the layer itself is then replaced by its trimmed sub-rect. Pieces
 * whose file size matches the base are re-placed from their frame; others keep
 * their centre and only gain a ratio (and a correct height).
 */
export async function fixImages(input: {
  questionId: string
  background: Background
  pieces: PlacementPiece[]
  aspect: number
  tolerance: number
  onProgress?: (done: number, total: number) => void
}): Promise<{ background: Background; pieces: PlacementPiece[] }> {
  const { questionId, background, pieces, aspect, tolerance, onProgress } = input
  const total = background.layers.length + pieces.length
  let done = 0
  const layers: BackgroundLayer[] = []
  let baseFull: { rect: Box; natural: Natural } | null = null
  for (const l of background.layers) {
    const next = await inContext(l.name || basename(l.imageUrl), async () => {
      const t = await trimImage(await fetchBlob(l.imageUrl))
      const imageUrl = await uploadImageBlob(`${questionId}-layer-${l.id}-${Date.now()}.${t.ext}`, t.blob)
      // corrected rect for the full file: keep width and centre, height from the full file's ratio
      const fullRatio = t.natural.width / t.natural.height
      const fullH = (l.width * aspect) / fullRatio
      const full: Box = { x: l.x, y: l.y + l.height / 2 - fullH / 2, width: l.width, height: fullH }
      // the trimmed image occupies its frame box inside the corrected full rect
      const rect: Box = { x: full.x + (full.width * t.frame.x) / 100, y: full.y + (full.height * t.frame.y) / 100, width: (full.width * t.frame.width) / 100, height: (full.height * t.frame.height) / 100 }
      const layer: BackgroundLayer = { ...l, imageUrl, ratio: t.ratio, natural: t.natural, frame: t.frame, name: l.name ?? fileNameToLabel(basename(l.imageUrl)), ...rect }
      return { layer, full, natural: t.natural }
    })
    if (!baseFull) baseFull = { rect: next.full, natural: next.natural }
    layers.push(next.layer)
    onProgress?.(++done, total)
  }
  const next: PlacementPiece[] = []
  for (const p of pieces) {
    const url = p.imageUrl
    if (!url) {
      next.push(p)
      onProgress?.(++done, total)
      continue
    }
    const placed = await inContext((p.label ?? '').trim() || basename(url), async () => {
      const t = await trimImage(await fetchBlob(url))
      const imageUrl = await uploadImageBlob(`${questionId}-piece-${p.id}-${Date.now()}.${t.ext}`, t.blob)
      const withRatio = { ...p, imageUrl, ratio: t.ratio }
      const m = alignedPlacement(t, baseFull)
      if (m) return placePiece(withRatio, m.centre, m.width, aspect, tolerance)
      // keep the centre; the sprite's on-screen width shrinks to the visible part of the old file
      const width = (p.width * t.frame.width) / 100
      return placePiece(withRatio, centreOf(p.area), width, aspect, tolerance)
    })
    next.push(placed)
    onProgress?.(++done, total)
  }
  return { background: { ...background, layers }, pieces: next }
}
