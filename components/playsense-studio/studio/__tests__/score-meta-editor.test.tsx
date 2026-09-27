// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScoreMetaEditor } from '../score-meta-editor'
import type { ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types'

const score = (initialTempo: number): ScoreDocument => ({
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo,
  initialTimeSignature: [4, 4], initialKeyFifths: 0, tracks: [],
})

const track = (): Track => ({
  index: 0, instrument: 'guitar', displayName: 'Track 1', tuning: null,
  stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [],
})

let root: Root
let host: HTMLDivElement
let dispatch: ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  dispatch = vi.fn()
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

function render(tempo: number) {
  act(() => { root.render(<ScoreMetaEditor score={score(tempo)} dispatch={dispatch} />) })
  return host.querySelector<HTMLInputElement>('input[aria-label="Tempo (BPM)"]')!
}

function renderWithTrack() {
  act(() => {
    root.render(<ScoreMetaEditor score={{ ...score(120), tracks: [track()] }} dispatch={dispatch} />)
  })
}

const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
function type(input: HTMLInputElement, value: string) {
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function key(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) {
  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })) })
}

describe('tempo field', () => {
  it('shows a draft while typing without dispatching', () => {
    const input = render(120)
    act(() => input.focus())
    type(input, '')
    type(input, '9')
    type(input, '90')
    expect(input.value).toBe('90')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('commits the typed tempo once on Enter', () => {
    const input = render(120)
    act(() => input.focus())
    type(input, '9')
    type(input, '90')
    key(input, 'Enter')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-score-meta', initialTempo: 90 })
  })

  it('commits on blur', () => {
    const input = render(120)
    act(() => input.focus())
    type(input, '8')
    type(input, '85')
    act(() => input.blur())
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-score-meta', initialTempo: 85 })
  })

  it('reverts on Escape and on an empty draft', () => {
    const input = render(120)
    act(() => input.focus())
    type(input, '7')
    key(input, 'Escape')
    expect(input.value).toBe('120')
    act(() => input.focus())
    type(input, '')
    act(() => input.blur())
    expect(input.value).toBe('120')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('steps by one with the arrows and by ten with Shift', () => {
    const input = render(120)
    key(input, 'ArrowUp')
    key(input, 'ArrowDown', { shiftKey: true })
    expect(dispatch.mock.calls.map(c => c[0])).toEqual([
      { type: 'set-score-meta', initialTempo: 121 },
      { type: 'set-score-meta', initialTempo: 110 },
    ])
  })

  it('reflects an outside tempo change while idle', () => {
    const input = render(120)
    act(() => { root.render(<ScoreMetaEditor score={score(96)} dispatch={dispatch} />) })
    expect(input.value).toBe('96')
  })
})

describe('track fields (moved from the editor row)', () => {
  it('edits the track name and instrument (moved from the editor row)', () => {
    renderWithTrack()
    const name = host.querySelector('input[aria-label="Track name"]') as HTMLInputElement
    const inst = host.querySelector('select[aria-label="Instrument"]') as HTMLSelectElement
    expect(name).not.toBeNull()
    expect(inst).not.toBeNull()
    act(() => { inst.value = 'perc-conga'; inst.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-track-instrument', trackIndex: 0, instrument: 'perc-conga' })
  })

  it('edits the track name', () => {
    renderWithTrack()
    const name = host.querySelector('input[aria-label="Track name"]') as HTMLInputElement
    act(() => {
      setter.call(name, 'New name')
      name.dispatchEvent(new Event('input', { bubbles: true }))
      name.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'set-track-name', trackIndex: 0, name: 'New name' })
  })

  it('renders neither field when the track is missing', () => {
    act(() => { root.render(<ScoreMetaEditor score={score(120)} dispatch={dispatch} />) })
    expect(host.querySelector('input[aria-label="Track name"]')).toBeNull()
    expect(host.querySelector('select[aria-label="Instrument"]')).toBeNull()
  })
})
