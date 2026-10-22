'use client'
import { useTranslation } from '@/components/language-provider'
import { pick } from '@/lib/i18n/localize'
import { activitySequence } from '@/lib/courses/activity-sequence'
import { CourseSequenceContext, CourseSequenceNavigation } from '@/components/solfeo/course-sequence-navigation'
import type { SectionWithClasses } from './types'

export function StudioSequence({ sections, courseId, classId, itemId, onClass, onItem }: {
  sections: SectionWithClasses[]; courseId: string; classId: string; itemId: string | null
  onClass: (id: string) => void; onItem: (id: string) => void
}) {
  const { t, locale } = useTranslation()
  const classes = sections.flatMap(section => section.classes).map(cls => ({ ...cls, title: pick(locale, cls.title, cls.title_es || cls.title) }))
  const cls = classes.find(c => c.id === classId)
  const parts = cls?.items.map(item => ({ ...item, title: pick(locale, item.title, item.title_es || item.title) })) ?? []
  const index = Math.max(0, parts.findIndex(part => part.id === itemId))
  const sequence = activitySequence({ courseId, classId, classes, parts, activeIndex: index, t })
  const destination = (value: typeof sequence.previous) => value ? {
    title: value.title,
    onClick: () => { onClass(value.classId); if (value.itemId) onItem(value.itemId) },
  } : undefined
  return <CourseSequenceContext.Provider value={{ previous: destination(sequence.previous), current: sequence.current, next: destination(sequence.next) }}>
    <CourseSequenceNavigation />
  </CourseSequenceContext.Provider>
}
