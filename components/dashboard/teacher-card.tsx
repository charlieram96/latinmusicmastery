'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Music,
  Mail,
  BookOpen,
  Video,
  ChevronRight,
  ExternalLink,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'

interface Course {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  musical_style: { name: string } | null
}

interface Teacher {
  id: string
  name: string
  image_url: string | null
  instrument: string
  bio: string | null
  email: string | null
  specialties: string[] | null
  courses: Course[]
}

interface TeacherCardProps {
  teacher: Teacher
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TeacherCard({ teacher }: TeacherCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Card
        className="overflow-hidden cursor-pointer hover:bg-secondary/30 transition-colors group"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <Avatar className="w-24 h-24 mb-4 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
              {teacher.image_url && (
                <AvatarImage src={teacher.image_url} alt={teacher.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                {getInitials(teacher.name)}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">
              {teacher.name}
            </h3>

            {/* Primary Instrument */}
            <div className="flex items-center gap-1.5 text-primary text-sm mb-3">
              <Music className="w-4 h-4" />
              <span className="font-medium">{teacher.instrument}</span>
            </div>

            {/* Specialties (limited) */}
            {teacher.specialties && teacher.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
                {teacher.specialties.slice(0, 3).map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {teacher.specialties.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{teacher.specialties.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Bio Preview */}
            {teacher.bio && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {teacher.bio}
              </p>
            )}

            {/* Course Count & View More */}
            <div className="flex items-center justify-between w-full mt-auto pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {teacher.courses.length} {teacher.courses.length === 1 ? 'course' : 'courses'}
              </span>
              <span className="text-xs text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                View Profile
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expanded Profile Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{teacher.name}'s Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="w-28 h-28 ring-4 ring-primary/10">
                {teacher.image_url && (
                  <AvatarImage src={teacher.image_url} alt={teacher.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-semibold">
                  {getInitials(teacher.name)}
                </AvatarFallback>
              </Avatar>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold mb-2">{teacher.name}</h2>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-primary mb-3">
                  <Music className="w-5 h-5" />
                  <span className="font-semibold text-lg">{teacher.instrument}</span>
                </div>

                {/* Specialties */}
                {teacher.specialties && teacher.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {teacher.specialties.map((specialty) => (
                      <Badge key={specialty} variant="secondary">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {teacher.bio && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  About
                </h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {teacher.bio}
                </p>
              </div>
            )}

            {/* Courses */}
            {teacher.courses.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Courses by {teacher.name.split(' ')[0]}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {teacher.courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/course/${course.slug || course.id}`}
                      onClick={() => setIsOpen(false)}
                      className="group"
                    >
                      <Card className="overflow-hidden hover:bg-secondary/30 transition-colors">
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-16 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                            {course.thumbnail_url ? (
                              <img
                                src={course.thumbnail_url}
                                alt={course.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                <BookOpen className="h-5 w-5 text-primary/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {course.title}
                            </p>
                            {course.musical_style && (
                              <p className="text-xs text-muted-foreground">
                                {course.musical_style.name}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button asChild className="flex-1">
                <Link href="/dashboard/feedback" onClick={() => setIsOpen(false)}>
                  <Video className="h-4 w-4 mr-2" />
                  Request Feedback
                </Link>
              </Button>
              {teacher.email && (
                <Button variant="outline" asChild className="flex-1">
                  <a href={`mailto:${teacher.email}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Teacher
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
