import { describe, expect, it } from 'vitest'
import { DEFAULT_TICKET_DESIGN, PRESET_COLORS, applyPreset, inkOn, normalizeTicketDesign } from '../design'

describe('normalizeTicketDesign', () => {
  it('returns the defaults for empty or junk input', () => {
    expect(normalizeTicketDesign({})).toEqual(DEFAULT_TICKET_DESIGN)
    expect(normalizeTicketDesign(null)).toEqual(DEFAULT_TICKET_DESIGN)
    expect(normalizeTicketDesign('nope')).toEqual(DEFAULT_TICKET_DESIGN)
  })

  it('keeps valid partial values and fills the rest', () => {
    const design = normalizeTicketDesign({ layout: 'pass', colors: { accent: '#123456' }, show: { barcode: false } })
    expect(design.layout).toBe('pass')
    expect(design.colors.accent).toBe('#123456')
    expect(design.colors.background).toBe(DEFAULT_TICKET_DESIGN.colors.background)
    expect(design.show.barcode).toBe(false)
    expect(design.show.date).toBe(true)
  })

  it('replaces invalid fields with defaults instead of failing', () => {
    const design = normalizeTicketDesign({
      layout: 'poster',
      colors: { text: 'red', muted: '#12345' },
      imageStrength: 4,
      logoUrl: 'javascript:alert(1)',
      eyebrow: { en: 'x'.repeat(500) },
    })
    expect(design.layout).toBe(DEFAULT_TICKET_DESIGN.layout)
    expect(design.colors.text).toBe(DEFAULT_TICKET_DESIGN.colors.text)
    expect(design.colors.muted).toBe(DEFAULT_TICKET_DESIGN.colors.muted)
    expect(design.imageStrength).toBe(DEFAULT_TICKET_DESIGN.imageStrength)
    expect(design.logoUrl).toBeNull()
    expect(design.eyebrow.en).toBe(DEFAULT_TICKET_DESIGN.eyebrow.en)
  })

  it('applies presets without touching other choices', () => {
    const design = applyPreset(normalizeTicketDesign({ layout: 'pass' }), 'papel')
    expect(design.preset).toBe('papel')
    expect(design.colors).toEqual(PRESET_COLORS.papel)
    expect(design.layout).toBe('pass')
  })

  it('picks readable ink for fills', () => {
    expect(inkOn('#FFFFFF')).toBe('#140C10')
    expect(inkOn('#100A13')).toBe('#FFFFFF')
    expect(inkOn('#FFA524')).toBe('#140C10')
  })
})
