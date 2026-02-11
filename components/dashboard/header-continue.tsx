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

interface HeaderContinueClientProps {
  moduleId: string
  moduleTitle: string
  courseTitle: string
}

export function HeaderContinueClient({ moduleId, moduleTitle, courseTitle }: HeaderContinueClientProps) {
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
            <Link href={`/modules/${moduleId}`}>
              <Play className="h-4 w-4 fill-current" />
              <span className="hidden lg:inline">Continue</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">{moduleTitle}</p>
          <p className="text-xs text-muted-foreground">{courseTitle}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
