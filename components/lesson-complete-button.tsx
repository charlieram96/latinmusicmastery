'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markLessonComplete } from '@/app/actions/progress'

interface LessonCompleteButtonProps {
  lessonId: string
  userId: string
}

export function LessonCompleteButton({ lessonId, userId }: LessonCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      const result = await markLessonComplete(lessonId, userId)
      if (result.error) {
        console.error('Failed to mark lesson as complete:', result.error)
        alert('Failed to mark lesson as complete. Please try again.')
      }
    } catch (error) {
      console.error('Error marking lesson as complete:', error)
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
