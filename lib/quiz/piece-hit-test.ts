/** Sprite opacity, independent of the rectangular grading area. */
export type PieceHitMask = { width: number; height: number; alpha: Uint8Array }

/** Bounds of visible pixels, excluding transparent sprite padding. */
export function visiblePieceBounds(mask: PieceHitMask) {
  let left = mask.width, top = mask.height, right = -1, bottom = -1
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    if (mask.alpha[y * mask.width + x] < 24) continue
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  return right < 0 ? null : { left, top, right, bottom }
}

/** Fit visible pixels to a consistent thumbnail envelope, preserving aspect ratio. */
export function thumbnailOffset(mask: PieceHitMask, boxWidth: number, boxHeight: number) {
  const bounds = visiblePieceBounds(mask)
  if (!bounds) return { x: 0, y: 0, scale: 1 }
  const { left, top, right, bottom } = bounds
  const containedScale = Math.min(boxWidth / mask.width, boxHeight / mask.height)
  // Leave the same breathing room around every visible silhouette, regardless
  // of the transparent padding in its source image. Long bells stay slender.
  const visibleScale = Math.min((boxWidth - 8) / (right - left + 1), (boxHeight - 8) / (bottom - top + 1))
  return {
    x: (mask.width - left - right - 1) * visibleScale / 2,
    y: (mask.height - top - bottom - 1) * visibleScale / 2,
    scale: visibleScale / containedScale,
  }
}

export function hitsPiecePixel(mask: PieceHitMask, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return false
  const px = Math.floor(x * mask.width), py = Math.floor(y * mask.height)
  return mask.alpha[py * mask.width + px] >= 24
}
