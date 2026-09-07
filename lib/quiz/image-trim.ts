import type { Box } from './placement'

/** Pure pixel math for trimming transparent margins off piece images. Browser I/O lives in the admin builder. */
export const ALPHA_THRESHOLD = 8
export const TRIM_PAD = 4
export const MAX_SIDE = 1024

export type PixelBox = { x: number; y: number; width: number; height: number }

/** Bounding box of pixels whose alpha exceeds `threshold`, padded by `pad` px and clamped to the image. Null when fully transparent. */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number, threshold = ALPHA_THRESHOLD, pad = TRIM_PAD): PixelBox | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad)
  return { x: left, y: top, width: Math.min(width, x1 + 1 + pad) - left, height: Math.min(height, y1 + 1 + pad) - top }
}

export function boxToPercent(box: PixelBox, width: number, height: number): Box {
  return { x: (box.x / width) * 100, y: (box.y / height) * 100, width: (box.width / width) * 100, height: (box.height / height) * 100 }
}

export function scaleToFit(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}
