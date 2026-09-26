import { describe, expect, it } from 'vitest'
import { buildPathNodes, pathWindow, type PathSectionInput } from '../path-nodes'

const cls = (id: string, done: number, total: number, items: { item_type: string; video_duration_seconds: number | null }[] = []) =>
  ({ id, title: `Lesson ${id}`, totalItems: total, completedItems: done, items })

const COURSE: PathSectionInput[] = [
  { id: 's1', title: 'Welcome', classes: [
    cls('a', 2, 2, [{ item_type: 'VIDEO', video_duration_seconds: 300 }, { item_type: 'QUIZ', video_duration_seconds: null }]),
    cls('b', 1, 3, [{ item_type: 'VIDEO', video_duration_seconds: 610 }, { item_type: 'EXERCISE', video_duration_seconds: null }, { item_type: 'VIDEO', video_duration_seconds: 50 }]),
    cls('c', 0, 1, [{ item_type: 'JAM_SESSION', video_duration_seconds: null }]),
  ] },
  { id: 's2', title: 'Rhythm', classes: [cls('d', 0, 1)] },
]

describe('buildPathNodes', () => {
  it('emits lessons in order with a checkpoint closing each module', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    expect(nodes.map((n) => n.kind === 'lesson' ? n.id : `cp:${n.moduleIndex}`)).toEqual(['a', 'b', 'c', 'cp:0', 'd', 'cp:1'])
  })

  it('numbers lessons across modules and links them', () => {
    const nodes = buildPathNodes('son', COURSE, null).filter((n) => n.kind === 'lesson')
    expect(nodes.map((n) => n.number)).toEqual([1, 2, 3, 4])
    expect(nodes[1]).toMatchObject({ href: '/dashboard/course/son/class/b', moduleIndex: 0 })
  })

  it('marks done lessons, then the first unfinished lesson as current', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['done', 'current', 'upcoming', 'upcoming'])
  })

  it('an explicit current lesson wins over progress', () => {
    const nodes = buildPathNodes('son', COURSE, 'c')
    expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['done', 'upcoming', 'current', 'upcoming'])
  })

  it('unknown current id falls back to the first unfinished lesson', () => {
    const nodes = buildPathNodes('son', COURSE, 'deleted-lesson')
    expect(nodes.find((n) => n.state === 'current')).toMatchObject({ id: 'b' })
  })

  describe('empty (0-item) lessons', () => {
    it('are never done and never the fallback current lesson (same rule as the server nextClassId)', () => {
      const nodes = buildPathNodes('son', [{ id: 's', title: 'S', classes: [cls('x', 1, 1), cls('e', 0, 0), cls('y', 0, 2)] }], null)
      expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['done', 'upcoming', 'current'])
    })

    it('do not keep a course from being finished, nor a checkpoint from being done', () => {
      const nodes = buildPathNodes('son', [{ id: 's', title: 'S', classes: [cls('x', 0, 0), cls('y', 1, 1)] }], null)
      expect(nodes.filter((n) => n.kind === 'lesson').map((n) => n.state)).toEqual(['upcoming', 'done'])
      expect(nodes.at(-1)).toMatchObject({ kind: 'checkpoint', state: 'done' })
    })

    it('a module of only empty lessons keeps its checkpoint upcoming', () => {
      const nodes = buildPathNodes('son', [
        { id: 's1', title: 'A', classes: [cls('x', 1, 1)] },
        { id: 's2', title: 'B', classes: [cls('e1', 0, 0), cls('e2', 0, 0)] },
      ], null)
      expect(nodes.filter((n) => n.kind === 'checkpoint').map((n) => n.state)).toEqual(['done', 'upcoming'])
      expect(nodes.some((n) => n.state === 'current')).toBe(false)
    })

    it('the caller current id (nextClassId) is used as is, so the path matches the syllabus', () => {
      const nodes = buildPathNodes('son', [{ id: 's', title: 'S', classes: [cls('e', 0, 0), cls('y', 0, 2), cls('z', 0, 1)] }], 'y')
      expect(nodes.find((n) => n.state === 'current')).toMatchObject({ id: 'y' })
    })
  })

  it('a class href from the caller wins (non-students go to subscribe, like syllabus rows)', () => {
    const nodes = buildPathNodes('son', [{ id: 's', title: 'S', classes: [{ ...cls('x', 0, 1), href: '/dashboard/subscribe?course=c' }, cls('y', 0, 1)] }], null)
    const lessons = nodes.filter((n) => n.kind === 'lesson')
    expect(lessons.map((n) => n.href)).toEqual(['/dashboard/subscribe?course=c', '/dashboard/course/son/class/y'])
  })

  it('finished course has no current and every checkpoint is done', () => {
    const done: PathSectionInput[] = [{ id: 's', title: 'S', classes: [cls('x', 1, 1), cls('y', 2, 2)] }]
    const nodes = buildPathNodes('son', done, null)
    expect(nodes.some((n) => n.state === 'current')).toBe(false)
    expect(nodes.at(-1)).toMatchObject({ kind: 'checkpoint', state: 'done' })
  })

  it('a finished course has no current even when a current id is passed', () => {
    const done: PathSectionInput[] = [{ id: 's', title: 'S', classes: [cls('x', 1, 1), cls('y', 2, 2)] }]
    const nodes = buildPathNodes('son', done, 'y')
    expect(nodes.some((n) => n.state === 'current')).toBe(false)
    expect(nodes.find((n) => n.kind === 'lesson' && n.id === 'y')).toMatchObject({ state: 'done' })
  })

  it('a checkpoint is done only when every lesson in its module is done', () => {
    const nodes = buildPathNodes('son', COURSE, null)
    const cps = nodes.filter((n) => n.kind === 'checkpoint')
    expect(cps.map((n) => n.state)).toEqual(['upcoming', 'upcoming'])
    expect(cps[0]).toMatchObject({ href: '/dashboard/course/son/module/s1', moduleTitle: 'Welcome' })
  })

  it('collects distinct lesson types in item order and rounds video minutes', () => {
    const b = buildPathNodes('son', COURSE, null).find((n) => n.kind === 'lesson' && n.id === 'b')
    expect(b).toMatchObject({ types: ['video', 'play'], minutes: 11 })
    const c = buildPathNodes('son', COURSE, null).find((n) => n.kind === 'lesson' && n.id === 'c')
    expect(c).toMatchObject({ types: ['play'], minutes: null })
  })

  it('skips empty modules', () => {
    const nodes = buildPathNodes('son', [{ id: 'e', title: 'Empty', classes: [] }, ...COURSE], null)
    expect(nodes.filter((n) => n.kind === 'checkpoint')).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ kind: 'lesson', id: 'a', moduleIndex: 1 })
  })
})

