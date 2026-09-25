// @vitest-environment jsdom
import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceLayout, type WorkspaceController } from '../use-workspace-layout'
import { PLAY_WORKSPACE, WATCH_WORKSPACE, serializeWorkspaceState, type WorkspaceLayout } from '@/lib/playsense-studio/workspace-layout'

let root: Root
let host: HTMLDivElement
let ctl: WorkspaceController
let phone = false

function Probe({ kind, layouts }: { kind: string; layouts?: readonly WorkspaceLayout[] }) {
  const controller = useWorkspaceLayout(kind, kind.startsWith('play') ? PLAY_WORKSPACE : WATCH_WORKSPACE, layouts ? { layouts } : undefined)
  useEffect(() => { ctl = controller })
  return null
}
const render = (kind: string, layouts?: readonly WorkspaceLayout[]) =>
  act(() => { root.render(<Probe kind={kind} layouts={layouts} />) })

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  // This jsdom environment has no working global localStorage (Node's own shadows it).
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
  })
  phone = false
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(max-width: 767px)' ? phone : false,
    addEventListener() {}, removeEventListener() {},
  }))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useWorkspaceLayout', () => {
  it('hydrates the stored state for its kind', () => {
    localStorage.setItem('lmm-workspace:watch:wrapped', serializeWorkspaceState({ ...WATCH_WORKSPACE, layout: 'stack', split: 60 }))
    render('watch:wrapped')
    expect(ctl.state).toMatchObject({ layout: 'stack', split: 60 })
    expect(ctl.layout).toBe('stack')
  })

  it('saves every committed change under its kind', () => {
    render('watch:wrapped')
    act(() => ctl.update({ split: 60 }))
    expect(JSON.parse(localStorage.getItem('lmm-workspace:watch:wrapped')!)).toMatchObject({ split: 60, layout: 'side' })
  })

  it('re-reads when the kind changes', () => {
    localStorage.setItem('lmm-workspace:watch:scroll', serializeWorkspaceState({ ...WATCH_WORKSPACE, layout: 'pip' }))
    render('watch:wrapped')
    expect(ctl.state.layout).toBe('side')
    render('watch:scroll')
    expect(ctl.state.layout).toBe('pip')
  })

  it('measures for FLIP before a layout change and ignores layouts the view lacks', () => {
    render('watch:wrapped', ['side', 'stack'])
    const seen: string[] = []
    ctl.beforeLayoutChange.current = () => seen.push(ctl.state.layout)
    act(() => ctl.setLayout('stack'))
    expect(seen).toEqual(['side'])
    expect(ctl.state.layout).toBe('stack')
    act(() => ctl.setLayout('pip'))
    expect(ctl.state.layout).toBe('stack')
    expect(seen).toHaveLength(1)
  })

  it('swap mirrors the pip corner and saves', () => {
    render('play')
    act(() => ctl.swap())
    expect(ctl.state.corner).toBe('bl')
    expect(JSON.parse(localStorage.getItem('lmm-workspace:play')!).corner).toBe('bl')
  })

  it('shows side as stack on phones without changing the stored choice', () => {
    phone = true
    render('watch:wrapped')
    expect(ctl.narrow).toBe(true)
    expect(ctl.state.layout).toBe('side')
    expect(ctl.layout).toBe('stack')
  })

  it('survives blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    render('watch:wrapped')
    act(() => ctl.update({ split: 30 }))
    expect(ctl.state.split).toBe(30)
  })
})
