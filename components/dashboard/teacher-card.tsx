'use client'

import { useState } from 'react'
import Image from 'next/image'
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
  MessageSquare,
  User
} from 'lucide-react'
import Link from 'next/link'
import { TiptapReadOnly } from '@/components/class-viewer/tiptap-read-only'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'

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
  bio: unknown
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
        className="overflow-hidden cursor-pointer group hover:brightness-110 transition-all duration-300 p-0 gap-0"
        onClick={() => setIsOpen(true)}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] bg-muted">
          {teacher.image_url ? (
            <Image
              src={teacher.image_url}
              alt={teacher.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-10 h-10 text-primary/40" />
              </div>
            </div>
          )}
          {/* Instrument Badge */}
          <div className="absolute top-3 left-3">
            <Badge className="bg-black/60 hover:bg-black/60 text-white border-0 backdrop-blur-sm">
              <Music className="w-3 h-3 mr-1" />
              {teacher.instrument}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2 truncate group-hover:text-primary transition-colors">
            {teacher.name}
          </h3>

          {/* Specialties */}
          {teacher.specialties && teacher.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {teacher.specialties.slice(0, 3).map((specialty) => (
                <Badge key={specialty} variant="secondary" className="text-xs font-normal">
                  {specialty}
                </Badge>
              ))}
              {teacher.specialties.length > 3 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  +{teacher.specialties.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Bio */}
          {(() => {
            const bioPreview = tiptapToPlainText(teacher.bio)
            return bioPreview ? (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {bioPreview}
              </p>
            ) : null
          })()}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{teacher.courses.length} {teacher.courses.length === 1 ? 'course' : 'courses'}</span>
            </div>
            <span className="text-xs text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
              View Profile
              <ChevronRight className="h-3 w-3" />
            </span>
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
            {teacher.bio ? (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  About
                </h3>
                <div className="text-muted-foreground leading-relaxed text-sm [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1:first-child]:mt-0 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:my-3 [&_img]:rounded-lg [&_img]:max-w-full [&_iframe]:my-3 [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg">
                  <TiptapReadOnly
                    content={
                      teacher.bio && typeof teacher.bio === 'object'
                        ? (teacher.bio as Record<string, unknown>)
                        : null
                    }
                  />
                </div>
              </div>
            ) : null}

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
