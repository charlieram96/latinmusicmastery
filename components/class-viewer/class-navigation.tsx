'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClassNavigationProps {
  courseId: string
  classId: string
  currentIndex: number
  totalItems: number
  nextClassId: string | null
}

export function ClassNavigation({
  courseId,
  classId,
  currentIndex,
  totalItems,
  nextClassId,
}: ClassNavigationProps) {
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < totalItems - 1

  return (
    <div className="flex items-center justify-between gap-4">
      {hasPrev ? (
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/dashboard/course/${courseId}/class/${classId}?item=${currentIndex - 1}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Link>
        </Button>
      ) : (
        <div className="flex-1" />
      )}

      {hasNext ? (
        <Button asChild className="flex-1">
          <Link href={`/dashboard/course/${courseId}/class/${classId}?item=${currentIndex + 1}`}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      ) : nextClassId ? (
        <Button asChild className="flex-1">
          <Link href={`/dashboard/course/${courseId}/class/${nextClassId}`}>
            Next Class
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/dashboard/course/${courseId}`}>
            Back to Course
          </Link>
        </Button>
      )}
    </div>
  )
}
