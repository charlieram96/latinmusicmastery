'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** `icon`: a 36px icon button. `rail`: a full-width 40px row for the sidebar rail (icon at a fixed x, label fades in). */
  variant?: 'icon' | 'rail'
  className?: string
}

/** Text that only shows while the rail is expanded (hover) or forced open (data-expanded). */
export const RAIL_REVEAL =
  'opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-data-[expanded=true]/rail:opacity-100'

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme()
  const { t } = useTranslation()

  // Before mount the stored preference is unknown; render the dark icon disabled.
  const current = mounted ? theme : 'dark'
  const Icon = current === 'light' ? Sun : Moon
  const nextLabel = current === 'light' ? t('common.switchToDarkMode') : t('common.switchToLightMode')

  if (variant === 'rail') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        disabled={!mounted}
        aria-label={nextLabel}
        className={cn(
          'flex h-10 w-full items-center rounded-lg pl-[10px] pr-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          className
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className={cn('ml-[22px] truncate text-sm font-medium', RAIL_REVEAL)}>
          {t('common.theme.label')}: {t(`common.theme.${current}`)}
        </span>
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      disabled={!mounted}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      aria-label={nextLabel}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
