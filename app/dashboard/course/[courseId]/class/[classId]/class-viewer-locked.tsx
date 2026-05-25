'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

export function ClassViewerLocked({ courseId }: { courseId: string }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">
        {t('dashboard.pages.course.class.locked.title')}
      </h2>
      <p className="text-muted-foreground mb-8">
        {t('dashboard.pages.course.class.locked.description')}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Button asChild size="lg" className="rounded-2xl">
          <Link href="/dashboard/subscribe">
            <Lock className="h-4 w-4 mr-2" />
            {t('dashboard.pages.course.class.locked.cta')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-2xl">
          <Link href={`/dashboard/course/${courseId}`}>
            {t('dashboard.pages.course.class.locked.back')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
