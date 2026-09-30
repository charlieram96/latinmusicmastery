import { describe, expect, it } from 'vitest'
import { INSTRUMENT_ORDER } from '../catalog'
import { PAD, SEATS, SEAT_GLYPHS, VIEWBOX, defaultSeatKey, isSoonSeat, seatByKey } from '../stage-plot'

describe('stage plot seats', () => {
  it('has exactly one seat for every instrument key', () => {
    expect(SEATS).toHaveLength(12)
    for (const key of INSTRUMENT_ORDER) expect(SEATS.filter(s => s.key === key), key).toHaveLength(1)
  })

  it('never lets two seat pads overlap', () => {
    for (let i = 0; i < SEATS.length; i++) {
      for (let j = i + 1; j < SEATS.length; j++) {
        const a = SEATS[i], b = SEATS[j]
        const apart = Math.abs(a.x - b.x) >= PAD.w || Math.abs(a.y - b.y) >= PAD.h
        expect(apart, `${a.key} vs ${b.key}`).toBe(true)
      }
    }
  })

  it('keeps every pad and its labels inside the view box', () => {
    for (const s of SEATS) {
      expect(s.x - PAD.w / 2).toBeGreaterThanOrEqual(0)
      expect(s.x + PAD.w / 2).toBeLessThanOrEqual(VIEWBOX.w)
      expect(s.y - PAD.h / 2).toBeGreaterThanOrEqual(0)
      expect(s.y + 90).toBeLessThanOrEqual(VIEWBOX.h)
    }
  })

  it('puts the sax inside the apron line', () => {
    expect(seatByKey('Saxophone')).toMatchObject({ x: 215, y: 450 })
  })

  it('has a glyph and both languages for every seat', () => {
    for (const s of SEATS) {
      expect(SEAT_GLYPHS[s.glyph], s.key).toBeTruthy()
      expect(s.name.en && s.name.es && s.note.en && s.note.es, s.key).toBeTruthy()
    }
  })
})

describe('defaultSeatKey', () => {
  it('picks the instrument with the most courses', () => {
    expect(defaultSeatKey([{ key: 'Timbal', total: 4 }, { key: 'Conga', total: 9 }, { key: 'Piano', total: 7 }])).toBe('Conga')
  })
  it('breaks ties by stage order', () => {
    expect(defaultSeatKey([{ key: 'Piano', total: 5 }, { key: 'Timbal', total: 5 }])).toBe('Timbal')
  })
  it('falls back to the first seat when nothing is live', () => {
    expect(defaultSeatKey([])).toBe(SEATS[0].key)
  })
})

describe('isSoonSeat', () => {
  it('is soon when the catalog has no course for the instrument', () => {
    const live = [{ key: 'Conga', total: 3 }, { key: 'Voice', total: 0 }]
    expect(isSoonSeat('Conga', live)).toBe(false)
    expect(isSoonSeat('Voice', live)).toBe(true)
    expect(isSoonSeat('Trumpet', live)).toBe(true)
  })
})
