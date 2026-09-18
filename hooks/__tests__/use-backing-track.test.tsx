// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useBackingTrack, type PlacedBackingTrack } from '../use-backing-track'
import type { BackingMix } from '@/lib/play-sense/backing-mix'

// A stand-in Web Audio graph: enough to see which gain each track is given
// and whether a later mix change ramps the running node instead of restarting.
function fakeContext() {
  const gains: Array<{ gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; connect: () => void; disconnect: () => void }> = []
  const sources: Array<{ start: ReturnType<typeof vi.fn> }> = []
  return {
    currentTime: 0,
    destination: {},
    gains,
    sources,
    createGain() {
      const node = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: () => {}, disconnect: () => {} }
      gains.push(node)
      return node
    },
    createBufferSource() {
      const node = { buffer: null, connect: () => {}, disconnect: () => {}, stop: () => {}, start: vi.fn(), onended: null }
      sources.push(node)
      return node
    },
  }
}

const tracks: PlacedBackingTrack[] = [
  { id: 'a', audioUrl: '/a.mp3', startSeconds: 0, trimInSeconds: 0, trimOutSeconds: null, gain: 0.8 },
  { id: 'b', audioUrl: '/b.mp3', startSeconds: 0, trimInSeconds: 0, trimOutSeconds: null, gain: 1 },
]

let hook: ReturnType<typeof useBackingTrack>
let root: Root
function Harness({ mix }: { mix: BackingMix }) {
  const value = useBackingTrack({ tracks, mix })
  useLayoutEffect(() => { hook = value }, [value])
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
  vi.stubGlobal('OfflineAudioContext', class { decodeAudioData = async () => ({ duration: 4 }) })
  root = createRoot(document.createElement('div'))
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it('applies the student mix on top of the authored level, and ramps it live', async () => {
  await act(async () => { root.render(<Harness mix={{ a: { level: 0.5, muted: false } }} />) })
  await act(async () => { await Promise.resolve() })
  expect(hook.isLoaded).toBe(true)
  const ctx = fakeContext()
  act(() => { hook.startPlayback(ctx as unknown as AudioContext, 1) })
  // master, then one node per track in order
  expect(ctx.gains.map(g => g.gain.value)).toEqual([1, 0.4, 1])
  expect(ctx.sources).toHaveLength(2)
  await act(async () => { root.render(<Harness mix={{ a: { level: 0.5, muted: true }, b: { level: 0.25, muted: false } }} />) })
  expect(ctx.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number))
  expect(ctx.gains[2].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, expect.any(Number))
  // Muting never reschedules: the same two sources keep running.
  expect(ctx.sources).toHaveLength(2)
})
