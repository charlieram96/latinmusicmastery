/** Queue layout changes without clearing a canvas between its render and browser paint. */
export function observeFrameResize(element: HTMLElement, applySize: (width: number, height: number) => void) {
  let pending = true
  let width = 0
  let height = 0
  let disconnected = false
  const observer = new ResizeObserver(() => { pending = true })
  observer.observe(element)

  return {
    /** Call from the drawing loop, before rendering the next complete frame. */
    flush() {
      if (disconnected || !pending) return false
      pending = false
      const nextWidth = element.clientWidth, nextHeight = element.clientHeight
      if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return false
      width = nextWidth; height = nextHeight
      applySize(width, height)
      return true
    },
    disconnect() {
      disconnected = true
      observer.disconnect()
    },
  }
}
