'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** `icon`: a 36px icon button. `rail`: a full-width 40px row for the sidebar rail (icon at a fixed x, label fades in). */
  variant?: 'icon' | 'rail'
  className?: string
}

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme()
  const { t } = useTranslation()

  // Before mount we do not know the stored preference; render the dark icon disabled.
  const current: Theme = mounted ? theme : 'dark'
  const Icon = ICONS[current]
  const label = t(`common.theme.${current}`)
  const nextLabel =
    current === 'light'
      ? t('common.switchToDarkMode')
      : current === 'dark'
        ? t('common.useSystemTheme')
        : t('common.switchToLightMode')

  if (variant === 'rail') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        disabled={!mounted}
        aria-label={nextLabel}
        className={cn(
          'flex h-10 w-full items-center rounded-lg pl-[11px] pr-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          className
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="ml-3 truncate text-sm font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100">
          {t('common.theme.label')}: {label}
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
