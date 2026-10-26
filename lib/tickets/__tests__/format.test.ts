import { describe, expect, it } from 'vitest'
import { dateBadge, formatEventTime, formatMoney, pickLocalized, utcToZonedLocal, zonedLocalToUtc } from '../format'

describe('event time zones', () => {
  it('converts venue wall-clock time to UTC and back', () => {
    expect(zonedLocalToUtc('2026-11-21T20:00', 'America/New_York')).toBe('2026-11-22T01:00:00.000Z')
    expect(zonedLocalToUtc('2026-07-04T20:00', 'America/New_York')).toBe('2026-07-05T00:00:00.000Z')
    expect(zonedLocalToUtc('2026-11-21T20:00', 'Europe/Madrid')).toBe('2026-11-21T19:00:00.000Z')
    expect(utcToZonedLocal('2026-11-22T01:00:00.000Z', 'America/New_York')).toBe('2026-11-21T20:00')
    expect(utcToZonedLocal('2026-07-05T00:00:00.000Z', 'America/New_York')).toBe('2026-07-04T20:00')
    expect(zonedLocalToUtc('nope', 'UTC')).toBeNull()
  })

  it('formats in the event zone regardless of the server zone', () => {
    expect(formatEventTime('2026-11-22T01:00:00Z', 'America/New_York', 'en')).toBe('8:00 PM EST')
    expect(dateBadge('2026-11-22T01:00:00Z', 'America/New_York', 'en')).toEqual({ month: 'NOV', day: '21' })
  })
})

describe('money and localisation', () => {
  it('formats whole and fractional amounts', () => {
    expect(formatMoney(2500, 'usd', 'en')).toBe('$25')
    expect(formatMoney(2550, 'usd', 'en')).toBe('$25.50')
  })
  it('falls back to English when no Spanish variant was authored', () => {
    expect(pickLocalized('Hello', 'Hola', 'es')).toBe('Hola')
    expect(pickLocalized('Hello', '  ', 'es')).toBe('Hello')
    expect(pickLocalized('Hello', 'Hola', 'en')).toBe('Hello')
  })
})
