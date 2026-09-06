'use client'

import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  Search,
  Video,
  FileText,
} from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

const FAQ_KEYS = [
  'startCourse',
  'downloadMaterials',
  'progressTracking',
  'paymentMethods',
  'cancelSubscription',
  'refunds',
  'newContent',
  'mobileAccess',
] as const

const RESOURCE_KEYS = ['gettingStarted', 'videoTutorials', 'documentation'] as const
const RESOURCE_ICONS: Record<string, typeof BookOpen> = {
  gettingStarted: BookOpen,
  videoTutorials: Video,
  documentation: FileText,
}

export default function HelpPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader
        title={t('dashboard.pages.help.title')}
        description={t('dashboard.pages.help.subtitle')}
      />

      {/* Search */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('dashboard.pages.help.searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <Button>{t('dashboard.pages.help.searchButton')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Resources */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {RESOURCE_KEYS.map((key) => {
          const Icon = RESOURCE_ICONS[key]
          return (
            <Card key={key} className="hover:bg-secondary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{t(`dashboard.pages.help.resources.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t(`dashboard.pages.help.resources.${key}.description`)}
                  </p>
                  <Button variant="link" size="sm" className="p-0 h-auto">
                    {t('dashboard.pages.help.learnMore')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {t('dashboard.pages.help.faqs.title')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.pages.help.faqs.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_KEYS.map((key, index) => (
              <AccordionItem key={key} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {t(`dashboard.pages.help.faqs.items.${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t(`dashboard.pages.help.faqs.items.${key}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {t('dashboard.pages.help.liveChat.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.pages.help.liveChat.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard.pages.help.liveChat.body')}
            </p>
            <Button className="w-full">
              {t('dashboard.pages.help.liveChat.cta')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t('dashboard.pages.help.emailSupport.title')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.pages.help.emailSupport.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard.pages.help.emailSupport.body')}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:support@latinmusicmastery.com">
                {t('dashboard.pages.help.emailSupport.cta')}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
