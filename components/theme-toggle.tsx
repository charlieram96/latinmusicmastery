'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()
  const { t } = useTranslation()

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-muted-foreground"
        disabled
      >
        <Moon className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
      aria-label={theme === 'light' ? t('common.switchToDarkMode') : t('common.switchToLightMode')}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  )
}
