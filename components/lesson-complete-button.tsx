'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markModuleComplete, markLessonComplete } from '@/app/actions/progress'

interface LessonCompleteButtonProps {
  lessonId?: string
  moduleId?: string
  userId: string
}

export function LessonCompleteButton({ lessonId, moduleId, userId }: LessonCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      const result = moduleId
        ? await markModuleComplete(moduleId, userId)
        : lessonId
          ? await markLessonComplete(lessonId, userId)
          : { error: 'No module or lesson ID provided' }
      if (result.error) {
        console.error('Failed to mark as complete:', result.error)
        alert('Failed to mark as complete. Please try again.')
      }
    } catch (error) {
      console.error('Error marking as complete:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleComplete}
      disabled={isLoading}
      className="gap-2"
    >
      <CheckCircle2 className="w-4 h-4" />
      {isLoading ? 'Saving...' : 'Mark as Complete'}
    </Button>
  )
}
