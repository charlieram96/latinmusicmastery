'use client'

import Link from 'next/link'
import { Play, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { ContinueLearningHeroProps } from '@/types/dashboard'

export function ContinueLearningHero({ continueData }: ContinueLearningHeroProps) {
  if (!continueData) {
    return (
      <AnimatedSection delay={0.05}>
        <div className="relative overflow-hidden rounded-2xl min-h-[160px] flex flex-col justify-center items-center text-center px-6 py-8 bg-gradient-to-br from-terracotta/20 via-warm-surface to-gold/10 warm-glow">
          {/* Decorative background glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-terracotta/5 via-transparent to-gold/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="rounded-full bg-terracotta/15 p-4">
              <Play className="h-8 w-8 text-terracotta" />
            </div>
            <h3 className="text-xl sm:text-2xl font-heading font-semibold text-foreground">
              Start your first course
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Explore our library of Latin music courses and begin your journey today.
            </p>
            <Button asChild className="mt-2 bg-terracotta hover:bg-terracotta/90 text-white">
              <Link href="/dashboard/courses">
                Browse Courses
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>
    )
  }

  const resumeHref = continueData.classId
    ? `/dashboard/course/${continueData.courseSlug}/class/${continueData.classId}`
    : `/dashboard/course/${continueData.courseSlug}`

  return (
    <AnimatedSection delay={0.05}>
      <Link href={resumeHref} className="group block">
        <div className="relative overflow-hidden rounded-2xl min-h-[180px] flex flex-col justify-end warm-glow">
          {/* Thumbnail background */}
          {continueData.courseThumbnail ? (
            <img
              src={continueData.courseThumbnail}
              alt={continueData.courseTitle}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-warm-surface" />
          )}

          {/* Warm gradient overlay with amber/terracotta tint */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-terracotta/15 via-transparent to-amber-900/20 mix-blend-normal" />

          {/* Content */}
          <div className="relative z-10 p-4 sm:p-5 flex flex-col gap-3">
            {/* Badge */}
            <Badge className="w-fit border-amber-500/30 bg-amber-500/15 text-amber-300 backdrop-blur-sm">
              Continue Learning
            </Badge>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-heading font-semibold text-white leading-tight line-clamp-2">
              {continueData.courseTitle}
            </h3>

            {/* Resume button */}
            <Button
              size="lg"
              className="w-fit mt-1 bg-terracotta hover:bg-terracotta/90 text-white gap-2 group/btn"
              tabIndex={-1}
            >
              <span className="relative flex items-center justify-center h-6 w-6">
                <span className="absolute inset-0 rounded-full ring-2 ring-white/20" />
                <Play className="relative h-4 w-4 fill-white text-white" />
              </span>
              Resume Lesson
            </Button>
          </div>
        </div>
      </Link>
    </AnimatedSection>
  )
}
