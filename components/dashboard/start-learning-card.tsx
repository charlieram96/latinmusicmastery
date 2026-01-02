'use client'

import { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, ArrowRight, Users, Music, Play } from 'lucide-react'

interface Course {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  difficulty: string | null
  description?: string | null
  musical_style?: { name: string } | null
  teacher?: { name: string } | null
}

interface StartLearningCardProps {
  courses: Course[]
}

// Fisher-Yates shuffle with seed for consistency
function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array]
  let currentSeed = seed

  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280
    return currentSeed / 233280
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function StartLearningCard({ courses }: StartLearningCardProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // Use a ref to store the seed so it's stable across renders
  const seedRef = useRef<number | null>(null)
  if (seedRef.current === null) {
    seedRef.current = Math.floor(Math.random() * 10000)
  }
  const seed = seedRef.current

  // Randomize courses with stable seed
  const randomizedCourses = useMemo(() => shuffleArray(courses, seed), [courses, seed])
  const displayCourses = useMemo(() => [...randomizedCourses, ...randomizedCourses, ...randomizedCourses], [randomizedCourses])
  const row2Courses = useMemo(() => shuffleArray(displayCourses, seed + 1), [displayCourses, seed])
  const row3Courses = useMemo(() => {
    const half = displayCourses.slice(0, displayCourses.length / 2)
    return shuffleArray([...half, ...half], seed + 2)
  }, [displayCourses, seed])

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-500/20 text-green-400 border-green-500/40'
      case 'intermediate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
      case 'advanced':
        return 'bg-red-500/20 text-red-400 border-red-500/40'
      default:
        return 'bg-white/20 text-white/80 border-white/30'
    }
  }

  const CourseCard = ({ course, cardKey, textPosition }: { course: Course; cardKey: string; textPosition: 'bottom' | 'top' }) => {
    const isHovered = hoveredCard === cardKey

    return (
      <div
        className="flex-shrink-0"
        onMouseEnter={() => setHoveredCard(cardKey)}
        onMouseLeave={() => setHoveredCard(null)}
      >
        <Link href={`/dashboard/course/${course.slug}`}>
          <div
            className={`
              w-[244px] h-[135px] rounded-xl overflow-hidden bg-muted relative
              transition-all duration-300 ease-out cursor-pointer
              ${isHovered ? 'shadow-2xl shadow-black/40 z-50' : 'z-0'}
            `}
          >
            {/* Background Image */}
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary/50" />
              </div>
            )}

            {/* Dark Overlay - appears on hover */}
            <div className={`
              absolute inset-0
              ${textPosition === 'top' ? 'bg-gradient-to-b from-black via-black/70 to-black/40' : 'bg-gradient-to-t from-black via-black/70 to-black/40'}
              transition-opacity duration-300
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `} />

            {/* Content Overlay */}
            <div className={`
              absolute inset-0 p-3 flex flex-col
              ${textPosition === 'top' ? 'justify-start' : 'justify-end'}
              transition-all duration-300 ease-out
              ${isHovered ? 'opacity-100 translate-y-0' : `opacity-0 ${textPosition === 'top' ? '-translate-y-4' : 'translate-y-4'}`}
            `}>
              {/* Badges Row */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {course.musical_style?.name && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-white/10 text-white border-white/30 backdrop-blur-sm">
                    <Music className="w-2.5 h-2.5 mr-1" />
                    {course.musical_style.name}
                  </Badge>
                )}
                {course.difficulty && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 backdrop-blur-sm ${getDifficultyColor(course.difficulty)}`}>
                    {course.difficulty}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h4 className="font-semibold text-sm text-white leading-tight line-clamp-2 mb-1">
                {course.title}
              </h4>

              {/* Teacher */}
              {course.teacher?.name && (
                <p className="text-[11px] text-white/70 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {course.teacher.name}
                </p>
              )}

              {/* Play indicator */}
              <div className={`absolute ${textPosition === 'top' ? 'bottom-3' : 'top-3'} right-3`}>
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-b from-card to-muted/30 h-[380px]">
      {/* Animated Course Boxes */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Row 1 - moves left, cut off at top */}
        <div
          className="flex gap-3 absolute -top-[38px] animate-marquee-left"
          style={{ width: 'max-content' }}
        >
          {displayCourses.map((course, index) => (
            <CourseCard
              key={`row1-${course.id}-${index}`}
              course={course}
              cardKey={`row1-${course.id}-${index}`}
              textPosition="bottom"
            />
          ))}
        </div>

        {/* Row 2 - moves right */}
        <div
          className="flex gap-3 absolute top-[109px] animate-marquee-right"
          style={{ width: 'max-content' }}
        >
          {row2Courses.map((course, index) => (
            <CourseCard
              key={`row2-${course.id}-${index}`}
              course={course}
              cardKey={`row2-${course.id}-${index}`}
              textPosition="bottom"
            />
          ))}
        </div>

        {/* Row 3 - moves left, cut off at bottom */}
        <div
          className="flex gap-3 absolute top-[256px] animate-marquee-left-slow"
          style={{ width: 'max-content' }}
        >
          {row3Courses.map((course, index) => (
            <CourseCard
              key={`row3-${course.id}-${index}`}
              course={course}
              cardKey={`row3-${course.id}-${index}`}
              textPosition="top"
            />
          ))}
        </div>
      </div>

      {/* Gradient Overlay for Text Contrast */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card via-card/60 to-transparent pointer-events-none" />

      {/* Text Content at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Start Your Journey</h3>
          <p className="text-sm text-muted-foreground">Explore expert-led Latin music courses</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/courses">
            Browse Courses
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Custom Keyframe Styles - 50% slower (1.5x duration) */}
      <style jsx>{`
        @keyframes marquee-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.33%);
          }
        }
        @keyframes marquee-right {
          0% {
            transform: translateX(-33.33%);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes marquee-left-slow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee-left {
          animation: marquee-left 88s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 98s linear infinite;
        }
        .animate-marquee-left-slow {
          animation: marquee-left-slow 108s linear infinite;
        }
      `}</style>
    </Card>
  )
}
