import { describe, expect, it } from 'vitest'
import { displayName, presentTeacher, tidySpecialties } from '../present-teacher'

describe('tidySpecialties', () => {
  it('drops trailing punctuation, a leading "and", blanks and duplicates, and capitalises', () => {
    expect(tidySpecialties(['jazz', 'Timba.', 'and classical music.', ' ', 'timba'])).toEqual(['Jazz', 'Timba', 'Classical music'])
  })
  it('handles null', () => {
    expect(tidySpecialties(null)).toEqual([])
  })
})

describe('presentTeacher', () => {
  it('keeps a real photo', () => {
    expect(presentTeacher({ name: 'A B', imageUrl: 'https://x/y.jpg', specialties: [] }).imageUrl).toBe('https://x/y.jpg')
  })
  it('falls back to the monogram', () => {
    expect(presentTeacher({ name: 'A B', imageUrl: null, specialties: [] }).imageUrl.startsWith('data:image/svg+xml')).toBe(true)
  })
})

describe('displayName', () => {
  it('curls and title-cases a quoted nickname', () => {
    expect(displayName('Patricio "el chino" Diaz')).toBe('Patricio “El Chino” Diaz')
  })
  it('leaves plain names alone', () => {
    expect(displayName('Leo Garcia')).toBe('Leo Garcia')
  })
})
