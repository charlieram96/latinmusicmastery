'use client'

import { LearningIcon } from '@/components/learning-mode/art'

import { useLearningMode, setLearningMode } from '@/components/learning-mode/store'
import { BookOpen, Rainbow } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { RAIL_REVEAL } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'

/** Shared preference for the local learning appearance. */
export function LearningModeToggle({variant = 'rail'}: {variant?: 'rail' | 'icon'}) {
  const { locale } = useTranslation()
  const mode = useLearningMode()
  const es = locale === 'es'
  const label = es ? 'Modo de aprendizaje' : 'Learning mode'
  const classic = es ? 'Mundo clásico' : 'Classic world'
  const kids = es ? 'Mundo infantil' : 'Kids world'
  const current = mode === 'kids' ? kids : classic
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={`${label}: ${current}`} title={`${label}: ${current}`}
        className={cn("flex h-10 items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-primary", variant === "rail" ? "w-full pl-[10px] pr-2" : "w-10 justify-center shrink-0")}>
        <LearningIcon name="learning" icon={Rainbow} />
        {variant === 'rail' && <span className={cn('ml-[22px] truncate text-sm font-medium', RAIL_REVEAL)}>{label}</span>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="right" align="end" className="z-[100] min-w-52">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={mode} onValueChange={value => {
        if (value !== 'classic' && value !== 'kids') return
        setLearningMode(value)
      }}>
        <DropdownMenuRadioItem value="classic" className="min-h-11 gap-2"><BookOpen className="h-4 w-4" />{classic}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="kids" className="min-h-11 gap-2"><Rainbow className="h-4 w-4 text-primary" />{kids}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}
