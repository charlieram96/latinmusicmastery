import { describe, expect, it } from 'vitest'
import {
  PLAY_WORKSPACE, WATCH_WORKSPACE, effectiveLayout, leadingSplit, nearestCorner, nudgeSplit,
  parseWorkspaceState, resizePipWidth, serializeWorkspaceState, snapSplit, splitFromPointer,
  swapWorkspace, workspaceStorageKey, MUSIC_SPLIT_BOUNDS,
} from '../workspace-layout'

describe('split maths', () => {
  it('snaps within ±2.2 of a third, a half and two thirds', () => {
    expect(snapSplit(48)).toBe(50)
    expect(snapSplit(52.2)).toBe(50)
    expect(snapSplit(52.3)).toBe(52.3)
    expect(snapSplit(31.5)).toBeCloseTo(33.333, 2)
    expect(snapSplit(68.8)).toBeCloseTo(66.667, 2)
  })
  it('turns a pointer into a clamped, snapped, rounded share', () => {
    expect(splitFromPointer(100 + 480, 100, 1000)).toBe(50)
    expect(splitFromPointer(100 + 440, 100, 1000)).toBe(44)
    expect(splitFromPointer(100 + 50, 100, 1000)).toBe(22)
    expect(splitFromPointer(100 + 990, 100, 1000)).toBe(78)
    expect(splitFromPointer(100 + 330, 100, 1000)).toBe(33.3)
    expect(splitFromPointer(0, 0, 0)).toBe(50)
    expect(splitFromPointer(10, 0, 100, MUSIC_SPLIT_BOUNDS)).toBe(25)
  })
  it('nudges by the step and stays in bounds', () => {
    expect(nudgeSplit(44, 2)).toBe(46)
    expect(nudgeSplit(77, 2)).toBe(78)
    expect(nudgeSplit(23, -2)).toBe(22)
  })
  it('reads the leading region share from the media share', () => {
    expect(leadingSplit(44, false)).toBe(44)
    expect(leadingSplit(44, true)).toBe(56)
    expect(leadingSplit(leadingSplit(33.3, true), true)).toBe(33.3)
  })
})

describe('picture in picture', () => {
  const box = { left: 0, top: 0, width: 1000, height: 600 }
  it('picks the nearest corner by the centre of the dropped video', () => {
    expect(nearestCorner({ x: 900, y: 500 }, box)).toBe('br')
    expect(nearestCorner({ x: 100, y: 500 }, box)).toBe('bl')
    expect(nearestCorner({ x: 900, y: 100 }, box)).toBe('tr')
    expect(nearestCorner({ x: 100, y: 100 }, box)).toBe('tl')
  })
  it('grows from the inner corner and clamps to 18–50 %', () => {
    expect(resizePipWidth(24, -100, 'br', 1000)).toBe(34)
    expect(resizePipWidth(24, 100, 'bl', 1000)).toBe(34)
    expect(resizePipWidth(24, 100, 'tr', 1000)).toBe(18)
    expect(resizePipWidth(24, -900, 'br', 1000)).toBe(50)
    expect(resizePipWidth(24, 50, 'br', 0)).toBe(24)
  })
})

describe('layouts', () => {
  it('shows side as stack on phones', () => {
    expect(effectiveLayout('side', true)).toBe('stack')
    expect(effectiveLayout('pip', true)).toBe('pip')
    expect(effectiveLayout('side', false)).toBe('side')
  })
  it('swap keeps the media share and brings the video back from music only', () => {
    expect(swapWorkspace(WATCH_WORKSPACE)).toEqual({ ...WATCH_WORKSPACE, swap: true })
    expect(swapWorkspace({ ...WATCH_WORKSPACE, layout: 'music' })).toEqual({ ...WATCH_WORKSPACE, layout: 'side', swap: true })
    expect(swapWorkspace(PLAY_WORKSPACE).corner).toBe('bl')
    expect(swapWorkspace({ ...PLAY_WORKSPACE, corner: 'tl' }).corner).toBe('tr')
  })
  it('defaults: watch side 44, play pip 24 % bottom right', () => {
    expect(WATCH_WORKSPACE).toMatchObject({ layout: 'side', split: 44 })
    expect(PLAY_WORKSPACE).toMatchObject({ layout: 'pip', pipWidth: 24, corner: 'br' })
  })
})

describe('persistence', () => {
  it('keys per view kind', () => {
    expect(workspaceStorageKey('watch:wrapped')).toBe('lmm-workspace:watch:wrapped')
  })
  it('round-trips', () => {
    const s = { ...PLAY_WORKSPACE, split: 60, corner: 'tl' as const, swap: true }
    expect(parseWorkspaceState(serializeWorkspaceState(s), WATCH_WORKSPACE)).toEqual(s)
  })
  it('parse falls back per field', () => {
    expect(parseWorkspaceState(null, WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    expect(parseWorkspaceState('{', WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    expect(parseWorkspaceState('[1]', WATCH_WORKSPACE)).toEqual(WATCH_WORKSPACE)
    const odd = JSON.stringify({ layout: 'diagonal', split: 'x', musicSplit: 99, corner: 'mid', pipWidth: 5, swap: 'yes' })
    expect(parseWorkspaceState(odd, WATCH_WORKSPACE)).toEqual({ ...WATCH_WORKSPACE, musicSplit: 80, pipWidth: 18 })
    expect(parseWorkspaceState(JSON.stringify({ split: 95 }), WATCH_WORKSPACE).split).toBe(78)
  })
  it('drops a layout the view does not offer', () => {
    const raw = JSON.stringify({ ...WATCH_WORKSPACE, layout: 'pip' })
    expect(parseWorkspaceState(raw, WATCH_WORKSPACE, ['side', 'stack']).layout).toBe('side')
  })
})
