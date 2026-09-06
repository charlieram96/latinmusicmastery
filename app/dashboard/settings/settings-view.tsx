'use client'

import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Bell, Lock, Globe, Trash2 } from 'lucide-react'
import { ThemePreference } from '@/components/settings/theme-preference'
import { useTranslation } from '@/components/language-provider'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n'

interface SettingsViewProps {
  fullName: string
  email: string
}

export function SettingsView({ fullName, email }: SettingsViewProps) {
  const { t, locale, setLocale } = useTranslation()

  return (
    <>
      <PageHeader
        title={t('dashboard.pages.settings.title')}
        description={t('dashboard.pages.settings.subtitle')}
      />

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('dashboard.pages.settings.profile.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.settings.profile.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t('dashboard.pages.settings.profile.fullName')}</Label>
              <Input
                id="full_name"
                defaultValue={fullName}
                placeholder={t('dashboard.pages.settings.profile.fullNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('dashboard.pages.settings.profile.email')}</Label>
              <Input
                id="email"
                type="email"
                defaultValue={email}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                {t('dashboard.pages.settings.profile.emailHelp')}
              </p>
            </div>
          </div>

          <Button>{t('dashboard.pages.settings.saveChanges')}</Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('dashboard.pages.settings.notifications.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.settings.notifications.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">{t('dashboard.pages.settings.notifications.emailLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.settings.notifications.emailHelp')}
              </p>
            </div>
            <Checkbox id="email-notifications" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="course-reminders">{t('dashboard.pages.settings.notifications.remindersLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.settings.notifications.remindersHelp')}
              </p>
            </div>
            <Checkbox id="course-reminders" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="achievement-alerts">{t('dashboard.pages.settings.notifications.achievementLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.settings.notifications.achievementHelp')}
              </p>
            </div>
            <Checkbox id="achievement-alerts" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing-emails">{t('dashboard.pages.settings.notifications.marketingLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.settings.notifications.marketingHelp')}
              </p>
            </div>
            <Checkbox id="marketing-emails" />
          </div>

          <Button>{t('dashboard.pages.settings.notifications.update')}</Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('dashboard.pages.settings.preferences.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.settings.preferences.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">{t('dashboard.pages.settings.preferences.languageLabel')}</Label>
            <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t('dashboard.pages.settings.preferences.timezoneLabel')}</Label>
            <Select defaultValue="utc">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">{t('dashboard.pages.settings.preferences.tz.utc')}</SelectItem>
                <SelectItem value="est">{t('dashboard.pages.settings.preferences.tz.est')}</SelectItem>
                <SelectItem value="pst">{t('dashboard.pages.settings.preferences.tz.pst')}</SelectItem>
                <SelectItem value="cet">{t('dashboard.pages.settings.preferences.tz.cet')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ThemePreference />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoplay">{t('dashboard.pages.settings.preferences.autoplayLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.settings.preferences.autoplayHelp')}
              </p>
            </div>
            <Checkbox id="autoplay" defaultChecked />
          </div>

          <Button>{t('dashboard.pages.settings.preferences.save')}</Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('dashboard.pages.settings.security.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.settings.security.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('dashboard.pages.settings.security.passwordLabel')}</Label>
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.pages.settings.security.passwordHelp')}
            </p>
            <Button variant="outline">{t('dashboard.pages.settings.security.changePassword')}</Button>
          </div>

          <Separator />

          <div>
            <Label>{t('dashboard.pages.settings.security.twoFactorLabel')}</Label>
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.pages.settings.security.twoFactorHelp')}
            </p>
            <Button variant="outline">{t('dashboard.pages.settings.security.enable2FA')}</Button>
          </div>

          <Separator />

          <div>
            <Label>{t('dashboard.pages.settings.security.sessionsLabel')}</Label>
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.pages.settings.security.sessionsHelp')}
            </p>
            <Button variant="outline">{t('dashboard.pages.settings.security.viewSessions')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('dashboard.pages.settings.dangerZone.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.settings.dangerZone.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('dashboard.pages.settings.dangerZone.deleteLabel')}</Label>
            <p className="text-sm text-muted-foreground mb-3">
              {t('dashboard.pages.settings.dangerZone.deleteHelp')}
            </p>
            <Button variant="destructive">{t('dashboard.pages.settings.dangerZone.deleteCta')}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
