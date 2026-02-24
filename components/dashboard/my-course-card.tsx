'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { BookOpen, Play, CheckCircle2, Circle } from 'lucide-react'
import { GraduationCap } from 'lucide-react'

interface MyCourseCardProps {
  course: {
    id: string
    title: string
    slug?: string
    thumbnail_url?: string | null
    totalLessons: number
    completedLessons: number
    currentSectionTitle: string | null
    currentSectionIndex: number | null
    totalSections: number
    currentClassTitle: string | null
    currentClassId: string | null
    musical_style?: { name: string; country?: { name: string } } | null
    teacher?: { name: string; image_url?: string | null } | null
  }
  index: number
}

export function MyCourseCard({ course, index }: MyCourseCardProps) {
  const progressPercent = course.totalLessons > 0
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0
  const isComplete = progressPercent === 100
  const isStarted = progressPercent > 0
  const hasSections = course.totalSections > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4 }}
    >
      <Link href={`/dashboard/course/${course.slug || course.id}`} className="group block">
        <Card className="overflow-hidden h-full p-0 gap-0 transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/20">
          {/* Accent bar */}
          <div className={`h-0.5 ${isComplete ? 'bg-green-500' : 'bg-primary'}`} />

          {/* Thumbnail */}
          <div className="relative aspect-[16/10] bg-muted overflow-hidden">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary/50" />
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Teacher avatar - bottom left */}
            {course.teacher && (
              <div className="absolute bottom-2 left-2">
                {course.teacher.image_url ? (
                  <img
                    src={course.teacher.image_url}
                    alt={course.teacher.name}
                    className="h-6 w-6 rounded-full object-cover ring-2 ring-card"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-card">
                    <GraduationCap className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            )}

            {/* Style badge - bottom right */}
            {course.musical_style?.name && (
              <span className="absolute bottom-2 right-2 bg-white/15 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                {course.musical_style.name}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="p-3 flex flex-col flex-1">
            {/* Title */}
            <h3 className="font-semibold text-sm font-heading line-clamp-1 mb-2 group-hover:text-primary transition-colors">
              {course.title}
            </h3>

            {/* Progress block */}
            {isComplete ? (
              /* Complete state */
              <div className="bg-green-500/10 rounded-lg p-2.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-green-500">Course Complete</span>
                </div>
                <p className="text-[10px] text-green-500/70 mt-1">
                  All {course.totalLessons} items completed
                </p>
              </div>
            ) : hasSections && course.currentSectionTitle ? (
              /* In-progress / not started state with module info */
              <div className="bg-muted/50 rounded-lg p-2.5 mb-2">
                {/* Module line */}
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Module {course.currentSectionIndex} of {course.totalSections}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Circle className="h-2 w-2 fill-amber-500 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-foreground truncate">
                    {course.currentSectionTitle}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-border/50 my-1.5" />

                {/* Up next / Start here */}
                <p className="text-[10px] uppercase tracking-wider text-primary font-medium">
                  {isStarted ? 'Up Next' : 'Start Here'}
                </p>
                {course.currentClassTitle && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Play className="h-2 w-2 text-primary flex-shrink-0" />
                    <span className="text-xs text-foreground truncate">
                      {course.currentClassTitle}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* No sections fallback */
              <div className="bg-muted/50 rounded-lg p-2.5 mb-2">
                <p className="text-xs text-muted-foreground">Content coming soon</p>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-auto">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 h-1 bg-primary/20 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isComplete
                        ? 'bg-gradient-to-r from-green-500/80 to-green-500'
                        : 'bg-gradient-to-r from-primary/80 to-primary'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                  {/* Glow dot at progress point */}
                  {progressPercent > 0 && progressPercent < 100 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_1px] shadow-primary/50"
                      style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%)` }}
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-7 text-right">
                  {progressPercent}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {course.completedLessons} of {course.totalLessons} items
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
