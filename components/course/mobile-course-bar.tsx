'use client'

import { Button } from '@/components/ui/button'
import { EnterCourseModeButton } from '@/components/dashboard/enter-course-mode-button'
import { PlayCircle, Clock } from 'lucide-react'

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
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-background/95 backdrop-blur-lg border-t border-border lg:hidden">
      {progressPercentage > 0 && (
        <p className="text-xs text-muted-foreground text-center mb-2">
          {progressPercentage}% complete
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
          {hasStarted ? 'Continue Course' : 'Begin Course'}
        </EnterCourseModeButton>
      ) : (
        <Button size="lg" disabled className="w-full h-12 rounded-xl text-base">
          <Clock className="h-5 w-5 mr-2" />
          Coming Soon
        </Button>
      )}
    </div>
  )
}
