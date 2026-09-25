import { describe, expect, it } from 'vitest'
import { partKind, partLabels, partProgress } from '../lesson-parts'

const t = (key: string) => ({
  'dashboard.classViewer.itemTypes.lesson': 'Lesson',
  'dashboard.pages.modules.exercise': 'Exercise',
  'dashboard.pages.modules.quiz': 'Quiz',
} as Record<string, string>)[key] ?? key

describe('lesson parts', () => {
  it('maps item types to part kinds', () => {
    expect(['VIDEO', 'EXERCISE', 'JAM_SESSION', 'QUIZ', 'OTHER'].map(partKind)).toEqual(['video', 'play', 'play', 'quiz', 'other'])
  })

  it('numbers repeated types and leaves single ones plain', () => {
    const items = [{ item_type: 'VIDEO' }, { item_type: 'EXERCISE' }, { item_type: 'EXERCISE' }, { item_type: 'QUIZ' }]
    expect(partLabels(items, t)).toEqual(['Lesson', 'Exercise 1', 'Exercise 2', 'Quiz'])
  })

  it.each([
    ['done', undefined, 100],
    ['active', 'saving', 50],
    ['active', 'in-progress', 50],
    ['active', 'error', 50],
    ['active', undefined, 12],
    ['todo', undefined, 0],
  ] as const)('%s / %s → %d%%', (state, status, pct) => expect(partProgress(state, status)).toBe(pct))
})
