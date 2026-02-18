'use client'

import { Button } from '@/components/ui/button'
import { Video, HelpCircle, FileQuestion, Music, Plus } from 'lucide-react'
import { ClassItemType } from '@/types/modules'

interface AddClassItemBarProps {
  onAdd: (type: ClassItemType) => void
}

const itemTypes = [
  {
    type: 'VIDEO' as ClassItemType,
    label: '+Video',
    icon: Video,
    classes: 'text-blue-600 hover:bg-blue-500/10 border-blue-500/30',
  },
  {
    type: 'QUIZ' as ClassItemType,
    label: '+Quiz',
    icon: HelpCircle,
    classes: 'text-purple-600 hover:bg-purple-500/10 border-purple-500/30',
  },
  {
    type: 'EXERCISE' as ClassItemType,
    label: '+Exercise',
    icon: FileQuestion,
    classes: 'text-green-600 hover:bg-green-500/10 border-green-500/30',
  },
  {
    type: 'JAM_SESSION' as ClassItemType,
    label: '+Jam Session',
    icon: Music,
    classes: 'text-orange-600 hover:bg-orange-500/10 border-orange-500/30',
  },
]

export default function AddClassItemBar({ onAdd }: AddClassItemBarProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {itemTypes.map(({ type, label, icon: Icon, classes }) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          className={classes}
          onClick={() => onAdd(type)}
        >
          <Plus className="h-3 w-3" />
          <Icon className="h-3 w-3" />
          {label}
        </Button>
      ))}
    </div>
  )
}
