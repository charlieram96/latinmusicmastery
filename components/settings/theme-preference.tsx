'use client'

import { useTheme } from '@/components/theme-provider'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Moon, Sun } from 'lucide-react'

export function ThemePreference() {
  const { theme, setTheme, mounted } = useTheme()

  if (!mounted) {
    return (
      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select disabled>
          <SelectTrigger id="theme">
            <SelectValue placeholder="Loading..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">Theme</Label>
      <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark')}>
        <SelectTrigger id="theme">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Dark
            </div>
          </SelectItem>
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Light
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
