import { partLabels } from './lesson-parts'
type Part = { id: string; title: string; item_type: string }
type Destination = { title: string; href: string; classId: string; itemId?: string }
type Entry = { id: string; title: string; href?: string }
export function activitySequence({ courseId, classId, classes, parts, activeIndex, t }: {
  courseId: string; classId: string; classes: Entry[]; parts: Part[]; activeIndex: number; t: (key: string) => string
}) {
  const index = classes.findIndex(c => c.id === classId)
  const lesson = classes[index]
  const classDestination = (entry?: Entry): Destination | undefined => entry ? {
    title: entry.title, href: entry.href ?? `/dashboard/course/${courseId}/class/${entry.id}`, classId: entry.id,
  } : undefined
  const labels = partLabels(parts, t)
  const partDestination = (i: number): Destination | undefined => parts[i] ? {
    title: `${labels[i]} · ${parts[i].title}`,
    href: `/dashboard/course/${courseId}/class/${classId}?itemId=${encodeURIComponent(parts[i].id)}`,
    classId, itemId: parts[i].id,
  } : undefined
  return {
    previous: activeIndex > 0 ? partDestination(activeIndex - 1) : classDestination(classes[index - 1]),
    current: { title: [lesson?.title, labels[activeIndex], parts[activeIndex]?.title].filter(Boolean).join(' · ') },
    next: activeIndex < parts.length - 1 ? partDestination(activeIndex + 1) : classDestination(classes[index + 1]),
  }
}
