import { FileQuestion, HelpCircle, Music, Video, type LucideIcon } from 'lucide-react'
import type { ClassItemType } from '@/types/modules'

interface ItemTypeMeta {
  label: string
  icon: LucideIcon
  /** Icon/text tint */
  fg: string
  /** Soft tinted fill for icon squares and chips */
  bg: string
  /** Matching border tint */
  border: string
}

/** Color language for the four lesson item types — shared by the canvas rows,
    add-item bar, and drawer header. Matches the convention used across the admin. */
export const ITEM_TYPE_META: Record<ClassItemType, ItemTypeMeta> = {
  VIDEO: {
    label: 'Video',
    icon: Video,
    fg: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
  QUIZ: {
    label: 'Quiz',
    icon: HelpCircle,
    fg: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
  },
  EXERCISE: {
    label: 'Exercise',
    icon: FileQuestion,
    fg: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/25',
  },
  JAM_SESSION: {
    label: 'Jam Session',
    icon: Music,
    fg: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
  },
}

export function itemMeta(type: string): ItemTypeMeta {
  return ITEM_TYPE_META[type as ClassItemType] ?? ITEM_TYPE_META.VIDEO
}
