// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplitWorkspace, type SplitWorkspaceSecondaryHeaderCtx } from '../split-workspace'

// The workspace sits 300px below a 1000px-tall window, so the fitted
// (viewport-filling) height is 1000 - 300 minus the 8px footer gap and the
// 12px handle allowance = 680px, while the old 92%-of-window ceiling would
// allow 920px.
const WINDOW_H = 1000
const FRAME_TOP = 300
const FIT_H = WINDOW_H - FRAME_TOP - 8 - 12

let root: Root
let host: HTMLDivElement
let headerCtx: SplitWorkspaceSecondaryHeaderCtx | null

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(window, 'innerHeight', { value: WINDOW_H, configurable: true })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: FRAME_TOP, bottom: FRAME_TOP + FIT_H, left: 0, right: 1000, width: 1000, height: FIT_H, x: 0, y: FRAME_TOP, toJSON() {},
  })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  headerCtx = null
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function render(frame: 'card' | 'bleed') {
  act(() => {
    root.render(<SplitWorkspace
      frame={frame}
      primary={<div data-primary />}
      secondary={<div data-secondary />}
      secondaryHeader={(ctx) => { headerCtx = ctx; return <div data-header /> }}
    />)
  })
}

const workspace = () => host.querySelector<HTMLElement>('[data-lesson-workspace]')!
const knob = () => host.querySelector<HTMLButtonElement>('button[aria-label="Resize"]')!
const primaryFlex = () => (host.querySelector<HTMLElement>('[data-primary]')!.parentElement as HTMLElement).style.flex

function drag(dx: number, dy: number) {
  act(() => {
    knob().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 500, clientY: 500 }))
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 + dx, clientY: 500 + dy }))
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup'))
  })
}

describe('SplitWorkspace knob in the full-bleed lesson frame', () => {
  it('fits the workspace to the viewport on mount', () => {
    render('bleed')
    expect(workspace().style.height).toBe(`${FIT_H}px`)
  })

  it('side by side: dragging down never grows the workspace past the fitted height', () => {
    render('bleed')
    drag(0, 500)
    expect(workspace().style.height).toBe(`${FIT_H}px`)
  })

  it('side by side: dragging up still lets the workspace shrink', () => {
    render('bleed')
    drag(0, -100)
    expect(workspace().style.height).toBe(`${FIT_H - 100}px`)
  })

  it('stacked: the knob only rebalances the split and leaves the height alone', () => {
    render('bleed')
    act(() => headerCtx!.setOrient('column'))
    const before = primaryFlex()
    drag(300, 68) // 68px of a 680px-tall workspace = +10 points of split
    expect(workspace().style.height).toBe(`${FIT_H}px`)
    expect(before).toBe('40 1 0px')
    expect(primaryFlex()).toBe('50 1 0px')
  })

  it('stacked: gives the score pane the larger share by default', () => {
    render('bleed')
    expect(primaryFlex()).toBe('55 1 0px')
    act(() => headerCtx!.setOrient('column'))
    expect(primaryFlex()).toBe('40 1 0px')
    act(() => headerCtx!.setOrient('row'))
    expect(primaryFlex()).toBe('55 1 0px')
  })
})

describe('SplitWorkspace knob in the card frame', () => {
  it('still resizes the height with the knob', () => {
    render('card')
    expect(workspace().style.height).toBe('560px')
    drag(0, 100)
    expect(workspace().style.height).toBe('660px')
  })
})
