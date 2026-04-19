'use client'

import Image from 'next/image'
import { Users, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { FeaturedTeacher } from '@/types/dashboard'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'

interface FeaturedTeacherSpotlightProps {
  teacher: FeaturedTeacher
}

export function FeaturedTeacherSpotlight({
  teacher,
}: FeaturedTeacherSpotlightProps) {
  return (
    <AnimatedSection delay={0.25}>
      <div className="warm-surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Featured Teacher
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Photo */}
          {teacher.image_url ? (
            <Image
              src={teacher.image_url}
              alt={teacher.name}
              width={56}
              height={56}
              className="rounded-full w-14 h-14 object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-terracotta/20 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-terracotta" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground">
                {teacher.name}
              </h4>
              {teacher.instrument && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 bg-gold/10 text-gold border-gold/30"
                >
                  {teacher.instrument}
                </Badge>
              )}
            </div>
            {(() => {
              const bioPreview = tiptapToPlainText(teacher.bio)
              return bioPreview ? (
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
                  {bioPreview}
                </p>
              ) : null
            })()}
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}
