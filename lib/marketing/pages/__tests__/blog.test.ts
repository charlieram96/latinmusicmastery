import { describe, expect, it } from 'vitest'
import { parseInline, parsePostBody, postCategories, readingMinutes } from '../blog'

describe('parseInline', () => {
  it('splits **bold** runs', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }])
  })
  it('returns plain text as one run', () => {
    expect(parseInline('plain')).toEqual([{ text: 'plain' }])
  })
})

describe('parsePostBody', () => {
  it('parses headings, numbered lists and paragraphs, skipping blank lines', () => {
    const body = 'Intro **line**\n\n## Heading\n1. One\n2. Two\nClosing'
    expect(parsePostBody(body)).toEqual([
      { type: 'p', runs: [{ text: 'Intro ' }, { text: 'line', bold: true }] },
      { type: 'h2', runs: [{ text: 'Heading' }] },
      { type: 'ol', items: [[{ text: 'One' }], [{ text: 'Two' }]] },
      { type: 'p', runs: [{ text: 'Closing' }] },
    ])
  })
  it('returns no blocks for empty content', () => {
    expect(parsePostBody('')).toEqual([])
  })
})

describe('readingMinutes', () => {
  it('is one minute per thousand characters, at least one', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('x'.repeat(2500))).toBe(3)
  })
})

describe('postCategories', () => {
  it('lists distinct categories in first-seen order', () => {
    expect(postCategories([{ category: 'News' }, { category: 'History' }, { category: 'News' }, { category: '' }])).toEqual(['News', 'History'])
  })
})
