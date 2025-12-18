'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, ArrowRight } from 'lucide-react'

interface Course {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  difficulty: string | null
  musical_style?: { name: string } | null
  teacher?: { name: string } | null
}

interface StartLearningCardProps {
  courses: Course[]
}

export function StartLearningCard({ courses }: StartLearningCardProps) {
  const [isPaused, setIsPaused] = useState(false)

  // Duplicate courses for seamless loop
  const displayCourses = [...courses, ...courses, ...courses]

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-b from-card to-muted/30 h-[380px]">
      {/* Animated Course Boxes */}
      <div
        className="absolute inset-0 overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Row 1 - moves left, cut off at top */}
        <div
          className="flex gap-3 absolute -top-[38px] animate-marquee-left"
          style={{
            animationPlayState: isPaused ? 'paused' : 'running',
            width: 'max-content'
          }}
        >
          {displayCourses.map((course, index) => (
            <div
              key={`row1-${course.id}-${index}`}
              className="flex-shrink-0"
            >
              <div className="w-[244px] h-[135px] rounded-xl overflow-hidden bg-muted">
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
              </div>
            </div>
          ))}
        </div>

        {/* Row 2 - moves right */}
        <div
          className="flex gap-3 absolute top-[109px] animate-marquee-right"
          style={{
            animationPlayState: isPaused ? 'paused' : 'running',
            width: 'max-content'
          }}
        >
          {[...displayCourses].reverse().map((course, index) => (
            <div
              key={`row2-${course.id}-${index}`}
              className="flex-shrink-0"
            >
              <div className="w-[244px] h-[135px] rounded-xl overflow-hidden bg-muted">
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
              </div>
            </div>
          ))}
        </div>

        {/* Row 3 - moves left, cut off at bottom */}
        <div
          className="flex gap-3 absolute top-[256px] animate-marquee-left-slow"
          style={{
            animationPlayState: isPaused ? 'paused' : 'running',
            width: 'max-content'
          }}
        >
          {displayCourses.slice(0, displayCourses.length / 2).concat(displayCourses.slice(0, displayCourses.length / 2)).map((course, index) => (
            <div
              key={`row3-${course.id}-${index}`}
              className="flex-shrink-0"
            >
              <div className="w-[244px] h-[135px] rounded-xl overflow-hidden bg-muted">
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
              </div>
            </div>
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

      {/* Custom Keyframe Styles */}
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
          animation: marquee-left 59s linear infinite;
        }
        .animate-marquee-right {
          animation: marquee-right 65s linear infinite;
        }
        .animate-marquee-left-slow {
          animation: marquee-left-slow 72s linear infinite;
        }
      `}</style>
    </Card>
  )
}
