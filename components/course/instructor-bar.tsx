'use client'

import { useState } from 'react'
import { Disc3, User } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface InstructorBarProps {
  name: string
  instrument?: string | null
  imageUrl?: string | null
  /** Plain-text biography (already extracted from TipTap). */
  bio: string
}

/** Length past which the bio is collapsed behind a "Read full bio" toggle. */
const COLLAPSE_AT = 220
/** Where the collapsed preview is trimmed (trailing word is cut at a space). */
const PREVIEW_LEN = 180

function previewOf(bio: string): string {
  if (bio.length <= COLLAPSE_AT) return bio
  const slice = bio.slice(0, PREVIEW_LEN)
  const lastSpace = slice.lastIndexOf(' ')
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : PREVIEW_LEN).trimEnd()}…`
}

export function InstructorBar({ name, instrument, imageUrl, bio }: InstructorBarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const collapsible = bio.length > COLLAPSE_AT
  const preview = previewOf(bio)

  return (
    <div
      className="flex flex-col items-start gap-4 rounded-[18px] border border-border p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-6"
      style={{
        background:
          'linear-gradient(120deg, hsl(var(--primary) / 0.05), transparent 46%), hsl(var(--card))',
      }}
    >
      {/* Avatar */}
      <div className="h-[78px] w-[78px] flex-shrink-0 overflow-hidden rounded-full border-2 border-border">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" style={{ objectPosition: '50% 28%' }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/15">
            <User className="h-8 w-8 text-primary" />
          </div>
        )}
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary">
          {t('dashboard.pages.course.yourInstructor')}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-heading text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
            {name}
          </h3>
          {instrument && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Disc3 className="h-3 w-3" />
              {instrument}
            </span>
          )}
        </div>
        {bio && (
          <p className="mt-2 max-w-[78ch] text-[13.5px] leading-[1.62] text-muted-foreground">
            {collapsible && !open ? preview : bio}
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="ml-1.5 whitespace-nowrap text-[13px] font-semibold text-primary hover:text-primary/80"
              >
                {open ? t('dashboard.pages.course.showLess') : t('dashboard.pages.course.readFullBio')}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
