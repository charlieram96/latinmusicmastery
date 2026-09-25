// The lesson rail's nodes: the lessons of the current lesson's module. Pure.

import { buildPathNodes, type PathLessonType, type PathSectionInput, type PathState } from './path-nodes'
import { classState } from './structure'

export interface RailLesson {
  id: string
  title: string
  href: string
  state: PathState
  /** Behind the subscription paywall for this student. */
  paywalled: boolean
  kind: PathLessonType
  minutes: number | null
  /** 1-based position within the module. */
  number: number
}

type RailSectionInput = PathSectionInput & { classes: (PathSectionInput['classes'][number] & { is_free?: boolean | null })[] }

/** A lesson with a play-along is a play-along; otherwise video, then quiz. */
function mainKind(types: PathLessonType[]): PathLessonType {
  for (const kind of ['play', 'video', 'quiz'] as const) if (types.includes(kind)) return kind
  return 'other'
}

export function railLessons(courseId: string, sections: RailSectionInput[], currentClassId: string, hasAccess: boolean): { lessons: RailLesson[]; moduleIndex: number } {
  const moduleIndex = sections.findIndex(s => s.classes.some(c => c.id === currentClassId))
  if (moduleIndex === -1) return { lessons: [], moduleIndex: -1 }
  const byId = new Map(sections[moduleIndex].classes.map(c => [c.id, c]))
  const nodes = buildPathNodes(courseId, sections, currentClassId)
  const lessons: RailLesson[] = []
  for (const node of nodes) {
    if (node.kind !== 'lesson' || node.moduleIndex !== moduleIndex) continue
    const cls = byId.get(node.id)!
    lessons.push({
      id: node.id, title: node.title, href: node.href, state: node.state,
      paywalled: classState({ id: cls.id, isFree: cls.is_free ?? false, totalItems: cls.totalItems, completedItems: cls.completedItems }, null, hasAccess) === 'locked',
      kind: mainKind(node.types), minutes: node.minutes, number: lessons.length + 1,
    })
  }
  return { lessons, moduleIndex }
}
