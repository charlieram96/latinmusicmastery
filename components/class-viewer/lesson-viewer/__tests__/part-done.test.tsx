// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))

import { PartDone } from '../part-done'
import type { AttemptStats } from '@/lib/play-sense/types'
import type { BarResult } from '@/lib/play-sense/bar-results'
import { applyRhythmGrade } from '@/lib/play-sense/rhythm-grade'
import { evaluateRhythm } from '@/lib/play-sense/rhythm-evaluation'

const stats = { score: 86, accuracy: 88, perfectCount: 20, goodCount: 10, okCount: 2, missCount: 3, extraHits: 0, maxCombo: 21, maxStreak: 9,
  avgOffsetMs: 4, tempoDriftMs: 3, durationSeconds: 192, pitchAccuracy: null } as unknown as AttemptStats
const bar = (n: number, status: BarResult['status']): BarResult => ({ bar: n, status, notes: status === 'rest' ? 0 : 4, missed: status === 'miss' ? 1 : 0, early: 0, late: status === 'close' ? 1 : 0 })
const bars = [bar(1, 'clean'), bar(2, 'close'), bar(3, 'miss'), bar(4, 'rest'), bar(5, 'clean'), bar(6, 'miss')]

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (previousBest: number | null | undefined, extra: Partial<React.ComponentProps<typeof PartDone>> = {}) =>
  act(() => root.render(<PartDone stats={stats} bars={bars} previousBest={previousBest} onAgain={vi.fn()} onContinue={vi.fn()} demo={false} {...extra} />))

describe('PartDone', () => {
  it('distinguishes missing capture from detected hits outside the timing window', () => {
    render(null, { stats: { ...stats, accuracy: 0, rhythm: evaluateRhythm([0, .5], []) } })
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('No hits were recorded')
    render(null, { stats: { ...stats, accuracy: 0, rhythm: evaluateRhythm([0, .5], [.2, .7]) } })
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })
  it('shows the accuracy ring, heading and three stat tiles', () => {
    render(null)
    expect(host.querySelector('[data-accuracy-ring]')?.getAttribute('aria-label')).toBe('dashboard.classViewer.lessonMode.part.accuracyLabel(88)')
    expect(host.querySelector('h2')?.textContent).toBe('dashboard.classViewer.lessonMode.part.heading.good')
    const tiles = [...host.querySelectorAll('[data-stat]')].map(t => t.textContent)
    expect(tiles[0]).toContain('2/5')
    expect(tiles[1]).toContain('21')
    expect(tiles[2]).toContain('3:12')
  })

  it('compares the take with the previous best', () => {
    render(null)
    expect(host.textContent).toContain('part.first')
    render(74)
    expect(host.textContent).toContain('part.better(74)')
    render(95)
    expect(host.textContent).toContain('part.below(95)')
  })

  it('draws one tile per bar and names the missed bars to practise', () => {
    render(80)
    const tiles = [...host.querySelectorAll('[data-bar-tile]')]
    expect(tiles.map(t => t.getAttribute('data-status'))).toEqual(['clean', 'close', 'miss', 'rest', 'clean', 'miss'])
    expect(tiles[2].getAttribute('aria-label')).toBe('dashboard.classViewer.lessonMode.part.barLabel(3,dashboard.classViewer.lessonMode.part.legend.miss)')
    expect(host.textContent).toContain('practiceBars(3, 6)')
  })

  it('offers Again and Continue', () => {
    const onAgain = vi.fn()
    const onContinue = vi.fn()
    render(80, { onAgain, onContinue })
    act(() => (host.querySelector('[data-part-again]') as HTMLButtonElement).click())
    act(() => (host.querySelector('[data-part-continue]') as HTMLButtonElement).click())
    expect(onAgain).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('a take stopped early shows the bars it never reached as not played and says it was partial (L2)', () => {
    render(95, { bars: [bar(1, 'clean'), bar(2, 'miss'), { ...bar(3, 'rest'), status: 'unplayed', notes: 0 }, { ...bar(4, 'rest'), status: 'unplayed', notes: 0 }] })
    const tiles = [...host.querySelectorAll('[data-bar-tile]')].map(t => t.getAttribute('data-status'))
    expect(tiles).toEqual(['clean', 'miss', 'unplayed', 'unplayed'])
    expect(host.textContent).toContain('part.partial(2,4)')
    expect(host.textContent).not.toContain('part.below')
    expect(host.querySelector('.lx-legend i[data-status=unplayed]')).not.toBeNull()
    expect([...host.querySelectorAll('[data-stat]')][0].textContent).toContain('1/2')
  })

  it('hides the comparison while the previous best is still loading (L11)', () => {
    render(undefined)
    expect(host.textContent).not.toContain('part.first')
  })
})

it('enables Continue at the all-Keep-going passing minimum and shows partial credit',()=>{
  render(null,{stats:applyRhythmGrade({...stats,perfectCount:0,goodCount:0,okCount:4,missCount:0,extraHits:0}),bars:[bar(1,'close')]})
  expect(host.textContent).toContain('Keep going: 4 × 75')
  expect((host.querySelector('[data-part-continue]') as HTMLButtonElement).disabled).toBe(false)
})

it('lets the student override a failed take without changing its grade', () => {
  const onContinue=vi.fn()
  render(null,{stats:{...stats,accuracy:40},onContinue})
  expect((host.querySelector('[data-part-continue]') as HTMLButtonElement).disabled).toBe(true)
  act(() => (host.querySelector('[data-part-override]') as HTMLButtonElement).click())
  expect(onContinue).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('40%')
  expect(host.textContent).toContain('Not passed')
})
