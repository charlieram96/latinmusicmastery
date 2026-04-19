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
  variant?: 'icon' | 'labeled'
  className?: string
}

export function LanguageToggle({ variant = 'labeled', className }: LanguageToggleProps) {
  const { locale, setLocale, locales, t } = useTranslation()

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
