'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { ActionMessage, LessonAction, useLessonFrame } from '@/components/class-viewer/lesson-viewer/lesson-mode/lesson-frame'

export function ClassViewerLocked({ courseId }: { courseId: string }) {
  const { t } = useTranslation()
  // In the lesson frame the way forward lives in the action bar, like every other part.
  const inLesson = !!useLessonFrame()

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-border bg-raised px-6 py-16 text-center shadow-warm">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-2">
        {t('dashboard.pages.course.class.locked.title')}
      </h2>
      <p className={inLesson ? 'text-muted-foreground' : 'text-muted-foreground mb-8'}>
        {t('dashboard.pages.course.class.locked.description')}
      </p>
      {inLesson ? (
        <LessonAction>
          <ActionMessage icon={<Lock className="h-5 w-5" />} title={t('dashboard.pages.course.class.locked.title')} />
          <Button asChild variant="chunky-ghost">
            <Link href={`/dashboard/course/${courseId}`}>{t('dashboard.pages.course.class.locked.back')}</Link>
          </Button>
          <Button asChild variant="chunky" data-primary="">
            <Link href="/dashboard/subscribe"><Lock className="h-4 w-4" />{t('dashboard.pages.course.class.locked.cta')}</Link>
          </Button>
        </LessonAction>
      ) : (
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
      )}
    </div>
  )
}
