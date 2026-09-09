import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observeFrameResize } from '@/components/play-sense/stage-highway/frame-resize'

describe('stage resizing between rendered frames', () => {
  let notify: () => void
  let disconnect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notify = callback }
      observe() {}
      disconnect = disconnect
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  function surface() {
    const element = { clientWidth: 800, clientHeight: 600 }
    const applySize = vi.fn()
    const viewport = observeFrameResize(element as HTMLElement, applySize)
    viewport.flush()
    applySize.mockClear()
    return { element, applySize, viewport }
  }

  it('preserves the completed frame when layout changes before browser paint', () => {
    const element = { clientWidth: 800, clientHeight: 600 }
    let image = 'completed frame'
    const pending = observeFrameResize(element as HTMLElement, () => { image = 'cleared' })
    pending.flush()
    image = 'completed frame'
    element.clientWidth = 720
    notify()
    expect(image).toBe('completed frame')
    // Only the drawing loop may clear the buffer, immediately before it redraws.
    pending.flush()
    expect(image).toBe('cleared')
  })

  it('coalesces multiple drag updates into the latest size for the next frame', () => {
    const { element, applySize, viewport } = surface()
    for (const width of [790, 770, 745, 720]) { element.clientWidth = width; notify() }
    expect(applySize).not.toHaveBeenCalled()
    expect(viewport.flush()).toBe(true)
    expect(applySize).toHaveBeenCalledExactlyOnceWith(720, 600)
    expect(viewport.flush()).toBe(false)
  })

  it('does not clear or reallocate buffers for duplicate size notifications', () => {
    const { applySize, viewport } = surface()
    notify()
    expect(viewport.flush()).toBe(false)
    expect(applySize).not.toHaveBeenCalled()
  })

  it('keeps the last size while hidden and resizes when the panel returns', () => {
    const { element, applySize, viewport } = surface()
    element.clientHeight = 0; notify()
    expect(viewport.flush()).toBe(false)
    expect(applySize).not.toHaveBeenCalled()
    element.clientHeight = 420; notify()
    expect(viewport.flush()).toBe(true)
    expect(applySize).toHaveBeenCalledExactlyOnceWith(800, 420)
  })

  it('discards pending work when the stage is destroyed', () => {
    const { element, applySize, viewport } = surface()
    element.clientWidth = 700; notify()
    viewport.disconnect()
    notify()
    expect(viewport.flush()).toBe(false)
    expect(applySize).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
