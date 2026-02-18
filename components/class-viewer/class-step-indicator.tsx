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

const typeConfig: Record<string, { color: string, activeColor: string, icon: typeof Video }> = {
  VIDEO: { color: 'text-blue-500', activeColor: 'ring-blue-500 bg-blue-500/10', icon: Video },
  QUIZ: { color: 'text-purple-500', activeColor: 'ring-purple-500 bg-purple-500/10', icon: FileQuestion },
  EXERCISE: { color: 'text-green-500', activeColor: 'ring-green-500 bg-green-500/10', icon: Dumbbell },
  JAM_SESSION: { color: 'text-orange-500', activeColor: 'ring-orange-500 bg-orange-500/10', icon: Music },
}

export function ClassStepIndicator({
  items,
  activeIndex,
  completedItemIds,
  courseId,
  classId,
}: ClassStepIndicatorProps) {
  return (
    <div className="overflow-x-auto pb-2 -mx-2 px-2">
      <div className="flex items-center gap-1 min-w-max">
        {items.map((item, index) => {
          const config = typeConfig[item.item_type] || typeConfig.VIDEO
          const Icon = config.icon
          const isActive = index === activeIndex
          const isCompleted = completedItemIds.includes(item.id)

          return (
            <div key={item.id} className="flex items-center">
              <Link
                href={`/dashboard/course/${courseId}/class/${classId}?item=${index}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-full transition-all text-sm',
                  isActive && `ring-2 ${config.activeColor} font-medium`,
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
                <span className="hidden sm:inline max-w-[120px] truncate">{item.title}</span>
                <span className="sm:hidden">{index + 1}</span>
              </Link>
              {index < items.length - 1 && (
                <div className={cn(
                  'w-4 h-0.5 mx-0.5',
                  isCompleted ? 'bg-green-500/30' : 'bg-border'
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
