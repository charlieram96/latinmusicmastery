import { describe, expect, it } from 'vitest'
import { lessonSegments, syllabusWindow } from '../syllabus-window'

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('syllabusWindow', () => {
  it('shows two before and two after the current lesson', () => {
    expect(syllabusWindow(ids, 'e')).toEqual({ visible: ['c', 'd', 'e', 'f', 'g'], collapsible: true })
  })

  it('shifts at module edges to keep five rows', () => {
    expect(syllabusWindow(ids, 'a').visible).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(syllabusWindow(ids, 'b').visible).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(syllabusWindow(ids, 'h').visible).toEqual(['d', 'e', 'f', 'g', 'h'])
    expect(syllabusWindow(ids, 'g').visible).toEqual(['d', 'e', 'f', 'g', 'h'])
  })

  it('a module shorter than the window shows every lesson', () => {
    expect(syllabusWindow(['a', 'b', 'c'], 'a')).toEqual({ visible: ['a', 'b', 'c'], collapsible: false })
  })

  it('no toggle when the window covers the module', () => {
    expect(syllabusWindow(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual({ visible: ['a', 'b', 'c', 'd', 'e'], collapsible: false })
  })

  it('nothing current collapses every module', () => {
    expect(syllabusWindow(ids, null)).toEqual({ visible: [], collapsible: true })
    expect(syllabusWindow(ids, 'elsewhere')).toEqual({ visible: [], collapsible: true })
    expect(syllabusWindow([], null)).toEqual({ visible: [], collapsible: false })
  })
})

describe('lessonSegments', () => {
  it('one segment per lesson, the current one filled by item progress', () => {
    expect(
      lessonSegments(
        [
          { id: 'a', totalItems: 2, completedItems: 2 },
          { id: 'b', totalItems: 4, completedItems: 1 },
          { id: 'c', totalItems: 0, completedItems: 0 },
        ],
        'b'
      )
    ).toEqual([{ state: 'done', fraction: 1 }, { state: 'current', fraction: 0.25 }, { state: 'upcoming', fraction: 0 }])
  })
})
