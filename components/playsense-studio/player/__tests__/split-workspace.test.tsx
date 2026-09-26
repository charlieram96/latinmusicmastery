// @vitest-environment jsdom
import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SplitWorkspace, WorkspaceLayoutSwitcher } from '../split-workspace'
import { useWorkspaceLayout, type WorkspaceController } from '../use-workspace-layout'
import { PLAY_WORKSPACE, WATCH_WORKSPACE, type WorkspaceLayout, type WorkspaceState } from '@/lib/playsense-studio/workspace-layout'

vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let root: Root
let host: HTMLDivElement
let ctl: WorkspaceController
let phone = false
let reduced = false
let rect = { top: 0, left: 0, width: 1000, height: 600 }
const animate = vi.fn()
const tapped = vi.fn()

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  phone = false
  reduced = false
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width') ? phone : q.includes('reduced-motion') ? reduced : false,
    addEventListener() {}, removeEventListener() {},
  }))
  rect = { top: 0, left: 0, width: 1000, height: 600 }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON() {},
  }) as DOMRect)
  animate.mockReset()
  tapped.mockReset()
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  delete (Element.prototype as { animate?: unknown }).animate
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Harness({ defaults, layouts, frame = 'fill', highway, media = true }: {
  defaults: WorkspaceState; layouts?: readonly WorkspaceLayout[]; frame?: 'card' | 'bleed' | 'fill'; highway?: boolean; media?: boolean
}) {
  const controller = useWorkspaceLayout('test', defaults, layouts ? { layouts } : undefined)
  useEffect(() => { ctl = controller })
  return <>
    <WorkspaceLayoutSwitcher controller={controller} />
    <SplitWorkspace controller={controller} frame={frame}
      media={media ? <div data-media><video /><button type="button" data-tap onClick={tapped}>play</button><div data-ws-nodrag data-controls /></div> : undefined}
      music={<div data-staff />}
      highway={highway ? <div data-highway /> : undefined} />
  </>
}
function render(props: Partial<Parameters<typeof Harness>[0]> = {}) {
  act(() => { root.render(<Harness defaults={WATCH_WORKSPACE} {...props} />) })
}

const q = <T extends Element = HTMLElement>(sel: string) => host.querySelector<T>(sel as never)!
const ws = () => q('.ws')
const lead = () => ws().style.getPropertyValue('--ws-lead')
const pointer = (target: EventTarget, type: string, x: number, y: number) =>
  act(() => { target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })) })
const pick = (label: string) => act(() => { q<HTMLButtonElement>(`button[aria-label="${label}"]`).click() })

describe('SplitWorkspace frame', () => {
  it('fits the workspace to the viewport on mount', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    rect = { top: 300, left: 0, width: 1000, height: 680 }
    render({ frame: 'bleed' })
    expect(q('[data-lesson-workspace]').style.height).toBe(`${1000 - 300 - 8 - 12}px`)
  })
})

describe('SplitWorkspace footer', () => {
  it('renders the footer below the stage, outside the PiP area', () => {
    const controller = { current: null as WorkspaceController | null }
    function WithFooter() {
      const c = useWorkspaceLayout('f', PLAY_WORKSPACE)
      useEffect(() => { controller.current = c })
      return <SplitWorkspace controller={c} frame="fill" media={<video />} music={<div />} footer={<div data-footer />} />
    }
    act(() => { root.render(<WithFooter />) })
    const footer = q('[data-footer]')
    expect(footer.closest('.ws')).toBeNull()
    expect(footer.closest('[data-lesson-workspace]')).not.toBeNull()
  })
})

