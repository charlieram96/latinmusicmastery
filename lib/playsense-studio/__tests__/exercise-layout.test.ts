import { describe, expect, it } from 'vitest'
import { scorePanelBounds, scorePanelSize } from '../exercise-layout'

describe('responsive exercise score panel', () => {
  it('preserves stage space and keeps the side score within readable bounds', () => {
    const bounds = scorePanelBounds(900, 800, false)
    expect(bounds).toEqual({ min: 280, max: 560, extent: 900 })
    expect(scorePanelSize(.4, bounds)).toBe(360)
    expect(scorePanelSize(1, bounds)).toBe(560)
    expect(scorePanelSize(0, bounds)).toBe(280)
  })
  it('caps an expanded panel on large monitors and preserves its chosen proportion on resize', () => {
    expect(scorePanelSize(.8, scorePanelBounds(1800, 900, false))).toBe(960)
    expect(scorePanelSize(.45, scorePanelBounds(1000, 900, false))).toBe(450)
    expect(scorePanelSize(.45, scorePanelBounds(800, 900, false))).toBe(360)
  })
  it('switches to an adjustable height while preserving a visible mobile stage', () => {
    const bounds = scorePanelBounds(390, 700, true)
    expect(bounds).toEqual({ min: 200, max: 455, extent: 700 })
    expect(scorePanelSize(.44, bounds)).toBe(308)
    expect(scorePanelSize(1, bounds)).toBe(455)
    expect(700 - bounds.max).toBeGreaterThanOrEqual(220)
  })
  it('keeps valid limits in short or initially hidden containers', () => {
    for (const [width, height] of [[390, 300], [0, 0]]) {
      const bounds = scorePanelBounds(width, height, true)
      expect(bounds.min).toBeLessThanOrEqual(bounds.max)
      expect(scorePanelSize(.44, bounds)).toBeGreaterThanOrEqual(0)
      expect(scorePanelSize(.44, bounds)).toBeLessThanOrEqual(Math.max(1, height))
    }
  })
})
