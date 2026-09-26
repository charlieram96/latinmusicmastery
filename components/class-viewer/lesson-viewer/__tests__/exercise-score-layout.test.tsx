// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'en' }) }))
vi.mock('@/components/playsense-studio/player/notation/renderers/staff-renderer', () => ({
  StaffRenderer: ({ layoutMode }: { layoutMode: string }) => <div data-staff data-mode={layoutMode} />,
}))

import { ExerciseScore } from '../exercise-score'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  // This jsdom environment has no working global localStorage (Node's own shadows it).
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear() })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const base = { score: CONGA_TUMBAO_FIXTURE, currentMs: 0, playing: false, pass: 1, passCount: 1, onDurationKnown: () => {} }

it('follows a staff layout its parent controls, and reports the student’s switch', () => {
  localStorage.setItem('lmm-staff-layout', 'stacked')
  const change = vi.fn()
  act(() => root.render(<ExerciseScore {...base} staffLayout="horizontal" onStaffLayoutChange={change} />))
  expect(host.querySelector('[data-staff]')?.getAttribute('data-mode')).toBe('paged')
  const stacked = [...host.querySelectorAll('.ps-staff-layout-switch button')].find(b => b.getAttribute('title') === 'staff.layout.stacked') as HTMLButtonElement
  act(() => stacked.click())
  expect(change).toHaveBeenCalledWith('stacked')
  // Still what the parent says until it re-renders.
  expect(host.querySelector('[data-staff]')?.getAttribute('data-mode')).toBe('paged')
})

it('keeps its own preference without a parent', () => {
  act(() => root.render(<ExerciseScore {...base} />))
  expect(host.querySelector('[data-staff]')?.getAttribute('data-mode')).toBe('wrapped')
})

it('leaves layout to the lesson workspace switcher: no Left/Top/Right menu on the score', async () => {
  const { ExerciseScoreWorkspaceBridge } = await import('../exercise-workspace')
  const { PLAY_WORKSPACE } = await import('@/lib/playsense-studio/workspace-layout')
  const controller = (layout: string) => ({ state: { ...PLAY_WORKSPACE, layout }, layout, update: vi.fn(), setLayout: vi.fn(),
    defaults: PLAY_WORKSPACE, beforeLayoutChangeRef: { current: null } }) as never
  act(() => root.render(<ExerciseScoreWorkspaceBridge controller={controller('side')}><ExerciseScore {...base} /></ExerciseScoreWorkspaceBridge>))
  expect(host.querySelector('[aria-label="Score layout"]')).toBeNull()
  expect(host.querySelector('.ps-exercise-score')?.getAttribute('data-score-layout')).toBe('vertical')
  act(() => root.render(<ExerciseScoreWorkspaceBridge controller={controller('stack')}><ExerciseScore {...base} /></ExerciseScoreWorkspaceBridge>))
  expect(host.querySelector('.ps-exercise-score')?.getAttribute('data-score-layout')).toBe('horizontal')
})
