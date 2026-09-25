import { describe, expect, it } from 'vitest'
import { summarizeLessonProgress, type LessonProgressInput } from '../lesson-progress-summary'

const base: LessonProgressInput = {
  courseId: 'c', classId: 'k', currentIndex: 0, totalItems: 2, itemIds: ['a', 'b'], completedItemIds: [],
  nextClassId: 'k2', activeItemId: 'a', activeItemType: 'VIDEO', isCompleted: false, nextLabel: 'Montuno in F',
}

describe('summarizeLessonProgress', () => {
  it('is in progress before anything finishes, with the next part as destination', () => {
    const s = summarizeLessonProgress(base, {})
    expect(s).toMatchObject({ label: 'inProgress', done: false, lessonDone: false, next: 'part', hasNextPart: true,
      nextHref: '/dashboard/course/c/class/k?item=1', prevHref: null, completedCount: 0 })
    expect(s.detail).toEqual({ key: 'partsCompleted', params: { count: 0, total: 2 } })
  })

  it('names the finished part and what comes next', () => {
    const s = summarizeLessonProgress(base, { completedItemIds: ['a'] })
    expect(s).toMatchObject({ label: 'videoComplete', done: true, completedCount: 1 })
    expect(s.detail).toEqual({ key: 'upNext', params: { title: 'Montuno in F' } })
  })

  it('reports saving and failed saves', () => {
    expect(summarizeLessonProgress(base, { item: { activities: ['media'], status: 'saving' } }).label).toBe('savingProgress')
    const failed = summarizeLessonProgress(base, { item: { activities: ['media'], status: 'error' } })
    expect(failed).toMatchObject({ label: 'saveFailed', error: true, done: false })
  })

  it('reports a partly finished exercise', () => {
    const s = summarizeLessonProgress({ ...base, activeItemType: 'EXERCISE' }, { item: { activities: ['performance'], status: 'in-progress' } })
    expect(s.label).toBe('practiceComplete')
    expect(s.detail).toEqual({ key: 'finishQuestions' })
  })

  it('goes to the next lesson from the last part, and says the lesson is complete', () => {
    const s = summarizeLessonProgress({ ...base, currentIndex: 1, activeItemId: 'b' }, { completedItemIds: ['a', 'b'] })
    expect(s).toMatchObject({ label: 'lessonComplete', lessonDone: true, next: 'lesson', hasNextPart: false,
      nextHref: '/dashboard/course/c/class/k2', prevHref: '/dashboard/course/c/class/k?item=0' })
  })

  it('goes back to the course after the last lesson', () => {
    const s = summarizeLessonProgress({ ...base, currentIndex: 1, activeItemId: 'b', nextClassId: null }, {})
    expect(s).toMatchObject({ next: 'course', nextHref: '/dashboard/course/c' })
  })

  it('summarize: zero items never counts as done', () => {
    const s = summarizeLessonProgress({ ...base, totalItems: 0, itemIds: [], currentIndex: 0, activeItemId: null, activeItemType: null }, {})
    expect(s).toMatchObject({ done: false, lessonDone: false, next: 'lesson', completedCount: 0 })
    expect(s.detail).toEqual({ key: 'partsCompleted', params: { count: 0, total: 0 } })
  })

  it('ignores completions for items outside this lesson', () => {
    expect(summarizeLessonProgress(base, { completedItemIds: ['zzz'] }).completedCount).toBe(0)
  })
})
