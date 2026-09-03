'use client'

import Link from 'next/link'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/components/language-provider'

interface HeaderContinueClientProps {
  classId: string
  courseId: string
  classTitle: string
  courseTitle: string
}

export function HeaderContinueClient({ classId, courseId, classTitle, courseTitle }: HeaderContinueClientProps) {
  const { t } = useTranslation()
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-9 gap-2"
            asChild
          >
            <Link href={`/dashboard/course/${courseId}/class/${classId}`}>
              <Play className="h-4 w-4 fill-current" />
              <span className="hidden lg:inline">{t('common.continue')}</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">{classTitle}</p>
          <p className="text-xs text-muted-foreground">{courseTitle}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
