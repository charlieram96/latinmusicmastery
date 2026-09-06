'use client'

import Link from 'next/link'
import { AudioWaveform, Drum } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

export function ToolTiles() {
  const { t } = useTranslation()
  const base = 'dashboard.pages.home.tools'
  const tiles = [
    { href: '/dashboard/tuner', icon: AudioWaveform, name: t(`${base}.tuner`), body: t(`${base}.tunerBody`), tint: 'bg-primary/[0.14] text-primary' },
    { href: '/dashboard/play-sense', icon: Drum, name: t(`${base}.playSense`), body: t(`${base}.playSenseBody`), tint: 'bg-terracotta/[0.16] text-terracotta' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {tiles.map(({ href, icon: Icon, name, body, tint }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
        >
          <span className={`grid h-7 w-7 place-items-center rounded-md ${tint}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block font-heading text-base font-bold tracking-tight">{name}</span>
            <span className="block text-xs text-muted-foreground">{body}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
