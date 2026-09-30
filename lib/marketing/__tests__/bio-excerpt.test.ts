import { describe, expect, it } from 'vitest'
import { bioExcerpt } from '../bio-excerpt'

const p = (text: string, bold = false) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] })
const h = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] })
const doc = (...content: unknown[]) => ({ type: 'doc', content })

describe('bioExcerpt', () => {
  it('skips headings, bold title lines and short label lines', () => {
    const d = doc(p('Biography Patricio Díaz', true), p('PATRICIO DÍAZ NÁPOLES'), h('Biography'), p('Patricio was born in Camagüey City, a province of Cuba, in 1974.'))
    expect(bioExcerpt(d)).toBe('Patricio was born in Camagüey City, a province of Cuba, in 1974.')
  })
  it('joins hard-wrapped paragraphs that follow', () => {
    const d = doc(p('He started his elementary studies of music at the school, and then he'), p('attended the Higher Institute.'))
    expect(bioExcerpt(d)).toBe('He started his elementary studies of music at the school, and then he attended the Higher Institute.')
  })
  it('cuts at a word boundary with an ellipsis', () => {
    const d = doc(p('one two three four five six seven eight nine ten eleven twelve'))
    expect(bioExcerpt(d, 30)).toBe('one two three four five six…')
  })
  it('returns an empty string for missing or empty docs', () => {
    expect(bioExcerpt(null)).toBe('')
    expect(bioExcerpt(doc(h('Only a heading')))).toBe('')
    expect(bioExcerpt('not a doc')).toBe('')
  })
})
