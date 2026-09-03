'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markClassItemComplete } from '@/app/actions/progress'
import { useTranslation } from '@/components/language-provider'

interface ClassItemCompleteButtonProps {
  classItemId: string
}

export function ClassItemCompleteButton({ classItemId }: ClassItemCompleteButtonProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const handleComplete = async () => {
    setIsLoading(true)
    try {
      const result = await markClassItemComplete(classItemId)
      if (result.error) {
        console.error('Failed to mark as complete:', result.error)
        alert(t('dashboard.classViewer.footer.markFailed'))
      }
    } catch (error) {
      console.error('Error marking as complete:', error)
      alert(t('dashboard.classViewer.footer.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleComplete} disabled={isLoading} className="gap-2">
      <CheckCircle2 className="w-4 h-4" />
      {isLoading ? t('dashboard.classViewer.footer.saving') : t('dashboard.classViewer.footer.markCompleted')}
    </Button>
  )
}
