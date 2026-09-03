'use client'

import { Button } from '@/components/ui/button'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'
import { PlayCircle, Clock } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface MobileCourseBarProps {
  courseId: string
  nextClassHref?: string
  courseTitle: string
  hasStarted: boolean
  progressPercentage: number
}

export function MobileCourseBar({
  courseId,
  nextClassHref,
  courseTitle,
  hasStarted,
  progressPercentage,
}: MobileCourseBarProps) {
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-background/95 backdrop-blur-lg border-t border-border lg:hidden">
      {progressPercentage > 0 && (
        <p className="text-xs text-muted-foreground text-center mb-2">
          {t('dashboard.pages.course.percentComplete', { percent: progressPercentage })}
        </p>
      )}
      {nextClassHref ? (
        <EnterCourseModeButton
          courseId={courseId}
          href={nextClassHref}
          courseTitle={courseTitle}
          isNewCourse={!hasStarted}
          className="w-full h-12 rounded-xl text-base"
          size="lg"
        >
          <PlayCircle className="h-5 w-5 mr-2" />
          {hasStarted ? t('dashboard.pages.course.continueCourse') : t('dashboard.pages.course.beginCourse')}
        </EnterCourseModeButton>
      ) : (
        <Button size="lg" disabled className="w-full h-12 rounded-xl text-base">
          <Clock className="h-5 w-5 mr-2" />
          {t('dashboard.pages.course.comingSoon')}
        </Button>
      )}
    </div>
  )
}
