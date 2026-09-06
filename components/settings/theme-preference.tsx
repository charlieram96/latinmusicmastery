'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/components/theme-provider'
import { useTranslation } from '@/components/language-provider'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const OPTIONS: { value: Theme; icon: typeof Sun }[] = [
  { value: 'dark', icon: Moon },
  { value: 'light', icon: Sun },
]

export function ThemePreference() {
  const { theme, setTheme, mounted } = useTheme()
  const { t } = useTranslation()

  if (!mounted) {
    return (
      <div className="space-y-2">
        <Label htmlFor="theme">{t('common.theme.label')}</Label>
        <Select disabled>
          <SelectTrigger id="theme">
            <SelectValue placeholder={t('common.loading')} />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">{t('common.theme.label')}</Label>
      <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
        <SelectTrigger id="theme">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map(({ value, icon: Icon }) => (
            <SelectItem key={value} value={value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {t(`common.theme.${value}`)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
