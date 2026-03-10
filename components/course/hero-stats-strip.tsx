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

export function HeroStatsStrip({
  progressPercentage,
  completedItems,
  totalItems,
  remainingDuration,
  difficulty,
  difficultyColor,
}: HeroStatsStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-white/10">
      {/* Progress */}
      <div className="text-center py-2">
        <p className="text-2xl lg:text-3xl font-bold font-heading">{progressPercentage}%</p>
        <div className="w-16 h-0.5 bg-muted rounded-full mx-auto mt-2 mb-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Complete</p>
      </div>

      {/* Items */}
      <div className="text-center py-2">
        <p className="text-2xl lg:text-3xl font-bold font-heading">
          {completedItems}<span className="text-muted-foreground text-lg">/{totalItems}</span>
        </p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Lessons</p>
      </div>

      {/* Remaining */}
      <div className="text-center py-2">
        <p className="text-2xl lg:text-3xl font-bold font-heading">{formatDuration(remainingDuration)}</p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Remaining</p>
      </div>

      {/* Difficulty */}
      <div className="text-center py-2">
        <p className={`text-2xl lg:text-3xl font-bold font-heading capitalize ${difficultyColor}`}>
          {difficulty || 'All'}
        </p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Level</p>
      </div>
    </div>
  )
}
