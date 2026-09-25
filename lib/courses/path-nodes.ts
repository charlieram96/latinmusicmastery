// Pure helpers for the Duolingo-style lesson path (course detail + dashboard).
// No React or Supabase imports so everything here is unit-testable.

import { classHref, moduleOverviewHref, videoDurationSeconds } from './structure'

export type PathLessonType = 'video' | 'play' | 'quiz' | 'other'
export type PathState = 'done' | 'current' | 'upcoming'

export interface PathLessonNode {
  kind: 'lesson'
  id: string
  /** 1-based position across the whole course. */
  number: number
  moduleIndex: number
  title: string
  state: PathState
  types: PathLessonType[]
  /** Rounded video minutes, or null when the lesson has no timed video. */
  minutes: number | null
  href: string
}

export interface PathCheckpointNode {
  kind: 'checkpoint'
  id: string
  moduleIndex: number
  moduleTitle: string
  state: 'done' | 'upcoming'
  href: string
}

export type PathNode = PathLessonNode | PathCheckpointNode

export interface PathGap {
  kind: 'gap'
  id: string
  count: number
}

export type PathItem = PathNode | PathGap

export interface PathSectionInput {
  id: string
  title: string
  classes: {
    id: string
    title: string
    totalItems: number
    completedItems: number
    items?: { item_type: string; video_duration_seconds: number | null }[]
  }[]
}

const TYPE_OF: Record<string, PathLessonType> = {
  VIDEO: 'video',
  EXERCISE: 'play',
  JAM_SESSION: 'play',
  QUIZ: 'quiz',
}

const isDone = (c: { totalItems: number; completedItems: number }) =>
  c.totalItems > 0 && c.completedItems >= c.totalItems

/** One node per lesson plus a checkpoint closing each non-empty module. */
export function buildPathNodes(
  courseId: string,
  sections: PathSectionInput[],
  currentClassId: string | null
): PathNode[] {
  const all = sections.flatMap((s) => s.classes)
  const known = currentClassId !== null && all.some((c) => c.id === currentClassId)
  const currentId = known ? currentClassId : all.find((c) => !isDone(c))?.id ?? null

  const nodes: PathNode[] = []
  let number = 0
  sections.forEach((section, moduleIndex) => {
    if (section.classes.length === 0) return
    for (const c of section.classes) {
      number += 1
      const types: PathLessonType[] = []
      for (const item of c.items ?? []) {
        const t = TYPE_OF[item.item_type] ?? 'other'
        if (!types.includes(t)) types.push(t)
      }
      const seconds = videoDurationSeconds(c.items)
      nodes.push({
        kind: 'lesson',
        id: c.id,
        number,
        moduleIndex,
        title: c.title,
        state: c.id === currentId ? 'current' : isDone(c) ? 'done' : 'upcoming',
        types,
        minutes: seconds > 0 ? Math.round(seconds / 60) : null,
        href: classHref(courseId, c.id),
      })
    }
    nodes.push({
      kind: 'checkpoint',
      id: `checkpoint-${section.id}`,
      moduleIndex,
      moduleTitle: section.title,
      state: section.classes.every(isDone) ? 'done' : 'upcoming',
      href: moduleOverviewHref(courseId, section.id),
    })
  })
  return nodes
}

/**
 * A short slice of the path for compact cards: `before` lessons, the current
 * one, `after` lessons, then (if any lessons were skipped) a gap, then the
 * checkpoint of the current module. With nothing current, the slice ends at
 * the last node of the course.
 */
export function pathWindow(nodes: PathNode[], opts: { before: number; after: number }): PathItem[] {
  if (nodes.length === 0) return []
  let anchor = nodes.findIndex((n) => n.state === 'current')
  if (anchor === -1) {
    // Finished: anchor on the last lesson.
    for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].kind === 'lesson') { anchor = i; break }
  }
  const moduleIndex = nodes[anchor].moduleIndex
  const checkpointIndex = nodes.findIndex((n, i) => i > anchor && n.kind === 'checkpoint' && n.moduleIndex === moduleIndex)

  let start = anchor
  let lessonsBefore = 0
  for (let i = anchor - 1; i >= 0 && lessonsBefore < opts.before; i--) {
    start = i
    if (nodes[i].kind === 'lesson') lessonsBefore += 1
  }
  let end = anchor
  let lessonsAfter = 0
  for (let i = anchor + 1; i < nodes.length && lessonsAfter < opts.after; i++) {
    if (i === checkpointIndex) break
    end = i
    if (nodes[i].kind === 'lesson') lessonsAfter += 1
  }

  const out: PathItem[] = nodes.slice(start, end + 1)
  if (checkpointIndex !== -1) {
    const hidden = nodes.slice(end + 1, checkpointIndex).filter((n) => n.kind === 'lesson').length
    if (hidden > 0) out.push({ kind: 'gap', id: `gap-${moduleIndex}`, count: hidden })
    out.push(nodes[checkpointIndex])
  }
  return out
}
