'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markClassItemComplete } from '@/app/actions/progress'

interface ClassItemCompleteButtonProps {
  classItemId: string
}

export function ClassItemCompleteButton({ classItemId }: ClassItemCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      const result = await markClassItemComplete(classItemId)
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
    <Button onClick={handleComplete} disabled={isLoading} className="gap-2">
      <CheckCircle2 className="w-4 h-4" />
      {isLoading ? 'Saving...' : 'Mark as Complete'}
    </Button>
  )
}
