'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { useTranslation } from '@/components/language-provider'

export default function LoginPage() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Side - Image with Text Overlay (always dark themed) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=2070&auto=format&fit=crop')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-primary/30" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link href="/">
            <img
              src="/large-color-logo.svg"
              alt="Latin Music Mastery"
              className="h-8 w-auto"
            />
          </Link>

          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold font-heading leading-tight">
              {t('auth.login.heroTitlePre')}
              <span className="text-primary"> {t('auth.login.heroTitleHighlight')}</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              {t('auth.login.heroSubtitle')}
            </p>

            <div className="flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-bold">150+</div>
                <div className="text-sm text-white/60">{t('auth.login.statVideoLessons')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">8</div>
                <div className="text-sm text-white/60">{t('auth.login.statMusicStyles')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">4.9</div>
                <div className="text-sm text-white/60">{t('auth.login.statRating')}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-white/80 italic">
              {t('auth.login.quote')}
            </p>
            <p className="text-sm text-white/60">{t('auth.login.quoteAuthor')}</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form (theme-aware) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-8">
            <Link href="/">
              <img
                src="/large-color-logo.svg"
                alt="Latin Music Mastery"
                className="h-8 w-auto mx-auto"
              />
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold font-heading text-foreground">{t('auth.login.welcomeBack')}</h2>
            <p className="mt-2 text-muted-foreground">
              {t('auth.login.signInSubtitle')}
            </p>
          </div>

          <GoogleSignInButton />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground">
                {t('auth.orContinueWithEmail')}
              </span>
            </div>
          </div>

          <form action={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">{t('common.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('common.emailPlaceholder')}
                required
                disabled={loading}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">{t('common.password')}</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={loading}
                className="bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 h-auto text-base font-semibold rounded-full"
              disabled={loading}
            >
              {loading ? t('auth.login.signingIn') : t('auth.login.signInButton')}
            </Button>
          </form>

          <p className="text-center text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
              {t('auth.login.signUpFree')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
