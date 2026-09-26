// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('layout details found in the browser check', () => {
  it('does not number the first music row when a video intro row precedes it', () => {
    draw({ leadingGapMs: 1000 })
    const musicRows = [...host.querySelectorAll('svg > g[data-score-row]')].filter(r => r.querySelector('[data-score-note]')).length
    expect(host.querySelectorAll('[data-score-bar-number]')).toHaveLength(musicRows - 1)
  })
  it('drops the helper rows below dynamics', () => {
    const top = (score: ScoreDocument) => { draw({ score }); return parseFloat((host.querySelector('.ps-staff-name') as HTMLElement).style.top) }
    const plain = top(scale())
    const loud = top(scale({}, () => [60, 62, 64, 65].map(midi => ({ kind: 'note', midi, durationQN: 1, dynamic: 'f' }))))
    expect(loud).toBeGreaterThan(plain + 15)
  })
})

describe('review fixes', () => {
  it('counts a blank bar inside its own bar, not over the previous one', () => {
    const blank = scale({}, bar => bar === 2 ? [] : [60, 62, 64, 65].map(midi => ({ kind: 'note', midi, durationQN: 1 })))
    draw({ score: blank, layoutMode: 'scroll' })
    const lefts = [...host.querySelectorAll('.ps-staff-count')].map(el => parseFloat((el as HTMLElement).style.left))
    // One line: eight counts per bar, in bar order.
    expect(lefts).toHaveLength(32)
    const bar = (k: number) => lefts.slice(k * 8, k * 8 + 8)
    expect(Math.min(...bar(1))).toBeGreaterThan(Math.max(...bar(0)))
    expect(Math.max(...bar(1))).toBeLessThan(Math.min(...bar(2)))
    // Spread across the bar rather than bunched in the previous bar's tail.
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
    expect(range(bar(1))).toBeGreaterThan(range(bar(0)) * .5)
  })
  it('plain engraving (helpers off) draws no helpers and dims no rows, for the Studio previews', () => {
    draw({ helpers: false, currentMs: 2500 })
    expect(host.querySelectorAll('.ps-staff-name, .ps-staff-count, .ps-staff-next')).toHaveLength(0)
    expect(host.querySelectorAll('[data-row-state]')).toHaveLength(0)
  })
})

describe('note states for every voice (minors)', () => {
  /** Voice 1: four quarters; voice 2: two halves underneath. */
  const twoVoices = () => {
    const score = scale()
    score.tracks[0].measures.forEach(m => m.voices.push({ number: 2, events: [48, 50].map(midi => ({ kind: 'note', midi, durationQN: 2 })) } as never))
    return score
  }
  const voice2 = () => [...host.querySelectorAll('[data-score-note][data-voice="2"]')].map(n => n.getAttribute('data-note-state'))
  it('dims and lights voice-2 notes too, and clears them on a seek back', () => {
    draw({ score: twoVoices(), currentMs: 1200 })
    expect(voice2().slice(0, 3)).toEqual(['played', 'active', 'upcoming'])
    draw({ score: twoVoices(), currentMs: 100 })
    expect(voice2().slice(0, 2)).toEqual(['active', 'upcoming'])
  })
  it('never lights a sounding rest, and dims it once it has passed', () => {
    const rests = scale({}, () => [{ kind: 'note', midi: 60, durationQN: 1 }, { kind: 'rest', durationQN: 1 }, { kind: 'note', midi: 64, durationQN: 2 }])
    draw({ score: rests, currentMs: 700 })
    expect(states().slice(0, 3)).toEqual(['played', 'upcoming', 'upcoming'])
    draw({ score: rests, currentMs: 1200 })
    expect(states().slice(0, 3)).toEqual(['played', 'played', 'active'])
  })
  it('does not dim played notes twice inside a faded past row', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('components/playsense-studio/player/notation/renderers/staff-renderer.css', 'utf8')
    expect(css).toMatch(/\[data-row-state=past\] \[data-score-note\]\[data-note-state=played\][^{]*\{ opacity:1; \}/)
    expect(css).toMatch(/\[data-row-state=past\] \.ps-staff-name\[data-past=true\][^{]*\{ opacity:1; \}/)
  })
})

describe('paged interludes and turns (minors)', () => {
  const click = (el: Element) => {
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 4, clientY: 90 }))
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 4, clientY: 90 }))
  }
  it('a click beside the interlude box on an interlude page seeks nowhere', () => {
    const onSeek = vi.fn()
    draw({ layoutMode: 'paged', currentMs: -500, leadingGapMs: 1000, onSeek })
    click(host.querySelector('.ps-staff-content')!)
    expect(onSeek).not.toHaveBeenCalled()
  })
  it('a click on a music page still seeks', () => {
    const onSeek = vi.fn()
    draw({ layoutMode: 'paged', currentMs: 500, onSeek })
    click(host.querySelector('.ps-staff-content')!)
    expect(onSeek).toHaveBeenCalledTimes(1)
  })
  it('fades the playhead, band, ring and loop markers in with the new page instead of jumping', () => {
    const animated: Array<{ el: Element; frames: Keyframe[] }> = []
    const animate = vi.fn(function (this: Element, frames: Keyframe[]) {
      animated.push({ el: this, frames })
      return { cancel() {}, onfinish: null } as unknown as Animation
    })
    const restore = [Element.prototype.animate, (Element.prototype as { getAnimations?: unknown }).getAnimations]
    Element.prototype.animate = animate as never
    ;(Element.prototype as { getAnimations?: unknown }).getAnimations = () => []
    try {
      draw({ layoutMode: 'paged', currentMs: 500, loopAMs: 2200, loopBMs: 3000 })
      animated.length = 0
      draw({ layoutMode: 'paged', currentMs: 2500, loopAMs: 2200, loopBMs: 3000 })
      const fadedIn = (el: Element | null) => animated.some(a => a.el === el && a.frames[0]?.opacity === 0 && (a.frames.at(-1)?.offset ?? 1) < 1)
      expect(fadedIn(host.querySelector('.ps-staff-playhead'))).toBe(true)
      expect(fadedIn(host.querySelector('.ps-staff-band'))).toBe(true)
      expect(fadedIn(host.querySelector('.ps-staff-next'))).toBe(true)
      for (const marker of host.querySelectorAll('[data-playsense-studio-loop-marker]')) expect(fadedIn(marker)).toBe(true)
    } finally {
      Element.prototype.animate = restore[0] as never
      ;(Element.prototype as { getAnimations?: unknown }).getAnimations = restore[1]
    }
  })
})

describe('paged row in a tall pane (minors)', () => {
  it('fills its pane and centres the one-row viewport vertically', async () => {
    draw({ layoutMode: 'paged' })
    const el = host.querySelector('.ps-score-engraving') as HTMLElement
    const viewport = host.querySelector('.ps-staff-viewport') as HTMLElement
    expect(el.style.height).toBe('100%')
    expect(el.style.minHeight).toBe(viewport.style.height)
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('components/playsense-studio/player/notation/renderers/staff-renderer.css', 'utf8')
    expect(css).toMatch(/\[data-score-layout-mode=paged\] \{[^}]*display:flex;[^}]*flex-direction:column/)
    expect(css).toMatch(/\[data-score-layout-mode=paged\] \.ps-staff-viewport \{[^}]*margin-block:auto/)
  })
  it('keeps the scroll line at its own height', () => {
    draw({ layoutMode: 'scroll' })
    const el = host.querySelector('.ps-score-engraving') as HTMLElement
    expect(el.style.height).toMatch(/px$/)
    expect(el.style.minHeight).toBe('')
  })
})
