import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ order: async () => ({ data: [
    { name: 'Saxophone' }, { name: 'Trumpet' }, { name: ' Voice ' }, { name: 'Flute' },
  ], error: null }) }) }) }),
}))
import { getCourseInstrumentOptions } from '../instrument-options'
import { selectedCourseInstrument } from '../instrument-classification'

it('offers catalog instruments in creation, editing, filtering and saving without teacher specialties', async () => {
  const choices = await getCourseInstrumentOptions()
  expect(choices).toContain('Saxophone')
  expect(choices).toContain('Trumpet')
  expect(choices).toContain('Flute')
  expect(choices.filter((value) => value === 'Voice')).toHaveLength(1)
  expect(choices.slice(-3)).toEqual(['Theoretical', 'Demonstrative', 'Practical'])
  expect(selectedCourseInstrument('Flute', choices)).toBe('Flute')
})

import { sortCourseInstruments } from '@/lib/instruments'
it('sorts by the visible language without mutating stored choices', () => {
  const original = ['Theoretical', 'Trumpet', 'Drums', 'Bass', 'Saxophone', 'Practical']
  expect(sortCourseInstruments(original, 'es')).toEqual(['Bass', 'Drums', 'Practical', 'Saxophone', 'Theoretical', 'Trumpet'])
  expect(sortCourseInstruments(['Theoretical', 'Trumpet', 'Voice', 'Violin'], 'es')).toEqual(['Theoretical', 'Trumpet', 'Violin', 'Voice'])
  expect(original[0]).toBe('Theoretical')
})
