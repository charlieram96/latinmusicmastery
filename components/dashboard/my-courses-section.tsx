'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'
import type { MyCoursesProps } from '@/types/dashboard'

export function MyCoursesSection({ courses }: MyCoursesProps) {
  if (courses.length === 0) return null

  const displayed = courses.slice(0, 3)

  return (
    <AnimatedSection delay={0.15}>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            My Courses
          </h3>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/dashboard/my-courses"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Course cards grid */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((item) => {
            const percent =
              item.total > 0
                ? Math.round((item.completed / item.total) * 100)
                : 0

            return (
              <StaggerItem key={item.course.id}>
                <Link
                  href={`/dashboard/course/${item.course.slug || item.course.id}`}
                  className="group block"
                >
                  <div className="warm-surface rounded-2xl p-4 flex items-start gap-4 transition-all duration-200 hover:brightness-110 hover:warm-glow">
                    {/* Thumbnail */}
                    <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {item.course.thumbnail_url ? (
                        <Image
                          src={item.course.thumbnail_url}
                          alt={item.course.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-amber-500/10">
                          <BookOpen className="h-6 w-6 text-amber-400/60" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">
                        {item.course.title}
                      </p>

                      {/* Progress bar + percentage */}
                      <div className="flex items-center gap-2">
                        <Progress
                          value={percent}
                          className="h-1.5 flex-1 bg-amber-500/15 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-amber-500 [&>[data-slot=progress-indicator]]:to-gold"
                        />
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-8 text-right">
                          {percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  )
}
