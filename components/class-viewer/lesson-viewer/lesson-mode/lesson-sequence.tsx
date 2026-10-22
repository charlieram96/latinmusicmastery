'use client'
import { useTranslation } from '@/components/language-provider'
import { useLearningMode } from '@/components/learning-mode/store'
import { CourseSequenceContext, CourseSequenceNavigation } from '@/components/solfeo/course-sequence-navigation'
import { activitySequence } from '@/lib/courses/activity-sequence'
import type { LessonModeShellProps } from './lesson-mode-shell'

export function LessonSequence({ course, lesson, sections, rail, parts, activeIndex, nextLesson }: Pick<LessonModeShellProps,
  'course' | 'lesson' | 'sections' | 'rail' | 'parts' | 'activeIndex' | 'nextLesson'>) {
  const { t } = useTranslation()
  const learningMode = useLearningMode()
  const classes = sections?.flatMap(section => section.classes) ?? rail
  const sequence = activitySequence({ courseId: course.id, classId: lesson.id, classes, parts, activeIndex, t })
  if (!sections && !sequence.next && nextLesson) sequence.next = { ...nextLesson, classId: '' }
  return <div className="lx-course-sequence" data-course-sequence>
    <CourseSequenceContext.Provider value={sequence}><CourseSequenceNavigation currentTitle={learningMode === 'kids' ? (parts[activeIndex]?.title || lesson.title) : undefined} /></CourseSequenceContext.Provider>
  </div>
}
