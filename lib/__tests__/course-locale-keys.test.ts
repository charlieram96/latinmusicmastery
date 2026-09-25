import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (o: unknown, path: string) => path.split('.').reduce<any>((a, k) => a?.[k], o)
const KEYS = ['path.heading', 'path.doneOfOne', 'path.doneOf', 'path.module', 'path.goToLesson', 'syllabus.showAll', 'syllabus.showFewer', 'syllabus.go']

describe('course page locale keys', () => {
  it.each(KEYS)('%s exists in en and es', (k) => {
    expect(typeof get(en, `dashboard.pages.course.${k}`)).toBe('string')
    expect(typeof get(es, `dashboard.pages.course.${k}`)).toBe('string')
  })

  it('Spanish path types use the same terms as the course item types', () => {
    const c = get(es, 'dashboard.pages.course')
    expect(c.path.types.quiz).toBe(c.itemTypes.QUIZ)
    expect(c.path.types.video).toBe(c.itemTypes.VIDEO)
  })
})
