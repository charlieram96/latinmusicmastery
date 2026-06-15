'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ITEM_TYPE_META } from './item-meta'
import type { ClassItemType } from '@/types/modules'

const ITEM_TYPES = Object.keys(ITEM_TYPE_META) as ClassItemType[]

interface AddItemBarProps {
  onAdd: (type: ClassItemType) => Promise<void> | void
}

export function AddItemBar({ onAdd }: AddItemBarProps) {
  const [busyType, setBusyType] = useState<ClassItemType | null>(null)

  const handleAdd = async (type: ClassItemType) => {
    if (busyType) return
    setBusyType(type)
    try {
      await onAdd(type)
    } finally {
      setBusyType(null)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITEM_TYPES.map((type) => {
        const meta = ITEM_TYPE_META[type]
        const Icon = meta.icon
        return (
          <button
            key={type}
            type="button"
            disabled={busyType !== null}
            onClick={() => void handleAdd(type)}
            className={cn(
              'group/add flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all duration-150',
              'hover:bg-card hover:shadow-sm disabled:opacity-50',
              type === 'VIDEO' && 'hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400',
              type === 'QUIZ' && 'hover:border-purple-500/40 hover:text-purple-600 dark:hover:text-purple-400',
              type === 'EXERCISE' && 'hover:border-green-500/40 hover:text-green-600 dark:hover:text-green-400',
              type === 'JAM_SESSION' && 'hover:border-orange-500/40 hover:text-orange-600 dark:hover:text-orange-400'
            )}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <Plus className="absolute h-3.5 w-3.5 transition-all duration-150 group-hover/add:scale-0 group-hover/add:opacity-0" />
              <Icon className="absolute h-4 w-4 scale-0 opacity-0 transition-all duration-150 group-hover/add:scale-100 group-hover/add:opacity-100" />
            </span>
            {busyType === type ? 'Adding…' : meta.label}
          </button>
        )
      })}
    </div>
  )
}