describe('SplitWorkspace divider', () => {
  it('renders the watch default: side with the divider at 44 %', () => {
    render()
    expect(ws().dataset.layout).toBe('side')
    expect(lead()).toBe('44')
    expect(q('.ws-div').getAttribute('aria-valuenow')).toBe('44')
  })

  it('divider drag snaps and clamps, and commits on release', () => {
    render()
    const div = q('.ws-div')
    pointer(div, 'pointerdown', 440, 300)
    expect(ws().dataset.dragging).toBe('')
    pointer(window, 'pointermove', 488, 300)
    expect(q('.ws-pct').textContent).toBe('50%')
    expect(lead()).toBe('50')
    pointer(window, 'pointerup', 488, 300)
    expect(ctl.state.split).toBe(50)
    expect(ws().dataset.dragging).toBeUndefined()
    pointer(q('.ws-div'), 'pointerdown', 500, 300)
    pointer(window, 'pointermove', 990, 300)
    pointer(window, 'pointerup', 990, 300)
    expect(ctl.state.split).toBe(78)
  })

  it('stacked, the divider follows the vertical axis', () => {
    render({ defaults: { ...WATCH_WORKSPACE, layout: 'stack' } })
    pointer(q('.ws-div'), 'pointerdown', 500, 200)
    pointer(window, 'pointermove', 500, 196)
    pointer(window, 'pointerup', 500, 196)
    expect(ctl.state.split).toBe(33.3)
  })

  it('arrow keys nudge by 2 and double-click resets with a grid transition', () => {
    render()
    const div = q('.ws-div')
    act(() => { div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(ctl.state.split).toBe(46)
    act(() => { div.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })) })
    expect(ctl.state.split).toBe(46)
    act(() => { div.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(ctl.state.split).toBe(44)
    expect(ws().dataset.anim).toBe('')
  })

  it('swap puts music first and keeps the media share', () => {
    render()
    pick('lessonWorkspace.swap')
    expect(ws().dataset.swap).toBe('true')
    expect(lead()).toBe('56')
    expect(ctl.state.split).toBe(44)
    // Dragging the divider to 60 % from the left now gives the video 40 %.
    pointer(q('.ws-div'), 'pointerdown', 560, 300)
    pointer(window, 'pointermove', 600, 300)
    pointer(window, 'pointerup', 600, 300)
    expect(ctl.state.split).toBe(40)
  })

  it('music divider appears with the highway', () => {
    render({ highway: true })
    expect(q('.ws-div2')).not.toBeNull()
    expect(ws().style.getPropertyValue('--ws-staff')).toBe('54')
    pointer(q('.ws-div2'), 'pointerdown', 500, 300)
    pointer(window, 'pointermove', 500, 420)
    pointer(window, 'pointerup', 500, 420)
    expect(ctl.state.musicSplit).toBe(70)
  })
})

describe('SplitWorkspace layouts', () => {
  it('keeps the same media node across layouts', () => {
    render()
    const video = q('video')
    for (const layout of ['stack', 'pip', 'music', 'side'] as const) {
      act(() => ctl.setLayout(layout))
      expect(ws().dataset.layout).toBe(layout)
      expect(q('video')).toBe(video)
    }
  })

  it('FLIP animates both regions for 440 ms', () => {
    render()
    rect = { top: 0, left: 0, width: 1000, height: 600 }
    pick('lessonWorkspace.stack')
    expect(animate).toHaveBeenCalledTimes(2)
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 440 })
  })

  it('reduced motion skips FLIP', () => {
    reduced = true
    render()
    pick('lessonWorkspace.stack')
    expect(ws().dataset.layout).toBe('stack')
    expect(animate).not.toHaveBeenCalled()
  })

  it('without media there is nothing to lay out', () => {
    render({ media: false })
    expect(ws().dataset.layout).toBe('music')
    expect(host.querySelector('.ws-media')).toBeNull()
    expect(host.querySelector('.ws-div')).toBeNull()
  })

  it('shows side as stack on phones', () => {
    phone = true
    render()
    expect(ws().dataset.layout).toBe('stack')
  })
})

