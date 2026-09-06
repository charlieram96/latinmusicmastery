'use client'

import { Languages } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LOCALE_LABELS, LOCALE_SHORT_LABELS, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
  /** `rail`: a 40px row for the sidebar rail whose label fades in when the rail expands. */
  variant?: 'icon' | 'labeled' | 'rail'
  className?: string
}

export function LanguageToggle({ variant = 'labeled', className }: LanguageToggleProps) {
  const { locale, setLocale, locales, t } = useTranslation()

  if (variant === 'rail') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('common.changeLanguage')}
            className={cn(
              'flex h-10 w-full items-center rounded-lg pl-[10px] pr-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
              className
            )}
          >
            <Languages className="h-5 w-5 shrink-0" />
            <span className="ml-3 truncate text-sm font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100">
              {t('common.language')}: {LOCALE_LABELS[locale]}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={12}>
          {locales.map((l) => (
            <DropdownMenuItem
              key={l}
              onSelect={() => setLocale(l)}
              className={cn(locale === l && 'bg-accent')}
            >
              <span className="font-semibold mr-2 text-xs w-6">{LOCALE_SHORT_LABELS[l]}</span>
              {LOCALE_LABELS[l]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('common.changeLanguage')}
                className={cn(
                  'relative flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
                  className
                )}
              >
                <Languages className="h-[18px] w-[18px]" />
                <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold leading-none bg-background rounded px-1 py-0.5 border border-border">
                  {LOCALE_SHORT_LABELS[locale]}
                </span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {t('common.language')}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" side="right" sideOffset={12}>
          {locales.map((l) => (
            <DropdownMenuItem
              key={l}
              onSelect={() => setLocale(l)}
              className={cn(locale === l && 'bg-accent')}
            >
              <span className="font-semibold mr-2 text-xs w-6">{LOCALE_SHORT_LABELS[l]}</span>
              {LOCALE_LABELS[l]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-full text-muted-foreground hover:text-foreground',
            className
          )}
          aria-label={t('common.changeLanguage')}
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold">{LOCALE_SHORT_LABELS[locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l: Locale) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => setLocale(l)}
            className={cn(locale === l && 'bg-accent')}
          >
            <span className="font-semibold mr-2 text-xs w-6">{LOCALE_SHORT_LABELS[l]}</span>
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
