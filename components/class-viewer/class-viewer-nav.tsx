'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClassItemCompleteButton } from './class-item-complete-button'

interface ClassViewerNavProps {
  courseId: string
  courseTitle: string
  classTitle: string
  classItemId: string | null
  isCompleted: boolean
}

export function ClassViewerNav({
  courseId,
  courseTitle,
  classTitle,
  classItemId,
  isCompleted,
}: ClassViewerNavProps) {
  return (
    <div className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/course/${courseId}`}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Course
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-muted-foreground truncate">
                {courseTitle}
              </div>
              <div className="font-medium truncate">
                {classTitle}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            {isCompleted ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </Badge>
            ) : classItemId ? (
              <ClassItemCompleteButton classItemId={classItemId} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
