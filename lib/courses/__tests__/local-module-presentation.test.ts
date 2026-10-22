import { expect, it } from 'vitest'
import { separateTimbalWelcome, TIMBAL_BASIC_MODULE, TIMBAL_WELCOME_CLASS, TIMBAL_WELCOME_MODULE } from '../local-module-presentation'
it('moves the introduction intact, preserving every other class and subsequent module', () => {
  const items = [{ id: 'uploaded-video', video_url: '/original.mp4' }]
  const sections = [
    { id: TIMBAL_BASIC_MODULE, order_index: 0, classes: [{ id: TIMBAL_WELCOME_CLASS, items }, ...Array.from({ length: 10 }, (_, i) => ({ id: `technical-${i}`, items: [] }))] },
    { id: 'son', order_index: 1, classes: [{ id: 'son-class', items: [] }] },
  ]
  separateTimbalWelcome(sections)
  expect(sections.map(s => s.id)).toEqual([TIMBAL_WELCOME_MODULE, TIMBAL_BASIC_MODULE, 'son'])
  expect(sections.map(s => s.order_index)).toEqual([0, 1, 2])
  expect(sections.map(s => s.classes.length)).toEqual([1, 10, 1])
  expect(sections[0].classes[0].items).toBe(items)
  separateTimbalWelcome(sections)
  expect(sections).toHaveLength(3)
})
it('leaves unrelated courses unchanged',()=>{
 const sections=[{id:'other',classes:[{id:'lesson'}]}]
 const before=JSON.stringify(sections);separateTimbalWelcome(sections);expect(JSON.stringify(sections)).toBe(before)
})
