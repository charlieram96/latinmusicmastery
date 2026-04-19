'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  Lock,
  FileQuestion,
  Dumbbell,
} from 'lucide-react'
import { LessonCompleteButton } from '@/components/lesson-complete-button'
import { useTranslation } from '@/components/language-provider'

interface ModuleViewProps {
  module: any
  moduleId: string
  userId: string
  courseModules: any[]
  progressEntries: [string, any][]
  currentProgressCompleted: boolean
  previousModule: any | null
  nextModule: any | null
  canAccessNext: boolean
  isStudent: boolean
}

export function ModuleView({
  module,
  moduleId,
  userId,
  courseModules,
  progressEntries,
  currentProgressCompleted,
  previousModule,
  nextModule,
  canAccessNext,
  isStudent,
}: ModuleViewProps) {
  const { t } = useTranslation()
  const progressMap = new Map(progressEntries)
  const course = module.course

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'QUIZ':
        return <FileQuestion className="w-4 h-4" />
      case 'EXERCISE':
        return <Dumbbell className="w-4 h-4" />
      default:
        return <PlayCircle className="w-4 h-4" />
    }
  }

  return (
    <>
      {/* Top Navigation */}
      <div className="border-b border-border bg-background sticky top-0 z-10 -mx-6 -mt-6 mb-6">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/course/${course.id}`}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {t('dashboard.pages.modules.backToCourse')}
                </Link>
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground truncate">{course.title}</div>
                <div className="font-medium truncate">{module.title}</div>
              </div>
            </div>
            {!currentProgressCompleted && (
              <LessonCompleteButton moduleId={moduleId} userId={userId} />
            )}
            {currentProgressCompleted && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {t('dashboard.pages.modules.completed')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* VIDEO type: Soundslice Embed */}
          {module.module_type === 'VIDEO' && module.soundslice_embed_url && (
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={module.soundslice_embed_url}
                    className="w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* QUIZ type */}
          {module.module_type === 'QUIZ' && module.question && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="w-5 h-5" />
                  {t('dashboard.pages.modules.quiz')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium mb-4">{module.question}</p>
                {module.options && Array.isArray(module.options) && (
                  <div className="space-y-2">
                    {(module.options as string[]).map((option: string, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
                {module.explanation && (
                  <p className="text-sm text-muted-foreground mt-4">{module.explanation}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* EXERCISE type */}
          {module.module_type === 'EXERCISE' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" />
                  {t('dashboard.pages.modules.exercise')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {module.question && (
                  <p className="text-lg font-medium mb-4">{module.question}</p>
                )}
                {module.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {module.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Module Description */}
          {module.description && module.module_type === 'VIDEO' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.pages.modules.aboutLesson')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{module.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            {previousModule ? (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/dashboard/modules/${previousModule.id}`}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('dashboard.pages.modules.previous')}
                </Link>
              </Button>
            ) : (
              <div className="flex-1" />
            )}

            {nextModule && (
              <>
                {canAccessNext ? (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/modules/${nextModule.id}`}>
                      {t('dashboard.pages.modules.next')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled className="flex-1">
                    <Lock className="w-4 h-4 mr-2" />
                    {t('dashboard.pages.modules.nextLocked')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar - Course Modules */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>{t('dashboard.pages.modules.courseContent')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {courseModules?.map((courseModule, index) => {
                  const progress = progressMap.get(courseModule.id)
                  const isCompleted = progress?.completed || false
                  const isCurrent = courseModule.id === moduleId
                  const isLocked = !courseModule.is_free && !isStudent

                  const content = (
                    <>
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : isLocked ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          getModuleIcon(courseModule.module_type)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {index + 1}. {courseModule.title}
                        </div>
                      </div>
                    </>
                  )

                  if (isLocked) {
                    return (
                      <div
                        key={courseModule.id}
                        className="flex items-center gap-3 p-3 rounded-lg opacity-50 cursor-not-allowed"
                      >
                        {content}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={courseModule.id}
                      href={`/dashboard/modules/${courseModule.id}`}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCurrent ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      {content}
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
