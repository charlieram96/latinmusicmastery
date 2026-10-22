// Keep browser zoom distinct from layout fitting. Pinch zoom is handled by the
// browser compositor; desktop page zoom changes devicePixelRatio.
let initialPixelRatio: number | undefined
export function stagePageZoom() {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  initialPixelRatio ??= ratio
  return ratio / initialPixelRatio
}

/** Queue layout changes without clearing a canvas between its render and browser paint. */
export function observeFrameResize(element: HTMLElement, applySize: (width: number, height: number) => void) {
  let pending = true
  let width = 0
  let height = 0
  let disconnected = false
  let zoom = stagePageZoom()
  const observer = new ResizeObserver(() => { pending = true })
  observer.observe(element)

  return {
    /** Call from the drawing loop, before rendering the next complete frame. */
    flush() {
      const nextZoom = stagePageZoom()
      const zoomChanged = nextZoom !== zoom
      if (disconnected || (!pending && !zoomChanged)) return false
      pending = false
      const nextWidth = element.clientWidth, nextHeight = element.clientHeight
      if (!nextWidth || !nextHeight || (!zoomChanged && width === nextWidth && height === nextHeight)) return false
      width = nextWidth; height = nextHeight; zoom = nextZoom
      applySize(width, height)
      return true
    },
    disconnect() {
      disconnected = true
      observer.disconnect()
    },
  }
}
