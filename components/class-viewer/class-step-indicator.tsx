'use client'

import Link from 'next/link'
import { Video, FileQuestion, Dumbbell, Music, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClassItem {
  id: string
  title: string
  item_type: string
  order_index: number
}

interface ClassStepIndicatorProps {
  items: ClassItem[]
  activeIndex: number
  completedItemIds: string[]
  courseId: string
  classId: string
}

const typeConfig: Record<string, { color: string, activeBg: string, icon: typeof Video }> = {
  VIDEO: { color: 'text-blue-500', activeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', icon: Video },
  QUIZ: { color: 'text-purple-500', activeBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', icon: FileQuestion },
  EXERCISE: { color: 'text-green-500', activeBg: 'bg-green-500/15 text-green-700 dark:text-green-400', icon: Dumbbell },
  JAM_SESSION: { color: 'text-orange-500', activeBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', icon: Music },
}

export function ClassStepIndicator({
  items,
  activeIndex,
  completedItemIds,
  courseId,
  classId,
}: ClassStepIndicatorProps) {
  return (
    <div className="overflow-x-auto -mx-2 px-2 pb-1">
      <div className="inline-flex items-center rounded-xl bg-muted/50 p-1 min-w-max">
        {items.map((item, index) => {
          const config = typeConfig[item.item_type] || typeConfig.VIDEO
          const Icon = config.icon
          const isActive = index === activeIndex
          const isCompleted = completedItemIds.includes(item.id)

          return (
            <Link
              key={item.id}
              href={`/dashboard/course/${courseId}/class/${classId}?item=${index}`}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-all',
                isActive && `${config.activeBg} font-medium shadow-sm`,
                !isActive && !isCompleted && 'text-muted-foreground hover:bg-muted',
                isCompleted && !isActive && 'text-muted-foreground'
              )}
              title={item.title}
            >
              {isCompleted && !isActive ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? config.color : '')} />
              )}
              <span className="hidden sm:inline">{item.title}</span>
              <span className="sm:hidden">{index + 1}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
