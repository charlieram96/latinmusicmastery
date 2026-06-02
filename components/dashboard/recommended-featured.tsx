'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Users, ArrowRight, Sparkles } from 'lucide-react'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'
import { CourseCoverCard } from '@/components/dashboard/course-cover-card'
import type { DashboardCourse, FeaturedTeacher } from '@/types/dashboard'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'

/* ------------------------------------------------------------------ */
/*  Props — newCourseIds arrives as string[] (Sets can't serialize)    */
/* ------------------------------------------------------------------ */

interface RecommendedFeaturedProps {
  recommendedCourses: DashboardCourse[]
  newCourseIds: string[]
  featuredTeacher: FeaturedTeacher | null
  allCourses: DashboardCourse[]
}

/** Difficulty → badge styling (green / amber / red), matching the design. */
function difficultyBadge(
  difficulty?: string | null
): { text: string; className: string } | undefined {
  if (!difficulty) return undefined
  const d = difficulty.toLowerCase()
  if (d === 'beginner')
    return { text: 'Beginner', className: 'bg-emerald-500/85 text-white' }
  if (d === 'intermediate')
    return { text: 'Intermediate', className: 'bg-amber-500/90 text-neutral-900' }
  if (d === 'advanced')
    return { text: 'Advanced', className: 'bg-red-500/85 text-white' }
  return { text: difficulty, className: 'bg-secondary text-foreground' }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecommendedFeatured({
  recommendedCourses,
  newCourseIds,
  featuredTeacher,
}: RecommendedFeaturedProps) {
  const newIds = useMemo(() => new Set(newCourseIds), [newCourseIds])

  const displayed = recommendedCourses.slice(0, 3)

  return (
    <AnimatedSection delay={0.25}>
      <div className="space-y-6">
        {/* ── Featured Teacher (mobile only — desktop shows in sidebar) ── */}
        {featuredTeacher && (
          <div className="flex items-center gap-4 rounded-2xl border-l-4 border-l-terracotta border-y border-r border-border bg-card p-4 sm:p-5 lg:hidden">
            <div className="flex-shrink-0">
              {featuredTeacher.image_url ? (
                <Image
                  src={featuredTeacher.image_url}
                  alt={featuredTeacher.name}
                  width={80}
                  height={80}
                  className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/20 sm:h-20 sm:w-20">
                  <Users className="h-6 w-6 text-terracotta" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-foreground">
                  {featuredTeacher.name}
                </h4>
                {featuredTeacher.instrument && (
                  <Badge
                    variant="outline"
                    className="h-5 border-gold/30 bg-gold/10 px-1.5 py-0 text-[10px] text-gold"
                  >
                    {featuredTeacher.instrument}
                  </Badge>
                )}
              </div>
              {(() => {
                const bioPreview = tiptapToPlainText(featuredTeacher.bio)
                return bioPreview ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                    {bioPreview}
                  </p>
                ) : null
              })()}
            </div>

            <Sparkles className="hidden h-5 w-5 flex-shrink-0 text-gold/40 sm:block" />
          </div>
        )}

        {/* ── Recommended Courses ────────────────────────────────── */}
        {displayed.length > 0 && (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="inline-flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Recommended for you
              </h2>
              <Link
                href="/dashboard/courses"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Course grid */}
            <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map((course) => {
                const badge = newIds.has(course.id)
                  ? { text: 'New', className: 'bg-gold text-[#161210]' }
                  : difficultyBadge(course.difficulty)
                return (
                  <StaggerItem key={course.id}>
                    <CourseCoverCard
                      href={`/dashboard/course/${course.slug}`}
                      title={course.title}
                      thumbnailUrl={course.thumbnail_url}
                      teacherName={course.teacher?.name}
                      badge={badge}
                    />
                  </StaggerItem>
                )
              })}
            </StaggerContainer>
          </div>
        )}
      </div>
    </AnimatedSection>
  )
}