describe('SplitWorkspace picture in picture', () => {
  const pip = () => render({ defaults: PLAY_WORKSPACE })

  it('drag tilts the video and springs it to the nearest corner', () => {
    pip()
    const media = q('[data-media]')
    pointer(media, 'pointerdown', 900, 500)
    pointer(window, 'pointermove', 100, 100)
    expect(q('.ws-media').style.transform).toContain('rotate(')
    expect(q('.ws-media').dataset.grabbing).toBe('')
    pointer(window, 'pointerup', 100, 100)
    expect(ws().dataset.corner).toBe('tl')
    expect(q('.ws-media').style.transform).toBe('')
    expect(animate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 440, easing: 'cubic-bezier(.34,1.56,.64,1)' }))
  })

  it('a tap on the pip is not a drag', () => {
    pip()
    const tap = q('[data-tap]')
    pointer(tap, 'pointerdown', 900, 500)
    pointer(window, 'pointermove', 902, 500)
    pointer(window, 'pointerup', 902, 500)
    act(() => { tap.click() })
    expect(ws().dataset.corner).toBe('br')
    expect(tapped).toHaveBeenCalledOnce()
  })

  it('never starts a drag from the controls', () => {
    pip()
    pointer(q('[data-controls]'), 'pointerdown', 900, 500)
    pointer(window, 'pointermove', 100, 100)
    pointer(window, 'pointerup', 100, 100)
    expect(ws().dataset.corner).toBe('br')
  })

  it('resizes from the inner corner', () => {
    pip()
    pointer(q('.ws-pip-resize'), 'pointerdown', 900, 500)
    pointer(window, 'pointermove', 800, 500)
    expect(ws().style.getPropertyValue('--ws-pipw')).toBe('34')
    pointer(window, 'pointerup', 800, 500)
    expect(ctl.state.pipWidth).toBe(34)
    expect(ctl.state.corner).toBe('br')
  })

  it('double-click goes back to side', () => {
    pip()
    act(() => { q('[data-media]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(ctl.state.layout).toBe('side')
  })
})

describe('WorkspaceLayoutSwitcher', () => {
  const buttons = () => [...host.querySelectorAll<HTMLButtonElement>('[role="group"] button')].map(b => b.getAttribute('aria-label'))

  it('shows four layouts and swap, marking the active one', () => {
    render()
    expect(buttons()).toEqual(['lessonWorkspace.side', 'lessonWorkspace.stack', 'lessonWorkspace.pip', 'lessonWorkspace.music', 'lessonWorkspace.swap'])
    expect(q('button[aria-label="lessonWorkspace.side"]').getAttribute('aria-pressed')).toBe('true')
    pick('lessonWorkspace.pip')
    expect(q('button[aria-label="lessonWorkspace.pip"]').getAttribute('aria-pressed')).toBe('true')
    expect(ctl.state.layout).toBe('pip')
  })

  it('hides side on phones', () => {
    phone = true
    render()
    expect(buttons()).not.toContain('lessonWorkspace.side')
    expect(q('button[aria-label="lessonWorkspace.stack"]').getAttribute('aria-pressed')).toBe('true')
  })

  it('offers only what the view offers', () => {
    render({ layouts: ['side', 'stack'] })
    expect(buttons()).toEqual(['lessonWorkspace.side', 'lessonWorkspace.stack', 'lessonWorkspace.swap'])
  })

  it('renders nothing when there is no choice', () => {
    render({ layouts: ['music'], defaults: { ...WATCH_WORKSPACE, layout: 'music' } })
    expect(host.querySelector('[role="group"]')).toBeNull()
  })
})

describe('SplitWorkspace polish minors', () => {
  const pip = () => render({ defaults: PLAY_WORKSPACE })

  it('W1: choosing the active layout leaves no stale measurement for a later corner move', () => {
    pip()
    pick('lessonWorkspace.pip')
    animate.mockReset()
    act(() => ctl.update({ corner: 'tl' }))
    const flips = animate.mock.calls.filter(([frames]) => JSON.stringify(frames).includes('scale('))
    expect(flips).toEqual([])
  })

  it('W2: double-clicking the tap-to-play button in PiP does not switch the layout', () => {
    pip()
    act(() => { q('[data-tap]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) })
    expect(ctl.state.layout).toBe('pip')
  })

  it('W5: unmounting mid-drag removes the drag listeners', () => {
    render()
    const removed = vi.spyOn(window, 'removeEventListener')
    pointer(q('.ws-div'), 'pointerdown', 440, 300)
    act(() => { root.render(<div />) })
    expect(removed.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']))
  })

  it('W5: unmounting mid PiP drag removes the drag listeners', () => {
    pip()
    const removed = vi.spyOn(window, 'removeEventListener')
    pointer(q('[data-media]'), 'pointerdown', 900, 500)
    act(() => { root.render(<div />) })
    expect(removed.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']))
  })

  it('W6: a PiP press blocks text selection until release', () => {
    pip()
    const select = () => { const e = new Event('selectstart', { bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented }
    pointer(q('[data-media]'), 'pointerdown', 900, 500)
    expect(select()).toBe(true)
    pointer(window, 'pointerup', 900, 500)
    expect(select()).toBe(false)
  })
})

describe('SplitWorkspace dock (W3)', () => {
  let mounts = 0
  function Stateful() {
    const [n, setN] = React.useState(0)
    useEffect(() => { mounts++ }, [])
    return <button type="button" data-dock-btn onClick={() => setN(v => v + 1)}>{n}</button>
  }
  function WithDock() {
    const c = useWorkspaceLayout('dock', WATCH_WORKSPACE)
    useEffect(() => { ctl = c })
    return <SplitWorkspace controller={c} frame="fill" media={<video />} music={<div />} dock={<Stateful />} />
  }

  it('keeps one mounted dock that moves between the video pane and the footer', () => {
    mounts = 0
    act(() => { root.render(<WithDock />) })
    const btn = q('[data-dock-btn]')
    expect(btn.closest('.ws-media')).not.toBeNull()
    act(() => { btn.click() })
    act(() => ctl.setLayout('pip'))
    expect(q('[data-dock-btn]').closest('.ws-footer')).not.toBeNull()
    act(() => ctl.setLayout('side'))
    expect(q('[data-dock-btn]').closest('.ws-media')).not.toBeNull()
    expect(q('[data-dock-btn]')).toBe(btn)
    expect(btn.textContent).toBe('1')
    expect(mounts).toBe(1)
  })
})
