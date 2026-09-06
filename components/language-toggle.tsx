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

/** Rail label visibility: shown while the rail is hovered or forced open. */
const RAIL_REVEAL =
  'opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-data-[expanded=true]/rail:opacity-100'
const RAIL_HIDE = 'transition-opacity duration-150 group-hover/rail:opacity-0 group-data-[expanded=true]/rail:opacity-0'

interface LanguageToggleProps {
  /** `rail`: a 40px row for the sidebar rail whose label fades in when the rail expands. */
  variant?: 'icon' | 'labeled' | 'rail'
  className?: string
}

export function LanguageToggle({ variant = 'labeled', className }: LanguageToggleProps) {
  const { locale, setLocale, locales, t } = useTranslation()

  if (variant === 'rail') {
    // No popover: collapsed, the row itself flips to the next language (the
    // current code sits on the icon); expanded, an inline EN / ES switch appears.
    const next = locales[(locales.indexOf(locale) + 1) % locales.length]
    return (
      <div
        className={cn(
          'relative flex h-10 w-full items-center rounded-lg pl-[10px] pr-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setLocale(next)}
          aria-label={`${t('common.changeLanguage')}: ${LOCALE_LABELS[next]}`}
          className="absolute inset-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <span className="pointer-events-none relative flex h-5 w-5 shrink-0 items-center justify-center">
          <Languages className="h-5 w-5" />
          <span
            aria-hidden
            className={cn(
              'absolute -right-2 -top-1.5 rounded-[3px] bg-sidebar px-[3px] text-[8px] font-bold leading-[11px] text-sidebar-foreground/80 ring-1 ring-sidebar-border',
              RAIL_HIDE
            )}
          >
            {LOCALE_SHORT_LABELS[locale]}
          </span>
        </span>
        <span className={cn('pointer-events-none relative ml-[22px] truncate text-sm font-medium', RAIL_REVEAL)}>
          {t('common.language')}
        </span>
        <div
          role="radiogroup"
          aria-label={t('common.language')}
          className={cn('relative ml-auto flex shrink-0 gap-0.5 rounded-md bg-sidebar-accent p-0.5', RAIL_REVEAL)}
        >
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={locale === l}
              onClick={() => setLocale(l)}
              className={cn(
                'h-6 rounded-[5px] px-2 text-[11px] font-semibold transition-colors',
                locale === l ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {LOCALE_SHORT_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
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
