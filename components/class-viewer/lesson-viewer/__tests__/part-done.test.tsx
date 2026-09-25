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

const render = (previousBest: number | null, extra: Partial<React.ComponentProps<typeof PartDone>> = {}) =>
  act(() => root.render(<PartDone stats={stats} bars={bars} previousBest={previousBest} onAgain={vi.fn()} onContinue={vi.fn()} demo={false} {...extra} />))

describe('PartDone', () => {
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
})
