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
        <div className="relative overflow-hidden rounded-2xl min-h-[240px] flex flex-col justify-center items-center text-center">
          {/* Video background */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            src="https://videos.pexels.com/video-files/4488162/4488162-uhd_2560_1440_24fps.mp4"
          />
          {/* Dark overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30" />

          <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-10">
            <div className="rounded-full bg-white/10 backdrop-blur-md p-4 ring-1 ring-white/20">
              <Play className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-heading font-semibold text-white">
              Start your first course
            </h3>
            <p className="text-sm text-white/80 max-w-md">
              Explore our library of Latin music courses and begin your journey today.
            </p>
            <Button asChild className="mt-2 bg-white text-neutral-900 hover:bg-white/90 hover:shadow-lg hover:-translate-y-0.5 transition-all">
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
