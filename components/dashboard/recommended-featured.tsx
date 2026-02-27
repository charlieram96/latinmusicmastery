'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Users, ArrowRight, Sparkles } from 'lucide-react'
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/dashboard/animated-section'
import type { DashboardCourse, FeaturedTeacher } from '@/types/dashboard'

/* ------------------------------------------------------------------ */
/*  Props — newCourseIds arrives as string[] (Sets can't serialize)    */
/* ------------------------------------------------------------------ */

interface RecommendedFeaturedProps {
  recommendedCourses: DashboardCourse[]
  newCourseIds: string[]
  featuredTeacher: FeaturedTeacher | null
  allCourses: DashboardCourse[]
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecommendedFeatured({
  recommendedCourses,
  newCourseIds,
  featuredTeacher,
  allCourses,
}: RecommendedFeaturedProps) {
  const newIds = useMemo(() => new Set(newCourseIds), [newCourseIds])

  const displayed = recommendedCourses.slice(0, 3)

  return (
    <AnimatedSection delay={0.25}>
      <div className="space-y-6">
        {/* ── Compact Browse Banner ─────────────────────────────── */}
        <Link
          href="/dashboard/courses"
          className="group block rounded-2xl overflow-hidden"
        >
          <div className="relative bg-gradient-to-r from-terracotta/30 via-amber-900/20 to-gold/20 px-5 py-6 flex items-center justify-between gap-4">
            {/* Decorative SVG wave pattern */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]"
              preserveAspectRatio="none"
              viewBox="0 0 400 100"
            >
              <path
                d="M0,60 C50,30 100,80 150,50 C200,20 250,70 300,40 C350,10 400,60 400,60 L400,100 L0,100 Z"
                fill="currentColor"
                className="text-gold"
              />
              <path
                d="M0,75 C60,50 120,90 180,65 C240,40 300,80 400,55 L400,100 L0,100 Z"
                fill="currentColor"
                className="text-terracotta"
              />
            </svg>
            <div className="relative">
              <h3 className="text-lg font-heading font-semibold text-foreground">
                Start Your Journey
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Explore our full library of Latin music courses
              </p>
            </div>
            <Button
              size="sm"
              className="relative bg-terracotta hover:bg-terracotta/90 text-white flex-shrink-0"
              tabIndex={-1}
            >
              Browse Courses
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Link>

        {/* ── Featured Teacher Spotlight (mobile only — desktop shows in sidebar) */}
        {featuredTeacher && (
          <div className="warm-surface rounded-2xl border-l-4 border-l-terracotta p-4 sm:p-5 flex items-center gap-4 lg:hidden">
            {/* Photo */}
            <div className="flex-shrink-0">
              {featuredTeacher.image_url ? (
                <Image
                  src={featuredTeacher.image_url}
                  alt={featuredTeacher.name}
                  width={80}
                  height={80}
                  className="rounded-full w-16 h-16 sm:w-20 sm:h-20 object-cover"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-terracotta/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-terracotta" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-semibold text-foreground">
                  {featuredTeacher.name}
                </h4>
                {featuredTeacher.instrument && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-gold/10 text-gold border-gold/30"
                  >
                    {featuredTeacher.instrument}
                  </Badge>
                )}
              </div>
              {featuredTeacher.bio && (
                <p className="mt-1 text-sm text-muted-foreground leading-snug line-clamp-2">
                  {featuredTeacher.bio}
                </p>
              )}
            </div>

            {/* Sparkle accent */}
            <Sparkles className="hidden sm:block h-5 w-5 text-gold/40 flex-shrink-0" />
          </div>
        )}

        {/* ── Recommended Courses ────────────────────────────────── */}
        {displayed.length > 0 && (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-gold" />
                <h3 className="text-lg font-heading font-semibold text-foreground">
                  Recommended For You
                </h3>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href="/dashboard/courses">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {/* Course grid */}
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map((course) => (
                <StaggerItem key={course.id}>
                  <Link href={`/dashboard/course/${course.slug}`} className="group block">
                    <div className="warm-surface rounded-2xl overflow-hidden transition-all duration-200 hover:brightness-110 hover:warm-glow">
                      {/* Thumbnail */}
                      <div className="relative aspect-[4/3] bg-muted">
                        {course.thumbnail_url ? (
                          <Image
                            src={course.thumbnail_url}
                            alt={course.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* NEW badge */}
                        {newIds.has(course.id) && (
                          <span className="absolute top-2 right-2 bg-gold text-[#161210] text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shadow-sm">
                            NEW
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3 space-y-1.5">
                        <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-2 group-hover:text-gold transition-colors">
                          {course.title}
                        </h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          {course.musical_style?.name && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-5 bg-terracotta/10 text-terracotta border-terracotta/30"
                            >
                              {course.musical_style.name}
                            </Badge>
                          )}
                        </div>

                        {course.teacher?.name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {course.teacher.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        )}
      </div>
    </AnimatedSection>
  )
}
