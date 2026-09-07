'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Crown, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { coverStyle } from '@/lib/course-covers'
import type { MasterClassSummary } from '@/types/dashboard'

export function MasterClassCard({ masterClass }: { masterClass: MasterClassSummary | null }) {
  const { t } = useTranslation()
  if (!masterClass) return null

  return (
    <section aria-labelledby="home-masterclass" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gold/[0.16] text-gold">
          <Crown className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="home-masterclass" className="text-base font-semibold">
          {t('dashboard.pages.home.masterClass.label')}
        </h2>
      </div>
      <Link
        href={masterClass.href}
        className="relative flex h-16 items-center gap-3 overflow-hidden rounded-lg px-3.5 text-white"
        style={masterClass.thumbnailUrl ? undefined : { background: coverStyle(masterClass.styleName) }}
      >
        {masterClass.thumbnailUrl && (
          <Image src={masterClass.thumbnailUrl} alt="" fill sizes="340px" className="object-cover" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
        <span className="relative min-w-0">
          <span className="block truncate text-sm font-semibold">{masterClass.title}</span>
          {masterClass.teacherName && <span className="block truncate text-xs text-white/75">{masterClass.teacherName}</span>}
        </span>
      </Link>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href={masterClass.href}>
          <Play className="h-3.5 w-3.5 fill-current" />
          {t('dashboard.pages.home.masterClass.watch')}
        </Link>
      </Button>
    </section>
  )
}
