// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { StaffRenderer, type StaffRendererProps } from '../staff-renderer'

beforeAll(() => {
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' }
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never
})

/** Four bars of quarter notes at 120 bpm: each note 500ms, each bar 2000ms. */
function scale(overrides: Partial<ScoreDocument> = {}, events?: (bar: number) => unknown[]): ScoreDocument {
  return {
    schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
    initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [1, 2, 3, 4].map(number => ({ number, voices: [{ number: 1, events: events?.(number) ?? [60, 62, 64, 65].map(midi => ({ kind: 'note', midi, durationQN: 1 })) }] })) }],
    ...overrides,
  } as ScoreDocument
}

let root: Root, host: HTMLDivElement
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const draw = (props: Partial<StaffRendererProps> & { score?: ScoreDocument }) =>
  act(() => { root.render(<StaffRenderer score={scale()} trackIndex={0} currentMs={0} layoutMode="wrapped" {...props} />) })
const states = () => [...host.querySelectorAll('[data-score-note]')].map(n => n.getAttribute('data-note-state'))

describe('note states', () => {
  it('dims played notes and lights the sounding one', () => {
    draw({ currentMs: 1200 })
    expect(states().slice(0, 4)).toEqual(['played', 'played', 'active', 'upcoming'])
  })
  it('seeking back clears played', () => {
    draw({ currentMs: 5000 }); draw({ currentMs: 100 })
    expect(states().filter(s => s === 'played')).toHaveLength(0)
  })
  it('hidden cursor keeps played, drops active', () => {
    draw({ currentMs: 1200, showCursor: false })
    expect(states().slice(0, 4)).toEqual(['played', 'played', 'upcoming', 'upcoming'])
  })
})

describe('rows', () => {
  it('groups each row of the SVG and the helpers', () => {
    draw({ currentMs: 2500 })
    const rows = [...host.querySelectorAll('svg > g[data-score-row]')]
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every(r => r.querySelector('[data-score-note]'))).toBe(true)
    expect(host.querySelectorAll('.ps-staff-row[data-score-row]')).toHaveLength(rows.length)
  })
})

describe('playhead', () => {
  it('has a diamond', () => {
    draw({ currentMs: 0 })
    expect(host.querySelector('.ps-staff-playhead .ps-staff-playhead-diamond')).not.toBeNull()
  })
})
describe('bar band and labels', () => {
  it('replaces the MEASURE labels with one band', () => {
    draw({ currentMs: 2500 })
    expect(host.textContent).not.toMatch(/MEASURE/)
    expect(host.querySelectorAll('.ps-staff-band')).toHaveLength(1)
  })
  it('numbers every row after the first', () => {
    draw({})
    const rows = host.querySelectorAll('svg > g[data-score-row]').length
    expect(host.querySelectorAll('[data-score-bar-number]')).toHaveLength(rows - 1)
  })
})

describe('helpers', () => {
  it('names each attack and lights the current one', () => {
    draw({ currentMs: 600 })
    const chips = [...host.querySelectorAll('.ps-staff-name')]
    expect(chips.slice(0, 4).map(c => c.textContent)).toEqual(['C', 'D', 'E', 'F'])
    expect(chips[1].getAttribute('data-active')).toBe('true')
  })
  it('uses solfege when asked', () => {
    draw({ helpers: { and: 'y', noteNames: 'solfege' } })
    expect(host.querySelector('.ps-staff-name')?.textContent).toBe('Do')
    expect([...host.querySelectorAll('.ps-staff-count')].slice(0, 2).map(c => c.textContent)).toEqual(['1', 'y'])
  })
  it('no chip under a tied continuation', () => {
    const tied = scale({}, () => [{ kind: 'note', midi: 60, durationQN: 2, tieToNext: true }, { kind: 'note', midi: 60, durationQN: 2 }])
    draw({ score: tied })
    expect(host.querySelectorAll('.ps-staff-name')).toHaveLength(4)
  })
  it('counts eighths under every bar', () => {
    draw({})
    expect(host.querySelectorAll('.ps-staff-count')).toHaveLength(32)
  })
  it('rings the next attack while playing', () => {
    draw({ currentMs: 600 })
    expect(host.querySelector('.ps-staff-next')?.hasAttribute('hidden')).toBe(false)
  })
  it('percussion shows no note names', async () => {
    const { CONGA_TUMBAO_FIXTURE } = await import('@/lib/playsense-studio/score-fixtures')
    draw({ score: CONGA_TUMBAO_FIXTURE })
    expect(host.querySelectorAll('.ps-staff-name')).toHaveLength(0)
    expect(host.querySelectorAll('.ps-staff-count').length).toBeGreaterThan(0)
  })
})
describe('stacked', () => {
  it('marks past, now and next rows', () => {
    draw({ currentMs: 2500 })
    const rows = [...host.querySelectorAll('svg > g[data-score-row]')].map(r => r.getAttribute('data-row-state'))
    expect(rows[0]).toBe('past')
    expect(rows[1]).toBe('now')
  })
})

describe('paged', () => {
  it('shows only the current page', () => {
    draw({ layoutMode: 'paged', currentMs: 2500 })
    const pages = [...host.querySelectorAll('svg > g[data-score-row]')].map(r => r.getAttribute('data-page-state'))
    expect(pages.filter(p => p === 'current')).toHaveLength(1)
    expect(pages[1]).toBe('current')
  })
  it('draws every page at the same height (one row tall)', () => {
    draw({ layoutMode: 'paged' })
    const wrappedHeight = (() => { draw({ layoutMode: 'wrapped' }); return host.querySelector('svg')!.getAttribute('height') })()
    draw({ layoutMode: 'paged' })
    expect(Number(host.querySelector('svg')!.getAttribute('height'))).toBeLessThan(Number(wrappedHeight))
  })
  it('paged shows the interlude page before the music', () => {
    draw({ layoutMode: 'paged', currentMs: -500, leadingGapMs: 1000 })
    const current = host.querySelector('.ps-staff-row[data-page-state=current]')
    expect(current).not.toBeNull()
    expect(current!.querySelector('.ps-notation-interlude')).not.toBeNull()
  })
})
