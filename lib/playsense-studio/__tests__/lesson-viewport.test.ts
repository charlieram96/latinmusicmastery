import { describe, expect, it } from 'vitest'
import { lessonExerciseHeight } from '../lesson-viewport'

describe('lesson exercise viewport fit', () => {
  it('reserves the measured lesson header, footer and bottom breathing room', () => {
    const height = lessonExerciseHeight(940, 208, 0, 67)
    expect(208 + height + 12).toBe(940 - 67)
  })
  it('keeps the same height when the user scrolls the lesson', () => {
    expect(lessonExerciseHeight(940, -23, 231, 67)).toBe(lessonExerciseHeight(940, 208, 0, 67))
  })
  it('responds to shorter screens, wrapped headings, and taller navigation', () => {
    expect(lessonExerciseHeight(740, 248, 0, 83)).toBe(397)
    expect(lessonExerciseHeight(740, 208, 0, 67)).toBe(453)
  })
  it('also fits standalone previews without lesson navigation', () => {
    expect(lessonExerciseHeight(998, 0, 0, 0)).toBe(986)
    expect(lessonExerciseHeight(400, 420, 0, 67)).toBe(1)
  })
})
