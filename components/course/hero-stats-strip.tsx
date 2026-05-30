'use client'

interface HeroStatsStripProps {
  progressPercentage: number
  completedItems: number
  totalItems: number
  remainingDuration: number
  difficulty: string
  difficultyColor: string
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

function Stat({
  value,
  sub,
  label,
  valueClassName,
}: {
  value: string | number
  sub?: string | number
  label: string
  valueClassName?: string
}) {
  return (
    <div className="bg-card/80 px-4 py-7 text-center backdrop-blur-xl">
      <div
        className={`font-heading text-[40px] font-extrabold leading-none tracking-[-0.03em] text-foreground ${valueClassName ?? ''}`}
      >
        {value}
        {sub != null && <span className="text-[22px] font-bold text-muted-foreground/70">/{sub}</span>}
      </div>
      <div className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

export function HeroStatsStrip({
  progressPercentage,
  completedItems,
  totalItems,
  remainingDuration,
  difficulty,
  difficultyColor,
}: HeroStatsStripProps) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
      <Stat value={`${progressPercentage}%`} label="Complete" />
      <Stat value={completedItems} sub={totalItems} label="Lessons" />
      <Stat value={formatDuration(remainingDuration)} label="Remaining" />
      <Stat value={difficulty || 'All'} label="Level" valueClassName={`capitalize ${difficultyColor}`} />
    </div>
  )
}
