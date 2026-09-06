'use client'

import Link from 'next/link'
import {
  Award,
  BookOpen,
  Calendar,
  Crown,
  Flame,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useTranslation } from '@/components/language-provider'
import type { MilestoneItem } from '@/types/dashboard'

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Target,
  Star,
  Trophy,
  Crown,
  Flame,
  Calendar,
  Award,
  Zap,
}

export function MilestonesCard({ milestones }: { milestones: MilestoneItem[] }) {
  const { t } = useTranslation()
  if (milestones.length === 0) return null

  return (
    <section aria-labelledby="home-milestones" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-gold/[0.16] text-gold">
          <Trophy className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="home-milestones" className="text-base font-semibold">
          {t('dashboard.pages.home.nextMilestones')}
        </h2>
        <Link href="/dashboard/achievements" className="ml-auto text-xs text-muted-foreground hover:text-primary">
          {t('common.viewAll')}
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {milestones.slice(0, 3).map((m) => {
          const Icon = ICON_MAP[m.iconName] ?? Star
          return (
            <li key={m.key} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gold/[0.16] text-gold">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{m.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {m.current} / {m.requirement}
                  </span>
                </div>
                <Progress value={m.progress} className="mt-1.5 h-1" indicatorClassName="bg-gold" />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