describe('pathWindow', () => {
  const long: PathSectionInput[] = [{ id: 'm', title: 'M', classes: Array.from({ length: 12 }, (_, i) => cls(`l${i}`, i < 6 ? 1 : 0, 1)) }]
  const nodes = buildPathNodes('son', long, null) // current = l6

  it('keeps `before` lessons, the current, `after` lessons, a gap, then the module checkpoint', () => {
    const w = pathWindow(nodes, { before: 2, after: 3 })
    expect(w.map((n) => n.kind === 'lesson' ? n.id : n.kind)).toEqual(['l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'gap', 'checkpoint'])
    expect(w.find((n) => n.kind === 'gap')).toMatchObject({ count: 2 })
  })

  it('no gap when the window reaches the checkpoint', () => {
    const w = pathWindow(nodes, { before: 2, after: 10 })
    expect(w.some((n) => n.kind === 'gap')).toBe(false)
    expect(w.at(-1)).toMatchObject({ kind: 'checkpoint' })
  })

  it('with nothing current, windows the end of the course', () => {
    const finished = buildPathNodes('son', [{ id: 'm', title: 'M', classes: [cls('x', 1, 1), cls('y', 1, 1), cls('z', 1, 1)] }], null)
    const w = pathWindow(finished, { before: 1, after: 3 })
    expect(w.map((n) => n.kind === 'lesson' ? n.id : n.kind)).toEqual(['y', 'z', 'checkpoint'])
  })
})
