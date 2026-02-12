'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from 'lucide-react'

interface MasterClassCourse {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  difficulty: string | null
  teacher_name: string | null
  teacher_image_url: string | null
  instrument: string | null
  musical_style: { name: string } | null
}

interface MasterClassCardProps {
  course: MasterClassCourse
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty?.toLowerCase()) {
    case 'beginner':
      return 'bg-green-500/20 text-green-400 border-green-500/40'
    case 'intermediate':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
    case 'advanced':
      return 'bg-red-500/20 text-red-400 border-red-500/40'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function MasterClassCard({ course }: MasterClassCardProps) {
  return (
    <Link href={`/dashboard/course/${course.slug || course.id}`}>
      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-0 shadow-md p-0 gap-0">
        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-amber-500/10 to-orange-500/5">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/5">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <User className="w-8 h-8 text-amber-500/40" />
              </div>
            </div>
          )}

          {/* Teacher avatar overlay */}
          <div className="absolute bottom-3 left-3">
            <Avatar className="h-10 w-10 ring-2 ring-white shadow-md">
              {course.teacher_image_url && (
                <AvatarImage src={course.teacher_image_url} alt={course.teacher_name || 'Teacher'} />
              )}
              <AvatarFallback className="bg-amber-500/20 text-amber-700 text-xs font-semibold">
                {course.teacher_name ? getInitials(course.teacher_name) : '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          {/* Teacher name + instrument */}
          {(course.teacher_name || course.instrument) && (
            <p className="text-xs font-medium text-muted-foreground font-mono tracking-wide uppercase mb-1.5">
              {course.teacher_name || 'Instructor'}
              {course.instrument && ` \u00B7 ${course.instrument}`}
            </p>
          )}

          {/* Course title */}
          <h3 className="font-heading font-semibold text-base mb-3 line-clamp-2 group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {course.difficulty && (
              <Badge variant="outline" className={`text-xs ${getDifficultyColor(course.difficulty)}`}>
                {course.difficulty}
              </Badge>
            )}
            {course.musical_style && (
              <Badge variant="secondary" className="text-xs font-normal">
                {course.musical_style.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
