'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, MessageCircle, ExternalLink, Music, Sparkles, Heart } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/components/language-provider'

export default function CommunityPage() {
  const { t } = useTranslation()
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading">{t('dashboard.pages.community.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('dashboard.pages.community.subtitle')}
        </p>
      </div>

      {/* Discord CTA */}
      <Card className="mb-8 overflow-hidden">
        <div className="bg-[#5865F2] p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="h-20 w-20 bg-white/10 rounded-2xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-white" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-white mb-2">{t('dashboard.pages.community.discord.title')}</h2>
              <p className="text-white/80 mb-4 max-w-xl">
                {t('dashboard.pages.community.discord.description')}
              </p>
              <Button size="lg" className="bg-white text-[#5865F2] hover:bg-white/90" asChild>
                <Link href="https://discord.gg/latinmusicmastery" target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('dashboard.pages.community.discord.cta')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Community Features */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">{t('dashboard.pages.community.discussionChannels.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.pages.community.discussionChannels.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">#piano</Badge>
              <Badge variant="secondary">#percussion</Badge>
              <Badge variant="secondary">#salsa</Badge>
              <Badge variant="secondary">#bachata</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">{t('dashboard.pages.community.practiceSessions.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.pages.community.practiceSessions.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.pages.community.practiceSessions.note')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">{t('dashboard.pages.community.challenges.title')}</CardTitle>
            <CardDescription>
              {t('dashboard.pages.community.challenges.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.pages.community.challenges.current')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Community Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            {t('dashboard.pages.community.guidelines.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span><strong className="text-foreground">{t('dashboard.pages.community.guidelines.rule1Title')}</strong> - {t('dashboard.pages.community.guidelines.rule1Body')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span><strong className="text-foreground">{t('dashboard.pages.community.guidelines.rule2Title')}</strong> - {t('dashboard.pages.community.guidelines.rule2Body')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span><strong className="text-foreground">{t('dashboard.pages.community.guidelines.rule3Title')}</strong> - {t('dashboard.pages.community.guidelines.rule3Body')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span><strong className="text-foreground">{t('dashboard.pages.community.guidelines.rule4Title')}</strong> - {t('dashboard.pages.community.guidelines.rule4Body')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">5.</span>
              <span><strong className="text-foreground">{t('dashboard.pages.community.guidelines.rule5Title')}</strong> - {t('dashboard.pages.community.guidelines.rule5Body')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
