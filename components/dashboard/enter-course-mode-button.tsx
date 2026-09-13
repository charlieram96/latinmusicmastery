'use client'

import { useState, ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlayCircle, Music, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { enrollInCourse } from '@/app/actions/progress'
import { useTranslation } from '@/components/language-provider'

interface EnterCourseModeButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick'> {
  moduleId?: string
  courseId: string
  courseTitle?: string
  isNewCourse?: boolean
  href?: string
}

export function EnterCourseModeButton({
  moduleId,
  courseId,
  courseTitle,
  isNewCourse = false,
  href,
  children,
  className,
  ...props
}: EnterCourseModeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()

  const handleClick = async () => {
    setIsLoading(true)

    // Enroll in course (or update last accessed time if already enrolled)
    await enrollInCourse(courseId)

    
    setTimeout(() => {
      router.push(href || (moduleId ? `/dashboard/modules/${moduleId}` : `/dashboard/course/${courseId}`))
    }, 100)
  }

  return (
    <>
      {/* Full-screen loading overlay - portaled to document.body to escape stacking contexts */}
      {isLoading && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Animated background pattern */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
                <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-8 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
                <div className="absolute inset-16 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.6s' }} />
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6">
              {/* Animated icon */}
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Music className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              </div>

              {/* Text */}
              <h2 className="text-2xl font-bold font-heading mb-2">
                {isNewCourse
                  ? t('dashboard.pages.course.enter.starting')
                  : t('dashboard.pages.course.enter.entering')}
              </h2>
              {courseTitle && (
                <p className="text-lg text-muted-foreground mb-4 max-w-md">
                  {courseTitle}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('dashboard.pages.course.enter.preparing')}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-8 w-64 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full animate-pulse"
                  style={{
                    width: '100%',
                    animation: 'loading-progress 1.5s ease-in-out infinite'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Custom animation styles */}
          <style jsx>{`
            @keyframes loading-progress {
              0% {
                transform: translateX(-100%);
              }
              50% {
                transform: translateX(0%);
              }
              100% {
                transform: translateX(100%);
              }
            }
          `}</style>
        </div>,
        document.body
      )}

      {/* Button */}
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('common.loading')}
          </>
        ) : (
          children || (
            <>
              <PlayCircle className="h-5 w-5 mr-2" />
              {isNewCourse
                ? t('dashboard.pages.course.beginCourse')
                : t('dashboard.pages.course.continueCourse')}
            </>
          )
        )}
      </Button>
    </>
  )
}
