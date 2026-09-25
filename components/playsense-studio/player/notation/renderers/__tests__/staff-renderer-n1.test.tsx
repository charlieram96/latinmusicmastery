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
