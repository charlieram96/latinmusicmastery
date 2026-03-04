'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { BookOpen, Play, GraduationCap } from 'lucide-react'
import { getInstrumentColor } from '@/lib/instruments'

interface MyCourseCardProps {
  course: {
    id: string
    title: string
    slug?: string
    thumbnail_url?: string | null
    instrument?: string | null
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

function ProgressRing({ percent, size = 28, strokeWidth = 2.5 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  const isComplete = percent === 100

  return (
    <svg width={size} height={size} className="drop-shadow-sm">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isComplete ? '#22c55e' : '#f59e0b'}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      {/* Percentage text */}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={size * 0.28}
        fontWeight="600"
        className="tabular-nums"
      >
        {percent}
      </text>
    </svg>
  )
}

export function MyCourseCard({ course, index }: MyCourseCardProps) {
  const progressPercent = course.totalLessons > 0
    ? Math.round((course.completedLessons / course.totalLessons) * 100)
    : 0
  const isComplete = progressPercent === 100
  const isStarted = progressPercent > 0
  const hasSections = course.totalSections > 0

  const accentColor = isComplete
    ? 'bg-green-500'
    : isStarted
      ? 'bg-amber-500'
      : 'bg-muted-foreground/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3 }}
    >
      <Link href={`/dashboard/course/${course.slug || course.id}`} className="group block">
        <Card className="overflow-hidden h-full p-0 gap-0 relative transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-black/20">
          {/* Left accent stripe */}
          <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentColor} z-10`} />

          {/* Thumbnail — 4:3 landscape */}
          <div className="relative aspect-[4/3] bg-muted overflow-hidden">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary/50" />
              </div>
            )}

            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Instrument badge — top-left */}
            {course.instrument && (
              <span className={`absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${getInstrumentColor(course.instrument)}`}>
                {course.instrument}
              </span>
            )}

            {/* Style badge — frosted pill, top-right */}
            {course.musical_style?.name && (
              <span className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                {course.musical_style.name}
              </span>
            )}

            {/* Circular progress ring — bottom-right */}
            {course.totalLessons > 0 && (
              <div className="absolute bottom-1.5 right-1.5">
                <ProgressRing percent={progressPercent} size={40} strokeWidth={3} />
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="p-2.5 flex flex-col flex-1">
            {/* Teacher row */}
            {course.teacher && (
              <div className="flex items-center gap-1.5 mb-1">
                {course.teacher.image_url ? (
                  <img
                    src={course.teacher.image_url}
                    alt={course.teacher.name}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <GraduationCap className="h-2.5 w-2.5 text-primary" />
                  </div>
                )}
                <span className="text-xs text-muted-foreground truncate">
                  {course.teacher.name}
                </span>
              </div>
            )}

            {/* Title */}
            <h3 className="font-semibold text-sm font-heading line-clamp-2 mb-1.5 group-hover:text-primary transition-colors leading-tight">
              {course.title}
            </h3>

            {/* Module info — compact */}
            {isComplete ? (
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-xs font-medium text-green-500">Complete</span>
              </div>
            ) : hasSections && course.currentSectionTitle ? (
              <div className="mb-1.5 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Mod {course.currentSectionIndex}/{course.totalSections}
                </p>
                {course.currentClassTitle && (
                  <div className="flex items-center gap-1">
                    <Play className="h-2.5 w-2.5 text-primary flex-shrink-0" />
                    <span className="text-xs text-foreground line-clamp-2 leading-tight">
                      {course.currentClassTitle}
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Thin progress bar + item count */}
            <div className="mt-auto">
              <div className="relative w-full h-0.5 bg-primary/15 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                {course.completedLessons}/{course.totalLessons} items
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
